# Module: Frontend Routing and UI

The frontend is a React 18 single-page app. `src/App.jsx` is the route registry and composes global providers, public content routes, authenticated user routes, staff routes, and admin routes.

## Responsibilities

- Mount public pages such as landing, guides, blog, FAQ, terms, privacy, report-abuse, RDAP, and API docs.
- Gate user dashboard routes behind `ProtectedRoute`.
- Gate staff/admin screens behind `RoleProtectedRoute`.
- Lazy-load page components with `lazyWithReload`.
- Wrap the app in auth, query, branding, setup, error boundary, cookie consent, and toast providers.

## Key Files

- `src/main.jsx` — React app mount.
- `src/App.jsx` — route tree and global provider composition.
- `src/pages/*.jsx` — public, user, staff, and admin screens.
- `src/components/Layout.jsx` — authenticated shell/sidebar layout.
- `src/components/ProtectedRoute.jsx` — signed-in access guard.
- `src/components/RoleProtectedRoute.jsx` — role-based route guard.
- `src/components/SetupGate.jsx` — first-run setup gate.
- `src/components/BrandRuntime.jsx` — runtime branding behavior.
- `src/components/ui/` — shared UI primitives.

## Public Route Groups

`App.jsx` registers static public routes for marketing pages, legal pages, guides, blog posts, RDAP lookup, activation, and API docs. These routes render outside the authenticated sidebar layout.

## Authenticated Route Groups

Signed-in routes include dashboard, subdomain management, requests, analytics, settings, and Discord linking. Admin/staff routes cover request review, subdomains, domains, users, reports, modules, donations, audit logs, email logs, Docker Engine, and account deletion requests.

## Dependencies

- **Uses:** `react-router-dom`, TanStack Query, Sonner, local auth/theme/query contexts, and many components/pages.
- **Used by:** Browser entry point and users interacting with the web app.

## Gotchas

- The route tree is explicit and large; adding a page usually means adding both a lazy import and a route.
- Staff and admin access must be enforced server-side too; route guards are UI convenience, not security.
- Visual changes should follow `DESIGN.md`, `docs/themes.md`, `src/themes/`, and semantic color tokens.
