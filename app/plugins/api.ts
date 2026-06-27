/**
 * $apiFetch - typed fetch wrapper used everywhere in the app.
 *
 * Architecture pattern used by Spotify / Netflix / GitHub:
 *   - Single entry point for all API calls (no raw fetch scattered around)
 *   - Access token injected automatically from the auth store
 *   - On 401: attempt a silent token refresh ONCE, then retry
 *   - On second 401 (refresh is also dead): force logout
 *
 * Usage anywhere in the app:
 *   const { $api } = useNuxtApp()
 *   const data = await $api<MyType>('/api/v1/users/')
 */

import { useAuthStore } from '~/stores/auth'


export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const BASE_URL = config.public.apiBase

  // Internal flag so we only attempt one refresh per 401 wave
  let isRefreshing = false
  let refreshPromise: Promise<string | null> | null = null

  /**
   * Core fetch function. All options follow Nuxt's $fetch / ofetch API.
   */
  async function apiFetch<T = unknown>(
    path: string,
    options: Parameters<typeof $fetch>[1] & { _retry?: boolean } = {}
  ): Promise<T> {
    const auth = useAuthStore()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    }

    if (auth.accessToken) {
      headers['Authorization'] = `Bearer ${auth.accessToken}`
    }

    try {
      return await $fetch<T>(path, {
        baseURL: BASE_URL,
        ...options,
        headers,
      })
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status

      // ── 401: try a silent token refresh (once) ──────────────────────────
      if (status === 401 && !options._retry && auth.refreshToken) {
        // Collapse concurrent refreshes into one promise
        if (!isRefreshing) {
          isRefreshing = true
          refreshPromise = auth.refreshAccessToken().finally(() => {
            isRefreshing = false
            refreshPromise = null
          })
        }

        const newToken = await refreshPromise
        if (newToken) {
          // Retry the original request with the fresh token
          return apiFetch<T>(path, { ...options, _retry: true })
        }
      }

      // ── 401 after refresh (or no refresh token): kick to login ──────────
      if (status === 401) {
        auth.forceLogout()
        await navigateTo('/login')
      }

      throw err
    }
  }

  return {
    provide: {
      api: apiFetch,
    },
  }
})