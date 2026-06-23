// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: true,
  srcDir: 'app',
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  vite: {
    // Leaflet touches `window` at import time. optimizeDeps.include
    // tells Vite/esbuild to pre-bundle it so that the global side
    // effects run in a clean Node-ish sandbox and the module we get
    // back is a normalised ESM shape — which makes the CJS↔ESM
    // unwrap in UaptsMap.vue work reliably.
    optimizeDeps: {
      include: ['leaflet'],
    },
  },

  routeRules: {
    '/': { redirect: '/login' },
    '/map': { redirect: '/kenya-map' },
  },

  modules: ['@nuxtjs/tailwindcss', '@vueuse/nuxt', '@pinia/nuxt'],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? 'http://127.0.0.1:8000',
      wsUrl: process.env.NUXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000/ws/audit/'
    }
  },

  // Single source of truth for leaflet.css — the local node_modules
  // copy is always reachable, the unpkg CDN one isn't (and was being
  // loaded twice, which caused a flash of unstyled map on slow nets).
  css: [
    '~/assets/css/main.css',
    'leaflet/dist/leaflet.css',
  ],

  app: {
    head: {
      title: 'UAPTS Platform',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Unified Analytics and Predictive Transport System' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap' }
      ]
    }
  }
})
