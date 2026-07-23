<template>
  <PageHeader
    eyebrow="Railway - Schedules & Punctuality"
    title="Train Schedules"
    subtitle="KRC · NCTTCA - SGR &amp; MGR timetables, OTP, NCTTCA corridor punctuality benchmarks, and recent operation adherence"
  >
    <template #actions>
      <div class="day-filter">
        <button v-for="d in [7, 30, 90]" :key="d" class="btn" :class="{ 'btn-active': otpDays === d }" @click="otpDays = d; loadOtp()">{{ d }}d OTP</button>
      </div>
      <NuxtLink to="/railway/network-inventory" class="btn">Station / Route Performance →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- OTP visual panel -->
  <div v-if="otp" class="otp-panel">
    <div class="otp-panel-pct">
      <span class="otp-pct-num" :style="{ color: otp.on_time_pct >= 85 ? '#16a34a' : otp.on_time_pct >= 70 ? '#d97706' : '#dc2626' }">
        {{ otp.on_time_pct.toFixed(1) }}%
      </span>
      <span class="otp-pct-label">On-Time ({{ otpDays }}d)</span>
    </div>
    <div class="otp-panel-bar-col">
      <div class="otp-panel-bar-wrap">
        <div class="otp-panel-bar" :style="{
          width: `${otp.on_time_pct}%`,
          background: otp.on_time_pct >= 85 ? '#22c55e' : otp.on_time_pct >= 70 ? '#f59e0b' : '#ef4444'
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

  <!-- OTP KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="On-Time Performance"
      :value="otp ? `${otp.on_time_pct.toFixed(1)}%` : '-'"
      :sub="`${otpDays}d rolling period`"
      :trend-direction="otp && otp.on_time_pct >= 85 ? 'up' : 'down'"
      source="batch" source-title="KRC OCC"
    />
    <KpiCard
      label="Total Operations"
      :value="otp ? fmtNum(otp.total_operations) : '-'"
      :sub="`${otpDays}d`"
      source="batch" source-title="KRC OCC"
    />
    <KpiCard
      label="Avg Delay"
      :value="otp ? `${otp.avg_delay_min.toFixed(0)} min` : '-'"
      sub="Arrival delay average"
      :trend-direction="otp && otp.avg_delay_min < 10 ? 'up' : 'down'"
      source="batch" source-title="KRC OCC"
    />
    <KpiCard
      label="Delayed Operations"
      :value="otp ? fmtNum(otp.delayed) : '-'"
      :sub="otp ? `${otp.cancellation_pct.toFixed(1)}% cancellation rate` : '-'"
      source="batch" source-title="KRC OCC"
    />
    <KpiCard
      label="Cancelled"
      :value="otp ? fmtNum(otp.cancelled) : '-'"
      sub="Service cancelled"
      :trend-direction="otp && otp.cancelled === 0 ? 'up' : 'down'"
      source="batch" source-title="KRC OCC"
    />
    <KpiCard
      label="Active Schedules"
      :value="fmtNum(schedules.filter(s => s.is_active).length)"
      :sub="`of ${fmtNum(schedules.length)} total`"
      source="batch" source-title="KRC"
    />
  </div>

  <!-- Schedule table -->
  <SectionTitle pill="KRC Timetables">Active Schedules</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="networkFilter" class="select-sm">
          <option value="">All networks</option>
          <option value="sgr">SGR</option>
          <option value="mgr">MGR</option>
        </select>
        <select v-model="classFilter" class="select-sm">
          <option value="">All service classes</option>
          <option value="express">Express</option>
          <option value="standard">Standard</option>
          <option value="local">Local</option>
          <option value="freight">Freight</option>
        </select>
        <select v-model="dayTypeFilter" class="select-sm">
          <option value="">All day types</option>
          <option value="daily">Daily</option>
          <option value="weekday">Weekday</option>
          <option value="weekend">Weekend</option>
          <option value="holiday">Holiday</option>
        </select>
        <label class="checkbox-label">
          <input v-model="activeOnly" type="checkbox" />
          Active only
        </label>
        <input v-model="trainSearch" class="select-sm" placeholder="Train number…" style="min-width:120px" />
        <button class="btn" @click="networkFilter=''; classFilter=''; dayTypeFilter=''; trainSearch=''; activeOnly=true">Reset</button>
        <ExportButton filename="uapts-train-schedules.csv" :rows="filteredSchedules" :columns="scheduleExportColumns" style="margin-left:auto" />
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Train #</th>
            <th>Network</th>
            <th>Class</th>
            <th>Route</th>
            <th>Dep</th>
            <th>Arr</th>
            <th>Duration</th>
            <th>Days</th>
            <th>Fare (Economy)</th>
            <th>Fare (1st)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody v-if="filteredSchedules.length">
          <template v-for="s in filteredSchedules.slice(0, 50)" :key="s.id">
            <tr class="expand-row" @click="expanded = expanded === s.id ? null : s.id">
              <td class="expand-cell">{{ expanded === s.id ? '▾' : '▸' }}</td>
              <td style="font-family:monospace;font-weight:700">{{ s.train_number }}</td>
              <td>
                <BadgePill :variant="s.network === 'sgr' ? 'info' : 'success'">
                  {{ s.network.toUpperCase() }}
                </BadgePill>
              </td>
              <td><BadgePill :variant="classBadge(s.service_class)">{{ s.service_class }}</BadgePill></td>
              <td style="font-size:12px;font-weight:600">{{ s.origin_code }} → {{ s.destination_code }}</td>
              <td style="font-family:monospace;font-weight:700;color:#1e293b">{{ s.departure_time }}</td>
              <td style="font-family:monospace;color:#64748b">{{ s.arrival_time }}</td>
              <td style="font-size:12px">{{ formatDuration(s.duration_minutes) }}</td>
              <td style="font-size:11px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="s.days_of_week">{{ s.days_of_week }}</td>
              <td style="font-size:12px">KES {{ fmtKES(parseFloat(s.fare_economy_kes)) }}</td>
              <td style="font-size:12px">KES {{ fmtKES(parseFloat(s.fare_first_class_kes)) }}</td>
              <td><BadgePill :variant="s.is_active ? 'success' : 'neutral'">{{ s.is_active ? 'Active' : 'Inactive' }}</BadgePill></td>
            </tr>
            <tr v-if="expanded === s.id" class="detail-row">
              <td :colspan="11">
                <div class="drilldown">
                  <div class="dd-item"><span class="dd-label">Days of Week</span><span>{{ s.days_of_week }}</span></div>
                  <div class="dd-item"><span class="dd-label">Day Type</span><span style="text-transform:capitalize">{{ s.day_type }}</span></div>
                  <div class="dd-item"><span class="dd-label">Train Unit</span><span style="font-family:monospace">{{ s.train_unit_code ?? '-' }}</span></div>
                  <div class="dd-item"><span class="dd-label">Freight Fare (per ton)</span><span>KES {{ fmtKES(parseFloat(s.fare_freight_per_ton_kes)) }}</span></div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
        <tbody v-else>
          <tr><td colspan="11" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading schedules…' : 'No schedules match filters.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Revenue, bookings and no-shows by route -->
  <SectionTitle :pill="`KRC Ticketing · ${otpDays}d`">Revenue &amp; Bookings by Route</SectionTitle>

  <div class="card" style="margin-bottom:16px">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Route</th><th>Bookings</th><th>No-Shows</th><th>No-Show Rate</th><th>Revenue (KES)</th></tr></thead>
          <tbody v-if="revenueByRoute.length">
            <tr v-for="r in revenueByRoute" :key="`${r.origin}-${r.destination}`">
              <td style="font-weight:600;font-size:12px">{{ r.origin }} → {{ r.destination }}</td>
              <td>{{ fmtNum(r.bookings) }}</td>
              <td>{{ fmtNum(r.noShows) }}</td>
              <td :style="{ color: r.noShowRate > 10 ? '#ef4444' : '#22c55e' }">{{ r.noShowRate.toFixed(1) }}%</td>
              <td style="font-size:12px">KES {{ fmtKES(r.revenue) }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No ticketing data in the current view.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Recent operations with adherence -->
  <SectionTitle pill="KRC OCC · Recent">Recent Operations - Schedule Adherence</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Train</th>
            <th>Route</th>
            <th>Date</th>
            <th>Status</th>
            <th>Sched. Dep</th>
            <th>Act. Dep</th>
            <th>Dep Delay</th>
            <th>Arr Delay</th>
            <th>Delay Reason</th>
            <th>Passengers</th>
          </tr>
        </thead>
        <tbody v-if="recentOps.length">
          <tr v-for="op in recentOps.slice(0, 30)" :key="op.id">
            <td style="font-family:monospace;font-weight:700">{{ op.schedule_train_number }}</td>
            <td style="font-size:12px">{{ op.origin_code }} → {{ op.destination_code }}</td>
            <td style="font-size:12px;white-space:nowrap">{{ op.service_date }}</td>
            <td><BadgePill :variant="opBadge(op.status)">{{ op.status.replace(/_/g,' ') }}</BadgePill></td>
            <td style="font-size:11px">
              {{ scheduleDepTime(op.schedule) }}
            </td>
            <td style="font-size:11px;white-space:nowrap">{{ op.actual_departure ? fmtTime(op.actual_departure) : '-' }}</td>
            <td>
              <span :style="{ color: op.delay_departure_min > 30 ? '#ef4444' : op.delay_departure_min > 0 ? '#f59e0b' : '#22c55e', fontWeight:'600', fontSize:'12px' }">
                {{ op.delay_departure_min > 0 ? `+${op.delay_departure_min} min` : '✓' }}
              </span>
            </td>
            <td>
              <span :style="{ color: op.delay_arrival_min > 30 ? '#ef4444' : op.delay_arrival_min > 0 ? '#f59e0b' : '#22c55e', fontWeight:'600', fontSize:'12px' }">
                {{ op.delay_arrival_min > 0 ? `+${op.delay_arrival_min} min` : '✓' }}
              </span>
            </td>
            <td style="font-size:12px;text-transform:capitalize">{{ op.delay_reason.replace(/_/g,' ') }}</td>
            <td style="font-size:12px">{{ op.passengers_actual != null ? fmtNum(op.passengers_actual) : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading operations…' : 'No recent operations.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Rail Schedules')

import { useRailway } from '~/composables/api'
import type { TrainSchedule, TrainOperation, OnTimeStats, RailTicket } from '~/composables/api'

const schedules  = ref<TrainSchedule[]>([])
const recentOps  = ref<TrainOperation[]>([])
const tickets    = ref<RailTicket[]>([])
const otp        = ref<OnTimeStats | null>(null)
const loading    = ref(true)
const error      = ref<string | null>(null)
const lastRefreshed  = ref('-')
const otpDays        = ref(30)
const networkFilter  = ref('')
const classFilter    = ref('')
const dayTypeFilter  = ref('')
const activeOnly     = ref(true)
const trainSearch    = ref('')
const expanded       = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const rail = useRailway()

  const [schRes, opRes, otpRes, ticketsRes] = await Promise.allSettled([
    rail.schedules({ page_size: 100 }),
    rail.operations({ page_size: 30 }),
    rail.onTimeStats(otpDays.value),
    rail.tickets({ page_size: 300, days: otpDays.value }),
  ])

  if (schRes.status === 'fulfilled') schedules.value = (schRes.value as any).results ?? []
  if (opRes.status  === 'fulfilled') recentOps.value = (opRes.value as any).results ?? []
  if (otpRes.status === 'fulfilled') otp.value       = otpRes.value
  if (ticketsRes.status === 'fulfilled') tickets.value = (ticketsRes.value as any).results ?? []

  if ([schRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Railway API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

async function loadOtp() {
  const [res] = await Promise.allSettled([useRailway().onTimeStats(otpDays.value)])
  if (res.status === 'fulfilled') otp.value = res.value
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const filteredSchedules = computed(() =>
  schedules.value.filter(s => {
    if (activeOnly.value    && !s.is_active)                                       return false
    if (networkFilter.value  && s.network       !== networkFilter.value)           return false
    if (classFilter.value    && s.service_class !== classFilter.value)             return false
    if (dayTypeFilter.value  && s.day_type      !== dayTypeFilter.value)           return false
    if (trainSearch.value    && !s.train_number.toLowerCase().includes(trainSearch.value.toLowerCase())) return false
    return true
  }),
)

const scheduleExportColumns = [
  { key: 'train_number', label: 'Train #' },
  { key: 'network', label: 'Network' },
  { key: 'service_class', label: 'Class' },
  { key: 'origin_code', label: 'Origin' },
  { key: 'destination_code', label: 'Destination' },
  { key: 'departure_time', label: 'Departure' },
  { key: 'arrival_time', label: 'Arrival' },
  { key: 'duration_minutes', label: 'Duration (min)' },
  { key: 'days_of_week', label: 'Days' },
  { key: 'fare_economy_kes', label: 'Fare Economy (KES)' },
  { key: 'fare_first_class_kes', label: 'Fare 1st Class (KES)' },
  { key: 'is_active', label: 'Active' },
]

// Build a lookup of schedule_id → departure_time for the adherence table
const scheduleMap = computed(() => {
  const m = new Map<string, string>()
  schedules.value.forEach(s => m.set(s.id, s.departure_time))
  return m
})
function scheduleDepTime(schedId: string) {
  return scheduleMap.value.get(schedId) ?? '-'
}

const revenueByRoute = computed(() => {
  const m = new Map<string, { origin: string; destination: string; bookings: number; noShows: number; revenue: number }>()
  for (const tk of tickets.value) {
    const originLabel = tk.origin_code ?? tk.origin
    const destinationLabel = tk.destination_code ?? tk.destination
    const key = `${originLabel}-${destinationLabel}`
    const ex = m.get(key) ?? { origin: originLabel, destination: destinationLabel, bookings: 0, noShows: 0, revenue: 0 }
    ex.bookings++
    if (tk.is_no_show) ex.noShows++
    ex.revenue += parseFloat(tk.fare_kes || '0')
    m.set(key, ex)
  }
  return [...m.values()]
    .map(r => ({ ...r, noShowRate: r.bookings > 0 ? (r.noShows / r.bookings) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15)
})

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
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-KE', { hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function formatDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`
}
function classBadge(c: string) {
  const m: Record<string,string> = { express:'info', standard:'neutral', local:'fair', freight:'warning' }
  return m[c] ?? 'neutral'
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
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; margin-bottom:16px; }
.day-filter { display:flex; gap:4px; }
.btn-active { background:#3b82f6; color:#fff; border-color:#3b82f6; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; color:#374151; }
.select-sm:focus { outline:none; border-color:#3b82f6; }
.checkbox-label { display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; user-select:none; color:#374151; }
.checkbox-label input[type="checkbox"] { width:14px; height:14px; accent-color:#3b82f6; cursor:pointer; }
.table-scroll { overflow-x:auto; }
.expand-row { cursor:pointer; }
.expand-cell { width:18px; color:#94a3b8; font-size:11px; }
.detail-row td { background:#fafbfc; padding:14px 18px; border-bottom:1px solid #f1f5f9; }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; }

/* ── OTP visual panel ── */
.otp-panel {
  display: flex;
  align-items: center;
  gap: 24px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.05);
}
.otp-panel-pct { text-align:center; flex-shrink:0; }
.otp-pct-num { font-size:44px; font-weight:800; line-height:1; letter-spacing:-0.03em; display:block; }
.otp-pct-label { font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:.06em; display:block; margin-top:2px; }
.otp-panel-bar-col { flex:1; }
.otp-panel-bar-wrap { background:#f1f5f9; border-radius:8px; height:14px; overflow:hidden; margin-bottom:10px; }
.otp-panel-bar { height:100%; border-radius:8px; transition:width .6s ease; }
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
.otp-ok     { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }
.otp-delay  { background:#fefce8; color:#d97706; border:1px solid #fef08a; }
.otp-cancel { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
.otp-info   { background:#f0f9ff; color:#0369a1; border:1px solid #bae6fd; }
</style>
