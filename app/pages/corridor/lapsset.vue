<template>
  <PageHeader
    eyebrow="Corridor & Trade - LAPSSET"
    title="LAPSSET Corridor"
    subtitle="Lamu Port – South Sudan – Ethiopia Transport corridor - port operations, highway and railway construction, and investment against plan"
  >
    <template #actions>
      <NuxtLink v-if="canSee('/corridor/northern')" to="/corridor/northern" class="btn">Northern Corridor<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink v-if="canSee('/corridor')" to="/corridor" class="btn">Overview<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <SectionTitle pill="Lamu Port · monthly">Port and corridor operations</SectionTitle>
  <div class="kpi-grid">
    <KpiCard v-for="s in ops" :key="s.indicator_code" v-bind="kpiCardBind(s)" />
    <EmptyState v-if="!ops.length" :loading="loading" message="No LAPSSET operating indicators loaded." compact />
  </div>

  <div class="two-col">
    <!-- Construction progress -->
    <div class="card">
      <div class="card-header">Construction and investment progress</div>
      <div class="card-body">
        <template v-if="progress.length">
          <div v-for="p in progress" :key="p.s.indicator_code + p.s.segment" class="prow">
            <div class="prow-head">
              <span class="prow-name">{{ p.s.segment || p.s.indicator_name }}</span>
              <span class="prow-kind">{{ p.s.segment ? p.s.indicator_name : '' }}</span>
              <span class="prow-pct mono">{{ p.s.latest.toFixed(1) }}%</span>
            </div>
            <ProgressBar :pct="p.s.latest" :variant="p.s.latest >= 75 ? 'success' : 'default'" />
            <div class="prow-foot">
              <span class="mono">{{ p.pace != null ? `${p.pace > 0 ? '+' : ''}${p.pace.toFixed(1)} pts / month` : 'pace unknown' }}</span>
              <span v-if="p.eta" class="eta">≈ {{ p.eta }} at the current pace (estimate)</span>
            </div>
          </div>
        </template>
        <EmptyState v-else :loading="loading" message="No progress indicators loaded." compact />
      </div>
    </div>

    <!-- Trend explorer -->
    <div class="card">
      <div class="card-header">
        Trend
        <select v-model="trendKey" class="select select-sm" aria-label="Indicator">
          <option v-for="s in trendOptions" :key="key(s)" :value="key(s)">{{ s.indicator_name }}{{ s.segment ? ` · ${s.segment}` : '' }}</option>
        </select>
      </div>
      <div class="card-body">
        <template v-if="trendSeries">
          <div class="fig-row"><span class="big">{{ fmtKpi(trendSeries.latest) }}</span><span class="unit">{{ trendSeries.unit }}</span></div>
          <TrendLineChart :points="trendPoints" :height="230" :format-value="fmtKpi" />
          <p v-if="trendSeries.benchmark_value != null" class="note">Reference <b class="mono">{{ fmtKpi(trendSeries.benchmark_value) }} {{ trendSeries.unit }}</b><template v-if="trendSeries.benchmark_source"> · {{ trendSeries.benchmark_source }}</template></p>
        </template>
        <EmptyState v-else :loading="loading" message="No indicator to chart." compact />
      </div>
    </div>
  </div>

  <!-- Against the Northern Corridor -->
  <SectionTitle pill="Cross-corridor">Against the Northern Corridor</SectionTitle>
  <div class="card">
    <div class="card-body flush">
      <table v-if="compare.length">
        <thead><tr><th>Indicator</th><th class="r">LAPSSET</th><th class="r">Northern</th><th class="r">LAPSSET as % of Northern</th></tr></thead>
        <tbody>
          <tr v-for="c in compare" :key="c.indicator_code">
            <td><b>{{ c.indicator_name }}</b></td>
            <td class="r mono">{{ cell(c, 'LAPSSET') }}</td>
            <td class="r mono">{{ cell(c, 'NORTHERN') }}</td>
            <td class="r mono">{{ share(c) }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else :loading="loading" message="No indicator is reported by both corridors yet." compact />
    </div>
  </div>
  <p class="note foot">Values are shown in each corridor's own reported unit; the percentage is only computed when both use the same unit.</p>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useCorridor, kpiCardBind, kpiKind, fmtKpi, monthLabel, type KpiSeries, type CorridorCompareRow } from '~/composables/api'

const access = useAccessControl()
const canSee = access.canAccessRoute

const series = ref<KpiSeries[]>([])
const compare = ref<CorridorCompareRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const trendKey = ref('')

async function load() {
  loading.value = true
  error.value = null
  const api = useCorridor()
  const [k, c] = await Promise.allSettled([api.kpiSeries({ corridor: 'LAPSSET', months: 12 }), api.compare()])
  if (k.status === 'fulfilled') {
    series.value = k.value
    if (!trendKey.value) trendKey.value = key(k.value.find(s => s.indicator_code === 'PORT_THROUGHPUT') ?? k.value[0] ?? ({} as KpiSeries))
  } else {
    error.value = 'Unable to reach the UAPTS Corridor API.'
  }
  if (c.status === 'fulfilled') compare.value = c.value.filter(r => r.corridors.LAPSSET && r.corridors.NORTHERN)
  loading.value = false
}
onMounted(load)

const key = (s: KpiSeries) => `${s.indicator_code}|${s.segment}`
const OPS = ['PORT_THROUGHPUT', 'BERTH_OCCUPANCY_PCT', 'VESSEL_TURNAROUND_TIME', 'TRUCK_VOLUME']
const ops = computed(() => OPS.map(c => series.value.find(s => s.indicator_code === c && !s.segment)).filter(Boolean) as KpiSeries[])

// Average monthly gain over the available history -> months to 100% at that pace. An estimate, labelled as one.
const progress = computed(() => series.value.filter(s => kpiKind(s.indicator_code) === 'progress').map(s => {
  const pts = s.points
  const pace = pts.length > 1 ? (pts[pts.length - 1]!.value - pts[0]!.value) / (pts.length - 1) : null
  let eta: string | null = null
  if (pace && pace > 0 && s.latest < 100) {
    const months = Math.ceil((100 - s.latest) / pace)
    const d = new Date(); d.setMonth(d.getMonth() + months)
    eta = d.toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })
  }
  return { s, pace, eta }
}))

