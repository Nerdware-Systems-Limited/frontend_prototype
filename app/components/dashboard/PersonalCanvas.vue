<template>
  <!-- Viewer's own-layout editor: the admin canvas in "personal" mode, with
       the same live widgets and filter engine the renderer uses. -->
  <DashboardCanvas
    :widgets="widgets" :row-height="definition.theme.rowHeight" :gap="definition.theme.gap"
    :selected-id="selectedId" mode="personal"
    @update:widgets="emit('update:widgets', $event)" @select="selectedId = $event"
  />
</template>

<script setup lang="ts">
import type { DashboardDefinition, ViewerContext, WidgetInstance } from '~/types/dashboard'
import { provideDashboardFilters } from '~/composables/useDashboardFilters'
import DashboardCanvas from '~/components/dashboard/DashboardCanvas.vue'

const props = defineProps<{ widgets: WidgetInstance[]; definition: DashboardDefinition }>()
const emit = defineEmits<{ 'update:widgets': [WidgetInstance[]] }>()

const selectedId = ref<string | null>(null)
const { viewer } = useViewerContext()
provide('dashboard:refreshTick', ref(0))
provideDashboardFilters(computed(() => props.definition), viewer as Ref<ViewerContext | null>, { syncUrl: false })
</script>
