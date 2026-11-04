<template>
  <PageHeader
    eyebrow="Railway - Schedules & Punctuality"
    title="Train Schedules"
    subtitle="KRC · NCTTCA - SGR &amp; MGR timetables, OTP, NCTTCA corridor punctuality benchmarks, and recent operation adherence"
  >
    <template #actions>
      <NuxtLink to="/railway/network-inventory" class="btn">Station / Route Performance<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- OTP visual panel -->
  <div v-if="otp" id="otp-panel" class="otp-panel drill-target">
    <div class="otp-panel-pct">
      <span class="otp-pct-num" :style="{ color: otp.on_time_pct >= 85 ? 'var(--success-fg)' : otp.on_time_pct >= 70 ? 'var(--warning-fg)' : 'var(--danger-fg)' }">
        {{ otp.on_time_pct.toFixed(1) }}%
      </span>
      <span class="otp-pct-label">On-Time ({{ timeRange.period.value.toLowerCase() }})</span>
    </div>
    <div class="otp-panel-bar-col">
      <div class="otp-panel-bar-wrap">
        <div class="otp-panel-bar" :style="{
          transform: `scaleX(${otp.on_time_pct / 100})`,
          background: otp.on_time_pct >= 85 ? 'var(--success)' : otp.on_time_pct >= 70 ? 'var(--warning)' : 'var(--destructive)'
        }" />
      </div>
      <div class="otp-panel-stats">
        <div class="otp-stat-pill otp-ok"><span>✓</span> {{ otp.total_operations - otp.delayed - otp.cancelled }} on-time</div>
        <div class="otp-stat-pill otp-delay"><span>⏱</span> {{ otp.delayed }} delayed</div>
        <div class="otp-stat-pill otp-cancel"><span>✕</span> {{ otp.cancelled }} cancelled</div>
        <div class="otp-stat-pill otp-info"><span>≈</span> avg +{{ otp.avg_delay_min.toFixed(0) }} min</div>
      </div>
    </div>
  </div>

  <!-- OTP KPIs: the server's figures over the chosen period / county -->
  <div class="kpi-grid">
    <KpiCard label="On-Time Performance" :value="otp ? `${otp.on_time_pct.toFixed(1)}%` : '-'" :unavailable="!otp" :unavailable-note="otpLoading ? 'Loading…' : 'KRC OCC feed unavailable'" :period="rangeTag" description="Rolling period" :status="!otp ? undefined : otp.on_time_pct >= 85 ? 'healthy' : 'warning'" to="#otp-panel" />
    <KpiCard label="Total Operations" :value="otp ? fmtNum(otp.total_operations) : '-'" :unavailable="!otp" :unavailable-note="otpLoading ? 'Loading…' : 'KRC OCC feed unavailable'" :period="rangeTag" description="Trains run" to="#schedule-adherence" />
    <KpiCard label="Avg Delay" :value="otp ? `${otp.avg_delay_min.toFixed(0)} min` : '-'" :unavailable="!otp" :unavailable-note="otpLoading ? 'Loading…' : 'KRC OCC feed unavailable'" :period="rangeTag" description="Arrival delay average" :status="!otp ? undefined : otp.avg_delay_min < 10 ? 'healthy' : 'warning'" />
    <KpiCard label="Delayed Operations" :value="otp ? fmtNum(otp.delayed) : '-'" :unavailable="!otp" :unavailable-note="otpLoading ? 'Loading…' : 'KRC OCC feed unavailable'" :period="rangeTag" :description="otp ? `${otp.cancellation_pct.toFixed(1)}% cancellation rate` : ''" to="#schedule-adherence" />
    <KpiCard label="Cancelled" :value="otp ? fmtNum(otp.cancelled) : '-'" :unavailable="!otp" :unavailable-note="otpLoading ? 'Loading…' : 'KRC OCC feed unavailable'" :period="rangeTag" description="Service cancelled" :status="!otp ? undefined : otp.cancelled === 0 ? 'healthy' : 'warning'" to="#schedule-adherence" />
    <KpiCard label="Active Schedules" :value="fmtNum(scheduleStats.groupCount('is_active', true))" :unavailable="scheduleStats.count.value === null" :unavailable-note="scheduleStats.loading.value ? 'Loading…' : 'KRC feed unavailable'" period="LIVE" :description="`of ${fmtNum(scheduleStats.count.value)} total`" to="#active-schedules-table" />
  </div>

  <!-- Schedule table -->
  <SectionTitle pill="KRC Timetables">Active Schedules</SectionTitle>

  <div id="active-schedules-table" class="card drill-target">
    <div class="card-body">
      <DataTable :table="scheduleTable" row-key="id" title="Train schedules" export-name="uapts-train-schedules" expandable filters-open
                 placeholder="Search train number, station…" empty="No schedules match the current filters.">
        <template #toolbar>
          <label class="checkbox-label"><input v-model="activeOnly" type="checkbox" /> Active only</label>
        </template>
        <template #cell-train_number="{ row }"><span style="font-family:monospace;font-weight:700">{{ row.train_number }}</span></template>
        <template #cell-network="{ row }"><BadgePill :variant="row.network === 'sgr' ? 'info' : 'success'">{{ String(row.network).toUpperCase() }}</BadgePill></template>
        <template #cell-route="{ row }"><span style="font-weight:600">{{ row.origin_code }} → {{ row.destination_code }}</span></template>
        <template #cell-duration_minutes="{ row }">{{ formatDuration(row.duration_minutes) }}</template>
        <template #cell-fare_economy_kes="{ row }">KES {{ fmtKES(parseFloat(row.fare_economy_kes)) }}</template>
        <template #cell-fare_first_class_kes="{ row }">KES {{ fmtKES(parseFloat(row.fare_first_class_kes)) }}</template>
        <template #expanded="{ row }">
          <div class="drilldown">
            <div class="dd-item"><span class="dd-label">Days of Week</span><span>{{ row.days_of_week }}</span></div>
            <div class="dd-item"><span class="dd-label">Day Type</span><span style="text-transform:capitalize">{{ row.day_type }}</span></div>
            <div class="dd-item"><span class="dd-label">Train Unit</span><span style="font-family:monospace">{{ row.train_unit_code ?? '-' }}</span></div>
            <div class="dd-item"><span class="dd-label">Freight Fare (per ton)</span><span>KES {{ fmtKES(parseFloat(row.fare_freight_per_ton_kes)) }}</span></div>
          </div>
        </template>
      </DataTable>
    </div>
  </div>

  <!-- Revenue and bookings by route: the server's ranked roll-up of the ticketing feed -->
  <SectionTitle :pill="`KRC Ticketing · ${rangeTag.toLowerCase()}`">Revenue &amp; Bookings by Route</SectionTitle>

  <div class="card" style="margin-bottom:16px">
    <div class="card-body">
      <div v-if="revenueByRoute.length" class="route-list">
        <div class="route-head"><span>Route</span><span>Bookings</span><span>Share</span><span>Revenue (KES)</span></div>
        <div v-for="r in revenueByRoute" :key="`${r.origin}-${r.destination}`" class="route-row">
          <span style="font-weight:600;font-size:12px">{{ r.origin }} → {{ r.destination }}</span>
          <span>{{ fmtNum(r.bookings) }}</span>
          <span>{{ totalBookings > 0 ? ((r.bookings / totalBookings) * 100).toFixed(1) : '0.0' }}%</span>
          <span style="font-size:12px">KES {{ fmtKES(r.revenue) }}</span>
        </div>
      </div>
      <EmptyState v-else :loading="routesLoading" message="No ticketing data in the current view." compact />
    </div>
  </div>

  <!-- Recent operations with adherence -->
  <SectionTitle pill="KRC OCC · Recent">Recent Operations - Schedule Adherence</SectionTitle>

  <div id="schedule-adherence" class="card drill-target">
    <div class="card-body">
      <DataTable :table="opsTable" row-key="id" title="Train operations" export-name="uapts-train-operations" filters-open
                 placeholder="Search train, station, delay reason…" empty="No operations in this period.">
        <template #cell-schedule_train_number="{ row }"><span style="font-family:monospace;font-weight:700">{{ row.schedule_train_number }}</span></template>
        <template #cell-route="{ row }">{{ row.origin_code }} → {{ row.destination_code }}</template>
        <template #cell-delay_departure_min="{ row }">
          <span :style="{ color: row.delay_departure_min > 30 ? 'var(--danger-fg)' : row.delay_departure_min > 0 ? 'var(--warning-fg)' : 'var(--success-fg)', fontWeight: '600' }">{{ row.delay_departure_min > 0 ? `+${row.delay_departure_min} min` : '✓' }}</span>
        </template>
        <template #cell-delay_arrival_min="{ row }">
          <span :style="{ color: row.delay_arrival_min > 30 ? 'var(--danger-fg)' : row.delay_arrival_min > 0 ? 'var(--warning-fg)' : 'var(--success-fg)', fontWeight: '600' }">{{ row.delay_arrival_min > 0 ? `+${row.delay_arrival_min} min` : '✓' }}</span>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import type { OnTimeStats } from '~/composables/api'
