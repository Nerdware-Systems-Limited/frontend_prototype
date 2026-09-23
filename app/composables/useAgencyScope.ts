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
