<template>
  <PageHeader
    eyebrow="Aviation - Flight Log"
    title="Flight Movements"
    subtitle="KAA ATC - Full flight-by-flight log with delay, passenger and cargo detail"
  >
    <template #actions>
      <NuxtLink to="/aviation" class="btn">Aviation Overview →</NuxtLink>
      <NuxtLink to="/aviation/passenger-stats" class="btn">Passenger Stats →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Flights Loaded" :value="fmtNum(flights.length)" :unavailable="loading || flError" :unavailable-note="loading ? 'Loading…' : 'KAA ATC feed unavailable'" :period="`${days}D`" to="#flight-log" />
    <KpiCard label="Delayed" :value="fmtNum(flights.filter(f => f.delay_departure_min > 0).length)" :unavailable="loading || flError" :unavailable-note="loading ? 'Loading…' : 'KAA ATC feed unavailable'" :period="`${days}D`" description="Departure delay > 0" :status="loading || flError ? undefined : flights.filter(f => f.delay_departure_min > 0).length > 0 ? 'warning' : 'healthy'" to="#flight-log" />
    <KpiCard label="Cancelled" :value="fmtNum(flights.filter(f => f.status === 'cancelled').length)" :unavailable="loading || flError" :unavailable-note="loading ? 'Loading…' : 'KAA ATC feed unavailable'" :period="`${days}D`" description="This window" :status="loading || flError ? undefined : flights.filter(f => f.status === 'cancelled').length > 0 ? 'warning' : 'healthy'" to="#flight-log" />
    <KpiCard label="Avg Departure Delay" :value="avgDepDelay != null ? `${avgDepDelay.toFixed(0)} min` : '-'" :unavailable="loading || flError" :unavailable-note="loading ? 'Loading…' : 'KAA ATC feed unavailable'" :period="`${days}D`" description="All loaded flights" />
  </div>

  <SectionTitle pill="KAA ATC · Live">Flight Log</SectionTitle>
  <div id="flight-log" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="search" class="select-sm" placeholder="Search flight no. / route…" style="min-width:180px" />
        <select v-model="airlineFilter" class="select-sm" @change="load">
          <option value="">All airlines</option>
          <option v-for="al in airlines" :key="al.iata_code" :value="al.iata_code">{{ al.name }}</option>
        </select>
        <select v-model="statusFilter" class="select-sm" @change="load">
          <option value="">All statuses</option>
          <option value="in_flight">In Flight</option>
          <option value="delayed">Delayed</option>
          <option value="cancelled">Cancelled</option>
          <option value="landed">Landed</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <DayRangeToggle v-model="days" :options="[7, 14, 30]" @update:model-value="load" />
        <button class="btn" @click="search=''; airlineFilter=''; statusFilter=''; load()">Clear</button>
        <ExportButton filename="uapts-flight-log.csv" :rows="filteredFlights" :columns="exportColumns" style="margin-left:auto" />
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Flight</th>
              <th>Airline</th>
              <th>Route</th>
              <th>Status</th>
              <th>Dep Delay</th>
              <th>Arr Delay</th>
              <th>Passengers</th>
              <th>Gate</th>
            </tr>
          </thead>
          <tbody v-if="filteredFlights.length">
            <template v-for="f in flightsPageRows" :key="f.id">
              <tr class="expand-row" @click="expanded = expanded === f.id ? null : f.id">
                <td class="expand-cell">{{ expanded === f.id ? '▾' : '▸' }}</td>
                <td style="font-family:monospace;font-weight:700">{{ f.schedule_flight_number }}</td>
                <td style="font-size:12px">{{ f.airline_iata }}</td>
                <td style="font-size:12px">{{ f.origin_code }} → {{ f.destination_code }}</td>
                <td><BadgePill :variant="flightBadge(f.status)">{{ f.status.replace(/_/g,' ') }}</BadgePill></td>
                <td :style="{ color: f.delay_departure_min > 30 ? 'var(--danger-fg)' : f.delay_departure_min > 0 ? 'var(--warning-fg)' : 'var(--success-fg)', fontWeight:'600' }">
                  {{ f.delay_departure_min > 0 ? `+${f.delay_departure_min} min` : 'On time' }}
                </td>
                <td :style="{ color: f.delay_arrival_min > 30 ? 'var(--danger-fg)' : f.delay_arrival_min > 0 ? 'var(--warning-fg)' : 'var(--success-fg)', fontWeight:'600' }">
                  {{ f.delay_arrival_min > 0 ? `+${f.delay_arrival_min} min` : '-' }}
                </td>
                <td>{{ f.passengers_actual != null ? fmtNum(f.passengers_actual) : fmtNum(f.passengers_booked) }}</td>
                <td style="font-family:monospace;font-size:12px">{{ f.gate || '-' }}</td>
              </tr>
              <tr v-if="expanded === f.id" class="detail-row">
                <td :colspan="9">
                  <div class="drilldown">
                    <div class="dd-item"><span class="dd-label">Flight Date</span><span>{{ f.flight_date }}</span></div>
                    <div class="dd-item"><span class="dd-label">Aircraft</span><span>{{ f.aircraft ?? '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Registration</span><span style="font-family:monospace">{{ f.aircraft_registration ?? '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Delay Reason</span><span>{{ f.delay_reason || '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Cargo</span><span>{{ fmtNum(f.cargo_kg) }} kg</span></div>
                    <div class="dd-item"><span class="dd-label">Passengers Booked</span><span>{{ fmtNum(f.passengers_booked) }}</span></div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
          <tbody v-else><tr><td colspan="9" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading flights…' : 'No flights match the current filters.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="flightsPage" :total-pages="flightsTotalPages" :total="flightsTotal"
          @prev="flightsPrev" @next="flightsNext"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useAviationMaritime } from '~/composables/api'
import type { Airline, Flight } from '~/composables/api'

const airlines = ref<Airline[]>([])
const flights  = ref<Flight[]>([])
const loading  = ref(true)
const error    = ref<string | null>(null)
const flError  = ref(false)
const days     = ref(7)

const search        = ref('')
const airlineFilter = ref('')
const statusFilter  = ref('')
const expanded       = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()

  const [alRes, flRes] = await Promise.allSettled([
    avm.airlines(),
    avm.flights({ days: days.value, airline: airlineFilter.value || undefined, status: statusFilter.value || undefined, page_size: 150 }),
  ])

  if (alRes.status === 'fulfilled') airlines.value = (alRes.value as any).results ?? []
  if (flRes.status === 'fulfilled') flights.value  = (flRes.value as any).results ?? []

  flError.value = flRes.status === 'rejected'

  if (flRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Aviation API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const filteredFlights = computed(() => flights.value.filter(f => {
  if (search.value) {
    const q = search.value.toLowerCase()
    const route = `${f.origin_code} ${f.destination_code}`.toLowerCase()
    if (!f.schedule_flight_number.toLowerCase().includes(q) && !route.includes(q)) return false
  }
  return true
}))
const avgDepDelay = computed(() => {
  if (!flights.value.length) return null
  return flights.value.reduce((s, f) => s + f.delay_departure_min, 0) / flights.value.length
})

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: flightsPageRows, page: flightsPage, totalPages: flightsTotalPages,
  total: flightsTotal, next: flightsNext, prev: flightsPrev,
} = usePagination(filteredFlights, 15)
const exportColumns = [
  { key: 'schedule_flight_number', label: 'Flight' },
  { key: 'airline_iata', label: 'Airline' },
  { key: 'origin_code', label: 'Origin' },
  { key: 'destination_code', label: 'Destination' },
  { key: 'status', label: 'Status' },
  { key: 'delay_departure_min', label: 'Dep Delay (min)' },
  { key: 'delay_arrival_min', label: 'Arr Delay (min)' },
  { key: 'passengers_actual', label: 'Passengers' },
  { key: 'cargo_kg', label: 'Cargo (kg)' },
  { key: 'gate', label: 'Gate' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function flightBadge(s: string) {
  const m: Record<string,string> = { in_flight:'info', landed:'success', arrived:'success', scheduled:'neutral', boarding:'fair', delayed:'warning', cancelled:'danger', diverted:'warning' }
  return m[s] ?? 'neutral'
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
</style>
