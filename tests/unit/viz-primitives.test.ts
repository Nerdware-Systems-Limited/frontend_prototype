// tests/unit/viz-primitives.test.ts
// ─────────────────────────────────────────────────────────────────────
// The visual primitives pick their form for the cell, keep every value
// reachable without hovering (table view, live readout), and route clicks
// through the dashboard action engine - never picking the "Other" bucket.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import type { Frame } from '~/types/frame'
import { OTHER } from '~/utils/bindings'

vi.mock('@vueuse/core', () => ({ useElementSize: () => ({ width: ref(480), height: ref(200) }) }))

import VizSeries from '~/components/dashboard/viz/VizSeries.vue'
import VizBreakdown from '~/components/dashboard/viz/VizBreakdown.vue'
import VizTable from '~/components/dashboard/viz/VizTable.vue'

enableAutoUnmount(afterEach)
const stubs = { Sparkline: { props: ['points'], template: '<i class="spark-stub" :data-n="points.length" />' } }

const series: Frame = {
  fields: [
    { key: 'hour', label: 'Hour', kind: 'time' },
    { key: 'volume', label: 'Vehicles', kind: 'measure', unit: 'count' },
    { key: 'speed', label: 'Speed', kind: 'measure', unit: 'kmh' },
  ],
  rows: [
    { hour: '2026-09-30T01:00:00Z', volume: 100, speed: 60 },
    { hour: '2026-09-30T02:00:00Z', volume: 1200, speed: 55 },
    { hour: '2026-09-30T03:00:00Z', volume: null, speed: 50 },
  ],
  meta: { total: 3 },
}

const breakdown: Frame = {
  fields: [{ key: 'label', label: 'Class', kind: 'category' }, { key: 'total', label: 'Vehicles', kind: 'measure', unit: 'count' }],
  rows: [
    { category: 'car', label: 'Car', total: 60 },
    { category: 'bus', label: 'Bus', total: 30 },
    { category: OTHER, label: 'Other (2)', total: 10 },
  ],
  meta: { total: 4, folded: 2 },
}

describe('VizSeries', () => {
  it('xs shows the latest reading and a sparkline, no plot', () => {
    const w = mount(VizSeries, { props: { frame: series, size: 'xs' }, global: { stubs } })
    expect(w.find('.vsr-svg').exists()).toBe(false)
    expect(w.get('.vsr-head-val').text()).toBe('1,200') // the last non-null volume
    expect(w.get('.spark-stub').attributes('data-n')).toBe('2')
  })

  it('draws only same-unit measures - one axis, the rest live in the table', () => {
    const w = mount(VizSeries, { props: { frame: series, size: 'm' }, global: { stubs } })
    expect(w.findAll('.vsr-line')).toHaveLength(1)
    expect(w.findAll('.vsr-tick').length).toBeGreaterThan(2)
    // the hidden table still carries the speed column
    expect(w.get('.vs-sr').text()).toContain('Speed')
  })

  it('arrow keys move the crosshair and announce every measure', async () => {
    const w = mount(VizSeries, { props: { frame: series, size: 'm' }, global: { stubs } })
    const stage = w.get('.vsr-stage')
    await stage.trigger('keydown', { key: 'End' })
    await stage.trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    expect(w.get('.vsr-sr').text()).toMatch(/Vehicles 1,200, Speed 55 km\/h$/)
    expect(w.find('.vsr-cross').exists()).toBe(true)
    await stage.trigger('keydown', { key: 'Escape' })
    expect(w.find('.vsr-cross').exists()).toBe(false)
  })

  it('bars mode draws one rounded bar per present value and Enter picks the x', async () => {
    const w = mount(VizSeries, { props: { frame: series, size: 'm', mode: 'bars', selectable: true }, global: { stubs } })
    expect(w.findAll('.vsr-bar').filter(b => b.attributes('d'))).toHaveLength(2) // null hour draws nothing
    const stage = w.get('.vsr-stage')
    await stage.trigger('keydown', { key: 'Home' })
    await stage.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('pick')).toEqual([['2026-09-30T01:00:00Z']])
  })

  it('the table toggle swaps the chart for a table of every value', async () => {
    const w = mount(VizSeries, { props: { frame: series, size: 'm' }, global: { stubs } })
    await w.get('.vs-toggle').trigger('click')
    expect(w.find('.vsr-svg').exists()).toBe(false)
    expect(w.findAll('tbody tr')).toHaveLength(3)
    expect(w.get('.vs-toggle').attributes('aria-pressed')).toBe('true')
  })
})

