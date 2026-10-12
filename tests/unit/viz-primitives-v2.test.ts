// tests/unit/viz-primitives-v2.test.ts
// ─────────────────────────────────────────────────────────────────────
// Phase 6 primitives: Points (map), StatusList, Progress, Heatmap.
// Honest by construction: rows without coordinates are counted, not
// dropped; status comes from a rule (never from position); a target is
// never invented; a quiet hour on a heatmap is a real 0 for counts and
// empty (not 0) for averages.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import type { Binding, Frame } from '~/types/frame'
import { applyBinding, statusWord } from '~/utils/bindings'
import { bindingFor, geoFields, rowFields, shapesFor, type PathInfo } from '~/utils/bindingDesign'
import { widgetIssues } from '~/utils/widgetValidation'
import { resolveCatalogItem, widgetEmits, widgetPermissions } from '~/utils/widgetRegistry'
import VizStatusList from '~/components/dashboard/viz/VizStatusList.vue'
import VizProgress from '~/components/dashboard/viz/VizProgress.vue'
import VizHeatmap from '~/components/dashboard/viz/VizHeatmap.vue'
import VizPoints from '~/components/dashboard/viz/VizPoints.vue'

enableAutoUnmount(afterEach)
const NuxtLinkStub = { name: 'NuxtLink', props: ['to'], template: '<a class="link-stub" :href="to"><slot /></a>' }

// ── Points ───────────────────────────────────────────────────────────────

const spots = [
  { road: 'A8', name: 'Kikuyu bypass', lat: -1.24, lon: 36.66, tier: 'critical', crashes: 14 },
  { road: 'A104', name: 'Waiyaki Way', lat: '-1.26', lon: '36.78', tier: 'high', crashes: 9 },
  { road: 'B3', name: 'No fix', lat: null, lon: 36.1, tier: 'low', crashes: 2 },
  { road: 'C12', name: 'Null island', lat: 0, lon: 0, tier: 'low', crashes: 1 },
]
const pointsBinding: Binding = {
  source: 'safety.top-blackspots', shape: 'points', path: '', geo: { lat: 'lat', lon: 'lon', key: 'road', tier: 'tier' },
  dimension: { key: 'name', label: 'Road' }, measures: [{ key: 'crashes', label: 'Accidents', unit: 'count' }], emits: 'road',
}

describe('points', () => {
  it('places rows with usable coordinates and counts the rest (0,0 is a missing fix, not a place)', () => {
    const f = applyBinding(spots, pointsBinding)
    expect(f.rows).toEqual([
      { key: 'A8', label: 'Kikuyu bypass', tier: 'critical', lat: -1.24, lon: 36.66, crashes: 14 },
      { key: 'A104', label: 'Waiyaki Way', tier: 'high', lat: -1.26, lon: 36.78, crashes: 9 },
    ])
    expect(f.meta).toEqual({ total: 2, unplaced: 2 })
  })

  it('a path with a latitude / longitude pair can be a map, and the picker finds the pair', () => {
    const info: PathInfo = { path: '', kind: 'rows', count: 4, fields: rowFields(spots) }
    expect(geoFields(info.fields)).toEqual({ lat: 'lat', lon: 'lon' })
    expect(shapesFor(info)).toContain('points')
    expect(bindingFor('x', info, 'points').geo).toEqual({ lat: 'lat', lon: 'lon', tier: 'tier' })
  })

  it('the xs form counts places by tier; the map form notes rows left off', () => {
    const f = applyBinding(spots, pointsBinding)
    const xs = mount(VizPoints, { props: { frame: f, size: 'xs' } })
    expect(`${xs.get('.vp-head-n').text()} ${xs.get('.vp-head-lbl').text()}`).toBe('2 places')
    expect(xs.findAll('.vp-tiers li').map(l => l.text())).toEqual(['Critical 1', 'High 1'])
    const m = mount(VizPoints, { props: { frame: f, size: 'm' }, global: { stubs: { ClientOnly: { template: '<div><slot /></div>' }, UaptsMap: { template: '<div class="map-stub" />' } } } })
    expect(m.find('.map-stub').exists()).toBe(true)
    expect(m.text()).toContain('2 without a location')
  })

  it('a map preset carries its source permission and its click field', () => {
    const r = resolveCatalogItem('preset:safety.hotspots_map')!
    expect(r.type).toBe('points')
    expect(widgetPermissions(r.type, r.config)).toEqual(['safety.view'])
    expect(widgetEmits(r.type, r.config)).toEqual(['road'])
  })
})

// ── Status list ──────────────────────────────────────────────────────────

