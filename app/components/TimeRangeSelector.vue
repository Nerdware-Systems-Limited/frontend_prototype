<template>
  <!--
    TimeRangeSelector - the one compact control for "how far back".

    Replaces the separate 24-hour / 7-day / 30-day toggles, panels and sections
    with a single pill that opens into the choices and folds back after you
    pick. It edits a `useTimeRange(...)` object, so everything on the page (and
    on the module's other pages) that reads that object follows the choice.

    Closed:  [ clock  Last 7 days  v ]
    Open:    [ 24 Hours | 7 Days | 30 Days | Year ]  [ < 2025 > ]  [ x ]

    The year choice only appears when the data behind the page can really be
    asked for a past year (`range.years`), so it never promises history the
    endpoint cannot return. Stepping the year never collapses the control.
  -->
  <div class="trs" :class="{ 'trs--open': open }">
    <button
      v-if="!open"
      type="button" class="trs-pill" :aria-expanded="false" :aria-controls="panelId"
      :aria-label="`Time range: ${summary}. Change`"
      @click="open = true"
    >
      <Clock :size="13" aria-hidden="true" />
      <span class="trs-summary">{{ summary }}</span>
      <ChevronDown :size="13" aria-hidden="true" />
    </button>

    <div v-else :id="panelId" class="trs-panel" role="group" aria-label="Time range">
      <div class="segmented">
        <button
          v-for="p in PRESETS" :key="p" type="button"
          :class="{ active: range.mode.value === p }" :aria-pressed="range.mode.value === p"
          @click="pick(p)"
        >{{ PRESET_LABEL[p] }}</button>
        <button
          v-if="range.years" type="button"
          :class="{ active: range.isYear.value }" :aria-pressed="range.isYear.value"
          @click="pick('year')"
        >Year</button>
      </div>

      <div v-if="range.years && range.isYear.value" class="trs-years" role="group" aria-label="Year">
        <button type="button" class="trs-step" :disabled="range.year.value <= EARLIEST_YEAR" aria-label="Previous year" @click="step(-1)">
          <ChevronLeft :size="14" aria-hidden="true" />
        </button>
        <span class="trs-year" aria-live="polite">{{ range.year.value }}</span>
        <button type="button" class="trs-step" :disabled="range.year.value >= thisYear" aria-label="Next year" @click="step(1)">
          <ChevronRight :size="14" aria-hidden="true" />
        </button>
      </div>

      <button type="button" class="trs-close" aria-label="Collapse time range" @click="open = false">
        <ChevronUp :size="14" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock } from 'lucide-vue-next'
import { EARLIEST_YEAR, PRESET_LABEL, currentYear, type RangeMode, type RangePreset } from '~/utils/timeRange'
import type { TimeRange } from '~/composables/useTimeRange'

const props = defineProps<{
  range: TimeRange
  /** Start expanded instead of as a single pill. */
  defaultOpen?: boolean
}>()
const emit = defineEmits<{ change: [] }>()

const PRESETS: RangePreset[] = ['24h', '7d', '30d']
const open = ref(!!props.defaultOpen)
const panelId = `trs-${Math.random().toString(36).slice(2, 8)}`
const thisYear = currentYear()

const summary = computed(() => props.range.isYear.value ? `Year ${props.range.year.value}` : PRESET_LABEL[props.range.mode.value as RangePreset])

function pick(mode: RangeMode) {
  if (mode === props.range.mode.value) { if (mode !== 'year') open.value = false; return }
  props.range.setMode(mode)
  emit('change')
  // A preset is a one-step choice, so fold away. The year view stays open for stepping.
  if (mode !== 'year') open.value = false
}
function step(delta: number) {
  props.range.stepYear(delta)
  emit('change')
}

function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && open.value) open.value = false }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.trs { display: inline-flex; align-items: center; }
.trs-pill {
  display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 6px 10px;
  border: 1px solid var(--border-interactive); border-radius: var(--r-sm); background: var(--surface-2); color: var(--fg-1);
  font: 600 12px/1 var(--font-ui); cursor: pointer; white-space: nowrap;
}
.trs-pill:hover { background: var(--surface-quiet); }
.trs-pill:focus-visible, .trs-step:focus-visible, .trs-close:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.trs-panel { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.trs-years { display: inline-flex; align-items: center; border: 1px solid var(--border-interactive); border-radius: var(--r-sm); background: var(--surface-2); }
.trs-step, .trs-close {
  display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0;
  border: 0; background: transparent; color: var(--fg-2); cursor: pointer;
}
.trs-close { border: 1px solid var(--border-subtle); border-radius: var(--r-sm); }
.trs-step:hover:not(:disabled), .trs-close:hover { background: var(--surface-quiet); color: var(--fg-1); }
.trs-step:disabled { opacity: .35; cursor: not-allowed; }
.trs-year { min-width: 48px; text-align: center; font: 700 12px/1 var(--font-mono); font-variant-numeric: tabular-nums; color: var(--fg-1); }
@media (max-width: 600px) { .trs-panel { width: 100%; } }
</style>
