# Getting Started

## Prerequisites

Rootminster targets:

- Node.js 24
- PostgreSQL 17
- npm with `package-lock.json`
- Docker/Compose for containerized deployment
- Cloudflare API token for live DNS operations

The repository is ESM (`"type": "module"`) and uses React 18, Vite 6, Fastify 5, PostgreSQL `pg`, Radix UI primitives, TanStack Query, Stripe, Sentry/GlitchTip, Umami, and node-cron.

## Local Installation

```bash
git clone https://github.com/open-domains/Rootminster.git
cd Rootminster
npm ci
cp .env.example .env
```

At minimum configure database/app values in `.env`, including `DATABASE_URL` for local development. The README's Docker path also requires `APP_URL` and `POSTGRES_PASSWORD`.

## Database

```bash
npm run db:migrate
```

The migration runner applies `server/schema.sql`. Container startup also runs migrations.

## Development

```bash
npm run dev
```

This runs Vite and the API together. Separate commands are available:

```bash
npm run dev:web
npm run dev:api
```

## Production Commands

```bash
npm run build
npm start
npm run jobs
```

`npm start` runs `server/index.js`; `npm run jobs` runs `server/jobs.js`.

## Docker Quick Start

```bash
cp .env.example .env
# edit APP_URL and POSTGRES_PASSWORD
docker compose up -d --build
```

The stack starts `app`, `jobs`, and `postgres`. By default the app binds to `127.0.0.1:3000`.

## First Administrator

Either seed directly:

```bash
docker compose exec   -e ADMIN_EMAIL=admin@example.com   -e ADMIN_PASSWORD='replace-with-a-long-password'   app npm run db:seed-admin
```

Or set `INITIAL_SETUP_KEY`, open `/setup`, create the first administrator, and then remove the setup key.

## Validation Commands

```bash
npm run lint
npm run typecheck
npm run build
node --test server/*.test.js tests/*.test.js
```

There is no `npm test` script in `package.json`; tests use Node's built-in test runner.

## Configuration

- `.env.example` — bootstrap values and deployment configuration.
- `server/config.js` — normalized runtime config.
- `server/module-settings.js` — optional modules and field definitions.
- `compose.yml` — app/jobs/postgres deployment.
- `compose.traefik.yml` — HTTPS reverse-proxy overlay.
- `docs/themes.md` and `DESIGN.md` — visual/theme conventions.

## Where to Go Next

- Architecture: `architecture.md`
- API surface: `api.md`
- Module reference: `README.md#module-map`
- Existing upstream docs: `README.md`, `ARCHITECTURE.md`, and files in `docs/`
