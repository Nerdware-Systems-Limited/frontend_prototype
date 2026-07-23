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
    ⚠ {{ error }} Some benchmark fields (BCH, ship waiting time, truck turnaround, reefer plug utilisation, train frequency, revenue/TEU) are not yet integrated - vessel turnaround, TEU throughput, and dwell time below are live.
  </div>

  <!-- Live-derived KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Avg Vessel Dwell" :value="avgDwell != null ? `${avgDwell.toFixed(1)}d` : '-'" sub="UNCTAD target: <3 days" :trend-direction="avgDwell != null && avgDwell <= 3 ? 'up' : 'down'" source="live" source-title="KPA" />
    <KpiCard label="Total TEU (30d)" :value="fmtNum(totalTEU)" sub="All ports" trend-direction="up" source="live" source-title="KPA" />
    <KpiCard label="Avg BCH" :value="perfSummary ? perfSummary.kpis.avg_bch.toFixed(1) : '-'" sub="Target: ≥25 (world class >30)" :trend-direction="perfSummary && perfSummary.kpis.avg_bch >= 25 ? 'up' : 'down'" source="batch" source-title="Crane Monitoring" />
    <KpiCard label="Avg Berth Occupancy" :value="perfSummary ? pct(perfSummary.kpis.avg_berth_occupancy_pct) : '-'" sub="Optimal: 70-80%" source="batch" source-title="Berth Allocation" />
    <KpiCard label="Avg Ship Waiting" :value="perfSummary ? `${perfSummary.kpis.avg_ship_waiting_hrs.toFixed(1)}h` : '-'" sub="UNCTAD threshold: <24h" :trend-direction="perfSummary && perfSummary.kpis.avg_ship_waiting_hrs <= 24 ? 'up' : 'down'" source="batch" source-title="Vessel Traffic" />
    <KpiCard label="Avg Truck Turnaround" :value="perfSummary ? `${perfSummary.kpis.avg_truck_turnaround_min.toFixed(0)} min` : '-'" sub="Target: <60 min" :trend-direction="perfSummary && perfSummary.kpis.avg_truck_turnaround_min <= 60 ? 'up' : 'down'" source="batch" source-title="Port Gate System" />
  </div>

  <!-- Core KPI table (9.1) -->
  <SectionTitle pill="UNCTAD / IAPH / World Bank">Core Port Performance KPIs</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>KPI</th><th>Target / Benchmark</th><th v-for="p in ports" :key="p.port_unlocode">{{ p.port_name }}</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight:600;font-size:12px">Vessel Turnaround / Dwell</td>
              <td style="font-size:11px">Container: &lt;72 hrs</td>
              <td v-for="p in ports" :key="p.port_unlocode" :style="{ color: p.avg_yard_dwell_days > 3 ? '#f59e0b' : '#22c55e', fontWeight:'600' }">{{ p.avg_yard_dwell_days.toFixed(1) }}d</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Throughput (TEU, 30d)</td>
              <td style="font-size:11px">vs regional peers (Dar, Durban, Djibouti)</td>
              <td v-for="p in ports" :key="p.port_unlocode">{{ fmtNum(p.teu_throughput_30d) }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Box Moves / Crane / Hour (BCH)</td>
              <td style="font-size:11px">≥25 BCH (world class &gt;30)</td>
              <td v-for="p in ports" :key="p.port_unlocode">{{ kpiFor(p.port_unlocode)?.bch_moves_per_crane_hour?.toFixed(1) ?? '-' }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Berth Occupancy Rate</td>
              <td style="font-size:11px">70-80% optimal (&gt;85% congestion risk)</td>
              <td v-for="p in ports" :key="p.port_unlocode">{{ kpiFor(p.port_unlocode)?.berth_occupancy_rate_pct != null ? `${kpiFor(p.port_unlocode)!.berth_occupancy_rate_pct!.toFixed(0)}%` : '-' }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Ship Waiting Time (Anchorage)</td>
              <td style="font-size:11px">&lt;24 hours (UNCTAD)</td>
              <td v-for="p in ports" :key="p.port_unlocode">{{ kpiFor(p.port_unlocode)?.ship_waiting_time_hrs?.toFixed(1) ?? '-' }}h</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Truck Turnaround (gate-to-gate)</td>
              <td style="font-size:11px">&lt;60 minutes</td>
              <td v-for="p in ports" :key="p.port_unlocode">{{ kpiFor(p.port_unlocode)?.truck_turnaround_min?.toFixed(0) ?? '-' }} min</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Reefer Plug Utilisation</td>
              <td style="font-size:11px">Tracked for capacity planning</td>
              <td v-for="p in ports" :key="p.port_unlocode">{{ kpiFor(p.port_unlocode)?.reefer_plug_utilisation_pct != null ? `${kpiFor(p.port_unlocode)!.reefer_plug_utilisation_pct!.toFixed(0)}%` : '-' }}</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Train Departure Frequency</td>
              <td style="font-size:11px">≥3 trains/day (SGR)</td>
              <td v-for="p in ports" :key="p.port_unlocode">{{ kpiFor(p.port_unlocode)?.train_departures_per_day?.toFixed(1) ?? '-' }}/day</td>
            </tr>
            <tr>
              <td style="font-weight:600;font-size:12px">Revenue per TEU</td>
              <td style="font-size:11px">Monitor trend</td>
              <td v-for="p in ports" :key="p.port_unlocode">{{ kpiFor(p.port_unlocode)?.revenue_per_teu_kes != null ? `KES ${fmtNum(kpiFor(p.port_unlocode)!.revenue_per_teu_kes!)}` : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!kpis.length" class="source-note">Detailed benchmark fields (BCH, berth occupancy, waiting time, truck turnaround, reefer utilisation, train frequency, revenue/TEU) have not been integrated from the backend yet — dashes shown above.</div>
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
            <tr v-for="(r, i) in sortedRanking" :key="r.port_unlocode">
              <td style="font-weight:800">#{{ i + 1 }}</td>
              <td style="font-weight:600;font-size:12px">{{ r.port_name }}</td>
              <td>{{ r.vessel_efficiency_score.toFixed(0) }}</td>
              <td>{{ r.cargo_handling_score.toFixed(0) }}</td>
              <td>{{ r.turnaround_dwell_score.toFixed(0) }}</td>
              <td>{{ r.revenue_throughput_score.toFixed(0) }}</td>
              <td>{{ r.safety_environmental_score.toFixed(0) }}</td>
              <td>
                <div class="score-bar-wrap">
                  <div class="score-bar" :style="{ width: `${r.composite_score}%`, background: r.composite_score >= 70 ? '#22c55e' : r.composite_score >= 50 ? '#f59e0b' : '#ef4444' }" />
                </div>
                <span style="font-weight:700;font-size:12px">{{ r.composite_score.toFixed(1) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'Port ranking has not been integrated from the backend yet.' }}</div>
    </div>
  </div>

  <!-- Ranking weights reference -->
  <SectionTitle>Rank Category Weights</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead><tr><th>Rank Category</th><th>Weight</th><th>Benchmark Source</th></tr></thead>
        <tbody>
          <tr><td>Vessel Efficiency</td><td style="font-weight:700">30%</td><td style="font-size:12px">UNCTAD Port Performance Scorecard</td></tr>
          <tr><td>Cargo Handling Speed</td><td style="font-weight:700">25%</td><td style="font-size:12px">IAPH (International Association of Ports and Harbors)</td></tr>
          <tr><td>Turnaround and Dwell Time</td><td style="font-weight:700">25%</td><td style="font-size:12px">World Bank Port Efficiency Index</td></tr>
          <tr><td>Revenue and Throughput</td><td style="font-weight:700">10%</td><td style="font-size:12px">KPA internal benchmarks</td></tr>
          <tr><td>Safety and Environmental</td><td style="font-weight:700">10%</td><td style="font-size:12px">IMO / MARPOL compliance records</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Port Performance KPIs & Ranking')

import { useAviationMaritime, useMaritimePerformance } from '~/composables/api'
import type { MaritimeOps, PortOps, MaritimePerformanceSummary, PortPerformanceKpi, PortRankingScore } from '~/composables/api'

const ops         = ref<MaritimeOps | null>(null)
const perfSummary = ref<MaritimePerformanceSummary | null>(null)
const kpis        = ref<PortPerformanceKpi[]>([])
const ranking     = ref<PortRankingScore[]>([])
const loading     = ref(true)
const error       = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const avm  = useAviationMaritime()
  const perf = useMaritimePerformance()

  const [opRes, sumRes, kpiRes, rankRes] = await Promise.allSettled([
    avm.maritimeOperations(30),
    perf.summary(),
    perf.kpis({}),
    perf.ranking(),
  ])

  if (opRes.status   === 'fulfilled') ops.value = opRes.value
  if (sumRes.status  === 'fulfilled') perfSummary.value = sumRes.value
  if (kpiRes.status  === 'fulfilled') kpis.value = (kpiRes.value as any).results ?? []
  if (rankRes.status === 'fulfilled') ranking.value = (rankRes.value as any).results ?? []

  if (opRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Maritime API.'

  loading.value = false
}

onMounted(load)

const ports = computed((): PortOps[] => ops.value?.ports ?? [])
const totalTEU = computed(() => ports.value.reduce((s, p) => s + p.teu_throughput_30d, 0))
const avgDwell = computed(() => ports.value.length ? ports.value.reduce((s, p) => s + p.avg_yard_dwell_days, 0) / ports.value.length : null)
const sortedRanking = computed(() => [...ranking.value].sort((a, b) => b.composite_score - a.composite_score))

function kpiFor(unlocode: string) {
  return kpis.value.find(k => k.port_unlocode === unlocode)
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
