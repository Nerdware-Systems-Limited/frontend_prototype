// tests/unit/data-table.test.ts
// <DataTable> over a real engine: what a user can do, and that every action reaches the server query.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import DataTable from '~/components/DataTable.vue'
import { useServerTable } from '~/composables/useServerTable'
import type { PagedResult, TableColumn } from '~/types/dataTable'

const exportCsv = vi.fn()
vi.mock('~/composables/useCsvExport', () => ({ useCsvExport: () => ({ exportCsv }) }))

const COLS: TableColumn[] = [
  { key: 'call_id', label: 'Call', type: 'mono' },
  { key: 'stage', label: 'Stage', type: 'badge', badge: { arrived: 'info', departed: 'success' } },
  { key: 'tonnes', label: 'Tonnes', type: 'num', digits: 1 },
  { key: 'active', label: 'Active', type: 'bool' },
  { key: 'eta', label: 'ETA', type: 'date' },
  { key: 'hours', label: 'Hours', sortable: false, filter: false, priority: 3 },
]

const rowsFor = (n: number, size: number, count: number) =>
  Array.from({ length: Math.min(size, Math.max(0, count - (n - 1) * size)) }, (_, i) => {
    const k = (n - 1) * size + i
    return { id: `id${k}`, call_id: `CALL-${k}`, stage: 'arrived', tonnes: 12.345, active: true, eta: '2026-01-15', hours: 3 }
  })

let fetcher: ReturnType<typeof vi.fn>
let perms = { role: true, cap: true }
const stubs = { BadgePill: { template: '<span class="badge"><slot /></span>' } }

function setup(opts: { count?: number } = {}) {
  const count = opts.count ?? 140
  fetcher = vi.fn(async (p: any): Promise<PagedResult> => ({ count, results: rowsFor(Number(p.page), Number(p.page_size), count) }))
  const holder: any = {}
  const Host = defineComponent({
    setup() {
      holder.table = useServerTable({ key: 'dt-test', columns: COLS, fetcher: (p, c) => fetcher(p, c), pageSize: 25, debounceMs: 300 })
      return () => h(DataTable, { table: holder.table, rowKey: 'id', title: 'Calls', exportName: 'calls' })
    },
  })
  const wrapper = mount(Host, { global: { stubs }, attachTo: document.body })
  return { wrapper, holder }
}
const lastParams = () => fetcher.mock.calls.at(-1)![0]
const settle = async () => { await vi.advanceTimersByTimeAsync(0); await flushPromises() }

beforeEach(() => {
  localStorage.clear()
  exportCsv.mockClear()
  perms = { role: true, cap: true }
  ;(globalThis as any).usePermissions = () => ({ hasMinRole: () => perms.role, hasCapability: () => perms.cap })
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as any
  vi.useFakeTimers()
})
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = '' })

describe('rendering', () => {
  it('shows the headers, one page of rows, and the real total', async () => {
    const { wrapper } = setup()
    await settle()
    expect(wrapper.findAll('thead tr:first-child th').map(th => th.text())).toEqual(['Call', 'Stage', 'Tonnes', 'Active', 'ETA', 'Hours'])
    expect(wrapper.findAll('tbody tr')).toHaveLength(25)
    expect(wrapper.find('.dt-status').text()).toBe('Showing 1–25 of 140')
    expect(wrapper.text()).toContain('Page')
    expect(wrapper.text()).toContain('of 6')
  })

  it('formats cells by type: badge, number, boolean, date, missing', async () => {
    const { wrapper } = setup()
    await settle()
    const cells = wrapper.findAll('tbody tr:first-child td').map(td => td.text())
    expect(cells).toEqual(['CALL-0', 'arrived', '12.3', 'Yes', '15 Jan 2026', '3'])
    expect(wrapper.find('tbody tr:first-child .badge').exists()).toBe(true)
  })

  it('a custom cell slot replaces the default', async () => {
    fetcher = vi.fn(async () => ({ count: 1, results: [{ id: 'a', call_id: 'X', stage: 'arrived', tonnes: 1, active: false, eta: null, hours: null }] }))
    const Host = defineComponent({ setup() { const t = useServerTable({ key: 'slot', columns: COLS, fetcher: (p, c) => fetcher(p, c), persist: false }); return () => h(DataTable, { table: t }, { 'cell-call_id': ({ row }: any) => h('a', { class: 'custom' }, `#${row.call_id}`) }) } })
    const w = mount(Host, { global: { stubs } })
    await settle()
    expect(w.find('.custom').text()).toBe('#X')
  })

  it('a loading first page shows skeleton rows, not an empty state', async () => {
    fetcher = vi.fn(() => new Promise(() => {}))
    const Host = defineComponent({ setup() { const t = useServerTable({ key: 'load', columns: COLS, fetcher: (p, c) => fetcher(p, c), persist: false }); return () => h(DataTable, { table: t }) } })
    const w = mount(Host, { global: { stubs } })
    await settle()
    expect(w.findAll('.dt-skel').length).toBeGreaterThan(0)
    expect(w.text()).not.toContain('No records')
  })
})

