<template>
  <div ref="wrapEl" class="tlc-wrap" :style="{ height: `${height}px` }">
    <div v-if="!points.length" class="tlc-empty">{{ emptyText }}</div>
    <template v-else>
      <svg
        v-if="width > 0"
        class="tlc-svg"
        :width="width" :height="height"
        @pointermove="onMove" @pointerleave="onLeave"
      >
        <defs>
          <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="color" stop-opacity="0.20" />
            <stop offset="100%" :stop-color="color" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- gridlines -->
        <line
          v-for="(t, i) in yTicks" :key="'g'+i"
          :x1="pad.left" :x2="width - pad.right" :y1="t.y" :y2="t.y"
          class="tlc-grid"
        />

        <!-- area + line -->
        <path v-if="area" :d="areaPath" :fill="`url(#${gradId})`" stroke="none" />
        <polyline :points="polylineAttr" fill="none" :stroke="color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

        <!-- end marker -->
        <circle :cx="last.x" :cy="last.y" r="3.5" :fill="color" class="tlc-marker-ring" stroke-width="1.5" />

        <!-- crosshair -->
        <g v-if="hoverIndex !== null">
          <line :x1="hx" :x2="hx" :y1="pad.top" :y2="height - pad.bottom" class="tlc-crosshair" />
          <circle :cx="hx" :cy="hy" r="4.5" :fill="color" class="tlc-marker-ring" stroke-width="2" />
        </g>

        <!-- y-axis ticks -->
        <text
          v-for="(t, i) in yTicks" :key="'yl'+i"
          :x="pad.left - 8" :y="t.y"
          text-anchor="end" dominant-baseline="middle" class="tlc-ytick"
        >{{ formatValue(t.value) }}</text>

        <!-- end value label -->
        <text v-if="hoverIndex === null" :x="last.x" :y="Math.max(last.y - 10, 12)" text-anchor="end" class="tlc-endlabel">
          {{ formatValue(points[points.length - 1]!.value) }}
        </text>

        <!-- x-axis labels -->
        <text
          v-for="(p, i) in xLabelPoints" :key="'xl'+i"
          :x="p.x" :y="height - 6" text-anchor="middle" class="tlc-xtick"
        >{{ p.label }}</text>
      </svg>

      <div v-if="hoverIndex !== null" class="tlc-tooltip" :style="tooltipStyle">
        <div class="tlc-tooltip-value">{{ formatValue(points[hoverIndex!]!.value) }}</div>
        <div class="tlc-tooltip-label">{{ points[hoverIndex!]!.label }}</div>
        <div v-if="points[hoverIndex!]!.meta" class="tlc-tooltip-meta">{{ points[hoverIndex!]!.meta }}</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Simple, responsive single-series trend line - area wash + 2px line,
// hairline gridlines, hover crosshair/tooltip, sparing end-label.
// Width tracks the wrapping card exactly (no horizontal scroll, no
// distortion) via useElementSize; height is fixed by the `height` prop
// and already includes room for the x-axis label band.
const props = withDefaults(defineProps<{
  points: { label: string; value: number; meta?: string }[]
  /** Line/area/marker color. Defaults to the app's institutional blue,
   * resolved per-theme (see the `color` computed below) rather than a
   * fixed hex, so charts that don't pass an explicit color stay on-brand
   * and visible in both light and dark instead of silently defaulting to
   * an arbitrary blue. */
  color?: string
  height?: number
  area?: boolean
  formatValue?: (v: number) => string
  emptyText?: string
}>(), {
  color: undefined,
  height: 160,
  area: true,
  formatValue: (v: number) => Math.round(v).toLocaleString(),
  emptyText: 'No data available',
})

const wrapEl = ref<HTMLElement | null>(null)
const { width } = useElementSize(wrapEl)
const gradId = `tlc-grad-${Math.random().toString(36).slice(2, 9)}`

// SVG paint attributes (stroke/fill) can't resolve CSS custom properties,
// so when the caller leaves `color` unset we read the actual computed
// --primary value (which already differs per theme) once per theme change,
// instead of hardcoding one hex that would be wrong in the other theme.
const theme = useTheme()
const fallbackColor = ref('#0D4C8B')
function readFallbackColor() {
  if (typeof window === 'undefined') return
  const v = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
  if (v) fallbackColor.value = v
}
onMounted(readFallbackColor)
watch(() => theme.resolved.value, () => nextTick(readFallbackColor))
const color = computed(() => props.color ?? fallbackColor.value)

const pad = { left: 42, right: 10, top: 14, bottom: 20 }

const values = computed(() => props.points.map(p => p.value))
const rawMax = computed(() => Math.max(...values.value, 0))
const rawMin = computed(() => Math.min(...values.value, 0))

