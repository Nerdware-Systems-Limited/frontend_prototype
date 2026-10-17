<template>
  <PageHeader
    eyebrow="Corridor & Trade - NCTTCA"
    title="Northern Corridor"
    subtitle="Mombasa Port to the Great Lakes region - Transport Observatory indicators against benchmark, route condition and the port-to-border transit chain"
  >
    <template #actions>
      <DayRangeToggle v-model="days" :options="[7, 30, 90]" @update:model-value="load" />
      <NuxtLink v-if="canSee('/corridor/border-crossings')" to="/corridor/border-crossings" class="btn">Border Crossings<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink v-if="canSee('/corridor')" to="/corridor" class="btn">Overview<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Transit chain: where the time goes -->
  <SectionTitle pill="Observatory · latest month">Where the time goes - Mombasa to Kampala</SectionTitle>
  <div class="card">
    <div class="card-body">
      <template v-if="chain.total > 0">
        <div class="chain" role="img" :aria-label="chainLabel">
          <div v-for="c in chain.parts" :key="c.key" class="chain-seg" :style="{ flex: c.days, background: c.color }">
            <span class="chain-v">{{ c.days.toFixed(1) }} d</span>
            <span class="chain-l">{{ c.label }}</span>
          </div>
        </div>
        <p class="chain-note">
          Port dwell and border crossing are reported separately; road transit is the remainder of the reported
          Mombasa-Kampala time<template v-if="transit"> (<b class="mono">{{ transit.latest.toFixed(1) }} {{ transit.unit }}</b><template v-if="transit.benchmark_value != null">, target <b class="mono">{{ transit.benchmark_value }} {{ transit.unit }}</b></template>)</template>.
        </p>
      </template>
      <EmptyState v-else :loading="loading" message="Port dwell, border crossing and transit-time indicators are needed to draw the chain." compact />
    </div>
  </div>

  <!-- Route schematic -->
  <SectionTitle pill="Road condition · NCTTCA / KeNHA">Route condition and border waits</SectionTitle>
  <div class="card">
    <div class="card-body"><CorridorSchematic :segment-good-pct="segmentGood" :posts="posts" /></div>
  </div>

  <!-- Scorecard + explorer -->
  <SectionTitle pill="CT-03 · monthly">Corridor indicators</SectionTitle>
  <div class="two-col">
    <div class="card">
      <div class="card-header">Scorecard - select an indicator to chart it</div>
      <div class="card-body flush">
        <CorridorKpiScorecard :series="series" :loading="loading" selectable :active-key="activeKey" @select="select" />
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        {{ active ? active.indicator_name : 'Indicator trend' }}
        <span v-if="active?.segment" class="seg-chip">{{ active.segment }}</span>
      </div>
      <div class="card-body">
        <template v-if="active">
          <div class="active-fig">
            <span class="big">{{ fmtKpi(active.latest) }}</span><span class="unit">{{ active.unit }}</span>
            <BadgePill v-if="active.benchmark_value != null && tone !== 'neutral'" :variant="tone" size="sm">
              {{ tone === 'success' ? 'Meets target' : tone === 'warning' ? 'Near target' : 'Off target' }}
            </BadgePill>
          </div>
          <TrendLineChart :points="activePoints" :height="220" :format-value="fmtKpi" />
          <p v-if="active.benchmark_value != null" class="bench">
            Benchmark <b class="mono">{{ fmtKpi(active.benchmark_value) }} {{ active.unit }}</b>
            <template v-if="active.benchmark_source"> · {{ active.benchmark_source }}</template>
          </p>
          <p class="bench muted">{{ active.points.length }} months to {{ monthLabel(active.latest_period_end) }}</p>
        </template>
        <EmptyState v-else :loading="loading" message="No indicator selected." compact />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useCorridor, benchmarkTone, fmtKpi, monthLabel, type KpiSeries, type BorderPostStatus } from '~/composables/api'

const access = useAccessControl()
const canSee = access.canAccessRoute

