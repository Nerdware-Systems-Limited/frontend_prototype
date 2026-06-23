<script setup lang="ts">
// pages/aviation.vue — M07 Aviation (KAA + KCAA)
// Backend: /api/v1/aviation-maritime/aviation/ — airports, airlines,
//          aircraft, flights, schedules, cargo, passengers, OTP, summary.
definePageMeta({ title: 'Aviation' })

import { useAviationMaritime } from '~/composables/api'
import type {
  AviationSummary, Airport, Airline, Flight, FlightOTP,
  CargoByCommodity, PassengerByAirport, FlightStatus,
} from '~/composables/api'

const avm = useAviationMaritime()

const summary = ref<AviationSummary | null>(null)
const otp = ref<FlightOTP | null>(null)
const airports = ref<Airport[]>([])
const airlines = ref<Airline[]>([])
const flights = ref<Flight[]>([])
const cargo = ref<CargoByCommodity[]>([])
const pax = ref<PassengerByAirport[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const days = ref(7)
const airlineFilter = ref('')
const statusFilter = ref<FlightStatus | ''>('')

async function load() {
  loading.value = true
  error.value = null
  try {
    const [sum, ot, ap, al, fl, cg, px] = await Promise.all([
      avm.aviationSummary(days.value),
      avm.flightsOTP(days.value),
      avm.airports(),
      avm.airlines(),
      avm.flights({ days: days.value, airline: airlineFilter.value || undefined, status: statusFilter.value || undefined, page_size: 30 }),
      avm.cargoByCommodity(days.value),
      avm.passengersByAirport({ days: days.value }),
    ])
    summary.value = sum
    otp.value = ot
    airports.value = (ap as any).results ?? []
    airlines.value = (al as any).results ?? []
    flights.value = (fl as any).results ?? []
    cargo.value = (cg as any).results ?? []
    pax.value = (px as any).results ?? []
  } catch (err: any) {
    error.value = err?.status === 401
      ? 'Not authenticated — please log in.'
      : err?.message ?? 'Failed to load aviation data.'
  } finally {
    loading.value = false
  }
}

watch([days], () => { load() })
onMounted(load)

function fmtKES(s: string | null | undefined) {
  if (!s) return '—'
  const n = parseFloat(s)
  if (isNaN(n)) return s
  if (n >= 1e9) return `KES ${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `KES ${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `KES ${(n / 1e3).toFixed(0)}K`
  return `KES ${n.toFixed(0)}`
}
function fmtDate(s: string) {
  return new Date(s).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })
}
function statusBadge(s: string) {
  return s === 'arrived' || s === 'landed' ? 'badge-success'
       : s === 'delayed' ? 'badge-warning'
       : s === 'cancelled' || s === 'diverted' ? 'badge-danger'
       : 'badge-info'
}
function aocBadge(s: string) {
  return s === 'valid' ? 'badge-success' : s === 'pending' ? 'badge-warning' : 'badge-danger'
}
</script>

