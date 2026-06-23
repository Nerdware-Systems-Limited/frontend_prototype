<script setup lang="ts">
// pages/public-transport.vue — M04 Public Transport Operations
// FR-M04-001..014: route coverage, BRT dashboard, schedule adherence,
// fare analytics, demand forecasts, service quality, operator leaderboard,
// BebaPay payments, fleet deployments, passenger feedback, PSV licensing.

definePageMeta({ title: 'Public Transport' })

import { usePublicTransport } from '~/composables/api'
import type {
  PTSummary, Sacco, Route, BRTStop, FareCollection, OperatorMetric,
  ScheduleAdherence, PassengerFeedback, PSVLicense, ServiceType,
} from '~/composables/api'

const pt = usePublicTransport()

const summary = ref<PTSummary | null>(null)
const routes = ref<Route[]>([])
const saccos = ref<Sacco[]>([])
const brtStops = ref<BRTStop[]>([])
const leaderboard = ref<OperatorMetric[]>([])
const fareTrend = ref<{ collected_hour: string; total_kes: number; transactions: number }[]>([])
const fareChannels = ref<{ payment_channel: string; total_kes: number; transactions: number; share_pct: number }[]>([])
const onTime = ref<{ route__route_name: string; on_time_pct: number; total: number }[]>([])
const feedback = ref<PassengerFeedback[]>([])
const feedbackByCategory = ref<{ category: string; total: number; avg_rating: number }[]>([])
const licenses = ref<PSVLicense[]>([])
const mapLines = ref<any[]>([])
const mapMarkers = ref<any[]>([])

const loading = ref(true)
const error = ref<string | null>(null)
const serviceFilter = ref<ServiceType | 'all'>('all')

async function load() {
  loading.value = true
  error.value = null
  try {
    const [sm, rts, scs, stops, lb, rev, chan, ot, fb, fbc, lic] = await Promise.all([
      pt.summary(),
      pt.routes({ page_size: 50 }),
      pt.saccos({ page_size: 12 }),
      pt.brtStops({ page_size: 24 }),
      pt.leaderboard(),
      pt.revenueTrend(7),
      pt.revenueByChannel(7),
      pt.onTimeStats(7),
      pt.feedback({ page_size: 8 }),
      pt.feedbackByCategory(),
      pt.expiringLicenses(180),
    ])
    summary.value = sm
    routes.value = (rts as any).results ?? []
    saccos.value = (scs as any).results ?? []
    brtStops.value = (stops as any).results ?? []
    leaderboard.value = lb.results ?? []
    fareTrend.value = (rev.results ?? []).slice(-24)
    fareChannels.value = chan.results ?? []
    onTime.value = (ot.results ?? []).slice(0, 8)
    feedback.value = (fb as any).results ?? []
    feedbackByCategory.value = fbc.results ?? []
    licenses.value = (lic as any).results ?? []

    // Map: routes as polylines + BRT stops as markers.
    try {
      const md = await pt.mapData()
      mapLines.value = md.lines
      mapMarkers.value = md.markers
    } catch {
      mapLines.value = []
      mapMarkers.value = []
    }
  } catch (err: any) {
    error.value = err?.status === 401
      ? 'Sign in to view public transport data.'
      : err?.status === 404
        ? 'Public-transport endpoints not mounted — restart the backend after migrations.'
        : err?.message ?? 'Failed to load public transport data.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

// ── Helpers ────────────────────────────────────────────────────────────
function fmtKES(n: number) {
  if (n >= 1_000_000) return 'KES ' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return 'KES ' + (n / 1_000).toFixed(1) + 'k'
  return 'KES ' + Math.round(n).toLocaleString()
}
function fmtTime(iso?: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }) }
  catch { return iso }
}
function fmtHour(iso: string) {
  try { return new Date(iso).getHours().toString().padStart(2, '0') + ':00' } catch { return iso }
}
function badgeClass(s: string) {
  return s === 'active' ? 'success' : s === 'expired' ? 'danger' : 'neutral'
}

// Compute revenue chart.
const maxRev = computed(() => Math.max(1, ...fareTrend.value.map(f => f.total_kes ?? 0)))
const revBars = computed(() => fareTrend.value.map((f, i, arr) => ({
  x: (i / Math.max(1, arr.length - 1)) * 100,
  h: ((f.total_kes ?? 0) / maxRev.value) * 100,
  hour: fmtHour(f.collected_hour),
  rev: f.total_kes,
})))

