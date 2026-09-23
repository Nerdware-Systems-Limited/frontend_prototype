<template>
  <PageHeader
    eyebrow="Road Traffic Management"
    title="Live Traffic Overview"
    subtitle="KeNHA · KURA · KMD - Real-time flow, congestion events, speed compliance, KMD weather impact, and NCTTCA corridor alerts"
  >
    <template #actions>
      
      <!-- <button class="btn" :disabled="loading" @click="load">↻ Refresh</button> -->
      <NuxtLink to="/traffic/alerts" class="btn-primary">Alerts →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI ribbon -->
  <SectionTitle :pill="summary ? 'KeNHA ATC / RTMS · ' + freshnessLabel(summary.generated_at) : ''">
    Traffic KPIs
  </SectionTitle>

  <div class="kpi-grid">
    <KpiCard
      label="Active Stations"
      :value="summary ? `${fmtNum(summary.kpis.active_stations)} / ${fmtNum(summary.kpis.total_stations)}` : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KeNHA ATC feed unavailable'"
      period="LIVE"
      description="ATC · WIM · Video counting"
      :status="!summary ? undefined : summary.kpis.active_stations >= summary.kpis.total_stations ? 'healthy' : 'warning'"
    />
    <KpiCard
      label="Active Congestion"
      :value="summary ? fmtNum(summary.kpis.active_congestion_events) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KeNHA RTMS feed unavailable'"
      period="LIVE"
      description="Live events on network"
      to="#congestion-events"
    />
    <KpiCard
      label="Avg Speed (24h)"
      :value="summary?.kpis.avg_speed_24h_kmh != null ? `${summary.kpis.avg_speed_24h_kmh.toFixed(0)} km/h` : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KeNHA ATC feed unavailable'"
      period="24H"
      description="Network average"
      :status="!summary?.kpis.avg_speed_24h_kmh ? undefined : summary.kpis.avg_speed_24h_kmh >= 40 ? 'healthy' : 'warning'"
      :series="speedSeries"
    />
    <KpiCard
      label="Total Volume (24h)"
      :value="summary ? fmtNum(summary.kpis.total_volume_24h) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KeNHA ATC feed unavailable'"
      period="24H"
      description="Vehicles counted"
      :series="volumeSeries"
      to="#volume-trend"
    />
    <KpiCard
      label="Speed Compliance"
      :value="summary ? `${summary.speed_compliance.avg_compliance_pct.toFixed(1)}%` : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KeNHA ATC feed unavailable'"
      :description="summary ? `${fmtNum(summary.speed_compliance.observation_count)} observations` : ''"
      :status="!summary ? undefined : summary.speed_compliance.avg_compliance_pct >= 80 ? 'healthy' : 'warning'"
    />
    <KpiCard
      label="Segments Observed"
      :value="summary ? fmtNum(summary.kpis.total_segments_observed) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KeNHA RTMS feed unavailable'"
      period="LIVE"
      description="Road segments with data"
    />
  </div>

  <!-- Map + congestion distribution -->
  <div class="two-col-map">
    <div class="card map-card">
      <div class="card-header">Live Traffic Map</div>
      <ClientOnly>
        <UaptsMap
          :markers="mapMarkers"
          :roads="roadsGeo"
          :center="[-1.286, 36.817]"
          :zoom="10"
          height="500px"
          show-legend
          show-map-toolbar
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#22c55e" /> Station operational</span>
        <span class="mk"><span class="dot" style="background:#eab308" /> Station degraded</span>
        <span class="mk"><span class="dot" style="background:#94a3b8" /> Station offline</span>
      </div>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#10b981" /> Free flow</span>
        <span class="mk"><span class="dot" style="background:#eab308" /> Moderate</span>
        <span class="mk"><span class="dot" style="background:#f97316" /> Heavy</span>
        <span class="mk"><span class="dot" style="background:#ef4444" /> Severe</span>
      </div>
      <p class="map-key-note">Congestion events (large dots) are colored by live speed vs. free-flow speed; the shaded circle around one is its reported impact radius.</p>
    </div>

    <div class="right-col">
      <!-- Congestion distribution -->
      <div class="card">
        <div class="card-header">Congestion Distribution</div>
        <div class="card-body">
          <div v-if="congestionEntries.length" class="cong-list">
            <div v-for="[level, count] in congestionEntries" :key="level" class="cong-row">
              <span class="cong-label">{{ level.replace(/_/g,' ') }}</span>
              <div class="cong-bar-wrap">
                <div class="cong-bar" :style="{ transform: `scaleX(${congPct(count) / 100})`, background: congColor(level) }" />
              </div>
              <span class="cong-val">{{ fmtNum(count) }}</span>
            </div>
          </div>
          <EmptyState v-else :loading="loading" message="No congestion data for this window" compact />
        </div>
      </div>

      <!-- Vehicle class breakdown -->
      <div class="card" style="margin-top:12px">
        <div class="card-header">Vehicle Class Mix (7d)</div>
        <div class="card-body">
          <div v-if="classShare.length" class="cong-list">
            <div v-for="c in classShare" :key="c.vehicle_class" class="cong-row">
              <span class="cong-label">{{ c.vehicle_class.replace(/_/g,' ') }}</span>
              <div class="cong-bar-wrap">
                <div class="cong-bar" :style="{ transform: `scaleX(${c.share_pct / 100})`, background: classColor(c.vehicle_class) }" />
              </div>
              <span class="cong-val">{{ c.share_pct.toFixed(1) }}%</span>
            </div>
          </div>
          <EmptyState v-else :loading="loading" message="No class data" compact />
        </div>
      </div>

      <!-- Weather conditions -->
      <div class="card" style="margin-top:12px">
        <div class="card-header">Weather Conditions</div>
        <div class="card-body">
          <div v-if="weather.length" class="weather-list">
            <div v-for="w in weather.slice(0,4)" :key="w.id" class="weather-row">
              <span class="weather-icon">{{ wxIcon(w.condition) }}</span>
              <div>
                <div style="font-size:13px;font-weight:600">{{ w.condition.replace(/_/g,' ') }}</div>
                <div style="font-size:11px;color:var(--fg-2)">
                  {{ w.temperature_c != null ? `${w.temperature_c.toFixed(0)}°C` : '' }}
                  {{ w.rainfall_mm > 0 ? `· ${w.rainfall_mm.toFixed(1)}mm rain` : '' }}
                  {{ w.visibility_km != null ? `· ${w.visibility_km.toFixed(1)}km vis` : '' }}
                </div>
              </div>
              <div class="weather-impact" :style="{ color: impactColor(w.traffic_impact_score) }">
                {{ (w.traffic_impact_score * 100).toFixed(0) }}% impact
              </div>
            </div>
          </div>
          <EmptyState v-else :loading="loading" message="No weather data" compact />
        </div>
      </div>
    </div>
  </div>

  <!-- Volume trend -->
  <SectionTitle pill="KeNHA ATC · 24h">Traffic Volume (Last 24h)</SectionTitle>

  <div id="volume-trend" class="card drill-target">
    <div class="card-body">
      <TrendLineChart
        :points="volumeChartPoints"
        :height="180"
        :format-value="v => fmtNum(v)"
        :empty-text="loading ? 'Loading volume…' : 'No 24h volume data'"
      />
    </div>
  </div>

  <!-- Active congestion events -->
  <SectionTitle pill="KeNHA RTMS · Live">Active Congestion Events</SectionTitle>

  <div id="congestion-events" class="card drill-target">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Segment</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Avg Speed (km/h)</th>
            <th>Delay (min)</th>
            <th>Impact (km)</th>
            <th>Est. Duration (min)</th>
            <th>Started</th>
          </tr>
        </thead>
        <tbody v-if="congestionEvents.length">
          <tr v-for="ev in congestionEventsPageRows" :key="ev.id">
            <td>
              <div style="font-weight:600;font-size:13px">{{ ev.segment_road_code ?? ev.segment }}</div>
              <div v-if="ev.description" style="font-size:11px;color:var(--fg-3)">{{ ev.description.slice(0,60) }}…</div>
            </td>
            <td><BadgePill :variant="sevBadge(ev.severity)">{{ ev.severity }}</BadgePill></td>
            <td><BadgePill :variant="ev.status === 'active' ? 'danger' : 'success'">{{ ev.status }}</BadgePill></td>
            <td :style="{ color: ev.avg_speed_kmh < 20 ? 'var(--danger-fg)' : ev.avg_speed_kmh < 40 ? 'var(--warning-fg)' : 'var(--success-fg)', fontWeight:'600' }">
              {{ ev.avg_speed_kmh.toFixed(0) }}
            </td>
            <td style="font-weight:600">{{ ev.delay_minutes.toFixed(0) }}</td>
            <td>{{ ev.impact_radius_km.toFixed(1) }}</td>
            <td>{{ ev.expected_duration_min.toFixed(0) }}</td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtTime(ev.started_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="8" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading events…' : 'No active congestion events.' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="congestionEventsPage" :total-pages="congestionEventsTotalPages" :total="congestionEventsTotal"
        @prev="congestionEventsPrev" @next="congestionEventsNext"
      />
    </div>
  </div>

  <!-- Next-hour forecasts + active alerts -->
  <div class="two-col">
    <!-- Next-hour model forecasts -->
    <div class="card">
      <div class="card-header">
        Next-Hour Forecast
        <NuxtLink to="/traffic/analytics" class="link-sm">Full analytics →</NuxtLink>
      </div>
      <div class="card-body">
        <div v-if="nextHourForecasts.length" class="forecast-list">
          <div v-for="f in nextHourForecasts" :key="f.model_name" class="fc-row">
            <BadgePill variant="info">{{ f.model_name }}</BadgePill>
            <div class="fc-detail">
              <span>{{ fmtNum(f.avg_volume) }} vol</span>
              <span>{{ f.avg_speed.toFixed(0) }} km/h</span>
            </div>
          </div>
        </div>
        <EmptyState v-else :loading="loading" message="No forecast data" compact />
      </div>
    </div>

    <!-- Active alerts -->
    <div class="card">
      <div class="card-header">
        Active Alerts
        <NuxtLink to="/traffic/alerts" class="link-sm">View all →</NuxtLink>
      </div>
      <div class="card-body">
        <div v-if="alerts.length">
          <AlertItem
            v-for="al in alerts.slice(0, 6)"
            :key="al.id"
            :severity="al.severity === 'critical' ? 'critical' : al.severity === 'warning' ? 'warning' : 'info'"
            :title="al.title"
            :meta="`${al.alert_type.replace(/_/g,' ')} · ${fmtTime(al.issued_at)}`"
          />
        </div>
        <EmptyState v-else :loading="loading" message="No active alerts." icon="search" compact />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useTraffic, useGis } from '~/composables/api'
