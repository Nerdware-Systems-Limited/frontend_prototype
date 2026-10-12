// tests/unit/widget-inspector.test.ts
// ─────────────────────────────────────────────────────────────────────
// Inspector v2: Data / Actions / Style tabs, options rendered from the
// widget definition, the binding picker driven by the live payload (with a
// Frame preview), and the JSON view. Every edit is one whole new widget.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { inject, provide, ref, shallowRef, watch } from 'vue'
import type { WidgetInstance } from '~/types/dashboard'

beforeAll(() => {
  Object.assign(globalThis as any, { watch, shallowRef, inject, provide })
})

/** Payload per source id, as the picker would receive it. */
const payloads = shallowRef<Record<string, unknown>>({})
vi.mock('~/composables/useWidgetData', async () => {
  const { computed, ref: r } = await import('vue')
  return {
    useWidgetData: (id: () => string | null) => ({
      data: computed(() => (id() ? payloads.value[id()!] ?? null : null)),
      state: computed(() => (id() && payloads.value[id()!] != null ? 'ready' : 'loading')),
      failure: r(null), error: r(null), reload: vi.fn(),
    }),
  }
})
vi.mock('~/composables/useDashboardFilters', () => ({ useWidgetFilters: () => ({ context: ref({}) }) }))

/** /query/datasets/ and /query/saved/ as the backend returns them (savedRun must never be called). */
const savedRun = vi.fn()
const DATASETS = {
  incidents: {
    label: 'Safety Incidents', module: 'M05', joinable_on: 'road_segment', examples: [], default_sort: { field: 'reported_at', direction: 'desc' },
    fields: [
      { name: 'id', type: 'uuid' }, { name: 'title', type: 'string' }, { name: 'severity', type: 'enum', values: ['minor', 'serious', 'fatal'] },
      { name: 'reported_at', type: 'datetime' }, { name: 'vehicles_involved', type: 'number' },
    ],
  },
}
vi.mock('~/composables/api', async orig => ({
  ...(await orig<Record<string, unknown>>()),
  useQuery: () => ({
    datasets: async () => DATASETS,
    savedList: async () => ({ results: [{ id: 'sq1', name: 'Fatal last week', query_type: 'single', definition: { dataset: 'incidents', filters: [{ field: 'severity', op: 'eq', value: 'fatal' }], limit: 100 } }] }),
    savedRun,
  }),
}))

import WidgetInspector from '~/components/dashboard/editor/WidgetInspector.vue'
import { resolveCatalogItem } from '~/utils/widgetRegistry'

enableAutoUnmount(afterEach)

const TRAFFIC = {
  kpis: { total_volume_24h: 18234 },
  volume_24h: [
    { hour: '2026-10-05T05:00:00Z', volume: 812, avg_speed: 54 },
    { hour: '2026-10-05T06:00:00Z', volume: 1204, avg_speed: 48 },
  ],
  class_breakdown: [{ vehicle_class: 'psv', total: 420 }, { vehicle_class: 'goods', total: 310 }],
}
const place = (item: string, id = 'w1'): WidgetInstance => {
  const r = resolveCatalogItem(item)!
  return { id, type: r.type, x: 0, y: 0, w: r.size.w, h: r.size.h, config: r.config, title: r.title }
}
const lastChange = (w: ReturnType<typeof mount>) => (w.emitted('change')!.at(-1)![0] as WidgetInstance)

describe('Data tab', () => {
  it('renders the widget options from its definition and patches config', async () => {
    const w = mount(WidgetInspector, { props: { widget: place('risk-map') } })
    const toggle = w.find('input[type=checkbox]')
    expect(w.text()).toContain('Show road network')
    await toggle.setValue(false)
    expect(lastChange(w).config).toMatchObject({ showRoads: false, hotspotLimit: 30 })
    await w.find('input[type=number]').setValue('80')
    expect(lastChange(w).config).toMatchObject({ hotspotLimit: 80 })
  })

  it('clearing a text option removes the key instead of storing an empty string', async () => {
    const kpi = place('kpi')
    const w = mount(WidgetInspector, { props: { widget: { ...kpi, config: { ...kpi.config, label: 'Old' } } } })
    const label = w.findAll('input[type=text]').find(i => i.attributes('placeholder') === 'Defaults to the metric name')!
    await label.setValue('')
    expect(lastChange(w).config).not.toHaveProperty('label')
  })

  it('shows the problems with the widget above the tabs', () => {
    const w = mount(WidgetInspector, { props: { widget: { id: 'w1', type: 'table', x: 0, y: 0, w: 6, h: 4 } } })
    expect(w.get('.insp-issues').text()).toContain('No data selected')
  })
})

