<template>
  <!--
    The query behind a query.* source: which dataset fields to fetch, filters,
    sort and how many records. The server validates every part against the
    dataset's allow-list. Dashboard filters the dataset can honour are added
    on top at request time.
  -->
  <div class="qe">
    <p v-if="error" class="qe-fail" role="alert">{{ error }} <button type="button" class="qe-link" @click="retry">Retry</button></p>
    <p v-else-if="!datasets" class="qe-muted" role="status">Loading the dataset's fields…</p>

    <template v-else>
      <label v-if="savedChoices.length" class="qe-field">
        <span class="qe-label">Start from a saved query</span>
        <select class="qe-input" value="" @change="applySaved(val($event))">
          <option value="">Choose…</option>
          <option v-for="q in savedChoices" :key="q.id" :value="q.id">{{ q.name }}</option>
        </select>
      </label>

      <label v-if="join" class="qe-field">
        <span class="qe-label">Join</span>
        <select class="qe-input" :value="joinParams.join_type ?? 'inner'" @change="emitParams({ ...joinParams, join_type: val($event) as 'inner' | 'left' })">
          <option value="inner">Only matching records (inner)</option>
          <option value="left">Every {{ datasets[join.left]?.label ?? join.left }} record (left)</option>
        </select>
      </label>

      <fieldset v-for="side in sides" :key="side.key" class="qe-side">
        <legend v-if="join" class="qe-side-name">{{ side.meta?.label ?? side.dataset }}</legend>
        <p v-if="!side.meta" class="qe-fail">The server doesn't list the '{{ side.dataset }}' dataset.</p>
        <template v-else>
          <details class="qe-fields">
            <summary>Fields <span class="qe-meta">{{ side.query.fields?.length ? `${side.query.fields.length} of ${side.meta.fields.length}` : 'all' }}</span></summary>
            <label v-for="f in side.meta.fields" :key="f.name" class="qe-check">
              <input type="checkbox" :checked="!side.query.fields?.length || side.query.fields.includes(f.name)" @change="toggleField(side.key, f.name, checked($event))">
              {{ humanize(f.name) }} <span class="qe-type">{{ f.type }}</span>
            </label>
          </details>

          <div class="qe-filters">
            <span class="qe-label">Filters</span>
            <div v-for="(flt, i) in side.query.filters ?? []" :key="i" class="qe-filter">
              <select class="qe-input" :value="flt.field" :aria-label="`Filter ${i + 1} field`" @change="setFilter(side.key, i, { field: val($event), op: 'eq', value: '' })">
                <option v-for="f in side.meta.fields" :key="f.name" :value="f.name">{{ humanize(f.name) }}</option>
              </select>
              <select class="qe-input qe-op" :value="flt.op" :aria-label="`Filter ${i + 1} condition`" @change="setFilter(side.key, i, { ...flt, op: val($event) as FilterOp })">
                <option v-for="o in opsFor(fieldOf(side.meta, flt.field))" :key="o" :value="o">{{ OP_LABELS[o] }}</option>
              </select>
              <select
                v-if="fieldOf(side.meta, flt.field)?.values?.length && flt.op !== 'in'" class="qe-input" :value="String(flt.value)"
                :aria-label="`Filter ${i + 1} value`" @change="setFilter(side.key, i, { ...flt, value: val($event) })"
              >
                <option value="" disabled>Value…</option>
                <option v-for="v in fieldOf(side.meta, flt.field)!.values" :key="v" :value="v">{{ humanize(v) }}</option>
              </select>
              <input
                v-else class="qe-input" :type="inputType(fieldOf(side.meta, flt.field), flt.op)" :value="displayValue(flt)"
                :placeholder="flt.op === 'in' ? 'a, b, c' : 'Value'" :aria-label="`Filter ${i + 1} value`"
                @change="setFilter(side.key, i, { ...flt, value: parseValue(fieldOf(side.meta, flt.field), flt.op, val($event)) })"
              >
              <button type="button" class="qe-x" :aria-label="`Remove filter ${i + 1}`" @click="removeFilter(side.key, i)"><X :size="13" aria-hidden="true" /></button>
            </div>
            <button type="button" class="qe-link" @click="addFilter(side.key)"><Plus :size="12" aria-hidden="true" />Add filter</button>
          </div>

          <div v-if="!join" class="qe-pair">
            <label class="qe-field">
              <span class="qe-label">Sort by</span>
              <select class="qe-input" :value="side.query.sort?.field ?? ''" @change="setSort(val($event), side.query.sort?.direction ?? 'desc')">
                <option value="" :title="`Dataset default: ${humanize(side.meta.default_sort.field)}`">Default</option>
                <option v-for="f in side.meta.fields" :key="f.name" :value="f.name">{{ humanize(f.name) }}</option>
              </select>
            </label>
            <label class="qe-field">
              <span class="qe-label">Order</span>
              <select class="qe-input" :value="side.query.sort?.direction ?? 'desc'" :disabled="!side.query.sort" @change="setSort(side.query.sort!.field, val($event) as 'asc' | 'desc')">
                <option value="desc">Newest / high first</option><option value="asc">Oldest / low first</option>
              </select>
            </label>
          </div>
        </template>
      </fieldset>

      <label class="qe-field">
        <span class="qe-label">Records to fetch (max {{ QUERY_MAX_ROWS }})</span>
        <input
          class="qe-input qe-num" type="number" min="1" :max="QUERY_MAX_ROWS" :value="(params.limit as number | undefined) ?? ''" :placeholder="String(QUERY_MAX_ROWS)"
          @change="emitParams({ ...params, limit: Math.min(QUERY_MAX_ROWS, Number(val($event))) || undefined })"
        >
      </label>
      <p class="qe-muted">
        Counts and charts cover the records fetched. When more match, the widget says "from the first N of M records".
        <template v-if="honours.length"> Dashboard filters on <strong>{{ honours.map(f => FIELD_LABELS[f]).join(', ') }}</strong> also apply.</template>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Plus, X } from 'lucide-vue-next'
