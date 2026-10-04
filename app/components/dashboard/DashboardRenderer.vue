<template>
  <!--
    DashboardRenderer - draws a saved DashboardDefinition for a viewer.
    Owns: the filter/action engine, the refresh clock, the 12-column grid.
    Knows nothing about WHICH dashboard - pages/dashboard.vue resolves that.
  -->
  <div class="dr" :class="`dr--${definition.theme.density}`">
    <header v-if="!hideHeader" class="dr-head">
      <div class="dr-head-main">
        <h1>{{ definition.title }}</h1>
        <p v-if="definition.subtitle" class="dr-dek">{{ definition.subtitle }}</p>
      </div>
      <div class="dr-head-side">
        <span class="dr-refreshed" :title="`Auto-refresh every ${definition.refreshInterval}s`">
          Updated {{ lastRefreshed }} UTC
        </span>
        <button type="button" class="btn btn-sm" :disabled="refreshing" @click="refresh">
          {{ refreshing ? 'Refreshing…' : 'Refresh' }}
        </button>
        <slot name="header-actions" />
      </div>
    </header>

    <DashboardFilterBar :filters="definition.filters" :engine="engine" />

    <div
      class="dr-grid"
      :style="{ '--row-h': `${definition.theme.rowHeight}px`, '--gap': `${definition.theme.gap}px`, '--cols': GRID_COLUMNS }"
    >
      <div
        v-for="w in visibleWidgets" :key="w.id" class="dr-cell" :class="{ 'dr-cell--grow': w.type === 'kpi-row' }"
        :style="{
          gridColumn: `${w.x + 1} / span ${Math.min(w.w, GRID_COLUMNS - w.x)}`,
          gridRow: `${w.y + 1} / span ${w.h}`,
          '--h': w.h,
        }"
      >
        <WidgetFrame :instance="w" />
      </div>
      <EmptyState
        v-if="!visibleWidgets.length" class="dr-empty"
        :message="definition.widgets.length ? 'None of this dashboard\'s widgets are available to your role.' : 'This dashboard has no widgets yet.'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { GRID_COLUMNS, type DashboardDefinition, type ViewerContext } from '~/types/dashboard'
import { provideDashboardFilters } from '~/composables/useDashboardFilters'
import { invalidateWidgetData } from '~/composables/useWidgetData'
import { widgetPermissions } from '~/utils/widgetRegistry'
import WidgetFrame from '~/components/dashboard/WidgetFrame.vue'
import DashboardFilterBar from '~/components/dashboard/DashboardFilterBar.vue'

const props = withDefaults(defineProps<{
  definition: DashboardDefinition
  syncUrl?: boolean
  hideHeader?: boolean
}>(), { syncUrl: true, hideHeader: false })

const { viewer, can } = useViewerContext()
const defRef = computed(() => props.definition)
const engine = provideDashboardFilters(defRef, viewer as Ref<ViewerContext | null>, { syncUrl: props.syncUrl })

// Client-side gate mirrors the server's strip, so "Preview as" in the editor
// and stale caches behave the same as a fresh server response.
const visibleWidgets = computed(() =>
  props.definition.widgets
    .filter(w => !w.hidden && can(widgetPermissions(w.type, w.config)))
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x))

// ── Refresh clock: one tick for every widget, one cache flush ───────────
const refreshTick = ref(0)
provide('dashboard:refreshTick', refreshTick)
const lastRefreshed = ref(new Date().toISOString().slice(11, 16))
const refreshing = ref(false)
function refresh() {
  refreshing.value = true
  invalidateWidgetData()
  refreshTick.value++
  lastRefreshed.value = new Date().toISOString().slice(11, 16)
  setTimeout(() => { refreshing.value = false }, 600)
}
let timer: ReturnType<typeof setInterval> | null = null
watch(() => props.definition.refreshInterval, (s) => {
  if (timer) clearInterval(timer)
  timer = s > 0 ? setInterval(() => { if (document.visibilityState === 'visible') refresh() }, s * 1000) : null
}, { immediate: true })
onUnmounted(() => { if (timer) clearInterval(timer) })

useNavSubtitle(props.definition.title)
</script>

<style scoped>
.dr-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--border-subtle);
}
.dr-head-main h1 { font-size: 19px; font-weight: 700; letter-spacing: .055em; text-transform: uppercase; color: var(--fg-1); margin: 0; }
.dr-dek { margin: 4px 0 0; font-size: 12.5px; color: var(--fg-2); }
.dr-head-side { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dr-refreshed { font-family: var(--font-mono); font-size: 10.5px; color: var(--fg-3); }

.dr-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  grid-auto-rows: var(--row-h);
  gap: var(--gap);
}
.dr--compact .dr-grid { --gap: 6px; }
.dr-cell { min-width: 0; min-height: 0; }
.dr-empty { grid-column: 1 / -1; grid-row: span 3; }

/* Below tablet width the 12-col layout stops being readable: stack widgets
   in reading order (sorted y, then x) at their authored height. */
@media (max-width: 900px) {
  .dr-grid { display: flex; flex-direction: column; }
  .dr-cell { height: calc(var(--h) * var(--row-h) + (var(--h) - 1) * var(--gap)); }
  /* A KPI ribbon re-flows to 2 / 1 columns, so let it take the height it needs. */
  .dr-cell--grow { height: auto; }
}
</style>
