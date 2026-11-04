/**
 * useServerTable - the headless engine behind <DataTable>.
 *
 * Owns everything about "a window onto a big server-side dataset" and nothing about how it looks:
 *   - query state (page, page size, search, sort, column filters) -> the request's query string,
 *   - fetching with stale-response protection (a slow earlier request can never overwrite a newer one),
 *     abort of the superseded request, and a short page cache so going back/forward is instant,
 *   - debounced search / filter typing, page reset when the result set changes,
 *   - column layout (order, visibility, widths), density and sort remembered per table `key`,
 *   - "export everything that matches" by paging through the full result set.
 *
 * The server does the work (search, filter, sort, paging), so the table stays responsive however large the
 * dataset is: it only ever holds one page. The endpoint contract is the platform's own - `page`, `page_size`
 * (max 100), `ordering`, `q` (search) and `f.<column>[__lookup]` (see core/filters.py).
 *
 *   const table = useServerTable({ key: 'vessel-calls', columns, fetcher: p => api('/api/v1/...', { query: p }) })
 *   <DataTable :table="table" />
 */
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type {
  ColumnLayout, Density, FilterValue, PagedResult, Row, SortSpec, TableColumn, TableFetchContext, TableParams, TablePrefs,
} from '~/types/dataTable'

export interface UseServerTableOptions<T extends Row = Row> {
  /** Identity: where preferences are remembered, so give every table its own. */
  key: string
  columns: TableColumn<T>[]
  fetcher: (params: TableParams, ctx: TableFetchContext) => Promise<PagedResult<T>>
  pageSize?: number
  pageSizes?: number[]
  defaultSort?: SortSpec[]
  /** Remember page size, sort, column layout and density in localStorage. Default true. */
  persist?: boolean
  /** Wait this long after the last keystroke before searching / filtering. Default 300 ms. */
  debounceMs?: number
  /** Extra, externally controlled params (e.g. a port picked elsewhere on the page). Re-fetches when they change. */
  params?: MaybeRefOrGetter<Record<string, unknown> | undefined>
  /** Reuse a fetched page for this long. Default 30 s; 0 turns the cache off. */
  cacheMs?: number
  /** Fetch on mount. Default true. */
  immediate?: boolean
}

/** The server caps `page_size` at 100, so that is the biggest page an export can use. */
export const SERVER_MAX_PAGE_SIZE = 100
const PREFS_VERSION = 'v1'

export function defaultFilterKind(c: TableColumn<any>): Exclude<TableColumn['filter'], undefined> {
  if (c.filter !== undefined) return c.filter
  if (c.render || c.type === 'join') return false
  if (c.options?.length) return 'select'
  if (c.type === 'num') return 'number'
  if (c.type === 'date' || c.type === 'datetime') return 'date'
  if (c.type === 'bool') return 'bool'
  if (c.type === 'badge' && c.badge && Object.keys(c.badge).length) return 'select'
  return 'text'
}

export const isSortable = (c: TableColumn<any>) => !c.render && c.type !== 'join' && c.sortable !== false
export const sortField = (c: TableColumn<any>) => (typeof c.sortable === 'string' ? c.sortable : c.key)
export const filterField = (c: TableColumn<any>) => c.filterKey ?? c.key

function loadPrefs(storageKey: string): Partial<TablePrefs> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    return raw && typeof raw === 'object' ? raw : null
  } catch { return null }
}

function savePrefs(storageKey: string, prefs: TablePrefs) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(storageKey, JSON.stringify(prefs)) } catch { /* private mode / quota: in-memory still works */ }
}

const isEmptyFilter = (v: FilterValue | undefined) =>
  v === undefined || v === '' || (typeof v === 'object' && !v.from && !v.to)

