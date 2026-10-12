<template>
  <!--
    Row filter editor for GIS uploads: keep only the rows of a file whose
    attribute matches (or doesn't match) the listed values. Backend:
    row_filter {include, exclude} on upload / reload (layer_loader.py).
  -->
  <div class="rfe">
    <datalist :id="listId"><option v-for="c in columns" :key="c" :value="c" /></datalist>
    <div v-for="(r, i) in modelValue" :key="i" class="rfe-row">
      <select :value="r.mode" aria-label="Keep or drop" @change="patch(i, { mode: ($event.target as HTMLSelectElement).value as FilterRow['mode'] })">
        <option value="include">keep rows where</option>
        <option value="exclude">drop rows where</option>
      </select>
      <input :value="r.column" class="input" type="text" :list="listId" placeholder="column" aria-label="Column"
        @input="patch(i, { column: ($event.target as HTMLInputElement).value })" />
      <span class="rfe-is" aria-hidden="true">{{ r.mode === 'include' ? 'is' : 'is' }}</span>
      <input :value="r.values" class="input" type="text" placeholder="KeRRA, KURA (comma-separated)" aria-label="Values"
        @input="patch(i, { values: ($event.target as HTMLInputElement).value })" />
      <button type="button" class="linkish" @click="remove(i)">remove</button>
    </div>
    <button type="button" class="btn btn-sm" @click="add">+ Add condition</button>
  </div>
</template>

<script setup lang="ts">
import type { FilterRow } from '~/utils/gisFile'

const props = defineProps<{ modelValue: FilterRow[]; columns: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [FilterRow[]] }>()
const listId = `rfe-${useId()}`

function patch(i: number, change: Partial<FilterRow>) {
  emit('update:modelValue', props.modelValue.map((r, j) => (j === i ? { ...r, ...change } : r)))
}
function remove(i: number) { emit('update:modelValue', props.modelValue.filter((_, j) => j !== i)) }
function add() { emit('update:modelValue', [...props.modelValue, { mode: 'include', column: props.columns.includes('road_agency') ? 'road_agency' : '', values: '' }]) }
</script>

<style scoped>
.rfe { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.rfe-row { display: grid; grid-template-columns: auto minmax(110px, 1fr) auto minmax(140px, 1.4fr) auto; gap: 6px; align-items: center; width: 100%; }
.rfe-is { color: var(--fg-3); font-size: 12px; }
@media (max-width: 640px) { .rfe-row { grid-template-columns: 1fr 1fr; } }
</style>
