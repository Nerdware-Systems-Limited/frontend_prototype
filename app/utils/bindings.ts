/**
 * applyBinding(payload, binding) -> Frame. Pure, no Vue.
 *
 * Honest-data rules carry through: a value the API didn't return stays null
 * (drawn as a gap / "-"), never 0; a path the payload doesn't have yields an
 * empty Frame (the widget says so) rather than a guess; a payload of the
 * wrong shape throws, so the widget reports "unexpected response" instead of
 * drawing nonsense.
 */
import type { Aggregate, Binding, Frame, FrameField, TimeBucket } from '~/types/frame'
import { statusOf, type Status } from '~/utils/thresholds'

export class BindingError extends Error {
  constructor(message: string) { super(message); this.name = 'BindingError' }
}

/** Read a dot path ("kpis.total_volume_24h") from a payload. */
export function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj
  let cur: unknown = obj
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/** A number, or null for anything missing / non-numeric (never 0). */
export function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : Number.NaN
  return Number.isFinite(n) ? n : null
}

/** "very_high" -> "Very high", "M-PESA" stays as is. */
export function humanize(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return 'Unspecified'
  if (/[A-Z]/.test(s) && !s.includes('_')) return s
  const spaced = s.replace(/_+/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export const OTHER = '__other__'

/** The binding stored in a widget's config, or null when there is none. */
export function bindingOf(config: Record<string, unknown>): Binding | null {
  const b = config.binding as Binding | undefined
  return b && typeof b === 'object' && b.source && b.path !== undefined ? b : null
}

function asRows(value: unknown, binding: Binding): Record<string, unknown>[] {
  if (value == null) return []
  if (Array.isArray(value)) return value as Record<string, unknown>[]
  // categorical also accepts { category: number }
  if (binding.shape === 'categorical' && typeof value === 'object') {
    const dimKey = binding.dimension?.key ?? 'category'
    const mKey = binding.measures[0]?.key ?? 'value'
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ [dimKey]: k, [mKey]: v }))
  }
  throw new BindingError(`Expected a list at '${binding.path}', got ${typeof value}.`)
}

/** Kenya is UTC+3 all year (no daylight saving), so East Africa Time is a fixed shift. */
const EAT_MS = 3 * 3_600_000
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * The time group a timestamp falls in, in East Africa Time - an incident at
 * 01:00 EAT belongs to that day, not the previous UTC one. Keys sort in time
 * order: hour "2026-10-01T11:00:00+03:00", day "2026-10-01", week (its
 * Monday) "2026-09-28", month "2026-10", hourOfDay "00".."23",
 * dayOfWeek "1" (Mon) .. "7" (Sun).
 */
export function bucketOf(v: unknown, bucket: TimeBucket): string | null {
  if (v == null || v === '') return null
  const t = new Date(String(v)).getTime()
  if (Number.isNaN(t)) return String(v)
  // Wall-clock EAT read through the UTC getters.
  const d = new Date(t + EAT_MS)
  const iso = d.toISOString()
  if (bucket === 'hour') return `${iso.slice(0, 13)}:00:00+03:00`
  if (bucket === 'hourOfDay') return iso.slice(11, 13)
  if (bucket === 'dayOfWeek') return String(((d.getUTCDay() + 6) % 7) + 1)
  if (bucket === 'month') return iso.slice(0, 7)
  if (bucket === 'week') {
    const day = (d.getUTCDay() + 6) % 7 // Monday = 0
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10)
  }
  return iso.slice(0, 10)
}

/** Display text for a bucket key ("1" -> "Mon", "07" -> "07:00"); other keys pass through. */
export function bucketLabel(key: string, bucket: TimeBucket | undefined): string {
  if (bucket === 'dayOfWeek') return WEEKDAYS[Number(key) - 1] ?? key
  if (bucket === 'hourOfDay') return `${key}:00`
  return key
}

/** Every key a cyclic bucket can take, so a heatmap shows quiet hours as empty cells, not missing rows. */
const FULL_CYCLE: Partial<Record<TimeBucket, string[]>> = {
  hourOfDay: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')),
  dayOfWeek: ['1', '2', '3', '4', '5', '6', '7'],
}

/**
 * Group records: one row per group, `{ [by]: group, value }`. Records with
 * no group value fall in '' ("Unspecified"). A sum / average over a group
 * with no reported values is null, never 0.
 */
