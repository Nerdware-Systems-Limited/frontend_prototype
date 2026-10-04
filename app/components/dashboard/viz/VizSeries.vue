<template>
  <!--
    VizSeries - one or more measures over time, on ONE axis.
      xs  latest value + sparkline (the headline, no plot chrome)
      s   the line/area/bars without axes, end value labelled
      m   + y ticks, sparse x ticks, crosshair tooltip
      l   + direct end labels (<= 4 series)
    Measures with a different unit from the first are left to the table
    view - never a second y-axis.
  -->
  <div v-if="size === 'xs'" class="vsr-head">
    <span class="vsr-head-val">{{ lastText }}</span>
    <span class="vsr-head-lbl">{{ chartMeasures[0]?.label }} · {{ lastTime }}</span>
    <Sparkline v-if="headSeries.length > 1" class="vsr-head-spark" :points="headSeries" />
  </div>

  <VizShell
    v-else :frame="frame" :size="size" :summary="summary"
    :key-field="dimKey" :selectable="selectable" :is-picked="isPicked" :is-dimmed="isDimmed"
    @pick="k => emit('pick', k)"
  >
    <template v-if="chartMeasures.length > 1" #legend>
      <span v-for="(m, i) in chartMeasures" :key="m.key" class="vsr-key">
        <i class="vsr-key-mark" :class="{ 'vsr-key-mark--bar': mode === 'bars' }" :style="{ background: seriesColor(i) }" aria-hidden="true" />{{ m.label }}
      </span>
    </template>

    <div
      ref="stageEl" class="vsr-stage" tabindex="0" role="group" aria-roledescription="chart"
      :aria-label="`${summary} Use left and right arrow keys to read values.`"
      @pointermove="onPointer" @pointerleave="hover = null"
      @keydown="onKey" @blur="hover = null"
    >
      <svg v-if="width > 0 && height > 0" :width="width" :height="height" class="vsr-svg" aria-hidden="true" focusable="false">
        <!-- grid + y ticks (m/l only): hairline, solid, recessive -->
        <g v-if="axes">
          <g v-for="t in yTicks" :key="t" :transform="`translate(0,${y(t)})`">
            <line :x1="pad.left" :x2="width - pad.right" class="vsr-grid" :class="{ 'vsr-grid--zero': t === 0 }" />
            <text :x="pad.left - 6" dy="0.32em" text-anchor="end" class="vsr-tick">{{ tickText(t) }}</text>
          </g>
          <text
            v-for="k in xTickKeys" :key="k" :x="xPos(k)" :y="height - 4"
            :text-anchor="k === xKeys[0] ? 'start' : k === xKeys[xKeys.length - 1] ? 'end' : 'middle'" class="vsr-tick"
          >{{ timeLabel(k) }}</text>
        </g>

        <!-- bars: <= 24px, 4px rounded data-end, square at the baseline -->
        <template v-if="mode === 'bars'">
          <path
            v-for="(k, i) in xKeys" :key="k" :d="barFor(k)"
            :fill="seriesColor(0)" class="vsr-bar"
            :class="{ 'is-dim': isDimmed(k) || (hover != null && hover !== i), 'is-picked': isPicked(k) }"
          />
        </template>
        <template v-else>
          <path
            v-for="(s, i) in paths" :key="s.key + '-a'" :d="mode === 'area' ? s.area : ''"
            :fill="seriesColor(i)" class="vsr-area"
          />
          <path v-for="(s, i) in paths" :key="s.key" :d="s.line" :stroke="seriesColor(i)" class="vsr-line" />
        </template>

        <!-- crosshair finds the X -->
        <g v-if="hover != null">
          <line :x1="xPos(xKeys[hover]!)" :x2="xPos(xKeys[hover]!)" :y1="pad.top" :y2="plotBottom" class="vsr-cross" />
          <template v-if="mode !== 'bars'">
            <circle
              v-for="(m, i) in chartMeasures" v-show="valueAt(hover, m.key) != null" :key="m.key"
              :cx="xPos(xKeys[hover]!)" :cy="y(valueAt(hover, m.key) ?? 0)" r="4"
              :fill="seriesColor(i)" class="vsr-dot"
            />
          </template>
        </g>

        <!-- selective direct labels: the end of each series -->
        <template v-if="endLabels">
          <text
            v-for="e in endLabels" :key="e.key" :x="e.x + 6" :y="e.y" dy="0.32em" class="vsr-end"
          >{{ e.text }}</text>
        </template>
      </svg>

      <p class="vsr-sr" aria-live="polite">{{ liveText }}</p>
      <div v-if="hover != null" class="vsr-tip" :style="tipStyle" aria-hidden="true">
        <div class="vsr-tip-time">{{ timeLabel(xKeys[hover], true) }}</div>
        <div v-for="(m, i) in frameMeasures" :key="m.key" class="vsr-tip-row">
          <i v-if="i < chartMeasures.length" class="vsr-tip-key" :style="{ background: seriesColor(i) }" aria-hidden="true" />
          <strong class="vsr-tip-val">{{ formatValue(valueAt(hover, m.key), m.unit ?? 'count') }}</strong>
          <span class="vsr-tip-name">{{ m.label }}</span>
        </div>
      </div>
    </div>
  </VizShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import type { Frame, FrameField } from '~/types/frame'
