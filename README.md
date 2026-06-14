# BetterTracker

BetterTracker is a self-hosted expense tracker built with Next.js, Tailwind CSS, shadcn/ui, Better Auth, Drizzle, and SQLite.

Its a single local application that handles authentication, transaction entry, recurring schedules, admin settings, audit logs, and Discord notifications directly in the app.

## Features

- Multi-user authentication with Better Auth
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
DEFAULT_LOCALE=de-DE
TZ=Europe/Berlin
```

Notes:

- `DATABASE_URL` points to the local SQLite database.
- `BETTER_AUTH_ALLOWED_HOSTS` and `BETTER_AUTH_TRUSTED_ORIGINS` are important if you access the app through LAN IPs in development.
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

## License

This repository currently does not define a separate license file.
