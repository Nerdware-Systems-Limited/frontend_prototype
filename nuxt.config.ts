// https://nuxt.com/docs/api/configuration/nuxt-config

// Backend address (set NUXT_PUBLIC_API_BASE in .env). In dev the browser
// talks only to the Nuxt dev server, which proxies these prefixes to the
// backend - see app/utils/apiBase.ts.
const API_TARGET = (process.env.NUXT_PUBLIC_API_BASE ?? 'https://uapts.eu.cc').replace(/\/$/, '')
const DEV = process.env.NODE_ENV !== 'production'

export default defineNuxtConfig({
  // SSR off - SPA dashboard, same as the reference prototype
  // ssr: false,
  srcDir: 'app',
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit', 'leaflet', 'protomaps-leaflet'],
    },
  },

  routeRules: {
    '/**': { ssr: false },
    '/': { redirect: '/dashboard' },
    // Integration Hub redesign - a couple of old static paths kept
    // working for bookmarks. These MUST stay static: a `:param` rule here
    // (e.g. `/integrations/:source_id`) is matched by Nitro *before* the
    // file-based routes, so it silently swallows real pages like
    // `/integrations/files` and `/integrations/analytics` and 307s them
    // (Nitro also doesn't interpolate the param into the redirect target).
    // Old per-source deep links (`/integrations/<source_id>`) are handled
    // in-app instead - see app/pages/integrations/index.vue.
    '/integrations/uploads': { redirect: '/integrations/files' },
    // Static prefix, no `:param` at the top level - safe. (`/uploads/<id>`
    // has no page of its own, so this shadows nothing.)
    '/integrations/uploads/:id': { redirect: '/integrations/files/:id' },
  },

  modules: ['@nuxtjs/tailwindcss', '@vueuse/nuxt', '@pinia/nuxt'],

  // Dev-only same-origin proxy to the backend (it's on another host and we
  // can't change its CORS/CSRF settings). Auth is a Bearer header, which the
  // proxy forwards untouched; changeOrigin sets Host to the backend's.
  //
  // No `/ws` entry: `nuxi dev` runs Vite's own HMR WebSocket server on the
  // same underlying HTTP server, which claims every `upgrade` event before
  // this proxy's `ws: true` handling ever sees it, so a proxied `/ws/*` never
  // actually upgrades (confirmed - it comes back as a plain HTTP 200).
  // WebSockets connect straight to the backend instead - see wsUrl() in
  // app/utils/apiBase.ts for why that's safe to do (no CORS/CSRF concern).
  nitro: {
    devProxy: {
      '/api': { target: `${API_TARGET}/api`, changeOrigin: true },
      '/media': { target: `${API_TARGET}/media`, changeOrigin: true },
    },
  },

  runtimeConfig: {
    public: {
      apiBase: API_TARGET,
      // true in `nuxi dev`: requests use relative /api paths through the proxy above.
      apiProxy: DEV,
      // Left unset by default (rather than a hardcoded prod placeholder) so
      // useAuditSocket can derive a same-host ws(s):// URL from `apiBase`
      // when this isn't explicitly configured - see useAuditSocket.ts.
      wsUrl: process.env.NUXT_PUBLIC_WS_URL || '',
      notificationsWsUrl:
        process.env.NUXT_PUBLIC_NOTIFICATIONS_WS_URL ??
        'wss://uapts.eu.cc/ws/notifications/',
      tilesBase: process.env.NUXT_PUBLIC_TILES_BASE ?? 'https://uapts.eu.cc/media/', // works on nginx
    }
  },

  css: [
    // 1) main.css - Tailwind base + minimal reset (light UAPTS palette)
    '~/assets/css/main.css',
    // 2) theme.css - the wireframe design system, ported verbatim from
    //    UAPTS_WEB_WIREFRAMES/css/theme.css. Defines :root tokens,
    //    top-nav, sidebar, kpi cards, agency cards, alerts, modals, etc.
    '~/assets/css/theme.css',
    // 3) integration-hub.css - shared .ih-* surface primitives for the
    //    Integration Hub inner pages (files / file detail / feeds /
    //    analytics), so they match the /integrations landing view.
    '~/assets/css/integration-hub.css',
    // 4) Leaflet map CSS (for the existing UaptsMap.vue component)
    'leaflet/dist/leaflet.css',
  ],

  app: {
    head: {
      title: 'UAPTS - Unified Analytics & Predictive Transport System',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Unified Analytics and Predictive Transport System - National Transport Executive Dashboard' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
        },
      ],
    },
  },
})
