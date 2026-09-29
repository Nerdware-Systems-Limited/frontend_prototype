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
import { getActivePinia } from 'pinia'
import { useAccessPolicyStore } from '~/stores/accessPolicy'

// The resolver's types (AccessTier, RouteResolution, ScopeLevel) live in
// ~/utils/resolveAccess and are auto-imported from there; re-exporting them
// here made Nuxt report "Duplicated imports" for each one.

const settings = BASE_SETTINGS

export function useAccessControl() {
  const { user } = useAuth()

  // Saved Module Access overrides (never the page's unsaved draft). The store
  // is only missing outside a Pinia app - plain unit tests - where the JSON
  // alone applies, exactly as before any override is saved.
  const policy = getActivePinia() ? useAccessPolicyStore() : null
  const overrides = computed<PolicyOverrides>(() => policy?.overrides ?? EMPTY_OVERRIDES)
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
