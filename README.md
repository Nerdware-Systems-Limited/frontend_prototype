# UAPTS Frontend - Nuxt 4 + Vue 3

The Unified Analytics and Predictive Transport System dashboard SPA.

## Stack

- **Nuxt 4** with file-based routing under `app/pages/`
- **Vue 3** Composition API throughout
- **Pinia** for the auth store (`app/stores/auth.ts`)
- **Tailwind CSS** with a custom dark theme
- **lucide-vue-next** icons
- **TypeScript** strict mode
- **Vitest** for unit + integration tests

## API wiring

All backend calls go through typed composables under `app/composables/api/`,
re-exported from `app/composables/api/index.ts` (import via
`~/composables/api` rather than deep-relative paths). Non-exhaustive sample -
see `index.ts` for the full, current list:

```
app/composables/api/
├── _client.ts                    # $api wrapper + cleanQuery helper
├── useSystem.ts                  # /api/, /api/v1/health/, /api/schema/
├── useDashboard.ts                # M01 - aggregates module summaries into KPIs
├── useAudit.ts                   # /api/v1/audit/* + /ws/audit/ WS
├── useNotifications.ts           # /api/v1/notifications/*
├── useTraffic.ts                 # M02 - Road Traffic Management
├── useFleet.ts                   # M03 - Fleet & Vehicle Tracking
├── usePublicTransport.ts         # M04 - Public Transport Operations
├── useSafety.ts                  # M05 - Safety & Incident Management
├── useInfrastructure.ts          # M06 - Road Infrastructure
├── useAviationMaritime.ts        # M07 - Aviation + Maritime catalog & live ops
├── useAviationInfrastructure.ts  # M07a - Aviation infrastructure assets
├── useMaritimeInfrastructure.ts  # M07b - Maritime port/berth infra assets
├── useMaritimeServices.ts        # M07b - Cargo handling ops, pilotage, licensing
├── useMaritimeCargo.ts           # M07b - Cargo types, import/export pipeline
├── useMaritimeWaterways.ts       # M07b - Chartered/unchartered waterways
├── useMaritimeGreenTransport.ts  # M07b - Vessel emissions, EV fleet, cold chain
├── useMaritimePerformance.ts     # M07b - Port performance KPIs & ranking
├── useRailway.ts                 # M08 - Railway Management
├── useRailInfrastructure.ts      # M08 - Rail infrastructure assets
├── useRailSafety.ts              # M08 - Rail safety/investigations
├── useReports.ts                 # M09 - Analytics & Reporting
├── useQuery.ts                   # M09 - Query Builder
├── useAccounts.ts                # M10 - Agencies, departments, roles, users
├── useIntegrations.ts            # M12 - Data Integration Hub
├── useGis.ts                     # M13 - GIS & Spatial Analysis
└── useTraining.ts                # M14 - Training Institutes
```

Several maritime composables (`useMaritimeServices`, `useMaritimeCargo`,
`useMaritimeWaterways`, `useMaritimeGreenTransport`, `useMaritimePerformance`)
are written **ahead of the backend API**, mirroring the established
`useMaritimeInfrastructure`/`useRailInfrastructure` pattern: the shapes match
the design doc, and the corresponding pages render an honest empty state
("has not been integrated yet") until the backend mounts the endpoint - no
mock data is fabricated.

The composables resolve the base URL from `NUXT_PUBLIC_API_BASE` (defaults to
`http://127.0.0.1:8000`) and reuse the `$api` Nuxt plugin from
`app/plugins/api.ts`, which handles Bearer-token injection and silent refresh.

## Pages

| Route        | Module | Wireframe                          | Status   |
|--------------|--------|------------------------------------|----------|
| `/login`     | -      | (login.vue)                        | Live     |
| `/dashboard` | M01    | dashboard                          | Live API |
| `/traffic`   | M02    | m02-traffic-map.html               | Live     |
| `/fleet`     | M03    | m03-fleet-tracking.html            | Live     |
| `/incidents` | M05    | m05-safety-command.html            | Live     |
| `/rail`      | M08    | (aviation/rail/maritime/infr.)     | Stub     |
| `/maritime`  | M07b   | m07-mode-performance.html          | Live API |
| `/maritime/vessels` | M07b | -                              | Live API |
| `/maritime/port-ops` | M07b | -                             | Live API |
| `/maritime/infrastructure` | M07b | -                       | Live API (partial) |
| `/maritime/services` | M07b | -                             | Ahead of API |
| `/maritime/cargo` | M07b | -                                | Ahead of API |
| `/maritime/waterways` | M07b | -                            | Ahead of API |
| `/maritime/accidents` | M07b | -                            | Live API |
| `/maritime/green-transport` | M07b | -                      | Ahead of API |
| `/maritime/performance` | M07b | -                          | Live API (partial) |
| `/aviation`  | M07    | m07-intermodal.html                | Stub     |
| `/infrastructure` | M10 | m06-infrastructure.html         | Stub     |
| `/compliance` | M12   | (audit/compliance)                 | Stub     |
| `/analytics` | M01/M14 | analytics-workbench.html         | Live API |
| `/query-builder` | M15 | query-builder.html               | Stub     |
| `/reports`   | M15    | report-center.html                 | Live     |
| `/notifications` | - | notifications.html                 | Live     |
| `/integrations` | -   | integration-hub.html               | Live     |
| `/users`     | -      | user-management.html               | Live     |
| `/audit`     | -      | audit-trail.html                   | Live     |
| `/settings`  | -      | settings.html                      | Local    |
| `/profile`   | -      | (profile.vue)                      | Live API |

"Live" means the page reads from the backend (real or graceful 404); "Stub"
shows a "module pending" message that lights up automatically when the
backend mounts the corresponding `/api/v1/...` endpoint. "Ahead of API"
means the page and its composable are fully built against the design-doc
data shapes, but the backend endpoint doesn't exist yet - tables render an
honest "not yet integrated" empty state instead of mock data, and light up
automatically once the endpoint ships. "(partial)" means the page blends
live fields with ahead-of-API ones.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Dev server runs on `http://localhost:3000` and proxies API calls to the
backend at `http://127.0.0.1:8000` (set `NUXT_PUBLIC_API_BASE` in `.env`).

## Tests

```bash
npm run test         # one-shot run (CI mode)
npm run test:watch   # dev mode
npm run test:ui      # vitest --ui
```

The suite has three layers:

- **`tests/unit/types.test.ts`** - fixture-driven shape checks for every
  API response type. Catches drift between the backend serializers and
  the TypeScript types in `app/types/uapts.ts`.
- **`tests/unit/store.test.ts`** - Pinia store contract: login,
  refresh, hydrate, forceLogout, fetchMe.
- **`tests/unit/api.test.ts`** - every domain composable hits the right
  URL with the right method/body/query.
- **`tests/integration/live.test.ts`** - live HTTP probes against
  `http://127.0.0.1:8000`. Skips automatically if the backend is
  unreachable or `UAPTS_SKIP_LIVE=1`.

Integration tests run under the `node` Vitest environment (not
happy-dom) because happy-dom's fetch implementation strips
`Authorization` headers on cross-origin requests.

## Environment

`.env`:

```
NUXT_PUBLIC_API_BASE=http://127.0.0.1:8000
NUXT_PUBLIC_WS_URL=ws://127.0.0.1:8000/ws/audit/
```

Optional overrides for the integration test credentials:

```
UAPTS_TEST_EMAIL=admin@uapts.go.ke
UAPTS_TEST_PASSWORD=devpass123
```

## Build

```bash
npm run build       # nitro server build
npm run preview     # local preview
```