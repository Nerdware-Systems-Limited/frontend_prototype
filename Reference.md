# UAPTS — System Reference

A working index of what exists in this codebase and what it does: every
route, every shared component, every API composable, every store, and the
supporting utils that tie them together. For product intent and audience,
see `PRODUCT.md`; for the visual design system and its named rules, see
`DESIGN.md`. This document is the code-level map.

Nuxt 4 / Vue 3 (Composition API, `<script setup>`), `srcDir: app/`,
file-based routing, SPA (`ssr: false` for every route — `routeRules`), Pinia
for global state, Tailwind + a large hand-written token system
(`theme.css`), TypeScript strict, Vitest.

---

## 1. App shell

| File | Role |
|---|---|
| `app/layouts/default.vue` | The authenticated shell: `AppTopNav` + `AppSidebar` + scrolling `<main>`. Owns the notification-store `connect()`/`disconnect()` lifecycle (see §6). |
| `app/layouts/auth.vue` | Bare layout for login/forgot-password/reset-password. |
| `app/middleware/auth.global.ts` | Global route guard. Public routes: `/login`, `/forgot-password`, `/reset-password/*`. Otherwise: live access token → through; else attempt silent refresh from a stored refresh token; else redirect to `/login?redirect=<intended path>`. |
| `app/plugins/api.ts` | The `$api` fetcher every composable is built on — Bearer token injection, silent refresh-on-401, force-logout on a second 401. |
| `app/plugins/theme.client.ts` | Applies the stored light/dark choice to `<html data-theme>` before mount (no flash). |
| `app/plugins/leaflet.client.ts` | Client-only Leaflet bootstrap for `UaptsMap`. |
| `app/plugins/access-policy.client.ts` | Registers the accounts-API adapter for the `accessPolicy` store (`setAccessPolicyStorage`) and clears the store on sign-out. Loads nothing itself: the access token is memory-only and only `auth.global.ts` refreshes it, so the policy is fetched there once authenticated. See §9.7. |

**Routing quirks** (`nuxt.config.ts`): `/` is handled two ways — a
`routeRules['/']` redirect to `/dashboard`, **and** `app/pages/index.vue`
itself does `navigateTo('/login')` in its own script. `/integrations/uploads`
and `/integrations/uploads/:id` are kept as static redirects to the current
`/integrations/files` routes for old bookmarks — deliberately *not* a
`:param`-level rule, which Nitro would match before the real file-based
pages and silently swallow `/integrations/files`/`/integrations/analytics`.

**Config** (`runtimeConfig.public`): `apiBase` (REST), `wsUrl` (derived from
`apiBase` if unset), `notificationsWsUrl`, `tilesBase` (protomaps PMTiles).

---

## 2. Routes

Grouped by module (M01–M16 per `PRODUCT.md`). One line each — title +
subtitle pulled directly from each page's own `PageHeader`, so this reflects
real, current copy, not a paraphrase.

### Auth (no module)
| Route | Purpose |
|---|---|
| `/login` | "Sign in to UAPTS" — email/password, optional MFA step ("Two-factor verification") |
| `/forgot-password` | Request / confirm a password-reset email |
| `/reset-password/[uid]/[token]` | Password-reset confirmation link target |
| `/` (`index.vue`) | Redirects to `/login` |

