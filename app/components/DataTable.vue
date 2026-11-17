<script setup lang="ts">
/**
 * DataTable - the schema-driven table. Pure UI over a `useServerTable()` engine: it renders what the engine holds
 * (one page of a server-side dataset) and sends every interaction back to it.
 *
 *   <DataTable :table="table" row-key="id" export-name="vessel-calls">
 *     <template #cell-status="{ row }">…custom cell…</template>
 *   </DataTable>
 *
 * Every part is optional and replaceable: `toolbar` (extra controls), `cell-<key>` (a cell), `empty` (no rows).
 * Switch parts off with `:search="false"`, `:filters="false"`, `:columns-menu="false"`, `:export="false"`.
 *
 * Adaptive: a full grid on desktop (sticky header, resizable / reorderable / pinnable columns), horizontal
 * scroll on tablets, and a card per row on phones. Keyboard: the sort buttons, the pager and the menus are real
 * buttons; Escape closes a menu. Reduced motion is respected.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Download, Filter, RefreshCw, RotateCcw, Search, X, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, GripVertical } from 'lucide-vue-next'
import type { Row, TableColumn } from '~/types/dataTable'
import type { ServerTable } from '~/composables/useServerTable'
import { defaultFilterKind, isSortable } from '~/composables/useServerTable'
import { badgeVariant, formatTableCell, getCellPath } from '~/utils/tableFormat'
import { useCsvExport } from '~/composables/useCsvExport'

const props = withDefaults(defineProps<{
  table: ServerTable<any>
  rowKey?: string
  title?: string
  exportName?: string
  /** Text for an empty (no rows at all) table. */
  empty?: string
  search?: boolean
  filters?: boolean
  columnsMenu?: boolean
  export?: boolean
  /** Lowest role allowed to export (same gate as <ExportButton>). */
  exportMinRole?: string
  /** Height of the scrolling area, so the header stays put. CSS length. Default: grows with the page. */
  maxHeight?: string
  placeholder?: string
  /** Rows open into a detail panel (the `expanded` slot). */
  expandable?: boolean
  /** Show the per-column filter row from the start. */
  filtersOpen?: boolean
}>(), {
  rowKey: 'id', title: undefined, exportName: 'export', empty: 'No records.', search: true, filters: true, columnsMenu: true,
  export: true, exportMinRole: 'analyst', maxHeight: undefined, placeholder: 'Search every column…', expandable: false, filtersOpen: false,
})

const emit = defineEmits<{ 'row-click': [row: Row] }>()
const t = props.table

const showFilters = ref(props.filtersOpen)
const menu = ref<'columns' | 'export' | null>(null)
const root = ref<HTMLElement | null>(null)
const pageInput = ref(String(t.page.value))
watch(t.page, p => { pageInput.value = String(p) })

// ── responsive: cards on a phone ─────────────────────────────────────────
const narrow = ref(false)
let mq: MediaQueryList | null = null
const onMq = () => { narrow.value = !!mq?.matches }
onMounted(() => {
  if (typeof window === 'undefined' || !window.matchMedia) return
  mq = window.matchMedia('(max-width: 640px)')
  onMq()
  mq.addEventListener?.('change', onMq)
})
onBeforeUnmount(() => mq?.removeEventListener?.('change', onMq))