import type { Dataset, DatasetField, FilterOp, QueryDatasetKey, QueryFilter } from '~/composables/api'
import { QUERY_JOINS_BY_ID, QUERY_MAX_ROWS, SOURCES_BY_ID, type JoinParams, type QueryParams } from '~/utils/dataSources'
import { humanize } from '~/utils/bindings'
import { FIELD_LABELS } from '~/utils/filterFields'
import { useQueryCatalog } from '~/composables/useQueryCatalog'

const props = defineProps<{ source: string; params: Record<string, unknown> }>()
const emit = defineEmits<{ change: [params: Record<string, unknown>] }>()

const OP_LABELS: Record<FilterOp, string> = { eq: 'is', neq: 'is not', gt: '>', gte: '≥', lt: '<', lte: '≤', contains: 'contains', in: 'is one of' }
const { datasets, saved, error, retry, ensure } = useQueryCatalog()
ensure()

const val = (e: Event) => (e.target as HTMLInputElement).value
const checked = (e: Event) => (e.target as HTMLInputElement).checked

const join = computed(() => QUERY_JOINS_BY_ID[props.source] ?? null)
const dataset = computed(() => (join.value ? null : props.source.replace(/^query\./, '') as QueryDatasetKey))
const honours = computed(() => SOURCES_BY_ID[props.source]?.honours ?? [])
const joinParams = computed(() => props.params as JoinParams)

type SideKey = 'single' | 'left' | 'right'
const sides = computed(() => {
  const ds = datasets.value ?? {}
  if (join.value) {
    return (['left', 'right'] as const).map(k => ({
      key: k as SideKey, dataset: join.value![k], meta: ds[join.value![k]] as Dataset | undefined,
      query: (joinParams.value[k] ?? {}) as QueryParams,
    }))
  }
  return [{ key: 'single' as SideKey, dataset: dataset.value!, meta: ds[dataset.value!] as Dataset | undefined, query: props.params as QueryParams }]
})

// ── edits ──
function emitParams(p: Record<string, unknown>) {
  const out = { ...p }
  for (const [k, v] of Object.entries(out)) if (v === undefined) delete out[k]
  emit('change', out)
}
function patchSide(side: SideKey, patch: Partial<QueryParams>) {
  const cur = side === 'single' ? props.params as QueryParams : (joinParams.value[side] ?? {}) as QueryParams
  const next: Record<string, unknown> = { ...cur, ...patch }
  for (const [k, v] of Object.entries(next)) if (v === undefined || (Array.isArray(v) && !v.length)) delete next[k]
  emitParams(side === 'single' ? next : { ...props.params, [side]: next })
}
const sideOf = (side: SideKey) => sides.value.find(s => s.key === side)!
const fieldOf = (meta: Dataset, name: string) => meta.fields.find(f => f.name === name)

function toggleField(side: SideKey, name: string, on: boolean) {
  const s = sideOf(side)
  const all = s.meta!.fields.map(f => f.name)
  const cur = s.query.fields?.length ? s.query.fields : all
  const next = on ? all.filter(f => cur.includes(f) || f === name) : cur.filter(f => f !== name)
  patchSide(side, { fields: next.length === all.length ? undefined : next })
}

function opsFor(f: DatasetField | undefined): FilterOp[] {
  if (!f) return ['eq']
  if (f.type === 'number' || f.type === 'datetime') return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte']
  if (f.type === 'enum') return ['eq', 'neq', 'in']
  if (f.type === 'uuid') return ['eq', 'neq', 'in']
  return ['eq', 'neq', 'contains', 'in']
}
const inputType = (f: DatasetField | undefined, op: FilterOp) =>
  op === 'in' ? 'text' : f?.type === 'number' ? 'number' : f?.type === 'datetime' ? 'date' : 'text'