describe('Binding picker', () => {
  it('lists what the source returned and previews the Frame', async () => {
    payloads.value = { 'traffic.summary': TRAFFIC }
    const w = mount(WidgetInspector, { props: { widget: place('preset:traffic.volume_24h') } })
    await flushPromises()
    const data = w.findAll('select').find(s => s.findAll('option').some(o => o.text().startsWith('Volume 24h')))!
    expect(data.findAll('option').map(o => o.text())).toEqual([
      'Kpis · 1 category', 'Kpis › Total volume 24h · figure', 'Volume 24h · 2 rows', 'Class breakdown · 2 rows',
    ])
    expect(w.findAll('.be-table th').map(t => t.text())).toEqual(['Hour', 'Vehicles'])
    expect(w.findAll('.be-table td.num').map(t => t.text())).toEqual(['812', '1,204'])
    expect(w.get('.be-meta').text()).toBe('2 of 2 rows · live')
  })

  it('only offers visuals the data can feed, and switching keeps the measures', async () => {
    payloads.value = { 'traffic.summary': TRAFFIC }
    const w = mount(WidgetInspector, { props: { widget: place('preset:traffic.volume_24h') } })
    await flushPromises()
    const visual = (label: string) => w.findAll('.be-visual').find(b => b.text() === label)!
    expect(visual('Stat').attributes('disabled')).toBeDefined()
    expect(visual('Bars').attributes('aria-checked')).toBe('true')

    await visual('Line').trigger('click')
    expect(lastChange(w)).toMatchObject({ type: 'series', config: { mode: 'line' } })

    await visual('Table').trigger('click')
    const t = lastChange(w)
    expect(t.type).toBe('table')
    expect(t.config!.binding).toMatchObject({ shape: 'rows', columns: [{ key: 'hour', label: 'Hour' }], measures: [{ key: 'volume', label: 'Vehicles', unit: 'count' }] })
  })

  it('picking a figure turns the widget into a stat', async () => {
    payloads.value = { 'traffic.summary': TRAFFIC }
    const w = mount(WidgetInspector, { props: { widget: place('preset:traffic.volume_24h') } })
    await flushPromises()
    const data = w.findAll('select').find(s => s.findAll('option').some(o => o.text().startsWith('Volume 24h')))!
    await data.setValue('kpis.total_volume_24h')
    expect(lastChange(w)).toMatchObject({
      type: 'stat',
      config: { binding: { source: 'traffic.summary', shape: 'scalar', path: 'kpis.total_volume_24h', measures: [{ key: 'value', label: 'Total volume 24h', unit: 'count' }] } },
    })
  })

  it('a new source is applied once its payload arrives, keeping the visual when it can', async () => {
    payloads.value = { 'traffic.summary': TRAFFIC }
    const w = mount(WidgetInspector, { props: { widget: place('preset:traffic.class_breakdown') } })
    await flushPromises()
    await w.findAll('select')[0]!.setValue('fleet.summary')
    expect(w.emitted('change')).toBeUndefined() // nothing to apply yet
    payloads.value = { ...payloads.value, 'fleet.summary': { vehicles_by_type: [{ vehicle_type: 'bus', total: 9 }] } }
    await flushPromises()
    expect(lastChange(w)).toMatchObject({
      type: 'breakdown',
      config: { binding: { source: 'fleet.summary', shape: 'categorical', path: 'vehicles_by_type', dimension: { key: 'vehicle_type' }, measures: [{ key: 'total' }] } },
    })
  })

  it('makes a breakdown clickable', async () => {
    payloads.value = { 'traffic.summary': TRAFFIC }
    const w = mount(WidgetInspector, { props: { widget: place('preset:traffic.class_breakdown') } })
    await flushPromises()
    const clicks = w.findAll('select').find(s => s.findAll('option').some(o => o.text() === 'Not clickable'))!
    await clicks.setValue('')
    expect(lastChange(w).config!.binding).not.toHaveProperty('emits')
  })
})

describe('Actions tab', () => {
  const widget = place('preset:infra.by_agency')
  const actions = [{ id: 'a1', name: 'x', type: 'filter' as const, sourceWidgetId: 'w1', field: 'agency' as const, targetWidgetIds: 'all' as const, onClear: 'show-all' as const }]
  const filters = [
    { id: 'f1', field: 'agency' as const, label: 'Agency', control: 'select' as const, appliesTo: 'all' as const },
    { id: 'f2', field: 'county' as const, label: 'County', control: 'select' as const, appliesTo: 'all' as const },
  ]

  it('describes what a click does and which filters reach it', async () => {
    const w = mount(WidgetInspector, { props: { widget, actions, filters } })
    await w.findAll('[role=tab]')[1]!.trigger('click')
    expect(w.text()).toContain('A click selects a value for agency')
    expect(w.text()).toContain('Filters every compatible widget by agency')
    expect(w.findAll('.insp-rows').at(-1)!.findAll('li').map(l => l.get('.insp-tag').text())).toEqual(['applies', "can't honour"])
    await w.findAll('button').find(b => b.text() === 'Add click action')!.trigger('click')
    expect(w.emitted('add-action')).toEqual([['w1']])
  })
})