import { useApi } from '~/composables/api/_client'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useServerCount } from '~/composables/useServerCount'
import { useCountyScope } from '~/composables/useCountyScope'
import { useTimeRange } from '~/composables/useTimeRange'
import type { TableColumn } from '~/types/dataTable'

// Every table, KPI and roll-up asks the server for the page's period (the global one unless picked here, a preset OR a calendar
// range) and county, so they always agree - nothing is derived from a first page (see docs/data-tables.md).
const RAIL = '/api/v1/railway'
const api = useApi()
const timeRange = useTimeRange('railway', { default: '30d', years: true, custom: true })
const county = useCountyScope('railway')
const rangeTag = computed(() => timeRange.period.value)
const scope = () => ({ ...timeRange.query.value, ...county.query.value })

const opt = (values: string[]) => values.map(value => ({ value, label: value.replace(/_/g, ' ') }))
const CLASS_BADGE: Record<string, string> = { express: 'info', standard: 'neutral', local: 'fair', freight: 'warning' }
const OP_BADGE: Record<string, string> = { in_transit: 'info', boarding: 'fair', arrived: 'success', delayed: 'danger', cancelled: 'danger', scheduled: 'neutral', departed: 'info', diverted: 'warning' }

// ── Schedules ────────────────────────────────────────────────────────────
const activeOnly = ref(true)
const scheduleColumns: TableColumn[] = [
  { key: 'train_number', label: 'Train #', priority: 1, pin: 'left' },
  { key: 'network', label: 'Network', options: opt(['sgr', 'mgr']), priority: 2 },
  { key: 'service_class', label: 'Class', type: 'badge', badge: CLASS_BADGE, options: opt(['express', 'standard', 'local', 'freight']), priority: 2 },
  { key: 'route', label: 'Route', sortable: 'origin_code', filter: false, exportAs: r => `${r.origin_code} - ${r.destination_code}`, priority: 1 },
  { key: 'departure_time', label: 'Dep', type: 'mono', priority: 1 },
  { key: 'arrival_time', label: 'Arr', type: 'mono', priority: 2 },
  { key: 'duration_minutes', label: 'Duration', type: 'num', priority: 3 },
  { key: 'days_of_week', label: 'Days', priority: 3 },
  { key: 'day_type', label: 'Day type', options: opt(['daily', 'weekday', 'weekend', 'holiday']), priority: 3, hidden: true },
  { key: 'fare_economy_kes', label: 'Fare (Economy)', type: 'num', priority: 3 },
  { key: 'fare_first_class_kes', label: 'Fare (1st)', type: 'num', priority: 3 },
  { key: 'is_active', label: 'Status', type: 'bool', priority: 1 },
]
const scheduleTable = useEndpointTable({
  key: 'rail-schedules', path: `${RAIL}/schedules/`, columns: scheduleColumns, countyKey: 'railway', pageSize: 15,
  params: () => (activeOnly.value ? { 'f.is_active__exact': 'true' } : {}), defaultSort: [{ key: 'departure_time', dir: 'asc' }],
})

