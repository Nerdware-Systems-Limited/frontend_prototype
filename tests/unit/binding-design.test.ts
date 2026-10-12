// tests/unit/binding-design.test.ts
// ─────────────────────────────────────────────────────────────────────
// Inspector v2 authoring helpers (docs/Widgets.md §5.6): the data picker reads
// the live payload to list what a binding can point at, offers only the
// visuals that path can feed, and switching visuals keeps the author's
// choices wherever the fields still exist.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { bindingFor, describePayload, guessUnit, rowFields, shapesFor, withBindingFields, type PathInfo } from '~/utils/bindingDesign'
import { applyBinding } from '~/utils/bindings'
import { PRESETS_BY_ID } from '~/utils/widgetPresets'

const traffic = {
  kpis: { total_volume_24h: 18234, active_congestion_events: 3, avg_speed: null },
  volume_24h: [
    { hour: '2026-10-05T05:00:00Z', volume: 812, avg_speed: '54.2' },
    { hour: '2026-10-05T06:00:00Z', volume: 1204, avg_speed: '48.0' },
  ],
  class_breakdown: [{ vehicle_class: 'psv', total: 420 }, { vehicle_class: 'goods', total: 310 }],
  congestion_distribution: { low: 12, moderate: 5, high: 1 },
  stations: [],
  note: 'text is not bindable',
}
const byPath = (p: string) => describePayload(traffic).find(x => x.path === p)!

describe('describePayload', () => {
  it('lists figures, row lists and figure maps by their dot paths', () => {
    const got = describePayload(traffic).map(p => `${p.kind}:${p.path}`)
    expect(got).toEqual([
      'map:kpis', 'number:kpis.total_volume_24h', 'number:kpis.active_congestion_events', 'number:kpis.avg_speed',
      'rows:volume_24h', 'rows:class_breakdown', 'map:congestion_distribution',
      'number:congestion_distribution.low', 'number:congestion_distribution.moderate', 'number:congestion_distribution.high',
      'rows:stations',
    ])
  })

  it('keeps a figure the feed reported as null - a scalar widget says "not reported", never 0', () => {
    expect(byPath('kpis.avg_speed')).toMatchObject({ kind: 'number' })
  })

  it('types row fields: time by key or ISO value, numeric strings as numbers, the rest as text', () => {
    expect(byPath('volume_24h').fields).toEqual([
      { key: 'hour', type: 'time' }, { key: 'volume', type: 'number' }, { key: 'avg_speed', type: 'number' },
    ])
    expect(rowFields([{ name: 'Mombasa', opened: '1896-01-01', code: 'KEMBA' }])).toEqual([
      { key: 'name', type: 'text' }, { key: 'opened', type: 'time' }, { key: 'code', type: 'text' },
    ])
  })

  it('a root-level list is the whole response (path "")', () => {
    expect(describePayload([{ status: 'ongoing', enrollments: 4 }])).toEqual([
      { path: '', kind: 'rows', count: 1, fields: [{ key: 'status', type: 'text' }, { key: 'enrollments', type: 'number' }] },
    ])
  })
})

describe('shapesFor', () => {
  it('offers only the visuals a path can really feed', () => {
    expect(shapesFor(byPath('kpis.total_volume_24h'))).toEqual(['scalar'])
    expect(shapesFor(byPath('congestion_distribution'))).toEqual(['categorical'])
    expect(shapesFor(byPath('volume_24h'))).toEqual(['series', 'categorical', 'rows', 'status', 'matrix'])
    expect(shapesFor(byPath('class_breakdown'))).toEqual(['categorical', 'rows', 'status'])
    expect(shapesFor(byPath('stations'))).toEqual([]) // empty list: nothing to inspect yet
  })
})

