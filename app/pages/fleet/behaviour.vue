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
    <KpiCard label="Events Loaded" :value="fmtNum(events.length)" sub="Driver behaviour log" source="live" source-title="NTSA iTIMS" />
    <KpiCard label="Critical Severity" :value="fmtNum(events.filter(e => e.severity === 'critical').length)" sub="Requires review" trend-direction="down" source="live" source-title="NTSA iTIMS" />
    <KpiCard label="Vehicles Ranked" :value="fmtNum(utilization.length)" sub="Utilization leaderboard" source="batch" source-title="NTSA iTIMS" />
    <KpiCard label="Avg Utilization" :value="avgUtilization != null ? `${avgUtilization.toFixed(1)}%` : '-'" sub="Across ranked vehicles" source="batch" source-title="NTSA iTIMS" />
  </div>

  <!-- Driver behaviour events -->
  <SectionTitle pill="NTSA iTIMS · Live">Driver Behaviour Events</SectionTitle>
  <div class="card">
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
            <template v-for="ev in filteredEvents" :key="ev.id">
              <tr class="expand-row" @click="expandedEvent = expandedEvent === ev.id ? null : ev.id">
                <td class="expand-cell">{{ expandedEvent === ev.id ? '▾' : '▸' }}</td>
                <td style="font-weight:600">{{ ev.plate_number }}</td>
                <td><BadgePill variant="warning">{{ ev.event_type.replace(/_/g,' ') }}</BadgePill></td>
                <td><BadgePill :variant="sevBadge(ev.severity)">{{ ev.severity }}</BadgePill></td>
                <td>{{ ev.speed_kmh ?? '-' }}</td>
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
          <tbody v-else><tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No events match the current filters.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Utilization leaderboard -->
  <SectionTitle pill="NTSA iTIMS · Batch">Fleet Utilization Leaderboard</SectionTitle>
  <div class="card">
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
            <tr v-for="(u, i) in filteredUtilization" :key="u.id">
              <td style="font-weight:700;color:#94a3b8">#{{ i + 1 }}</td>
              <td style="font-weight:600">{{ u.plate_number }}</td>
              <td>{{ u.operator_name ?? '-' }}</td>
              <td>
                <div class="util-bar-wrap">
                  <div class="util-bar" :style="{ width: `${u.utilization_pct ?? 0}%`, background: utilColor(u.utilization_pct) }" />
                </div>
                <span style="font-size:12px">{{ u.utilization_pct != null ? `${u.utilization_pct.toFixed(1)}%` : '-' }}</span>
              </td>
              <td>{{ fmtNum(u.trips_count) }}</td>
              <td>{{ u.distance_km != null ? fmtNum(u.distance_km, 1) : '-' }}</td>
              <td>{{ u.active_hours != null ? u.active_hours.toFixed(1) : '-' }}</td>
              <td style="font-size:12px">{{ u.date }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No utilization data matches the current filters.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Driver Behaviour & Utilization')

import { useFleet } from '~/composables/api'
import type { DriverBehaviorEvent, FleetUtilization } from '~/composables/api'

const events      = ref<DriverBehaviorEvent[]>([])
const utilization = ref<FleetUtilization[]>([])
const loading     = ref(true)
const error       = ref<string | null>(null)

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
function sevBadge(s: string) {
  const m: Record<string,string> = { critical:'danger', high:'warning', medium:'fair', low:'success' }
  return m[s] ?? 'neutral'
}
function utilColor(pct: number | null | undefined) {
  if (pct == null) return '#94a3b8'
  return pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
.expand-row { cursor:pointer; }
.expand-cell { width:18px; color:#94a3b8; font-size:11px; }
.detail-row td { background:#fafbfc; padding:14px 18px; border-bottom:1px solid #f1f5f9; }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; }
.util-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.util-bar { height:100%; border-radius:4px; transition:width .4s; }
</style>
