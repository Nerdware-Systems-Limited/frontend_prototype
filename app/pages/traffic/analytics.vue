<template>
  <PageHeader
    eyebrow="Traffic - Analytics"
    title="Traffic Analytics"
    subtitle="KeNHA · KURA · KMD - Volume trends, speed compliance, vehicle class breakdown, O-D matrix, and AI forecasts"
  >
    <template #actions>
      <DayRangeToggle v-model="days" :options="[1, 7, 30]" @update:model-value="load" />
      <!-- <button class="btn" :disabled="loading" @click="load">↻ Refresh</button> -->
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI ribbon from summary -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Volume"
      :value="summary ? fmtNum(summary.kpis.total_volume_24h) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KeNHA ATC feed unavailable'"
      period="24H"
      description="Vehicles counted (24h)"
      :series="volumeSeries"
      to="#volume-trend"
    />
    <KpiCard
      label="Avg Network Speed"
      :value="summary?.kpis.avg_speed_24h_kmh != null ? `${summary.kpis.avg_speed_24h_kmh.toFixed(0)} km/h` : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KeNHA ATC feed unavailable'"
      period="24H"
      description="24-hour average"
      :status="!summary?.kpis.avg_speed_24h_kmh ? undefined : summary.kpis.avg_speed_24h_kmh >= 40 ? 'healthy' : 'warning'"
      :series="speedSeries"
    />
    <KpiCard
      label="Speed Compliance"
      :value="summary ? `${summary.speed_compliance.avg_compliance_pct.toFixed(1)}%` : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KeNHA ATC feed unavailable'"
      period="24H"
      description="Within posted limit"
      :status="!summary ? undefined : summary.speed_compliance.avg_compliance_pct >= 80 ? 'healthy' : 'warning'"
      to="#speed-compliance-table"
    />
    <KpiCard
      label="Top O-D Pair"
      :value="topPairs[0] ? `${topPairs[0].trips} trips` : '-'"
      :unavailable="loading || odError"
      :unavailable-note="loading ? 'Loading…' : 'KeNHA OD Survey feed unavailable'"
      :period="`${days}D`"
      :description="topPairs[0] ? `${topPairs[0].origin_zone} → ${topPairs[0].destination_zone}` : ''"
      to="#od-pairs-table"
    />
    <KpiCard
      label="Forecasts Available"
      :value="fmtNum(forecasts.length)"
      :unavailable="loading || forecastError"
      :unavailable-note="loading ? 'Loading…' : 'AI model feed unavailable'"
      period="NEXT 24H"
      description="Predictive segments"
      to="#forecast-chart"
    />
    <KpiCard
      label="Speed Observations"
      :value="fmtNum(speedObs.length)"
      :unavailable="loading || speedError"
      :unavailable-note="loading ? 'Loading…' : 'KeNHA ATC feed unavailable'"
      period="LIVE"
      description="Stations reporting"
      to="#speed-compliance-table"
    />
  </div>

  <!-- Volume trend + vehicle class mix -->
  <div class="two-col">
    <div id="volume-trend" class="card drill-target">
      <div class="card-header">Volume Trend (24h)</div>
      <div class="card-body">
        <TrendLineChart
          :points="volumeChartPoints"
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
              <div class="class-bar" :style="{ transform: `scaleX(${c.share_pct / 100})`, background: classColor(c.vehicle_class) }" />
            </div>
            <div class="class-nums">
              <span style="font-size:12px;font-weight:600">{{ c.share_pct.toFixed(1) }}%</span>
              <span style="font-size:11px;color:var(--fg-3)">{{ fmtNum(c.total) }}</span>
            </div>
          </div>
        </div>
        <EmptyState v-else :loading="loading" message="No class data" compact />
      </div>
    </div>
  </div>

  <!-- 24h forecast chart -->
  <SectionTitle pill="AI Model · KeNHA">24-Hour Traffic Forecast</SectionTitle>

  <div id="forecast-chart" class="card drill-target">
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

  <div id="speed-compliance-table" class="card drill-target">
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
          <tr v-for="s in speedObsPageRows" :key="s.id">
            <td style="font-family:monospace;font-size:12px;font-weight:600">{{ s.station_code ?? s.station }}</td>
            <td>{{ s.avg_speed_kmh.toFixed(0) }}</td>
            <td>{{ s.p85_speed_kmh != null ? s.p85_speed_kmh.toFixed(0) : '-' }}</td>
            <td>{{ s.speed_limit_kmh }}</td>
            <td>
              <div class="comp-bar-wrap">
                <div
                  class="comp-bar"
                  :style="{ transform: `scaleX(${s.compliance_pct / 100})`, background: compColor(s.compliance_pct) }"
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
            <td colspan="7" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading…' : 'No speed observations available.' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="speedObsPage" :total-pages="speedObsTotalPages" :total="speedObsTotal"
        @prev="speedObsPrev" @next="speedObsNext"
      />
    </div>
  </div>

  <!-- Top O-D pairs -->
  <SectionTitle :pill="`KeNHA OD Survey · ${days}d`">Top Origin-Destination Pairs</SectionTitle>

  <div id="od-pairs-table" class="card drill-target">
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
          <tr v-for="(p, i) in topPairsPageRows" :key="i">
            <td style="font-weight:600">{{ p.origin_zone }}</td>
            <td>{{ p.destination_zone }}</td>
            <td style="font-weight:700">{{ fmtNum(p.trips) }}</td>
            <td>{{ p.avg_min != null ? `${p.avg_min.toFixed(0)} min` : '-' }}</td>
            <td>
              <div class="comp-bar-wrap">
                <div
                  class="comp-bar"
                  :style="{ transform: `scaleX(${maxTrips > 0 ? p.trips / maxTrips : 0})`, background: 'var(--primary-fill)' }"
                />
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="5" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading O-D data…' : 'No O-D pairs available.' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="topPairsPage" :total-pages="topPairsTotalPages" :total="topPairsTotal"
        @prev="topPairsPrev" @next="topPairsNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useTraffic } from '~/composables/api'
