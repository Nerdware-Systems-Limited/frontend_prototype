# Architecture

_Verified against the code on 2026-10-12._

A map of how the UAPTS frontend is put together and why. For the file-by-file index see
[`Reference.md`](Reference.md); for each subsystem in depth see the documents linked at the end of this page.

## 1. What this app is

A single-page Nuxt 4 / Vue 3 application (`ssr: false` for every route) that renders the national transport
dashboard for Kenyan agencies. It owns no data. Every figure, role and permission comes from the Django backend
(`/api/v1/...`) over REST and two WebSockets. The frontend's job is to:

1. sign people in and keep the session alive (see [AUTH_AND_SESSIONS.md](AUTH_AND_SESSIONS.md));
2. show each person only the pages and modules their agency and role open (see [ACCESS_CONTROL.md](ACCESS_CONTROL.md));
3. render module pages and configurable dashboards honestly, including when data is missing
   (see [DASHBOARD_MANAGER.md](DASHBOARD_MANAGER.md) and `PRODUCT.md`).

> **The server is the security boundary.** Everything the frontend does to hide a page, a control or a field is
> a convenience layer. See [SECURITY.md](SECURITY.md).

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | Nuxt 4.4 (`srcDir: app/`), Vue 3.5 Composition API, `<script setup>` everywhere |
| Rendering | SPA. `routeRules['/**'] = { ssr: false }` |
| State | Pinia: `auth`, `accessPolicy`, `notifications` stores |
| Styling | Tailwind (base/utilities) + a hand-written token system in `app/assets/css/theme.css` and `integration-hub.css`. Light and dark themes via `data-theme` on `<html>` |
| Maps | Leaflet + protomaps-leaflet (PMTiles), canvas renderer |
| Charts | d3-scale / d3-shape / d3-array for math only; marks are Vue templates (no chart library) |
| Icons | `lucide-vue-next` |
| Types | TypeScript strict, `vue-tsc` |
| Tests | Vitest + `@vue/test-utils` + happy-dom |

## 3. Directory layout

```
app/
  assets/css/        theme.css (tokens, shell, shared components), main.css, integration-hub.css
  components/        shared components (flat) + dashboard/{editor,viz,widgets}
  composables/       app-level composables; api/ holds one typed client per backend domain
  config/            agencyModuleSummary.ts (module -> headline KPI map for the agency Command Centre)
  layouts/           default.vue (authenticated shell), auth.vue (login & password flows)
  middleware/        auth.global.ts, dashboard-manager.global.ts
  pages/             file-based routes, grouped by module
  plugins/           api, auth-sync, access-policy, theme, leaflet
  stores/            auth, accessPolicy, notifications
  types/             uapts.ts (API shapes), dashboard.ts (dashboard schema), frame.ts (widget data frames)
  utils/             pure TypeScript: access resolver, bindings, data sources, thresholds, units, layout engine ...
tests/
  unit/              one file per subsystem (51 files, 747 tests at the time of writing)
  integration/       live.test.ts, probes a running backend
  fixtures/          access-control.json (copy of the backend's baseline policy)
docs/                this folder
```

`utils/` is deliberately free of Nuxt and Vue state wherever possible (the access resolver, tab sync, layout
engine, bindings and thresholds are plain functions), which is what makes the 747 unit tests fast and
Nuxt-free.

## 4. Boot sequence

1. **Plugins** run alphabetically on the client: `access-policy.client` registers the API storage adapter for
   the access policy store (it loads nothing), `api` provides `$api`, `auth-sync.client` starts cross-tab session
   sharing, `leaflet.client` and `theme.client` apply the stored theme before first paint.
2. **Global route middleware** runs on every navigation, in file-name order:
   1. `auth.global.ts`: public routes pass; otherwise hydrate the refresh token from storage, ask sibling tabs
      for a session if there is none, silently refresh if there is no live access token, else redirect to
      `/login?redirect=<path>`. Once authenticated it awaits `useAccessPolicyStore().ensureLoaded()` (baseline
      policy, saved overrides, viewer permissions) and then resolves the route through
      `useAccessControl().resolveRoute()`. A denied route redirects to the safe space (`/dashboard`).
   2. `dashboard-manager.global.ts`: `/admin/dashboards/**` needs `dashboards.manage` or
      `dashboards.manage_agency`, otherwise it redirects to `/dashboard`.
