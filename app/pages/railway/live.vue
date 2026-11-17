<template>
  <PageHeader
    eyebrow="Railway - Train Operations"
    title="Train Operations"
    subtitle="KRC · NCTTCA - Real-time SGR &amp; MGR train positions, delays, rolling stock status, and NCTTCA corridor transit performance - refreshes every 30 seconds"
  >
    <template #actions>
      <BadgePill variant="danger">{{ fmtNum(delayedCount) }} delayed</BadgePill>
      <BadgePill variant="success">{{ fmtNum(onTimeCount) }} on-time</BadgePill>
      <NuxtLink to="/railway/network-inventory" class="btn">Rolling Stock Registry<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/railway/safety" class="btn">Incidents & Safety<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner banner-icon-warn" role="alert">{{ error }}</div>

  <!-- KPIs: counted by the server over every operation of today's service, not over the first page -->
  <div class="kpi-grid">
    <KpiCard label="Live Operations" :value="fmtNum(activeStats.count.value)" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="Active right now" to="#active-operations" />
    <KpiCard label="In Transit" :value="fmtNum(todayStats.groupCount('status', 'in_transit'))" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="Running between stations" to="#active-operations" />
    <KpiCard label="On-Time" :value="fmtNum(onTimeCount)" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="0 delay or ahead of schedule" to="#active-operations" />
    <KpiCard label="Delayed" :value="fmtNum(delayedCount)" :unavailable="unavailable" :unavailable-note="note" period="LIVE" :description="maxDelay != null && maxDelay > 0 ? `Max delay ${maxDelay} min` : 'No delays'" :status="unavailable ? undefined : delayedCount === 0 ? 'healthy' : 'warning'" to="#delay-alerts" />
    <KpiCard label="Cancelled Today" :value="fmtNum(todayStats.groupCount('status', 'cancelled'))" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="Service cancelled" :status="unavailable ? undefined : todayStats.groupCount('status', 'cancelled') === 0 ? 'healthy' : 'warning'" to="#active-operations" />
    <KpiCard label="Rolling Stock - Service" :value="fmtNum(stockStats.groupCount('status', 'in_service'))" :unavailable="stockStats.count.value === null" :unavailable-note="note" period="LIVE" :description="`of ${fmtNum(stockStats.count.value)} registered`" to="#rolling-stock-status" />
  </div>

  <!-- Live map + delayed alerts -->
  <div class="two-col-map">
    <CollapsibleSection class="card map-card" title="Live Train Positions (OCC)" storage-key="map:railway/live">
      <ClientOnly>
        <UaptsMap
          :markers="trainMarkers"
          :lines="railLines"
          :center="[-1.0, 37.5]"
          :zoom="6"
          height="500px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#22c55e" /> On Time</span>
        <span class="mk"><span class="dot" style="background:#ef4444" /> Delayed</span>
        <span class="mk"><span class="dot" style="background:#94a3b8" /> Cancelled</span>
        <span class="mk"><span class="dot" style="background:#3b82f6" /> Boarding</span>
        <span class="mk"><span class="line-seg" style="background:#3b82f6" /> SGR</span>
        <span class="mk"><span class="line-seg" style="background:#10b981" /> MGR</span>
      </div>
    </CollapsibleSection>

    <div class="right-col">
      <!-- Delayed alerts: the worst few, ranked by the server -->
      <div id="delay-alerts" class="card drill-target">
        <div class="card-header">
          Delay Alerts
          <BadgePill v-if="delayedCount" variant="danger">{{ delayedCount }}</BadgePill>
        </div>
        <div class="card-body">
          <div v-if="delayAlerts.length">
            <AlertItem
              v-for="op in delayAlerts"
              :key="op.id"
              severity="warning"
              :title="`Train ${op.schedule_train_number}: ${op.origin_code} → ${op.destination_code}`"
              :meta="`+${op.delay_arrival_min} min · ${(op.delay_reason ?? 'other').replace(/_/g,' ')} · ${op.current_station_code ?? 'En route'}`"
            />
          </div>
          <EmptyState v-else :loading="alertsLoading" message="No active delays." compact />
        </div>
      </div>

      <!-- Rolling stock status -->
      <div id="rolling-stock-status" class="card drill-target" style="margin-top:12px">
        <div class="card-header">Rolling Stock Status</div>
        <div class="card-body">
          <div class="rs-grid">
            <div v-for="st in trainStatuses" :key="st.status" class="rs-row">
              <BadgePill :variant="trainStatusBadge(st.status)">{{ st.status.replace(/_/g,' ') }}</BadgePill>
              <div class="rs-bar-wrap">
                <div class="rs-bar" :style="{ transform: `scaleX(${(stockStats.count.value ?? 0) > 0 ? st.count / (stockStats.count.value ?? 1) : 0})`, background: trainStatusColor(st.status) }" />
              </div>
              <span class="rs-val">{{ st.count }}</span>
            </div>
          </div>
          <div v-if="maintenanceStats.count.value" class="maint-alert">
            <div class="maint-alert-head banner-icon-warn">{{ maintenanceStats.count.value }} unit{{ maintenanceStats.count.value > 1 ? 's' : '' }} - maintenance due</div>
            <div v-for="t in maintenanceUnits" :key="t.id" class="maint-unit">
              {{ t.unit_id }} · {{ String(t.train_type).replace(/_/g,' ') }} · Due {{ fmtDate(t.next_maintenance) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Today's operations -->
  <SectionTitle pill="KRC OCC · Live">All Operations Today</SectionTitle>

  <div id="active-operations" class="card drill-target">
    <div class="card-body">
      <DataTable :table="opsTable" row-key="id" title="Train operations today" export-name="uapts-train-operations-today" filters-open
                 placeholder="Search train number, station…" empty="No operations match the current filters.">
        <template #cell-schedule_train_number="{ row }"><span style="font-family:monospace;font-weight:700">{{ row.schedule_train_number }}</span></template>
        <template #cell-route="{ row }">{{ row.origin_code }} → {{ row.destination_code }}</template>
        <template #cell-delay_departure_min="{ row }">
          <span :style="{ color: row.delay_departure_min > 30 ? 'var(--danger-fg)' : row.delay_departure_min > 0 ? 'var(--warning-fg)' : 'var(--success-fg)', fontWeight: '600' }">{{ row.delay_departure_min > 0 ? `+${row.delay_departure_min}` : 'On time' }}</span>
        </template>
        <template #cell-delay_arrival_min="{ row }">
          <span :style="{ color: row.delay_arrival_min > 30 ? 'var(--danger-fg)' : row.delay_arrival_min > 0 ? 'var(--warning-fg)' : 'var(--success-fg)', fontWeight: '600' }">{{ row.delay_arrival_min > 0 ? `+${row.delay_arrival_min}` : 'On time' }}</span>
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
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useRailway } from '~/composables/api'
import type { TrainOperation } from '~/composables/api'
import { useApi } from '~/composables/api/_client'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useServerCount } from '~/composables/useServerCount'
import { useCountyScope } from '~/composables/useCountyScope'
import { eatDate } from '~/utils/timeRange'
import type { TableColumn } from '~/types/dataTable'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

