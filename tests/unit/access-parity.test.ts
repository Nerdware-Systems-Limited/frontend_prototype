// tests/unit/access-parity.test.ts
// ─────────────────────────────────────────────────────────────────────
// Freezes what useAccessControl() resolves today for every agency × tier ×
// route, BEFORE the Module Access override layers exist. With no overrides
// saved, the layered resolver must reproduce this exactly - never update
// this snapshot to make a later change pass.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import settings from '~/config/access-control.json'

const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

import { useAccessControl } from '~/composables/useAccessControl'

const TIERS = ['super_admin', 'oversight', 'admin', 'analyst', 'operator', 'public']
const ROUTES = [...new Set([
  ...Object.values(settings.modules).flatMap((m: any) => m.routes as string[]),
  ...Object.keys(settings.defaults.baselineRoutes),
  '/integrations/files/abc123',
  '/not-a-route',
])].filter(r => !['/access-policies', '/admin/dashboards', '/admin/dashboards/[id]'].includes(r)) // added after the baseline was frozen

describe('access resolution parity baseline', () => {
  it('matches the pre-Module-Access matrix', () => {
    const out: Record<string, string> = {}
    for (const code of [...Object.keys(settings.agencies), null]) {
      for (const tier of TIERS) {
        userRef.value = { id: 'u', email: 'u@example.com', agency_code: code, role_type: tier }
        const { resolveRoute } = useAccessControl()
        for (const route of ROUTES) {
          const res = resolveRoute(route)
          out[`${code}|${tier}|${route}`] = `${res.allowed}|${res.scopeLevel}|${res.deniedCategories.join(',')}`
        }
      }
    }
    expect(out).toMatchSnapshot()
  })
})
