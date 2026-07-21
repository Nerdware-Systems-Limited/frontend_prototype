<template>
  <div class="mlc-root">
    <div v-if="series.length > 1" class="mlc-legend">
      <span v-for="s in series" :key="s.name" class="mlc-legend-item">
        <span class="mlc-legend-swatch" :style="{ background: s.color }" />
        {{ s.name }}
      </span>
    </div>

    <div ref="wrapEl" class="mlc-wrap" :style="{ height: `${height}px` }">
      <div v-if="!hasData" class="mlc-empty">{{ emptyText }}</div>
      <template v-else>
        <svg
          v-if="width > 0"
          class="mlc-svg"
          :width="width" :height="height"
          @pointermove="onMove" @pointerleave="onLeave"
        >
          <line
            v-for="(t, i) in yTicks" :key="'g'+i"
            :x1="pad.left" :x2="width - pad.right" :y1="t.y" :y2="t.y"
            class="mlc-grid"
          />

          <polyline
            v-for="s in seriesPoints" :key="s.name"
            :points="s.attr" fill="none" :stroke="s.color"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          />

          <g v-if="hoverIndex !== null">
            <line :x1="hx" :x2="hx" :y1="pad.top" :y2="height - pad.bottom" class="mlc-crosshair" />
            <template v-for="s in seriesPoints" :key="'hp'+s.name">
              <circle
                v-if="s.points[hoverIndex]"
                :cx="s.points[hoverIndex].x" :cy="s.points[hoverIndex].y"
                r="4" :fill="s.color" stroke="#fff" stroke-width="1.5"
              />
            </template>
          </g>

          <text
            v-for="(t, i) in yTicks" :key="'yl'+i"
            :x="pad.left - 8" :y="t.y"
            text-anchor="end" dominant-baseline="middle" class="mlc-ytick"
          >{{ formatValue(t.value) }}</text>

          <text
            v-for="(p, i) in xLabelPoints" :key="'xl'+i"
            :x="p.x" :y="height - 6" text-anchor="middle" class="mlc-xtick"
          >{{ p.label }}</text>
        </svg>

        <div v-if="hoverIndex !== null" class="mlc-tooltip" :style="tooltipStyle">
          <div class="mlc-tooltip-label">{{ xLabels[hoverIndex] }}</div>
          <div v-for="s in seriesPoints" :key="'tt'+s.name" class="mlc-tooltip-row">
            <span class="mlc-tooltip-key" :style="{ background: s.color }" />
            <span class="mlc-tooltip-name">{{ s.name }}</span>
            <span class="mlc-tooltip-value">{{ s.points[hoverIndex] ? formatValue(s.points[hoverIndex].value) : '-' }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// Multi-series trend line: one legend row (identity channel), shared
// crosshair, single tooltip listing every series at that x - never
// per-series tooltips. Series share the x-axis by index/label.
const props = withDefaults(defineProps<{
  series: { name: string; color: string; points: { label: string; value: number }[] }[]
  height?: number
  formatValue?: (v: number) => string
  emptyText?: string
}>(), {
  height: 180,
  formatValue: (v: number) => Math.round(v).toLocaleString(),
  emptyText: 'No data available',
})

const wrapEl = ref<HTMLElement | null>(null)
const { width } = useElementSize(wrapEl)
const pad = { left: 42, right: 10, top: 14, bottom: 20 }

const hasData = computed(() => props.series.some(s => s.points.length))
const pointCount = computed(() => Math.max(0, ...props.series.map(s => s.points.length)))
const xLabels = computed(() => {
  const withMost = props.series.reduce((a, b) => (a.points.length >= b.points.length ? a : b), props.series[0])
  return (withMost?.points ?? []).map(p => p.label)
})

const allValues = computed(() => props.series.flatMap(s => s.points.map(p => p.value)))
const maxV = computed(() => Math.max(...allValues.value, 0))
const minV = computed(() => Math.min(...allValues.value, 0))

function xFor(i: number) {
  const n = pointCount.value
  const innerW = Math.max(1, width.value - pad.left - pad.right)
  return n > 1 ? pad.left + (i / (n - 1)) * innerW : pad.left + innerW / 2
}
function yFor(v: number) {
  const range = maxV.value - minV.value || 1
  const innerH = props.height - pad.top - pad.bottom
  return pad.top + (1 - (v - minV.value) / range) * innerH
}

const seriesPoints = computed(() => props.series.map(s => {
  const points = s.points.map((p, i) => ({ ...p, x: xFor(i), y: yFor(p.value) }))
  return { name: s.name, color: s.color, points, attr: points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') }
}))

const yTicks = computed(() => {
  const steps = 3
  const range = maxV.value - minV.value || 1
  return Array.from({ length: steps + 1 }, (_, i) => {
    const value = minV.value + (range * i) / steps
    return { value, y: yFor(value) }
  }).reverse()
})

const xLabelPoints = computed(() => {
  const n = pointCount.value
  if (!n) return []
  const maxLabels = 6
  const stride = Math.max(1, Math.ceil(n / maxLabels))
  return xLabels.value
    .map((label, i) => ({ label, x: xFor(i), i }))
    .filter(p => p.i % stride === 0 || p.i === n - 1)
})

const hoverIndex = ref<number | null>(null)
const hx = computed(() => hoverIndex.value != null ? xFor(hoverIndex.value) : 0)

function onMove(e: PointerEvent) {
  if (!wrapEl.value || !pointCount.value) return
  const rect = wrapEl.value.getBoundingClientRect()
  const relX = e.clientX - rect.left
  const n = pointCount.value
  const innerW = Math.max(1, width.value - pad.left - pad.right)
  const ratio = n > 1 ? (relX - pad.left) / innerW : 0
  hoverIndex.value = Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))))
}
function onLeave() { hoverIndex.value = null }

const tooltipStyle = computed(() => {
  if (hoverIndex.value == null) return {}
  const left = Math.min(Math.max(xFor(hoverIndex.value), 70), Math.max(width.value - 70, 70))
  return { left: `${left}px`, top: `${pad.top}px` }
})
</script>

<style scoped>
.mlc-root { width:100%; }
.mlc-legend { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:8px; }
.mlc-legend-item { display:inline-flex; align-items:center; gap:5px; font-size:11px; color:#4b5563; }
.mlc-legend-swatch { width:10px; height:10px; border-radius:2px; display:inline-block; }
.mlc-wrap { position:relative; width:100%; }
.mlc-empty { display:flex; align-items:center; justify-content:center; height:100%; color:#94a3b8; font-size:13px; }
.mlc-svg { display:block; overflow:visible; }
.mlc-grid { stroke:#eef1f4; stroke-width:1; }
.mlc-crosshair { stroke:#cbd5e1; stroke-width:1; }
.mlc-ytick { font-size:9px; fill:#94a3b8; }
.mlc-xtick { font-size:9px; fill:#94a3b8; }
.mlc-tooltip {
  position:absolute; transform:translateX(-50%);
  background:#1e293b; color:#fff; border-radius:6px; padding:7px 10px;
  font-size:11px; line-height:1.5; white-space:nowrap; pointer-events:none;
  box-shadow:0 4px 12px rgba(15,23,42,.18); z-index:5;
}
.mlc-tooltip-label { color:#cbd5e1; font-size:10px; margin-bottom:3px; font-weight:600; }
.mlc-tooltip-row { display:flex; align-items:center; gap:6px; }
.mlc-tooltip-key { width:8px; height:2px; border-radius:1px; display:inline-block; }
.mlc-tooltip-name { color:#cbd5e1; flex:1; }
.mlc-tooltip-value { font-weight:700; }
</style>