// The table, every KPI and the alerts ask the server about TODAY's service (EAT) in the county in force, so a count and the
// rows behind it can never disagree. Only the map holds a list - the live positions the OCC feed reports.
const RAIL = '/api/v1/railway'
const OPS = `${RAIL}/operations/`
const api = useApi()
const county = useCountyScope('railway')
const today = () => eatDate(new Date())
const scope = () => county.query.value
const todayQ = () => ({ ...scope(), 'f.service_date__exact': today() })

const STATUSES = ['scheduled', 'boarding', 'departed', 'in_transit', 'delayed', 'arrived', 'cancelled', 'diverted'].map(value => ({ value, label: value.replace(/_/g, ' ') }))
const OP_BADGE: Record<string, string> = { in_transit: 'info', boarding: 'fair', arrived: 'success', delayed: 'danger', cancelled: 'danger', scheduled: 'neutral', departed: 'info', diverted: 'warning' }

// ── Today's operations table ─────────────────────────────────────────────
const opColumns: TableColumn[] = [
  { key: 'schedule_train_number', label: 'Train', priority: 1, pin: 'left' },
  { key: 'route', label: 'Route', sortable: 'origin_code', filter: false, exportAs: r => `${r.origin_code} - ${r.destination_code}`, priority: 2 },
  { key: 'service_date', label: 'Date', type: 'date', priority: 3 },
  { key: 'status', label: 'Status', type: 'badge', badge: OP_BADGE, options: STATUSES, priority: 1 },
  { key: 'current_station_code', label: 'Current Station', type: 'mono', priority: 2 },
  { key: 'actual_departure', label: 'Act. Departure', type: 'datetime', priority: 3 },
  { key: 'actual_arrival', label: 'Act. Arrival', type: 'datetime', priority: 3 },
  { key: 'delay_departure_min', label: 'Dep Delay', type: 'num', priority: 2 },
  { key: 'delay_arrival_min', label: 'Arr Delay', type: 'num', priority: 1 },
  { key: 'passengers_actual', label: 'Passengers', type: 'num', priority: 3 },
  { key: 'occupancy_pct', label: 'Occupancy', type: 'num', digits: 0, priority: 2 },
]
const opsTable = useEndpointTable({
  key: 'rail-operations-today', path: OPS, columns: opColumns, countyKey: 'railway', pageSize: 15,
  params: () => ({ 'f.service_date__exact': today() }), defaultSort: [{ key: 'delay_arrival_min', dir: 'desc' }],
})