export function aggregateRows(rows: Record<string, unknown>[], agg: Aggregate): Record<string, unknown>[] {
  const keyOf = (raw: unknown, bucket?: TimeBucket) => (bucket ? bucketOf(raw, bucket) ?? '' : raw == null ? '' : String(raw))
  const groups = new Map<string, { n: number; vals: number[]; k1: string; k2: string }>()
  for (const r of rows) {
    const k1 = keyOf(r[agg.by], agg.bucket)
    const k2 = agg.by2 ? keyOf(r[agg.by2], agg.bucket2) : ''
    const key = agg.by2 ? `${k1}\u0000${k2}` : k1
    const g = groups.get(key) ?? { n: 0, vals: [], k1, k2 }
    g.n++
    if (agg.fn !== 'count' && agg.measure) {
      const v = toNum(r[agg.measure])
      if (v != null) g.vals.push(v)
    }
    groups.set(key, g)
  }
  return [...groups].map(([key, g]) => {
    let value: number | null
    if (agg.fn === 'count') value = g.n
    else if (!g.vals.length) value = null
    else if (agg.fn === 'sum') value = g.vals.reduce((s, v) => s + v, 0)
    else if (agg.fn === 'avg') value = g.vals.reduce((s, v) => s + v, 0) / g.vals.length
    else if (agg.fn === 'min') value = Math.min(...g.vals)
    else value = Math.max(...g.vals)
    // A matrix may group one field twice (hour of day x weekday), so its keys are x / y.
    return agg.by2 ? { x: g.k1, y: g.k2, value } : { [agg.by]: key, value }
  })
}

const STATUS_RANK: Record<Status, number> = { critical: 0, warning: 1, neutral: 2, healthy: 3 }

/** {count, total} when the list at `path` is one page of a larger result (query sources). */
function partialOf(payload: unknown, path: string): { count: number; total: number } | undefined {
  const parent = path.includes('.') ? getPath(payload, path.slice(0, path.lastIndexOf('.'))) : path ? payload : null
  const p = parent as { count?: unknown; total?: unknown } | null
  if (!p || typeof p !== 'object' || typeof p.total !== 'number' || typeof p.count !== 'number') return undefined
  return p.count < p.total ? { count: p.count, total: p.total } : undefined
}

export function applyBinding(payload: unknown, binding: Binding): Frame {
  if (binding.shape === 'scalar') return shapeFrame(payload, binding)
  // Aggregate first, then shape the grouped rows as if the payload held them.
  const frame = binding.aggregate
    ? shapeFrame({ rows: aggregateRows(asRows(getPath(payload, binding.path), { ...binding, shape: 'rows' }), binding.aggregate) }, { ...binding, path: 'rows', aggregate: undefined }, binding.aggregate)
    : shapeFrame(payload, binding)
  const partial = partialOf(payload, binding.path)
  return partial ? { ...frame, meta: { ...frame.meta, partial } } : frame
}

