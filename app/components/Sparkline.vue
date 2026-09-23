<template>
  <!--
    Sparkline - a compact trajectory readout for a KPI card, NOT decoration.
    Only mount it where a real series exists (never a fabricated one). Static
    by design: the dashboard's one authored motion is the KPI stagger.
  -->
  <svg
    v-if="norm.length > 1"
    class="spark"
    :class="`spark--${tone}`"
    :viewBox="`0 0 ${W} ${H}`"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
  >
    <path class="spark__area" :d="areaPath" />
    <polyline class="spark__line" :points="linePoints" vector-effect="non-scaling-stroke" />
    <circle class="spark__dot" :cx="last.x" :cy="last.y" :r="2" vector-effect="non-scaling-stroke" />
  </svg>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Raw values, oldest first. Fewer than 2 points renders nothing. */
  points: number[]
  /** Semantic colour, usually the parent card's own status. */
  tone?: 'neutral' | 'critical' | 'below' | 'ontarget' | 'monitoring'
}>(), {
  tone: 'neutral',
})

const W = 100
const H = 30
const PAD = 3

const norm = computed(() => {
  const pts = (props.points ?? []).filter(n => typeof n === 'number' && Number.isFinite(n))
  if (pts.length < 2) return [] as Array<{ x: number; y: number }>
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const stepX = W / (pts.length - 1)
  const usableH = H - PAD * 2
  return pts.map((v, i) => ({
    x: +(i * stepX).toFixed(2),
    y: +(H - PAD - ((v - min) / span) * usableH).toFixed(2),
  }))
})

const linePoints = computed(() => norm.value.map(p => `${p.x},${p.y}`).join(' '))
const last = computed(() => norm.value[norm.value.length - 1] ?? { x: 0, y: 0 })
const areaPath = computed(() => {
  if (norm.value.length < 2) return ''
  const line = norm.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  return `${line} L${W},${H} L0,${H} Z`
})
</script>

<style scoped>
.spark {
  display: block;
  width: 100%;
  height: 30px;
  color: var(--fg-3);
  overflow: visible;
}
.spark--critical   { color: var(--destructive); }
.spark--below      { color: var(--warning); }
.spark--ontarget   { color: var(--success); }
.spark--monitoring { color: var(--info); }

.spark__line {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.spark__area {
  fill: currentColor;
  opacity: 0.1;
}
.spark__dot {
  fill: currentColor;
  stroke: var(--surface-2);
  stroke-width: 1.5;
}
</style>
