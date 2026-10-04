/**
 * /admin/dashboards/** (Dashboard Manager) is only for viewers with
 * dashboards.manage or dashboards.manage_agency (see useViewerContext).
 *
 * Runs after auth.global.ts (global middleware run in file-name order), so
 * the user is signed in and has already passed the route's own tier/agency
 * check there. This is the clean experience only; the API enforces the same
 * rule on every request.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (to.path !== '/admin/dashboards' && !to.path.startsWith('/admin/dashboards/')) return
  const { canManageDashboards, canManageAgencyDashboards } = useViewerContext()
  if (canManageDashboards.value || canManageAgencyDashboards.value) return
  return navigateTo('/dashboard')
})
