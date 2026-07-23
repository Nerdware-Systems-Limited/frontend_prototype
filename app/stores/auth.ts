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
import type { AuthUser, LoginResponse, TokenRefreshResponse, User } from '~/types/uapts'

// ── Safe browser-storage helpers (no-ops on SSR) ────────────────────────────
function getItem(key: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

function setItem(key: string, value: string, prefer: 'local' | 'session') {
  if (typeof window === 'undefined') return
  const storage = prefer === 'local' ? localStorage : sessionStorage
  storage.setItem(key, value)
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
    is_active: raw.is_active ?? true,
    is_staff: raw.is_staff ?? false,
    created_at: raw.created_at,
    full_name: local ? local.charAt(0).toUpperCase() + local.slice(1) : email,
  }
}

// ── Store ────────────────────────────────────────────────────────────────────
export const useAuthStore = defineStore('auth', () => {
  const config   = useRuntimeConfig()
  const BASE_URL = config.public.apiBase

  // ── State ──────────────────────────────────────────────────────────────────
  const accessToken  = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const user         = ref<AuthUser | null>(null)
  const isLoading    = ref(false)

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
  async function login(email: string, password: string, remember = false): Promise<void> {
    isLoading.value = true
    try {
      const res = await $fetch<LoginResponse>('/api/v1/auth/login/', {
        baseURL: BASE_URL,
        method: 'POST',
        body: { email, password },
      })
      _storeTokens(res.access, res.refresh ?? '', normaliseUser(res.user), remember)
    } finally {
      isLoading.value = false
    }
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
      const payload = JSON.parse(atob(accessToken.value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
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
        refreshToken.value = res.refresh
        _persistRefresh(res.refresh)
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

  function _persistRefresh(token: string, remember = true) {
    if (!token) return
    setItem('uapts_refresh', token, remember ? 'local' : 'session')
  }

  function _clearTokens() {
    accessToken.value  = null
    refreshToken.value = null
    user.value         = null
    removeItem('uapts_refresh')
    removeItem('uapts_user')
  }

  return {
    accessToken, refreshToken, user, isLoading,
    isAuthenticated, userInitials,
    hydrate, login, logout, forceLogout, refreshAccessToken, fetchMe, isAccessTokenFresh,
  }
})