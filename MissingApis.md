# Missing / Broken / Unwired APIs — Live Endpoint Audit

**Method:** every endpoint referenced by `app/composables/api/*.ts` was called
directly against a live backend with a real admin JWT (not mocked, not read
from code comments) using a purpose-built test harness, and the actual JSON
returned was diffed field-by-field against the TypeScript interface the
frontend declares for it. The harness was then re-run against the full
OpenAPI schema (`/api/schema/?format=json`) to find backend endpoints that
have **no** frontend composable at all.

- **Backend tested:** `http://192.168.0.110:8000` (the host in `.env`
  `NUXT_PUBLIC_API_BASE`), environment `development`.
- **Auth:** JWT login, admin role.
- **Endpoints exercised:** 220 (from 27 composable files).
- **Result:** 193 returned 200, 1 returned an unexpected 404, 1 returned an
  unexpected 500, 24 returned the *expected* 404 (composables explicitly
  written "ahead of the API" per their own file-header comments).
- **Harness:** [`scripts/test-endpoints.mjs`](scripts/test-endpoints.mjs) — see
  [Re-running this audit](#re-running-this-audit) at the bottom.

Findings are grouped by what kind of fix they need.

---

## 1. Confirmed backend bugs

These are not frontend problems — the frontend code calling them is correct;
the backend is misbehaving.

### 1.1 `GET /api/v1/integrations/records/` → 404, shadowed by `{source_id}/`

`useIntegrations().records()` (`app/composables/api/useIntegrations.ts:87`)
calls the documented, schema-listed route `/api/v1/integrations/records/`.
Live response:

```json
{"detail":"No DataSource matches the given query."}
```

**Cause:** the DRF router almost certainly registers `/{source_id}/` before
`/records/` in `urls.py`, so the URL resolver matches `records` as a
`source_id` path parameter and routes into the *DataSource* detail view
instead of the *records* list view. The endpoint **is** present in the
OpenAPI schema (`/api/v1/integrations/records/` and `/records/{id}/` both
listed), confirming the ViewSet exists — it's a route-ordering bug, not a
missing feature.

**Fix (backend):** in the integrations app's router/urls, register the
static `records/` prefix (and any other literal sub-paths) **before** the
dynamic `{source_id}/` pattern, or move `records` under a distinct prefix
(e.g. `/api/v1/integrations/_records/`) so it can never collide with a
source id.

**Frontend impact:** `useIntegrations().records()` and `.record(id)` are
called from the Integration Hub page's raw-payload drill-down — that view
will always show empty/error until this is fixed. No frontend change needed
once the backend route order is corrected.

### 1.2 `GET /api/v1/aviation-maritime/maritime/vessel-movements/turnaround/` → 500

Not currently called by any composable, but it's the exact real endpoint
the Maritime module's Turnaround Time section (design-doc Section 5) should
be using instead of the client-side dwell-time approximations currently on
`/maritime/port-ops`. It throws a Django `FieldError` (full debug traceback
returned — `DEBUG=True` on this environment):

```
Cannot compute Avg('<CombinedExpression: Avg(F(atd)) - Avg(F(eta)) / Value(3600.0)>'):
'<CombinedExpression: Avg(F(atd)) - Avg(F(eta)) / Value(3600.0)>' is an aggregate
```

**Cause:** the view nests one `Avg()` inside another (`Avg(Avg(atd) -
Avg(eta))`) in a single `.aggregate(...)` / `.annotate(...)` call — Django's
ORM cannot aggregate over an already-aggregated expression in one step.

**Fix (backend):** split into two steps — annotate each row with the raw
duration first (`ExpressionWrapper(F('atd') - F('eta'), output_field=...)`),
then `Avg()` that annotated field in a second `.aggregate()` call. Example:

```python
qs = qs.annotate(turnaround_seconds=ExpressionWrapper(
    F('atd') - F('eta'), output_field=DurationField()
))
result = qs.aggregate(avg_turnaround=Avg('turnaround_seconds'))
```

**Frontend impact:** once fixed, wire a new `vesselTurnaround()` call into
`useAviationMaritime.ts` and use it on `/maritime/port-ops` in place of the
`avg_yard_dwell_days`-only approximation, so Section 5's Waiting
Time/Pilotage/Discharge/Loading breakdown can show real numbers instead of
just the composite dwell figure.

---

## 2. Existing composable has the wrong field names (real endpoint, real data, type mismatch)

### 2.1 `useRailway().incidentStats()` — used the wrong type (same name, two different real shapes) — **FIXED**

`app/composables/api/useRailway.ts` had a single `IncidentSummary` interface
reused for two call sites that turn out to return **different field names**
for the same concept:

```json
// GET /api/v1/railway/summary/  → .incidents_90d  (used by dashboard.vue, railway/index.vue)
{"total":3,"casualties":16,"loss_kes":106319594,"fatal":0,"level_crossing":2}

// GET /api/v1/railway/incidents/stats/?days=90  → useRailway().incidentStats()
{"days":90,"total_incidents":3,"total_casualties":16,"total_loss_kes":106319594,"fatal_incidents":0,"level_crossing_incidents":2}
```

The original `IncidentSummary` shape (`total`/`casualties`/`loss_kes`/
`fatal`/`level_crossing`) was actually **correct** for `RailwaySummary.incidents_90d`
— only the standalone `incidentStats()` composable method was wrong (it was
typed with the same interface, but the live endpoint it calls uses
different, prefixed field names entirely). Confirmed no page currently
calls `incidentStats()` directly, so this was latent, not yet
user-visible.

**Applied fix:** kept `IncidentSummary` unchanged (still used correctly by
`RailwaySummary.incidents_90d` → `dashboard.vue` / `railway/index.vue`), and
added a second, distinct `RailIncidentStats` interface matching the real
`/incidents/stats/` response, now used as `incidentStats()`'s return type:

```ts
export interface RailIncidentStats {
  days: number
  total_incidents: number
  total_casualties: number
  total_loss_kes: number
  fatal_incidents: number
  level_crossing_incidents: number
}
```

### 2.2 Maritime accidents page (`app/pages/maritime/accidents.vue`) guessed field names that don't match the real `maritime-incidents` shape — **FIXED**

Built this session against the design doc's accident-field list (IMO
position lat/long, "vessels involved" array, investigation status,
environmental damage, response time). The **real**, live endpoint
(`/api/v1/aviation-maritime/maritime/maritime-incidents/`) returns:

