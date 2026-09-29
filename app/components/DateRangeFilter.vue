<template>
  <!--
    Segmented date-type control (e.g. Uploaded / Committed / Period) plus
    a from/to range. Nothing like this existed - every other page in the
    app uses two bare <input type="date"> fields with no way to say which
    date column they mean.
  -->
  <div class="date-range-filter">
    <div class="drf-segmented" role="tablist">
      <button
        v-for="f in fields" :key="f.key" type="button" role="tab"
        class="drf-segment" :class="{ active: field === f.key }"
        :aria-selected="field === f.key"
        @click="emit('update:field', f.key)"
      >{{ f.label }}</button>
    </div>
    <input
      type="date" class="select-sm drf-date" :value="from"
      @change="emit('update:from', ($event.target as HTMLInputElement).value)"
    />
    <span class="drf-arrow" aria-hidden="true">→</span>
    <input
      type="date" class="select-sm drf-date" :value="to"
      @change="emit('update:to', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  fields: { key: string; label: string }[]
  field: string
  from: string
  to: string
}>()
const emit = defineEmits<{
  'update:field': [string]
  'update:from': [string]
  'update:to': [string]
}>()
</script>

<style scoped>
.date-range-filter { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
.drf-segmented { display: flex; border: 1px solid var(--border-subtle); border-radius: var(--r-sm); overflow: hidden; flex-shrink: 0; }
.drf-segment {
  background: var(--surface-2); border: none; padding: 5px 8px; font-size: 11.5px; color: var(--fg-2);
  cursor: pointer; border-right: 1px solid var(--border-subtle); white-space: nowrap;
}
.drf-segment:last-child { border-right: none; }
.drf-segment:hover:not(.active) { background: var(--surface-quiet); }
.drf-segment.active { background: var(--primary); color: #fff; }
.drf-arrow { font-size: 11px; color: var(--fg-3); flex-shrink: 0; }
.drf-date { width: 128px; flex-shrink: 0; }
</style>
