<template>
  <div class="bars-widget">
    <WidgetState v-if="!hasData" :state="state" source="NTSA IRSMS" :detail="error" @retry="reload" />
    <EmptyState
      v-else-if="days.length < 5" compact
      :message="days.length ? `Only ${days.length} day-bucket(s) of trend data - too sparse for a daily chart.` : 'No fatality trend data for this period.'"
    />
    <template v-else>
      <!-- One tab stop for the whole chart; arrow keys move between days
           (roving tabindex), Enter/Space picks the focused day. -->
      <div
        ref="barsEl" class="bars" role="group"
        aria-label="Daily fatalities, last 30 days. Use arrow keys to move between days, Enter to filter linked widgets to a day."
        @keydown="onKey"
      >
        <button
          v-for="(d, i) in days" :key="d.day" type="button"
          class="bar" :class="[BANDS[band(d.fatalities)].cls, { dim: isDimmed(d.day), picked: pickedDay === d.day }]"
          :style="{ height: `${Math.max(6, (d.fatalities / max) * 100)}%` }"
          :tabindex="i === activeIndex ? 0 : -1"
          :aria-pressed="pickedDay === d.day"
          :title="`${d.day}: ${d.fatalities} fatalities (${BANDS[band(d.fatalities)].label})`"
          :aria-label="`${d.day}: ${d.fatalities} fatalities, ${BANDS[band(d.fatalities)].label}`"
          @click="pick(d.day)" @focus="activeIndex = i"
        />
      </div>
      <div class="legend">
        <span v-for="b in LEGEND" :key="b" class="legend-item"><i class="dot" :class="BANDS[b].cls" aria-hidden="true" />{{ BANDS[b].label }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { WidgetInstance } from '~/types/dashboard'
import { useDomainData } from '~/composables/useDomainData'
import { useWidgetFilters } from '~/composables/useDashboardFilters'
import WidgetState from '~/components/dashboard/WidgetState.vue'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { context, highlight, emit } = useWidgetFilters(() => props.instance.id)
const { data, error, state, reload } = useDomainData(() => 'safety' as const, () => context.value)
const hasData = computed(() => state.value === 'ready' || state.value === 'refreshing')

const days = computed(() => (data.value?.fatality_trend_30d ?? []).slice(-30))
const max = computed(() => Math.max(1, ...days.value.map(d => d.fatalities)))

type Band = 'high' | 'elevated' | 'low'
const BANDS: Record<Band, { cls: string; label: string }> = {
  high: { cls: 'spark-red', label: 'high (more than 5)' },
  elevated: { cls: 'spark-amber', label: 'elevated (3 to 5)' },
  low: { cls: 'spark-green', label: 'low (0 to 2)' },
}
const LEGEND: Band[] = ['high', 'elevated', 'low']
const band = (n: number): Band => (n > 5 ? 'high' : n > 2 ? 'elevated' : 'low')

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

// Roving tabindex: the most recent day is the entry point.
const barsEl = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
watch(() => days.value.length, (n) => { activeIndex.value = Math.max(0, n - 1) }, { immediate: true })

function onKey(e: KeyboardEvent) {
  const last = days.value.length - 1
  const next = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? activeIndex.value + 1
    : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? activeIndex.value - 1
      : e.key === 'Home' ? 0
        : e.key === 'End' ? last
          : null
  if (next == null) return
  e.preventDefault()
  activeIndex.value = Math.min(last, Math.max(0, next))
  ;(barsEl.value?.children[activeIndex.value] as HTMLElement | undefined)?.focus()
}
</script>

<style scoped>
.bars-widget { display: flex; flex-direction: column; height: 100%; }
.bars { flex: 1; min-height: 60px; display: flex; align-items: flex-end; gap: 2px; }
.bar { flex: 1; border: 0; padding: 0; border-radius: 1px 1px 0 0; cursor: pointer; transition: opacity var(--dur-fast) var(--ease-standard); }
.bar:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.bar.dim { opacity: .25; }
/* Selection is a state, not a lift: a hairline outline, no shadow (Flat-Body rule). */
.bar.picked { outline: 1px solid var(--fg-1); outline-offset: 1px; }
@media (hover: hover) and (pointer: fine) {
  .bar:hover { opacity: .75; }
}
.spark-red { background: var(--destructive); }
.spark-amber { background: var(--warning); }
.spark-green { background: var(--success); }
.legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 10px; color: var(--fg-3); padding-top: 6px; }
.legend-item { display: inline-flex; align-items: center; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: var(--r-pill); margin-right: 4px; }
</style>
