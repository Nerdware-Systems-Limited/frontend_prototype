# Dashboard Manager

_Verified against the code on 2026-10-12. [Widgets.md](Widgets.md) is the design audit and phase log (the "why"
and the backend requests); [dashboard-manager-integration.md](dashboard-manager-integration.md) lists where the
deployed backend differs from its reference package. This page is the current implementation (the "what")._

The Dashboard Manager lets administrators compose dashboards from widgets, assign them to audiences, publish
versions, and lets viewers see (and optionally personalise) the one they are assigned. The mental model is
Tableau's: widgets are worksheets, a dashboard is a layout with filters and actions, assignments say who sees it.

## 1. The three-layer data model

```
Data source  (where, what it honours)   utils/dataSources.ts   WidgetSource
     │
Binding      (which part, shaped how)   types/frame.ts         Binding  (stored in widget config)
     │  applyBinding(payload, binding)
Frame        (one shape for every visual)                      Frame { fields, rows, meta }
     │
Visual       (how it looks at this size) components/dashboard/viz/*   Viz*.vue
```

A widget is built around the **shape of the data** (a number, a time series, a breakdown, a ranked table, points,
statuses, a matrix), not around the module it reads. One generic `breakdown` widget can show vehicle classes,
payment channels or incident severities, with a binding in its config choosing which.

### Sources (`utils/dataSources.ts`)

A `WidgetSource` declares an endpoint, what it **honours** (dashboard filters it truly reads), its permission, its
integration tier (`live`, `file`, `manual`), its `route` (the page the data belongs to), its cache TTL, whether the
backend is `ahead-of-backend`, and a `fetch(params, options)`.

- 19 fixed sources: `safety.summary`, `safety.hotspots`, `safety.top-blackspots`, `fleet.summary`, `rail.summary`,
  `aviation.summary`, `aviation.infra`, `maritime.ops`, `maritime.cargo`, `infra.summary`, `integrations.feeds`,
  `traffic.summary`, `pt.summary`, `gis.roads` and five `training.*` sources.
- 13 query sources, one per Query Builder dataset (`query.incidents`, `query.blackspots`, `query.congestion`,
  `query.traffic_counts`, `query.vehicles`, `query.gps_tracks`, plus the M06 `query.road_segments`, `query.bridges`,
  `query.maintenance_orders`, `query.construction_projects`, `query.maintenance_budgets`, `query.streetlights`,
  `query.traffic_signals`) over `/query/execute/`, and 3 same-permission joins
  (`query.join.vehicles-gps`, `query.join.incidents-blackspots`, `query.join.congestion-counts`) over
  `/query/execute-join/`. The server returns at most `QUERY_MAX_ROWS = 500` records, and widgets say so when an
  aggregate covers only part of the data (`Frame.meta.partial`).
- `DOMAIN_PERMISSIONS` maps a domain to a permission string (`safety.view`, `fleet.view`, `railway.view`,
  `aviation.view`, `maritime.view`, `infrastructure.view`, `integrations.view`, `gis.view`, `traffic.view`,
  `public_transport.view`, `training.view`). It **must stay identical** to the backend's
  `apps/dashboards/catalog.py` because the server strips widgets by these exact strings.
- `honouredParams()` drops every filter a source does not read, so the frame can say "Not filtered by ..." instead
  of presenting unfiltered numbers as filtered.

### Bindings (`types/frame.ts`, `utils/bindings.ts`)

`Binding` fields: `source`, `params` (query sources: fields, filters, sort, limit; part of the cache key), optional
`aggregate` (`count|sum|avg|min|max` by a field with `hour|day|week|month|hourOfDay|dayOfWeek` buckets in **East
Africa Time**, plus `by2/bucket2` for matrices), `shape`, dot `path` into the payload, `dimension`, `measures`
(with `unit`), `columns`, `sort`, `limit` (top-N; categorical remainder folds into "Other"), `threshold`, `emits`,
`geo`, `status`, `link`, `target`, `dimension2`.

Shapes and the visual that draws each:

| Shape | Visual (widget type) | Notes |
|---|---|---|
| `scalar` | Stat (`stat`), Progress (`progress` with a `target`) | A missing figure is neutral, never green |
| `series` | Time series (`series`, line, area or bars) | |
| `categorical` | Breakdown (`breakdown`) | A `Record<string, number>` payload is accepted too |
| `rows` | Table (`table`) | |
| `points` | Map (`points`) | Rows without usable coordinates, including 0,0, are counted under the map |
| `status` | Status list (`status-list`) | Ranked worst first; status from a field map or a threshold, never from position |
| `matrix` | Heatmap (`heatmap`) | Complete hour and weekday axes; no records is an empty state, not a grid of zeros |

