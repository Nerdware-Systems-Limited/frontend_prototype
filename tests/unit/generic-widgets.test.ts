// tests/unit/generic-widgets.test.ts
// ─────────────────────────────────────────────────────────────────────
// The generic widgets (stat / series / breakdown / table): a binding in the
// config, a source payload in, honest states out. Status comes from the
// shared thresholds; a click reaches the dashboard action engine with the
// binding's filter field; a payload of the wrong shape is an error, not a
// blank or a guess.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { ref, shallowRef, watch } from 'vue'

beforeAll(() => {
  ;(globalThis as any).watch = watch
  ;(globalThis as any).shallowRef = shallowRef
})

const payload = shallowRef<unknown>(null)
const loadState = ref<string>('ready')
const emitSpy = vi.fn()

vi.mock('@vueuse/core', () => ({ useElementSize: () => ({ width: ref(480), height: ref(220) }) }))
vi.mock('~/composables/useWidgetData', () => ({
  useWidgetData: () => ({ data: payload, state: loadState, error: ref(null), reload: vi.fn() }),
}))
vi.mock('~/composables/useDashboardFilters', () => ({
  useWidgetFilters: () => ({ context: ref({}), highlight: ref(null), emit: emitSpy, ignored: ref([]) }),
}))

import StatWidget from '~/components/dashboard/widgets/StatWidget.vue'
import BreakdownWidget from '~/components/dashboard/widgets/BreakdownWidget.vue'
import SeriesWidget from '~/components/dashboard/widgets/SeriesWidget.vue'
import TableWidget from '~/components/dashboard/widgets/TableWidget.vue'
import { resolveCatalogItem } from '~/utils/widgetRegistry'

enableAutoUnmount(afterEach)

const KpiStub = { name: 'KpiCard', props: ['label', 'value', 'unit', 'status', 'unavailable', 'unavailableReason', 'loading', 'period', 'description', 'unitTitle', 'prominent', 'to'], template: '<div class="kpi-stub" />' }
const instance = (type: string) => ({ id: 'w1', type, x: 0, y: 0, w: 4, h: 3 })
const presetConfig = (id: string) => resolveCatalogItem(`preset:${id}`)!.config

describe('StatWidget', () => {
  const otp = { binding: { source: 'pt.summary', shape: 'scalar', path: 'on_time_pct', measures: [{ key: 'value', label: 'On-time', unit: 'pct' }], threshold: 'rail.otp_pct' }, period: '24H' }

  it('formats the figure and takes its status from the shared threshold', () => {
    payload.value = { on_time_pct: 65.04 }
    loadState.value = 'ready'
    const kpi = mount(StatWidget, { props: { instance: instance('stat'), config: otp }, global: { stubs: { KpiCard: KpiStub } } }).getComponent(KpiStub)
    expect(kpi.props()).toMatchObject({ label: 'On-time', value: '65.0', unit: '%', status: 'critical', unavailable: false, period: '24H' })
  })

  it('a figure the feed did not report is unavailable, never 0', () => {
    payload.value = { on_time_pct: null }
    const kpi = mount(StatWidget, { props: { instance: instance('stat'), config: otp }, global: { stubs: { KpiCard: KpiStub } } }).getComponent(KpiStub)
    expect(kpi.props()).toMatchObject({ value: '-', unavailable: true, unavailableReason: 'Not reported by the feed yet' })
  })

  it('puts the currency first for KES figures', () => {
    payload.value = { kpis: { revenue_24h_kes: 2_500_000 } }
    const cfg = { binding: { source: 'pt.summary', shape: 'scalar', path: 'kpis.revenue_24h_kes', measures: [{ key: 'value', label: 'Revenue', unit: 'kes' }] } }
    const kpi = mount(StatWidget, { props: { instance: instance('stat'), config: cfg }, global: { stubs: { KpiCard: KpiStub } } }).getComponent(KpiStub)
    expect(kpi.props()).toMatchObject({ value: 'KES 2.5M', unit: undefined, status: 'neutral' })
  })

  it('a not-integrated source says so', () => {
    loadState.value = 'not-integrated'
    payload.value = null
    const kpi = mount(StatWidget, { props: { instance: instance('stat'), config: otp }, global: { stubs: { KpiCard: KpiStub } } }).getComponent(KpiStub)
    expect(kpi.props('unavailableReason')).toMatch(/Not yet integrated/)
    loadState.value = 'ready'
  })
})

describe('BreakdownWidget', () => {
  it('a click emits the binding filter field with the raw category', async () => {
    payload.value = { network: { by_agency: [{ agency_code: 'KeNHA', total_length_km: 22000 }, { agency_code: 'KURA', total_length_km: 9000 }] } }
    const w = mount(BreakdownWidget, { props: { instance: instance('breakdown'), config: presetConfig('infra.by_agency') } })
    await w.findAll('button.vb-label')[1]!.trigger('click')
    expect(emitSpy).toHaveBeenLastCalledWith('agency', 'KURA')
    await w.findAll('button.vb-label')[1]!.trigger('click')
    expect(emitSpy).toHaveBeenLastCalledWith('agency', null) // second click clears
  })

  it('a payload of the wrong shape is an error state, not a blank chart', () => {
    payload.value = { network: { by_agency: 'oops' } }
    const w = mount(BreakdownWidget, { props: { instance: instance('breakdown'), config: presetConfig('infra.by_agency') }, global: { stubs: { WidgetState: { props: ['state', 'detail'], template: '<p class="ws-stub">{{ state }}: {{ detail }}</p>' } } } })
    expect(w.get('.ws-stub').text()).toMatch(/^error: Expected a list/)
  })

  it('a successful but empty list is the empty state', () => {
    payload.value = { network: { by_agency: [] } }
    const w = mount(BreakdownWidget, { props: { instance: instance('breakdown'), config: presetConfig('infra.by_agency') }, global: { stubs: { WidgetState: { props: ['state'], template: '<p class="ws-stub">{{ state }}</p>' } } } })
    expect(w.get('.ws-stub').text()).toBe('empty')
  })
})

describe('SeriesWidget / TableWidget', () => {
  it('draws a preset series in the configured mode', () => {
    payload.value = { revenue_24h: [{ hour: '2026-09-30T05:00:00Z', total_kes: 120000 }, { hour: '2026-09-30T06:00:00Z', total_kes: 90000 }] }
    const w = mount(SeriesWidget, { props: { instance: instance('series'), config: presetConfig('pt.revenue_24h') }, global: { stubs: { Sparkline: true } } })
    expect(w.findAll('.vsr-bar').filter(b => b.attributes('d'))).toHaveLength(2)
  })

  it('a table preset shows its declared columns only', () => {
    payload.value = { ports: [{ port_name: 'Mombasa', teu_throughput_30d: 120000, currently_in_port: 14, avg_yard_dwell_days: 4.2, port_unlocode: 'KEMBA' }] }
    const w = mount(TableWidget, { props: { instance: instance('table'), config: presetConfig('maritime.ports') } })
    expect(w.findAll('th').map(t => t.text())).toEqual(['Port', 'Throughput', 'In port', 'Yard dwell'])
    expect(w.findAll('td').map(t => t.text())).toEqual(['Mombasa', '120,000 TEU', '14', '4.2 days'])
  })
})
