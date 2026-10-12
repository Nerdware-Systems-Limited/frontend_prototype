<template>
  <!-- Generic heatmap: any binding with shape 'matrix'. -->
  <VizHeatmap v-if="hasFrame" :frame="frame!" :size="sizeClass" :title="title" :additive="additive" />
  <WidgetState v-else :state="state" :source="sourceLabel" :detail="error" empty-text="Nothing recorded to map yet." @retry="reload" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetInstance } from '~/types/dashboard'
import { useBoundFrame } from '~/composables/useBoundFrame'
import { useWidgetSize } from '~/composables/useWidgetSize'
import VizHeatmap from '~/components/dashboard/viz/VizHeatmap.vue'
import WidgetState from '~/components/dashboard/WidgetState.vue'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { binding, frame, hasFrame, state, error, sourceLabel, reload } = useBoundFrame(() => props.instance, () => props.config)
const { sizeClass } = useWidgetSize()
const title = computed(() => props.instance.title || String(props.config.presetTitle ?? 'Heatmap'))
// Totals only add up for counts and sums.
const additive = computed(() => ['count', 'sum'].includes(binding.value?.aggregate?.fn ?? ''))
</script>
