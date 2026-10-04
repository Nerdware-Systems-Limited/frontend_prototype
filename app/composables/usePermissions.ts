/**
 * usePermissions - role-tier and capability gating for the frontend.
 *
 * The backend only exposes a coarse `role_type` on the user record
 * ('super_admin' | 'admin' | 'analyst' | 'operator' | 'public' - see
 * roles.vue's ROLE_DEFS for the canonical descriptions), not per-action
 * permission strings. This composable is the single place that turns that
 * tier into yes/no answers so pages don't hand-roll their own role checks.
 *
 * Module Access adds a second, narrowing input: capabilities (export,
 * query_builder, manage_users, ...) that an agency and its role tiers can
 * switch off (useAccessControl().hasCapability). A gated action needs BOTH
 * the tier and the capability. With no Module Access overrides saved the
 * baseline capabilities match the tiers used here (analyst and above export,
 * admin manages users and uses the query builder), so nothing changes until
 * someone changes a policy.
 *
 * Like every client-side check this is the clean experience, not the gate:
 * the server decides (spec section 2.1).
 */

const ROLE_RANK: Record<string, number> = {
  public: 0,
  operator: 1,
  analyst: 2,
  admin: 3,
  super_admin: 4,
}

export function usePermissions() {
  const { user } = useAuth()
  const { hasCapability } = useAccessControl()

  /** True if the current user's role_type is exactly one of `roles`. */
  function hasRole(...roles: string[]) {
    const rt = user.value?.role_type
    return !!rt && roles.includes(rt)
  }

  /** True if the current user's role tier is at least `min` (public < operator < analyst < admin < super_admin). */
  function hasMinRole(min: string) {
    const rt = user.value?.role_type ?? 'public'
    return (ROLE_RANK[rt] ?? 0) >= (ROLE_RANK[min] ?? 0)
  }

  const isAdmin = computed(() => hasRole('admin', 'super_admin'))
  /** Exporting raw records: analyst+ by default across the app, and only while the `export` capability is on. */
  const canExport = computed(() => hasMinRole('analyst') && hasCapability('export'))
  /** Running queries in the query builder: the `query_builder` capability (the route's own tier gate still applies). */
  const canUseQueryBuilder = computed(() => hasCapability('query_builder'))
  /** Creating, editing, (de)activating and deleting accounts: the `manage_users` capability (the routes' tier gate still applies). */
  const canManageUsers = computed(() => hasCapability('manage_users'))

  return { hasRole, hasMinRole, hasCapability, isAdmin, canExport, canUseQueryBuilder, canManageUsers }
}
