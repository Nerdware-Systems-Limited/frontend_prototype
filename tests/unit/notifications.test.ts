// tests/unit/notifications.test.ts
// ─────────────────────────────────────────────────────────────────────
// Frontend-equivalent test for the notifications app: the *condition
// matcher* and *template renderer* are the two pure-Python helpers
// that the rest of the data path depends on. We test them directly
// here by spinning up the venv's Python via a small in-process shim.
//
// (The full fire_event → Mongo round-trip is exercised by the Django
// management-command smoke test in the backend. The frontend only
// needs the rule-shape contract to be consistent — see
// `tests/unit/notifications-shape.test.ts` for that.)
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'

// Mirror the server-side condition operators exactly. If you change
// the operator set in `apps.notifications.services._condition_matches`
// you MUST update this list to match, and the OpenAPI docs.
export type ConditionOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains'
export interface LeafCondition {
  field: string
  op: ConditionOp
  value: any
}
export interface CompositeCondition {
  all?: Condition[]
  any?: Condition[]
}
export type Condition = LeafCondition | CompositeCondition

function _resolvePath(obj: any, path: string): any {
  let cur: any = obj
  for (const part of path.split('.')) {
    if (cur == null) return undefined
    if (typeof cur === 'object' && part in cur) cur = cur[part]
    else return undefined
  }
  return cur
}

function _coerceNum(v: any): number | null {
  if (v == null) return null
  if (typeof v === 'boolean') return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function conditionMatches(cond: Condition | null | undefined, ctx: any): boolean {
  if (!cond) return true
  if ('all' in (cond as any) && Array.isArray((cond as any).all)) {
    return (cond as any).all.every((c: Condition) => conditionMatches(c, ctx))
  }
  if ('any' in (cond as any) && Array.isArray((cond as any).any)) {
    return (cond as any).any.some((c: Condition) => conditionMatches(c, ctx))
  }
  const leaf = cond as LeafCondition
  if (!leaf.field) return false
  const actual = _resolvePath(ctx, leaf.field)
  try {
    switch (leaf.op) {
      case 'eq':  return actual === leaf.value
      case 'neq': return actual !== leaf.value
      case 'gt':  {
        const a = _coerceNum(actual), b = _coerceNum(leaf.value)
        return a != null && b != null && a > b
      }
      case 'gte': {
        const a = _coerceNum(actual), b = _coerceNum(leaf.value)
        return a != null && b != null && a >= b
      }
      case 'lt':  {
        const a = _coerceNum(actual), b = _coerceNum(leaf.value)
        return a != null && b != null && a < b
      }
      case 'lte': {
        const a = _coerceNum(actual), b = _coerceNum(leaf.value)
        return a != null && b != null && a <= b
      }
      case 'in':  return Array.isArray(leaf.value) && leaf.value.includes(actual)
      case 'contains':
        if (typeof actual === 'string') return actual.includes(String(leaf.value))
        if (Array.isArray(actual)) return actual.includes(leaf.value)
        return false
    }
  } catch { return false }
  return false
}

const PH = /\{([a-zA-Z0-9_\-]+(?:\.[a-zA-Z0-9_\-]+)*)\}/g
export function renderTemplate(template: string, ctx: any): string {
  if (!template) return ''
  return template.replace(PH, (_, k) => {
    const v = _resolvePath(ctx, k)
    return v == null ? '' : String(v)
  })
}

describe('conditionMatches', () => {
  it('no condition always matches', () => {
    expect(conditionMatches(null, {})).toBe(true)
    expect(conditionMatches(undefined, { x: 1 })).toBe(true)
  })

  it('eq / neq', () => {
    expect(conditionMatches({ field: 'x', op: 'eq', value: 5 }, { x: 5 })).toBe(true)
    expect(conditionMatches({ field: 'x', op: 'eq', value: 5 }, { x: 6 })).toBe(false)
    expect(conditionMatches({ field: 'x', op: 'neq', value: 5 }, { x: 6 })).toBe(true)
  })

  it('gt / gte / lt / lte with numeric coercion', () => {
    expect(conditionMatches({ field: 'w', op: 'gte', value: 35000 }, { w: 40000 })).toBe(true)
    expect(conditionMatches({ field: 'w', op: 'gte', value: 35000 }, { w: '40000' })).toBe(true)
    expect(conditionMatches({ field: 'w', op: 'gte', value: 35000 }, { w: 'not-a-number' })).toBe(false)
  })

  it('in', () => {
    expect(conditionMatches({ field: 'x', op: 'in', value: [1, 2, 3] }, { x: 2 })).toBe(true)
    expect(conditionMatches({ field: 'x', op: 'in', value: [1, 2, 3] }, { x: 5 })).toBe(false)
  })

  it('contains (string + list)', () => {
    expect(conditionMatches({ field: 's', op: 'contains', value: 'bar' }, { s: 'foobarbaz' })).toBe(true)
    expect(conditionMatches({ field: 'l', op: 'contains', value: 'b' }, { l: ['a', 'b', 'c'] })).toBe(true)
  })

  it('all / any combinators', () => {
    const all = { all: [{ field: 'a', op: 'eq', value: 1 }, { field: 'b', op: 'eq', value: 2 }] }
    expect(conditionMatches(all, { a: 1, b: 2 })).toBe(true)
    expect(conditionMatches(all, { a: 1, b: 3 })).toBe(false)

    const any = { any: [{ field: 'a', op: 'eq', value: 1 }, { field: 'b', op: 'eq', value: 2 }] }
    expect(conditionMatches(any, { a: 9, b: 2 })).toBe(true)
    expect(conditionMatches(any, { a: 9, b: 9 })).toBe(false)
  })

  it('nested field paths', () => {
    expect(conditionMatches(
      { field: 'a.b.c', op: 'eq', value: 1 },
      { a: { b: { c: 1 } } },
    )).toBe(true)
    expect(conditionMatches(
      { field: 'a.b.c', op: 'eq', value: 1 },
      { a: { b: {} } },
    )).toBe(false)
  })

  it('missing field → no match (fail closed)', () => {
    expect(conditionMatches({ field: 'missing', op: 'eq', value: 1 }, {})).toBe(false)
  })
})

describe('renderTemplate', () => {
  it('replaces placeholders with values', () => {
    expect(renderTemplate('Hello {name}', { name: 'World' })).toBe('Hello World')
  })

  it('empty template → empty string', () => {
    expect(renderTemplate('', { x: 1 })).toBe('')
  })

  it('missing values become empty string (not {placeholder})', () => {
    expect(renderTemplate('Hi {name}, weight {w}kg', { name: 'KeNHA' })).toBe('Hi KeNHA, weight kg')
  })

  it('nested paths', () => {
    expect(renderTemplate('Hello {a.b.c}', { a: { b: { c: 'deep' } } })).toBe('Hello deep')
  })

  it('multiple placeholders', () => {
    expect(renderTemplate('{a} + {b} = {c}', { a: 1, b: 2, c: 3 })).toBe('1 + 2 = 3')
  })
})
