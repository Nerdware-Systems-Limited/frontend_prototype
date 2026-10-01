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
 * Every built-in role_type, most-privileged first - derived from
 * access-control.json's roles catalog (the platform's actual RBAC config),
 * not a separately maintained list, so adding/renaming a tier there doesn't
 * need a matching code change here. 'oversight' is a capability bucket that
 * JSON also tracks, not a real User.role_type value - excluded.
 */
export const ROLE_TYPES: string[] = Object.keys(BASE_SETTINGS.roles)
  .filter(r => r !== 'oversight')
  .sort((a, b) => (BASE_SETTINGS.roles[b]?.tier ?? 0) - (BASE_SETTINGS.roles[a]?.tier ?? 0))

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
 * Role types to offer in a role dropdown for an account currently on
 * `current` (null when creating). The account's current role stays in the
 * list so a locked row still renders its own value instead of a blank select.
 */
export function assignableRoleTypes(viewer: AgencyScopeUser | null, current: string | null = null): string[] {
  return ROLE_TYPES.filter(role => role === current || canChangeRole(viewer, current, role))
}