const cols = computed(() => t.visibleColumns.value)
const cardCols = computed(() => cols.value.filter(c => (c.priority ?? 2) <= 2))
const detailCols = computed(() => cols.value.filter(c => (c.priority ?? 2) > 2))
const expanded = ref<Set<string>>(new Set())
const rid = (row: Row, i: number) => String(row[props.rowKey] ?? i)
function onRow(row: Row, i: number) {
  if (props.expandable) toggleExpand(rid(row, i))
  emit('row-click', row)
}
const toggleExpand = (id: string) => {
  const next = new Set(expanded.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expanded.value = next
}

// ── pinned columns: sticky-left with cumulative offsets ──────────────────
const DEFAULT_PIN_WIDTH = 140
const EXPAND_COL = 34
const pinLeft = computed(() => {
  const out: Record<string, number> = {}
  let left = props.expandable ? EXPAND_COL : 0
  for (const c of cols.value) {
    if (c.pin !== 'left') continue
    out[c.key] = left
    left += t.widthOf(c.key) ?? DEFAULT_PIN_WIDTH
  }
  return out
})
const cellStyle = (c: TableColumn) => {
  const w = t.widthOf(c.key)
  const s: Record<string, string> = {}
  if (w) { s.width = `${w}px`; s.minWidth = `${w}px`; s.maxWidth = `${w}px` }
  else if (c.minWidth) s.minWidth = `${c.minWidth}px`
  if (c.key in pinLeft.value) s.left = `${pinLeft.value[c.key]}px`
  return s
}

// ── resizing (pointer drag on the header edge) ───────────────────────────
let resizing: { key: string; startX: number; startW: number } | null = null
function startResize(e: PointerEvent, c: TableColumn) {
  const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement
  resizing = { key: c.key, startX: e.clientX, startW: th.getBoundingClientRect().width }
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  e.preventDefault()
}
function onResize(e: PointerEvent) { if (resizing) t.resizeColumn(resizing.key, resizing.startW + (e.clientX - resizing.startX)) }
function endResize() { resizing = null }
function resizeByKey(e: KeyboardEvent, c: TableColumn) {
  const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement
  const w = th.getBoundingClientRect().width
  if (e.key === 'ArrowRight') { t.resizeColumn(c.key, w + 16); e.preventDefault() }
  if (e.key === 'ArrowLeft') { t.resizeColumn(c.key, w - 16); e.preventDefault() }
}

// ── reordering (drag a header onto another) ──────────────────────────────
const dragKey = ref<string | null>(null)
const overKey = ref<string | null>(null)
function onDrop(target: string) {
  if (dragKey.value && dragKey.value !== target) t.moveColumn(dragKey.value, target)
  dragKey.value = overKey.value = null
}
function moveByKey(e: KeyboardEvent, c: TableColumn) {
  const keys = cols.value.map(x => x.key)
  const i = keys.indexOf(c.key)
  if (e.altKey && e.key === 'ArrowLeft' && i > 0) { t.moveColumn(c.key, keys[i - 1]!); e.preventDefault() }
  if (e.altKey && e.key === 'ArrowRight' && i < keys.length - 1) { t.moveColumn(c.key, keys[i + 2] ?? null); e.preventDefault() }
}

// ── filters ──────────────────────────────────────────────────────────────
const kindOf = (c: TableColumn) => (props.filters ? defaultFilterKind(c as TableColumn) : false)
const filterable = computed(() => cols.value.filter(c => kindOf(c)))
const rangeVal = (key: string, side: 'from' | 'to') => {
  const v = t.filterInput.value[key]
  return typeof v === 'object' && v ? (v[side] ?? '') : ''
}
function setRange(key: string, side: 'from' | 'to', value: string) {
  const cur = t.filterInput.value[key]
  const base = typeof cur === 'object' && cur ? cur : {}
  t.setFilter(key, { ...base, [side]: value || undefined }, true)
}
const textVal = (key: string) => {
  const v = t.filterInput.value[key]
  return typeof v === 'string' ? v : ''
}
const chips = computed(() => {
  const out: Array<{ key: string; label: string; text: string }> = []
  for (const [key, v] of Object.entries(t.filters.value)) {
    const c = t.columns.find(x => x.key === key)
    if (!c) continue
    const text = typeof v === 'object' ? [v.from && `from ${v.from}`, v.to && `to ${v.to}`].filter(Boolean).join(' ')
      : c.options?.find(o => o.value === v)?.label ?? (defaultFilterKind(c as TableColumn) === 'bool' ? (v === 'true' ? 'Yes' : 'No') : v)
    out.push({ key, label: c.label, text })
  }
  return out
})

// ── export ───────────────────────────────────────────────────────────────
const { hasMinRole, hasCapability } = usePermissions()
const canExport = computed(() => props.export && hasMinRole(props.exportMinRole) && hasCapability('export'))
const { exportCsv } = useCsvExport()
const exportNote = ref<string | null>(null)

function csvColumns() { return exportCols().map(c => ({ key: c.key, label: c.label })) }
const exportCols = () => cols.value.filter(c => !c.noExport)
function csvRows(rows: Row[]) {
  return rows.map(r => Object.fromEntries(exportCols().map(c => [c.key, c.exportAs ? c.exportAs(r) : c.render || c.type === 'join' ? formatTableCell(c, r) : getCellPath(r, c.key)])))
}
function exportPage() {
  exportCsv(`${props.exportName}-page-${t.page.value}.csv`, csvRows(t.rows.value), csvColumns())
  menu.value = null
}
async function exportAll() {
  menu.value = null
  exportNote.value = null
  try {
    const { rows, truncated } = await t.fetchAll()
    exportCsv(`${props.exportName}.csv`, csvRows(rows), csvColumns())
    exportNote.value = truncated ? `Exported the first ${rows.length.toLocaleString()} rows - narrow the filters to export the rest.` : null
  } catch {
    exportNote.value = 'Export failed. Try again.'
  }
}

// ── pager ────────────────────────────────────────────────────────────────
function jump() {
  const n = Number(pageInput.value)
  if (Number.isFinite(n)) t.goto(n)
  pageInput.value = String(t.page.value)
}

// ── menus ────────────────────────────────────────────────────────────────
function onDoc(e: MouseEvent) { if (menu.value && root.value && !(e.target as HTMLElement).closest('.dt-menu-wrap')) menu.value = null }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') menu.value = null }
onMounted(() => { document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) })