const filteredRoutes = computed(() => {
  if (serviceFilter.value === 'all') return routes.value.slice(0, 12)
  return routes.value.filter(r => r.service_type === serviceFilter.value).slice(0, 12)
})
</script>

<template>
  <div class="pt-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M04</div>
        <h1 class="text-display">Public Transport Operations</h1>
        <p class="text-sm text-fg-muted mt-1">
          NaMATA BRT &amp; matatu oversight · Schedule adherence · Fare analytics ·
          Service quality · Operator ranking · Cashless payments · Passenger feedback
        </p>
      </div>
      <button class="btn btn-secondary" @click="load" :disabled="loading">
        <span v-if="loading">Refreshing…</span><span v-else>Refresh</span>
      </button>
    </div>

    <!-- Loading / error -->
    <div v-if="loading && !summary" class="card">
      <div class="card-body text-fg-muted">Loading /api/v1/public-transport/…</div>
    </div>
    <div v-else-if="error" class="card">
      <div class="card-body text-fg-muted">{{ error }}</div>
    </div>

    <!-- Live Map: routes + BRT stops across Nairobi.
         Built with Leaflet via the reusable UAPTSMap component. -->
    <div class="card map-card">
      <div class="card-header">
        <div>
          <div class="text-subhead">Nairobi Public Transport Map</div>
          <div class="text-xs text-fg-muted">
            BRT routes (orange) · Matatu/PSV routes (blue) · BRT stops ·
            {{ mapLines.length }} routes · {{ mapMarkers.length }} stops
          </div>
        </div>
      </div>
      <ClientOnly>
        <UaptsMap
          :lines="mapLines"
          :markers="mapMarkers"
          height="560px"
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
        <div class="text-label text-fg-dim">Active SACCOs</div>
        <div class="kpi-value">{{ summary.kpis.active_saccos }}</div>
        <div class="text-xs text-fg-muted mt-1">Registered PSV operators</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Active Routes</div>
        <div class="kpi-value">{{ summary.kpis.active_routes }}</div>
        <div class="text-xs text-fg-muted mt-1">
          {{ summary.kpis.brt_routes }} BRT · {{ summary.kpis.matatu_routes }} matatu
        </div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Revenue (24h)</div>
        <div class="kpi-value">{{ fmtKES(summary.kpis.revenue_24h_kes) }}</div>
        <div class="text-xs text-fg-muted mt-1">All payment channels</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Passenger Trips (24h)</div>
        <div class="kpi-value">{{ summary.kpis.passenger_trips_24h.toLocaleString() }}</div>
        <div class="text-xs text-fg-muted mt-1">Total boardings</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">On-Time Performance</div>
        <div class="kpi-value">{{ summary.on_time_pct.toFixed(1) }}%</div>
        <div class="text-xs text-fg-muted mt-1">±3 min · 7-day window</div>
      </div>
    </div>

    <!-- Revenue chart -->
    <div v-if="summary" class="card chart-card">
      <div class="card-header">
        <div>
          <div class="text-subhead">Revenue Trend · Last 24h</div>
          <div class="text-xs text-fg-muted">Sum across all routes and payment channels</div>
        </div>
      </div>
      <div class="chart-area">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="chart-svg" style="height:160px;width:100%">
          <g v-for="(b, i) in revBars" :key="i">
            <rect :x="b.x - 1.5" :y="100 - b.h" width="3" :height="b.h" fill="#10b981" opacity="0.85" rx="0.4"/>
          </g>
        </svg>
        <div class="chart-axis">
          <span v-for="(b, i) in revBars" :key="i" class="chart-tick" v-show="i % 4 === 0">{{ b.hour }}</span>
        </div>
      </div>
    </div>

    <!-- Map view: routes + stops -->
    <ClientOnly>
      <div class="card" style="padding: 0; overflow: hidden">
        <div class="card-header" style="padding: 12px 18px">
          <div>
            <div class="text-subhead">Live Map · Routes &amp; Stops</div>
            <div class="text-xs text-fg-muted">FR-M04-001/002 · Digital Matatus GTFS · PostGIS LineStrings</div>
          </div>
          <NuxtLink to="/kenya-map" class="btn btn-ghost text-xs">Full map →</NuxtLink>
        </div>
        <UaptsMap
          :layers="['kenya', 'routes', 'brt-stops']"
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

    <!-- Two-col: payment channels + leaderboard -->
    <div v-if="summary" class="two-col">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Fare Revenue by Channel</div>
          <span class="text-xs text-fg-muted">FR-M04-010 · 7d</span>
        </div>
        <div class="card-body">
          <div v-for="c in fareChannels" :key="c.payment_channel" class="bar-row">
            <span class="bar-label">{{ c.payment_channel }}</span>
            <div class="bar-track">
              <div class="bar-fill bar-success" :style="{ width: c.share_pct + '%' }"></div>
            </div>
            <span class="bar-value">{{ c.share_pct.toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Operator Leaderboard</div>
          <span class="text-xs text-fg-muted">FR-M04-009 · Composite score</span>
        </div>
        <div class="leaderboard-list">
          <div v-for="op in leaderboard.slice(0, 8)" :key="op.id" class="lb-row">
            <span class="lb-rank">#{{ op.rank_position }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ op.sacco_name }}</div>
              <div class="text-xs text-fg-muted">
                On-time {{ op.on_time_pct.toFixed(1) }}% · {{ op.fleet_utilization_pct.toFixed(0) }}% util
              </div>
            </div>
            <span class="lb-revenue">{{ fmtKES(Number(op.revenue_kes)) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- On-time + Feedback -->
    <div v-if="summary" class="two-col">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Schedule Adherence by Route</div>
          <span class="text-xs text-fg-muted">FR-M04-004 · 7d</span>
        </div>
        <div class="card-body">
          <div v-if="!onTime.length" class="text-fg-muted text-sm">No data.</div>
          <div v-for="ot in onTime" :key="ot.route__route_name" class="bar-row">
            <span class="bar-label truncate">{{ ot.route__route_name }}</span>
            <div class="bar-track">
              <div class="bar-fill" :class="ot.on_time_pct > 85 ? 'bar-success' : ot.on_time_pct > 70 ? 'bar-info' : 'bar-warning'"
                :style="{ width: ot.on_time_pct + '%' }"></div>
            </div>
            <span class="bar-value">{{ ot.on_time_pct.toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Passenger Feedback</div>
          <span class="text-xs text-fg-muted">FR-M04-014</span>
        </div>
        <div class="card-body">
          <div v-for="f in feedbackByCategory" :key="f.category" class="bar-row">
            <span class="bar-label">{{ f.category.replace('_', ' ') }}</span>
            <div class="bar-track">
              <div class="bar-fill bar-info" :style="{ width: Math.min(100, (f.total / 10) * 100) + '%' }"></div>
            </div>
            <span class="bar-value">{{ f.total }} · {{ f.avg_rating?.toFixed(1) }}★</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Routes grid (with service_type filter) -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="text-subhead">Routes · NaMATA &amp; NTSA</div>
          <span class="text-xs text-fg-muted">FR-M04-001 · Coverage &amp; frequency</span>
        </div>
        <div class="flex gap-1">
          <button v-for="f in ['all','brt','matatu']" :key="f"
            class="btn btn-ghost text-xs py-1 px-2"
            :class="{ 'bg-card-hover': serviceFilter === f }"
            @click="serviceFilter = f as any">{{ f }}</button>
        </div>
      </div>
      <div class="card-body">
        <table class="data-table">
          <thead>
            <tr><th>Route</th><th>SACCO</th><th>Type</th><th>Fare</th><th>Distance</th><th>Stops</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in filteredRoutes" :key="r.id">
              <td class="font-medium">{{ r.route_name }}</td>
              <td>{{ r.sacco_name || '—' }}</td>
              <td><span class="badge" :class="r.service_type === 'brt' ? 'badge-info' : 'badge-neutral'">{{ r.service_type.toUpperCase() }}</span></td>
              <td>KES {{ Number(r.fare_kes).toFixed(0) }}</td>
              <td>{{ r.distance_km.toFixed(1) }} km</td>
              <td>{{ r.stop_count }}</td>
              <td><span class="badge" :class="r.is_active ? 'badge-success' : 'badge-neutral'">{{ r.is_active ? 'active' : 'inactive' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- SACCOs + BRT stops -->
    <div class="two-col">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">SACCOs · Matatu/PSV Operators</div>
          <span class="text-xs text-fg-muted">FR-M04-007/009</span>
        </div>
        <div class="card-body">
          <table class="data-table">
            <thead><tr><th>SACCO</th><th>Routes</th><th>Fleet</th><th>Quality</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="s in saccos" :key="s.id">
                <td class="font-medium">{{ s.sacco_name }}</td>
                <td>{{ s.route_count }}</td>
                <td>{{ s.fleet_size }}</td>
                <td>{{ s.service_quality_score.toFixed(0) }}</td>
                <td>
                  <span class="badge" :class="`badge-${badgeClass(s.registration_status)}`">{{ s.registration_status }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="text-subhead">BRT Stops · Nairobi Network</div>
          <span class="text-xs text-fg-muted">FR-M04-002 · From Digital Matatus GIS</span>
        </div>
        <div class="brt-grid">
          <div v-for="b in brtStops.slice(0, 12)" :key="b.id" class="brt-cell">
            <div class="text-sm font-medium truncate">{{ b.stop_name }}</div>
            <div class="text-xs text-fg-muted font-mono">{{ b.stop_id }}</div>
            <div class="text-xs text-fg-muted mt-1">
              {{ b.avg_boarding_count }} boardings · {{ b.avg_dwell_seconds }}s dwell
            </div>
            <div class="brt-meta">
              <span v-if="b.has_shelter" title="Has shelter">⛱</span>
              <span v-if="b.has_ticket_machine" title="Has ticket machine">🎫</span>
              <span :title="`Accessibility ${(b.accessibility_score*100).toFixed(0)}%`">{{ (b.accessibility_score*100).toFixed(0) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Passenger feedback list -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Recent Passenger Feedback</div>
        <span class="text-xs text-fg-muted">FR-M04-014</span>
      </div>
      <div v-if="!feedback.length" class="card-body text-fg-muted">No feedback yet.</div>
      <div v-else class="event-list">
        <div v-for="f in feedback" :key="f.id" class="event-row">
          <span class="badge" :class="badgeClass(f.status)">{{ f.category }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ f.text || '(no comment)' }}</div>
            <div class="text-xs text-fg-muted">{{ f.route_name || '—' }} · {{ f.sacco_name || '—' }}</div>
          </div>
          <span class="text-xs text-fg-dim">{{ f.rating }}★</span>
        </div>
      </div>
    </div>

    <!-- Expiring PSV licences -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">PSV Licences Expiring Soon</div>
        <span class="text-xs text-fg-muted">FR-M04-003 · Next 180 days</span>
      </div>
      <div v-if="!licenses.length" class="card-body text-fg-muted">No licences expiring soon.</div>
      <table v-else class="data-table">
        <thead><tr><th>Licence</th><th>SACCO</th><th>Expiry</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="l in licenses.slice(0, 10)" :key="l.id">
            <td class="font-mono text-xs">{{ l.license_number }}</td>
            <td>{{ l.sacco_name || '—' }}</td>
            <td>{{ fmtTime(l.expiry_date) }}</td>
            <td><span class="badge" :class="badgeClass(l.status)">{{ l.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.pt-page { display: flex; flex-direction: column; gap: 18px; }
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.kpi-card { padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.kpi-value { font-size: 26px; font-weight: 600; line-height: 1.1; }
.two-col {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
}
@media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
.chart-card .chart-area { padding: 0 18px 12px; }
.chart-axis {
  display: flex; justify-content: space-between;
  font-size: 10px; color: var(--fg-muted);
  padding: 4px 0 12px;
}
.bar-row {
  display: grid; grid-template-columns: 110px 1fr 100px; align-items: center;
  gap: 10px; padding: 4px 0;
}
.bar-label { font-size: 12px; color: var(--fg-muted); text-transform: capitalize; }
.bar-track { height: 10px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; }
.bar-success { background: #10b981; }
.bar-info { background: #3b82f6; }
.bar-warning { background: #f59e0b; }
.bar-danger { background: #ef4444; }
.bar-value { font-size: 12px; text-align: right; font-variant-numeric: tabular-nums; }
.leaderboard-list { padding: 4px 0; }
.lb-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.lb-rank { font-weight: 600; color: var(--fg-muted); width: 28px; font-variant-numeric: tabular-nums; }
.lb-revenue { font-size: 12px; font-weight: 500; }
.event-list { padding: 4px 0; }
.event-row { display: flex; align-items: center; gap: 12px; padding: 10px 18px; }
.brt-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px; padding: 14px 18px;
}
.brt-cell {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px; padding: 10px;
}
.brt-meta { display: flex; gap: 6px; font-size: 11px; color: var(--fg-muted); margin-top: 6px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.data-table th { text-align: left; padding: 8px 6px; color: var(--fg-muted); border-bottom: 1px solid rgba(255,255,255,0.06); font-weight: 500; font-size: 11px; text-transform: uppercase; }
.data-table td { padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.card-body { padding: 14px 18px; }
</style>