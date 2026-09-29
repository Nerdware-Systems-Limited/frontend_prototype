<template>
  <!-- Search + filter row for the Module Access tables; v-model is a ModuleFilter. -->
  <div class="filter-bar filter-bar--grid module-filters" role="search" aria-label="Filter modules and pages">
    <div class="search-field filter-span">
      <Search :size="14" class="search-icon" aria-hidden="true" />
      <input
        :value="modelValue.query" type="search" class="select-sm search-input"
        placeholder="Search modules or pages…" aria-label="Search modules or pages"
        @input="update({ query: ($event.target as HTMLInputElement).value })"
        @keydown.esc="update({ query: '' })"
      />
    </div>
    <label class="filter-group">
      <span class="filter-label">Access</span>
      <select
        :value="modelValue.access" class="select-sm"
        @change="update({ access: ($event.target as HTMLSelectElement).value as AccessFilterLevel })"
      >
        <option value="any">Any</option>
        <option value="full">Full access</option>
        <option value="read">Read access</option>
        <option value="none">Restricted</option>
      </select>
    </label>
    <label class="filter-group">
      <span class="filter-label">Filter</span>
      <select
        :value="modelValue.source" class="select-sm"
        @change="update({ source: ($event.target as HTMLSelectElement).value as SourceFilter })"
      >
        <option value="all">All</option>
        <option value="inherited">Inherited</option>
        <option value="custom">Custom</option>
      </select>
    </label>
    <button v-if="isFilterActive(modelValue)" type="button" class="btn btn-sm clear-btn" @click="emit('update:modelValue', { ...EMPTY_FILTER })">
      Clear
    </button>
  </div>
</template>

<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { EMPTY_FILTER, isFilterActive, type AccessFilterLevel, type ModuleFilter, type SourceFilter } from '~/utils/accessFilter'

const props = defineProps<{ modelValue: ModuleFilter }>()
const emit = defineEmits<{ 'update:modelValue': [ModuleFilter] }>()

function update(patch: Partial<ModuleFilter>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
</script>

<style scoped>
.module-filters { margin-bottom: 12px; }
.search-field { position: relative; display: flex; align-items: center; flex: 1 1 260px; min-width: 0; }
.search-icon { position: absolute; left: 9px; color: var(--fg-3); pointer-events: none; }
.search-input { width: 100%; padding-left: 29px; }
.search-input::placeholder { color: var(--fg-3); }
.clear-btn { margin-left: auto; }
@media (min-width: 769px) {
  .search-field { max-width: 360px; }
  /* One control height across the row (search inputs render taller than selects by default). */
  .search-input, .filter-group .select-sm { height: 30px; }
}
@media (max-width: 768px) {
  .filter-group { flex-direction: column; align-items: stretch; gap: 4px; }
  .clear-btn { grid-column: 1 / -1; margin-left: 0; min-height: 36px; }
}
</style>
