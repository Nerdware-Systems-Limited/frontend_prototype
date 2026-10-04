# Agency Command Centre Richness - Design Spec

**Status:** Approved direction (Approach B), pending user review of this written spec.

**Visitor mode:** Operate (per `impeccable` PRODUCT.md/DESIGN.md - this is a refinement of the
existing instrument-panel workspace, not a new visual world; the Blockworks-derived
data-terminal direction in `DESIGN.md` is already the shipped system and stays as-is).

## Problem

`AgencyCommandCentre.vue` (the per-agency `/dashboard` landing view) currently renders every
reachable operational module as one flat `KpiCard` tile - a single number, a short description
string, and a muted style for read-scope modules. It is already *data-driven* per agency (different
agencies get different tiles based on their real RBAC scope), but every agency's page has the same
flat, single-density shape: no trend, no recent-activity detail, nothing that differentiates "this
is KeNHA's actual job" from "this is a module KeNHA merely has cross-agency read access to."

The user wants each agency's command centre to be genuinely richer and more distinctive: summaries,
charts/trends, and tables that link to the full data - not just a bigger number.

## Non-goals

- No new backend endpoints. Every chart/table pulls from a composable method that an existing
  domain page already calls (same rule the original `AgencyCommandCentre` plan followed).
- No change to RBAC resolution, route gating, or `access-control.json` (separate concern, already
  correct).
- No change to `NationalCommandCentre.vue` (SDT/super_admin's ministry-wide view) - this spec is
  scoped to `AgencyCommandCentre.vue` only.
- No fabricated trend or table data. Per PRODUCT.md's binding rule and this component's own
  existing honest-empty-state discipline: a module with no genuine time-series or list data behind
  it gets no chart/table section, not an invented one. Coverage is honest, not uniform.

## Approach (B - Dashboard sections, approved)

Split the page into two zones by scope, computed exactly as today (`resolveRoute(entry.route).scopeLevel`
per `agencyModuleSummary` entry - unchanged):

- **Operations** - the agency's full-scope modules. Each renders as one bordered panel (not a
  `KpiCard` tile) containing, top to bottom: a header (module label + scope context + a "View full
  workspace →" link to the module's real domain page), a compact KPI strip (2–3 figures, flat text
  blocks - not nested `KpiCard`s), a trend chart section (`TrendLineChart`/`MultiLineChart`, only
  when the module has a genuine backing time-series), and a recent-activity table (4–6 rows, only
  when the module has a genuine backing list endpoint), each sub-section independently omitted (not
  emptied) when its data source doesn't exist or returns nothing.
- **Cross-Agency Visibility** - the agency's read-scope modules, unchanged from today: the existing
  flat, muted `KpiCard` grid. No chart/table richness here - these are secondary visibility grants,
  not the agency's own mandate, and giving them equal richness would blur exactly the distinction
  this work is for.

### Why not nest `KpiCard` inside the new panel

