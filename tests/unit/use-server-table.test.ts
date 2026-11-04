// tests/unit/use-server-table.test.ts
// The headless engine behind <DataTable>: query building, debounce, stale-response protection, caching,
// remembered preferences and export-everything.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { useServerTable, SERVER_MAX_PAGE_SIZE, defaultFilterKind } from '~/composables/useServerTable'
import type { TableColumn, PagedResult } from '~/types/dataTable'

const COLS: TableColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status', type: 'badge', badge: { open: 'success', closed: 'danger' } },
  { key: 'eta', label: 'ETA', type: 'datetime' },
  { key: 'tonnes', label: 'Tonnes', type: 'num' },
  { key: 'active', label: 'Active', type: 'bool' },
  { key: 'port_name', label: 'Port', sortable: 'port__name', filterKey: 'port_unlocode' },
  { key: 'computed', label: 'Computed', render: r => String(r.tonnes * 2) },
]

const page = (n: number, count = 140, size = 25): PagedResult => ({
  count,
  results: Array.from({ length: Math.min(size, Math.max(0, count - (n - 1) * size)) }, (_, i) => ({ id: `r${(n - 1) * size + i}`, name: `Row ${(n - 1) * size + i}` })),
})

let fetcher: ReturnType<typeof vi.fn>
const make = (extra: Record<string, unknown> = {}) =>
  useServerTable({ key: 'test', columns: COLS, fetcher: (p, c) => fetcher(p, c), pageSize: 25, debounceMs: 300, ...extra })
const lastParams = () => fetcher.mock.calls.at(-1)![0]

