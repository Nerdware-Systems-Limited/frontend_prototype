<template>
  <PageHeader
    eyebrow="Railway Management (KRC)"
    title="Railway Operations"
    subtitle="KRC · KPA · KenTrade · NCTTCA - SGR & MGR ridership, freight manifests, KPA port-rail reconciliation, KenTrade cargo, and NCTTCA corridor KPIs"
  >
    <template #actions>
      <NuxtLink to="/railway/network-inventory" class="btn">Network Inventory<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/railway/safety" class="btn">Rail Safety<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/railway/live" class="btn">Live Operations<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner banner-icon-warn" role="alert">{{ error }}</div>

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
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KRC feed unavailable'"
      period="LIVE"
      :description="`${fmtNum(summary?.kpis.total_lines ?? null)} total`"
    />
    <KpiCard
      label="Trains in Service"
      :value="summary ? fmtNum(summary.kpis.trains_in_service) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KRC OCC feed unavailable'"
      period="LIVE"
      :description="`of ${fmtNum(summary?.kpis.total_trains ?? null)} fleet`"
      to="#live-operations"
    />
    <KpiCard
      label="Operations (24h)"
      :value="summary ? fmtNum(summary.kpis.operations_24h) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KRC OCC feed unavailable'"
      period="24H"
      description="Trains run today"
      to="#live-operations"
    />
    <KpiCard
      label="On-Time Performance"
      :value="summary ? `${summary.on_time_30d.on_time_pct.toFixed(1)}%` : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KRC OCC feed unavailable'"
      :period="rangeTag"
      :description="summary ? `Avg delay ${summary.on_time_30d.avg_delay_min.toFixed(0)} min (30d)` : ''"
      :status="!summary ? undefined : summary.on_time_30d.on_time_pct >= 85 ? 'healthy' : 'warning'"
      to="#otp-summary"
    />
    <KpiCard
      label="Passenger Bookings"
      :value="summary ? fmtNum(summary.kpis.passenger_bookings_30d) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KRC feed unavailable'"
      :period="rangeTag"
      :description="summary ? `KES ${fmtKES(summary.ridership_30d.revenue_kes)}` : ''"
      to="#ridership-summary"
    />
    <KpiCard
      label="Freight Shipments"
      :value="summary ? fmtNum(summary.kpis.freight_30d_shipments) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KRC feed unavailable'"
      :period="rangeTag"
      :description="summary ? `${fmtNum(summary.freight_30d.total_tons)} tons` : ''"
      to="/railway/freight"
    />
    <KpiCard
      label="No-Show Rate"
      :value="summary ? `${summary.ridership_30d.no_show_rate_pct.toFixed(1)}%` : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KRC feed unavailable'"
      :period="rangeTag"
      description="Of booked passengers"
      :status="!summary ? undefined : summary.ridership_30d.no_show_rate_pct < 5 ? 'healthy' : 'warning'"
    />
    <KpiCard
      label="Open Incidents"
      :value="summary ? fmtNum(summary.kpis.open_incidents) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'KRC Safety feed unavailable'"
      period="LIVE"
      :description="summary ? `${fmtNum(summary.incidents_90d.casualties)} casualties · ${safetyTag}` : ''"
      :status="!summary ? undefined : summary.kpis.open_incidents === 0 ? 'healthy' : 'warning'"
      to="/railway/safety"
    />
  </div>

  <!-- Rail map + live operations -->
  <div class="two-col-map">
    <CollapsibleSection class="card map-card" title="SGR &amp; MGR Network Map" storage-key="map:railway/index">
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
    </CollapsibleSection>

    <div class="right-col">
      <!-- OTP summary card -->
      <div id="otp-summary" class="card drill-target">
        <div class="card-header">On-Time Performance - {{ otp?.window }}</div>
        <div class="card-body" v-if="otp">
          <div class="otp-big">{{ otp.on_time_pct.toFixed(1) }}%</div>
          <div class="otp-bar-wrap">
            <div class="otp-bar" :style="{
              transform: `scaleX(${otp.on_time_pct / 100})`,
              background: otp.on_time_pct >= 85 ? 'var(--success)' : otp.on_time_pct >= 70 ? 'var(--warning)' : 'var(--destructive)'
            }" />
          </div>
          <div class="otp-stats">
            <div><span class="stat-label">Total Ops</span><span>{{ fmtNum(otp.total_operations) }}</span></div>
            <div><span class="stat-label">Delayed</span><span>{{ otp.delayed != null ? fmtNum(otp.delayed) : '-' }}</span></div>
            <div><span class="stat-label">Cancelled</span><span>{{ fmtNum(otp.cancelled) }}</span></div>
            <div><span class="stat-label">Avg Delay</span><span>{{ otp.avg_delay_min.toFixed(0) }} min</span></div>
          </div>
        </div>
        <EmptyState v-else :loading="loading" message="No OTP data" compact />
      </div>

      <!-- Ridership summary -->
      <div id="ridership-summary" class="card stack-card drill-target">
        <div class="card-header">Ridership & Revenue ({{ rangeTag.toLowerCase() }})</div>
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
          Freight Summary ({{ rangeTag.toLowerCase() }})
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
          Safety Summary ({{ safetyTag }})
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

  <div id="live-operations" class="card drill-target">
    <div class="card-body">
      <DataTable :table="liveTable" row-key="id" title="Live train operations" export-name="uapts-live-train-operations"
                 placeholder="Search train, station…" empty="No live train operations.">
        <template #cell-schedule_train_number="{ row }"><span style="font-family:monospace;font-weight:700">{{ row.schedule_train_number }}</span></template>
        <template #cell-route="{ row }">{{ row.origin_code }} → {{ row.destination_code }}</template>
        <template #cell-delay_arrival_min="{ row }">
          <span :style="{ color: row.delay_arrival_min > 30 ? 'var(--danger-fg)' : row.delay_arrival_min > 0 ? 'var(--warning-fg)' : 'var(--success-fg)', fontWeight: '600' }">
            {{ row.delay_arrival_min > 0 ? `+${row.delay_arrival_min} min` : 'On time' }}
          </span>
        </template>
        <template #cell-occupancy_pct="{ row }">
          <template v-if="row.occupancy_pct != null">
            <div class="occ-wrap"><div class="occ-bar" :style="{ width: `${row.occupancy_pct}%`, background: row.occupancy_pct >= 90 ? 'var(--destructive)' : row.occupancy_pct >= 70 ? 'var(--warning)' : 'var(--success)' }" /></div>
            <span style="font-size:11px">{{ Number(row.occupancy_pct).toFixed(0) }}%</span>
          </template>
          <span v-else>-</span>
        </template>
      </DataTable>
    </div>
  </div>

  <!-- Top routes: a ranked top-N from the ticketing roll-up, so a scrolling list rather than a pageable table -->
  <SectionTitle :pill="`KRC Ticketing · ${rangeTag}`">Top Routes by Ridership</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="topRoutes.length" class="route-list">
        <div class="route-head"><span>Origin</span><span>Destination</span><span>Bookings</span><span>Revenue (KES)</span><span>Share</span></div>
        <div v-for="r in topRoutes" :key="`${r.origin__code}-${r.destination__code}`" class="route-row">
          <span style="font-weight:600">{{ r.origin__name }} <span style="font-size:11px;color:var(--fg-3)">({{ r.origin__code }})</span></span>
          <span>{{ r.destination__name }} <span style="font-size:11px;color:var(--fg-3)">({{ r.destination__code }})</span></span>
          <span style="font-weight:700">{{ fmtNum(r.bookings) }}</span>
          <span>{{ fmtKES(r.revenue) }}</span>
          <span class="share-bar-wrap"><span class="share-bar" :style="{ width: `${maxBookings > 0 ? (r.bookings / maxBookings) * 100 : 0}%`, background: 'var(--primary-fill)' }" /></span>
        </div>
      </div>
      <div v-else class="empty-cell">{{ loading ? 'Loading…' : 'No route data.' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useRailway, useGis } from '~/composables/api'
import type { RailwaySummary, OnTimeStats } from '~/composables/api'
import { useApi } from '~/composables/api/_client'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useCountyScope } from '~/composables/useCountyScope'
import { useTimeRange } from '~/composables/useTimeRange'
import type { TableColumn } from '~/types/dataTable'

