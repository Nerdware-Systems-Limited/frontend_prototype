<template>
  <!-- Daily fatalities (and incidents, when the API returns that series) on
       one shared-crosshair chart. Only real series are drawn - if the
       summary has no incident trend, this is a one-line chart, honestly. -->
  <div class="trend-widget">
    <EmptyState v-if="loading && !series.length" loading compact />
    <EmptyState v-else-if="error" compact :message="`NTSA IRSMS feed unavailable - ${error}`" />
    <MultiLineChart v-else :series="series" :height="chartHeight" empty-text="No trend data for this period." />
  </div>
</template>

<script setup lang="ts">
import type { WidgetInstance } from '~/types/dashboard'
import type { SafetySummary } from '~/composables/api/useSafety'
import { useDomainData } from '~/composables/useDomainData'
import { useWidgetFilters } from '~/composables/useDashboardFilters'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown>; bodyHeight?: number }>()
const { context } = useWidgetFilters(() => props.instance.id)
const { data, error, loading } = useDomainData(() => 'safety' as const, () => context.value)

const chartHeight = computed(() => Math.max(120, (props.bodyHeight ?? 200) - 28))

const series = computed(() => {
  // incident_trend_30d isn't returned by the UAPTS /safety/summary/ yet; the chart shows it when it is.
  const s = data.value as (SafetySummary & { incident_trend_30d?: { day: string; incidents: number }[] }) | null
  if (!s) return []
  const out: { name: string; color: string; points: { label: string; value: number }[] }[] = []
  const fat = (s.fatality_trend_30d ?? []) as { day: string; fatalities: number }[]
  if (fat.length) out.push({ name: 'Fatalities', color: 'var(--destructive)', points: fat.map(d => ({ label: d.day.slice(5), value: d.fatalities })) })
  const inc = (s.incident_trend_30d ?? []) as { day: string; incidents: number }[]
  if (inc.length) out.push({ name: 'Incidents', color: 'var(--info)', points: inc.map(d => ({ label: d.day.slice(5), value: d.incidents })) })
  return out
})
</script>

<style scoped>
.trend-widget { height: 100%; }
</style>