import {
  areaPath, barPath, bandScale, linePath, pointScale, seriesColor, sparseTicks, timeLabel, valueScale,
  SERIES_SLOTS, type SizeClass,
} from '~/utils/viz'
import { formatKesAmount, formatNumber, formatValue } from '~/utils/units'
import Sparkline from '~/components/Sparkline.vue'
import VizShell from './VizShell.vue'

const props = withDefaults(defineProps<{
  frame: Frame
  size: SizeClass
  mode?: 'line' | 'area' | 'bars'
  /** A noun for the summary, e.g. "Traffic volume". */
  title?: string
  selectable?: boolean
  isPicked?: (key: string) => boolean
  isDimmed?: (key: string) => boolean
}>(), { mode: 'line', title: 'Series', selectable: false, isPicked: () => false, isDimmed: () => false })

const emit = defineEmits<{ pick: [key: string] }>()

const dimField = computed(() => props.frame.fields.find(f => f.kind !== 'measure')!)
const dimKey = computed(() => dimField.value.key)
const frameMeasures = computed(() => props.frame.fields.filter(f => f.kind === 'measure'))
/** Only measures sharing the first measure's unit are drawn - one axis, always. */
const chartMeasures = computed<FrameField[]>(() => {
  const first = frameMeasures.value[0]
  if (!first) return []
  const same = frameMeasures.value.filter(m => (m.unit ?? 'count') === (first.unit ?? 'count'))
  return props.mode === 'bars' ? same.slice(0, 1) : same.slice(0, SERIES_SLOTS)
})
const xKeys = computed(() => props.frame.rows.map(r => String(r[dimKey.value])))
const valueAt = (i: number, key: string) => (props.frame.rows[i]?.[key] as number | null | undefined) ?? null

// ── xs headline ──────────────────────────────────────────────────────────
const headSeries = computed(() => {
  const m = chartMeasures.value[0]
  return m ? props.frame.rows.map(r => r[m.key] as number | null).filter((v): v is number => v != null) : []
})
const lastIndex = computed(() => {
  const m = chartMeasures.value[0]
  if (!m) return -1
  for (let i = props.frame.rows.length - 1; i >= 0; i--) if (props.frame.rows[i]![m.key] != null) return i
  return -1
})
const lastText = computed(() => {
  const m = chartMeasures.value[0]
  return m && lastIndex.value >= 0 ? formatValue(valueAt(lastIndex.value, m.key), m.unit ?? 'count') : '-'
})
const lastTime = computed(() => (lastIndex.value >= 0 ? timeLabel(xKeys.value[lastIndex.value], true) : ''))