const summary  = ref<RailwaySummary | null>(null)
// RailwaySummary.on_time_30d is a trimmed-down OnTimeStats (no `delayed` /
// `cancellation_pct` on this backend) - fetch the full stats separately so
// the "Delayed" stat below doesn't show a misleading dash.
const timeRange = useTimeRange('railway', { default: '30d', years: true, custom: true })
const rangeTag = computed(() => timeRange.period.value)
// The open-incidents card follows the period too; with none picked the backend looks back 90 days.
const safetyTag = computed(() => rangeTag.value)
// The range-driven on-time figures when they have loaded; otherwise the summary's own fixed 30 days,
// labelled as such, so the card never shows one window under another window's name.
const otp = computed(() => {
  const o = otpStats.value
  if (o) return { on_time_pct: o.on_time_pct, total_operations: o.total_operations, cancelled: o.cancelled, avg_delay_min: o.avg_delay_min, delayed: o.delayed as number | null, window: timeRange.period.value.toLowerCase() }
  const s = summary.value?.on_time_30d
  return s ? { on_time_pct: s.on_time_pct, total_operations: s.total_operations, cancelled: s.cancelled, avg_delay_min: s.avg_delay_min, delayed: null as number | null, window: '30d' } : null
})
const otpStats = ref<OnTimeStats | null>(null)
const mapData  = ref<{ lines: any[]; markers: any[] }>({ lines: [], markers: [] })
const loading  = ref(true)
const error    = ref<string | null>(null)
const lastRefreshed = ref('-')

