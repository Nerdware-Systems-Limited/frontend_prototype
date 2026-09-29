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
/** A value that didn't come from the type system (bad JSON in storage) is treated as 'none' - fail closed, never fail open. */
function normalizeScope(scope: ScopeLevel): ScopeLevel { return scope in SCOPE_RANK ? scope : 'none' }
export function scopeRank(scope: ScopeLevel): number { return SCOPE_RANK[normalizeScope(scope)] }
export function minScope(a: ScopeLevel, b: ScopeLevel): ScopeLevel {
  const na = normalizeScope(a); const nb = normalizeScope(b)
  return SCOPE_RANK[na] <= SCOPE_RANK[nb] ? na : nb
}
export function maxScope(a: ScopeLevel, b: ScopeLevel): ScopeLevel {
  const na = normalizeScope(a); const nb = normalizeScope(b)
  return SCOPE_RANK[na] >= SCOPE_RANK[nb] ? na : nb
}

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
