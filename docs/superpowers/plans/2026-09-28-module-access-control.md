# Module Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Access Control page ("Module Access", `/access-policies`) where super_admin sets what each agency may access (modules, pages, restricted data categories, capabilities) and agency admins set, within that, what their agency and each of its roles can actually do.

**Architecture:** The resolver in `useAccessControl.ts` is extracted into a pure `app/utils/resolveAccess.ts` that layers three override levels (ceiling → agency enabled → role) on top of the unchanged `access-control.json`. A Pinia store (`accessPolicy`) holds saved overrides plus an editable draft and persists through a swappable storage adapter (localStorage now, accounts API later). `useAccessControl()` reads the store's saved overrides, so sidebar, route middleware and module tiles react to saved changes.

**Tech Stack:** Nuxt 4 (SSR off), Vue 3 `<script setup>`, Pinia 3, Vitest 3 + happy-dom + @vue/test-utils.

**Spec:** `docs/superpowers/specs/2026-09-28-module-access-control-design.md`

## Global Constraints

- No backend changes; persistence is `localStorage['uapts:access-policy:v1']` behind the `AccessPolicyStorage` adapter.
- With no overrides saved, every resolution must be identical to today (guarded by the Task 1 snapshot - never update that snapshot to make a test pass).
- Each layer only narrows the one above: `ceiling ≥ enabled ≥ role`, scopes ordered `none < read < full`.
- Page copy must show: "Local preview - changes are saved in this browser only and do not reach other users or the server."
- Platform-blocked categories (enforcement `ingestion_validation`, `not_ingested`, `feature_flag_off`) are locked at their JSON state; nothing may toggle them.
- Agency admins may never make an edit that removes their own admin role's `full` access to `/access-policies` or its `manage_users` capability.
- Styling uses existing theme tokens only (`--fg-1..3`, `--surface-2`, `--surface-sunken`, `--border-subtle`, `--primary`, `--primary-wash`, `--r-sm`, `--r-pill`, `--warning-bg/fg`); read `DESIGN.md` before Task 6.
- This project is **not a git repository**: every "Checkpoint" step runs the tests instead of committing. If a repo is initialised before execution, commit at each checkpoint.
- Run single test files with `npx vitest run <path>`; the full suite with `npx vitest run`.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `app/utils/resolveAccess.ts` | Create | Pure resolver + override-layer math (types, `resolveFor`, `pageScope`, `moduleSummary`, `categoryState`, `capabilitySet`, helpers) |
| `app/utils/accessEdits.ts` | Create | `AccessEdit` union, pure `applyEdit`, pruning, `editWarning`, `stableStringify` |
| `app/utils/accessPolicyStorage.ts` | Create | Storage adapter interface + localStorage implementation + payload validation |
| `app/stores/accessPolicy.ts` | Create | Saved overrides, draft, permission-checked `edit()`, load/save/discard/reset/clearStale |
| `app/plugins/access-policy.client.ts` | Create | Loads saved overrides before first navigation |
| `app/composables/useAccessControl.ts` | Modify | Thin reactive wrapper over `resolveFor`; adds `hasCapability` |
| `app/config/access-control.json` | Modify | Add `/access-policies` route to M10 |
| `app/components/AppSidebar.vue`, `app/components/AppTopNav.vue` | Modify | "Module Access" nav entries |
| `app/components/AccessScopeToggle.vue` | Create | Segmented Inherit/None/Read/Full control with a cap |
| `app/components/AccessAgencyTab.vue` | Create | Modules/pages × Allowed/Enabled |
| `app/components/AccessRolesTab.vue` | Create | Agency capabilities, role × page grid, role × capability grid |
| `app/components/AccessCategoriesTab.vue` | Create | Restricted categories × Allowed/Enabled |
| `app/components/AccessPreviewPanel.vue` | Create | "Preview as role" reachable-pages list |
| `app/pages/access-policies.vue` | Create | Page shell: header actions, banner, agency rail, tabs, confirm + leave guard |
| `tests/unit/access-parity.test.ts` | Create | Snapshot of today's full resolution matrix |
| `tests/unit/resolve-access.test.ts` | Create | Layer math |
| `tests/unit/access-policy-store.test.ts` | Create | Store + edits + storage |
| `tests/unit/access-policy-wiring.test.ts` | Create | Resolver reads saved overrides |
| `tests/unit/access-scope-toggle.test.ts` | Create | Toggle component |
| `tests/unit/access-policies-page.test.ts` | Create | Page behaviour per role |
| `Reference.md` | Modify | Document the page in §9.6 |

---

### Task 1: Snapshot today's resolution matrix

**Files:**
- Create: `tests/unit/access-parity.test.ts`

**Interfaces:**
- Consumes: current `useAccessControl()` (unchanged).
- Produces: `tests/unit/__snapshots__/access-parity.test.ts.snap` - the baseline every later task must keep matching.

- [ ] **Step 1: Write the snapshot test**

```ts
// tests/unit/access-parity.test.ts
// ─────────────────────────────────────────────────────────────────────
// Freezes what useAccessControl() resolves today for every agency × tier ×
// route, BEFORE the Module Access override layers exist. With no overrides
// saved, the layered resolver must reproduce this exactly - never update
// this snapshot to make a later change pass.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import settings from '~/config/access-control.json'

const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

import { useAccessControl } from '~/composables/useAccessControl'

const TIERS = ['super_admin', 'oversight', 'admin', 'analyst', 'operator', 'public']
const ROUTES = [...new Set([
  ...Object.values(settings.modules).flatMap((m: any) => m.routes as string[]),
  ...Object.keys(settings.defaults.baselineRoutes),
  '/integrations/files/abc123',
  '/not-a-route',
])].filter(r => r !== '/access-policies') // added later by this feature; not part of the baseline

describe('access resolution parity baseline', () => {
  it('matches the pre-Module-Access matrix', () => {
    const out: Record<string, string> = {}
    for (const code of [...Object.keys(settings.agencies), null]) {
      for (const tier of TIERS) {
        userRef.value = { id: 'u', email: 'u@example.com', agency_code: code, role_type: tier }
        const { resolveRoute } = useAccessControl()
        for (const route of ROUTES) {
          const res = resolveRoute(route)
          out[`${code}|${tier}|${route}`] = `${res.allowed}|${res.scopeLevel}|${res.deniedCategories.join(',')}`
        }
      }
    }
    expect(out).toMatchSnapshot()
  })
})
```

- [ ] **Step 2: Run it to write the snapshot**

Run: `npx vitest run tests/unit/access-parity.test.ts`
Expected: PASS, "1 snapshot written". Confirm `tests/unit/__snapshots__/access-parity.test.ts.snap` exists.

- [ ] **Step 3: Checkpoint**

Run: `npx vitest run tests/unit/access-parity.test.ts tests/unit/access-control.test.ts`
Expected: both PASS.

---

### Task 2: Pure layered resolver

**Files:**
- Create: `app/utils/resolveAccess.ts`
- Modify: `app/composables/useAccessControl.ts` (replace whole file)
- Modify: `app/config/access-control.json:50` and the `routes` block (~line 64)
- Test: `tests/unit/resolve-access.test.ts`

**Interfaces:**
- Produces (all exported from `~/utils/resolveAccess`):
  - Types: `AccessTier`, `ScopeLevel`, `CategoryState = 'allow'|'deny'`, `PolicyLayer = 'ceiling'|'enabled'|'role'`, `RouteResolution`, `AccessSettings`, `ScopeMaps`, `LayerOverride`, `RoleOverride`, `AgencyOverride`, `PolicyOverrides`, `AccessSubject`, `IgnoreOverride`
  - Constants: `BASE_SETTINGS`, `POLICY_VERSION = 1`, `EMPTY_OVERRIDES`, `CAPABILITIES: string[]`, `PLATFORM_BLOCKED_ENFORCEMENT`
  - `resolveFor(ov: PolicyOverrides, subject: AccessSubject | null, path: string): RouteResolution`
  - `pageScope(ov, code, layer: PolicyLayer, tier: string | null, routeKey, ignore?: IgnoreOverride): ScopeLevel`
  - `moduleSummary(ov, code, layer, tier: string | null, moduleId, ignore?): { scope: ScopeLevel; mixed: boolean }`
  - `categoryState(ov, code, layer: 'ceiling'|'enabled', category): CategoryState`
  - `capabilitySet(ov, code, layer: PolicyLayer, tier: string | null): Set<string>`
  - `capabilitiesFor(ov, subject: AccessSubject | null): Set<string>`
  - `adminCanManagePolicy(ov, code): boolean`
  - `partitionStale(ov): { stale: string[]; cleaned: PolicyOverrides }`
  - `agencyRoleTiers(code): AccessTier[]`, `editableModules(): string[]`, `editableRoutes(moduleId): string[]`, `inheritedDomainLabel(code, moduleId): string | null`, `isCategoryLocked(category): boolean`, `matchRouteKey`, `moduleOfRoute`, `tierRank`, `scopeRank`, `minScope`, `maxScope`
  - `useAccessControl()` gains `hasCapability(capability: string): boolean`; its other return values are unchanged.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/resolve-access.test.ts
// ─────────────────────────────────────────────────────────────────────
// The Module Access override layers (spec: docs/superpowers/specs/
// 2026-09-28-module-access-control-design.md). ceiling -> agency enabled
// -> role, each only narrowing the one above. No-override parity with the
// original resolver is covered by access-parity.test.ts.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  EMPTY_OVERRIDES, adminCanManagePolicy, agencyRoleTiers, capabilitiesFor, categoryState,
  moduleSummary, pageScope, partitionStale, resolveFor, type AgencyOverride, type PolicyOverrides,
} from '~/utils/resolveAccess'

const ov = (agencies: Record<string, AgencyOverride>): PolicyOverrides => ({ version: 1, agencies })
const as = (agency_code: string | null, role_type: string) => ({ agency_code, role_type })

describe('resolveFor - ceiling layer (super_admin)', () => {
  it('narrows a module the JSON grants', () => {
    const o = ov({ KENHA: { ceiling: { modules: { M02: 'read' } } } })
    expect(resolveFor(o, as('KENHA', 'analyst'), '/traffic').scopeLevel).toBe('read')
    expect(resolveFor(o, as('KENHA', 'analyst'), '/traffic/alerts').scopeLevel).toBe('read')
  })

  it('can grant a module the JSON never gave, including one the JSON denies', () => {
    const o = ov({ KENHA: { ceiling: { modules: { M08: 'read', M04: 'full' } } } })
    expect(resolveFor(o, as('KENHA', 'analyst'), '/railway').scopeLevel).toBe('read')
    expect(resolveFor(o, as('KENHA', 'analyst'), '/public-transport').scopeLevel).toBe('full')
  })

  it('a page value beats the module value on the same layer', () => {
    const o = ov({ KENHA: { ceiling: { modules: { M02: 'full' }, routes: { '/traffic/alerts': 'none' } } } })
    expect(resolveFor(o, as('KENHA', 'analyst'), '/traffic').allowed).toBe(true)
    expect(resolveFor(o, as('KENHA', 'analyst'), '/traffic/alerts').allowed).toBe(false)
  })
})

describe('resolveFor - agency enabled and role layers', () => {
  it('enabled narrows but can never exceed the ceiling', () => {
    expect(resolveFor(ov({ KENHA: { enabled: { modules: { M02: 'read' } } } }), as('KENHA', 'analyst'), '/traffic').scopeLevel).toBe('read')
    expect(resolveFor(ov({ KENHA: { enabled: { modules: { M08: 'full' } } } }), as('KENHA', 'analyst'), '/railway').allowed).toBe(false)
  })

  it('lowering the ceiling caps a stored higher enabled value', () => {
    const o = ov({ KENHA: { ceiling: { modules: { M02: 'read' } }, enabled: { modules: { M02: 'full' } } } })
    expect(resolveFor(o, as('KENHA', 'analyst'), '/traffic').scopeLevel).toBe('read')
  })

  it('a role limit narrows only that role and can never exceed enabled', () => {
    const o = ov({ KENHA: { roles: { operator: { modules: { M02: 'none' } }, analyst: { modules: { M08: 'full' } } } } })
    expect(resolveFor(o, as('KENHA', 'operator'), '/traffic').allowed).toBe(false)
    expect(resolveFor(o, as('KENHA', 'analyst'), '/traffic').scopeLevel).toBe('full')
    expect(resolveFor(o, as('KENHA', 'analyst'), '/railway').allowed).toBe(false)
  })

  it('route minTier still applies after every layer', () => {
    const o = ov({ KENHA: { roles: { operator: { modules: { M09: 'full' } } } } })
    expect(resolveFor(o, as('KENHA', 'operator'), '/analytics').allowed).toBe(false)
  })

  it('/access-policies is open to agency admins and not to analysts', () => {
    expect(resolveFor(EMPTY_OVERRIDES, as('KENHA', 'admin'), '/access-policies').scopeLevel).toBe('full')
    expect(resolveFor(EMPTY_OVERRIDES, as('KENHA', 'analyst'), '/access-policies').allowed).toBe(false)
  })
})

describe('restricted categories', () => {
  it('platform-blocked categories keep their JSON state and ignore overrides', () => {
    expect(categoryState(EMPTY_OVERRIDES, 'KENHA', 'enabled', 'anpr_plate')).toBe('deny')
    const o = ov({ KENHA: { ceiling: { categories: { anpr_plate: 'allow' } } } })
    expect(categoryState(o, 'KENHA', 'enabled', 'anpr_plate')).toBe('deny')
    // Locked is not forced-deny: the owning tenant keeps today's behaviour.
    expect(categoryState(EMPTY_OVERRIDES, 'NTSA', 'enabled', 'crash_victim')).toBe('allow')
  })

  it('enabled can deny a category the ceiling allows', () => {
    const o = ov({ KPA: { enabled: { categories: { cargo_commercial: 'deny' } } } })
    expect(resolveFor(EMPTY_OVERRIDES, as('KPA', 'admin'), '/maritime/cargo').deniedCategories).not.toContain('cargo_commercial')
    expect(resolveFor(o, as('KPA', 'admin'), '/maritime/cargo').deniedCategories).toContain('cargo_commercial')
  })

  it('enabled cannot allow a category the ceiling denies', () => {
    const o = ov({ KRC: { enabled: { categories: { cargo_commercial: 'allow' } } } })
    expect(resolveFor(o, as('KRC', 'admin'), '/maritime/cargo').deniedCategories).toContain('cargo_commercial')
  })
})

describe('capabilities', () => {
  it('defaults to the global role capabilities', () => {
    expect([...capabilitiesFor(EMPTY_OVERRIDES, as('KENHA', 'analyst'))].sort()).toEqual(['export', 'query_builder', 'run_reports'])
  })

  it('enabled removes a capability from every role', () => {
    const o = ov({ KENHA: { enabled: { capabilities: ['query_builder', 'run_reports', 'manage_users'] } } })
    expect(capabilitiesFor(o, as('KENHA', 'analyst')).has('export')).toBe(false)
  })

  it('a role may gain a capability only if the agency has it enabled', () => {
    const kenha = ov({ KENHA: { roles: { analyst: { capabilities: ['approve_uploads'] } } } })
    expect(capabilitiesFor(kenha, as('KENHA', 'analyst')).has('approve_uploads')).toBe(true)
    // KAA's roleTiers are admin + analyst, so operator-only capabilities are outside its ceiling.
    const kaa = ov({ KAA: { roles: { analyst: { capabilities: ['acknowledge_alerts'] } } } })
    expect(capabilitiesFor(kaa, as('KAA', 'analyst')).has('acknowledge_alerts')).toBe(false)
  })

  it('super_admin holds every capability; no agency holds none', () => {
    expect(capabilitiesFor(EMPTY_OVERRIDES, as(null, 'super_admin')).has('manage_users')).toBe(true)
    expect(capabilitiesFor(EMPTY_OVERRIDES, as(null, 'analyst')).size).toBe(0)
  })
})

