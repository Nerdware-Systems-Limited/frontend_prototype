<template>
  <div class="kpi-row" :style="{ '--kpi-cols': visibleKeys.length || 1 }">
    <KpiWidget
      v-for="k in visibleKeys" :key="k"
      :instance="instance"
      :config="{ metricKey: k, prominent: config.prominent }"
    />
    <p v-if="!visibleKeys.length" class="kpi-row-empty">No metrics selected - add some in the inspector.</p>
  </div>
</template>

<script setup lang="ts">
import type { WidgetInstance } from '~/types/dashboard'
import { METRICS_BY_KEY, type Domain } from '~/utils/metricRegistry'
import { DOMAIN_PERMISSIONS } from '~/utils/dataSources'
import KpiWidget from './KpiWidget.vue'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { can } = useViewerContext()

// The server already strips metrics the viewer can't see; this is the
// belt-and-braces client check (e.g. in the editor's "Preview as").
const visibleKeys = computed(() =>
  ((props.config.metricKeys as string[] | undefined) ?? []).filter((k) => {
    const m = METRICS_BY_KEY[k]
    return m && can([DOMAIN_PERMISSIONS[m.domain as Domain]])
  }),
)
</script>

<style scoped>
.kpi-row {
  display: grid; gap: 8px; height: 100%;
  grid-template-columns: repeat(var(--kpi-cols), minmax(0, 1fr));
}
@container widget (max-width: 900px) { .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container widget (max-width: 480px) { .kpi-row { grid-template-columns: 1fr; } }
.kpi-row-empty { font-size: 12px; color: var(--fg-3); margin: auto; }
</style>
