// tests/unit/dashboard-branch.test.ts
// ─────────────────────────────────────────────────────────────────────
// dashboard.vue first asks the Dashboard Manager which dashboard this
// viewer gets. When nothing is assigned (HTTP 204 -> null) or the API isn't
// deployed (404), it must fall back to exactly the old behaviour:
// SDT/super_admin get NationalCommandCentre, every other agency-bound
// account gets AgencyCommandCentre. Other failures fall back too, but say so.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref, watch, inject, getCurrentInstance, toRaw } from 'vue'
import { createPinia } from 'pinia'
import { useAccessControl } from '~/composables/useAccessControl'
import { useViewerContext } from '~/composables/useViewerContext'
import { DashboardApiError } from '~/composables/useDashboardApi'

const resolve = vi.fn()
vi.mock('~/composables/useDashboardApi', async () => {
  const actual = await vi.importActual<typeof import('~/composables/useDashboardApi')>('~/composables/useDashboardApi')
  return { ...actual, useDashboardApi: () => ({ resolve }) }
})

beforeAll(() => {
  ;(globalThis as any).useAccessControl = useAccessControl
  ;(globalThis as any).useViewerContext = useViewerContext
  ;(globalThis as any).useRoute = () => ({ query: {} })
  // Nuxt auto-imports the page and useViewerContext rely on.
  Object.assign(globalThis, { watch, inject, getCurrentInstance, toRaw })
})

const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

import DashboardPage from '~/pages/dashboard.vue'

function setUser(agency_code: string | null, role_type: string) {
  userRef.value = { id: 'u1', email: 'u1@example.com', agency_code, role_type, department: null }
}

beforeEach(() => {
  userRef.value = null
  resolve.mockReset()
  resolve.mockResolvedValue(null) // HTTP 204: nothing assigned
})

// Mounted the way the app actually runs: with Pinia installed on the app.
async function mountDashboard() {
  const w = mount(DashboardPage, {
    global: {
      plugins: [createPinia()],
      stubs: {
        NationalCommandCentre: { template: '<div data-testid="national" />' },
        AgencyCommandCentre: { template: '<div data-testid="agency" />' },
        EmptyState: true, SideDrawer: true, DashboardRenderer: true, PersonalCanvas: true, NuxtLink: true,
      },
    },
  })
  await flushPromises()
  return w
}

describe('dashboard.vue branch (nothing assigned)', () => {
  it('super_admin sees NationalCommandCentre', async () => {
    setUser(null, 'super_admin')
    const w = await mountDashboard()
    expect(w.find('[data-testid="national"]').exists()).toBe(true)
    expect(w.find('[data-testid="agency"]').exists()).toBe(false)
  })

  it('SDT sees NationalCommandCentre', async () => {
    setUser('SDT', 'admin')
    const w = await mountDashboard()
    expect(w.find('[data-testid="national"]').exists()).toBe(true)
    expect(w.find('[data-testid="agency"]').exists()).toBe(false)
  })

  it('an ordinary agency admin sees AgencyCommandCentre', async () => {
    setUser('KENHA', 'admin')
    const w = await mountDashboard()
    expect(w.find('[data-testid="agency"]').exists()).toBe(true)
    expect(w.find('[data-testid="national"]').exists()).toBe(false)
  })

  it('no agency resolved falls back to NationalCommandCentre', async () => {
    setUser(null, 'analyst')
    const w = await mountDashboard()
    expect(w.find('[data-testid="national"]').exists()).toBe(true)
  })
})

describe('dashboard.vue when /resolve/ fails', () => {
  it('404 (Dashboard Manager not deployed) falls back silently', async () => {
    setUser('KENHA', 'admin')
    resolve.mockRejectedValue(new DashboardApiError('Not found.', 404))
    const w = await mountDashboard()
    expect(w.find('[data-testid="agency"]').exists()).toBe(true)
    expect(w.find('[role="alert"]').exists()).toBe(false)
  })

  it('any other error falls back and shows the error', async () => {
    setUser('KENHA', 'admin')
    resolve.mockRejectedValue(new DashboardApiError('The server couldn\'t complete the request (HTTP 500).', 500))
    const w = await mountDashboard()
    expect(w.find('[data-testid="agency"]').exists()).toBe(true)
    expect(w.find('[role="alert"]').text()).toContain('HTTP 500')
  })
})