describe('helpers', () => {
  it('agencyRoleTiers always includes admin, most-privileged first', () => {
    expect(agencyRoleTiers('SDR')).toEqual(['oversight', 'admin', 'analyst'])
    expect(agencyRoleTiers('KENHA')).toEqual(['admin', 'analyst', 'operator'])
  })

  it('moduleSummary reports the best page scope and whether pages differ', () => {
    expect(moduleSummary(EMPTY_OVERRIDES, 'KPA', 'ceiling', null, 'M07b')).toEqual({ scope: 'full', mixed: true })
    expect(moduleSummary(EMPTY_OVERRIDES, 'KPA', 'ceiling', null, 'M02')).toEqual({ scope: 'none', mixed: false })
  })

  it('pageScope can ignore a layer\'s own page value (what "Inherit" shows)', () => {
    const o = ov({ KENHA: { ceiling: { routes: { '/traffic/alerts': 'none' } } } })
    expect(pageScope(o, 'KENHA', 'ceiling', null, '/traffic/alerts')).toBe('none')
    expect(pageScope(o, 'KENHA', 'ceiling', null, '/traffic/alerts', { layer: 'ceiling', key: 'route' })).toBe('full')
  })

  it('adminCanManagePolicy detects self-lockout', () => {
    expect(adminCanManagePolicy(EMPTY_OVERRIDES, 'KENHA')).toBe(true)
    expect(adminCanManagePolicy(ov({ KENHA: { enabled: { modules: { M10: 'none' } } } }), 'KENHA')).toBe(false)
    expect(adminCanManagePolicy(ov({ KENHA: { roles: { admin: { capabilities: ['export'] } } } }), 'KENHA')).toBe(false)
  })

  it('partitionStale separates keys that no longer exist in the JSON', () => {
    const o = ov({ NOPE: {}, KENHA: { ceiling: { modules: { M99: 'full', M02: 'read' } } } })
    const { stale, cleaned } = partitionStale(o)
    expect(stale).toEqual(expect.arrayContaining(['NOPE', 'KENHA.ceiling.modules.M99']))
    expect(cleaned.agencies.NOPE).toBeUndefined()
    expect(cleaned.agencies.KENHA.ceiling?.modules).toEqual({ M02: 'read' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/resolve-access.test.ts`
Expected: FAIL - cannot resolve `~/utils/resolveAccess`.

- [ ] **Step 3: Add the route to the JSON**

In `app/config/access-control.json`, change the M10 `routes` array (line 50) to:

```json
"routes": ["/agencies", "/users", "/roles", "/audit", "/access-policies"]
```

and add after the `"/audit"` entry in the top-level `routes` block (line 64):

```json
    "/access-policies": { "module": "M10", "minTier": "admin", "agencyScoped": true, "note": "Module Access - what each agency and role may reach. super_admin edits every agency's ceiling; an agency admin edits only its own agency within that ceiling (see docs/superpowers/specs/2026-09-28-module-access-control-design.md)." },
```

- [ ] **Step 4: Create `app/utils/resolveAccess.ts`**

```ts
/**
 * resolveAccess - the pure agency-scope resolver (RBAC spec section 7) plus
 * the Module Access override layers (docs/superpowers/specs/
 * 2026-09-28-module-access-control-design.md).
 *
 * No Vue, no Pinia: every function takes the override set explicitly, so the
 * route resolver, the policy store's self-lockout check, and the Module
 * Access page's "Preview as" panel all run exactly the same logic.
 * useAccessControl() is the reactive wrapper pages and middleware use.
 *
 * Layers, each only able to narrow the one above:
 *   ceiling  - set by super_admin; defaults to the JSON (domain bundle ∪ grants − denies)
 *   enabled  - set by the agency's own admin (or super_admin); defaults to the ceiling
 *   role     - per role tier inside the agency; defaults to enabled
 * A module value applies to every page in the module unless the same layer
 * also sets that page.
 */

import settingsData from '~/config/access-control.json'

export type AccessTier = 'super_admin' | 'oversight' | 'admin' | 'analyst' | 'operator' | 'public'
export type ScopeLevel = 'full' | 'read' | 'none'
export type CategoryState = 'allow' | 'deny'
export type PolicyLayer = 'ceiling' | 'enabled' | 'role'

export interface RouteResolution {
  /** Whether the route may be opened at all. */
  allowed: boolean
  /** 'full' = write/manage, 'read' = view only, 'none' = not resolved. */
  scopeLevel: ScopeLevel
  /** Short trace of which rule decided this - for the audit log / debugging, not shown to the user. */
  reason: string
  /** The module the route belongs to, when known. */
  module?: string
  /** Restricted-data categories (section 6) present on this route that this agency has denied. */
  deniedCategories: string[]
  /** True when this resolution IS the safe-space fallback, i.e. denied. */
  isSafeSpace: boolean
}

export interface AccessSettings {
  version: number
  defaults: {
    safeSpace: { route: string; mode: string }
    denyRedirect: string
    newAccountTier: string
    failClosed: boolean
    baselineRoutes: Record<string, ScopeLevel>
  }
  roles: Record<string, { tier: number; bypassScope?: boolean; capabilities?: string[] }>
  domains: Record<string, { label: string; modules: string[]; readOnly?: boolean }>
  modules: Record<string, { label: string; routes: string[] }>
  routes: Record<string, {
    module: string
    minTier: AccessTier
    agencyScoped: boolean
    categories?: string[]
    /** Lowers minTier to `minTier` for viewers whose own agency sits in `domain` - see resolveFor step 7. */
    minTierDomainOverride?: { domain: string; minTier: AccessTier }
  }>
  agencies: Record<string, {
    name: string
    domains: string[]
    landing: string
    roleTiers?: string[]
    grants: { full: string[]; read: string[]; routes: Record<string, ScopeLevel> }
    denies: { modules: string[]; routes: string[]; categories: string[] }
  }>
  publicView: { route: string; denyCategories: string[] }
  restrictedCategories: Record<string, { label: string; owningAgency: string; enforcement: string; minTier?: AccessTier }>
}

/** Absent key = inherit from the layer above (or the JSON, for the ceiling). */
export interface ScopeMaps {
  modules?: Record<string, ScopeLevel>
  routes?: Record<string, ScopeLevel>
}
export interface LayerOverride extends ScopeMaps {
  categories?: Record<string, CategoryState>
  capabilities?: string[]
}
export interface RoleOverride extends ScopeMaps {
  capabilities?: string[]
}
export interface AgencyOverride {
  ceiling?: LayerOverride
  enabled?: LayerOverride
  roles?: Record<string, RoleOverride>
  updatedAt?: string
  updatedBy?: string
}
export interface PolicyOverrides {
  version: 1
  agencies: Record<string, AgencyOverride>
}
export interface AccessSubject {
  agency_code?: string | null
  role_type?: string | null
}
/** Drop one layer's own module or page value - what an "Inherit" option displays. */
export interface IgnoreOverride {
  layer: PolicyLayer
  key: 'route' | 'module'
}

export const POLICY_VERSION = 1
export const EMPTY_OVERRIDES: PolicyOverrides = { version: 1, agencies: {} }
export const BASE_SETTINGS = settingsData as unknown as AccessSettings
const S = BASE_SETTINGS

type Agency = AccessSettings['agencies'][string]

// ── Route and tier lookups (built once from the JSON) ─────────────────

/** route -> module, built once from the modules block. */
const ROUTE_MODULE: Record<string, string> = {}
for (const [moduleId, mod] of Object.entries(S.modules)) {
  for (const route of mod.routes) ROUTE_MODULE[route] = moduleId
}

/**
 * Dynamic-segment route keys (e.g. "/integrations/files/[id]") can't be
 * matched by equality against a real path like "/integrations/files/abc123".
 * Longest-prefix-first so a more specific pattern wins over a shorter one.
 */
const DYNAMIC_ROUTE_KEYS = Object.keys(ROUTE_MODULE)
  .filter(key => key.includes('['))
  .map(key => ({ key, prefix: key.slice(0, key.indexOf('[')) }))
  .sort((a, b) => b.prefix.length - a.prefix.length)

export function matchRouteKey(path: string): string | undefined {
  if (path in ROUTE_MODULE) return path
  for (const { key, prefix } of DYNAMIC_ROUTE_KEYS) {
    if (path.startsWith(prefix)) return key
  }
  return undefined
}

export function moduleOfRoute(routeKey: string): string | undefined {
  return ROUTE_MODULE[routeKey] ?? S.routes[routeKey]?.module
}

const TIER_RANK: Record<string, number> = Object.fromEntries(
  Object.entries(S.roles).map(([key, role]) => [key, role.tier]),
)

export function tierRank(tier: string | undefined | null): number {
  return TIER_RANK[tier ?? 'public'] ?? TIER_RANK.public ?? 10
}

function isBypassTier(tier: string): boolean {
  return tier === 'super_admin' || !!S.roles[tier]?.bypassScope
}

const SCOPE_RANK: Record<ScopeLevel, number> = { none: 0, read: 1, full: 2 }
export function scopeRank(scope: ScopeLevel): number { return SCOPE_RANK[scope] }
export function minScope(a: ScopeLevel, b: ScopeLevel): ScopeLevel { return SCOPE_RANK[a] <= SCOPE_RANK[b] ? a : b }
export function maxScope(a: ScopeLevel, b: ScopeLevel): ScopeLevel { return SCOPE_RANK[a] >= SCOPE_RANK[b] ? a : b }

// ── Catalogues the Module Access page lists ───────────────────────────

/** Enforcement decided at ingestion / feature-flag level - nothing on this page can undo it. */
export const PLATFORM_BLOCKED_ENFORCEMENT = ['ingestion_validation', 'not_ingested', 'feature_flag_off']

export function isCategoryLocked(category: string): boolean {
  return PLATFORM_BLOCKED_ENFORCEMENT.includes(S.restrictedCategories[category]?.enforcement ?? '')
}

/** Every capability any role carries today. */
export const CAPABILITIES: string[] = [...new Set(Object.values(S.roles).flatMap(r => r.capabilities ?? []))]

const BASELINE_ROUTES = new Set(Object.keys(S.defaults.baselineRoutes))

/** A module's static, non-baseline routes - the pages an override can meaningfully change. */
export function editableRoutes(moduleId: string): string[] {
  return (S.modules[moduleId]?.routes ?? []).filter(r => !r.includes('[') && !BASELINE_ROUTES.has(r))
}

/** Modules with at least one editable page (M01's only route, /dashboard, is baseline). */
export function editableModules(): string[] {
  return Object.keys(S.modules).filter(m => editableRoutes(m).length > 0)
}

/**
 * Role columns for an agency: `admin` plus its roleTiers, minus super_admin /
 * public, most-privileged first. admin is always present because seeded
 * admin accounts exist even where roleTiers omits it (e.g. SDR).
 */
export function agencyRoleTiers(code: string): AccessTier[] {
  const listed = S.agencies[code]?.roleTiers ?? []
  const tiers = new Set(['admin', ...listed].filter(t => t !== 'super_admin' && t !== 'public' && t in S.roles))
  return [...tiers].sort((a, b) => tierRank(b) - tierRank(a)) as AccessTier[]
}

/** Label of the first domain bundle the agency sits in that includes this module, if any. */
export function inheritedDomainLabel(code: string, moduleId: string): string | null {
  for (const domainKey of S.agencies[code]?.domains ?? []) {
    const domain = S.domains[domainKey]
    if (domain?.modules.includes(moduleId)) return domain.label
  }
  return null
}

// ── Layer math ─────────────────────────────────────────────────────────

/**
 * Steps 4-6 of spec section 7.2 against the JSON alone: domain bundle union
 * (a readOnly domain grants read, an ordinary one full; full wins), then the
 * agency's own grants (module, then route-level), then its denials, which
 * always win.
 */
function jsonScope(agency: Agency, moduleId: string, routeKey: string): ScopeLevel {
  let scope: ScopeLevel = 'none'
  for (const domainKey of agency.domains) {
    const domain = S.domains[domainKey]
    if (!domain?.modules.includes(moduleId)) continue
    if (domain.readOnly) {
      if (scope === 'none') scope = 'read'
    } else {
      scope = 'full'
    }
  }
  if (agency.grants.full.includes(moduleId)) scope = 'full'
  else if (agency.grants.read.includes(moduleId) && scope === 'none') scope = 'read'
  const routeGrant = agency.grants.routes[routeKey]
  if (routeGrant) scope = routeGrant
  if (agency.denies.modules.includes(moduleId) || agency.denies.routes.includes(routeKey)) scope = 'none'
  return scope
}

function pick(maps: ScopeMaps | undefined, moduleId: string, routeKey: string, skip?: 'route' | 'module'): ScopeLevel | undefined {
  const route = skip === 'route' ? undefined : maps?.routes?.[routeKey]
  const mod = skip === 'module' ? undefined : maps?.modules?.[moduleId]
  return route ?? mod
}

/** A page's scope at `layer` for agency `code`, each layer clamped to the one above. */
export function pageScope(
  ov: PolicyOverrides, code: string, layer: PolicyLayer, tier: string | null, routeKey: string, ignore?: IgnoreOverride,
): ScopeLevel {
  const agency = S.agencies[code]
  const moduleId = moduleOfRoute(routeKey)
  if (!agency || !moduleId) return 'none'
  const a = ov.agencies[code]
  const skip = (l: PolicyLayer) => (ignore?.layer === l ? ignore.key : undefined)

  const ceiling = pick(a?.ceiling, moduleId, routeKey, skip('ceiling')) ?? jsonScope(agency, moduleId, routeKey)
  if (layer === 'ceiling') return ceiling
  const enabled = minScope(ceiling, pick(a?.enabled, moduleId, routeKey, skip('enabled')) ?? ceiling)
  if (layer === 'enabled') return enabled
  const roleMaps = tier ? a?.roles?.[tier] : undefined
  return minScope(enabled, pick(roleMaps, moduleId, routeKey, skip('role')) ?? enabled)
}

/** Best scope across a module's editable pages, and whether those pages differ. */
export function moduleSummary(
  ov: PolicyOverrides, code: string, layer: PolicyLayer, tier: string | null, moduleId: string, ignore?: IgnoreOverride,
): { scope: ScopeLevel; mixed: boolean } {
  const scopes = editableRoutes(moduleId).map(r => pageScope(ov, code, layer, tier, r, ignore))
  if (!scopes.length) return { scope: 'none', mixed: false }
  return { scope: scopes.reduce(maxScope), mixed: new Set(scopes).size > 1 }
}

/**
 * Whether a restricted category is visible to the agency at `layer`. The
 * JSON default is agency.denies.categories. Platform-blocked categories are
 * locked at that default; otherwise enabled can only deny what the ceiling allows.
 */
export function categoryState(ov: PolicyOverrides, code: string, layer: 'ceiling' | 'enabled', category: string): CategoryState {
  const agency = S.agencies[code]
  if (!agency) return 'deny'
  const json: CategoryState = agency.denies.categories.includes(category) ? 'deny' : 'allow'
  if (isCategoryLocked(category)) return json
  const a = ov.agencies[code]
  const ceiling = a?.ceiling?.categories?.[category] ?? json
  if (layer === 'ceiling' || ceiling === 'deny') return ceiling
  return a?.enabled?.categories?.[category] ?? ceiling
}

/**
 * Capabilities at `layer`. Ceiling defaults to every capability of the
 * agency's role tiers; enabled defaults to the ceiling; a role defaults to
 * its global capabilities. Each is intersected with the layer above.
 */
export function capabilitySet(ov: PolicyOverrides, code: string, layer: PolicyLayer, tier: string | null): Set<string> {
  if (!S.agencies[code]) return new Set()
  const a = ov.agencies[code]
  const ceilingDefault = agencyRoleTiers(code).flatMap(t => S.roles[t]?.capabilities ?? [])
  const ceiling = new Set(a?.ceiling?.capabilities ?? ceilingDefault)
  if (layer === 'ceiling') return ceiling
  const enabled = new Set((a?.enabled?.capabilities ?? [...ceiling]).filter(c => ceiling.has(c)))
  if (layer === 'enabled' || !tier) return enabled
  const roleDefault = S.roles[tier]?.capabilities ?? []
  return new Set((a?.roles?.[tier]?.capabilities ?? roleDefault).filter(c => enabled.has(c)))
}

export function capabilitiesFor(ov: PolicyOverrides, subject: AccessSubject | null): Set<string> {
  if (!subject) return new Set()
  const tier = subject.role_type ?? 'public'
  if (isBypassTier(tier)) return new Set(CAPABILITIES)
  const code = subject.agency_code?.toUpperCase()
  if (!code || !S.agencies[code]) return new Set()
  return capabilitySet(ov, code, 'role', tier)
}

// ── The resolver ───────────────────────────────────────────────────────

function denyResult(reason: string): RouteResolution {
  return { allowed: false, scopeLevel: 'none', reason, deniedCategories: [], isSafeSpace: true }
}

/**
 * The eight-step resolution algorithm from spec section 7.2, with the Module
 * Access layers folded into steps 4-6. Deny by default; anything that doesn't
 * reach an explicit permit falls through to the safe space.
 */
export function resolveFor(ov: PolicyOverrides, subject: AccessSubject | null, path: string): RouteResolution {
  // Step 2 (partial): not authenticated at all.
  if (!subject) return denyResult('not authenticated')

  // Baseline routes are open to any authenticated account, agency or not -
  // this is what makes the safe space itself reachable rather than circular.
  const baselineScope = S.defaults.baselineRoutes[path]
  if (baselineScope) {
    return { allowed: true, scopeLevel: baselineScope, reason: 'baseline route', deniedCategories: [], isSafeSpace: false }
  }

  const roleTier = (subject.role_type ?? 'public') as AccessTier

  // Public tier: the single fixed view, nothing else (spec section 2.6).
  if (roleTier === 'public') return denyResult('public tier - single fixed view only')

  // Step 3: the only bypass in the model.
  if (isBypassTier(roleTier)) {
    return { allowed: true, scopeLevel: 'full', reason: 'super_admin bypass', deniedCategories: [], isSafeSpace: false }
  }

  const code = subject.agency_code?.toUpperCase() || null
  const agency = code ? S.agencies[code] : undefined
  if (!code || !agency) return denyResult('no agency resolved for this account')

  const routeKey = matchRouteKey(path)
  if (!routeKey) return denyResult('route not recognised')

  const routeMeta = S.routes[routeKey]
  const moduleId = moduleOfRoute(routeKey)
  if (!moduleId) return denyResult('route has no module mapping')

  // Steps 4-6 (JSON domain bundle, grants, denials) become the ceiling; then
  // the agency's enabled layer (5b) and the role limit (6b) narrow it.
  const scope = pageScope(ov, code, 'role', roleTier, routeKey)

  // Restricted categories mask fields, they never block the whole route. Two
  // independent reasons: a tier gate that applies even inside the owning
  // agency (restrictedCategories[category].minTier), and the agency's own
  // category layers (JSON denies.categories as the default).
  const deniedCategories = (routeMeta?.categories ?? []).filter((category) => {
    const def = S.restrictedCategories[category]
    const belowCategoryTier = !!def?.minTier && tierRank(roleTier) < tierRank(def.minTier)
    return belowCategoryTier || categoryState(ov, code, 'enabled', category) === 'deny'
  })

  if (scope === 'none') return denyResult(`no grant for ${moduleId} at ${routeKey}`)

  // Step 7: route minimum tier, optionally lowered for agencies in a given
  // domain (minTierDomainOverride - e.g. /agencies for SDT/SDR admin-tier staff).
  let minTier = routeMeta?.minTier ?? 'operator'
  const override = routeMeta?.minTierDomainOverride
  if (override && agency.domains.includes(override.domain)) minTier = override.minTier
  if (tierRank(roleTier) < tierRank(minTier)) return denyResult(`role tier below ${minTier} for ${routeKey}`)

  // Step 8 (the permit path).
  return {
    allowed: true,
    scopeLevel: scope,
    reason: `${code} ${scope} grant on ${moduleId}`,
    module: moduleId,
    deniedCategories,
    isSafeSpace: false,
  }
}

/** Whether the agency's own admin role could still fully manage its access under `ov` (self-lockout guard). */
export function adminCanManagePolicy(ov: PolicyOverrides, code: string): boolean {
  const subject = { agency_code: code, role_type: 'admin' }
  const res = resolveFor(ov, subject, '/access-policies')
  return res.allowed && res.scopeLevel === 'full' && capabilitiesFor(ov, subject).has('manage_users')
}

// ── Stale overrides ────────────────────────────────────────────────────

function cleanLayer<T extends LayerOverride>(layer: T, path: string, stale: string[]): T {
  const out: LayerOverride = {}
  function keep<V>(field: string, map: Record<string, V>, valid: (key: string) => boolean): Record<string, V> {
    const kept: Record<string, V> = {}
    for (const [key, value] of Object.entries(map)) {
      if (valid(key)) kept[key] = value
      else stale.push(`${path}.${field}.${key}`)
    }
    return kept
  }
  if (layer.modules) out.modules = keep('modules', layer.modules, k => k in S.modules)
  if (layer.routes) out.routes = keep('routes', layer.routes, k => !!moduleOfRoute(k))
  if (layer.categories) out.categories = keep('categories', layer.categories, k => k in S.restrictedCategories)
  if (layer.capabilities) {
    out.capabilities = layer.capabilities.filter(c => CAPABILITIES.includes(c))
    layer.capabilities.filter(c => !CAPABILITIES.includes(c)).forEach(c => stale.push(`${path}.capabilities.${c}`))
  }
  return out as T
}

/** Splits overrides into keys the JSON still knows and ones it doesn't (renamed/removed agencies, modules, routes...). */
export function partitionStale(ov: PolicyOverrides): { stale: string[]; cleaned: PolicyOverrides } {
  const stale: string[] = []
  const cleaned: PolicyOverrides = { version: 1, agencies: {} }
  for (const [code, a] of Object.entries(ov.agencies)) {
    if (!S.agencies[code]) { stale.push(code); continue }
    const out: AgencyOverride = {}
    if (a.updatedAt) out.updatedAt = a.updatedAt
    if (a.updatedBy) out.updatedBy = a.updatedBy
    if (a.ceiling) out.ceiling = cleanLayer(a.ceiling, `${code}.ceiling`, stale)
    if (a.enabled) out.enabled = cleanLayer(a.enabled, `${code}.enabled`, stale)
    if (a.roles) {
      out.roles = {}
      for (const [tier, role] of Object.entries(a.roles)) {
        if (!S.roles[tier]) { stale.push(`${code}.roles.${tier}`); continue }
        out.roles[tier] = cleanLayer(role, `${code}.roles.${tier}`, stale)
      }
    }
    cleaned.agencies[code] = out
  }
  return { stale, cleaned }
}
```

- [ ] **Step 5: Replace `app/composables/useAccessControl.ts`**

```ts
/**
 * useAccessControl - the agency-scope resolver (RBAC spec section 7).
 *
 * Second axis alongside usePermissions()'s role-tier gate: usePermissions()
 * answers "what may this person do", this answers "whose data and which
 * modules may they see". A route is reachable only when both axes permit
 * it (spec section 2.2 - "Two axes, resolved independently"). This is a
 * client-side convenience only, per spec section 2.1 - "The server is the
 * gate. Client-side checks exist to give a clean experience, never to
 * provide the protection."
 *
 * The resolution logic lives in ~/utils/resolveAccess (pure, shared with the
 * Module Access page's preview and the policy store's self-lockout check);
 * this composable binds it to the signed-in user and the saved Module Access
 * overrides. Every enforcement point should go through this composable
 * rather than reading the settings file directly, so that migrating to the
 * accounts API later (spec section 7.3) stays a one-place change.
 */

import type { User } from '~/types/uapts'
import {
  BASE_SETTINGS, EMPTY_OVERRIDES, capabilitiesFor, resolveFor,
  type AccessTier, type PolicyOverrides, type RouteResolution, type ScopeLevel,
} from '~/utils/resolveAccess'

export type { AccessTier, RouteResolution, ScopeLevel } from '~/utils/resolveAccess'

const settings = BASE_SETTINGS

export function useAccessControl() {
  const { user } = useAuth()

  const overrides = computed<PolicyOverrides>(() => EMPTY_OVERRIDES)
  const subject = computed(() => user.value as User | null)

  const agencyCode = computed(() => subject.value?.agency_code?.toUpperCase() || null)
  const roleTier = computed<AccessTier>(() => (subject.value?.role_type as AccessTier) ?? 'public')
  const isSuperAdmin = computed(
    () => roleTier.value === 'super_admin' || !!settings.roles[roleTier.value]?.bypassScope,
  )

  const agency = computed(() => (agencyCode.value ? settings.agencies[agencyCode.value] : undefined))

  /** Union of every module across every domain the current agency belongs to (spec 7.2 step 4). */
  const domainModules = computed<Set<string>>(() => {
    const modules = new Set<string>()
    for (const domainKey of agency.value?.domains ?? []) {
      settings.domains[domainKey]?.modules.forEach(m => modules.add(m))
    }
    return modules
  })

  const safeSpace = computed(() => settings.defaults.safeSpace)
  const landingRoute = computed(() => agency.value?.landing ?? safeSpace.value.route)

  function resolveRoute(path: string): RouteResolution {
    return resolveFor(overrides.value, subject.value, path)
  }

  function canAccessRoute(path: string): boolean {
    return resolveRoute(path).allowed
  }

  /** True if the agency can reach ANY route in the module (used by sidebar/palette filtering). */
  function canAccessModule(moduleId: string): boolean {
    const mod = settings.modules[moduleId]
    if (!mod?.routes.length) return false
    return mod.routes.some(route => !route.includes('[') && canAccessRoute(route))
  }

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

  /** Whether the signed-in user holds `capability` after every Module Access layer (always true for super_admin). */
  function hasCapability(capability: string): boolean {
    return capabilitiesFor(overrides.value, subject.value).has(capability)
  }

  return {
    agencyCode,
    roleTier,
    isSuperAdmin,
    agency,
    domainModules,
    safeSpace,
    landingRoute,
    resolveRoute,
    canAccessRoute,
    canAccessModule,
    moduleScope,
    hasCapability,
  }
}
```

- [ ] **Step 6: Run the new tests**

Run: `npx vitest run tests/unit/resolve-access.test.ts`
Expected: PASS (all cases).

- [ ] **Step 7: Run the parity and existing resolver tests**

Run: `npx vitest run tests/unit/access-parity.test.ts tests/unit/access-control.test.ts tests/unit/module-scope.test.ts tests/unit/agency-command-centre.test.ts tests/unit/dashboard-branch.test.ts tests/unit/field-mask.test.ts`
Expected: all PASS, snapshot unchanged. If the snapshot fails, the extraction changed behaviour - fix `resolveAccess.ts`, do not update the snapshot.

- [ ] **Step 8: Checkpoint**

Run: `npx vitest run`
Expected: whole suite PASS.

---

### Task 3: Edits, storage adapter and policy store

**Files:**
- Create: `app/utils/accessEdits.ts`
- Create: `app/utils/accessPolicyStorage.ts`
- Create: `app/stores/accessPolicy.ts`
- Test: `tests/unit/access-policy-store.test.ts`

**Interfaces:**
- Consumes: everything listed as produced in Task 2.
- Produces:
  - `~/utils/accessEdits`: `type EditableLayer = 'ceiling' | 'enabled'`; `type AccessEdit` =
    `{ kind: 'scope'; layer: EditableLayer; key: string; value: ScopeLevel | null }` |
    `{ kind: 'roleScope'; tier: string; key: string; value: ScopeLevel | null }` |
    `{ kind: 'category'; layer: EditableLayer; category: string; value: CategoryState | null }` |
    `{ kind: 'capabilities'; layer: EditableLayer; caps: string[] | null }` |
    `{ kind: 'roleCapabilities'; tier: string; caps: string[] | null }` |
    `{ kind: 'reset'; keepCeiling: boolean }`
    (`key` starting with `/` is a page, otherwise a module id; `null` = inherit);
    `editLayer(e): PolicyLayer`, `applyEdit(ov, code, e): PolicyOverrides`, `pruneOverrides(ov): PolicyOverrides`, `cloneOverrides(ov)`, `stableStringify(v): string`, `editWarning(ov, code, e): string | null`
  - `~/utils/accessPolicyStorage`: `interface AccessPolicyStorage { load(): Promise<PolicyOverrides | null>; save(o: PolicyOverrides): Promise<void> }`, `ACCESS_POLICY_STORAGE_KEY`, `parseStoredPolicy(raw)`, `localAccessPolicyStorage`
  - `~/stores/accessPolicy`: `AccessPolicyError`, `setAccessPolicyStorage(s)`, `useAccessPolicyStore()` with state `overrides`, `draft`, `loaded`, `saving`, `saveError`; getters `isSuperAdmin`, `dirtyAgencies: string[]`, `isDirty`, `staleKeys: string[]`; actions `canEditAgency(code): boolean`, `edit(code, e: AccessEdit): void` (throws `AccessPolicyError`), `resetAgency(code)`, `discard()`, `clearStale()`, `load(): Promise<void>`, `save(): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/access-policy-store.test.ts
// ─────────────────────────────────────────────────────────────────────
// Module Access policy store: draft/save/discard, who may edit which
// layer, the agency-admin self-lockout guard, and the storage adapter.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

;(globalThis as any).$fetch = vi.fn()

import { useAuthStore } from '~/stores/auth'
import { useAccessPolicyStore, setAccessPolicyStorage, AccessPolicyError } from '~/stores/accessPolicy'
import { ACCESS_POLICY_STORAGE_KEY, localAccessPolicyStorage, parseStoredPolicy } from '~/utils/accessPolicyStorage'
import { editWarning } from '~/utils/accessEdits'
import { EMPTY_OVERRIDES, type PolicyOverrides } from '~/utils/resolveAccess'

function memoryStorage(initial: PolicyOverrides | null = null) {
  let saved = initial
  return {
    saved: () => saved,
    load: vi.fn(async () => saved),
    save: vi.fn(async (o: PolicyOverrides) => { saved = JSON.parse(JSON.stringify(o)) }),
  }
}

function signIn(agency_code: string | null, role_type: string) {
  useAuthStore().user = { id: 'u1', email: 'me@example.com', agency_code, role_type } as any
}

let storage: ReturnType<typeof memoryStorage>
beforeEach(() => {
  setActivePinia(createPinia())
  storage = memoryStorage()
  setAccessPolicyStorage(storage)
})

describe('draft, save, discard', () => {
  it('starts from saved overrides and is clean', async () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    expect(store.loaded).toBe(true)
    expect(store.draft).toEqual(EMPTY_OVERRIDES)
    expect(store.isDirty).toBe(false)
  })

  it('an edit dirties the draft without touching saved overrides; save persists and stamps it', async () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'read' })
    expect(store.isDirty).toBe(true)
    expect(store.dirtyAgencies).toEqual(['KENHA'])
    expect(store.overrides.agencies.KENHA).toBeUndefined()

    await store.save()
    expect(store.isDirty).toBe(false)
    expect(storage.saved()?.agencies.KENHA.ceiling?.modules?.M02).toBe('read')
    expect(storage.saved()?.agencies.KENHA.updatedBy).toBe('me@example.com')
    expect(store.overrides.agencies.KENHA.updatedAt).toBeTruthy()
  })

  it('setting a value back to inherit leaves the draft clean', async () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: '/traffic', value: 'none' })
    store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: '/traffic', value: null })
    expect(store.isDirty).toBe(false)
  })

  it('discard restores the saved state', async () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'none' })
    store.discard()
    expect(store.isDirty).toBe(false)
  })

  it('a failed save keeps the draft and reports it', async () => {
    signIn(null, 'super_admin')
    storage.save.mockRejectedValueOnce(new Error('QuotaExceededError'))
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'none' })
    await store.save()
    expect(store.saveError).toMatch(/Couldn't save/)
    expect(store.isDirty).toBe(true)
  })
})