const sortIcon = (key: string) => (t.sortDir(key) === 'asc' ? ArrowUp : t.sortDir(key) === 'desc' ? ArrowDown : ArrowUpDown)
const ariaSort = (c: TableColumn) => (!isSortable(c as TableColumn) ? undefined : t.sortDir(c.key) === 'asc' ? 'ascending' : t.sortDir(c.key) === 'desc' ? 'descending' : 'none')
const showSkeleton = computed(() => t.loading.value && !t.rows.value.length)
const isEmpty = computed(() => !t.loading.value && !t.error.value && t.loaded.value && !t.rows.value.length)
</script>

<template>
  <section ref="root" class="dt" :class="[`dt--${t.density.value}`, { 'dt--busy': t.loading.value }]" :aria-label="title || 'Data table'">
    <!-- Toolbar -->
    <div class="dt-toolbar">
      <label v-if="search" class="dt-search">
        <Search :size="14" aria-hidden="true" />
        <input
          type="search" :value="t.searchInput.value" :placeholder="placeholder" aria-label="Search all columns"
          @input="t.setSearch(($event.target as HTMLInputElement).value)"
        >
      </label>

      <button v-if="filters && filterable.length" type="button" class="btn dt-btn" :class="{ 'is-on': showFilters }" :aria-pressed="showFilters" @click="showFilters = !showFilters">
        <Filter :size="14" aria-hidden="true" />Filters<span v-if="chips.length" class="dt-count">{{ chips.length }}</span>
      </button>

      <slot name="toolbar" />

      <div class="dt-spacer" />

      <div v-if="columnsMenu" class="dt-menu-wrap">
        <button type="button" class="btn dt-btn" :aria-expanded="menu === 'columns'" aria-haspopup="true" @click="menu = menu === 'columns' ? null : 'columns'">
          <Columns3 :size="14" aria-hidden="true" />Columns
        </button>
        <div v-if="menu === 'columns'" class="dt-menu" role="menu" aria-label="Columns and density">
          <div class="dt-menu-title">Show columns</div>
          <label v-for="c in t.allColumns.value" :key="c.key" class="dt-check" role="menuitemcheckbox" :aria-checked="!t.layout.value.hidden.includes(c.key)">
            <input type="checkbox" :checked="!t.layout.value.hidden.includes(c.key)" @change="t.toggleColumn(c.key)">{{ c.label }}
          </label>
          <div class="dt-menu-title">Density</div>
          <div class="dt-seg" role="group" aria-label="Density">
            <button v-for="d in (['compact', 'standard', 'comfortable'] as const)" :key="d" type="button" :class="{ on: t.density.value === d }" :aria-pressed="t.density.value === d" @click="t.density.value = d">{{ d }}</button>
          </div>
          <button type="button" class="dt-link" @click="t.resetLayout()"><RotateCcw :size="12" aria-hidden="true" />Reset to defaults</button>
        </div>
      </div>

      <div v-if="canExport" class="dt-menu-wrap">
        <button type="button" class="btn dt-btn" :disabled="t.exporting.value || !t.total.value" :aria-expanded="menu === 'export'" aria-haspopup="true" @click="menu = menu === 'export' ? null : 'export'">
          <Download :size="14" aria-hidden="true" />{{ t.exporting.value ? `Exporting ${Math.round(t.exportProgress.value * 100)}%` : 'Export' }}
        </button>
        <div v-if="menu === 'export'" class="dt-menu" role="menu">
          <button type="button" class="dt-item" role="menuitem" @click="exportPage">This page ({{ t.rows.value.length }} rows)</button>
          <button type="button" class="dt-item" role="menuitem" @click="exportAll">All {{ t.total.value.toLocaleString() }} matching rows</button>
        </div>
      </div>

      <button type="button" class="btn dt-btn dt-icon" :disabled="t.loading.value" title="Refresh" aria-label="Refresh" @click="t.refresh()">
        <RefreshCw :size="14" :class="{ 'dt-spin': t.loading.value }" aria-hidden="true" />
      </button>
    </div>

    <!-- Active filters -->
    <div v-if="chips.length || t.search.value" class="dt-chips" aria-label="Active filters">
      <span v-if="t.search.value" class="dt-chip">Search: <b>{{ t.search.value }}</b>
        <button type="button" :aria-label="`Clear search`" @click="t.setSearch('')"><X :size="11" aria-hidden="true" /></button></span>
      <span v-for="c in chips" :key="c.key" class="dt-chip">{{ c.label }}: <b>{{ c.text }}</b>
        <button type="button" :aria-label="`Clear ${c.label} filter`" @click="t.clearFilter(c.key)"><X :size="11" aria-hidden="true" /></button></span>
      <button type="button" class="dt-link" @click="t.clearAll()">Clear all</button>
    </div>

    <p v-if="exportNote" class="dt-note" role="status">{{ exportNote }}</p>

    <!-- Error -->
    <div v-if="t.error.value" class="dt-state dt-state--error" role="alert">
      <span>{{ t.error.value }}</span>
      <button type="button" class="btn" @click="t.refresh()">Retry</button>
    </div>

    <!-- Phone: a card per row -->
    <div v-if="narrow" class="dt-cards">
      <template v-if="showSkeleton"><div v-for="n in 4" :key="`s${n}`" class="dt-skel-card" /></template>
      <article v-for="(row, i) in t.rows.value" :key="rid(row, i)" class="dt-card" @click="emit('row-click', row)">
        <dl>
          <div v-for="c in cardCols" :key="c.key">
            <dt>{{ c.label }}</dt>
            <dd>
              <slot :name="`cell-${c.key}`" :row="row" :value="getCellPath(row, c.key)" :column="c">
                <BadgePill v-if="c.type === 'badge' && getCellPath(row, c.key)" :variant="badgeVariant(c as TableColumn, getCellPath(row, c.key))">{{ formatTableCell(c, row) }}</BadgePill>
                <template v-else>{{ formatTableCell(c, row) }}</template>
              </slot>
            </dd>
          </div>
        </dl>
        <template v-if="detailCols.length || expandable">
          <button type="button" class="dt-link" :aria-expanded="expanded.has(rid(row, i))" @click.stop="toggleExpand(rid(row, i))">
            {{ expanded.has(rid(row, i)) ? 'Less' : expandable && !detailCols.length ? 'Details' : `${detailCols.length} more` }}
          </button>
          <template v-if="expanded.has(rid(row, i))">
            <dl v-if="detailCols.length">
              <div v-for="c in detailCols" :key="c.key"><dt>{{ c.label }}</dt><dd>{{ formatTableCell(c, row) }}</dd></div>
            </dl>
            <slot v-if="expandable" name="expanded" :row="row" />
          </template>
        </template>
      </article>
    </div>

    <!-- Desktop / tablet: the grid -->
    <div v-else class="dt-scroll" :style="maxHeight ? { maxHeight } : undefined" tabindex="0" role="region" :aria-label="`${title || 'Table'} (scrollable)`">
      <table class="dt-table">
        <thead>
          <tr>
            <th v-if="expandable" class="dt-expand-col" scope="col"><span class="sr-only">Details</span></th>
            <th
              v-for="c in cols" :key="c.key" scope="col" :aria-sort="ariaSort(c)" :style="cellStyle(c)"
              :class="{ 'is-num': c.type === 'num', 'is-pinned': c.pin === 'left', 'is-over': overKey === c.key }"
              draggable="true"
              @dragstart="dragKey = c.key" @dragover.prevent="overKey = c.key" @dragleave="overKey = null" @drop.prevent="onDrop(c.key)" @dragend="dragKey = overKey = null"
              @keydown="moveByKey($event, c)"
            >
              <div class="dt-th">
                <GripVertical :size="12" class="dt-grip" aria-hidden="true" />
                <button v-if="isSortable(c as TableColumn)" type="button" class="dt-sort" :title="'Sort by ' + c.label + ' (shift-click to add)'" @click="t.toggleSort(c.key, $event.shiftKey)">
                  <span>{{ c.label }}</span>
                  <component :is="sortIcon(c.key)" :size="12" aria-hidden="true" :class="{ 'dt-sorted': t.sortDir(c.key) }" />
                  <sup v-if="t.sortRank(c.key)" class="dt-rank">{{ t.sortRank(c.key) }}</sup>
                </button>
                <span v-else class="dt-label">{{ c.label }}</span>
                <span
                  class="dt-resize" role="separator" aria-orientation="vertical" tabindex="0" :aria-label="`Resize ${c.label} column`"
                  @pointerdown="startResize($event, c)" @pointermove="onResize" @pointerup="endResize" @pointercancel="endResize" @keydown="resizeByKey($event, c)"
                />
              </div>
            </th>
          </tr>
          <tr v-if="showFilters && filterable.length" class="dt-filter-row">
            <th v-if="expandable" class="dt-expand-col" />
            <th v-for="c in cols" :key="c.key" :class="{ 'is-pinned': c.pin === 'left' }" :style="cellStyle(c)">
              <template v-if="kindOf(c) === 'text'">
                <input class="dt-input" type="text" :value="textVal(c.key)" :aria-label="`Filter ${c.label}`" placeholder="contains…" @input="t.setFilter(c.key, ($event.target as HTMLInputElement).value)">
              </template>
              <template v-else-if="kindOf(c) === 'select'">
                <select class="dt-input" :value="textVal(c.key)" :aria-label="`Filter ${c.label}`" @change="t.setFilter(c.key, ($event.target as HTMLSelectElement).value, true)">
                  <option value="">All</option>
                  <option v-for="o in (c.options ?? Object.keys(c.badge ?? {}).map(k => ({ value: k, label: k.replace(/_/g, ' ') })))" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
              </template>
              <template v-else-if="kindOf(c) === 'bool'">
                <select class="dt-input" :value="textVal(c.key)" :aria-label="`Filter ${c.label}`" @change="t.setFilter(c.key, ($event.target as HTMLSelectElement).value, true)">
                  <option value="">Any</option><option value="true">Yes</option><option value="false">No</option>
                </select>
              </template>
              <template v-else-if="kindOf(c) === 'date'">
                <div class="dt-range">
                  <input class="dt-input" type="date" :value="rangeVal(c.key, 'from')" :aria-label="`${c.label} from`" @change="setRange(c.key, 'from', ($event.target as HTMLInputElement).value)">
                  <input class="dt-input" type="date" :value="rangeVal(c.key, 'to')" :aria-label="`${c.label} to`" @change="setRange(c.key, 'to', ($event.target as HTMLInputElement).value)">
                </div>
              </template>
              <template v-else-if="kindOf(c) === 'number'">
                <div class="dt-range">
                  <input class="dt-input" type="number" :value="rangeVal(c.key, 'from')" :aria-label="`${c.label} minimum`" placeholder="min" @input="setRange(c.key, 'from', ($event.target as HTMLInputElement).value)">
                  <input class="dt-input" type="number" :value="rangeVal(c.key, 'to')" :aria-label="`${c.label} maximum`" placeholder="max" @input="setRange(c.key, 'to', ($event.target as HTMLInputElement).value)">
                </div>
              </template>
            </th>
          </tr>
        </thead>

        <tbody v-if="showSkeleton">
          <tr v-for="n in 6" :key="`s${n}`" class="dt-skel"><td v-for="c in cols" :key="c.key"><span /></td></tr>
        </tbody>
        <tbody v-else-if="t.rows.value.length">
          <template v-for="(row, i) in t.rows.value" :key="rid(row, i)">
            <tr :class="{ 'dt-row-open': expanded.has(rid(row, i)), 'dt-clickable': expandable }" @click="onRow(row, i)">
              <td v-if="expandable" class="dt-expand-col">
                <button type="button" class="dt-toggle" :aria-expanded="expanded.has(rid(row, i))" :aria-label="expanded.has(rid(row, i)) ? 'Hide details' : 'Show details'" @click.stop="toggleExpand(rid(row, i))">
                  <ChevronRight :size="14" :class="{ 'is-open': expanded.has(rid(row, i)) }" aria-hidden="true" />
                </button>
              </td>
              <td v-for="c in cols" :key="c.key" :class="{ 'is-num': c.type === 'num', 'is-mono': c.type === 'mono', 'is-pinned': c.pin === 'left' }" :style="cellStyle(c)">
                <slot :name="`cell-${c.key}`" :row="row" :value="getCellPath(row, c.key)" :column="c">
                  <BadgePill v-if="c.type === 'badge' && getCellPath(row, c.key)" :variant="badgeVariant(c as TableColumn, getCellPath(row, c.key))">{{ formatTableCell(c, row) }}</BadgePill>
                  <template v-else>{{ formatTableCell(c, row) }}</template>
                </slot>
              </td>
            </tr>
            <tr v-if="expandable && expanded.has(rid(row, i))" class="dt-detail">
              <td :colspan="cols.length + 1"><slot name="expanded" :row="row" /></td>
            </tr>
          </template>
        </tbody>
        <tbody v-else-if="isEmpty">
          <tr><td :colspan="cols.length + (expandable ? 1 : 0)" class="dt-empty">
            <slot name="empty">{{ t.activeFilterCount.value ? 'Nothing matches the current search and filters.' : empty }}
              <button v-if="t.activeFilterCount.value" type="button" class="dt-link" @click="t.clearAll()">Clear them</button></slot>
          </td></tr>
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div class="dt-footer">
      <span class="dt-status" aria-live="polite">
        <template v-if="t.total.value">Showing {{ t.firstRow.value.toLocaleString() }}–{{ t.lastRow.value.toLocaleString() }} of {{ t.total.value.toLocaleString() }}</template>
        <template v-else-if="t.loaded.value">0 rows</template>
      </span>
      <div class="dt-pager" role="navigation" aria-label="Pagination">
        <button type="button" class="btn dt-icon" :disabled="t.page.value <= 1" aria-label="First page" @click="t.goto(1)"><ChevronsLeft :size="14" aria-hidden="true" /></button>
        <button type="button" class="btn dt-icon" :disabled="t.page.value <= 1" aria-label="Previous page" @click="t.prev()"><ChevronLeft :size="14" aria-hidden="true" /></button>
        <span class="dt-page">Page
          <input v-model="pageInput" class="dt-page-input" inputmode="numeric" aria-label="Page number" @keydown.enter="jump" @blur="jump">
          of {{ t.totalPages.value.toLocaleString() }}</span>
        <button type="button" class="btn dt-icon" :disabled="t.page.value >= t.totalPages.value" aria-label="Next page" @click="t.next()"><ChevronRight :size="14" aria-hidden="true" /></button>
        <button type="button" class="btn dt-icon" :disabled="t.page.value >= t.totalPages.value" aria-label="Last page" @click="t.goto(t.totalPages.value)"><ChevronsRight :size="14" aria-hidden="true" /></button>
      </div>
      <label class="dt-size">Rows
        <select :value="t.pageSize.value" aria-label="Rows per page" @change="t.setPageSize(Number(($event.target as HTMLSelectElement).value))">
          <option v-for="s in t.pageSizes" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
    </div>
  </section>
