<template>
  <PageHeader
    eyebrow="Maritime - Port Performance"
    title="Port Performance KPIs & Ranking"
    subtitle="UNCTAD · IAPH · World Bank LPI - International-standard port KPIs and a composite ranking of Kenyan ports against each other and regional East African peers"
  >
    <template #actions>
      <NuxtLink to="/maritime/port-ops" class="btn">Port Operations →</NuxtLink>
      <NuxtLink to="/maritime/green-transport" class="btn">Green Transport →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">
    ⚠ {{ error }}
  </div>

  <!-- Live-derived KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Avg Vessel Turnaround" :value="avgVesselTurnaround != null ? `${avgVesselTurnaround.toFixed(1)}h` : '-'" sub="Target: <72h" :trend-direction="avgVesselTurnaround != null && avgVesselTurnaround <= 72 ? 'up' : 'down'" source="live" source-title="KPA" />
    <KpiCard label="Total TEU" :value="fmtNum(totalTEU)" :sub="`All ports, last ${summary?.days ?? 30}d`" trend-direction="up" source="live" source-title="KPA" />
    <KpiCard label="Avg BCH" :value="avgBch != null ? avgBch.toFixed(1) : '-'" sub="Target: ≥25 (world class >30)" :trend-direction="avgBch != null && avgBch >= 25 ? 'up' : 'down'" source="live" source-title="Crane Monitoring" />
    <KpiCard label="Avg Berth Occupancy" :value="pct(avgOccupancy)" sub="Optimal: 70-80%" source="live" source-title="Berth Allocation" />
    <KpiCard label="Avg Ship Waiting" :value="avgWaiting != null ? `${avgWaiting.toFixed(1)}h` : '-'" sub="UNCTAD threshold: <24h" :trend-direction="avgWaiting != null && avgWaiting <= 24 ? 'up' : 'down'" source="live" source-title="Vessel Traffic" />
    <KpiCard label="Avg Truck Turnaround" :value="avgTruckTurnaround != null ? `${avgTruckTurnaround.toFixed(0)} min` : '-'" sub="Target: <60 min" :trend-direction="avgTruckTurnaround != null && avgTruckTurnaround <= 60 ? 'up' : 'down'" source="live" source-title="Port Gate System" />
  </div>

  <!-- Core KPI table (9.1) -->
  <SectionTitle pill="UNCTAD / IAPH / World Bank · Live">Core Port Performance KPIs</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>KPI</th><th>Target / Benchmark</th><th v-for="p in kpis" :key="p.port">{{ p.port_name }}</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight:600;font-size:12px">Vessel Turnaround</td>
              <td style="font-size:11px">Container: &lt;72 hrs</td>
              <td v-for="p in kpis" :key="p.port">{{ trackedVal(p.vessel_turnaround_hours, v => `${v.toFixed(1)}h`) }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Berth Occupancy Rate</td>
              <td style="font-size:11px">70-80% optimal (&gt;85% congestion risk)</td>
              <td v-for="p in kpis" :key="p.port">{{ trackedVal(p.berth_occupancy_pct, v => `${v.toFixed(0)}%`) }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Box Moves / Crane / Hour (BCH)</td>
              <td style="font-size:11px">≥25 BCH (world class &gt;30)</td>
              <td v-for="p in kpis" :key="p.port">{{ trackedVal(p.bch, v => v.toFixed(1)) }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Cargo Dwell Time</td>
              <td style="font-size:11px">Target: &lt;5 days</td>
              <td v-for="p in kpis" :key="p.port">{{ trackedVal(p.cargo_dwell_days, v => `${v.toFixed(1)}d`) }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Ship Waiting Time (schedule variance)</td>
              <td style="font-size:11px">&lt;24 hours (UNCTAD)</td>
              <td v-for="p in kpis" :key="p.port">{{ trackedVal(p.waiting_time_hours, v => `${v.toFixed(1)}h`) }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Throughput (TEU)</td>
              <td style="font-size:11px">vs regional peers (Dar, Durban, Djibouti)</td>
              <td v-for="p in kpis" :key="p.port">{{ trackedVal(p.teu_throughput, v => fmtNum(v)) }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Revenue per TEU</td>
              <td style="font-size:11px">Monitor trend</td>
              <td v-for="p in kpis" :key="p.port">{{ trackedVal(p.revenue_per_teu_kes, v => `KES ${fmtNum(v)}`) }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Truck Turnaround (gate-to-gate)</td>
              <td style="font-size:11px">&lt;60 minutes</td>
              <td v-for="p in kpis" :key="p.port">{{ trackedVal(p.truck_turnaround_minutes, v => `${v.toFixed(0)} min`) }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Reefer Plug Utilisation</td>
              <td style="font-size:11px">Tracked for capacity planning</td>
              <td v-for="p in kpis" :key="p.port">{{ trackedVal(p.reefer_plug_utilization_pct, v => `${v.toFixed(0)}%`) }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Train Departure Frequency</td>
              <td style="font-size:11px">≥3 trains/day (SGR)</td>
              <td v-for="p in kpis" :key="p.port">{{ trackedVal(p.train_departures_per_day, v => `${v.toFixed(1)}/day`) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="source-note">Reefer plug utilisation and train departure frequency aren't tracked on this backend - no reefer plug telemetry or rail-port interface data is modeled yet.</div>
    </div>
  </div>

  <!-- Port ranking (9.2) -->
  <SectionTitle pill="Composite Score · 30% Vessel Eff. · 25% Cargo Speed · 25% Turnaround · 10% Revenue · 10% Safety">Port Ranking</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div v-if="ranking.length" class="table-scroll">
        <table>
          <thead><tr><th>Rank</th><th>Port</th><th>Vessel Eff. (30%)</th><th>Cargo Speed (25%)</th><th>Turnaround (25%)</th><th>Revenue (10%)</th><th>Safety (10%)</th><th>Composite</th></tr></thead>
          <tbody>
            <tr v-for="r in ranking" :key="r.port">
              <td style="font-weight:800">#{{ r.rank }}</td>
              <td style="font-weight:600;font-size:12px">{{ r.port_name }}</td>
              <td>{{ categoryVal(r, 'vessel_efficiency') }}</td>
              <td>{{ categoryVal(r, 'cargo_handling_speed') }}</td>
              <td>{{ categoryVal(r, 'turnaround_dwell') }}</td>
              <td>{{ categoryVal(r, 'revenue_throughput') }}</td>
              <td>{{ categoryVal(r, 'safety_environmental') }}</td>
              <td>
                <div class="score-bar-wrap">
                  <div class="score-bar" :style="{ width: `${r.composite_score}%`, background: r.composite_score >= 70 ? '#22c55e' : r.composite_score >= 50 ? '#f59e0b' : '#ef4444' }" />
                </div>
                <span style="font-weight:700;font-size:12px">{{ r.composite_score.toFixed(1) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="ranking.some(r => r.missing_categories.length)" class="source-note">Dashes mark categories excluded for a port due to missing data - its composite score is renormalized over the remaining weighted categories rather than penalized to zero.</div>
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No ports have comparable ranking data for this period.' }}</div>
    </div>
  </div>

  <!-- Ranking weights reference -->
  <SectionTitle>Rank Category Weights</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead><tr><th>Rank Category</th><th>Weight</th><th>Benchmark Source</th></tr></thead>
        <tbody>
          <tr><td>Vessel Efficiency</td><td style="font-weight:700">{{ pct(RANK_WEIGHTS.vessel_efficiency * 100) }}</td><td style="font-size:12px">UNCTAD Port Performance Scorecard</td></tr>
          <tr><td>Cargo Handling Speed</td><td style="font-weight:700">{{ pct(RANK_WEIGHTS.cargo_handling_speed * 100) }}</td><td style="font-size:12px">IAPH (International Association of Ports and Harbors)</td></tr>
          <tr><td>Turnaround and Dwell Time</td><td style="font-weight:700">{{ pct(RANK_WEIGHTS.turnaround_dwell * 100) }}</td><td style="font-size:12px">World Bank Port Efficiency Index</td></tr>
          <tr><td>Revenue and Throughput</td><td style="font-weight:700">{{ pct(RANK_WEIGHTS.revenue_throughput * 100) }}</td><td style="font-size:12px">KPA internal benchmarks</td></tr>
          <tr><td>Safety and Environmental</td><td style="font-weight:700">{{ pct(RANK_WEIGHTS.safety_environmental * 100) }}</td><td style="font-size:12px">IMO / MARPOL compliance records</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Port Performance KPIs & Ranking')

import { useMaritimePerformance, RANK_WEIGHTS } from '~/composables/api'
import type { MaritimePerformanceSummary, PortPerformanceKpi, PortRankingScore, TrackedKpiField, RankingCategory } from '~/composables/api'

const summary  = ref<MaritimePerformanceSummary | null>(null)
const kpis     = ref<PortPerformanceKpi[]>([])
const ranking  = ref<PortRankingScore[]>([])
const loading  = ref(true)
const error    = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const perf = useMaritimePerformance()

  const [sumRes, kpiRes, rankRes] = await Promise.allSettled([
    perf.summary(),
    perf.kpis({}),
    perf.ranking(),
  ])

  if (sumRes.status  === 'fulfilled') summary.value = sumRes.value
  if (kpiRes.status  === 'fulfilled') kpis.value = kpiRes.value.ports ?? []
  if (rankRes.status === 'fulfilled') ranking.value = rankRes.value.rankings ?? []

  if ([sumRes, kpiRes, rankRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime Performance API.'

  loading.value = false
}

onMounted(load)

function avgTracked<T>(rows: T[], pick: (row: T) => number | null | undefined): number | null {
  const vals = rows.map(pick).filter((v): v is number => v != null)
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
}

const totalTEU = computed(() => summary.value?.ports.reduce((s, p) => s + p.teu_throughput, 0) ?? 0)
const avgVesselTurnaround = computed(() => avgTracked(summary.value?.ports ?? [], p => p.avg_turnaround_hours))
const avgBch = computed(() => avgTracked(summary.value?.ports ?? [], p => p.bch))
const avgOccupancy = computed(() => avgTracked(summary.value?.ports ?? [], p => p.berth_occupancy_pct))
const avgWaiting = computed(() => avgTracked(kpis.value, p => p.waiting_time_hours.value))
const avgTruckTurnaround = computed(() => avgTracked(kpis.value, p => p.truck_turnaround_minutes.value))

function trackedVal(field: TrackedKpiField, fmt: (v: number) => string): string {
  return field.tracked && field.value != null ? fmt(field.value) : '-'
}
function categoryVal(r: PortRankingScore, cat: RankingCategory): string {
  const v = r.category_scores[cat]
  return v != null ? v.toFixed(0) : '-'
}
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function pct(v: number | null | undefined) { return v == null ? '-' : `${v.toFixed(1)}%` }
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(165px,1fr)); gap:12px; margin-bottom:16px; }
.table-scroll { overflow-x:auto; }
.source-note { margin-top:10px; font-size:11px; color:#94a3b8; border-top:1px solid #f1f5f9; padding-top:10px; }
.score-bar-wrap { display:inline-block; width:60px; background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-right:6px; vertical-align:middle; }
.score-bar { height:100%; border-radius:4px; transition:width .4s; }
</style>
