<template>
  <!-- Generic time series: any binding with shape 'series' (docs/Widgets.md §5.3). -->
  <VizSeries
    v-if="hasFrame" :frame="frame!" :size="sizeClass" :mode="mode" :title="title"
    :selectable="enabled" :is-picked="isPicked" :is-dimmed="isDimmed" @pick="pick"
  />
  <WidgetState v-else :state="state" :source="sourceLabel" :detail="error" empty-text="No readings for this period." @retry="reload" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetInstance } from '~/types/dashboard'
import { useBoundFrame } from '~/composables/useBoundFrame'
import { useWidgetSize } from '~/composables/useWidgetSize'
import VizSeries from '~/components/dashboard/viz/VizSeries.vue'
import WidgetState from '~/components/dashboard/WidgetState.vue'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { frame, hasFrame, state, error, sourceLabel, reload, enabled, pick, isPicked, isDimmed } =
  useBoundFrame(() => props.instance, () => props.config)
const { sizeClass } = useWidgetSize()
const mode = computed(() => (['line', 'area', 'bars'].includes(String(props.config.mode)) ? props.config.mode : 'line') as 'line' | 'area' | 'bars')
const title = computed(() => props.instance.title || String(props.config.presetTitle ?? 'Series'))
</script>