// ── Recent operations (the chosen period) ────────────────────────────────
const opColumns: TableColumn[] = [
  { key: 'schedule_train_number', label: 'Train', priority: 1, pin: 'left' },
  { key: 'route', label: 'Route', sortable: 'origin_code', filter: false, exportAs: r => `${r.origin_code} - ${r.destination_code}`, priority: 2 },
  { key: 'service_date', label: 'Date', type: 'date', priority: 1 },
  { key: 'status', label: 'Status', type: 'badge', badge: OP_BADGE, options: opt(Object.keys(OP_BADGE)), priority: 1 },
  { key: 'schedule_departure_time', label: 'Sched. Dep', type: 'mono', priority: 3 },
  { key: 'actual_departure', label: 'Act. Dep', type: 'datetime', priority: 3 },
  { key: 'delay_departure_min', label: 'Dep Delay', type: 'num', priority: 2 },
  { key: 'delay_arrival_min', label: 'Arr Delay', type: 'num', priority: 1 },
  { key: 'delay_reason', label: 'Delay Reason', priority: 2 },
  { key: 'passengers_actual', label: 'Passengers', type: 'num', priority: 3 },
]
const opsTable = useEndpointTable({
  key: 'rail-operations', path: `${RAIL}/operations/`, columns: opColumns, countyKey: 'railway', pageSize: 15,
  params: () => timeRange.query.value, defaultSort: [{ key: 'service_date', dir: 'desc' }],
})

