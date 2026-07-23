<template>
  <PageHeader
    eyebrow="Railway"
    title="Rail Network Inventory"
    subtitle="KRC · NCTTCA - Line, station and rolling-stock registry with an SGR/MGR comparison panel and cross-network data quality checks"
  >
    <template #actions>
      <NuxtLink to="/railway/infrastructure" class="btn">Rail Infrastructure →</NuxtLink>
      <NuxtLink to="/railway/live" class="btn">Train Operations →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- SGR / MGR comparison -->
  <SectionTitle pill="Computed · Live Registry">SGR / MGR Comparison</SectionTitle>
  <div class="compare-grid">
    <div v-for="c in comparison" :key="c.network" class="compare-card">
      <div class="cc-header">
        <BadgePill :variant="c.network === 'sgr' ? 'info' : 'success'">{{ c.network.toUpperCase() }}</BadgePill>
        <span class="cc-lines">{{ c.lineCount }} line(s)</span>
      </div>
      <div class="cc-grid">
        <div><span class="cc-label">Track km</span><span class="cc-val">{{ fmtNum(c.trackKm, 0) }}</span></div>
        <div><span class="cc-label">Active Stations</span><span class="cc-val">{{ fmtNum(c.activeStations) }}</span></div>
        <div><span class="cc-label">Active Trains</span><span class="cc-val">{{ fmtNum(c.activeTrains) }}</span></div>
        <div><span class="cc-label">Weekly Services</span><span class="cc-val">{{ fmtNum(c.scheduleCount) }}</span></div>
        <div><span class="cc-label">On-Time %</span><span class="cc-val">{{ c.onTimePct != null ? c.onTimePct.toFixed(1) + '%' : '-' }}</span></div>
        <div><span class="cc-label">Bookings (loaded)</span><span class="cc-val">{{ fmtNum(c.bookings) }}</span></div>
        <div><span class="cc-label">Freight (t, loaded)</span><span class="cc-val">{{ fmtNum(c.freightTons) }}</span></div>
        <div><span class="cc-label">Revenue (loaded)</span><span class="cc-val">KES {{ fmtKES(c.revenueKes) }}</span></div>
        <div><span class="cc-label">Active Incidents</span><span class="cc-val" :class="{ 'val-danger': c.activeIncidents > 0 }">{{ fmtNum(c.activeIncidents) }}</span></div>
      </div>
    </div>
  </div>

  <!-- Network map -->
  <SectionTitle pill="Live · OSM-Sourced Geometry">Network Map</SectionTitle>
  <div class="card map-card">
    <div class="card-header">Lines &amp; Stations</div>
    <ClientOnly>
      <UaptsMap
        :markers="stationMarkers"
        :lines="railLines"
        :center="[-1.0, 37.5]"
        :zoom="6"
        height="440px"
        show-legend
      />
    </ClientOnly>
    <div class="map-key">
      <span class="mk"><span class="line-seg" style="background:#3b82f6" /> SGR</span>
      <span class="mk"><span class="line-seg" style="background:#10b981" /> MGR</span>
    </div>
  </div>

  <!-- Line inventory -->
  <SectionTitle pill="Live · OSM-Sourced Geometry">Line Inventory</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Line</th><th>Network</th><th>Gauge</th><th>Region</th><th>Length (km)</th><th>Stations</th>
              <th>Status</th><th>Operator</th><th>Electrification</th><th>Source Updated</th>
            </tr>
          </thead>
          <tbody v-if="lines.length">
            <tr v-for="l in lines" :key="l.id">
              <td style="font-weight:600;font-size:12px">{{ l.name || l.osm_id }}</td>
              <td><BadgePill :variant="l.network === 'sgr' ? 'info' : 'success'">{{ l.network.toUpperCase() }}</BadgePill></td>
              <td style="font-size:12px">{{ l.gauge }}{{ l.gauge_mm ? ` (${l.gauge_mm}mm)` : '' }}</td>
              <td style="font-size:12px">{{ [l.admin1_name, l.admin2_name].filter(Boolean).join(' / ') || '-' }}</td>
              <td>{{ l.length_km != null ? l.length_km.toFixed(1) : '-' }}</td>
              <td>{{ l.stations_count }}</td>
              <td><BadgePill :variant="lineStatusBadge(l.status)">{{ l.status.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-size:12px">{{ l.operator ?? '-' }}</td>
              <td style="font-size:12px">{{ l.electrification ? `Electrified${l.electrified_voltage_kv ? ` (${l.electrified_voltage_kv}kV)` : ''}` : 'Non-electrified' }}</td>
              <td style="font-size:11px">{{ fmtDate(l.updated_at) }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading lines…' : 'No lines available.' }}</td></tr></tbody>
        </table>
      </div>
      <div class="source-note">Origin/destination termini and dedicated signalling status are not yet modelled per line - region shown is the OSM administrative boundary the line traverses.</div>
    </div>
  </div>

  <!-- Station inventory -->
  <SectionTitle pill="Live · OSM-Sourced Geometry">Station Inventory</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="stationSearch" class="select-sm" placeholder="Search station name/code…" style="min-width:180px" />
        <select v-model="stationNetworkFilter" class="select-sm">
          <option value="">All networks</option>
          <option value="sgr">SGR</option>
          <option value="mgr">MGR</option>
          <option value="uganda">Uganda Railway</option>
        </select>
        <select v-model="stationTypeFilter" class="select-sm">
          <option value="">All types</option>
          <option value="terminal">Terminal</option>
          <option value="interchange">Interchange</option>
          <option value="intermediate">Intermediate</option>
          <option value="halt">Halt</option>
          <option value="freight">Freight</option>
          <option value="depot">Depot</option>
        </select>
        <button class="btn" @click="stationSearch=''; stationNetworkFilter=''; stationTypeFilter=''">Clear</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th><th>Code</th><th>Name</th><th>Type</th><th>Network</th><th>Coordinates</th>
              <th>County</th><th>Capacity/day</th><th>Freight Terminal</th><th>Platforms</th>
            </tr>
          </thead>
          <tbody v-if="filteredStations.length">
            <template v-for="s in filteredStations" :key="s.id">
              <tr class="station-row" @click="toggleStation(s)">
                <td class="expand-cell">{{ expandedStation === s.id ? '▾' : '▸' }}</td>
                <td style="font-family:monospace;font-weight:700">{{ s.code }}</td>
                <td style="font-weight:600">{{ s.name }}</td>
                <td><BadgePill variant="info">{{ s.station_type }}</BadgePill></td>
                <td><BadgePill :variant="s.network === 'sgr' ? 'info' : 'success'">{{ s.network.toUpperCase() }}</BadgePill></td>
                <td style="font-size:11px;font-family:monospace">{{ stationCoords(s.id) }}</td>
                <td style="font-size:12px">{{ s.admin1_name ?? '-' }}</td>
                <td>{{ fmtNum(s.passenger_capacity_daily) }}</td>
                <td style="text-align:center">{{ s.has_freight_terminal ? '✓' : '-' }}</td>
                <td>{{ s.platforms }}</td>
              </tr>
              <tr v-if="expandedStation === s.id" class="station-detail-row">
                <td :colspan="10">
                  <div class="drilldown">
                    <div class="dd-col">
                      <div class="dd-title">Passenger Activity (loaded tickets)</div>
                      <div class="dd-list">
                        <div class="dd-item dd-item-block"><span style="color:#94a3b8">Boardings (origin)</span><span>{{ stationActivity(s.code).boardings }}</span></div>
                        <div class="dd-item dd-item-block"><span style="color:#94a3b8">Alightings (destination)</span><span>{{ stationActivity(s.code).alightings }}</span></div>
                        <div class="dd-item dd-item-block"><span style="color:#94a3b8">Revenue (loaded)</span><span>KES {{ fmtKES(stationActivity(s.code).revenue) }}</span></div>
                      </div>
                    </div>
                    <div class="dd-col">
                      <div class="dd-title">Occupancy at Station (recent ops)</div>
                      <div class="dd-list">
                        <div class="dd-item dd-item-block"><span style="color:#94a3b8">Avg occupancy</span><span>{{ stationActivity(s.code).avgOccupancy != null ? stationActivity(s.code).avgOccupancy.toFixed(0) + '%' : 'no recent operations' }}</span></div>
                        <div class="dd-item dd-item-block"><span style="color:#94a3b8">Operations observed</span><span>{{ stationActivity(s.code).opsCount }}</span></div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
          <tbody v-else><tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading stations…' : 'No stations match the current filters.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Rolling stock registry -->
  <SectionTitle pill="Live Registry">Rolling Stock Registry</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="trainSearch" class="select-sm" placeholder="Search unit ID…" style="min-width:160px" />
        <select v-model="trainStatusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="in_service">In Service</option>
          <option value="standby">Standby</option>
          <option value="maintenance">Maintenance</option>
          <option value="inspection">Inspection</option>
          <option value="retired">Retired</option>
        </select>
        <select v-model="trainNetworkFilter" class="select-sm">
          <option value="">All networks</option>
          <option value="sgr">SGR</option>
          <option value="mgr">MGR</option>
          <option value="other">Other / Freight</option>
        </select>
        <button class="btn" @click="trainSearch=''; trainStatusFilter=''; trainNetworkFilter=''">Clear</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Unit ID</th><th>Type</th><th>Network</th><th>Status</th><th>Capacity</th><th>Current Assignment</th>
              <th>Maintenance</th><th>Age</th><th>Depot</th><th>Available</th>
            </tr>
          </thead>
          <tbody v-if="filteredTrains.length">
            <tr v-for="tr in filteredTrains" :key="tr.id">
              <td style="font-family:monospace;font-weight:700">{{ tr.unit_id }}</td>
              <td style="font-size:12px">{{ tr.train_type.replace(/_/g,' ') }}</td>
              <td><BadgePill :variant="trainNetwork(tr) === 'sgr' ? 'info' : trainNetwork(tr) === 'mgr' ? 'success' : 'neutral'">{{ trainNetwork(tr).toUpperCase() }}</BadgePill></td>
              <td><BadgePill :variant="trainStatusBadge(tr.status)">{{ tr.status.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-size:12px">{{ tr.capacity_passengers ? `${fmtNum(tr.capacity_passengers)} pax` : `${fmtNum(tr.capacity_freight_tons)}t` }}</td>
              <td style="font-size:12px">{{ tr.current_location_code ?? tr.current_location ?? '-' }}</td>
              <td style="font-size:11px">
                <span :style="{ color: isDue(tr.next_maintenance) ? '#ef4444' : 'inherit' }">{{ fmtDate(tr.next_maintenance) }}</span>
              </td>
              <td>{{ tr.year_built ? new Date().getFullYear() - tr.year_built : '-' }}</td>
              <td style="font-size:12px">{{ tr.home_depot ?? '-' }}</td>
              <td style="text-align:center">
                <span :style="{ color: ['in_service','standby'].includes(tr.status) ? '#22c55e' : '#94a3b8' }">{{ ['in_service','standby'].includes(tr.status) ? '✓' : '-' }}</span>
              </td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading rolling stock…' : 'No rolling stock matches the current filters.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Data quality -->
  <SectionTitle pill="Computed · Cross-Network">Data Quality Checks</SectionTitle>
  <div class="two-col">
    <div class="card">
      <div class="card-header">Missing Geometry ({{ qualityChecks.missingGeometry.length }})</div>
      <div class="card-body scroll-body">
        <div v-if="qualityChecks.missingGeometry.length">
          <AlertItem v-for="item in qualityChecks.missingGeometry" :key="item.id" severity="warning" :title="item.label" :meta="item.kind" />
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'All loaded lines and stations have usable geometry.' }}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">Stale Station Records ({{ qualityChecks.staleStations.length }})</div>
      <div class="card-body scroll-body">
        <div v-if="qualityChecks.staleStations.length">
          <AlertItem v-for="s in qualityChecks.staleStations" :key="s.id" severity="info" :title="`${s.name} (${s.code})`" :meta="`Last updated ${s.updated_at ? fmtDate(s.updated_at) : 'never'}`" />
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No stale station records (>365d) detected.' }}</div>
      </div>
    </div>
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-header">Unknown Rolling Stock Status ({{ qualityChecks.unknownStatus.length }})</div>
      <div class="card-body scroll-body">
        <div v-if="qualityChecks.unknownStatus.length">
          <AlertItem v-for="tr in qualityChecks.unknownStatus" :key="tr.id" severity="warning" :title="tr.unit_id" meta="No status recorded" />
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'Every rolling-stock unit has a recorded status.' }}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">Inconsistent Network / Gauge Classification ({{ qualityChecks.gaugeMismatch.length }})</div>
      <div class="card-body scroll-body">
        <div v-if="qualityChecks.gaugeMismatch.length">
          <AlertItem v-for="l in qualityChecks.gaugeMismatch" :key="l.id" severity="warning" :title="l.name || l.osm_id" :meta="`${l.network.toUpperCase()} line classified with ${l.gauge} gauge`" />
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No network/gauge inconsistencies detected.' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Rail Network Inventory')