`applyBinding(payload, binding)` is pure and unit tested (`bindings.test.ts`). `useBoundFrame` wires source,
filter context, binding and honest states together for every generic widget.

### Thresholds and units

`utils/thresholds.ts` is the single source of truth for "is this figure OK?": KPI cards, the alerts rail and agency
snapshot rows all call `statusOf()`, so they cannot disagree. Status values: `healthy | warning | critical |
neutral`; a missing figure is `neutral`. `utils/units.ts` formats values by unit key (`count`, `pct`, `kes`, `kmh`,
...) in `en-KE`. Thresholds live in frontend code today; Widgets.md section 5.5 plans moving them to the server.

## 2. Widget catalog (`utils/widgetRegistry.ts`)

`WIDGETS` holds static metadata for 19 widget types (size, permissions, honoured filters, `emits`, default config,
inspector `options`); `WIDGET_COMPONENTS` maps type to Vue component, kept separate so the backend can import a JSON
dump of the metadata without Vue.

| Group | Types |
|---|---|
| Hand-built | `kpi`, `kpi-row`, `fatality-bars`, `incident-trend`, `risk-map`, `alerts`, `feed-health`, `agency-card`, `national-command-centre` (embed) |
| Generic (bound) | `stat`, `series`, `breakdown`, `table`, `points`, `status-list`, `progress`, `heatmap` |
| Layout | `text`, `image` (links pass through `utils/safeUrl.ts`) |

- The generic types are `palette: false`. Authors place them through **presets** (`utils/widgetPresets.ts`, 75
  entries across traffic, public transport, safety, fleet, rail, aviation, maritime, infrastructure, training and
  query), each a named binding. Adding a chart for data already in a source payload is one preset entry, not a new
  component. `risk-map` and the old hand-built types remain for stored dashboards.
- `metricRegistry.ts` is the KPI catalog behind `kpi` and `kpi-row`; resolvers are shared with the hard-coded
  `NationalCommandCentre.vue` so both produce identical numbers.
- `widgetPermissions(type, config)` derives a widget's permission from its binding's source (an unknown source locks
  the widget with `dashboards.unknown-source`); `widgetFilterFields()` and `widgetEmits()` do the same for filters.
- **Adding a widget type** = one registry entry + one component, no dashboard code changes. **Adding a chart** = one
  preset. **Adding data** = one source.

### Size adaptivity

`WidgetFrame` measures its body and provides a size class via `useWidgetSize`: `xs` (<240 px, headline only),
`s` (<400, compact), `m` (<640, full chart with axes), `l` (640+, adds legend and values). Visuals pick their form
from it. Outside a frame it falls back to `m`.

### Agency-scoped catalog (`utils/agencyCatalog.ts`)

On a dashboard with an `ownerAgency`, the editor offers only widgets whose source page that agency can open (the same
`pageScope` resolution Module Access uses at the *enabled* layer). National dashboards (`ownerAgency = null`) get
the full catalog. The backend enforces the same rule on save and publish; the frontend only decides what to offer.

## 3. The dashboard schema (`types/dashboard.ts`)

`DashboardDefinition` (`schemaVersion: 1`) is exactly what the backend stores in `DashboardVersion.definition`:

```
title, subtitle?, theme {density, rowHeight, gap}, refreshInterval (seconds, 0 = off)
widgets[]   WidgetInstance { id, type, title?, x, y, w, h, config?, style?, hidden? }   12-column grid
filters[]   DashboardFilter { id, field, label, control, options?, defaultValue?, appliesTo 'all'|ids[], locked?, bindToViewer? }
actions[]   DashboardAction { id, name, type filter|highlight|navigate, sourceWidgetId, field, targetWidgetIds, urlTemplate?, onClear }
```

Filter fields: `date_range`, `agency`, `county`, `road`, `mode`, `severity`, `vehicle_class`.

Assignments (`DashboardAssignment`) say who sees a dashboard: `scopeType` in `user | role_in_department |
department | role | agency | global`, a `scopeValue` (for example `NTSA:analyst`, `KeNHA:maintenance`, `*`), a
`priority`, a `locked` flag, `allowPersonalization` and an optional `activeFrom` / `activeUntil` window.

### Resolution (`utils/resolveDashboard.ts`)

The server (`apps/dashboards/resolver.py`) is the authority; the client copy powers "Preview as..." and conflict
warnings. Keep them in sync. Algorithm: keep published assignments whose window contains now, keep those that match
the viewer, walk `SCOPE_PRECEDENCE` from least to most specific taking the highest-priority match at each level
unless a broader level has a `locked` assignment (locks flow downward), and the last candidate wins.

### Layout engine (`utils/layoutEngine.ts`)

