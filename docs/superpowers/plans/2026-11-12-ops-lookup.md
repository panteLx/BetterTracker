# OPS Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Cases page that searches OPS codes (by code or description) and shows billing codes, §115b and Hybrid-DRG status plus an "AOP not possible" warning, fed by two admin-uploaded Excel files.

**Architecture:** Two new tables (`ops_codes` from Anhang 2, `ops_hybrid_codes` from the Hybrid-DRG list) are replaced wholesale on upload inside one transaction after validation. Dataset metadata and the four fixed codes live in the existing `app_settings` table under their own keys, handled by the OPS service only (not added to `DEFAULT_SETTINGS`, so the generic admin settings route cannot write them). A pure rule function decides AOP eligibility and is shared by server and UI. The page follows the existing guard → service → `lib/http.ts` route pattern and the server-prefetch + `HydrationBoundary` page pattern.

**Tech Stack:** Next.js (pinned, see `AGENTS.md`), Drizzle + better-sqlite3, Zod, TanStack Query, next-intl, shadcn/ui, `read-excel-file` (new dependency, `read-excel-file/node`).

**Spec:** `docs/superpowers/specs/2026-11-12-ops-lookup-design.md`

## Global Constraints

- No test runner exists. Verify with `npm run lint`, `npm run build`, one-off `npx tsx` scripts (do not commit them) and browser checks (Playwright MCP `playwright`). Do not invent test commands.
- Code comments in English, short and sparse. UI strings in both `messages/en-US/cases.json` and `messages/de-DE/cases.json` (new keys under a `ops` object; no new namespace needed).
- Commit messages Conventional Commits, no Claude attribution.
- AOP rule (verbatim from spec): AOP billing is *not possible* if `§115b = "-"` OR the code is Hybrid-DRG-eligible; reasons shown for every condition that applies; codes stay visible but greyed out.
- Fixed codes and defaults: Arztbrief per Post `40110`, Arztbrief per Fax `40111`, Pauschale bis 59 Jahre `07211`, Pauschale ab 59 Jahre `07212`. Keep as strings (leading zero).
- Only global admins (`isAdminRole`: admin, superadmin) may upload or edit fixed codes; all users with Cases access may search.
- Upload replaces the dataset entirely; validation happens before any deletion; failure leaves old data untouched.
- Hybrid match is on the exact OPS string only (the list contains rows like `5-530.0x`).
- Anhang 2 columns used (match by normalized header text, trimmed, whitespace collapsed, case-insensitive; ignore all other columns): `OPS 2026` (any year, pattern `^ops \d{4}$`), `Bezeichnung OPS 2026` (pattern `^bezeichnung ops`), `ambulante Operation`, `Überwachungs-komplex ambulant`, `ambulante Anästhesie`, `Zuschlag Förderung`, `§115b`, `Zuschlag für den zusätzlichen Hygieneaufwand`. Hybrid list columns: `OPS 2026` (same pattern), `OPS-Bezeichnung 2026` (pattern `^ops-bezeichnung`).
- Cell values are read as trimmed strings (numeric cells converted with `String`, no number formatting); empty → `null`.
- Sample files for manual verification: `/home/admin/.claude/uploads/d02deed9-6ef5-4207-92de-2cba560d0fe1/3c950824-Anhang2.xlsx` (11,228 rows) and `.../807ef2f7-HybridDRG.xlsx` (904 rows). Known row: `5-530.00` → op `31153`, Überwachung `31505`, Förderung `31454`, Hygiene `31056`, Anästhesie `31823`, §115b `Ja`, Hybrid yes.

## Review Focus

- Searching `5530` or `5-530` finds `5-530.00…` (hyphen/dot-insensitive code match), and `hernia inguinalis` finds by description; two words both must match.
- Upload with a missing required column, a wrong sheet (empty), or a non-xlsx file → 400 with a readable message, old data and dataset info unchanged.
- Upload of a very large/duplicated-code Anhang 2 → duplicate OPS codes in one file: last row wins or the upload is rejected, never a 500 from a unique-constraint error.
- Funding surcharge empty (`Zuschlag Förderung` blank) → shows "–", not "null" or "undefined".
- Non-admin calling the upload or fixed-code endpoint → 403; non-Cases user calling search → 403.
- Search with no data uploaded yet → empty state telling the admin to upload files, not an error; hybrid list empty/missing → code not treated as Hybrid-DRG but a notice says the list is missing.
- Fixed code edit with empty or non-numeric text → rejected (digits only, 1–10 chars).

