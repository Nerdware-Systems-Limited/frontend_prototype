<template>
  <PageHeader
    eyebrow="Railway Management (KRC)"
    title="Railway Operations"
    subtitle="KRC · KPA · KenTrade · NCTTCA - SGR &amp; MGR ridership, freight manifests, KPA port-rail reconciliation, KenTrade cargo, and NCTTCA corridor KPIs"
  >
    <template #actions>
      <BadgePill v-if="summary" variant="info">
        {{ fmtNum(summary.kpis.trains_in_service) }} trains live
      </BadgePill>
      <NuxtLink to="/railway/network-inventory" class="btn">Network Inventory →</NuxtLink>
      <NuxtLink to="/railway/safety" class="btn">Rail Safety →</NuxtLink>
      <NuxtLink to="/railway/live" class="btn-primary">Live Operations →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Legacy system EOL alerts - always shown -->
  <!-- <div class="eol-banner">
    <AlertItem
      severity="warning"
      title="MGR Translogic System - End of Life"
      meta="Data-continuity risk: Translogic is beyond vendor support. Revenue and operational data may be lost if the system fails before migration. Contact ICT for migration timeline."
    />
    <AlertItem
      severity="warning"
      title="MGR ATW Ticketing System - End of Life"
      meta="Data-continuity risk: ATW ticketing is EOL. Ticketing reconciliation data should be backed up manually until UAPTS integration is complete."
    />
  </div> -->

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Active Rail Lines"
      :value="summary ? `${fmtNum(summary.kpis.sgr_lines)} SGR / ${fmtNum(summary.kpis.mgr_lines)} MGR` : '-'"
      :sub="`${fmtNum(summary?.kpis.total_lines ?? null)} total`"
      source="batch" source-title="KRC"
    />
    <KpiCard
      label="Trains in Service"
      :value="summary ? fmtNum(summary.kpis.trains_in_service) : '-'"
      :sub="`of ${fmtNum(summary?.kpis.total_trains ?? null)} fleet`"
      source="live" source-title="KRC OCC"
    />
    <KpiCard
      label="Operations (24h)"
      :value="summary ? fmtNum(summary.kpis.operations_24h) : '-'"
      sub="Trains run today"
      trend-direction="up"
      source="live" source-title="KRC OCC"
    />
    <KpiCard
      label="On-Time Performance"
      :value="summary ? `${summary.on_time_30d.on_time_pct.toFixed(1)}%` : '-'"
      :sub="summary ? `Avg delay ${summary.on_time_30d.avg_delay_min.toFixed(0)} min (30d)` : '-'"
      :trend-direction="summary && summary.on_time_30d.on_time_pct >= 85 ? 'up' : 'down'"
      source="batch" source-title="KRC OCC"
    />
    <KpiCard
      label="Passenger Bookings (30d)"
      :value="summary ? fmtNum(summary.kpis.passenger_bookings_30d) : '-'"
      :sub="summary ? `KES ${fmtKES(summary.ridership_30d.revenue_kes)}` : '-'"
      trend-direction="up"
      source="batch" source-title="KRC"
    />
    <KpiCard
      label="Freight Shipments (30d)"
      :value="summary ? fmtNum(summary.kpis.freight_30d_shipments) : '-'"
      :sub="summary ? `${fmtNum(summary.freight_30d.total_tons)} tons` : '-'"
      trend-direction="up"
      source="batch" source-title="KRC"
    />
    <KpiCard
      label="No-Show Rate"
      :value="summary ? `${summary.ridership_30d.no_show_rate_pct.toFixed(1)}%` : '-'"
      sub="Passengers (30d)"
      :trend-direction="summary && summary.ridership_30d.no_show_rate_pct < 5 ? 'up' : 'down'"
      source="batch" source-title="KRC"
    />
    <KpiCard
      label="Open Incidents"
      :value="summary ? fmtNum(summary.kpis.open_incidents) : '-'"
      :sub="summary ? `${fmtNum(summary.incidents_90d.casualties)} casualties (90d)` : '-'"
      :trend-direction="summary && summary.kpis.open_incidents === 0 ? 'up' : 'down'"
      source="live" source-title="KRC Safety"
    />
  </div>

  <!-- Rail map + live operations -->
  <div class="two-col-map">
    <div class="card map-card">
      <div class="card-header">SGR & MGR Network Map</div>
      <ClientOnly>
        <UaptsMap
          :markers="mapData.markers"
          :lines="mapData.lines"
          :center="[-0.5, 37.5]"
          :zoom="6"
          height="480px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="line-seg" style="background:#3b82f6" /> SGR</span>
        <span class="mk"><span class="line-seg" style="background:#10b981" /> MGR</span>
        <span class="mk"><span class="line-seg" style="background:#f59e0b" /> Uganda Railway</span>
        <span class="mk"><span class="dot" style="background:#ef4444" /> Terminal / Interchange</span>
        <span class="mk"><span class="dot" style="background:#3b82f6" /> SGR Station</span>
        <span class="mk"><span class="dot" style="background:#10b981" /> MGR Station</span>
      </div>
    </div>

    <div class="right-col">
      <!-- OTP summary card -->
      <div class="card">
        <div class="card-header">On-Time Performance - 30d</div>
        <div class="card-body" v-if="summary">
          <div class="otp-big">{{ summary.on_time_30d.on_time_pct.toFixed(1) }}%</div>
          <div class="otp-bar-wrap">
            <div class="otp-bar" :style="{
              width: `${summary.on_time_30d.on_time_pct}%`,
              background: summary.on_time_30d.on_time_pct >= 85 ? '#22c55e' : summary.on_time_30d.on_time_pct >= 70 ? '#f59e0b' : '#ef4444'
            }" />
          </div>
          <div class="otp-stats">
            <div><span class="stat-label">Total Ops</span><span>{{ fmtNum(summary.on_time_30d.total_operations) }}</span></div>
            <div><span class="stat-label">Delayed</span><span>{{ fmtNum(summary.on_time_30d.delayed) }}</span></div>
            <div><span class="stat-label">Cancelled</span><span>{{ fmtNum(summary.on_time_30d.cancelled) }}</span></div>
            <div><span class="stat-label">Avg Delay</span><span>{{ summary.on_time_30d.avg_delay_min.toFixed(0) }} min</span></div>
          </div>
        </div>
        <div v-else class="card-body" style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No OTP data' }}</div>
      </div>

      <!-- Ridership summary -->
      <div class="card stack-card">
        <div class="card-header">Ridership & Revenue (30d)</div>
        <div class="card-body" v-if="summary">
          <div class="rid-stat-row">
            <div><span class="stat-label">Bookings</span><span class="rid-val">{{ fmtNum(summary.ridership_30d.bookings) }}</span></div>
            <div><span class="stat-label">Passengers</span><span class="rid-val">{{ fmtNum(summary.ridership_30d.passengers) }}</span></div>
            <div><span class="stat-label">Revenue</span><span class="rid-val">KES {{ fmtKES(summary.ridership_30d.revenue_kes) }}</span></div>
          </div>
        </div>
        <div v-else class="card-body empty-cell">{{ loading ? 'Loading…' : 'No ridership data' }}</div>
      </div>

      <!-- Freight summary -->
      <div class="card stack-card">
        <div class="card-header">
          Freight Summary (30d)
          <NuxtLink to="/railway/freight" class="link-sm">Details →</NuxtLink>
        </div>
        <div class="card-body" v-if="summary">
          <div class="rid-stat-row freight-stats">
            <div><span class="stat-label">Shipments</span><span class="rid-val">{{ fmtNum(summary.freight_30d.shipments) }}</span></div>
            <div><span class="stat-label">Total Tons</span><span class="rid-val">{{ fmtNum(summary.freight_30d.total_tons) }}</span></div>
            <div><span class="stat-label">Revenue</span><span class="rid-val">KES {{ fmtKES(summary.freight_30d.total_revenue_kes) }}</span></div>
          </div>
          <div class="mini-section-head">Top Corridors</div>
          <div class="corridor-list">
            <div v-for="c in summary.freight_30d.top_corridors.slice(0,4)" :key="`${c.origin_station__code}-${c.destination_station__code}`" class="corridor-row">
              <span class="corridor-route">{{ c.origin_station__code }} → {{ c.destination_station__code }}</span>
              <BadgePill variant="neutral">{{ c.cargo_type.replace(/_/g,' ') }}</BadgePill>
              <span class="corridor-stat">{{ fmtNum(c.tons) }}t</span>
            </div>
          </div>
        </div>
        <div v-else class="card-body empty-cell">{{ loading ? 'Loading…' : 'No freight data' }}</div>
      </div>

      <!-- Safety -->
      <div class="card stack-card">
        <div class="card-header">
          Safety Summary (90d)
          <NuxtLink to="/railway/safety" class="link-sm">Details →</NuxtLink>
        </div>
        <div class="card-body" v-if="summary">
          <div class="rid-stat-row">
            <div>
              <span class="stat-label">Incidents</span>
              <span class="rid-val" :class="summary.incidents_90d.total > 0 ? 'val-warn' : 'val-ok'">{{ summary.incidents_90d.total }}</span>
            </div>
            <div>
              <span class="stat-label">Fatal</span>
              <span class="rid-val" :class="summary.incidents_90d.fatal > 0 ? 'val-danger' : 'val-ok'">{{ summary.incidents_90d.fatal }}</span>
            </div>
            <div><span class="stat-label">Casualties</span><span class="rid-val">{{ summary.incidents_90d.casualties }}</span></div>
            <div><span class="stat-label">Level Crossing</span><span class="rid-val">{{ summary.incidents_90d.level_crossing }}</span></div>
          </div>
        </div>
        <div v-else class="card-body empty-cell">{{ loading ? 'Loading…' : 'No safety data' }}</div>
      </div>
    </div>
  </div>

  <!-- Live operations table -->
  <SectionTitle pill="KRC OCC · Live">Live Train Operations</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Train</th>
            <th>Route</th>
            <th>Status</th>
            <th>Current Station</th>
            <th>Delay (Arr)</th>
            <th>Delay Reason</th>
            <th>Occupancy</th>
          </tr>
        </thead>
        <tbody v-if="liveOps.length">
          <tr v-for="op in liveOps" :key="op.id">
            <td style="font-family:monospace;font-weight:700">{{ op.train_number }}</td>
            <td style="font-size:12px">{{ op.origin_code }} → {{ op.destination_code }}</td>
            <td><BadgePill :variant="opBadge(op.status)">{{ op.status.replace(/_/g,' ') }}</BadgePill></td>
            <td style="font-size:12px;font-family:monospace">{{ op.current_station_code ?? '-' }}</td>
            <td :style="{ color: op.delay_arrival_min > 30 ? '#ef4444' : op.delay_arrival_min > 0 ? '#f59e0b' : '#22c55e', fontWeight:'600' }">
              {{ op.delay_arrival_min > 0 ? `+${op.delay_arrival_min} min` : 'On time' }}
            </td>
            <td style="font-size:12px;text-transform:capitalize">{{ (op as any).delay_reason?.replace(/_/g,' ') ?? '-' }}</td>
            <td>
              <div v-if="(op as any).occupancy_pct != null" class="occ-wrap">
                <div class="occ-bar" :style="{ width: `${(op as any).occupancy_pct}%`, background: (op as any).occupancy_pct >= 90 ? '#ef4444' : (op as any).occupancy_pct >= 70 ? '#f59e0b' : '#22c55e' }" />
              </div>
              <span style="font-size:11px">{{ (op as any).occupancy_pct != null ? `${(op as any).occupancy_pct.toFixed(0)}%` : '-' }}</span>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading live operations…' : 'No live train operations.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Top routes -->
  <SectionTitle pill="KRC Ticketing · 30d">Top Routes by Ridership</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Origin</th>
            <th>Destination</th>
            <th>Bookings</th>
            <th>Revenue (KES)</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody v-if="topRoutes.length">
          <tr v-for="r in topRoutes" :key="`${r.origin__code}-${r.destination__code}`">
            <td style="font-weight:600">{{ r.origin__name }} <span style="font-size:11px;color:#94a3b8">({{ r.origin__code }})</span></td>
            <td>{{ r.destination__name }} <span style="font-size:11px;color:#94a3b8">({{ r.destination__code }})</span></td>
            <td style="font-weight:700">{{ fmtNum(r.bookings) }}</td>
            <td>{{ fmtKES(r.revenue) }}</td>
            <td>
              <div class="share-bar-wrap">
                <div class="share-bar" style="background:#3b82f6"
                  :style="{ width: `${maxBookings > 0 ? (r.bookings / maxBookings) * 100 : 0}%` }" />
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No route data.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Railway')

