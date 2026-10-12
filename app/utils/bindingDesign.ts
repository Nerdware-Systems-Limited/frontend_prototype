/**
 * Binding design - what the inspector's data picker needs to author a
 * Binding without code (docs/Widgets.md §5.6). Pure, no Vue.
 *
 *   describePayload(payload)        -> every path a binding could point at
 *   shapesFor(path)                 -> which visuals that path can feed
 *   bindingFor(source, path, shape) -> a sensible binding, keeping what the
 *                                      author already chose where it still fits
 *
 * Everything is read from the LIVE payload the source returned, so the
 * picker only offers fields that really exist (no guessed schemas).
 */
import type { Aggregate, AggregateFn, Binding, FrameShape, MeasureSpec } from '~/types/frame'
import type { UnitKey } from '~/utils/units'
import { humanize } from '~/utils/bindings'

export type FieldType = 'number' | 'time' | 'text'
export interface FieldInfo {
  key: string
  type: FieldType
  /** Text with few distinct values (an enum, a status): a good field to group records by. */
  category?: boolean
}

/**
 * number - a single figure (null counts: the feed may not report it yet)
 * rows   - a list of objects
 * map    - an object of figures, e.g. { low: 3, high: 1 }
 */
export type PathKind = 'number' | 'rows' | 'map'
export interface PathInfo {
  path: string
  kind: PathKind
  /** rows: the keys seen in the first rows, in order. */
  fields: FieldInfo[]
  /** rows: list length. map: entries. number: 1. */
  count: number
}

/** The generic widget type that draws each shape. */
export type GenericType = 'stat' | 'series' | 'breakdown' | 'table' | 'points' | 'status-list' | 'progress' | 'heatmap'
/** The default visual for each shape (Progress also draws a 'scalar'; it is picked explicitly). */
export const TYPE_FOR_SHAPE: Record<FrameShape, GenericType> = {
  scalar: 'stat', series: 'series', categorical: 'breakdown', rows: 'table',
  points: 'points', status: 'status-list', matrix: 'heatmap',
}
export const SHAPE_FOR_TYPE: Record<string, FrameShape> = {
  'stat': 'scalar', 'series': 'series', 'breakdown': 'categorical', 'table': 'rows',
  'points': 'points', 'status-list': 'status', 'progress': 'scalar', 'heatmap': 'matrix',
}

const TIME_KEY = /(^|_)(hour|date|day|month|period|time|week|year|at)$/i
const TIME_VALUE = /^\d{4}-\d{2}(-\d{2})?([T ]\d{2}:\d{2})?/
const SAMPLE = 50
const MAX_DEPTH = 4

const isNumeric = (v: unknown): boolean =>
  typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
const isPlainObject = (v: unknown): v is Record<string, unknown> => v != null && typeof v === 'object' && !Array.isArray(v)

function fieldType(key: string, values: unknown[]): FieldType | null {
  const seen = values.filter(v => v != null && v !== '')
  if (!seen.length) return TIME_KEY.test(key) ? 'time' : 'number'
  if (seen.some(v => typeof v === 'object')) return null
  if (TIME_KEY.test(key) && seen.every(v => isNumeric(v) || (typeof v === 'string' && TIME_VALUE.test(v)))) return 'time'
  if (seen.every(isNumeric)) return 'number'
  if (seen.every(v => typeof v === 'string' && TIME_VALUE.test(v))) return 'time'
  return 'text'
}

/** The fields of a list of rows, from its first rows. */
export function rowFields(rows: unknown[]): FieldInfo[] {
  const sample = rows.slice(0, SAMPLE).filter(isPlainObject)
  const keys: string[] = []
  for (const r of sample) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k)
  const out: FieldInfo[] = []
  for (const key of keys) {
    const values = sample.map(r => r[key])
    const t = fieldType(key, values)
    if (!t) continue
    const distinct = new Set(values.filter(v => v != null && v !== '')).size
    // Few distinct values among several records reads as a category (status, severity, type).
    out.push(t === 'text' && sample.length >= 4 && distinct <= Math.min(12, sample.length / 2) ? { key, type: t, category: true } : { key, type: t })
  }
  return out
}

