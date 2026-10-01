/**
 * useAuth - composable for components.
 *
 * Thin wrapper that re-exports everything from the auth store so
 * components don't need to import Pinia directly. This is the same
 * pattern used by Vercel and Supabase's own Vue helpers.
 */

import { useAuthStore } from '~/stores/auth'

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()

  function redirectAfterLogin() {
    // Read the route when it's needed, not at setup: useAuth is also reached from
    // route middleware (via useAccessControl), where useRoute() is unreliable (NUXT_E2005).
    const redirect = (router.currentRoute.value.query.redirect as string) || '/dashboard'
    return navigateTo(redirect)
  }

  /**
   * Login and redirect to the intended page (or dashboard) - unless the
   * account has MFA enabled, in which case no tokens are issued yet and the
   * result tells the caller (login.vue) to show the code-entry step instead.
   */
  async function login(email: string, password: string, remember = false) {
    const result = await store.login(email, password, remember)
    if (result.mfaRequired) return result
    await redirectAfterLogin()
    return result
  }

  /** Confirms the login-challenge code and completes the redirect. */
  async function mfaVerify(otpId: string, code: string) {
    await store.mfaVerify(otpId, code)
    await redirectAfterLogin()
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
    showMfaNudge:    computed(() => store.showMfaNudge),
    // actions
    login,
    logout,
    dismissMfaNudge: store.dismissMfaNudge,
    fetchMe: store.fetchMe,
    mfaVerify,
    mfaResend: store.mfaResend,
    mfaEnroll: store.mfaEnroll,
    mfaEnrollVerify: store.mfaEnrollVerify,
    mfaDisable: store.mfaDisable,
    requestPasswordReset: store.requestPasswordReset,
    confirmPasswordReset: store.confirmPasswordReset,
    changePassword: store.changePassword,
  }
}