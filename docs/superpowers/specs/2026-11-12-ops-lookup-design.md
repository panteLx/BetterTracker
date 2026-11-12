# OPS lookup (AOP / Hybrid-DRG) design

## Intent

When billing outpatient surgery (AOP), the user needs several billing codes ("Ziffern") for one OPS code. Today they are spread across sources and hard to find, especially the hygiene surcharge and the funding surcharge. The user also must always know (a) whether the OPS code is billable under §115b and (b) whether it is Hybrid-DRG-eligible. Hybrid-DRG cases must not be billed as AOP.

Goal: a search page in the Cases module that returns all of this for any OPS code in one view, fed by two Excel files that an admin can re-upload when new versions are published.

## Data sources

- **Anhang 2** (`.xlsx`, ~11,200 rows, one sheet). Header row, columns by name:
  `OPS 2026`, `Bezeichnung OPS 2026`, `ambulante Operation`, `Überwachungs-komplex ambulant`, `ambulante Anästhesie`, `Zuschlag Förderung`, `§115b` (`Ja` / `-`), `Zuschlag für den zusätzlichen Hygieneaufwand`. Other columns are ignored.
- **Hybrid-DRG list** (`.xlsx`, ~900 rows, one sheet). Columns `OPS 2026`, `OPS-Bezeichnung 2026`. Presence of an OPS code means Hybrid-DRG-eligible; absence means not eligible.
- Funding surcharge may be empty for some rows; show "–" then.
- Code-suffix rows like `5-530.0x` / `.0y` exist in the Hybrid list; match on exact OPS string only.

## Fixed codes

Arztbrief per Post (40110), Arztbrief per Fax (40111), Pauschale bis 59 Jahre (07211), Pauschale ab 59 Jahre (07212) are identical for every OPS code. They are stored as editable settings (seeded with these defaults) and shown on every result.

## Behavior

- Search box matches OPS code (prefix/substring) or any words in the description, case-insensitive; results list left, detail card right (stacked on phones). Mockup: https://claude.ai/artifact/9pdZFR4zFTZpa4S8K5KXt2 (layout reference, not final copy).
- Detail card shows: OPS code, description, §115b status, Hybrid-DRG status, Operation, Überwachungskomplex, Zuschlag Förderung AOP, Hygienezuschlag, the four fixed codes, Anästhesie. Every code has a copy button.
- **AOP rule:** AOP billing is *not possible* if `§115b = "-"` OR the code is Hybrid-DRG-eligible. In that case a prominent red message names every reason that applies (both can apply), and all codes stay visible but greyed out. Otherwise a green "AOP abrechenbar" message is shown.
  - Example: `5-530.00` has §115b = Ja and is Hybrid-DRG-eligible, so it shows the blocked message.
- Show the source file names/dates and row counts on the page so the user knows which version is loaded.

## Upload and admin

- Only admins (global admin/superadmin role) can upload the two files and edit the fixed codes; other Cases users get read-only search.
- Uploading replaces the previous dataset for that file entirely (in one transaction). Files are validated before anything is replaced: required columns present, at least one data row. On failure show a clear error and keep the old data.
- Log uploads and fixed-code changes via the existing audit log.

## Constraints

- Follow existing project patterns (see `CLAUDE.md`): route handlers call guards then `lib/services/*`, Zod validators, Drizzle schema + migration, server-side prefetch with TanStack Query, `next-intl` messages in `en-US` and `de-DE` (new namespace needs both locales and the loader).
- Cases module only; no new dependency unless needed for xlsx parsing (none is installed today). Pick a well-maintained parser and say which.
- No test runner exists; verify with `npm run lint`, `npm run build` and a browser check using the two real sample files.

## Non-goals

- No billing logic beyond the rule above, no per-case integration (linking to case files), no history of old dataset versions, no support for other OPS years' column layouts beyond required-column validation.

## Left to the builder

Table design and indexing, how the upload is parsed (server-side), route and navigation placement inside Cases (workspace-independent vs. per workspace), exact UI copy, search ranking.

## Calls made without the user (to confirm)

- Page lives in the Cases module, visible to all users with Cases access.
- Data stored in SQLite, replaced entirely on upload.
- "Admins" means the global admin/superadmin role, not per-workspace admins.
- Greyed-out display for blocked codes (confirmed by user); red/green message wording is a proposal.
