// app/stores/auth.ts
// ─────────────────────────────────────────────────────────────────────
// Auth Store - Pinia
//
// Holds ALL authentication state for the app.
// Pattern: same as Stripe / Notion / Linear - a single store owns tokens,
// user profile, and all auth mutations. Nothing else touches localStorage directly.
//
// Token storage strategy (matching what banks and gov platforms do):
//   - accessToken  → memory only (reactive ref). Never touches localStorage.
//                    Cleared on tab close. Limits XSS blast radius.
//   - refreshToken → localStorage (survives tab/window close for "Remember me")
//                    OR sessionStorage (session-scoped for non-"remember me")
//
// SSR safety: every localStorage/sessionStorage access is guarded by
// process.client so the store is safe to import on the server.
// ─────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { apiBaseUrl } from '~/utils/apiBase'
import type {
  AuthUser,
  DetailResponse,
  LoginResponse,
  LoginResult,
  MfaIssuedResponse,
  MfaVerifyResponse,
  TokenRefreshResponse,
  User,
} from '~/types/uapts'

// ── Safe browser-storage helpers (no-ops on SSR) ────────────────────────────
function getItem(key: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

function setItem(key: string, value: string, prefer: 'local' | 'session') {
  if (typeof window === 'undefined') return
  const [storage, other] = prefer === 'local' ? [localStorage, sessionStorage] : [sessionStorage, localStorage]
  storage.setItem(key, value)
  // getItem() prefers localStorage over sessionStorage - a stale copy left in
  // the other storage (e.g. from an earlier "remember me" login) would keep
  // winning over this fresh one after every hard reload, silently
  // re-authenticating as whoever that old token belonged to while the just-
  // stored user profile (this call) displays correctly. Only one can be live.
  other.removeItem(key)
}

function removeItem(key: string) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(key)
  sessionStorage.removeItem(key)
}

function preferLocal(): 'local' | 'session' {
  if (typeof window === 'undefined') return 'local'
  return localStorage.getItem('uapts_refresh') ? 'local' : 'session'
}

/**
 * Normalise a user record returned by the backend into the shape the UI
 * expects. The backend's `UserSerializer` doesn't currently emit `full_name`
 * - we synthesise it from the email local-part until the backend grows the
 * proper name fields, so the existing dashboard / avatar code keeps working.
 */
function normaliseUser(raw: Partial<User> & { email?: string }): AuthUser {
  const email = raw.email ?? ''
  const local = email.split('@')[0] ?? ''
  return {
    id: raw.id ?? '',
    email,
    role_type: (raw.role_type ?? 'public') as AuthUser['role_type'],
    role: raw.role ?? null,
    role_name: raw.role_name ?? null,
    agency: raw.agency ?? null,
    agency_code: raw.agency_code ?? null,
    department: raw.department ?? null,
    mfa_active: raw.mfa_active ?? false,
    mfa_channel: raw.mfa_channel ?? '',
    phone_number: raw.phone_number ?? '',
    is_active: raw.is_active ?? true,
    is_staff: raw.is_staff ?? false,
    created_at: raw.created_at,
    full_name: local ? local.charAt(0).toUpperCase() + local.slice(1) : email,
  }
}