3. **Layout** `default.vue` mounts `AppTopNav` + `AppSidebar` and owns the notifications WebSocket lifecycle.
4. **Page** loads its own data through the domain composables.

## 5. Data flow

```
page / component
   │  useSafety().summary()
   ▼
composables/api/useSafety.ts      typed wrapper, builds URL + query (cleanQuery)
   │  $api(path, opts)
   ▼
plugins/api.ts                    Bearer token, single refresh-and-retry on 401, force logout on a second 401
   │  $fetch(baseURL + path)
   ▼
Django REST  /api/v1/...
```

- In development `apiBaseUrl()` returns `''` and the Nuxt dev server proxies `/api` and `/media` to the backend
  (`nitro.devProxy`), so the browser stays same-origin. In production builds it returns the absolute
  `NUXT_PUBLIC_API_BASE`. See [API_LAYER.md](API_LAYER.md).
- WebSockets (`/ws/notifications/`, `/ws/audit/`) always connect directly to the backend with the JWT in the
  `?token=` query string, because the dev proxy cannot upgrade them (explained in `app/utils/apiBase.ts`).

## 6. Two independent access axes

A page opens only when both agree:

| Axis | Question | Code |
|---|---|---|
| Role tier | What may this person do? | `usePermissions()` (rank of `role_type`) |
| Agency scope | Whose data and which modules? | `useAccessControl()` -> `utils/resolveAccess.ts` |

The agency-scope baseline policy is no longer a file in this repo. It is served by the backend at
`GET /api/v1/access-control/baseline/` and held in a reactive object (`BASE_SETTINGS`). Saved Module Access
overrides are read and written through `/api/v1/access-control/`. Until the baseline arrives the resolver fails
closed. Details in [ACCESS_CONTROL.md](ACCESS_CONTROL.md).

## 7. Honest data

A product rule that shapes the code (see `PRODUCT.md`, principle 2): the UI never fabricates a figure.

- A missing value renders `-` with a reason, never `0`.
- Composables written ahead of a backend endpoint (several maritime and rail ones) render a
  "not yet integrated" state and light up when the endpoint ships.
- Dashboard widgets map failures to explicit states: `loading`, `refreshing`, `ready`, `empty`, `partial`,
  `not-integrated`, `forbidden`, `error` (`useWidgetData`, `WidgetState.vue`).
- A widget says "Not filtered by ..." when a dashboard filter does not apply to its endpoint.

## 8. Theming

- Default theme is **light**, regardless of the OS preference. The top-bar toggle stores the choice in
  `localStorage['uapts_theme']`.
- All colour resolves from CSS custom properties in `theme.css`. Fixed hex is intentional only for the Leaflet
  canvas, SVG chart presentation attributes and categorical status palettes.
- `/login`, `/forgot-password` and `/reset-password/*` use `layouts/auth.vue`, which never reads `data-theme` and
  has its own accessibility controls.
- Design rules live in `DESIGN.md`.

## 9. Where to read next

| Topic | Document |
|---|---|
| Setup, scripts, tests, conventions, recipes | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Login, MFA, tokens, cross-tab sessions | [AUTH_AND_SESSIONS.md](AUTH_AND_SESSIONS.md) |
| `$api`, domain composables, WebSockets, errors | [API_LAYER.md](API_LAYER.md) |
| Role tiers, agency scope, Module Access | [ACCESS_CONTROL.md](ACCESS_CONTROL.md), [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) |
| Configurable dashboards and widgets | [DASHBOARD_MANAGER.md](DASHBOARD_MANAGER.md), [Widgets.md](Widgets.md) |
| Security posture and known gaps | [SECURITY.md](SECURITY.md), [SECURITY_AUDIT.md](SECURITY_AUDIT.md) |
| Backend work the frontend is waiting on | [BACKEND_FIXES.md](BACKEND_FIXES.md), [dashboard-manager-integration.md](dashboard-manager-integration.md) |
