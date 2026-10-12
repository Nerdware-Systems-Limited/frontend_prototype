# Development guide

_Verified against the code on 2026-10-12._

Everything needed to run, test, extend and ship the frontend.

## 1. Prerequisites and setup

- Node.js (a version Nuxt 4 supports) and npm.
- A reachable UAPTS backend. The default is the deployed one at `https://uapts.eu.cc`; for a local Django backend
  use `http://127.0.0.1:8000`.

```bash
npm install          # also runs `nuxt prepare` (postinstall) to generate .nuxt/ types
# create .env if you need to override anything (section 2); there is no .env.example
npm run dev          # http://localhost:3000, or the next free port
```

## 2. Environment variables

All optional. `.env` is git-ignored.

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_PUBLIC_API_BASE` | `https://uapts.eu.cc` | Backend address. Dev proxy target and production API base |
| `NUXT_PUBLIC_API_PROXY` | `true` in dev, `false` in production builds | Route HTTP through the Nuxt dev proxy (same-origin) or call the absolute URL |
| `NUXT_PUBLIC_WS_URL` | unset | Audit WebSocket. When unset it is derived from the API base (`http` to `ws`, `/ws/audit/`) |
| `NUXT_PUBLIC_NOTIFICATIONS_WS_URL` | `wss://uapts.eu.cc/ws/notifications/` | Notifications WebSocket. Set it explicitly for a local backend, e.g. `ws://127.0.0.1:8000/ws/notifications/` |
| `NUXT_PUBLIC_TILES_BASE` | `https://uapts.eu.cc/media/` | Base URL for protomaps PMTiles |

Test-only overrides (read by `tests/integration/live.test.ts`; vitest.config.ts forwards `UAPTS_*` entries from `.env`):

| Variable | Default |
|---|---|
| `UAPTS_API_BASE` | `http://127.0.0.1:8000` |
| `UAPTS_TEST_EMAIL` / `UAPTS_TEST_PASSWORD` | dev defaults hard-coded in `tests/integration/live.test.ts`; override for staging or CI |
| `UAPTS_SKIP_LIVE` | unset; `1` skips the live suite |

Changing `NUXT_PUBLIC_API_BASE` needs a dev-server restart because the proxy target is read when `nuxt.config.ts`
loads.

