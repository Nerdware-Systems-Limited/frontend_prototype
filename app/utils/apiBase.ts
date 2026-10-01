/**
 * Where browser requests go.
 *
 * NUXT_PUBLIC_API_BASE (.env) is the backend's address. In development the
 * Nuxt dev server proxies /api, /ws and /media to it (nitro.devProxy in
 * nuxt.config.ts), so the browser stays same-origin: no CORS or CSRF-origin
 * changes are needed on a backend we don't control. `public.apiProxy` is on
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
 * WebSocket URL - always the configured absolute backend address, never
 * rewritten to this page's own host.
 *
 * This used to point WebSockets at the page's own host so they'd ride the
 * same devProxy as HTTP (nitro.devProxy, `ws: true`), matching the "stay
 * same-origin" strategy in apiBaseUrl(). In practice that proxy never
 * upgrades the connection - `nuxi dev` runs Vite's own HMR WebSocket server
 * on the same underlying HTTP server, which claims the `upgrade` event
 * before Nitro's proxy sees it, so every WS handshake through it comes back
 * as a plain HTTP 200 instead of a 101 Switching Protocols (confirmed
 * against both /ws/audit/ and /ws/notifications/). Unlike HTTP, a
 * WebSocket's cross-origin request isn't blocked by the browser and isn't
 * subject to Django's CSRF-origin check (core/ws_auth.py authenticates
 * purely off the `?token=` JWT, no Origin check) - so there's no same-origin
 * requirement to preserve here, and connecting straight to the backend
 * sidesteps the broken proxy entirely.
 */
export function wsUrl(configured: string): string {
  return configured
}

function isProxied(pub: Record<string, unknown>): boolean {
  const v = pub.apiProxy
  return v === true || v === 'true'
}
