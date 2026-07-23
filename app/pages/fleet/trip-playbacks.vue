<template>
  <PageHeader
    eyebrow="Fleet - Trip Playback"
    title="Trip Playback"
    subtitle="Replay any vehicle's historical route - select a trip to visualize the path on the map"
  >
    <template #actions>
      <span class="freshness-badge" :class="{ loading }">
        {{ loading ? 'Loading…' : `${fmtNum(trips.length)} trips loaded` }}
      </span>
      <!-- <button class="btn" :disabled="loading" @click="load">↻ Refresh</button> -->
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Filters -->
  <div class="filter-row">
    <input v-model="plateFilter" class="select-sm" placeholder="Plate number…" style="min-width:160px" />
    <input v-model="dateFrom" type="date" class="select-sm" />
    <input v-model="dateTo" type="date" class="select-sm" />
    <select v-model="statusFilter" class="select-sm">
      <option value="">All statuses</option>
      <option value="completed">Completed</option>
      <option value="in_progress">In Progress</option>
      <option value="cancelled">Cancelled</option>
    </select>
    <button class="btn btn-primary" @click="load">Search</button>
    <button class="btn" @click="plateFilter=''; dateFrom=''; dateTo=''; statusFilter=''; load()">Clear</button>
  </div>

  <!-- Trip path map (shown when a trip is selected) -->
  <div v-if="selectedTrip" class="card map-card" style="margin-bottom:16px">
    <div class="card-header">
      Replay: {{ selectedTrip.plate_number }} - {{ selectedTrip.origin_label }} → {{ selectedTrip.destination_label }}
      <button class="btn" style="margin-left:auto;font-size:12px" @click="selectedTrip = null; tripPath = []">✕ Close</button>
    </div>
    <ClientOnly>
      <UaptsMap
        :lines="tripLines"
        :markers="tripEndpoints"
        :center="[-1.286, 36.817]"
        :zoom="10"
        height="380px"
        show-legend
      />
    </ClientOnly>
    <div class="trip-stats">
      <div class="ts-item"><span>Distance</span><strong>{{ selectedTrip.distance_km != null ? `${selectedTrip.distance_km.toFixed(1)} km` : '-' }}</strong></div>
      <div class="ts-item"><span>Duration</span><strong>{{ fmtDuration(selectedTrip.duration_seconds) }}</strong></div>
      <div class="ts-item"><span>Avg Speed</span><strong>{{ selectedTrip.avg_speed_kmh != null ? `${selectedTrip.avg_speed_kmh.toFixed(0)} km/h` : '-' }}</strong></div>
      <div class="ts-item"><span>Max Speed</span><strong>{{ selectedTrip.max_speed_kmh != null ? `${selectedTrip.max_speed_kmh.toFixed(0)} km/h` : '-' }}</strong></div>
      <div class="ts-item"><span>Stops</span><strong>{{ selectedTrip.stop_count }}</strong></div>
      <div v-if="selectedTrip.stops_served?.length" class="ts-item"><span>Stops Served</span><strong>{{ selectedTrip.stops_served.join(', ') }}</strong></div>
      <div class="ts-item"><span>Boardings</span><strong>{{ selectedTrip.boardings ?? '-' }}</strong></div>
      <div class="ts-item"><span>Alightings</span><strong>{{ selectedTrip.alightings ?? '-' }}</strong></div>
      <div class="ts-item">
        <span>Status</span>
        <BadgePill :variant="tripStatusBadge(selectedTrip.status)">{{ selectedTrip.status.replace(/_/g,' ') }}</BadgePill>
      </div>
    </div>
  </div>

  <!-- Trips table -->
  <SectionTitle>Trip Records</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Plate</th>
            <th>Operator</th>
            <th>Route</th>
            <th>Origin → Destination</th>
            <th>Started</th>
            <th>Duration</th>
            <th>Distance (km)</th>
            <th>Avg km/h</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody v-if="trips.length">
          <tr
            v-for="trip in trips"
            :key="trip.id"
            :class="{ 'row-selected': selectedTrip?.id === trip.id }"
          >
            <td style="font-weight:600">{{ trip.plate_number }}</td>
            <td style="font-size:12px">{{ trip.operator_name ?? '-' }}</td>
            <td style="font-size:12px">{{ trip.route_name ?? '-' }}</td>
            <td style="font-size:12px">{{ trip.origin_label }} → {{ trip.destination_label }}</td>
            <td style="white-space:nowrap;font-size:12px">{{ fmtTime(trip.started_at) }}</td>
            <td>{{ fmtDuration(trip.duration_seconds) }}</td>
            <td>{{ trip.distance_km != null ? fmtNum(trip.distance_km, 1) : '-' }}</td>
            <td>{{ trip.avg_speed_kmh != null ? trip.avg_speed_kmh.toFixed(0) : '-' }}</td>
            <td><BadgePill :variant="tripStatusBadge(trip.status)">{{ trip.status.replace(/_/g,' ') }}</BadgePill></td>
            <td>
              <button
                class="btn btn-sm"
                :disabled="loadingPath === trip.id"
                @click="replayTrip(trip)"
              >
                {{ loadingPath === trip.id ? '…' : '▶ Replay' }}
              </button>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="10" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading trip records…' : 'No trips found. Try adjusting the filters.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Trip Playback')