---

### Task 1: Schema, migration, dependency

**Files:**
- Modify: `lib/db/schema.ts` (add `opsCodes` and `opsHybridCodes` after `letterChecks`)
- Create: `drizzle/<generated>.sql` via `npm run db:generate`
- Modify: `package.json`, `package-lock.json` (`npm install read-excel-file`)

**Interfaces:**
- Produces: `opsCodes` table `ops_codes`: `opsCode` text primary key; `description` text notNull; `operation`, `monitoring`, `anesthesia`, `funding`, `hygiene` text nullable; `aop115b` integer boolean notNull (true when the §115b cell is `Ja`, case-insensitive); no timestamps needed.
- Produces: `opsHybridCodes` table `ops_hybrid_codes`: `opsCode` text primary key; `description` text notNull.

- [ ] **Step 1: Add both tables to `lib/db/schema.ts` as specified.**
- [ ] **Step 2: Run `npm install read-excel-file`, then `npm run db:generate`; confirm the new SQL contains only the two `CREATE TABLE`s.**
- [ ] **Step 3: Run `npm run db:migrate` and `npm run lint`. Expected: migration applies, lint clean.**
- [ ] **Step 4: Commit** `feat(cases): add OPS lookup tables`

---

### Task 2: Excel parsing and AOP rule

**Files:**
- Create: `lib/ops/parse.ts`
- Create: `lib/ops/aop-rule.ts`

**Interfaces:**
- Consumes: `ValidationError` from `lib/errors.ts`; `readSheet` from `read-excel-file/node`.
- Produces (`lib/ops/parse.ts`):
  - `type OpsEntry = { opsCode: string; description: string; operation: string | null; monitoring: string | null; anesthesia: string | null; funding: string | null; hygiene: string | null; aop115b: boolean }`
  - `type HybridEntry = { opsCode: string; description: string }`
  - `parseAnhang2(bytes: Buffer): Promise<OpsEntry[]>` — finds the header row among the first 10 rows, resolves columns by the matchers in Global Constraints, skips rows without an OPS code, de-duplicates by `opsCode` (last wins). Throws `ValidationError` naming every missing column, or when there are no data rows or the bytes are not a readable xlsx.
  - `parseHybridList(bytes: Buffer): Promise<HybridEntry[]>` — same approach for the hybrid columns.
- Produces (`lib/ops/aop-rule.ts`, no server-only imports so the client can use it):
  - `type AopReason = "no115b" | "hybridDrg"`
  - `getAopEligibility(input: { aop115b: boolean; hybridDrg: boolean }): { allowed: boolean; reasons: AopReason[] }` — `allowed` only if both reasons are absent; `reasons` in the order `no115b`, `hybridDrg`.

- [ ] **Step 1: Implement `lib/ops/aop-rule.ts` with the signature above.**
- [ ] **Step 2: Implement `lib/ops/parse.ts`. Check the exact `readSheet` input types in `node_modules/read-excel-file` docs (Buffer vs path vs stream) and convert if needed.**
- [ ] **Step 3: Write a throwaway script (outside the repo or uncommitted) that runs both parsers on the sample files and asserts: Anhang 2 yields > 10,000 entries and the `5-530.00` row equals the known values in Global Constraints with `aop115b === true`; Hybrid list has 904 entries including `5-530.00`; `getAopEligibility({ aop115b: true, hybridDrg: true })` returns `{ allowed: false, reasons: ["hybridDrg"] }` and `{ aop115b: false, hybridDrg: true }` returns both reasons. Also assert `parseAnhang2(Buffer.from("not xlsx"))` rejects with `ValidationError`. Run with `npx tsx <script>`. Expected: all assertions pass.**
- [ ] **Step 4: Run `npm run lint`. Commit** `feat(cases): parse OPS Excel files and AOP rule`

---

### Task 3: OPS service and validators

**Files:**
- Create: `lib/services/ops-service.ts`
- Create: `lib/validators/ops.ts`

