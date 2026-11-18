# Pathology Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the pathology lab's patient-list PDF into the Cases module, let users enter treatment type / insurer / insurance number per row, and export an answer PDF containing the original columns plus the entries.

**Architecture:** Two new tables (`pathology_lists`, `pathology_list_entries`), fully separate from `case_files`/PVS/invoices but scoped to a case workspace (membership permissions reused). A server-side parser (`pdfjs-dist`, text + positions + fill colours) feeds a mandatory import preview; entries are edited inline; the export reuses `@react-pdf/renderer`.

**Tech Stack:** Next.js 16 (pinned, newer than training data; check `node_modules/next/dist/docs/`), Drizzle + better-sqlite3, Zod, TanStack Query, next-intl, shadcn/ui, `@react-pdf/renderer`, new dependency `pdfjs-dist` (see Task 2).

**Spec:** `docs/superpowers/specs/2026-11-18-pathology-lists-design.md`

## Global Constraints

- No test runner exists. Verify with `npm run lint`, `npm run build`, throwaway scripts, and browser checks. Do not invent test commands.
- No relation to `case_files`, PVS batches, invoices or OPS — no foreign keys, no shared services.
- Dates stored as ISO `YYYY-MM-DD` text (like `case_files.date_of_birth`); displayed as `TT.MM.JJJJ`.
- `treatmentType` values are exactly `stat`, `hybrid`, `aop`; export labels `Stat.`, `Hybrid`, `AOP`.
- Patient data (names, birth dates, insurance numbers) must never appear in audit logs, error messages or console output; audit metadata holds counts only. The uploaded PDF is never stored, only its file name.
- The example PDFs contain real patient data: never commit them or copy them into the repo; keep verification scripts in the session scratchpad and pass PDF paths as arguments.
- API routes follow the repo pattern: guard → service → `lib/http.ts` helpers; Zod validation; `logAuditEvent` on mutations.
- Code comments in English, short and sparse. UI strings in BOTH `messages/en-US/cases.json` and `messages/de-DE/cases.json` under `Cases.pathology` (nav label under `Cases.nav.pathology`).
- Migrations via `npm run db:generate`, then `npm run db:migrate`.
- Do not commit unless the user asks.

## Review Focus

- Non-PDF, corrupted, or zero-row PDF → 400 with a clear message, nothing stored (Tasks 2, 3).
- Re-importing the same or an overlapping list → existing sample numbers skipped, edited entries never overwritten (Task 3).
- Entry edits and archiving on an archived list → rejected (Task 1, 3).
- Read-only member editing/importing → 403; user outside the workspace → 404 (Task 3).
- Names with umlauts, ß, hyphens and two-line cells (`Andreichenko Alexander` / `*30.05.1987`) parse intact; empty strings become `null`; over-long text rejected (Tasks 1, 2).

---

### Task 1: Schema, validators, service

**Files:**
- Modify: `lib/db/schema.ts` (new tables after `caseFileStatusHistory`; relations only if needed)
- Create: `drizzle/00xx_*.sql` (generated)
- Create: `lib/validators/pathology.ts`
- Create: `lib/services/pathology-service.ts`

**Interfaces:**
- Produces (`lib/validators/pathology.ts`):
  - `treatmentTypeSchema = z.enum(["stat","hybrid","aop"])`, `type PathologyTreatmentType`
  - `importEntrySchema` (sampleNumber ≤ 32, patientName ≤ 200, dateOfBirth/receivedDate ISO date nullable, liquid ≤ 4, sender ≤ 100, material ≤ 500 nullable, isCancerRegistry boolean)
  - `commitImportSchema = z.object({ sourceFileName: z.string().max(255), periodStart: isoDate, periodEnd: isoDate, entries: z.array(importEntrySchema).min(1).max(1000) }).strict()`
  - `updateEntrySchema` (strict, every field optional): `treatmentType` nullable enum, `insurer` ≤ 120, `insuranceNumber` ≤ 40, `note` ≤ 300 (trim; empty string → `null`), `isCancerRegistry` boolean
  - `archiveListSchema = z.object({ isArchived: z.boolean() }).strict()`
