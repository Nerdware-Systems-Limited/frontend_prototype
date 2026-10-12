# API layer

_Verified against the code on 2026-10-12._

How the frontend talks to the Django backend: the `$api` plugin, the per-domain composables, the dev proxy, error
handling and the two WebSockets.

## 1. Base URL and the dev proxy

| Setting | Source | Meaning |
|---|---|---|
| `NUXT_PUBLIC_API_BASE` | `.env`, default `https://uapts.eu.cc` | The backend address |
| `runtimeConfig.public.apiProxy` | `true` in `nuxi dev`, else `false` (override `NUXT_PUBLIC_API_PROXY`) | Whether HTTP goes through the dev proxy |

`apiBaseUrl()` in `app/utils/apiBase.ts` is the only place that decides. It returns `''` when proxied and the
absolute backend URL otherwise. Nothing else should read `public.apiBase` for HTTP.

In `nuxi dev`, `nitro.devProxy` forwards `/api` and `/media` to the backend with `changeOrigin: true`. The browser
therefore stays same-origin, so no CORS or CSRF-origin change is needed on a backend this team does not control.
The Bearer header is forwarded untouched.

**There is no `/ws` proxy entry.** `nuxi dev` runs Vite's own HMR WebSocket server on the same HTTP server, which
claims every `upgrade` event before the proxy sees it, so a proxied `/ws/*` returns a plain HTTP 200 instead of 101.
WebSockets connect straight to the backend instead (`wsUrl()` in `apiBase.ts` is a documented passthrough).
That is safe because the backend authenticates WebSockets from the `?token=` JWT alone, with no Origin check.

## 2. The `$api` plugin

`app/plugins/api.ts` provides `$api(path, options)`, an `ofetch` wrapper:

- sets `Content-Type: application/json` and `Authorization: Bearer <access>` when a token exists;
- on `401`, and only if a refresh token exists and this call is not already a retry, runs one shared
  `refreshAccessToken()` and retries once;
- on a second `401` (or no refresh token) calls `forceLogout()` and navigates to `/login`;
- rethrows the original error so callers can read `status` and `data`.

Everything else (error normalisation, caching) is the caller's job. See [AUTH_AND_SESSIONS.md](AUTH_AND_SESSIONS.md)
for refresh details.

## 3. Domain composables

`app/composables/api/` has one file per backend domain, all re-exported from `~/composables/api` (import from
there, not by deep relative path).

```ts
import { useSafety } from '~/composables/api'
const safety = useSafety()
const summary = await safety.summary()
```

Conventions every file follows:

- A header comment names the module (M01..M16) and the backend mount point.
- Response and payload types are declared in the same file next to the functions that use them. Shared envelopes
  (`Paged<T>`) are in `types/uapts.ts`.
- Each composable is a **thin, stateless wrapper**: it builds the URL, runs `cleanQuery()` on the params so
  `null`, `undefined` and `''` never reach the query string, and returns the typed promise. It holds no loading or
  error state; pages own theirs (see `EmptyState` for the shared empty/loading UI).
- `useApi()` in `_client.ts` returns the typed `$api`. `ApiOptions` is `ofetch`'s options plus a loosely typed
  `query`.

Domain index (module code, file):

| Module | Files |
|---|---|
| System, audit, accounts | `useSystem`, `useAudit`, `useAccounts` (agencies, departments, roles, users) |
| M01 Command Centre | `useDashboard` |
| M02 Traffic | `useTraffic` |
| M03 Fleet | `useFleet`, `useVehicleInspections`, `useDriverLicensing` |
| M04 Public transport | `usePublicTransport` |
| M05 Safety | `useSafety` |
| M06 Infrastructure | `useInfrastructure` |
| M07a Aviation | `useAviationMaritime` (shared), `useAviationInfrastructure`, `useAviationLicensing` |
| M07b Maritime | `useMaritimeInfrastructure`, `useMaritimeServices`, `useMaritimeCargo`, `useMaritimeWaterways`, `useMaritimeGreenTransport`, `useMaritimePerformance` |
| M08 Railway | `useRailway`, `useRailInfrastructure`, `useRailSafety` |
| M09/M15 Reporting, query | `useReports`, `useQuery` |
| M11 Notifications | `useNotifications` |
| M12 Integration Hub | `useIntegrations` |
| M13 GIS | `useGis` (map GeoJSON), `useGisLayers` (uploaded layers, coverage, requests) |
| M14 Training | `useTraining` |
| M16 ML | `useMlPredictive` |

