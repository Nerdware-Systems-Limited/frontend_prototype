# Per-agency Command Centre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every agency account sees a command centre built from its own RBAC grants instead of the ministry-wide national view; only `SDT` and `super_admin` keep today's national view.

**Architecture:** `dashboard.vue` stays the single URL (RBAC baseline route / safe space) and branches its rendered component on viewer identity. Today's full dashboard body is extracted verbatim into `NationalCommandCentre.vue` (pure move, no behavior change). A new `AgencyCommandCentre.vue` reads the viewer's resolved agency from `useAccessControl()` and a static module→composable registry to render real KPI tiles for full-scope modules, muted tiles for read-scope modules, and a quick-links list - reusing composables each domain page already calls, no new backend endpoints.

**Tech Stack:** Vue 3 `<script setup>`, Nuxt 3 auto-imports, Vitest + `@vue/test-utils`, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-18-agency-command-centre-design.md`

## Global Constraints

- No new backend endpoints - every KPI tile calls a composable an existing domain page already uses.
- `/dashboard` remains the only URL; no changes to `access-control.json`'s `routes`/`modules`/`baselineRoutes`/`safeSpace`.
- Every KPI tile must degrade to `KpiCard`'s `unavailable`/`unavailableReason` honest-empty-state pattern on fetch failure or missing data - never a fabricated number (per project rule: no fabricated data).
- `platform.noagency` and `platform.public` behavior is unchanged - out of scope per the spec's non-goals.
- `NationalCommandCentre.vue`'s extraction must be byte-for-byte behavior-identical to today's `dashboard.vue` - no edits while moving it.

---

### Task 1: Extract `NationalCommandCentre.vue` from `dashboard.vue`

**Files:**
- Create: `app/components/NationalCommandCentre.vue`
- Modify: `app/pages/dashboard.vue`

**Interfaces:**
- Produces: `<NationalCommandCentre />` - a self-contained component with no props, identical markup/logic/styles to today's `dashboard.vue` body.

This is a pure mechanical move. `app/pages/dashboard.vue` is currently 1952 lines: `<template>` spans lines 1–679, `<script setup lang="ts">` spans 681–1358 (with `definePageMeta({ layout: 'default' })` as its first line, which does **not** move - that's page-only and stays behind), `<style scoped>` spans 1360–1952.

- [ ] **Step 1: Read the full current file**

Run: read `app/pages/dashboard.vue` in full (it's long - read it without a line limit, or in two passes) so you have the exact current content before moving anything.

- [ ] **Step 2: Create `NationalCommandCentre.vue` with the moved content**

Create `app/components/NationalCommandCentre.vue` containing, in order:
1. `<template>` - copy lines 2–678 verbatim (the content *inside* today's `<template>...</template>`, i.e. everything except the `<template>`/`</template>` tags themselves, which you re-add around it).
2. `<script setup lang="ts">` - copy lines 683–1358 verbatim (everything in the script block **except** line 682, `definePageMeta({ layout: 'default' })` - omit that one line, nothing else changes).
3. `<style scoped>` - copy lines 1361–1951 verbatim (everything inside today's `<style scoped>...</style>`).

Do not reformat, rename, or "clean up" anything during this copy - the goal is a pure relocation so behavior is provably unchanged.

- [ ] **Step 3: Replace `dashboard.vue` with a temporary passthrough**

Replace the entire contents of `app/pages/dashboard.vue` with:

```vue
<template>
  <NationalCommandCentre />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>
```

(This is an intermediate state - Task 5 replaces it with the real branch. This step exists so the app stays in a working, testable state after this task.)

- [ ] **Step 4: Verify no regressions**

Run: `npx vitest run`
Expected: same pass count as before this task (the pre-existing `tests/integration/live.test.ts` failures are unrelated and expected - see that file's own guard).

Start the dev server if not already running (`npm run dev`) and open `/dashboard` in a browser logged in as any working seeded account (e.g. `kenha.admin@uapts.test` / `ChangeMe!`) - the page must render pixel-identical to how it did before this task (it will, since every account currently sees this same national view; that stops being true after Task 5).

- [ ] **Step 5: Commit**

```bash
git add app/components/NationalCommandCentre.vue app/pages/dashboard.vue
git commit -m "refactor: extract NationalCommandCentre from dashboard.vue