- Produces (`pathology-service.ts`):
  - `type PathologyEntry` (all columns incl. `id`, `listId`, `position`), `type PathologyListSummary = { id; periodStart; periodEnd; sourceFileName; isArchived; entryCount; filledCount; openCancerRegistryCount; createdAt }`
  - `listPathologyLists(workspaceId: string, includeArchived: boolean): Promise<PathologyListSummary[]>`
  - `getPathologyList(workspaceId: string, listId: string): Promise<PathologyListSummary & { entries: PathologyEntry[] }>` (404 `NotFoundError` if the list is not in the workspace)
  - `updatePathologyEntry(workspaceId, listId, entryId, patch: z.infer<typeof updateEntrySchema>): Promise<PathologyEntry>` — `ConflictError` if the list is archived
  - `setPathologyListArchived(workspaceId, listId, isArchived): Promise<PathologyListSummary>`
  - `listInsurerSuggestions(workspaceId: string): Promise<string[]>` (distinct non-empty `insurer`, most used first, max 100)
  - `commitPathologyImport(workspaceId, input: z.infer<typeof commitImportSchema>, actorUserId): Promise<{ list: PathologyListSummary; importedCount: number; skippedCount: number }>`

- [ ] **Step 1:** Add `pathologyLists` and `pathologyListEntries` to `schema.ts` with the columns from the spec's Datenmodell section (entries also carry `workspaceId`, cascade on both parents), `...timestamps`, index on `listId`, `uniqueIndex("pathology_entries_workspace_sample_idx").on(workspaceId, sampleNumber)`. Run `npm run db:generate` and `npm run db:migrate`; check the SQL only creates the two tables and indexes.
- [ ] **Step 2:** Write the validators above.
- [ ] **Step 3:** Implement the read functions. `filledCount` = entries with a `treatmentType`, non-empty `insurer` and non-empty `insuranceNumber`; `openCancerRegistryCount` = `isCancerRegistry` entries missing insurer or insuranceNumber. Order entries by `position`.
- [ ] **Step 4:** Implement `commitPathologyImport` in one transaction: drop entries whose `sampleNumber` already exists in the workspace (count them as skipped); if nothing is left throw `ConflictError("All entries already exist")`; insert the list and the remaining entries with `position` following input order.
- [ ] **Step 5:** Implement `updatePathologyEntry` and `setPathologyListArchived` (verify list and entry belong to the workspace/list; archived list → `ConflictError`, except toggling archive itself).
- [ ] **Step 6:** Run `npx tsc --noEmit` and `npm run lint`. Expected: clean.

### Task 2: PDF parser

**Files:**
- Modify: `package.json` / lockfile (add `pdfjs-dist` pinned to `5.4.149`, the version verified in a spike with Node 22; use the `pdfjs-dist/legacy/build/pdf.mjs` entry)
- Modify: `next.config.ts` (`serverExternalPackages: ["pdfjs-dist"]`; if `output: "standalone"` tracing misses `pdf.worker.mjs`, add it to `outputFileTracingIncludes`)
- Create: `lib/services/pathology-pdf-parser.ts`

**Interfaces:**
- Produces:
  - `type ParsedPathologyEntry = { sampleNumber: string; patientName: string; dateOfBirth: string | null; receivedDate: string | null; liquid: string | null; sender: string | null; material: string | null; isCancerRegistry: boolean }`
  - `type ParsedPathologyList = { periodStart: string | null; periodEnd: string | null; entries: ParsedPathologyEntry[] }`
  - `parsePathologyPdf(bytes: Uint8Array): Promise<ParsedPathologyList>` — throws `ValidationError("Could not read the PDF")` on any pdfjs failure or when no header row is found; max 20 pages.

- [ ] **Step 1:** Add the dependency and the `next.config.ts` change.
- [ ] **Step 2:** Implement `parsePathologyPdf`. Facts verified in the spike: `getTextContent()` items carry `str` and `transform[4]/[5]` (x/y); sample numbers arrive as one item (`"H 2026 016136"`); header cells are filled `#cfcfd1`; Krebsregister rows are filled `#ff6600`; fill rectangles come from `getOperatorList()` `constructPath` ops (bounds in `args[2]`) under the current transform, so track `save`/`restore`/`transform` (CTM). Approach:
  1. Group items into lines by y; locate the header line containing `Proben-Nr` and `Patient`; column x-ranges come from the header cells (Proben-Nr, Patient, Eingang, Liq, Einsender, Material). Text right of the Material cell is never a field (empty answer columns, user annotations).
  2. A row starts at an item in the Proben-Nr column matching `/^[A-Z]\s?\d{4}\s\d{6}$/`; following lines without a sample number are continuation lines, appended per column with a single space.
  3. Split the Patient cell on `*TT.MM.JJJJ` into name and `dateOfBirth` (ISO); `receivedDate` likewise from the Eingang cell.
  4. `isCancerRegistry` is true when a warm fill (`r ≥ 0xd0, g ≤ 0xa0, b ≤ 0x80`) covers the row's y-band, or when any text in the row's y-band (including right of Material) matches `/Kasse\s*\+\s*Vers-?Nr|Krebsregister/i`.
  5. `periodStart`/`periodEnd` from `/Zeitraum\s+(\d{2})\.(\d{2})\.(\d{4})\s+bis\s+(\d{2})\.(\d{2})\.(\d{4})/` over the first page's text.