const days = ref(30)
const series = ref<KpiSeries[]>([])
const posts = ref<BorderPostStatus[]>([])
const active = ref<KpiSeries | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const api = useCorridor()
  const [k, p] = await Promise.allSettled([api.kpiSeries({ corridor: 'NORTHERN', months: 12 }), api.borderPerformance(days.value)])
  if (k.status === 'fulfilled') {
    series.value = k.value
    // Keep the current selection across a refresh; otherwise lead with the first indicator.
    active.value = k.value.find(s => s.corridor === active.value?.corridor && s.indicator_code === active.value?.indicator_code && s.segment === active.value?.segment) ?? k.value[0] ?? null
  } else {
    error.value = 'Unable to reach the UAPTS Corridor API.'
  }
  if (p.status === 'fulfilled') posts.value = p.value.posts
  loading.value = false
}
onMounted(load)

const activeKey = computed(() => active.value ? `${active.value.corridor}|${active.value.indicator_code}|${active.value.segment}` : '')
const select = (s: KpiSeries) => { active.value = s }
const tone = computed(() => active.value ? benchmarkTone(active.value) : 'neutral')
const activePoints = computed(() => (active.value?.points ?? []).map(p => ({ label: monthLabel(p.period_end), value: p.value })))

const latestOf = (code: string) => series.value.find(s => s.indicator_code === code && !s.segment)
const transit = computed(() => latestOf('TRANSIT_TIME_MSA_KLA'))

// Port dwell (days) + border crossing (hours -> days). Road transit is whatever remains of the reported total.
const chain = computed(() => {
  const dwell = latestOf('PORT_DWELL_TIME')?.latest
  const border = latestOf('BORDER_CROSSING_TIME')
  const total = transit.value?.latest
  if (dwell == null || border == null || total == null) return { parts: [], total: 0 }
  const borderDays = border.unit === 'hours' ? border.latest / 24 : border.latest
  const road = Math.max(0, total - dwell - borderDays)
  const parts = [
    { key: 'dwell', label: 'Port dwell, Mombasa', days: dwell, color: 'var(--primary-fill)' },
    { key: 'road', label: 'Road transit (remainder)', days: road, color: 'var(--info)' },
    { key: 'border', label: 'Border crossing', days: borderDays, color: 'var(--warning)' },
  ].filter(p => p.days > 0)
  return { parts, total: dwell + road + borderDays }
})
const chainLabel = computed(() => chain.value.parts.map(p => `${p.label} ${p.days.toFixed(1)} days`).join(', '))

const segmentGood = computed(() => Object.fromEntries(
  series.value.filter(s => s.indicator_code === 'ROAD_IN_GOOD_CONDITION_PCT' && s.segment).map(s => [s.segment, s.latest]),
))
</script>

<style scoped>
.two-col { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; margin-bottom: 24px; align-items: start; }
@media (max-width: 1100px) { .two-col { grid-template-columns: 1fr; } }
.card-body.flush { padding: 0; }
.chain { display: flex; gap: 2px; height: 58px; }
.chain-seg { display: flex; flex-direction: column; justify-content: center; padding: 6px 12px; color: #fff; min-width: 90px; border-radius: 2px; }
.chain-v { font: 600 16px 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.chain-l { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .9; }
.chain-note { margin: 12px 0 0; font-size: 12.5px; color: var(--fg-2); }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; color: var(--fg-1); }
.seg-chip { margin-left: 8px; font-size: 10px; background: var(--surface-sunken); padding: 1px 6px; border-radius: 2px; text-transform: none; letter-spacing: 0; }
.active-fig { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
.big { font: 600 28px 'JetBrains Mono', ui-monospace, monospace; letter-spacing: -.01em; color: var(--fg-1); }
.unit { font-size: 12px; color: var(--fg-3); margin-right: 6px; }
.bench { margin: 8px 0 0; font-size: 12px; color: var(--fg-2); }
.bench.muted { color: var(--fg-3); }
</style>
