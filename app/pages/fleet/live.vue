<template>
  <PageHeader
    eyebrow="Fleet - Live Positions"
    title="Live Vehicle Positions"
    subtitle="Real-time GPS positions for all active PSVs and government fleet - refreshes every 30 seconds"
  >
    <!-- <template #actions>
      
      <BadgePill variant="success">{{ liveVehicles.length }} Live</BadgePill>
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template> -->
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Filter bar -->
  <div class="filter-row">
    <select v-model="typeFilter" class="select-sm">
      <option value="">All vehicle types</option>
      <option value="psv_matatu">PSV Matatu</option>
      <option value="psv_bus">PSV Bus</option>
      <option value="brt">BRT</option>
      <option value="taxi">Taxi</option>
      <option value="truck">Truck</option>
      <option value="government">Government</option>
    </select>
    <input
      v-model="plateSearch"
      class="select-sm"
      placeholder="Search plate number…"
      style="min-width:180px"
    />
    <button class="btn" @click="load">Apply</button>
    <button class="btn" @click="typeFilter = ''; plateSearch = ''">Clear</button>
  </div>

  <!-- Map + sidebar -->
  <div class="map-layout">
    <div class="map-pane card map-card">
      <ClientOnly>
        <UaptsMap
          :markers="mapMarkers"
          :roads="roadsGeo"
          :center="[-1.286, 36.817]"
          :zoom="10"
          height="560px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:var(--success)" /> Operational</span>
        <span class="mk"><span class="dot" style="background:var(--warning)" /> Maintenance</span>
        <span class="mk"><span class="dot" style="background:var(--destructive)" /> Impounded</span>
        <span class="mk"><span class="dot" style="background:var(--border-strong)" /> Unknown</span>
      </div>
    </div>

    <div class="sidebar-pane card">
      <div class="card-header">
        Recent Geofence Breaches
        <span class="count-badge">{{ breaches.length }}</span>
      </div>
      <div class="scroll-body">
        <div v-for="b in breaches" :key="b.id" class="breach-row">
          <div class="breach-plate">{{ b.plate_number }}</div>
          <div class="breach-zone">{{ b.zone_name }}</div>
          <BadgePill :variant="eventBadge(b.event_type)">{{ b.event_type }}</BadgePill>
          <div class="breach-time">{{ fmtTime(b.detected_at) }}</div>
        </div>
        <EmptyState v-if="breaches.length === 0" :loading="loading" message="No recent geofence breaches." compact />
      </div>
    </div>
  </div>

  <!-- Live vehicle table -->
  <SectionTitle :pill="`${filteredVehicles.length} vehicles`">Live Vehicle List</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Plate</th>
            <th>Type</th>
            <th>Status</th>
            <th>Speed (km/h)</th>
            <th>Route</th>
            <th>Operator</th>
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody v-if="filteredVehicles.length">
          <tr v-for="v in vehiclesPageRows" :key="v.id">
            <td style="font-weight:600">{{ v.plate_number }}</td>
            <td style="font-size:12px">{{ v.vehicle_type.replace(/_/g,' ') }}</td>
            <td><BadgePill :variant="statusBadge(v.status)">{{ v.status }}</BadgePill></td>
            <td>{{ v.last_speed_kmh != null ? v.last_speed_kmh.toFixed(0) : '-' }}</td>
            <td style="font-size:12px">{{ v.route_name ?? '-' }}</td>
            <td style="font-size:12px">{{ v.operator_name ?? '-' }}</td>
            <td style="white-space:nowrap;font-size:12px">{{ v.last_seen_at ? fmtTime(v.last_seen_at) : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="7" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading live vehicles…' : 'No vehicles match current filters.' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="vehiclesPage" :total-pages="vehiclesTotalPages" :total="vehiclesTotal"
        @prev="vehiclesPrev" @next="vehiclesNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useFleet, useGis } from '~/composables/api'
import type { Vehicle, GeofenceEvent } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'purple' | 'gray'; size?: 'sm' | 'md' | 'lg' }

const liveVehicles = ref<Vehicle[]>([])
const breaches     = ref<GeofenceEvent[]>([])
const roadsGeo     = ref<GeoJSONFeatureCollection | null>(null)
const loading      = ref(true)
const error        = ref<string | null>(null)
const lastRefreshed = ref('-')
const typeFilter   = ref('')
const plateSearch  = ref('')

async function load() {
  loading.value = true
  error.value = null
  const fleet = useFleet()
  const gis   = useGis()

  const [liveRes, breachRes, roadsRes] = await Promise.allSettled([
    fleet.liveVehicles(),
    fleet.recentBreaches(),
    gis.roads({ limit: 400, simplify: 0.01 }),
  ])

  if (liveRes.status   === 'fulfilled') liveVehicles.value = (liveRes.value as any).results ?? (liveRes.value as any) ?? []
  if (breachRes.status === 'fulfilled') breaches.value     = Array.isArray(breachRes.value) ? breachRes.value : ((breachRes.value as any).results ?? [])
  if (roadsRes.status  === 'fulfilled') roadsGeo.value     = roadsRes.value

  if ([liveRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Fleet API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
// 30-second refresh for live positions
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 30_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ─────────────────────────────────────────────────────────────
const filteredVehicles = computed(() =>
  liveVehicles.value.filter(v => {
    if (typeFilter.value && v.vehicle_type !== typeFilter.value) return false
    if (plateSearch.value && !v.plate_number.toLowerCase().includes(plateSearch.value.toLowerCase())) return false
    return true
  }),
)

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: vehiclesPageRows, page: vehiclesPage, totalPages: vehiclesTotalPages,
  total: vehiclesTotal, next: vehiclesNext, prev: vehiclesPrev,
} = usePagination(filteredVehicles, 15)

const mapMarkers = computed((): MarkerSpec[] =>
  filteredVehicles.value
    .filter(v => v.last_latitude && v.last_longitude)
    .map(v => ({
      id: `v-${v.id}`,
      lat: v.last_latitude!,
      lon: v.last_longitude!,
      title: v.plate_number,
      subtitle: `${v.vehicle_type.replace(/_/g,' ')} · ${v.last_speed_kmh?.toFixed(0) ?? '?'} km/h`,
      color: v.status === 'operational' ? 'green' : v.status === 'maintenance' ? 'yellow' : 'red',
      size: 'sm',
    })),
)

// ── Helpers ──────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function statusBadge(s: string) {
  const m: Record<string,string> = { operational:'success', maintenance:'warning', impounded:'danger' }
  return m[s] ?? 'neutral'
}
function eventBadge(e: string) {
  return e === 'entry' ? 'info' : e === 'exit' ? 'warning' : 'neutral'
}
</script>

<style scoped>
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
.map-layout { display:grid; grid-template-columns:3fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .map-layout { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid var(--border-subtle); }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.sidebar-pane { display:flex; flex-direction:column; overflow:hidden; }
.count-badge { font-size:11px; background:var(--surface-sunken); border-radius:10px; padding:1px 7px; margin-left:6px; }
.scroll-body { flex:1; overflow-y:auto; max-height:520px; }
.breach-row { padding:10px 14px; border-bottom:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:3px; }
.breach-plate { font-size:13px; font-weight:700; }
.breach-zone { font-size:12px; color:var(--fg-2); }
.breach-time { font-size:11px; color:var(--fg-3); }
</style>