// ── KPIs: counted by the server ──────────────────────────────────────────
const todayStats = useServerCount(OPS, todayQ, { aggregate: ['max:delay_arrival_min'], groupBy: ['status'] })
const activeStats = useServerCount(OPS, () => ({ ...scope(), 'f.status__in': 'boarding,departed,in_transit,delayed' }))
const delayStats = useServerCount(OPS, () => ({ ...todayQ(), 'f.delay_arrival_min__gt': 0 }), { groupBy: ['status'] })
const punctualStats = useServerCount(OPS, () => ({ ...todayQ(), 'f.delay_arrival_min__lte': 0 }), { groupBy: ['status'] })
const stockStats = useServerCount(`${RAIL}/trains/`, scope, { groupBy: ['status'] })
const maintenanceStats = useServerCount(`${RAIL}/trains/`, () => ({ ...scope(), 'f.next_maintenance__lte': today() }))
const allStats = [todayStats, activeStats, delayStats, punctualStats, stockStats, maintenanceStats]

// Cancelled runs are neither "delayed" nor "on time".
const notCancelled = (s: typeof delayStats) => {
  const total = s.count.value, cancelled = s.groupCount('status', 'cancelled')
  return total === null || cancelled === null ? null : total - cancelled
}
const delayedCount = computed(() => notCancelled(delayStats))
const onTimeCount = computed(() => notCancelled(punctualStats))
const maxDelay = computed(() => todayStats.agg('max', 'delay_arrival_min'))
const unavailable = computed(() => todayStats.count.value === null)
const note = computed(() => todayStats.loading.value ? 'Loading…' : 'KRC OCC feed unavailable')
const error = computed(() => todayStats.failed.value && !todayStats.loading.value ? 'Unable to reach the UAPTS Railway API.' : null)

const trainStatuses = computed(() => (stockStats.groups.value.status ?? []).map(g => ({ status: String(g.value), count: g.count })))

// ── Alerts and maintenance units: the worst few, ranked by the server ────
const delayAlerts = ref<any[]>([])
const alertsLoading = ref(true)
const maintenanceUnits = ref<any[]>([])
async function loadLists() {
  const q = (path: string, query: Record<string, unknown>) => api<any>(path, { query: { page_size: 8, ...query } }).then(r => r?.results ?? []).catch(() => [])
  const [alerts, units] = await Promise.all([
    q(OPS, { ...todayQ(), 'f.delay_arrival_min__gt': 0, 'f.status__in': 'boarding,departed,in_transit,delayed,arrived,diverted,scheduled', ordering: '-delay_arrival_min' }),
    q(`${RAIL}/trains/`, { ...scope(), 'f.next_maintenance__lte': today(), page_size: 4, ordering: 'next_maintenance' }),
  ])
  delayAlerts.value = alerts; maintenanceUnits.value = units; alertsLoading.value = false
}