// "Nice" axis domain/step (clean round numbers - 0/25/50/75, not raw
// fractions of whatever the data happens to span) - see niceStep().
const niceStepV = computed(() => niceStep((rawMax.value - rawMin.value || 1) / 3))
const maxV = computed(() => Math.ceil(rawMax.value / niceStepV.value) * niceStepV.value)
const minV = computed(() => Math.min(0, Math.floor(rawMin.value / niceStepV.value) * niceStepV.value))

function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return niceNorm * mag
}

function xFor(i: number) {
  const n = props.points.length
  const innerW = Math.max(1, width.value - pad.left - pad.right)
  return n > 1 ? pad.left + (i / (n - 1)) * innerW : pad.left + innerW / 2
}
function yFor(v: number) {
  const range = maxV.value - minV.value || 1
  const innerH = props.height - pad.top - pad.bottom
  return pad.top + (1 - (v - minV.value) / range) * innerH
}

const chartPoints = computed(() => props.points.map((p, i) => ({ ...p, x: xFor(i), y: yFor(p.value) })))
const polylineAttr = computed(() => chartPoints.value.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
const areaPath = computed(() => {
  if (!chartPoints.value.length) return ''
  const baseline = props.height - pad.bottom
  const first = chartPoints.value[0]!
  const lastP = chartPoints.value[chartPoints.value.length - 1]!
  const mid = chartPoints.value.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return `M${first.x.toFixed(1)},${baseline} ${mid} L${lastP.x.toFixed(1)},${baseline} Z`
})
const last = computed(() => chartPoints.value[chartPoints.value.length - 1] ?? { x: 0, y: 0 })

const yTicks = computed(() => {
  const step = niceStepV.value
  const ticks: { value: number; y: number }[] = []
  for (let v = minV.value; v <= maxV.value + step * 0.5; v += step) {
    ticks.push({ value: v, y: yFor(v) })
  }
  return ticks.reverse()
})

// Cap x-axis labels regardless of point count so they never collide.
const xLabelPoints = computed(() => {
  const n = chartPoints.value.length
  if (!n) return []
  const maxLabels = 6
  const stride = Math.max(1, Math.ceil(n / maxLabels))
  return chartPoints.value.filter((_, i) => i % stride === 0 || i === n - 1)
})

const hoverIndex = ref<number | null>(null)
const hx = computed(() => hoverIndex.value != null ? chartPoints.value[hoverIndex.value]!.x : 0)
const hy = computed(() => hoverIndex.value != null ? chartPoints.value[hoverIndex.value]!.y : 0)

function onMove(e: PointerEvent) {
  if (!wrapEl.value || !chartPoints.value.length) return
  const rect = wrapEl.value.getBoundingClientRect()
  const relX = e.clientX - rect.left
  const n = chartPoints.value.length
  const innerW = Math.max(1, width.value - pad.left - pad.right)
  const ratio = n > 1 ? (relX - pad.left) / innerW : 0
  hoverIndex.value = Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))))
}
function onLeave() { hoverIndex.value = null }

const tooltipStyle = computed(() => {
  if (hoverIndex.value == null) return {}
  const p = chartPoints.value[hoverIndex.value]!
  const left = Math.min(Math.max(p.x, 56), Math.max(width.value - 56, 56))
  return { left: `${left}px`, top: `${Math.max(p.y - 10, 4)}px` }
})
</script>

<style scoped>
.tlc-wrap { position:relative; width:100%; }
.tlc-empty { display:flex; align-items:center; justify-content:center; height:100%; color:var(--fg-3); font-size:13px; }
.tlc-svg { display:block; overflow:visible; }
.tlc-grid { stroke:var(--border-subtle); stroke-width:1; }
.tlc-crosshair { stroke:var(--border-interactive); stroke-width:1; }
.tlc-marker-ring { stroke:var(--surface-2); }
.tlc-ytick { font-size:9px; fill:var(--fg-3); font-variant-numeric:tabular-nums; }
.tlc-xtick { font-size:9px; fill:var(--fg-3); }
.tlc-endlabel { font-size:10px; font-weight:600; fill:var(--fg-2); }
.tlc-tooltip {
  position:absolute; transform:translate(-50%, -100%);
  background:var(--surface-2); color:var(--fg-1); border:1px solid var(--border-subtle);
  border-radius:6px; padding:5px 9px;
  font-size:11px; line-height:1.35; white-space:nowrap; pointer-events:none;
  box-shadow:var(--elev-2); z-index:5;
}
.tlc-tooltip-value { font-weight:700; }
.tlc-tooltip-label { color:var(--fg-2); font-size:10px; }
.tlc-tooltip-meta { color:var(--fg-3); font-size:10px; margin-top:2px; }
</style>