Pure move, no behavior change - dashboard.vue temporarily just
renders it unconditionally until the agency branch lands."
```

---

### Task 2: Add `moduleScope()` to `useAccessControl.ts`

**Files:**
- Modify: `app/composables/useAccessControl.ts`
- Test: `tests/unit/module-scope.test.ts`

**Interfaces:**
- Consumes: nothing new - uses the existing `settings.modules`, `matchRouteKey`, `resolveRoute` already in this file.
- Produces: `moduleScope(moduleId: string): ScopeLevel` - added to the object `useAccessControl()` returns, alongside the existing `canAccessModule`.

`canAccessModule` already answers "can this agency reach anything in this module" by checking whether any static route in it is allowed. `moduleScope` answers "how well" - needed because some agencies (e.g. KMA on Maritime/M07b) reach a module entirely through individual `grants.routes` overrides with no module-level grant, so a single "full or none" boolean isn't enough to decide tile styling.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/module-scope.test.ts`:

```typescript
// tests/unit/module-scope.test.ts
// ─────────────────────────────────────────────────────────────────────
// moduleScope() - the best scope (full > read > none) across every
// static route in a module, for AgencyCommandCentre tile styling.
// The KMA/M07b case is the reason this exists: KMA reaches Maritime
// entirely through individual grants.routes overrides with no
// module-level grant, so canAccessModule()'s boolean isn't enough.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'

const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

import { useAccessControl } from '~/composables/useAccessControl'

function setUser(agency_code: string | null, role_type: string) {
  userRef.value = { id: 'u1', email: 'u1@example.com', agency_code, role_type }
}

beforeEach(() => {
  userRef.value = null
})

describe('useAccessControl - moduleScope()', () => {
  it('KENHA has full scope on M06 (module-level grant)', () => {
    setUser('KENHA', 'admin')
    const { moduleScope } = useAccessControl()
    expect(moduleScope('M06')).toBe('full')
  })

  it('KMA has full scope on M07b Maritime via route-overrides only, not a module grant', () => {
    setUser('KMA', 'admin')
    const { moduleScope } = useAccessControl()
    // KMA's grants.full does NOT include M07b - full scope comes from
    // /maritime/vessels, /maritime/accidents etc. being 'full' route overrides.
    expect(moduleScope('M07b')).toBe('full')
  })

  it('KENHA has only read scope on M08 Railway (single read route override, no module grant)', () => {
    setUser('KENHA', 'admin')
    const { moduleScope } = useAccessControl()
    expect(moduleScope('M08')).toBe('read')
  })

  it('a module with zero accessible routes resolves to none', () => {
    setUser('KENHA', 'admin')
    const { moduleScope } = useAccessControl()
    expect(moduleScope('M14')).toBe('none') // KENHA denies M14 outright
  })

  it('super_admin gets full scope on every module', () => {
    setUser(null, 'super_admin')
    const { moduleScope } = useAccessControl()
    expect(moduleScope('M10')).toBe('full')
    expect(moduleScope('M14')).toBe('full')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/module-scope.test.ts`
Expected: FAIL - `moduleScope is not a function` (or `undefined`), since `useAccessControl()` doesn't return it yet.

- [ ] **Step 3: Implement `moduleScope()`**

In `app/composables/useAccessControl.ts`, add this function inside `useAccessControl()`, right after the existing `canAccessModule` function (find `function canAccessModule(moduleId: string): boolean {` and add after its closing `}`):

```typescript
  /** Best scope (full > read > none) across every static route in the module - for tile styling, not gating. */
  function moduleScope(moduleId: string): ScopeLevel {
    const mod = settings.modules[moduleId]
    if (!mod?.routes.length) return 'none'
    let best: ScopeLevel = 'none'
    for (const route of mod.routes) {
      if (route.includes('[')) continue // dynamic routes, same filter canAccessModule uses
      const res = resolveRoute(route)
      if (res.scopeLevel === 'full') return 'full' // can't beat this, stop early
      if (res.scopeLevel === 'read') best = 'read'
    }
    return best
  }
```

