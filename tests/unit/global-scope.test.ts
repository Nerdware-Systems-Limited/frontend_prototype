// tests/unit/global-scope.test.ts
// The system-wide period + county: a DEFAULT every module follows until it picks its own.
import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useGlobalScope } from '~/composables/useGlobalScope'
import { useTimeRange } from '~/composables/useTimeRange'
import { useCountyScope } from '~/composables/useCountyScope'

const store = new Map<string, any>()
beforeEach(() => {
  store.clear()
  sessionStorage.clear()
  ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
})

describe('time range: module vs global', () => {
  it('an untouched module follows the global range', () => {
    const g = useGlobalScope()
    const r = useTimeRange('aviation', { default: '7d' })
    expect(r.mode.value).toBe('7d')
    g.setRange({ mode: '30d', year: 2026 })
    expect(r.mode.value).toBe('30d')
    expect(r.isGlobal.value).toBe(true)
    expect(r.query.value).toEqual({ days: 30 })
  })

  it('picking a range on a module overrides the global one for that module only', () => {
    const g = useGlobalScope()
    g.setRange({ mode: '30d', year: 2026 })
    const a = useTimeRange('aviation', { default: '7d' })
    const b = useTimeRange('maritime', { default: '7d' })
    a.setMode('24h')
    expect(a.mode.value).toBe('24h')
    expect(a.isOverridden.value).toBe(true)
    expect(a.isGlobal.value).toBe(false)
    expect(b.mode.value).toBe('30d')            // the other module still follows global
    g.setRange({ mode: '7d', year: 2026 })
    expect(a.mode.value).toBe('24h')            // an override survives later global changes
    expect(b.mode.value).toBe('7d')
  })

  it('reset hands the module back to the global range', () => {
    const g = useGlobalScope()
    g.setRange({ mode: '30d', year: 2026 })
    const r = useTimeRange('aviation', { default: '7d' })
    r.setMode('24h')
    r.reset()
    expect(r.mode.value).toBe('30d')
    expect(r.isOverridden.value).toBe(false)
  })

  it('with no global range nothing changes: the module default applies', () => {
    const r = useTimeRange('aviation', { default: '7d' })
    expect(r.mode.value).toBe('7d')
    expect(r.isGlobal.value).toBe(false)
  })

  it('a global range the module cannot answer falls back to its default instead of an unsupported query', () => {
    const g = useGlobalScope()
    g.setRange({ mode: 'custom', year: 2026, from: '2026-01-01', to: '2026-02-01' })
    const noCustom = useTimeRange('aviation', { default: '7d' })
    expect(noCustom.mode.value).toBe('7d')
    const withCustom = useTimeRange('safety', { default: '30d', custom: true })
    expect(withCustom.query.value).toEqual({ date_from: '2026-01-01', date_to: '2026-02-01' })
  })

  it('editing starts from the global range, not the module default', () => {
    const g = useGlobalScope()
    g.setRange({ mode: 'year', year: 2024 })
    const r = useTimeRange('safety', { default: '30d', years: true })
    r.stepYear(1)
    expect(r.year.value).toBe(2025)
  })

  it('exposes the range in force as a RangeSelection', () => {
    const r = useTimeRange('safety', { default: '30d' })
    expect(r.selection.value).toMatchObject({ mode: '30d' })
  })
})

describe('county scope', () => {
  it('follows the global county until the module picks its own', () => {
    const g = useGlobalScope()
    const c = useCountyScope('safety')
    expect(c.county.value).toBeNull()
    g.setCounty('Nairobi')
    expect(c.county.value).toBe('Nairobi')
    expect(c.query.value).toEqual({ county: 'Nairobi' })
    expect(c.isGlobal.value).toBe(true)
    c.set('Mombasa')
    expect(c.county.value).toBe('Mombasa')
    g.setCounty('Kisumu')
    expect(c.county.value).toBe('Mombasa')
  })

  it('"All counties" on a module is an explicit override, not a fallback to global', () => {
    const g = useGlobalScope()
    g.setCounty('Nairobi')
    const c = useCountyScope('safety')
    c.set(null)
    expect(c.county.value).toBeNull()
    expect(c.query.value).toEqual({})
    expect(c.label.value).toBe('All counties')
    c.reset()
    expect(c.county.value).toBe('Nairobi')
  })
})

describe('global scope store', () => {
  it('persists for the session and rehydrates', () => {
    const g = useGlobalScope()
    g.setRange({ mode: '7d', year: 2026 })
    g.setCounty('Nairobi')
    expect(JSON.parse(sessionStorage.getItem('uapts_global_scope')!)).toMatchObject({ county: 'Nairobi', range: { mode: '7d' } })
    store.clear()                                // a reload: in-memory state gone
    const again = useGlobalScope()
    expect(again.county.value).toBe('Nairobi')
    expect(again.range.value?.mode).toBe('7d')
  })

  it('clear removes both parts and the stored copy', () => {
    const g = useGlobalScope()
    g.setCounty('Nairobi')
    g.clear()
    expect(g.isActive.value).toBe(false)
    expect(sessionStorage.getItem('uapts_global_scope')).toBeNull()
  })

  it('ignores a corrupt or hand-edited stored value', () => {
    sessionStorage.setItem('uapts_global_scope', '{"range":{"mode":"forever","year":"x"},"county":42}')
    const g = useGlobalScope()
    expect(g.isActive.value).toBe(false)
    sessionStorage.setItem('uapts_global_scope', 'not json')
    store.clear()
    expect(useGlobalScope().isActive.value).toBe(false)
  })

  it('a stored custom range without valid dates is dropped', () => {
    sessionStorage.setItem('uapts_global_scope', '{"range":{"mode":"custom","year":2026},"county":null}')
    expect(useGlobalScope().range.value).toBeNull()
  })
})
