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
        <circle :cx="last.x" :cy="last.y" r="3.5" :fill="color" stroke="#fff" stroke-width="1.5" />

        <!-- crosshair -->
        <g v-if="hoverIndex !== null">
          <line :x1="hx" :x2="hx" :y1="pad.top" :y2="height - pad.bottom" class="tlc-crosshair" />
          <circle :cx="hx" :cy="hy" r="4.5" :fill="color" stroke="#fff" stroke-width="2" />
        </g>

        <!-- y-axis ticks -->
        <text
          v-for="(t, i) in yTicks" :key="'yl'+i"
          :x="pad.left - 8" :y="t.y"
          text-anchor="end" dominant-baseline="middle" class="tlc-ytick"
        >{{ formatValue(t.value) }}</text>

        <!-- end value label -->
        <text v-if="hoverIndex === null" :x="last.x" :y="Math.max(last.y - 10, 12)" text-anchor="end" class="tlc-endlabel">
          {{ formatValue(points[points.length - 1].value) }}
        </text>

        <!-- x-axis labels -->
        <text
          v-for="(p, i) in xLabelPoints" :key="'xl'+i"
          :x="p.x" :y="height - 6" text-anchor="middle" class="tlc-xtick"
        >{{ p.label }}</text>
      </svg>

      <div v-if="hoverIndex !== null" class="tlc-tooltip" :style="tooltipStyle">
        <div class="tlc-tooltip-value">{{ formatValue(points[hoverIndex].value) }}</div>
        <div class="tlc-tooltip-label">{{ points[hoverIndex].label }}</div>
        <div v-if="points[hoverIndex].meta" class="tlc-tooltip-meta">{{ points[hoverIndex].meta }}</div>
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
  color?: string
  height?: number
  area?: boolean
  formatValue?: (v: number) => string
  emptyText?: string
}>(), {
  color: '#3b82f6',
  height: 160,
  area: true,
  formatValue: (v: number) => Math.round(v).toLocaleString(),
  emptyText: 'No data available',
})

const wrapEl = ref<HTMLElement | null>(null)
const { width } = useElementSize(wrapEl)
const gradId = `tlc-grad-${Math.random().toString(36).slice(2, 9)}`

const pad = { left: 42, right: 10, top: 14, bottom: 20 }

const values = computed(() => props.points.map(p => p.value))
const maxV = computed(() => Math.max(...values.value, 0))
const minV = computed(() => Math.min(...values.value, 0))

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
  const first = chartPoints.value[0]
  const lastP = chartPoints.value[chartPoints.value.length - 1]
  const mid = chartPoints.value.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return `M${first.x.toFixed(1)},${baseline} ${mid} L${lastP.x.toFixed(1)},${baseline} Z`
})
const last = computed(() => chartPoints.value[chartPoints.value.length - 1] ?? { x: 0, y: 0 })

const yTicks = computed(() => {
  const steps = 3
  const range = maxV.value - minV.value || 1
  return Array.from({ length: steps + 1 }, (_, i) => {
    const value = minV.value + (range * i) / steps
    return { value, y: yFor(value) }
  }).reverse()
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
const hx = computed(() => hoverIndex.value != null ? chartPoints.value[hoverIndex.value].x : 0)
const hy = computed(() => hoverIndex.value != null ? chartPoints.value[hoverIndex.value].y : 0)

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
  const p = chartPoints.value[hoverIndex.value]
  const left = Math.min(Math.max(p.x, 56), Math.max(width.value - 56, 56))
  return { left: `${left}px`, top: `${Math.max(p.y - 10, 4)}px` }
})
</script>

<style scoped>
.tlc-wrap { position:relative; width:100%; }
.tlc-empty { display:flex; align-items:center; justify-content:center; height:100%; color:#94a3b8; font-size:13px; }
.tlc-svg { display:block; overflow:visible; }
.tlc-grid { stroke:#eef1f4; stroke-width:1; }
.tlc-crosshair { stroke:#cbd5e1; stroke-width:1; }
.tlc-ytick { font-size:9px; fill:#94a3b8; }
.tlc-xtick { font-size:9px; fill:#94a3b8; }
.tlc-endlabel { font-size:10px; font-weight:600; fill:#475569; }
.tlc-tooltip {
  position:absolute; transform:translate(-50%, -100%);
  background:#1e293b; color:#fff; border-radius:6px; padding:5px 9px;
  font-size:11px; line-height:1.35; white-space:nowrap; pointer-events:none;
  box-shadow:0 4px 12px rgba(15,23,42,.18); z-index:5;
}
.tlc-tooltip-value { font-weight:700; }
.tlc-tooltip-label { color:#cbd5e1; font-size:10px; }
.tlc-tooltip-meta { color:#94a3b8; font-size:10px; margin-top:2px; }
</style>
