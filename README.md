# UAPTS Frontend - Nuxt 4 + Vue 3

The Unified Analytics and Predictive Transport System dashboard SPA for Kenyan transport agencies. It owns no
data: every figure, role and permission comes from the Django backend over REST and two WebSockets.

**Documentation:** this file is the quick start. Detailed docs live in [`docs/`](docs/README.md): architecture,
development guide, auth and sessions, API layer, access control, Dashboard Manager, security and the full
code-level reference.

## Stack

- **Nuxt 4** (`srcDir: app/`) as a single-page app (`ssr: false` for every route), file-based routing under
  `app/pages/`
- **Vue 3** Composition API throughout
- **Pinia** for the auth store (`app/stores/auth.ts`), notifications, and
  Module Access overrides (`app/stores/accessPolicy.ts`)
- **Tailwind CSS** for base/utilities, plus a custom institutional-blue
  design system in `app/assets/css/theme.css` (tokens, top nav, sidebar, KPI
  cards, agency cards, alerts, modals) with light and dark themes - see
  [Theming](#theming) below
- **lucide-vue-next** icons, **Leaflet** + protomaps for maps, **d3-scale/shape/array** for chart maths (marks are
  Vue templates, no chart library)
- **TypeScript** strict mode
- **Vitest** for unit + integration tests (57 files, 813 tests)

## API wiring

All backend calls go through typed composables under `app/composables/api/`,
re-exported from `app/composables/api/index.ts` (import via
`~/composables/api` rather than deep-relative paths):

```
app/composables/api/
├── _client.ts                    # $api wrapper + cleanQuery helper
├── useSystem.ts                  # /api/, /api/v1/health/, /api/schema/
├── useAudit.ts                   # /api/v1/audit/*
├── useAccounts.ts                # M10 - agencies, departments, roles, users
├── useDashboard.ts               # M01 - cross-module KPI aggregation
├── useTraffic.ts                 # M02 - Road Traffic Management
├── useFleet.ts                   # M03 - Fleet Tracking & Vehicle Management
├── useVehicleInspections.ts      # M03 - NTSA roadworthiness inspections
├── useDriverLicensing.ts         # M03 - NTSA driver identity + licences
├── usePublicTransport.ts         # M04 - Public Transport Operations
├── useSafety.ts                  # M05 - Safety & Incident Management
├── useInfrastructure.ts          # M06 - Infrastructure & Network Health
├── useAviationMaritime.ts        # M07 - Aviation + Maritime catalog & live ops
├── useAviationInfrastructure.ts  # M07a - Aviation infrastructure assets
├── useAviationLicensing.ts       # M07a - Aircraft/operator licensing (KCAA)
├── useMaritimeInfrastructure.ts  # M07b - Maritime port/berth infra assets
├── useMaritimeServices.ts        # M07b - Cargo handling, pilotage, licensing
├── useMaritimeCargo.ts           # M07b - Cargo types, import/export pipeline
├── useMaritimeWaterways.ts       # M07b - Chartered/unchartered waterways
├── useMaritimeGreenTransport.ts  # M07b - Vessel emissions, EV fleet, cold chain
├── useMaritimePerformance.ts     # M07b - Port performance KPIs & ranking
├── useRailway.ts                 # M08 - Railway Management
├── useRailInfrastructure.ts      # M08 - Rail infrastructure assets
├── useRailSafety.ts              # M08 - Rail safety compliance
├── useCorridor.ts                # M15 - Corridor & Trade (transit, border crossings, corridor KPIs)
├── useReports.ts                 # M09/M15 - Reporting & BI
├── useQuery.ts                   # M15 - Ad-hoc Query Builder
├── useMlPredictive.ts            # M16 - ML model registry + Ask assistant
├── useNotifications.ts           # M11 - event-driven notifications
├── useIntegrations.ts            # M12 - Data Integration Hub
├── useGis.ts                     # M13 - GeoJSON / map endpoints
├── useGisLayers.ts               # M13 - uploaded layers, coverage, layer requests
└── useTraining.ts                # M14 - Training Institutes
```

Several maritime composables (`useMaritimeServices`, `useMaritimeCargo`,
`useMaritimeWaterways`, `useMaritimeGreenTransport`, `useMaritimePerformance`)
are written ahead of the backend API, mirroring the established
`useMaritimeInfrastructure`/`useRailInfrastructure` pattern: the shapes match
the design doc, and the corresponding pages render an honest empty state
until the backend mounts the endpoint. No mock data is fabricated.

The composables reuse the `$api` Nuxt plugin from `app/plugins/api.ts`, which
handles Bearer-token injection and a single silent refresh-and-retry on 401.
In `nuxi dev` the browser stays same-origin: the Nuxt dev server proxies `/api`
and `/media` to `NUXT_PUBLIC_API_BASE` (`nitro.devProxy`), so no backend CORS
change is needed; production builds call the absolute URL. WebSockets always
connect straight to the backend. See [`docs/API_LAYER.md`](docs/API_LAYER.md).

Two clients live outside `api/` because they carry their own error handling:
`app/composables/useDashboardApi.ts` (Dashboard Manager, `/api/v1/dashboards/`)
and the access-policy adapter in `app/utils/accessPolicyStorage.ts`
(`/api/v1/access-control/`).

## Pages

Routes live under `app/pages/`, grouped by module:

- `/dashboard` - M01 dashboard. Shows the dashboard the server assigns to the viewer, or falls back to the
  National (super admin, SDT) or Agency Command Centre when none is assigned
- `/traffic`, `/traffic/analytics`, `/traffic/alerts` - M02 Road Traffic
- `/fleet`, `/fleet/live`, `/fleet/behaviour`, `/fleet/geofences`, `/fleet/trip-playbacks` - M03 Fleet
- `/public-transport` and subpages (`brt`, `compliance`, `driver-licensing`, `operators`, `vehicle-inspections`, `vehicle-registration`) - M04
- `/safety` and subpages (`incidents`, `blackspots`, `kpis`) - M05
- `/infrastructure` and subpages (`overview`, `bridges`, `funding`, `maintenance`, `projects`) - M06
- `/aviation` and subpages (`overview`, `flights`, `infrastructure`, `licensing`, `passenger-stats`) - M07a
- `/maritime` and subpages (`overview`, `vessels`, `port-ops`, `infrastructure`, `services`, `cargo`, `waterways`, `accidents`, `green-transport`, `performance`, `imports-exports`) - M07b
- `/railway` and subpages (`live`, `freight`, `schedules`, `infrastructure`, `network-inventory`, `safety`) - M08
- `/corridor` and subpages (`northern`, `border-crossings`, `transit`, `lapsset`) - M15 Corridor & Trade
  (NCTTCA, KenTrade, LAPSSET; backend `/api/v1/corridor/`, read-only)
- `/analytics`, `/query-builder`, `/reports` - M09
- `/agencies`, `/users`, `/roles`, `/access-policies`, `/audit` - M10 access control
  (`/audit` is scoped by viewer: platform, own agency or own actions only; see `docs/Reference.md`)
  (`/access-policies` is "Module Access": per-agency and per-role module, page,
  data-category and capability access; see `docs/ACCESS_CONTROL.md`)
- `/admin/dashboards`, `/admin/dashboards/[id]` - Dashboard Manager: list and
  editor (needs `dashboards.manage` or `dashboards.manage_agency`; see
  `docs/DASHBOARD_MANAGER.md`)
- `/notifications`, `/notifications/rules` - M11
- `/integrations` and subpages (`analytics`, `files`, `files/[id]`, `feeds/[source_id]`) - M12
- `/gis` and subpages (`overview`, `coverage`, `layers`, `layers/[id]`, `requests`) - M13 GIS & Spatial Analysis
  (the five subpages cover agency-uploaded layers; see `docs/Reference.md` M13)
- `/training` and subpages (`cohorts`, `enrollments`, `completions`) - M14
- `/profile` - user profile
- `/login`, `/forgot-password`, `/reset-password/[uid]/[token]` - auth layout
  (`layouts/auth.vue`), the only routes outside `layouts/default.vue`

`/` redirects to `/dashboard` (see `routeRules` in `nuxt.config.ts`). Pages
whose composable is ahead of the API (see above) render an honest "not yet
integrated" empty state instead of mock data, and light up automatically
once the endpoint ships.

## Sessions and access

- **Tokens.** The access token lives in memory only. The refresh token goes to `localStorage` ("Remember me") or
  `sessionStorage`. A refresh rotates the token, and tabs share the session over a `BroadcastChannel` with a Web
  Lock serialising refreshes, so "open in new tab" stays signed in and two tabs cannot log each other out. See
  [`docs/AUTH_AND_SESSIONS.md`](docs/AUTH_AND_SESSIONS.md).
- **Route guard.** `app/middleware/auth.global.ts` requires a session, loads the access policy, then resolves the
  route against it; denied routes go to `/dashboard`. `dashboard-manager.global.ts` additionally protects
  `/admin/dashboards/**`.
- **Access model.** Two independent axes: role tier (`usePermissions`) and agency scope (`useAccessControl`). The
  baseline policy is **served by the backend** (`GET /api/v1/access-control/baseline/`), Module Access overrides are
  saved through `/api/v1/access-control/`, and the resolver fails closed until the baseline arrives. All of this is a
  UI convenience layer; the backend is the security boundary (`docs/SECURITY.md`).

## Theming

The default-layout app is themed via `data-theme="light"|"dark"` on
`<html>`, set by `useTheme()` (`app/composables/useTheme.ts`) and applied
before first paint by `app/plugins/theme.client.ts` to avoid a flash. All
color in `app/assets/css/theme.css` (and page/component styles) should
resolve from its CSS custom properties (`--fg-*`, `--surface-*`,
`--border-*`, `--primary*`, `--success/warning/danger/info-fg`, etc.) rather
than literal hex, so it repaints correctly under both themes.

- **Default is light**, regardless of OS `prefers-color-scheme` - a
  government dashboard used in bright offices and on wall displays
  shouldn't silently open dark. The toggle in the top bar persists an
  explicit choice to `localStorage` (`uapts_theme`).
- **Known, intentional exceptions** that stay fixed hex rather than
  following the theme: colors painted onto the Leaflet canvas map
  (`UaptsMap.vue` uses `preferCanvas:true`, and SVG chart components like
  `TrendLineChart`/`MultiLineChart` use presentation attributes) - neither
  can resolve CSS custom properties, so their colors (including map-legend
  dots meant to visually match a marker) are literal hex on purpose.
  Genuinely categorical, multi-hue data palettes (vehicle class, model
  name, cargo/rail/flight status, etc.) are also left fixed, since they're
  meant to stay visually consistent across themes rather than flip with
  light/dark.
- **`/login`, `/forgot-password`, `/reset-password/[uid]/[token]` do not
  follow this theme.** They use the separate `layouts/auth.vue` layout,
  which never reads `data-theme`, and instead run their own independent
  high-contrast / grayscale / font-size accessibility controls local to
  the login screen. This is intentional today, not a gap - if that ever
  needs to change, it's a product decision, not a mechanical fix.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Dev server runs on `http://localhost:3000` (or the next free port). API
calls go directly to `NUXT_PUBLIC_API_BASE`, which defaults to the deployed
backend at `https://uapts.eu.cc`. To point at a local backend instead, set
`NUXT_PUBLIC_API_BASE=http://127.0.0.1:8000` in `.env`.

## Tests

```bash
npm run test         # one-shot run (CI mode)
npm run test:watch   # dev mode
npm run test:ui      # vitest --ui
```

57 files, 813 tests. Beyond the contract tests below there is one file per subsystem (access control, session
sync, dashboard bindings, widgets, thresholds, query sources, and so on); the list and conventions are in
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

- **`tests/unit/types.test.ts`** - fixture-driven shape checks for every
  API response type. Catches drift between the backend serializers and
  the TypeScript types in `app/types/uapts.ts`.
- **`tests/unit/store.test.ts`** - Pinia store contract: login, refresh,
  hydrate, forceLogout, fetchMe.
- **`tests/unit/api.test.ts`** - every domain composable hits the right
  URL with the right method/body/query.
- **`tests/unit/notifications.test.ts`**, **`notifications-shape.test.ts`** -
  notifications store/composable behaviour and payload shapes.
- **`tests/unit/railway.test.ts`** - railway composable coverage.
- **`tests/integration/live.test.ts`** - live HTTP probes against
  `UAPTS_API_BASE` (defaults to `http://127.0.0.1:8000`). Skips
  automatically if the backend is unreachable or `UAPTS_SKIP_LIVE=1`.

Integration tests run under the `node` Vitest environment (not happy-dom)
because happy-dom's fetch implementation strips `Authorization` headers on
cross-origin requests.

## Environment

`.env` (all optional, shown with their defaults):

```
NUXT_PUBLIC_API_BASE=https://uapts.eu.cc
NUXT_PUBLIC_WS_URL=
NUXT_PUBLIC_NOTIFICATIONS_WS_URL=wss://uapts.eu.cc/ws/notifications/
NUXT_PUBLIC_TILES_BASE=https://uapts.eu.cc/media/
```

`NUXT_PUBLIC_WS_URL` is left unset by default so `useAuditSocket` can derive
a same-host `ws(s)://` URL from `NUXT_PUBLIC_API_BASE` instead.

`NUXT_PUBLIC_API_PROXY` defaults to on in `nuxi dev` and off in production builds.

Overrides for the integration test suite (`tests/integration/live.test.ts`):

```
UAPTS_API_BASE=http://127.0.0.1:8000
UAPTS_TEST_EMAIL=<a backend test account>
UAPTS_TEST_PASSWORD=<its password>
UAPTS_SKIP_LIVE=1
```

## Build

```bash
npm run build       # nitro server build
npm run generate    # static output (the app is an SPA)
npm run preview     # local preview
```

## Documentation map

| Document | Contents |
|---|---|
| [`docs/README.md`](docs/README.md) | Index of everything below |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack, layout, boot sequence, data flow |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Setup, env vars, tests, conventions, recipes, deploy notes |
| [`docs/AUTH_AND_SESSIONS.md`](docs/AUTH_AND_SESSIONS.md) | Login, MFA, tokens, cross-tab sessions |
| [`docs/API_LAYER.md`](docs/API_LAYER.md) | `$api`, composables, proxy, WebSockets |
| [`docs/ACCESS_CONTROL.md`](docs/ACCESS_CONTROL.md) | Resolver, Module Access, policy store |
| [`docs/DASHBOARD_MANAGER.md`](docs/DASHBOARD_MANAGER.md) | Widgets, bindings, editor, runtime |
| [`docs/MODULE_UX.md`](docs/MODULE_UX.md) | Collapsible maps and incidents, time range, certificate alerts, HQ summary |
| [`docs/Reference.md`](docs/Reference.md) | Code-level index of routes, stores, composables, components |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security overview and known gaps |
| [`PRODUCT.md`](PRODUCT.md), [`DESIGN.md`](DESIGN.md) | Product intent and visual design system |