const summary = computed(() => {
  const n = xKeys.value.length
  const span = n ? `${timeLabel(xKeys.value[0], true)} to ${timeLabel(xKeys.value[n - 1], true)}` : 'no data'
  return `${props.title}: ${chartMeasures.value.map(m => m.label).join(', ')}, ${n} points, ${span}. Latest ${lastText.value}.`
})

// ── geometry ─────────────────────────────────────────────────────────────
const stageEl = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(stageEl)
const axes = computed(() => props.size === 'm' || props.size === 'l')
const endRoom = computed(() => (props.size === 'l' && props.mode !== 'bars' && chartMeasures.value.length <= 4 ? 56 : props.size === 's' ? 44 : 8))
const pad = computed(() => ({ top: 8, right: endRoom.value, bottom: axes.value ? 20 : 4, left: axes.value ? 44 : 2 }))
const plotBottom = computed(() => height.value - pad.value.bottom)

const allValues = computed(() => chartMeasures.value.flatMap(m => props.frame.rows.map(r => r[m.key] as number | null)))
const y = computed(() => valueScale(allValues.value, [plotBottom.value, pad.value.top], props.size === 'l' ? 5 : 4))
const yTicks = computed(() => y.value.ticks(props.size === 'l' ? 5 : 4))

const xPoint = computed(() => pointScale(xKeys.value, [pad.value.left, width.value - pad.value.right]))
const xBand = computed(() => bandScale(xKeys.value, [pad.value.left, width.value - pad.value.right], 0.2))
function xPos(k: string): number {
  if (props.mode === 'bars') return (xBand.value(k) ?? 0) + xBand.value.bandwidth() / 2
  return xPoint.value(k) ?? 0
}
const xTickKeys = computed(() => sparseTicks(xKeys.value, props.size === 'l' ? 6 : 4))

const paths = computed(() => chartMeasures.value.map((m) => {
  const pts = props.frame.rows.map((r, i) => ({ x: xPos(xKeys.value[i]!), y: r[m.key] == null ? null : y.value(r[m.key] as number) }))
  return { key: m.key, line: linePath(pts), area: areaPath(pts, y.value(0)) }
}))

function barFor(k: string): string {
  const m = chartMeasures.value[0]
  const i = xKeys.value.indexOf(k)
  const v = m ? valueAt(i, m.key) : null
  if (v == null) return ''
  const bw = Math.min(24, Math.max(1, xBand.value.bandwidth()))
  const x0 = xPos(k) - bw / 2
  const top = y.value(Math.max(v, 0))
  const base = y.value(0)
  return barPath(x0, top, bw, Math.max(0, base - top))
}

const endLabels = computed(() => {
  if (props.size === 'm' || props.mode === 'bars') return null
  if (props.size === 's' && chartMeasures.value.length > 1) return null
  if (chartMeasures.value.length > 4) return null
  return chartMeasures.value.map((m) => {
    for (let i = props.frame.rows.length - 1; i >= 0; i--) {
      const v = valueAt(i, m.key)
      if (v != null) return { key: m.key, x: xPos(xKeys.value[i]!), y: y.value(v), text: formatValue(v, m.unit ?? 'count') }
    }
    return null
  }).filter((e): e is NonNullable<typeof e> => !!e)
})

function tickText(v: number): string {
  const unit = chartMeasures.value[0]?.unit ?? 'count'
  if (unit === 'kes') return formatKesAmount(v)
  if (unit === 'pct') return `${formatNumber(v, 0)}%`
  return Math.abs(v) >= 10_000 ? formatKesAmount(v) : formatNumber(v, Number.isInteger(v) ? 0 : 1)
}

