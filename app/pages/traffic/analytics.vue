<template>
  <PageHeader
    eyebrow="Traffic - Analytics"
    title="Traffic Analytics"
    subtitle="KeNHA · KURA · KMD - Volume trends, speed compliance, vehicle class breakdown, O-D matrix, and AI forecasts"
  >
    <template #actions>
      
      <div class="day-filter">
        <button
          v-for="d in [1, 7, 30]"
          :key="d"
          class="btn"
          :class="{ 'btn-active': days === d }"
          @click="days = d; load()"
        >{{ d }}d</button>
      </div>
      <!-- <button class="btn" :disabled="loading" @click="load">↻ Refresh</button> -->
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI ribbon from summary -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Volume"
      :value="summary ? fmtNum(summary.kpis.total_volume_24h) : '-'"
      sub="Vehicles counted (24h)"
      source="live" source-title="KeNHA ATC"
    />
    <KpiCard
      label="Avg Network Speed"
      :value="summary?.kpis.avg_speed_24h_kmh != null ? `${summary.kpis.avg_speed_24h_kmh.toFixed(0)} km/h` : '-'"
      sub="24-hour average"
      source="live" source-title="KeNHA ATC"
    />
    <KpiCard
      label="Speed Compliance"
      :value="summary ? `${summary.speed_compliance.avg_compliance_pct.toFixed(1)}%` : '-'"
      sub="Within posted limit"
      :trend-direction="summary && summary.speed_compliance.avg_compliance_pct >= 80 ? 'up' : 'down'"
      source="live" source-title="KeNHA ATC"
    />
    <KpiCard
      label="Top O-D Pair"
      :value="topPairs[0] ? `${topPairs[0].trips} trips` : '-'"
      :sub="topPairs[0] ? `${topPairs[0].origin_zone} → ${topPairs[0].destination_zone}` : '-'"
      source="batch" source-title="KeNHA OD Survey"
    />
    <KpiCard
      label="Forecasts Available"
      :value="fmtNum(forecasts.length)"
      sub="Predictive segments"
      source="batch" source-title="AI Model"
    />
    <KpiCard
      label="Speed Observations"
      :value="fmtNum(speedObs.length)"
      sub="Stations reporting"
      source="live" source-title="KeNHA ATC"
    />
  </div>

  <!-- Volume trend + vehicle class mix -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">Volume Trend (24h)</div>
      <div class="card-body">
        <TrendLineChart
          :points="volumeChartPoints"
          color="#3b82f6"
          :height="180"
          :format-value="v => fmtNum(v)"
          :empty-text="loading ? 'Loading…' : 'No volume data'"
        />
      </div>
    </div>

    <div class="card">
      <div class="card-header">Vehicle Class Mix ({{ days }}d)</div>
      <div class="card-body">
        <div v-if="classData.length" class="class-list">
          <div v-for="c in classData" :key="c.vehicle_class" class="class-row">
            <span class="class-label">{{ c.vehicle_class.replace(/_/g,' ') }}</span>
            <div class="class-bar-wrap">
              <div class="class-bar" :style="{ width: `${c.share_pct}%`, background: classColor(c.vehicle_class) }" />
            </div>
            <div class="class-nums">
              <span style="font-size:12px;font-weight:600">{{ c.share_pct.toFixed(1) }}%</span>
              <span style="font-size:11px;color:#94a3b8">{{ fmtNum(c.total) }}</span>
            </div>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No class data' }}</div>
      </div>
    </div>
  </div>

  <!-- 24h forecast chart -->
  <SectionTitle pill="AI Model · KeNHA">24-Hour Traffic Forecast</SectionTitle>

  <div class="card">
    <div class="card-body">
      <MultiLineChart
        :series="forecastSeries"
        :height="200"
        :format-value="v => fmtNum(v)"
        :empty-text="loading ? 'Loading forecast…' : 'No forecast data available.'"
      />
    </div>
  </div>

  <!-- Speed compliance per station -->
  <SectionTitle :pill="sourceLabel('kenha_traffic')">Speed Compliance by Station</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Station</th>
            <th>Avg Speed (km/h)</th>
            <th>P85 Speed (km/h)</th>
            <th>Speed Limit (km/h)</th>
            <th>Compliance</th>
            <th>Samples</th>
            <th>Recorded</th>
          </tr>
        </thead>
        <tbody v-if="speedObs.length">
          <tr v-for="s in speedObs" :key="s.id">
            <td style="font-family:monospace;font-size:12px;font-weight:600">{{ s.station_code ?? s.station }}</td>
            <td>{{ s.avg_speed_kmh.toFixed(0) }}</td>
            <td>{{ s.p85_speed_kmh != null ? s.p85_speed_kmh.toFixed(0) : '-' }}</td>
            <td>{{ s.speed_limit_kmh }}</td>
            <td>
              <div class="comp-bar-wrap">
                <div
                  class="comp-bar"
                  :style="{ width: `${s.compliance_pct}%`, background: compColor(s.compliance_pct) }"
                />
              </div>
              <span style="font-size:11px">{{ s.compliance_pct.toFixed(1) }}%</span>
            </td>
            <td>{{ fmtNum(s.sample_count) }}</td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtTime(s.recorded_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading…' : 'No speed observations available.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Top O-D pairs -->
  <SectionTitle :pill="`KeNHA OD Survey · ${days}d`">Top Origin-Destination Pairs</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Origin Zone</th>
            <th>Destination Zone</th>
            <th>Trips</th>
            <th>Avg Travel Time (min)</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody v-if="topPairs.length">
          <tr v-for="(p, i) in topPairs" :key="i">
            <td style="font-weight:600">{{ p.origin_zone }}</td>
            <td>{{ p.destination_zone }}</td>
            <td style="font-weight:700">{{ fmtNum(p.trips) }}</td>
            <td>{{ p.avg_min != null ? `${p.avg_min.toFixed(0)} min` : '-' }}</td>
            <td>
              <div class="comp-bar-wrap">
                <div
                  class="comp-bar"
                  style="background:#3b82f6"
                  :style="{ width: `${maxTrips > 0 ? (p.trips / maxTrips) * 100 : 0}%` }"
                />
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading O-D data…' : 'No O-D pairs available.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Traffic Analytics')

import { useTraffic } from '~/composables/api'
import type { TrafficSummary, TrafficForecast, SpeedObservation } from '~/composables/api'

const summary  = ref<TrafficSummary | null>(null)
const forecasts = ref<TrafficForecast[]>([])
const speedObs  = ref<SpeedObservation[]>([])
const classData = ref<{ vehicle_class: string; total: number; share_pct: number }[]>([])
const topPairs  = ref<{ origin_zone: string; destination_zone: string; trips: number; avg_min: number }[]>([])
const loading   = ref(true)
const error     = ref<string | null>(null)
const lastRefreshed = ref('-')
const days = ref(7)

const { sourceLabel } = useDataSources()

async function load() {
  loading.value = true
  error.value = null
  const traffic = useTraffic()

  const [sumRes, fcRes, speedRes, classRes, odRes] = await Promise.allSettled([
    traffic.summary(),
    traffic.forecasts({ page_size: 48 }),
    traffic.speedObservations({ page_size: 30 }),
    traffic.classShare(days.value),
    traffic.topOdPairs(days.value),
  ])

  if (sumRes.status   === 'fulfilled') {
    summary.value   = sumRes.value
    classData.value = sumRes.value.class_breakdown ?? []
  }
  if (fcRes.status    === 'fulfilled') forecasts.value = (fcRes.value as any).results ?? []
  if (speedRes.status === 'fulfilled') speedObs.value  = (speedRes.value as any).results ?? []
  if (classRes.status === 'fulfilled' && !classData.value.length)
    classData.value = (classRes.value as any).results ?? []
  if (odRes.status    === 'fulfilled') topPairs.value  = (odRes.value as any).results ?? []

  if ([sumRes, fcRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Traffic API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const maxTrips = computed(() => Math.max(1, ...topPairs.value.map(p => p.trips)))

// ── Volume trend line chart ─────────────────────────────────────────────
const volumeChartPoints = computed(() =>
  (summary.value?.volume_24h ?? []).map(h => ({ label: fmtHour(h.hour), value: h.volume })),
)

// ── Forecast multi-line chart (one line per model) ──────────────────────
const forecastModels = computed(() =>
  [...new Set(forecasts.value.map(f => f.model_name))],
)
const forecastSeries = computed(() => forecastModels.value.map(m => ({
  name: m,
  color: modelColor(m),
  points: forecasts.value
    .filter(f => f.model_name === m)
    .sort((a, b) => a.target_at.localeCompare(b.target_at))
    .map(f => ({ label: fmtHour(f.target_at), value: f.predicted_volume })),
})))

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function fmtHour(iso: string | undefined) {
  if (!iso) return ''
  try { return new Date(iso).getHours().toString().padStart(2, '0') + ':00' } catch { return iso }
}
function classColor(cls: string) {
  const m: Record<string,string> = { car:'#3b82f6', motorcycle:'#a855f7', light_truck:'#f59e0b', heavy_truck:'#ef4444', bus:'#22c55e', other:'#94a3b8' }
  return m[cls] ?? '#64748b'
}
function modelColor(m: string) {
  const c: Record<string,string> = { arima:'#3b82f6', prophet:'#22c55e', lstm:'#a855f7', gradient_boost:'#f59e0b' }
  return c[m] ?? '#64748b'
}
function compColor(pct: number) {
  return pct >= 85 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.day-filter { display:flex; gap:4px; }
.btn-active { background:#3b82f6; color:#fff; border-color:#3b82f6; }
.class-list { display:flex; flex-direction:column; gap:8px; }
.class-row { display:grid; grid-template-columns:110px 1fr 80px; align-items:center; gap:8px; }
.class-label { font-size:12px; text-transform:capitalize; }
.class-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.class-bar { height:100%; border-radius:4px; transition:width .4s; }
.class-nums { display:flex; flex-direction:column; align-items:flex-end; }
.comp-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.comp-bar { height:100%; border-radius:4px; transition:width .4s; }
</style>
