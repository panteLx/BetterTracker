# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev              # Start dev server
npm run build             # Production build
npm run lint               # ESLint (eslint-config-next, flat config)
npm run db:generate        # Generate a drizzle migration after editing lib/db/schema.ts
npm run db:migrate         # Apply migrations (also runs automatically via instrumentation.node.ts when RUN_MIGRATIONS=true)
npm run seed                # Migrate + run scripts/seed.ts
npm run release patch|minor|major   # Bump version, tag, push, create GitHub release (maintainers only, needs gh CLI)
```

There is no test suite/test runner in this repo — don't invent test commands. Verify changes with `npm run lint`, `npm run build`, and manual/browser checks.

## Next.js version warning

This repo pins a Next.js version ahead of most training data (see `AGENTS.md`). The concrete breaking change already present in this codebase: **`middleware.ts` has been renamed to `proxy.ts`** (same `NextRequest`/`NextResponse`/`config.matcher` API, just a different file name and exported function name — see `proxy.ts`). Before relying on other Next.js API knowledge, check `node_modules/next/dist/docs/`.

## Architecture

BetterTracker is a self-hosted, multi-user finance tracker with a bolted-on **Cases** module (patient case file / medical billing management). The two modules are structurally parallel but independent — expect to find matching concepts under different names in each.

### Two parallel domains

| Concept | Finance module | Cases module |
|---|---|---|
| Container | `trackers` | `case-workspaces` |
| Membership permission | `owner/admin/write/read` (`trackerMembers`) | same shape, separate table |
| Per-user module gate | `user.canAccessTrackers` | `user.canAccessCases` |
| API guards | `lib/auth/guards.ts` | `lib/auth/case-workspace-guards.ts` |
| Access lookup | `lib/auth/tracker-access.ts` | `lib/auth/case-workspace-access.ts` |
| Routes | `/trackers`, `/transactions`, `/schedules`, `/statistics` | `/cases/[workspaceId]/...` |

A user with a module gate disabled is redirected away from that module's pages (`requireTrackerModuleUser` / `requireCaseModuleUser` in `lib/auth/session.ts`) rather than seeing an error — falling back to the other module, or to `/no-access` if neither is reachable.

### Auth stack

- **Better Auth** (`lib/auth.ts`) backed by the Drizzle SQLite adapter, with email/password and optional generic OIDC (`lib/auth/oidc.ts`, enabled only when `OIDC_DISCOVERY_URL` etc. are set).
- Roles are `user` / `admin` / `superadmin` (global, via the Better Auth `admin` plugin + `lib/auth/access-control.ts`), completely separate from the per-tracker/per-workspace `owner/admin/write/read` permission on membership rows.
- The first user ever registered is auto-promoted to `superadmin` (`lib/auth/first-user.ts`).
- Auth API routes require a `Headers` object explicitly (no implicit cookie access) — session/guard functions in `lib/auth/session.ts` and `lib/auth/guards.ts` take `request.headers` as a parameter.
- Route protection at the edge lives in `proxy.ts` (session-cookie presence check only, for redirect UX); real authorization always happens server-side via the guard functions, never trust the proxy check alone.

### API route pattern

Every route handler under `app/api/**/route.ts` follows the same shape:
1. Call the relevant `require*Api`/`require*Access` guard from `lib/auth/guards.ts` or `lib/auth/case-workspace-guards.ts`, passing `request.headers`. If `authResult.response` is set, return it immediately.
2. Delegate real work to a function in `lib/services/*.ts` (business logic and Drizzle queries live there, not in the route file).
3. Wrap in try/catch and return via the response helpers in `lib/http.ts` (`ok`, `created`, `badRequest`, `forbidden`, `notFound`, `conflict`, `serverError`, `mapServiceError`) — `mapServiceError` recognizes `HttpError` subclasses (`lib/errors.ts`) and Zod errors as 4xx.
4. Validate request bodies against schemas in `lib/validators/*.ts` (Zod).
5. Mutations that matter for accountability call `logAuditEvent` (`lib/audit-log.ts`).

### Data layer

- SQLite via `better-sqlite3` + Drizzle ORM. Single schema file: `lib/db/schema.ts`. `lib/db/index.ts` opens the DB file (path from `DATABASE_URL`, default `file:./data/sqlite.db`) with WAL mode and foreign keys on.
- After editing the schema, run `npm run db:generate` to produce a migration under `drizzle/`, then `npm run db:migrate`. In production, migrations instead run at boot via `instrumentation.ts`/`instrumentation.node.ts` when `RUN_MIGRATIONS=true`.
- Every table gets `createdAt`/`updatedAt` from the shared `timestamps` helper at the top of `schema.ts`.

### Data fetching / loading UX

Pages avoid client-side loading spinners on first paint: each `page.tsx` (Server Component) creates a query client, prefetches the data a page needs directly from the DB/service layer, and wraps the client component in `<HydrationBoundary>` (TanStack Query). Client components then read from a warm cache instead of showing a skeleton. When adding a new data-driven page, follow this prefetch pattern rather than fetching only client-side.

### i18n

- `next-intl`, locales are `en-US` and `de-DE` (`lib/i18n/config.ts`), chosen via a cookie (`bettertracker.locale`), not the URL — there is no `[locale]` route segment.
- Messages are split per-feature under `messages/<locale>/*.json` (e.g. `admin.json`, `cases.json`) and aggregated in `lib/i18n/request.ts`, keyed by namespace (`Common`, `Trackers`, `Cases`, etc.) — adding a new namespace means updating both locale directories and the `loadMessages` aggregator.

### Cases module specifics

- Status workflow for case files: Needs processing → Medical controlling → (optional) Queued for PVS → Sent to PVS → Done, plus a Returned action.
- Sending files to PVS groups them into a dated submission "batch" (`lib/services/pvs-submission-service.ts`) with per-case-type PDF export (`lib/services/pdf/`, built on `@react-pdf/renderer`).
- Case files and to-do lists support archiving (soft-delete, reversible, read-only while archived) instead of hard deletion.
- Date fields accept locale-aware shorthand entry (e.g. `18.11.99` → `18.11.1999`); see the case-file validators/service for the parsing rules before changing date handling.

### UI

shadcn/ui ("new-york" style) + Radix primitives, Tailwind CSS v4. `components/ui/` holds generated primitives; feature components are grouped by domain (`components/cases/`, `components/trackers/`, `components/admin/`, etc.), with shared chrome (`app-header`, `page-container`, `module-switcher`) in `components/layout/`.
