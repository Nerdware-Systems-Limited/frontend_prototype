# Agency Command Centre Richness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every agency's `/dashboard` command centre shows its full-scope modules as rich panels (KPI strip + trend chart + recent-activity table, each independently honest about missing data) instead of flat KPI tiles, while its read-scope cross-agency modules stay as today's simple muted tiles.

**Architecture:** `AgencyCommandCentre.vue` splits its resolved modules into two groups by `resolveRoute(entry.route).scopeLevel` (unchanged resolution logic): full-scope modules render via a new `AgencyModulePanel.vue` (one per module, self-fetching, self-degrading); read-scope modules keep rendering via the existing flat `KpiCard` grid. `agencyModuleSummary.ts` gains optional `trend`/`table` config per module, sourced from fields already present in the same `summary()` response the KPI tile already fetches (no new API calls for 6 of 7 operational modules - see Deviation from spec below) plus one extra, already-used endpoint for Safety's incident table.

**Tech Stack:** Vue 3 `<script setup>`, Nuxt 4 auto-imports, Vitest + `@vue/test-utils`, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-19-agency-command-centre-richness-design.md`

## Deviation from spec (discovered during planning - read before starting)

The spec's per-module data-source table assumed most trend/table content would need a **separate**
fetch per sub-section. Re-reading each operational module's actual `Summary` TypeScript interface
(the same object `entry.fetch()` already returns for the KPI tile) found that 6 of 7 modules already
embed exactly the array shape needed for a trend or a table **in that same response** - `TrafficSummary.volume_24h`,
`PTSummary.revenue_24h` / `.expiring_licences`, `SafetySummary.fatality_trend_30d`,
`FleetSummary.top_breaches_24h`, `InfrastructureSummary.construction.portfolio_by_corridor`,
`MaritimeCargoSummary.ports`, `RailwaySummary.live_operations`. Only Safety's recent-incidents table
needs a second, already-existing endpoint (`useSafety().activeIncidents()`). This is strictly fewer
API calls than the spec assumed, changes no architecture, and is still 100% grounded in real,
already-typed response shapes (never a guessed field name) - the exact discipline the spec asked
for. `ModuleSummaryEntry.table.fetch` is therefore optional (only Safety sets it); `trend`/`table`
mappers read the same `summary` object by default.

## Global Constraints

- No new backend endpoints (spec non-goal, still holds - see Deviation above for how this changed the mechanism, not the rule).
- No change to `NationalCommandCentre.vue`, RBAC resolution, or `access-control.json` (spec non-goal).
- No fabricated data: a module with no genuine trend/table data behind it renders no chart/table sub-section - never an invented placeholder (spec non-goal, product-binding rule).
- No nested cards: the new panel *is* the card (flat `--surface-2`, 1px `--border-subtle`, `--radius`); its internal KPI row is a flat metric-strip, never a `KpiCard` nested inside it (impeccable craft-floor check).
- Every figure/count renders in JetBrains Mono with `tabular-nums` via the existing global `.num` class (`app/assets/css/theme.css:808`) - never redefine mono/tabular-nums locally.
- UPPERCASE Inter 9–10px for labels/section headers, sentence case for body - DESIGN.md's UPPERCASE-Micro Rule.
- Per this session: **do not run `git commit`** in any task's steps. Verification and moving to the next task takes the place of the plan template's usual "Commit" step - the user commits manually.

---

### Task 1: Extend `agencyModuleSummary.ts` with trend/table config

**Files:**
- Modify: `app/config/agencyModuleSummary.ts`
- Modify: `tests/unit/agency-module-summary.test.ts`

**Interfaces:**
- Consumes: nothing new - `useSafety` is already imported in this file for other modules' fetches... actually it is not currently imported; this task adds it to the existing `import { ... } from '~/composables/api'` line since M05's KPI `fetch` already calls `useSafety().summary()` two lines below - confirm `useSafety` is already in that import list (it is, per the file's current contents) before adding `activeIncidents()` usage.
- Produces: `TrendPoint`, `ModuleSummaryTrend`, `ModuleSummaryTableColumn`, `ModuleSummaryTable` types; `ModuleSummaryEntry.trend?` and `.table?` fields - consumed by Task 2 (`AgencyModulePanel.vue`) and Task 3 (`AgencyCommandCentre.vue`, for read-scope modules which ignore `trend`/`table` entirely).

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/agency-module-summary.test.ts` (append inside the existing `describe('agencyModuleSummary registry', ...)` block, after its last `it`):