import { useFleet } from '~/composables/api'
import type { TripPlayback } from '~/composables/api'

type LineSpec = { id: string; points: [number, number][]; color?: string; weight?: number; label?: string }
type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'purple' | 'gray'; size?: 'sm' | 'md' | 'lg' }

const trips        = ref<TripPlayback[]>([])
const selectedTrip = ref<TripPlayback | null>(null)
const tripPath     = ref<[number, number][]>([])
const loading      = ref(true)
const loadingPath  = ref<string | null>(null)
const error        = ref<string | null>(null)

const plateFilter  = ref('')
const dateFrom     = ref('')
const dateTo       = ref('')
const statusFilter = ref('')

async function load() {
  loading.value = true
  error.value = null
  const fleet = useFleet()

  const q: Record<string, any> = { page_size: 50 }
  if (plateFilter.value)  q.search     = plateFilter.value
  // Backend only supports a lower bound (`from`, filters started_at__gte) -
  // there is no upper-bound ("to") filter on /trip-playbacks/, so dateTo
  // can't be wired up without a backend change (see report).
  if (dateFrom.value)     q.from       = dateFrom.value
  if (statusFilter.value) q.status     = statusFilter.value

  const [res] = await Promise.allSettled([fleet.tripPlaybacks(q)])
  if (res.status === 'fulfilled') trips.value = (res.value as any).results ?? []
  else error.value = 'Unable to reach the UAPTS Fleet API.'

  loading.value = false
}

async function replayTrip(trip: TripPlayback) {
  selectedTrip.value = trip
  tripPath.value = []

  // The trip record itself already carries a GPS breadcrumb polyline as
  // [lon, lat] pairs (GeoJSON order) - use it immediately (no network
  // round-trip) and swap to the [lat, lon] order this page's map layer
  // expects. Only fall back to the dedicated /path/ endpoint if the trip
  // has none (e.g. GPS tracking gap).
  if (trip.path?.length) {
    tripPath.value = trip.path.map(([lon, lat]) => [lat, lon])
    await nextTick()
    document.querySelector('.map-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }

  loadingPath.value = trip.id
  try {
    // GET /trip-playbacks/{id}/path/ returns an object with a `path` key —
    // [lon, lat] pairs (GeoJSON order), same as TripPlayback.path — not a
    // bare array, `.points`, or a paginated `.results`.
    const res = await useFleet().tripPath(trip.id)
    if (Array.isArray(res?.path)) {
      tripPath.value = res.path.map(([lon, lat]) => [lat, lon])
    }
  } catch {
    // If path fetch fails, keep selectedTrip for stats but show empty map
  } finally {
    loadingPath.value = null
  }

  // Scroll map into view
  await nextTick()
  document.querySelector('.map-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(load)

// ── Computed ─────────────────────────────────────────────────────────────
const tripLines = computed((): LineSpec[] => {
  if (!tripPath.value.length) return []
  return [{
    id: 'trip-path',
    points: tripPath.value,
    color: '#3b82f6',
    weight: 4,
    label: selectedTrip.value?.plate_number,
  }]
})

const tripEndpoints = computed((): MarkerSpec[] => {
  if (!tripPath.value.length || !selectedTrip.value) return []
  const pts = tripPath.value
  const markers: MarkerSpec[] = []
  markers.push({ id: 'start', lat: pts[0][0], lon: pts[0][1], title: 'Start', color: 'green', size: 'md' })
  if (pts.length > 1) markers.push({ id: 'end', lat: pts[pts.length-1][0], lon: pts[pts.length-1][1], title: 'End', color: 'red', size: 'md' })
  return markers
})

// ── Helpers ──────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function fmtDuration(secs: number | null | undefined) {
  if (secs == null) return '-'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function tripStatusBadge(s: string) {
  const m: Record<string,string> = { completed:'success', in_progress:'info', cancelled:'neutral' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.map-card { overflow:hidden; }
.trip-stats { display:flex; flex-wrap:wrap; gap:0; border-top:1px solid #f1f5f9; }
.ts-item { display:flex; flex-direction:column; gap:2px; padding:10px 16px; border-right:1px solid #f1f5f9; min-width:90px; }
.ts-item span { font-size:11px; color:#94a3b8; }
.ts-item strong { font-size:14px; }
.row-selected { background:#eff6ff; }
.btn-sm { padding:3px 10px; font-size:12px; }
</style>