**Interfaces:**
- Consumes: Task 1 tables, Task 2 parsers and `getAopEligibility`; `db` from `lib/db`; `appSettings`.
- Produces (validators): `opsSearchQuerySchema` — `{ q: z.string().trim().max(100).default("") }`; `opsFixedCodesSchema` — object `{ letterPost, letterFax, flatUnder60, flatFrom60 }`, each `z.string().trim().regex(/^\d{1,10}$/)`, `.strict()`.
- Produces (service):
  - `type OpsFixedCodes = z.infer<typeof opsFixedCodesSchema>`; `DEFAULT_OPS_FIXED_CODES: OpsFixedCodes` = `{ letterPost: "40110", letterFax: "40111", flatUnder60: "07211", flatFrom60: "07212" }`
  - `type OpsResult = OpsEntry & { hybridDrg: boolean }` (field names as in Task 2)
  - `type OpsDatasetInfo = { anhang2: { fileName: string; uploadedAt: string; rowCount: number } | null; hybrid: { fileName: string; uploadedAt: string; rowCount: number } | null }`
  - `searchOps(query: string): Promise<{ items: OpsResult[]; total: number }>` — empty query returns `{ items: [], total: 0 }`; otherwise split on whitespace, every term must match `ops_code` (hyphens/dots removed on both sides) or `description` (case-insensitive `LIKE`, escape `%` and `_`); order by `ops_code`; limit 50, `total` is the unlimited count.
  - `getOpsOverview(): Promise<{ fixedCodes: OpsFixedCodes; dataset: OpsDatasetInfo }>`
  - `replaceAnhang2(bytes: Buffer, fileName: string, userId: string): Promise<OpsDatasetInfo>` and `replaceHybridList(...)` same shape — parse first, then delete + chunked insert (≤ 500 rows per statement; SQLite variable limit) and update the metadata setting in one `db.transaction`.
  - `updateFixedCodes(input: OpsFixedCodes, userId: string): Promise<OpsFixedCodes>`
  - Settings keys: `opsDatasetInfo`, `opsFixedCodes` (JSON in `app_settings.valueJson`, same upsert shape as `setSetting` in `lib/services/admin-settings-service.ts`).

- [ ] **Step 1: Implement validators and service as specified; read `setSetting` in `lib/services/admin-settings-service.ts` and mirror its upsert for the two keys.**
- [ ] **Step 2: Throwaway `npx tsx` script against a scratch DB (`DATABASE_URL=file:./data/ops-test.db`, migrate first, delete the file afterwards): call `replaceAnhang2` and `replaceHybridList` with the sample files, then assert `searchOps("5530")` and `searchOps("5-530")` both include `5-530.00` with `hybridDrg === true`, `searchOps("hernia inguinalis")` returns > 0, `searchOps("")` returns `{ items: [], total: 0 }`; a failed re-upload (`Buffer.from("x")`) leaves `searchOps("5-530.00")` unchanged; `getOpsOverview().fixedCodes` equals the defaults. Expected: all pass.**
- [ ] **Step 3: Run `npm run lint`. Commit** `feat(cases): add OPS service`

---

### Task 4: API routes

**Files:**
- Create: `app/api/ops/route.ts` (GET `?q=`: search + overview)
- Create: `app/api/ops/upload/route.ts` (POST multipart: `kind` = `anhang2` | `hybrid`, `file`)
- Create: `app/api/ops/fixed-codes/route.ts` (PUT JSON)

**Interfaces:**
- Consumes: Task 3 service/validators; `requireCaseModuleApi` (`lib/auth/case-workspace-guards.ts`) for GET; `requireAdmin` (`lib/auth/guards.ts`) for POST/PUT — but admin must additionally have Cases access? No: admin role alone is sufficient (spec says admins). `logAuditEvent` + `getRequestAuditContext`; `ok`, `badRequest`, `mapServiceError`.
- Produces: GET → `{ items, total, fixedCodes, dataset }`; POST → `{ dataset }`; PUT → `{ fixedCodes }`. Audit actions `ops_dataset_uploaded` (metadata `{ kind, fileName, rowCount }`) and `ops_fixed_codes_updated` (metadata with old and new values).