```typescript
  it('M02 trend.points maps volume_24h into chart points, empty array when absent', () => {
    const entry = agencyModuleSummary.M02
    expect(entry.trend).toBeDefined()
    const points = entry.trend!.points({ volume_24h: [{ hour: '2026-01-01T08:00:00Z', volume: 120 }] })
    expect(points).toEqual([{ value: 120, label: '08:00' }])
    expect(entry.trend!.points(undefined)).toEqual([])
  })

  it('M03 table.rows maps top_breaches_24h, empty array when absent', () => {
    const entry = agencyModuleSummary.M03
    expect(entry.table).toBeDefined()
    const rows = entry.table!.rows(
      { top_breaches_24h: [{ geofence__zone_name: 'Yard A', geofence__zone_type: 'depot', c: 3 }] },
      undefined,
    )
    expect(rows).toEqual([{ zone: 'Yard A', type: 'depot', breaches: 3 }])
    expect(entry.table!.rows(undefined, undefined)).toEqual([])
  })

  it('M04 trend.points maps revenue_24h and table.rows maps expiring_licences', () => {
    const entry = agencyModuleSummary.M04
    const points = entry.trend!.points({ revenue_24h: [{ hour: '2026-01-01T09:00:00Z', total_kes: 5000 }] })
    expect(points).toEqual([{ value: 5000, label: '09:00' }])
    const rows = entry.table!.rows(
      { expiring_licences: [{ license_number: 'PSV-1', sacco__sacco_name: 'City Hoppa', expiry_date: '2026-02-01', status: 'active' }] },
      undefined,
    )
    expect(rows).toEqual([{ license: 'PSV-1', sacco: 'City Hoppa', expiry: '2026-02-01', status: 'active' }])
  })

  it('M05 trend.points maps fatality_trend_30d and table.rows maps a separate activeIncidents() fetch', () => {
    const entry = agencyModuleSummary.M05
    const points = entry.trend!.points({ fatality_trend_30d: [{ day: '2026-01-05', fatalities: 2 }] })
    expect(points.length).toBe(1)
    expect(points[0].value).toBe(2)
    expect(entry.trend!.color).toBe('destructive')
    expect(entry.table!.fetch).toBeTypeOf('function')
    const rows = entry.table!.rows(undefined, { results: [{ reference_code: 'INC-1', incident_type: 'collision', severity: 'major', status: 'active' }] })
    expect(rows).toEqual([{ ref: 'INC-1', type: 'collision', severity: 'major', status: 'active' }])
    expect(entry.table!.rows(undefined, undefined)).toEqual([])
  })

  it('M06 table.rows maps construction.portfolio_by_corridor', () => {
    const entry = agencyModuleSummary.M06
    const rows = entry.table!.rows(
      { construction: { portfolio_by_corridor: [{ corridor: 'A104', count: 4, contract_sum: 900000, disbursed: 400000 }] } },
      undefined,
    )
    expect(rows).toEqual([{ corridor: 'A104', projects: 4, contract: 900000, disbursed: 400000 }])
  })

  it('M07a Aviation has no trend or table (no confirmed source)', () => {
    const entry = agencyModuleSummary.M07a
    expect(entry.trend).toBeUndefined()
    expect(entry.table).toBeUndefined()
  })

  it('M07b table.rows maps ports', () => {
    const entry = agencyModuleSummary.M07b
    const rows = entry.table!.rows(
      { ports: [{ port_name: 'Mombasa', cargo_tonnes: 5000, cargo_teu: 300, gate_events: 12 }] },
      undefined,
    )
    expect(rows).toEqual([{ port: 'Mombasa', tonnes: 5000, teu: 300, gateEvents: 12 }])
  })

  it('M08 table.rows maps live_operations', () => {
    const entry = agencyModuleSummary.M08
    const rows = entry.table!.rows(
      { live_operations: [{ train_number: 'SGR-01', origin_code: 'MSA', destination_code: 'NBO', status: 'in_transit', delay_arrival_min: 5 }] },
      undefined,
    )
    expect(rows).toEqual([{ train: 'SGR-01', route: 'MSA → NBO', status: 'in_transit', delay: 5 }])
  })

  it('every table.rows and trend.points caps output at 6 rows / handles a large input without throwing', () => {
    const manyBreaches = Array.from({ length: 20 }, (_, i) => ({ geofence__zone_name: `Z${i}`, geofence__zone_type: 'x', c: i }))
    expect(agencyModuleSummary.M03.table!.rows({ top_breaches_24h: manyBreaches }, undefined).length).toBe(6)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/agency-module-summary.test.ts`
