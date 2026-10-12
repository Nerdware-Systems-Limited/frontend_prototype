// vitest.config.ts
// ─────────────────────────────────────────────────────────────────────
// Test runner config for the Nuxt 4 frontend.
//
// We deliberately stay OFF Nuxt Test Utils for most tests: they're slow
// (it has to spin up a Nuxt build) and the bulk of our surface - the
// API plugin, auth store, and domain composables - are pure TS/Vue and
// can be tested in isolation with happy-dom.
//
// Integration tests live in `tests/integration/` and run against the
// live backend on http://127.0.0.1:8000. They use Node's native
// `fetch` (via `environment: 'node'`) because happy-dom's fetch
// strips Authorization headers on cross-origin requests - which would
// silently break every authenticated probe.
//
// For end-to-end page tests (mount a Nuxt page, click around), opt-in
// via a separate file that calls `setup()` from @nuxt/test-utils.
// ─────────────────────────────────────────────────────────────────────
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'

// Vitest only exposes VITE_-prefixed values from .env, so the live-backend suite
// (tests/integration/live.test.ts) would never see UAPTS_TEST_EMAIL / _PASSWORD.
// Hand it just the UAPTS_* entries; real environment variables still win.
const uaptsEnv = loadEnv('test', process.cwd(), 'UAPTS_')

export default defineConfig({
  plugins: [vue()],
  test: {
    env: uaptsEnv,
    // Per-file environment override - happy-dom for Vue/Pinia,
    // node for integration tests that hit the live backend.
    // (Each file can also set `// @vitest-environment node` at the top.)
    environment: 'happy-dom',
    environmentMatchGlobs: [
      // Integration tests need Node's fetch (Authorization headers work).
      ['tests/integration/**', 'node'],
    ],
    globals: true,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
})