import { useRailway } from '~/composables/api'
import type { RailLine, RailStation, Train, TrainSchedule, TrainOperation, RailTicket, FreightManifest, RailIncident, RailNetwork } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

const lines      = ref<RailLine[]>([])
const railLines  = ref<any[]>([])
const stations   = ref<RailStation[]>([])
const trains     = ref<Train[]>([])
const schedules  = ref<TrainSchedule[]>([])
const operations = ref<TrainOperation[]>([])
const tickets    = ref<RailTicket[]>([])
const freight    = ref<FreightManifest[]>([])
const incidents  = ref<RailIncident[]>([])
const stationCoordMap = ref<Map<string, { lat: number; lon: number }>>(new Map())
const loading    = ref(true)
const error      = ref<string | null>(null)

const stationSearch        = ref('')
const stationNetworkFilter = ref('')
const stationTypeFilter    = ref('')
const trainSearch          = ref('')
const trainStatusFilter    = ref('')
const trainNetworkFilter   = ref('')
const expandedStation      = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const rail = useRailway()

  const [linesRes, stationsRes, trainsRes, schedRes, opsRes, ticketsRes, freightRes, incidentsRes, mapRes] = await Promise.allSettled([
    rail.lines({ page_size: 200 }),
    rail.stations({ page_size: 200 }),
    rail.trains({ page_size: 200 }),
    rail.schedules({ page_size: 200 }),
    rail.operations({ page_size: 200 }),
    rail.tickets({ page_size: 200 }),
    rail.freight({ page_size: 200 }),
    rail.incidents({ page_size: 200 }),
    rail.mapData(),
  ])

  if (linesRes.status     === 'fulfilled') lines.value      = (linesRes.value as any).results ?? []
  if (stationsRes.status  === 'fulfilled') stations.value   = (stationsRes.value as any).results ?? []
  if (trainsRes.status    === 'fulfilled') trains.value     = (trainsRes.value as any).results ?? []
  if (schedRes.status     === 'fulfilled') schedules.value  = (schedRes.value as any).results ?? []
  if (opsRes.status       === 'fulfilled') operations.value = (opsRes.value as any).results ?? []
  if (ticketsRes.status   === 'fulfilled') tickets.value    = (ticketsRes.value as any).results ?? []
  if (freightRes.status   === 'fulfilled') freight.value    = (freightRes.value as any).results ?? []
  if (incidentsRes.status === 'fulfilled') incidents.value  = (incidentsRes.value as any).results ?? []
  if (mapRes.status === 'fulfilled') {
    const m = new Map<string, { lat: number; lon: number }>()
    for (const mk of (mapRes.value as any).markers ?? []) {
      const id = String(mk.id).replace(/^station-/, '')
      m.set(id, { lat: mk.lat, lon: mk.lon })
    }
    stationCoordMap.value = m
    railLines.value = (mapRes.value as any).lines ?? []
  }

  if (linesRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Railway API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

function toggleStation(s: RailStation) { expandedStation.value = expandedStation.value === s.id ? null : s.id }
function stationCoords(id: string) {
  const c = stationCoordMap.value.get(id)
  return c ? `${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}` : '-'
}

const stationMarkers = computed((): MarkerSpec[] =>
  stations.value
    .filter(s => stationCoordMap.value.has(s.id))
    .map(s => {
      const c = stationCoordMap.value.get(s.id)!
      return {
        id: `station-${s.id}`,
        lat: c.lat,
        lon: c.lon,
        title: s.name,
        subtitle: `${s.network.toUpperCase()} · ${s.station_type}`,
        color: s.network === 'sgr' ? 'blue' : 'green',
        size: s.station_type === 'terminal' || s.station_type === 'interchange' ? 'lg' : 'sm',
      }
    }),
)

// ── Filters ──────────────────────────────────────────────────────────────
const filteredStations = computed(() => stations.value.filter(s => {
  if (stationSearch.value) {
    const q = stationSearch.value.toLowerCase()
    if (!s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) return false
  }
  if (stationNetworkFilter.value && s.network !== stationNetworkFilter.value) return false
  if (stationTypeFilter.value && s.station_type !== stationTypeFilter.value) return false
  return true
}))

function trainNetwork(tr: Train): RailNetwork | 'other' {
  if (tr.train_type.startsWith('sgr')) return 'sgr'
  if (tr.train_type.startsWith('mgr')) return 'mgr'
  return 'other'
}
const filteredTrains = computed(() => trains.value.filter(tr => {
  if (trainSearch.value && !tr.unit_id.toLowerCase().includes(trainSearch.value.toLowerCase())) return false
  if (trainStatusFilter.value && tr.status !== trainStatusFilter.value) return false
  if (trainNetworkFilter.value && trainNetwork(tr) !== trainNetworkFilter.value) return false
  return true
}))
function isDue(s: string | null | undefined) { return !!s && new Date(s).getTime() <= Date.now() }

// ── Station passenger activity drill-down (from loaded tickets/operations) ──
function stationActivity(code: string) {
  const boardings  = tickets.value.filter(tk => tk.origin_code === code).length
  const alightings = tickets.value.filter(tk => tk.destination_code === code).length
  const revenue = tickets.value
    .filter(tk => tk.origin_code === code || tk.destination_code === code)
    .reduce((s, tk) => s + parseFloat(tk.fare_kes || '0'), 0)
  const ops = operations.value.filter(o => o.current_station_code === code)
  const withOcc = ops.filter(o => o.occupancy_pct != null)
  const avgOccupancy = withOcc.length ? withOcc.reduce((s, o) => s + (o.occupancy_pct as number), 0) / withOcc.length : null
  return { boardings, alightings, revenue, avgOccupancy, opsCount: ops.length }
}

// ── SGR / MGR comparison panel ───────────────────────────────────────────
const scheduleNetworkMap = computed(() => {
  const m = new Map<string, RailNetwork>()
  schedules.value.forEach(s => m.set(s.id, s.network))
  return m
})
const lineNetworkMap = computed(() => {
  const m = new Map<string, RailNetwork>()
  lines.value.forEach(l => m.set(l.id, l.network))
  return m
})

const comparison = computed(() => {
  const networks: RailNetwork[] = ['sgr', 'mgr']
  return networks.map(network => {
    const netLines = lines.value.filter(l => l.network === network)
    const trackKm = netLines.reduce((s, l) => s + (l.length_km ?? 0), 0)
    const netStations = stations.value.filter(s => s.network === network)
    const activeStations = netStations.filter(s => s.has_passenger_service).length
    const netTrains = trains.value.filter(tr => trainNetwork(tr) === network)
    const activeTrains = netTrains.filter(tr => tr.status === 'in_service').length
    const netSchedules = schedules.value.filter(s => s.network === network && s.is_active)

    const netOps = operations.value.filter(o => scheduleNetworkMap.value.get(o.schedule) === network)
    const completedOps = netOps.filter(o => ['arrived', 'departed'].includes(o.status))
    const onTimeOps = completedOps.filter(o => o.delay_arrival_min === 0)
    const onTimePct = completedOps.length ? (onTimeOps.length / completedOps.length) * 100 : null

    const netTickets = tickets.value.filter(tk => scheduleNetworkMap.value.get(tk.schedule) === network)
    const bookings = netTickets.length
    const revenueKes = netTickets.reduce((s, tk) => s + parseFloat(tk.fare_kes || '0'), 0)

    const netFreight = freight.value.filter(f => f.schedule && scheduleNetworkMap.value.get(f.schedule) === network)
    const freightTons = netFreight.reduce((s, f) => s + f.tonnage, 0)

    const netIncidents = incidents.value.filter(i => i.line && lineNetworkMap.value.get(i.line) === network && i.status !== 'closed' && i.status !== 'resolved')

    return {
      network, lineCount: netLines.length, trackKm, activeStations, activeTrains,
      scheduleCount: netSchedules.length, onTimePct, bookings, revenueKes, freightTons,
      activeIncidents: netIncidents.length,
    }
  })
})

// ── Data quality checks ──────────────────────────────────────────────────
const qualityChecks = computed(() => {
  const missingGeometry: { id: string; label: string; kind: string }[] = []
  for (const l of lines.value) {
    if (l.length_km == null || l.length_km === 0) missingGeometry.push({ id: `line-${l.id}`, label: l.name || l.osm_id, kind: 'Line - no length/geometry' })
  }
  for (const s of stations.value) {
    if (!stationCoordMap.value.has(s.id)) missingGeometry.push({ id: `station-${s.id}`, label: `${s.name} (${s.code})`, kind: 'Station - no coordinates in GeoJSON layer' })
  }

  const oneYearAgo = Date.now() - 365 * 86_400_000
  const staleStations = stations.value.filter(s => !s.updated_at || new Date(s.updated_at).getTime() < oneYearAgo)

  const unknownStatus = trains.value.filter(tr => !tr.status)

  const gaugeMismatch = lines.value.filter(l =>
    (l.network === 'sgr' && l.gauge !== 'standard') ||
    (l.network === 'mgr' && l.gauge !== 'metre'),
  )

  return { missingGeometry, staleStations, unknownStatus, gaugeMismatch }
})

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '-'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}k`
  return Math.round(n).toLocaleString()
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function lineStatusBadge(s: string) {
  const m: Record<string,string> = { operational:'success', under_construction:'warning', planned:'neutral', suspended:'danger', abandoned:'danger', decommissioned:'neutral' }
  return m[s] ?? 'neutral'
}
function trainStatusBadge(s: string) {
  const m: Record<string,string> = { in_service:'success', standby:'fair', maintenance:'warning', retired:'neutral', inspection:'info' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.map-card { overflow:hidden; margin-bottom:16px; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid #f1f5f9; color:#475569; }
.mk { display:flex; align-items:center; gap:5px; }
.line-seg { width:20px; height:4px; border-radius:2px; display:inline-block; flex-shrink:0; }
.compare-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:16px; margin-bottom:16px; }
.compare-card { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:16px 18px; }
.cc-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
.cc-lines { font-size:12px; color:#94a3b8; }
.cc-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.cc-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; display:block; margin-bottom:2px; }
.cc-val { font-size:15px; font-weight:700; color:#1e293b; }
.val-danger { color:#dc2626; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
.source-note { margin-top:10px; font-size:11px; color:#94a3b8; border-top:1px solid #f1f5f9; padding-top:10px; }
.station-row { cursor:pointer; }
.expand-cell { width:18px; color:#94a3b8; font-size:11px; }
.station-detail-row td { background:#fafbfc; padding:14px 18px; border-bottom:1px solid #f1f5f9; }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; }
.dd-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#64748b; margin-bottom:8px; }
.dd-list { display:flex; flex-direction:column; gap:6px; }
.dd-item { display:flex; align-items:center; gap:8px; font-size:12px; }
.dd-item-block { flex-direction:column; align-items:flex-start; gap:2px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.scroll-body { max-height:280px; overflow-y:auto; }
</style>
