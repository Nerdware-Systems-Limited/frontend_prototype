// tests/unit/time-range-selector.test.ts
// One compact control: a pill when closed, the three ranges (and Year) when open.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import TimeRangeSelector from '~/components/TimeRangeSelector.vue'
import { useTimeRange } from '~/composables/useTimeRange'
import { currentYear } from '~/utils/timeRange'

const store = new Map<string, any>()
beforeEach(() => {
  store.clear()
  ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
})
const stubs = { Clock: true, ChevronDown: true, ChevronUp: true, ChevronLeft: true, ChevronRight: true }

describe('TimeRangeSelector', () => {
  it('is a single pill naming the current range until opened', () => {
    const range = useTimeRange('a', { default: '7d' })
    const w = mount(TimeRangeSelector, { props: { range }, global: { stubs } })
    expect(w.find('.trs-pill').text()).toContain('7 Days')
    expect(w.find('.segmented').exists()).toBe(false)
  })
  it('opens into the three ranges with the current one highlighted', async () => {
    const range = useTimeRange('b', { default: '30d' })
    const w = mount(TimeRangeSelector, { props: { range }, global: { stubs } })
    await w.find('.trs-pill').trigger('click')
    const buttons = w.findAll('.segmented button')
    expect(buttons.map(b => b.text())).toEqual(['24 Hours', '7 Days', '30 Days'])
    expect(buttons[2]!.classes()).toContain('active')
    expect(buttons[2]!.attributes('aria-pressed')).toBe('true')
  })
  it('choosing a range updates the shared state, announces the change and folds away', async () => {
    const range = useTimeRange('c', { default: '7d' })
    const w = mount(TimeRangeSelector, { props: { range, defaultOpen: true }, global: { stubs } })
    await w.findAll('.segmented button')[0]!.trigger('click')
    expect(range.days.value).toBe(1)
    expect(w.emitted('change')).toHaveLength(1)
    expect(w.find('.trs-pill').text()).toContain('24 Hours')
  })
  it('choosing the range already selected changes nothing', async () => {
    const range = useTimeRange('d', { default: '7d' })
    const w = mount(TimeRangeSelector, { props: { range, defaultOpen: true }, global: { stubs } })
    await w.findAll('.segmented button')[1]!.trigger('click')
    expect(w.emitted('change')).toBeUndefined()
  })
  it('offers no Year view when the page data cannot answer a past year', () => {
    const w = mount(TimeRangeSelector, { props: { range: useTimeRange('e'), defaultOpen: true }, global: { stubs } })
    expect(w.findAll('.segmented button').map(b => b.text())).not.toContain('Year')
  })
  it('Year view steps between years, stays open, and stops at the limits', async () => {
    const range = useTimeRange('f', { default: '7d', years: true })
    const w = mount(TimeRangeSelector, { props: { range, defaultOpen: true }, global: { stubs } })
    await w.findAll('.segmented button').find(b => b.text() === 'Year')!.trigger('click')
    expect(range.isYear.value).toBe(true)
    expect(w.find('.trs-year').text()).toBe(String(currentYear()))
    const [prev, next] = w.findAll('.trs-step')
    expect(next!.attributes('disabled')).toBeDefined() // cannot go past this year
    await prev!.trigger('click')
    expect(range.year.value).toBe(currentYear() - 1)
    expect(w.find('.trs-year').text()).toBe(String(currentYear() - 1))
    expect(w.find('.trs-years').exists()).toBe(true) // still open
    expect(w.emitted('change')).toHaveLength(2)
  })
  it('Escape folds the control', async () => {
    const w = mount(TimeRangeSelector, { props: { range: useTimeRange('g'), defaultOpen: true }, global: { stubs }, attachTo: document.body })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('.trs-pill').exists()).toBe(true)
    w.unmount()
  })
})
