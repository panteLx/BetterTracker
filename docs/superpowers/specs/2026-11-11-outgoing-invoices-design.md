# Outgoing invoices (Ausgangsrechnungen) for the Cases module

## Intent

After case files are sent to the PVS, billing produces outgoing invoices as PDFs. One invoice
typically covers several patients. Today the user files the PDF on paper, ticks it off, and
manually moves each case file from `awaiting_invoice` to `done`. This feature lets the user
upload the PDF, assign it to the covered case files, and have those files move to `done`
automatically. Each case file then shows its invoice.

## Goals

- Upload an invoice PDF into a case workspace.
- Assign one invoice to many case files; a case file has at most one invoice (1 invoice : n case files).
- Assigning moves a case file `awaiting_invoice` → `done`.
- Un-assigning moves it back `done` → `awaiting_invoice` and removes the invoice from its details.
- Assignments can be added and removed after upload, and the invoice may be uploaded with no assignments.
- Deleting an invoice un-assigns all its case files (same revert as above) and removes the PDF.
- Case file details show the assigned invoice with a link to open the PDF.

## Non-goals

- No parsing/OCR of the PDF; the user matches patients by hand against name and file number on the paper/PDF.
- No invoice amounts, numbers, or dates as structured data.
- No search or filtering in the patient picker (the `awaiting_invoice` list is small).
- No change to the existing status workflow before `awaiting_invoice`.

## Anti-goals

- A case file must never be `done` via an invoice while the link is gone, or have an invoice while not `done`
  (status and assignment must not drift apart).

## Decided by the user

- Picker lists all case files with status `awaiting_invoice` in the workspace, showing patient name and file number.
- Revert on un-assign returns to `awaiting_invoice`.
- Adding patients to an existing invoice later is supported.

## Design (builder's calls unless marked above — see "Calls made")

### Data
- New table `case_invoices`: `id`, `workspaceId` (FK cascade), `originalFileName`, `storagePath`, `sizeBytes`,
  `uploadedByUserId` (FK set null), `timestamps`.
- New nullable column `case_files.invoiceId` (FK `case_invoices.id`, on delete set null), indexed.
  1 invoice : n case files without a join table.
- PDFs are stored on disk under `data/invoices/<workspaceId>/<invoiceId>.pdf` (the `data` volume is already
  persisted in `compose.yaml`); the DB stores metadata only. Upload accepts PDFs only, size-capped (suggest 10 MB).

### Service (`lib/services/case-invoice-service.ts`)
- `uploadInvoice`, `listInvoices`, `getInvoiceDetail`, `assignCaseFiles`, `unassignCaseFiles`, `deleteInvoice`,
  `readInvoiceFile`.
- `assignCaseFiles`: only case files of the same workspace with status `awaiting_invoice` (else `ValidationError`);
  sets `invoiceId` + status `done`, writes status history (same pattern as `bulkMarkDone`), in one transaction.
- `unassignCaseFiles` / `deleteInvoice`: clears `invoiceId`, sets status `awaiting_invoice`, writes status history.
- Existing `bulkMarkDone` (manual done without invoice) is replaced or hidden in the UI so the manual path does
  not bypass the invoice; builder decides (see open point below).
- Mutations call `logAuditEvent`; write permission required, read permission to view/download.

### API (`app/api/case-workspaces/[id]/invoices/...`)
Standard guard → service → `lib/http.ts` pattern: list/upload (multipart), detail/delete, assign, unassign,
`GET .../file` streaming the PDF with `Content-Type: application/pdf` and rate limiting like the PDF routes.
Validators in `lib/validators/`.

### UI
- New page `app/cases/[workspaceId]/invoices/page.tsx` with server-side prefetch + `HydrationBoundary`,
  linked from the workspace navigation next to batches/todos.
- Invoice list; upload dialog (file + multi-select of `awaiting_invoice` case files); invoice detail to
  add/remove patients, open the PDF, delete.
- `case-file-sheet.tsx`: show the assigned invoice (name, link) when present.
- Messages in `messages/{en-US,de-DE}/cases.json`.

## Left to the builder
- Exact file-size limit, navigation placement, component structure.
- Manual "mark done" is removed from the UI (decided: `done` always means invoice assigned); existing `done` files
  without an invoice stay untouched. The builder decides whether to delete or keep the unused service function and route.
- Filename sanitization, cleanup of orphaned files on failed DB writes.

## Calls made (user to verify)
1. Disk storage instead of a SQLite BLOB.
2. 1 invoice : n case files via `case_files.invoiceId` (a case file cannot have several invoices).
3. Invoice upload allowed with zero assignments.
4. Deleting an invoice reverts its case files rather than being blocked.
5. Assign/unassign are all-or-nothing in one transaction; a case file that is not `awaiting_invoice` (including one
   already on another invoice) or is archived fails the whole request with `ValidationError`.
6. Any other existing path that moves a case file away from `done` must also clear `invoiceId`, so status and link
   never drift apart. The builder checks all such paths (today none is known besides unassign/delete).
7. No PDF replacement; to fix a wrong PDF, delete the invoice and upload again.
8. Delete order: revert case files in the DB first, then remove the file; a missing file on disk only makes the
   download return 404 and does not block deleting the invoice.
9. Upload validation: declared type `application/pdf` plus `%PDF-` magic bytes; the builder checks the pinned
   Next.js body-size limits against the chosen cap.
10. Read-only members see the invoices page and can download PDFs, with all mutation controls hidden.
