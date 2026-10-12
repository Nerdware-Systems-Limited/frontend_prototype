// tests/unit/query-sources.test.ts
// ─────────────────────────────────────────────────────────────────────
// Phase 5: any Query Builder dataset on a dashboard. Raw records are
// grouped on the client (count / sum / … by a field or time bucket);
// dashboard filters become server-side dataset filters only where the
// dataset has a matching field; and a figure computed from the first 500
// of more records says so instead of passing as the whole.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'

const execute = vi.fn()
const executeJoin = vi.fn()
vi.mock('~/composables/api', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useQuery: () => ({ execute, executeJoin }),
}))

import { aggregateRows, applyBinding, bucketOf } from '~/utils/bindings'
import { QUERY_MAX_ROWS, SOURCES_BY_ID, dashboardQueryFilters, paramsOption } from '~/utils/dataSources'
import { bindingFor, shapesFor, type PathInfo } from '~/utils/bindingDesign'
import { widgetIssues } from '~/utils/widgetValidation'
import { PRESETS } from '~/utils/widgetPresets'
import { resolveCatalogItem, widgetFilterFields, widgetPermissions } from '~/utils/widgetRegistry'
import type { Binding } from '~/types/frame'

const records = [
  { severity: 'fatal', reported_at: '2026-10-01T08:15:00Z', vehicles: 2 },
  { severity: 'serious', reported_at: '2026-10-01T21:40:00Z', vehicles: null },
  { severity: 'fatal', reported_at: '2026-10-03T06:00:00Z', vehicles: 3 },
  { severity: null, reported_at: null, vehicles: 1 },
]
const result = (rows: Record<string, unknown>[], total = rows.length) => ({ total, count: rows.length, rows, limit: 500, offset: 0 })

describe('aggregateRows', () => {
  it('counts records per group; records without a value fall in "Unspecified", not dropped', () => {
    expect(aggregateRows(records, { by: 'severity', fn: 'count' })).toEqual([
      { severity: 'fatal', value: 2 }, { severity: 'serious', value: 1 }, { severity: '', value: 1 },
    ])
  })

  it('sums and averages only reported values; a group with none is null, never 0', () => {
    expect(aggregateRows(records, { by: 'severity', fn: 'sum', measure: 'vehicles' })).toEqual([
      { severity: 'fatal', value: 5 }, { severity: 'serious', value: null }, { severity: '', value: 1 },
    ])
    expect(aggregateRows(records, { by: 'severity', fn: 'avg', measure: 'vehicles' })[0]).toEqual({ severity: 'fatal', value: 2.5 })
  })

  it('buckets timestamps in East Africa Time: hour, day, week (Monday), month, hour of day, weekday', () => {
    expect(bucketOf('2026-10-01T08:15:00Z', 'hour')).toBe('2026-10-01T11:00:00+03:00')
    expect(bucketOf('2026-10-01T08:15:00Z', 'day')).toBe('2026-10-01')
    // 22:30 UTC on Wednesday 30 Sep is 01:30 EAT on Thursday 1 Oct
    expect(bucketOf('2026-09-30T22:30:00Z', 'day')).toBe('2026-10-01')
    expect(bucketOf('2026-10-04T12:00:00Z', 'week')).toBe('2026-09-28') // Sunday -> its Monday
    expect(bucketOf('2026-10-04T23:00:00Z', 'week')).toBe('2026-10-05') // already Monday 02:00 in Nairobi
    expect(bucketOf('2026-09-30T22:30:00Z', 'month')).toBe('2026-10')
    expect(bucketOf('2026-10-01T08:15:00Z', 'hourOfDay')).toBe('11')
    expect(bucketOf('2026-10-04T12:00:00Z', 'dayOfWeek')).toBe('7') // Sunday
    expect(bucketOf(null, 'day')).toBeNull()
  })
})

