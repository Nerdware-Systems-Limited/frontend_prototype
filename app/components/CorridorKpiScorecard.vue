<template>
  <div class="ck">
    <table v-if="rows.length" class="ck-table">
      <thead>
        <tr>
          <th>Indicator</th>
          <th class="num">Latest</th>
          <th class="num">Benchmark</th>
          <th class="gap-col">Against benchmark</th>
          <th class="trend-col">Trend</th>
          <th class="num">Δ</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in rows" :key="r.key"
          :class="{ clickable: selectable, active: selectable && r.key === activeKey }"
          :tabindex="selectable ? 0 : undefined"
          @click="selectable && $emit('select', r.s)"
          @keydown.enter="selectable && $emit('select', r.s)"
        >
          <td>
            <span class="dot" :style="{ background: TONE_COLOR[r.tone] }" aria-hidden="true" />
            <span class="ind-name">{{ r.s.indicator_name }}</span>
            <span v-if="r.s.segment" class="seg">{{ r.s.segment }}</span>
          </td>
          <td class="num fig">{{ fmtKpi(r.s.latest) }}<span class="unit">{{ r.s.unit }}</span></td>
          <td class="num fig muted">
            <template v-if="r.s.benchmark_value != null">{{ fmtKpi(r.s.benchmark_value) }}<span class="unit">{{ r.s.unit }}</span></template>
            <template v-else>-</template>
          </td>
          <td class="gap-col">
            <template v-if="r.kind === 'progress'">
              <div class="bar"><div class="fill" :style="{ width: `${Math.min(100, r.s.latest)}%`, background: 'var(--primary-fill)' }" /></div>
              <span class="gap-txt">{{ fmtKpi(r.s.latest) }}% complete</span>
            </template>
            <template v-else-if="r.s.benchmark_value != null">
              <div class="bar">
                <div class="fill" :style="{ width: `${barPct(r)}%`, background: TONE_COLOR[r.tone] }" />
                <div class="mark" :style="{ left: `${markPct(r)}%` }" title="Benchmark" />
              </div>
              <span class="gap-txt" :class="`t-${r.tone}`">{{ gapText(r) }}</span>
            </template>
            <span v-else class="gap-txt muted">No benchmark set</span>
          </td>
          <td class="trend-col"><Sparkline :points="r.s.points.map(p => p.value)" :tone="sparkTone(r.tone)" /></td>
          <td class="num fig" :class="deltaClass(r.s)">{{ deltaText(r.s) }}</td>
        </tr>
      </tbody>
    </table>
    <EmptyState v-else :loading="loading" :message="emptyText" compact />
  </div>
</template>

<script setup lang="ts">
import {
  benchmarkTone, changeFavourable, fmtKpi, kpiKind, CORRIDOR_TONE_COLOR as TONE_COLOR,
  type KpiSeries, type CorridorTone,
} from '~/composables/api'

const props = withDefaults(defineProps<{
  series: KpiSeries[]
  loading?: boolean
  selectable?: boolean
  activeKey?: string
  emptyText?: string
}>(), { loading: false, selectable: false, activeKey: '', emptyText: 'No corridor indicators loaded yet.' })
defineEmits<{ select: [s: KpiSeries] }>()

const rows = computed(() => props.series.map(s => ({
  s, key: `${s.corridor}|${s.indicator_code}|${s.segment}`, kind: kpiKind(s.indicator_code), tone: benchmarkTone(s),
})))

type Row = (typeof rows.value)[number]

// Bar scale: 0 .. 1.5 x the larger of value/benchmark, so a miss visibly overshoots the benchmark tick.
function scaleMax(r: Row) { return Math.max(r.s.latest, r.s.benchmark_value ?? 0) * 1.25 || 1 }
function barPct(r: Row) { return Math.min(100, (r.s.latest / scaleMax(r)) * 100) }
function markPct(r: Row) { return Math.min(100, ((r.s.benchmark_value ?? 0) / scaleMax(r)) * 100) }

function gapText(r: Row) {
  const pct = r.s.vs_benchmark_pct
  if (pct == null) return ''
  const meets = r.tone === 'success'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}% ${meets ? 'meets target' : r.kind === 'lower' ? 'over target' : 'below target'}`
}
function sparkTone(t: CorridorTone) { return t === 'success' ? 'ontarget' : t === 'warning' ? 'monitoring' : t === 'danger' ? 'critical' : 'neutral' }
function deltaText(s: KpiSeries) {
  if (s.change == null) return '-'
  return `${s.change > 0 ? '+' : ''}${fmtKpi(s.change)}`
}
function deltaClass(s: KpiSeries) {
  const fav = changeFavourable(s)
  return fav === null ? 'muted' : fav ? 't-success' : 't-danger'
}
</script>

<style scoped>
.ck-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.ck-table th { text-align: left; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-3); background: var(--surface-1); padding: 8px 13px; border-bottom: 1px solid var(--border-strong); white-space: nowrap; }
.ck-table td { padding: 9px 13px; border-bottom: 1px solid var(--border-subtle); vertical-align: middle; }
.ck-table tbody tr:last-child td { border-bottom: none; }
.ck-table tbody tr.clickable { cursor: pointer; }
.ck-table tbody tr.clickable:hover td { background: var(--primary-wash); }
.ck-table tbody tr.active td { background: var(--primary-wash-strong, var(--primary-wash)); }
.ck-table tbody tr:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.num { text-align: right !important; }
.fig { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
.unit { font-size: 10px; font-weight: 500; color: var(--fg-3); margin-left: 4px; }
.muted { color: var(--fg-3); font-weight: 500; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 9px; vertical-align: middle; }
.ind-name { font-weight: 600; color: var(--fg-1); }
.seg { display: inline-block; margin-left: 8px; font-size: 10px; color: var(--fg-2); background: var(--surface-sunken); padding: 1px 6px; border-radius: 2px; font-weight: 600; }
.gap-col { min-width: 170px; }
.trend-col { width: 110px; }
.trend-col :deep(svg) { width: 96px; height: 26px; }
.bar { position: relative; height: 5px; background: var(--surface-sunken); border-radius: 3px; overflow: visible; margin-bottom: 4px; }
.fill { height: 100%; border-radius: 3px; }
.mark { position: absolute; top: -3px; width: 1px; height: 11px; background: var(--fg-1); }
.gap-txt { font-size: 10.5px; font-family: 'JetBrains Mono', ui-monospace, monospace; }
.t-success { color: var(--success-fg); }
.t-warning { color: var(--warning-fg); }
.t-danger { color: var(--danger-fg); }
@media (max-width: 760px) { .trend-col { display: none; } }
</style>
