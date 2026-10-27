# Dashboard Manager Widgets: Audit and Way Forward

> **Status (2026-10-12).** Phases 0 to 6 are shipped in the frontend (sections 9 to 13 log what each phase delivered
> and the backend items B1 to B26 it needs). Sections 1 to 8 are the original audit and plan, kept for the reasoning;
> where they describe "today" (for example "10 widgets" or "6 of ~16 modules") they describe the state **before** the
> work. For how the system works now, read [DASHBOARD_MANAGER.md](DASHBOARD_MANAGER.md). Phases 6b (agency
> primitives), 6c (agency templates) and 7 (polish) have no shipped-log section here, so treat them as open until
> verified.

> Scope: `app/components/dashboard/**`, `app/utils/widgetRegistry.ts`, `app/utils/metricRegistry.ts`,
> `app/composables/useDomainData.ts`, `app/composables/useDashboardFilters.ts`, `app/types/dashboard.ts`.
> Lenses: **impeccable** (Operate mode, DESIGN.md "National Instrument Panel" rules, honest-data principle)
> and **Emil Kowalski design engineering** (component API, defaults, motion, invisible details).
> Report only. No source was changed.

---

## 1. The short version

The Dashboard Manager *shell* is good: a 12-column layout engine with compaction, live widgets on the edit
canvas, Tableau-style filters and actions, server-side permission stripping, URL-synced state, a per-widget
error boundary, and an honest "Not filtered by …" note. Keep all of it.

The **widgets** are the bottleneck. They are built around the domain each one reads (a *fatality* bar chart,
a *safety* trend, an *NTSA* card) when they should be built around the **shape of the data** (a number, a time
series, a breakdown, a ranked table, a set of points). That one choice explains most of what you're seeing:

| Symptom | Root cause |
| --- | --- |
| Only 6 of ~16 modules can appear on a dashboard | Data access is a closed `switch` over 6 hand-picked `*/summary/` endpoints |
| Each new chart needs a new `.vue` file | Visuals are bound to one payload field, e.g. `fatality_trend_30d` |
| The inspector grows an `v-if` branch per widget | Config is `Record<string, unknown>` with no schema |
| Loading, error and refresh logic is copied 5 times | No shared data/state primitive below `useDomainData` |
| Widgets don't adapt to their cell beyond height | Only `bodyHeight` is passed. No width or size class reaches them |

**Recommendation:** move to a three-layer model, **Data Source → Binding → Visual**, with a small set of
generic, size-adaptive visual primitives and a schema-driven inspector. Today's 10 widgets become *presets*
(saved bindings) on top of it, so no existing dashboard breaks. Details and a phased plan are in §5 and §6.

---

## 2. Inventory: what exists today