describe('applyBinding with an aggregate', () => {
  const bySeverity: Binding = {
    source: 'query.incidents', shape: 'categorical', path: 'rows', aggregate: { by: 'severity', fn: 'count' },
    dimension: { key: 'severity', label: 'Severity' }, measures: [{ key: 'value', label: 'Incidents', unit: 'count' }],
  }

  it('groups, then shapes as a breakdown with the raw category kept for clicks', () => {
    const f = applyBinding(result(records), bySeverity)
    expect(f.rows).toEqual([
      { category: 'fatal', label: 'Fatal', value: 2 }, { category: 'serious', label: 'Serious', value: 1 }, { category: '', label: 'Unspecified', value: 1 },
    ])
    expect(f.meta.partial).toBeUndefined()
  })

  it('flags figures computed from only part of the matching records', () => {
    expect(applyBinding(result(records, 1204), bySeverity).meta.partial).toEqual({ count: 4, total: 1204 })
  })

  it('a time series per day skips records without a time and sorts by day', () => {
    const b: Binding = { source: 'query.incidents', shape: 'series', path: 'rows', aggregate: { by: 'reported_at', fn: 'count', bucket: 'day' },
      dimension: { key: 'reported_at', label: 'Day', kind: 'time' }, measures: [{ key: 'value', label: 'Incidents', unit: 'count' }] }
    // 21:40 UTC on 1 Oct is 00:40 EAT on 2 Oct
    expect(applyBinding(result(records), b).rows).toEqual([
      { reported_at: '2026-10-01', value: 1 }, { reported_at: '2026-10-02', value: 1 }, { reported_at: '2026-10-03', value: 1 },
    ])
  })

  it('a plain table of records also says when it is the first page only', () => {
    const b: Binding = { source: 'query.incidents', shape: 'rows', path: 'rows', columns: [{ key: 'severity', label: 'Severity' }], measures: [] }
    expect(applyBinding(result(records.slice(0, 2), 90), b).meta.partial).toEqual({ count: 2, total: 90 })
  })
})

describe('dashboardQueryFilters', () => {
  const map = { date_range: 'reported_at', severity: 'severity', road: 'segment_road_code' } as const

  it('maps only the filters the dataset has a field for; the end day is inclusive', () => {
    expect(dashboardQueryFilters({ date_from: '2026-10-01', date_to: '2026-10-05', severity: 'fatal,serious', county: 'Nairobi', road: 'A8' }, map)).toEqual([
      { field: 'reported_at', op: 'gte', value: '2026-10-01' },
      { field: 'reported_at', op: 'lt', value: '2026-10-06' },
      { field: 'severity', op: 'in', value: ['fatal', 'serious'] },
      { field: 'segment_road_code', op: 'eq', value: 'A8' },
    ])
  })

  it('a source honours exactly the filters it maps', () => {
    expect(SOURCES_BY_ID['query.incidents']!.honours).toEqual(['date_range', 'severity', 'road'])
    expect(SOURCES_BY_ID['query.vehicles']!.honours).toEqual([])
    // a join honours a filter only when both sides can apply it
    expect(SOURCES_BY_ID['query.join.incidents-blackspots']!.honours).toEqual(['road'])
  })
})

describe('query source requests', () => {
  beforeEach(() => { execute.mockReset().mockResolvedValue(result([])); executeJoin.mockReset().mockResolvedValue(result([])) })

  it('sends the binding params plus the honoured dashboard filters, with the limit capped', async () => {
    const params = { fields: ['severity'], filters: [{ field: 'status', op: 'eq', value: 'reported' }], sort: { field: 'reported_at', direction: 'desc' }, limit: 9000 }
    await SOURCES_BY_ID['query.incidents']!.fetch({ severity: 'fatal' }, paramsOption(params))
    expect(execute).toHaveBeenCalledWith({
      dataset: 'incidents', fields: ['severity'], sort: { field: 'reported_at', direction: 'desc' }, limit: QUERY_MAX_ROWS,
      filters: [{ field: 'status', op: 'eq', value: 'reported' }, { field: 'severity', op: 'eq', value: 'fatal' }],
    })
  })

  it('no params means every field, the dataset default sort and the most records', async () => {
    await SOURCES_BY_ID['query.vehicles']!.fetch({}, paramsOption(undefined))
    expect(execute).toHaveBeenCalledWith({ dataset: 'vehicles', filters: [], limit: QUERY_MAX_ROWS })
  })

  it('a join fixes both datasets and filters each side by its own field', async () => {
    await SOURCES_BY_ID['query.join.incidents-blackspots']!.fetch({ road: 'A8' }, paramsOption({ left: { fields: ['severity'] }, join_type: 'left' }))
    expect(executeJoin).toHaveBeenCalledWith({
      left: { dataset: 'incidents', fields: ['severity'], filters: [{ field: 'segment_road_code', op: 'eq', value: 'A8' }] },
      right: { dataset: 'blackspots', filters: [{ field: 'segment_road_code', op: 'eq', value: 'A8' }] },
      join_type: 'left', limit: QUERY_MAX_ROWS,
    })
  })

  it('a join carries the one permission both its datasets need', () => {
    expect(SOURCES_BY_ID['query.join.vehicles-gps']!.permission).toBe('fleet.view')
    expect(SOURCES_BY_ID['query.join.congestion-counts']!.permission).toBe('traffic.view')
  })
})

