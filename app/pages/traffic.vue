<script setup lang="ts">
// pages/traffic.vue — M02 Road Traffic Management
// FR-M02-001..014: real-time flow, volume analytics, vehicle class,
// speed compliance, congestion, weather correlation, forecasts, OD matrix.
//
// Backend: /api/v1/traffic/ — counting-stations, counts, classifications,
// speed-observations, congestion-events, route-optimizations, forecasts,
// od-matrices, weather, alerts. Plus /summary/ for the one-shot dashboard.

definePageMeta({ title: 'Traffic' })

import { useTraffic } from '~/composables/api'
import type {
  CongestionEvent, CongestionLevel, TrafficForecast, TrafficSummary,
  VehicleClassification, ODMatrix, WeatherObservation, TrafficAlert,
  CountingStation,
} from '~/composables/api'

const traffic = useTraffic()

const summary = ref<TrafficSummary | null>(null)
const events = ref<CongestionEvent[]>([])
const forecasts = ref<TrafficForecast[]>([])
const classShare = ref<{ vehicle_class: string; total: number; share_pct: number }[]>([])
const topPairs = ref<{ origin_zone: string; destination_zone: string; trips: number }[]>([])
const weather = ref<WeatherObservation[]>([])
const alerts = ref<TrafficAlert[]>([])
const stations = ref<CountingStation[]>([])
const mapMarkers = ref<any[]>([])
const mapArrows = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [sum, ev, fc, cs, tp, wx, al, st] = await Promise.all([
      traffic.summary(),
      traffic.activeCongestion(),
      traffic.forecasts({ page_size: 24 }),
      traffic.classShare(7),
      traffic.topOdPairs(7),
      traffic.weather({ page_size: 8 }),
      traffic.alerts({ page_size: 8, active: true }),
      traffic.countingStations({ page_size: 12 }),
    ])
    summary.value = sum
    events.value = (ev as any).results ?? []
    forecasts.value = (fc as any).results ?? []
    classShare.value = cs.results ?? []
    topPairs.value = (tp.results ?? []).slice(0, 8)
    weather.value = (wx as any).results ?? []
    alerts.value = (al as any).results ?? []
    stations.value = (st as any).results ?? []

    // Map: build markers (counting stations + congestion events) and
    // arrows (top OD pairs). Coordinates for OD zones use Nairobi CBD
    // as the anchor with small jitter per zone name (hash-based, so the
    // placement is stable across reloads).
    try {
      const md = await traffic.mapData()
      mapMarkers.value = md.markers
    } catch {
      mapMarkers.value = []
    }
    mapArrows.value = topPairs.value.slice(0, 12).map(p => ({
      id: `${p.origin_zone}-${p.destination_zone}`,
      from: zoneCoord(p.origin_zone),
      to: zoneCoord(p.destination_zone),
      label: `${p.origin_zone} → ${p.destination_zone}: ${p.trips.toLocaleString()} trips`,
      weight: Math.min(6, 1 + Math.log10(p.trips ?? 1)),
      color: 'purple',
    }))
  } catch (err: any) {
    error.value = err?.status === 401
      ? 'Sign in to view traffic data.'
      : err?.status === 404
        ? 'Traffic endpoints not yet mounted — restart the backend after running migrations.'
        : err?.message ?? 'Failed to load traffic data.'
  } finally {
    loading.value = false
  }
}

// Stable, deterministic zone-coordinate lookup. We hash the zone name
// and use the hash to scatter zones around the Nairobi metro box.
function zoneCoord(zone: string): [number, number] {
  let hash = 0
  for (let i = 0; i < zone.length; i++) {
    hash = (hash * 31 + zone.charCodeAt(i)) | 0
  }
  const fx = ((hash & 0xffff) / 0xffff) * 2 - 1   // -1..1
  const fy = (((hash >> 16) & 0xffff) / 0xffff) * 2 - 1
  // Nairobi metro box (approx): lat -1.45..-1.10, lon 36.65..37.05.
  return [-1.275 + fy * 0.18, 36.85 + fx * 0.20]
}

onMounted(load)

// ── Helpers ────────────────────────────────────────────────────────────
function fmtTime(iso?: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-KE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) }
  catch { return iso }
}
function fmtHour(iso: string) {
  try { return new Date(iso).getHours().toString().padStart(2, '0') + ':00' } catch { return iso }
}
function levelColor(level: CongestionLevel | string) {
  return level === 'severe' || level === 'critical' ? 'danger'
    : level === 'heavy' || level === 'high' ? 'warning'
    : level === 'moderate' || level === 'medium' ? 'info'
    : 'success'
}
function sevClass(s: string) {
  return s === 'critical' ? 'danger' : s === 'high' ? 'warning' : s === 'medium' ? 'info' : 'neutral'
}
function condIcon(c: string) {
  return c === 'rain' || c === 'heavy_rain' ? '🌧'
    : c === 'cloudy' ? '☁'
    : c === 'fog' ? '🌫'
    : c === 'storm' ? '⛈'
    : '☀'
}

