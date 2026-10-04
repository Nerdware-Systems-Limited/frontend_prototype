/**
 * applyBinding(payload, binding) -> Frame. Pure, no Vue.
 *
 * Honest-data rules carry through: a value the API didn't return stays null
 * (drawn as a gap / "-"), never 0; a path the payload doesn't have yields an
 * empty Frame (the widget says so) rather than a guess; a payload of the
 * wrong shape throws, so the widget reports "unexpected response" instead of
 * drawing nonsense.
 */
import type { Binding, Frame, FrameField } from '~/types/frame'

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

export function applyBinding(payload: unknown, binding: Binding): Frame {
  const measureFields: FrameField[] = binding.measures.map(m => ({ key: m.key, label: m.label, kind: 'measure', unit: m.unit }))
  const raw = getPath(payload, binding.path)

  if (binding.shape === 'scalar') {
    if (raw != null && typeof raw === 'object') throw new BindingError(`Expected a number at '${binding.path}'.`)
    const m = binding.measures[0]!
    return {
      fields: [{ key: m.key, label: m.label, kind: 'measure', unit: m.unit }],
      rows: raw === undefined ? [] : [{ [m.key]: toNum(raw) }],
      meta: { total: raw === undefined ? 0 : 1 },
    }
  }

  const source = asRows(raw, binding)
  const dim = binding.dimension

  if (binding.shape === 'series') {
    if (!dim) throw new BindingError('A series binding needs a dimension (the x key).')
    const rows = source.map((r) => {
      const out: Record<string, unknown> = { [dim.key]: r[dim.key] }
      for (const m of binding.measures) out[m.key] = toNum(r[m.key])
      return out
    }).filter(r => r[dim.key] != null)
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