// ── KPIs ─────────────────────────────────────────────────────────────────
const scheduleStats = useServerCount(`${RAIL}/schedules/`, county.query, { groupBy: ['is_active'] })
const otp = ref<OnTimeStats | null>(null)
const otpLoading = ref(true)
const error = computed(() => !otp.value && !otpLoading.value && scheduleStats.failed.value ? 'Unable to reach the UAPTS Railway API.' : null)
async function loadOtp() {
  try { otp.value = await api<OnTimeStats>(`${RAIL}/operations/on-time-stats/`, { query: scope() }) } catch { otp.value = null } finally { otpLoading.value = false }
}

// ── Revenue by route: ranked server roll-up of the ridership feed ─────────
const routeRows = ref<any[]>([])
const routesLoading = ref(true)
async function loadRoutes() {
  try { routeRows.value = (await api<any>(`${RAIL}/tickets/by-route/`, { query: scope() }))?.results ?? [] } catch { routeRows.value = [] } finally { routesLoading.value = false }
}
const revenueByRoute = computed(() => {
  const m = new Map<string, { origin: string; destination: string; bookings: number; revenue: number }>()
  for (const r of routeRows.value) {
    const key = `${r.origin__code}-${r.destination__code}`
    const ex = m.get(key) ?? { origin: r.origin__name ?? r.origin__code, destination: r.destination__name ?? r.destination__code, bookings: 0, revenue: 0 }
    ex.bookings += Number(r.bookings ?? 0); ex.revenue += Number(r.revenue ?? 0)
    m.set(key, ex)
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 15)
})
const totalBookings = computed(() => revenueByRoute.value.reduce((s, r) => s + r.bookings, 0))

watch(() => JSON.stringify(scope()), () => { void loadOtp(); void loadRoutes() })
onMounted(() => { void loadOtp(); void loadRoutes() })
function refreshAll() { void Promise.all([scheduleTable.refresh(), opsTable.refresh(), scheduleStats.refresh(), loadOtp(), loadRoutes()]) }
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(refreshAll, 120_000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '-'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return Math.round(n).toLocaleString()
}
function formatDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; margin-bottom:16px; }
.checkbox-label { display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; user-select:none; color:var(--fg-2); }
.checkbox-label input[type="checkbox"] { width:14px; height:14px; accent-color:var(--primary-fill); cursor:pointer; }

/* ── OTP visual panel ── */
.otp-panel {
  display: flex;
  align-items: center;
  gap: 24px;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
}
.otp-panel-pct { text-align:center; flex-shrink:0; }
.otp-pct-num { font-size:44px; font-weight:800; line-height:1; letter-spacing:-0.03em; display:block; }
.otp-pct-label { font-size:11px; color:var(--fg-3); text-transform:uppercase; letter-spacing:.06em; display:block; margin-top:2px; }
.otp-panel-bar-col { flex:1; }
.otp-panel-bar-wrap { background:var(--surface-sunken); border-radius:8px; height:14px; overflow:hidden; margin-bottom:10px; }
.otp-panel-bar { height:100%; width:100%; border-radius:8px; transform-origin:left; transition:transform .6s ease; }
.otp-panel-stats { display:flex; gap:8px; flex-wrap:wrap; }
.otp-stat-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}
.otp-ok     { background:var(--success-bg); color:var(--success-fg); border:1px solid var(--success-fg); }
.otp-delay  { background:var(--warning-bg); color:var(--warning-fg); border:1px solid var(--warning-fg); }
.otp-cancel { background:var(--danger-bg); color:var(--danger-fg); border:1px solid var(--danger-fg); }
.otp-info   { background:var(--info-bg); color:var(--info-fg); border:1px solid var(--info-fg); }
.route-list { display:flex; flex-direction:column; max-height:420px; overflow-y:auto; }
.route-head, .route-row { display:grid; grid-template-columns:2fr 1fr 1fr 1.2fr; gap:10px; padding:7px 4px; font-size:13px; align-items:center; }
.route-head { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--fg-3); border-bottom:1px solid var(--border-subtle); position:sticky; top:0; background:var(--surface-1, var(--surface)); }
.route-row { border-bottom:1px solid var(--border-subtle); }
</style>