import type { TrafficSummary, TrafficForecast, SpeedObservation } from '~/composables/api'

const summary  = ref<TrafficSummary | null>(null)
const forecasts = ref<TrafficForecast[]>([])
const speedObs  = ref<SpeedObservation[]>([])
const classData = ref<{ vehicle_class: string; total: number; share_pct: number }[]>([])
const topPairs  = ref<{ origin_zone: string; destination_zone: string; trips: number; avg_min: number }[]>([])
const loading   = ref(true)
const error     = ref<string | null>(null)
const speedError = ref(false)
const odError    = ref(false)
const forecastError = ref(false)
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

  speedError.value    = speedRes.status === 'rejected'
  odError.value       = odRes.status    === 'rejected'
  forecastError.value = fcRes.status    === 'rejected'

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

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: speedObsPageRows, page: speedObsPage, totalPages: speedObsTotalPages,
  total: speedObsTotal, next: speedObsNext, prev: speedObsPrev,
} = usePagination(speedObs, 15)

const {
  pageRows: topPairsPageRows, page: topPairsPage, totalPages: topPairsTotalPages,
  total: topPairsTotal, next: topPairsNext, prev: topPairsPrev,
} = usePagination(topPairs, 15)

// ── Volume trend line chart ─────────────────────────────────────────────
const volumeChartPoints = computed(() =>
  (summary.value?.volume_24h ?? []).map(h => ({ label: fmtHour(h.hour), value: h.volume })),
)
const volumeSeries = computed(() => {
  const h = summary.value?.volume_24h ?? []
  return h.length > 1 ? h.map(x => x.volume) : undefined
})
const speedSeries = computed(() => {
  const h = summary.value?.volume_24h ?? []
  const vals = h.map(x => x.avg_speed).filter((v): v is number => v != null)
  return vals.length > 1 ? vals : undefined
})

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
// Forecast-model line colors on the 24h chart - validated as a categorical
// set (dataviz skill's validate_palette.js: CVD ΔE >= 8 adjacent, normal-vision
// >= 15, both light and dark against this app's actual surfaces). The
// previous set (blue/violet/amber/green) put arima and lstm at CVD ΔE 0.9 -
// effectively the same color under deuteranopia, the most common form of
// color blindness.
const theme = useTheme()
const MODEL_COLORS: Record<string, { light: string; dark: string }> = {
  arima:          { light: '#2a78d6', dark: '#3987e5' },
  lstm:           { light: '#eb6834', dark: '#d95926' },
  gradient_boost: { light: '#1baf7a', dark: '#199e70' },
  timesfm:        { light: '#eda100', dark: '#c98500' },
}
function modelColor(m: string) {
  const pair = MODEL_COLORS[m] ?? { light: '#64748b', dark: '#8B9AAD' }
  return theme.resolved.value === 'dark' ? pair.dark : pair.light
}
function compColor(pct: number) {
  return pct >= 85 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--destructive)'
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.class-list { display:flex; flex-direction:column; gap:8px; }
.class-row { display:grid; grid-template-columns:110px 1fr 80px; align-items:center; gap:8px; }
.class-label { font-size:12px; text-transform:capitalize; }
.class-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.class-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
.class-nums { display:flex; flex-direction:column; align-items:flex-end; }
.comp-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.comp-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
</style>