const trendOptions = computed(() => series.value)
const trendSeries = computed(() => series.value.find(s => key(s) === trendKey.value) ?? null)
const trendPoints = computed(() => (trendSeries.value?.points ?? []).map(p => ({ label: monthLabel(p.period_end), value: p.value })))

const cell = (c: CorridorCompareRow, code: string) => { const v = c.corridors[code]; return v ? `${fmtKpi(v.value)} ${v.unit}` : '-' }
const share = (c: CorridorCompareRow) => {
  const a = c.corridors.LAPSSET, b = c.corridors.NORTHERN
  return a && b && a.unit === b.unit && b.value ? `${((a.value / b.value) * 100).toFixed(1)}%` : '-'
}
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; margin-bottom: 16px; }
.two-col { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 16px; align-items: start; }
@media (max-width: 1100px) { .two-col { grid-template-columns: 1fr; } }
.card-body.flush { padding: 0; }
.card-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.card-header .select-sm { text-transform: none; letter-spacing: 0; font-weight: 500; max-width: 230px; }
.r { text-align: right !important; }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.prow { padding: 10px 0; border-bottom: 1px solid var(--border-subtle); }
.prow:last-child { border-bottom: none; }
.prow-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; }
.prow-name { font-weight: 600; font-size: 13px; color: var(--fg-1); }
.prow-kind { font-size: 11px; color: var(--fg-3); flex: 1; }
.prow-pct { font-weight: 600; font-size: 14px; }
.prow-foot { display: flex; justify-content: space-between; margin-top: 5px; font-size: 11px; color: var(--fg-3); gap: 10px; flex-wrap: wrap; }
.eta { color: var(--fg-2); }
.fig-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.big { font: 600 28px 'JetBrains Mono', ui-monospace, monospace; letter-spacing: -.01em; color: var(--fg-1); }
.unit { font-size: 12px; color: var(--fg-3); }
.note { margin: 10px 0 0; font-size: 12px; color: var(--fg-2); }
.note.foot { font-size: 11.5px; color: var(--fg-3); margin-bottom: 24px; }
</style>