import type { TrafficSummary, CongestionEvent, TrafficAlert, WeatherObservation } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

const summary          = ref<TrafficSummary | null>(null)
const congestionEvents = ref<CongestionEvent[]>([])
const alerts           = ref<TrafficAlert[]>([])
const weather          = ref<WeatherObservation[]>([])
const classShare       = ref<{ vehicle_class: string; total: number; share_pct: number }[]>([])
const mapMarkers       = ref<MarkerSpec[]>([])
const roadsGeo         = ref<GeoJSONFeatureCollection | null>(null)
const loading          = ref(true)
const error            = ref<string | null>(null)
const lastRefreshed    = ref('-')

async function load() {
  loading.value = true
  error.value = null
  const traffic = useTraffic()
  const gis     = useGis()

  const [sumRes, congRes, alertRes, wxRes, classRes, mapRes, roadsRes] = await Promise.allSettled([
    traffic.summary(),
    traffic.activeCongestion(),
    traffic.alerts({ page_size: 20, active: true } as any),
    traffic.weather({ page_size: 6 }),
    traffic.classShare(7),
    traffic.mapData(),
    gis.roads({ limit: 400, simplify: 0.01 }),
  ])

  if (sumRes.status   === 'fulfilled') {
    summary.value    = sumRes.value
    classShare.value = sumRes.value.class_breakdown ?? []
  }
  if (congRes.status  === 'fulfilled') congestionEvents.value = (congRes.value as any).results ?? []
  if (alertRes.status === 'fulfilled') alerts.value           = (alertRes.value as any).results ?? []
  if (wxRes.status    === 'fulfilled') weather.value          = (wxRes.value as any).results ?? []
  if (classRes.status === 'fulfilled' && !classShare.value.length)
    classShare.value = (classRes.value as any).results ?? []
  if (mapRes.status   === 'fulfilled') mapMarkers.value       = mapRes.value.markers as MarkerSpec[]
  if (roadsRes.status === 'fulfilled') roadsGeo.value         = roadsRes.value

  if ([sumRes, congRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Traffic API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 60_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const volumeChartPoints = computed(() =>
  (summary.value?.volume_24h ?? []).map(h => ({
    label: fmtHour(h.hour),
    value: h.volume,
    meta: h.avg_speed != null ? `${h.avg_speed.toFixed(0)} km/h avg speed` : undefined,
  })),
)

const nextHourForecasts = computed(() => summary.value?.forecast_next_hour ?? [])

const volumeSeries = computed(() => {
  const h = summary.value?.volume_24h ?? []
  return h.length > 1 ? h.map(x => x.volume) : undefined
})
const speedSeries = computed(() => {
  const h = summary.value?.volume_24h ?? []
  const vals = h.map(x => x.avg_speed).filter((v): v is number => v != null)
  return vals.length > 1 ? vals : undefined
})

const totalCongestion = computed(() =>
  Object.values(summary.value?.congestion_distribution ?? {}).reduce((s, v) => s + v, 0) || 1,
)
const congestionEntries = computed(() =>
  Object.entries(summary.value?.congestion_distribution ?? {}) as [string, number][],
)

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: congestionEventsPageRows, page: congestionEventsPage, totalPages: congestionEventsTotalPages,
  total: congestionEventsTotal, next: congestionEventsNext, prev: congestionEventsPrev,
} = usePagination(congestionEvents, 15)

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function fmtHour(iso: string) {
  try { return new Date(iso).getHours().toString().padStart(2, '0') + ':00' } catch { return iso }
}
function freshnessLabel(iso: string | undefined) {
  if (!iso) return 'Live'
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    return mins < 2 ? 'Live' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`
  } catch { return 'Live' }
}
function congColor(level: string) {
  const m: Record<string,string> = { free_flow:'#22c55e', moderate:'#f59e0b', heavy:'#f97316', severe:'#ef4444' }
  return m[level] ?? '#94a3b8'
}
function congPct(count: number) { return (count / totalCongestion.value) * 100 }
function classColor(cls: string) {
  const m: Record<string,string> = { car:'#3b82f6', motorcycle:'#a855f7', light_truck:'#f59e0b', heavy_truck:'#ef4444', bus:'#22c55e', other:'#94a3b8' }
  return m[cls] ?? '#64748b'
}
const { riskBadge: sevBadge } = useSeverityBadge()
function wxIcon(c: string) {
  const m: Record<string,string> = { clear:'☀️', cloudy:'☁️', rain:'🌧️', heavy_rain:'⛈️', fog:'🌫️', storm:'⛈️' }
  return m[c] ?? '🌤️'
}
function impactColor(score: number) {
  // traffic_impact_score is a 0..1 fraction from the backend, not 0..100.
  return score >= 0.7 ? 'var(--danger-fg)' : score >= 0.4 ? 'var(--warning-fg)' : 'var(--success-fg)'
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:1100px) { .two-col, .two-col-map { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px 0; }
.map-key:first-of-type { border-top:1px solid var(--border-subtle); padding-top:8px; }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.map-key-note { font-size:10.5px; color:var(--fg-3); padding:6px 14px 10px; margin:0; }
.right-col { display:flex; flex-direction:column; gap:12px; overflow-y:auto; max-height:540px; }
.cong-list { display:flex; flex-direction:column; gap:8px; }
.cong-row { display:grid; grid-template-columns:90px 1fr 44px; align-items:center; gap:8px; }
.cong-label { font-size:12px; text-transform:capitalize; }
.cong-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.cong-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
.cong-val { font-size:11px; text-align:right; }
.weather-list { display:flex; flex-direction:column; gap:8px; }
.weather-row { display:flex; align-items:center; gap:10px; padding:4px 0; }
.weather-icon { font-size:20px; line-height:1; }
.weather-impact { margin-left:auto; font-size:12px; font-weight:600; }
.forecast-list { display:flex; flex-direction:column; gap:8px; }
.fc-row { display:flex; align-items:center; gap:10px; }
.fc-detail { display:flex; gap:16px; font-size:12px; color:var(--fg-2); margin-left:auto; }
.link-sm { font-size:12px; color:var(--link); text-decoration:none; }
</style>
