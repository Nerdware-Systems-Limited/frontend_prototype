// tests/unit/use-server-count.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useServerCount } from '~/composables/useServerCount'

let $api: ReturnType<typeof vi.fn>
beforeEach(() => {
  $api = vi.fn(async () => ({
    count: 42, results: [],
    aggregates: { 'avg:avg_dwell_seconds': 38.5, 'sum:amount': 1200, 'distinct:route_name': 6, 'avg:empty': null },
    groups: { has_shelter: [{ value: true, count: 31 }, { value: false, count: 11 }] },
  }))
  ;(globalThis as any).useNuxtApp = () => ({ $api })
})
afterEach(() => vi.useRealTimers())

function host(path: string, params: any, opts: any) {
  const holder: any = {}
  mount(defineComponent({ setup() { holder.c = useServerCount(path, params, opts); return () => null } }))
  return holder
}

describe('useServerCount', () => {
  it('asks for one row plus the aggregates and groups, in a single request', async () => {
    host('/x/', { county: 'Nairobi' }, { aggregate: ['avg:avg_dwell_seconds', 'distinct:route_name'], groupBy: ['has_shelter'] })
    await flushPromises()
    expect($api).toHaveBeenCalledTimes(1)
    expect($api).toHaveBeenCalledWith('/x/', { query: { county: 'Nairobi', page_size: 1, aggregate: 'avg:avg_dwell_seconds,distinct:route_name', group_by: 'has_shelter' } })
  })

  it('a plain count sends no aggregate parameters at all', async () => {
    host('/x/', undefined, {})
    await flushPromises()
    expect($api.mock.calls[0]![1].query).toEqual({ page_size: 1 })
  })

  it('exposes the count, aggregates and group helpers', async () => {
    const { c } = host('/x/', undefined, { aggregate: ['avg:avg_dwell_seconds'], groupBy: ['has_shelter'] })
    await flushPromises()
    expect(c.count.value).toBe(42)
    expect(c.avg('avg_dwell_seconds')).toBe(38.5)
    expect(c.sum('amount')).toBe(1200)
    expect(c.distinct('route_name')).toBe(6)
    expect(c.groupCount('has_shelter', true)).toBe(31)
    expect(c.groupCount('has_shelter', false)).toBe(11)
    expect(c.groupPct('has_shelter', true)).toBeCloseTo(73.81, 1)
  })

  it('is null - never 0 - when there is nothing to report', async () => {
    const { c } = host('/x/', undefined, {})
    expect(c.count.value).toBeNull()                                     // before it has loaded
    expect(c.avg('x')).toBeNull()
    expect(c.groupCount('has_shelter', true)).toBeNull()
    await flushPromises()
    expect(c.avg('empty')).toBeNull()                                    // the server said null (no rows)
    expect(c.avg('not_requested')).toBeNull()
    expect(c.groupCount('not_grouped', true)).toBeNull()
    expect(c.groupCount('has_shelter', 'something else')).toBe(0)        // a group value with no rows is a real 0
  })

  it('a failed request is unavailable, not zero', async () => {
    $api.mockRejectedValue(new Error('down'))
    const { c } = host('/x/', undefined, { aggregate: ['avg:a'] })
    await flushPromises()
    expect(c.count.value).toBeNull()
    expect(c.failed.value).toBe(true)
    expect(c.avg('a')).toBeNull()
  })

  it('refetches when the params change and ignores a stale response', async () => {
    const county = ref('A')
    let release!: (v: any) => void
    $api.mockImplementationOnce(() => new Promise(r => { release = r }))
    const { c } = host('/x/', () => ({ county: county.value }), {})
    county.value = 'B'
    await flushPromises()
    expect($api).toHaveBeenCalledTimes(2)
    release({ count: 999, results: [] })                                 // the slow first request lands late
    await flushPromises()
    expect(c.count.value).toBe(42)                                       // the newer answer stands
  })

  it('groupPct is null with no rows', async () => {
    $api.mockResolvedValue({ count: 0, results: [], groups: { has_shelter: [] } })
    const { c } = host('/x/', undefined, { groupBy: ['has_shelter'] })
    await flushPromises()
    expect(c.groupPct('has_shelter', true)).toBeNull()
  })
})