const feeds = [
  { agency: 'KPA', name: 'Port ops', status: 'connected', lag: 2 },
  { agency: 'NTSA', name: 'iTIMS', status: 'disconnected', lag: 90 },
  { agency: 'KRC', name: 'Rail ops', status: 'degraded', lag: 30 },
  { agency: 'KAA', name: 'Flights', status: 'paused', lag: 5 },
  { agency: 'KMA', name: 'Vessels', status: 'mystery', lag: 1 },
]
const statusBinding: Binding = {
  source: 'integrations.feeds', shape: 'status', path: '', dimension: { key: 'agency', label: 'Agency' },
  status: { field: 'status' }, columns: [{ key: 'name', label: 'Feed' }], measures: [{ key: 'lag', label: 'Lag', unit: 'min' }],
}

describe('status list', () => {
  it('reads common status words, ranks worst first, then by measure', () => {
    expect(['offline', 'Degraded', 'resolved', 'active'].map(statusWord)).toEqual(['critical', 'warning', 'healthy', 'neutral'])
    const f = applyBinding(feeds, statusBinding)
    expect(f.rows.map(r => `${r.key}:${r.status}`)).toEqual(['NTSA:critical', 'KRC:warning', 'KAA:warning', 'KMA:neutral', 'KPA:healthy'])
    expect(f.rows[0]).toMatchObject({ label: 'NTSA', detail: 'iTIMS', lag: 90 })
  })

  it("the binding's own map overrides the shared words", () => {
    const f = applyBinding(feeds, { ...statusBinding, status: { field: 'status', map: { paused: 'healthy', mystery: 'critical' } } })
    expect(f.rows.map(r => `${r.key}:${r.status}`)).toEqual(['NTSA:critical', 'KMA:critical', 'KRC:warning', 'KAA:healthy', 'KPA:healthy'])
  })

  it('or a threshold on a measure decides', () => {
    const trains = [{ t: 'SGR-1', d: 4 }, { t: 'SGR-2', d: 25 }, { t: 'MGR-9', d: null }]
    const f = applyBinding(trains, { source: 'rail.summary', shape: 'status', path: '', dimension: { key: 't', label: 'Train' }, threshold: 'rail.avg_delay_min', measures: [{ key: 'd', label: 'Delay', unit: 'min' }] })
    expect(f.rows.map(r => `${r.key}:${r.status}`)).toEqual(['SGR-2:warning', 'MGR-9:neutral', 'SGR-1:healthy'])
  })

  it('xs states counts in words; rows open their route or pick their key', async () => {
    const f = applyBinding(feeds, statusBinding)
    const xs = mount(VizStatusList, { props: { frame: f, size: 'xs' } })
    expect(xs.text()).toBe('1 critical · 2 warning · 1 info · 1 ok')
    const linked = mount(VizStatusList, { props: { frame: f, size: 'm', link: '/integrations?agency={key}' }, global: { stubs: { NuxtLink: NuxtLinkStub } } })
    expect(linked.findAll('.link-stub')[0]!.attributes('href')).toBe('/integrations?agency=NTSA')
    expect(linked.findAll('.vsl-word').map(w => w.text())).toEqual(['Critical', 'Warning', 'Warning', 'Info', 'OK'])
    const pickable = mount(VizStatusList, { props: { frame: f, size: 's', selectable: true } })
    expect(pickable.findAll('button.vsl-item')).toHaveLength(3)
    await pickable.find('button.vsl-item').trigger('click')
    expect(pickable.emitted('pick')).toEqual([['NTSA']])
    expect(pickable.text()).toContain('+ 2 more')
  })
})

// ── Progress ─────────────────────────────────────────────────────────────

const budget = { budget: { utilization_pct: 64, disbursed_kes: 5.2e9, allocated_kes: 8e9 } }