describe('sorting', () => {
  it('clicking a header sorts on the server and marks the column', async () => {
    const { wrapper } = setup()
    await settle()
    await wrapper.findAll('.dt-sort')[0]!.trigger('click'); await settle()
    expect(lastParams().ordering).toBe('call_id')
    expect(wrapper.findAll('thead tr:first-child th')[0]!.attributes('aria-sort')).toBe('ascending')
    await wrapper.findAll('.dt-sort')[0]!.trigger('click'); await settle()
    expect(lastParams().ordering).toBe('-call_id')
    expect(wrapper.findAll('thead tr:first-child th')[0]!.attributes('aria-sort')).toBe('descending')
  })

  it('shift-click adds a second sort column', async () => {
    const { wrapper } = setup()
    await settle()
    await wrapper.findAll('.dt-sort')[0]!.trigger('click')
    await wrapper.findAll('.dt-sort')[1]!.trigger('click', { shiftKey: true }); await settle()
    expect(lastParams().ordering).toBe('call_id,stage')
  })

  it('a column the server cannot sort has no sort button', async () => {
    const { wrapper } = setup()
    await settle()
    const hours = wrapper.findAll('thead tr:first-child th')[5]!
    expect(hours.find('.dt-sort').exists()).toBe(false)
    expect(hours.attributes('aria-sort')).toBeUndefined()
  })
})

describe('paging', () => {
  it('next, last, first and a typed page number all reach the server', async () => {
    const { wrapper, holder } = setup()
    await settle()
    await wrapper.find('button[aria-label="Next page"]').trigger('click'); await settle()
    expect(lastParams().page).toBe(2)
    expect(wrapper.find('.dt-status').text()).toBe('Showing 26–50 of 140')
    await wrapper.find('button[aria-label="Last page"]').trigger('click'); await settle()
    expect(lastParams().page).toBe(6)
    expect(wrapper.find('.dt-status').text()).toBe('Showing 126–140 of 140')
    const input = wrapper.find('input[aria-label="Page number"]')
    await input.setValue('3'); await input.trigger('keydown.enter'); await settle()
    expect(lastParams().page).toBe(3)
    await wrapper.find('button[aria-label="First page"]').trigger('click'); await settle()
    // page 1 was fetched earlier, so the cache serves it (no new request): check what the table shows
    expect(holder.table.page.value).toBe(1)
    expect(wrapper.find('.dt-status').text()).toBe('Showing 1–25 of 140')
  })

  it('first/previous are disabled on page 1, next/last on the last page', async () => {
    const { wrapper } = setup({ count: 10 })
    await settle()
    for (const l of ['First page', 'Previous page', 'Next page', 'Last page']) expect(wrapper.find(`button[aria-label="${l}"]`).attributes('disabled')).toBeDefined()
  })

  it('the page-size menu offers 25 / 50 / 100 and refetches', async () => {
    const { wrapper } = setup()
    await settle()
    await wrapper.find('select[aria-label="Rows per page"]').setValue('100'); await settle()
    expect(lastParams().page_size).toBe(100)
    expect(wrapper.findAll('tbody tr')).toHaveLength(100)
  })
})

