// tests/unit/use-endpoint-table.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useGlobalScope } from '~/composables/useGlobalScope'

let $api: ReturnType<typeof vi.fn>
beforeEach(() => {
  localStorage.clear()
  $api = vi.fn(async (_p: string, o: any) => ({ count: 80, results: [{ id: o.query.page }] }))
  ;(globalThis as any).useNuxtApp = () => ({ $api })
  const store = new Map<string, any>()
  ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('useEndpointTable', () => {
  const cols = [{ key: 'name', label: 'Name' }]

  it('calls the endpoint with the engine\'s query and the abort signal', async () => {
    const t = useEndpointTable({ key: 'a', path: '/api/v1/x/', columns: cols, pageSize: 25, persist: false })
    await t.refresh()
    expect($api).toHaveBeenCalledWith('/api/v1/x/', expect.objectContaining({ query: { page: 1, page_size: 25 }, signal: expect.any(AbortSignal) }))
    expect(t.total.value).toBe(80)
  })

  it('adds the module county, refetches when it changes, and does not share cache across counties', async () => {
    const t = useEndpointTable({ key: 'b', path: '/api/v1/x/', columns: cols, countyKey: 'maritime', persist: false })
    await t.refresh()
    expect($api.mock.calls.at(-1)![1].query).not.toHaveProperty('county')
    useGlobalScope().setCounty('Mombasa'); await vi.advanceTimersByTimeAsync(0)
    expect($api.mock.calls.at(-1)![1].query).toMatchObject({ county: 'Mombasa', page: 1 })
    const n = $api.mock.calls.length
    useGlobalScope().setCounty(null); await vi.advanceTimersByTimeAsync(0)
    expect($api.mock.calls.length).toBe(n)                       // back to a query already fetched: the cache serves it
    expect(t.query.value).not.toHaveProperty('county')
  })

  it('merges extra params and drops the empty ones', async () => {
    const port = ref<string | undefined>(undefined)
    const t = useEndpointTable({ key: 'c', path: '/api/v1/x/', columns: cols, params: () => ({ port: port.value, scope: 'a' }), persist: false })
    await t.refresh()
    expect($api.mock.calls.at(-1)![1].query).toEqual({ page: 1, page_size: 25, scope: 'a' })
    port.value = 'KEMBA'; await vi.advanceTimersByTimeAsync(0)
    expect($api.mock.calls.at(-1)![1].query).toMatchObject({ port: 'KEMBA' })
  })
})
