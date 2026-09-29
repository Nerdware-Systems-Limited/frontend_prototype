<template>
  <!--
    Action designer - Tableau's Dashboard > Actions.
      Filter    : click in Source -> Targets are filtered by the clicked value
      Highlight : click in Source -> Targets dim everything else
      Navigate  : click in Source -> open a route with {value} substituted
  -->
  <div class="ad">
    <p v-if="!sources.length" class="ad-empty">
      Add a clickable widget first (risk map, feed health, fatality trend, agency snapshot) - those are the ones that can drive actions.
    </p>
    <button v-else type="button" class="btn btn-sm ad-add" @click="add"><Plus :size="14" aria-hidden="true" />Add action</button>

    <div v-for="(a, i) in actions" :key="a.id" class="ad-item">
      <div class="ad-sentence">
        When a viewer clicks
        <select class="ad-input" :value="a.sourceWidgetId" aria-label="Source widget" @change="changeSource(i, val($event))">
          <option v-for="w in sources" :key="w.id" :value="w.id">{{ labelOf(w) }}</option>
        </select>
        on a
        <select class="ad-input" :value="a.field" aria-label="Field" @change="update(i, { field: val($event) as FilterField })">
          <option v-for="f in emitsOf(a.sourceWidgetId)" :key="f" :value="f">{{ FIELD_LABELS[f].toLowerCase() }}</option>
        </select>,
        <select class="ad-input" :value="a.type" aria-label="Action type" @change="update(i, { type: val($event) as ActionType })">
          <option value="filter">filter</option>
          <option value="highlight">highlight</option>
          <option value="navigate">open a page</option>
        </select>
      </div>

      <template v-if="a.type === 'navigate'">
        <input
          type="text" class="ad-input ad-wide" :value="a.urlTemplate ?? ''" placeholder="/safety/incidents?county={value}"
          aria-label="Route template" @input="update(i, { urlTemplate: val($event) })"
        >
        <p class="ad-hint"><code>{value}</code> is replaced with what was clicked.</p>
      </template>
      <div v-else class="ad-targets">
        <label class="ad-check"><input type="checkbox" :checked="a.targetWidgetIds === 'all'" @change="update(i, { targetWidgetIds: checked($event) ? 'all' : compatible(a).map(w => w.id) })"> every compatible widget</label>
        <template v-if="a.targetWidgetIds !== 'all'">
          <label v-for="w in compatible(a)" :key="w.id" class="ad-check">
            <input type="checkbox" :checked="a.targetWidgetIds.includes(w.id)" @change="toggleTarget(i, w.id, checked($event))"> {{ labelOf(w) }}
          </label>
          <p v-if="!compatible(a).length" class="ad-hint">No other widget can be filtered by {{ FIELD_LABELS[a.field].toLowerCase() }}.</p>
        </template>
        <label class="ad-row">When the selection is cleared
          <select class="ad-input" :value="a.onClear" @change="update(i, { onClear: val($event) as DashboardAction['onClear'] })">
            <option value="show-all">show all values</option>
            <option value="keep">keep the last selection</option>
          </select>
        </label>
      </div>

      <div class="ad-foot">
        <input type="text" class="ad-input ad-name" :value="a.name" aria-label="Action name" @input="update(i, { name: val($event) })">
        <button type="button" class="ad-remove" :aria-label="`Remove action ${a.name}`" @click="remove(i)">Remove</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import type { ActionType, DashboardAction, FilterField, WidgetInstance } from '~/types/dashboard'
import { WIDGETS_BY_TYPE, widgetFilterFields } from '~/utils/widgetRegistry'
import { FIELD_LABELS } from '~/utils/filterFields'
import { newId } from '~/utils/layoutEngine'

const props = defineProps<{ actions: DashboardAction[]; widgets: WidgetInstance[] }>()
const emit = defineEmits<{ 'update:actions': [DashboardAction[]] }>()

const val = (e: Event) => (e.target as HTMLSelectElement).value
const checked = (e: Event) => (e.target as HTMLInputElement).checked
const labelOf = (w: WidgetInstance) => w.title || WIDGETS_BY_TYPE[w.type]?.title || w.type
const emitsOf = (id: string): FilterField[] => {
  const w = props.widgets.find(x => x.id === id)
  return (w && WIDGETS_BY_TYPE[w.type]?.emits) || []
}
const sources = computed(() => props.widgets.filter(w => WIDGETS_BY_TYPE[w.type]?.emits?.length))
const compatible = (a: DashboardAction) =>
  props.widgets.filter(w => w.id !== a.sourceWidgetId && widgetFilterFields(w.type, w.config).includes(a.field))

function add() {
  const src = sources.value[0]!
  const field = emitsOf(src.id)[0]!
  emit('update:actions', [...props.actions, {
    id: newId('a'), name: `Filter by ${FIELD_LABELS[field].toLowerCase()} from ${labelOf(src)}`,
    type: 'filter', sourceWidgetId: src.id, field, targetWidgetIds: 'all', onClear: 'show-all',
  }])
}
function update(i: number, p: Partial<DashboardAction>) {
  emit('update:actions', props.actions.map((a, j) => (j === i ? { ...a, ...p } : a)))
}
function changeSource(i: number, id: string) {
  const fields = emitsOf(id)
  const cur = props.actions[i]!
  update(i, { sourceWidgetId: id, field: fields.includes(cur.field) ? cur.field : fields[0]! })
}
function toggleTarget(i: number, id: string, on: boolean) {
  const a = props.actions[i]!
  const cur = a.targetWidgetIds === 'all' ? [] : a.targetWidgetIds
  update(i, { targetWidgetIds: on ? [...new Set([...cur, id])] : cur.filter(x => x !== id) })
}
function remove(i: number) { emit('update:actions', props.actions.filter((_, j) => j !== i)) }
</script>

<style scoped>
.ad { display: flex; flex-direction: column; gap: 10px; }
.ad-add { align-self: flex-start; gap: 6px; }
.ad-empty { font-size: 11.5px; color: var(--fg-3); line-height: 1.5; margin: 4px 0; }
.ad-item { border: 1px solid var(--border-subtle); border-radius: var(--r-sm); background: var(--surface-2); padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.ad-sentence { font-size: 12px; color: var(--fg-2); line-height: 2.2; }
/* Inline selects read as part of the sentence, so they size to their text instead of the global 100%. */
.ad-input { width: auto; max-width: 100%; height: 28px; padding: 0 6px; font-size: 12px; }
.ad-wide, .ad-name { width: 100%; }
.ad-targets { display: flex; flex-direction: column; gap: 4px; padding-left: 8px; border-left: 2px solid var(--border-subtle); }
.ad-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-2); cursor: pointer; }
.ad-check input { width: auto; accent-color: var(--primary); }
.ad-row { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--fg-3); margin-top: 4px; }
.ad-hint { font-size: 10.5px; color: var(--fg-3); margin: 0; }
.ad-foot { display: flex; gap: 8px; align-items: center; }
.ad-remove { background: none; border: 0; color: var(--danger-fg); font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap; }
</style>
