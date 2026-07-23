// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // SSR off - SPA dashboard, same as the reference prototype
  // ssr: false,
  srcDir: 'app',
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit', 'leaflet'],
    },
  },

  routeRules: {
    '/**': { ssr: false },
    '/': { redirect: '/dashboard' },
  },

  modules: ['@nuxtjs/tailwindcss', '@vueuse/nuxt', '@pinia/nuxt'],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? 'https://uapts.eu.cc',
      // Left unset by default (rather than a hardcoded prod placeholder) so
      // useAuditSocket can derive a same-host ws(s):// URL from `apiBase`
      // when this isn't explicitly configured - see useAuditSocket.ts.
      wsUrl: process.env.NUXT_PUBLIC_WS_URL || '',
      notificationsWsUrl:
        process.env.NUXT_PUBLIC_NOTIFICATIONS_WS_URL ??
        'wss://uapts.eu.cc/ws/notifications/',
    }
  },

  css: [
    // 1) main.css - Tailwind base + minimal reset (light UAPTS palette)
    '~/assets/css/main.css',
    // 2) theme.css - the wireframe design system, ported verbatim from
    //    UAPTS_WEB_WIREFRAMES/css/theme.css. Defines :root tokens,
    //    top-nav, sidebar, kpi cards, agency cards, alerts, modals, etc.
    '~/assets/css/theme.css',
    // 3) Leaflet map CSS (for the existing UaptsMap.vue component)
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
        { rel: 'icon', type: 'image/png', href: '/uapts-logo.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },
})