Dashboard Manager and access policy clients are **not** in `api/`: see `composables/useDashboardApi.ts` and
`utils/accessPolicyStorage.ts` (both still go through `$api`).

### Ahead-of-backend composables

Several maritime composables (`Services`, `Cargo`, `Waterways`, `GreenTransport`, `Performance`) and some rail and
aviation ones were written against the design documents before the backend mounted their endpoints. Their pages
render a "not yet integrated" empty state and start working when the endpoint exists. In the dashboard data layer
this is `WidgetSource.backend === 'ahead-of-backend'`: a 404 or 501 from such a source becomes the
`not-integrated` widget state rather than an error.

### Adding a domain composable

1. Create `app/composables/api/useThing.ts` with the header comment, types, and a `useThing()` returning methods.
2. Export it (and its public types) from `api/index.ts`.
3. Add URL/method/body/query coverage to `tests/unit/api.test.ts`.
4. Add a response fixture to `tests/unit/types.test.ts` so serializer drift is caught.

## 4. Errors

- Raw `ofetch` errors expose `status` (or `statusCode`), `data` and `message`.
- Dashboard Manager calls convert to `DashboardApiError` with `describeApiError()`, which flattens the three DRF
  error body shapes (`{detail}`, `{field: [...]}`, list-of-objects) into one sentence, ignores blank bodies and
  HTML error pages, and falls back to a status-specific message.
- Access policy saves convert to `AccessPolicyStorageError`, preferring the server's own refusal text.
- The widget data layer maps failures to widget states (`forbidden` for 401/403, `not-integrated` for 404/501 on
  ahead-of-backend sources, otherwise `error`). See [DASHBOARD_MANAGER.md](DASHBOARD_MANAGER.md).

## 5. WebSockets

| Socket | Composable | Used by | Messages |
|---|---|---|---|
| `/ws/notifications/` | `useNotificationSocket` wrapped by `stores/notifications.ts` | `layouts/default.vue` connects on mount, disconnects on unmount | `hello`, `notification`, `count`, `ping`, `pong` |
| `/ws/audit/` | `useAuditSocket` | `pages/audit.vue` only | `initial` (last 50), `new_log` (prepended, capped 200), `metrics` |

Shared behaviour: the JWT goes in `?token=` (browsers cannot set a handshake header), 30 s client keepalive
ping, reconnect after 3 s unless closed with code 1000. The notification socket skips a refresh when
`isAccessTokenFresh()` says the token is still valid. URL resolution: `NUXT_PUBLIC_NOTIFICATIONS_WS_URL` for
notifications; `NUXT_PUBLIC_WS_URL` for audit, derived from `NUXT_PUBLIC_API_BASE` (`http` to `ws`) when unset.

The notification socket lives in a Pinia store so it survives page navigation. A plain composable's teardown
would be tied to whichever component called it first. `useAuditSocket` is not wrapped in a store, which is only
safe while exactly one component uses it.

## 6. Pagination and filtering

- Backend lists return the DRF envelope `{ count, next, previous, results }` (`Paged<T>`), page size 20.
- Many pages fetch a list once and paginate client-side with `usePagination(source, 15)`; the `page` ref
  self-clamps when a filter shrinks the result.
- Server-side filters are passed through each composable's `query` argument.
- Dashboard filters reach endpoints only through `honouredParams()` in `utils/dataSources.ts`, which drops
  every param the endpoint does not read.

## 7. Verifying against a live backend

- `tests/integration/live.test.ts` probes a running backend (`UAPTS_API_BASE`, default `http://127.0.0.1:8000`) and
  skips itself when unreachable or when `UAPTS_SKIP_LIVE=1`. It runs under the `node` environment because
  happy-dom's fetch strips `Authorization` on cross-origin requests.
- `scripts/test-endpoints.mjs` is a standalone endpoint smoke script.
