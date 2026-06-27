/**
 * Global route middleware - auth guard.
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
 */

import { useAuthStore } from '~/stores/auth'

const PUBLIC_ROUTES = ['/login']

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_ROUTES.includes(to.path)) return

  const auth = useAuthStore()

  // Hydrate from storage on the first navigation (SSR-off / SPA boot)
  if (!auth.refreshToken) {
    auth.hydrate()
  }

  // Already have a live access token
  if (auth.isAuthenticated) return

  // Try a silent refresh using the stored refresh token
  if (auth.refreshToken) {
    const newToken = await auth.refreshAccessToken()
    if (newToken) return
  }

  // Nothing worked - go to login, preserving the intended destination
  return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
})