async function load() {
  loading.value = true
  error.value = null
  const rail = useRailway()

  const [sumRes, mapRes, otpRes] = await Promise.allSettled([
    rail.summary(timeRange.query.value as any),
    rail.mapData(),
    useApi()<OnTimeStats>('/api/v1/railway/operations/on-time-stats/', { query: timeRange.query.value as Record<string, any> }),
  ])

  if (sumRes.status  === 'fulfilled') {
    summary.value = sumRes.value
  }
  if (otpRes.status === 'fulfilled') otpStats.value = otpRes.value
  if (mapRes.status  === 'fulfilled') mapData.value = mapRes.value

  if ([sumRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Railway API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

// County filter for this module, following the global filter in the top bar until a county is picked here.
const county = useCountyScope('railway')
// Reload when the county (or the period) changes - picked here, on another page, or from the global filter.
watch(() => JSON.stringify([timeRange.query.value, county.query.value]), load)
onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const topRoutes  = computed(() => summary.value?.top_routes ?? [])
const maxBookings = computed(() => Math.max(1, ...topRoutes.value.map(r => r.bookings)))

// ── Live train operations: every operation under way, searched / filtered / sorted / paged on the server ──
const IN_SERVICE = 'boarding,departed,in_transit,delayed'
const OP_STATUSES = ['scheduled', 'boarding', 'departed', 'in_transit', 'delayed', 'arrived', 'cancelled', 'diverted'].map(value => ({ value, label: value.replace(/_/g, ' ') }))
const OP_BADGE: Record<string, string> = { in_transit: 'info', boarding: 'fair', arrived: 'success', delayed: 'danger', cancelled: 'danger', scheduled: 'neutral', departed: 'info', diverted: 'warning' }
const liveColumns: TableColumn[] = [
  { key: 'schedule_train_number', label: 'Train', priority: 1, pin: 'left' },
  { key: 'route', label: 'Route', sortable: 'origin_code', filter: false, exportAs: r => `${r.origin_code} - ${r.destination_code}`, priority: 2 },
  { key: 'status', label: 'Status', type: 'badge', badge: OP_BADGE, options: OP_STATUSES, priority: 1 },
  { key: 'current_station_code', label: 'Current Station', type: 'mono', priority: 2 },
  { key: 'delay_arrival_min', label: 'Delay (Arr)', type: 'num', priority: 1 },
  { key: 'delay_reason', label: 'Delay Reason', priority: 3 },
  { key: 'occupancy_pct', label: 'Occupancy', type: 'num', digits: 0, priority: 2 },
]
const liveTable = useEndpointTable({
  key: 'rail-live-operations', path: '/api/v1/railway/operations/', columns: liveColumns, countyKey: 'railway', pageSize: 15,
  params: { 'f.status__in': IN_SERVICE }, defaultSort: [{ key: 'delay_arrival_min', dir: 'desc' }],
})
watch(() => JSON.stringify([timeRange.query.value, county.query.value]), () => { void liveTable.refresh() })

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
.eol-banner { margin-bottom:12px; display:flex; flex-direction:column; gap:6px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }

/* ── Map layout ── */
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; align-items:start; }
@media(max-width:1100px) { .two-col-map { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid var(--border-subtle); color:var(--fg-2); }
.mk { display:flex; align-items:center; gap:5px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; flex-shrink:0; }
.line-seg { width:20px; height:4px; border-radius:2px; display:inline-block; flex-shrink:0; }

/* ── Right column stacked cards ── */
.right-col { display:flex; flex-direction:column; }
.stack-card { margin-top: 0; }
.right-col > .card + .card { margin-top: 12px; }

/* ── OTP card ── */
.otp-big { font-size:36px; font-weight:800; text-align:center; padding:10px 0 2px; color:var(--fg-1); letter-spacing:-0.02em; }
.otp-bar-wrap { background:var(--surface-sunken); border-radius:6px; height:12px; overflow:hidden; margin:6px 0 12px; }
.otp-bar { height:100%; width:100%; border-radius:6px; transform-origin:left; transition:transform .5s ease; }
.otp-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:0; border-top:1px solid var(--border-subtle); }
.otp-stats > div { text-align:center; padding:8px 4px; border-right:1px solid var(--border-subtle); }
.otp-stats > div:last-child { border-right:none; }

/* ── Stat labels / values ── */
.stat-label { font-size:11px; display:block; color:var(--fg-3); margin-bottom:2px; text-transform:uppercase; letter-spacing:.04em; }
.rid-stat-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(70px,1fr)); gap:8px; }
.freight-stats { margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid var(--border-subtle); }
.rid-val { font-size:16px; font-weight:700; display:block; color:var(--fg-1); }
.val-ok     { color:var(--success-fg); }
.val-warn   { color:var(--warning-fg); }
.val-danger { color:var(--danger-fg); }
.empty-cell { color:var(--fg-3); font-size:13px; }

