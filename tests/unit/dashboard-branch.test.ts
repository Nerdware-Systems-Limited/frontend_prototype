// tests/unit/dashboard-branch.test.ts
// ─────────────────────────────────────────────────────────────────────
// dashboard.vue's branch is the one thing nothing else tests: does
// SDT/super_admin actually get NationalCommandCentre, and does every
// other agency-bound account get AgencyCommandCentre? A per-task review
// of Tasks 1/4/5 couldn't see this gap - each covered its own component,
// not the wiring between them.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { useAccessControl } from '~/composables/useAccessControl'

beforeAll(() => {
  ;(globalThis as any).useAccessControl = useAccessControl
})

const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

import DashboardPage from '~/pages/dashboard.vue'

function setUser(agency_code: string | null, role_type: string) {
  userRef.value = { id: 'u1', email: 'u1@example.com', agency_code, role_type }
}

beforeEach(() => { userRef.value = null })

const mountDashboard = () =>
  mount(DashboardPage, {
    global: {
      stubs: {
        NationalCommandCentre: { template: '<div data-testid="national" />' },
        AgencyCommandCentre: { template: '<div data-testid="agency" />' },
      },
    },
  })

describe('dashboard.vue branch', () => {
  it('super_admin sees NationalCommandCentre', () => {
    setUser(null, 'super_admin')
    const w = mountDashboard()
    expect(w.find('[data-testid="national"]').exists()).toBe(true)
    expect(w.find('[data-testid="agency"]').exists()).toBe(false)
  })

  it('SDT sees NationalCommandCentre', () => {
    setUser('SDT', 'admin')
    const w = mountDashboard()
    expect(w.find('[data-testid="national"]').exists()).toBe(true)
    expect(w.find('[data-testid="agency"]').exists()).toBe(false)
  })

  it('an ordinary agency admin sees AgencyCommandCentre', () => {
    setUser('KENHA', 'admin')
    const w = mountDashboard()
    expect(w.find('[data-testid="agency"]').exists()).toBe(true)
    expect(w.find('[data-testid="national"]').exists()).toBe(false)
  })

  it('no agency resolved falls back to NationalCommandCentre', () => {
    setUser(null, 'analyst')
    const w = mountDashboard()
    expect(w.find('[data-testid="national"]').exists()).toBe(true)
  })
})
