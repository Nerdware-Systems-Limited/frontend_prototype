<template>
  <!-- Label + unit for one measure. Units drive formatting everywhere (utils/units.ts). -->
  <div class="mr" :class="{ 'mr--compact': compact }">
    <input
      type="text" class="mr-input" :value="measure.label" :aria-label="`Label for ${measure.key}`" placeholder="Label"
      @input="emit('change', { ...measure, label: val($event) })"
    >
    <select class="mr-input mr-unit" :value="measure.unit ?? 'count'" :aria-label="`Unit for ${measure.label || measure.key}`" @change="emit('change', { ...measure, unit: val($event) as UnitKey })">
      <option v-for="u in UNIT_CHOICES" :key="u.value" :value="u.value">{{ u.label }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import type { MeasureSpec } from '~/types/frame'
import type { UnitKey } from '~/utils/units'

defineProps<{ measure: MeasureSpec; compact?: boolean }>()
const emit = defineEmits<{ change: [MeasureSpec] }>()
const val = (e: Event) => (e.target as HTMLInputElement).value

const UNIT_CHOICES: { value: UnitKey; label: string }[] = [
  { value: 'count', label: 'Count' }, { value: 'pct', label: '%' }, { value: 'kes', label: 'KES' },
  { value: 'km', label: 'km' }, { value: 'kmh', label: 'km/h' }, { value: 'tonnes', label: 'Tonnes' },
  { value: 'kg', label: 'kg' }, { value: 'teu', label: 'TEU' }, { value: 'min', label: 'Minutes' },
  { value: 'days', label: 'Days' }, { value: 'score', label: 'Score' },
]
</script>

<style scoped>
.mr { display: grid; grid-template-columns: 1fr 92px; gap: 6px; }
.mr--compact { padding-left: 20px; }
.mr-input { height: 28px; padding: 0 8px; font-size: 12px; }
.mr-unit { padding-right: 4px; }
</style>
