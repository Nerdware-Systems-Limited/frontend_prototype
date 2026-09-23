# UAPTS Frontend - Nuxt 4 + Vue 3

The Unified Analytics and Predictive Transport System dashboard SPA.

## Stack

- **Nuxt 4** with file-based routing under `app/pages/`
- **Vue 3** Composition API throughout
- **Pinia** for the auth store (`app/stores/auth.ts`)
- **Tailwind CSS** for base/utilities, plus a custom institutional-blue
  design system in `app/assets/css/theme.css` (tokens, top nav, sidebar, KPI
  cards, agency cards, alerts, modals) with light and dark themes - see
  [Theming](#theming) below
- **lucide-vue-next** icons
- **TypeScript** strict mode
- **Vitest** for unit + integration tests

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
├── useReports.ts                 # M09/M15 - Reporting & BI
├── useQuery.ts                   # M15 - Ad-hoc Query Builder
├── useMlPredictive.ts            # M16 - ML model registry + Ask assistant
├── useNotifications.ts           # M11 - event-driven notifications
├── useIntegrations.ts            # M12 - Data Integration Hub
├── useGis.ts                     # M13 - GeoJSON / map endpoints
└── useTraining.ts                # M14 - Training Institutes
```

Several maritime composables (`useMaritimeServices`, `useMaritimeCargo`,
`useMaritimeWaterways`, `useMaritimeGreenTransport`, `useMaritimePerformance`)
are written ahead of the backend API, mirroring the established
`useMaritimeInfrastructure`/`useRailInfrastructure` pattern: the shapes match
the design doc, and the corresponding pages render an honest empty state
until the backend mounts the endpoint. No mock data is fabricated.

The composables resolve the base URL from `NUXT_PUBLIC_API_BASE` and reuse
the `$api` Nuxt plugin from `app/plugins/api.ts`, which handles Bearer-token
injection and silent refresh.

## Pages

Routes live under `app/pages/`, grouped by module:

- `/dashboard` - M01 executive dashboard
- `/traffic`, `/traffic/analytics`, `/traffic/alerts` - M02 Road Traffic
- `/fleet`, `/fleet/live`, `/fleet/behaviour`, `/fleet/geofences`, `/fleet/trip-playbacks` - M03 Fleet
- `/public-transport` and subpages (`brt`, `compliance`, `driver-licensing`, `operators`, `vehicle-inspections`, `vehicle-registration`) - M04
- `/safety` and subpages (`incidents`, `blackspots`, `kpis`) - M05
- `/infrastructure` and subpages (`bridges`, `funding`, `maintenance`, `projects`) - M06
- `/aviation` and subpages (`flights`, `infrastructure`, `licensing`, `passenger-stats`) - M07a
- `/maritime` and subpages (`vessels`, `port-ops`, `infrastructure`, `services`, `cargo`, `waterways`, `accidents`, `green-transport`, `performance`, `imports-exports`) - M07b
- `/railway` and subpages (`live`, `freight`, `schedules`, `infrastructure`, `network-inventory`, `safety`) - M08
- `/analytics`, `/query-builder`, `/reports` - M09/M15
- `/agencies`, `/users`, `/roles`, `/audit` - M10 access control
- `/notifications`, `/notifications/rules` - M11
- `/integrations` - M12
- `/gis` - M13
- `/training` and subpages (`cohorts`, `enrollments`, `completions`) - M14
- `/profile` - user profile
- `/login`, `/forgot-password`, `/reset-password/[uid]/[token]` - auth layout
  (`layouts/auth.vue`), the only routes outside `layouts/default.vue`

`/` redirects to `/dashboard` (see `routeRules` in `nuxt.config.ts`). Pages
whose composable is ahead of the API (see above) render an honest "not yet
integrated" empty state instead of mock data, and light up automatically
once the endpoint ships.

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

Overrides for the integration test suite (`tests/integration/live.test.ts`):

```
UAPTS_API_BASE=http://127.0.0.1:8000
UAPTS_TEST_EMAIL=admin@uapts.go.ke
UAPTS_TEST_PASSWORD=devpass123
UAPTS_SKIP_LIVE=1
```

## Build

```bash
npm run build       # nitro server build
npm run preview     # local preview
```
