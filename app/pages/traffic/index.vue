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
      sub="ATC · WIM · Video counting"
      source="live" source-title="KeNHA ATC"
    />
    <KpiCard
      label="Active Congestion"
      :value="summary ? fmtNum(summary.kpis.active_congestion_events) : '-'"
      sub="Live events on network"
      trend-direction="down"
      source="live" source-title="KeNHA RTMS"
    />
    <KpiCard
      label="Avg Speed (24h)"
      :value="summary?.kpis.avg_speed_24h_kmh != null ? `${summary.kpis.avg_speed_24h_kmh.toFixed(0)} km/h` : '-'"
      sub="Network average"
      :trend-direction="summary?.kpis.avg_speed_24h_kmh && summary.kpis.avg_speed_24h_kmh >= 40 ? 'up' : 'down'"
      source="live" source-title="KeNHA ATC"
    />
    <KpiCard
      label="Total Volume (24h)"
      :value="summary ? fmtNum(summary.kpis.total_volume_24h) : '-'"
      sub="Vehicles counted"
      trend-direction="up"
      source="live" source-title="KeNHA ATC"
    />
    <KpiCard
      label="Speed Compliance"
      :value="summary ? `${summary.speed_compliance.avg_compliance_pct.toFixed(1)}%` : '-'"
      :sub="summary ? `${fmtNum(summary.speed_compliance.observation_count)} observations` : '-'"
      :trend-direction="summary && summary.speed_compliance.avg_compliance_pct >= 80 ? 'up' : 'down'"
      source="live" source-title="KeNHA ATC"
    />
    <KpiCard
      label="Segments Observed"
      :value="summary ? fmtNum(summary.kpis.total_segments_observed) : '-'"
      sub="Road segments with data"
      source="live" source-title="KeNHA RTMS"
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
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#22c55e" /> Station operational</span>
        <span class="mk"><span class="dot" style="background:#eab308" /> Station degraded</span>
        <span class="mk"><span class="dot" style="background:#94a3b8" /> Station offline</span>
        <span class="mk"><span class="dot" style="background:#ef4444" /> Congestion event</span>
      </div>
    </div>

    <div class="right-col">
      <!-- Congestion distribution -->
      <div class="card">
        <div class="card-header">Congestion Distribution</div>
        <div class="card-body">
          <div v-if="summary" class="cong-list">
            <div v-for="(count, level) in summary.congestion_distribution" :key="level" class="cong-row">
              <span class="cong-label">{{ String(level).replace(/_/g,' ') }}</span>
              <div class="cong-bar-wrap">
                <div class="cong-bar" :style="{ width: `${congPct(count)}%`, background: congColor(String(level)) }" />
              </div>
              <span class="cong-val">{{ fmtNum(count) }}</span>
            </div>
          </div>
          <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No data' }}</div>
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
                <div class="cong-bar" :style="{ width: `${c.share_pct}%`, background: classColor(c.vehicle_class) }" />
              </div>
              <span class="cong-val">{{ c.share_pct.toFixed(1) }}%</span>
            </div>
          </div>
          <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No class data' }}</div>
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
                <div style="font-size:11px;color:#64748b">
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
          <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No weather data' }}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Volume trend -->
  <SectionTitle pill="KeNHA ATC · 24h">Traffic Volume (Last 24h)</SectionTitle>

  <div class="card">
    <div class="card-body">
      <TrendLineChart
        :points="volumeChartPoints"
        color="#3b82f6"
        :height="180"
        :format-value="v => fmtNum(v)"
        :empty-text="loading ? 'Loading volume…' : 'No 24h volume data'"
      />
    </div>
  </div>

  <!-- Active congestion events -->
  <SectionTitle pill="KeNHA RTMS · Live">Active Congestion Events</SectionTitle>

  <div class="card">
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
          <tr v-for="ev in congestionEvents" :key="ev.id">
            <td>
              <div style="font-weight:600;font-size:13px">{{ ev.segment }}</div>
              <div v-if="ev.description" style="font-size:11px;color:#94a3b8">{{ ev.description.slice(0,60) }}…</div>
            </td>
            <td><BadgePill :variant="sevBadge(ev.severity)">{{ ev.severity }}</BadgePill></td>
            <td><BadgePill :variant="ev.status === 'active' ? 'danger' : 'success'">{{ ev.status }}</BadgePill></td>
            <td :style="{ color: ev.avg_speed_kmh < 20 ? '#ef4444' : ev.avg_speed_kmh < 40 ? '#f59e0b' : '#22c55e', fontWeight:'600' }">
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
            <td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading events…' : 'No active congestion events.' }}
            </td>
          </tr>
        </tbody>
      </table>
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
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No forecast data' }}</div>
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
        <div v-else style="color:#94a3b8;font-size:13px">
          {{ loading ? 'Loading…' : 'No active alerts.' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Live Traffic')

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

const totalCongestion = computed(() =>
  Object.values(summary.value?.congestion_distribution ?? {}).reduce((s, v) => s + v, 0) || 1,
)

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
function sevBadge(s: string) {
  const m: Record<string,string> = { critical:'danger', high:'warning', medium:'fair', low:'success' }
  return m[s] ?? 'neutral'
}
function wxIcon(c: string) {
  const m: Record<string,string> = { clear:'☀️', cloudy:'☁️', rain:'🌧️', heavy_rain:'⛈️', fog:'🌫️', storm:'⛈️' }
  return m[c] ?? '🌤️'
}
function impactColor(score: number) {
  // traffic_impact_score is a 0..1 fraction from the backend, not 0..100.
  return score >= 0.7 ? '#ef4444' : score >= 0.4 ? '#f59e0b' : '#22c55e'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:1100px) { .two-col, .two-col-map { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid #f1f5f9; }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.right-col { display:flex; flex-direction:column; gap:12px; overflow-y:auto; max-height:540px; }
.cong-list { display:flex; flex-direction:column; gap:8px; }
.cong-row { display:grid; grid-template-columns:90px 1fr 44px; align-items:center; gap:8px; }
.cong-label { font-size:12px; text-transform:capitalize; }
.cong-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.cong-bar { height:100%; border-radius:4px; transition:width .4s; }
.cong-val { font-size:11px; text-align:right; }
.weather-list { display:flex; flex-direction:column; gap:8px; }
.weather-row { display:flex; align-items:center; gap:10px; padding:4px 0; }
.weather-icon { font-size:20px; line-height:1; }
.weather-impact { margin-left:auto; font-size:12px; font-weight:600; }
.forecast-list { display:flex; flex-direction:column; gap:8px; }
.fc-row { display:flex; align-items:center; gap:10px; }
.fc-detail { display:flex; gap:16px; font-size:12px; color:#64748b; margin-left:auto; }
.link-sm { font-size:12px; color:#3b82f6; text-decoration:none; }
</style>