describe('search and filters', () => {
  it('searching is debounced, hits the server, and shows a removable chip', async () => {
    const { wrapper, holder } = setup()
    await settle()
    fetcher.mockClear()
    const box = wrapper.find('input[type="search"]')
    await box.setValue('mombasa')
    expect(fetcher).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(350); await flushPromises()
    expect(lastParams().q).toBe('mombasa')
    expect(wrapper.find('.dt-chips').text()).toContain('mombasa')
    await wrapper.find('.dt-chip button').trigger('click'); await vi.advanceTimersByTimeAsync(350); await flushPromises()
    expect(holder.table.query.value).not.toHaveProperty('q')
    expect(wrapper.find('.dt-chips').exists()).toBe(false)
  })

  it('the Filters button reveals a control per filterable column', async () => {
    const { wrapper } = setup()
    await settle()
    expect(wrapper.find('.dt-filter-row').exists()).toBe(false)
    await wrapper.findAll('button').find(b => b.text().startsWith('Filters'))!.trigger('click')
    const row = wrapper.find('.dt-filter-row')
    expect(row.exists()).toBe(true)
    expect(row.find('input[aria-label="Filter Call"]').exists()).toBe(true)            // text
    expect(row.find('select[aria-label="Filter Stage"]').exists()).toBe(true)          // select from the badge map
    expect(row.find('input[aria-label="Tonnes minimum"]').exists()).toBe(true)         // number range
    expect(row.find('select[aria-label="Filter Active"]').exists()).toBe(true)         // bool
    expect(row.find('input[aria-label="ETA from"]').exists()).toBe(true)               // date range
    expect(row.findAll('th')[5]!.find('input, select').exists()).toBe(false)           // Hours: not filterable
  })

  it('filters reach the server as f.* params and appear as chips', async () => {
    const { wrapper } = setup()
    await settle()
    await wrapper.findAll('button').find(b => b.text().startsWith('Filters'))!.trigger('click')
    await wrapper.find('input[aria-label="Filter Call"]').setValue('CALL-1')
    await wrapper.find('select[aria-label="Filter Stage"]').setValue('departed')
    await wrapper.find('input[aria-label="Tonnes minimum"]').setValue('5')
    await vi.advanceTimersByTimeAsync(400); await flushPromises()
    expect(lastParams()).toMatchObject({ 'f.call_id': 'CALL-1', 'f.stage__exact': 'departed', 'f.tonnes__gte': '5', page: 1 })
    const chips = wrapper.find('.dt-chips').text()
    expect(chips).toContain('Call')
    expect(chips).toContain('Stage')
    expect(chips).toContain('Tonnes')
  })

  it('shows a friendly empty state when filters match nothing, with a way out', async () => {
    const { wrapper, holder } = setup()
    await settle()
    fetcher.mockImplementation(async () => ({ count: 0, results: [] }))
    holder.table.setSearch('zzz'); await vi.advanceTimersByTimeAsync(400); await flushPromises()
    expect(wrapper.find('.dt-empty').text()).toContain('Nothing matches')
    fetcher.mockImplementation(async (p: any) => ({ count: 140, results: rowsFor(Number(p.page), Number(p.page_size), 140) }))
    await wrapper.find('.dt-empty .dt-link').trigger('click'); await settle()
    expect(wrapper.findAll('tbody tr')).toHaveLength(25)
  })

  it('an empty dataset says so', async () => {
    fetcher = vi.fn(async () => ({ count: 0, results: [] }))
    const Host = defineComponent({ setup() { const t = useServerTable({ key: 'e', columns: COLS, fetcher: (p, c) => fetcher(p, c), persist: false }); return () => h(DataTable, { table: t, empty: 'No vessel calls uploaded yet.' }) } })
    const w = mount(Host, { global: { stubs } })
    await settle()
    expect(w.find('.dt-empty').text()).toContain('No vessel calls uploaded yet.')
  })
})

