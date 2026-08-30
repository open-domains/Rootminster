# Rootminster V2

Rootminster V2 is the standalone Open Domains management platform. 

## Stack

- React 18 and Vite frontend
- Fastify API running on Node.js 24
- PostgreSQL 17 with JSONB and targeted indexes
- Argon2id password hashing and database-backed sessions
- SMTP email, Cloudflare DNS, Stripe, Umami, Discord, Google OAuth, and Hostinger integrations
- Separate job runner with PostgreSQL advisory locks
- Docker Compose, with an optional Traefik overlay

## Quick start with Docker

1. Copy `.env.example` to `.env`.
2. Set `APP_URL`, `POSTGRES_PASSWORD`, and the integration credentials you use.
3. Start the application:

   ```bash
   docker compose up -d --build
   ```

4. Create the first administrator:

   ```bash
   docker compose exec \
     -e ADMIN_EMAIL=admin@example.com \
     -e ADMIN_PASSWORD='replace-with-a-long-password' \
     app npm run db:seed-admin
   ```

5. Open the local application on `http://127.0.0.1:3000`, or the URL configured in `APP_URL`.

Database migrations run automatically when the application container starts.

## Traefik

Create or reuse the external Docker network named in `TRAEFIK_NETWORK`, then start with both Compose files:

```bash
docker compose -f compose.yml -f compose.traefik.yml up -d --build
```

The overlay creates an HTTPS router for `APP_HOST` and sends traffic to port 3001 in the application container. The base Compose file also binds the service to `127.0.0.1:${APP_PORT}`; remove that port mapping if it is not wanted.

## Local development

Use a PostgreSQL database matching `DATABASE_URL`, then run:

```bash
npm install
npm run db:migrate
npm run dev
```

The web interface runs through Vite and proxies API requests to the local Fastify process.

## Importing existing data

The importer accepts either an object whose keys are entity names or an object containing an `entities` property:

```json
{
  "entities": {
    "User": [],
    "Domain": [],
    "DnsRecord": [],
    "SubdomainRequest": []
  }
}
```

Import a file with:

```bash
npm run db:import -- ./export.json
```

Or stream it into the running container:

```bash
docker compose exec -T app node scripts/import-data.js - < export.json
```

Legacy identifiers are mapped to new UUIDs and retained in `legacy_id`. Existing users are marked as verified but do not receive imported passwords; they must use the password-reset flow before email/password sign-in.

## Environment settings

The complete list is in `.env.example`. Only configure integrations that are actually used.

- `CLOUDFLARE_API_TOKEN` enables DNS creation, editing, deletion, and synchronization.
- `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` protect request and abuse forms.
- SMTP settings enable verification, password-reset, request, and abuse-report email.
- Stripe settings enable donations. Configure the webhook as `https://your-host/api/webhooks/stripe`.
- Google credentials enable the existing Google login buttons.
- Umami settings enable per-subdomain analytics.
- `HOSTINGER_API_KEY` enables the Docker Engine page inherited from the supplied interface.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the web and API development processes |
| `npm run build` | Build the production frontend |
| `npm start` | Start the API and serve the built frontend |
| `npm run jobs` | Start scheduled maintenance and synchronization jobs |
| `npm run db:migrate` | Apply the PostgreSQL schema |
| `npm run db:seed-admin` | Create or update an administrator account |
| `npm run db:import -- FILE` | Import a legacy JSON export |
| `npm run lint` | Run the code-quality checks |
| `npm run typecheck` | Check the JavaScript/JSX project |

## Security notes

- Keep PostgreSQL on the internal Docker network.
- Use a narrowly scoped Cloudflare token restricted to the required zones.
- Never commit `.env` or production exports.
- Put the public application behind HTTPS before enabling authentication.
- Back up the `postgres_data` volume before upgrades or bulk imports.