- [ ] **Step 3:** Verify with a throwaway script in the scratchpad run via `npx tsx <script> <pdf>` from the repo root (pass paths as arguments):
  - `b11667f6-Temp.pdf`: 30 entries, period `2026-11-02`..`2026-11-17`, exactly `H 2026 016136` and `H 2026 016347` flagged, `Andreichenko Alexander` with `dateOfBirth` `1987-05-30`.
  - `e425c7ac-02.11.26_-_17.11.26.pdf` (annotated): entries deep-equal to the Temp result (annotations ignored).
  - `527bdd82-16.10.26_-_01.11.26.pdf` (older, annotated): 18 entries; `H 2026 015578` and `H 2026 015773` flagged.
  - A non-PDF byte array and a PDF without a header row throw `ValidationError`.
- [ ] **Step 4:** `npm run lint`. Expected: clean. Do not copy the PDFs or the script into the repo.

### Task 3: API routes

**Files (all under `app/api/case-workspaces/[id]/pathology/`):**
- Create: `route.ts` (GET lists), `import/preview/route.ts`, `import/route.ts`, `insurers/route.ts`, `[listId]/route.ts`, `[listId]/entries/[entryId]/route.ts`
- Modify: `lib/services/pathology-service.ts` (add `previewPathologyImport`)

**Interfaces:**
- Consumes: Task 1 service/validators, Task 2 `parsePathologyPdf`.
- Produces:
  - `previewPathologyImport(workspaceId: string, bytes: Uint8Array): Promise<{ periodStart: string | null; periodEnd: string | null; entries: Array<ParsedPathologyEntry & { duplicate: boolean }> }>` — throws `ValidationError` when 0 entries are found.
  - `GET /pathology?archived=1` → `{ items: PathologyListSummary[] }`; `GET /pathology/insurers` → `{ items: string[] }`
  - `POST /pathology/import/preview` multipart `file` → preview object above
  - `POST /pathology/import` JSON `commitImportSchema` → 201 `{ list, importedCount, skippedCount }`
  - `GET /pathology/[listId]` → `{ item }`; `PATCH` body `archiveListSchema` → `{ item }`
  - `PATCH /pathology/[listId]/entries/[entryId]` body `updateEntrySchema` → `{ item }`

- [ ] **Step 1:** Read routes use `requireCaseWorkspaceReadAccess`; all mutating routes use `requireCaseWorkspaceContentCreateAccess`.
- [ ] **Step 2:** Preview route: require `file instanceof File`, `type === "application/pdf"`, bytes start with `%PDF-`, size 1..10 MiB, `checkRateLimit(\`pathology-preview:${userId}\`, 10, 60_000)`; call `previewPathologyImport`. Nothing is persisted.
- [ ] **Step 3:** Import, archive and entry-update routes audit-log (`pathology_list_imported` with `{ importedCount, skippedCount }`, `pathology_list_archived` with `{ isArchived }`, `pathology_entry_updated` with `{ fields: string[] }` — field names only, never values).
- [ ] **Step 4:** `npx tsc --noEmit`, `npm run lint`, then `npm run build` and run the standalone server (`node .next/standalone/server.js`) to confirm the preview route works there (pdfjs worker resolved); fix tracing config if not.
- [ ] **Step 5:** Manual API checks with curl against the dev server using an authenticated session: preview of `b11667f6-Temp.pdf` returns 30 entries; a text file renamed to `.pdf` → 400; commit twice → second returns 409 (all duplicates); a read-only member PATCH → 403; PATCH on an archived list's entry → 409.

### Task 4: Export PDF

**Files:**
- Create: `lib/services/pdf/pathology-list-document.tsx`, `lib/services/pdf/render-pathology-pdf.ts`
- Create: `app/api/case-workspaces/[id]/pathology/[listId]/pdf/route.ts`

**Interfaces:**
- Consumes: `getPathologyList`.
- Produces:
  - `formatPathologyAnswer(entry: Pick<PathologyEntry, "insuranceNumber" | "insurer" | "note">): string` in the document file — `"<Vers-Nr.> - <Kasse>"`, with ` (<note>)` appended when set; if only one of insurer/number exists, just that one; empty string when none.
  - `PATHOLOGY_TREATMENT_LABELS: Record<PathologyTreatmentType, string>` (`Stat.`, `Hybrid`, `AOP`)
  - `renderPathologyListPdf(list: PathologyListSummary & { entries: PathologyEntry[] }): Promise<Buffer>`
  - `GET /pathology/[listId]/pdf` → `application/pdf`, filename `Patientenliste_<start>_<end>.pdf`

