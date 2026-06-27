// app/composables/api/_client.ts
// ─────────────────────────────────────────────────────────────────────
// Low-level typed $api wrapper.
//
// The `$api` Nuxt plugin (plugins/api.ts) injects a fetch function
// into the Nuxt app that handles:
//   - Bearer token injection from the auth store
//   - Silent refresh on 401 (once)
//   - Force-logout on a second 401
//
// This module re-exposes it with a slightly nicer signature and a
// pre-bound runtime-config base URL, so domain composables don't have
// to keep calling `useNuxtApp()` + `useRuntimeConfig()`.
// ─────────────────────────────────────────────────────────────────────

import type { FetchOptions } from 'ofetch'

export interface ApiOptions extends Omit<FetchOptions<'json'>, 'body'> {
  body?: unknown
  /** Query-string params (typed loosely - domain composables re-narrow). */
  query?: Record<string, string | number | boolean | undefined | null>
}

/** Typed wrapper around the $api plugin. */
export function useApi() {
  const { $api } = useNuxtApp() as unknown as {
    $api: <T = unknown>(path: string, opts?: ApiOptions) => Promise<T>
  }
  return $api
}

/**
 * Convenience: build query-string params that drop null/undefined.
 * Keeps the URL clean (no `?agency_code=`).
 */
export function cleanQuery(q: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (!q) return out
  for (const [k, v] of Object.entries(q)) {
    if (v === null || v === undefined || v === '') continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    }
  }
  return out
}