<template>
  <PageHeader
    eyebrow="Public Transport Operations"
    title="Public Transport Overview"
    subtitle="NaMATA · NTSA · NCTTCA - BRT operations, PSV oversight, schedule adherence, fare analytics, NCTTCA corridor ridership, and operator ranking"
  >
    <template #actions>
      <NuxtLink to="/public-transport/vehicle-inspections" class="btn">Inspections →</NuxtLink>
      <NuxtLink to="/public-transport/operators" class="btn">Public Operators →</NuxtLink>
      <NuxtLink to="/public-transport/compliance" class="btn-primary">Compliance →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI ribbon -->
  <SectionTitle :pill="summary ? 'NaMATA / NTSA · ' + freshnessLabel(summary.generated_at) : ''">
    Operations KPIs
  </SectionTitle>

  <div class="kpi-grid">
    <KpiCard
      label="Active SACCOs"
      :value="summary ? fmtNum(summary.kpis.active_saccos) : '-'"
      :sub="`${summary ? fmtNum(summary.kpis.total_saccos) : '-'} total registered`"
      source="batch" source-title="NTSA PSV Registry"
    />
    <KpiCard
      label="Active Routes"
      :value="summary ? fmtNum(summary.kpis.active_routes) : '-'"
      :sub="`${summary?.kpis.brt_routes ?? '-'} BRT · ${summary?.kpis.matatu_routes ?? '-'} matatu`"
      source="batch" source-title="Digital Matatus GTFS"
    />
    <KpiCard
      label="Departures (24h)"
      :value="summary ? fmtNum(summary.kpis.scheduled_departures_24h) : '-'"
      sub="Scheduled dispatches"
      trend-direction="up"
      source="live" source-title="NaMATA GTFS-RT"
    />
    <KpiCard
      label="Revenue (24h)"
      :value="summary ? fmtKES(summary.kpis.revenue_24h_kes) : '-'"
      sub="All payment channels"
      trend-direction="up"
      source="live" source-title="BebaPay / NTSA"
    />
    <KpiCard
      label="Passenger Trips (24h)"
      :value="summary ? fmtNum(summary.kpis.passenger_trips_24h) : '-'"
      sub="Total boardings"
      trend-direction="up"
      source="live" source-title="NaMATA GTFS-RT"
    />
    <KpiCard
      label="On-Time Performance"
      :value="summary ? `${summary.on_time_pct.toFixed(1)}%` : '-'"
      sub="±3 min · 7-day window"
      :trend-direction="summary && summary.on_time_pct >= 80 ? 'up' : 'down'"
      source="live" source-title="NaMATA Schedule"
    />
  </div>

  <!-- Route map + channel revenue side by side -->
  <div class="two-col-map">
    <div class="card map-card">
      <div class="card-header">Nairobi Public Transport Map</div>
      <ClientOnly>
        <UaptsMap
          :lines="mapLines"
          :markers="mapMarkers"
          :roads="roadsGeo"
          :center="[-1.286, 36.817]"
          :zoom="11"
          height="480px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#f97316" /> BRT routes</span>
        <span class="mk"><span class="dot" style="background:#3b82f6" /> Matatu routes</span>
        <span class="mk"><span class="dot" style="background:#eab308" /> BRT stops</span>
      </div>
    </div>

    <div class="side-col">
      <!-- Payment channels -->
      <div class="card">
        <div class="card-header">Revenue by Channel (7d)</div>
        <div class="card-body">
          <div v-for="c in fareChannels" :key="c.payment_channel" class="chan-row">
            <span class="chan-label">{{ c.payment_channel }}</span>
            <div class="chan-bar-wrap">
              <div class="chan-bar" :style="{ width: `${c.share_pct}%`, background: chanColor(c.payment_channel) }" />
            </div>
            <span class="chan-val">{{ c.share_pct.toFixed(1) }}%</span>
          </div>
          <div v-if="!fareChannels.length && !loading" style="font-size:13px;color:#94a3b8">No channel data.</div>
        </div>
      </div>

      <!-- On-time by route -->
      <div class="card" style="margin-top:12px">
        <div class="card-header">Schedule Adherence by Route</div>
        <div class="card-body">
          <div v-for="ot in onTime" :key="ot.route__route_name ?? ot.route_id" class="chan-row">
            <span class="chan-label" style="font-size:11px">{{ ot.route__route_name ?? ot.route_id }}</span>
            <div class="chan-bar-wrap">
              <div
                class="chan-bar"
                :style="{
                  width: `${ot.on_time_pct}%`,
                  background: ot.on_time_pct >= 85 ? '#22c55e' : ot.on_time_pct >= 70 ? '#f59e0b' : '#ef4444',
                }"
              />
            </div>
            <span class="chan-val">{{ ot.on_time_pct.toFixed(1) }}%</span>
          </div>
          <div v-if="!onTime.length && !loading" style="font-size:13px;color:#94a3b8">No adherence data.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Revenue trend bar chart -->
  <SectionTitle pill="BebaPay / NTSA · 24h">Revenue Trend (Last 24h)</SectionTitle>

  <div class="card">
    <div class="card-body">
      <TrendLineChart
        :points="fareTrendPoints"
        color="#22c55e"
        :height="180"
        :format-value="v => fmtKES(v)"
        :empty-text="loading ? 'Loading…' : 'No revenue data'"
      />
    </div>
  </div>

  <!-- Operator leaderboard + Expiring licenses -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">
        Operator Leaderboard
        <NuxtLink to="/public-transport/operators" class="link-sm">View all →</NuxtLink>
      </div>
      <div class="card-body">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>SACCO</th>
              <th>On-Time</th>
              <th>Revenue</th>
              <th>Util %</th>
            </tr>
          </thead>
          <tbody v-if="leaderboard.length">
            <tr v-for="op in leaderboard.slice(0,8)" :key="op.id">
              <td style="font-weight:700;color:#94a3b8">#{{ op.rank_position }}</td>
              <td style="font-weight:600">{{ op.sacco_name ?? op.sacco }}</td>
              <td>
                <span :style="{ color: op.on_time_pct >= 80 ? '#22c55e' : '#f59e0b' }">
                  {{ op.on_time_pct.toFixed(1) }}%
                </span>
              </td>
              <td style="font-size:12px">{{ fmtKES(Number(op.revenue_kes)) }}</td>
              <td style="font-size:12px">{{ op.fleet_utilization_pct.toFixed(0) }}%</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr>
              <td colspan="5" style="text-align:center;color:#94a3b8;padding:14px">{{ loading ? 'Loading…' : 'No data' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        Expiring PSV Licences (90d)
        <NuxtLink to="/public-transport/compliance" class="link-sm">Manage →</NuxtLink>
      </div>
      <div class="card-body">
        <div v-if="expiringLicenses.length">
          <AlertItem
            v-for="l in expiringLicenses.slice(0, 6)"
            :key="l.license_number"
            :severity="daysUntil(l.expiry_date) <= 30 ? 'critical' : daysUntil(l.expiry_date) <= 60 ? 'warning' : 'info'"
            :title="l.sacco__sacco_name ?? l.license_number"
            :meta="`Expires ${fmtDate(l.expiry_date)} · ${daysUntil(l.expiry_date)}d remaining`"
          />
        </div>
        <div v-else style="font-size:13px;color:#94a3b8">
          {{ loading ? 'Loading…' : 'No licences expiring in the next 90 days.' }}
        </div>
      </div>
    </div>
  </div>

  <!-- Feedback by category -->
  <SectionTitle pill="Passenger Feedback">Feedback Categories</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="feedbackByCategory.length" class="feedback-grid">
        <div v-for="f in feedbackByCategory" :key="f.category" class="fb-row">
          <span class="fb-label">{{ f.category.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) }}</span>
          <div class="fb-bar-wrap">
            <div class="fb-bar" :style="{ width: `${maxFeedback > 0 ? (f.total / maxFeedback) * 100 : 0}%` }" />
          </div>
          <span class="fb-meta">{{ fmtNum(f.total) }} · {{ f.avg_rating?.toFixed(1) ?? '-' }}★</span>
        </div>
      </div>
      <div v-else style="font-size:13px;color:#94a3b8">{{ loading ? 'Loading…' : 'No feedback data' }}</div>
    </div>
  </div>

  <!-- Demand forecast 24h -->
  <SectionTitle pill="AI Forecast · NaMATA">Demand Forecast (Next 24h)</SectionTitle>

  <div class="card">
    <div class="card-body">
      <TrendLineChart
        :points="demandForecastPoints"
        color="#8b5cf6"
        :height="180"
        :format-value="v => fmtNum(v)"
        :empty-text="loading ? 'Loading…' : 'No forecast data'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Public Transport')

import { usePublicTransport, useGis } from '~/composables/api'
import type { PTSummary, OperatorMetric } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'

type LineSpec   = { id: string; points: [number, number][]; color?: string; weight?: number; opacity?: number; label?: string }
type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

const summary          = ref<PTSummary | null>(null)
const leaderboard      = ref<OperatorMetric[]>([])
const fareTrend        = ref<{ collected_hour: string; total_kes: number; transactions: number }[]>([])
const fareChannels     = ref<{ payment_channel: string; total_kes: number; transactions: number; share_pct: number }[]>([])
const onTime           = ref<any[]>([])
const feedbackByCategory = ref<{ category: string; total: number; avg_rating: number }[]>([])
const expiringLicenses = ref<any[]>([])
const mapLines         = ref<LineSpec[]>([])
const mapMarkers       = ref<MarkerSpec[]>([])
const roadsGeo         = ref<GeoJSONFeatureCollection | null>(null)
const loading          = ref(true)
const error            = ref<string | null>(null)
const lastRefreshed    = ref('-')

async function load() {
  loading.value = true
  error.value = null
  const pt  = usePublicTransport()
  const gis = useGis()

  const [sumRes, lbRes, revRes, chanRes, otRes, fbcRes, licRes, mapRes, roadsRes] = await Promise.allSettled([
    pt.summary(),
    pt.leaderboard(),
    pt.revenueTrend(7),
    pt.revenueByChannel(7),
    pt.onTimeStats(7),
    pt.feedbackByCategory(),
    pt.expiringLicenses(90),
    pt.mapData(),
    gis.roads({ limit: 300, simplify: 0.02 }),
  ])

  if (sumRes.status  === 'fulfilled') {
    summary.value         = sumRes.value
    expiringLicenses.value = sumRes.value.expiring_licences ?? []
    feedbackByCategory.value = sumRes.value.feedback_by_category ?? []
  }
  if (lbRes.status   === 'fulfilled') leaderboard.value       = (lbRes.value as any).results ?? []
  if (revRes.status  === 'fulfilled') fareTrend.value         = ((revRes.value as any).results ?? []).slice(-24)
  if (chanRes.status === 'fulfilled') fareChannels.value      = (chanRes.value as any).results ?? []
  if (otRes.status   === 'fulfilled') onTime.value            = ((otRes.value as any).results ?? []).slice(0, 8)
  if (fbcRes.status  === 'fulfilled' && !(feedbackByCategory.value.length)) feedbackByCategory.value = (fbcRes.value as any).results ?? []
  if (licRes.status  === 'fulfilled' && !(expiringLicenses.value.length)) expiringLicenses.value = (Array.isArray(licRes.value) ? licRes.value : (licRes.value as any).results ?? [])
  if (mapRes.status  === 'fulfilled') { mapLines.value = mapRes.value.lines; mapMarkers.value = mapRes.value.markers }
  if (roadsRes.status === 'fulfilled') roadsGeo.value = roadsRes.value

  if ([sumRes, lbRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Public Transport API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ─────────────────────────────────────────────────────────────
const maxFeedback = computed(() => Math.max(1, ...feedbackByCategory.value.map(f => f.total ?? 0)))
const demandForecast = computed(() => summary.value?.demand_forecast_24h ?? [])

const fareTrendPoints = computed(() =>
  fareTrend.value.map(f => ({ label: fmtHour(f.collected_hour), value: f.total_kes ?? 0 })),
)
const demandForecastPoints = computed(() =>
  demandForecast.value.map(d => ({ label: fmtHour(d.target_at), value: d.total_predicted ?? 0 })),
)

// ── Helpers ──────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(n: number | null | undefined) {
  if (n == null) return '-'
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `KES ${(n / 1_000).toFixed(1)}k`
  return `KES ${Math.round(n).toLocaleString()}`
}
function fmtHour(iso: string) {
  try { return new Date(iso).getHours().toString().padStart(2, '0') + ':00' } catch { return iso }
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function freshnessLabel(iso: string | undefined) {
  if (!iso) return 'Live'
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    return mins < 2 ? 'Live' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`
  } catch { return 'Live' }
}
function daysUntil(dateStr: string): number {
  try { return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000) }
  catch { return 999 }
}
function chanColor(ch: string) {
  const m: Record<string,string> = { bebapay:'#f97316', mpesa:'#22c55e', cash:'#94a3b8', card:'#3b82f6', other:'#a855f7' }
  return m[ch] ?? '#64748b'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col, .two-col-map { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid #f1f5f9; }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.side-col { display:flex; flex-direction:column; overflow-y:auto; max-height:508px; gap:0; }
.chan-row { display:grid; grid-template-columns:110px 1fr 50px; align-items:center; gap:8px; padding:4px 0; }
.chan-label { font-size:12px; text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.chan-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.chan-bar { height:100%; border-radius:4px; transition:width .4s; }
.chan-val { font-size:11px; text-align:right; }
.feedback-grid { display:flex; flex-direction:column; gap:8px; }
.fb-row { display:grid; grid-template-columns:160px 1fr 100px; align-items:center; gap:8px; }
.fb-label { font-size:13px; }
.fb-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.fb-bar { height:100%; background:#3b82f6; border-radius:4px; }
.fb-meta { font-size:12px; text-align:right; }
.link-sm { font-size:12px; color:#3b82f6; text-decoration:none; }
</style>
