// tests/unit/dashboard-widgets.test.ts
// ─────────────────────────────────────────────────────────────────────
// Dashboard Manager widget fixes (docs/Widgets.md, phase 0):
//   - framing is a registry property, not a duplicated kind list
//   - the catalog only claims filters and clicks the widgets really honour
//   - figures format en-KE whatever the browser locale
//   - the fatality bar chart keeps button semantics, has one tab stop,
//     and names each band in words, not colour alone
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref, shallowRef, watch } from 'vue'

beforeAll(() => {
  ;(globalThis as any).watch = watch
  ;(globalThis as any).shallowRef = shallowRef
})

const trend = Array.from({ length: 10 }, (_, i) => ({ day: `2026-09-${String(i + 1).padStart(2, '0')}`, fatalities: i }))
const emitSpy = vi.fn()

vi.mock('~/composables/useDomainData', () => ({
  useDomainData: () => ({ data: ref({ fatality_trend_30d: trend }), error: ref(null), state: ref('ready'), loading: ref(false), reload: () => {} }),
}))
vi.mock('~/composables/useDashboardFilters', () => ({
  useWidgetFilters: () => ({ context: ref({}), highlight: ref(null), emit: emitSpy, ignored: ref([]) }),
}))

import { WIDGETS, WIDGETS_BY_TYPE, isFramed, widgetFilterFields } from '~/utils/widgetRegistry'
import { fmtKsh, fmtNum } from '~/utils/metricRegistry'
import FatalityBarsWidget from '~/components/dashboard/widgets/FatalityBarsWidget.vue'

describe('widget registry', () => {
  it('marks self-carded widgets frameless and frames everything else', () => {
    const frameless = WIDGETS.filter(w => !isFramed(w.type)).map(w => w.type).sort()
    expect(frameless).toEqual(['agency-card', 'kpi', 'kpi-row', 'national-command-centre', 'stat', 'text'])
    expect(isFramed('fatality-bars')).toBe(true)
    expect(isFramed('not-a-widget')).toBe(true)
  })

  it('KPI widgets claim only the filters their metrics honour', () => {
    expect(WIDGETS_BY_TYPE.kpi!.filterFields).toEqual([])
    expect(widgetFilterFields('kpi', { metricKey: 'safety.active_incidents' })).toEqual([])
    expect(widgetFilterFields('kpi', { metricKey: 'infra.good_condition' })).toEqual(['agency'])
    expect(widgetFilterFields('kpi-row', { metricKeys: ['safety.active_incidents', 'infra.critical_bridges'] })).toEqual(['agency'])
  })

  it('the risk map only emits what it really emits', () => {
    expect(WIDGETS_BY_TYPE['risk-map']!.emits).toEqual(['road'])
  })

  it('the trend widget no longer promises an incident series the API lacks', () => {
    expect(WIDGETS_BY_TYPE['incident-trend']!.title).not.toMatch(/incidents vs/i)
  })
})

describe('formatters', () => {
  it('format en-KE and keep the honest dash', () => {
    expect(fmtNum(1234567)).toBe((1234567).toLocaleString('en-KE'))
    expect(fmtNum(null)).toBe('-')
    expect(fmtKsh(950)).toBe('950')
    expect(fmtKsh(2_500_000_000)).toBe('2.5B')
  })
})

describe('FatalityBarsWidget accessibility', () => {
  const mountBars = () => mount(FatalityBarsWidget, {
    props: { instance: { id: 'b1', type: 'fatality-bars', x: 0, y: 0, w: 6, h: 3 }, config: {} },
    global: { stubs: { EmptyState: true } },
    attachTo: document.body,
  })

  it('keeps real buttons with one tab stop on the latest day', () => {
    const w = mountBars()
    const bars = w.findAll('button.bar')
    expect(bars).toHaveLength(10)
    for (const b of bars) expect(b.attributes('role')).toBeUndefined()
    expect(bars.filter(b => b.attributes('tabindex') === '0')).toHaveLength(1)
    expect(bars[9]!.attributes('tabindex')).toBe('0')
    w.unmount()
  })

  it('names the severity band in each label', () => {
    const w = mountBars()
    const bars = w.findAll('button.bar')
    expect(bars[0]!.attributes('aria-label')).toContain('low')
    expect(bars[4]!.attributes('aria-label')).toContain('elevated')
    expect(bars[9]!.attributes('aria-label')).toContain('high')
    w.unmount()
  })

  it('arrow keys rove focus and Enter-click emits the day', async () => {
    const w = mountBars()
    const group = w.get('.bars')
    await group.trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    const bars = w.findAll('button.bar')
    expect(bars[8]!.attributes('tabindex')).toBe('0')
    expect(document.activeElement).toBe(bars[8]!.element)
    await group.trigger('keydown', { key: 'Home' })
    expect(w.findAll('button.bar')[0]!.attributes('tabindex')).toBe('0')

    await bars[8]!.trigger('click')
    expect(emitSpy).toHaveBeenLastCalledWith('date_range', { from: '2026-09-09', to: '2026-09-09' })
    expect(w.findAll('button.bar')[8]!.attributes('aria-pressed')).toBe('true')
    w.unmount()
  })
})
