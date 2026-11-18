# Outgoing Invoice Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every outgoing invoice gets one case type (ambulant / stationaer / konsil); patient pickers only offer case files of that type.

**Architecture:** Nullable `invoice_type` column on `case_invoices` (legacy rows stay `null`). The service layer enforces type matching on upload and assign; the assignable endpoint filters by type; the UI selects the type first and shows it as a badge. Untyped legacy invoices get a "set type" action.

**Tech Stack:** Next.js (pinned, newer than training data), Drizzle + better-sqlite3, Zod, TanStack Query, next-intl, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-11-18-invoice-type-design.md`

## Global Constraints

- Type values are exactly `ambulant`, `stationaer`, `konsil` (same as `case_files.case_type`).
- No test runner exists in this repo. Verify with `npm run lint`, `npm run build`, and browser checks. Do not invent test commands.
- Code comments in English, short and sparse. UI strings go into BOTH `messages/en-US/cases.json` and `messages/de-DE/cases.json` under `Cases.invoices`.
- Migrations via `npm run db:generate`, then `npm run db:migrate`.
- No type change once an invoice has a type.
- API routes follow the repo pattern: guard → service → `lib/http.ts` helpers; validate with Zod; audit-log mutations.
- Do not commit unless the user asks.

## Review Focus

- Upload without a type → 400 (server, not only UI).
- Assign a case file of another type via direct API call → rejected.
- Assign to an untyped invoice → rejected until a type is set.
- Setting a type on an untyped invoice with mixed-type linked patients → rejected; setting on an already typed invoice → rejected.
- Upload with a type but a selected case file of another type → rejected, and the stored PDF is cleaned up (existing catch block).

---

### Task 1: Schema, validator, service

**Files:**
- Modify: `lib/db/schema.ts` (`caseInvoices`, ~line 340)
- Create: `drizzle/00xx_*.sql` (generated)
- Modify: `lib/validators/case-invoice.ts`
- Modify: `lib/services/case-invoice-service.ts`

**Interfaces:**
- Produces:
  - `export type InvoiceType = "ambulant" | "stationaer" | "konsil"` and `export const invoiceTypeSchema = z.enum([...])` in `lib/validators/case-invoice.ts`
  - `invoiceUploadFieldsSchema` now also requires `invoiceType: InvoiceType`
  - `export const setInvoiceTypeSchema = z.object({ invoiceType: invoiceTypeSchema }).strict()`
  - `CaseInvoice.invoiceType: InvoiceType | null`
  - `listAssignableCaseFiles(workspaceId: string, invoiceType?: InvoiceType): Promise<InvoiceCaseFile[]>`
  - `uploadInvoice(workspaceId, file, invoiceType: InvoiceType, caseFileIds, actorUserId)`
  - `setInvoiceType(workspaceId: string, invoiceId: string, invoiceType: InvoiceType): Promise<CaseInvoice>`

- [ ] **Step 1:** Add `invoiceType: text("invoice_type", { enum: ["ambulant", "stationaer", "konsil"] })` (nullable) to `caseInvoices`. Run `npm run db:generate` and `npm run db:migrate`; check the generated SQL is a single `ALTER TABLE ... ADD invoice_type text`.
- [ ] **Step 2:** In the validator, add `invoiceTypeSchema`, `InvoiceType`, extend `invoiceUploadFieldsSchema` with required `invoiceType`, add `setInvoiceTypeSchema`.
- [ ] **Step 3:** In the service, include `invoiceType` in `CaseInvoice`/`hydrateInvoices`; add the optional `invoiceType` filter to `listAssignableCaseFiles` (`eq(caseFiles.caseType, invoiceType)`).
- [ ] **Step 4:** Extend `assignInTx` with a parameter `invoiceType: InvoiceType | null`. Throw `ValidationError("Set an invoice type before assigning case files")` when null; select `caseType` in the row query and throw `ValidationError("Case files must match the invoice type")` on any mismatch. Callers: `uploadInvoice` passes its type (inserted on the invoice row); `assignCaseFiles` passes the type from `loadInvoiceRow`.
- [ ] **Step 5:** Implement `setInvoiceType`: load the row; `ValidationError("Invoice already has a type")` if not null; load linked case files' `caseType`, `ValidationError` if any differs from the new type; update and return `getInvoice`.
- [ ] **Step 6:** Run `npx tsc --noEmit` (expect errors only at the not-yet-updated callers in Task 2) and `npm run lint` on the touched files.

### Task 2: API routes

**Files:**
- Modify: `app/api/case-workspaces/[id]/invoices/route.ts`
- Modify: `app/api/case-workspaces/[id]/invoices/assignable/route.ts`
- Create: `app/api/case-workspaces/[id]/invoices/[invoiceId]/type/route.ts`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `POST /invoices` multipart field `invoiceType`; `GET /invoices/assignable?invoiceType=<type>` (invalid or missing value → unfiltered is NOT allowed: respond 400 via `invoiceTypeSchema.parse`); `PUT /invoices/[invoiceId]/type` body `{ invoiceType }` returning `{ item }`.

- [ ] **Step 1:** In the upload route read `form.get("invoiceType")`, parse it with `invoiceUploadFieldsSchema` together with `caseFileIds`, pass it to `uploadInvoice`, add `invoiceType` to the `case_invoice_uploaded` audit metadata.
- [ ] **Step 2:** In the assignable route parse the `invoiceType` search param with `invoiceTypeSchema` and pass it to the service.
- [ ] **Step 3:** Create the `type` route (`PUT`, `requireCaseWorkspaceContentCreateAccess`, `parseRequestJson` + `setInvoiceTypeSchema`, audit action `case_invoice_type_set` with `{ invoiceType }`).
- [ ] **Step 4:** Run `npx tsc --noEmit` and `npm run lint`. Expected: clean.

### Task 3: UI, i18n, prefetch

**Files:**
- Modify: `components/cases/invoice-dialogs.tsx`
- Modify: `components/cases/invoices-client.tsx`
- Modify: `app/cases/[workspaceId]/submissions/page.tsx`
- Modify: `messages/en-US/cases.json`, `messages/de-DE/cases.json`

**Interfaces:**
- Consumes: Task 2 endpoints; existing `Cases.caseType` translations (`ambulant`, `stationaer`, `konsil`) for labels.
- Produces: `CaseFilePicker` takes `invoiceType: InvoiceType | null`; query key `["case-invoices-assignable", workspaceId, invoiceType]`.

- [ ] **Step 1:** `CaseFilePicker`: when `invoiceType` is null render a hint (`t("pickTypeFirst")`) and skip the query (`enabled`); otherwise fetch `.../invoices/assignable?invoiceType=...`.
- [ ] **Step 2:** `InvoiceUploadDialog`: add a required type selector (use the same select/radio primitive as `case-file-sheet.tsx` for case type); changing the type clears `selected`; send `form.set("invoiceType", ...)`; disable submit without type and file.
- [ ] **Step 3:** `InvoiceAssignDialog`: take the invoice's `invoiceType` and pass it to the picker. In `InvoiceRow` hide/disable "add patients" while the type is null.
- [ ] **Step 4:** `InvoiceRow`: show a type badge (`tCaseType(invoice.invoiceType)`) or a "no type" badge; for null type and `canEdit`, add a small `Select` that calls `PUT .../type` and invalidates `["case-invoices", workspaceId]`. Add `invoiceType: InvoiceType | null` to the local `CaseInvoice` type.
- [ ] **Step 5:** `page.tsx`: remove the `case-invoices-assignable` prefetch (the picker now keys by type) and the unused `listAssignableCaseFiles` import. Check that `components/cases/invoices-client.tsx`'s invalidations still match by key prefix.
- [ ] **Step 6:** Add i18n keys (both locales): `typeLabel`, `typePlaceholder`, `pickTypeFirst`, `noType`, `setType`, `toast.typeSet`, `toast.typeSetFailed`; update `noAssignable` to mention the chosen type.
- [ ] **Step 7:** `npm run lint` and `npm run build`. Expected: both pass.
- [ ] **Step 8:** Browser check (playwright MCP, dev server): (a) upload requires type, list is filtered, (b) assign dialog filtered by invoice type, (c) a legacy invoice shows "no type", cannot add patients, type can be set once, (d) a direct `curl` assign with a mismatched case file returns 400.

---

**Self-review notes:** every spec section maps to a task (type field → 1; filtering/enforcement → 1–2; badge/set-type/dialogs → 3; i18n/migration/audit → 1–3). Names consistent: `invoiceType`, `InvoiceType`, `setInvoiceType`, `invoiceTypeSchema`.