- [ ] **Step 1:** Document: A4 landscape, title `Patientenliste: Zeitraum TT.MM.JJJJ bis TT.MM.JJJJ`, columns Proben-Nr, Patient (`Name *TT.MM.JJJJ`), Eingang, Liq, Einsender, Material, Behandlung, Vers-Nr. - Kasse; header cells grey, `isCancerRegistry` rows background `#ff6600`; style after `lib/services/pdf/pvs-submission-document.tsx`; header row repeats on page breaks (`fixed`).
- [ ] **Step 2:** Route: read access, `checkRateLimit`, audit `pathology_list_exported` with `{ entryCount }`, headers like the invoice file route (`nosniff`). Export is never blocked by missing data.
- [ ] **Step 3:** Verify by exporting a list imported from the Temp PDF with a few entries filled, convert with `pdftotext -layout` and check text and column order, and view page 1 as an image (`pdftoppm -png -r 80`) to confirm the two orange rows and landscape layout.

### Task 5: UI, navigation, i18n

**Files:**
- Modify: `components/layout/cases-header.tsx` (nav item `{ href: .../pathology, key: "pathology", icon: Microscope, exact: false }` before `settings`; the mobile nav derives from the same list)
- Modify: `messages/en-US/cases.json`, `messages/de-DE/cases.json`
- Create: `app/cases/[workspaceId]/pathology/page.tsx`, `app/cases/[workspaceId]/pathology/[listId]/page.tsx`
- Create: `components/cases/pathology-lists-client.tsx`, `components/cases/pathology-import-dialog.tsx`, `components/cases/pathology-list-client.tsx`

**Interfaces:**
- Consumes: Task 3/4 endpoints. Query keys: `["pathology-lists", workspaceId, includeArchived]`, `["pathology-list", workspaceId, listId]`, `["pathology-insurers", workspaceId]`.

- [ ] **Step 1:** Pages follow the prefetch pattern of `app/cases/[workspaceId]/ops/page.tsx` and `submissions/page.tsx` (`requireCaseModuleUser`, access check → redirect, `HydrationBoundary`), prefetching by calling the services directly; the detail page 404s via `notFound()` for an unknown list.
- [ ] **Step 2:** `PathologyListsClient`: cards per list (period, source file name, `filledCount / entryCount`, badge for `openCancerRegistryCount > 0`), archived toggle, import button (write access only; follow `canWriteWorkspace` usage in `invoices-client.tsx`), empty state.
- [ ] **Step 3:** `PathologyImportDialog`: file picker → `POST import/preview` → preview table (rows editable for name/material, duplicates greyed with "already exists", flagged rows red, counts in the header) → confirm calls `POST import` with the non-duplicate rows; navigate to the new list; show server error messages as toasts.
- [ ] **Step 4:** `PathologyListClient`: table with original columns read-only plus editable Behandlungsart (`Select`), Vers-Nr., Kasse (text input with native `<datalist>` from the insurers query), Bemerkung, and a Krebsregister checkbox; each change PATCHes that field (text on blur only when changed) and updates the query cache; rows with `isCancerRegistry` in red, with a visible "missing" marker while insurer/number are empty; inputs disabled for read-only members and archived lists; archive/unarchive action.
- [ ] **Step 5:** Export button: when `openCancerRegistryCount > 0` open an `AlertDialog` listing the affected sample numbers with "Export anyway" / "Cancel"; otherwise download directly from `.../pdf`.
- [ ] **Step 6:** Add i18n keys for both locales (nav label "Pathologie"/"Pathology", all labels, toasts, errors, the warning dialog).
- [ ] **Step 7:** `npm run lint` and `npm run build`. Expected: both pass.
- [ ] **Step 8:** Browser check (playwright MCP, dev server): import the Temp PDF → 30 rows, 2 red; re-import → duplicates greyed, commit refused; fill a few rows, reload, values persist; export warning lists the two red rows when empty and disappears once filled; archived list is read-only; a read-only member sees no edit/import controls; layout holds at mobile width.

---

**Self-review notes:** spec sections map to tasks (data model → 1; import/preview/duplicates/period/cancer detection → 2–3; editing, suggestions, archive → 1, 3, 5; export and warning → 4, 5; audit/privacy → 3 and Global Constraints). Names consistent: `PathologyEntry`, `PathologyListSummary`, `ParsedPathologyEntry`, `commitImportSchema`, `updateEntrySchema`, `previewPathologyImport`, `formatPathologyAnswer`. Spec correction: the old list carried its Krebsregister text in a column right of Material, not inside it; Task 2 matches text anywhere in the row's y-band.
