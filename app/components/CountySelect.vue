<template>
  <!--
    CountySelect - the compact "which county" control, the sibling of TimeRangeSelector.
    Edits a `useCountyScope(...)` object. Renders nothing when the county list is
    unavailable (reference layer not loaded), so it never offers a filter that
    can't be honoured.
  -->
  <label v-if="names.length" class="csel" :class="{ 'csel--active': !!scope.county.value }">
    <MapPin :size="13" aria-hidden="true" />
    <select :value="scope.county.value ?? ''" aria-label="County" @change="onChange">
      <option value="">All counties</option>
      <option v-for="n in names" :key="n" :value="n">{{ n }}</option>
    </select>
  </label>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { MapPin } from 'lucide-vue-next'
import type { CountyScope } from '~/composables/useCountyScope'
import { useCounties } from '~/composables/useCounties'

const props = defineProps<{ scope: CountyScope }>()
const emit = defineEmits<{ change: [] }>()

const { names, load } = useCounties()
onMounted(load)

function onChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  props.scope.set(v || null)
  emit('change')
}
</script>

<style scoped>
.csel {
  display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 8px 0 10px;
  border: 1px solid var(--border-interactive); border-radius: var(--r-sm);
  background: var(--surface-2); color: var(--fg-1);
}
.csel--active { border-color: var(--primary); background: var(--primary-wash); color: var(--primary); }
.csel select {
  border: 0; background: transparent; color: inherit; cursor: pointer; max-width: 150px;
  font: 600 12px/1 var(--font-ui); padding: 6px 2px;
}
.csel select:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 2px; }
.csel:hover { background: var(--surface-quiet); }
</style>