Pure functions: `clampBox`, `overlaps`, and `compact()`, which pushes colliding widgets down and then floats
everything up to fill gaps (the react-grid-layout model).

## 4. Runtime (viewing)

`pages/dashboard.vue` is where everyone lands.

1. `useDashboardApi().resolve()` asks `GET /api/v1/dashboards/resolve/` for the viewer's dashboard (HTTP 204 means
   none assigned).
2. **No dashboard assigned, or the API is unavailable:** it falls back to the previous behaviour,
   `NationalCommandCentre.vue` for super admins and SDT, `AgencyCommandCentre.vue` for other users with an agency, so rollout changes nothing until an admin publishes
   something.
3. Otherwise `DashboardRenderer` draws the definition. It owns the filter and action engine, the refresh clock and
   the 12-column grid. Header actions: Customise (when `canPersonalize`), "Why this view?" (the matched assignment),
   and Edit (for managers).
4. **Personalisation:** `PersonalCanvas` lets the viewer move, resize and hide widgets. The server keeps only
   `id/x/y/w/h/hidden` of widgets already on the published layout (`PUT/DELETE /dashboards/{id}/personal/`).

### Filters and actions (`composables/useDashboardFilters.ts`)

`provideDashboardFilters()` is called by the renderer; widgets call `useWidgetFilters(widgetId)` for their context
and an `emit()` for clicks. A filter applies to a widget only when it is in `appliesTo` **and** in the widget's
honoured fields. State is URL-synced: `?f.<field>=<value>` for filters and `?a.<actionId>=<value>` for action
selections, so a filtered view is shareable and survives refresh. Filters with `bindToViewer` fill from the viewer's
agency or department; `locked` filters ignore the URL and show their default. The personal canvas passes
`syncUrl: false`.

### Data hook (`composables/useWidgetData.ts`)

One primitive loads every widget:

- requests are keyed by `source + honoured params + options` and cached for the source TTL (default 60 s), so ten
  safety widgets cost one call; a failure is never cached;
- a per-widget request counter ignores responses that arrive after a newer request;
- a refresh keeps old data on screen (`refreshing`); only the first load is `loading`;
- states: `idle, loading, refreshing, ready, empty, partial, not-integrated, forbidden, error`. 401/403 give
  `forbidden`; 404/501 on an `ahead-of-backend` source gives `not-integrated`; anything else is `error`;
- the frame footer reports which sources fed the widget and when;
- `invalidateWidgetData()` clears the cache; the renderer calls it before each refresh tick, which only fires while
  `document.visibilityState === 'visible'`.

`WidgetFrame.vue` draws the chrome (title bar, background, border, padding, accent), the "Not filtered by ..." note
and an **error boundary** so one broken widget never blanks the dashboard. `WidgetState.vue` renders one wording per
state in the product's voice.

## 5. Authoring (`/admin/dashboards`)

Routes: `pages/admin/dashboards/index.vue` (list, templates, status) and `[id].vue` (editor). Access: route tier
`admin` in the baseline, then `middleware/dashboard-manager.global.ts` requires `dashboards.manage` or
`dashboards.manage_agency` (from `useViewerContext`), otherwise redirects to `/dashboard`. Agency admins manage
only dashboards owned by their agency. Management rights always come from the **real** signed-in user, never the
"Preview as" viewer.

`components/dashboard/DashboardEditor.vue` layout: toolbar (name, status, undo/redo, preview, history, save,
publish) | palette | live canvas | inspector.

- **Palette** (`editor/WidgetPalette.vue`): hand-built widgets plus presets, grouped by module, filtered by the
  owner agency's catalog scope.
- **Canvas** (`DashboardCanvas.vue`): drag and resize on the 12-column grid with live widgets, keyboard moves
  without animation.
- **Inspector** (`editor/WidgetInspector.vue`) tabs: **Data** (schema-driven fields from `WidgetDefinition.options`
  rendered by `OptionField.vue`; for generic widgets the **binding picker** `BindingEditor.vue`), **Actions**
  (`ActionDesigner.vue`), **Style**, plus a **JSON** view (`WidgetJson.vue`).
- **Binding picker** (`utils/bindingDesign.ts`): source (scoped to the owner agency), then a data path read from
  the **live payload** (so only fields that exist are offered), then the visual the path can feed, then fields,
  units, threshold, top-N, click field, with a 5-row Frame preview. Switching visual keeps measures, labels, units
  and the click field. Query sources add `QueryEditor.vue`: fields, typed filters, sort, record limit, and "Start
  from a saved query", which **copies** the definition and never calls `/saved/{id}/run/` (a run distributes the
  query to its recipients).