describe('progress', () => {
  it('takes its target from the payload or a fixed number - never a guess', () => {
    const fromFeed = applyBinding(budget, { source: 'infra.summary', shape: 'scalar', path: 'budget.disbursed_kes', target: { path: 'budget.allocated_kes', label: 'Allocated' }, measures: [{ key: 'value', label: 'Disbursed', unit: 'kes' }] })
    expect(fromFeed.rows).toEqual([{ value: 5.2e9, target: 8e9 }])
    expect(fromFeed.fields.map(f => f.label)).toEqual(['Disbursed', 'Allocated'])
    const fixed = applyBinding(budget, { source: 'infra.summary', shape: 'scalar', path: 'budget.utilization_pct', target: { value: 80 }, measures: [{ key: 'value', label: 'Absorbed', unit: 'pct' }] })
    expect(fixed.rows).toEqual([{ value: 64, target: 80 }])
  })

  it('draws value, target tick and share of target', () => {
    const f: Frame = { fields: [{ key: 'value', label: 'Disbursed', kind: 'measure', unit: 'kes' }, { key: 'target', label: 'Allocated', kind: 'measure', unit: 'kes' }], rows: [{ value: 5.2e9, target: 8e9 }], meta: { total: 1 } }
    const w = mount(VizProgress, { props: { frame: f, size: 'm', title: 'Disbursed vs allocated' } })
    expect(w.get('.vpg-share').text()).toBe('65%')
    expect(w.get('.vpg-target').attributes('style')).toContain('left: 90.9')
    expect(w.get('.vpg-foot').text()).toContain('Allocated KES 8.0B')
  })

  it('a percentage without a target draws on 0-100; any other unit says no target', () => {
    const pct: Frame = { fields: [{ key: 'value', label: 'Absorbed', kind: 'measure', unit: 'pct' }], rows: [{ value: 64 }], meta: { total: 1 } }
    expect(mount(VizProgress, { props: { frame: pct, size: 'm' } }).get('.vpg-fill').attributes('style')).toContain('width: 64%')
    const kes: Frame = { fields: [{ key: 'value', label: 'Disbursed', kind: 'measure', unit: 'kes' }], rows: [{ value: 5e9 }], meta: { total: 1 } }
    const w = mount(VizProgress, { props: { frame: kes, size: 'm' } })
    expect(w.find('.vpg-track').exists()).toBe(false)
    expect(w.text()).toContain('No target set')
  })

  it('warns when a non-percentage progress has no target', () => {
    const r = resolveCatalogItem('preset:infra.disbursed_vs_allocated')!
    const b = r.config.binding as Binding
    expect(widgetIssues({ id: 'w', type: 'progress', x: 0, y: 0, w: 3, h: 2, config: { binding: { ...b, target: undefined } } }).map(i => i.message))
      .toEqual(['No target set - the bar needs one unless the figure is a percentage.'])
  })
})

// ── Heatmap ──────────────────────────────────────────────────────────────

describe('heatmap', () => {
  const incidents = [
    { reported_at: '2026-10-05T05:10:00Z' }, // Mon 08:10 EAT
    { reported_at: '2026-10-05T05:50:00Z' }, // Mon 08:50 EAT
    { reported_at: '2026-10-09T15:00:00Z' }, // Fri 18:00 EAT
  ]
  const hourByDay: Binding = {
    source: 'query.incidents', shape: 'matrix', path: 'rows', aggregate: { by: 'reported_at', bucket: 'hourOfDay', by2: 'reported_at', bucket2: 'dayOfWeek', fn: 'count' },
    dimension: { key: 'reported_at', label: 'Hour of day' }, dimension2: { key: 'reported_at', label: 'Day of week' }, measures: [{ key: 'value', label: 'Incidents', unit: 'count' }],
  }

  it('grids hour of day x weekday in EAT, complete, with quiet slots a real 0 for counts', () => {
    const f = applyBinding({ rows: incidents, total: 3, count: 3 }, hourByDay)
    expect(f.rows).toHaveLength(24 * 7)
    const at = (y: string, x: string) => f.rows.find(r => r.yLabel === y && r.xLabel === x)?.value
    expect(at('Mon', '08:00')).toBe(2)
    expect(at('Fri', '18:00')).toBe(1)
    expect(at('Sun', '03:00')).toBe(0)
  })

  it('an average has nothing to show for an empty slot: null, not 0', () => {
    const rows = [{ day: 'Mon', level: 'heavy', speed: 20 }, { day: 'Tue', level: 'free_flow', speed: 70 }]
    const f = applyBinding({ rows }, { source: 'x', shape: 'matrix', path: 'rows', aggregate: { by: 'day', by2: 'level', fn: 'avg', measure: 'speed' },
      dimension: { key: 'day', label: 'Day' }, dimension2: { key: 'level', label: 'Level' }, measures: [{ key: 'value', label: 'Speed', unit: 'kmh' }] })
    expect(f.rows.map(r => `${r.x}/${r.y}=${r.value}`)).toEqual(['Mon/free_flow=null', 'Tue/free_flow=70', 'Mon/heavy=20', 'Tue/heavy=null'])
  })

  it('the picker offers a heatmap for a timestamp and defaults to hour x weekday', () => {
    const info: PathInfo = { path: 'rows', kind: 'rows', count: 3, fields: [{ key: 'reported_at', type: 'time' }] }
    expect(shapesFor(info)).toContain('matrix')
    expect(bindingFor('query.incidents', info, 'matrix', null, { aggregate: true })).toMatchObject({
      aggregate: { by: 'reported_at', bucket: 'hourOfDay', by2: 'reported_at', bucket2: 'dayOfWeek', fn: 'count' },
      dimension: { label: 'Hour of day' }, dimension2: { label: 'Day of week' },
    })
  })

  it('names the busiest cell when small; grids and totals (counts only) when large', () => {
    const f = applyBinding({ rows: incidents }, hourByDay)
    expect(mount(VizHeatmap, { props: { frame: f, size: 's' } }).text()).toContain('Highest: Mon · 08:00')
    const big = mount(VizHeatmap, { props: { frame: f, size: 'l', additive: true } })
    expect(big.findAll('.vh-cell')).toHaveLength(168)
    expect(big.findAll('.vh-yl').map(y => y.text())).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Total'])
    expect(big.findAll('.vh-tot').at(-1)!.text()).toBe('3')
    expect(mount(VizHeatmap, { props: { frame: f, size: 'l', additive: false } }).find('.vh-tot').exists()).toBe(false)
  })
})

