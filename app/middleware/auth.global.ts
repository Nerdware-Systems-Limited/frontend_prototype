/**
 * Global route middleware - auth guard, then agency-scope guard.
 *
 * Every navigation goes through here (defineNuxtRouteMiddleware is global
 * because the file is placed in middleware/ and named with no `.client`/`.server` suffix).
 *
 * Logic (mirrors what GitHub / Notion / Linear do):
 *   1. Public routes (login) - always let through
 *   2. Has access token in memory → let through
 *   3. No access token but has a stored refresh token → attempt a silent
 *      refresh (this covers the "come back the next day" case).
 *      - Refresh succeeds → let through
 *      - Refresh fails    → redirect to /login
 *   4. Nothing at all → redirect to /login
 *
 * Once authenticated, step 5 resolves the agency-scope axis
 * (useAccessControl.ts, RBAC spec section 7/8.1) and redirects to the
 * safe space on denial - closing gap #3 (no client-side route gating on
 * /roles, /users, /audit, /integrations) and gap #8 (the post-login
 * `?redirect=` target was never re-validated against scope). This is the
 * "clean experience" layer only; the real gate is the server (spec 2.1).
 */

import { useAuthStore } from '~/stores/auth'
import { useAccessPolicyStore } from '~/stores/accessPolicy'

const PUBLIC_ROUTES = ['/login', '/forgot-password']

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_ROUTES.includes(to.path) || to.path.startsWith('/reset-password/')) return

  const auth = useAuthStore()

  // Hydrate from storage on the first navigation (SSR-off / SPA boot)
  if (!auth.refreshToken) {
    auth.hydrate()
  }

  // Already have a live access token
  if (auth.isAuthenticated) return resolveScopeWithPolicy(to.path)

  // Try a silent refresh using the stored refresh token
  if (auth.refreshToken) {
    const newToken = await auth.refreshAccessToken()
    if (newToken) return resolveScopeWithPolicy(to.path)
  }

  // Nothing worked - go to login, preserving the intended destination
  return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
})

/**
 * The saved Module Access policy comes from the server and needs the access
 * token, so it can only be fetched here, after authentication. ensureLoaded()
 * is a no-op after the first navigation of a session (and never throws).
 */
async function resolveScopeWithPolicy(path: string) {
  await useAccessPolicyStore().ensureLoaded()
  return resolveScope(path)
}

function resolveScope(path: string) {
  const access = useAccessControl()
  const resolution = access.resolveRoute(path)
  if (resolution.allowed) return

  const safeSpace = access.safeSpace.value.route
  if (path === safeSpace) return // already there - nothing to redirect to
  return navigateTo(safeSpace)
}