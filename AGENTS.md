# Repository Guidelines

## Project Structure & Module Organization

Rootminster is a React 18/Vite frontend with a Fastify API, PostgreSQL storage, and a separate job runner.

- `src/pages/`: route screens; `src/components/`: shared components and `ui/` primitives.
- `src/lib/` and `src/api/`: shared logic, React contexts and the API client. Translations live in `src/i18n/`.
- `src/themes/` and `src/index.css`: theme styling; consult `DESIGN.md` and `docs/themes.md` before changing visual conventions.
- `server/`: process entry points (`index.js`, `jobs.js`, `migrate.js`, `seed-admin.js`, `admin-ai-cli.js`) and `schema.sql`.
  - `server/core/`: config, database, entity store, security helpers, mail, module settings and the function runner.
  - `server/routes/`: Fastify route modules (auth, entities, contact form, public API, MCP, backups, terms and so on) and shared route guards.
  - `server/integrations/`: third-party services (Discord, GlitchTip, Hostinger Mail, R2, Docker, Observer, admin AI).
  - `server/lib/`: domain logic shared by routes, functions and jobs.
  - `server/functions/`: domain function handlers loaded by name.
- `tests/`: automated tests; server tests live in `tests/server/`. `public/` holds static assets; `docs/` holds documentation. `dist/` is generated output.

## Build, Test, and Development Commands

Use Node.js 24 and PostgreSQL 17. Run `npm ci`, copy `.env.example` to `.env`, and configure `DATABASE_URL`.

- `npm run db:migrate`: initialize or update the database schema.
- `npm run dev`: start Vite and the API; `dev:web` and `dev:api` run them separately.
- `npm run build`: generate the production frontend; `npm start` runs the production server.
- `npm run jobs`: run scheduled maintenance.
- `npm run lint`: run ESLint; `npm run lint:fix` applies supported fixes.
- `npm run typecheck`: check the files covered by `jsconfig.json`.
- `npm test`: run every `tests/**/*.test.js` file.

## Coding Style & Naming Conventions

Use ES modules, two-space indentation, and surrounding quote/semicolon conventions. Name React components in PascalCase (`ThemeToggle.jsx`), hooks with `use`, and utility modules descriptively (`cookie-consent.js`). Prefer `@/` imports within the frontend. Reuse existing Radix/Tailwind components and semantic color tokens. ESLint checks React hooks and unused imports; avoid unrelated formatting changes.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`; name files `*.test.js`. Add focused regressions for changed behavior, especially authorization, DNS validation, and persistence. No coverage threshold is configured. Check affected UI at desktop/mobile sizes and in both themes and color modes.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects, such as `Fix impersonation banner` and `Add passkeys`; no mandatory prefix is evident. Keep commits focused. PRs should explain the problem, resulting behavior, validation commands, related issues, and configuration or migration impacts. Include screenshots for visual changes.

## Security & Configuration

Never commit credentials or `.env`. Enforce permissions server-side, including privileged function handlers. Keep example configuration and documentation aligned with new settings.