describe('JSON view', () => {
  it('applies valid JSON and reports invalid JSON without emitting', async () => {
    const w = mount(WidgetInspector, { props: { widget: place('text') } })
    await w.get('.insp-json-btn').trigger('click')
    const ta = w.get('textarea')
    await ta.setValue('{ nope')
    await w.findAll('button').find(b => b.text() === 'Apply')!.trigger('click')
    expect(w.get('.wj-problem').text()).toMatch(/Not valid JSON/)
    expect(w.emitted('change')).toBeUndefined()

    await ta.setValue(JSON.stringify({ type: 'text', x: 0, y: 2, w: 6, h: 1, config: { text: 'Hello', variant: 'heading' } }))
    await w.findAll('button').find(b => b.text() === 'Apply')!.trigger('click')
    expect(lastChange(w)).toEqual({ id: 'w1', type: 'text', x: 0, y: 2, w: 6, h: 1, config: { text: 'Hello', variant: 'heading' } })
  })
})

describe('Query sources', () => {
  const incidentsBreakdown = () => place('preset:query.incidents_by_severity')

  it('lists the dataset fields from the catalog even when no records came back', async () => {
    payloads.value = { 'query.incidents': { total: 0, count: 0, rows: [], limit: 500, offset: 0 } }
    const w = mount(WidgetInspector, { props: { widget: incidentsBreakdown() } })
    await flushPromises()
    const data = w.findAll('select').find(s => s.findAll('option').some(o => o.text().startsWith('Records')))!
    expect(data.findAll('option').map(o => o.text())).toEqual(['Records · 0 fetched', 'Total matching records · figure'])
    const by = w.findAll('select').find(s => s.findAll('option').some(o => o.text() === 'Severity'))!
    expect(by.exists()).toBe(true)
    expect(w.text()).toContain('Dashboard filters on Date range, Severity, Road also apply')
  })

  it('adding a query filter changes the binding params (and so the request)', async () => {
    payloads.value = { 'query.incidents': { total: 0, count: 0, rows: [], limit: 500, offset: 0 } }
    const w = mount(WidgetInspector, { props: { widget: incidentsBreakdown() } })
    await flushPromises()
    await w.findAll('button').find(b => b.text() === 'Add filter')!.trigger('click')
    expect(lastChange(w).config!.binding).toMatchObject({ params: { fields: ['severity'], filters: [{ field: 'severity', op: 'eq', value: 'minor' }] } })
  })

  it('switches the measure from a count to a sum and relabels it', async () => {
    payloads.value = { 'query.incidents': { total: 2, count: 2, rows: [{ severity: 'fatal', vehicles_involved: 2 }, { severity: 'fatal', vehicles_involved: 3 }], limit: 500, offset: 0 } }
    const widget = incidentsBreakdown()
    const b = widget.config!.binding as Record<string, unknown>
    const w = mount(WidgetInspector, { props: { widget: { ...widget, config: { ...widget.config, binding: { ...b, params: {} } } } } })
    await flushPromises()
    const measure = w.findAll('select').find(s => s.attributes('aria-label') === 'Measure')!
    await measure.setValue('sum:vehicles_involved')
    expect(lastChange(w).config!.binding).toMatchObject({
      aggregate: { by: 'severity', fn: 'sum', measure: 'vehicles_involved' }, measures: [{ key: 'value', label: 'Sum of vehicles involved', unit: 'count' }],
    })
  })

  it('says when the preview covers only part of the matching records', async () => {
    payloads.value = { 'query.incidents': { total: 1204, count: 2, rows: [{ severity: 'fatal' }, { severity: 'minor' }], limit: 2, offset: 0 } }
    const w = mount(WidgetInspector, { props: { widget: incidentsBreakdown() } })
    await flushPromises()
    expect(w.text()).toContain('From the first 2 of 1,204 matching records')
  })

  it('a saved query is copied into the binding, never run (running distributes it)', async () => {
    payloads.value = { 'query.incidents': { total: 0, count: 0, rows: [], limit: 500, offset: 0 } }
    const w = mount(WidgetInspector, { props: { widget: incidentsBreakdown() } })
    await flushPromises()
    const pick = w.findAll('select').find(s => s.findAll('option').some(o => o.text() === 'Fatal last week'))!
    await pick.setValue('sq1')
    expect(lastChange(w).config!.binding).toMatchObject({ params: { filters: [{ field: 'severity', op: 'eq', value: 'fatal' }], limit: 100 } })
    expect(savedRun).not.toHaveBeenCalled()
  })
})
