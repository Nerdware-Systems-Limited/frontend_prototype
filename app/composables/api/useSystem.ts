// app/composables/api/useSystem.ts
// ─────────────────────────────────────────────────────────────────────
// System-level endpoints:
//   - GET /api/                      (service banner / link inventory)
//   - GET /api/v1/health/            (component health probe)
//   - GET /api/schema/               (OpenAPI 3.0 JSON)
//
// Used by:
//   - app.vue / dashboard.vue status strip ("All Systems Operational")
//   - top-nav health indicator dots
// ─────────────────────────────────────────────────────────────────────

import { useApi } from './_client'
import type { HealthResponse, RootBanner } from '~/types/uapts'

export function useSystemApi() {
  const api = useApi()
  return {
    banner: () => api<RootBanner>('/api/'),
    health: () => api<HealthResponse>('/api/v1/health/'),
    /** Fetches the raw OpenAPI 3.0 schema (large; cache outside the SPA). */
    schema: () => api<unknown>('/api/schema/?format=json'),
  }
}

/** Convenience: is the system reachable at all? */
export function useServiceHealth() {
  const banner = useState<RootBanner | null>('uapts:banner', () => null)
  const health = useState<HealthResponse | null>('uapts:health', () => null)
  const loading = useState<boolean>('uapts:health-loading', () => false)
  const lastChecked = useState<number | null>('uapts:health-checked', () => null)

  async function refresh(force = false) {
    if (!force && lastChecked.value && Date.now() - lastChecked.value < 30_000) return
    loading.value = true
    try {
      const sys = useSystemApi()
      const [b, h] = await Promise.allSettled([sys.banner(), sys.health()])
      if (b.status === 'fulfilled') banner.value = b.value
      if (h.status === 'fulfilled') health.value = h.value
      lastChecked.value = Date.now()
    } finally {
      loading.value = false
    }
  }

  return { banner, health, loading, lastChecked, refresh }
}