function shapeFrame(payload: unknown, binding: Binding, agg?: Aggregate): Frame {
  const measureFields: FrameField[] = binding.measures.map(m => ({ key: m.key, label: m.label, kind: 'measure', unit: m.unit }))
  const raw = getPath(payload, binding.path)

  if (binding.shape === 'scalar') {
    if (raw != null && typeof raw === 'object') throw new BindingError(`Expected a number at '${binding.path}'.`)
    const m = binding.measures[0]!
    const fields: FrameField[] = [{ key: m.key, label: m.label, kind: 'measure', unit: m.unit }]
    const row: Record<string, unknown> = { [m.key]: toNum(raw) }
    // Progress: the target is a fixed figure or another figure in the same payload (never guessed).
    const t = binding.target
    if (t && (t.value != null || t.path)) {
      fields.push({ key: 'target', label: t.label || 'Target', kind: 'measure', unit: m.unit })
      row.target = t.path ? toNum(getPath(payload, t.path)) : toNum(t.value)
    }
    return { fields, rows: raw === undefined ? [] : [row], meta: { total: raw === undefined ? 0 : 1 } }
  }

  const source = asRows(raw, binding)
  const dim = binding.dimension

  if (binding.shape === 'series') {
    if (!dim) throw new BindingError('A series binding needs a dimension (the x key).')
    const rows = source.map((r) => {
      const out: Record<string, unknown> = { [dim.key]: r[dim.key] }
      for (const m of binding.measures) out[m.key] = toNum(r[m.key])
      return out
    }).filter(r => r[dim.key] != null && r[dim.key] !== '')
    rows.sort((a, b) => String(a[dim.key]).localeCompare(String(b[dim.key])))
    const limited = binding.limit ? rows.slice(-binding.limit) : rows
    return {
      fields: [{ key: dim.key, label: dim.label, kind: dim.kind ?? 'time' }, ...measureFields],
      rows: limited,
      meta: { total: rows.length },
    }
  }

  if (binding.shape === 'categorical') {
    const dimKey = dim?.key ?? 'category'
    const m = binding.measures[0]!
    let rows = source
      .map(r => ({ category: r[dimKey], label: humanize(r[dimKey]), [m.key]: toNum(r[m.key]) }))
      .filter(r => r.category != null)
    const dir = binding.sort?.dir ?? 'desc'
    rows.sort((a, b) => {
      const av = (a[m.key] as number | null) ?? -Infinity
      const bv = (b[m.key] as number | null) ?? -Infinity
      return dir === 'desc' ? bv - av : av - bv
    })
    const total = rows.length
    let folded = 0
    if (binding.limit && rows.length > binding.limit) {
      const keep = rows.slice(0, binding.limit - 1)
      const rest = rows.slice(binding.limit - 1)
      folded = rest.length
      const vals = rest.map(r => r[m.key] as number | null).filter((v): v is number => v != null)
      rows = [...keep, { category: OTHER, label: `Other (${rest.length})`, [m.key]: vals.length ? vals.reduce((s, v) => s + v, 0) : null }]
    }
    return {
      fields: [{ key: 'label', label: dim?.label ?? 'Category', kind: 'category' }, { key: m.key, label: m.label, kind: 'measure', unit: m.unit }],
      rows,
      meta: { total, folded: folded || undefined },
    }
  }

  if (binding.shape === 'points') return pointsFrame(source, binding)
  if (binding.shape === 'status') return statusFrame(source, binding)
  if (binding.shape === 'matrix') return matrixFrame(source, binding, agg)

  // rows
  const cols = binding.columns ?? []
  let rows = source.map((r) => {
    const out: Record<string, unknown> = {}
    for (const c of cols) out[c.key] = r[c.key] ?? null
    for (const m of binding.measures) out[m.key] = toNum(r[m.key])
    return out
  })
  if (binding.sort) {
    const { key, dir } = binding.sort
    rows.sort((a, b) => {
      const av = a[key]; const bv = b[key]
      const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''))
      return dir === 'desc' ? -c : c
    })
  }
  const total = rows.length
  if (binding.limit) rows = rows.slice(0, binding.limit)
  return {
    fields: [...cols.map(c => ({ key: c.key, label: c.label, kind: 'text' as const })), ...measureFields],
    rows,
    meta: { total },
  }
}

// ── Points ───────────────────────────────────────────────────────────────

/** Rows with usable coordinates; the rest are counted, not dropped silently. */
function pointsFrame(source: Record<string, unknown>[], binding: Binding): Frame {
  const g = binding.geo
  if (!g) throw new BindingError('A map binding needs the latitude and longitude fields.')
  const labelKey = binding.dimension?.key
  const cols = binding.columns ?? []
  let unplaced = 0
  const rows: Record<string, unknown>[] = []
  for (const r of source) {
    const lat = toNum(r[g.lat])
    const lon = toNum(r[g.lon])
    // 0,0 is in the Gulf of Guinea: a missing coordinate, not a Kenyan location.
    if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) { unplaced++; continue }
    const out: Record<string, unknown> = {
      key: g.key ? r[g.key] ?? null : null,
      label: labelKey ? r[labelKey] ?? null : null,
      tier: g.tier ? r[g.tier] ?? null : null,
      lat, lon,
    }
    for (const c of cols) out[c.key] = r[c.key] ?? null
    for (const m of binding.measures) out[m.key] = toNum(r[m.key])
    rows.push(out)
  }
  const limited = binding.limit ? rows.slice(0, binding.limit) : rows
  return {
    fields: [
      { key: 'label', label: binding.dimension?.label ?? 'Place', kind: 'text' },
      { key: 'tier', label: 'Tier', kind: 'category' },
      ...cols.map(c => ({ key: c.key, label: c.label, kind: 'text' as const })),
      ...binding.measures.map(m => ({ key: m.key, label: m.label, kind: 'measure' as const, unit: m.unit })),
    ],
    rows: limited,
    meta: { total: rows.length, ...(unplaced ? { unplaced } : {}) },
  }
}

// ── Status list ──────────────────────────────────────────────────────────

/**
 * The status words the platform's feeds use. A status field's value is read
 * through the binding's map first, then these; anything else is Info.
 * ("active" is deliberately absent: an active incident and an active feed
 * mean opposite things.)
 */
const STATUS_WORDS: [RegExp, Status][] = [
  [/^(critical|fatal|severe|very_high|offline|disconnected|down|failed|failing|overdue|expired|breach(ed)?)$/i, 'critical'],
  [/^(high|warning|degraded|serious|delayed|heavy|paused|pending|due|expiring)$/i, 'warning'],
  [/^(ok|healthy|connected|operational|online|resolved|closed|completed|low|minor|free_flow|on_time|passed?)$/i, 'healthy'],
]
export function statusWord(v: unknown): Status {
  const s = String(v ?? '').trim()
  return STATUS_WORDS.find(([re]) => re.test(s))?.[1] ?? 'neutral'
}