## 3. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with the `/api` and `/media` proxy |
| `npm run build` | Nitro/Nuxt production build |
| `npm run generate` | Static generation (the app is an SPA, so this is also a valid deploy artefact) |
| `npm run preview` | Serve the production build locally |
| `npm test` | `vitest run`, one-shot (CI mode) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:ui` | Vitest UI |
| `node scripts/test-endpoints.mjs` | Live endpoint tester. Logs in, GETs every endpoint the composables reference, diffs response fields against the TypeScript interfaces and prints a JSON report. Needs `UAPTS_EMAIL`, `UAPTS_PASSWORD`, optional `UAPTS_BASE` |

Type checking: `vue-tsc` is a dev dependency, and `nuxt prepare` generates the `.nuxt/tsconfig.*.json` projects the
root `tsconfig.json` references.

## 4. Testing

State at the time of writing: **51 files, 747 tests, all passing** (`npm test`, about 20 s).

- **Environment.** Vitest with `happy-dom` and `globals: true`. `tests/integration/**` runs under `node` because
  happy-dom's fetch strips `Authorization` on cross-origin requests.
- **No Nuxt build in unit tests.** `tests/setup.ts` installs the auto-imports the source relies on (`ref`,
  `computed`, `reactive`, `onMounted`, `useRuntimeConfig`, `useNuxtApp`, `useState`, `definePageMeta`), a default
  `$api` that returns an empty page, stubs for `NuxtLink`, `ClientOnly` and `UaptsMap`, and clears
  `localStorage` and `sessionStorage` after every test. Tests that need another `$api` set `globalThis.$api`.
- **Access baseline.** `setup.ts` calls `setBaseSettings()` with `tests/fixtures/access-control.json`, a copy of the
  backend's `apps/access_control/data/access-control.json`. Refresh it when the backend file changes.
- **Aliases.** `~` and `@` both point to `app/`.
- **Live suite.** `tests/integration/live.test.ts` skips itself when the backend is unreachable or `UAPTS_SKIP_LIVE=1`.

What is covered, by subsystem:

| Area | Files |
|---|---|
| Auth and sessions | `store`, `tab-sync`, `api` |
| API contract | `api`, `types`, `safety-infrastructure-api`, `railway`, `notifications`, `notifications-shape` |
| Access control | `access-control`, `resolve-access`, `access-*`, `capability-gates`, `page-access-coverage`, `module-scope`, `agency-scope`, `field-mask`, `role-options` |
| Dashboard Manager | `dashboard-*`, `generic-widgets`, `bindings`, `binding-design`, `widget-*`, `viz*`, `thresholds`, `threshold-widgets`, `units`, `query-sources`, `data-sources`, `agency-catalog` |
| Command centres | `agency-command-centre`, `agency-module-summary`, `national-heatmap`, `kpi-card` |

`page-access-coverage.test.ts` fails when a page exists that the access policy does not classify, and
`agency-module-summary.test.ts` fails when a baseline module is neither operational nor explicitly non-operational.
Both exist so new pages and modules cannot silently fall outside the policy. A page that is deliberately public must be added to
`PUBLIC_ROUTES` in `app/utils/publicRoutes.ts` **and** to `PUBLIC_PAGES` in the coverage test.

## 5. Conventions

**Honest states.** A failed or missing value renders `-` with a reason, never `0`. A page for an endpoint that does
not exist yet renders a "not yet integrated" empty state and no mock data.

**Copy.** No em-dashes in user-facing text (use a period, colon or comma; placeholders are `-`). Plain, non-alarmist
tone. Dates and times render `en-KE`, currency is KES.

**Styling.**
- Colour comes from CSS custom properties in `theme.css`, never literal hex, so both themes repaint. Exceptions:
  Leaflet canvas colours, SVG chart presentation attributes and categorical status palettes.
- Figures use `var(--font-mono)`. The system monospace stack is only for real code or credential contexts.
- Animate `transform: scale()` for bar and meter fills, never `width` or `height`.
- Filter bars: `min-width: 0` on every direct child, explicit capped widths per control, `flex-wrap: wrap` as the
  narrow-screen safety net.
- Header action buttons are plain text; navigation links end with `→`.
- No arbitrary-value Tailwind classes in pages or components.
- Full rules: `DESIGN.md`.

**Structure.**
- Put pure logic in `app/utils/` with no Nuxt or Pinia dependency so it can be unit tested directly.
- API composables are stateless wrappers; pages own loading and error state.
- Import API composables from `~/composables/api`.
- Anything permission-dependent goes through `usePermissions()` and `useAccessControl()`, never a hand-rolled
  `role_type === ...` check. These are UX gates only; assume the server enforces the real rule.
- Two agency facets on an upload are distinct: `agency_code` (who submitted it) versus `covers_agency` /
  `covers_breakdown` (who the data is about).

## 6. Recipes

### Add a page

1. Create `app/pages/<module>/<name>.vue` (file-based route). Use `PageHeader` so the top-nav subtitle updates.
2. Add the route to the **backend** baseline policy (`routes` entry with module, `minTier`, `agencyScoped`) and to
   `tests/fixtures/access-control.json`. A route the baseline does not know is denied for everyone except
   `super_admin`.
3. Add a link in `AppSidebar.vue` (it hides links the viewer cannot open) if it should be in the navigation.
4. Run `npm test`; `page-access-coverage` will tell you if the policy and the page disagree.

### Add a domain API composable

See [API_LAYER.md](API_LAYER.md) section 3: composable file, export from `api/index.ts`, URL coverage in
`api.test.ts`, shape fixture in `types.test.ts`.

### Add a dashboard data source, preset or widget

See [DASHBOARD_MANAGER.md](DASHBOARD_MANAGER.md) section 2.

- New data: one entry in `SOURCES` (`utils/dataSources.ts`) with `honours`, permission, `route`, `backend` flag.
  Its permission string must exist in the backend `catalog.py` too.
- New chart on existing data: one preset in `utils/widgetPresets.ts`.
- New widget type: one entry in `utils/widgetRegistry.ts` and one component.

### Add a restricted-field mask

Declare the category on the route in the baseline policy, then call `useFieldMask(path)` in the page and wrap each
restricted value with `isMasked(category)` / `mask()`.

### Add a Module Access edit type

Extend the `AccessEdit` union and `applyEdit` in `utils/accessEdits.ts`, add its `editWarning` text, its history
wording in `accessHistory.ts`, and tests in `access-policy-store.test.ts`.

## 7. Backend coupling to keep in step

| Frontend | Backend | Rule |
|---|---|---|
| `DOMAIN_PERMISSIONS`, `PERMISSION_MODULE`, source `route` | `apps/dashboards/catalog.py` | Identical strings |
| `utils/resolveAccess.ts` | `apps/access_control/resolver.py` | Same algorithm; `partitionStale` mirrors `partition_stale` |
| `utils/resolveDashboard.ts` | `apps/dashboards/resolver.py` | Same algorithm and fixtures |
| `tests/fixtures/access-control.json` | `apps/access_control/data/access-control.json` | Copy; refresh on change |
| `types/uapts.ts` and composable types | DRF serializers | `types.test.ts` fixtures catch drift |

## 8. Build and deploy notes

- `ssr: false` for every route, so the output is a client bundle plus Nitro. `npm run generate` is enough for
  static hosting behind Nginx.
- In production builds the API proxy is off: the browser calls `NUXT_PUBLIC_API_BASE` directly, so the backend must
  allow that origin (CORS and CSRF trusted origins) or be served from the same host behind the reverse proxy.
- WebSockets always connect straight to the backend with the JWT in the query string; the reverse proxy must pass
  `Upgrade` headers for `/ws/`.
- The SPA ships no Content-Security-Policy or security headers itself; set them at the edge. See
  [SECURITY.md](SECURITY.md) item 8.
- `routeRules` in `nuxt.config.ts`: `/` redirects to `/dashboard`; `/integrations/uploads` and
  `/integrations/uploads/:id` redirect to `/integrations/files`. Do not add a top-level `:param` rule under
  `/integrations`, because Nitro would match it before the file-based pages and swallow real routes.

## 9. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Everything redirects to `/dashboard` after login | The baseline policy failed to load (check the console for `[access-policy] could not load the baseline`) so the resolver is failing closed |
| A new page is unreachable | The route is missing from the backend baseline `routes`, or the agency has no grant for its module |
| Notification or audit socket never connects in dev | Expected if the URL points at the Nuxt dev server; WebSockets must use the backend host. Set `NUXT_PUBLIC_NOTIFICATIONS_WS_URL` |
| 401 loop to `/login` in a new tab | Session-only login and no other tab open. Tabs share a session only while another tab holds it |
| A widget says "Not filtered by ..." | The source does not honour that filter. Intended; see `honours` in `dataSources.ts` |
| A query widget says "From the first 500 of N records" | The server caps `/query/execute/` at 500 rows (B22 in Widgets.md) |
| Dashboard saved but a widget vanished for viewers | The server stripped it: viewer lacks the widget's permission code, or the backend does not know the type or source (B1, B2, B8 to B10) |
