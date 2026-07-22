/**
 * usePermissions - role-tier gating for the frontend.
 *
 * The backend only exposes a coarse `role_type` on the user record
 * ('admin' | 'analyst' | 'operator' | 'public' - see roles.vue's ROLE_DEFS
 * for the canonical descriptions), not per-action permission strings. This
 * composable is the single place that turns that tier into yes/no answers
 * so pages don't hand-roll their own role checks.
 */

const ROLE_RANK: Record<string, number> = {
  public: 0,
  operator: 1,
  analyst: 2,
  admin: 3,
}

export function usePermissions() {
  const { user } = useAuth()

  /** True if the current user's role_type is exactly one of `roles`. */
  function hasRole(...roles: string[]) {
    const rt = user.value?.role_type
    return !!rt && roles.includes(rt)
  }

  /** True if the current user's role tier is at least `min` (public < operator < analyst < admin). */
  function hasMinRole(min: string) {
    const rt = user.value?.role_type ?? 'public'
    return (ROLE_RANK[rt] ?? 0) >= (ROLE_RANK[min] ?? 0)
  }

  const isAdmin = computed(() => hasRole('admin'))
  /** Exporting raw records is gated to analyst+ by default across the app. */
  const canExport = computed(() => hasMinRole('analyst'))

  return { hasRole, hasMinRole, isAdmin, canExport }
}