describe('who may edit what', () => {
  it('an agency admin cannot edit the ceiling', async () => {
    signIn('KENHA', 'admin')
    const store = useAccessPolicyStore()
    expect(() => store.edit('KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'none' })).toThrow(AccessPolicyError)
  })

  it('an agency admin cannot edit another agency', () => {
    signIn('KENHA', 'admin')
    const store = useAccessPolicyStore()
    expect(store.canEditAgency('KURA')).toBe(false)
    expect(() => store.edit('KURA', { kind: 'scope', layer: 'enabled', key: 'M02', value: 'none' })).toThrow(AccessPolicyError)
  })

  it('an agency admin can edit its own enabled layer and roles', () => {
    signIn('kenha', 'admin') // agency_code case must not matter
    const store = useAccessPolicyStore()
    store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: 'M02', value: 'read' })
    store.edit('KENHA', { kind: 'roleScope', tier: 'operator', key: 'M05', value: 'none' })
    expect(store.draft.agencies.KENHA.enabled?.modules?.M02).toBe('read')
    expect(store.draft.agencies.KENHA.roles?.operator?.modules?.M05).toBe('none')
  })

  it('analysts cannot edit anything', () => {
    signIn('KENHA', 'analyst')
    const store = useAccessPolicyStore()
    expect(() => store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: 'M02', value: 'read' })).toThrow(AccessPolicyError)
  })

  it('platform-blocked categories cannot be changed, even by super_admin', () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    expect(() => store.edit('KENHA', { kind: 'category', layer: 'ceiling', category: 'anpr_plate', value: 'allow' })).toThrow(AccessPolicyError)
  })
})