Expected: FAIL - `entry.trend` / `entry.table` are `undefined` on every module (the fields don't exist yet).

- [ ] **Step 3: Add the new types and the `useSafety`-backed table fetch**

In `app/config/agencyModuleSummary.ts`, the import line already reads:

```typescript
import {
  useTraffic, useFleet, usePublicTransport, useSafety, useInfrastructure,
  useAviationInfrastructure, useMaritimeCargo, useRailway,
} from '~/composables/api'
```

Leave it unchanged (`useSafety` is already there). Add these types directly below the existing `ModuleSummaryKpi`/`ModuleSummaryEntry` interfaces (after the `ModuleSummaryEntry` interface, before `export const OPERATIONAL_MODULES`):

```typescript
export interface TrendPoint {
  value: number
  label: string
}

export interface ModuleSummaryTrend {
  /** Chart section heading, e.g. "Volume Trend (24h)". */
  title: string
  /** 'destructive' for fatality/casualty-style series; omit for the default institutional-blue line. */
  color?: 'destructive'
  /** Reads the same object `fetch()` returns for the KPI tile. Must return [] for null/undefined/missing-field input - never throw. */
  points: (summary: any) => TrendPoint[]
}

export interface ModuleSummaryTableColumn {
  key: string
  label: string
  numeric?: boolean
}

export interface ModuleSummaryTable {
  /** Only set when the table needs data beyond what `fetch()` already returns (Safety's incident list is the only current case). */
  fetch?: () => Promise<any>
  columns: ModuleSummaryTableColumn[]
  /** `summary` is the same object `fetch()` returns for the KPI tile; `extra` is this table's own `fetch()` result (undefined when `fetch` is unset or rejected). Must return [] for missing/malformed input - never throw. */
  rows: (summary: any, extra: any) => Record<string, string | number | null>[]
  viewAllRoute: string
  viewAllLabel: string
}
```

Then add `trend?: ModuleSummaryTrend` and `table?: ModuleSummaryTable` as new optional fields on the existing `ModuleSummaryEntry` interface (find it above `OPERATIONAL_MODULES` and add these two lines inside it, after `kpis: ModuleSummaryKpi[]`):

```typescript
  trend?: ModuleSummaryTrend
  table?: ModuleSummaryTable
```

Add two small local helpers just above `export const agencyModuleSummary` (not exported - used only by the mappers below):

```typescript
function fmtHour(iso: string | undefined): string {
  if (!iso) return ''
  try { return `${new Date(iso).getHours().toString().padStart(2, '0')}:00` } catch { return iso }
}

function fmtDay(iso: string | undefined): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }) } catch { return iso }
}
```

- [ ] **Step 4: Add `trend`/`table` to the M02 entry**

Find the `M02:` entry in `agencyModuleSummary` and add `trend` after its `kpis` array closes (i.e. after the `],` that ends `kpis: [...]`, still inside the `M02: { ... }` object):

```typescript
    trend: {
      title: 'Volume Trend (24h)',
      points: (s: any) => (s?.volume_24h ?? []).map((h: any) => ({ value: h.volume, label: fmtHour(h.hour) })),
    },
```

- [ ] **Step 5: Add `table` to the M03 entry**

Same pattern, inside `M03: { ... }`, after its `kpis` array:

```typescript
    table: {
      columns: [
        { key: 'zone', label: 'Geofence' },
        { key: 'type', label: 'Type' },
        { key: 'breaches', label: 'Breaches (24h)', numeric: true },
      ],
      rows: (s: any) => (s?.top_breaches_24h ?? []).slice(0, 6).map((b: any) => ({
        zone: b.geofence__zone_name ?? '-', type: b.geofence__zone_type ?? '-', breaches: b.c ?? 0,
      })),
      viewAllRoute: '/fleet/geofences',
      viewAllLabel: 'View all geofences →',
    },
```

- [ ] **Step 6: Add `trend` and `table` to the M04 entry**

Inside `M04: { ... }`, after its `kpis` array:

```typescript
    trend: {
      title: 'Revenue Trend (24h)',
      points: (s: any) => (s?.revenue_24h ?? []).map((h: any) => ({ value: h.total_kes, label: fmtHour(h.hour) })),
    },
    table: {
      columns: [
        { key: 'license', label: 'Licence #' },
        { key: 'sacco', label: 'SACCO' },
        { key: 'expiry', label: 'Expires' },
        { key: 'status', label: 'Status' },
      ],
      rows: (s: any) => (s?.expiring_licences ?? []).slice(0, 6).map((l: any) => ({
        license: l.license_number ?? '-', sacco: l.sacco__sacco_name ?? '-', expiry: l.expiry_date ?? '-', status: l.status ?? '-',
      })),
      viewAllRoute: '/public-transport/driver-licensing',
      viewAllLabel: 'View all licences →',
    },
```

- [ ] **Step 7: Add `trend` and `table` to the M05 entry**

Inside `M05: { ... }`, after its `kpis` array:

```typescript
    trend: {
      title: 'Fatality Trend (30d)',
      color: 'destructive',
      points: (s: any) => (s?.fatality_trend_30d ?? []).map((d: any) => ({ value: d.fatalities, label: fmtDay(d.day) })),
    },
    table: {
      fetch: () => useSafety().activeIncidents(),
      columns: [
        { key: 'ref', label: 'Reference' },
        { key: 'type', label: 'Type' },
        { key: 'severity', label: 'Severity' },
        { key: 'status', label: 'Status' },
      ],
      rows: (_s: any, extra: any) => ((extra?.results ?? []) as any[]).slice(0, 6).map(i => ({
        ref: i.reference_code ?? '-', type: i.incident_type ?? '-', severity: i.severity ?? '-', status: i.status ?? '-',
      })),
      viewAllRoute: '/safety/incidents',
      viewAllLabel: 'View all incidents →',
    },
```

- [ ] **Step 8: Add `table` to the M06 entry**

Inside `M06: { ... }`, after its `kpis` array:

```typescript
    table: {
      columns: [
        { key: 'corridor', label: 'Corridor' },
        { key: 'projects', label: 'Projects', numeric: true },
        { key: 'contract', label: 'Contract Sum', numeric: true },
        { key: 'disbursed', label: 'Disbursed', numeric: true },
      ],
      rows: (s: any) => (s?.construction?.portfolio_by_corridor ?? []).slice(0, 6).map((c: any) => ({
        corridor: c.corridor ?? '-', projects: c.count ?? 0, contract: c.contract_sum ?? 0, disbursed: c.disbursed ?? 0,
      })),
      viewAllRoute: '/infrastructure/projects',
      viewAllLabel: 'View all projects →',
    },
```

- [ ] **Step 9: M07a stays untouched (no trend/table - no confirmed source)**

No change to the `M07a: { ... }` entry. This step exists so the task list matches the test in Step 1 asserting `M07a` has neither.

- [ ] **Step 10: Add `table` to the M07b entry**

Inside `M07b: { ... }`, after its `kpis` array:

```typescript
    table: {
      columns: [
        { key: 'port', label: 'Port' },
        { key: 'tonnes', label: 'Cargo (t)', numeric: true },
        { key: 'teu', label: 'TEU', numeric: true },
        { key: 'gateEvents', label: 'Gate Events', numeric: true },
      ],
      rows: (s: any) => (s?.ports ?? []).slice(0, 6).map((p: any) => ({
        port: p.port_name ?? '-', tonnes: p.cargo_tonnes ?? 0, teu: p.cargo_teu ?? 0, gateEvents: p.gate_events ?? 0,
      })),
      viewAllRoute: '/maritime/cargo',
      viewAllLabel: 'View all cargo activity →',
    },
```

- [ ] **Step 11: Add `table` to the M08 entry**

Inside `M08: { ... }`, after its `kpis` array:

```typescript
    table: {
      columns: [
        { key: 'train', label: 'Train' },
        { key: 'route', label: 'Route' },
        { key: 'status', label: 'Status' },
        { key: 'delay', label: 'Delay (min)', numeric: true },
      ],
      rows: (s: any) => (s?.live_operations ?? []).slice(0, 6).map((o: any) => ({
        train: o.train_number ?? '-', route: `${o.origin_code ?? '?'} → ${o.destination_code ?? '?'}`, status: o.status ?? '-', delay: o.delay_arrival_min ?? 0,
      })),
      viewAllRoute: '/railway/live',
      viewAllLabel: 'View live operations →',
    },
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/agency-module-summary.test.ts`
Expected: PASS, all tests including the pre-existing completeness ones.

- [ ] **Step 13: Run the full suite to check for regressions**

Run: `npx vitest run`
Expected: same pass/fail counts as before this task (pre-existing `tests/integration/live.test.ts` failures are unrelated and expected when the backend isn't reachable).

---

### Task 2: `AgencyModulePanel.vue`

**Files:**
- Create: `app/components/AgencyModulePanel.vue`
- Test: `tests/unit/agency-module-panel.test.ts`

**Interfaces:**
- Consumes: `ModuleSummaryEntry` (Task 1, imported by the test fixture and by whatever mounts this component in Task 3), `TrendLineChart.vue` (existing, props `points`/`color`/`height`), `useTheme()` (existing, `{ resolved: Ref<'light'|'dark'> }`).
- Produces: `<AgencyModulePanel :entry="ModuleSummaryEntry" :module-id="string" />` - no other props, no emits. Consumed by `AgencyCommandCentre.vue` in Task 3.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agency-module-panel.test.ts`:

```typescript
// tests/unit/agency-module-panel.test.ts
// ─────────────────────────────────────────────────────────────────────
// AgencyModulePanel renders a KPI strip always, a trend chart only when
// entry.trend exists AND its points() returns real data, a table only
// when entry.table exists AND its rows() returns real data - and never
// crashes when a sub-section's fetch is missing or rejects (the same
// honest-empty-state discipline as KpiCard, just for a whole panel).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

beforeAll(() => {
  ;(globalThis as any).useTheme = () => ({ resolved: ref('light') })
})

import AgencyModulePanel from '~/components/AgencyModulePanel.vue'
import type { ModuleSummaryEntry } from '~/config/agencyModuleSummary'

function mountPanel(entry: ModuleSummaryEntry) {
  return mount(AgencyModulePanel, {
    props: { entry, moduleId: 'M99' },
    global: {
      stubs: { NuxtLink: true, TrendLineChart: true },
      renderStubDefaultSlot: true,
    },
  })
}

describe('AgencyModulePanel', () => {
  it('renders the KPI strip from a resolved fetch', async () => {
    const entry: ModuleSummaryEntry = {
      label: 'Test Module', route: '/test', period: 'LIVE',
      fetch: () => Promise.resolve({ kpis: { count: 42 } }),
      kpis: [{ label: 'Count', get: (s: any) => s?.kpis?.count ?? null }],
    }
    const w = mountPanel(entry)
    await flushPromises()
    expect(w.text()).toContain('42')
    expect(w.text()).toContain('Test Module')
  })

  it('shows a per-KPI "No data" without crashing when the fetch rejects', async () => {
    const entry: ModuleSummaryEntry = {
      label: 'Broken Module', route: '/broken', period: 'LIVE',
      fetch: () => Promise.reject(new Error('feed down')),
      kpis: [{ label: 'Count', get: (s: any) => s?.kpis?.count ?? null }],
    }
    const w = mountPanel(entry)
    await flushPromises()
    expect(w.text()).toMatch(/no data/i)
  })

  it('renders a trend section only when trend.points returns real data', async () => {
    const withTrend: ModuleSummaryEntry = {
      label: 'Trend Module', route: '/trend', period: 'LIVE',
      fetch: () => Promise.resolve({ series: [{ v: 1 }] }),
      kpis: [{ label: 'X', get: () => 1 }],
      trend: { title: 'My Trend', points: (s: any) => (s?.series ?? []).map((p: any) => ({ value: p.v, label: 'd' })) },
    }
    const w = mountPanel(withTrend)
    await flushPromises()
    expect(w.text()).toContain('My Trend')

    const emptyTrend: ModuleSummaryEntry = {
      ...withTrend,
      fetch: () => Promise.resolve({ series: [] }),
    }
    const w2 = mountPanel(emptyTrend)
    await flushPromises()
    expect(w2.text()).not.toContain('My Trend')
  })

  it("does not crash when table.fetch is unset and rows() reads only the KPI summary", async () => {
    const entry: ModuleSummaryEntry = {
      label: 'Table Module', route: '/table', period: 'LIVE',
      fetch: () => Promise.resolve({ items: [{ name: 'Alpha' }] }),
      kpis: [{ label: 'X', get: () => 1 }],
      table: {
        columns: [{ key: 'name', label: 'Name' }],
        rows: (s: any) => (s?.items ?? []).map((i: any) => ({ name: i.name })),
        viewAllRoute: '/table/all',
        viewAllLabel: 'View all →',
      },
    }
    const w = mountPanel(entry)
    await flushPromises()
    expect(w.text()).toContain('Alpha')
    expect(w.text()).toContain('View all →')
  })

  it("does not crash when table.fetch is set but rejects (e.g. the mocked composable is missing that method)", async () => {
    const entry: ModuleSummaryEntry = {
      label: 'Table Module', route: '/table', period: 'LIVE',
      fetch: () => Promise.resolve({ items: [] }),
      kpis: [{ label: 'X', get: () => 1 }],
      table: {
        fetch: () => { throw new Error('method not mocked') },
        columns: [{ key: 'name', label: 'Name' }],
        rows: (_s: any, extra: any) => (extra?.results ?? []).map((i: any) => ({ name: i.name })),
        viewAllRoute: '/table/all',
        viewAllLabel: 'View all →',
      },
    }
    expect(() => mountPanel(entry)).not.toThrow()
    const w = mountPanel(entry)
    await flushPromises()
    expect(w.text()).not.toContain('View all →') // no rows -> table section omitted
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/agency-module-panel.test.ts`
Expected: FAIL - `Failed to resolve import "~/components/AgencyModulePanel.vue"`.

- [ ] **Step 3: Implement `AgencyModulePanel.vue`**

Create `app/components/AgencyModulePanel.vue`:

```vue
<template>
  <div class="card amp-panel">
    <div class="card-header amp-header">
      <span>{{ entry.label }}</span>
      <NuxtLink :to="entry.route" class="amp-view-link">View full workspace →</NuxtLink>
    </div>
    <div class="card-body">
      <div class="metric-strip" role="group" :aria-label="`${entry.label} key metrics`">
        <div v-for="k in kpiRows" :key="k.label" class="metric-item">
          <span class="metric-label">{{ k.label }}</span>
          <span class="metric-value">{{ k.display }}</span>
          <span class="metric-sub">{{ k.sub }}</span>
        </div>
      </div>

      <template v-if="entry.trend && trendPoints.length">
        <div class="amp-subhead">{{ entry.trend.title }}</div>
        <TrendLineChart :points="trendPoints" :height="140" :color="trendColor" />
      </template>

      <template v-if="entry.table && tableRows.length">
        <div class="amp-subhead">Recent Activity</div>
        <div class="amp-table-wrap">
          <table class="amp-table">
            <thead>
              <tr>
                <th v-for="c in entry.table.columns" :key="c.key">{{ c.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in tableRows" :key="i">
                <td v-for="c in entry.table.columns" :key="c.key" :class="{ num: c.numeric }">{{ row[c.key] ?? '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <NuxtLink :to="entry.table.viewAllRoute" class="amp-view-link">{{ entry.table.viewAllLabel }}</NuxtLink>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ModuleSummaryEntry } from '~/config/agencyModuleSummary'

const props = defineProps<{
  entry: ModuleSummaryEntry
  moduleId: string
}>()

const theme = useTheme()
const trendColor = computed(() => {
  if (props.entry.trend?.color !== 'destructive') return undefined
  return theme.resolved.value === 'dark' ? '#F26559' : '#DA3B30'
})

const loading = ref(true)
const fetchFailed = ref(false)
const summaryData = ref<any>(null)
const tableExtra = ref<any>(undefined)

async function load() {
  loading.value = true
  fetchFailed.value = false

  // Deferring each fetch call inside a `.then()` turns a *synchronous* throw
  // (e.g. a test mock missing the method `table.fetch` calls) into a
  // rejected promise `allSettled` can catch, instead of an uncaught
  // exception that would crash `load()` before either promise resolves.
  const [summaryRes, tableRes] = await Promise.allSettled([
    Promise.resolve().then(() => props.entry.fetch()),
    props.entry.table?.fetch
      ? Promise.resolve().then(() => props.entry.table!.fetch!())
      : Promise.resolve(undefined),
  ])

  if (summaryRes.status === 'fulfilled') {
    summaryData.value = summaryRes.value
  } else {
    fetchFailed.value = true
  }
  tableExtra.value = tableRes.status === 'fulfilled' ? tableRes.value : undefined

  loading.value = false
}

onMounted(load)

const kpiRows = computed(() => props.entry.kpis.map((k) => {
  const value = summaryData.value != null ? k.get(summaryData.value) : null
  return {
    label: k.label,
    display: value == null ? '-' : `${value}${k.unit ? ` ${k.unit}` : ''}`,
    sub: value != null ? '' : (loading.value ? 'Loading…' : (fetchFailed.value ? 'Feed unavailable' : 'No data')),
  }
}))

const trendPoints = computed(() =>
  props.entry.trend && summaryData.value != null ? props.entry.trend.points(summaryData.value) : [],
)

const tableRows = computed(() =>
  props.entry.table ? props.entry.table.rows(summaryData.value, tableExtra.value) : [],
)
</script>

<style scoped>
.amp-panel { display: flex; flex-direction: column; }
.amp-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.amp-view-link { font-size: 11px; color: var(--fg-2); white-space: nowrap; }
.amp-view-link:hover { color: var(--primary); }

.metric-strip {
  display: flex; flex-wrap: wrap;
  background: var(--surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius);
  margin-bottom: 14px;
}
.metric-item {
  flex: 1 1 130px; min-width: 110px;
  padding: 8px 12px;
  border-left: 1px solid var(--border-subtle);
  display: flex; flex-direction: column; gap: 2px;
}
.metric-item:first-child { border-left: 0; }
.metric-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--fg-3); }
.metric-value { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 600; color: var(--fg-1); line-height: 1.2; }
.metric-sub { font-size: 10px; color: var(--danger-fg); }

.amp-subhead { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--fg-2); margin: 4px 0 8px; }

.amp-table-wrap { overflow-x: auto; }
.amp-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.amp-table th {
  background: var(--surface-1); color: var(--fg-3);
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
  padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--border-strong);
}
.amp-table td { padding: 6px 10px; font-size: 12px; color: var(--fg-1); border-bottom: 1px solid var(--border-subtle); }
.amp-table tr:last-child td { border-bottom: 0; }

@media (max-width: 640px) {
  .amp-table { min-width: 420px; }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/agency-module-panel.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npx vitest run`
Expected: same as Task 1's Step 13, plus these 5 new passes.

---

### Task 3: Wire `AgencyCommandCentre.vue` to the two-zone layout

**Files:**
- Modify: `app/components/AgencyCommandCentre.vue`
- Modify: `tests/unit/agency-command-centre.test.ts`

**Interfaces:**
- Consumes: `AgencyModulePanel.vue` (Task 2), `agencyModuleSummary`/`OPERATIONAL_MODULES` (Task 1), `useAccessControl()`'s existing `agency`/`agencyCode`/`roleTier`/`resolveRoute`/`canAccessRoute`/`moduleScope` (all already exist - `moduleScope` was added in an earlier session, confirm it's still exported from `useAccessControl.ts`'s return object before using it).

- [ ] **Step 1: Read the current file in full**

Read `app/components/AgencyCommandCentre.vue` end to end (it's short, ~133 lines) so the replacement in Step 3 is a deliberate rewrite, not a guess at what's already there.

- [ ] **Step 2: Update the failing/changing tests first**

Replace the full contents of `tests/unit/agency-command-centre.test.ts`:

```typescript
// tests/unit/agency-command-centre.test.ts
// ─────────────────────────────────────────────────────────────────────
// AgencyCommandCentre renders an AgencyModulePanel per full-scope module
// (Operations section) and a muted KpiCard per read-scope module
// (Cross-Agency Visibility section), nothing for denied modules, and
// "No data" (never a fabricated value) when a module's API call fails.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
// AgencyCommandCentre calls Nuxt's auto-imported useAccessControl() in
// setup. Outside Nuxt's build there's no auto-import, so wire the *real*
// composable through globalThis (not a mock) - these tests exist to prove
// RBAC resolution against the real access-control.json, same idiom the
// KpiCard test uses for useRouter()/useRoute().
import { useAccessControl } from '~/composables/useAccessControl'
// Nuxt also auto-registers every app/components/*.vue file as a global
// component (no explicit import needed in production). Outside Nuxt's
// build, @vue/test-utils needs them registered explicitly so the real
// components render, rather than being silently skipped - see
// `global.components` on the mount() calls below.
import KpiCard from '~/components/KpiCard.vue'
import EmptyState from '~/components/EmptyState.vue'
import SectionTitle from '~/components/SectionTitle.vue'
import AgencyModulePanel from '~/components/AgencyModulePanel.vue'

beforeAll(() => {
  ;(globalThis as any).useRouter = () => ({ push: vi.fn(), replace: vi.fn() })
  ;(globalThis as any).useRoute  = () => ({ query: {} })
  ;(globalThis as any).useAccessControl = useAccessControl
  ;(globalThis as any).useTheme = () => ({ resolved: ref('light') })
})

const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

// Fleet (NTSA full) resolves with real data including a breach for its
// table; Safety (NTSA full) rejects, to prove the honest-empty-state path
// (never a fabricated number on failure) survives the new panel structure.
vi.mock('~/composables/api', async () => {
  const actual = await vi.importActual<any>('~/composables/api')
  return {
    ...actual,
    useFleet: () => ({
      summary: () => Promise.resolve({
        kpis: { live_vehicles: 42, trips_7d: 100 },
        governor_compliance: { online_pct: 91 },
        top_breaches_24h: [{ geofence__zone_name: 'Yard A', geofence__zone_type: 'depot', c: 2 }],
      }),
    }),
    useSafety: () => ({
      summary: () => Promise.reject(new Error('feed down')),
      activeIncidents: () => Promise.reject(new Error('feed down')),
    }),
  }
})

import AgencyCommandCentre from '~/components/AgencyCommandCentre.vue'

function setUser(agency_code: string | null, role_type: string) {
  userRef.value = { id: 'u1', email: 'u1@example.com', agency_code, role_type }
}

beforeEach(() => { userRef.value = null; vi.clearAllMocks() })

const mountCentre = () =>
  mount(AgencyCommandCentre, {
    global: {
      components: { KpiCard, EmptyState, SectionTitle, AgencyModulePanel },
      stubs: { NuxtLink: true, TrendLineChart: true },
      // Every tile/link now carries `:to`, so KpiCard's/NuxtLink's root
      // becomes a (stubbed) NuxtLink - Vue Test Utils' auto-stubs drop
      // default-slot content unless this is set, which would otherwise
      // hide the KPI value/label/reason text these tests assert on.
      renderStubDefaultSlot: true,
    },
  })

describe('AgencyCommandCentre', () => {
  it('renders an Operations panel with a real KPI value for a full-scope module', async () => {
    setUser('NTSA', 'admin') // NTSA grants.full includes M03 Fleet
    const w = mountCentre()
    await flushPromises()
    expect(w.text()).toContain('Operations')
    expect(w.text()).toContain('42')
  })

  it('renders the Fleet panel\'s recent-activity table from an embedded summary field', async () => {
    setUser('NTSA', 'admin')
    const w = mountCentre()
    await flushPromises()
    expect(w.text()).toContain('Yard A')
  })

  it("shows No data, not a fabricated number, when a full-scope module's fetch rejects", async () => {
    setUser('NTSA', 'admin') // NTSA grants.full includes M05 Safety
    const w = mountCentre()
    await flushPromises()
    expect(w.text()).toMatch(/no data/i)
  })

  it('does not render anything for a module the agency has no access to at all', async () => {
    setUser('KENHA', 'admin') // KENHA denies M04 Public Transport outright
    const w = mountCentre()
    await flushPromises()
    expect(w.text()).not.toContain('Public Transport')
  })

  it('renders the agency name as the page heading', async () => {
    setUser('KPA', 'admin')
    const w = mountCentre()
    await flushPromises()
    expect(w.text()).toContain('Kenya Ports Authority')
  })

  it('renders the identity line from real domain + full-scope module labels, never invented copy', async () => {
    setUser('KENHA', 'admin')
    const w = mountCentre()
    await flushPromises()
    expect(w.text()).toContain('Roads and Highways')
    expect(w.text()).toContain('Manages:')
  })

  it('keeps read-scope modules as muted KpiCard tiles under Cross-Agency Visibility (NTSA has explicit read-only access to /traffic)', async () => {
    setUser('NTSA', 'admin')
    const w = mountCentre()
    await flushPromises()
    expect(w.text()).toContain('Cross-Agency Visibility')
    expect(w.find('.kpi-card--muted').exists()).toBe(true)
  })

  it('quick links render human labels, not raw paths, and never duplicate an already-shown module route', async () => {
    setUser('KENHA', 'admin')
    const w = mountCentre()
    await flushPromises()
    expect(w.text()).not.toContain('/infrastructure/bridges')
    expect(w.text()).toContain('Bridges')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/agency-command-centre.test.ts`
Expected: FAIL - the current component has no "Operations"/"Cross-Agency Visibility" section labels, no identity line, and quick links still render raw paths.

- [ ] **Step 4: Replace `AgencyCommandCentre.vue`**

Replace the full contents of `app/components/AgencyCommandCentre.vue`:

```vue
<template>
  <header class="acc-header">
    <div class="acc-header-main">
      <h1>{{ agency?.name ?? agencyCode }}</h1>
      <p class="acc-dek">{{ agencyCode }} · {{ roleTier }} workspace</p>
      <p v-if="identityLine" class="acc-identity">{{ identityLine }}</p>
    </div>
    <NuxtLink v-if="agency?.landing && agency.landing !== '/dashboard'" :to="agency.landing" class="btn-primary">
      Full workspace →
    </NuxtLink>
  </header>

  <template v-if="operationsTiles.length">
    <SectionTitle>Operations</SectionTitle>
    <div class="acc-panels">
      <AgencyModulePanel v-for="t in operationsTiles" :key="t.moduleId" :entry="t.entry" :module-id="t.moduleId" />
    </div>
  </template>

  <template v-if="visibilityTiles.length">
    <SectionTitle>Cross-Agency Visibility</SectionTitle>
    <div class="kpi-grid">
      <KpiCard
        v-for="t in visibilityTiles" :key="t.moduleId"
        :label="t.entry.label"
        :value="t.primary.value ?? '-'"
        :unit="t.primary.unit"
        :loading="t.loading"
        :unavailable="!t.loading && t.primary.value == null"
        :unavailable-reason="t.fetchFailed ? `${t.entry.label} feed unavailable` : 'No value reported'"
        :description="t.secondary.map(k => `${k.label}: ${k.value ?? '-'}`).join(' · ')"
        class="kpi-card--muted"
        :period="t.entry.period"
        :to="t.entry.route"
      />
    </div>
  </template>

  <EmptyState v-if="!operationsTiles.length && !visibilityTiles.length" message="No modules resolved for this agency yet." />

  <template v-for="g in quickLinkGroups" :key="g.label">
    <SectionTitle>{{ g.label }}</SectionTitle>
    <div class="acc-quicklinks">
      <NuxtLink v-for="l in g.links" :key="l.path" :to="l.path" class="acc-quicklink">
        {{ l.label }}
      </NuxtLink>
    </div>
  </template>
</template>

<script setup lang="ts">
import { agencyModuleSummary, OPERATIONAL_MODULES, type ModuleSummaryEntry } from '~/config/agencyModuleSummary'
import accessControlData from '~/config/access-control.json'

const { agency, agencyCode, roleTier, resolveRoute, canAccessRoute, moduleScope } = useAccessControl()

const settingsData = accessControlData as any

// ── Scope resolution (sync - resolveRoute never awaits anything) ────────

interface ResolvedTile { moduleId: string; entry: ModuleSummaryEntry; scope: 'full' | 'read' }

const resolvedTiles = computed<ResolvedTile[]>(() =>
  OPERATIONAL_MODULES
    .map((id) => {
      const entry = agencyModuleSummary[id]
      return { moduleId: id, entry, scope: resolveRoute(entry.route).scopeLevel as 'full' | 'read' | 'none' }
    })
    .filter((t): t is ResolvedTile => t.scope === 'full' || t.scope === 'read'),
)

const operationsTiles = computed(() => resolvedTiles.value.filter(t => t.scope === 'full'))
const visibilityTiles = computed(() => visibilityTileData.value)

// ── Identity line - domain label(s) + every full-scope module's own
// label, derived entirely from access-control.json data already loaded
// by useAccessControl() - never invented copy (product no-fabricated-data
// rule). Deliberately uses moduleScope() across ALL modules, not just the
// operational ones with a KPI registry entry, so an agency's M12/M09/M13
// full grants show up here too even though they have no panel of their own.
const identityLine = computed(() => {
  const domainLabels = (agency.value?.domains ?? [])
    .map((d: string) => settingsData.domains?.[d]?.label)
    .filter(Boolean)
  const manageLabels = Object.entries<any>(settingsData.modules ?? {})
    .filter(([id]) => id !== 'M01' && moduleScope(id) === 'full')
    .map(([, mod]) => mod.label)
  const parts: string[] = []
  if (domainLabels.length) parts.push(domainLabels.join(', '))
  if (manageLabels.length) parts.push(`Manages: ${manageLabels.join(', ')}`)
  return parts.join(' · ')
})

// ── Read-scope tiles - still a flat KpiCard grid, so this page still owns
// their fetch/loading state itself (KpiCard is presentational, unlike
// AgencyModulePanel which self-fetches for the full-scope Operations
// section above).

interface VisibilityTile {
  moduleId: string
  entry: ModuleSummaryEntry
  loading: boolean
  fetchFailed: boolean
  primary: { value: string | number | null; unit?: string }
  secondary: { label: string; value: string | number | null }[]
}

const visibilityTileData = ref<VisibilityTile[]>([])

async function loadVisibility() {
  const candidates = resolvedTiles.value.filter(t => t.scope === 'read')
  const built: VisibilityTile[] = candidates.map(({ entry, moduleId }) => ({
    moduleId, entry, loading: true, fetchFailed: false, primary: { value: null }, secondary: [],
  }))
  visibilityTileData.value = built

  await Promise.allSettled(built.map(async (tile, idx) => {
    try {
      const summary = await tile.entry.fetch()
      const [primaryKpi, ...restKpis] = tile.entry.kpis
      visibilityTileData.value[idx].primary = { value: primaryKpi.get(summary), unit: primaryKpi.unit }
      visibilityTileData.value[idx].secondary = restKpis.map(k => ({ label: k.label, value: k.get(summary) }))
    } catch {
      visibilityTileData.value[idx].primary = { value: null }
      visibilityTileData.value[idx].fetchFailed = true
    } finally {
      visibilityTileData.value[idx].loading = false
    }
  }))
}

onMounted(loadVisibility)

// ── Quick links - non-operational modules (and any operational module's
// OTHER routes beyond the one already shown as its own tile/panel), with
// human-readable labels instead of raw path strings.

const OPERATIONAL_ROUTE_SET = new Set(OPERATIONAL_MODULES.map(id => agencyModuleSummary[id].route))

const ROUTE_LABEL_OVERRIDES: Record<string, string> = { gis: 'GIS', brt: 'BRT' }

function humanizeRoute(path: string): string {
  const last = path.split('/').filter(Boolean).pop() ?? path
  if (ROUTE_LABEL_OVERRIDES[last]) return ROUTE_LABEL_OVERRIDES[last]
  return last.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const quickLinkGroups = computed(() => {
  const baseline = new Set(Object.keys(settingsData.defaults?.baselineRoutes ?? {}))
  const groups: { label: string; links: { path: string; label: string }[] }[] = []
  for (const mod of Object.values<any>(settingsData.modules)) {
    const links: { path: string; label: string }[] = []
    for (const route of mod.routes as string[]) {
      if (route.includes('[')) continue
      if (baseline.has(route)) continue
      if (OPERATIONAL_ROUTE_SET.has(route)) continue // already shown as its module's own tile/panel
      if (canAccessRoute(route)) links.push({ path: route, label: humanizeRoute(route) })
    }
    if (links.length) groups.push({ label: mod.label, links })
  }
  return groups
})
</script>

<style scoped>
.acc-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
.acc-dek { color:var(--fg-3); font-size:13px; margin:2px 0 0; }
.acc-identity { color:var(--fg-3); font-size:11.5px; margin:4px 0 0; }
.acc-panels { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:14px; margin-bottom:16px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin-bottom:16px; }
.kpi-card--muted { opacity:.7; }
.acc-quicklinks { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
.acc-quicklink { font-size:12px; padding:6px 10px; border:1px solid var(--border-subtle); border-radius:var(--r-sm); color:var(--fg-2); }
.acc-quicklink:hover { border-color:var(--primary); color:var(--primary); }
</style>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/agency-command-centre.test.ts`
Expected: PASS, all 8 tests.

- [ ] **Step 6: Run the full suite one more time**

Run: `npx vitest run`
Expected: same as Task 2's Step 5, plus these passes; no new failures beyond the pre-existing `live.test.ts` ones.

- [ ] **Step 7: Manual verification**

Start the dev server if not already running (`npm run dev`). Log in as `kenha.admin@uapts.test` / `ChangeMe!` (or whatever the live backend's real credentials are) and open `/dashboard`:

- KeNHA's full-scope modules (Road Traffic, Safety & Incidents, Road Infrastructure, plus M09/M12/M13) render as bordered Operations panels, each with a KPI strip and, where the underlying summary has the data, a trend chart or a recent-activity table.
- The header shows a "Roads and Highways · Manages: ..." identity line.
- Any read-scope modules (Fleet, Maritime routes KeNHA has read access to) still render as the flat, muted KpiCard grid under "Cross-Agency Visibility".
- Quick links at the bottom show human labels ("Bridges", not "/infrastructure/bridges") and never repeat a route already shown as its own panel/tile.

Then log in as an agency with fewer full-scope modules (e.g. `lapsset.admin@uapts.test`) and confirm the page degrades gracefully - few or no Operations panels, mostly quick links, no console errors, no crashes when a module's chart/table data isn't present.

- [ ] **Step 8: Run the mechanical impeccable detector**

Run: `"C:/Users/LastOS/.claude/plugins/cache/impeccable/impeccable/4.2.2/skills/impeccable/scripts/impeccable" detect --json app/components/AgencyModulePanel.vue app/components/AgencyCommandCentre.vue`

Address anything it flags before considering this task done.

---

## Self-review notes (for whoever executes this plan)

- Task 1's M02/M04/M05 `trend.points()` mappers assume `volume_24h`/`revenue_24h`/`fatality_trend_30d` entries carry an ISO-ish `hour`/`day` string `new Date()` can parse - this matches every other date-handling helper already in this codebase (e.g. `traffic/analytics.vue`'s own `fmtHour`), so no new risk is introduced, but confirm against a real live-backend response if one becomes reachable during implementation, same as this project's established "verify against real code/data before trusting a plan's assumption" discipline.
- M07a Aviation and M03 Fleet's trend both stay absent in this plan (M03 gets a table only) - this is the intended honest-coverage outcome per the spec's non-goals, not a gap to silently fill later.
- The Deviation section at the top of this plan changed the spec's assumed "separate fetch per sub-section" mechanism to "read the same summary() response" for 6 of 7 modules. If a future change to any of these `Summary` TypeScript interfaces removes one of the fields this plan reads (`volume_24h`, `revenue_24h`, `expiring_licences`, `fatality_trend_30d`, `top_breaches_24h`, `construction.portfolio_by_corridor`, `ports`, `live_operations`), the corresponding `trend`/`table` silently degrades to empty (per its own `?? []` guard) rather than breaking - this is the honest-degrade contract working as intended, not a regression to chase.
