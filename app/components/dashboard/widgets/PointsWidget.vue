<template>
  <!-- Generic map: any binding with shape 'points'. -->
  <VizPoints
    v-if="hasFrame && frame!.rows.length" :frame="frame!" :size="sizeClass" :height="mapHeight" :title="title"
    :selectable="enabled" :is-picked="isPicked" :is-dimmed="isDimmed" @pick="pick"
  />
  <WidgetState v-else :state="hasFrame ? 'empty' : state" :source="sourceLabel" :detail="error" :empty-text="emptyText" @retry="reload" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetInstance } from '~/types/dashboard'
import { useBoundFrame } from '~/composables/useBoundFrame'
import { useWidgetSize } from '~/composables/useWidgetSize'
import VizPoints from '~/components/dashboard/viz/VizPoints.vue'
import WidgetState from '~/components/dashboard/WidgetState.vue'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { frame, hasFrame, state, error, sourceLabel, reload, enabled, pick, isPicked, isDimmed } =
  useBoundFrame(() => props.instance, () => props.config)
const { sizeClass, height } = useWidgetSize()
// Leave room for the legend row under the map.
const mapHeight = computed(() => Math.max(160, (height.value || 300) - 28))
const title = computed(() => props.instance.title || String(props.config.presetTitle ?? 'Map'))
const emptyText = computed(() => (frame.value?.meta.unplaced ? `None of the ${frame.value.meta.unplaced} records has a location.` : 'Nothing to place on the map yet.'))
</script>