describe('self-lockout guard', () => {
  it('blocks an agency admin from disabling Access Control for their own agency', () => {
    signIn('KENHA', 'admin')
    const store = useAccessPolicyStore()
    expect(() => store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: 'M10', value: 'none' })).toThrow(/your own ability/)
    expect(() => store.edit('KENHA', { kind: 'roleScope', tier: 'admin', key: '/access-policies', value: 'read' })).toThrow(/your own ability/)
    expect(() => store.edit('KENHA', { kind: 'roleCapabilities', tier: 'admin', caps: ['export'] })).toThrow(/your own ability/)
    expect(store.isDirty).toBe(false)
  })

  it('lets super_admin make the same change (the page asks for confirmation first)', () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: 'M10', value: 'none' })
    expect(store.draft.agencies.KENHA.enabled?.modules?.M10).toBe('none')
  })

  it('editWarning explains the consequence for super_admin', () => {
    expect(editWarning(EMPTY_OVERRIDES, 'KENHA', { kind: 'scope', layer: 'ceiling', key: 'M10', value: 'none' })).toMatch(/lose Access Control/)
    expect(editWarning(EMPTY_OVERRIDES, 'KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'read' })).toBeNull()
  })
})

describe('reset and stale overrides', () => {
  const saved: PolicyOverrides = {
    version: 1,
    agencies: {
      KENHA: { ceiling: { modules: { M02: 'read' } }, enabled: { modules: { M05: 'read' } }, roles: { operator: { modules: { M06: 'none' } } } },
      GONE: { ceiling: { modules: { M02: 'none' } } },
    },
  }

  it('an agency admin reset keeps the ceiling; a super_admin reset clears everything', async () => {
    setAccessPolicyStorage(memoryStorage(saved))
    signIn('KENHA', 'admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.resetAgency('KENHA')
    expect(store.draft.agencies.KENHA).toEqual({ ceiling: { modules: { M02: 'read' } } })

    signIn(null, 'super_admin')
    store.resetAgency('KENHA')
    expect(store.draft.agencies.KENHA).toBeUndefined()
  })

  it('lists stale keys and lets super_admin clear them', async () => {
    setAccessPolicyStorage(memoryStorage(saved))
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    expect(store.staleKeys).toContain('GONE')
    store.clearStale()
    expect(store.draft.agencies.GONE).toBeUndefined()
    expect(store.draft.agencies.KENHA.ceiling?.modules?.M02).toBe('read')
  })
})

describe('localStorage adapter', () => {
  it('round-trips a policy', async () => {
    const policy: PolicyOverrides = { version: 1, agencies: { KPA: { enabled: { modules: { M13: 'none' } } } } }
    await localAccessPolicyStorage.save(policy)
    expect(await localAccessPolicyStorage.load()).toEqual(policy)
  })

  it('ignores unknown versions and unreadable payloads', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseStoredPolicy(JSON.stringify({ version: 2, agencies: {} }))).toBeNull()
    expect(parseStoredPolicy('{not json')).toBeNull()
    expect(parseStoredPolicy(null)).toBeNull()
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('uses the documented key', () => {
    expect(ACCESS_POLICY_STORAGE_KEY).toBe('uapts:access-policy:v1')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/access-policy-store.test.ts`
Expected: FAIL - cannot resolve `~/stores/accessPolicy`.

- [ ] **Step 3: Create `app/utils/accessEdits.ts`**

```ts
/**
 * accessEdits - the single description of a Module Access change, applied
 * purely to an override set. The policy store applies edits after checking
 * the viewer's rights; the page uses the same function to warn about an
 * edit's consequences before it is made.
 */

import {
  adminCanManagePolicy, editableModules, moduleSummary,
  type AgencyOverride, type CategoryState, type PolicyLayer, type PolicyOverrides, type ScopeLevel,
} from '~/utils/resolveAccess'

export type EditableLayer = 'ceiling' | 'enabled'

/** `key` starting with "/" is a page, otherwise a module id. `null` value/caps = inherit. */
export type AccessEdit =
  | { kind: 'scope'; layer: EditableLayer; key: string; value: ScopeLevel | null }
  | { kind: 'roleScope'; tier: string; key: string; value: ScopeLevel | null }
  | { kind: 'category'; layer: EditableLayer; category: string; value: CategoryState | null }
  | { kind: 'capabilities'; layer: EditableLayer; caps: string[] | null }
  | { kind: 'roleCapabilities'; tier: string; caps: string[] | null }
  | { kind: 'reset'; keepCeiling: boolean }

export function editLayer(e: AccessEdit): PolicyLayer {
  switch (e.kind) {
    case 'scope':
    case 'category':
    case 'capabilities':
      return e.layer
    case 'roleScope':
    case 'roleCapabilities':
      return 'role'
    case 'reset':
      return e.keepCeiling ? 'enabled' : 'ceiling'
  }
}

export function cloneOverrides(ov: PolicyOverrides): PolicyOverrides {
  return JSON.parse(JSON.stringify(ov))
}

/** JSON with sorted keys, so re-adding a removed key doesn't read as a change. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function setKey(target: Record<string, any>, field: string, key: string, value: unknown) {
  if (value === null) {
    if (target[field]) delete target[field][key]
  } else {
    (target[field] ??= {})[key] = value
  }
}

function setCaps(target: { capabilities?: string[] }, caps: string[] | null) {
  if (caps === null) delete target.capabilities
  else target.capabilities = [...new Set(caps)].sort()
}

const isEmpty = (o: object | undefined) => !o || Object.keys(o).length === 0

function pruneLayer<T extends Record<string, any>>(layer: T | undefined): T | undefined {
  if (!layer) return undefined
  for (const field of ['modules', 'routes', 'categories']) {
    if (layer[field] && isEmpty(layer[field])) delete layer[field]
  }
  return isEmpty(layer) ? undefined : layer
}

/** Removes empty maps, layers and agencies in place (an explicit `capabilities: []` is kept - it means "none"). */
export function pruneOverrides(ov: PolicyOverrides): PolicyOverrides {
  for (const [code, a] of Object.entries(ov.agencies)) {
    for (const layer of ['ceiling', 'enabled'] as const) {
      const pruned = pruneLayer(a[layer])
      if (pruned) a[layer] = pruned
      else delete a[layer]
    }
    if (a.roles) {
      for (const tier of Object.keys(a.roles)) {
        const pruned = pruneLayer(a.roles[tier])
        if (pruned) a.roles[tier] = pruned
        else delete a.roles[tier]
      }
      if (isEmpty(a.roles)) delete a.roles
    }
    if (isEmpty(a)) delete ov.agencies[code]
  }
  return ov
}

/** Returns a new override set with `e` applied to agency `code`. No permission checks - see the policy store. */
export function applyEdit(ov: PolicyOverrides, code: string, e: AccessEdit): PolicyOverrides {
  const next = cloneOverrides(ov)
  const a: AgencyOverride = (next.agencies[code] ??= {})
  const field = (key: string) => (key.startsWith('/') ? 'routes' : 'modules')
  switch (e.kind) {
    case 'scope':
      setKey((a[e.layer] ??= {}), field(e.key), e.key, e.value)
      break
    case 'roleScope':
      setKey(((a.roles ??= {})[e.tier] ??= {}), field(e.key), e.key, e.value)
      break
    case 'category':
      setKey((a[e.layer] ??= {}), 'categories', e.category, e.value)
      break
    case 'capabilities':
      setCaps((a[e.layer] ??= {}), e.caps)
      break
    case 'roleCapabilities':
      setCaps(((a.roles ??= {})[e.tier] ??= {}), e.caps)
      break
    case 'reset':
      if (!e.keepCeiling) delete a.ceiling
      delete a.enabled
      delete a.roles
      break
  }
  return pruneOverrides(next)
}

function anyModuleEnabled(ov: PolicyOverrides, code: string): boolean {
  return editableModules().some(m => moduleSummary(ov, code, 'enabled', null, m).scope !== 'none')
}

/** A plain-language consequence worth confirming before applying `e`, or null when there is none. */
export function editWarning(ov: PolicyOverrides, code: string, e: AccessEdit): string | null {
  const next = applyEdit(ov, code, e)
  const hadM10 = moduleSummary(ov, code, 'enabled', null, 'M10').scope !== 'none'
  if (hadM10 && moduleSummary(next, code, 'enabled', null, 'M10').scope === 'none') {
    return `${code}'s admins will lose Access Control - Users, Roles, Audit Trail and Module Access.`
  }
  if (anyModuleEnabled(ov, code) && !anyModuleEnabled(next, code)) {
    return `${code} will have no modules enabled - its users will only see the restricted dashboard.`
  }
  if (adminCanManagePolicy(ov, code) && !adminCanManagePolicy(next, code)) {
    return `${code}'s admins will no longer be able to manage their own agency's access.`
  }
  return null
}
```

- [ ] **Step 4: Create `app/utils/accessPolicyStorage.ts`**

```ts
/**
 * accessPolicyStorage - where saved Module Access overrides live.
 *
 * Interim: this browser's localStorage (spec: "Local preview - changes are
 * saved in this browser only"). When the accounts API exposes
 * GET/PUT /api/v1/access-control/, add an adapter with the same interface
 * and pass it to setAccessPolicyStorage() - nothing else changes.
 */

import { POLICY_VERSION, type PolicyOverrides } from '~/utils/resolveAccess'

export interface AccessPolicyStorage {
  load(): Promise<PolicyOverrides | null>
  save(overrides: PolicyOverrides): Promise<void>
}

export const ACCESS_POLICY_STORAGE_KEY = 'uapts:access-policy:v1'

/** Returns the stored policy, or null (with a warning) when it's missing, unreadable, or from another version. */
export function parseStoredPolicy(raw: string | null): PolicyOverrides | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.version !== POLICY_VERSION || typeof parsed.agencies !== 'object' || parsed.agencies === null) {
      console.warn('[access-policy] ignoring saved access settings with an unknown version')
      return null
    }
    return parsed as PolicyOverrides
  } catch {
    console.warn('[access-policy] ignoring unreadable saved access settings')
    return null
  }
}

export const localAccessPolicyStorage: AccessPolicyStorage = {
  async load() {
    if (typeof localStorage === 'undefined') return null
    return parseStoredPolicy(localStorage.getItem(ACCESS_POLICY_STORAGE_KEY))
  },
  async save(overrides) {
    localStorage.setItem(ACCESS_POLICY_STORAGE_KEY, JSON.stringify(overrides))
  },
}
```

- [ ] **Step 5: Create `app/stores/accessPolicy.ts`**

```ts
/**
 * accessPolicy - Module Access override layers (ceiling / agency enabled /
 * role) on top of app/config/access-control.json. See
 * docs/superpowers/specs/2026-09-28-module-access-control-design.md.
 *
 * `overrides` is what the resolver reads (useAccessControl); `draft` is what
 * /access-policies edits until Save. Every change goes through edit(), which
 * checks the viewer's rights first - the page's disabled controls are a
 * convenience, not the gate (and once the accounts API replaces the storage
 * adapter, the server is the real gate, spec section 2.1).
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { localAccessPolicyStorage, type AccessPolicyStorage } from '~/utils/accessPolicyStorage'
import {
  BASE_SETTINGS, EMPTY_OVERRIDES, adminCanManagePolicy, isCategoryLocked, partitionStale, type PolicyOverrides,
} from '~/utils/resolveAccess'
import { applyEdit, cloneOverrides, editLayer, pruneOverrides, stableStringify, type AccessEdit } from '~/utils/accessEdits'

export class AccessPolicyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccessPolicyError'
  }
}

let storage: AccessPolicyStorage = localAccessPolicyStorage

/** Swap point for tests now and the accounts API adapter later. */
export function setAccessPolicyStorage(next: AccessPolicyStorage) {
  storage = next
}

interface PolicyViewer { email?: string; role_type?: string; agency_code?: string | null }

export const useAccessPolicyStore = defineStore('accessPolicy', () => {
  const auth = useAuthStore()

  const overrides = ref<PolicyOverrides>(cloneOverrides(EMPTY_OVERRIDES))
  const draft = ref<PolicyOverrides>(cloneOverrides(EMPTY_OVERRIDES))
  const loaded = ref(false)
  const saving = ref(false)
  const saveError = ref<string | null>(null)

  const viewer = computed(() => auth.user as unknown as PolicyViewer | null)
  const isSuperAdmin = computed(() => viewer.value?.role_type === 'super_admin')

  const dirtyAgencies = computed(() => {
    const codes = new Set([...Object.keys(draft.value.agencies), ...Object.keys(overrides.value.agencies)])
    return [...codes].filter(c => stableStringify(draft.value.agencies[c]) !== stableStringify(overrides.value.agencies[c]))
  })
  const isDirty = computed(() => dirtyAgencies.value.length > 0)
  const staleKeys = computed(() => partitionStale(overrides.value).stale)

  /** super_admin: any agency. Agency admin: only their own. */
  function canEditAgency(code: string): boolean {
    if (!BASE_SETTINGS.agencies[code]) return false
    if (isSuperAdmin.value) return true
    return viewer.value?.role_type === 'admin' && viewer.value.agency_code?.toUpperCase() === code
  }

  function edit(code: string, e: AccessEdit) {
    if (!canEditAgency(code)) throw new AccessPolicyError(`You can't change access for ${code}.`)
    if (editLayer(e) === 'ceiling' && !isSuperAdmin.value) {
      throw new AccessPolicyError('Only super admin can change what an agency is allowed.')
    }
    if (e.kind === 'category' && isCategoryLocked(e.category)) {
      throw new AccessPolicyError(`${e.category} is blocked platform-wide and can't be changed here.`)
    }
    const next = applyEdit(draft.value, code, e)
    if (!isSuperAdmin.value && adminCanManagePolicy(draft.value, code) && !adminCanManagePolicy(next, code)) {
      throw new AccessPolicyError("That change would remove your own ability to manage your agency's access.")
    }
    draft.value = next
  }

  /** super_admin clears every layer; an agency admin clears enabled + roles and keeps the ceiling. */
  function resetAgency(code: string) {
    edit(code, { kind: 'reset', keepCeiling: !isSuperAdmin.value })
  }

  function discard() {
    draft.value = cloneOverrides(overrides.value)
    saveError.value = null
  }

  function clearStale() {
    if (!isSuperAdmin.value) throw new AccessPolicyError('Only super admin can clear stale settings.')
    draft.value = pruneOverrides(partitionStale(draft.value).cleaned)
  }

  async function load() {
    try {
      const stored = await storage.load()
      if (stored) overrides.value = stored
    } catch (err) {
      console.warn('[access-policy] could not load saved access settings - using defaults', err)
    }
    draft.value = cloneOverrides(overrides.value)
    loaded.value = true
  }

  async function save() {
    if (!isDirty.value) return
    saving.value = true
    saveError.value = null
    const next = cloneOverrides(draft.value)
    const stamp = new Date().toISOString()
    const by = viewer.value?.email ?? 'unknown'
    for (const code of dirtyAgencies.value) {
      const agency = next.agencies[code]
      if (agency) {
        agency.updatedAt = stamp
        agency.updatedBy = by
      }
    }
    try {
      await storage.save(next)
      overrides.value = next
      draft.value = cloneOverrides(next)
    } catch (err) {
      console.warn('[access-policy] save failed', err)
      saveError.value = "Couldn't save in this browser (storage may be full or blocked). Your changes are still here - try again."
    } finally {
      saving.value = false
    }
  }

  return {
    overrides, draft, loaded, saving, saveError,
    isSuperAdmin, dirtyAgencies, isDirty, staleKeys,
    canEditAgency, edit, resetAgency, discard, clearStale, load, save,
  }
})
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/unit/access-policy-store.test.ts`
Expected: PASS.

- [ ] **Step 7: Checkpoint**

Run: `npx vitest run`
Expected: whole suite PASS.

---

### Task 4: Wire saved overrides into the app

**Files:**
- Modify: `app/composables/useAccessControl.ts` (imports + the `overrides` computed)
- Create: `app/plugins/access-policy.client.ts`
- Modify: `app/components/AppSidebar.vue:188-197`
- Modify: `app/components/AppTopNav.vue:276-279`
- Test: `tests/unit/access-policy-wiring.test.ts`

**Interfaces:**
- Consumes: `useAccessPolicyStore()` (`overrides`, `draft`, `load`) from Task 3.
- Produces: resolver, sidebar, palette and middleware react to `store.overrides` (saved state only, never `draft`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/access-policy-wiring.test.ts
// ─────────────────────────────────────────────────────────────────────
// useAccessControl() resolves against the policy store's SAVED overrides -
// never the unsaved draft - and falls back to the JSON outside a Pinia app.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

;(globalThis as any).$fetch = vi.fn()
const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

import { useAccessControl } from '~/composables/useAccessControl'
import { useAccessPolicyStore } from '~/stores/accessPolicy'

beforeEach(() => {
  setActivePinia(createPinia())
  userRef.value = { id: 'u', email: 'u@example.com', agency_code: 'KENHA', role_type: 'analyst' }
})

describe('useAccessControl + saved Module Access overrides', () => {
  it('a saved override changes what the resolver allows', () => {
    const store = useAccessPolicyStore()
    const access = useAccessControl()
    expect(access.canAccessRoute('/traffic')).toBe(true)
    store.overrides = { version: 1, agencies: { KENHA: { enabled: { modules: { M02: 'none' } } } } }
    expect(access.canAccessRoute('/traffic')).toBe(false)
  })

  it('an unsaved draft does not', () => {
    const store = useAccessPolicyStore()
    const access = useAccessControl()
    store.draft = { version: 1, agencies: { KENHA: { enabled: { modules: { M02: 'none' } } } } }
    expect(access.canAccessRoute('/traffic')).toBe(true)
  })

  it('hasCapability follows saved role overrides', () => {
    const store = useAccessPolicyStore()
    const access = useAccessControl()
    expect(access.hasCapability('export')).toBe(true)
    store.overrides = { version: 1, agencies: { KENHA: { roles: { analyst: { capabilities: ['run_reports'] } } } } }
    expect(access.hasCapability('export')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/access-policy-wiring.test.ts`
Expected: FAIL - first test: `expected true to be false` (resolver still reads `EMPTY_OVERRIDES`).

- [ ] **Step 3: Read the store in `useAccessControl.ts`**

Add to the imports:

```ts
import { getActivePinia } from 'pinia'
import { useAccessPolicyStore } from '~/stores/accessPolicy'
```

Replace `const overrides = computed<PolicyOverrides>(() => EMPTY_OVERRIDES)` with:

```ts
  // Saved Module Access overrides (never the page's unsaved draft). The store
  // is only missing outside a Pinia app - plain unit tests - where the JSON
  // alone applies, exactly as before any override is saved.
  const policy = getActivePinia() ? useAccessPolicyStore() : null
  const overrides = computed<PolicyOverrides>(() => policy?.overrides ?? EMPTY_OVERRIDES)
```

- [ ] **Step 4: Create `app/plugins/access-policy.client.ts`**

```ts
// Loads saved Module Access overrides before the first navigation, so the
// route middleware and sidebar resolve against them from the start (SSR is
// off app-wide - see nuxt.config.ts routeRules - so this always runs first).
import { useAccessPolicyStore } from '~/stores/accessPolicy'

export default defineNuxtPlugin(async () => {
  await useAccessPolicyStore().load()
})
```

- [ ] **Step 5: Add the sidebar link**

In `app/components/AppSidebar.vue`, change the M10 `<details>` open list and add the link after "Roles & Permissions":

```vue
      <details v-if="canSeeModule('M10')" class="sidebar-group" :open="groupIsOpen(['/agencies', '/users', '/roles', '/access-policies', '/audit'])">
```

```vue
          <NuxtLink v-if="canSee('/roles')" class="sidebar-link" to="/roles" :class="{ active: isActive('/roles') }">Roles & Permissions</NuxtLink>
          <NuxtLink v-if="canSee('/access-policies')" class="sidebar-link" to="/access-policies" :class="{ active: isActive('/access-policies') }">Module Access</NuxtLink>
```

- [ ] **Step 6: Add the command-palette entry**

In `app/components/AppTopNav.vue` after the `'Roles & Permissions'` item:

```ts
  { label: 'Module Access', group: 'Access Control', to: '/access-policies', icon: Users },
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/unit/access-policy-wiring.test.ts tests/unit/access-parity.test.ts tests/unit/access-control.test.ts`
Expected: PASS.

- [ ] **Step 8: Checkpoint**

Run: `npx vitest run`
Expected: whole suite PASS.

---

### Task 5: `AccessScopeToggle` component

**Files:**
- Create: `app/components/AccessScopeToggle.vue`
- Test: `tests/unit/access-scope-toggle.test.ts`

**Interfaces:**
- Consumes: `scopeRank`, `ScopeLevel` from `~/utils/resolveAccess`.
- Produces: `<AccessScopeToggle>` props `modelValue: ScopeLevel | null` (null = inherit), `label: string` (aria), `max?: ScopeLevel` (default `'full'`), `allowInherit?: boolean`, `inheritedLabel?: string`, `disabled?: boolean`, `compact?: boolean`; emits `update:modelValue(ScopeLevel | null)`. Each option button carries `data-scope="inherit|none|read|full"`; a `.scope-capped` marker renders when `modelValue` exceeds `max`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/access-scope-toggle.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AccessScopeToggle from '~/components/AccessScopeToggle.vue'

const opt = (w: any, scope: string) => w.find(`[data-scope="${scope}"]`)

describe('AccessScopeToggle', () => {
  it('marks the current value and emits the chosen scope', async () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'read', label: 'Traffic' } })
    expect(opt(w, 'read').attributes('aria-checked')).toBe('true')
    await opt(w, 'none').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['none'])
  })

  it('disables options above max', () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'read', max: 'read', label: 'Traffic' } })
    expect(opt(w, 'full').attributes('disabled')).toBeDefined()
    expect(opt(w, 'read').attributes('disabled')).toBeUndefined()
  })

  it('offers Inherit with the inherited value and emits null for it', async () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'none', allowInherit: true, inheritedLabel: 'full', label: 'Traffic' } })
    expect(opt(w, 'inherit').text()).toContain('full')
    await opt(w, 'inherit').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([null])
  })

  it('shows capped when the stored value is above max', () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'full', max: 'read', label: 'Traffic' } })
    expect(w.find('.scope-capped').exists()).toBe(true)
  })

  it('emits nothing when disabled', async () => {
    const w = mount(AccessScopeToggle, { props: { modelValue: 'read', disabled: true, label: 'Traffic' } })
    await opt(w, 'none').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/access-scope-toggle.test.ts`
Expected: FAIL - cannot find `~/components/AccessScopeToggle.vue`.

- [ ] **Step 3: Create the component**

```vue
<template>
  <!--
    Segmented None / Read / Full control, optionally with an Inherit option
    (modelValue null). `max` greys out options above what the layer above
    allows; a stored value already above `max` is flagged "capped" - it
    stays saved but resolves to `max` (spec: lowering a ceiling never
    rewrites lower layers).
  -->
  <div class="scope-toggle" :class="{ compact }" role="radiogroup" :aria-label="label">
    <button
      v-for="opt in options" :key="opt.key" type="button" role="radio"
      class="scope-opt" :class="{ active: current === opt.key }"
      :aria-checked="current === opt.key" :aria-label="opt.label"
      :disabled="isDisabled(opt.key)" :title="titleFor(opt.key)" :data-scope="opt.key"
      @click="choose(opt.key)"
    >{{ compact ? opt.short : opt.label }}</button>
    <span v-if="capped" class="scope-capped" :title="`Saved as ${modelValue}, limited to ${max} by the level above`">capped</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { scopeRank, type ScopeLevel } from '~/utils/resolveAccess'

type OptionKey = ScopeLevel | 'inherit'

const props = withDefaults(defineProps<{
  modelValue: ScopeLevel | null
  label: string
  max?: ScopeLevel
  allowInherit?: boolean
  inheritedLabel?: string
  disabled?: boolean
  compact?: boolean
}>(), { max: 'full', allowInherit: false, inheritedLabel: '', disabled: false, compact: false })

const emit = defineEmits<{ 'update:modelValue': [ScopeLevel | null] }>()

const options = computed<{ key: OptionKey; label: string; short: string }[]>(() => [
  ...(props.allowInherit
    ? [{ key: 'inherit' as const, label: props.inheritedLabel ? `Inherit · ${props.inheritedLabel}` : 'Inherit', short: 'I' }]
    : []),
  { key: 'none', label: 'None', short: 'N' },
  { key: 'read', label: 'Read', short: 'R' },
  { key: 'full', label: 'Full', short: 'F' },
])

const current = computed<OptionKey>(() => props.modelValue ?? (props.allowInherit ? 'inherit' : 'none'))
const capped = computed(() => !!props.modelValue && scopeRank(props.modelValue) > scopeRank(props.max))

function aboveMax(key: OptionKey) {
  return key !== 'inherit' && scopeRank(key) > scopeRank(props.max)
}
function isDisabled(key: OptionKey) {
  return props.disabled || aboveMax(key)
}
function titleFor(key: OptionKey) {
  if (props.disabled) return 'Read-only for your role'
  if (aboveMax(key)) return `Not available - the level above allows at most ${props.max}`
  return undefined
}
function choose(key: OptionKey) {
  if (isDisabled(key)) return
  emit('update:modelValue', key === 'inherit' ? null : key)
}
</script>

<style scoped>
.scope-toggle {
  display: inline-flex; align-items: center; gap: 0;
  border: 1px solid var(--border-subtle); border-radius: var(--r-sm); overflow: hidden;
  background: var(--surface-2);
}
.scope-opt {
  background: none; border: none; border-right: 1px solid var(--border-subtle);
  padding: 4px 9px; font-size: 11.5px; font-weight: 500; color: var(--fg-2);
  cursor: pointer; white-space: nowrap; font-family: inherit;
  transition: background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
.scope-opt:last-of-type { border-right: none; }
.compact .scope-opt { padding: 4px 7px; min-width: 24px; }
.scope-opt:hover:not(:disabled):not(.active) { background: var(--primary-wash); color: var(--fg-1); }
.scope-opt.active { background: var(--primary); color: #fff; font-weight: 600; }
.scope-opt:disabled { cursor: not-allowed; opacity: 0.45; }
.scope-opt.active:disabled { opacity: 0.7; }
.scope-capped {
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
  padding: 0 7px; color: var(--warning-fg); background: var(--warning-bg); align-self: stretch;
  display: inline-flex; align-items: center;
}
</style>
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/access-scope-toggle.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `npx vitest run`
Expected: whole suite PASS.

---

### Task 6: Page shell + Agency access tab

Read `DESIGN.md` (Components, Layout, Colors) before starting; keep the page flat, 1px hairlines, no shadows.

**Files:**
- Create: `app/components/AccessAgencyTab.vue`
- Create: `app/pages/access-policies.vue`
- Test: `tests/unit/access-policies-page.test.ts`

**Interfaces:**
- Consumes: store (`draft`, `overrides`, `isDirty`, `dirtyAgencies`, `saving`, `saveError`, `staleKeys`, `canEditAgency`, `edit`, `discard`, `save`, `load`, `loaded`, `clearStale`), `editWarning`, `AccessEdit`, `AccessPolicyError`, `AccessScopeToggle`, `TabStrip`, `ConfirmDialog`, `PageHeader`.
- Produces: `<AccessAgencyTab code overrides can-edit-ceiling can-edit-enabled @edit>`; toggles wrapped in `data-testid="ceiling-<key>"` / `"enabled-<key>"` where key is a module id or route. The page's `onEdit(e: AccessEdit)` handler, which later tabs reuse via `@edit="onEdit"`.

- [ ] **Step 1: Write the failing page test**

```ts
// tests/unit/access-policies-page.test.ts
// ─────────────────────────────────────────────────────────────────────
// /access-policies: super_admin edits every agency's ceiling; an agency
// admin sees only its own agency, ceiling read-only, enabled capped.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia, type Pinia } from 'pinia'

;(globalThis as any).$fetch = vi.fn()
const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })
;(globalThis as any).onBeforeRouteLeave = () => {}

import { useAccessControl } from '~/composables/useAccessControl'
;(globalThis as any).useAccessControl = useAccessControl

import { useAuthStore } from '~/stores/auth'
import { useAccessPolicyStore } from '~/stores/accessPolicy'
import { BASE_SETTINGS } from '~/utils/resolveAccess'
import Page from '~/pages/access-policies.vue'
import TabStrip from '~/components/TabStrip.vue'
import AccessScopeToggle from '~/components/AccessScopeToggle.vue'
import AccessAgencyTab from '~/components/AccessAgencyTab.vue'

let pinia: Pinia
function signIn(agency_code: string | null, role_type: string) {
  const u = { id: 'u1', email: 'me@example.com', agency_code, role_type }
  userRef.value = u
  useAuthStore().user = u as any
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

function mountPage() {
  return mount(Page, {
    global: {
      plugins: [pinia],
      components: { TabStrip, AccessScopeToggle, AccessAgencyTab },
      stubs: { PageHeader: true, ConfirmDialog: true, NuxtLink: true, AccessRolesTab: true, AccessCategoriesTab: true, AccessPreviewPanel: true },
    },
  })
}
const btn = (w: any, testid: string, scope: string) => w.find(`[data-testid="${testid}"] [data-scope="${scope}"]`)

describe('access-policies page - agency access', () => {
  it('super_admin gets the agency rail and editable Allowed controls', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    expect(w.find('.agency-rail').exists()).toBe(true)
    expect(w.findAll('.rail-item')).toHaveLength(Object.keys(BASE_SETTINGS.agencies).length)
    expect(btn(w, 'ceiling-M02', 'full').attributes('disabled')).toBeUndefined()
    expect(w.text()).toContain('saved in this browser only')
  })

  it('an agency admin sees only its own agency, Allowed read-only, Enabled capped at Allowed', async () => {
    signIn('KPA', 'admin')
    const w = mountPage()
    await flushPromises()
    expect(w.find('.agency-rail').exists()).toBe(false)
    expect(w.find('.agency-name').text()).toContain('Kenya Ports Authority')
    expect(btn(w, 'ceiling-M12', 'none').attributes('disabled')).toBeDefined()
    // KPA's JSON denies M02, so its ceiling is none and Enabled can't go above it.
    expect(btn(w, 'enabled-M02', 'read').attributes('disabled')).toBeDefined()
    expect(btn(w, 'enabled-M12', 'read').attributes('disabled')).toBeUndefined()
  })

  it('an agency admin edit lands in the draft', async () => {
    signIn('KPA', 'admin')
    const w = mountPage()
    await flushPromises()
    await btn(w, 'enabled-M13', 'none').trigger('click')
    const store = useAccessPolicyStore()
    expect(store.draft.agencies.KPA.enabled?.modules?.M13).toBe('none')
    expect(store.isDirty).toBe(true)
  })

  it('super_admin removing Access Control asks for confirmation instead of applying', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    await btn(w, 'ceiling-M10', 'none').trigger('click')
    expect(w.find('confirm-dialog-stub').attributes('open')).toBe('true')
    expect(useAccessPolicyStore().isDirty).toBe(false)
  })

  it('expanding a module shows its pages', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    expect(w.find('[data-testid="ceiling-/traffic/alerts"]').exists()).toBe(false)
    const m02Row = w.findAll('.module-row').find((r: any) => r.find('[data-testid="ceiling-M02"]').exists())!
    await m02Row.find('.expand-btn').trigger('click')
    expect(w.find('[data-testid="ceiling-/traffic/alerts"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/access-policies-page.test.ts`
Expected: FAIL - cannot find `~/pages/access-policies.vue`.

- [ ] **Step 3: Create `app/components/AccessAgencyTab.vue`**

```vue
<template>
  <!--
    Agency access: what the agency may have (Allowed - super_admin) and what
    it has switched on within that (Enabled - its own admin). Module rows set
    every page at once; expanding a module exposes per-page overrides.
  -->
  <table class="data-table access-table">
    <thead>
      <tr>
        <th scope="col">Module</th>
        <th scope="col">Allowed <span class="th-note">set by super admin</span></th>
        <th scope="col">Enabled <span class="th-note">set by agency admin</span></th>
      </tr>
    </thead>
    <tbody>
      <template v-for="m in modules" :key="m">
        <tr class="module-row">
          <td>
            <div class="module-cell">
              <button
                type="button" class="expand-btn" :aria-expanded="expanded.has(m)"
                :aria-label="`${expanded.has(m) ? 'Hide' : 'Show'} pages in ${label(m)}`" @click="toggle(m)"
              >{{ expanded.has(m) ? '▾' : '▸' }}</button>
              <span class="module-label">{{ label(m) }}</span>
              <span class="module-id">{{ m }}</span>
              <span v-if="!raw('ceiling', m) && domainLabel(m)" class="module-hint">via {{ domainLabel(m) }}</span>
            </div>
          </td>
          <td :data-testid="`ceiling-${m}`">
            <AccessScopeToggle
              :model-value="raw('ceiling', m)" allow-inherit
              :inherited-label="moduleInherited('ceiling', m)"
              :disabled="!canEditCeiling" :label="`${label(m)} - allowed`"
              @update:model-value="v => emitScope('ceiling', m, v)"
            />
          </td>
          <td :data-testid="`enabled-${m}`">
            <AccessScopeToggle
              :model-value="raw('enabled', m)" allow-inherit
              :inherited-label="moduleInherited('enabled', m)"
              :max="moduleSummary(overrides, code, 'ceiling', null, m).scope"
              :disabled="!canEditEnabled" :label="`${label(m)} - enabled`"
              @update:model-value="v => emitScope('enabled', m, v)"
            />
          </td>
        </tr>
        <template v-if="expanded.has(m)">
          <tr v-for="r in editableRoutes(m)" :key="r" class="page-row">
            <td class="page-cell"><code>{{ r }}</code></td>
            <td :data-testid="`ceiling-${r}`">
              <AccessScopeToggle
                :model-value="raw('ceiling', r)" allow-inherit
                :inherited-label="pageScope(overrides, code, 'ceiling', null, r, { layer: 'ceiling', key: 'route' })"
                :disabled="!canEditCeiling" :label="`${r} - allowed`"
                @update:model-value="v => emitScope('ceiling', r, v)"
              />
            </td>
            <td :data-testid="`enabled-${r}`">
              <AccessScopeToggle
                :model-value="raw('enabled', r)" allow-inherit
                :inherited-label="pageScope(overrides, code, 'enabled', null, r, { layer: 'enabled', key: 'route' })"
                :max="pageScope(overrides, code, 'ceiling', null, r)"
                :disabled="!canEditEnabled" :label="`${r} - enabled`"
                @update:model-value="v => emitScope('enabled', r, v)"
              />
            </td>
          </tr>
        </template>
      </template>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  BASE_SETTINGS, editableModules, editableRoutes, inheritedDomainLabel, moduleSummary, pageScope,
  type PolicyOverrides, type ScopeLevel,
} from '~/utils/resolveAccess'
import type { AccessEdit, EditableLayer } from '~/utils/accessEdits'

const props = defineProps<{
  code: string
  overrides: PolicyOverrides
  canEditCeiling: boolean
  canEditEnabled: boolean
}>()
const emit = defineEmits<{ edit: [AccessEdit] }>()

const modules = editableModules()
const expanded = ref(new Set<string>())

function toggle(m: string) {
  const next = new Set(expanded.value)
  if (next.has(m)) next.delete(m)
  else next.add(m)
  expanded.value = next
}
function label(m: string) {
  return BASE_SETTINGS.modules[m]?.label ?? m
}
function domainLabel(m: string) {
  return inheritedDomainLabel(props.code, m)
}
function raw(layer: EditableLayer, key: string): ScopeLevel | null {
  const l = props.overrides.agencies[props.code]?.[layer]
  return (key.startsWith('/') ? l?.routes?.[key] : l?.modules?.[key]) ?? null
}
function moduleInherited(layer: EditableLayer, m: string): string {
  const s = moduleSummary(props.overrides, props.code, layer, null, m, { layer, key: 'module' })
  return s.mixed ? 'mixed' : s.scope
}
function emitScope(layer: EditableLayer, key: string, value: ScopeLevel | null) {
  emit('edit', { kind: 'scope', layer, key, value })
}
</script>

<style scoped>
.module-cell { display: flex; align-items: center; gap: 8px; }
.expand-btn {
  background: none; border: none; color: var(--fg-3); cursor: pointer;
  width: 18px; padding: 0; font-size: 12px; font-family: inherit;
}
.expand-btn:hover { color: var(--primary); }
.module-label { color: var(--fg-1); font-weight: 600; }
.module-id, .module-hint, .th-note { font-size: 11px; color: var(--fg-3); font-weight: 400; text-transform: none; letter-spacing: 0; }
.page-row td { background: var(--surface-sunken); }
.page-cell { padding-left: 39px; }
.page-cell code { font-size: 11.5px; color: var(--fg-2); }
</style>
```

- [ ] **Step 4: Create `app/pages/access-policies.vue`**

```vue
<template>
  <PageHeader
    eyebrow="Access Control"
    title="Module Access"
    subtitle="Which modules, pages and restricted data each agency - and each role inside it - can reach"
  >
    <template #actions>
      <span v-if="store.isDirty" class="badge warning unsaved-pill">
        Unsaved · {{ store.dirtyAgencies.length }} {{ store.dirtyAgencies.length === 1 ? 'agency' : 'agencies' }}
      </span>
      <button type="button" class="btn" :disabled="!store.isDirty || store.saving" @click="store.discard()">Discard changes</button>
      <button type="button" class="btn-primary" :disabled="!store.isDirty || store.saving" @click="store.save()">
        {{ store.saving ? 'Saving…' : 'Save changes' }}
      </button>
    </template>
  </PageHeader>

  <p class="local-banner" role="note">
    Local preview - changes are saved in this browser only and do not reach other users or the server.
  </p>
  <div v-if="store.saveError" class="error-banner">⚠ {{ store.saveError }}</div>
  <div v-if="actionError" class="error-banner">⚠ {{ actionError }}</div>

  <p v-if="!selected" class="error-banner">
    Your account isn't linked to an agency this page knows about, so there is nothing to manage here.
  </p>

  <div v-else class="access-layout" :class="{ 'has-rail': isSuper }">
    <nav v-if="isSuper" class="agency-rail" aria-label="Agencies">
      <input v-model="agencySearch" class="select-sm rail-search" placeholder="Filter agencies…" aria-label="Filter agencies" />
      <button
        v-for="code in filteredCodes" :key="code" type="button"
        class="rail-item" :class="{ active: code === selected }" :aria-current="code === selected ? 'true' : undefined"
        :title="BASE_SETTINGS.agencies[code].name" @click="selected = code"
      >
        <span class="rail-code">{{ code }}</span>
        <span v-if="store.draft.agencies[code]" class="rail-dot" aria-label="Changed from defaults" />
        <span class="rail-count" :title="`${enabledCount(code)} modules enabled`">{{ enabledCount(code) }}</span>
      </button>
    </nav>

    <section class="agency-main" :aria-label="`${selected} access`">
      <header class="agency-head">
        <div>
          <h2 class="agency-name">{{ BASE_SETTINGS.agencies[selected].name }} <span class="agency-code">{{ selected }}</span></h2>
          <p class="agency-meta">{{ lastChanged }}</p>
        </div>
        <button v-if="canEditEnabled" type="button" class="btn-ghost" @click="askReset">Reset to defaults</button>
      </header>

      <p v-if="!canEditEnabled" class="readonly-note">You can view this agency's access but not change it.</p>
      <div v-if="isSuper && store.staleKeys.length" class="error-banner stale-note">
        {{ store.staleKeys.length }} saved {{ store.staleKeys.length === 1 ? 'setting refers' : 'settings refer' }} to agencies,
        modules or pages that no longer exist and {{ store.staleKeys.length === 1 ? 'is' : 'are' }} ignored.
        <button type="button" class="btn-ghost" @click="store.clearStale()">Clear them</button>
      </div>

      <TabStrip v-model="tab" :tabs="tabs" />

      <AccessAgencyTab
        v-if="tab === 'agency'"
        :code="selected" :overrides="store.draft"
        :can-edit-ceiling="isSuper" :can-edit-enabled="canEditEnabled"
        @edit="onEdit"
      />
    </section>
  </div>

  <ConfirmDialog
    :open="!!confirmSpec"
    :title="confirmSpec?.title ?? ''"
    :message="confirmSpec?.message ?? ''"
    :confirm-label="confirmSpec?.confirmLabel ?? 'Continue'"
    danger
    @confirm="runConfirm"
    @cancel="cancelConfirm"
  />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAccessPolicyStore, AccessPolicyError } from '~/stores/accessPolicy'
import { BASE_SETTINGS, editableModules, moduleSummary } from '~/utils/resolveAccess'
import { editWarning, type AccessEdit } from '~/utils/accessEdits'

// ── Who is looking ─────────────────────────────────────────────────────
// super_admin: every agency, every layer. Agency admin: own agency only,
// enabled + role layers. Everyone else never reaches this route
// (access-control.json: /access-policies minTier admin). The store re-checks
// every edit; the disabled controls here are only the clean experience.
const { user } = useAuth()
const access = useAccessControl()
const store = useAccessPolicyStore()

const isSuper = computed(() => user.value?.role_type === 'super_admin')
const agencyCodes = Object.keys(BASE_SETTINGS.agencies)
const ownCode = computed(() => {
  const code = user.value?.agency_code?.toUpperCase() ?? null
  return code && BASE_SETTINGS.agencies[code] ? code : null
})

const selected = ref<string | null>(isSuper.value ? agencyCodes[0] ?? null : ownCode.value)
const canEditEnabled = computed(() =>
  !!selected.value && store.canEditAgency(selected.value) && access.resolveRoute('/access-policies').scopeLevel === 'full',
)

// ── Agency rail ────────────────────────────────────────────────────────
const agencySearch = ref('')
const filteredCodes = computed(() => {
  const q = agencySearch.value.trim().toLowerCase()
  if (!q) return agencyCodes
  return agencyCodes.filter(c => `${c} ${BASE_SETTINGS.agencies[c].name}`.toLowerCase().includes(q))
})
function enabledCount(code: string) {
  return editableModules().filter(m => moduleSummary(store.draft, code, 'enabled', null, m).scope !== 'none').length
}

const lastChanged = computed(() => {
  const saved = selected.value ? store.overrides.agencies[selected.value] : undefined
  if (!saved?.updatedAt) return 'Using platform defaults - never changed here'
  return `Last changed by ${saved.updatedBy ?? 'unknown'} · ${new Date(saved.updatedAt).toLocaleString()}`
})

// ── Tabs ───────────────────────────────────────────────────────────────
const tab = ref('agency')
const tabs = [
  { key: 'agency', label: 'Agency access' },
  { key: 'roles', label: 'Role permissions' },
  { key: 'categories', label: 'Data categories' },
]

// ── Edits, guardrails, confirmation ────────────────────────────────────
interface ConfirmSpec { title: string; message: string; confirmLabel: string; run: () => void; cancel?: () => void }
const confirmSpec = ref<ConfirmSpec | null>(null)
const actionError = ref<string | null>(null)

function applyNow(code: string, e: AccessEdit) {
  actionError.value = null
  try {
    store.edit(code, e)
  } catch (err) {
    actionError.value = err instanceof AccessPolicyError ? err.message : 'That change could not be applied.'
  }
}

function onEdit(e: AccessEdit) {
  const code = selected.value
  if (!code) return
  // Agency admins can't make the edits these warnings describe at all - the
  // store's self-lockout guard rejects them - so only super_admin is asked.
  const warning = isSuper.value ? editWarning(store.draft, code, e) : null
  if (!warning) return applyNow(code, e)
  confirmSpec.value = { title: `Change ${code}'s access?`, message: warning, confirmLabel: 'Apply change', run: () => applyNow(code, e) }
}

function askReset() {
  const code = selected.value
  if (!code) return
  confirmSpec.value = {
    title: `Reset ${code} to defaults?`,
    message: isSuper.value
      ? `Clears every Module Access change for ${code} - allowed, enabled and role settings. Nothing is saved until you press Save changes.`
      : 'Clears your agency\'s enabled and role settings back to what super admin allows. Nothing is saved until you press Save changes.',
    confirmLabel: 'Reset',
    run: () => applyNow(code, { kind: 'reset', keepCeiling: !isSuper.value }),
  }
}

function runConfirm() {
  const spec = confirmSpec.value
  confirmSpec.value = null
  spec?.run()
}
function cancelConfirm() {
  const spec = confirmSpec.value
  confirmSpec.value = null
  spec?.cancel?.()
}

// ── Unsaved-changes guards ─────────────────────────────────────────────
onBeforeRouteLeave(() => {
  if (!store.isDirty) return true
  return new Promise<boolean>((resolve) => {
    confirmSpec.value = {
      title: 'Leave without saving?',
      message: 'Your Module Access changes have not been saved and will be discarded.',
      confirmLabel: 'Discard and leave',
      run: () => { store.discard(); resolve(true) },
      cancel: () => resolve(false),
    }
  })
})

function onBeforeUnload(ev: BeforeUnloadEvent) {
  if (!store.isDirty) return
  ev.preventDefault()
  ev.returnValue = ''
}
onMounted(() => {
  if (!store.loaded) store.load()
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
</script>

<style scoped>
.unsaved-pill { align-self: center; }
.local-banner {
  margin: 8px 0 12px; padding: 8px 14px; border-radius: var(--r-sm);
  background: var(--primary-wash); border: 1px solid var(--border-subtle);
  color: var(--fg-2); font-size: 12.5px;
}
.access-layout { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 16px; align-items: start; }
.access-layout.has-rail { grid-template-columns: 200px minmax(0, 1fr) 260px; }
.agency-rail {
  display: flex; flex-direction: column; gap: 2px; position: sticky; top: 12px;
  max-height: calc(100vh - 140px); overflow-y: auto;
  border: 1px solid var(--border-subtle); border-radius: var(--r-sm); background: var(--surface-2); padding: 8px;
}
.rail-search { width: 100%; margin-bottom: 6px; }
.rail-item {
  display: flex; align-items: center; gap: 6px; width: 100%;
  background: none; border: none; border-left: 2px solid transparent; border-radius: 0;
  padding: 6px 8px; font-size: 12.5px; color: var(--fg-2); cursor: pointer; text-align: left; font-family: inherit;
}
.rail-item:hover { background: var(--primary-wash); color: var(--fg-1); }
.rail-item.active { background: var(--primary-wash); color: var(--primary); border-left-color: var(--primary); font-weight: 600; }
.rail-code { flex: 1; }
.rail-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--warning-fg); }
.rail-count {
  font-size: 11px; font-weight: 600; background: var(--surface-sunken); color: var(--fg-2);
  border-radius: var(--r-pill); padding: 1px 7px;
}
.agency-main { min-width: 0; }
.agency-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
.agency-name { font-size: 16px; font-weight: 600; color: var(--fg-1); margin: 0; }
.agency-code { font-size: 12px; font-weight: 500; color: var(--fg-3); margin-left: 6px; }
.agency-meta, .readonly-note { font-size: 12px; color: var(--fg-3); margin: 2px 0 0; }
.readonly-note { margin: 0 0 10px; }
.stale-note { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
@media (max-width: 1100px) {
  .access-layout, .access-layout.has-rail { grid-template-columns: minmax(0, 1fr); }
  .agency-rail { position: static; max-height: 220px; }
}
</style>
```

- [ ] **Step 5: Run the page tests**

Run: `npx vitest run tests/unit/access-policies-page.test.ts`
Expected: PASS.

- [ ] **Step 6: Checkpoint**

Run: `npx vitest run`
Expected: whole suite PASS.

---

### Task 7: Role permissions tab

**Files:**
- Create: `app/components/AccessRolesTab.vue`
- Modify: `app/pages/access-policies.vue` (render the tab)
- Modify: `tests/unit/access-policies-page.test.ts` (register component, add cases)

**Interfaces:**
- Consumes: `agencyRoleTiers`, `capabilitySet`, `CAPABILITIES`, `moduleSummary`, `pageScope`, `editableModules`, `editableRoutes` (Task 2); page `onEdit` (Task 6).
- Produces: `<AccessRolesTab code overrides can-edit-ceiling can-edit-enabled @edit>`; test ids `cap-ceiling-<cap>`, `cap-enabled-<cap>`, `role-<tier>-<key>`, `cap-<tier>-<cap>`.

- [ ] **Step 1: Add failing tests**

In `tests/unit/access-policies-page.test.ts`: add `import AccessRolesTab from '~/components/AccessRolesTab.vue'`, add `AccessRolesTab` to `global.components`, and remove `AccessRolesTab: true` from `stubs`. Then append:

```ts
async function openTab(w: any, label: string) {
  const tabBtn = w.findAll('.tab-strip-tab').find((b: any) => b.text().includes(label))
  await tabBtn.trigger('click')
}

describe('access-policies page - role permissions', () => {
  it('shows a column per role and caps role cells at the agency\'s enabled level', async () => {
    signIn('KENHA', 'admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Role permissions')
    const headers = w.findAll('.role-grid th').map((th: any) => th.text())
    expect(headers).toEqual(expect.arrayContaining(['admin', 'analyst', 'operator']))
    expect(btn(w, 'role-operator-M02', 'full').attributes('disabled')).toBeUndefined()
    // KENHA's JSON denies M04, so no role can be given it.
    expect(btn(w, 'role-operator-M04', 'read').attributes('disabled')).toBeDefined()
  })

  it('applies a role limit to the draft', async () => {
    signIn('KENHA', 'admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Role permissions')
    await btn(w, 'role-operator-M02', 'none').trigger('click')
    expect(useAccessPolicyStore().draft.agencies.KENHA.roles?.operator?.modules?.M02).toBe('none')
  })

  it('refuses to let an agency admin remove its own manage_users, and says why', async () => {
    signIn('KENHA', 'admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Role permissions')
    const box = w.find('[data-testid="cap-admin-manage_users"]')
    await box.setValue(false)
    expect(w.find('.error-banner').text()).toContain('your own ability')
    expect((box.element as HTMLInputElement).checked).toBe(true)
    expect(useAccessPolicyStore().isDirty).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/access-policies-page.test.ts`
Expected: FAIL - cannot find `~/components/AccessRolesTab.vue`.

- [ ] **Step 3: Create `app/components/AccessRolesTab.vue`**

```vue
<template>
  <!--
    Role permissions: the agency-level capability sets, then what each role
    inside the agency may reach (capped at the agency's Enabled level), then
    each role's capabilities (capped at the agency's enabled capabilities).
  -->
  <div class="roles-tab">
    <SectionTitle>Agency capabilities</SectionTitle>
    <table class="data-table cap-table">
      <thead>
        <tr><th scope="col">Capability</th><th scope="col">Allowed</th><th scope="col">Enabled</th></tr>
      </thead>
      <tbody>
        <tr v-for="c in CAPABILITIES" :key="c">
          <td><code>{{ c }}</code></td>
          <td>
            <input
              type="checkbox" :checked="ceilingCaps.has(c)" :disabled="!canEditCeiling"
              :aria-label="`${c} allowed`" :data-testid="`cap-ceiling-${c}`"
              @change="ev => onBox(ev, ceilingCaps.has(c), () => toggleAgencyCap('ceiling', c))"
            />
          </td>
          <td>
            <input
              type="checkbox" :checked="enabledCaps.has(c)" :disabled="!canEditEnabled || !ceilingCaps.has(c)"
              :aria-label="`${c} enabled`" :data-testid="`cap-enabled-${c}`"
              @change="ev => onBox(ev, enabledCaps.has(c), () => toggleAgencyCap('enabled', c))"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <SectionTitle>Pages by role</SectionTitle>
    <p class="tab-note">I = inherit, N = none, R = read, F = full. A role can never exceed what the agency has enabled.</p>
    <div class="grid-scroll">
      <table class="data-table role-grid">
        <thead>
          <tr><th scope="col">Module</th><th v-for="t in tiers" :key="t" scope="col">{{ t }}</th></tr>
        </thead>
        <tbody>
          <template v-for="m in modules" :key="m">
            <tr class="module-row">
              <td>
                <div class="module-cell">
                  <button
                    type="button" class="expand-btn" :aria-expanded="expanded.has(m)"
                    :aria-label="`${expanded.has(m) ? 'Hide' : 'Show'} pages in ${label(m)}`" @click="toggle(m)"
                  >{{ expanded.has(m) ? '▾' : '▸' }}</button>
                  <span class="module-label">{{ label(m) }}</span>
                </div>
              </td>
              <td v-for="t in tiers" :key="t" :data-testid="`role-${t}-${m}`">
                <AccessScopeToggle
                  compact allow-inherit
                  :model-value="rawRole(t, m)" :inherited-label="roleInherited(t, m)"
                  :max="moduleSummary(overrides, code, 'enabled', null, m).scope"
                  :disabled="!canEditEnabled" :label="`${label(m)} for ${t}`"
                  @update:model-value="v => emit('edit', { kind: 'roleScope', tier: t, key: m, value: v })"
                />
              </td>
            </tr>
            <template v-if="expanded.has(m)">
              <tr v-for="r in editableRoutes(m)" :key="r" class="page-row">
                <td class="page-cell"><code>{{ r }}</code></td>
                <td v-for="t in tiers" :key="t" :data-testid="`role-${t}-${r}`">
                  <AccessScopeToggle
                    compact allow-inherit
                    :model-value="rawRole(t, r)"
                    :inherited-label="pageScope(overrides, code, 'role', t, r, { layer: 'role', key: 'route' })"
                    :max="pageScope(overrides, code, 'enabled', null, r)"
                    :disabled="!canEditEnabled" :label="`${r} for ${t}`"
                    @update:model-value="v => emit('edit', { kind: 'roleScope', tier: t, key: r, value: v })"
                  />
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <SectionTitle>Capabilities by role</SectionTitle>
    <table class="data-table cap-table">
      <thead>
        <tr><th scope="col">Capability</th><th v-for="t in tiers" :key="t" scope="col">{{ t }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="c in CAPABILITIES" :key="c">
          <td><code>{{ c }}</code></td>
          <td v-for="t in tiers" :key="t">
            <input
              type="checkbox" :checked="roleCaps(t).has(c)" :disabled="!canEditEnabled || !enabledCaps.has(c)"
              :aria-label="`${c} for ${t}`" :data-testid="`cap-${t}-${c}`"
              @change="ev => onBox(ev, roleCaps(t).has(c), () => toggleRoleCap(t, c))"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  BASE_SETTINGS, CAPABILITIES, agencyRoleTiers, capabilitySet, editableModules, editableRoutes, moduleSummary, pageScope,
  type PolicyOverrides, type ScopeLevel,
} from '~/utils/resolveAccess'
import type { AccessEdit, EditableLayer } from '~/utils/accessEdits'

const props = defineProps<{
  code: string
  overrides: PolicyOverrides
  canEditCeiling: boolean
  canEditEnabled: boolean
}>()
const emit = defineEmits<{ edit: [AccessEdit] }>()

const modules = editableModules()
const tiers = computed(() => agencyRoleTiers(props.code))
const expanded = ref(new Set<string>())

const ceilingCaps = computed(() => capabilitySet(props.overrides, props.code, 'ceiling', null))
const enabledCaps = computed(() => capabilitySet(props.overrides, props.code, 'enabled', null))
function roleCaps(tier: string) {
  return capabilitySet(props.overrides, props.code, 'role', tier)
}

function toggle(m: string) {
  const next = new Set(expanded.value)
  if (next.has(m)) next.delete(m)
  else next.add(m)
  expanded.value = next
}
function label(m: string) {
  return BASE_SETTINGS.modules[m]?.label ?? m
}
function rawRole(tier: string, key: string): ScopeLevel | null {
  const l = props.overrides.agencies[props.code]?.roles?.[tier]
  return (key.startsWith('/') ? l?.routes?.[key] : l?.modules?.[key]) ?? null
}
function roleInherited(tier: string, m: string): string {
  const s = moduleSummary(props.overrides, props.code, 'role', tier, m, { layer: 'role', key: 'module' })
  return s.mixed ? 'mixed' : s.scope
}

function toggled(set: Set<string>, c: string): string[] {
  const next = new Set(set)
  if (next.has(c)) next.delete(c)
  else next.add(c)
  return [...next]
}
/**
 * Put the checkbox back to its current state before emitting: if the page
 * rejects the edit (e.g. the self-lockout guard), the DOM would otherwise
 * show a change that never happened. An accepted edit re-renders `checked`.
 */
function onBox(ev: Event, wasChecked: boolean, apply: () => void) {
  (ev.target as HTMLInputElement).checked = wasChecked
  apply()
}
function toggleAgencyCap(layer: EditableLayer, c: string) {
  emit('edit', { kind: 'capabilities', layer, caps: toggled(layer === 'ceiling' ? ceilingCaps.value : enabledCaps.value, c) })
}
function toggleRoleCap(tier: string, c: string) {
  emit('edit', { kind: 'roleCapabilities', tier, caps: toggled(roleCaps(tier), c) })
}
</script>

<style scoped>
.tab-note { font-size: 12px; color: var(--fg-3); margin: -4px 0 8px; }
.grid-scroll { overflow-x: auto; margin-bottom: 16px; }
.cap-table { margin-bottom: 16px; }
.cap-table code, .page-cell code { font-size: 11.5px; color: var(--fg-2); }
.role-grid th:not(:first-child) { text-transform: none; }
.module-cell { display: flex; align-items: center; gap: 8px; }
.expand-btn {
  background: none; border: none; color: var(--fg-3); cursor: pointer;
  width: 18px; padding: 0; font-size: 12px; font-family: inherit;
}
.expand-btn:hover { color: var(--primary); }
.module-label { color: var(--fg-1); font-weight: 600; white-space: nowrap; }
.page-row td { background: var(--surface-sunken); }
.page-cell { padding-left: 39px; }
input[type="checkbox"] { accent-color: var(--primary); width: 14px; height: 14px; }
</style>
```

- [ ] **Step 4: Render it in the page**

In `app/pages/access-policies.vue`, directly after the `<AccessAgencyTab ... />` element:

```vue
      <AccessRolesTab
        v-else-if="tab === 'roles'"
        :code="selected" :overrides="store.draft"
        :can-edit-ceiling="isSuper" :can-edit-enabled="canEditEnabled"
        @edit="onEdit"
      />
```

- [ ] **Step 5: Run the page tests**

In the mount helper, register `SectionTitle` too (`import SectionTitle from '~/components/SectionTitle.vue'`, add to `components`).

Run: `npx vitest run tests/unit/access-policies-page.test.ts`
Expected: PASS.

- [ ] **Step 6: Checkpoint**

Run: `npx vitest run`
Expected: whole suite PASS.

---

### Task 8: Data categories tab

**Files:**
- Create: `app/components/AccessCategoriesTab.vue`
- Modify: `app/pages/access-policies.vue`
- Modify: `tests/unit/access-policies-page.test.ts`

**Interfaces:**
- Consumes: `categoryState`, `isCategoryLocked`, `BASE_SETTINGS.restrictedCategories` (Task 2); page `onEdit`.
- Produces: `<AccessCategoriesTab code overrides can-edit-ceiling can-edit-enabled @edit>`; test ids `cat-ceiling-<category>`, `cat-enabled-<category>`.

- [ ] **Step 1: Add failing tests**

Register `AccessCategoriesTab` in `global.components` (import it; remove its stub) and append:

```ts
describe('access-policies page - data categories', () => {
  it('locks platform-blocked categories even for super_admin', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Data categories')
    expect(w.find('[data-testid="cat-ceiling-crash_victim"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="cat-ceiling-cargo_commercial"]').attributes('disabled')).toBeUndefined()
  })

  it('an agency admin cannot enable a category its ceiling denies', async () => {
    signIn('KRC', 'admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Data categories')
    expect(w.find('[data-testid="cat-enabled-cargo_commercial"]').attributes('disabled')).toBeDefined()
  })

  it('an agency admin can mask one of its own categories', async () => {
    signIn('KPA', 'admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Data categories')
    await w.find('[data-testid="cat-enabled-cargo_commercial"]').setValue(false)
    expect(useAccessPolicyStore().draft.agencies.KPA.enabled?.categories?.cargo_commercial).toBe('deny')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/access-policies-page.test.ts`
Expected: FAIL - cannot find `~/components/AccessCategoriesTab.vue`.

- [ ] **Step 3: Create `app/components/AccessCategoriesTab.vue`**

```vue
<template>
  <!--
    Restricted data categories (RBAC spec section 6). Unchecked = the
    category's fields are masked on every page for this agency. Platform
    blocks are enforced at ingestion / by feature flag and can't be changed.
  -->
  <table class="data-table">
    <thead>
      <tr>
        <th scope="col">Category</th>
        <th scope="col">Owner</th>
        <th scope="col">Enforcement</th>
        <th scope="col">Allowed</th>
        <th scope="col">Enabled</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="[key, def] in categories" :key="key">
        <td>
          <div class="cat-label">{{ def.label }}</div>
          <code class="cat-key">{{ key }}</code>
        </td>
        <td class="cat-owner">{{ def.owningAgency }}</td>
        <td>
          <span v-if="isCategoryLocked(key)" class="badge warning" :title="`Enforced by ${def.enforcement.replaceAll('_', ' ')} - not changeable here`">Platform block</span>
          <span v-else class="cat-enforcement">{{ def.enforcement.replaceAll('_', ' ') }}</span>
        </td>
        <td>
          <input
            type="checkbox" :checked="state('ceiling', key) === 'allow'"
            :disabled="!canEditCeiling || isCategoryLocked(key)"
            :aria-label="`${def.label} allowed`" :data-testid="`cat-ceiling-${key}`"
            @change="ev => onBox(ev, 'ceiling', key)"
          />
        </td>
        <td>
          <input
            type="checkbox" :checked="state('enabled', key) === 'allow'"
            :disabled="!canEditEnabled || isCategoryLocked(key) || state('ceiling', key) === 'deny'"
            :aria-label="`${def.label} enabled`" :data-testid="`cat-enabled-${key}`"
            @change="ev => onBox(ev, 'enabled', key)"
          />
        </td>
      </tr>
    </tbody>
  </table>
  <p class="cat-note">
    Unchecked means the category's fields are masked for this agency on every page. Admin-only categories
    stay masked for analysts and operators regardless.
  </p>
</template>

<script setup lang="ts">
import { BASE_SETTINGS, categoryState, isCategoryLocked, type PolicyOverrides } from '~/utils/resolveAccess'
import type { AccessEdit, EditableLayer } from '~/utils/accessEdits'

const props = defineProps<{
  code: string
  overrides: PolicyOverrides
  canEditCeiling: boolean
  canEditEnabled: boolean
}>()
const emit = defineEmits<{ edit: [AccessEdit] }>()

const categories = Object.entries(BASE_SETTINGS.restrictedCategories)

function state(layer: EditableLayer, category: string) {
  return categoryState(props.overrides, props.code, layer, category)
}

/** Reset the box to the current state first; an accepted edit re-renders it (see AccessRolesTab). */
function onBox(ev: Event, layer: EditableLayer, category: string) {
  const wasAllowed = state(layer, category) === 'allow'
  ;(ev.target as HTMLInputElement).checked = wasAllowed
  emit('edit', { kind: 'category', layer, category, value: wasAllowed ? 'deny' : 'allow' })
}
</script>

<style scoped>
.cat-label { color: var(--fg-1); font-weight: 500; }
.cat-key { font-size: 11px; color: var(--fg-3); }
.cat-owner, .cat-enforcement { font-size: 12px; color: var(--fg-2); }
.cat-note { font-size: 12px; color: var(--fg-3); margin-top: 8px; }
input[type="checkbox"] { accent-color: var(--primary); width: 14px; height: 14px; }
</style>
```

- [ ] **Step 4: Render it in the page**

In `app/pages/access-policies.vue`, after the `<AccessRolesTab ... />` element:

```vue
      <AccessCategoriesTab
        v-else
        :code="selected" :overrides="store.draft"
        :can-edit-ceiling="isSuper" :can-edit-enabled="canEditEnabled"
        @edit="onEdit"
      />
```

- [ ] **Step 5: Run the page tests**

Run: `npx vitest run tests/unit/access-policies-page.test.ts`
Expected: PASS.

- [ ] **Step 6: Checkpoint**

Run: `npx vitest run`
Expected: whole suite PASS.

---

### Task 9: "Preview as" panel

**Files:**
- Create: `app/components/AccessPreviewPanel.vue`
- Modify: `app/pages/access-policies.vue`
- Modify: `tests/unit/access-policies-page.test.ts`

**Interfaces:**
- Consumes: `resolveFor`, `capabilitiesFor`, `agencyRoleTiers`, `editableModules`, `editableRoutes` (Task 2).
- Produces: `<AccessPreviewPanel code overrides>` - lists pages a chosen role reaches under the **draft**; root has class `preview-panel`, items `.preview-item`.

- [ ] **Step 1: Add failing tests**

Register `AccessPreviewPanel` in `global.components` (import; remove stub) and append:

```ts
describe('access-policies page - preview', () => {
  it('lists what the chosen role would reach under the draft', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    await w.find('.preview-panel select').setValue('operator')
    const routes = () => w.findAll('.preview-item code').map((c: any) => c.text())
    expect(routes()).toContain('/traffic')
    expect(routes()).not.toContain('/analytics') // minTier analyst

    await btn(w, 'enabled-M02', 'none').trigger('click')
    expect(routes()).not.toContain('/traffic')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/access-policies-page.test.ts`
Expected: FAIL - cannot find `~/components/AccessPreviewPanel.vue`.

- [ ] **Step 3: Create `app/components/AccessPreviewPanel.vue`**

```vue
<template>
  <!-- What one role at this agency would reach with the current (unsaved) draft, via the real resolver. -->
  <aside class="preview-panel" aria-label="Preview access as a role">
    <SectionTitle>Preview as</SectionTitle>
    <select v-model="chosenTier" class="select-sm preview-select" aria-label="Role to preview">
      <option v-for="t in tiers" :key="t" :value="t">{{ t }}</option>
    </select>
    <p class="preview-count">{{ pages.length }} {{ pages.length === 1 ? 'page' : 'pages' }} reachable</p>
    <ul class="preview-list">
      <li v-for="p in pages" :key="p.route" class="preview-item">
        <code>{{ p.route }}</code>
        <span class="badge" :class="p.scope === 'full' ? 'success' : 'info'">{{ p.scope }}</span>
      </li>
    </ul>
    <p class="preview-caps"><strong>Capabilities:</strong> {{ caps.length ? caps.join(', ') : 'none' }}</p>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  agencyRoleTiers, capabilitiesFor, editableModules, editableRoutes, resolveFor, type PolicyOverrides,
} from '~/utils/resolveAccess'

const props = defineProps<{ code: string; overrides: PolicyOverrides }>()

const tiers = computed(() => agencyRoleTiers(props.code))
const pickedTier = ref<string | null>(null)
// Falls back to the most-privileged tier when the pick doesn't exist at a newly selected agency.
const chosenTier = computed({
  get: () => (pickedTier.value && tiers.value.includes(pickedTier.value as any) ? pickedTier.value : tiers.value[0] ?? 'admin'),
  set: (t: string) => { pickedTier.value = t },
})

const subject = computed(() => ({ agency_code: props.code, role_type: chosenTier.value }))
const pages = computed(() =>
  editableModules()
    .flatMap(m => editableRoutes(m))
    .map(route => ({ route, res: resolveFor(props.overrides, subject.value, route) }))
    .filter(p => p.res.allowed)
    .map(p => ({ route: p.route, scope: p.res.scopeLevel })),
)
const caps = computed(() => [...capabilitiesFor(props.overrides, subject.value)].sort())
</script>

<style scoped>
.preview-panel {
  position: sticky; top: 12px; max-height: calc(100vh - 140px); overflow-y: auto;
  border: 1px solid var(--border-subtle); border-radius: var(--r-sm); background: var(--surface-2); padding: 12px;
}
.preview-select { width: 100%; }
.preview-count { font-size: 12px; color: var(--fg-3); margin: 8px 0 6px; }
.preview-list { list-style: none; margin: 0 0 10px; padding: 0; }
.preview-item {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 4px 0; border-bottom: 1px solid var(--border-subtle);
}
.preview-item code { font-size: 11.5px; color: var(--fg-2); overflow-wrap: anywhere; }
.preview-caps { font-size: 12px; color: var(--fg-2); margin: 0; }
@media (max-width: 1100px) { .preview-panel { position: static; max-height: none; } }
</style>
```

- [ ] **Step 4: Render it in the page**

In `app/pages/access-policies.vue`, after the closing `</section>` of `.agency-main` (still inside `.access-layout`):

```vue
    <AccessPreviewPanel :code="selected" :overrides="store.draft" />
```

- [ ] **Step 5: Run the page tests**

Run: `npx vitest run tests/unit/access-policies-page.test.ts`
Expected: PASS.

- [ ] **Step 6: Checkpoint**

Run: `npx vitest run`
Expected: whole suite PASS.

---

### Task 10: Verify end to end and document

**Files:**
- Modify: `Reference.md` (§9.6, after the paragraph ending "…both category-masking directions).")

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: every test PASSES, including `access-parity` with its snapshot unchanged since Task 1.

- [ ] **Step 2: Type-check the new code**

Run: `npx nuxi typecheck 2>&1 | grep -E "resolveAccess|accessEdits|accessPolicy|access-policies|AccessScopeToggle|AccessAgencyTab|AccessRolesTab|AccessCategoriesTab|AccessPreviewPanel|useAccessControl"`
Expected: no output (pre-existing errors elsewhere in the repo are out of scope). Fix any listed error.

- [ ] **Step 3: Run the app and check it by hand**

Run: `npm run dev`, then in the browser (ask the user for a super_admin and an agency-admin login if none are known):
1. As super_admin, open Access Control → Module Access. Confirm the "saved in this browser only" banner, the agency rail, three tabs, and the preview panel.
2. Set KENHA → Traffic (M02) Allowed to None, Save. Sign in as a KENHA user: the Road Traffic sidebar group is gone and `/traffic` redirects to `/dashboard`.
3. As super_admin set KENHA M10 Allowed to None: a confirmation appears. Cancel it.
4. As a KENHA admin: only KENHA shown, Allowed column read-only; unticking `manage_users` for admin shows the "your own ability" error and the box stays ticked.
5. Make an edit, then click another sidebar link: the "Leave without saving?" dialog appears; Cancel keeps you on the page.
6. Resize to ~390px wide: layout collapses to one column with no horizontal page scroll (tables scroll inside `.grid-scroll`).

- [ ] **Step 4: Document it in `Reference.md` §9.6**

Append after the paragraph ending "…and both category-masking directions).":

```markdown
**Module Access (`/access-policies`, 2026-09-28).** Three override layers sit on
top of this file without changing it - *ceiling* (super_admin: what an agency
may have), *enabled* (the agency's own admin: what it switches on within
that), and *role* (per role tier inside the agency) - each only able to narrow
the one above. The pure logic is `app/utils/resolveAccess.ts` (`resolveFor`),
which `useAccessControl()` now wraps; saved overrides live in the
`accessPolicy` Pinia store and, for now, this browser's
`localStorage['uapts:access-policy:v1']` via `app/utils/accessPolicyStorage.ts`
(swap that adapter for the accounts API later). With nothing saved, resolution
is identical to before - pinned by `tests/unit/access-parity.test.ts`'s
snapshot. Spec: `docs/superpowers/specs/2026-09-28-module-access-control-design.md`.
```

- [ ] **Step 5: Final checkpoint**

Run: `npx vitest run`
Expected: whole suite PASS. Report results (and any manual-check failures) to the user.
