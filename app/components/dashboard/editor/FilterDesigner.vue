<template>
  <!--
    Filter designer - Tableau's "Apply to Worksheets", made explicit.
    For each filter you choose the widgets it drives; widgets that can't
    honour the field are shown disabled with the reason, so nobody believes
    a chart is filtered when it isn't.
  -->
  <div class="fd">
    <div class="fd-add">
      <select v-model="newField" class="fd-input" aria-label="Filter field">
        <option value="" disabled>Add a filter on…</option>
        <option v-for="f in ALL_FIELDS" :key="f" :value="f" :disabled="filters.some(x => x.field === f)">{{ FIELD_LABELS[f] }}</option>
      </select>
      <button type="button" class="btn btn-sm btn-primary" :disabled="!newField" @click="add">Add</button>
    </div>

    <p v-if="!filters.length" class="fd-empty">No filters yet. Filters appear in a bar above the dashboard and narrow every widget they apply to.</p>

    <details v-for="(f, i) in filters" :key="f.id" class="fd-item" :open="openId === f.id" @toggle="onToggle($event, f.id)">
      <summary>
        <ChevronRight :size="14" class="fd-chevron" aria-hidden="true" />
        <span class="fd-name">{{ f.label }}</span>
        <Lock v-if="f.locked || f.bindToViewer" :size="11" class="fd-lock" :aria-label="f.bindToViewer ? 'Pinned to viewer' : 'Locked'" />
        <span class="fd-meta">{{ appliesSummary(f) }}</span>
      </summary>

      <div class="fd-body">
        <label class="fd-row">Label <input type="text" class="fd-input" :value="f.label" @input="update(i, { label: val($event) })"></label>
        <label class="fd-row">Control
          <select class="fd-input" :value="f.control" @change="update(i, { control: val($event) as DashboardFilter['control'] })">
            <option v-if="f.field === 'date_range'" value="daterange">Date range</option>
            <template v-else>
              <option value="select">Dropdown</option>
              <option value="multiselect">Multi-select</option>
              <option value="segmented">Buttons</option>
            </template>
          </select>
        </label>
        <label v-if="f.field !== 'date_range' && optionsFor(f).length" class="fd-row">Default
          <select class="fd-input" :value="(f.defaultValue as string) ?? ''" @change="update(i, { defaultValue: val($event) || null })">
            <option value="">All</option>
            <option v-for="o in optionsFor(f)" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>

        <div v-if="f.field === 'agency' || f.field === 'county'" class="fd-row">
          <span>Audience</span>
          <div class="fd-radios">
            <label><input type="radio" :name="`b-${f.id}`" :checked="!f.bindToViewer && !f.locked" @change="update(i, { bindToViewer: null, locked: false })"> Viewer chooses</label>
            <label v-if="f.field === 'agency'"><input type="radio" :name="`b-${f.id}`" :checked="f.bindToViewer === 'agency'" @change="update(i, { bindToViewer: 'agency', locked: false })"> Pin to viewer's own agency</label>
            <label><input type="radio" :name="`b-${f.id}`" :checked="!!f.locked && !f.bindToViewer" @change="update(i, { bindToViewer: null, locked: true })"> Lock to the default</label>
          </div>
        </div>
        <label v-else class="fd-check"><input type="checkbox" :checked="!!f.locked" @change="update(i, { locked: checked($event) })"> Lock to the default (viewers can't change it)</label>

        <div class="fd-applies">
          <div class="fd-applies-head">
            <span>Applies to</span>
            <label class="fd-check"><input type="checkbox" :checked="f.appliesTo === 'all'" @change="update(i, { appliesTo: checked($event) ? 'all' : supporting(f).map(w => w.id) })"> All compatible widgets</label>
          </div>
          <ul class="fd-widgets">
            <li v-for="w in widgets" :key="w.id" :class="{ off: !supports(w, f) }">
              <label class="fd-check" :title="supports(w, f) ? '' : `${labelOf(w)} can't be filtered by ${FIELD_LABELS[f.field]}`">
                <input
                  type="checkbox" :disabled="!supports(w, f) || f.appliesTo === 'all'"
                  :checked="supports(w, f) && (f.appliesTo === 'all' || f.appliesTo.includes(w.id))"
                  @change="toggleTarget(i, w.id, checked($event))"
                >
                {{ labelOf(w) }}
                <span v-if="!supports(w, f)" class="fd-na">n/a</span>
              </label>
            </li>
          </ul>
        </div>
        <button type="button" class="fd-remove" @click="remove(i)">Remove filter</button>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, Lock } from 'lucide-vue-next'
import type { DashboardFilter, FilterField, FilterOption, WidgetInstance } from '~/types/dashboard'
import { WIDGETS_BY_TYPE, widgetFilterFields } from '~/utils/widgetRegistry'
import { DEFAULT_CONTROL, FIELD_LABELS, FIELD_OPTIONS } from '~/utils/filterFields'
import { newId } from '~/utils/layoutEngine'

