// tests/unit/agency-command-centre.test.ts
// ─────────────────────────────────────────────────────────────────────
// AgencyCommandCentre renders one real KpiCard per full-scope module,
// a muted one per read-scope module, nothing for denied modules, and
// "NO DATA" (never a fabricated value) when a module's API call fails.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
// AgencyCommandCentre calls Nuxt's auto-imported useAccessControl() in
// setup. Outside Nuxt's build there's no auto-import, so wire the *real*
// composable through globalThis (not a mock) - these tests exist to prove
// RBAC resolution against the real access-control.json, same idiom the
// KpiCard test uses for useRouter()/useRoute().
import { useAccessControl } from '~/composables/useAccessControl'
// Nuxt also auto-registers every app/components/*.vue file as a global
// component (no explicit import needed in production). Outside Nuxt's
// build, @vue/test-utils needs them registered explicitly so the real
// KpiCard/EmptyState/SectionTitle render for real, rather than being
// silently skipped - see `global.components` on the mount() calls below.
import KpiCard from '~/components/KpiCard.vue'
import EmptyState from '~/components/EmptyState.vue'
import SectionTitle from '~/components/SectionTitle.vue'

beforeAll(() => {
  ;(globalThis as any).useRouter = () => ({ push: vi.fn(), replace: vi.fn() })
  ;(globalThis as any).useRoute  = () => ({ query: {} })
  ;(globalThis as any).useAccessControl = useAccessControl
})

const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

// Fleet resolves with real data; Safety rejects, to prove the
// honest-empty-state path (never a fabricated number on failure).
vi.mock('~/composables/api', async () => {
  const actual = await vi.importActual<any>('~/composables/api')
  return {
    ...actual,
    useFleet: () => ({ summary: () => Promise.resolve({ kpis: { live_vehicles: 42, trips_7d: 100 }, governor_compliance: { online_pct: 91 } }) }),
    useSafety: () => ({ summary: () => Promise.reject(new Error('feed down')) }),
  }
})

import AgencyCommandCentre from '~/components/AgencyCommandCentre.vue'

function setUser(agency_code: string | null, role_type: string) {
  userRef.value = { id: 'u1', email: 'u1@example.com', agency_code, role_type }
}

beforeEach(() => { userRef.value = null; vi.clearAllMocks() })

const mountCentre = () =>
  mount(AgencyCommandCentre, {
    global: {
      components: { KpiCard, EmptyState, SectionTitle },
      stubs: { NuxtLink: true, Sparkline: true },
      // Every tile now carries `:to`, so KpiCard's root becomes a
      // (stubbed) NuxtLink - Vue Test Utils' auto-stubs drop default-slot
      // content unless this is set, which would otherwise hide the KPI
      // value/label/reason text these tests assert on.
      renderStubDefaultSlot: true,
    },
  })

describe('AgencyCommandCentre', () => {
  it("renders a real KPI value for a module the agency has full access to", async () => {
    setUser('NTSA', 'admin') // NTSA grants.full includes M03 Fleet
    const w = mountCentre()
    await flushPromises()
    const text = w.text()
    expect(text).toContain('42')
  })

  it("shows NO DATA, not a fabricated number, when a full-scope module's fetch rejects", async () => {
    setUser('NTSA', 'admin') // NTSA grants.full includes M05 Safety
    const w = mountCentre()
    await flushPromises()
    // KpiCard's unavailable tag renders literal "No data" text and relies on
    // CSS text-transform: uppercase for the visual "NO DATA" - happy-dom's
    // textContent doesn't apply CSS, so match case-insensitively here.
    expect(w.text()).toMatch(/no data/i)
  })

  it('does not render a tile for a module the agency has no access to at all', async () => {
    setUser('KENHA', 'admin') // KENHA denies M04 Public Transport outright
    const w = mountCentre()
    await flushPromises()
    expect(w.text()).not.toContain('Public Transport')
  })

  it('renders the agency name as the page heading', async () => {
    setUser('KPA', 'admin')
    const w = mountCentre()
    await flushPromises()
    expect(w.text()).toContain('Kenya Ports Authority')
  })

  it('applies the muted class to a read-scope tile (NTSA has explicit read-only access to /traffic)', async () => {
    setUser('NTSA', 'admin')
    const w = mountCentre()
    await flushPromises()
    expect(w.find('.kpi-card--muted').exists()).toBe(true)
  })
})