- **Filters** (`editor/FilterDesigner.vue`): shows compatibility ("County: 2 of 9 widgets") as you add one.
- **Audience** (`editor/AudiencePanel.vue`): assignments, with a directory from `GET /dashboards/directory/`
  (`useDashboardDirectory` falls back to the accounts API when that returns no agencies).
- **Guardrails** (`utils/widgetValidation.ts`): `widgetIssues()` returns errors (block Publish, dashed outline on
  the canvas, listed in the Publish drawer) and warnings (do not block). Drafts always save.
- **Preview as...**: provides a simulated `ViewerContext` through `provide('dashboard:viewerOverride')`; widgets
  gate on it instead of the signed-in admin.

### Versions

Edits go to a **draft**; viewers keep the published version until **Publish**. Every publish is a restorable
version (`GET /{id}/versions/`, `POST /{id}/versions/{n}/restore/`).

### Templates (`utils/dashboardTemplates.ts`)

"New dashboard, from template" clones one of five: Blank, National Command Centre (the current national page rebuilt
from widgets), Road Safety Operations, Road Infrastructure and Executive one-pager. The backend seeds the same JSON
as system dashboards.

## 6. API surface (`composables/useDashboardApi.ts`)

Base `/api/v1/dashboards/` (the reference package says `/api/dashboards/`; the deployed routing is `/api/v1/`).

| Call | Method and path |
|---|---|
| `resolve({dashboardId?})` | `GET /resolve/` |
| `list`, `get`, `create` | `GET /`, `GET /{id}/`, `POST /` |
| `saveDraft` | `PATCH /{id}/` |
| `publish`, `archive`, `duplicate` | `POST /{id}/publish/`, `/archive/`, `/duplicate/` |
| `remove` | `DELETE /{id}/` |
| `versions`, `restore` | `GET /{id}/versions/`, `POST /{id}/versions/{n}/restore/` |
| `saveAssignments` | `PUT /{id}/assignments/` |
| `savePersonalLayout`, `resetPersonalLayout` | `PUT` / `DELETE /{id}/personal/` |
| `directory`, `searchUsers` | `GET /directory/`, `GET /directory/users/?q=` (2+ characters) |

Errors are normalised into `DashboardApiError` (status plus a message fit for the UI).

## 7. Viewer context and permissions (`composables/useViewerContext.ts`)

UAPTS users carry no permission strings. The server derives dashboard permission codes from module access
(`DASHBOARDS_VIEWER_ADAPTER`) and serves them at `GET /api/v1/access-control/viewer/`; the policy store holds them
and this client **never recomputes them**. `ViewerContext` = `{ userId, agencyCode, departmentCode, roles,
permissions, isSuperAdmin }`; the department UUID is resolved to its code via `useDepartments().get()` and cached
for the session.

## 8. Honest data rules specific to widgets

- No fabricated or sampled data in previews or palette thumbnails.
- No number animation on refresh.
- A widget never implies filter coverage it lacks.

### Who sees what (coverage tab)

The matrix resolves agency x department x role with the client copy of `resolveDashboard`, from the published
dashboards `GET /dashboards/` returns. Notes:

- An agency admin's list only holds dashboards their agency owns, so a national dashboard that wins for their users
  is not counted; the empty cell reads "No agency dashboard" (not "Built-in fallback") and a banner says so.
- `super_admin` and `public` are not shown as role columns.
- An agency with no departments registered gets one "Whole agency" row (resolved with no department), so
  agency-wide and role-wide dashboards still show.
- Time buckets are East Africa Time (UTC+3), not UTC.
- `FleetSummary.governor_compliance` is deliberately not bound anywhere because the backend returns hard-coded
  zeros (BACKEND item B5 in Widgets.md).
- Alerts stay hand-built because they read six sources at once and a binding reads one (B26).

## 9. Tests

`dashboard-api`, `dashboard-branch`, `dashboard-compat`, `dashboard-widgets`, `generic-widgets`, `bindings`,
`binding-design`, `widget-data`, `widget-inspector`, `widget-presets`, `widget-validation`, `viz`, `viz-primitives`,
`viz-primitives-v2`, `thresholds`, `threshold-widgets`, `units`, `query-sources`, `data-sources`, `agency-catalog`,
`national-heatmap` (all `tests/unit/`).

## 10. Open backend items

Tracked in [Widgets.md](Widgets.md) sections 9 to 13 (B1 to B26). The ones that most affect what ships:
widget type and source allow-lists in `catalog.py` (B1, B2, B8 to B10), server-side catalog-scope and publish
validation (B11, B17), a training summary endpoint (B13), per-dataset authorisation of `/query/execute/` for
dashboard viewers (B21, done 2026-10-26: page scope, agency rows and masked fields are checked on every read), and
server-side aggregation (B22).