const props = defineProps<{ filters: DashboardFilter[]; widgets: WidgetInstance[] }>()
const emit = defineEmits<{ 'update:filters': [DashboardFilter[]] }>()

const ALL_FIELDS = Object.keys(FIELD_LABELS) as FilterField[]
const newField = ref<FilterField | ''>('')
const openId = ref<string | null>(null)

const val = (e: Event) => (e.target as HTMLInputElement).value
const checked = (e: Event) => (e.target as HTMLInputElement).checked
const labelOf = (w: WidgetInstance) => w.title || WIDGETS_BY_TYPE[w.type]?.title || w.type
const supports = (w: WidgetInstance, f: DashboardFilter) => widgetFilterFields(w.type, w.config).includes(f.field)
const supporting = (f: DashboardFilter) => props.widgets.filter(w => supports(w, f))
const optionsFor = (f: DashboardFilter): FilterOption[] => f.options?.length ? f.options : FIELD_OPTIONS[f.field] ?? []

function appliesSummary(f: DashboardFilter) {
  const n = f.appliesTo === 'all' ? supporting(f).length : f.appliesTo.length
  return `${f.appliesTo === 'all' ? 'all · ' : ''}${n} widget${n === 1 ? '' : 's'}`
}

function add() {
  if (!newField.value) return
  const f: DashboardFilter = {
    id: newId('f'), field: newField.value, label: FIELD_LABELS[newField.value],
    control: DEFAULT_CONTROL[newField.value], appliesTo: 'all', defaultValue: null,
  }
  emit('update:filters', [...props.filters, f])
  openId.value = f.id
  newField.value = ''
}
function update(i: number, p: Partial<DashboardFilter>) {
  emit('update:filters', props.filters.map((f, j) => (j === i ? { ...f, ...p } : f)))
}
function remove(i: number) { emit('update:filters', props.filters.filter((_, j) => j !== i)) }
function toggleTarget(i: number, widgetId: string, on: boolean) {
  const f = props.filters[i]!
  const cur = f.appliesTo === 'all' ? supporting(f).map(w => w.id) : f.appliesTo
  update(i, { appliesTo: on ? [...new Set([...cur, widgetId])] : cur.filter(id => id !== widgetId) })
}
function onToggle(e: Event, id: string) {
  if ((e.target as HTMLDetailsElement).open) openId.value = id
  else if (openId.value === id) openId.value = null
}
</script>

<style scoped>
.fd { display: flex; flex-direction: column; gap: 8px; }
.fd-add { display: flex; gap: 6px; }
.fd-input { height: 30px; padding: 0 8px; font-size: 12px; }
.fd-empty { font-size: 11.5px; color: var(--fg-3); line-height: 1.5; margin: 4px 0; }
.fd-item { border: 1px solid var(--border-subtle); border-radius: var(--r-sm); background: var(--surface-2); }
.fd-item summary { display: flex; align-items: center; gap: 6px; padding: 9px 10px; cursor: pointer; list-style: none; border-radius: var(--r-sm); }
.fd-item summary::-webkit-details-marker { display: none; }
.fd-item summary:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.fd-item[open] summary { border-bottom: 1px solid var(--border-subtle); border-radius: var(--r-sm) var(--r-sm) 0 0; }
.fd-chevron { flex-shrink: 0; color: var(--fg-3); transition: transform 160ms var(--ease-out); }
.fd-item[open] .fd-chevron { transform: rotate(90deg); }
.fd-name { font-size: 12px; font-weight: 600; color: var(--fg-1); }
.fd-lock { color: var(--fg-3); flex-shrink: 0; }
.fd-meta { margin-left: auto; font-size: 10.5px; color: var(--fg-3); font-family: var(--font-mono); white-space: nowrap; }
.fd-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.fd-row { display: grid; grid-template-columns: 70px 1fr; align-items: center; gap: 8px; font-size: 11.5px; color: var(--fg-2); }
.fd-radios { display: flex; flex-direction: column; gap: 4px; }
.fd-radios label, .fd-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-2); cursor: pointer; }
.fd-radios input, .fd-check input { width: auto; accent-color: var(--primary); }
.fd-applies { border-top: 1px solid var(--border-subtle); padding-top: 8px; }
.fd-applies-head { display: flex; justify-content: space-between; align-items: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--fg-3); margin-bottom: 6px; }
.fd-applies-head .fd-check { text-transform: none; letter-spacing: 0; font-weight: 500; }
.fd-widgets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; max-height: 200px; overflow-y: auto; }
.fd-widgets li.off { opacity: .55; }
.fd-na { font-size: 9px; font-family: var(--font-mono); color: var(--fg-3); margin-left: auto; }
.fd-remove { align-self: flex-start; background: none; border: 0; padding: 2px 0; color: var(--danger-fg); font-size: 12px; font-weight: 500; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .fd-chevron { transition: none; } }
.fd-remove:hover { text-decoration: underline; }
</style>
