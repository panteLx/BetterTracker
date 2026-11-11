# Outgoing Invoices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload outgoing-invoice PDFs to a case workspace, assign them to several case files (moving them `awaiting_invoice` ⇄ `done`), and show the invoice in the case file details.

**Architecture:** New `case_invoices` table plus nullable `case_files.invoiceId`; PDFs stored on disk under `data/invoices/`. A service module owns all assign/unassign/delete logic (transactional, status history written). Thin API routes follow the existing guard → service → `lib/http.ts` pattern; a new workspace page `/cases/[workspaceId]/invoices` manages invoices.

**Tech Stack:** Next.js (pinned, see `AGENTS.md`), Drizzle + better-sqlite3, Zod, TanStack Query, next-intl, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-11-11-outgoing-invoices-design.md`

## Global Constraints

- There is no test runner. Verify with `npm run lint`, `npm run build`, and browser checks (Playwright MCP `playwright`). Do not invent test commands.
- Code comments in English, short and sparse. UI strings in both `messages/en-US/cases.json` and `messages/de-DE/cases.json`.
- Commit messages Conventional Commits, no Claude attribution.
- Upload: `application/pdf` declared type **and** `%PDF-` magic bytes; size cap 10 MB.
- Files live at `data/invoices/<workspaceId>/<invoiceId>.pdf`; the DB stores metadata only.
- `done` always means an invoice is assigned; no other path may leave a case file `done` without `invoiceId`, or `invoiceId` set while not `done`.
- Assign/unassign are all-or-nothing in one transaction and fail with `ValidationError` if any file is not eligible (see Task 2).
- API routes are excluded from `proxy.ts`'s matcher, so no proxy body-size limit applies to uploads.

## Review Focus

- Uploading a non-PDF renamed to `.pdf` (wrong magic bytes) → 400, nothing stored.
- Upload larger than 10 MB → 400, nothing stored.
- Assigning a file already on another invoice, an archived file, or a file from another workspace → whole request fails, no partial changes.
- Deleting an invoice whose PDF is already missing on disk → still succeeds, case files revert.
- Downloading an invoice id from another workspace → 404 (no cross-workspace read).

---

### Task 1: Schema, migration, file storage helper

**Files:**
- Modify: `lib/db/schema.ts` (add `caseInvoices` table before `caseFiles`; add `invoiceId` column + index to `caseFiles`)
- Create: `drizzle/<generated>.sql` via `npm run db:generate`
- Create: `lib/storage/invoice-files.ts`

**Interfaces:**
- Produces (schema): `caseInvoices` with `id`, `workspaceId` (FK cascade → `caseWorkspaces.id`), `originalFileName` text notNull, `sizeBytes` integer notNull, `uploadedByUserId` (FK set null → `user.id`), `...timestamps`; `caseFiles.invoiceId` text nullable FK → `caseInvoices.id` `onDelete: "set null"`, index `case_files_invoice_idx`.
- Produces (helper):
  - `invoiceFilePath(workspaceId: string, invoiceId: string): string`
  - `saveInvoiceFile(workspaceId: string, invoiceId: string, bytes: Buffer): Promise<void>` (creates dirs)
  - `readInvoiceFile(workspaceId: string, invoiceId: string): Promise<Buffer | null>` (null if missing)
  - `deleteInvoiceFile(workspaceId: string, invoiceId: string): Promise<void>` (ignores missing)
  - Base directory derived from the directory of `DATABASE_URL` (default `./data`), not hard-coded to the cwd.

- [ ] **Step 1: Edit `lib/db/schema.ts` as specified above; `onDelete: "set null"` on the case file side is only a safety net, the service clears it explicitly.**
- [ ] **Step 2: Run `npm run db:generate`; open the new SQL and confirm it contains only the new table, the new column and the index.**
- [ ] **Step 3: Implement the helper in `lib/storage/invoice-files.ts` with the signatures above (`node:fs/promises`, `node:path`).**
- [ ] **Step 4: Run `npm run db:migrate` and `npm run lint`. Expected: migration applies, lint clean.**
- [ ] **Step 5: Commit** `feat(cases): add case invoices table and file storage helper`

---

### Task 2: Invoice service and validators

**Files:**
- Create: `lib/services/case-invoice-service.ts`
- Create: `lib/validators/case-invoice.ts`
- Modify: `lib/services/case-file-service.ts` (export `recordStatusHistory`, or move it to a shared spot; keep one implementation)

**Interfaces:**
- Consumes: Task 1 schema and storage helper; `NotFoundError`, `ValidationError` from `lib/errors.ts`; existing `caseFileIdsInputSchema` (`lib/validators/case-file-bulk.ts`).
- Produces (validators): `invoiceUploadFieldsSchema` — Zod object `{ caseFileIds: z.array(z.string().trim().min(1)).default([]) }` for the multipart text field (JSON-encoded array, parsed by the route).
- Produces (service):
  - `type CaseInvoice = { id: string; workspaceId: string; originalFileName: string; sizeBytes: number; createdAt: Date; caseFiles: { id: string; patientName: string; fileNumber: string }[] }`
  - `listInvoices(workspaceId: string): Promise<CaseInvoice[]>` — newest first.
  - `getInvoice(workspaceId: string, invoiceId: string): Promise<CaseInvoice>` — `NotFoundError` if not in workspace.
  - `uploadInvoice(workspaceId: string, file: { name: string; bytes: Buffer }, caseFileIds: string[], actorUserId: string): Promise<CaseInvoice>` — validates size ≤ 10 MB and `%PDF-` prefix (`ValidationError`), inserts row, saves file, then assigns `caseFileIds` (if any) via the same logic as `assignCaseFiles`; if assignment fails the invoice row and file are removed again.
  - `assignCaseFiles(workspaceId: string, invoiceId: string, caseFileIds: string[], actorUserId: string): Promise<CaseInvoice>`
  - `unassignCaseFiles(workspaceId: string, invoiceId: string, caseFileIds: string[], actorUserId: string): Promise<CaseInvoice>`
  - `deleteInvoice(workspaceId: string, invoiceId: string, actorUserId: string): Promise<void>`
  - `getInvoiceFile(workspaceId: string, invoiceId: string): Promise<{ name: string; bytes: Buffer }>` — `NotFoundError` if row or file missing.
  - `listAssignableCaseFiles(workspaceId: string): Promise<{ id: string; patientName: string; fileNumber: string }[]>` — status `awaiting_invoice`, not archived, ordered by `patientName`.
- Rules: `assignCaseFiles` requires every id to belong to the workspace, have status `awaiting_invoice`, `invoiceId IS NULL` and `isArchived = false`, else `ValidationError` and no changes. It sets `invoiceId` + `status = "done"` and writes status history. `unassignCaseFiles` requires every id to currently have this `invoiceId`; sets `invoiceId = null`, `status = "awaiting_invoice"`, status history. `deleteInvoice` does the unassign for all its files in one transaction, deletes the row, then calls `deleteInvoiceFile` (a missing file must not throw).

- [ ] **Step 1: Write `lib/validators/case-invoice.ts` with `invoiceUploadFieldsSchema`.**
- [ ] **Step 2: Implement the service with the signatures and rules above; wrap DB mutations in `db.transaction`.**
- [ ] **Step 3: Verify with a throwaway script run via `npx tsx` (not committed) against a local seeded DB: upload a small valid PDF, assign two `awaiting_invoice` cases, confirm both are `done` with status history rows; unassign one → back to `awaiting_invoice`; assign a `done` case → throws `ValidationError`; non-PDF bytes → throws; delete invoice → remaining case reverts. Expected: all outcomes as listed.**
- [ ] **Step 4: Run `npm run lint`. Expected: clean.**
- [ ] **Step 5: Commit** `feat(cases): add outgoing invoice service`

---

### Task 3: API routes

**Files (all under `app/api/case-workspaces/[id]/invoices/`):**
- Create: `route.ts` — `GET` list, `POST` multipart upload (fields `file`, optional `caseFileIds` as JSON string)
- Create: `assignable/route.ts` — `GET` assignable case files
- Create: `[invoiceId]/route.ts` — `GET` detail, `DELETE`
- Create: `[invoiceId]/assign/route.ts` — `POST` body `{ caseFileIds }`
- Create: `[invoiceId]/unassign/route.ts` — `POST` body `{ caseFileIds }`
- Create: `[invoiceId]/file/route.ts` — `GET` streams the PDF

**Interfaces:**
- Consumes: Task 2 service; guards `requireCaseWorkspaceReadAccess` (GET) and `requireCaseWorkspaceContentCreateAccess` (mutations) from `lib/auth/case-workspace-guards.ts`; `ok`, `created`, `mapServiceError`, `parseRequestJson` from `lib/http.ts`; `caseFileIdsInputSchema`; `logAuditEvent` + `getRequestAuditContext`; `checkRateLimit` as in the existing PDF route.
- Produces: JSON shapes `{ items: CaseInvoice[] }`, `{ item: CaseInvoice }`, `{ items: AssignableCaseFile[] }`; file route responds `Content-Type: application/pdf`, `Content-Disposition: inline; filename*=UTF-8''<encoded name>`.
- Audit actions: `case_invoice_uploaded`, `case_invoice_assigned`, `case_invoice_unassigned`, `case_invoice_deleted`, `resourceType: "case_invoice"`.

- [ ] **Step 1: Implement the six route files following `app/api/case-workspaces/[id]/case-files/mark-awaiting-invoice/route.ts` (guard → service → try/catch → `mapServiceError`). Upload uses `request.formData()`, reads `file` as `File`, 400 via `badRequest` if missing.**
- [ ] **Step 2: Run `npm run lint` and `npm run build`. Expected: both pass.**
- [ ] **Step 3: With `npm run dev` and an authenticated session cookie, curl the routes: upload valid PDF → 201; upload text file named `x.pdf` → 400; file route → `application/pdf`; a read-only member's POST → 403; invoice id from another workspace on `/file` → 404. Expected: as listed.**
- [ ] **Step 4: Commit** `feat(cases): add outgoing invoice API routes`

---

### Task 4: Case board integration (invoice in details, manual done removed)

**Files:**
- Modify: `lib/services/case-file-service.ts` — list select adds `invoiceId` and `invoiceFileName` (left join `caseInvoices`); delete `bulkMarkDone`; guard: any code path setting a status other than `done` on a file with `invoiceId` must also null `invoiceId` (verify by reading all `.set({ status` calls; none should currently reach `done` files — record the result in the commit message).
- Delete: `app/api/case-workspaces/[id]/case-files/mark-done/route.ts`
- Modify: `components/cases/case-board-client.tsx` — `CaseFile` type gains `invoiceId: string | null; invoiceFileName: string | null`; remove `markDoneMutation` and the `onMarkDone` prop wiring.
- Modify: `components/cases/bulk-action-bar.tsx` — remove `onMarkDone` prop and the `awaitingInvoice` mode's button; in that mode show a short hint with a link to the invoices page instead (needs `workspaceId` prop if not present).
- Modify: `components/cases/case-file-sheet.tsx` — when `caseFile.invoiceId` is set, show the file name as a link to `/api/case-workspaces/${workspaceId}/invoices/${invoiceId}/file` (opens in a new tab).
- Modify: `messages/{en-US,de-DE}/cases.json` — remove now-unused `markDone`/`markingDone`/`toast.markDoneFailed` keys, add hint and invoice-label strings.
- Modify: `scripts/seed.ts` only if it calls the removed function.

**Interfaces:**
- Consumes: Task 1 `caseFiles.invoiceId`. Produces: `CaseFile.invoiceId` / `invoiceFileName` used by Task 5 only for linking, not required.

- [ ] **Step 1: Make the service and type changes; run `npm run lint` to find every remaining reference to the removed code (`grep -rn "mark-done\|bulkMarkDone\|onMarkDone\|markDone"`). Expected: no matches after the edits.**
- [ ] **Step 2: Update bulk-action bar, sheet, and messages in both locales.**
- [ ] **Step 3: Run `npm run build`. Expected: passes.**
- [ ] **Step 4: Browser check (Playwright MCP): in the `awaiting_invoice` filter, selecting cases no longer shows a "done" button; a `done` case with an invoice (create one via Task 3 API) shows the invoice link in its sheet and opens the PDF.**
- [ ] **Step 5: Commit** `feat(cases): show invoice in case details and remove manual done`

---

### Task 5: Invoices page and navigation

**Files:**
- Create: `app/cases/[workspaceId]/invoices/page.tsx` — mirror `app/cases/[workspaceId]/batches/page.tsx`: prefetch `["case-invoices", workspaceId]` and `["case-invoices-assignable", workspaceId]` with `listInvoices` / `listAssignableCaseFiles`.
- Create: `components/cases/invoices-client.tsx` — list of invoices (name, size, date, assigned patients with name + file number), actions per invoice: open PDF, add patients, remove patient, delete (AlertDialog confirm).
- Create: `components/cases/invoice-upload-dialog.tsx` — PDF file input + checkbox list of assignable case files (name + file number); submit posts multipart to `/api/case-workspaces/${workspaceId}/invoices`.
- Modify: `components/layout/cases-header.tsx` — add `{ href: .../invoices, key: "invoices", icon: <lucide FileText or Receipt>, exact: false }` to `workspaceNavItems` before `settings`.
- Modify: `messages/{en-US,de-DE}/cases.json` — `nav.invoices` ("Invoices" / "Ausgangsrechnungen") and an `invoices` namespace for all page strings.

**Interfaces:**
- Consumes: Task 3 routes; `fetchJson`/`FetchError` from `lib/client-fetch.ts` (note: multipart upload needs a plain `fetch` with `FormData`, no JSON content-type); canWrite flag from workspace access as `batches-client.tsx` does it — mutation controls hidden for read-only members.
- Mutations invalidate `["case-invoices", workspaceId]`, `["case-invoices-assignable", workspaceId]`, and the board's case file queries (look up the exact key in `case-board-client.tsx`).

- [ ] **Step 1: Implement the page, client component, upload dialog, nav item and messages (both locales).**
- [ ] **Step 2: Run `npm run lint` and `npm run build`. Expected: both pass.**
- [ ] **Step 3: Browser check (Playwright MCP), checklist: upload with two patients selected → both appear `done` on the board; add a third later → `done`; remove one → back to "Warten auf Ausgangsrechnung" and invoice gone from its details; upload with no selection works; delete invoice → all its cases revert; read-only member sees list and PDF link but no mutation controls; German and English labels both render.**
- [ ] **Step 4: Commit** `feat(cases): add outgoing invoices page`

---

## Self-Review (run against the spec)

- Spec coverage: upload (T2/T3/T5), 1:n assignment (T1/T2), assign→done and revert (T2), later add/remove (T3/T5), upload without assignments (T2/T5), delete reverts (T2), invoice in details (T4), manual done removed (T4), read-only members (T3/T5), orphan/missing-file handling (T2), upload validation (T2).
- Type consistency: `CaseInvoice`, `assignCaseFiles`, `unassignCaseFiles`, `listAssignableCaseFiles` are named identically in Tasks 2, 3 and 5.