/** Every path in a payload a binding could read, depth-first in payload order. */
export function describePayload(payload: unknown): PathInfo[] {
  const out: PathInfo[] = []
  const walk = (v: unknown, path: string, depth: number) => {
    if (Array.isArray(v)) {
      if (!v.length || v.some(isPlainObject)) out.push({ path, kind: 'rows', fields: rowFields(v), count: v.length })
      return
    }
    if (isPlainObject(v)) {
      const entries = Object.entries(v)
      if (path && entries.length && entries.every(([, x]) => x == null || isNumeric(x)) && entries.some(([, x]) => isNumeric(x))) {
        out.push({ path, kind: 'map', fields: [{ key: 'category', type: 'text' }, { key: 'value', type: 'number' }], count: entries.length })
      }
      if (depth >= MAX_DEPTH) return
      for (const [k, x] of entries) walk(x, path ? `${path}.${k}` : k, depth + 1)
      return
    }
    if (path && (v == null || isNumeric(v))) out.push({ path, kind: 'number', fields: [], count: 1 })
  }
  walk(payload, '', 0)
  return out
}

/**
 * The shapes (and so the visuals) a path can feed. A list without numbers
 * can still be a breakdown or a series: by counting its records.
 */
export function shapesFor(info: PathInfo): FrameShape[] {
  if (info.kind === 'number') return ['scalar']
  if (info.kind === 'map') return ['categorical']
  const out: FrameShape[] = []
  const times = info.fields.filter(f => f.type === 'time').length
  const texts = info.fields.filter(f => f.type === 'text').length
  if (times) out.push('series')
  if (times || texts) out.push('categorical')
  if (info.fields.length) out.push('rows')
  if (geoFields(info.fields)) out.push('points')
  if (times || texts) out.push('status')
  // hour of day x weekday from one timestamp, or two categories
  if (times || texts >= 2) out.push('matrix')
  return out
}

const LAT = /(^|_|\.)lat(itude)?$/i
const LON = /(^|_|\.)(lon|lng|longitude)$/i
/** The latitude / longitude pair among a path's number fields, if it has one. */
export function geoFields(fields: FieldInfo[]): { lat: string; lon: string } | null {
  const lat = fields.find(f => f.type === 'number' && LAT.test(f.key))?.key
  const lon = fields.find(f => f.type === 'number' && LON.test(f.key))?.key
  return lat && lon ? { lat, lon } : null
}

export const AGG_LABELS: Record<AggregateFn, string> = { count: 'Count of records', sum: 'Sum of', avg: 'Average', min: 'Lowest', max: 'Highest' }

/** The measure an aggregate produces (its key is always 'value'). */
export function aggregateMeasure(agg: Aggregate, prev?: MeasureSpec): MeasureSpec {
  const label = agg.fn === 'count' ? 'Records' : `${AGG_LABELS[agg.fn]} ${humanize(agg.measure ?? '').toLowerCase()}`.trim()
  const unit = agg.fn === 'count' ? 'count' as const : guessUnit(agg.measure ?? '')
  return prev && prev.key === 'value' ? { ...prev } : { key: 'value', label, unit }
}

/** A unit from the field name - the author can change it. */
export function guessUnit(key: string): UnitKey {
  const k = key.toLowerCase()
  if (/pct|percent|rate/.test(k)) return 'pct'
  if (/kes|revenue|amount|cost|disbursed|contract|budget/.test(k)) return 'kes'
  if (/teu/.test(k)) return 'teu'
  if (/ton/.test(k)) return 'tonnes'
  if (/(^|_)kg/.test(k)) return 'kg'
  if (/speed|kmh/.test(k)) return 'kmh'
  if (/(^|_)km|length|distance/.test(k)) return 'km'
  if (/delay|(^|_)min(utes)?$/.test(k)) return 'min'
  if (/days|dwell/.test(k)) return 'days'
  return 'count'
}