describe('errors', () => {
  it('shows the error with a retry that works', async () => {
    const { wrapper } = setup()
    await settle()
    fetcher.mockRejectedValueOnce({ message: 'Server down' })
    await wrapper.find('button[aria-label="Refresh"]').trigger('click'); await settle()
    expect(wrapper.find('.dt-state--error').text()).toContain('Server down')
    await wrapper.find('.dt-state--error button').trigger('click'); await settle()
    expect(wrapper.find('.dt-state--error').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr')).toHaveLength(25)
  })
})

describe('columns and density', () => {
  it('the Columns menu hides and shows columns, and resets', async () => {
    const { wrapper } = setup()
    await settle()
    await wrapper.findAll('button').find(b => b.text().startsWith('Columns'))!.trigger('click')
    const boxes = wrapper.findAll('.dt-menu .dt-check input')
    expect(boxes).toHaveLength(6)
    await boxes[2]!.setValue(false)
    expect(wrapper.findAll('thead tr:first-child th').map(th => th.text())).not.toContain('Tonnes')
    await wrapper.find('.dt-menu .dt-link').trigger('click')
    expect(wrapper.findAll('thead tr:first-child th').map(th => th.text())).toContain('Tonnes')
  })

  it('density changes the table class', async () => {
    const { wrapper } = setup()
    await settle()
    await wrapper.findAll('button').find(b => b.text().startsWith('Columns'))!.trigger('click')
    await wrapper.findAll('.dt-seg button').find(b => b.text() === 'compact')!.trigger('click')
    expect(wrapper.find('.dt').classes()).toContain('dt--compact')
  })
})

describe('export', () => {
  it('exports this page, or every matching row', async () => {
    const { wrapper } = setup({ count: 130 })
    await settle()
    await wrapper.findAll('button').find(b => b.text().startsWith('Export'))!.trigger('click')
    const items = wrapper.findAll('.dt-menu .dt-item')
    expect(items.map(i => i.text())).toEqual(['This page (25 rows)', 'All 130 matching rows'])
    await items[0]!.trigger('click')
    expect(exportCsv).toHaveBeenCalledTimes(1)
    expect(exportCsv.mock.calls[0]![1]).toHaveLength(25)

    exportCsv.mockClear()
    await wrapper.findAll('button').find(b => b.text().startsWith('Export'))!.trigger('click')
    await wrapper.findAll('.dt-menu .dt-item')[1]!.trigger('click')
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(exportCsv).toHaveBeenCalledTimes(1)
    expect(exportCsv.mock.calls[0]![1]).toHaveLength(130)                           // all pages, not just the one on screen
    expect(exportCsv.mock.calls[0]![2].map((c: any) => c.label)).toEqual(['Call', 'Stage', 'Tonnes', 'Active', 'ETA', 'Hours'])
  })

  it('is hidden for a role without the export capability', async () => {
    perms.cap = false
    const { wrapper } = setup()
    await settle()
    expect(wrapper.findAll('button').some(b => b.text().startsWith('Export'))).toBe(false)
  })
})

describe('on a phone', () => {
  it('shows a card per row instead of a grid, with the low-priority columns folded away', async () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as any
    const { wrapper } = setup()
    await settle()
    expect(wrapper.find('table').exists()).toBe(false)
    const cards = wrapper.findAll('.dt-card')
    expect(cards).toHaveLength(25)
    expect(cards[0]!.text()).toContain('CALL-0')
    expect(cards[0]!.text()).not.toContain('Hours')              // priority 3: behind "1 more"
    await cards[0]!.find('.dt-link').trigger('click')
    expect(cards[0]!.text()).toContain('Hours')
  })
})

describe('nested values', () => {
  it('a dotted column key reads a nested value, in the cell and in the export', async () => {
    fetcher = vi.fn(async () => ({ count: 1, results: [{ id: 'a', cohort_detail: { cohort_code: 'C-77' }, plain: 'x' }] }))
    const cols: TableColumn[] = [{ key: 'cohort_detail.cohort_code', label: 'Cohort', type: 'mono', sortable: false, filter: false }, { key: 'plain', label: 'Plain' }]
    const Host = defineComponent({ setup() { const t = useServerTable({ key: 'nest', columns: cols, fetcher: (p, c) => fetcher(p, c), persist: false }); return () => h(DataTable, { table: t, exportName: 'n' }) } })
    const w = mount(Host, { global: { stubs } })
    await settle()
    expect(w.find('tbody tr').findAll('td').map(td => td.text())).toEqual(['C-77', 'x'])
    await w.findAll('button').find(b => b.text().startsWith('Export'))!.trigger('click')
    await w.findAll('.dt-menu .dt-item')[0]!.trigger('click')
    expect(exportCsv.mock.calls.at(-1)![1]).toEqual([{ 'cohort_detail.cohort_code': 'C-77', plain: 'x' }])
  })
})