### M01 — Command Centre
| Route | Purpose |
|---|---|
| `/dashboard` | "Command Centre" — branches on viewer identity: `NationalCommandCentre` (ministry-wide view) for SDT and super_admin, `AgencyCommandCentre` (the viewer's own resolved agency scope) for every other agency-bound account |

### M02 — Road Traffic
| Route | Purpose |
|---|---|
| `/traffic` | "Live Traffic Overview" — real-time flow, congestion, speed compliance, weather impact, corridor alerts |
| `/traffic/alerts` | "Traffic Alerts" — active alerts, congestion events, weather warnings, corridor risk forecasts |
| `/traffic/analytics` | "Traffic Analytics" — volume trends, speed compliance, vehicle class breakdown, O-D matrix, AI forecasts |

### M03 — Fleet & Vehicle Tracking
| Route | Purpose |
|---|---|
| `/fleet` | "Fleet Overview" — utilization, governor compliance, weather-correlated behaviour events, operator leaderboard |
| `/fleet/live` | "Live Vehicle Positions" — refreshes every 30s |
| `/fleet/behaviour` | "Driver Behaviour & Utilization" |
| `/fleet/geofences` | "Geofence Zones" — configure zones, monitor entry/exit breaches |
| `/fleet/trip-playbacks` | "Trip Playback" — replay a vehicle's historical route |

### M04 — Public Transport
| Route | Purpose |
|---|---|
| `/public-transport` | "Public Transport Overview" — BRT, PSV oversight, schedule adherence, fare analytics, corridor ridership |
| `/public-transport/brt` | "BRT Stops & Headway" |
| `/public-transport/compliance` | "PSV Compliance & Licensing" |
| `/public-transport/driver-licensing` | "Driver Licensing" |
| `/public-transport/vehicle-registration` | "Vehicle Registration" |
| `/public-transport/vehicle-inspections` | "Vehicle Inspections" |
| `/public-transport/operators` | "Public Operators" |

### M05 — Safety & Incidents
| Route | Purpose |
|---|---|
| `/safety` | "Safety Overview" — national KPIs, active incidents, weather correlation, intervention effectiveness, hotspot analysis |
| `/safety/incidents` | "Incident Command" — real-time active incidents, dispatch coordination, investigation workflows |
| `/safety/blackspots` | "Blackspot Analysis" — KDE cluster analysis, road geometry context, predictive hotspot overlays |
| `/safety/kpis` | "Safety KPIs" — crash rates, injury severity, county breakdowns, violation trends |

### M06 — Road Infrastructure
| Route | Purpose |
|---|---|
| `/infrastructure` | "Road Network Inventory" — per-agency inventory, pavement quality (IRI/PCI), AI deterioration forecasts |
| `/infrastructure/bridges` | "Bridge & Asset Registry" — bridges, streetlights, signals, WIM stations, closures |
| `/infrastructure/maintenance` | "Maintenance Orders" — work orders, contractor progress, budget allocation |
| `/infrastructure/projects` | "Road Infrastructure Status" — construction portfolio, work orders, asset status |
| `/infrastructure/funding` | "Funding Allocations" — budget allocations, disbursements, absorption, variance |

### M07a — Aviation
| Route | Purpose |
|---|---|
| `/aviation` | "Aviation Operations" — ADS-B tracking, OTP, passenger volumes, cargo, weather advisories, safety oversight |
| `/aviation/flights` | "Flight Movements" — full flight-by-flight log |
| `/aviation/infrastructure` | "Aviation Infrastructure" — airport registry, runway/navaid condition, capital works |
| `/aviation/licensing` | "Aircraft & Operator Licensing" — CoR, CoA, AOC, pilot licences, renewal tracking |
| `/aviation/passenger-stats` | "Passenger Statistics" — throughput, domestic vs international, air cargo clearances |

### M07b — Maritime
| Route | Purpose |
|---|---|
| `/maritime` | "Maritime Overview" — real-time AIS traffic, port performance, cargo single-window, corridor KPIs |
| `/maritime/vessels` | "Vessel Registry & Movements" |
| `/maritime/port-ops` | "Port Operations" — berth occupancy, throughput, corridor dwell analysis, 60-day trends |
| `/maritime/cargo` | "Cargo Tracking" — cargo type breakdown, import/export pipeline stage, handling KPIs |
| `/maritime/imports-exports` | "Imports/Exports" — container throughput, yard dwell, port-rail reconciliation |
| `/maritime/infrastructure` | "Maritime Infrastructure" — port/berth registry, channel depth, navaids, capital works |
| `/maritime/performance` | "Port Performance KPIs & Ranking" — UNCTAD/IAPH/World Bank LPI benchmarks |
| `/maritime/services` | "Port Services" — cargo handling, pilotage, licensing |
| `/maritime/waterways` | "Waterways" — chartered/unchartered navigable classification, buoys, dredged depth |
| `/maritime/accidents` | "Maritime Accidents & Safety" |
| `/maritime/green-transport` | "Green Transport" — vessel emissions/TEU-km, shore power, EV trucks, reefer energy |

### M08 — Railway
| Route | Purpose |
|---|---|
| `/railway` | "Railway Operations" — SGR/MGR ridership, freight manifests, port-rail reconciliation, corridor KPIs |
| `/railway/live` | "Train Operations" — real-time positions, delays, rolling stock, refreshes every 30s |
| `/railway/schedules` | "Train Schedules" — timetables, OTP, punctuality benchmarks |
| `/railway/freight` | "Freight Operations" — manifests, corridor analysis, clearances, transit tracking |
| `/railway/infrastructure` | "Rail Infrastructure" — track condition, level crossings, signalling, capital works |
| `/railway/network-inventory` | "Rail Network Inventory" — line/station/rolling-stock registry, SGR/MGR comparison |
| `/railway/safety` | "Rail Safety" — incident tracking, crossing safety, compliance, predictive risk |

### M09/M15 — Reporting & Query Builder
| Route | Purpose |
|---|---|
| `/reports` | "Reports" — scheduled and on-demand, PDF/XLSX, across all modules |
| `/query-builder` | "Query Builder" — browse the `gisdb` schema, compose visually or raw SQL, preview, run |
| `/analytics` | "AI Predictive Workbench" — forecasting, anomaly detection, what-if simulation |

### M10 — Access Control
| Route | Purpose |
|---|---|
| `/agencies` | "Agencies" — tbl_agencies directory; oversight/super_admin can view, super_admin can create/edit/delete |
| `/users` | "Users" — account directory, create accounts, manage status, view profiles |
| `/roles` | "Roles & Permissions" — RBAC role assignments, status management, departments |
| `/access-policies` | "Module Access" — which modules, pages, restricted data categories and capabilities each agency (and each role inside it) can reach. super_admin sets every agency's limit; an agency admin manages its own agency within that limit. Admin tier. See §9.7 |
| `/audit` | "Audit Trail" — full platform audit log, every user action/data change/system event |

### M11 — Notifications
| Route | Purpose |
|---|---|
| `/notifications` | "Notification Center" — real-time alerts from every module |
| `/notifications/rules` | "Alert Rules & Escalation" — threshold rules, escalation workflows, delivery activity |

### M12 — Data Integration Hub

See **§10** for the full deep-dive (this is the most thoroughly documented
module in this reference — routes, functions, components, conventions).

| Route | Purpose |
|---|---|
| `/integrations` | "Upload & Connect" — upload a file, or register how a live feed connects |
| `/integrations/analytics` | "Ingestion Analytics" — platform-wide reconciliation |
| `/integrations/files` | "Files & Feeds" — upload inbox + live feed registry |
| `/integrations/files/[id]` | One upload's detail |
| `/integrations/feeds/[source_id]` | One live feed's detail |

### M13 — GIS
| Route | Purpose |
|---|---|
| `/gis` | "GIS Explorer" — national road network, PT routes, rail lines, port infrastructure, spatial layers |

### M14 — Training Institutes
| Route | Purpose |
|---|---|
| `/training` | "Training Management" — course catalogue, cohort scheduling, enrollments, certificates |
| `/training/cohorts` | "Cohort Management" — capacity, fill rates, sessions, enrollment counts |
| `/training/enrollments` | "Student Enrollments" — confirmation, payment status, attendance |
| `/training/completions` | "Certificates & Completions" — certificate register, validity tracking |

### M16 — ML / Predictive
Surfaced through `/analytics` above (`useMlPredictive.ts` — model registry
+ the "Ask UAPTS" assistant); no separate dedicated page.

### Account
| Route | Purpose |
|---|---|
| `/profile` | Profile + MFA enrollment ("Choose how you want to receive your codes" / "Enter the code we sent you") |

---

## 3. Pinia stores

`app/stores/`

- **`auth.ts`** (`useAuthStore`) — the only owner of tokens/user state.
  `accessToken` is memory-only (never localStorage — limits XSS blast
  radius); `refreshToken` persists to `localStorage` ("remember me") or
  `sessionStorage`. Actions: `login`, `mfaVerify`, `mfaResend`, `mfaEnroll`,
  `mfaEnrollVerify`, `mfaDisable`, `logout`, `forceLogout`,
  `refreshAccessToken`, `fetchMe`, `isAccessTokenFresh(bufferMs)` (decodes
  the JWT `exp` claim client-side, no signature check needed since it's our
  own token), `requestPasswordReset`, `confirmPasswordReset`,
  `changePassword` (blacklists every refresh token server-side —
  logout-on-change, cleared locally immediately). `hydrate()` reads storage
  on app boot. Backend doesn't emit `full_name`; `normaliseUser()`
  synthesizes one from the email local-part.
- **`accessPolicy.ts`** (`useAccessPolicyStore`) — Module Access overrides
  (§9.7). `overrides` is the saved state the resolver reads; `draft` is what
  `/access-policies` edits until Save. Every change goes through
  `edit(code, AccessEdit)`, which checks the viewer's rights first (super_admin:
  any agency, any layer; agency admin: own agency, enabled + role layers, and
  only while their own saved `/access-policies` scope is `full`) and rejects an
  agency admin's self-lockout - the server re-checks all of it on save, this is
  the clean experience. `save()` sends the draft, then adopts the document the
  server stored (it stamps and prunes) and re-reads the server-recorded change
  log (`historyFor(code)`); an adapter without `recordsHistory` (the
  `localStorage` one) gets client-built entries instead. `ensureLoaded()` loads
  once per signed-in account (called from `auth.global.ts`); `reset()` forgets
  it; also `discard()`, `resetAgency()`, `clearStale()`, `load()`. Persistence is
  a swappable adapter (`setAccessPolicyStorage`): the accounts API in the app,
  `localStorage` as the store's default (used by the unit tests).
- **`notifications.ts`** (`useNotificationStore`) — thin Pinia wrapper
  around `useNotificationSocket()` (see §4), kept as a store specifically so
  the WebSocket survives page navigation (a plain composable's teardown is
  tied to whichever component happened to call it first — see the
  connect/disconnect note in `layouts/default.vue`).

`useAuth()` (`app/composables/useAuth.ts`) is the component-facing wrapper
apps actually call — re-exports the auth store plus `login()`/`mfaVerify()`
with the post-auth redirect (`?redirect=` query param, default
`/dashboard`) built in.

---

## 4. Composables — app-level (non-API)

`app/composables/*.ts` (not `api/`).