beforeEach(() => {
  localStorage.clear()
  fetcher = vi.fn(async (p: any) => page(Number(p.page), 140, Number(p.page_size)))
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('first load and paging', () => {
  it('fetches page 1 on mount and exposes the real total, not the page length', async () => {
    const holder: any = {}
    mount(defineComponent({ setup() { holder.t = make(); return () => null } }))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(lastParams()).toEqual({ page: 1, page_size: 25 })
    expect(holder.t.rows.value).toHaveLength(25)
    expect(holder.t.total.value).toBe(140)
    expect(holder.t.totalPages.value).toBe(6)
    expect([holder.t.firstRow.value, holder.t.lastRow.value]).toEqual([1, 25])
  })

  it('goto fetches that page and clamps to the real range', async () => {
    const t = make()
    await t.refresh()
    t.goto(3); await vi.advanceTimersByTimeAsync(0)
    expect(lastParams().page).toBe(3)
    expect([t.firstRow.value, t.lastRow.value]).toEqual([51, 75])
    t.goto(999); await vi.advanceTimersByTimeAsync(0)
    expect(t.page.value).toBe(6)
    t.goto(-4); await vi.advanceTimersByTimeAsync(0)
    expect(t.page.value).toBe(1)
  })

  it('changing the page size keeps the first visible row on screen', async () => {
    const t = make()
    await t.refresh()
    t.goto(3)                             // rows 51-75
    t.setPageSize(50)                     // row 51 is now on page 2 (51-100)
    expect(t.page.value).toBe(2)
    t.setPageSize(7 as any)               // not one of the offered sizes: ignored
    expect(t.pageSize.value).toBe(50)
  })

  it('lands on the last real page when the result set shrinks under it', async () => {
    const t = make()
    await t.refresh()
    t.goto(6); await vi.advanceTimersByTimeAsync(0)
    fetcher.mockImplementation(async () => ({ count: 30, results: [] }))
    await t.refresh()
    expect(t.page.value).toBe(2)
  })
})

describe('search and filters', () => {
  it('debounces typing into one request and goes back to page 1', async () => {
    const t = make()
    await t.refresh()
    t.goto(4); await vi.advanceTimersByTimeAsync(0)
    fetcher.mockClear()
    for (const s of ['m', 'mo', 'mom', 'momb']) { t.setSearch(s); await vi.advanceTimersByTimeAsync(100) }
    expect(fetcher).not.toHaveBeenCalled()                      // still typing
    await vi.advanceTimersByTimeAsync(300)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(lastParams()).toEqual({ page: 1, page_size: 25, q: 'momb' })
  })

  it('builds the filter parameters the backend understands', async () => {
    const t = make()
    await t.refresh()
    t.setFilter('name', 'abc')
    t.setFilter('status', 'open', true)
    t.setFilter('active', 'true', true)
    t.setFilter('eta', { from: '2026-01-01', to: '2026-01-31' }, true)
    t.setFilter('tonnes', { from: '10' }, true)
    t.setFilter('port_name', 'KEMBA', true)
    await vi.advanceTimersByTimeAsync(400)
    expect(lastParams()).toEqual({
      page: 1, page_size: 25,
      'f.name': 'abc',
      'f.status__exact': 'open',                 // a choice is exact, not "contains"
      'f.active': 'true',
      'f.eta__gte': '2026-01-01', 'f.eta__lte': '2026-01-31',
      'f.tonnes__gte': '10',
      'f.port_unlocode': 'KEMBA',                // filterKey overrides the display key
    })
  })

  it('empty values clear a filter; clearAll resets search and every filter', async () => {
    const t = make()
    await t.refresh()
    t.setFilter('name', 'abc', true); t.setSearch('x'); await vi.advanceTimersByTimeAsync(400)
    t.setFilter('name', '', true); await vi.advanceTimersByTimeAsync(0)
    expect(t.query.value).toEqual({ page: 1, page_size: 25, q: 'x' })
    t.clearAll(); await vi.advanceTimersByTimeAsync(0)
    // (asserted on the query, not the last request: this exact page was already fetched, so the cache serves it)
    expect(t.query.value).toEqual({ page: 1, page_size: 25 })
    expect(t.activeFilterCount.value).toBe(0)
  })

  it('external params refetch when they change and drop empty values', async () => {
    const { ref } = await import('vue')
    const port = ref<string | undefined>(undefined)
    const t = make({ params: () => ({ port: port.value, scope: 'aviation' }) })
    await t.refresh()
    expect(lastParams()).toEqual({ page: 1, page_size: 25, scope: 'aviation' })
    port.value = 'KEMBA'; await vi.advanceTimersByTimeAsync(0)
    expect(lastParams()).toEqual({ page: 1, page_size: 25, scope: 'aviation', port: 'KEMBA' })
  })
})

describe('sorting', () => {
  it('click cycles ascending, descending, off', async () => {
    const t = make()
    await t.refresh()
    t.toggleSort('name'); await vi.advanceTimersByTimeAsync(0)
    expect(lastParams().ordering).toBe('name')
    t.toggleSort('name'); await vi.advanceTimersByTimeAsync(0)
    expect(lastParams().ordering).toBe('-name')
    t.toggleSort('name'); await vi.advanceTimersByTimeAsync(0)
    expect(t.query.value).not.toHaveProperty('ordering')
  })

  it('a plain click replaces the sort; shift-click builds a multi-column sort', async () => {
    const t = make()
    await t.refresh()
    t.toggleSort('name'); t.toggleSort('tonnes')
    expect(t.sort.value.map(s => s.key)).toEqual(['tonnes'])
    t.toggleSort('name', true)
    expect(t.sort.value.map(s => s.key)).toEqual(['tonnes', 'name'])
    expect(t.sortRank('name')).toBe(2)
    await vi.advanceTimersByTimeAsync(0)
    expect(lastParams().ordering).toBe('tonnes,name')
    t.toggleSort('tonnes', true)                         // asc -> desc, order kept
    expect(t.sort.value).toEqual([{ key: 'tonnes', dir: 'desc' }, { key: 'name', dir: 'asc' }])
  })

  it('sorts by the column\'s sortable field when it differs from the display key', async () => {
    const t = make()
    await t.refresh()
    t.toggleSort('port_name', false); t.toggleSort('port_name', false)
    await vi.advanceTimersByTimeAsync(0)
    expect(lastParams().ordering).toBe('-port__name')
  })

  it('sorting goes back to page 1', async () => {
    const t = make()
    await t.refresh()
    t.goto(4)
    t.toggleSort('name')
    expect(t.page.value).toBe(1)
  })
})

describe('requests that arrive out of order', () => {
  it('a slow earlier request can never overwrite a newer one', async () => {
    const t = make({ cacheMs: 0 })
    await t.refresh()                                        // learn the total so page 2 exists
    let releaseSlow!: (v: PagedResult) => void
    fetcher.mockImplementationOnce(() => new Promise<PagedResult>(r => { releaseSlow = r }))   // the next request is slow
    const first = t.refresh()
    t.goto(2)                                                // page 2 (fast, default mock)
    await vi.advanceTimersByTimeAsync(0)
    expect(t.rows.value[0]!.name).toBe('Row 25')
    releaseSlow({ count: 140, results: [{ id: 'old', name: 'OLD' }] })
    await first
    expect(t.rows.value[0]!.name).toBe('Row 25')            // still page 2's rows
    expect(t.loading.value).toBe(false)
  })

  it('aborts the superseded request', async () => {
    const signals: AbortSignal[] = []
    fetcher.mockImplementation(async (p: any, c: any) => { signals.push(c.signal); return page(Number(p.page)) })
    const t = make({ cacheMs: 0 })
    await t.refresh()
    t.goto(2); await vi.advanceTimersByTimeAsync(0)
    expect(signals[0]!.aborted).toBe(true)
    expect(signals[1]!.aborted).toBe(false)
  })

  it('an aborted request is not reported as an error', async () => {
    fetcher.mockImplementationOnce(async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e })
    const t = make()
    await t.refresh()
    expect(t.error.value).toBeNull()
  })
})

describe('caching', () => {
  it('going back to a fetched page does not refetch; refresh does', async () => {
    const t = make()
    await t.refresh()
    t.goto(2); await vi.advanceTimersByTimeAsync(0)
    fetcher.mockClear()
    t.goto(1); await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).not.toHaveBeenCalled()
    expect(t.rows.value[0]!.name).toBe('Row 0')
    await t.refresh()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('refresh drops EVERY cached page, so an edit elsewhere cannot leave a stale one behind', async () => {
    let version = 1
    fetcher.mockImplementation(async (p: any) => ({ count: 140, results: [{ id: `p${p.page}`, name: `v${version} page ${p.page}` }] }))
    const t = make()
    await t.refresh()
    t.goto(2); await vi.advanceTimersByTimeAsync(0)
    t.goto(1); await vi.advanceTimersByTimeAsync(0)
    version = 2                                                   // e.g. an alert was resolved
    await t.refresh()                                             // refreshes page 1...
    fetcher.mockClear()
    t.goto(2); await vi.advanceTimersByTimeAsync(0)               // ...and page 2 must NOT come from the old cache
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(t.rows.value[0]!.name).toBe('v2 page 2')
  })

  it('a cached page expires', async () => {
    const t = make({ cacheMs: 1000 })
    await t.refresh()
    t.goto(2); await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1500)
    fetcher.mockClear()
    t.goto(1); await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})

describe('errors', () => {
  it('reports a failure, empties the table, and recovers on retry', async () => {
    fetcher.mockRejectedValueOnce({ data: { detail: 'Not allowed' } })
    const t = make()
    await t.refresh()
    expect(t.error.value).toBe('Not allowed')
    expect(t.rows.value).toEqual([])
    await t.refresh()
    expect(t.error.value).toBeNull()
    expect(t.rows.value).toHaveLength(25)
  })
})

describe('remembered preferences', () => {
  it('remembers page size, sort, column layout and density - not search, filters or page', async () => {
    const a = make()
    a.setPageSize(50); a.toggleSort('name'); a.toggleColumn('eta'); a.moveColumn('tonnes', 'name'); a.resizeColumn('name', 220)
    a.density.value = 'compact'
    a.setSearch('x'); a.setFilter('name', 'y', true); a.goto(2)
    await nextTick()
    const b = make()
    expect(b.pageSize.value).toBe(50)
    expect(b.sort.value).toEqual([{ key: 'name', dir: 'asc' }])
    expect(b.layout.value.hidden).toEqual(['eta'])
    expect(b.layout.value.order.slice(0, 2)).toEqual(['tonnes', 'name'])
    expect(b.widthOf('name')).toBe(220)
    expect(b.density.value).toBe('compact')
    expect([b.search.value, Object.keys(b.filters.value).length, b.page.value]).toEqual(['', 0, 1])
  })

  it('tables with different keys do not share preferences', async () => {
    make().setPageSize(100); await nextTick()
    expect(useServerTable({ key: 'other', columns: COLS, fetcher: (p, c) => fetcher(p, c) }).pageSize.value).toBe(25)
  })

  it('survives a schema change: drops removed columns, appends new ones', async () => {
    const a = make(); a.toggleColumn('eta'); a.moveColumn('tonnes', 'name'); await nextTick()
    const fewer = COLS.filter(c => c.key !== 'tonnes').concat({ key: 'brand_new', label: 'New' })
    const b = useServerTable({ key: 'test', columns: fewer, fetcher: (p, c) => fetcher(p, c) })
    expect(b.layout.value.order).not.toContain('tonnes')
    expect(b.layout.value.order.at(-1)).toBe('brand_new')
    expect(b.layout.value.hidden).toEqual(['eta'])
  })

  it('ignores corrupt storage', () => {
    localStorage.setItem('uapts_table:v1:test', '{not json')
    expect(make().pageSize.value).toBe(25)
    localStorage.setItem('uapts_table:v1:test', JSON.stringify({ pageSize: 7, sort: [{ key: 'ghost', dir: 'asc' }, { key: 'name', dir: 'sideways' }], density: 'huge' }))
    const t = make()
    expect([t.pageSize.value, t.sort.value, t.density.value]).toEqual([25, [], 'standard'])
  })

  it('persist: false remembers nothing', async () => {
    make({ persist: false }).setPageSize(100); await nextTick()
    expect(localStorage.getItem('uapts_table:v1:test')).toBeNull()
  })

  it('resetLayout restores the schema defaults', async () => {
    const t = make({ defaultSort: [{ key: 'tonnes', dir: 'desc' }] })
    t.toggleColumn('eta'); t.setPageSize(100); t.toggleSort('name'); t.density.value = 'comfortable'
    t.resetLayout()
    expect([t.layout.value.hidden, t.pageSize.value, t.sort.value, t.density.value]).toEqual([[], 25, [{ key: 'tonnes', dir: 'desc' }], 'standard'])
  })
})

describe('column layout', () => {
  it('never hides the last visible column', () => {
    const t = make({ persist: false })
    for (const c of COLS) t.toggleColumn(c.key)
    expect(t.visibleColumns.value).toHaveLength(1)
  })

  it('a column that starts hidden stays hidden until shown', () => {
    const t = useServerTable({ key: 'h', columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B', hidden: true }], fetcher: async () => ({ count: 0, results: [] }), persist: false })
    expect(t.visibleColumns.value.map(c => c.key)).toEqual(['a'])
    t.toggleColumn('b')
    expect(t.visibleColumns.value.map(c => c.key)).toEqual(['a', 'b'])
  })

  it('resizing respects min and max width', () => {
    const t = useServerTable({ key: 'r', columns: [{ key: 'a', label: 'A', minWidth: 80, maxWidth: 300 }], fetcher: async () => ({ count: 0, results: [] }), persist: false })
    t.resizeColumn('a', 10); expect(t.widthOf('a')).toBe(80)
    t.resizeColumn('a', 9999); expect(t.widthOf('a')).toBe(300)
  })

  it('moveColumn moves before a column, or to the end', () => {
    const t = make({ persist: false })
    t.moveColumn('tonnes', 'name'); expect(t.layout.value.order[0]).toBe('tonnes')
    t.moveColumn('tonnes', null); expect(t.layout.value.order.at(-1)).toBe('tonnes')
  })
})

describe('export everything that matches', () => {
  it('pages through the whole result set 100 at a time with the same search, filters and sort', async () => {
    fetcher.mockImplementation(async (p: any) => {
      const n = Number(p.page), size = Number(p.page_size)
      return { count: 250, results: Array.from({ length: Math.min(size, 250 - (n - 1) * size) }, (_, i) => ({ id: (n - 1) * size + i })) }
    })
    const t = make()
    t.setSearch('x'); t.setFilter('active', 'true', true); t.toggleSort('name')
    await vi.advanceTimersByTimeAsync(400)
    fetcher.mockClear()
    const { rows, truncated } = await t.fetchAll()
    expect(rows).toHaveLength(250)
    expect(truncated).toBe(false)
    expect(fetcher.mock.calls.map(c => c[0].page)).toEqual([1, 2, 3])
    for (const [p] of fetcher.mock.calls) expect(p).toMatchObject({ page_size: SERVER_MAX_PAGE_SIZE, q: 'x', 'f.active': 'true', ordering: 'name' })
    expect(t.exporting.value).toBe(false)
  })

  it('stops at the row cap and says it was truncated', async () => {
    fetcher.mockImplementation(async (p: any) => ({ count: 5000, results: Array.from({ length: 100 }, (_, i) => ({ id: `${p.page}-${i}` })) }))
    const t = make()
    const { rows, truncated } = await t.fetchAll(250)
    expect(truncated).toBe(true)
    expect(rows).toHaveLength(250)
  })

  it('stops when a page comes back empty instead of looping', async () => {
    fetcher.mockImplementation(async () => ({ count: 999, results: [] }))
    const { rows } = await make().fetchAll()
    expect(rows).toEqual([])
  })
})

describe('defaultFilterKind', () => {
  it.each([
    [{ key: 'a', label: 'A' }, 'text'],
    [{ key: 'a', label: 'A', type: 'mono' }, 'text'],
    [{ key: 'a', label: 'A', type: 'num' }, 'number'],
    [{ key: 'a', label: 'A', type: 'date' }, 'date'],
    [{ key: 'a', label: 'A', type: 'datetime' }, 'date'],
    [{ key: 'a', label: 'A', type: 'bool' }, 'bool'],
    [{ key: 'a', label: 'A', type: 'badge', badge: { x: 'info' } }, 'select'],
    [{ key: 'a', label: 'A', type: 'badge', badge: {} }, 'text'],
    [{ key: 'a', label: 'A', type: 'join' }, false],
    [{ key: 'a', label: 'A', render: () => '' }, false],
    [{ key: 'a', label: 'A', filter: false }, false],
    [{ key: 'a', label: 'A', type: 'num', filter: 'text' }, 'text'],
  ] as const)('%j -> %s', (col, kind) => expect(defaultFilterKind(col as TableColumn)).toBe(kind))
})