describe('bindingFor', () => {
  it('builds a binding the existing engine can apply', () => {
    const b = bindingFor('traffic.summary', byPath('volume_24h'), 'series')
    expect(b).toEqual({
      source: 'traffic.summary', shape: 'series', path: 'volume_24h',
      dimension: { key: 'hour', label: 'Hour', kind: 'time' },
      measures: [{ key: 'volume', label: 'Volume', unit: 'count' }],
    })
    expect(applyBinding(traffic, b).rows).toEqual([
      { hour: '2026-10-05T05:00:00Z', volume: 812 }, { hour: '2026-10-05T06:00:00Z', volume: 1204 },
    ])
  })

  it('scalar: labels from the path, unit guessed from the name', () => {
    const b = bindingFor('traffic.summary', byPath('kpis.total_volume_24h'), 'scalar')
    expect(b.measures).toEqual([{ key: 'value', label: 'Total volume 24h', unit: 'count' }])
    expect(applyBinding(traffic, b).rows).toEqual([{ value: 18234 }])
  })

  it('a figure map becomes a breakdown over its keys', () => {
    const b = bindingFor('traffic.summary', byPath('congestion_distribution'), 'categorical')
    expect(applyBinding(traffic, b).rows.map(r => r.label)).toEqual(['Low', 'Moderate', 'High'])
  })

  it('switching visuals keeps measures, labels, units, limit and the click field', () => {
    const preset = PRESETS_BY_ID['traffic.class_breakdown']!.binding
    const info = byPath('class_breakdown')
    const asTable = bindingFor(preset.source, info, 'rows', preset)
    expect(asTable).toMatchObject({
      shape: 'rows', columns: [{ key: 'vehicle_class', label: 'Vehicle class' }],
      measures: [{ key: 'total', label: 'Vehicles', unit: 'count' }], emits: 'vehicle_class',
    })
    const back = bindingFor(preset.source, info, 'categorical', asTable)
    expect(back).toMatchObject({ shape: 'categorical', dimension: { key: 'vehicle_class', label: 'Vehicle class' }, measures: preset.measures, emits: 'vehicle_class' })
  })

  it('drops choices whose fields no longer exist on the new path', () => {
    const prev = bindingFor('traffic.summary', byPath('volume_24h'), 'series')
    const next = bindingFor('traffic.summary', byPath('class_breakdown'), 'categorical', prev)
    expect(next.measures).toEqual([{ key: 'total', label: 'Total', unit: 'count' }])
    expect(next.dimension?.key).toBe('vehicle_class')
  })

  it('never stores undefined keys', () => {
    const b = bindingFor('traffic.summary', byPath('kpis.active_congestion_events'), 'scalar')
    expect(Object.keys(b)).toEqual(['source', 'shape', 'path', 'measures'])
  })
})

describe('guessUnit', () => {
  it.each([
    ['on_time_pct', 'pct'], ['revenue_kes', 'kes'], ['total_length_km', 'km'], ['teu_throughput_30d', 'teu'],
    ['cargo_tonnes', 'tonnes'], ['avg_speed', 'kmh'], ['delay_arrival_min', 'min'], ['avg_yard_dwell_days', 'days'], ['bookings', 'count'],
  ])('%s -> %s', (key, unit) => expect(guessUnit(key)).toBe(unit))
})

// Every preset path is described by the payload walker the picker uses.
describe('presets stay authorable', () => {
  it('a preset binding re-derived from its own path keeps its measures', () => {
    const p = PRESETS_BY_ID['pt.leaderboard']!.binding
    const info: PathInfo = { path: p.path, kind: 'rows', count: 1, fields: rowFields([{ sacco__sacco_name: 'X', rank_position: 1, on_time_pct: 90, revenue_kes: 1, fleet_utilization_pct: 1, complaint_count: 0 }]) }
    expect(bindingFor(p.source, info, 'rows', p)).toMatchObject({ columns: p.columns, measures: p.measures, sort: p.sort })
  })
})

describe('withBindingFields', () => {
  it('an empty list keeps the fields its binding already uses, so the preset stays editable', () => {
    const b = PRESETS_BY_ID['traffic.class_breakdown']!.binding
    const info = withBindingFields(byPath('stations'), { ...b, path: 'stations' })
    expect(info.fields).toEqual([{ key: 'vehicle_class', type: 'text' }, { key: 'total', type: 'number' }])
    expect(shapesFor(info)).toEqual(['categorical', 'rows', 'status'])
  })

  it('leaves non-empty paths and other paths alone', () => {
    const b = PRESETS_BY_ID['traffic.class_breakdown']!.binding
    expect(withBindingFields(byPath('volume_24h'), b)).toEqual(byPath('volume_24h'))
    expect(withBindingFields(byPath('stations'), b).fields).toEqual([])
  })
})

describe('default category', () => {
  it('prefers a readable name over a code', () => {
    const info: PathInfo = { path: 'ports', kind: 'rows', count: 2, fields: rowFields([{ port_unlocode: 'KEMBA', port_name: 'Mombasa', arrivals_30d: 4 }]) }
    expect(bindingFor('maritime.ops', info, 'categorical').dimension).toEqual({ key: 'port_name', label: 'Port name' })
    expect(bindingFor('maritime.ops', info, 'rows').columns!.map(c => c.key)).toEqual(['port_name', 'port_unlocode'])
  })
})