describe('guardrails for the new visuals', () => {
  const place = (item: string) => { const r = resolveCatalogItem(item)!; return { id: 'w', type: r.type, x: 0, y: 0, w: 4, h: 3, config: r.config } }

  it('every phase 6 preset is valid as placed', () => {
    for (const id of ['safety.hotspots_map', 'safety.blackspots_map', 'integrations.feed_status', 'rail.delays', 'query.congestion_live',
      'infra.budget_absorption', 'infra.disbursed_vs_allocated', 'rail.otp_progress', 'query.incidents_hour_weekday', 'query.traffic_hour_weekday']) {
      expect(widgetIssues(place(`preset:${id}`)), id).toEqual([])
    }
  })

  it('a map without coordinates and a status list without a rule say so', () => {
    const m = place('preset:safety.hotspots_map')
    expect(widgetIssues({ ...m, config: { binding: { ...(m.config.binding as Binding), geo: undefined } } })[0]!.message).toBe('Pick the latitude and longitude fields.')
    const s = place('preset:integrations.feed_status')
    expect(widgetIssues({ ...s, config: { binding: { ...(s.config.binding as Binding), status: undefined } } })[0]!.message).toMatch(/^No status rule yet/)
  })
})

describe('found in the browser (regressions)', () => {
  it('a status list counts every row, not just the rows its limit keeps', () => {
    const many = Array.from({ length: 31 }, (_, i) => ({ agency: `A${i}`, status: 'offline' }))
    const f = applyBinding(many, { source: 'integrations.feeds', shape: 'status', path: '', dimension: { key: 'agency', label: 'Agency' }, status: { field: 'status' }, measures: [], limit: 20 })
    expect(f.rows).toHaveLength(20)
    expect(mount(VizStatusList, { props: { frame: f, size: 'xs' } }).text()).toBe('31 critical')
    expect(mount(VizStatusList, { props: { frame: f, size: 'm' } }).text()).toContain('+ 11 more')
  })

  it('a heatmap with no records is empty - not a grid of zeros with a "highest" cell', () => {
    const b: Binding = { source: 'query.incidents', shape: 'matrix', path: 'rows', aggregate: { by: 't', bucket: 'hourOfDay', by2: 't', bucket2: 'dayOfWeek', fn: 'count' },
      dimension: { key: 't', label: 'Hour of day' }, dimension2: { key: 't', label: 'Day of week' }, measures: [{ key: 'value', label: 'Incidents', unit: 'count' }] }
    expect(applyBinding({ rows: [] }, b).rows).toEqual([])
    const zeros: Frame = { fields: [{ key: 'xLabel', label: 'X', kind: 'category' }, { key: 'yLabel', label: 'Y', kind: 'category' }, { key: 'value', label: 'N', kind: 'measure' }],
      rows: [{ x: '1', xLabel: '1', y: 'a', yLabel: 'a', value: 0 }], meta: { total: 1 } }
    expect(mount(VizHeatmap, { props: { frame: zeros, size: 's' } }).text()).toBe('Nothing recorded yet')
  })

  it('an empty feed keeps a map, status list or heatmap editable from its own binding', async () => {
    const { fieldsFromBinding } = await import('~/utils/bindingDesign')
    const map = resolveCatalogItem('preset:safety.hotspots_map')!.config.binding as Binding
    expect(geoFields(fieldsFromBinding(map))).toEqual({ lat: 'latitude', lon: 'longitude' })
    const heat = resolveCatalogItem('preset:query.incidents_hour_weekday')!.config.binding as Binding
    expect(fieldsFromBinding(heat)).toEqual([{ key: 'reported_at', type: 'time' }])
    const feeds = resolveCatalogItem('preset:integrations.feed_status')!.config.binding as Binding
    expect(fieldsFromBinding(feeds).map(f => f.key)).toEqual(['agency_code', 'name', 'source_system', 'status'])
  })
})
