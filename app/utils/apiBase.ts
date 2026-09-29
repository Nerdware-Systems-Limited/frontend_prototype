/**
 * Where browser requests go.
 *
 * NUXT_PUBLIC_API_BASE (.env) is the backend's address. In development the
 * Nuxt dev server proxies /api and /media to it (nitro.devProxy in
 * nuxt.config.ts), so HTTP stays same-origin: no CORS or CSRF-origin
 * changes are needed on a backend we don't control. WebSockets are not
 * proxied (see wsUrl). `public.apiProxy` is on
 * in dev and off in production builds (override with NUXT_PUBLIC_API_PROXY).
 *
 * Every request/WebSocket that used to read `public.apiBase` directly goes
 * through these two helpers instead.
 */

/** Base URL for HTTP calls: '' (same origin, proxied) or the absolute backend URL. */
export function apiBaseUrl(): string {
  const pub = useRuntimeConfig().public
  if (isProxied(pub)) return ''
  return String(pub.apiBase ?? '').replace(/\/$/, '')
}

/**
 * WebSocket URL: always the configured backend address, never the dev proxy.
 * Proxying upgrades through Nitro's devProxy crashed `nuxi dev` whenever a
 * socket was reset (unhandled ECONNRESET), and WebSockets don't need the
 * proxy anyway: browsers don't apply CORS to them. Kept as the single place
 * socket URLs are resolved, so callers don't change if that ever does.
 */
export function wsUrl(configured: string): string {
  return configured
}

function isProxied(pub: Record<string, unknown>): boolean {
  const v = pub.apiProxy
  return v === true || v === 'true'
}
