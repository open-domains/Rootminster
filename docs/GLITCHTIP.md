# GlitchTip monitoring

Rootminster can report browser and server failures to any GlitchTip instance using its Sentry-compatible ingestion API. The integration is disabled by default and does not require environment variables.

## Setup

1. Create a project in GlitchTip and select JavaScript or React as its platform.
2. Copy the project's DSN from GlitchTip's project settings.
3. In Rootminster, open **Admin → Module Settings → GlitchTip monitoring**.
4. Paste the DSN and set the environment name, normally `production`.
5. Set the error sample rate to `1`. Start performance tracing at `0.05` and adjust it to suit the available event allowance.
6. Enable the module and save it.
7. Select **Send test event** and confirm that `Rootminster GlitchTip test event` appears in GlitchTip.

The backend configuration updates immediately. Reload open Rootminster browser tabs after changing the module so the frontend receives the new public ingestion configuration.

## GitHub Actions sourcemaps

The production image workflow builds the browser application once, injects GlitchTip debug IDs, uploads its hidden sourcemaps, and packages that exact JavaScript bundle into the Docker image. The `.map` files are deleted before the image is assembled and are never served by Rootminster.

Add this GitHub Actions repository secret:

- `GLITCHTIP_AUTH_TOKEN` — an API token permitted to upload releases and sourcemaps.

The workflow defaults to the OpenDomains instance, organization and project. Forks can override them with these repository variables:

- `GLITCHTIP_URL`
- `GLITCHTIP_ORG`
- `GLITCHTIP_PROJECT`

Each build uses the full Git commit SHA as its release identifier. When the secret is absent, the image still builds but GitHub Actions emits a warning and skips the upload.

## Privacy and security

- GlitchTip DSNs contain a public ingestion key, not an administrative API token.
- Browser reports are sent through Rootminster's rate-limited `/api/observability/envelope` tunnel.
- User identity, cookies, authorization headers, request bodies, breadcrumbs, arbitrary extras and URL query strings are removed from captured events.
- Monitoring failures do not interrupt normal application requests.
- Production API responses continue to hide internal exception details.
