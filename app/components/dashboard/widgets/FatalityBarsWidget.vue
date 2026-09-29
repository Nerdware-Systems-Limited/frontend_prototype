<template>
  <div class="bars-widget">
    <EmptyState v-if="loading && !days.length" loading compact />
    <EmptyState v-else-if="error" compact :message="`NTSA IRSMS feed unavailable - ${error}`" />
    <EmptyState
      v-else-if="days.length < 5" compact
      :message="days.length ? `Only ${days.length} day-bucket(s) of trend data - too sparse for a daily chart.` : 'No fatality trend data for this period.'"
    />
    <template v-else>
      <div class="bars" role="list" aria-label="Daily fatalities, last 30 days">
        <button
          v-for="d in days" :key="d.day" type="button" role="listitem"
          class="bar" :class="[band(d.fatalities), { dim: isDimmed(d.day), picked: pickedDay === d.day }]"
          :style="{ height: `${Math.max(6, (d.fatalities / max) * 100)}%` }"
          :title="`${d.day}: ${d.fatalities} fatalities`"
          :aria-label="`${d.day}: ${d.fatalities} fatalities. Click to filter linked widgets to this day.`"
          @click="pick(d.day)"
        />
      </div>
      <div class="legend">
        <span><i class="dot spark-red" /> &gt;5 fatal</span>
        <span><i class="dot spark-amber" /> 3–5</span>
        <span><i class="dot spark-green" /> 0–2</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { WidgetInstance } from '~/types/dashboard'
import { useDomainData } from '~/composables/useDomainData'
import { useWidgetFilters } from '~/composables/useDashboardFilters'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { context, highlight, emit } = useWidgetFilters(() => props.instance.id)
const { data, error, loading } = useDomainData(() => 'safety' as const, () => context.value)

const days = computed(() => (data.value?.fatality_trend_30d ?? []).slice(-30))
const max = computed(() => Math.max(1, ...days.value.map(d => d.fatalities)))
const band = (n: number) => (n > 5 ? 'spark-red' : n > 2 ? 'spark-amber' : 'spark-green')

const pickedDay = ref<string | null>(null)
function pick(day: string) {
  pickedDay.value = pickedDay.value === day ? null : day
  emit('date_range', pickedDay.value ? { from: day, to: day } : null)
}
function isDimmed(day: string) {
  const h = highlight.value
  if (!h || h.field !== 'date_range' || !h.value || typeof h.value !== 'object' || Array.isArray(h.value)) return false
  return day < h.value.from || day > h.value.to
}
</script>

<style scoped>
.bars-widget { display: flex; flex-direction: column; height: 100%; }
.bars { flex: 1; min-height: 60px; display: flex; align-items: flex-end; gap: 2px; }
.bar { flex: 1; border: 0; padding: 0; border-radius: 1px 1px 0 0; cursor: pointer; transition: opacity var(--dur-fast) var(--ease-standard); }
.bar:hover { opacity: .75; }
.bar:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.bar.dim { opacity: .25; }
.bar.picked { box-shadow: 0 0 0 2px var(--fg-1); }
.spark-red { background: var(--destructive); }
.spark-amber { background: var(--warning); }
.spark-green { background: var(--success); }
.legend { display: flex; gap: 12px; font-size: 10px; color: var(--fg-3); padding-top: 6px; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 3px; }
</style>
