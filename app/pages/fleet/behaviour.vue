<template>
  <PageHeader
    eyebrow="Fleet - Driver Behaviour & Utilization"
    title="Driver Behaviour & Utilization"
    subtitle="NTSA iTIMS - Full driver behaviour event log and the fleet utilization leaderboard"
  >
    <template #actions>
      <NuxtLink to="/fleet" class="btn">Fleet Overview →</NuxtLink>
      <NuxtLink to="/fleet/live" class="btn">Live Map →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Events Loaded" :value="fmtNum(events.length)"
      :unavailable="loading || eventsError" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE" description="Driver behaviour log" to="#behaviour-events"
    />
    <KpiCard
      label="Critical Severity" :value="fmtNum(events.filter(e => e.severity === 'critical').length)"
      :unavailable="loading || eventsError" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE" description="Requires review"
      :status="loading || eventsError ? undefined : events.filter(e => e.severity === 'critical').length > 0 ? 'critical' : 'healthy'"
      to="#behaviour-events"
    />
    <KpiCard
      label="Vehicles Ranked" :value="fmtNum(utilization.length)"
      :unavailable="loading || utilError" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE" description="Utilization leaderboard" to="#utilization-leaderboard"
    />
    <KpiCard
      label="Avg Utilization" :value="avgUtilization != null ? `${avgUtilization.toFixed(1)}%` : '-'"
      :unavailable="loading || utilError" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE" description="Across ranked vehicles" to="#utilization-leaderboard"
    />
  </div>

  <!-- Driver behaviour events -->
  <SectionTitle pill="NTSA iTIMS · Live">Driver Behaviour Events</SectionTitle>
  <div id="behaviour-events" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="eventSearch" class="select-sm" placeholder="Search plate number…" style="min-width:180px" @change="load" />
        <select v-model="severityFilter" class="select-sm">
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select v-model="eventTypeFilter" class="select-sm">
          <option value="">All event types</option>
          <option value="speeding">Speeding</option>
          <option value="harsh_brake">Harsh Braking</option>
          <option value="harsh_accel">Harsh Acceleration</option>
          <option value="excessive_idle">Excessive Idling</option>
          <option value="sharp_turn">Sharp Turn</option>
        </select>
        <button class="btn" @click="eventSearch=''; severityFilter=''; eventTypeFilter=''; load()">Clear</button>
        <ExportButton filename="uapts-driver-behaviour-events.csv" :rows="filteredEvents" :columns="eventExportColumns" style="margin-left:auto" />
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Plate</th>
              <th>Event Type</th>
              <th>Severity</th>
              <th>Speed (km/h)</th>
              <th>Limit (km/h)</th>
              <th>Duration (s)</th>
              <th>Detected</th>
            </tr>
          </thead>
          <tbody v-if="filteredEvents.length">
            <template v-for="ev in eventsPageRows" :key="ev.id">
              <tr class="expand-row" @click="expandedEvent = expandedEvent === ev.id ? null : ev.id">
                <td class="expand-cell">{{ expandedEvent === ev.id ? '▾' : '▸' }}</td>
                <td style="font-weight:600">{{ ev.plate_number }}</td>
                <td><BadgePill variant="warning">{{ ev.event_type.replace(/_/g,' ') }}</BadgePill></td>
                <td><BadgePill :variant="sevBadge(ev.severity)">{{ ev.severity }}</BadgePill></td>
                <td>{{ ev.speed_kmh != null ? ev.speed_kmh.toFixed(1) : '-' }}</td>
                <td>{{ ev.speed_limit_kmh ?? '-' }}</td>
                <td>{{ ev.duration_seconds ?? '-' }}</td>
                <td style="white-space:nowrap;font-size:12px">{{ fmtTime(ev.detected_at) }}</td>
              </tr>
              <tr v-if="expandedEvent === ev.id" class="detail-row">
                <td :colspan="8">
                  <div class="drilldown">
                    <div class="dd-item"><span class="dd-label">Deceleration</span><span>{{ ev.deceleration_mps2 != null ? `${ev.deceleration_mps2.toFixed(2)} m/s²` : '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Coordinates</span><span style="font-family:monospace">{{ ev.latitude != null && ev.longitude != null ? `${ev.latitude.toFixed(4)}, ${ev.longitude.toFixed(4)}` : '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Vehicle ID</span><span style="font-family:monospace">{{ ev.vehicle }}</span></div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
          <tbody v-else><tr><td colspan="8" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No events match the current filters.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="eventsPage" :total-pages="eventsTotalPages" :total="eventsTotal"
          @prev="eventsPrev" @next="eventsNext"
        />
      </div>
    </div>
  </div>

  <!-- Utilization leaderboard -->
  <SectionTitle pill="NTSA iTIMS · Batch">Fleet Utilization Leaderboard</SectionTitle>
  <div id="utilization-leaderboard" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="utilSearch" class="select-sm" placeholder="Search plate / operator…" style="min-width:180px" />
        <button class="btn" @click="utilSearch=''">Clear</button>
        <ExportButton filename="uapts-fleet-utilization.csv" :rows="filteredUtilization" :columns="utilExportColumns" style="margin-left:auto" />
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Plate / Vehicle</th>
              <th>Operator</th>
              <th>Utilization %</th>
              <th>Trips</th>
              <th>Distance (km)</th>
              <th>Active Hours</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody v-if="filteredUtilization.length">
            <tr v-for="(u, i) in utilPageRows" :key="u.id">
              <td style="font-weight:700;color:var(--fg-3)">#{{ i + 1 }}</td>
              <td style="font-weight:600">{{ u.plate_number }}</td>
              <td>{{ u.operator_name ?? '-' }}</td>
              <td>
                <div class="util-bar-wrap">
                  <div class="util-bar" :style="{ transform: `scaleX(${(u.utilization_pct ?? 0) / 100})`, background: utilColor(u.utilization_pct) }" />
                </div>
                <span style="font-size:12px">{{ u.utilization_pct != null ? `${u.utilization_pct.toFixed(1)}%` : '-' }}</span>
              </td>
              <td>{{ fmtNum(u.trips_count) }}</td>
              <td>{{ u.distance_km != null ? fmtNum(u.distance_km, 1) : '-' }}</td>
              <td>{{ u.active_hours != null ? u.active_hours.toFixed(1) : '-' }}</td>
              <td style="font-size:12px">{{ u.date }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="8" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No utilization data matches the current filters.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="utilPage" :total-pages="utilTotalPages" :total="utilTotal"
          @prev="utilPrev" @next="utilNext"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useFleet } from '~/composables/api'
import type { DriverBehaviorEvent, FleetUtilization } from '~/composables/api'

const events      = ref<DriverBehaviorEvent[]>([])
const utilization = ref<FleetUtilization[]>([])
const loading     = ref(true)
const error       = ref<string | null>(null)
const eventsError = ref(false)
const utilError   = ref(false)

const eventSearch     = ref('')
const severityFilter  = ref('')
const eventTypeFilter = ref('')
const expandedEvent   = ref<string | null>(null)

const utilSearch = ref('')

async function load() {
  loading.value = true
  error.value = null
  const fleet = useFleet()

  const [evRes, utilRes] = await Promise.allSettled([
    fleet.behaviourEvents({ page_size: 150, search: eventSearch.value || undefined, ordering: '-detected_at' }),
    fleet.utilization({ page_size: 100, ordering: '-utilization_pct' }),
  ])

  if (evRes.status   === 'fulfilled') events.value      = (evRes.value as any).results ?? []
  if (utilRes.status === 'fulfilled') utilization.value = (utilRes.value as any).results ?? []

  eventsError.value = evRes.status   === 'rejected'
  utilError.value   = utilRes.status === 'rejected'

  if ([evRes, utilRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Fleet API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const filteredEvents = computed(() => events.value.filter(ev => {
  if (severityFilter.value && ev.severity !== severityFilter.value) return false
  if (eventTypeFilter.value && ev.event_type !== eventTypeFilter.value) return false
  return true
}))
const {
  pageRows: eventsPageRows, page: eventsPage, totalPages: eventsTotalPages,
  total: eventsTotal, next: eventsNext, prev: eventsPrev,
} = usePagination(filteredEvents, 15)

const eventExportColumns = [
  { key: 'plate_number', label: 'Plate' },
  { key: 'event_type', label: 'Event Type' },
  { key: 'severity', label: 'Severity' },
  { key: 'speed_kmh', label: 'Speed (km/h)' },
  { key: 'speed_limit_kmh', label: 'Limit (km/h)' },
  { key: 'duration_seconds', label: 'Duration (s)' },
  { key: 'detected_at', label: 'Detected' },
]

const filteredUtilization = computed(() => utilization.value.filter(u => {
  if (utilSearch.value) {
    const q = utilSearch.value.toLowerCase()
    if (!u.plate_number.toLowerCase().includes(q) && !(u.operator_name ?? '').toLowerCase().includes(q)) return false
  }
  return true
}))
const {
  pageRows: utilPageRows, page: utilPage, totalPages: utilTotalPages,
  total: utilTotal, next: utilNext, prev: utilPrev,
} = usePagination(filteredUtilization, 15)

const avgUtilization = computed(() => {
  const vals = utilization.value.filter(u => u.utilization_pct != null).map(u => u.utilization_pct as number)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
})
const utilExportColumns = [
  { key: 'plate_number', label: 'Plate' },
  { key: 'operator_name', label: 'Operator' },
  { key: 'utilization_pct', label: 'Utilization %' },
  { key: 'trips_count', label: 'Trips' },
  { key: 'distance_km', label: 'Distance (km)' },
  { key: 'active_hours', label: 'Active Hours' },
  { key: 'date', label: 'Date' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
const { riskBadge: sevBadge } = useSeverityBadge()
function utilColor(pct: number | null | undefined) {
  if (pct == null) return 'var(--border-strong)'
  return pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--destructive)'
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.table-scroll { overflow-x:auto; }
.expand-row { cursor:pointer; }
.expand-cell { width:18px; color:var(--fg-3); font-size:11px; }
.detail-row td { background:var(--surface-1); padding:14px 18px; border-bottom:1px solid var(--border-subtle); }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--fg-3); }
.util-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.util-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
</style>