/* ── Mini section head ── */
.mini-section-head { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--fg-3); margin-bottom:8px; }

/* ── Corridor list ── */
.corridor-list { display:flex; flex-direction:column; gap:0; }
.corridor-row { display:flex; align-items:center; gap:8px; font-size:12px; padding:6px 0; border-bottom:1px solid var(--border-subtle); }
.corridor-row:last-child { border-bottom:none; }
.corridor-route { font-family:monospace; font-weight:700; flex:1; color:var(--fg-1); }
.corridor-stat { font-size:11px; font-weight:600; color:var(--fg-2); white-space:nowrap; }

/* ── Operations table ── */
.occ-wrap { background:var(--surface-sunken); border-radius:3px; height:5px; overflow:hidden; margin-bottom:2px; }
.occ-bar { height:100%; border-radius:3px; }
.share-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:6px; overflow:hidden; }
.share-bar { height:100%; border-radius:4px; }
.link-sm { font-size:12px; color:var(--link); text-decoration:none; }
.route-list { display:flex; flex-direction:column; max-height:420px; overflow-y:auto; }
.route-head, .route-row { display:grid; grid-template-columns:1.4fr 1.4fr .7fr .8fr 1fr; gap:10px; align-items:center; padding:7px 4px; font-size:13px; }
.route-head { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--fg-3); border-bottom:1px solid var(--border-subtle); position:sticky; top:0; background:var(--surface-1, var(--surface)); }
.route-row { border-bottom:1px solid var(--border-subtle); }
.share-bar { display:block; }
</style>
