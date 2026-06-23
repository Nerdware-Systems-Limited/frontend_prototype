# UAPTS Frontend — Nuxt 4 + Vue 3

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

All backend calls go through typed composables under `app/composables/api/`:

```
app/composables/api/
├── _client.ts          # $api wrapper + cleanQuery helper
├── useAuth.ts          # /api/v1/auth/* (login, logout, refresh, register, password)
├── useAccounts.ts      # /api/v1/accounts/{agencies,departments,roles,users}
├── useSystem.ts        # /api/, /api/v1/health/, /api/schema/
├── useDashboard.ts     # M01 — aggregates accounts + health into KPIs
├── useAudit.ts         # /api/v1/audit/* + /ws/audit/ WS
├── useNotifications.ts # /api/v1/notifications/*
├── useTraffic.ts       # M02
├── useFleet.ts         # M03
├── useIncidents.ts     # M05
├── useReports.ts       # M15
└── useIntegrations.ts  # DIH integration registry
```

The composables resolve the base URL from `NUXT_PUBLIC_API_BASE` (defaults to
`http://127.0.0.1:8000`) and reuse the `$api` Nuxt plugin from
`app/plugins/api.ts`, which handles Bearer-token injection and silent refresh.

## Pages

| Route        | Module | Wireframe                          | Status   |
|--------------|--------|------------------------------------|----------|
| `/login`     | —      | (login.vue)                        | Live     |
| `/dashboard` | M01    | dashboard                          | Live API |
| `/traffic`   | M02    | m02-traffic-map.html               | Live     |
| `/fleet`     | M03    | m03-fleet-tracking.html            | Live     |
| `/incidents` | M05    | m05-safety-command.html            | Live     |
| `/rail`      | M08    | (aviation/rail/maritime/infr.)     | Stub     |
| `/maritime`  | M07    | m07-mode-performance.html          | Stub     |
| `/aviation`  | M07    | m07-intermodal.html                | Stub     |
| `/infrastructure` | M10 | m06-infrastructure.html         | Stub     |
| `/compliance` | M12   | (audit/compliance)                 | Stub     |
| `/analytics` | M01/M14 | analytics-workbench.html         | Live API |
| `/query-builder` | M15 | query-builder.html               | Stub     |
| `/reports`   | M15    | report-center.html                 | Live     |
| `/notifications` | — | notifications.html                 | Live     |
| `/integrations` | —   | integration-hub.html               | Live     |
| `/users`     | —      | user-management.html               | Live     |
| `/audit`     | —      | audit-trail.html                   | Live     |
| `/settings`  | —      | settings.html                      | Local    |
| `/profile`   | —      | (profile.vue)                      | Live API |

"Live" means the page reads from the backend (real or graceful 404); "Stub"
shows a "module pending" message that lights up automatically when the
backend mounts the corresponding `/api/v1/...` endpoint.

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

- **`tests/unit/types.test.ts`** — fixture-driven shape checks for every
  API response type. Catches drift between the backend serializers and
  the TypeScript types in `app/types/uapts.ts`.
- **`tests/unit/store.test.ts`** — Pinia store contract: login,
  refresh, hydrate, forceLogout, fetchMe.
- **`tests/unit/api.test.ts`** — every domain composable hits the right
  URL with the right method/body/query.
- **`tests/integration/live.test.ts`** — live HTTP probes against
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