```json
{
  "id": "5aaf0bf6-...", "incident_ref": "KMA-MIR-2026-00004",
  "incident_type": "grounding", "severity": "none",
  "vessel": "4dfdad32-...", "vessel_name": "M/V Tembo Horizon",
  "port": "3d273e3a-...", "port_unlocode": "KEKLF",
  "occurred_at": "2026-02-19T19:47:21.385570+03:00",
  "description": "Grounding involving M/V Tembo Horizon near Kilifi Harbour. Severity: none.",
  "casualties": 0, "pollution_tons": 0, "status": "investigating",
  "reported_by_agency": "6f972837-...", "agency_code": "KMA",
  "created_at": "...", "updated_at": "..."
}
```

Differences from what `accidents.vue`'s defensive accessors guess:

| Page guesses | Real field | Fix |
|---|---|---|
| `inc.investigation_status ?? inc.status` | `status` | drop the `investigation_status` guess, just bind `inc.status` |
| `inc.oil_spill_volume_tonnes ?? inc.pollution_volume_tonnes ?? inc.spill_volume` | `pollution_tons` | bind directly, no fallback chain needed |
| `inc.response_time_min ?? ...` | *(field does not exist)* | remove the Response Time column, or request the backend add it — it's in the design doc (Section 7) but not implemented |
| `inc.vessels_involved` (array) / `inc.vessel_names` | single `vessel` + `vessel_name` | there is exactly one vessel per incident record on this backend, not an array — simplify `vesselsLabel()` |
| `inc.latitude`/`inc.longitude` | *(not present)* | the incident map on this page will always show "no incident position data" until the backend adds lat/long — currently only `port_unlocode` is given, which would need a lookup against `ports()` to plot |
| — | `incident_ref` (unused) | add as a display column — it's the natural human-readable reference |