| Composable | Purpose |
|---|---|
| `useAuth()` | See §3. |
| `useTheme()` | Light/dark choice. Light is the binding default regardless of OS `prefers-color-scheme` (bright-office/wall-display product). Persists to `localStorage['uapts_theme']`; `applyStoredTheme()` is called pre-mount by the theme plugin to avoid a flash. `{choice, resolved, isDark, set, toggle}`. |
| `usePagination(source, pageSize=15)` | Client-side pagination over an already-loaded/filtered array. `page` is a **writable computed** that self-clamps to `[1, totalPages]` on every read — an out-of-range page (filter shrank the results) self-corrects with no `watch()`. Site-wide convention: 15 rows/page. Returns `{page, total, totalPages, pageRows, goTo, next, prev}`. |
| `usePermissions()` | Role-tier gating (`public < operator < analyst < admin`, from the coarse `role_type` field — the backend has no per-action permission strings). `hasRole(...roles)`, `hasMinRole(min)`, `isAdmin`, plus the capability-aware gates: `hasCapability(cap)`, `canExport` (analyst+ AND the `export` capability), `canUseQueryBuilder` (`query_builder`), `canManageUsers` (`manage_users`). A gated action needs both the tier and the capability; with no overrides saved the baseline capabilities match the old tier rules, so nothing changes until an admin changes a policy. |
| `useCsvExport()` | `exportCsv(filename, rows, columns?)` — builds and downloads a client-side CSV from already-loaded rows; used by `ExportButton`'s rows/columns mode. |
| `useSeverityBadge()` | Canonical severity/status → `BadgePill` variant maps, shared so the same word renders the same color everywhere: `riskBadge`, `incidentSeverityBadge`, `dispatchBadge`, `congestionBadge`, `geofenceEventBadge`. |
| `useDataSources()` | Single source of truth for "which agency, which system, how often updated" labels — sourced from the agency UAPTS Needs Assessment questionnaires; an unanswered cadence is recorded as `"Not specified"`, never guessed. `meta(key)`, `sourceLabel(key)` → e.g. `"KeNHA · DRIMS / ARICS · Annual survey (per financial year)"`. |
| `useDashboardSubtitle()` (exports `useNavSubtitle`) | Shared `useState` for the top-nav's persistent subtitle; every `PageHeader` calls this via its `eyebrow`/`title`. |
| `useNotificationSocket(wsBaseUrl?)` | WebSocket client for `/ws/notifications/` (JWT via `?token=` query string — browsers can't set a custom header on a WS handshake). Message types: `hello`/`notification`/`count`/`ping`/`pong`. 30s client keepalive ping, 3s auto-reconnect, caps the in-memory list at 200. Wrapped by the `notifications` store — don't call directly outside it. |
| `useAuditSocket(urlOverride?)` | WebSocket client for `/ws/audit/` (same JWT-in-query-string pattern). `initial` (last 50 logs) / `new_log` (prepend, cap 200) / `metrics` message types. Used directly by `audit.vue` only (not wrapped in a store — see the file's own comment on why that's only safe as long as exactly one component uses it). |
| `useUploadPoll(fetcher, isInFlight)` | See §10.4 — Integration Hub's shared backoff poller. |
| `useAccessControl()` | The agency-scope resolver from the RBAC spec (section 7). Second axis alongside `usePermissions()`'s role-tier gate — that answers "what may this person do", this answers "whose data and which modules may they see"; a route needs both to pass. A thin reactive wrapper over the pure resolver in `app/utils/resolveAccess.ts`, bound to the signed-in user and the **saved** Module Access overrides (never the unsaved draft; outside a Pinia app it falls back to `access-control.json` alone). `resolveRoute(path)` runs the spec's 8-step algorithm (deny by default → domain bundle → agency grants → agency denials always win → Module Access ceiling / enabled / role layers → route's minimum tier → category masks → safe space if nothing resolved) and returns `{allowed, scopeLevel, module, deniedCategories, isSafeSpace}`; `canAccessRoute()`/`canAccessModule()`/`moduleScope()` are convenience wrappers and `hasCapability(cap)` answers the capability layers. Called by `auth.global.ts` (route guard), `AppSidebar.vue`, `AppTopNav.vue`'s command palette, `useFieldMask()` and the agency Command Centre. |

### Module Access utilities (`app/utils/`)

Pure TypeScript, no Vue - shared by the resolver, the `accessPolicy` store and
the `/access-policies` page so they all run the same logic.

| File | Purpose |
|---|---|
| `resolveAccess.ts` | The resolver (`resolveFor(overrides, subject, path)`) and the layer math: `pageScope`, `moduleSummary`, `categoryState`, `capabilitySet`, `capabilitiesFor`, `adminCanManagePolicy` (self-lockout check), `partitionStale`, plus catalogues (`editableModules`, `editableRoutes`, `agencyRoleTiers`, `CAPABILITIES`, `isCategoryLocked`). |
| `accessEdits.ts` | The `AccessEdit` union (every change the page can make), pure `applyEdit`/`pruneOverrides`, `editWarning` (plain-language consequence to confirm before applying), `stableStringify`. |
| `accessPolicyStorage.ts` | Storage adapter interface (`load`/`save`, optional `loadHistory`/`saveHistory`/`recordsHistory`), payload validation (`normalizePolicy`), the `localStorage` implementation, and `createApiAccessPolicyStorage` - GET/PUT `/api/v1/access-control/` and GET `.../history/`, with the server's own refusal text surfaced as `AccessPolicyStorageError`. |
| `accessHistory.ts` | `describeChanges(before, after, code)` turns a save into readable lines ("Railway - Agency limit: Read → Full"); `HistoryEntry`, `parseStoredHistory`. |
| `accessExport.ts` | `buildPermissionExport` (one agency's effective pages, categories, capabilities), CSV column list, printable HTML for "Save as PDF". |
| `accessFilter.ts` | Search + Access/Filter matching for the module tables (`filterModules`). |
| `accessLabels.ts` | Plain-language labels for capability ids and category enforcement modes. |

---

## 5. Composables — API (`app/composables/api/`)

32 files, one per backend domain, all re-exported through the
`index.ts` barrel (`import { useSafety, useDashboard } from
'~/composables/api'`). Every one is a thin wrapper over the shared
`useApi()` (`_client.ts`) — Bearer token + silent refresh handled centrally,
`cleanQuery()` strips null/undefined/empty-string query params.

`useIntegrations.ts` and `useAccounts.ts` are documented in full in **§10**
(Integration Hub) and were covered in an earlier working session
respectively — both follow the same conventions as everything below.

### `useAviationInfrastructure.ts` — M07a
Base `/api/v1/aviation-infra/`. `summary()`, `runways(q?)`, `navaids(q?)`,
`facilities(q?)`, `capitalWorks(q?)`.
Types: `Runway`, `Navaid`, `AviationFacility`, `AviationCapitalWork`.

### `useAviationLicensing.ts` — M07a
Base `/api/v1/aviation-licensing/`. `summary()`, `list(q?)`,
`expiring(days=90)`.
Types: `AviationLicence`.

### `useAviationMaritime.ts` — M07a + M07b combined
One large read-only composable (no CRUD).
- Aviation: `airports`, `airlines`, `aircraft`, `flightSchedules`,
  `flights`, `flightsOTP(days=14)`, `flightsByStatus`, `cargoManifests`,
  `cargoByCommodity(days=14)`, `passengerStats`, `passengersByAirport`,
  `safetyReports`, `safetyReportStats(days=365)`,
  `intermodalConnections`, `intermodalOnTime(days=30)`, `metObservations`,
  `metObservationsLatest`, `aviationSummary(days=7)`
- Maritime: `ports`, `berths`, `vessels`, `vesselMovements`,
  `vesselMovementsLive`, `containerThroughput`, `containerByPort`,
  `containerTrend(days=60)`, `yardDwell`, `maritimeInspections`,
  `maritimeIncidents`, `maritimeIncidentStats(days=90)`,
  `maritimeOperations(days=30)`
Types: `AviationSummary`, `MaritimeOps`, `Airport`/`Airline`/`Aircraft`/
`Flight`/`FlightOTP`, `Port`/`Berth`/`Vessel`/`VesselMovement`, container/
dwell/connection records.

### `useDashboard.ts` — M01
Two surfaces: `useDashboard()` — legacy client-side aggregator
(`summary()` composes agency count + user count + `/api/v1/health/`) plus
`canonicalSummary()` (direct `GET /api/v1/dashboard/summary/`); and
`useDashboardSummary()` — an SSR `useAsyncData` wrapper around the
canonical endpoint (`{data, refresh, pending, error}`).
Types: `DashboardKpi`, `DashboardModule`, `DashboardRecentActivity`,
`DashboardSummary`.

### `useDriverLicensing.ts` — M03/M04
Two resource groups: `drivers(q?)`, `getDriver(id)`,
`driverLicenceHistory(id)`, `revealDriverId(id)` (PII, separate endpoint);
`licences(q?)`, `getLicence(id)`, `expiring(days=30)`.
Types: `Driver`, `DriverLicence`, `LicenceClass`, `LicenceStatus`,
`RevealedDriverIdentity`.

### `useMaritimeCargo.ts` — M07b
Base `/api/v1/maritime-cargo/`. `summary(days=30)`, `byType(q?)`,
`pipeline(q?)`, `handlingStageKpis(days=30)`, `onwardTransport(days=30)`,
`cargoTypeRecords(q?)`, `onwardTransportRecords(q?)`, `gateEvents(q?)`.

### `useMaritimeGreenTransport.ts` — M07b
Base `/api/v1/maritime-green/`. `summary(days=30)`,
`vesselEmissions(q?)`, `modeStats(days=30)`, `evFleet(q?)`,
`reeferEnergy(q?)`.

### `useMaritimeInfrastructure.ts` — M07b
Base `/api/v1/maritime-infra/`. `summary(days=30)`, `channels(q?)`,
`navaids(q?)`, `dryDocks(q?)`, `icds(q?)` (inland container depots),
`capitalWorks(q?)`.

### `useMaritimePerformance.ts` — M07b
Base `/api/v1/maritime-performance/`. `summary(days=30)`, `kpis(q?)`,
`ranking(days=30)`. Also exports `RANK_WEIGHTS` (a plain constant — the
composite ranking's weighting table).

### `useMaritimeServices.ts` — M07b
Base `/api/v1/maritime-services/`. `summary(days=30)`,
`cargoHandling(q?)`, `pilotage(q?)`, `licences(q?)`,
`licencesExpiring(days=30)`.

### `useMaritimeWaterways.ts` — M07b
Base `/api/v1/maritime-waterways/`. `summary()`, `list(q?)`,
`infrastructure(q?)`.

### `useMlPredictive.ts` — M16
Base `/api/v1/ml/`. `models(taskType?)` → `MLModelRegistryEntry[]`;
`ask(question)` → `AskResult` (backend answers via OpenAI when configured,
else a rule-based fallback — `source: 'openai'|'fallback'` tells you
which); `history()` → `{results: AIQueryLogEntry[]}`.

### `useNotifications.ts` — M11
Base `/api/v1/notifications/` (Mongo-backed; live push is the separate
`useNotificationSocket`). Per-user feed: `list(q?)`, `get(id)`,
`unreadCount()`, `markRead(id)`, `markAllRead()`, `delete(id)`. Admin:
`notify(req)`. `rules: {list,get,create,update,delete}` (admin only).
`stats()`, `activity(limit=50)`. `escalation: {policies: {...}, runs:
{list(status?), acknowledge(id), escalate(id), quickStats()}}`.
`health()`.

### `usePublicTransport.ts` — M04
Base `/api/v1/public-transport/`. One large flat composable, all GET
except `publishFeed`: `summary`, `saccos`, `routes`, `routeCoverage`,
`schedules`, `compliance`, `complianceSummary`, `demand`, `brtStops`,
`brtHeadway`, `scheduleAdherence`, `onTimeStats(days=7)`,
`fareCollections`, `revenueTrend(days=7)`, `revenueByChannel(days=7)`,
`demandForecasts`, `serviceQuality`, `operatorMetrics`, `leaderboard`,
`payments`, `fleetDeployments`, `feeds`, `publishFeed(id)`, `feedback`,
`feedbackByCategory`, `psvLicenses`, `expiringLicenses(days=90)`.

### `useRailInfrastructure.ts` — M08
Base `/api/v1/rail-infra/`. `trackSections`, `trackSectionConditionSummary`,
`levelCrossings`, `highRiskLevelCrossings`, `capitalWorks`,
`capitalWorksByStatus`, `culverts`, `signals`, `signalFaults`.

### `useRailSafety.ts` — M08
`correctiveActions(q?)`, `forIncident(incidentRef)`, `riskIndicators(q?)`.

### `useRailway.ts` — M08 core
Base `/api/v1/railway/`. `lines`, `stations`, `trains`, `schedules`,
`operations`, `freight`, `incidents`, `tickets`, `summary`,
`liveOperations`, `onTimeStats(days=30)`, `freightByCorridor(days=30)`,
`incidentStats(days=90)`, `revenueByRoute(days=30)`.

### `useReports.ts` — M09/M15
Base `/api/v1/reports/`. `catalog()` → `ReportTemplate[]`, `template(id)`,
`runs(q?)`, `generate(body)`.

### `useSystem.ts`
`useSystemApi()` — `banner()` (`GET /api/`), `health()` (`GET
/api/v1/health/`), `schema()` (OpenAPI JSON, large). `useServiceHealth()` —
cross-page `useState`-backed convenience wrapper (`banner`, `health`,
`loading`, `lastChecked`) with `refresh(force=false)` throttled to 30s;
powers the top-nav health dots and dashboard status strip.

### `useVehicleInspections.ts` — M03/M04
Base `/api/v1/vehicle-inspections/`. `list(q?)`, `get(id)`, `summary()`,
`reinspections(id)`, `forVehicle(vehicleId)`.

### `useGis.ts` — M13
GeoJSON endpoints for the map page + dashboard overlays. Notable: a
**module-scoped in-memory response cache** (keyed by endpoint+params, TTL
per layer — boundaries 10min, roads 5min, routes/map 30s, 150-entry cap,
insertion-order eviction), shared across every call site in the session;
pass `force: true` to bypass. `kenyaBoundary({admin_level?, force?})`,
`roads({bbox?, highway?, limit?, simplify?, force?})`,
`roadsPmtilesUrl(path?)` / `railsPmtilesUrl(path?)` (a separate `pmtiles
serve` process — Django/Daphne doesn't honor the HTTP Range requests
PMTiles needs), `routes({bbox?, service_type?, limit?, simplify?,
force?})`, `mapOverview({include?, limit_roads?, limit_routes?, bbox?,
force?})` (combined boundary+roads+routes+stations+events in one
round-trip), `clearGisCache()`.
Types: `GeoJSONFeature`, `GeoJSONFeatureCollection`, `MapOverviewBundle`.

### `useInfrastructure.ts` — M06
Base `/api/v1/infrastructure/`. Large flat composable, all GET except
`progressMaintenance`/`syncFieldSurvey`: `summary`, `segments`,
`getSegment(id)`, `segmentConditionMap`, `segmentConditionDistribution`,
`segmentIRIHistogram`, `maintenanceOrders`, `maintenanceByType`,
`progressMaintenance(id, {progress_pct})`, `regionalOffices`,
`fieldSurveys`, `syncFieldSurvey(id)`, `bridges`, `criticalBridges`,
`streetlights`, `streetlightStatusSummary`, `projects`, `projectPortfolio`,
`delayedProjects`, `projectsByCounty`, `forecasts`, `atRiskForecasts`,
`wimReadings`, `wimOverloadStats`, `wimRepeatOffenders`, `budgets`,
`budgetSummary`, `signals`, `signalFaults`, `ruralRoadStatus`,
`assetSnapshots`.

### `useTraining.ts` — M14
Base `/api/v1/training/`. `courses`, `course(id)`, `cohorts`, `cohort(id)`,
`cohortStats(id)`, `cohortEnrollments(id)`, `cohortSessions(id)`,
`enrollments`, `sessions`, `attendance`, `completions`, `revenue`,
`revenueSummary`.

### `useAudit.ts` — M10
`list(q?)`, `get(id)`, `listFromUrl(url)`, `myLogs(q?)`, `actions()`. Full
type/query docs in §10.4's sibling section (identical composable, just also
used by `audit.vue` outside the Integration Hub).

### `useQuery.ts` — M09/M15
`datasets()` → `Record<QueryDatasetKey, Dataset>`. `execute(payload)` /
`executeJoin(payload)` (visual query builder). `savedList()` /
`savedCreate(payload)` / `savedDelete(id)` / `savedRun(id)`. `schema()` →
`DbSchemaResponse` (tables/columns/relations). `raw(payload)` →
`RawSqlResult`.

### `useSafety.ts` — M05
Base `/api/v1/safety/`. Large, with real action endpoints beyond CRUD:
`summary`, `incidents`, `getIncident(id)`, `createIncident(body)`,
`triageIncident(id)`, `dispatchIncident(id, body?)`, `resolveIncident(id)`,
`closeIncident(id)`, `activeIncidents`, `incidentDispatches(id)`,
`incidentsByChannel`, `verifyIncident(id)`, `unverifyIncident(id)`,
`incidentReporters(id)`; `accidents`, `fatalityTrend`, `accidentsByCause`;
`blackspots`, `topBlackspots`; `dispatches`, `activeDispatches`,
`acknowledgeDispatch(id)`, `arriveDispatch(id)`, `completeDispatch(id)`;
`hotspots`, `hotspotHeatmap`; `kpis`, `kpiTrend`, `kpiByCounty`;
`interventions`, `interventionEffectiveness`; `violations`,
`violationsByType`.

### `useTraffic.ts` — M02
Traffic volume, congestion, speed compliance, O-D matrix (grouped
similarly to `useSafety.ts` — see the file directly for the full method
list).

### `useAccounts.ts` — M10
`useAgencies()`, `useDepartments()`, `useRoles()`, `useUsers()` — plain
`list/get/create/update/remove` CRUD per resource, all under
`/api/v1/accounts/`. Full field-level docs on `Agency`/`Department`/
`Role`/`User` are in `app/types/uapts.ts`.

### `_client.ts`
The low-level typed `$api` wrapper every composable above is built on.
`useApi()` re-exposes the plugin-injected fetcher. `cleanQuery(q)` strips
null/undefined/empty-string values from a query-params object.

### `index.ts`
Pure re-export barrel — no logic of its own.

---

## 6. Shared components

`app/components/`, 52 files. Grouped by role.

### Layout / chrome
| Component | Purpose |
|---|---|
| `AppTopNav.vue` | Full top bar (331 lines): ⌘K command palette (~55 hardcoded entries mirroring the sidebar routes), live clock, light/dark toggle, notification bell (shake animation on new item), and the app's one connection point for the notification WebSocket (`notificationStore.connect()`/`disconnect()`). |
| `AppSidebar.vue` | The authoritative module→route nav map (M01–M14, with M10–M12 grouped). Collapsible groups, active-route highlighting, role-gated items. **The best single source of truth for the whole-system route map** — more authoritative than inferring from page titles. |
| `PageHeader.vue` | `title` (required) + optional `eyebrow`/`subtitle` + actions slot. Also the one place that sets the top-nav's persistent subtitle (`useNavSubtitle(eyebrow \|\| title)`). |
| `SectionTitle.vue` | Small uppercase heading + optional `pill` badge. |
| `BackToTop.vue` | Self-contained fixed scroll-to-top button, appears after 800px scroll, respects `prefers-reduced-motion`. No props. |

### Data display
| Component | Purpose |
|---|---|
| `KpiCard.vue` | The canonical, mature KPI-figure component (all 53 pages use this API). Label/value/unit, semantic status (with legacy alias support: `good/warn/crit/info`, `ontarget/below/monitoring/nodata`), optional actual-vs-target bullet bar (`transform`-based fill — the correct pattern), comparison delta with explicit directional favorability (never assumed), optional embedded `Sparkline`, honest "unavailable" state (`-` + "NO DATA" + reason, never a fabricated 0), optional drill-down (`to="#id"` scrolls / `to="/route"` navigates, emits `activate` with a filter payload). |
| `BadgePill.vue` | Generic status/tag pill. Two class families: `.badge.{variant}` (success/warning/danger/info/neutral) vs. `.iri-pill.iri-{variant}` (IRI road-condition values — passing an IRI variant name through the wrong path renders unstyled). `size` prop (`sm`/`md`) added this session for dense table cells. |
| `SourceChip.vue` | Small pill for data provenance — `variant` (`live`/`batch`/`manual`), `title` tooltip. |
| `Sparkline.vue` | Compact SVG trend readout for a KPI card, deliberately static/non-animated ("the dashboard's one authored motion is the KPI stagger" per its own comment). Renders nothing below 2 points. |
| `MultiLineChart.vue` | Multi-series SVG trend line — legend, shared crosshair, one tooltip listing every series at the hovered x, "nice" round-number y-axis (`niceStep()`, kept in sync by hand with `TrendLineChart`'s copy). |
| `TrendLineChart.vue` | Single-series version — area gradient + line, hairline gridlines, hover crosshair/tooltip. `color` defaults to the theme's institutional blue rather than a fixed hex, so it stays on-brand in both themes if the caller omits it. |
| `UaptsMap.vue` | The one Leaflet map component (1689 lines), used across M02/M04. Wrapped in `<ClientOnly>` by every caller. Two calling styles: layer-catalog (`layers: string[]`, each fetched from its own endpoint) or data-props (pre-fetched `boundary`/`roads`/`routes` GeoJSON + `markers`/`lines`/`arrows`). Both support `roadsTilesUrl`/`railsTilesUrl` (protomaps-leaflet PMTiles, viewport-scoped), a v-model-able `basemap` (light/dark/satellite, no-API-key tile sources), `showMapToolbar`. Dynamic-imports `leaflet`/`protomaps-leaflet` client-side, caches the resolved module once per mount. Exposes `flyTo()`/`fitBounds()`/`getMap()` via `defineExpose`; emits `feature-click`, `update:basemap`, `bounds-change`. |
| `AlertItem.vue` | Wireframe `.alert-item` row: severity badge + title/meta + optional ACK button. Used in the Command Centre's Active Alerts panel. |
| `StatusBar.vue` | Trivial wrapper (`<div class="status-bar"><slot/></div>`) for a row of agency online/offline dot indicators — children are caller-supplied `.stat`/`.dot` markup. |

### Tables / lists / pagination
| Component | Purpose |
|---|---|
| `TablePagination.vue` | Minimal prev/next pager (no page-number buttons). `page`/`totalPages`/`total` props, `prev`/`next` emits. Pairs with `usePagination()`. |
| `EmptyState.vue` | Shared "nothing here yet" pattern — spinner while `loading`, else an inline SVG `icon` (`dataset`/`search`/`inbox`) + `message` + optional action slot; a `compact` variant for inline use. Replaces the old inconsistent per-page mix of bare `-`/`0`/stuck spinners. |
| `FilterBar.vue` | Trivial wrapper (`<div class="filter-bar"><slot/></div>`) — all real layout/behavior is the shared `.filter-bar` CSS plus whatever the caller slots in. |

### Forms / controls
| Component | Purpose |
|---|---|
| `ExportButton.vue` | Role-gated export control, two modes: `:href` (fetches a real backend export endpoint through the authenticated client and saves as a blob — a bare `<a href>` would skip the Bearer token and 401) or `:rows`/`:columns` (client-side CSV via `useCsvExport()` from already-loaded/filtered data). Renders nothing below `minRole` (default `analyst`) — opt-in, not hidden-but-reachable. |
| `ConfirmDialog.vue` | Themed replacement for `window.confirm()` (added this session; used in `users.vue`/`roles.vue`'s destructive actions). Focuses Cancel on open, Escape-to-cancel (guarded while `busy`), `role="alertdialog"`. `message` renders with `white-space: pre-line`, so `\n\n` gives a second paragraph. |
| `OverflowMenu.vue` | "•••" menu button (WAI-ARIA menu pattern): `items` (`{key, label, icon?, danger?, separatorBefore?}`), emits `select(key)`. Arrow keys / Home / End move, Esc or a click outside closes and refocuses the button. Destructive items render in `--danger-fg`. First used by `/access-policies`. |
| `SideDrawer.vue` | Right-hand modal panel over a scrim for secondary tasks that shouldn't navigate away (previews, history). `open`, `title`, `subtitle`; default slot, optional `toolbar`/`footer` slots; emits `close`. Teleported to `<body>`, focus moves in and is trapped, Esc / × / scrim close, focus returns to the opener. Full-width on phones. |
| `AppModal.vue` | Teleported dialog, fade+scale transition, Escape-to-close, body-scroll lock. **Known gap**: entirely hardcoded hex colors (`#ffffff`, `#111827`, `#e5e7eb`, `#6b7280`, `#f9fafb`) — won't respond to dark mode or any `theme.css` change, unlike every other modal in the app. |
| `ProgressBar.vue` | Shared wrapper around the theme's `.progress`/`.progress-bar` pattern (previously hand-rolled 3×). **Known gap**: animates via `:style="{width: pct+'%'}"` against `theme.css`'s width-based transition — the same layout-thrash pattern fixed this session in `IngestProgress.vue` and the Integration Hub bar-fills, not yet applied here. |
| `DayRangeToggle.vue` | Shared "7d / 30d / 90d" quick-range button group (previously hand-built near-identically on 9 pages). `modelValue` (v-model, number\|null), `options`, `suffix`, `deselectable`. |
| `UploadTimeline.vue` | Vertical step timeline for file-processing stages — a step with no timestamp shows pending, never a fabricated one (per its own header comment). Used in `integrations/files/[id].vue`. **Known gap**: one leftover raw em-dash placeholder (line 15) that escaped this session's em-dash cleanup, which covered the Integration Hub's own dedicated component list but not this app-wide one. |

### Module Access-specific (10 components)
Used by `/access-policies` only:
`AccessAgencyTab.vue` (modules/pages × Allowed/Enabled),
`AccessRolesTab.vue` (pages by role + one capability matrix),
`AccessCategoriesTab.vue` (restricted data categories),
`AccessScopeToggle.vue` (None/Read/Full selector - inherited level drawn as a
blue wash, a level set on that layer drawn solid with a reset icon, "Capped" /
"Mixed" flags, roving tabindex + arrow keys), `AccessScopeLegend.vue`,
`AccessModuleCell.vue` (module label as the disclosure control for its pages),
`AccessModuleFilters.vue` (search + Access + Filter row),
`AccessPreviewPanel.vue` ("Preview as role" drawer content),
`AccessHistoryList.vue` (change-history drawer content),
`AccessExportDialog.vue` (CSV / JSON / PDF). All tables adopt the shared
`.stack-table` mobile pattern.

### Empty / not implemented
`AuditTable.vue`, `DashboardCard.vue`, `StatCard.vue`, `UserTable.vue` are
all **0-byte files** — plausible-sounding names with nothing behind them.
`audit.vue`, `dashboard.vue`, and `users.vue` all build their own inline
table/card markup directly rather than using any of these. Don't assume
they're wired to anything.

### Data Integration Hub-specific (11 components)
`FileDropzone.vue`, `IngestStatusPill.vue`, `SampleGrid.vue`,
`TabStrip.vue`, `ReconciliationFunnel.vue`, `KpiTile.vue`, `JsonViewer.vue`,
`SourcePicker.vue`, `IngestProgress.vue`, `DateRangeFilter.vue`,
`RoutePanel.vue` — see **§10.2** for the full per-component reference
(props/emits).

---

## 7. Shared types

`app/types/uapts.ts` — the cross-cutting API-response shapes referenced
throughout: `Agency`, `Department`, `Role`, `User`, `AuthUser` (extends
`User` with `first_name`/`last_name`/`full_name`/`employee_id`/`avatar` —
the backend doesn't emit name fields yet, declared optional so the UI lights
up automatically if it grows them), `LoginResponse`, `TokenRefreshResponse`,
`MfaChallenge`, `LoginResult` (`LoginResponse | MfaChallenge`),
`MfaIssuedResponse`, `MfaEnrollVerifyResponse`, `MfaVerifyResponse`,
`DetailResponse`, `Paged<T>` (the standard pagination envelope), the
system-health shapes `HealthResponse`/`ComponentStatus`/`RootBanner`, and
`ApiError`.

Domain-specific types (e.g. `DataSource`, `DataUpload`) live in their own
API composable file rather than here — see §5.

---

## 8. Design system

Full detail lives in `DESIGN.md` (tokens, typography, component specs,
named rules). The single most load-bearing fact for writing new UI in this
codebase: **every color resolves from a `var(--token)`, never a hardcoded
hex** — `theme.css` defines the full light+dark palette and swaps it under
`[data-theme]`. Several components (§6 "Known gaps") predate this
discipline being fully enforced and are flagged individually above rather
than fixed opportunistically here.

---

## 9. Deep dive — Data Integration Hub (M12)

The most thoroughly worked module in this codebase this session. Full
routes, components, API surface, and the conventions established while
building it out (several of which — the em-dash rule, the `transform`
over `width`/`height` animation rule, honest-empty-state discipline — are
good defaults for the rest of the app too, not just this module).

### 9.1 Routes

| Route | File | Purpose |
|---|---|---|
| `/integrations` | `index.vue` | Upload a file, or register how a live feed connects |
| `/integrations/analytics` | `analytics.vue` | Platform-wide ingestion reconciliation (received → written) |
| `/integrations/files` | `files/index.vue` | Cross-agency upload inbox + live feed registry, as two tab segments |
| `/integrations/files/[id]` | `files/[id].vue` | One upload's detail: sample, validation, mapping, DB matches |
| `/integrations/feeds/[source_id]` | `feeds/[source_id].vue` | One live feed's connection details + reconciliation |

**`index.vue`** — Two tabs (`TabStrip`): **Upload a file** / **Register an
API**.
- Upload flow (3 steps): choose the feed (`SourcePicker`) or drop into the
  **routing queue** (template-late intake, backend assigns a feed later) →
  download the locked `.xlsx` template if one exists → drop the file
  (`FileDropzone`), uploads immediately. Result renders inline, keyed on
  `uploadResult.status` (`validated`/`needs_mapping`/`rejected`/`failed`/
  `unrouted`).
- Register flow (admin-only, UX-level `isAdmin` check — real gate is
  server-side `IsAdminRole`): agency + feed ID + protocol (`PROTOCOLS` grid)
  → auth method → endpoint & schedule (with a live `curlExample` preview) →
  test (`runTest()`, real SSRF-guarded reachability check for pull
  protocols, shape-only for push) & save (`saveFeed()`). A push feed's
  `issued_secret` is shown exactly once.
- Right rail: Connected feeds (first 6) + Recent uploads (last 6).

**`analytics.vue`** — One aggregate call per time window (`24h`/`7d`/`30d`,
`platformStats()` + `agencyContributions()`) rather than per-source calls.
Headline ribbon, received→written funnel, silent-failures table (receiving
records, writing zero domain rows), agency contributions (`ih-hbars`),
handler errors / unrecognised record types, and an independent feed-health
table with its own status chips + pagination.

**`files/index.vue`** — Two `TabStrip` segments (`segment` synced to the
URL query string):
- **Files**: routing-queue jump-chip, filter bar (filename, submitted-by
  agency, covers agency, feed, status, `DateRangeFilter`, Reset), KPI ribbon
  scoped to the *current filter set* (not all-time, not just the loaded
  page), table with `IngestProgress` read/write bars + `IngestStatusPill`.
- **Feeds**: search (feed ID/agency) + status filter + Reset, table of the
  live registry.

**`files/[id].vue`** — Header: Download original, Replace (dropdown →
upload a correction). If `status === 'unrouted'`: the whole main column is
`RoutePanel`. Otherwise `TabStrip` with Sample / Validation / Mapping /
DB matches (first three gate on `needs_mapping`). Right rail: batch details
(feed, format, size, sheets, submitted/uploaded by, content hash,
corrects/superseded-by).

**`feeds/[source_id].vue`** — Header: Trigger sync, Pause/Resume.
Connection details (only if `source.protocol` is set — blank means a
legacy/seeded feed never registered through the console), headline ribbon,
received→written funnel with a silent-failure banner, 7-day sparkbar chart,
unrecognised types / top handler errors, last 50 raw payloads
(`JsonViewer`).

### 9.2 Components

| Component | Purpose | Key props | Emits |
|---|---|---|---|
| `KpiTile` | Label / big mono number / sub-label, explicit tri-state (`loading`/`ok`/`unavailable`) — a failed fetch never renders as a real `0` | `label`, `value`, `sub`, `state` | — |
| `TabStrip` | Generic underline-style tab switcher | `tabs: {key,label,count?,disabled?,disabledReason?}[]`, `modelValue` | `update:modelValue` |
| `ReconciliationFunnel` | `declared→parsed→valid→written` or `received→attempted→written`, same component either way | `stages`, `branches?` | — |
| `RoutePanel` | Routing control for an un-routed upload — detected headers + server-ranked candidate feeds; the human picks, nothing auto-applies | `uploadId`, `detectedHeaders?`, `agencyCode?` | `routed` |
| `SourcePicker` | "Choose the feed" combobox, manual `DataSource`s grouped by agency (auto-selects if only one exists) | `sources`, `modelValue` | `update:modelValue` |
| `FileDropzone` | Drag/drop + click-to-browse, client-side validation, upload-progress state | `accept`, `maxSizeMb`, `disabled`, `disabledReason`, `uploading`, `progress`, `fileName` | `file`, `error` |
| `IngestProgress` | Like a progress bar but accepts `pct: null` for "genuinely don't know yet" → indeterminate sweep | `pct`, `variant`, `label` | — |
| `IngestStatusPill` | `BadgePill` wrapper driven by `statusMeta()` — single source of truth for every status pill/chip in the hub | `status` | — |
| `JsonViewer` | Collapsible raw-payload viewer | `value`, `label`, `collapsible`, `startOpen` | — |
| `SampleGrid` | Raw file preview table with row/cell-level error highlighting (normalized substring match against `validation_report`) | `columns`, `rows`, `startRowNumber`, `rowErrors`, `loading` | — |
| `DateRangeFilter` | Segmented date-type control (Uploaded/Committed/Period) + a from/to range | `fields`, `field`, `from`, `to` | `update:field`, `update:from`, `update:to` |

`app/assets/css/integration-hub.css` (global, `.ih-*` namespaced) supplies
the shared primitives every page composes with: `.ih-card`, `.ih-ribbon`,
`.ih-lead`, `.ih-table`, `.ih-chips`, `.ih-toggle`, `.ih-two-col`,
`.ih-stats`, `.ih-sparkbars`, `.ih-hbars`, and the staggered `ih-rise`/
`ih-rise-2/3/4` entrance animation.

### 9.3 `useIntegrations()` — full API surface

Backend base `/api/v1/integrations/`:

```
GET  /                        list DataSources
GET  /{source_id}/            one DataSource
POST /{source_id}/trigger/    queue a manual sync
POST /{source_id}/pause/
POST /{source_id}/resume/
POST /{source_id}/ingest/     remote-pusher entry point (X-API-Key)
GET  /records/                paginated IngestedRecord list
GET  /records/{id}/

GET  /{source_id}/uploads/    upload history for a source
POST /{source_id}/uploads/    upload a file - 202, async validation
GET  /uploads/{id}/           poll one upload's status/counts
POST /uploads/{id}/commit/    202, async commit
```

Upload/commit run as Celery tasks — POST returns immediately with
`status="pending"`/`"committing"`; callers poll `uploads.detail()` until a
terminal status.

```ts
useIntegrations() → {
  list(q?), get(sourceId), trigger(sourceId), pause(sourceId), resume(sourceId),
  records(q?), record(id),

  uploads: {
    list(sourceId, q?),
    create(sourceId, file, declaredSchemaVersion?, onProgress?),
    intake(file, {sourceId?, declaredSchemaVersion?, agencyCode?}, onProgress?),   // routing-queue path
    inbox(q?),                          // cross-agency inbox
    routeInfo(uploadId),                // ranked candidate feeds
    route(uploadId, sourceId),          // assign a feed to an unrouted upload
    detail(uploadId),
    preview(uploadId, q?),              // Sample tab - re-parses the file fresh every call
    download(uploadId),                 // -> Blob
    commit(uploadId),
    replace(uploadId, file, declaredSchemaVersion?, onProgress?),
    includeDuplicates(uploadId),
    expectedColumns(sourceId),
    applyMapping(uploadId, columnMap, saveForAgency),
    templateDownload(sourceId),         // -> Blob
  },

  feedStats(sourceId),
  agencyContributions(window?),         // 24h | 7d | 30d | all, default '30d'
  platformStats(window?),               // default '7d'
  registerFeed(payload),                // admin-only server-side
  testConnection(payload),              // pre-save form test, or re-test a saved feed
}
```

Two response conventions coexist: `DataSourceViewSet`/`IngestedRecordViewSet`
return raw serializer data; everything under `uploads.*` plus
`feedStats`/`platformStats`/`registerFeed`/`testConnection` use a
`{success, data, message}` envelope, unwrapped internally by
`unwrapEnvelope()`. File upload/replace/template-download bypass the normal
`$api` plugin: `uploadFileWithProgress()` uses a raw `XMLHttpRequest`
(needed for `xhr.upload.onprogress`) and `downloadBlobWithAuth()` uses
`fetch` with the auth header attached manually.

Key types: `DataSource`, `DataUpload`/`DataUploadDetail`,
`DataUploadStatus` (`unrouted | pending | validating | needs_mapping |
validated | rejected | committing | committed | partial | failed |
superseded`), `RouteCandidate`/`RouteInfo`, `UploadInboxAggregates`/
`UploadInboxResult`, `AgencyContribution`, `IngestedRecord`,
`ExpectedColumn`, `DataSourceStats`, `SilentFailure`, `PlatformStats`,
`RegisterFeedPayload`/`RegisterFeedResult`, `TestConnectionPayload`/
`TestConnectionResult`.

### 9.4 Supporting composables & utils

**`app/utils/ingestStatus.ts`** — single source of truth for
`DataUploadStatus → label/phase/variant`. Auto-imported.
- `statusMeta(status)` → `{label, phase, variant, inFlight, actionRequired}`
- `isInFlight(status)`, `needsAttention(status)`
- `readPct(upload)` → `0 | null | 100` (`null` = genuinely indeterminate,
  no parse-progress field exists on the backend)
- `writePct(upload)` → real percentage, `domain_records_created / valid_rows`

**`app/composables/useUploadPoll.ts`** — `useUploadPoll(fetcher,
isInFlight)` → `{start, stop}`. One polling implementation shared by pages
1–3 (replaced three near-identical hand-rolled pollers). A chain of
`setTimeout`s, not `setInterval`: one live timer, backs off `3s → 5s → 10s`
then holds, pauses while the tab is backgrounded, resumes immediately (not
after another backoff wait) on `visibilitychange`, stops for good once
`isInFlight()` goes false.

### 9.5 Conventions established this session (apply more broadly)

- **Honest states, not fabricated ones.** A failed KPI fetch renders
  `-`/"Unavailable", never a fake `0`. Missing/placeholder values render
  `-`, never `Never` or anything asserting a fact the platform doesn't
  actually know (e.g. `users.vue`'s "Last Login" is derived from real
  audit-log `login` events, not a nonexistent backend field — see the
  file's own `fmtLastLogin()` comment).
- **No em-dashes in user-facing copy.** Split with a period, or join with
  a colon/comma instead; empty-value placeholders use `-`. Code comments
  are exempt.
- **Figures use `var(--font-mono)`** (JetBrains Mono), not a bare system
  monospace stack. The system stack is reserved for genuine code/credential
  contexts (`<code>` spans, a generated secret value, `.curl-block`,
  `JsonViewer`'s raw payload).
- **Bar/meter fills animate `transform: scale()`, never `width`/`height`
  directly** — animating a layout property causes reflow thrash. Each fill
  stays 100% width/height in layout at all times and is only ever visually
  scaled down (factor always ≤1 by construction), so the track's
  `overflow: hidden` still clips correctly with no extra bookkeeping. Not
  yet applied to `ProgressBar.vue` (see §6 "Known gaps").
- **Header action buttons are plain text**, no decorative emoji — a
  trailing `→` for navigation links.
- **Filter bars get `min-width: 0` on every direct child** plus explicit
  capped widths per control, so controls actually shrink instead of the
  row wrapping raggedly (the flexbox default, `min-width: auto`, silently
  blocks shrinking). `flex-wrap: wrap` stays the safety net at narrow/
  mobile widths.
- **Two agency facets on an upload are distinct**: `agency_code` (who
  *submitted* it) vs. `covers_agency`/`covers_breakdown` (who the data is
  *about* — e.g. KRB submits funding data about KeNHA).

---

## 9.6 RBAC settings file (`app/config/access-control.json`)

The interim, file-based settings source `useAccessControl()` (§4) reads.
Encodes the whole RBAC spec's model: `roles` (the tier ladder incl. the new
`super_admin`/`oversight` tiers), `domains` (9 transport-domain bundles,
`oversight` marked `readOnly`), `modules` (route membership per M01–M14),
`routes` (per-route `minTier`/`agencyScoped`/`categories` overrides — only
populated for routes that deviate from the default), the 12 agency
profiles (`grants.full`/`grants.read`/`grants.routes`, `denies.modules`/
`denies.routes`/`denies.categories`), `publicView`, and
`restrictedCategories` (the section 6 data-sensitivity table, with a
`minTier` field for categories that stay admin-gated even within the
*owning* agency's own tenant — separate from `denies.categories`, which is
the cross-tenant "never shown to another agency at all" block). Version 1,
`updatedBy: "system@transport.go.ke"` as a placeholder pending the section
9 "who holds Super Admin" decision.

Verified against `tests/unit/access-control.test.ts` (13 cases covering
fail-closed-when-unauthenticated, the super_admin bypass, the public
single-view rule, cross-agency denial, the query-builder restriction,
oversight's read-only domain scope, tier gates on top of module grants,
and both category-masking directions).

## 9.7 Module Access (`/access-policies`, 2026-09-28)

**Model.** Three override layers sit on top of `access-control.json` without
changing it, each only able to narrow the one above:

| Layer | Set by | UI label |
|---|---|---|
| ceiling | super_admin | "Allowed by super admin" / history: "Agency limit" |
| enabled | super_admin or that agency's admin | "Enabled for agency" / history: "Agency access" |
| role | super_admin or that agency's admin | per role column / history: "Analyst role", ... |

Each layer holds module and page scopes (None/Read/Full), restricted data
category allow/deny (ceiling and enabled only) and capability sets. A module
value applies to all its pages unless the same layer sets a page. Platform-wide
category blocks (`ingestion_validation`, `not_ingested`, `feature_flag_off`)
can't be changed. With nothing saved, resolution is identical to before, pinned
by `tests/unit/access-parity.test.ts`'s snapshot of every agency × tier × route.

**Code.** Logic: `app/utils/resolveAccess.ts` and the other `access*.ts` utils
(§4). State: the `accessPolicy` store (§3), given the API adapter by
`plugins/access-policy.client.ts` and loaded by `middleware/auth.global.ts`
right after authentication and before the first route is resolved.
`useAccessControl()` reads saved overrides only. Page: `app/pages/access-policies.vue` + the Module Access components (§6).

**Page behaviour.**
- Agency bar: agency select (super_admin; "(edited)" marks agencies with
  changes) or the admin's own agency, status pills (modules at Full / Read /
  Restricted for the agency), last-saved line, and a "•••" menu: *Preview as
  role* and *View change history* (side drawers), *Export permissions* (CSV /
  JSON / PDF via the browser's print dialog), *Reset to agency defaults*
  (destructive, confirmed; super_admin clears every layer, an agency admin
  keeps the super_admin limit).
- Tabs: Agency access, Role permissions, Data categories. The first two share a
  search + Access (Any / Full / Read / Restricted) + Filter (All / Inherited /
  Custom) row; searching opens matching modules.
- Edits are a draft until *Save changes*; *Discard*, a leave-page guard and
  `beforeunload` protect unsaved work. super_admin is asked to confirm edits
  with a serious consequence (`editWarning`); an agency admin simply can't make
  an edit that removes their own admin role's full `/access-policies` access or
  `manage_users`.

**Storage.** The accounts API is the source of truth: `GET`/`PUT
/api/v1/access-control/` (overrides; a super_admin gets every agency, anyone else
only their own) and `GET /api/v1/access-control/history/` (change log, newest
first; super_admin and agency admins only). The server is the gate - it enforces
the rules above on every save (ceiling is super_admin-only, an agency admin is
confined to their own agency and refused a self-lockout, platform-blocked
categories never change), stamps `updatedBy`/`updatedAt` itself, builds the
history itself and audit-logs each change; the client checks are the clean
experience, not the gate (spec 2.1). Nothing is fetched before authentication
(a 401 from `$api` means "log out"); `auth.global.ts` loads the policy per
signed-in account. If the load fails the app falls back to the baseline JSON
and logs a warning. `localStorage['uapts:access-policy:v1']` /
`['uapts:access-policy-history:v1']` remain the store's default adapter for
tests and dev.

**Tests.** `resolve-access`, `access-parity`, `access-policy-store`,
`access-policy-wiring`, `access-scope-toggle`, `access-filter`,
`access-history`, `access-policies-page`, `access-policy-api-storage`,
`access-policy-middleware`, `capability-gates` (all under `tests/unit/`).

Spec: `docs/superpowers/specs/2026-09-28-module-access-control-design.md`
(see its "Changes after approval" section).

## 10. Known gaps (accurate as of this document, not fixed here)

- **Four empty component files**: `AuditTable.vue`, `DashboardCard.vue`,
  `StatCard.vue`, `UserTable.vue` (0 bytes each). The correspondingly-named
  pages build their own markup inline instead.
- **`AppModal.vue`** is fully hardcoded-hex, doesn't respond to dark mode.
- **`EmptyState.vue`** has the same `var(--token, #fallbackHex)` dead-code
  pattern fixed elsewhere this session (real tokens are always defined, so
  the fallbacks never fire and don't match the real palette anyway).
- **`ProgressBar.vue`** still animates `width` directly (shared
  `.progress-bar` class) — the layout-thrash pattern fixed in
  `IngestProgress.vue` and the Integration Hub's own bar-fills.
- **`UploadTimeline.vue`** has one leftover raw em-dash placeholder.
- **`AppSidebar.vue`** has an unused `canManageUsers`/`ADMIN_ROLES`
  computed/constant — dead code, no client-side route gating currently
  wired to it (a previously-flagged, still-open product/eng decision — see
  `DESIGN_AUDIT.md`).
- Client-side route gating is in place (`auth.global.ts`, `AppSidebar.vue`
  and the command palette all go through `useAccessControl()`), but it is the
  clean experience only; `/query-builder` still needs restricting
  server-side per the RBAC spec's recommended sequence.
- **Capability gates are client-side only.** `ExportButton`, the query builder's
  Run action and the account-write controls on `/users` and `/roles` now need
  the `export` / `query_builder` / `manage_users` capability as well as the
  role tier (`usePermissions()`), but the backend's export, query-console and
  user endpoints still gate on role tier alone, so switching a capability off
  hides the control without closing the endpoint. Role/department catalog
  editing on `/roles` is not capability-gated.
- **The baseline JSON is duplicated.** `app/config/access-control.json` is also
  vendored into the backend (`apps/access_control/data/`) for server-side
  resolution; change both together until one is served from the other.
- **PDF export** uses the browser's print dialog ("Save as PDF"); there is no
  PDF library in the project.
