<template>
  <!-- Generic table: any binding with shape 'rows'. -->
  <div v-if="hasFrame" class="tw">
    <VizTable
      class="tw-table" :frame="frame!" :size="sizeClass" :max-rows="maxRows"
      :key-field="keyField" :selectable="enabled" :is-picked="isPicked" :is-dimmed="isDimmed" @pick="pick"
    />
    <p v-if="frame!.meta.partial" class="tw-note">
      First {{ formatValue(frame!.meta.partial.count, 'count') }} of {{ formatValue(frame!.meta.partial.total, 'count') }} records
    </p>
  </div>
  <WidgetState v-else :state="state" :source="sourceLabel" :detail="error" empty-text="No rows to show." @retry="reload" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetInstance } from '~/types/dashboard'
import { useBoundFrame } from '~/composables/useBoundFrame'
import { useWidgetSize } from '~/composables/useWidgetSize'
import { formatValue } from '~/utils/units'
import VizTable from '~/components/dashboard/viz/VizTable.vue'
import WidgetState from '~/components/dashboard/WidgetState.vue'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { binding, frame, hasFrame, state, error, sourceLabel, reload, enabled, pick, isPicked, isDimmed } =
  useBoundFrame(() => props.instance, () => props.config)
const { sizeClass, height } = useWidgetSize()
// Fit the rows the cell can hold (~28px each below a ~30px header).
const maxRows = computed(() => Math.max(3, Math.floor(((height.value || 240) - 56) / 28)))
const keyField = computed(() => binding.value?.columns?.[0]?.key)
</script>

<style scoped>
.tw { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 4px; }
.tw-table { flex: 1; min-height: 0; }
.tw-note { margin: 0; font-size: 10.5px; color: var(--warning-fg); font-variant-numeric: tabular-nums; }
</style>
