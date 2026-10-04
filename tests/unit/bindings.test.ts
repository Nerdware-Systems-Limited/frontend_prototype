// tests/unit/bindings.test.ts
// ─────────────────────────────────────────────────────────────────────
// applyBinding: source payload -> Frame. Honest-data rules hold: missing
// values stay null (never 0), a missing path is an empty Frame, and a
// payload of the wrong shape throws instead of drawing nonsense.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { BindingError, OTHER, applyBinding, getPath, humanize, toNum } from '~/utils/bindings'
import type { Binding } from '~/types/frame'

describe('helpers', () => {
  it('reads dot paths and survives missing branches', () => {
    expect(getPath({ a: { b: { c: 3 } } }, 'a.b.c')).toBe(3)
    expect(getPath({ a: null }, 'a.b')).toBeUndefined()
    expect(getPath({ a: 1 }, '')).toEqual({ a: 1 })
  })
  it('coerces numbers without inventing zeros', () => {
    expect(toNum('1234.50')).toBe(1234.5)
    expect(toNum(7)).toBe(7)
    expect(toNum(null)).toBeNull()
    expect(toNum('')).toBeNull()
    expect(toNum('n/a')).toBeNull()
  })
  it('humanizes snake_case keys and leaves names alone', () => {
    expect(humanize('very_high')).toBe('Very high')
    expect(humanize('M-PESA')).toBe('M-PESA')
    expect(humanize('')).toBe('Unspecified')
  })
})

describe('scalar', () => {
  const b: Binding = { source: 's', shape: 'scalar', path: 'kpis.total', measures: [{ key: 'value', label: 'Total', unit: 'count' }] }
  it('reads one number', () => {
    expect(applyBinding({ kpis: { total: '42' } }, b).rows).toEqual([{ value: 42 }])
  })
  it('a null figure stays null; a missing one is an empty frame', () => {
    expect(applyBinding({ kpis: { total: null } }, b).rows).toEqual([{ value: null }])
    expect(applyBinding({ kpis: {} }, b).rows).toEqual([])
  })
  it('throws on an object where a number belongs', () => {
    expect(() => applyBinding({ kpis: { total: { x: 1 } } }, b)).toThrow(BindingError)
  })
})

describe('series', () => {
  const b: Binding = {
    source: 's', shape: 'series', path: 'volume_24h', dimension: { key: 'hour', label: 'Hour', kind: 'time' },
    measures: [{ key: 'volume', label: 'Vehicles', unit: 'count' }, { key: 'avg_speed', label: 'Speed', unit: 'kmh' }],
  }
  it('sorts by time, keeps gaps as null and drops rows without an x', () => {
    const f = applyBinding({
      volume_24h: [
        { hour: '2026-09-30T02:00:00Z', volume: 20, avg_speed: null },
        { hour: '2026-09-30T01:00:00Z', volume: '10', avg_speed: 55 },
        { hour: null, volume: 99 },
      ],
    }, b)
    expect(f.rows).toEqual([
      { hour: '2026-09-30T01:00:00Z', volume: 10, avg_speed: 55 },
      { hour: '2026-09-30T02:00:00Z', volume: 20, avg_speed: null },
    ])
    expect(f.fields.map(x => x.kind)).toEqual(['time', 'measure', 'measure'])
  })
  it('keeps the most recent points when limited', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ hour: `2026-09-30T0${i}:00:00Z`, volume: i }))
    expect(applyBinding({ volume_24h: rows }, { ...b, limit: 2 }).rows.map(r => r.volume)).toEqual([3, 4])
  })
  it('needs a dimension', () => {
    expect(() => applyBinding({ volume_24h: [] }, { ...b, dimension: undefined })).toThrow(/dimension/)
  })
})

describe('categorical', () => {
  const b: Binding = {
    source: 's', shape: 'categorical', path: 'by', dimension: { key: 'cls', label: 'Class' },
    measures: [{ key: 'total', label: 'Vehicles', unit: 'count' }],
  }
  it('sorts largest first and humanizes labels', () => {
    const f = applyBinding({ by: [{ cls: 'heavy_goods', total: 5 }, { cls: 'car', total: 50 }] }, b)
    expect(f.rows).toEqual([
      { category: 'car', label: 'Car', total: 50 },
      { category: 'heavy_goods', label: 'Heavy goods', total: 5 },
    ])
  })
  it('accepts a { category: value } record', () => {
    const f = applyBinding({ by: { low: 3, severe: 1 } }, b)
    expect(f.rows.map(r => [r.category, r.total])).toEqual([['low', 3], ['severe', 1]])
  })
  it('folds the tail into Other so colours never cycle', () => {
    const by = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((k, i) => [k, 10 - i]))
    const f = applyBinding({ by }, { ...b, limit: 3 })
    expect(f.rows.map(r => r.category)).toEqual(['a', 'b', OTHER])
    expect(f.rows[2]).toMatchObject({ label: 'Other (3)', total: 8 + 7 + 6 })
    expect(f.meta).toEqual({ total: 5, folded: 3 })
  })
  it('a missing list is an empty frame; a string is a shape error', () => {
    expect(applyBinding({}, b).rows).toEqual([])
    expect(() => applyBinding({ by: 'oops' }, b)).toThrow(BindingError)
  })
})

describe('rows', () => {
  const b: Binding = {
    source: 's', shape: 'rows', path: 'list', columns: [{ key: 'name', label: 'Name' }],
    measures: [{ key: 'n', label: 'Count', unit: 'count' }], sort: { key: 'n', dir: 'desc' },
  }
  it('keeps only declared columns, sorts and limits', () => {
    const f = applyBinding({ list: [{ name: 'A', n: 1, secret: 'x' }, { name: 'B', n: 3 }, { name: 'C', n: 2 }] }, { ...b, limit: 2 })
    expect(f.rows).toEqual([{ name: 'B', n: 3 }, { name: 'C', n: 2 }])
    expect(f.meta.total).toBe(3)
  })
})