/** A row's status: from a field's value (map, then the shared words), or the threshold on its measure. */
function rowStatus(r: Record<string, unknown>, binding: Binding): Status {
  const s = binding.status
  if (s?.field) return s.map?.[String(r[s.field] ?? '')] ?? statusWord(r[s.field])
  const m = binding.measures[0]
  if (binding.threshold && m) return statusOf(toNum(r[m.key]), binding.threshold)
  return 'neutral'
}

/** Rows ranked worst status first, then by measure (largest first). */
function statusFrame(source: Record<string, unknown>[], binding: Binding): Frame {
  const dim = binding.dimension
  const m = binding.measures[0]
  const cols = binding.columns ?? []
  const rows = source.map((r) => {
    const out: Record<string, unknown> = {
      key: dim ? r[dim.key] ?? null : null,
      label: dim ? humanize(r[dim.key]) : 'Item',
      status: rowStatus(r, binding),
      detail: cols.map(c => r[c.key]).filter(v => v != null && v !== '').map(String).join(' · '),
    }
    if (m) out[m.key] = toNum(r[m.key])
    return out
  })
  rows.sort((a, b) => {
    const d = STATUS_RANK[a.status as Status] - STATUS_RANK[b.status as Status]
    if (d || !m) return d
    return ((b[m.key] as number | null) ?? -Infinity) - ((a[m.key] as number | null) ?? -Infinity)
  })
  const total = rows.length
  const statusCounts: Partial<Record<Status, number>> = {}
  for (const r of rows) statusCounts[r.status as Status] = (statusCounts[r.status as Status] ?? 0) + 1
  return {
    fields: [
      { key: 'label', label: dim?.label ?? 'Item', kind: 'category' },
      { key: 'status', label: 'Status', kind: 'category' },
      { key: 'detail', label: 'Detail', kind: 'text' },
      ...(m ? [{ key: m.key, label: m.label, kind: 'measure' as const, unit: m.unit }] : []),
    ],
    rows: binding.limit ? rows.slice(0, binding.limit) : rows,
    meta: { total, statusCounts },
  }
}

// ── Matrix (heatmap) ─────────────────────────────────────────────────────

/**
 * Two categories x one measure: rows { x, xLabel, y, yLabel, value }.
 * Hour-of-day and weekday axes are always complete; a count is 0 for a
 * quiet slot (a real zero), any other aggregate is null (nothing to average).
 */
function matrixFrame(source: Record<string, unknown>[], binding: Binding, agg?: Aggregate): Frame {
  const m = binding.measures[0]
  if (!binding.dimension || !binding.dimension2 || !m) throw new BindingError('A heatmap needs a column field, a row field and a measure.')
  const grouped = !!agg?.by2
  const xKey = grouped ? 'x' : binding.dimension.key
  const yKey = grouped ? 'y' : binding.dimension2.key
  const xb = grouped ? agg!.bucket : undefined
  const yb = grouped ? agg!.bucket2 : undefined
  // No records at all: say so (the widget's empty state), not a grid of zeros.
  if (!source.length) {
    return { fields: [], rows: [], meta: { total: 0 } }
  }
  const cells = new Map<string, number | null>()
  const xs = new Set<string>()
  const ys = new Set<string>()
  for (const r of source) {
    const x = String(r[xKey] ?? '')
    const y = String(r[yKey] ?? '')
    if (x === '' || y === '') continue
    xs.add(x); ys.add(y)
    cells.set(`${x}\u0000${y}`, toNum(r[m.key]))
  }
  const order = (seen: Set<string>, b?: TimeBucket) => (b && FULL_CYCLE[b] ? FULL_CYCLE[b]! : [...seen].sort((a, c) => a.localeCompare(c, 'en', { numeric: true })))
  const xOrder = order(xs, xb)
  const yOrder = order(ys, yb)
  const empty = agg?.fn === 'count' ? 0 : null
  const rows: Record<string, unknown>[] = []
  for (const y of yOrder) {
    for (const x of xOrder) {
      const k = `${x}\u0000${y}`
      rows.push({ x, xLabel: bucketLabel(x, xb), y, yLabel: bucketLabel(y, yb), [m.key]: cells.has(k) ? cells.get(k) : empty })
    }
  }
  return {
    fields: [
      { key: 'xLabel', label: binding.dimension!.label, kind: 'category' },
      { key: 'yLabel', label: binding.dimension2!.label, kind: 'category' },
      { key: m.key, label: m.label, kind: 'measure', unit: m.unit },
    ],
    rows,
    meta: { total: source.length },
  }
}
