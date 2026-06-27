<template>
  <PageHeader
    eyebrow="M07 - Aviation & Airport Management"
    title="Aviation Operations"
    subtitle="KAA · KCAA · KMD - Real-time ADS-B flight tracking, OTP, passenger volumes, cargo, KMD weather advisories, and KCAA safety oversight"
  >
    <template #actions>
      
      <div class="day-filter">
        <button v-for="d in [7, 14, 30]" :key="d" class="btn" :class="{ 'btn-active': days === d }" @click="days = d; load()">{{ d }}d</button>
      </div>
      <NuxtLink to="/aviation/passenger-stats" class="btn-primary">Passenger Stats →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI Ribbon -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Airports"
      :value="summary ? fmtNum(summary.kpis.total_airports) : '-'"
      sub="KAA managed"
      source="batch" source-title="KAA"
    />
    <KpiCard
      label="Active Airlines"
      :value="summary ? fmtNum(summary.kpis.total_airlines) : '-'"
      sub="AOC valid operators"
      source="batch" source-title="KCAA"
    />
    <KpiCard
      label="Aircraft in Service"
      :value="summary ? fmtNum(summary.kpis.aircraft_in_service) : '-'"
      sub="Airworthy fleet"
      source="batch" source-title="KCAA"
    />
    <KpiCard
      label="Flights"
      :value="summary ? fmtNum(summary.kpis.flights_total) : '-'"
      :sub="summary ? `${fmtNum(summary.kpis.flights_delayed)} delayed · ${fmtNum(summary.kpis.flights_cancelled)} cancelled` : '-'"
      source="live" source-title="KAA ATC"
    />
    <KpiCard
      label="On-Time Performance"
      :value="summary ? `${summary.kpis.otp_pct.toFixed(1)}%` : '-'"
      :sub="summary ? `Avg delay ${summary.kpis.avg_delay_min.toFixed(0)} min` : '-'"
      :trend-direction="summary && summary.kpis.otp_pct >= 80 ? 'up' : 'down'"
      source="live" source-title="KAA ATC"
    />
    <KpiCard
      label="Passengers"
      :value="summary ? fmtNum(summary.kpis.pax_total) : '-'"
      sub="All airports"
      source="batch" source-title="KAA"
    />
    <KpiCard
      label="Cargo Throughput"
      :value="summary?.kpis.cargo_kg_total ? `${(summary.kpis.cargo_kg_total / 1000).toFixed(0)} t` : '-'"
      sub="All airports"
      source="batch" source-title="KAA"
    />
    <KpiCard
      label="Safety Reports"
      :value="safetyStats ? fmtNum(safetyStats.total_reports) : '-'"
      :sub="safetyStats ? `${fmtNum(safetyStats.fatal)} fatal · ${fmtNum(safetyStats.casualties)} casualties` : '-'"
      :trend-direction="safetyStats && safetyStats.fatal === 0 ? 'up' : 'down'"
      source="batch" source-title="KCAA"
    />
  </div>

  <!-- Airport map + Flight status distribution -->
  <div class="two-col-map">
    <div class="card map-card">
      <div class="card-header">Airport Network (KAA)</div>
      <ClientOnly>
        <UaptsMap
          :markers="airportMarkers"
          :center="[0.3, 37.9]"
          :zoom="6"
          height="460px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#ef4444" /> International</span>
        <span class="mk"><span class="dot" style="background:#3b82f6" /> Regional</span>
        <span class="mk"><span class="dot" style="background:#22c55e" /> Domestic</span>
      </div>
    </div>

    <div class="right-col">
      <!-- OTP card -->
      <div class="card" v-if="otp">
        <div class="card-header">On-Time Performance ({{ days }}d)</div>
        <div class="card-body">
          <div class="otp-big">{{ otp.on_time_pct.toFixed(1) }}%</div>
          <div class="otp-bar-wrap">
            <div class="otp-bar" :style="{ width: `${otp.on_time_pct}%`, background: otp.on_time_pct >= 85 ? '#22c55e' : otp.on_time_pct >= 70 ? '#f59e0b' : '#ef4444' }" />
          </div>
          <div class="otp-stats">
            <div><span class="stat-label">Total</span><span>{{ fmtNum(otp.total_flights) }}</span></div>
            <div><span class="stat-label">On Time</span><span>{{ fmtNum(otp.on_time_flights) }}</span></div>
            <div><span class="stat-label">Avg Delay</span><span>{{ otp.avg_delay_min.toFixed(0) }} min</span></div>
          </div>
        </div>
      </div>

      <!-- Flight status distribution -->
      <div class="card" style="margin-top:12px">
        <div class="card-header">Flight Status Distribution</div>
        <div class="card-body">
          <div v-if="statusDist.length" class="cong-list">
            <div v-for="s in statusDist" :key="s.status" class="cong-row">
              <span class="cong-label">{{ s.status.replace(/_/g,' ') }}</span>
              <div class="cong-bar-wrap">
                <div class="cong-bar" :style="{ width: `${maxStatusCount > 0 ? (s.c / maxStatusCount) * 100 : 0}%`, background: statusColor(s.status) }" />
              </div>
              <span class="cong-val">{{ fmtNum(s.c) }}</span>
            </div>
          </div>
          <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No status data' }}</div>
        </div>
      </div>

      <!-- Cargo by commodity -->
      <div class="card" style="margin-top:12px">
        <div class="card-header">Cargo by Commodity ({{ days }}d)</div>
        <div class="card-body">
          <div v-if="cargo.length" class="cong-list">
            <div v-for="c in cargo.slice(0,6)" :key="c.commodity" class="cong-row">
              <span class="cong-label">{{ c.commodity.replace(/_/g,' ') }}</span>
              <div class="cong-bar-wrap">
                <div class="cong-bar" style="background:#a855f7"
                  :style="{ width: `${maxCargo > 0 ? (c.total_kg / maxCargo) * 100 : 0}%` }" />
              </div>
              <span class="cong-val">{{ (c.total_kg / 1000).toFixed(0) }}t</span>
            </div>
          </div>
          <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No cargo data' }}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Passenger volumes by airport -->
  <SectionTitle :pill="`KAA · ${days}d`">Passenger Traffic by Airport</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Airport</th>
            <th>IATA</th>
            <th>Total Pax</th>
            <th>Domestic</th>
            <th>International</th>
            <th>Intl Share</th>
            <th>Revenue (KES)</th>
          </tr>
        </thead>
        <tbody v-if="pax.length">
          <tr v-for="p in pax" :key="p.airport__iata_code">
            <td style="font-weight:600">{{ p.airport__name }}</td>
            <td style="font-family:monospace;font-weight:700">{{ p.airport__iata_code }}</td>
            <td style="font-weight:700">{{ fmtNum(p.total_pax) }}</td>
            <td>{{ fmtNum(p.domestic) }}</td>
            <td>{{ fmtNum(p.intl) }}</td>
            <td>
              <div class="comp-bar-wrap">
                <div class="comp-bar" style="background:#3b82f6"
                  :style="{ width: `${p.total_pax > 0 ? (p.intl / p.total_pax) * 100 : 0}%` }" />
              </div>
              <span style="font-size:11px">{{ p.total_pax > 0 ? ((p.intl / p.total_pax) * 100).toFixed(0) : 0 }}%</span>
            </td>
            <td style="font-size:12px">KES {{ fmtKES(parseFloat(p.revenue_kes)) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No passenger data.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Flight log -->
  <SectionTitle pill="KAA ATC · Live">Recent Flights</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="airlineFilter" class="select-sm" @change="load">
          <option value="">All airlines</option>
          <option v-for="al in airlines.slice(0,20)" :key="al.iata_code" :value="al.iata_code">{{ al.name }}</option>
        </select>
        <select v-model="statusFilter" class="select-sm" @change="load">
          <option value="">All statuses</option>
          <option value="in_flight">In Flight</option>
          <option value="delayed">Delayed</option>
          <option value="cancelled">Cancelled</option>
          <option value="landed">Landed</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <button class="btn" @click="airlineFilter=''; statusFilter=''; load()">Clear</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Flight</th>
            <th>Airline</th>
            <th>Route</th>
            <th>Status</th>
            <th>Dep Delay</th>
            <th>Arr Delay</th>
            <th>Passengers</th>
            <th>Cargo (kg)</th>
            <th>Gate</th>
          </tr>
        </thead>
        <tbody v-if="flights.length">
          <tr v-for="f in flights" :key="f.id">
            <td style="font-family:monospace;font-weight:700">{{ f.schedule_flight_number }}</td>
            <td style="font-size:12px">{{ f.airline_iata }}</td>
            <td style="font-size:12px">{{ f.origin_code }} → {{ f.destination_code }}</td>
            <td><BadgePill :variant="flightBadge(f.status)">{{ f.status.replace(/_/g,' ') }}</BadgePill></td>
            <td :style="{ color: f.delay_departure_min > 30 ? '#ef4444' : f.delay_departure_min > 0 ? '#f59e0b' : '#22c55e', fontWeight:'600' }">
              {{ f.delay_departure_min > 0 ? `+${f.delay_departure_min} min` : 'On time' }}
            </td>
            <td :style="{ color: f.delay_arrival_min > 30 ? '#ef4444' : f.delay_arrival_min > 0 ? '#f59e0b' : '#22c55e', fontWeight:'600' }">
              {{ f.delay_arrival_min > 0 ? `+${f.delay_arrival_min} min` : '-' }}
            </td>
            <td>{{ f.passengers_actual != null ? fmtNum(f.passengers_actual) : fmtNum(f.passengers_booked) }}</td>
            <td>{{ fmtNum(f.cargo_kg) }}</td>
            <td style="font-family:monospace;font-size:12px">{{ f.gate || '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading flights…' : 'No flights match current filters.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Met observations -->
  <SectionTitle pill="KCAA MET · Live">Airport Meteorological Conditions</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="metObs.length" class="met-grid">
        <div v-for="m in metObs" :key="m.id ?? m.station" class="met-card">
          <div style="font-weight:700;font-size:13px">{{ m.station_name ?? m.station }}</div>
          <div style="font-size:12px;color:#64748b">
            {{ m.temperature_c != null ? `${m.temperature_c.toFixed(0)}°C` : '' }}
            {{ m.wind_speed_kmh != null ? `· ${m.wind_speed_kmh.toFixed(0)} km/h` : '' }}
            {{ m.visibility_km != null ? `· ${m.visibility_km.toFixed(0)} km vis` : '' }}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px">{{ m.condition?.replace(/_/g,' ') ?? '' }}</div>
        </div>
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No meteorological data available.' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Aviation')

import { useAviationMaritime } from '~/composables/api'
import type {
  AviationSummary, Airport, Airline, Flight, FlightOTP, CargoByCommodity, PassengerByAirport,
} from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

const summary    = ref<AviationSummary | null>(null)
const otp        = ref<FlightOTP | null>(null)
const airports   = ref<Airport[]>([])
const airlines   = ref<Airline[]>([])
const flights    = ref<Flight[]>([])
const cargo      = ref<CargoByCommodity[]>([])
const pax        = ref<PassengerByAirport[]>([])
const statusDist = ref<{ status: string; c: number }[]>([])
const metObs     = ref<any[]>([])
const safetyStats = ref<{ total_reports: number; fatal: number; serious: number; casualties: number } | null>(null)
const loading    = ref(true)
const error      = ref<string | null>(null)
const lastRefreshed  = ref('-')
const days           = ref(7)
const airlineFilter  = ref('')
const statusFilter   = ref('')

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()

  const [sumRes, otpRes, apRes, alRes, flRes, cgRes, pxRes, stRes, metRes, sfRes] = await Promise.allSettled([
    avm.aviationSummary(days.value),
    avm.flightsOTP(days.value),
    avm.airports(),
    avm.airlines(),
    avm.flights({ days: days.value, airline: airlineFilter.value || undefined, status: statusFilter.value || undefined, page_size: 30 }),
    avm.cargoByCommodity(days.value),
    avm.passengersByAirport({ days: days.value }),
    avm.flightsByStatus({ days: days.value }),
    avm.metObservationsLatest(),
    avm.safetyReportStats(365),
  ])

  if (sumRes.status === 'fulfilled') {
    summary.value    = sumRes.value
    statusDist.value = sumRes.value.by_status ?? []
  }
  if (otpRes.status === 'fulfilled') otp.value         = otpRes.value
  if (apRes.status  === 'fulfilled') airports.value    = (apRes.value as any).results ?? []
  if (alRes.status  === 'fulfilled') airlines.value    = (alRes.value as any).results ?? []
  if (flRes.status  === 'fulfilled') flights.value     = (flRes.value as any).results ?? []
  if (cgRes.status  === 'fulfilled') cargo.value       = (cgRes.value as any).results ?? []
  if (pxRes.status  === 'fulfilled') pax.value         = (pxRes.value as any).results ?? []
  if (stRes.status  === 'fulfilled') statusDist.value  = (stRes.value as any).results ?? statusDist.value
  if (metRes.status === 'fulfilled') metObs.value      = (metRes.value as any).results ?? []
  if (sfRes.status  === 'fulfilled') safetyStats.value = sfRes.value

  if ([sumRes, flRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Aviation API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const airportMarkers = computed((): MarkerSpec[] =>
  airports.value
    .filter(a => a.latitude != null && a.longitude != null)
    .map(a => ({
      id: `ap-${a.id}`,
      lat: a.latitude!,
      lon: a.longitude!,
      title: a.name,
      subtitle: `${a.iata_code} / ${a.icao_code} · ${a.city} · Cap: ${fmtNum(a.design_capacity_passengers)}/yr`,
      color: a.airport_type === 'international' ? 'red' : a.airport_type === 'regional' ? 'blue' : 'green',
      size: a.airport_type === 'international' ? 'lg' : 'md',
    })),
)

const maxStatusCount = computed(() => Math.max(1, ...statusDist.value.map(s => s.c)))
const maxCargo       = computed(() => Math.max(1, ...cargo.value.map(c => c.total_kg)))

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
function flightBadge(s: string) {
  const m: Record<string,string> = { in_flight:'info', landed:'success', arrived:'success', scheduled:'neutral', boarding:'fair', delayed:'warning', cancelled:'danger', diverted:'warning' }
  return m[s] ?? 'neutral'
}
function statusColor(s: string) {
  const m: Record<string,string> = { in_flight:'#3b82f6', landed:'#22c55e', arrived:'#22c55e', scheduled:'#94a3b8', boarding:'#f59e0b', delayed:'#f97316', cancelled:'#ef4444', diverted:'#a855f7' }
  return m[s] ?? '#64748b'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.day-filter { display:flex; gap:4px; }
.btn-active { background:#3b82f6; color:#fff; border-color:#3b82f6; }
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:1100px) { .two-col-map { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid #f1f5f9; }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.right-col { display:flex; flex-direction:column; gap:0; overflow-y:auto; max-height:520px; }
.otp-big { font-size:32px; font-weight:800; text-align:center; padding:8px 0 4px; }
.otp-bar-wrap { background:#f1f5f9; border-radius:6px; height:12px; overflow:hidden; margin:4px 0 8px; }
.otp-bar { height:100%; border-radius:6px; transition:width .5s; }
.otp-stats { display:flex; justify-content:space-around; }
.stat-label { font-size:10px; display:block; color:#94a3b8; }
.cong-list { display:flex; flex-direction:column; gap:7px; }
.cong-row { display:grid; grid-template-columns:90px 1fr 44px; align-items:center; gap:8px; }
.cong-label { font-size:12px; text-transform:capitalize; }
.cong-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.cong-bar { height:100%; border-radius:4px; transition:width .4s; }
.cong-val { font-size:11px; text-align:right; }
.comp-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.comp-bar { height:100%; border-radius:4px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.met-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; }
.met-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; }
</style>
