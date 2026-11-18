# Outgoing invoice type (ambulant / konsil / stationär)

## Intent
Each outgoing invoice belongs to exactly one case type. The patient picker for an invoice only offers case files of that type, so invoices cannot be mixed up across types.

## Goals
- New invoices must have a type (`ambulant`, `stationaer`, `konsil`, same values as `case_files.case_type`).
- Upload dialog: pick the type first; the patient list appears afterwards, filtered by that type.
- Assign dialog: list is filtered by the invoice's type.
- Server enforces the match on upload and on assign (not only in the UI).
- Type shown as a badge in the invoice list.

## Non-goals
- No type change for invoices that already have one (wrong type: delete and re-upload).
- No automatic backfill of existing invoices.

## Decisions
- `case_invoices.invoice_type` is nullable in the DB. Existing invoices stay `null` ("no type"); the upload API and validator require it for new ones. (Decided with user.)
- Untyped invoices show a "no type" badge and a "set type" action. Setting is allowed only while the type is `null` and fails if any already-linked case file has a different type. Assigning further patients to an untyped invoice is blocked until a type is set. (Builder's call, derived from the above.)
- Assignable list endpoint takes the type as a query parameter; the service filters by `caseType`.
- i18n: new keys in both `messages/en-US/cases.json` and `messages/de-DE/cases.json` under `Cases.invoices`.
- Migration via `npm run db:generate`.
- Audit log: extend `case_invoice_uploaded` metadata with the type; new audit action for setting a type.

## Approaches considered
1. **Nullable column + validator-enforced for new uploads (chosen):** keeps legacy rows valid, no guessing.
2. NOT NULL with backfill from linked patients: fails for empty/mixed invoices, needs a guessed default.
3. Filter only in the UI: rejected, the server must guard against mismatched assignments.

## Left to the builder
Exact badge styling, placement of the "set type" action, wording of the translations.
