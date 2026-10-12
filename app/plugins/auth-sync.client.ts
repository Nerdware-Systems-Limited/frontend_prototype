/**
 * Turns on cross-tab session sharing (see utils/tabSync.ts). Runs on the client
 * before any route middleware, so a new tab can ask its sibling tabs for the
 * session before the auth guard decides to send it to /login.
 */
import { useAuthStore } from '~/stores/auth'
import { isPublicRoute } from '~/utils/publicRoutes'

export default defineNuxtPlugin((nuxtApp) => {
  // Captured now: the callback below fires later from a BroadcastChannel event,
  // outside any Nuxt context, where useRoute()/navigateTo() cannot find the app.
  const router = useRouter()

  useAuthStore().initTabSync({
    // Another tab signed out (or its session died): follow it to the login page.
    onRemoteLogout: () => {
      const route = router.currentRoute.value
      if (isPublicRoute(route.path)) return
      return nuxtApp.runWithContext(() => navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`))
    },
  })
})