`craft-floor.md`'s refuse list flags "nested cards" - wrapping a bordered `KpiCard` tile inside
another bordered panel. The Operations panel is itself the card (flat `--surface-2`, 1px
`--border-subtle`, `--r-sm` per DESIGN.md's Card spec); its KPI row is a plain flex strip of mono
figures (the same `.metric-strip`/`.metric-item` pattern already used in `users.vue` and
`agencies.vue` - divided by hairlines, no per-figure card chrome), not a row of `KpiCard`s.

### Identity framing (carried over from the earlier-agreed prioritization/identity design)

The page header keeps today's agency name + `agencyCode · roleTier workspace` line, and gains one
more line derived entirely from `access-control.json` data already loaded by `useAccessControl()` -
never invented copy:

```
{domain labels joined} · Manages: {full-scope module labels joined}
```

e.g. `Roads and Highways · Manages: Road Traffic, Safety & Incidents, Road Infrastructure`.

## Data model changes

### `agencyModuleSummary.ts` - extend `ModuleSummaryEntry`

```ts
export interface TrendPoint { value: number; label: string; meta?: string }

export interface ModuleSummaryEntry {
  label: string
  route: string
  period: string
  fetch: () => Promise<any>
  kpis: ModuleSummaryKpi[]
  /** Optional - only set when a genuine time-series backs this module (see per-module table below). */
  trend?: {
    fetch: () => Promise<any>
    points: (raw: any) => TrendPoint[] // returns [] when the raw shape yields nothing real
    color?: 'primary' | 'destructive' // defaults to primary; destructive for fatality-style series
  }
  /** Optional - only set when a genuine list endpoint backs "recent activity" for this module. */
  table?: {
    fetch: () => Promise<any>
    columns: { key: string; label: string; numeric?: boolean }[]
    rows: (raw: any) => Record<string, string | number | null>[] // [] renders the empty state
    viewAllRoute: string
    viewAllLabel: string // e.g. "View all incidents →"
  }
}
```

`trend.fetch`/`table.fetch` run alongside the existing `entry.fetch()` in the same
`Promise.allSettled` batch per module (not sequential) - a rejected trend or table fetch degrades
that one sub-section to its own empty state; it never blocks the KPI figure or the other
sub-section.

### Per-module content plan

Each row cites the exact existing page whose fetch/mapping pattern the implementing task must read
and mirror - never re-derive field names by guessing. Where no page precedent exists, the module
gets KPI-only (today's behavior), honestly, per the non-goals section.

| Module | Trend source (mirror this page's mapping) | Table source (mirror this page's mapping) |
|---|---|---|
| M02 Traffic | `useTraffic().speedObservations({page_size:30})` - mirror `traffic/analytics.vue`'s point mapping | `useTraffic().activeCongestion()` - active congestion events, links to `/traffic` |
| M03 Fleet | none confirmed - KPI-only | `useFleet().behaviourCritical()` - critical driver-behaviour events, links to `/fleet/behaviour` |
| M04 Public Transport | `usePublicTransport().onTimeStats(7)` - mirror `public-transport/index.vue` | `usePublicTransport().expiringLicenses(90)` - links to `/public-transport/driver-licensing` |
| M05 Safety | `useSafety().kpiTrend()` - mirror `safety/kpis.vue`'s `trendLinePoints` mapping exactly | `useSafety().activeIncidents()` - links to `/safety/incidents` |
| M06 Infrastructure | none confirmed - KPI-only | `useInfrastructure().delayedProjects()` - links to `/infrastructure/projects` |
| M07a Aviation | none confirmed - KPI-only | none confirmed - KPI-only (verify `capitalWorks()` shape first; if unusable, leave KPI-only) |
| M07b Maritime | `useMaritimeCargo()` trend source - mirror `maritime/imports-exports.vue`'s `trendSeries` mapping (note: that page uses `MultiLineChart`, not `TrendLineChart` - follow its component choice) | `useMaritimeCargo().gateEvents()` - links to `/maritime/cargo` |
| M08 Railway | `useRailSafety()` trend source - mirror `railway/safety.vue`'s chart mapping (note: a different composable than the `useRailway()` this module's KPI already uses - both are existing, already-used composables, so still within the "no new backend calls" rule) | `useRailway().incidents()` - links to `/railway/safety` |

Each implementation task's first step is: read the cited page's actual fetch + mapping code, confirm
the shape still matches, and only then wire the registry entry. If the shape has drifted or the
endpoint returns nothing usable, the task ships that module KPI-only and notes it - the same
discipline the original plan's Task 4 self-review used for NTSA/KMA assumptions, and the same one
`agencyModuleSummary.ts`'s own file header already states for M14 Training.

## Component changes

### `AgencyCommandCentre.vue`

- Header gains the derived "domain · Manages: ..." line (see Identity framing).
- Replace the single flat tile grid with two sections:
  - `<SectionTitle>Operations</SectionTitle>` + one Operations panel per full-scope module.
  - `<SectionTitle>Cross-Agency Visibility</SectionTitle>` + the existing muted `KpiCard` grid,
    unchanged, for read-scope modules.
- Quick-link groups (existing `quickLinkGroups` computed) stay as today's mechanism for
  non-operational modules, with two fixes carried over from the earlier-agreed but
  since-superseded bounded design (still valid, not in conflict with this larger scope):
  1. Human-readable labels instead of raw path strings (mechanical derivation: last path segment,
     kebab-case → Title Case, with `GIS`/`BRT` as literal acronym overrides - no new content to
     maintain).
  2. Exclude a module's own `entry.route` (already shown as an Operations panel or, for read-scope,
     already the tile's own link) from that module's quick-link list, so a route never appears
     twice on the same page.

### New: `AgencyModulePanel.vue`

A new small component (not inlined in `AgencyCommandCentre.vue` - 8 possible sub-sections per
module is too much to keep as a template literal inside the parent) taking:

```ts
defineProps<{
  entry: ModuleSummaryEntry
  moduleId: string
}>()
```

Owns its own `load()` (fetches `entry.fetch()`, `entry.trend?.fetch()`, `entry.table?.fetch()` via
one `Promise.allSettled`), its own loading/error state per sub-section, and renders:

- Header row: module label (Card Header spec - UPPERCASE 12px `fg-2`, `surface-1` ground, bottom
  hairline) + `NuxtLink to="{{entry.route}}"` "View full workspace →".
- KPI strip: `.metric-strip`/`.metric-item` pattern, one item per `entry.kpis[]`, mono figure +
  UPPERCASE label, honest `-` + "NO DATA" per-item when that KPI's `get()` returns null (mirrors
  `KpiCard`'s existing honest-unavailable contract, just in the flat-strip layout instead of tile
  layout).