// ── Live positions for the map (what the OCC feed reports right now) ─────
const liveOps = ref<TrainOperation[]>([])
const railLines = ref<any[]>([])
async function loadMap() {
  const rail = useRailway()
  const [liveRes, mapRes] = await Promise.allSettled([rail.liveOperations(), rail.mapData()])
  if (liveRes.status === 'fulfilled') liveOps.value = Array.isArray(liveRes.value) ? liveRes.value : (liveRes.value as any).results ?? []
  if (mapRes.status === 'fulfilled') railLines.value = mapRes.value.lines ?? []
}
const trainMarkers = computed((): MarkerSpec[] =>
  liveOps.value
    .filter(op => op.current_lat != null && op.current_lon != null)
    .map(op => ({
      id: `op-${op.id}`,
      lat: op.current_lat!,
      lon: op.current_lon!,
      title: `Train ${op.schedule_train_number}`,
      subtitle: `${op.origin_code} → ${op.destination_code} · ${op.status.replace(/_/g,' ')} · ${op.delay_arrival_min > 0 ? `+${op.delay_arrival_min} min` : 'On time'}`,
      color: op.status === 'cancelled' ? 'gray'
           : op.delay_arrival_min > 0  ? 'red'
           : op.status === 'boarding'  ? 'blue'
           : 'green',
      size: op.delay_arrival_min > 30 ? 'lg' : 'md',
    })),
)

onMounted(() => { void loadLists(); void loadMap() })
function refreshAll() { void Promise.all([opsTable.refresh(), ...allStats.map(s => s.refresh()), loadLists(), loadMap()]) }
watch(() => county.county.value, () => { void loadLists(); void loadMap() })
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(refreshAll, 30_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function trainStatusBadge(s: string) {
  const m: Record<string,string> = { in_service:'success', standby:'fair', maintenance:'warning', retired:'neutral', inspection:'info' }
  return m[s] ?? 'neutral'
}
function trainStatusColor(s: string) {
  const m: Record<string,string> = { in_service:'#22c55e', standby:'#f59e0b', maintenance:'#f97316', retired:'#94a3b8', inspection:'#3b82f6' }
  return m[s] ?? '#64748b'
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; margin-bottom:16px; }
/* ── Map layout ── */
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; align-items:start; }
@media(max-width:1100px) { .two-col-map { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid var(--border-subtle); color:var(--fg-2); }
.mk { display:flex; align-items:center; gap:5px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; flex-shrink:0; }
.line-seg { width:20px; height:4px; border-radius:2px; display:inline-block; flex-shrink:0; }

/* ── Right column ── */
.right-col { display:flex; flex-direction:column; gap:12px; }

/* ── Rolling stock ── */
.rs-grid { display:flex; flex-direction:column; gap:8px; }
.rs-row { display:grid; grid-template-columns:120px 1fr 36px; align-items:center; gap:8px; }
.rs-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:8px; overflow:hidden; }
.rs-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s ease; }
.rs-val { font-size:12px; font-weight:700; text-align:right; color:var(--fg-2); }

/* ── Maintenance warning ── */
.maint-alert { margin-top:10px; padding:8px 10px; background:var(--warning-bg); border:1px solid var(--warning-fg); border-radius:7px; }
.maint-alert-head { font-size:11px; font-weight:700; color:var(--warning-fg); margin-bottom:5px; }
.maint-unit { font-size:11px; color:var(--fg-2); padding:2px 0; }

/* ── Operations table ── */
.occ-wrap { background:var(--surface-sunken); border-radius:3px; height:5px; overflow:hidden; margin-bottom:2px; }
.occ-bar { height:100%; border-radius:3px; }
</style>