const lastSegment = (path: string) => path.split('.').filter(Boolean).at(-1) ?? 'value'
/** Drop undefined keys so the stored JSON stays tidy. */
const tidy = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

/**
 * A binding for `shape` over `info`. Measures, dimension, columns, sort,
 * limit, threshold and click field carry over from `prev` wherever the
 * fields still exist, so switching Line -> Breakdown -> Table loses nothing.
 */
export interface BindingForOptions {
  /** Group records by default (query sources return raw records, not summaries). */
  aggregate?: boolean
}

export function bindingFor(source: string, info: PathInfo, shape: FrameShape, prev?: Binding | null, opts: BindingForOptions = {}): Binding {
  const nums = info.fields.filter(f => f.type === 'number')
  const times = info.fields.filter(f => f.type === 'time')
  // Readable labels first: "port_name" beats "port_unlocode" as a default category.
  const NAMEY = /name|label|title/i
  const texts = info.fields.filter(f => f.type === 'text').sort((a, b) => Number(NAMEY.test(b.key)) - Number(NAMEY.test(a.key)))
  const has = (key: string | undefined, list: FieldInfo[]) => !!key && list.some(f => f.key === key)
  const measure = (key: string): MeasureSpec =>
    prev?.measures.find(m => m.key === key) ?? { key, label: humanize(key), unit: guessUnit(key) }
  const kept = (prev?.measures ?? []).filter(m => has(m.key, nums))
  const dimOf = (pool: FieldInfo[]) => {
    const key = has(prev?.dimension?.key, pool) ? prev!.dimension!.key : pool[0]?.key
    if (!key) return undefined
    const kind = times.some(f => f.key === key) ? 'time' as const : 'category' as const
    return { key, label: prev?.dimension?.key === key ? prev.dimension.label : humanize(key), kind }
  }

  const params = prev?.source === source ? prev.params : undefined
  /** Count / sum / … grouped by `by`, keeping the previous aggregate's function where its fields still exist. */
  const groupBy = (by: string, bucket?: Aggregate['bucket']): Aggregate => {
    const p = prev?.aggregate
    const keep = p && (p.fn === 'count' || has(p.measure, nums))
    return tidy({ by, fn: keep ? p!.fn : 'count' as const, measure: keep ? p!.measure : undefined, bucket })
  }
  const wantsAggregate = opts.aggregate || !!prev?.aggregate || !nums.length

  if (shape === 'scalar') {
    const m = prev?.measures[0]
    const fromScalar = prev?.shape === 'scalar' && prev.path === info.path
    return tidy({
      source, shape, path: info.path, params,
      measures: [{ key: 'value', label: fromScalar && m ? m.label : humanize(lastSegment(info.path)), unit: fromScalar && m?.unit ? m.unit : guessUnit(info.path) }],
      threshold: prev?.threshold,
      target: prev?.target,
    })
  }

  if (shape === 'series') {
    if (wantsAggregate && times.length) {
      const dim = dimOf(times)!
      const agg = groupBy(dim.key, prev?.aggregate?.bucket ?? 'day')
      return tidy({
        source, shape, path: info.path, params, aggregate: agg,
        dimension: { key: dim.key, label: dim.label, kind: 'time' as const },
        measures: [aggregateMeasure(agg, prev?.aggregate ? prev.measures[0] : undefined)],
        limit: prev?.shape === 'series' ? prev.limit : undefined,
      })
    }
    return tidy({
      source, shape, path: info.path, params,
      dimension: dimOf([...times, ...texts]),
      measures: kept.length ? kept : nums.slice(0, 1).map(f => measure(f.key)),
      limit: prev?.shape === 'series' ? prev.limit : undefined,
    })
  }

  if (shape === 'categorical') {
    if (info.kind === 'map') {
      const m = prev?.measures[0]
      return tidy({
        source, shape, path: info.path, params,
        dimension: { key: 'category', label: prev?.dimension?.label ?? 'Category', kind: 'category' as const },
        measures: [{ key: 'value', label: m?.label ?? humanize(lastSegment(info.path)), unit: m?.unit ?? 'count' }],
        limit: prev?.limit, emits: prev?.emits,
      })
    }
    const dim = dimOf([...texts, ...times])
    // Grouping by raw timestamps gives one bar per record: prefer a text category,
    // and when only times exist, group them into days (or the previous bucket).
    const ID = /(^|_|\.)id$/i
    const groupable = [...texts].sort((a, b) => rank(a) - rank(b))
    function rank(f: FieldInfo) { return f.category ? 0 : ID.test(f.key) ? 3 : NAMEY.test(f.key) ? 2 : 1 }
    const gdim = dimOf(groupable) ?? dimOf(times)
    if (wantsAggregate && gdim) {
      const agg = groupBy(gdim.key, gdim.kind === 'time' ? prev?.aggregate?.bucket ?? 'day' : undefined)
      return tidy({
        source, shape, path: info.path, params, aggregate: agg,
        dimension: { key: gdim.key, label: gdim.label },
        measures: [aggregateMeasure(agg, prev?.aggregate ? prev.measures[0] : undefined)],
        limit: prev?.limit ?? 8, emits: prev?.emits,
      })
    }
    return tidy({
      source, shape, path: info.path, params,
      dimension: dim ? { key: dim.key, label: dim.label } : undefined,
      measures: (kept.length ? kept : nums.map(f => measure(f.key))).slice(0, 1),
      limit: prev?.limit ?? (info.count > 8 ? 6 : undefined),
      emits: prev?.emits,
    })
  }

  if (shape === 'points') {
    const geo = geoFields(info.fields)
    const pg = prev?.geo && has(prev.geo.lat, nums) && has(prev.geo.lon, nums) ? prev.geo : null
    const keyField = pg?.key && has(pg.key, texts) ? pg.key : texts.find(f => /road_code|(^|_)code$/i.test(f.key))?.key
    const tierField = pg?.tier && has(pg.tier, texts) ? pg.tier : texts.find(f => /tier|severity|level|status|condition/i.test(f.key))?.key
    const label = dimOf(texts)
    return tidy({
      source, shape, path: info.path, params,
      geo: tidy({ lat: pg?.lat ?? geo?.lat ?? '', lon: pg?.lon ?? geo?.lon ?? '', key: keyField, tier: tierField }),
      dimension: label ? { key: label.key, label: label.label } : undefined,
      measures: (kept.length ? kept : nums.filter(f => !LAT.test(f.key) && !LON.test(f.key)).slice(0, 2).map(f => measure(f.key))),
      limit: prev?.shape === 'points' ? prev.limit : undefined,
      emits: prev?.emits,
    })
  }

  if (shape === 'status') {
    const label = dimOf(texts) ?? dimOf(times)
    const statusField = prev?.status?.field && has(prev.status.field, [...texts, ...times]) ? prev.status.field
      : texts.find(f => /status|severity|tier|level|condition|state/i.test(f.key) && f.key !== label?.key)?.key
    const m = kept[0] ?? (nums[0] ? measure(nums[0].key) : undefined)
    const detail = [...times, ...texts].filter(f => f.key !== label?.key && f.key !== statusField).slice(0, 2)
    return tidy({
      source, shape, path: info.path, params,
      dimension: label ? { key: label.key, label: label.label } : undefined,
      status: statusField ? tidy({ field: statusField, map: prev?.status?.field === statusField ? prev.status.map : undefined }) : undefined,
      threshold: statusField ? undefined : prev?.threshold,
      measures: m ? [m] : [],
      columns: detail.map(f => ({ key: f.key, label: humanize(f.key) })),
      limit: prev?.shape === 'status' ? prev.limit : 20,
      link: prev?.link, emits: prev?.emits,
    })
  }

  if (shape === 'matrix') {
    const ID = /(^|_|\.)id$/i
    const groupable = [...texts].filter(f => !ID.test(f.key)).sort((a, b) => Number(!!b.category) - Number(!!a.category))
    const t = times[0]
    const agg: Aggregate = t
      ? tidy({ by: t.key, bucket: 'hourOfDay' as const, by2: t.key, bucket2: 'dayOfWeek' as const, fn: groupBy(t.key).fn, measure: groupBy(t.key).measure })
      : tidy({ by: groupable[0]?.key ?? '', by2: groupable[1]?.key ?? '', fn: groupBy(groupable[0]?.key ?? '').fn, measure: groupBy(groupable[0]?.key ?? '').measure })
    return tidy({
      source, shape, path: info.path, params, aggregate: agg,
      dimension: t ? { key: t.key, label: 'Hour of day' } : { key: agg.by, label: humanize(agg.by) },
      dimension2: t ? { key: t.key, label: 'Day of week' } : { key: agg.by2!, label: humanize(agg.by2) },
      measures: [aggregateMeasure(agg, prev?.aggregate ? prev.measures[0] : undefined)],
    })
  }

  // rows
  const textual = [...texts, ...times]
  const keptCols = (prev?.columns ?? []).filter(c => has(c.key, textual))
  const columns = keptCols.length
    ? keptCols
    : has(prev?.dimension?.key, textual)
      ? [{ key: prev!.dimension!.key, label: prev!.dimension!.label }]
      : textual.slice(0, 3).map(f => ({ key: f.key, label: humanize(f.key) }))
  const measures = kept.length ? kept : nums.slice(0, 3).map(f => measure(f.key))
  const sortKey = prev?.sort?.key
  return tidy({
    source, shape, path: info.path, params, columns, measures,
    sort: sortKey && (columns.some(c => c.key === sortKey) || measures.some(m => m.key === sortKey)) ? prev!.sort : undefined,
    limit: prev?.shape === 'rows' ? prev.limit : undefined,
    emits: prev?.emits,
  })
}

