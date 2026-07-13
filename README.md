# BetterTracker

BetterTracker is a self-hosted expense tracker built with Next.js, Tailwind CSS, shadcn/ui, Better Auth, Drizzle, and SQLite.

Its a single local application that handles authentication, transaction entry, recurring schedules, admin settings, audit logs, and Discord notifications directly in the app.

## Features

- Multi-user authentication with Better Auth
- Optional OpenID Connect (OIDC) login and registration
- Role-based access for `user`, `admin`, and `superadmin`
- Multiple trackers such as `Coffee`, `Money`, or custom tracker spaces
- Transaction entry with categories, payees, notes, and recent activity
- Inline creation of trackers, categories, and payees from the main flow
- Recurring schedules with manual transaction creation
- Admin area for users, trackers, logs, settings, and system stats
- Audit logging for mutations
- Optional Discord webhook notifications per tracker
- SQLite persistence through Drizzle ORM

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Better Auth
- Drizzle ORM
- better-sqlite3
- TanStack Query

## Requirements

- Node.js 20 or newer
- npm

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file:

```bash
cp .env.example .env
```

3. Update the values in `.env`.

At minimum, set a strong `BETTER_AUTH_SECRET`.

4. Run the database migration:

```bash
npm run db:migrate
```

5. Start the development server:

```bash
npm run dev
```

6. Open the app:

```text
http://localhost:3000
```

The first registered account becomes `superadmin`.

## Environment Variables

The project ships with the following example variables:

```env
DATABASE_URL=file:./data/sqlite.db
NODE_ENV=development
BETTER_AUTH_SECRET=replace-with-a-long-random-string
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_ALLOWED_HOSTS=localhost,127.0.0.1,192.168.100.13
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://192.168.100.13:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
OIDC_DISPLAY_NAME=OpenID Connect
OIDC_DISCOVERY_URL=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_SCOPES=openid,profile,email
DEFAULT_LOCALE=de-DE
TZ=Europe/Berlin
```

Notes:

- `DATABASE_URL` points to the local SQLite database.
- `BETTER_AUTH_ALLOWED_HOSTS` and `BETTER_AUTH_TRUSTED_ORIGINS` are important if you access the app through LAN IPs in development.
- To enable OIDC, set `OIDC_DISCOVERY_URL` and `OIDC_CLIENT_ID`. The callback URL is `${BETTER_AUTH_URL}/api/auth/oauth2/callback/oidc`.
- The admin setting `Registrierungen erlauben` also applies to OIDC sign-ups. Existing linked OIDC users can still use the login flow when registrations are disabled.
- Discord webhook settings are configured in the UI, either per tracker or as admin defaults that can be applied to all trackers.

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run db:generate
npm run db:migrate
npm run seed
```

## Database

- Schema definitions live in `lib/db/schema.ts`
- Drizzle config lives in `drizzle.config.ts`
- Migrations are written to `drizzle/`
- The default local database file is `data/sqlite.db`

## Application Areas

- `/` transaction entry and recent transactions
- `/transactions` filterable transaction history
- `/schedules` recurring schedules
- `/profile` current user overview
- `/admin` admin overview
- `/admin/users` user management
- `/admin/trackers` tracker management
- `/admin/logs` audit logs
- `/admin/settings` application settings

## Development Notes

- The app uses the Next.js App Router.
- API endpoints are implemented with route handlers under `app/api`.
- The default locale is German-first, but the README and codebase structure are English-friendly.
- SQLite is the default target for local and self-hosted deployments.

## Production Build

To create a production build:

```bash
npm run build
npm run start
```

## Docker

Build and run the production image:

```bash
docker build -t bettertracker:local .
docker run --rm \
  --name bettertracker \
  -p 3000:3000 \
  -v bettertracker-data:/app/data \
  -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -e BETTER_AUTH_URL="http://localhost:3000" \
  -e NEXT_PUBLIC_APP_URL="http://localhost:3000" \
  bettertracker:local
```

The container stores SQLite data in `/app/data` and applies pending Drizzle
migrations during startup. Set `RUN_MIGRATIONS=false` to disable automatic
migrations.

To run the published image with Docker Compose:

```bash
docker compose pull
docker compose up -d
```

Compose loads the existing `.env` file and passes all variables from it to the
container. If no `.env` exists yet, use the included template:

```bash
cp .env.compose.example .env
openssl rand -base64 32
```

Put the generated value into `BETTER_AUTH_SECRET` in `.env`. A differently
named environment file can be selected with
`BETTERTRACKER_ENV_FILE=/path/to/file docker compose up -d`.

Use a fixed release such as `ghcr.io/pantelx/bettertracker:1.0.0` for
`BETTERTRACKER_IMAGE` in production. To update later:

```bash
docker compose pull
docker compose up -d
```

SQLite data is kept in the named volume `bettertracker-data`. Stop the
application with `docker compose down`. Do not add `--volumes` unless the
database should also be deleted.

For a deployment behind a public domain or reverse proxy, also set
`BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_ALLOWED_HOSTS`, and
`BETTER_AUTH_TRUSTED_ORIGINS` to the deployed HTTPS origin:

```env
BETTER_AUTH_URL=https://tracker.example.com
NEXT_PUBLIC_APP_URL=https://tracker.example.com
BETTER_AUTH_ALLOWED_HOSTS=tracker.example.com
BETTER_AUTH_TRUSTED_ORIGINS=https://tracker.example.com
```

Better Auth derives dynamic callback URLs from the forwarded request host and
protocol. Ensure the reverse proxy forwards `X-Forwarded-Host` and
`X-Forwarded-Proto`; Caddy does this by default when using `reverse_proxy`.

## GitHub Container Registry

The workflow in `.github/workflows/container.yml` publishes images to:

```text
ghcr.io/<github-owner>/<repository>
```

Every push to `main` publishes `main` and `sha-<commit>` tags. Releases use
Semantic Versioning Git tags:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

The `v1.0.0` tag publishes the container tags `1.0.0`, `1.0`, `1`, and
`latest`. Pre-releases such as `v1.1.0-rc.1` do not replace `latest`.

No registry password is required in the repository: the workflow publishes
with GitHub's built-in `GITHUB_TOKEN`.

## License

This repository currently does not define a separate license file.
