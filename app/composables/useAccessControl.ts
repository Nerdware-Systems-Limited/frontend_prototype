/**
 * useAccessControl - the agency-scope resolver (RBAC spec section 7).
 *
 * Second axis alongside usePermissions()'s role-tier gate: usePermissions()
 * answers "what may this person do", this answers "whose data and which
 * modules may they see". A route is reachable only when both axes permit
 * it (spec section 2.2 - "Two axes, resolved independently"). This is a
 * client-side convenience only, per spec section 2.1 - "The server is the
 * gate. Client-side checks exist to give a clean experience, never to
 * provide the protection." Every real enforcement point (API auth,
 * row-level filter, ingestion validation) is server-side and out of this
 * file's scope.
 *
 * Reads app/config/access-control.json, the interim settings file the
 * spec calls for in section 7 ("use a settings file before the API is
 * built"). Every enforcement point should go through this composable
 * rather than reading the settings file directly, so that migrating to
 * the accounts API later (spec section 7.3) changes this one file.
 */

import settingsData from '~/config/access-control.json'
import type { User } from '~/types/uapts'

export type AccessTier = 'super_admin' | 'oversight' | 'admin' | 'analyst' | 'operator' | 'public'
export type ScopeLevel = 'full' | 'read' | 'none'

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

interface AccessSettings {
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
    /** Lowers minTier to `minTier` for viewers whose own agency sits in `domain` - see resolveRoute step 7. */
    minTierDomainOverride?: { domain: string; minTier: AccessTier }
  }>
  agencies: Record<string, {
    name: string
    domains: string[]
    landing: string
    grants: { full: string[]; read: string[]; routes: Record<string, ScopeLevel> }
    denies: { modules: string[]; routes: string[]; categories: string[] }
  }>
  publicView: { route: string; denyCategories: string[] }
  restrictedCategories: Record<string, { label: string; owningAgency: string; enforcement: string; minTier?: AccessTier }>
}

const settings = settingsData as unknown as AccessSettings