Then add `moduleScope` to the object returned at the bottom of `useAccessControl()` (find the `return { agencyCode, roleTier, ... }` block and add `moduleScope,` alongside `canAccessModule,`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/module-scope.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npx vitest run`
Expected: same pass/fail counts as Task 1's Step 4, plus these 5 new passes.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useAccessControl.ts tests/unit/module-scope.test.ts
git commit -m "feat: add moduleScope() for per-module tile scope styling"
```

---

### Task 3: `agencyModuleSummary.ts` registry

**Files:**
- Create: `app/config/agencyModuleSummary.ts`
- Test: `tests/unit/agency-module-summary.test.ts`

**Interfaces:**
- Consumes: nothing (static data + type-only imports from the composables it references).
- Produces: `OPERATIONAL_MODULES: readonly string[]`, `agencyModuleSummary: Record<string, ModuleSummaryEntry>`, and the `ModuleSummaryEntry` type - all imported by `AgencyCommandCentre.vue` in Task 4.

This is the module→composable→KPI-fields mapping from the spec's table. Each entry says which composable method to call and how to reduce its response into 2–3 headline numbers.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agency-module-summary.test.ts`:

```typescript
// tests/unit/agency-module-summary.test.ts
// ─────────────────────────────────────────────────────────────────────
// agencyModuleSummary registry completeness: every operational module
// (has a natural single-number KPI) must have an entry, so a new
// module added to access-control.json can't silently fall through
// AgencyCommandCentre with no tile and no decision made about it.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { OPERATIONAL_MODULES, agencyModuleSummary } from '~/config/agencyModuleSummary'
import accessControlData from '~/config/access-control.json'

describe('agencyModuleSummary registry', () => {
  it('every operational module id has a registry entry', () => {
    for (const id of OPERATIONAL_MODULES) {
      expect(agencyModuleSummary[id], `missing registry entry for ${id}`).toBeDefined()
    }
  })

  it('every registry entry has a label, a fetch function, and 2-3 kpi field getters', () => {
    for (const [id, entry] of Object.entries(agencyModuleSummary)) {
      expect(typeof entry.label, id).toBe('string')
      expect(typeof entry.fetch, id).toBe('function')
      expect(entry.kpis.length, id).toBeGreaterThanOrEqual(2)
      expect(entry.kpis.length, id).toBeLessThanOrEqual(3)
      for (const kpi of entry.kpis) {
        expect(typeof kpi.label, id).toBe('string')
        expect(typeof kpi.get, id).toBe('function')
      }
    }
  })

  it('every operational module id in the registry is a real module in access-control.json', () => {
    const realModuleIds = Object.keys((accessControlData as any).modules)
    for (const id of OPERATIONAL_MODULES) {
      expect(realModuleIds, id).toContain(id)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/agency-module-summary.test.ts`
Expected: FAIL - `Failed to resolve import "~/config/agencyModuleSummary"`.

- [ ] **Step 3: Implement the registry**

Create `app/config/agencyModuleSummary.ts`:

```typescript
/**
 * agencyModuleSummary - module -> composable -> headline KPI mapping for
 * AgencyCommandCentre.vue. Only "operational" modules are listed (ones
 * with a natural single-number KPI, e.g. a fatality count) - utility
 * modules (M01 Command Centre, M09 Reporting, M10 Access Control, M11
 * Notifications, M12 Integration Hub, M13 GIS) surface only as quick
 * links, not KPI tiles, per the design spec.
 *
 * Every `fetch` call reuses a composable an existing domain page already
 * calls - no new backend endpoints. `get(summary)` reads one field off
 * that already-typed response; returning `null` renders the tile's
 * honest "NO DATA" state (KpiCard's `unavailable` prop), never a
 * fabricated number.
 */

import {
  useTraffic, useFleet, usePublicTransport, useSafety, useInfrastructure,
  useAviationInfrastructure, useMaritimeCargo, useRailway,
} from '~/composables/api'

export interface ModuleSummaryKpi {
  label: string
  get: (summary: any) => string | number | null
  unit?: string
}

export interface ModuleSummaryEntry {
  label: string
  fetch: () => Promise<any>
  kpis: ModuleSummaryKpi[]
}

export const OPERATIONAL_MODULES = [
  'M02', 'M03', 'M04', 'M05', 'M06', 'M07a', 'M07b', 'M08',
] as const

export const agencyModuleSummary: Record<string, ModuleSummaryEntry> = {
  M02: {
    label: 'Road Traffic',
    fetch: () => useTraffic().summary(),
    kpis: [
      { label: 'Active congestion events', get: s => s?.kpis?.active_congestion_events ?? null },
      { label: 'Avg speed (24h)', get: s => s?.kpis?.avg_speed_24h_kmh ?? null, unit: 'km/h' },
      { label: 'Volume (24h)', get: s => s?.kpis?.total_volume_24h ?? null },
    ],
  },
  M03: {
    label: 'Fleet & Vehicle Tracking',
    fetch: () => useFleet().summary(),
    kpis: [
      { label: 'Live vehicles', get: s => s?.kpis?.live_vehicles ?? null },
      { label: 'Trips (7d)', get: s => s?.kpis?.trips_7d ?? null },
      { label: 'Governor compliance', get: s => s?.governor_compliance?.online_pct ?? null, unit: '%' },
    ],
  },
  M04: {
    label: 'Public Transport',
    fetch: () => usePublicTransport().summary(),
    kpis: [
      { label: 'Active SACCOs', get: s => (s?.kpis?.active_saccos != null && s?.kpis?.total_saccos != null) ? `${s.kpis.active_saccos}/${s.kpis.total_saccos}` : null },
      { label: 'Active routes', get: s => s?.kpis?.active_routes ?? null },
      { label: 'Passenger trips (24h)', get: s => s?.kpis?.passenger_trips_24h ?? null },
    ],
  },
  M05: {
    label: 'Safety & Incidents',
    fetch: () => useSafety().summary(),
    kpis: [
      { label: 'Active incidents', get: s => s?.kpis?.active ?? null },
      { label: 'Fatalities (30d)', get: s => s?.kpis?.fatal_30d ?? null },
      { label: 'Incidents (7d)', get: s => s?.kpis?.total_7d ?? null },
    ],
  },
  M06: {
    label: 'Road Infrastructure',
    fetch: () => useInfrastructure().summary(),
    kpis: [
      { label: 'Avg IRI', get: s => s?.network?.iri_average ?? null },
      { label: 'Avg PCI', get: s => s?.network?.pci_average ?? null },
      { label: 'Network length', get: s => s?.network?.total_length_km ?? null, unit: 'km' },
    ],
  },
  M07a: {
    label: 'Aviation',
    fetch: () => useAviationInfrastructure().summary(),
    kpis: [
      { label: 'Runway availability', get: s => s?.kpis?.runway_availability_pct ?? null, unit: '%' },
      { label: 'ATC infra health', get: s => s?.kpis?.atc_infra_health_pct ?? null, unit: '%' },
      { label: 'Open work orders', get: s => s?.kpis?.open_work_orders ?? null },
    ],
  },
  M07b: {
    label: 'Maritime',
    fetch: () => useMaritimeCargo().summary(),
    kpis: [
      { label: 'Cargo tonnes (30d)', get: s => Array.isArray(s?.ports) ? s.ports.reduce((sum: number, p: any) => sum + (p.cargo_tonnes ?? 0), 0) : null },
      { label: 'Cargo TEU (30d)', get: s => Array.isArray(s?.ports) ? s.ports.reduce((sum: number, p: any) => sum + (p.cargo_teu ?? 0), 0) : null },
    ],
  },
  M08: {
    label: 'Railway',
    fetch: () => useRailway().summary(),
    kpis: [
      { label: 'Trains in service', get: s => s?.kpis?.trains_in_service ?? null },
      { label: 'Freight shipments (30d)', get: s => s?.kpis?.freight_30d_shipments ?? null },
      { label: 'Passenger bookings (30d)', get: s => s?.kpis?.passenger_bookings_30d ?? null },
    ],
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/agency-module-summary.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/config/agencyModuleSummary.ts tests/unit/agency-module-summary.test.ts
git commit -m "feat: add agency module->KPI summary registry"
```

---

### Task 4: `AgencyCommandCentre.vue`

**Files:**
- Create: `app/components/AgencyCommandCentre.vue`
- Test: `tests/unit/agency-command-centre.test.ts`

**Interfaces:**
- Consumes: `useAccessControl()` (from Task 2, including `moduleScope`), `agencyModuleSummary`/`OPERATIONAL_MODULES` (from Task 3), `KpiCard.vue` (existing).
- Produces: `<AgencyCommandCentre />` - no props, reads the viewer's own access state. Consumed by `dashboard.vue` in Task 5.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agency-command-centre.test.ts`:

```typescript
// tests/unit/agency-command-centre.test.ts
// ─────────────────────────────────────────────────────────────────────
// AgencyCommandCentre renders one real KpiCard per full-scope module,
// a muted one per read-scope module, nothing for denied modules, and
// "NO DATA" (never a fabricated value) when a module's API call fails.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

beforeAll(() => {
  ;(globalThis as any).useRouter = () => ({ push: vi.fn(), replace: vi.fn() })
  ;(globalThis as any).useRoute  = () => ({ query: {} })
})

const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

// Fleet resolves with real data; Safety rejects, to prove the
// honest-empty-state path (never a fabricated number on failure).
vi.mock('~/composables/api', async () => {
  const actual = await vi.importActual<any>('~/composables/api')
  return {
    ...actual,
    useFleet: () => ({ summary: () => Promise.resolve({ kpis: { live_vehicles: 42, trips_7d: 100 }, governor_compliance: { online_pct: 91 } }) }),
    useSafety: () => ({ summary: () => Promise.reject(new Error('feed down')) }),
  }
})

import AgencyCommandCentre from '~/components/AgencyCommandCentre.vue'

function setUser(agency_code: string | null, role_type: string) {
  userRef.value = { id: 'u1', email: 'u1@example.com', agency_code, role_type }
}

beforeEach(() => { userRef.value = null; vi.clearAllMocks() })

describe('AgencyCommandCentre', () => {
  it("renders a real KPI value for a module the agency has full access to", async () => {
    setUser('NTSA', 'admin') // NTSA grants.full includes M03 Fleet
    const w = mount(AgencyCommandCentre, { global: { stubs: { NuxtLink: true, Sparkline: true } } })
    await flushPromises()
    const text = w.text()
    expect(text).toContain('42')
  })

  it("shows NO DATA, not a fabricated number, when a full-scope module's fetch rejects", async () => {
    setUser('NTSA', 'admin') // NTSA grants.full includes M05 Safety
    const w = mount(AgencyCommandCentre, { global: { stubs: { NuxtLink: true, Sparkline: true } } })
    await flushPromises()
    expect(w.text()).toContain('NO DATA')
  })

  it('does not render a tile for a module the agency has no access to at all', async () => {
    setUser('KENHA', 'admin') // KENHA denies M04 Public Transport outright
    const w = mount(AgencyCommandCentre, { global: { stubs: { NuxtLink: true, Sparkline: true } } })
    await flushPromises()
    expect(w.text()).not.toContain('Public Transport')
  })

  it('renders the agency name as the page heading', async () => {
    setUser('KPA', 'admin')
    const w = mount(AgencyCommandCentre, { global: { stubs: { NuxtLink: true, Sparkline: true } } })
    await flushPromises()
    expect(w.text()).toContain('Kenya Ports Authority')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/agency-command-centre.test.ts`
Expected: FAIL - `Failed to resolve import "~/components/AgencyCommandCentre.vue"`.

- [ ] **Step 3: Implement `AgencyCommandCentre.vue`**

Create `app/components/AgencyCommandCentre.vue`:

```vue
<template>
  <header class="acc-header">
    <div class="acc-header-main">
      <h1>{{ agency?.name ?? agencyCode }}</h1>
      <p class="acc-dek">{{ agencyCode }} · {{ roleTier }} workspace</p>
    </div>
    <NuxtLink v-if="agency?.landing && agency.landing !== '/dashboard'" :to="agency.landing" class="btn-primary">
      Full workspace →
    </NuxtLink>
  </header>

  <div v-if="tiles.length" class="kpi-grid">
    <KpiCard
      v-for="t in tiles" :key="t.moduleId"
      :label="t.entry.label"
      :value="t.primary.value ?? '-'"
      :unit="t.primary.unit"
      :unavailable="t.primary.value == null"
      :unavailable-reason="t.loading ? 'Loading…' : `${t.entry.label} feed unavailable`"
      :description="t.secondary.map(k => `${k.label}: ${k.value ?? '-'}`).join(' · ')"
      :class="{ 'kpi-card--muted': t.scope === 'read' }"
      :period="t.scope === 'read' ? 'READ' : 'LIVE'"
    />
  </div>
  <EmptyState v-else :loading="loading" message="No modules resolved for this agency yet." />

  <SectionTitle v-if="quickLinks.length">Quick Links</SectionTitle>
  <div v-if="quickLinks.length" class="acc-quicklinks">
    <NuxtLink v-for="l in quickLinks" :key="l.path" :to="l.path" class="acc-quicklink">
      {{ l.label }}
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { agencyModuleSummary, OPERATIONAL_MODULES } from '~/config/agencyModuleSummary'
import accessControlData from '~/config/access-control.json'

const { agency, agencyCode, roleTier, moduleScope, canAccessRoute } = useAccessControl()

interface Tile {
  moduleId: string
  entry: (typeof agencyModuleSummary)[string]
  scope: 'full' | 'read'
  loading: boolean
  primary: { value: string | number | null; unit?: string }
  secondary: { label: string; value: string | number | null }[]
}

const loading = ref(true)
const tiles = ref<Tile[]>([])

async function load() {
  loading.value = true
  const settings = accessControlData as any

  const candidates = OPERATIONAL_MODULES
    .map(id => ({ id, scope: moduleScope(id) }))
    .filter(t => t.scope === 'full' || t.scope === 'read')

  const built: Tile[] = candidates.map(({ id, scope }) => ({
    moduleId: id,
    entry: agencyModuleSummary[id],
    scope: scope as 'full' | 'read',
    loading: true,
    primary: { value: null },
    secondary: [],
  }))
  tiles.value = built

  await Promise.allSettled(built.map(async (tile) => {
    try {
      const summary = await tile.entry.fetch()
      const [primaryKpi, ...restKpis] = tile.entry.kpis
      tile.primary = { value: primaryKpi.get(summary), unit: primaryKpi.unit }
      tile.secondary = restKpis.map(k => ({ label: k.label, value: k.get(summary) }))
    } catch {
      tile.primary = { value: null }
    } finally {
      tile.loading = false
    }
  }))

  loading.value = false
}

onMounted(load)

const quickLinks = computed(() => {
  const settings = accessControlData as any
  const links: { path: string; label: string }[] = []
  for (const [moduleId, mod] of Object.entries<any>(settings.modules)) {
    for (const route of mod.routes as string[]) {
      if (route.includes('[')) continue
      if (canAccessRoute(route)) links.push({ path: route, label: route })
    }
  }
  return links
})
</script>

<style scoped>
.acc-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
.acc-dek { color:var(--fg-3); font-size:13px; margin:2px 0 0; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin-bottom:16px; }
.kpi-card--muted { opacity:.7; }
.acc-quicklinks { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
.acc-quicklink { font-size:12px; padding:6px 10px; border:1px solid var(--border-subtle); border-radius:var(--r-sm); color:var(--fg-2); }
.acc-quicklink:hover { border-color:var(--primary); color:var(--primary); }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/agency-command-centre.test.ts`
Expected: PASS, all 4 tests. If the "NTSA has M03 Fleet full-scope" or "M05 Safety full-scope" assumptions don't hold against the live `access-control.json` (re-check NTSA's `grants.full` - it should include `M03` and `M05` per the file as of this plan's writing), adjust the test's chosen agency/module to a pair that genuinely resolves to `full` for that agency rather than changing the production code to fit the test.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: all prior passes plus these 4 new ones, no new failures beyond the pre-existing `live.test.ts` ones.

- [ ] **Step 6: Commit**

```bash
git add app/components/AgencyCommandCentre.vue tests/unit/agency-command-centre.test.ts
git commit -m "feat: add AgencyCommandCentre component"
```

---

### Task 5: Wire the branch into `dashboard.vue`

**Files:**
- Modify: `app/pages/dashboard.vue`

**Interfaces:**
- Consumes: `<NationalCommandCentre />` (Task 1), `<AgencyCommandCentre />` (Task 4), `useAccessControl()`'s `isSuperAdmin`/`agencyCode`.

- [ ] **Step 1: Replace the passthrough with the real branch**

Replace `app/pages/dashboard.vue`'s contents (currently the Task 1 passthrough) with:

```vue
<template>
  <NationalCommandCentre v-if="showNational" />
  <AgencyCommandCentre v-else-if="agencyCode" />
  <NationalCommandCentre v-else />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { isSuperAdmin, agencyCode } = useAccessControl()
const showNational = computed(() => isSuperAdmin.value || agencyCode.value === 'SDT')
</script>
```

The final `<NationalCommandCentre v-else />` branch covers `platform.noagency` and any account with no resolvable agency and no super_admin bypass - this preserves today's behavior for that edge case exactly (same component, same "no agency" state it already handles via its own `error`/empty rendering), per the spec's explicit non-goal of not inventing a third variant for it.

- [ ] **Step 2: Manual verification (no automated test for this task - it's pure wiring already covered by Tasks 1 and 4's tests)**

Start the dev server (`npm run dev` if not already running) and check, logged in via `http://localhost:3000/login` with password `ChangeMe!` for every account:

- `kenha.admin@uapts.test` → `/dashboard` shows `AgencyCommandCentre` (KeNHA's name in the header, KPI tiles for its full-scope modules like M06 Road Infrastructure).
- `kpa.admin@uapts.test` → shows KPA's own tiles (M07b Maritime via the cargo-tonnes reduction).
- `kma.admin@uapts.test` → shows a full-scope M07b tile despite KMA having no module-level Maritime grant (the `moduleScope` route-override case from Task 2).
- `lapsset.admin@uapts.test` → mostly quick links, few or no KPI tiles (LAPSSET's grants are minimal per its "Provisional" note in `access-control.json`).

`SDT` and `super_admin` cannot currently be verified live - both are blocked by the pre-existing backend seed bugs documented earlier in this project (`sdt.*` accounts aren't mapped to a working agency in the way this plan assumes... actually SDT *is* mapped now; the real blocker is that no seeded account has `role_type='super_admin'`, and `sdt.oversight`'s `role_type` is `'admin'` not `'oversight'` - neither affects `showNational`, which only checks `agencyCode.value === 'SDT'` or `isSuperAdmin`). Verify **SDT specifically** live instead:

- `sdt.admin@uapts.test` → `/dashboard` must show `NationalCommandCentre` (the full ministry-wide view), not `AgencyCommandCentre` - this is the one account besides super_admin that should see it.

For `super_admin`, since no seeded account has that literal `role_type`, confirm the logic itself is correct by re-reading Task 5 Step 1's `showNational` computed against `useAccessControl.ts`'s existing `isSuperAdmin` definition (`roleTier.value === 'super_admin' || settings.roles[roleTier.value]?.bypassScope`) rather than a live login - this was already unit-tested indirectly via `tests/unit/access-control.test.ts`'s `"super_admin bypasses scope entirely"` case.

- [ ] **Step 3: Run the full suite one more time**

Run: `npx vitest run`
Expected: same as Task 4 Step 5.

- [ ] **Step 4: Commit**

```bash
git add app/pages/dashboard.vue
git commit -m "feat: branch /dashboard to AgencyCommandCentre per viewer

SDT and super_admin keep the existing national view; every other
agency-bound account now sees its own command centre."
```

---

## Self-review notes (for whoever executes this plan)

- Task 4's test assumes NTSA grants `M03` and `M05` at `full` scope - this was true in `access-control.json` as read while writing this plan (`"NTSA": { "grants": { "full": ["M04", "M03", "M05", "M09", "M12"], ... } }`). If that file has changed by execution time, re-check before assuming the test is wrong.
- `AgencyCommandCentre.vue`'s quick-links list intentionally includes routes with no KPI tile (M09–M13) - this is the mechanism that gives those modules *any* presence on the command centre, per the spec's non-goal about not forcing artificial KPIs onto non-metric modules.
- M14 Training was deliberately left out of `OPERATIONAL_MODULES` in Task 3 (per the spec: "best-effort... honest NO DATA if no clean flat KPI exists" was the fallback description, but on inspection `useTraining()` has no unified `.summary()` - only `enrollmentSummary`-shaped and `revenueSummary`-shaped calls). It surfaces via quick links only, same as M09–M13. If a future pass wants a Training tile, that's a new task, not a gap in this one.