export function useServerTable<T extends Row = Row>(opts: UseServerTableOptions<T>) {
  const sizes = opts.pageSizes ?? [25, 50, 100]
  const defaultPageSize = opts.pageSize ?? sizes[0] ?? 25
  const storageKey = `uapts_table:${PREFS_VERSION}:${opts.key}`
  const persist = opts.persist !== false
  const debounceMs = opts.debounceMs ?? 300
  const cacheMs = opts.cacheMs ?? 30_000
  const colByKey = () => new Map(opts.columns.map(c => [c.key, c]))

  // ── remembered preferences ────────────────────────────────────────────
  const stored = persist ? loadPrefs(storageKey) : null
  const defaultLayout = (): ColumnLayout => ({
    order: opts.columns.map(c => c.key),
    hidden: opts.columns.filter(c => c.hidden).map(c => c.key),
    widths: {},
  })
  const known = new Set(opts.columns.map(c => c.key))
  function sanitizeLayout(l?: Partial<ColumnLayout>): ColumnLayout {
    const base = defaultLayout()
    if (!l) return base
    // Stored order keeps only columns that still exist; columns added since the layout was saved are appended.
    const order = [...(l.order ?? []).filter(k => known.has(k))]
    for (const k of base.order) if (!order.includes(k)) order.push(k)
    return {
      order,
      hidden: (l.hidden ?? []).filter(k => known.has(k)),
      widths: Object.fromEntries(Object.entries(l.widths ?? {}).filter(([k, w]) => known.has(k) && Number.isFinite(w))),
    }
  }

  const pageSize = ref(sizes.includes(stored?.pageSize as number) ? (stored!.pageSize as number) : defaultPageSize)
  const sort = ref<SortSpec[]>(
    Array.isArray(stored?.sort) ? stored!.sort!.filter(s => known.has(s.key) && (s.dir === 'asc' || s.dir === 'desc')) : (opts.defaultSort ?? []),
  )
  const layout = ref<ColumnLayout>(sanitizeLayout(stored?.layout))
  const density = ref<Density>(['compact', 'standard', 'comfortable'].includes(stored?.density as string) ? stored!.density! : 'standard')

  // ── query state ───────────────────────────────────────────────────────
  const page = ref(1)
  const searchInput = ref('')          // what the box shows, live
  const search = ref('')               // what is applied (after the debounce)
  const filterInput = ref<Record<string, FilterValue>>({})
  const filters = ref<Record<string, FilterValue>>({})

  // ── result state ──────────────────────────────────────────────────────
  const rows = ref([]) as Ref<T[]>
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)            // has a first page ever arrived

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  const firstRow = computed(() => (total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
  const lastRow = computed(() => Math.min(total.value, page.value * pageSize.value))

  const visibleColumns = computed<TableColumn<T>[]>(() => {
    const byKey = colByKey()
    const hidden = new Set(layout.value.hidden)
    return layout.value.order.filter(k => !hidden.has(k)).map(k => byKey.get(k) as TableColumn<T>).filter(Boolean)
  })
  const allColumns = computed<TableColumn<T>[]>(() => {
    const byKey = colByKey()
    return layout.value.order.map(k => byKey.get(k) as TableColumn<T>).filter(Boolean)
  })

  // ── the request ───────────────────────────────────────────────────────
  function filterParams(): TableParams {
    const out: TableParams = {}
    const byKey = colByKey()
    for (const [key, value] of Object.entries(filters.value)) {
      const col = byKey.get(key)
      if (!col || isEmptyFilter(value)) continue
      const field = filterField(col)
      const kind = defaultFilterKind(col)
      if (typeof value === 'object') {
        if (value.from) out[`f.${field}__gte`] = value.from
        if (value.to) out[`f.${field}__lte`] = value.to
      } else if (kind === 'select') {
        out[`f.${field}__exact`] = value                  // a choice is an exact match, not "contains"
      } else {
        out[`f.${field}`] = value
      }
    }
    return out
  }

  const query = computed<TableParams>(() => {
    const out: TableParams = { page: page.value, page_size: pageSize.value }
    if (search.value.trim()) out.q = search.value.trim()
    if (sort.value.length) {
      const byKey = colByKey()
      out.ordering = sort.value
        .map(s => `${s.dir === 'desc' ? '-' : ''}${byKey.get(s.key) ? sortField(byKey.get(s.key)!) : s.key}`).join(',')
    }
    Object.assign(out, filterParams())
    for (const [k, v] of Object.entries(toValue(opts.params) ?? {})) {
      if (v !== undefined && v !== null && v !== '') out[k] = v as string | number
    }
    return out
  })

  const cache = new Map<string, { at: number; data: PagedResult<T> }>()
  let seq = 0
  let controller: AbortController | null = null

  async function fetchPage(force = false) {
    const params = query.value
    const cacheKey = JSON.stringify(params)
    const hit = cache.get(cacheKey)
    if (!force && cacheMs > 0 && hit && Date.now() - hit.at < cacheMs) {
      rows.value = hit.data.results
      total.value = hit.data.count
      error.value = null
      loaded.value = true
      return
    }
    controller?.abort()
    controller = new AbortController()
    const mine = ++seq
    loading.value = true
    error.value = null
    try {
      const data = await opts.fetcher(params, { signal: controller.signal })
      if (mine !== seq) return                              // a newer request superseded this one
      rows.value = data.results ?? []
      total.value = data.count ?? rows.value.length
      loaded.value = true
      if (cacheMs > 0) {
        cache.set(cacheKey, { at: Date.now(), data })
        if (cache.size > 60) cache.delete(cache.keys().next().value as string)
      }
      // The result set shrank under us (a filter elsewhere, rows deleted): land on the last real page.
      if (page.value > totalPages.value) page.value = totalPages.value
    } catch (e: any) {
      if (mine !== seq || e?.name === 'AbortError') return
      rows.value = []
      total.value = 0
      error.value = e?.data?.detail ?? e?.message ?? 'Unable to load this table.'
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  // Page, sort, page size and external params fetch immediately; typing is debounced (below).
  watch(() => JSON.stringify(query.value), () => { void fetchPage() })

  // ── search & filters (debounced) ──────────────────────────────────────
  let timer: ReturnType<typeof setTimeout> | null = null
  function commit() {
    timer = null
    const changedSearch = searchInput.value !== search.value
    const nextFilters = Object.fromEntries(Object.entries(filterInput.value).filter(([, v]) => !isEmptyFilter(v)))
    const changedFilters = JSON.stringify(nextFilters) !== JSON.stringify(filters.value)
    if (!changedSearch && !changedFilters) return
    search.value = searchInput.value
    filters.value = nextFilters
    page.value = 1
  }
  function schedule(immediate = false) {
    if (timer) clearTimeout(timer)
    if (immediate || debounceMs <= 0) commit()
    else timer = setTimeout(commit, debounceMs)
  }

  function setSearch(v: string) { searchInput.value = v; schedule() }
  /** Text filters debounce while typing; pass `immediate` for a choice or a date. */
  function setFilter(key: string, value: FilterValue | undefined, immediate = false) {
    const next = { ...filterInput.value }
    if (isEmptyFilter(value)) delete next[key]
    else next[key] = value as FilterValue
    filterInput.value = next
    schedule(immediate)
  }
  function clearFilter(key: string) { setFilter(key, undefined, true) }
  function clearAll() {
    searchInput.value = ''
    filterInput.value = {}
    schedule(true)
  }

  // ── sorting ───────────────────────────────────────────────────────────
  /** Click: cycle asc -> desc -> off on that column alone. `additive` (shift-click) edits a multi-column sort. */
  function toggleSort(key: string, additive = false) {
    const cur = sort.value.find(s => s.key === key)
    const next: SortSpec | null = !cur ? { key, dir: 'asc' } : cur.dir === 'asc' ? { key, dir: 'desc' } : null
    const others = additive ? sort.value.filter(s => s.key !== key) : []
    sort.value = next ? (additive && cur ? sort.value.map(s => (s.key === key ? next : s)) : [...others, next]) : others
    page.value = 1
  }
  const sortDir = (key: string): 'asc' | 'desc' | null => sort.value.find(s => s.key === key)?.dir ?? null
  const sortRank = (key: string) => (sort.value.length > 1 ? sort.value.findIndex(s => s.key === key) + 1 : 0)

  // ── paging ────────────────────────────────────────────────────────────
  function goto(p: number) { page.value = Math.min(Math.max(1, Math.trunc(p) || 1), totalPages.value) }
  const next = () => goto(page.value + 1)
  const prev = () => goto(page.value - 1)
  function setPageSize(n: number) {
    if (!sizes.includes(n)) return
    // Keep the first visible row on screen when the page size changes.
    const first = (page.value - 1) * pageSize.value
    pageSize.value = n
    page.value = Math.floor(first / n) + 1
  }

  // ── column layout ─────────────────────────────────────────────────────
  function toggleColumn(key: string) {
    const hidden = new Set(layout.value.hidden)
    if (hidden.has(key)) hidden.delete(key)
    else if (layout.value.order.length - hidden.size > 1) hidden.add(key)        // never hide the last column
    layout.value = { ...layout.value, hidden: [...hidden] }
  }
  function moveColumn(key: string, beforeKey: string | null) {
    if (key === beforeKey) return
    const order = layout.value.order.filter(k => k !== key)
    const at = beforeKey === null ? order.length : order.indexOf(beforeKey)
    order.splice(at < 0 ? order.length : at, 0, key)
    layout.value = { ...layout.value, order }
  }
  function resizeColumn(key: string, width: number) {
    const c = colByKey().get(key)
    const w = Math.round(Math.min(c?.maxWidth ?? 800, Math.max(c?.minWidth ?? 60, width)))
    layout.value = { ...layout.value, widths: { ...layout.value.widths, [key]: w } }
  }
  const widthOf = (key: string) => layout.value.widths[key] ?? colByKey().get(key)?.width

  /** Back to the schema's defaults: layout, density, page size and sort. (Search and filters have their own clear.) */
  function resetLayout() {
    layout.value = defaultLayout()
    density.value = 'standard'
    pageSize.value = defaultPageSize
    sort.value = opts.defaultSort ?? []
    page.value = 1
  }

  // Remember the preferences (never the search text, filters or page - those are about this visit).
  watch([pageSize, sort, layout, density], () => {
    if (persist) savePrefs(storageKey, { pageSize: pageSize.value, sort: sort.value, layout: layout.value, density: density.value })
  }, { deep: true })

  // ── export everything that matches ────────────────────────────────────
  const exporting = ref(false)
  const exportProgress = ref(0)
  let cancelExport = false

  /** Every row matching the current search, filters and sort - not just the page on screen.
   *  Pages through the result set 100 at a time; stops at `maxRows` and says so. */
  async function fetchAll(maxRows = 50_000): Promise<{ rows: T[]; truncated: boolean }> {
    exporting.value = true
    exportProgress.value = 0
    cancelExport = false
    const base = { ...query.value }
    delete base.page
    const out: T[] = []
    try {
      let p = 1
      for (;;) {
        if (cancelExport) break
        const data = await opts.fetcher({ ...base, page: p, page_size: SERVER_MAX_PAGE_SIZE }, { signal: new AbortController().signal })
        out.push(...(data.results ?? []))
        exportProgress.value = Math.min(1, out.length / Math.max(1, data.count))
        if (out.length >= data.count || !(data.results ?? []).length) break
        if (out.length >= maxRows) return { rows: out.slice(0, maxRows), truncated: true }
        p++
      }
      return { rows: out, truncated: false }
    } finally {
      exporting.value = false
    }
  }
  const cancelFetchAll = () => { cancelExport = true }

  const activeFilterCount = computed(() => Object.keys(filters.value).length + (search.value.trim() ? 1 : 0))

  /** Re-fetch the current page. Drops every cached page too: after an edit elsewhere (a resolved alert, a deleted row)
   *  any page could be stale, not just the one on screen. */
  function refresh() { cache.clear(); return fetchPage(true) }

  if (getCurrentInstance()) {
    onMounted(() => { if (opts.immediate !== false) void fetchPage() })
    onBeforeUnmount(() => { if (timer) clearTimeout(timer); controller?.abort() })
  }

  return {
    key: opts.key, columns: opts.columns, pageSizes: sizes,
    // result
    rows, total, loading, error, loaded, refresh,
    // paging
    page, pageSize, totalPages, firstRow, lastRow, goto, next, prev, setPageSize,
    // search & filters
    searchInput, search, filters, filterInput, setSearch, setFilter, clearFilter, clearAll, activeFilterCount,
    // sorting
    sort, toggleSort, sortDir, sortRank,
    // layout
    layout, visibleColumns, allColumns, density, toggleColumn, moveColumn, resizeColumn, widthOf, resetLayout,
    // export
    exporting, exportProgress, fetchAll, cancelFetchAll,
    // for tests / advanced callers
    query,
  }
}

export type ServerTable<T extends Row = Row> = ReturnType<typeof useServerTable<T>>
