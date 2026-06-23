// tests/setup.ts
// ─────────────────────────────────────────────────────────────────────
// Vitest global setup.
//   - Polyfills `process.client` so the auth store works (it gates
//     localStorage reads behind this flag).
//   - Polyfills Nuxt's auto-imported composables (`ref`, `computed`,
//     `useRuntimeConfig`, `useNuxtApp`, `useState`) so production
//     source code can be imported unchanged in tests.
//   - Clears localStorage / sessionStorage between tests so auth state
//     doesn't leak across runs.
// ─────────────────────────────────────────────────────────────────────

import { ref, computed, reactive } from 'vue'

// Provide the runtime flag the auth store guards on. In Nuxt, `process.client`
// is set to true in the browser bundle; we replicate that here for happy-dom.
;(globalThis as any).process = {
  client: true,
  server: false,
  env: { NODE_ENV: 'test', ...(((globalThis as any).process?.env) ?? {}) },
}

// Make Nuxt's auto-imports available as globals so app source code can
// be imported by tests without rewriting every `ref(...)` / `computed(...)`
// call site. (Nuxt compiles these to imports in production.)
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).reactive = reactive
;(globalThis as any).useRuntimeConfig = () => ({
  public: {
    apiBase: process.env.UAPTS_API_BASE ?? 'http://test.local:8000',
    wsUrl: 'ws://test.local:8000/ws/audit/',
  },
})
;(globalThis as any).useNuxtApp = () => ({ $api: (globalThis as any).$api })
;(globalThis as any).useState = <T>(_k: string, init: () => T): { value: T } => {
  return { value: init() } as any
}

import { afterEach } from 'vitest'

afterEach(() => {
  // Wipe any tokens a test persisted. Vitest doesn't auto-clear storage.
  // Integration tests run under the `node` env where these globals don't exist.
  if (typeof localStorage !== 'undefined') localStorage.clear()
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
})