import { useRailway, useGis } from '~/composables/api'
import type { RailwaySummary, LiveOperation } from '~/composables/api'

const summary  = ref<RailwaySummary | null>(null)
const liveOps  = ref<LiveOperation[]>([])
const mapData  = ref<{ lines: any[]; markers: any[] }>({ lines: [], markers: [] })
const loading  = ref(true)
const error    = ref<string | null>(null)
const lastRefreshed = ref('-')

async function load() {
  loading.value = true
  error.value = null
  const rail = useRailway()

  const [sumRes, liveRes, mapRes] = await Promise.allSettled([
    rail.summary(),
    rail.liveOperations(),
    rail.mapData(),
  ])

  if (sumRes.status  === 'fulfilled') {
    summary.value = sumRes.value
    liveOps.value = sumRes.value.live_operations ?? []
  }
  if (liveRes.status === 'fulfilled') {
    const raw = Array.isArray(liveRes.value) ? liveRes.value : (liveRes.value as any).results ?? []
    if (raw.length) liveOps.value = raw
  }
  if (mapRes.status  === 'fulfilled') mapData.value = mapRes.value

  if ([sumRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Railway API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const topRoutes  = computed(() => summary.value?.top_routes ?? [])
const maxBookings = computed(() => Math.max(1, ...topRoutes.value.map(r => r.bookings)))

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(n: number | null | undefined) {
  if (n == null || isNaN(n as number)) return '-'
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000)     return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000)         return `${(num / 1_000).toFixed(0)}k`
  return Math.round(num).toLocaleString()
}
function opBadge(s: string) {
  const m: Record<string,string> = { in_transit:'info', boarding:'fair', arrived:'success', delayed:'danger', cancelled:'danger', scheduled:'neutral', departed:'info', diverted:'warning' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.eol-banner { margin-bottom:12px; display:flex; flex-direction:column; gap:6px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }

/* ── Map layout ── */
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; align-items:start; }
@media(max-width:1100px) { .two-col-map { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid #f1f5f9; color:#475569; }
.mk { display:flex; align-items:center; gap:5px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; flex-shrink:0; }
.line-seg { width:20px; height:4px; border-radius:2px; display:inline-block; flex-shrink:0; }

/* ── Right column stacked cards ── */
.right-col { display:flex; flex-direction:column; }
.stack-card { margin-top: 0; }
.right-col > .card + .card { margin-top: 12px; }

/* ── OTP card ── */
.otp-big { font-size:36px; font-weight:800; text-align:center; padding:10px 0 2px; color:#1e293b; letter-spacing:-0.02em; }
.otp-bar-wrap { background:#f1f5f9; border-radius:6px; height:12px; overflow:hidden; margin:6px 0 12px; }
.otp-bar { height:100%; border-radius:6px; transition:width .5s ease; }
.otp-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:0; border-top:1px solid #f1f5f9; }
.otp-stats > div { text-align:center; padding:8px 4px; border-right:1px solid #f1f5f9; }
.otp-stats > div:last-child { border-right:none; }

/* ── Stat labels / values ── */
.stat-label { font-size:10px; display:block; color:#94a3b8; margin-bottom:2px; text-transform:uppercase; letter-spacing:.04em; }
.rid-stat-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(70px,1fr)); gap:8px; }
.freight-stats { margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid #f1f5f9; }
.rid-val { font-size:16px; font-weight:700; display:block; color:#1e293b; }
.val-ok     { color:#16a34a; }
.val-warn   { color:#d97706; }
.val-danger { color:#dc2626; }
.empty-cell { color:#94a3b8; font-size:13px; }

/* ── Mini section head ── */
.mini-section-head { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; margin-bottom:8px; }

/* ── Corridor list ── */
.corridor-list { display:flex; flex-direction:column; gap:0; }
.corridor-row { display:flex; align-items:center; gap:8px; font-size:12px; padding:6px 0; border-bottom:1px solid #f8fafc; }
.corridor-row:last-child { border-bottom:none; }
.corridor-route { font-family:monospace; font-weight:700; flex:1; color:#1e293b; }
.corridor-stat { font-size:11px; font-weight:600; color:#475569; white-space:nowrap; }

/* ── Operations table ── */
.occ-wrap { background:#f1f5f9; border-radius:3px; height:5px; overflow:hidden; margin-bottom:2px; }
.occ-bar { height:100%; border-radius:3px; }
.share-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; }
.share-bar { height:100%; border-radius:4px; }
.link-sm { font-size:12px; color:#3b82f6; text-decoration:none; }
</style>