**Applied fix:** rewrote `accidents.vue` against the confirmed real shape -
bound `incident_ref`/`vessel_name`/`status`/`pollution_tons` directly (no
more speculative fallback chains), dropped the Response Time column
(field doesn't exist on this backend), simplified `vesselsLabel` logic
away (single `vessel_name`, not an array), and replaced the broken
lat/long-based map with one that resolves each incident's `port_unlocode`
against the `ports()` catalog (already fetched, same pattern as
`/maritime` and `/maritime/port-ops`) and plots one marker per port
showing incident count + most-severe incident.

### 2.3 `useVehicleInspections().summary()` / `usePublicTransport().complianceSummary()` — untyped (`any`), actual shape now confirmed — **FIXED**

Both composables intentionally return `any`/`unknown` per their own
comments ("shape is server-defined, not part of the documented schema").
Confirmed live shapes, worth typing now that they're known:

```ts
// GET /api/v1/fleet/vehicle-inspections/summary/
interface VehicleInspectionSummary {
  total: number
  by_result: Record<'pass' | 'fail' | 'conditional_pass', number>
  pass_rate_pct: number
  days: number
}

// GET /api/v1/public-transport/compliance/summary/
type ComplianceSummary = Record<'fare' | 'licensing' | 'capacity', {
  compliant: number; flagged: number; violation: number; total: number
}>
```

**Applied fix:** added `VehicleInspectionSummary` to `useVehicleInspections.ts`
and `ComplianceSummary`/`ComplianceCheckType` to `usePublicTransport.ts` with
exactly the confirmed field names above, and pointed both composable
methods' return types at them instead of `any`/loosely-typed `Record`.
No page currently reads either endpoint, so this was a pure type fix with
no template changes needed.

---

## 3. Backend returns real fields the frontend type doesn't declare — **FIXED**

Not bugs — these were opportunities to surface data the backend already
computes but the UI couldn't see because the TS interface didn't know the
field existed (`Paged<T>`/`api<T>()` silently drop anything not on `T`
from the type system's perspective, even though the raw JSON has it). All
rows below have been added to their respective interfaces.

| Composable / type | Endpoint | Fields added | Status |
|---|---|---|---|
| `Vehicle` (`useFleet.ts`) | `/fleet/vehicles/` | `engine_capacity_cc`, `body_type`, `county`, `logbook_status`, `owner_name`, `owner_id_number`, `owner_phone` | Added to the type with a doc-comment flagging that owner fields are blank (`""`) for every sampled vehicle — either unseeded or intentionally redacted like `Driver.national_id`. **Still needs backend confirmation** on which, and a `revealOwnerId()`-style endpoint if it's redaction (mirroring `useDriverLicensing().revealDriverId()`) — no UI change made pending that answer. |
| `TripPlayback` (`useFleet.ts`) | `/fleet/trip-playbacks/{id}` (list) | `path?: [number, number][]`, `stops_served?: string[]` | Added to the type **and wired up**: `fleet/trip-playbacks.vue`'s `replayTrip()` now uses `trip.path` immediately (swapped from GeoJSON `[lon,lat]` to the page's `[lat,lon]` convention) instead of always firing the separate `/path/` request, falling back to that endpoint only if a trip has no inline path. `stops_served` now shows in the trip stats panel. |
| `RoadSegment` (`useInfrastructure.ts`) | `/infrastructure/road-segments/` | `county` | Added to the type. **UI filter not added** — the Infrastructure page's segment table already has non-trivial agency-sampling/pagination logic for 588k+ rows; wiring a county filter through that is a bigger change than a type fix and was left for a follow-up. |
| `RailLine` / `RailStation` (`useRailway.ts`) | `/railway/lines/`, `/railway/stations/` | `latitude`, `longitude` | Added to both types. |
| `RailTicket` (`useRailway.ts`) | `/railway/tickets/` | `schedule_train_number`, `origin_code`, `destination_code`, `operator_agency_code` | Added to the type. |
| `RootBanner` (`useSystem.ts` / `types/uapts.ts`) | `/api/` | `policy_docs_url` | Added. |
| `WeatherObservation` (`useTraffic.ts`) | `/traffic/weather/` | `created_at`, `updated_at` | Added. |
| `PublicTransport` types (`Route`, `Schedule`, `Sacco`, `BRTStop`, `FareCollection`, `PTFeed`, `PSVLicense`, plus the inline `compliance()`/`demand()` row shapes) | various `/public-transport/*` | `created_at`/`updated_at` (most), `Sacco.agency`/`agency_code`, `ServiceQualityScore`/`OperatorMetric`.`calculated_at`, `PassengerFeedback.contact_hash` | Added to all listed types. |
| `GeoJSONFeatureCollection` (`useGis.ts`) | `/gis/kenya/boundary/` | `properties?: Record<string, any>` | Named explicitly (was previously only reachable via the interface's `[k: string]: any` catch-all). |
| `Notification` (`useNotifications.ts`) | `/notifications/` | `user_id_any?: string[]` | Added. |

---

## 4. Real, working backend endpoints with **zero** frontend integration

Found by diffing the full OpenAPI path list against every URL referenced
in `app/composables/api/*.ts`. All of the following were spot-checked live
and return real, populated (non-empty) data — these are not stubs, they're
simply not wired up to any composable or page yet.

| Endpoint(s) | What it is | Suggested fix |
|---|---|---|
| `GET /api/v1/public-transport/terminals/`, `/terminals/{id}/`, `/terminals/accessibility-gaps/` | Bus/matatu terminal registry (12 rows: bay count, vehicle/passenger capacity, routes served, accessibility) | Add a `terminals()` + `accessibilityGaps()` pair to `usePublicTransport.ts` and a "Terminals" section/page — currently PT only tracks routes and BRT stops, not terminal facilities. |
| `GET /api/v1/railway/rolling-stock/`, `/rolling-stock/{id}/` | Individual rail cars/coaches/locomotives within a `Train` consist (171 rows: unit type, manufacturer, capacity, position-in-consist, status) | Add `rollingStock()` to `useRailway.ts` or `useRailInfrastructure.ts`; useful as a drill-down from the `trains()` catalog (a `Train` is a consist of several `rolling-stock` units). |
| `GET /api/v1/infrastructure/performance-assessments/`, `/performance-assessments/latest/`, `/performance-assessments/export/`, `/{id}/` | Road-agency performance audits (RMAI-style: technical/financial/overall score, % good/fair condition, workplan budget vs km maintained — 295 rows) | Add to `useInfrastructure.ts` and surface on the Infrastructure page — this is exactly the kind of KPI-scorecard data an "Infrastructure Performance" section would want, and it already exists server-side. |
| `GET /api/v1/training/analytics/enrollments/`, `/analytics/attendance/` | Pre-aggregated per-cohort enrollment funnel (registered→confirmed→attending→completed/failed/withdrawn) and attendance rollups | Add to `useTraining.ts` — saves the frontend from re-deriving these numbers client-side from raw `enrollments()`/`attendance()` rows. |
| `GET /api/v1/audit/users/{user_id}/logs/` | Per-user audit trail (distinct from `/audit/my-logs/`, which is "logs by the *current* user") | Add a `userLogs(userId)` method to `useAudit.ts` — needed for the User Management page's "view this user's activity" drill-down, which today has no way to see another user's audit history. |
| `GET /api/v1/aviation-maritime/aviation/flight-movements/`, `/flight-movements/{id}/` | Fine-grained flight event timeline (check-in-open, boarding, pushback, etc. — 490 rows, distinct from the coarser `flights()` status field) | Add `flightMovements()` to `useAviationMaritime.ts`; would let the aviation flight-detail view show a real event timeline instead of just current `status`. |
| `GET /api/v1/geojson/brt-stops/`, `/congestion/`, `/od-flow/`, `/segments/`, `/stations/`, `/weather/`, `/all/` | A full per-module GeoJSON surface parallel to the two already used (`/geojson/rail-lines/`, `/geojson/rail-stations/`) | `useGis.ts` only wraps `/gis/kenya/boundary/`, `/gis/roads/`, `/gis/routes/`, `/gis/map/` — none of these `/geojson/*` module-specific endpoints. `/geojson/all/` in particular is a single bundle (segments + stations + presumably others) that could replace several of the ad-hoc per-page `mapData()` implementations (`useTraffic().mapData()`, `usePublicTransport().mapData()`, `useRailway().mapData()` each hand-roll their own marker/line construction from catalog endpoints today). Worth evaluating whether standardizing on `/geojson/*` reduces duplicate marker-building code across those three composables. |
| `POST /api/v1/auth/register/`, `/register/verify-email/`, `/api/v1/auth/password/reset/`, `/reset/confirm/`, `/change/` | Self-service account registration + password reset/change | `app/stores/auth.ts` only implements login/logout/refresh — there is no "forgot password" or self-registration flow in the frontend at all. If self-service accounts are in scope (vs. admin-provisioned only), these need a composable + `/login`, `/register`, `/reset-password` pages. |

---

## 5. Confirmed genuinely "ahead of API" (expected — not a bug)

These composables' own file-header comments already say the backend
doesn't implement them yet. Cross-verified two ways: (a) every one returns
404 live, and (b) **none of their paths appear anywhere in the OpenAPI
schema at all** — so this isn't a routing/permission issue, the backend
truly has no matching app/ViewSet yet. No action needed until the backend
ships these; the pages built against them already degrade to an honest
"not yet integrated" empty state (`Promise.allSettled` + banner).

| Composable | Endpoints (24 total) |
|---|---|
| `useAviationInfrastructure.ts` | `.../aviation/infrastructure/summary\|runways\|navaids\|facilities\|capital-works/` |
| `useMaritimeInfrastructure.ts` | `.../maritime/infrastructure/summary\|channels\|navaids\|dry-docks\|icds\|capital-works/` |
| `useMaritimeServices.ts` | `.../maritime/services/summary\|cargo-handling\|pilotage\|licences/` |
| `useMaritimeCargo.ts` | `.../maritime/cargo/summary\|by-type\|pipeline\|handling-stage-kpis\|onward-transport/` |
| `useMaritimeWaterways.ts` | `.../maritime/waterways/` (list + `/summary/` + `/infrastructure/`) |
| `useMaritimeGreenTransport.ts` | `.../maritime/green-transport/summary\|vessel-emissions\|mode-stats\|ev-fleet\|reefer-energy/` |
| `useMaritimePerformance.ts` | `.../maritime/performance/summary\|kpis\|ranking/` |
| `useRailSafety.ts` | `/railway/safety/corrective-actions/`, `/railway/safety/risk-indicators/` |

---

## 6. Returns 200 but the dataset is currently empty in this environment

Not bugs — just no seeded rows to verify item-level field shape against yet.
Re-run the harness (see below) once these are seeded, or point
`UAPTS_BASE` at an environment that has data, to confirm field names for
real:

`Traffic.counts`, `Traffic.congestionEvents` (+ `activeCongestion`),
`Traffic.routeOptimizations`, `Traffic.forecasts`, `Traffic.alerts`,
`Fleet.liveVehicles`, `Fleet.recentBreaches`,
`PublicTransport.demandForecasts`, `Safety.accidents`,
`Safety.fatalityTrend`, `Safety.accidentsByCause`, `Safety.blackspots` (+
`topBlackspots`), `Safety.interventions`,
`Infrastructure.delayedProjects`, `Infrastructure.forecasts` (+
`atRiskForecasts`), `Infrastructure.signalFaults`,
`Infrastructure.ruralRoadStatus`, `Railway.liveOperations`,
`Training.revenue` (+ `revenueSummary`).

---

## 7. Minor / low-priority notes

- **`Reports.catalog`**: none of the 9 seeded templates populate the
  optional `params` field. If the Report Center page has per-template
  parameter-entry UI gated on this field, it's currently unreachable — not
  a bug (field is optional), but worth confirming intentional.
- **`Notifications.rules.list`**: sampled rule has no `condition` — valid
  per the optional type (a rule with no condition just always fires), not
  a defect.
- **`Gis.kenyaBoundary`**: optional `count`/`filters` fields absent — fine,
  they're declared optional.

---

## Re-running this audit

```bash
UAPTS_EMAIL=you@example.com UAPTS_PASSWORD='***' \
UAPTS_BASE=http://192.168.0.110:8000 \
  node scripts/test-endpoints.mjs > report.json
```

Prints one status line per endpoint to stderr as it runs, then a full JSON
array (status, timing, missing/extra fields, truncated sample) to stdout.
`UAPTS_BASE` defaults to `http://192.168.0.110:8000`; point it at
`https://uapts.eu.cc` or any other environment to compare. Requires Node
18+ (uses native `fetch`, no dependencies).