- Trend sub-section (only when `entry.trend` is set and `points(raw).length`): `<SectionTitle>`-style
  small label ("Trend") + `TrendLineChart` (or `MultiLineChart` per the per-module table above),
  180px height, matching `safety/kpis.vue`'s existing chart sizing.
- Table sub-section (only when `entry.table` is set and `rows(raw).length`): a plain `<table>`
  using the Data Table spec (surface-1 header, `border-strong` header rule, `border-subtle` row
  rules, numeric cells in mono via `.num`), 4–6 rows, `+ NuxtLink to="{{entry.table.viewAllRoute}}"`
  "{{entry.table.viewAllLabel}}" below it.
- Any sub-section whose fetch rejected or returned empty renders nothing (not a placeholder row) -
  consistent with "coverage is honest, not uniform": a module's panel legitimately varies in height
  across agencies depending on what that module's backend actually returns for them today.

## Visual system compliance (DESIGN.md, unchanged, cited for the implementer)

- Flat `--surface-2` panel, 1px `--border-subtle`, `--radius` 4px, `overflow:hidden` - no
  `box-shadow` (Flat-Body Rule).
- Every KPI figure, count, and mono value: JetBrains Mono, `tabular-nums` (Mono-Figure Rule).
- Section/module labels: UPPERCASE Inter, 9–10px, 0.06–0.12em tracking (UPPERCASE-Micro Rule) - no
  new eyebrow/kicker above the panel header itself (craft-floor's kicker ban); the module label
  *is* the header, not a label above a bigger heading.
- Status colour (if a KPI in the strip carries a `good`/`warn`/`crit` state) is a 1px top rule or a
  dot + wash, never a `border-left` slab.
- No sparkline-as-decoration: the trend section only renders `TrendLineChart`/`MultiLineChart` fed
  by real fetched points, never a synthetic mini-chart standing in for content.
- Responsive: Operations panels stack to one column at the existing `minmax(280px,1fr)` module-card
  breakpoint behavior already documented for agency/module cards; the table sub-section gets
  horizontal scroll inside its own body at ≤768px per the existing Data Table mobile rule.

## Testing

- Extend `tests/unit/agency-module-summary.test.ts`'s completeness check: any module with a `trend`
  or `table` key must have a working `points`/`rows` mapper (type-level + a unit case per module
  that sets one).
- New `tests/unit/agency-module-panel.test.ts` (component test, `@vue/test-utils`, mirroring the
  existing `agency-command-centre.test.ts` mocking pattern): a module with `trend`+`table` data
  renders both sub-sections; a module with a rejected trend fetch renders the KPI strip and table
  but no trend section (not a broken chart); a module with empty `rows()` renders no table section.
- Manual verification (per this project's established precedent for wiring/visual tasks): start the
  dev server, log in as an agency with several full-scope modules (e.g. `kenha.admin@uapts.test`)
  and confirm the Operations panels render real numbers/trends/tables, then an agency with fewer
  full-scope modules (e.g. `lapsset.admin@uapts.test`) to confirm graceful degradation.

## Self-review notes

- M07a Aviation and M03 Fleet currently have no confirmed trend precedent in this repo - they ship
  KPI+table (Fleet) or KPI-only (Aviation, pending `capitalWorks()` shape check) in this pass. This
  is a real, acknowledged risk that some modules end up less "rich" than others; that is the
  intended honest-coverage behavior, not a gap to force-fill later.
- The Operations/Cross-Agency split changes the page's vertical density noticeably for agencies
  with many full-scope modules (e.g. KeNHA's 6). This is an accepted trade-off of Approach B agreed
  with the user over Approach C's (rejected) top-N limiting.