- [ ] **Step 1: Implement the three routes in the existing pattern (guard → service → response helpers). Upload: reject missing file, unknown `kind`, and files over 10 MB with 400; accept by extension `.xlsx` and let the parser reject bad content.**
- [ ] **Step 2: Run `npm run build`; then with the dev server and an admin session, check via Playwright or `curl` with a session cookie: GET without login → 401; GET as non-Cases user → 403; POST/PUT as normal user → 403; admin upload of both sample files → 200 with row counts 11,228-ish / 904; upload of a `.txt` renamed `.xlsx` → 400 and data intact. Expected: as listed.**
- [ ] **Step 3: Commit** `feat(cases): add OPS lookup API`

---

### Task 5: Page, UI and navigation

**Files:**
- Create: `app/cases/[workspaceId]/ops/page.tsx` (server component; mirror `app/cases/[workspaceId]/invoices/page.tsx`: `requireCaseModuleUser`, workspace access check, prefetch `["ops", ""]` via `getOpsOverview` plus empty search result and `["case-workspaces"]`)
- Create: `components/cases/ops-client.tsx` (search input with debounce ~250 ms, result list, detail card, copy buttons)
- Create: `components/cases/ops-admin-panel.tsx` (shown only when `isAdminRole(user.role)`: two upload controls with dataset info, fixed-code edit form)
- Modify: `components/layout/cases-header.tsx` (`workspaceNavItems`: add `{ href: .../ops, key: "ops", icon: Search-like lucide icon, exact: false }` before `settings`)
- Modify: `components/layout/cases-mobile-nav.tsx` only if the extra item breaks its layout (its comment says four destinations split 2/2 around the center button); check at phone width and adapt minimally.
- Modify: `messages/en-US/cases.json`, `messages/de-DE/cases.json` (`nav.ops`, `ops.*`: title, description, search placeholder, result count, empty/no-data states, field labels, AOP messages, admin panel texts, errors)

**Interfaces:**
- Consumes: Task 4 routes; `getAopEligibility` from `lib/ops/aop-rule.ts`; `fetchJson` from `lib/client-fetch.ts`.
- Produces: page route `/cases/[workspaceId]/ops`; query key `["ops", q]` for search results and `["ops-overview"]` for dataset info and fixed codes (invalidate both after upload or fixed-code save).

- [ ] **Step 1: Add i18n keys in both locales (German is the primary copy: "AOP abrechenbar" / "AOP-Abrechnung nicht möglich", reasons "Kein §115b-Eintrag" and "Hybrid-DRG-Fall, nicht als AOP abrechenbar").**
- [ ] **Step 2: Implement the page and `OpsClient` per the spec and the mockup (https://claude.ai/artifact/9pdZFR4zFTZpa4S8K5KXt2): results left, detail card right (stacked on phones), §115b and Hybrid-DRG badges, red message above the codes when not allowed (all reasons) and green when allowed, codes `opacity` reduced and non-copyable styling (`aria-disabled`) when blocked, "–" for empty values, dataset info line.**
- [ ] **Step 3: Implement `OpsAdminPanel` (admin-only render; server also enforces) and the nav item; handle the mobile nav check from the Files list.**
- [ ] **Step 4: Run `npm run lint` and `npm run build`. Browser check with Playwright MCP: log in as admin, upload both sample files, search `5-530.00` (expect red message with the Hybrid-DRG reason, greyed codes), search for a code with §115b `-` (e.g. `1-465.91`: expect red, no-115b reason), search for a code with §115b `Ja` that is not in the Hybrid list (expect green), edit a fixed code and see it reflected, view at 400 px width and in dark mode, and log in as a non-admin to confirm the admin panel is absent. Expected: all as described.**
- [ ] **Step 5: Commit** `feat(cases): add OPS lookup page`

---

## Self-Review

- Spec coverage: data sources (Task 1–3), fixed codes editable (Task 3, 4, 5), search (Task 3, 5), detail card and copy buttons (Task 5), AOP rule with both reasons and greyed codes (Task 2, 5), dataset info (Task 3, 5), admin-only upload/edit with validation and replace-all (Task 3, 4), audit log (Task 4), i18n (Task 5). Gaps: none found.
- Open builder choices left per spec: table indexing, ranking, copy wording. Calls made in this plan: dataset metadata and fixed codes in `app_settings`; page is workspace-scoped in the URL (for the existing header) while the data is global; hybrid codes absent from Anhang 2 are not searchable.
