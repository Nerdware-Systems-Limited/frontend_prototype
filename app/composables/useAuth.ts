/**
 * useAuth — composable for components.
 *
 * Thin wrapper that re-exports everything from the auth store so
 * components don't need to import Pinia directly. This is the same
 * pattern used by Vercel and Supabase's own Vue helpers.
 */

import { useAuthStore } from '~/stores/auth'

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()
  const route  = useRoute()

  /**
   * Login and redirect to the intended page (or dashboard).
   * Wraps store.login so the composable owns the post-login navigation.
   */
  async function login(email: string, password: string, remember = false) {
    await store.login(email, password, remember)
    const redirect = (route.query.redirect as string) || '/dashboard'
    await navigateTo(redirect)
  }

  async function logout() {
    await store.logout()
    await navigateTo('/login')
  }

  return {
    // state
    user:            computed(() => store.user),
    isAuthenticated: computed(() => store.isAuthenticated),
    isLoading:       computed(() => store.isLoading),
    userInitials:    computed(() => store.userInitials),
    // actions
    login,
    logout,
    fetchMe: store.fetchMe,
  }
}