describe('designing bindings over records', () => {
  const incidents: PathInfo = { path: 'rows', kind: 'rows', count: 3, fields: [
    { key: 'id', type: 'text' }, { key: 'title', type: 'text' }, { key: 'severity', type: 'text', category: true }, { key: 'reported_at', type: 'time' },
  ] }

  it('records without numbers can still be a breakdown or a series - by counting them', () => {
    expect(shapesFor(incidents)).toEqual(['series', 'categorical', 'rows', 'status', 'matrix'])
  })

  it('query sources default to counting records', () => {
    const b = bindingFor('query.incidents', incidents, 'categorical', null, { aggregate: true })
    // groups by the enum, never by the id or a free-text title
    expect(b).toMatchObject({ aggregate: { by: 'severity', fn: 'count' }, dimension: { key: 'severity' }, measures: [{ key: 'value', label: 'Records', unit: 'count' }] })
    const s = bindingFor('query.incidents', incidents, 'series', b, { aggregate: true })
    expect(s).toMatchObject({ aggregate: { by: 'reported_at', fn: 'count', bucket: 'day' }, dimension: { key: 'reported_at', kind: 'time' } })
  })

  it('switching visual keeps the query params and a sum over a field that still exists', () => {
    const counts: PathInfo = { path: 'rows', kind: 'rows', count: 1, fields: [{ key: 'recorded_at', type: 'time' }, { key: 'congestion_level', type: 'text' }, { key: 'vehicle_vol', type: 'number' }] }
    const prev: Binding = { source: 'query.traffic_counts', shape: 'series', path: 'rows', params: { limit: 200 },
      aggregate: { by: 'recorded_at', fn: 'sum', measure: 'vehicle_vol', bucket: 'week' }, dimension: { key: 'recorded_at', label: 'Week', kind: 'time' },
      measures: [{ key: 'value', label: 'Vehicles', unit: 'count' }] }
    expect(bindingFor(prev.source, counts, 'categorical', prev, { aggregate: true })).toMatchObject({
      params: { limit: 200 }, aggregate: { by: 'congestion_level', fn: 'sum', measure: 'vehicle_vol' }, measures: [{ key: 'value', label: 'Vehicles' }],
    })
  })
})

describe('query presets and guardrails', () => {
  it('query presets inherit permission and honoured filters from their dataset', () => {
    const r = resolveCatalogItem('preset:query.incidents_by_severity')!
    expect(widgetPermissions(r.type, r.config)).toEqual(['safety.view'])
    expect(widgetFilterFields(r.type, r.config)).toEqual(['date_range', 'severity', 'road'])
  })

  it('every query preset is valid as placed', () => {
    for (const p of PRESETS.filter(x => x.binding.source.startsWith('query.'))) {
      const r = resolveCatalogItem(`preset:${p.id}`)!
      expect(widgetIssues({ id: 'w', type: r.type, x: 0, y: 0, w: 4, h: 3, config: r.config }), p.id).toEqual([])
    }
  })

  it('flags a grouping out of step with its category, a sum with no field, and an over-limit query', () => {
    const r = resolveCatalogItem('preset:query.incidents_by_severity')!
    const b = r.config.binding as Binding
    const issues = widgetIssues({ id: 'w', type: 'breakdown', x: 0, y: 0, w: 4, h: 3, config: { binding: {
      ...b, aggregate: { by: 'status', fn: 'sum' }, params: { limit: 900 },
    } } }).map(i => `${i.level}: ${i.message}`)
    expect(issues).toEqual([
      'error: The grouping and the category field differ. Pick the field to break down by again.',
      'error: Pick the field to sum, average or compare.',
      'warning: The server returns at most 500 records; 900 is capped.',
    ])
  })
})

describe('category detection', () => {
  it('marks low-cardinality text as a category to group by', async () => {
    const { rowFields } = await import('~/utils/bindingDesign')
    const rows = ['fatal', 'serious', 'fatal', 'minor', 'fatal', 'serious'].map((sev, i) => ({ id: `i${i}`, severity: sev }))
    expect(rowFields(rows)).toEqual([{ key: 'id', type: 'text' }, { key: 'severity', type: 'text', category: true }])
  })
})
