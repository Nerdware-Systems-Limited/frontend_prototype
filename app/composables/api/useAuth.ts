// app/composables/api/useAuth.ts
// ─────────────────────────────────────────────────────────────────────
// /api/v1/auth/* - login / logout / refresh / register / password flows.
//
// These wrap the standard dj-rest-auth + simplejwt endpoints. The store
// (stores/auth.ts) owns the token state; this composable just exposes
// the HTTP operations so tests can mock the transport layer cleanly.
// ─────────────────────────────────────────────────────────────────────

import { useApi } from './_client'
import type { AuthUser, LoginResponse, TokenRefreshResponse } from '~/types/uapts'

export interface LoginPayload { email: string; password: string }
export interface PasswordChangePayload {
  old_password: string
  new_password1: string
  new_password2: string
}
export interface PasswordResetPayload { email: string }
export interface PasswordResetConfirmPayload {
  uid: string
  token: string
  new_password1: string
  new_password2: string
}
export interface RegisterPayload {
  email: string
  password1: string
  password2: string
}

export function useAuthApi() {
  const api = useApi()

  return {
    /** POST /api/v1/auth/login/ → `{access, refresh, user}`. */
    login: (body: LoginPayload) =>
      api<LoginResponse>('/api/v1/auth/login/', { method: 'POST', body }),

    /** POST /api/v1/auth/logout/ - blacklists the refresh token. */
    logout: (refresh: string, access: string) =>
      api<void>('/api/v1/auth/logout/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}` },
        body: { refresh },
      }),

    /** POST /api/v1/auth/token/refresh/ → `{access, refresh?}`. */
    refresh: (refresh: string) =>
      api<TokenRefreshResponse>('/api/v1/auth/token/refresh/', { method: 'POST', body: { refresh } }),

    /** POST /api/v1/auth/token/verify/. */
    verify: (token: string) =>
      api<{}>('/api/v1/auth/token/verify/', { method: 'POST', body: { token } }),

    /** GET /api/v1/auth/user/ → current profile. */
    user: () => api<AuthUser>('/api/v1/auth/user/'),

    /** POST /api/v1/auth/register/. */
    register: (body: RegisterPayload) =>
      api<LoginResponse>('/api/v1/auth/register/', { method: 'POST', body }),

    /** POST /api/v1/auth/password/change/ (authenticated). */
    changePassword: (body: PasswordChangePayload) =>
      api<{ detail: string }>('/api/v1/auth/password/change/', { method: 'POST', body }),

    /** POST /api/v1/auth/password/reset/. */
    requestPasswordReset: (body: PasswordResetPayload) =>
      api<{ detail: string }>('/api/v1/auth/password/reset/', { method: 'POST', body }),

    /** POST /api/v1/auth/password/reset/confirm/. */
    confirmPasswordReset: (body: PasswordResetConfirmPayload) =>
      api<{ detail: string }>('/api/v1/auth/password/reset/confirm/', { method: 'POST', body }),
  }
}