const displayValue = (flt: QueryFilter) => (Array.isArray(flt.value) ? flt.value.join(', ') : String(flt.value ?? ''))
function parseValue(f: DatasetField | undefined, op: FilterOp, raw: string): QueryFilter['value'] {
  const one = (v: string) => (f?.type === 'number' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v.trim())
  return op === 'in' ? raw.split(',').map(one).filter(v => v !== '') : one(raw)
}

function addFilter(side: SideKey) {
  const s = sideOf(side)
  const first = s.meta!.fields.find(f => f.type === 'enum') ?? s.meta!.fields[0]!
  patchSide(side, { filters: [...(s.query.filters ?? []), { field: first.name, op: 'eq', value: first.values?.[0] ?? '' }] })
}
function setFilter(side: SideKey, i: number, f: QueryFilter) {
  const list = [...(sideOf(side).query.filters ?? [])]
  // Changing the field resets the condition to one its type supports.
  if (!opsFor(fieldOf(sideOf(side).meta!, f.field)).includes(f.op)) f = { ...f, op: 'eq' }
  list[i] = f
  patchSide(side, { filters: list })
}
function removeFilter(side: SideKey, i: number) {
  patchSide(side, { filters: (sideOf(side).query.filters ?? []).filter((_, j) => j !== i) })
}
function setSort(field: string, direction: 'asc' | 'desc') {
  patchSide('single', { sort: field ? { field, direction } : undefined })
}

// ── saved queries: copy the definition, never run it (a run distributes it) ──
const savedChoices = computed(() => (saved.value ?? []).filter((q) => {
  const d = q.definition
  return join.value
    ? q.query_type === 'join' && d.left?.dataset === join.value.left && d.right?.dataset === join.value.right
    : q.query_type === 'single' && d.dataset === dataset.value
}))
function applySaved(id: string) {
  const q = savedChoices.value.find(x => x.id === id)
  if (!q) return
  const d = q.definition
  const strip = <T extends { dataset?: unknown }>(side: T | undefined) => {
    if (!side) return undefined
    const { dataset: _d, ...rest } = side
    return rest
  }
  emitParams(join.value
    ? { left: strip(d.left), right: strip(d.right), join_type: d.join_type, limit: d.limit }
    : { fields: d.fields?.length ? d.fields : undefined, filters: d.filters?.length ? d.filters : undefined, sort: d.sort, limit: d.limit })
}

</script>

<style scoped>
.qe { display: flex; flex-direction: column; gap: 10px; padding: 10px; border: 1px solid var(--border-subtle); border-radius: var(--r-sm); background: var(--surface-1); }
.qe-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.qe-label { font-size: 11px; color: var(--fg-2); font-weight: 500; }
.qe-input { height: 28px; padding: 0 6px; font-size: 12px; min-width: 0; }
.qe-num { font-family: var(--font-mono); }
.qe-muted { font-size: 11px; color: var(--fg-3); margin: 0; line-height: 1.5; }
.qe-muted strong { color: var(--fg-2); font-weight: 600; }
.qe-fail { font-size: 11.5px; color: var(--danger-fg); margin: 0; line-height: 1.5; }
.qe-side { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.qe-side + .qe-side { border-top: 1px solid var(--border-subtle); padding-top: 10px; }
.qe-side-name { font-size: 11px; font-weight: 700; color: var(--fg-1); padding: 0; margin-bottom: 4px; }
.qe-fields summary { font-size: 11px; color: var(--fg-2); font-weight: 500; cursor: pointer; display: flex; gap: 6px; align-items: baseline; }
.qe-fields summary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.qe-fields[open] summary { margin-bottom: 4px; }
.qe-meta { font-size: 10px; font-family: var(--font-mono); color: var(--fg-3); }
.qe-check { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--fg-2); cursor: pointer; padding: 1px 0; }
.qe-check input { width: auto; accent-color: var(--primary); }
.qe-type { margin-left: auto; font-size: 9.5px; font-family: var(--font-mono); color: var(--fg-3); }
.qe-filters { display: flex; flex-direction: column; gap: 5px; }
.qe-filter { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr) minmax(0, 1.2fr) 22px; gap: 4px; align-items: center; }
.qe-x { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 0; background: none; color: var(--fg-3); cursor: pointer; border-radius: var(--r-xs); padding: 0; }
.qe-x:focus-visible, .qe-link:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.qe-link { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; background: none; border: 0; padding: 0; color: var(--primary); font-size: 11.5px; font-weight: 600; cursor: pointer; }
.qe-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
@media (hover: hover) {
  .qe-x:hover { background: var(--danger-bg); color: var(--danger-fg); }
  .qe-link:hover { text-decoration: underline; }
}
</style>
