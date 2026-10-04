// tests/unit/threshold-widgets.test.ts
// ─────────────────────────────────────────────────────────────────────
// The alerts rail and agency snapshot read the same thresholds as the KPI
// cards: a breach raises an alert of the matching severity and colours the
// agency row; a figure within limits does neither.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { ref, shallowRef, watch } from 'vue'

beforeAll(() => {
  ;(globalThis as any).watch = watch
  ;(globalThis as any).shallowRef = shallowRef
  ;(globalThis as any).useViewerContext = () => ({ can: () => true, viewer: ref(null) })
})

const payloads = shallowRef<Record<string, unknown>>({})

vi.mock('~/composables/useWidgetData', () => ({
  useWidgetSources: () => ({
    data: payloads, failures: ref({}), state: ref('ready'), refreshedAt: ref(null), loading: ref(false), reload: () => {},
  }),
}))
vi.mock('~/composables/useDashboardFilters', () => ({
  useWidgetFilters: () => ({ context: ref({}), highlight: ref(null), emit: vi.fn(), ignored: ref([]) }),
}))

import AlertsWidget from '~/components/dashboard/widgets/AlertsWidget.vue'
import AgencyCardWidget from '~/components/dashboard/widgets/AgencyCardWidget.vue'

// Each mount shares `payloads`; unmount so an old widget never re-renders on the next test's data.
enableAutoUnmount(afterEach)

const instance = { id: 'w', type: 'alerts', x: 0, y: 0, w: 4, h: 4 }
const stubs = { NuxtLink: { template: '<a :class="$attrs.class"><slot /></a>' }, WidgetState: true }

describe('AlertsWidget', () => {
  it('raises alerts whose severity matches the threshold status', () => {
    payloads.value = {
      'safety.summary': { kpis: { active: 3, fatal_30d: 25 }, black_spots_by_tier: { critical: 7 } },
      'rail.summary': { incidents_90d: { fatal: 0 }, on_time_30d: { on_time_pct: 75 } },
      'aviation.summary': { kpis: { otp_pct: 90 } },
      'fleet.summary': { governor_compliance: { tamper_rate_pct: 2 } },
      'infra.summary': { bridges: { critical_count: 0 } },
      'integrations.feeds': [],
    }
    const w = mount(AlertsWidget, { props: { instance, config: {} }, global: { stubs } })
    const rows = w.findAll('.alert').map(a => ({ sev: a.classes().find(c => c === 'critical' || c === 'warning'), text: a.text() }))
    expect(rows).toEqual([
      { sev: 'critical', text: expect.stringContaining('25 road fatalities in 30 days') },
      { sev: 'critical', text: expect.stringContaining('7 critical black spots') },
      { sev: 'warning', text: expect.stringContaining('Rail OTP below benchmark: 75.0%') },
    ])
  })

  it('says all clear when every checked figure is within limits', () => {
    payloads.value = {
      'safety.summary': { kpis: { active: 1, fatal_30d: 2 }, black_spots_by_tier: {} },
      'rail.summary': { incidents_90d: { fatal: 0 }, on_time_30d: { on_time_pct: 92 } },
      'aviation.summary': { kpis: { otp_pct: 90 } },
      'fleet.summary': { governor_compliance: { tamper_rate_pct: 1 } },
      'infra.summary': { bridges: { critical_count: 0 } },
      'integrations.feeds': [],
    }
    const w = mount(AlertsWidget, { props: { instance, config: {} }, global: { stubs } })
    expect(w.findAll('.alert.critical, .alert.warning')).toHaveLength(0)
    expect(w.text()).toContain('No active escalations')
  })
})

describe('AgencyCardWidget', () => {
  it('colours rows by threshold status and leaves plain counts neutral', () => {
    payloads.value = {
      'rail.summary': {
        on_time_30d: { on_time_pct: 65, avg_delay_min: 4 },
        ridership_30d: { passengers: 120000 },
        freight_30d: { total_tons: 3400 },
      },
    }
    const w = mount(AgencyCardWidget, {
      props: { instance: { ...instance, type: 'agency-card' }, config: { agency: 'KRC' } },
      global: { stubs },
    })
    const rows = Object.fromEntries(w.findAll('.agency-row').map(r => [
      r.get('.agency-row-label').text(),
      { value: r.get('.agency-val').text(), cls: r.get('.agency-val').classes().filter(c => ['success', 'warning', 'danger'].includes(c)) },
    ]))
    expect(rows['SGR on-time performance (30d)']).toEqual({ value: '65.0%', cls: ['danger'] })
    expect(rows['Avg delay']).toEqual({ value: '4.0 min', cls: ['success'] })
    expect(rows['Ridership (30d)']).toEqual({ value: '120,000', cls: [] })
    expect(rows['Freight tonnage (30d)']).toEqual({ value: '3,400 t', cls: [] })
  })
})
