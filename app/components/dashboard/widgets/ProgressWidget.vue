<template>
  <!-- Generic progress: a 'scalar' binding with a target. Status from the shared threshold. -->
  <VizProgress v-if="hasFrame" :frame="frame!" :size="sizeClass" :title="title" :status="status" />
  <WidgetState v-else :state="state" :source="sourceLabel" :detail="error" empty-text="Not reported by the feed yet." @retry="reload" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetInstance } from '~/types/dashboard'
import { useBoundFrame } from '~/composables/useBoundFrame'
import { useWidgetSize } from '~/composables/useWidgetSize'
import { statusOf } from '~/utils/thresholds'
import VizProgress from '~/components/dashboard/viz/VizProgress.vue'
import WidgetState from '~/components/dashboard/WidgetState.vue'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { binding, frame, hasFrame, state, error, sourceLabel, reload } = useBoundFrame(() => props.instance, () => props.config)
const { sizeClass } = useWidgetSize()
// The frame's title bar names the widget; the bar names what it measures.
const title = computed(() => binding.value?.measures[0]?.label ?? 'Progress')
const status = computed(() => {
  const b = binding.value
  const m = b?.measures[0]
  const v = m ? frame.value?.rows[0]?.[m.key] : undefined
  return b?.threshold && typeof v === 'number' ? statusOf(v, b.threshold) : 'neutral'
})
</script>