// Traffic volume bar chart (simple SVG).
const maxVolume = computed(() => {
  const vols = (summary.value?.volume_24h ?? []).map(v => v.volume ?? 0)
  return Math.max(1, ...vols)
})
const chartBars = computed(() => {
  const rows = summary.value?.volume_24h ?? []
  return rows.slice(-24).map((r, i, arr) => {
    const x = (i / Math.max(1, arr.length - 1)) * 100
    const h = ((r.volume ?? 0) / maxVolume.value) * 100
    const y = 100 - h
    return { x, y, h, hour: fmtHour(r.hour) }
  })
})
</script>

<template>
  <div class="traffic-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M02</div>
        <h1 class="text-display">Road Traffic Management</h1>
        <p class="text-sm text-fg-muted mt-1">
          Real-time flow visualization · Volume analytics · Vehicle classification ·
          Speed compliance · Congestion detection · Weather correlation · 24h forecasts
        </p>
      </div>
      <button class="btn btn-secondary" @click="load" :disabled="loading">
        <span v-if="loading">Refreshing…</span><span v-else>Refresh</span>
      </button>
    </div>

    <!-- Loading / error states -->
        <div v-if="loading && !summary" class="card">
          <div class="card-body text-fg-muted">Loading traffic data from /api/v1/traffic/…</div>
        </div>
        <div v-else-if="error" class="card">
          <div class="card-body text-fg-muted">{{ error }}</div>
        </div>

        <!-- Live Map: counting stations, congestion events, OD pairs.
             Built with Leaflet via the reusable UAPTSMap component. -->
        <div class="card map-card">
          <div class="card-header">
            <div>
              <div class="text-subhead">Nairobi Live Traffic Map</div>
              <div class="text-xs text-fg-muted">
                Counting stations · Active congestion · Top OD pairs ·
                {{ mapMarkers.length }} markers · {{ mapArrows.length }} OD arrows
              </div>
            </div>
          </div>
          <ClientOnly>
            <UaptsMap
              :markers="mapMarkers"
              :arrows="mapArrows"
              height="520px"
              show-legend
            />
            <template #fallback>
              <div class="card-body text-fg-muted">Loading map…</div>
            </template>
          </ClientOnly>
        </div>

    <!-- KPI strip -->
    <div v-if="summary" class="kpi-grid">
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Active Stations</div>
        <div class="kpi-value">{{ summary.kpis.active_stations }}<span class="text-fg-dim text-sm"> / {{ summary.kpis.total_stations }}</span></div>
        <div class="text-xs text-fg-muted mt-1">KeNHA · KURA · NTSA</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Volume (24h)</div>
        <div class="kpi-value">{{ (summary.kpis.total_volume_24h ?? 0).toLocaleString() }}</div>
        <div class="text-xs text-fg-muted mt-1">Total vehicle observations</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Avg Speed (24h)</div>
        <div class="kpi-value">
          {{ summary.kpis.avg_speed_24h_kmh ? summary.kpis.avg_speed_24h_kmh.toFixed(1) : '—' }}<span class="text-fg-dim text-sm"> km/h</span>
        </div>
        <div class="text-xs text-fg-muted mt-1">Across all counting stations</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Active Congestion</div>
        <div class="kpi-value">{{ summary.kpis.active_congestion_events }}</div>
        <div class="text-xs text-fg-muted mt-1">Live events · FR-M02-005</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Segments Observed</div>
        <div class="kpi-value">{{ summary.kpis.total_segments_observed }}</div>
        <div class="text-xs text-fg-muted mt-1">Unique road segments (24h)</div>
      </div>
    </div>

    <!-- Map view: live traffic + road network -->
        <ClientOnly>
          <div class="card" style="padding: 0; overflow: hidden">
            <div class="card-header" style="padding: 12px 18px">
              <div>
                <div class="text-subhead">Live Map · Congestion &amp; Weather</div>
                <div class="text-xs text-fg-muted">FR-M02-001/010 · PostGIS LineStrings &amp; Points</div>
              </div>
              <NuxtLink to="/kenya-map" class="btn btn-ghost text-xs">Full map →</NuxtLink>
            </div>
            <UaptsMap
              :layers="['kenya', 'segments', 'stations', 'congestion', 'weather']"
              :center="[-1.286, 36.817]"
              :zoom="11"
              height="420px"
              :show-readout="false"
            />
          </div>
          <template #fallback>
            <div class="card" style="height: 460px"><div class="card-body text-fg-muted">Loading map…</div></div>
          </template>
        </ClientOnly>

    <!-- 24h volume chart -->
    <div v-if="summary" class="card chart-card">
      <div class="card-header">
        <div>
          <div class="text-subhead">Traffic Volume — Last 24 hours</div>
          <div class="text-xs text-fg-muted">Vehicles per hour · Across all operational stations</div>
        </div>
      </div>
      <div class="chart-area">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="chart-svg" style="height:160px;width:100%">
          <g v-for="(b, i) in chartBars" :key="i">
            <rect :x="b.x - 1.5" :y="b.y" width="3" :height="b.h" fill="#3b82f6" opacity="0.85" rx="0.4"/>
          </g>
        </svg>
        <div class="chart-axis">
          <span v-for="(b, i) in chartBars" :key="i" class="chart-tick" v-show="i % 4 === 0">{{ b.hour }}</span>
        </div>
      </div>
    </div>

    <!-- Two-column row: Congestion distribution + Vehicle classes -->
    <div v-if="summary" class="two-col">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Congestion Distribution</div>
          <span class="text-xs text-fg-muted">Last 24h observations</span>
        </div>
        <div class="card-body">
          <div v-for="level in ['free_flow','moderate','heavy','severe']" :key="level" class="bar-row">
            <span class="bar-label">{{ level.replace('_', ' ') }}</span>
            <div class="bar-track">
              <div class="bar-fill" :class="`bar-${levelColor(level)}`"
                :style="{ width: pct(summary.congestion_distribution?.[level] ?? 0, summary.congestion_distribution) + '%' }"></div>
            </div>
            <span class="bar-value">{{ summary.congestion_distribution?.[level] ?? 0 }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Vehicle Class Share</div>
          <span class="text-xs text-fg-muted">Last 7 days</span>
        </div>
        <div class="card-body">
          <div v-for="c in classShare" :key="c.vehicle_class" class="bar-row">
            <span class="bar-label">{{ c.vehicle_class.replace('_', ' ') }}</span>
            <div class="bar-track">
              <div class="bar-fill bar-info"
                :style="{ width: c.share_pct + '%' }"></div>
            </div>
            <span class="bar-value">{{ c.share_pct.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Live congestion events -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Live Congestion Events</div>
        <span class="badge badge-neutral">{{ events.length }} active</span>
      </div>
      <div v-if="!events.length" class="card-body text-fg-muted">
        No active congestion events.
      </div>
      <div v-else class="event-list">
        <div v-for="ev in events.slice(0, 10)" :key="ev.id" class="event-row">
          <span class="badge" :class="`badge-${sevClass(ev.severity)}`">{{ ev.severity }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium">{{ ev.description || `Congestion on segment ${ev.segment_id?.slice(0,8)}` }}</div>
            <div class="text-xs text-fg-muted">
              Speed {{ ev.avg_speed_kmh.toFixed(1) }} km/h · Delay {{ ev.delay_minutes }} min ·
              Impact radius {{ ev.impact_radius_km.toFixed(1) }} km
            </div>
          </div>
          <span class="text-xs text-fg-dim">{{ fmtTime(ev.started_at) }}</span>
        </div>
      </div>
    </div>

    <!-- Forecast snapshot + Speed compliance -->
    <div v-if="summary" class="two-col">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Speed Compliance</div>
          <span class="text-xs text-fg-muted">FR-M02-004 · Fleet-wide</span>
        </div>
        <div class="card-body">
          <div class="big-number">
            {{ summary.speed_compliance.avg_compliance_pct.toFixed(1) }}%
          </div>
          <div class="text-xs text-fg-muted">
            Sample size: {{ summary.speed_compliance.observation_count.toLocaleString() }} speed observations
          </div>
          <div class="text-xs text-fg-muted mt-2">
            % of vehicles at or below posted speed limit
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Forecast — Next Hour</div>
          <span class="text-xs text-fg-muted">FR-M02-012 · 4 ML models</span>
        </div>
        <div class="card-body">
          <div v-for="f in summary.forecast_next_hour" :key="f.model_name" class="bar-row">
            <span class="bar-label">{{ f.model_name }}</span>
            <div class="bar-track">
              <div class="bar-fill bar-success"
                :style="{ width: Math.min(100, (f.avg_volume / 1500) * 100) + '%' }"></div>
            </div>
            <span class="bar-value">{{ Math.round(f.avg_volume).toLocaleString() }} veh/h</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Weather correlation -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Weather Correlation · KMD feed</div>
        <span class="text-xs text-fg-muted">FR-M02-010</span>
      </div>
      <div class="weather-row">
        <div v-for="w in weather" :key="w.id" class="weather-cell">
          <div class="text-2xl">{{ condIcon(w.condition) }}</div>
          <div class="text-xs text-fg-muted mt-1">{{ w.condition.replace('_', ' ') }}</div>
          <div class="text-xs">{{ w.rainfall_mm.toFixed(1) }} mm rain</div>
          <div class="text-xs text-fg-muted">Impact {{ (w.traffic_impact_score * 100).toFixed(0) }}%</div>
        </div>
      </div>
    </div>

    <!-- OD matrix top pairs -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Top Origin → Destination Pairs</div>
        <span class="text-xs text-fg-muted">FR-M02-014 · Aggregated GPS · Last 7d</span>
      </div>
      <div class="card-body">
        <div v-if="!topPairs.length" class="text-fg-muted text-sm">No OD data yet.</div>
        <div v-else class="od-row" v-for="p in topPairs" :key="p.origin_zone + '-' + p.destination_zone">
          <span class="od-origin">{{ p.origin_zone }}</span>
          <span class="od-arrow">→</span>
          <span class="od-dest">{{ p.destination_zone }}</span>
          <span class="od-count">{{ p.trips.toLocaleString() }} trips</span>
        </div>
      </div>
    </div>

    <!-- Active alerts -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Active Alerts</div>
        <span class="badge badge-warning">{{ alerts.length }} unresolved</span>
      </div>
      <div v-if="!alerts.length" class="card-body text-fg-muted">No active alerts.</div>
      <div v-else class="event-list">
        <div v-for="a in alerts.slice(0, 8)" :key="a.id" class="event-row">
          <span class="badge" :class="`badge-${sevClass(a.severity)}`">{{ a.alert_type }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium">{{ a.title }}</div>
            <div class="text-xs text-fg-muted">{{ a.message }}</div>
          </div>
          <span class="text-xs text-fg-dim">{{ fmtTime(a.issued_at) }}</span>
        </div>
      </div>
    </div>

    <!-- Counting stations inventory -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Counting Stations</div>
        <span class="text-xs text-fg-muted">FR-M02-009 · KeNHA · KURA · NTSA</span>
      </div>
      <div class="card-body">
        <div v-if="!stations.length" class="text-fg-muted text-sm">No stations.</div>
        <table v-else class="data-table">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Agency</th><th>Type</th><th>Speed limit</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in stations.slice(0, 12)" :key="s.id">
              <td class="font-mono text-xs">{{ s.station_code }}</td>
              <td>{{ s.station_name }}</td>
              <td>{{ s.agency_code || '—' }}</td>
              <td>{{ s.station_type.toUpperCase() }}</td>
              <td>{{ s.speed_limit_kmh ?? '—' }} km/h</td>
              <td><span class="badge" :class="`badge-${s.equipment_status === 'operational' ? 'success' : s.equipment_status === 'degraded' ? 'warning' : 'neutral'}`">{{ s.equipment_status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
function pct(v: number, dist: any) {
  const total = Object.values(dist ?? {}).reduce((a: number, b: any) => a + (b as number), 0) as number
  return total === 0 ? 0 : (v / total) * 100
}
</script>

<style scoped>
.traffic-page { display: flex; flex-direction: column; gap: 18px; }
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.kpi-card { padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.kpi-value { font-size: 26px; font-weight: 600; line-height: 1.1; }
.chart-card .chart-area { padding: 0 18px 12px; }
.chart-axis {
  display: flex; justify-content: space-between;
  font-size: 10px; color: var(--fg-muted);
  padding: 4px 0 12px;
}
.two-col {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
}
@media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
.bar-row {
  display: grid; grid-template-columns: 110px 1fr 80px; align-items: center;
  gap: 10px; padding: 4px 0;
}
.bar-label { font-size: 12px; text-transform: capitalize; color: var(--fg-muted); }
.bar-track { height: 10px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; }
.bar-success { background: #10b981; }
.bar-info { background: #3b82f6; }
.bar-warning { background: #f59e0b; }
.bar-danger { background: #ef4444; }
.bar-value { font-size: 12px; text-align: right; font-variant-numeric: tabular-nums; }
.event-list { padding: 4px 0; }
.event-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 18px;
}
.event-row:hover { background: rgba(255,255,255,0.025); }
.weather-row {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px; padding: 14px 18px;
}
.weather-cell {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px; padding: 10px;
}
.big-number { font-size: 32px; font-weight: 600; color: #10b981; }
.od-row {
  display: grid; grid-template-columns: 1fr 24px 1fr 100px; gap: 10px;
  padding: 6px 0; align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  font-size: 13px;
}
.od-row:last-child { border-bottom: none; }
.od-origin { color: var(--fg-muted); }
.od-arrow { color: var(--fg-dim); text-align: center; }
.od-dest { font-weight: 500; }
.od-count { text-align: right; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { text-align: left; padding: 8px 6px; color: var(--fg-muted); border-bottom: 1px solid rgba(255,255,255,0.06); font-weight: 500; font-size: 11px; text-transform: uppercase; }
.data-table td { padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.card-body { padding: 14px 18px; }
</style>