</template>

<style scoped>
.dt { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.dt-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.dt-spacer { flex: 1; }
.dt-search { display: inline-flex; align-items: center; gap: 6px; min-width: 220px; flex: 1 1 220px; max-width: 360px; padding: 0 10px; height: 30px; background: var(--surface-2); border: 1px solid var(--border-interactive); border-radius: var(--r-sm); color: var(--fg-3); }
.dt-search input { flex: 1; border: 0; background: transparent; outline: 0; font: inherit; font-size: 12px; color: var(--fg-1); min-width: 0; }
.dt-search:focus-within { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-wash); }
.dt-btn { display: inline-flex; align-items: center; gap: 6px; }
.dt-btn.is-on { background: var(--primary-wash); color: var(--primary); border-color: var(--primary); }
.dt-icon { padding-left: 8px; padding-right: 8px; }
.dt-count { min-width: 16px; padding: 0 5px; border-radius: 999px; background: var(--primary-fill); color: #fff; font-size: 11px; font-weight: 700; line-height: 16px; text-align: center; }
.dt-menu-wrap { position: relative; }
.dt-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; min-width: 200px; max-height: 340px; overflow: auto; display: flex; flex-direction: column; gap: 2px; padding: 8px; background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: var(--r-md); box-shadow: var(--elev-3); }
.dt-menu-title { margin: 6px 4px 2px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-3); }
.dt-check, .dt-item { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: var(--r-sm); font-size: 12px; color: var(--fg-1); cursor: pointer; text-align: left; background: transparent; border: 0; }
.dt-check:hover, .dt-item:hover { background: var(--surface-quiet); }
.dt-seg { display: flex; border: 1px solid var(--border-interactive); border-radius: var(--r-sm); overflow: hidden; }
.dt-seg button { flex: 1; padding: 4px 6px; font-size: 11px; text-transform: capitalize; background: var(--surface-2); border: 0; border-right: 1px solid var(--border-subtle); color: var(--fg-2); cursor: pointer; }
.dt-seg button:last-child { border-right: 0; }
.dt-seg button.on { background: var(--primary-fill); color: #fff; }
.dt-link { display: inline-flex; align-items: center; gap: 4px; padding: 2px 0; background: transparent; border: 0; cursor: pointer; font-size: 11px; font-weight: 600; color: var(--link); text-decoration: underline; text-underline-offset: 2px; }
.dt-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.dt-chip { display: inline-flex; align-items: center; gap: 5px; padding: 2px 4px 2px 9px; font-size: 11px; color: var(--fg-2); background: var(--primary-wash); border: 1px solid var(--border-subtle); border-radius: 999px; }
.dt-chip b { color: var(--fg-1); font-weight: 600; }
.dt-chip button { display: inline-flex; padding: 2px; background: transparent; border: 0; border-radius: 50%; cursor: pointer; color: var(--fg-3); }
.dt-chip button:hover { background: var(--surface-sunken); color: var(--fg-1); }
.dt-note { margin: 0; font-size: 12px; color: var(--warning-fg); }
.dt-state { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; font-size: 12px; border-radius: var(--r-sm); }
.dt-state--error { color: var(--danger-fg); background: var(--danger-bg); }

.dt-scroll { overflow: auto; border: 1px solid var(--border-subtle); border-radius: var(--r-md); background: var(--surface-2); }
.dt-scroll:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.dt-table { width: 100%; min-width: max-content; border-collapse: separate; border-spacing: 0; font-size: 12px; table-layout: auto; }
.dt-table thead th { position: sticky; top: 0; z-index: 3; background: var(--surface-1); border-bottom: 1px solid var(--border-strong); text-align: left; padding: 0; white-space: nowrap; }
.dt-filter-row th { top: 33px; z-index: 2; padding: 4px 8px; background: var(--surface-1); }
.dt-th { display: flex; align-items: center; gap: 2px; padding: 0 0 0 6px; height: 33px; position: relative; }
.dt-grip { color: var(--fg-3); opacity: 0; cursor: grab; flex-shrink: 0; }
.dt-table th:hover .dt-grip { opacity: .7; }
.dt-sort { display: inline-flex; align-items: center; gap: 5px; flex: 1; min-width: 0; padding: 0 6px; height: 100%; background: transparent; border: 0; cursor: pointer; font: 700 10px/1 var(--font-ui); letter-spacing: .06em; text-transform: uppercase; color: var(--fg-2); }
.dt-sort span { overflow: hidden; text-overflow: ellipsis; }
.dt-sort:hover { color: var(--primary); }
.dt-sort svg { opacity: .35; flex-shrink: 0; }
.dt-sort svg.dt-sorted { opacity: 1; color: var(--primary); }
.dt-sort:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.dt-rank { font-size: 10.5px; color: var(--primary); }
.dt-label { flex: 1; padding: 0 6px; font: 700 10px/1 var(--font-ui); letter-spacing: .06em; text-transform: uppercase; color: var(--fg-2); }
.dt-resize { position: absolute; right: 0; top: 0; bottom: 0; width: 7px; cursor: col-resize; touch-action: none; }
.dt-resize::after { content: ''; position: absolute; right: 3px; top: 8px; bottom: 8px; width: 1px; background: var(--border-strong); }
.dt-resize:hover::after, .dt-resize:focus-visible::after { width: 2px; background: var(--primary); }
.dt-resize:focus-visible { outline: none; }
.dt-table th.is-over { box-shadow: inset 2px 0 0 var(--primary); }
.dt-table th.is-num .dt-th { justify-content: flex-end; }

.dt-table tbody td { padding: var(--dt-py, 8px) 12px; border-bottom: 1px solid var(--border-subtle); color: var(--fg-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: var(--surface-2); }
.dt-table tbody tr:hover td { background: var(--surface-quiet); }
.dt-table tbody tr:last-child td { border-bottom: 0; }
.dt-table td.is-num { text-align: right; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.dt-table td.is-mono { font-family: var(--font-mono); font-size: 11.5px; }
.dt-table .is-pinned { position: sticky; z-index: 2; box-shadow: 1px 0 0 var(--border-subtle); }
.dt-table thead .is-pinned { z-index: 4; }
.dt--compact { --dt-py: 4px; }
.dt--comfortable { --dt-py: 13px; }
.dt-expand-col { width: 34px; min-width: 34px; max-width: 34px; padding: 0 !important; text-align: center; }
.dt-toggle { display: inline-flex; padding: 6px; background: transparent; border: 0; border-radius: var(--r-sm); cursor: pointer; color: var(--fg-3); }
.dt-toggle:hover { background: var(--surface-sunken); color: var(--fg-1); }
.dt-toggle:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.dt-toggle svg { transition: transform .15s; }
.dt-toggle svg.is-open { transform: rotate(90deg); }
.dt-clickable { cursor: pointer; }
.dt-detail td { padding: 0 !important; white-space: normal !important; background: var(--surface-1) !important; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.dt-empty { padding: 28px 12px; text-align: center; color: var(--fg-3); white-space: normal !important; }
.dt-input { width: 100%; min-width: 90px; height: 26px; padding: 0 6px; font: inherit; font-size: 11px; color: var(--fg-1); background: var(--surface-2); border: 1px solid var(--border-interactive); border-radius: var(--r-sm); }
.dt-input:focus-visible { outline: 2px solid var(--primary); outline-offset: 0; }
.dt-range { display: flex; gap: 4px; }
.dt-skel td span { display: block; height: 10px; border-radius: 3px; background: linear-gradient(90deg, var(--surface-sunken), var(--surface-quiet), var(--surface-sunken)); background-size: 200% 100%; animation: dt-shimmer 1.2s linear infinite; }
.dt--busy .dt-table tbody { opacity: .65; transition: opacity .15s; }

.dt-cards { display: flex; flex-direction: column; gap: 8px; }
.dt-card, .dt-skel-card { padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--r-md); }
.dt-skel-card { height: 92px; background: var(--surface-sunken); }
.dt-card dl { margin: 0; display: grid; gap: 4px; }
.dt-card dl > div { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; }
.dt-card dt { color: var(--fg-3); }
.dt-card dd { margin: 0; text-align: right; color: var(--fg-1); overflow-wrap: anywhere; }

.dt-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; justify-content: space-between; padding: 2px 2px 0; font-size: 12px; color: var(--fg-3); font-variant-numeric: tabular-nums; }
.dt-pager { display: inline-flex; align-items: center; gap: 4px; }
.dt-page { display: inline-flex; align-items: center; gap: 6px; padding: 0 6px; color: var(--fg-2); }
.dt-page-input { width: 46px; height: 26px; text-align: center; font: inherit; font-size: 12px; color: var(--fg-1); background: var(--surface-2); border: 1px solid var(--border-interactive); border-radius: var(--r-sm); }
.dt-size { display: inline-flex; align-items: center; gap: 6px; }
.dt-size select { height: 26px; font: inherit; font-size: 10.5px; background: var(--surface-2); color: var(--fg-1); border: 1px solid var(--border-interactive); border-radius: var(--r-sm); }
.dt-spin { animation: dt-rotate .8s linear infinite; }
@keyframes dt-rotate { to { transform: rotate(360deg); } }
@keyframes dt-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .dt-spin, .dt-skel td span, .dt-toggle svg { animation: none; transition: none; } .dt--busy .dt-table tbody { transition: none; } }
</style>
