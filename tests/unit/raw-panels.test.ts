// tests/unit/raw-panels.test.ts
// MaritimeRawPanel / AviationRawPanel on the server table: right endpoint, right params, and the whole dataset
// (not the first 100 rows) is reachable.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { useGlobalScope } from '~/composables/useGlobalScope'
import MaritimeRawPanel from '~/components/MaritimeRawPanel.vue'
import AviationRawPanel from '~/components/AviationRawPanel.vue'

let $api: ReturnType<typeof vi.fn>
const COUNT = 640

// Stub the collapsible so the body renders, and expose the panel's own table through the DataTable stub's props.
const DataTableStub = { props: ['table', 'title', 'emptyText', 'empty', 'exportName', 'rowKey'], template: '<div class="dt-stub" />' }
const CollapsibleStub = { props: ['count', 'title'], template: '<section><h2>{{ title }}</h2><span class="count">{{ count }}</span><slot /></section>' }
const mountPanel = (C: any, props: Record<string, unknown>) =>
  mount(C, { props, global: { stubs: { CollapsibleSection: CollapsibleStub, DataTable: DataTableStub } } })

beforeEach(() => {
  localStorage.clear()
  $api = vi.fn(async (_path: string, opts: any) => ({ count: COUNT, results: Array.from({ length: Math.min(Number(opts.query.page_size), 25) }, (_, i) => ({ id: `r${i}` })) }))
  ;(globalThis as any).useNuxtApp = () => ({ $api })
  const store = new Map<string, any>()
  ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
  ;(globalThis as any).usePermissions = () => ({ hasMinRole: () => true, hasCapability: () => true })
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

const tableOf = (w: any) => w.findComponent(DataTableStub).props('table')

describe('MaritimeRawPanel', () => {
  it('asks the server for page 1 of the real dataset and shows the real total, not 100', async () => {
    const w = mountPanel(MaritimeRawPanel, { dataset: 'vessel-calls' })
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect($api).toHaveBeenCalledTimes(1)
    expect($api.mock.calls[0]![0]).toBe('/api/v1/aviation-maritime/maritime/vessel-calls/')
    expect($api.mock.calls[0]![1].query).toEqual({ page: 1, page_size: 25 })
    expect(w.find('.count').text()).toBe(String(COUNT))
    expect(tableOf(w).totalPages.value).toBe(Math.ceil(COUNT / 25))
  })

  it('never asks for more than the server allows per page', async () => {
    mountPanel(MaritimeRawPanel, { dataset: 'vessel-calls' })
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(Number($api.mock.calls[0]![1].query.page_size)).toBeLessThanOrEqual(100)
  })

  it('passes the page-level port selector through', async () => {
    mountPanel(MaritimeRawPanel, { dataset: 'container-dwell', port: 'KEMBA' })
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect($api.mock.calls[0]![0]).toBe('/api/v1/aviation-maritime/maritime/container-dwell/')
    expect($api.mock.calls[0]![1].query).toMatchObject({ port: 'KEMBA' })
  })

  it('server-side search and filters go to the endpoint', async () => {
    const w = mountPanel(MaritimeRawPanel, { dataset: 'vessel-calls' })
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    const t = tableOf(w)
    t.setSearch('ever given'); t.setFilter('port_unlocode', 'KEMBA', true)
    await vi.advanceTimersByTimeAsync(400); await flushPromises()
    expect($api.mock.calls.at(-1)![1].query).toMatchObject({ q: 'ever given', 'f.port_unlocode': 'KEMBA', page: 1 })
  })

  it.each([
    ['vessel-calls', ['waiting_hours', 'turnaround_hours', 'stage']],
    ['bulk-cargo', ['total_tonnes']],
    ['inspections', ['recidivist']],
  ])('%s: columns the server computes cannot be sorted or filtered', async (dataset, computed) => {
    const w = mountPanel(MaritimeRawPanel, { dataset })
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    for (const c of tableOf(w).columns.filter((c: any) => computed.includes(c.key))) {
      expect([c.key, c.sortable, c.filter]).toEqual([c.key, false, false])
    }
    // ...and an ordinary column still can
    const plain = tableOf(w).columns.find((c: any) => !computed.includes(c.key))
    expect(plain.sortable).toBeUndefined()
  })

  it('every dataset resolves to a real endpoint path', async () => {
    for (const d of ['vessel-calls', 'container-movements', 'container-dwell', 'bulk-cargo', 'pollution', 'inspections']) {
      $api.mockClear()
      mountPanel(MaritimeRawPanel, { dataset: d })
      await vi.advanceTimersByTimeAsync(0); await flushPromises()
      expect($api.mock.calls[0]![0]).toMatch(/^\/api\/v1\/aviation-maritime\/maritime\/[a-z-]+\/$/)
    }
  })
})

describe('the module county', () => {
  it('is sent with the request and refetches when it changes', async () => {
    const w = mountPanel(MaritimeRawPanel, { dataset: 'vessel-calls' })
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect($api.mock.calls[0]![1].query).not.toHaveProperty('county')
    $api.mockClear()
    useGlobalScope().setCounty('Mombasa')                                  // e.g. picked in the top bar
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect($api).toHaveBeenCalledTimes(1)
    expect($api.mock.calls[0]![1].query).toMatchObject({ county: 'Mombasa', page: 1 })
    expect(w.exists()).toBe(true)
  })

  it('does not serve one county\'s cached page to another', async () => {
    const w = mountPanel(AviationRawPanel, { dataset: 'ground-handlers' })
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    const t = tableOf(w)
    useGlobalScope().setCounty('Nairobi'); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    useGlobalScope().setCounty(null as any); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(JSON.stringify(t.query.value)).not.toContain('county')
  })
})

describe('AviationRawPanel', () => {
  it('uses the aviation endpoints and the airport selector where the dataset takes one', async () => {
    mountPanel(AviationRawPanel, { dataset: 'air-cargo', airport: 'NBO' })
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect($api.mock.calls[0]![0]).toBe('/api/v1/aviation-maritime/aviation/air-cargo-stats/')
    expect($api.mock.calls[0]![1].query).toMatchObject({ airport: 'NBO' })

    $api.mockClear()
    mountPanel(AviationRawPanel, { dataset: 'aoc', airport: 'NBO' })       // the AOC register is not per-airport
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect($api.mock.calls[0]![1].query).not.toHaveProperty('airport')
  })

  it('weather keeps its fixed aviation scope', async () => {
    mountPanel(AviationRawPanel, { dataset: 'weather' })
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect($api.mock.calls[0]![0]).toBe('/api/v1/aviation-maritime/aviation/met-observations/')
    expect($api.mock.calls[0]![1].query).toMatchObject({ scope: 'aviation' })
  })

  it('the whole dataset is reachable by paging, not just the first 100 rows', async () => {
    const w = mountPanel(AviationRawPanel, { dataset: 'ground-handlers' })
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    const t = tableOf(w)
    t.goto(t.totalPages.value); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect($api.mock.calls.at(-1)![1].query.page).toBe(Math.ceil(COUNT / 25))   // page 26 of 26: far past the old 100-row cap
  })
})