// ── Store ────────────────────────────────────────────────────────────────────
export const useAuthStore = defineStore('auth', () => {
  const BASE_URL = apiBaseUrl()

  // ── State ──────────────────────────────────────────────────────────────────
  const accessToken  = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const user         = ref<AuthUser | null>(null)
  const isLoading    = ref(false)

  // Set true by a successful login (not by hydrate() restoring an existing
  // session on page reload) when the account has no MFA enrolled - prompts
  // the "Secure Your Account" nudge once per fresh sign-in. Memory-only by
  // design: a reload naturally clears it rather than re-showing on every
  // page view, and dismissing it just for this session is exactly "skip".
  const showMfaNudge = ref(false)
  function dismissMfaNudge() { showMfaNudge.value = false }

  // "Remember me" as chosen on the login form - captured when a login comes
  // back as an MFA challenge (no tokens yet) so mfaVerify() can honour the
  // same persistence choice once the code is confirmed and tokens actually
  // arrive.
  let pendingRemember = false

  // ── Getters ────────────────────────────────────────────────────────────────
  const isAuthenticated = computed(() => !!accessToken.value)
  const userInitials    = computed(() => {
    if (!user.value) return '??'
    const name = user.value.full_name || user.value.email
    return name.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase()
  })

  // ── Hydrate from storage on app boot (client-only) ─────────────────────────
  function hydrate() {
    if (typeof window === 'undefined') return
    const stored     = getItem('uapts_refresh')
    const storedUser = getItem('uapts_user')
    if (stored)     refreshToken.value = stored
    if (storedUser) {
      try { user.value = JSON.parse(storedUser) as AuthUser } catch { /* ignore */ }
    }
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  /**
   * `identifier` is either an email or the user's self-service username
   * (see profile.vue) - the backend's LoginSerializer accepts either, but
   * expects them under different body keys, so decide here rather than
   * pushing that heuristic onto every caller.
   *
   * Returns `{ mfaRequired: false }` once tokens are stored, or
   * `{ mfaRequired: true, otpId, channel }` when the account has MFA
   * enabled - the caller (useAuth/login.vue) is responsible for prompting
   * for the code and calling `mfaVerify()`.
   */
  async function login(
    identifier: string, password: string, remember = false,
  ): Promise<{ mfaRequired: false } | { mfaRequired: true; otpId: string; channel: 'email' | 'sms' }> {
    isLoading.value = true
    try {
      const body = identifier.includes('@')
        ? { email: identifier, password }
        : { username: identifier, password }
      const res = await $fetch<LoginResult>('/api/v1/auth/login/', {
        baseURL: BASE_URL,
        method: 'POST',
        body,
      })
      if ('mfa_required' in res) {
        pendingRemember = remember
        return { mfaRequired: true, otpId: res.otp_id, channel: res.channel }
      }
      const loggedInUser = normaliseUser(res.user)
      _storeTokens(res.access, res.refresh ?? '', loggedInUser, remember)
      showMfaNudge.value = !loggedInUser.mfa_active
      return { mfaRequired: false }
    } finally {
      isLoading.value = false
    }
  }

  // ── MFA: login challenge ─────────────────────────────────────────────────
  /** Confirms the code sent at login and stores the tokens it returns. */
  async function mfaVerify(otpId: string, code: string): Promise<void> {
    isLoading.value = true
    try {
      const res = await $fetch<LoginResponse>('/api/v1/auth/mfa/verify/', {
        baseURL: BASE_URL,
        method: 'POST',
        body: { otp_id: otpId, code },
      })
      _storeTokens(res.access, res.refresh ?? '', normaliseUser(res.user), pendingRemember)
    } finally {
      isLoading.value = false
    }
  }

  /** Resends a login-challenge or enrollment code; returns the new otp_id. */
  async function mfaResend(otpId: string): Promise<MfaIssuedResponse> {
    return $fetch<MfaIssuedResponse>('/api/v1/auth/mfa/resend/', {
      baseURL: BASE_URL,
      method: 'POST',
      body: { otp_id: otpId },
    })
  }

  // ── MFA: enrollment (authenticated) ──────────────────────────────────────
  function _authHeaders(): Record<string, string> {
    return accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {}
  }

  async function mfaEnroll(channel: 'email' | 'sms'): Promise<MfaIssuedResponse> {
    return $fetch<MfaIssuedResponse>('/api/v1/auth/mfa/enroll/', {
      baseURL: BASE_URL,
      method: 'POST',
      headers: _authHeaders(),
      body: { channel },
    })
  }

  /** Confirms the enrollment code - activates MFA and updates the cached user. */
  async function mfaEnrollVerify(otpId: string, code: string): Promise<void> {
    const res = await $fetch<MfaVerifyResponse>('/api/v1/auth/mfa/verify/', {
      baseURL: BASE_URL,
      method: 'POST',
      body: { otp_id: otpId, code },
    })
    if ('user' in res && res.user) {
      user.value = normaliseUser(res.user)
      setItem('uapts_user', JSON.stringify(user.value), preferLocal())
    }
  }

  async function mfaDisable(password: string): Promise<void> {
    await $fetch<DetailResponse>('/api/v1/auth/mfa/disable/', {
      baseURL: BASE_URL,
      method: 'POST',
      headers: _authHeaders(),
      body: { password },
    })
    if (user.value) {
      user.value = { ...user.value, mfa_active: false, mfa_channel: '' }
      setItem('uapts_user', JSON.stringify(user.value), preferLocal())
    }
  }

  // ── Password reset (forgot password) ─────────────────────────────────────
  async function requestPasswordReset(email: string): Promise<void> {
    await $fetch<DetailResponse>('/api/v1/auth/password/reset/', {
      baseURL: BASE_URL,
      method: 'POST',
      body: { email },
    })
  }

  async function confirmPasswordReset(
    uid: string, token: string, newPassword1: string, newPassword2: string,
  ): Promise<void> {
    await $fetch<DetailResponse>('/api/v1/auth/password/reset/confirm/', {
      baseURL: BASE_URL,
      method: 'POST',
      body: { uid, token, new_password1: newPassword1, new_password2: newPassword2 },
    })
  }

  // ── Password change (authenticated) ──────────────────────────────────────
  /**
   * The backend blacklists every outstanding refresh token on a successful
   * change (logout-on-change) - the current access token still works until
   * its natural ~15min expiry, but the next silent refresh will fail. Clear
   * locally right away rather than let that surface as a confusing error
   * later.
   */
  async function changePassword(oldPassword: string, newPassword1: string, newPassword2: string): Promise<void> {
    await $fetch<DetailResponse>('/api/v1/auth/password/change/', {
      baseURL: BASE_URL,
      method: 'POST',
      headers: _authHeaders(),
      body: { old_password: oldPassword, new_password1: newPassword1, new_password2: newPassword2 },
    })
    _clearTokens()
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function logout(): Promise<void> {
    if (refreshToken.value && accessToken.value) {
      try {
        await $fetch('/api/v1/auth/logout/', {
          baseURL: BASE_URL,
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken.value}` },
          body: { refresh: refreshToken.value },
        })
      } catch { /* ignore - we clear locally regardless */ }
    }
    _clearTokens()
  }

  /** Called by the API plugin when a refresh attempt fails */
  function forceLogout() {
    _clearTokens()
  }

  // ── Token freshness check ──────────────────────────────────────────────────
  // Decodes the access token's `exp` claim (no signature verification needed -
  // we trust our own token) so callers like the notification socket can skip
  // refreshAccessToken() when the current token is still valid, instead of
  // forcing a refresh on every single (re)connect attempt.
  function isAccessTokenFresh(bufferMs = 60_000): boolean {
    if (!accessToken.value) return false
    try {
      const payload = JSON.parse(atob(accessToken.value.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')))
      if (typeof payload.exp !== 'number') return false
      return Date.now() < payload.exp * 1000 - bufferMs
    } catch {
      return false
    }
  }

  // ── Silent token refresh ───────────────────────────────────────────────────
  async function refreshAccessToken(): Promise<string | null> {
    if (!refreshToken.value) return null
    try {
      const res = await $fetch<TokenRefreshResponse>('/api/v1/auth/token/refresh/', {
        baseURL: BASE_URL,
        method: 'POST',
        body: { refresh: refreshToken.value },
      })
      accessToken.value = res.access
      if (res.refresh) {
        // Rotation (SIMPLE_JWT.ROTATE_REFRESH_TOKENS) must preserve the
        // original "remember me" choice, not silently promote a session-only
        // login into a persistent one - _persistRefresh's own default is
        // `true`, which did exactly that on the very first refresh of every
        // non-remembered session. Persist the rotated token to wherever the
        // one it's replacing already lives.
        const remember = preferLocal() === 'local'
        refreshToken.value = res.refresh
        _persistRefresh(res.refresh, remember)
      }
      return res.access
    } catch {
      _clearTokens()
      return null
    }
  }

  // ── Fetch current user profile ─────────────────────────────────────────────
  async function fetchMe(): Promise<void> {
    if (!accessToken.value) return
    try {
      // Backend exposes the profile at /api/v1/auth/user/ (dj-rest-auth).
      // Some deployments also mount it at /api/v1/users/me/ via a custom
      // endpoint - keep a fallback to whichever responds first.
      let me: User | null = null
      try {
        me = await $fetch<User>('/api/v1/auth/user/', {
          baseURL: BASE_URL,
          headers: { Authorization: `Bearer ${accessToken.value}` },
        })
      } catch {
        me = await $fetch<User>('/api/v1/users/me/', {
          baseURL: BASE_URL,
          headers: { Authorization: `Bearer ${accessToken.value}` },
        })
      }
      user.value = normaliseUser(me)
      setItem('uapts_user', JSON.stringify(user.value), preferLocal())
    } catch { /* leave cached value as-is */ }
  }

  // ── Private helpers ────────────────────────────────────────────────────────
  function _storeTokens(access: string, refresh: string, userData: AuthUser, remember: boolean) {
    accessToken.value  = access
    refreshToken.value = refresh
    user.value         = userData
    _persistRefresh(refresh, remember)
    setItem('uapts_user', JSON.stringify(userData), remember ? 'local' : 'session')
  }

  function _persistRefresh(token: string, remember: boolean) {
    if (!token) return
    setItem('uapts_refresh', token, remember ? 'local' : 'session')
  }

  function _clearTokens() {
    accessToken.value  = null
    refreshToken.value = null
    user.value         = null
    showMfaNudge.value = false
    removeItem('uapts_refresh')
    removeItem('uapts_user')
  }

  return {
    accessToken, refreshToken, user, isLoading, showMfaNudge,
    isAuthenticated, userInitials,
    hydrate, login, logout, forceLogout, refreshAccessToken, fetchMe, isAccessTokenFresh,
    dismissMfaNudge,
    mfaVerify, mfaResend, mfaEnroll, mfaEnrollVerify, mfaDisable,
    requestPasswordReset, confirmPasswordReset, changePassword,
  }
})