| Widget type | Kind | Reads | Honours filters | Emits | Notes |
| --- | --- | --- | --- | --- | --- |
| `kpi` | kpi | 1 of 19 registry metrics | `agency` (infra metrics only) | none | Good: wraps the shared `KpiCard` |
| `kpi-row` | kpi-row | N registry metrics | union of the above | none | Container-query reflow 6→2→1 cols |
| `fatality-bars` | bars | `safety.fatality_trend_30d` | none | `date_range` | Hard-wired to one field |
| `incident-trend` | trend | `safety.fatality_trend_30d` (+ `incident_trend_30d`, which the API doesn't return) | none | none | Catalog promises 2 series and draws 1 |
| `risk-map` | map | hotspots + top black spots + GIS roads | none | `road` (`county` declared, never emitted) | Centre and zoom hard-coded |
| `alerts` | alerts | 5 domain summaries + integrations list | none | none | Thresholds duplicated from the Command Centre |
| `feed-health` | feed-health | integrations list | `agency` | `agency` | |
| `agency-card` | agency-card | 1–2 domain summaries | none | `agency` | 7 hand-written specs. The other 6 agencies fall back to "Awaiting feed" |
| `text` | text | none | none | none | Safe: no `v-html` |
| `national-command-centre` | embed | everything | none | none | Migration shim |

**Data reach:** 19 metrics across 6 domains (`safety, fleet, rail, aviation, maritime, infra`), out of
**30 API composables with ~300 methods** under `app/composables/api/`.

---

## 3. Coverage gap: data in the system that no widget can show

The table lists data that the API **already returns**. Most of it is in summaries the app fetches today, and
the widgets throw it away.

| Module | Already returned, unused by any widget | Natural visual |
| --- | --- | --- |
| **M02 Traffic** (`useTraffic().summary`) | `volume_24h` (hourly volume + speed), `class_breakdown`, `congestion_distribution`, `speed_compliance`, `forecast_next_hour`, station KPIs | Time series, breakdown, stat |
| **M04 Public transport** (`usePublicTransport().summary`) | `revenue_24h`, `payment_channels`, `on_time_pct`, `top_routes`, SACCO `leaderboard`, `feedback_by_category`, `expiring_licences`, `demand_forecast_24h` (with bounds) | Time series + band, breakdown, ranked table, deadline list |
| **M05 Safety** (unused fields) | `incidents_by_severity`, `incidents_by_type`, `top_predictive_hotspots`, `recent_violations_24h` | Breakdown, points |
| **M03 Fleet** (unused fields) | `vehicles_by_type`, `vehicles_by_status`, `behaviour_events_24h`, `top_breaches_24h`, governor `online_pct` / `fault_rate_pct`, `trips_7d`, `distance_7d_km` | Breakdown, ranked table, stat |
| **M08 Rail** (unused fields) | `live_operations`, `top_routes` (bookings + revenue), `freight_30d` detail, `incidents_90d` detail | Live list, ranked table |
| **M07a Aviation** (unused fields) | `by_status`, delayed/cancelled counts, `cargo_kg_total`, airports/airlines/aircraft counts | Breakdown, stat |
| **M07b Maritime** | per-port `ports[]` rows, inspections/detentions; cargo, waterways, green transport, performance composables (built ahead of backend) | Table, honest "not yet integrated" state |
| **M06 Infrastructure** (unused fields) | `streetlights`, `construction.portfolio_by_corridor`, `network.by_agency`, `bridges.by_condition_class`, PCI | Breakdown, ranked table, per-agency stats (this also unlocks KURA and KeRRA cards) |
| **M14 Training** | enrolment summary, revenue summary | Stat, time series |
| **M16 ML / predictive** | model registry / predictions | Status list, points |
| **M12 Integration Hub** | per-feed freshness and silent-failure detection (only status counts are used) | Status list with freshness |
| **M15 Query builder** (`useQuery().execute`) | **Any whitelisted dataset with filters, sort and field selection**: incidents, vehicles, congestion, blackspots, traffic counts, GPS tracks | Generic table, breakdown, series. *This is the escape hatch for "all the data in the system".* |

The last row matters most. `/query/execute/` is already a server-validated, permission-aware, filterable
row source. A widget that can bind to it can show almost any operational table without a new endpoint.

---

## 3b. Agency KPI coverage (against the 12-agency KPI brief)

The brief sets out the KPIs each agency's dashboard is expected to carry. The matrix below compares them to
what the **frontend API layer** (`app/composables/api/*.ts`) exposes today, and to what the current widgets
can draw.

Legend: **W** = drawable by a current widget · **A** = API type/method exists, no widget ·
**—** = nothing in the API layer (so it needs a backend endpoint, a scheduled file or a manual template).
"A" came from a keyword pass over the API types and still needs confirming field by field.

| Agency | Expected KPI group | Today | Primitive needed |
| --- | --- | --- | --- |
| **KeNHA** | IRI, bridge health | **W** (`infra.good_condition`, `infra.critical_bridges`) | Stat, Breakdown |
| | AADT per corridor | — | Series / Breakdown by corridor |
| | Black spots, accidents **by chainage**, construction-zone incidents | A (black spots, chainage in infra/rail infra) | **Chainage strip** (new) |
| | Axle-load / weighbridge overload compliance | A (`useFleet` weighbridge stations/events) | Stat + Progress, Table |
| | Boundary markers, permit turnaround, RAP progress, % PAPs compensated | — | **Milestone tracker** (new), Progress |
| **KURA** | NMT km built, signal timing efficiency | — | Progress, Stat |
| | Street lighting functional %, pavement condition (G/F/P) across 86 urban areas | A (`infra.streetlights`, condition distribution, `by_agency`) | Stat, Breakdown, Table by town |
| | APRP absorption, paid certificates vs pending bills, physical completion | partial A (`budget.utilization_pct`, construction `by_agency`) | **Budget flow** (new), Progress |
| **KeRRA** | Low-volume sealed km, rural bridges/culverts | partial A (bridges) | Progress, Breakdown |
| | RMLF utilisation, ARMWP progress | — | Budget flow, Progress |
| **SDR Roads** | National network G/F/P of 165,000 km | **W** (partial: % good only) | Breakdown (full G/F/P) |
| | Road Fund allocation → disbursement → absorption | partial A | **Budget flow** |
| | Unified fatality trend, blackspot intervention completion | **W** (fatality trend, intervention effectiveness) | Series, Progress |
| **SDR MTD** | Fleet & plant serviceability % | A (`useFleet` government fleet, `serviceability`) | Stat, Breakdown |
| | Lease program: run-hours, contracts, lease letters, km worked | A (`/equipment-leases/`) | Stat, Series, Table |
| | Rental revenue vs O&M cost, downtime, parts lag | — | Series (2-measure), Stat |
| **NTSA** | Daily fatalities **by road-user category**, causes | partial **W** (fatalities only; `incidents_by_type` unused) | Series + Breakdown |
| | Registration and smart-DL volumes | A (`useDriverLicensing`, fleet registry) | Series, Stat |
| | Inspection throughput, PSV compliance, IVMS speed/route violations | A (`useVehicleInspections`, PT compliance, fleet behaviour) | Stat, Breakdown, StatusList |
| **NaMATA** | Boarding/alighting, occupancy, terminal wait times | partial A (`usePublicTransport`) | Series, Heatmap (hour × stop) |
| | Route 111 / Ngong pilot: dispatch adherence, SACCO compliance, revenue | A (PT dispatch, compliance, `revenue_24h`) | Progress, Table, Series |
| | BRT corridor milestones | A? (`brt` page exists) | **Milestone tracker** |
| **KPA** | Vessel turnaround, berth occupancy, AIS milestones (ETA/ATA/ETB/ATB) | A (`useMaritimePerformance`, which is ahead of backend) | Stat + target band, **Milestone tracker** (per vessel) |
| | Throughput, dwell, crane moves/hr, truck turnaround | partial **W** (TEU, dwell) | Stat, Series |
| | SGR evacuation: nominated containers, SGR-bound dwell, daily volume | — (no container-number type found) | Series, Stat |
| | Reefer temperature / power exceptions | A (`useMaritimeCargo` / performance) | StatusList |
| **KRC** | Freight runs, train length, gross/net tonnes, wagon deployment | partial **W** (tonnage); A (wagons) | Stat, Series |
| | Passenger run times, volumes, coach occupancy, revenue **by class** | partial **W** (ridership); A (`TicketClass`) | Breakdown by class, Series |
| | KPA manifest sync, rail-nominated queue | — | Table (joined on container no.) |
| **KMA** | Registered vessels (IMO), PSC pass/fail | partial A (inspections/detentions in `MaritimeOps.kpis`) | Stat, Progress |
| | SAR alerts, casualties, response times | — (only `incidents_30d`) | StatusList, Series |
| | Agent licensing turnaround | A? (`useMaritimeServices`) | Stat vs SLA |
| **NCTTCA** | End-to-end transit time split into port dwell / road / border | — | **Segmented duration bar** (new) |
| | OSBP clearance time, queue length, capacity vs traffic | — | Progress (capacity), Series, Table per OSBP |
| | Weekly trucks per checkpoint, freight rate per tonne-km | — | Series, Table |
| **LAPSSET** | Milestones, delays, % complete (Lamu Port, highway, pipeline) | — | **Milestone tracker** |
| | Spend vs plan per department | — | **Budget flow** / Progress |
| | ESMP indicators, audit frequency | — | StatusList, Table |

**What this shows:**

1. **About a third of the brief is drawable today.** All of it sits in roads, safety, KPA and KRC headline numbers.
2. **Another third is already in the API layer** (weighbridge, MTD plant and leases, inspections, licensing, PT,
   maritime performance, rail classes). It's blocked only by the widget architecture. That's the payoff for
   phases 1–3.
3. **The final third has no endpoint** (AADT, RMLF, RAP/PAPs, NCTTCA transit, LAPSSET, SAR, SGR evacuation).
   These are mostly the manual-template and scheduled-file agencies, so the widgets must treat
   *integration tier* as a first-class state (below).

### Four primitives the brief adds to §5.3

| Primitive | Used by | Frame shape | Notes |
| --- | --- | --- | --- |
| **Milestone tracker** | LAPSSET, NaMATA BRT, KeNHA RAP, KPA AIS (ETA→ATA→ETB→ATB) | rows of `{ item, milestone, planned, actual, status }` | Planned vs actual on one time axis. Delay is the gap, coloured by threshold. At `xs`: "4 of 9 milestones · 2 late" |
| **Segmented duration bar** | NCTTCA transit (port dwell / road / border), KPA truck turnaround | category × ordered stages × duration | One stacked horizontal bar per destination. Hover isolates a stage across all bars |
| **Budget flow** | SDR Road Fund, KURA APRP, KeRRA RMLF, LAPSSET spend | ordered stages `allocated → disbursed → certified → paid`, plus `pending` | Reuse `ReconciliationFunnel.vue`'s pattern. KES via the unit formatter, B/M/K |
| **Chainage strip** | KeNHA accidents by chainage, construction zones, rail infra | rows `{ road_id, from_km, to_km, measure }` | A linear-referenced strip per road, which needs no map. Click a segment to emit `road` + `chainage` |

### Integration tier is a widget state, not a footnote

The brief describes three tiers: **live API** (NTSA, KPA), **scheduled file transfer**, and **manual template**
(MTD, LAPSSET, and several others). `useWidgetData()` (§5.4) should carry the tier from the `DataSource` and
`<WidgetState>` should render it:

| Tier | Footer | Stale rule | Empty copy |
| --- | --- | --- | --- |
| Live | `KPA KWATOS · LIVE · 14:02 EAT` + pulse dot | stale after 2× refresh interval | "Data unavailable — retry to refresh" |
| Scheduled file | `KeRRA · BATCH · file of 30 Sep` | stale after the expected cadence (daily/weekly) | "Awaiting next scheduled file (due {date})" |
| Manual template | `LAPSSET · MANUAL · submitted 12 Sep by …` | stale after the reporting period | "No submission for {period} yet", plus a link to the upload page for operators of that agency |

This extends `sourceMode: 'live' | 'batch'` to `'live' | 'file' | 'manual'` plus an `expectedCadence`. The
Integration Hub already tracks per-feed health and uploads (`IngestStatusPill`, `UploadTimeline`), so the data
is there.

### Join keys become cross-filter fields

The brief's cross-cutting identifiers are exactly what dashboard **actions** need in order to link widgets
across agencies. Extend `FilterField` (`types/dashboard.ts:131`) beyond geography:

| Field | Joins | Example action |
| --- | --- | --- |
| `road_id` (+ `chainage`) | National Roads Register: KeNHA ↔ KURA ↔ KeRRA ↔ NTSA crash data | Click a black spot → filter IRI, AADT and works on that road section |
| `vehicle_reg` | NTSA registry ↔ fleet GPS ↔ inspections ↔ weighbridge | Click an overload event → that vehicle's inspection history |
| `container_no` | KPA ↔ KRC SGR manifest ↔ NCTTCA transit | Click a delayed container → its rail queue and corridor transit |
| `imo` | KMA registry ↔ KPA vessel ops | Click a vessel → PSC record and turnaround |
| `corridor` / `osbp` | NCTTCA ↔ KeNHA corridors ↔ LAPSSET | Click Malaba → border clearance + corridor road condition |

`query.*` sources already join on shared keys (`joinable_on: 'road_segment' | 'vehicle'`), so the backend
concept exists. The widget side only needs `emits` to name these fields and the filter engine to pass them
through. This also answers the brief's question about a commuter moving from a KURA street onto a KeNHA
highway: there's no way to filter both without a shared `road_id`. **That's a data-model dependency to
raise with the backend, not something the widgets can fake.**

### Agency templates

Once the primitives exist, each of the 12 agencies gets a **starter dashboard template** in
`dashboardTemplates.ts` built from presets that follow the KPI groups above. KPIs with no endpoint are placed as
widgets in the honest "not yet integrated" or "awaiting submission" state, never as sample numbers. Coverage
then becomes visible: an agency's dashboard lights up tile by tile as its feeds onboard. That is Product
Principle 5 made literal.

---

## 4. Findings

### 4.1 Architecture (blocks reuse)

1. **Closed data layer.** `useDomainData.ts` `fetcher()` is a `switch` over six domains, and `DomainPayloads`
   is a closed type. Adding Traffic means editing the type, the switch, `DOMAIN_FILTERS`, `DOMAIN_LABELS` and
   `DOMAIN_PERMISSIONS` in three files.
2. **Widgets bypass the cache.** `AlertsWidget` and `FeedHealthWidget` both call `useIntegrations().list()`
   directly, so a dashboard with both makes two identical requests on every refresh tick. `RiskMapWidget` fetches
   GIS roads per instance with no cache.
3. **Load logic copied 5×.** `AgencyCardWidget.vue:126-137`, `AlertsWidget.vue:47-67`,
   `FeedHealthWidget.vue:44-58`, `RiskMapWidget.vue:50-64` and `useDomainData` each re-implement
   loading / failed / tick-watch / stale-response guarding, with small differences. Only `useDomainData` guards
   against out-of-order responses (`seq`). The other four can show an older response after a newer one.
4. **The inspector is not data-driven.** `WidgetInspector.vue:22-76` is a `v-if` chain on `def.type`. The
   registry header says "Adding a widget = one entry here + one component. No dashboard code changes," and that
   is not true while this chain exists.
5. **`SELF_FRAMED` is defined twice**, in `WidgetFrame.vue:46` and `WidgetInspector.vue:145`. Framing should
   be a property on `WidgetDefinition`.
6. **Untyped config.** `config: Record<string, unknown>` everywhere, so you get casts like
   `config.label as string` and `Number(props.config.hotspotLimit ?? 30)`. A stored dashboard with a bad config
   fails at render time, not at save time.
7. **Status thresholds live in three places.** `metricRegistry` resolvers, `AlertsWidget.vue:69-101` and
   `AgencyCardWidget` specs each restate "active > 10 is critical" and similar rules. They will drift.

### 4.2 Adaptability (widgets don't respond to their cell)

8. Only **height** reaches widgets (`WidgetFrame` passes `bodyHeight`). No widget knows its width, so a 3-col
   `fatality-bars` draws 30 two-pixel bars, and a 12-col one draws 30 fat ones with no extra information.
9. There are no **size classes**. Emil's rule is that good defaults beat options. A widget should pick its own
   best form for its cell (for example, a series at `xs` becomes value + sparkline, and at `l` becomes an axis
   chart with a crosshair) instead of asking the author to tune it.
10. `RiskMapWidget.vue:8` hard-codes `center [-0.5, 37.5]` and `zoom 6`. It doesn't fit to its markers, so a
    county filter still shows the whole country.
11. `kpi` declares `filterFields: ALL_GEO` (`widgetRegistry.ts:46`), but `widgetFilterFields()` overrides it
    with the metric's real fields. The palette and the backend allow-list read the misleading static value.

### 4.3 Honest data (PRODUCT.md principle 2)

12. **Status comes from position, not data**, in `AgencyCardWidget.vue`: "Fatalities (30d)" is always `crit`
    (line 50), "Maintenance backlog" is always `crit` (lines 66, 75), and every KRC/KAA throughput row is always
    `good`. DESIGN.md: *"Status reflects the metric's own state, never its position in the grid."*
13. `incident-trend` is described as "Incidents vs fatalities" with a two-series line (`widgetRegistry.ts:72`),
    but the second series doesn't exist in the API (`IncidentTrendWidget.vue:25`). The catalog over-promises.
14. **The filter bar is mostly cosmetic.** Per `metricRegistry.ts:116-118`, only `infra` honours any filter
    (`agency`). Every other widget shows "Not filtered by …", which is honest but means a county filter does
    nothing on a safety dashboard. This is a backend gap, and the widgets should make it visible *before* an
    author adds a filter (see §5.6), not only after.
15. `AGENCY_OPTIONS` offers KURA, KeRRA, NaMATA, NCTTCA, LAPSSET and SDT, but `infra.network.by_agency` and
    `construction.by_agency` already hold real per-agency figures for the road agencies. The card shows
    "Awaiting feed" while the data is in hand.
16. There is no **"not yet integrated"** state. Widgets can't tell "endpoint not shipped" (404) apart from
    "feed failed" (5xx). PRODUCT.md requires the first to render honestly and light up automatically.

### 4.4 Design system and accessibility

17. **Button semantics lost:** `FatalityBarsWidget.vue:12` puts `role="listitem"` on a `<button>`, which
    overrides its button role for assistive tech. The 30 bars are also 30 tab stops with no arrow-key roving.
18. **Colour-only encoding:** fatality bands (red/amber/green) carry meaning by hue alone, and no chart has a
    tabular alternative. WCAG 2.1 AA is a binding target.
19. `WidgetFrame.vue:92` draws a **2px** accent rule. The system's status rule is **1px**
    (`.kpi-card::before`, Hairline Rule).
20. `RiskMapWidget.vue:150` uses `color: #fff`, a hard-coded hex. Use a token (`--primary-fg`/on-fill).
21. `AgencyCardWidget.vue:165-172` re-declares a local `.badge` instead of using `BadgePill` / the
    global `.badge` classes, so the two drift.
22. `fmtNum()` (`metricRegistry.ts:72`) formats with `toLocaleString(undefined, …)`, which is the *browser*
    locale. PRODUCT.md requires `en-KE`. There's also no hook for Kiswahili labels.
23. **Mono-figure rule partially broken:** agency-card values sit in Inter inside `.badge`. Fatality bar
    tooltips and legend counts aren't in the mono face either.

### 4.5 Motion and feel (Emil lens)

| Before | After | Why |
| --- | --- | --- |
| Canvas widgets snap to new positions when `settle()` pushes them | FLIP the *other* widgets: `transform` over 180ms `cubic-bezier(0.23,1,0.32,1)`. The dragged one follows the pointer 1:1 | Spatial consistency: the author should see where things went. Animate only `transform` |
| Keyboard arrow-move animates the same as a drag would | No transition on keyboard moves | Keyboard actions repeat dozens of times. Animation makes them feel laggy |
| `.bar:hover { opacity:.75 }` and `a.alert:hover` ungated (`FatalityBarsWidget.vue:58`, `AlertsWidget.vue:117`) | Wrap in `@media (hover:hover) and (pointer:fine)` | Touch devices fire hover on tap, so bars stay "stuck" dimmed |
| Refresh tick: `AgencyCard`/`Alerts`/`FeedHealth` flip `loading=true` on every 120s refresh | Keep stale data on screen, show a quiet "refreshing" state in the frame header (mono timestamp → spinner dot) | An instrument panel shouldn't blink every two minutes. This is perceived performance |
| Value changes on refresh are instant | Keep them instant. **No count-up animations** | An operations dashboard is read hundreds of times a day. Number tweens add delay and look like data is changing when it isn't |
| First mount: all widgets pop at once | 30–40ms stagger on *first* render only (KPI ribbon already does 36ms), `opacity` + `translateY(4px)`, never on refresh | Gives order to a cold load and costs nothing later |
| Picked bar shown with `box-shadow: 0 0 0 2px` | 1px `outline` in `--fg-1` + dim the rest to `.35` | Flat-Body rule. Selection should read as a state, not a lift |
| Emit/selection change re-filters targets instantly with a loading flash | Crossfade target widget body (`opacity` 150ms ease) between old and new data. Never blank it | Prevents the jarring "everything goes empty" moment when a filter action fires |

---

## 5. The way forward: advanced reusable widgets

### 5.1 Target architecture

```
┌──────────────────────────────── WidgetInstance (stored JSON) ────────────────────────────────┐
│  { type: 'series', binding: {...}, options: {...}, x,y,w,h, style }                           │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
          │                         │                                   │
          ▼                         ▼                                   ▼
┌───────────────────┐   ┌──────────────────────────┐        ┌────────────────────────────┐
│ 1. DATA SOURCES   │   │ 2. BINDING / TRANSFORM   │        │ 3. VISUAL PRIMITIVES       │
│ registry: id,     │──▶│ select path, map fields, │──────▶ │ Stat · Series · Breakdown  │
│ fetch, params,    │   │ aggregate, sort, top-N,  │ Frame  │ Table · Points · StatusList│
│ honoured filters, │   │ thresholds → status      │ (std   │ Progress · Heatmap         │
│ permission, mode  │   │ → normalised Frame       │ shape) │ each with xs/s/m/l forms   │
└───────────────────┘   └──────────────────────────┘        └────────────────────────────┘
          ▲                                                           │
          │                  useWidgetData() state machine            ▼
          └──── shared cache / dedupe / tick / seq guard ──── <WidgetState> honest states
```

- **Data Source** answers *where the data comes from and what it honours*.
- **Binding** answers *which part of it, shaped how*.
- **Visual** answers *how it looks at this size*. It never knows which module the data came from.

The existing `metricRegistry` becomes a set of **Stat bindings**. `fatality-bars`, `incident-trend`,
`agency-card` and the like become **presets**: a named binding + visual + options in the palette.

### 5.2 Core types (sketch)

```ts
// utils/dataSources.ts: open registry, one entry per endpoint
export interface DataSource<P = unknown> {
  id: string                         // 'traffic.summary', 'query.incidents', 'integrations.feeds'
  module: ModuleCode                 // 'M02' …, drives palette grouping + permissions
  label: string
  source: string                     // 'NTSA IRSMS', shown in the frame footer
  sourceMode: 'live' | 'batch'
  permission: string                 // 'traffic.view'
  honours: FilterField[]             // the single source of truth for "Not filtered by …"
  status: 'live' | 'ahead-of-backend' // ahead → expect 404, render "not yet integrated"
  fetch: (params: SummaryFilterParams) => Promise<P>
  ttlMs?: number
}

// A Frame is the one shape every visual consumes.
export interface Frame {
  fields: { key: string; label: string; kind: 'time' | 'category' | 'measure' | 'geo' | 'text'; unit?: UnitKey }[]
  rows: Record<string, unknown>[]
  meta: { generatedAt?: string; truncated?: boolean; source: string; sourceMode: 'live' | 'batch' }
}

export interface Binding {
  source: string                     // DataSource id
  path?: string                      // 'class_breakdown' | 'kpis.total_volume_24h' | 'volume_24h'
  params?: Record<string, unknown>   // e.g. query dataset filters/sort/fields
  map?: Record<string, string>       // payload key → frame field ('vehicle_class' → 'category')
  aggregate?: { by: string; measure: string; fn: 'sum' | 'avg' | 'count' | 'max' }
  sort?: { field: string; dir: 'asc' | 'desc' }
  limit?: number                     // top-N, rest folded into "Other"
  thresholds?: ThresholdRef          // shared threshold id, see 5.5
}

// Widget definitions gain a config schema; the inspector renders from it.
export interface WidgetDefinition<O = Record<string, unknown>> {
  type: string
  accepts: FrameShape[]              // 'scalar' | 'series' | 'categorical' | 'rows' | 'points' | 'status'
  framed: boolean                    // replaces the duplicated SELF_FRAMED set
  options: OptionSchema<O>           // typed fields → generic inspector + save-time validation
  sizes: Record<SizeClass, { minW: number; minH: number }>
  emits?: 'dimension' | FilterField[] // generic visuals emit their own category/time dimension
  // …existing: title, description, category, defaultSize, requiredPermissions
}
```

Two things make this "all the data in the system":

1. **`query.*` sources** wrap `useQuery().execute()` per dataset. With a `Table`, `Breakdown` or `Series`
   visual, an analyst can put *any* allow-listed dataset on a dashboard with filters, server-side sort and
   field trimming, and no new frontend code.
2. **Path binding into summaries.** `traffic.summary` + `path: 'class_breakdown'` + `Breakdown` visual is a
   new widget with zero new components. Every unused field in §3 becomes reachable the same way.

### 5.3 The visual primitive set

Eight primitives cover every shape in §3. Each is a dumb `Frame → SVG/DOM` component with **size-class
variants** chosen automatically from the cell.

| Primitive | Frame shape | `xs` (≤2 cols) | `s` (3–4) | `m` (5–7) | `l` (8+) | Emits |
| --- | --- | --- | --- | --- | --- | --- |
| **Stat** | scalar (+ optional series, target) | value + status rule | + delta, period | + sparkline | + bullet vs target | none |
| **Series** | time × measures (+ band) | last value + sparkline | line, no axes | axes + crosshair | + forecast band, legend, brush | `date_range` |
| **Breakdown** | category × measure | top-1 + "of N" | proportion bar (stacked 100%) | horizontal bars, top-5 + Other | all bars + values + share % | category field |
| **Table** | rows | count only | top-3 list | paginated table | + column chooser, sort | row key field |
| **Points** | geo rows | count by tier | mini static map | interactive map, fit-to-bounds | + layer toggles, legend | `county` / `road` |
| **StatusList** | rows with severity | worst severity + count | top-3 rows | full list | grouped by domain | target route |
| **Progress** | value vs target(s) | % | bullet bar | bullet + label | small multiples | none |
| **Heatmap** | 2 categories × measure | none | none | hour × day grid | + marginal totals | cell |

Rules every primitive follows (these are the "invisible details"):

- **Mono figures, en-KE formatting** through one `formatValue(v, unit)` registry: `count`, `pct`, `kes`,
  `km`, `min`, `teu`, `kg`, `kmh`. It replaces `fmtNum`/`fmtPct`/`fmtKsh` and fixes finding 22.
- **Status never from position.** Status comes only from a threshold evaluated on the row's own value.
- **No hue-only meaning.** Every status colour pairs with a dot shape, label or position. Every chart has a
  visually hidden `<table>` with the same Frame (one shared `<FrameTable>`).
- **Keyboard:** one tab stop per primitive. Arrow keys rove marks (`aria-activedescendant`), Enter emits, and
  Esc clears the selection. This fixes finding 17 across the board.
- **Highlight dimming** is shared (`useSelectable(frame, field)`), so all primitives dim non-matching marks the
  same way when a highlight action targets them.
- **Charting engine:** keep rendering in Vue SVG templates (on-system, tokens, a11y control) and add
  **`d3-scale` + `d3-shape` + `d3-array`** (~30 KB, headless) for scales, ticks, curves and stacking. That's
  better than a full chart library here: ECharts/Chart.js would fight the hairline, flat, tokenised look and
  hide the DOM from assistive tech. Revisit a canvas engine only if a widget must draw >5k marks.

### 5.4 One data primitive: `useWidgetData()` + `<WidgetState>`

Replace the five hand-rolled loaders with one composable that every visual uses:

```ts
const { frame, state, refreshedAt, reload } = useWidgetData(binding, filterContext)
// state: 'loading' | 'refreshing' | 'ready' | 'empty' | 'partial'
//      | 'not-integrated' | 'forbidden' | 'error'
```

- Generalises the `useDomainData` cache to **any source id + params key**, so integrations, GIS roads and
  query results are all de-duplicated per refresh tick (fixes finding 2).
- Keeps the `seq` stale-response guard for every widget (finding 3).
- **`refreshing` keeps the previous frame on screen.** Only the very first load shows a skeleton.
- Maps HTTP 404 on an `ahead-of-backend` source to **`not-integrated`** and 403 to **`forbidden`**, so the copy
  is truthful (finding 16).
- `<WidgetState>` renders each state with fixed system copy: "Data unavailable — retry to refresh",
  "Not yet integrated — appears when the {source} feed is onboarded", and so on. It reuses `EmptyState` and the
  existing tone.
- `WidgetFrame` gains a quiet footer: `SOURCE · LIVE/BATCH · 14:02 EAT`, in mono, so the "which agency /
  which feed / how fresh" labelling from Product Principle 1 is on every widget, not only KPI cards.

### 5.5 Thresholds as data

```ts
// utils/thresholds.ts: one source for KPI status, alerts and agency rows
export const THRESHOLDS = {
  'safety.active':      { warn: 5,  crit: 10, better: 'lower' },
  'safety.fatal_30d':   { warn: 10, crit: 20, better: 'lower' },
  'rail.otp_pct':       { warn: 80, crit: 70, better: 'higher' },
  'aviation.otp_pct':   { warn: 85, crit: 80, better: 'higher' },
  'fleet.tamper_pct':   { warn: 5,  crit: 10, better: 'lower' },
  // …
} satisfies Record<string, Threshold>
```

`metricRegistry` resolvers, the `alerts` widget and agency rows all call `statusOf(value, 'safety.active')`.
**StatusList** becomes a generic "every threshold breach across sources the viewer can see" list, so the
`alerts` widget is just a preset of it. Later, thresholds can move server-side and be edited in the admin
without a deploy.

### 5.6 Schema-driven inspector and authoring guardrails

- The inspector renders `def.options` (select, multiselect, number, toggle, metric picker, source picker,
  field mapper). The `v-if` chain goes, and a new widget really is "one registry entry + one component"
  (finding 4).
- **Binding picker:** choose Source (grouped by module, filtered by what the *author* can see) → Path (only
  paths whose shape the visual `accepts`) → field mapping, with a **live preview of the Frame** (first 5 rows)
  under it.
- **Filter compatibility up front:** when adding a dashboard filter, the FilterDesigner lists how many
  widgets will honour it ("County: 2 of 9 widgets"). In the palette, sources show their `honours` list.
  Authors learn the gap before publishing, not after.
- **Save-time validation:** reject configs that fail the schema, and bindings to sources the dashboard's
  audience can't see (warn on mixed audiences).
- Keep `agency-card`, but make it a **composite preset**: Stat × N rows driven by an
  `AGENCY_PROFILES` map *of bindings*. `by_agency` data then lights up KURA and KeRRA (finding 15), and
  agencies with nothing bound render "No live feed connected" as today.

### 5.7 Size adaptivity mechanics

- `WidgetFrame` measures **width and height** (`useElementSize` already gives both) and provides
  `sizeClass: 'xs' | 's' | 'm' | 'l'` via `provide`, also exposed as a `data-size` attribute for CSS.
- Primitives switch form on `sizeClass` (the table in §5.3) and use `@container widget` queries for fine
  typography. The KPI ribbon already proves the container-query approach works.
- Each definition's `sizes` map sets per-class minimums, so the canvas resize handle snaps to sizes where the
  visual has a real form, instead of a single `minSize`.
- Points fit to marker bounds (with padding) whenever the filter context changes (finding 10).

---

## 6. Phased plan

Each phase ships on its own, and existing stored dashboards keep rendering throughout because old `type`s
map to presets.

| Phase | Deliverable | Unblocks | Size |
| --- | --- | --- | --- |
| **0. Fixes (no new architecture)** | Findings 12, 13, 17, 19, 20, 21, 22, hover gating, ALL_GEO correction, `SELF_FRAMED` → `def.framed` | Honest data + a11y now | S |
| **1. Data primitive** | `dataSources.ts` registry (port the 6 domains + integrations + GIS roads), `useWidgetData`, `<WidgetState>`, freshness footer. Migrate existing widgets onto it | Dedupe, stale guard, not-integrated state | M |
| **2. Thresholds + formatter** | `thresholds.ts`, `formatValue(v, unit)` with en-KE, wire into metrics/alerts/agency | One status truth | S |
| **3. Primitives v1** | `Stat`, `Series`, `Breakdown`, `Table`, plus `FrameTable` a11y fallback, `useSelectable`, d3 helpers. Size classes in `WidgetFrame` | Traffic, PT, fleet/safety breakdowns, rail routes | L |
| **4. Inspector v2** | Option schemas, binding picker with Frame preview, filter-compatibility counts, save-time validation | Authors build new widgets without code | M |
| **5. Query sources** | `query.<dataset>` sources over `/query/execute/` + joins | "Any dataset on a dashboard" | M |
| **6. Primitives v2** | `Points` (fit-bounds, layers), `StatusList` (alerts as preset), `Progress`, `Heatmap` | Maps beyond safety, generic alerts | M |
| **6b. Agency primitives** | Milestone tracker, Segmented duration bar, Budget flow, Chainage strip; tier-aware states (`live/file/manual`); join-key filter fields (`road_id`, `vehicle_reg`, `container_no`, `imo`, `corridor`) | The 12-agency KPI brief (§3b) | L |
| **6c. Agency templates** | One starter template per agency, honest placeholders for KPIs without endpoints | Per-agency dashboards that light up as feeds onboard | M |
| **7. Polish** | Canvas FLIP settle, first-mount stagger, refresh crossfade, reduced-motion pass | Feel | S |

**Testing:** the project has no component tests yet. Each primitive should ship with a Vitest +
`@vue/test-utils` spec covering every `state` and every size class against fixture Frames. Bindings get pure
unit tests (payload → Frame), which is where most correctness risk lives.

---

## 7. What not to do

- **Don't adopt a heavy chart library** to "get more chart types". It breaks the hairline, flat, tokenised
  instrument-panel look and the a11y story. Headless d3 math with Vue rendering keeps both.
- **Don't add more domain-specific widgets** (`traffic-volume-bars`, `pt-revenue-line`, …). Each one is the
  current problem multiplied. Add presets on primitives instead.
- **Don't fabricate or sample data** in previews or palette thumbnails. Previews use the live Frame or an
  honest empty state.
- **Don't animate numbers** on refresh, and don't animate keyboard-driven canvas moves.
- **Don't let the filter bar imply coverage it doesn't have.** Show honour counts while authoring and keep
  the "Not filtered by …" chip while viewing.

---

## 8. Decisions needed from you

1. **Charting dependency.** OK to add `d3-scale`, `d3-shape` and `d3-array` (headless, ~30 KB), or keep
   everything hand-rolled?
2. **Query-builder sources on dashboards.** Should analyst-built bindings to `/query/execute/` be publishable
   to `operator` and `public` audiences, or limited to analyst+ dashboards?
3. **Thresholds ownership.** Keep them in frontend code for now (phase 2), or plan a backend
   `thresholds` endpoint so admins can edit them?
4. **Backend filter support.** Most domain summaries ignore every filter. Should we raise backend tickets for
   `county` / `date_range` / `agency` on the `/safety`, `/fleet` and `/railway` summaries alongside phase 3?
5. **Shared road ID.** KeNHA, KURA and KeRRA need a common `road_id` (National Roads Register) plus chainage
   before cross-agency road filtering can work. Can that be raised as a backend data-model item now, so it
   doesn't block phase 6b?
6. **Manual-template agencies.** For MTD, LAPSSET and the other manual-template agencies, should a widget link
   operators straight to their template upload when a submission is overdue?

---

## 9. Backend items logged during implementation (phases 0–3, frontend only)

These were found while building the frontend. None is implemented; the
frontend degrades honestly until they land.

| # | Item | Why it matters | Frontend today |
| --- | --- | --- | --- |
| B1 | `catalog.py` must allow the generic widget types `stat`, `series`, `breakdown`, `table` | The server allow-lists and strips widgets by type; unknown types may be dropped or rejected on save | Types render in the editor and viewer; publishing depends on the backend accepting them |
| B2 | Generic widgets' permission = their binding's source permission (`config.binding.source` → `SOURCES[...].permission` in `utils/dataSources.ts`) | Server-side stripping must match `widgetPermissions()` or a viewer could receive data they can't see (or lose data they can) | Client gate derives it; an unknown source locks the widget (`dashboards.unknown-source`) |
| B3 | New permission codes `traffic.view` (M02) and `public_transport.view` (M04) in `catalog.DOMAIN_PERMISSIONS` and the viewer adapter | Traffic / public-transport presets carry these codes | `VIEWER_PERMISSION_RULES` derives them from module access |
| B4 | `risk-map` `emits` is now `['road']` only (it never emitted `county`) | Mirror in `catalog.py` if it lists emits | Changed in `widgetRegistry.ts` |
| B5 | `/fleet/summary/` `governor_compliance` returns hard-coded zeros (noted in `useFleet.ts`) | The governor-tamper KPI, the fleet KPI status, the NTSA agency row and the tamper alert all read it, so they can show a false "healthy 0.0%" and the alert never fires | Not yet fixed in the frontend; presets never bind it. Fix options: backend returns real values, or frontend reads `/fleet/speed-governor-status/compliance/` (needs a per-metric source override) |
| B6 | Summary endpoints ignore dashboard filters (only infra honours `agency`) | Unchanged from §4.3 #14 | "Not filtered by …" on every affected widget |
| B7 | `road_id` / chainage, container number, IMO as shared keys | §3b join keys | Not started (phase 6b) |

---

## 10. Backend updates for agency-scoped catalogs and new module widgets (2026-10-04)

The frontend now does two things the backend doesn't know about yet:

1. **Agency-scoped catalog.** On a dashboard with an `ownerAgency`, the editor
   only offers widgets whose data comes from a page that agency can open
   (`utils/agencyCatalog.ts`). Every source declares that page in
   `WidgetSource.route` (`utils/dataSources.ts`). National dashboards
   (`ownerAgency = null`) still get the full catalog.
2. **New module widgets.** Railway (9 presets), Training Institutes (9), and
   more for Aviation and Maritime (`utils/widgetPresets.ts`), backed by seven
   new source ids.

Until the items below land, the editor enforces the scope, but the API still
accepts a save of any widget. Training widgets will also be stripped from
published dashboards, because the server doesn't know `training.view`.

### 10.1 Update (required for the new widgets to publish)

| # | Item | Where | Detail |
| --- | --- | --- | --- |
| B8 | Add `training: 'training.view'` to `DOMAIN_PERMISSIONS` | `apps/dashboards/catalog.py` | Must match `DOMAIN_PERMISSIONS` in `utils/dataSources.ts` exactly; the server strips widgets by this string |
| B9 | Viewer adapter grants `training.view` when the user can reach module **M14** | `DASHBOARDS_VIEWER_ADAPTER` (`apps.accounts.dashboards_viewer`) | Mirrors `VIEWER_PERMISSION_RULES` in `composables/useViewerContext.ts` (same pattern as B3) |
| B10 | Register the new source ids with their permissions (extends B2) | `catalog.py` source → permission map | `aviation.infra` → `aviation.view`; `maritime.cargo` → `maritime.view`; `training.overview`, `training.enrollment-status`, `training.outcomes`, `training.cohorts`, `training.revenue` → `training.view`. An unknown source locks the widget for everyone |

### 10.2 Move (frontend logic that belongs on the server)

| # | Item | Move from | Move to | Why |
| --- | --- | --- | --- | --- |
| B11 | **Agency catalog scope check** | `catalogScopeFor()` / `catalogItemInScope()` in `utils/agencyCatalog.ts` | Save and publish validation in `apps/dashboards` (reject with a 400 that names the out-of-scope widgets) | Today only the editor applies it, so a direct API call can put KPA data on a KRC dashboard. The rule: for a dashboard with `owner_agency`, each widget's source page must resolve above `none` for that agency at the **enabled** layer (agency-level, no role), using `apps/access_control/resolver.py` with saved Module Access overrides. National dashboards are exempt |
| B12 | **Source → page map** | `route` on each entry in `SOURCES` (`utils/dataSources.ts`) | `catalog.py`, next to the source → permission map | B11 needs it server-side. The hand-built widgets' sources (`WIDGET_SOURCES` in `agencyCatalog.ts`: `fatality-bars`, `incident-trend` → safety summary; `risk-map` → hotspots, black spots and GIS roads, **all** required; `feed-health` → integrations) and KPI metrics (domain → summary source) resolve the same way |
| B13 | **Training rollup** → `GET /api/v1/training/summary/` | `trainingOverview()`, `trainingRevenue()` and the status/outcome counters in `utils/dataSources.ts` | `apps/training` summary view | M14 has no summary endpoint, so the frontend makes up to 7 `count` requests for the overview, 7 for enrolments by status, 5 for outcomes and 2 for cohorts, then aggregates revenue client-side. One endpoint does this with a few `GROUP BY`s. Return this shape and each frontend source becomes a single fetch with no preset changes: `{ kpis: { active_courses, ongoing_cohorts, scheduled_cohorts, enrollments, completions, pass_rate_pct }, enrollments_by_status: [{ status, enrollments }], completions_by_outcome: [{ outcome, completions }], revenue_monthly: [{ period, total_kes }], revenue_by_stream: [{ revenue_stream, total_kes }], cohorts: [{ cohort_code, course, institute, status, start_date, enrolled_count, capacity, fill_rate_pct }] }`. Keep `pass_rate_pct` null when there are no completions (never 0). It should honour `agency` (an institute's owning agency) and `date_range` so the training widgets can join dashboard filters |

### 10.3 Check (no change expected, but confirm)

| # | Item | Detail |
| --- | --- | --- |
| B14 | `risk-map` permissions | Viewing still needs safety **or** GIS (`requiredPermissions`), but the agency catalog now needs the safety pages too, since the hotspots are safety data. Consider making the viewer rule "safety required" in `catalog.py` as well, so a GIS-only viewer doesn't receive hotspot data |
| B15 | Cross-agency read grants count | KRC's route grants (`/fleet`, `/maritime/port-ops`, `/maritime/cargo`) let its dashboards carry fleet and port data. That is intended: if an agency can open a page, it can use that page's data. If any route grant should be page-only, remove it from `access-control.json` rather than special-casing the catalog |
| B16 | `AGENCY_CARD_DOMAINS` | Unchanged, but B11 should use it: an `agency-card` is in scope only when the owner agency can open every domain page that card reads |

---

## 11. Phase 4 (Inspector v2) - shipped frontend, backend items (2026-10-05)

Shipped, frontend only:

- **Inspector tabs** Data / Actions / Style, plus a JSON view of the stored widget
  (`editor/WidgetInspector.vue`, `editor/WidgetJson.vue`). Widget options come from
  `WidgetDefinition.options` in `utils/widgetRegistry.ts` and render through
  `editor/OptionField.vue`. The per-type `v-if` blocks are gone.
- **Binding picker** (`editor/BindingEditor.vue`, `utils/bindingDesign.ts`): source
  (scoped to the owner agency) → data path read from the live payload → visual
  (Stat / Line / Area / Bars / Breakdown / Table, only those the path can feed) →
  fields, units, threshold, top-N, click field, with a 5-row Frame preview.
  Switching visuals keeps measures, labels, units and the click field. A path
  the feed left out or returned empty stays editable from the binding's own fields.
- **Guardrails** (`utils/widgetValidation.ts`): errors block Publish (toolbar badge,
  dashed outline on the canvas, list in the Publish drawer); drafts always save.
- **Filter compatibility**: "County · 2 of 9 widgets" when adding a filter.
- Stored JSON is unchanged: same widget types, config keys and `schemaVersion: 1`.

| # | Item | Where | Detail |
| --- | --- | --- | --- |
| B17 | **Save/publish validation** mirroring `widgetIssues()` | `apps/dashboards` publish view | Today only the editor blocks publishing. Server rule: generic widgets need a known `binding.source`, `binding.shape` matching the type (`stat`→`scalar`, `series`→`series`, `breakdown`→`categorical`, `table`→`rows`), a dimension for series/categorical, and at least one measure (tables may have columns only). Reject with a 400 naming the widget ids. Combine with B11 |
| B18 | **User-saved presets** ("Save as preset", as in Zoho Creator) | New `DashboardPreset` model + `GET/POST /dashboards/presets/` | Presets are code-only (`utils/widgetPresets.ts`). Store `{ id, title, description, type, binding, config, owner_agency, created_by }`; the palette would merge them under the built-ins and apply the same agency scope |
| B19 | **PDF / print export** of a published dashboard | Server-side render or a print stylesheet | Zoho offers PDF/Print per page. Needs a decision: headless render on the server (consistent output, heavier) or a frontend print stylesheet (cheap, browser-dependent) |

---

## 12. Phase 5 (Query sources) - shipped frontend, backend items (2026-10-05)

Shipped, frontend only:

- **One source per Query Builder dataset** (`query.incidents`, `query.blackspots`, `query.congestion`,
  `query.traffic_counts`, `query.vehicles`, `query.gps_tracks`, and the M06 infrastructure datasets
  `query.road_segments`, `query.bridges`, `query.maintenance_orders`, `query.construction_projects`,
  `query.maintenance_budgets`, `query.streetlights`, `query.traffic_signals`) over `/query/execute/`, plus three
  **same-permission joins** over `/query/execute-join/` (`query.join.vehicles-gps`,
  `query.join.incidents-blackspots`, `query.join.congestion-counts`). See `QUERY_DATASETS` in
  `utils/dataSources.ts`.
- `Binding.params` carries the dataset fields, filters, sort and limit; it is part of the request cache
  key, so the canvas widget and the inspector share one request.
- **Dashboard filters become server-side dataset filters** only where the dataset has the field
  (`filterMap`): incidents honour date range, severity and road; congestion and traffic counts honour
  date range and road; black spots honour road; GPS tracks honour date range; vehicles honour nothing.
  The date range's end day is inclusive. A join honours a filter only when both sides can.
- **`Binding.aggregate`** (count / sum / avg / min / max by a field, with hour / day / week / month buckets)
  turns raw records into breakdowns and series. A group with no reported values is null, never 0.
- **Honest sampling:** the server returns at most 500 records. When more match, `Frame.meta.partial`
  is set and charts and tables say "From the first N of M records".
- **Query editor** in the data picker (`editor/QueryEditor.vue`): fields, filters (typed by the dataset
  catalog, enum values as choices), sort, record limit, and "Start from a saved query", which **copies**
  the definition. It never calls `/saved/{id}/run/`, because a run distributes the query to its recipients.
- 8 query presets (incidents total / by severity / by type / per day / latest, congestion by severity,
  counted vehicles per day, vehicles by status).

| # | Item | Where | Detail |
| --- | --- | --- | --- |
| B20 | **"All of" permissions** for cross-domain joins | `catalog.py` widget permission rule | Widget permissions mean "any one of". A join of incidents (safety) with congestion (traffic) needs both, so the frontend offers only joins whose datasets share one permission. Add a `requiredAll` rule server-side (and in `widgetPermissions()`) to unlock mixed joins |
| B21 | ~~**Authorise `/query/execute/` per dataset domain** for dashboard viewers~~ **Done 2026-10-26** | `apps/analytics/query.py` | Every dataset names its module and pages (`routes`); execute, execute-join and `/query/datasets/` require the *viewer's own* resolved access to one of them (role layer included), refuse with 403 otherwise, scope rows to the viewer's agency where the dataset declares a `tenant` lookup, and mask restricted-category fields (e.g. `procurement`). `/query-builder` itself stays oversight-only; the datasets are authorised by their own pages. Agency rows: incidents (reporting agency or road owner), vehicles and GPS tracks are scoped to the viewer's agency; congestion, blackspots and traffic counts are marked `national` (network-wide analysis any agency with the page may read). Oversight agencies (SDT, SDR) read across agencies |
| B22 | **Server-side aggregation** `POST /query/aggregate/` (`group_by`, `fn`, `measure`, `bucket`) | `apps/query` | Aggregates are computed on at most 500 records today, and widgets say so. A `GROUP BY` endpoint returning `{ total, rows: [{ <by>: …, value }] }` makes them exact. The binding already holds everything the endpoint needs (`aggregate` + `params.filters`) |
| B23 | **Dataset fields for agency and county** (done for the M06 datasets: `agency_code`, `county`; the six original datasets still lack them), and `vehicle_type` enum values | `/query/datasets/` | No dataset exposes an agency or county field, so those dashboard filters can't narrow query widgets. `vehicles.vehicle_type` is an enum with no `values` list, so the editor can't offer choices |
| B24 | **Decision #2 (§8)** | Product | Query widgets carry their dataset's domain permission like any other widget, so they publish to any audience that holds it. If query-built widgets should be analyst-only, that needs a separate rule |

---

## 13. Phase 6 (Primitives v2) - shipped frontend (2026-10-05)

Four new visuals on the generic binding, each with its size-class forms (§5.3), a new shape, and presets.

| Visual | Type / shape | What's honest about it | Presets |
| --- | --- | --- | --- |
| **Map** (`VizPoints`) | `points` / `points` | Fits to its markers whenever the data changes (finding 10). Rows without coordinates, including 0,0, are counted under the map ("3 without a location"), never dropped silently. Tier legend uses dot + word + count | Predicted risk hotspots, Accident black spots (both click → `road`) |
| **Status list** (`VizStatusList`) | `status-list` / `status` | Status comes from a field's value (binding map, then shared words: offline / degraded / resolved …) or a threshold on a measure, never from position. Icon + word + colour. Counts cover every row, not just the rows a limit keeps | Feeds needing attention (click → `agency`), Trains running late, Active congestion events |
| **Progress** (`VizProgress`) | `progress` / `scalar` + `target` | Target is a fixed number or another figure in the same payload, never invented. A percentage with no target draws on 0-100; any other unit says "No target set". Status from the threshold, not the fill | Budget absorption, Disbursed vs allocated, Rail on-time vs benchmark |
| **Heatmap** (`VizHeatmap`) | `heatmap` / `matrix` | Hour-of-day and weekday axes in **East Africa Time**, always complete. A quiet slot is 0 for counts and empty for averages. No records at all = empty state, not a grid of zeros. Totals only for counts and sums | Incidents by hour × weekday, Counted vehicles by hour × weekday |

Also in this phase:
- **Time buckets are now EAT** (UTC+3) for every grouping. An incident at 01:00 EAT counts on that day, not the previous UTC day. Month keys read "Oct 2026".
- **Palette fix:** sources under a module the access config doesn't list (M16, predictive hotspots) were silently missing from the palette. They now get their own group.
- The data picker gained Map (lat/lon/name/tier/click field), Status (field or threshold, per-value status mapping, detail line, row link), Progress (target value or target path) and Heatmap (column and row field, each with a time bucket) controls.

| # | Item | Where | Detail |
| --- | --- | --- | --- |
| B25 | **Add module M16** (predictive analytics) to the access config | `access-control.json` | `safety.hotspots` is declared in module M16, which the config doesn't list. The palette now groups it under "Predictive analytics", but module access, agency scope and the M16 page don't know it |
| B26 | **Alerts as a StatusList preset** (§5.5) | Product / backend | The `alerts` widget reads six sources at once. A binding reads one, so alerts stay hand-built. A server-side "threshold breaches" endpoint (thresholds moved server-side) would turn it into one StatusList preset |
