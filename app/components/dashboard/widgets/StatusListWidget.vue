<template>
  <!-- Generic status list: any binding with shape 'status'. -->
  <VizStatusList
    v-if="hasFrame" :frame="frame!" :size="sizeClass" :title="title" :link="binding?.link ?? ''"
    :selectable="enabled" :is-picked="isPicked" :is-dimmed="isDimmed" @pick="pick"
  />
  <WidgetState v-else :state="state" :source="sourceLabel" :detail="error" empty-text="Nothing to report." @retry="reload" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetInstance } from '~/types/dashboard'
import { useBoundFrame } from '~/composables/useBoundFrame'
import { useWidgetSize } from '~/composables/useWidgetSize'
import VizStatusList from '~/components/dashboard/viz/VizStatusList.vue'
import WidgetState from '~/components/dashboard/WidgetState.vue'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { binding, frame, hasFrame, state, error, sourceLabel, reload, enabled, pick, isPicked, isDimmed } =
  useBoundFrame(() => props.instance, () => props.config)
const { sizeClass } = useWidgetSize()
const title = computed(() => props.instance.title || String(props.config.presetTitle ?? 'Status'))
</script>
