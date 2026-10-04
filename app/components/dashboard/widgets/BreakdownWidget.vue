<template>
  <!-- Generic breakdown: any binding with shape 'categorical'. -->
  <VizBreakdown
    v-if="hasFrame" :frame="frame!" :size="sizeClass" :title="title"
    :selectable="enabled" :is-picked="isPicked" :is-dimmed="isDimmed" @pick="pick"
  />
  <WidgetState v-else :state="state" :source="sourceLabel" :detail="error" empty-text="Nothing recorded to break down yet." @retry="reload" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetInstance } from '~/types/dashboard'
import { useBoundFrame } from '~/composables/useBoundFrame'
import { useWidgetSize } from '~/composables/useWidgetSize'
import VizBreakdown from '~/components/dashboard/viz/VizBreakdown.vue'
import WidgetState from '~/components/dashboard/WidgetState.vue'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { frame, hasFrame, state, error, sourceLabel, reload, enabled, pick, isPicked, isDimmed } =
  useBoundFrame(() => props.instance, () => props.config)
const { sizeClass } = useWidgetSize()
const title = computed(() => props.instance.title || String(props.config.presetTitle ?? 'Breakdown'))
</script>
