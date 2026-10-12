/**
 * useAgencyScope - account-management scoping (not route access; that's
 * useAccessControl.ts). An agency admin manages only their own agency's
 * users; super_admin is the only tier that sees/manages every tenant.
 *
 * access-control.json already documents this intent for M10 (KMA's own
 * note: "the resolver's agency scope on M10 already confines it") -
 * these are plain functions, not a Vue composable with reactive state,
 * so /users.vue can call them directly against its already-loaded data
 * without a second round of reactivity to reason about.
 */

import { BASE_SETTINGS } from '~/utils/resolveAccess'

export interface AgencyScopeUser {
  role_type: string
  agency: string | null
  agency_code: string | null
}

export function isUnscopedAdmin(user: AgencyScopeUser | null): boolean {
  return user?.role_type === 'super_admin'
}

/** The viewer's own agency_code, or null when unscoped (super_admin / no viewer). */
export function scopedAgencyCode(user: AgencyScopeUser | null): string | null {
  if (!user || isUnscopedAdmin(user)) return null
  return user.agency_code
}

/** Query params to merge into a users-list call so the backend itself only returns the viewer's own tenant. */
export function agencyListQueryFor(user: AgencyScopeUser | null): { agency?: string } {
  if (!user || isUnscopedAdmin(user) || !user.agency) return {}
  return { agency: user.agency }
}

/** Narrows an agency list (for a filter dropdown or the create-user form) to what the viewer may pick. */
export function visibleAgencyOptions<T extends { agency_code: string }>(
  agencies: T[], user: AgencyScopeUser | null,
): T[] {
  if (!user || isUnscopedAdmin(user)) return agencies
  return agencies.filter(a => a.agency_code === user.agency_code)
}

/** Whether the viewer may create/edit/deactivate/delete a user belonging to `target`'s agency. */
export function canManageUser(viewer: AgencyScopeUser | null, target: { agency_code?: string | null }): boolean {
  if (!viewer) return false
  if (isUnscopedAdmin(viewer)) return true
  return !!target.agency_code && target.agency_code === viewer.agency_code
}

/**
 * Whether the viewer may move an account from role `from` to role `to` (`from`
 * is null when creating one). super_admin is the platform-wide bypass, so any
 * change with super_admin on either side - granting it to someone else, to
 * themselves, or demoting an existing super_admin - is super_admin-only.
 * Leaving the role as it is always passes.
 */
export function canChangeRole(viewer: AgencyScopeUser | null, from: string | null, to: string): boolean {
  if (!viewer) return false
  if (from === to) return true
  if (isUnscopedAdmin(viewer)) return true
  return from !== 'super_admin' && to !== 'super_admin'
}

/** Whether the viewer may see `role` listed at all (catalog, filters) - super_admin is invisible to everyone else. */
export function canViewRole(viewer: AgencyScopeUser | null, role: string): boolean {
  return role !== 'super_admin' || isUnscopedAdmin(viewer)
}

/**
 * Built-in roles whose reach is platform-wide (mirrors core.permissions.is_ministry_tier on the
 * backend). Only a super_admin may hand these out: the API only blocks agency admins from granting
 * super_admin, so the UI must not offer them to anyone else.
 */
const GLOBAL_TIER_ROLES = new Set(['super_admin', 'ministry_admin', 'ministry_analyst'])

/** Display order for built-in roles, most privileged first (matches User.ROLE_CHOICES). Unlisted names follow, A-Z. */
const BUILTIN_ORDER = ['super_admin', 'ministry_admin', 'ministry_analyst', 'admin', 'analyst', 'operator', 'auditor', 'public']

export interface CatalogRole {
  role_name: string
  agency: string | null
  base_tier: string | null
}

/**
 * Which built-in roles a custom role may be based on. The backend only accepts a tier the resolver
 * governs and rules out super_admin (it already bypasses every check) and public (the resolver
 * denies it outright), so this is the catalog's built-ins that the policy has a tier for, minus
 * those two - most privileged first. Nothing here names a role: it follows the catalog.
 */
export function customRoleBaseTiers(catalog: CatalogRole[]): string[] {
  const rank = (n: string) => BASE_SETTINGS.roles[n]?.tier ?? 0
  return catalog
    .filter(r => !r.agency && !r.base_tier)
    .map(r => r.role_name)
    .filter(name => name !== 'super_admin' && name !== 'public' && name in BASE_SETTINGS.roles)
    .sort((x, y) => rank(y) - rank(x))
}

/**
 * The built-in roles a viewer may assign, taken from the backend's role catalog (the rows with no
 * owning agency and no base tier) rather than a list kept in code - so a role added on the server
 * shows up here without a frontend change. `current` stays in the list so a locked row still shows
 * its own value.
 */
export function assignableBuiltInRoles(
  viewer: AgencyScopeUser | null, catalog: CatalogRole[], current: string | null = null,
): string[] {
  const rank = (n: string) => { const i = BUILTIN_ORDER.indexOf(n); return i === -1 ? BUILTIN_ORDER.length : i }
  return catalog
    .filter(r => !r.agency && !r.base_tier)
    .map(r => r.role_name)
    .filter(name => name === current
      || (canChangeRole(viewer, current, name) && (!GLOBAL_TIER_ROLES.has(name) || isUnscopedAdmin(viewer))))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