<template>
  <div class="aviation-page">
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M07 · Aviation</div>
        <h1 class="text-display">Aviation Operations</h1>
        <p class="text-sm text-fg-muted mt-1">
          KAA airports, KCAA airlines &amp; AOC, flight schedules, OTP, cargo &amp; passenger throughput.
        </p>
      </div>
      <div class="flex gap-2">
        <select v-model="days" class="select">
          <option :value="1">Last 24h</option>
          <option :value="7">Last 7d</option>
          <option :value="14">Last 14d</option>
          <option :value="30">Last 30d</option>
        </select>
        <button class="btn btn-secondary" :disabled="loading" @click="load">↻ Refresh</button>
      </div>
    </div>

    <!-- KPIs -->
    <div v-if="summary" class="kpi-grid">
      <div class="card kpi">
        <div class="kpi-label">Airports</div>
        <div class="kpi-value">{{ summary.kpis.total_airports }}</div>
        <div class="kpi-sub">{{ summary.kpis.total_airlines }} airlines</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Aircraft in Service</div>
        <div class="kpi-value">{{ summary.kpis.aircraft_in_service }}</div>
        <div class="kpi-sub">Fleet</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Flights ({{ days }}d)</div>
        <div class="kpi-value">{{ summary.kpis.flights_total.toLocaleString() }}</div>
        <div class="kpi-sub">
          <span class="badge badge-warning">{{ summary.kpis.flights_delayed }} delayed</span>
          <span class="badge badge-danger ml-1">{{ summary.kpis.flights_cancelled }} cancelled</span>
        </div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">On-Time %</div>
        <div class="kpi-value">{{ summary.kpis.otp_pct.toFixed(1) }}%</div>
        <div class="kpi-sub">avg delay {{ summary.kpis.avg_delay_min.toFixed(1) }} min</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Passengers</div>
        <div class="kpi-value">{{ summary.kpis.pax_total.toLocaleString() }}</div>
        <div class="kpi-sub">Total pax</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Cargo</div>
        <div class="kpi-value">{{ (summary.kpis.cargo_kg_total / 1000).toFixed(1) }}t</div>
        <div class="kpi-sub">{{ summary.kpis.cargo_kg_total.toLocaleString() }} kg</div>
      </div>
    </div>

    <!-- OTP & by status -->
    <div v-if="otp" class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">On-Time Performance ({{ days }}d)</div>
        </div>
        <div class="otp-summary">
          <div class="otp-ring">
            <svg viewBox="0 0 120 120" class="otp-svg">
              <circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,0.06)" stroke-width="12" fill="none"/>
              <circle cx="60" cy="60" r="50"
                      :stroke="otp.on_time_pct >= 80 ? '#10b981' : otp.on_time_pct >= 60 ? '#f59e0b' : '#ef4444'"
                      stroke-width="12" fill="none"
                      stroke-linecap="round"
                      :stroke-dasharray="`${(otp.on_time_pct / 100) * 314} 314`"
                      transform="rotate(-90 60 60)"/>
              <text x="60" y="58" text-anchor="middle" fill="#e2eaf5" font-size="22" font-weight="700">
                {{ otp.on_time_pct.toFixed(1) }}%
              </text>
              <text x="60" y="78" text-anchor="middle" fill="#8fa3b8" font-size="10">on-time</text>
            </svg>
          </div>
          <div class="otp-stats">
            <div class="otp-stat">
              <div class="otp-stat-label">Total flights</div>
              <div class="otp-stat-value">{{ otp.total_flights.toLocaleString() }}</div>
            </div>
            <div class="otp-stat">
              <div class="otp-stat-label">On-time</div>
              <div class="otp-stat-value text-success">{{ otp.on_time_flights.toLocaleString() }}</div>
            </div>
            <div class="otp-stat">
              <div class="otp-stat-label">Avg delay</div>
              <div class="otp-stat-value">{{ otp.avg_delay_min.toFixed(1) }} min</div>
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Flights by Status</div>
        </div>
        <div class="bar-list">
          <div v-for="row in summary?.by_status ?? []" :key="row.status" class="bar-row">
            <span class="bar-label">{{ row.status }}</span>
            <div class="bar-track">
              <div class="bar-fill"
                   :class="`status-${row.status}`"
                   :style="{ width: ((row.c / (summary?.kpis.flights_total ?? 1)) * 100) + '%' }"></div>
            </div>
            <span class="bar-value">{{ row.c }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Airports + Airlines -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Airports</div>
          <span class="badge badge-neutral">{{ airports.length }}</span>
        </div>
        <div v-if="!airports.length" class="card-body text-fg-muted">No airports.</div>
        <table v-else class="data-table">
          <thead><tr><th>IATA</th><th>Name</th><th>Type</th><th>Runways</th><th>Capacity</th></tr></thead>
          <tbody>
            <tr v-for="a in airports" :key="a.id">
              <td class="font-mono font-bold">{{ a.iata_code }}</td>
              <td>
                <div class="text-sm font-medium">{{ a.name }}</div>
                <div class="text-xs text-fg-muted">{{ a.city }}</div>
              </td>
              <td><span class="badge badge-info">{{ a.airport_type }}</span></td>
              <td class="font-mono text-xs">{{ a.runway_count }}</td>
              <td class="font-mono text-xs">{{ a.design_capacity_passengers.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Airlines</div>
          <span class="badge badge-neutral">{{ airlines.length }}</span>
        </div>
        <div v-if="!airlines.length" class="card-body text-fg-muted">No airlines.</div>
        <table v-else class="data-table">
          <thead><tr><th>IATA</th><th>Name</th><th>AOC</th><th>Fleet</th><th>Cargo?</th></tr></thead>
          <tbody>
            <tr v-for="a in airlines" :key="a.id">
              <td class="font-mono font-bold">{{ a.iata_code }}</td>
              <td>
                <div class="text-sm font-medium">{{ a.name }}</div>
                <div class="text-xs text-fg-muted">{{ a.country }}</div>
              </td>
              <td><span class="badge" :class="`badge-${aocBadge(a.aoc_status)}`">{{ a.aoc_status }}</span></td>
              <td class="font-mono text-xs">{{ a.fleet_size }}</td>
              <td>
                <span v-if="a.is_cargo_only" class="badge badge-warning">cargo</span>
                <span v-else class="text-fg-dim text-xs">pax</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Flight board -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Recent Flights ({{ days }}d)</div>
        <div class="filter-row">
          <select v-model="airlineFilter" class="select" @change="load">
            <option value="">All airlines</option>
            <option v-for="a in airlines" :key="a.iata_code" :value="a.iata_code">{{ a.iata_code }} · {{ a.name }}</option>
          </select>
          <select v-model="statusFilter" class="select" @change="load">
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="boarding">Boarding</option>
            <option value="departed">Departed</option>
            <option value="in_flight">In flight</option>
            <option value="landed">Landed</option>
            <option value="arrived">Arrived</option>
            <option value="delayed">Delayed</option>
            <option value="cancelled">Cancelled</option>
            <option value="diverted">Diverted</option>
          </select>
        </div>
      </div>
      <div v-if="error" class="card-body text-fg-muted">{{ error }}</div>
      <div v-else-if="loading && !flights.length" class="card-body text-fg-muted">Loading…</div>
      <div v-else-if="!flights.length" class="card-body text-fg-muted">No flights.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Flight</th><th>Airline</th><th>Route</th><th>Status</th>
            <th>Delay</th><th>Pax</th><th>Cargo</th><th>Date</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in flights" :key="f.id">
            <td class="font-mono font-bold">{{ f.schedule_flight_number || '—' }}</td>
            <td class="font-mono">{{ f.airline_iata }}</td>
            <td class="font-mono text-sm">
              {{ f.origin_code }} → {{ f.destination_code }}
              <span class="text-fg-dim text-xs">({{ f.aircraft_registration || '—' }})</span>
            </td>
            <td><span class="badge" :class="`badge-${statusBadge(f.status)}`">{{ f.status }}</span></td>
            <td class="font-mono text-xs">
              <span v-if="f.delay_departure_min > 0" class="text-warning">+{{ f.delay_departure_min }}m dep</span>
              <span v-if="f.delay_arrival_min > 0" class="text-warning"> +{{ f.delay_arrival_min }}m arr</span>
              <span v-if="f.delay_departure_min === 0 && f.delay_arrival_min === 0" class="text-fg-dim">on-time</span>
            </td>
            <td class="font-mono text-xs">
              {{ f.passengers_actual ?? f.passengers_booked }}
              <span v-if="f.passengers_actual == null" class="text-fg-dim">bkg</span>
            </td>
            <td class="font-mono text-xs">{{ f.cargo_kg?.toLocaleString() ?? '—' }} kg</td>
            <td class="font-mono text-xs">{{ fmtDate(f.flight_date) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Cargo + Passenger mix -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Cargo by Commodity ({{ days }}d)</div>
        </div>
        <div v-if="!cargo.length" class="card-body text-fg-muted">No cargo data.</div>
        <div v-else class="bar-list">
          <div v-for="c in cargo" :key="c.commodity" class="bar-row">
            <span class="bar-label">{{ c.commodity }}</span>
            <div class="bar-track">
              <div class="bar-fill" :class="`commodity-${c.commodity}`"
                   :style="{ width: ((c.total_kg / Math.max(...cargo.map(x => x.total_kg))) * 100) + '%' }"></div>
            </div>
            <span class="bar-value">
              {{ (c.total_kg / 1000).toFixed(1) }}t
              <span class="text-fg-dim">({{ c.shipments }})</span>
            </span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Passengers by Airport ({{ days }}d)</div>
        </div>
        <div v-if="!pax.length" class="card-body text-fg-muted">No passenger data.</div>
        <div v-else class="bar-list">
          <div v-for="x in pax" :key="x.airport__iata_code" class="bar-row">
            <span class="bar-label font-mono">{{ x.airport__iata_code }}</span>
            <div class="bar-track">
              <div class="bar-fill"
                   :style="{ width: ((x.total_pax / Math.max(...pax.map(p => p.total_pax))) * 100) + '%' }"></div>
            </div>
            <span class="bar-value">
              {{ x.total_pax.toLocaleString() }}
              <span class="text-fg-dim">({{ fmtKES(x.revenue_kes) }})</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aviation-page { display: flex; flex-direction: column; gap: 20px; }
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.kpi { padding: 14px 18px; }
.kpi-label { font-size: 0.7rem; text-transform: uppercase; color: var(--fg-muted, #8fa3b8); letter-spacing: 0.05em; }
.kpi-value { font-size: 1.6rem; font-weight: 700; margin: 6px 0 4px; }
.kpi-sub { font-size: 0.72rem; color: var(--fg-muted, #8fa3b8); }
.grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.otp-summary {
  display: grid;
  grid-template-columns: 130px 1fr;
  align-items: center;
  gap: 20px;
  padding: 18px;
}
.otp-svg { width: 130px; height: 130px; }
.otp-stats { display: flex; flex-direction: column; gap: 10px; }
.otp-stat { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); }
.otp-stat:last-child { border-bottom: 0; }
.otp-stat-label { color: var(--fg-muted); font-size: 0.8125rem; }
.otp-stat-value { font-family: 'JetBrains Mono', monospace; font-weight: 600; }
.text-success { color: #10b981; }
.text-warning { color: #f59e0b; }
.bar-list { padding: 6px 0; }
.bar-row {
  display: grid;
  grid-template-columns: 110px 1fr 160px;
  align-items: center;
  gap: 12px;
  padding: 8px 18px;
  font-size: 0.8125rem;
}
.bar-track { background: rgba(255,255,255,0.04); border-radius: 4px; height: 10px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #22d3ee); }
.status-arrived, .status-landed { background: linear-gradient(90deg, #10b981, #34d399); }
.status-delayed { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.status-cancelled, .status-diverted { background: linear-gradient(90deg, #ef4444, #f87171); }
.status-scheduled, .status-boarding, .status-departed, .status-in_flight { background: linear-gradient(90deg, #22d3ee, #67e8f9); }
.bar-value { font-family: 'JetBrains Mono', monospace; text-align: right; color: var(--fg-muted); font-size: 0.75rem; }
.filter-row { display: flex; gap: 8px; }
.select {
  background: var(--bg-2, #0f1623);
  border: 1px solid var(--border, #1e2d42);
  color: var(--fg, #e2eaf5);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.8125rem;
}
.flex { display: flex; }
.gap-2 { gap: 8px; }
.ml-1 { margin-left: 4px; }
.card-body { padding: 18px; }
</style>