<div align="center">

# BetterTracker

**Your favorite self-hosted finance tracker!**

_BetterTracker is a self-hosted, multi-user expense and income tracker. Manage multiple trackers with custom categories, payees, and recurring schedules. Share trackers publicly, monitor your finances with statistics and charts, and administrate users via a built-in admin panel with role-based permissions and audit logging. A separate Cases area adds patient case file management for medical billing (PVS), with a status workflow, submission batches, and per-case-type PDF exports._

![Version](https://img.shields.io/github/v/release/pantelx/bettertracker?style=flat-square&label=version)
![Build](https://img.shields.io/github/check-runs/pantelx/bettertracker/main?style=flat-square&label=build)
![License](https://img.shields.io/github/license/pantelx/bettertracker?style=flat-square)

[Quick Start](#quick-start) · [Demo](https://bettertracker.pantelx.com) · [GitHub Issues](https://github.com/panteLx/BetterTracker/issues) · [Discord](https://discord.gg/Ma4SnagqwE)

<details>
<summary>Show Screenshots</summary>
<img width="1920" height="1080" alt="dashboard" src="https://github.com/user-attachments/assets/43a2ba48-2aca-43cf-87d8-77423980042f" />
<img width="1920" height="1080" alt="statistics" src="https://github.com/user-attachments/assets/58ac9e7e-7172-4330-a864-8aea70436f6f" />
<img width="1920" height="1080" alt="schedules" src="https://github.com/user-attachments/assets/2fb02133-6061-4913-b21f-a3e1fe79584f" />
<img width="1920" height="1080" alt="transactions" src="https://github.com/user-attachments/assets/5b0e4150-3ac6-47ec-a40a-d47e8c2cf348" />
</details>

## Features

| Feature            | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| **Trackers**       | Multiple trackers with custom colors, currencies, and members   |
| **Transactions**   | Record income and expenses with categories and payees           |
| **Schedules**      | Recurring payment templates with flexible frequency settings    |
| **Statistics**     | Visual charts for monthly trends, category breakdowns, and more |
| **Public Sharing** | Share trackers publicly via a unique link with live statistics  |
| **Authentication** | Email/password or custom OIDC provider                          |
| **Admin Panel**    | User management, registration control, and audit logging        |
| **Roles**          | Superadmin, admin, and user roles with per-tracker permissions  |
| **Discord**        | Optional webhook notifications per tracker                      |
| **Cases**          | Patient case file management for PVS medical billing, with a status workflow, submission batches, and PDF exports |

## Quick Start

</div>

### Docker

```bash
docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e BETTER_AUTH_SECRET=$(openssl rand -base64 32) \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  --name bettertracker \
  ghcr.io/pantelx/bettertracker:latest
```

Open http://localhost:3000. The first registered user becomes superadmin.

### Docker Compose

```bash
git clone https://github.com/panteLx/BetterTracker.git
cd BetterTracker
cp .env.example .env
# Edit .env and set BETTER_AUTH_SECRET
docker compose up -d
```

### From Source

```bash
git clone https://github.com/panteLx/BetterTracker.git
cd BetterTracker
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

<div align="center">

## Configuration

</div>

### Required

```bash
BETTER_AUTH_SECRET=          # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_ALLOWED_HOSTS=localhost
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000
```

### Optional: Custom OIDC

```bash
OIDC_DISPLAY_NAME=OpenID Connect
OIDC_DISCOVERY_URL=https://sso.example.com/.well-known/openid-configuration
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_SCOPES=openid,profile,email
```

### Optional: Localization

```bash
DEFAULT_LOCALE=en-US   # en-US or de-DE, used until a user picks a language
TZ=Europe/Berlin       # used for date/time formatting
```

See [.env.example](.env.example) for all options.

<div align="center">

## Cases Module

</div>

Patient case files live in their own **workspaces** (the same owner/admin/write/read permission model as trackers) inside the **Cases** area, reachable via the area switcher next to the theme toggle.

**Status workflow:** Needs processing → Medical controlling → Queued for PVS _(optional)_ → Sent to PVS → Done, with a Returned action that resets a case back to Needs processing and tracks a return count.

**PVS submissions:** Sending case files to PVS groups them into a dated submission batch with per-case-type PDF exports. Admins can hide/unhide a batch from the submissions list without changing its case files' status or history.

<div align="center">

## Database Commands

</div>

```bash
npm run db:migrate    # Apply migrations
npm run db:generate   # Generate migrations after schema changes
npm run db:studio     # Open Drizzle Studio GUI
```

<div align="center">

## Releasing

</div>

Maintainers with push access can cut a release from a clean `main` with:

```bash
npm run release patch   # 0.1.0 -> 0.1.1
npm run release minor   # 0.1.0 -> 0.2.0
npm run release major   # 0.1.0 -> 1.0.0
```

This bumps `package.json`/`package-lock.json`, commits, tags, and pushes, then
creates a GitHub release with auto-generated notes. The pushed tag triggers
[`container.yml`](.github/workflows/container.yml), which builds and
publishes the versioned Docker image. Requires the [GitHub CLI](https://cli.github.com)
to be installed and authenticated (`gh auth login`).

<div align="center">

## Docker Images

Images are available at `ghcr.io/pantelx/bettertracker`:

| Tag      | Description                  |
| -------- | ---------------------------- |
| `latest` | Latest stable release        |
| `vX.Y.Z` | Specific version             |
| `main`   | Development build (unstable) |

## Tech Stack

| Layer     | Technology                        |
| --------- | --------------------------------- |
| Framework | Next.js 16, React 19, TypeScript  |
| Database  | SQLite, Drizzle ORM               |
| Auth      | Better Auth                       |
| UI        | Tailwind CSS, shadcn/ui, Radix UI |
| Charts    | Recharts                          |

## Support

[GitHub Issues](https://github.com/panteLx/BetterTracker/issues) ·
[Buy Me a Coffee](https://www.buymeacoffee.com/pantel) ·
[GitHub Sponsors](https://github.com/sponsors/pantelx)

## License

MIT License. See [LICENSE](LICENSE) for details.

</div>