/** route -> module, built once from the modules block. */
const ROUTE_MODULE: Record<string, string> = {}
for (const [moduleId, mod] of Object.entries(settings.modules)) {
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

function matchRouteKey(path: string): string | undefined {
  if (path in ROUTE_MODULE) return path
  for (const { key, prefix } of DYNAMIC_ROUTE_KEYS) {
    if (path.startsWith(prefix)) return key
  }
  return undefined
}

const TIER_RANK: Record<string, number> = Object.fromEntries(
  Object.entries(settings.roles).map(([key, role]) => [key, role.tier]),
)

function tierRank(tier: string | undefined | null): number {
  return TIER_RANK[tier ?? 'public'] ?? TIER_RANK.public ?? 10
}

function denyResult(reason: string): RouteResolution {
  return { allowed: false, scopeLevel: 'none', reason, deniedCategories: [], isSafeSpace: true }
}

export function useAccessControl() {
  const { user } = useAuth()

  const agencyCode = computed(() => (user.value as User | null)?.agency_code?.toUpperCase() || null)
  const roleTier = computed<AccessTier>(() => ((user.value as User | null)?.role_type as AccessTier) ?? 'public')
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

  /**
   * A domain like Ministry Oversight grants every module it lists at read
   * scope only ("readOnly": true in the settings file - spec section 3:
   * "a read scope rather than a module bundle... grants cross-agency
   * visibility without any write right anywhere"). An ordinary domain
   * (roads, rail, ...) grants full scope. When an agency sits in more than
   * one domain for the same module, full wins over read.
   */
  function domainScopeFor(moduleId: string): ScopeLevel {
    let scope: ScopeLevel = 'none'
    for (const domainKey of agency.value?.domains ?? []) {
      const domain = settings.domains[domainKey]
      if (!domain?.modules.includes(moduleId)) continue
      if (domain.readOnly) {
        if (scope === 'none') scope = 'read'
      } else {
        scope = 'full'
      }
    }
    return scope
  }

  const safeSpace = computed(() => settings.defaults.safeSpace)
  const landingRoute = computed(() => agency.value?.landing ?? safeSpace.value.route)

  /**
   * The eight-step resolution algorithm from spec section 7.2. Deny by
   * default; the domain bundle then the agency's own grants are additive;
   * the agency's denials always win over both; the route's minimum tier
   * and restricted categories apply last; anything that doesn't reach an
   * explicit permit falls through to the safe space (never an error page,
   * never a silent allow).
   */
  function resolveRoute(path: string): RouteResolution {
    // Step 2 (partial): not authenticated at all.
    if (!user.value) return denyResult('not authenticated')

    // Baseline routes are open to any authenticated account, agency or not -
    // this is what makes the safe space itself ("/dashboard" in restricted
    // mode) reachable rather than circular.
    const baselineScope = settings.defaults.baselineRoutes[path]
    if (baselineScope) {
      return { allowed: true, scopeLevel: baselineScope, reason: 'baseline route', deniedCategories: [], isSafeSpace: false }
    }

    // Public tier: the single fixed view, nothing else (spec section 2.6).
    if (roleTier.value === 'public') {
      return denyResult('public tier - single fixed view only')
    }

    // Step 3: the only bypass in the model.
    if (isSuperAdmin.value) {
      return { allowed: true, scopeLevel: 'full', reason: 'super_admin bypass', deniedCategories: [], isSafeSpace: false }
    }

    if (!agency.value) return denyResult('no agency resolved for this account')

    const routeKey = matchRouteKey(path)
    if (!routeKey) return denyResult('route not recognised')

    const routeMeta = settings.routes[routeKey]
    const moduleId = ROUTE_MODULE[routeKey] ?? routeMeta?.module
    if (!moduleId) return denyResult('route has no module mapping')

    // Step 4: domain bundle union.
    let scope: ScopeLevel = domainScopeFor(moduleId)

    // Step 5: agency's own grants, additive - module level, then route-level override.
    if (agency.value.grants.full.includes(moduleId)) scope = 'full'
    else if (agency.value.grants.read.includes(moduleId) && scope === 'none') scope = 'read'
    const routeOverride = agency.value.grants.routes[routeKey]
    if (routeOverride) scope = routeOverride

    // Step 6: agency's denials, subtractive - always win over steps 4 and 5.
    if (agency.value.denies.modules.includes(moduleId) || agency.value.denies.routes.includes(routeKey)) {
      scope = 'none'
    }
    // Restricted categories (section 6) mask fields, they never block the whole
    // route (route-level permissions decide which page opens, not which fields on
    // it are visible). Two independent reasons a category ends up masked here:
    // a tier gate that applies even within the owning agency's own tenant
    // (restrictedCategories[category].minTier - e.g. KPA's own analyst still
    // can't see cargo_commercial, only KPA's own Agency Admin can), and a
    // cross-tenant block this agency has been denied outright (agency.denies.categories
    // - e.g. KRC reading KPA's cargo routes never sees cargo_commercial at all).
    const deniedCategories = (routeMeta?.categories ?? []).filter((category) => {
      const categoryDef = settings.restrictedCategories[category]
      const belowCategoryTier = !!categoryDef?.minTier && tierRank(roleTier.value) < tierRank(categoryDef.minTier)
      const deniedToTenant = agency.value!.denies.categories.includes(category)
      return belowCategoryTier || deniedToTenant
    })

    if (scope === 'none') return denyResult(`no grant for ${moduleId} at ${routeKey}`)

    // Step 7: route minimum tier. A route's own minTier can be lowered for
    // viewers whose agency sits in a given domain (minTierDomainOverride) -
    // e.g. /agencies is oversight-gated in general, but no seeded account
    // anywhere carries the literal role_type 'oversight' (even sdt.oversight@
    // is seeded 'admin'), so SDT/SDR's real admin-tier staff need this to
    // reach it at all. Scoped per-route rather than loosening minTier
    // globally, so unrelated oversight-gated routes (e.g. /query-builder's
    // raw-SQL gap #2) are untouched.
    let minTier = routeMeta?.minTier ?? 'operator'
    const override = routeMeta?.minTierDomainOverride
    if (override && agency.value.domains.includes(override.domain)) {
      minTier = override.minTier
    }
    if (tierRank(roleTier.value) < tierRank(minTier)) {
      return denyResult(`role tier below ${minTier} for ${routeKey}`)
    }

    // Step 8 (the permit path): everything above resolved to an explicit yes.
    return {
      allowed: true,
      scopeLevel: scope,
      reason: `${agencyCode.value} ${scope} grant on ${moduleId}`,
      module: moduleId,
      deniedCategories,
      isSafeSpace: false,
    }
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
  }
}