describe('VizBreakdown', () => {
  it('xs shows the top category and its share', () => {
    const w = mount(VizBreakdown, { props: { frame: breakdown, size: 'xs' } })
    expect(w.get('.vb-head-val').text()).toBe('60')
    expect(w.get('.vb-head-lbl').text()).toBe('Car · 60%')
    expect(w.get('.vb-head-of').text()).toBe('of 4 categories')
  })

  it('s shows the top bars only; l adds shares', () => {
    const big: Frame = { ...breakdown, rows: Array.from({ length: 6 }, (_, i) => ({ category: `c${i}`, label: `C${i}`, total: 10 - i })) }
    expect(mount(VizBreakdown, { props: { frame: big, size: 's' } }).findAll('.vb-row')).toHaveLength(4)
    const l = mount(VizBreakdown, { props: { frame: breakdown, size: 'l' } })
    expect(l.findAll('.vb-share').map(s => s.text())).toEqual(['60%', '30%', '10%'])
  })

  it('clicks emit the raw category; Other is never pickable', async () => {
    const w = mount(VizBreakdown, { props: { frame: breakdown, size: 'm', selectable: true } })
    const labels = w.findAll('.vb-label')
    expect(labels[0]!.element.tagName).toBe('BUTTON')
    expect(labels[2]!.element.tagName).toBe('SPAN')
    await labels[1]!.trigger('click')
    expect(w.emitted('pick')).toEqual([['bus']])
  })

  it('dims categories outside a highlight', () => {
    const w = mount(VizBreakdown, { props: { frame: breakdown, size: 'm', isDimmed: (k: string) => k !== 'car' } })
    expect(w.findAll('.vb-row').map(r => r.classes().includes('is-dim'))).toEqual([false, true, true])
  })
})

describe('VizTable', () => {
  const rows: Frame = {
    fields: [{ key: 'name', label: 'Port', kind: 'text' }, { key: 'teu', label: 'Throughput', kind: 'measure', unit: 'teu' }],
    rows: [{ name: 'Lamu', teu: 900 }, { name: 'Mombasa', teu: 120000 }, { name: 'Kisumu', teu: null }],
    meta: { total: 3 },
  }

  it('xs is a count, s a top-3 list', () => {
    expect(mount(VizTable, { props: { frame: rows, size: 'xs' } }).text()).toMatch(/^3\s*rows$/)
    expect(mount(VizTable, { props: { frame: rows, size: 's' } }).findAll('.vt-list-row')).toHaveLength(3)
  })

  it('sorts by a column header, missing values last, with aria-sort', async () => {
    const w = mount(VizTable, { props: { frame: rows, size: 'm' } })
    await w.findAll('.vt-sort')[1]!.trigger('click')
    expect(w.findAll('tbody tr').map(r => r.findAll('td')[1]!.text())).toEqual(['120,000 TEU', '900 TEU', '-'])
    expect(w.findAll('th')[1]!.attributes('aria-sort')).toBe('descending')
  })

  it('shows the first rows and a "Show all" control for long frames', async () => {
    const long: Frame = { ...rows, rows: Array.from({ length: 12 }, (_, i) => ({ name: `P${i}`, teu: i })) }
    const w = mount(VizTable, { props: { frame: long, size: 'm', maxRows: 5 } })
    expect(w.findAll('tbody tr')).toHaveLength(5)
    await w.get('.vt-all').trigger('click')
    expect(w.findAll('tbody tr')).toHaveLength(12)
  })

  it('the hidden copy has no focusable controls', () => {
    const w = mount(VizTable, { props: { frame: rows, size: 'm', interactive: false, maxRows: 1 } })
    expect(w.findAll('button').length).toBe(1) // only "Show all" - and the shell passes maxRows 1000 so it never shows
    const w2 = mount(VizTable, { props: { frame: rows, size: 'm', interactive: false, maxRows: 1000 } })
    expect(w2.findAll('button')).toHaveLength(0)
  })
})