/**
 * The fields a binding names, for a path whose list is empty right now -
 * so a preset stays editable while its feed has no rows (the author still
 * can't pick fields nobody has seen).
 */
export function fieldsFromBinding(b: Binding): FieldInfo[] {
  const out: FieldInfo[] = []
  const add = (key: string | undefined, type: FieldType) => { if (key && !out.some(f => f.key === key)) out.push({ key, type }) }
  const timeish = (key: string | undefined, bucketed: boolean) => (bucketed || (key && TIME_KEY.test(key)) ? 'time' as const : 'text' as const)
  const agg = b.aggregate
  if (b.dimension && b.dimension.key !== 'category') add(b.dimension.key, b.dimension.kind === 'time' || b.shape === 'series' ? 'time' : timeish(b.dimension.key, !!agg?.bucket))
  if (b.dimension2) add(b.dimension2.key, timeish(b.dimension2.key, !!agg?.bucket2))
  if (agg) { add(agg.by, timeish(agg.by, !!agg.bucket)); add(agg.by2, timeish(agg.by2, !!agg.bucket2)); add(agg.measure, 'number') }
  for (const c of b.columns ?? []) add(c.key, TIME_KEY.test(c.key) ? 'time' : 'text')
  if (b.geo) { add(b.geo.lat, 'number'); add(b.geo.lon, 'number'); add(b.geo.key, 'text'); add(b.geo.tier, 'text') }
  add(b.status?.field, 'text')
  // An aggregate's 'value' is computed, not a field of the rows.
  for (const m of b.measures) if (b.shape !== 'scalar' && !agg) add(m.key, 'number')
  return out
}

/** A path's info, with an empty list filled in from the binding that points at it. */
export function withBindingFields(info: PathInfo, b: Binding | null): PathInfo {
  if (info.kind !== 'rows' || info.fields.length || !b || b.path !== info.path) return info
  return { ...info, fields: fieldsFromBinding(b) }
}