// ── hover / keyboard ─────────────────────────────────────────────────────
const hover = ref<number | null>(null)
function nearestIndex(px: number): number | null {
  const n = xKeys.value.length
  if (!n) return null
  let best = 0
  let dist = Infinity
  xKeys.value.forEach((k, i) => { const d = Math.abs(xPos(k) - px); if (d < dist) { dist = d; best = i } })
  return best
}
function onPointer(e: PointerEvent) {
  const rect = stageEl.value?.getBoundingClientRect()
  if (!rect) return
  hover.value = nearestIndex(e.clientX - rect.left)
}
function onKey(e: KeyboardEvent) {
  const n = xKeys.value.length
  if (!n) return
  const cur = hover.value ?? n - 1
  if (e.key === 'ArrowLeft') hover.value = Math.max(0, cur - 1)
  else if (e.key === 'ArrowRight') hover.value = hover.value == null ? n - 1 : Math.min(n - 1, cur + 1)
  else if (e.key === 'Home') hover.value = 0
  else if (e.key === 'End') hover.value = n - 1
  else if (e.key === 'Escape') hover.value = null
  else if ((e.key === 'Enter' || e.key === ' ') && hover.value != null && props.selectable) emit('pick', xKeys.value[hover.value]!)
  else return
  e.preventDefault()
}

/** What the crosshair shows, read out for screen readers as it moves. */
const liveText = computed(() => {
  if (hover.value == null) return ''
  const i = hover.value
  return `${timeLabel(xKeys.value[i], true)}: ${frameMeasures.value.map(m => `${m.label} ${formatValue(valueAt(i, m.key), m.unit ?? 'count')}`).join(', ')}`
})

const tipStyle = computed(() => {
  if (hover.value == null) return {}
  const x = xPos(xKeys.value[hover.value]!)
  const flip = x > width.value * 0.6
  return flip ? { right: `${width.value - x + 10}px`, top: `${pad.value.top}px` } : { left: `${x + 10}px`, top: `${pad.value.top}px` }
})
</script>

<style scoped>
.vsr-head { display: flex; flex-direction: column; gap: 2px; height: 100%; justify-content: center; min-width: 0; }
.vsr-head-val { font-family: var(--font-mono); font-size: 22px; font-weight: 600; color: var(--fg-1); line-height: 1.1; }
.vsr-head-lbl { font-size: 10.5px; color: var(--fg-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vsr-head-spark { margin-top: 4px; }

.vsr-key { display: inline-flex; align-items: center; gap: 5px; }
.vsr-key-mark { width: 12px; height: 2px; border-radius: 1px; }
.vsr-key-mark--bar { width: 8px; height: 8px; border-radius: 2px; }

.vsr-stage { position: relative; height: 100%; outline: none; }
.vsr-stage:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: var(--r-xs); }
.vsr-svg { display: block; overflow: visible; }
.vsr-grid { stroke: var(--border-subtle); stroke-width: 1; shape-rendering: crispEdges; }
.vsr-grid--zero { stroke: var(--border-strong); }
.vsr-tick { font-family: var(--font-mono); font-size: 9.5px; font-variant-numeric: tabular-nums; fill: var(--fg-3); }
.vsr-line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.vsr-area { opacity: .1; stroke: none; }
.vsr-bar { transition: opacity var(--dur-fast) var(--ease-standard); }
.vsr-bar.is-dim { opacity: .35; }
.vsr-bar.is-picked { stroke: var(--fg-1); stroke-width: 1; }
.vsr-cross { stroke: var(--fg-3); stroke-width: 1; shape-rendering: crispEdges; }
/* 2px surface ring keeps the marker legible over the line */
.vsr-dot { stroke: var(--surface-2); stroke-width: 2; }
.vsr-end { font-family: var(--font-mono); font-size: 10px; font-variant-numeric: tabular-nums; fill: var(--fg-2); }

.vsr-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.vsr-tip {
  position: absolute; z-index: 5; pointer-events: none; min-width: 120px; padding: 7px 9px;
  background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: var(--r-sm); box-shadow: var(--elev-2);
}
.vsr-tip-time { font-size: 10px; color: var(--fg-3); margin-bottom: 3px; }
.vsr-tip-row { display: flex; align-items: center; gap: 6px; font-size: 11px; line-height: 1.6; }
.vsr-tip-key { width: 10px; height: 2px; border-radius: 1px; flex-shrink: 0; }
.vsr-tip-val { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-weight: 600; color: var(--fg-1); }
.vsr-tip-name { color: var(--fg-3); }
</style>
