<template>
  <PageHeader
    eyebrow="Aviation"
    title="Aviation Infrastructure"
    subtitle="KCAA · KAA - Airport registry, capacity utilisation, runway/navaid condition, terminal & ATC facilities, and capital works"
  >
    <template #actions>
      <NuxtLink to="/aviation" class="btn">Flight Movements →</NuxtLink>
      <NuxtLink to="/aviation/licensing" class="btn">Aircraft Licencing →</NuxtLink>
      <NuxtLink to="/aviation/passenger-stats" class="btn">Passenger Stats →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">
    ⚠ {{ error }} Runway condition, navaid status, terminal/ATC facility health, and capital-works integration with KCAA/KAA asset management is not yet live - airport registry and capacity figures below are computed from the live airport catalogue.
  </div>

  <!-- Real registry KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Registered Airports" :value="fmtNum(airports.length)" :unavailable="loading || apError" :unavailable-note="loading ? 'Loading…' : 'KAA Registry feed unavailable'" period="LIVE" :description="`${fmtNum(internationalCount)} international`" to="#airport-registry" />
    <KpiCard label="Total Runways" :value="fmtNum(totalRunways)" :unavailable="loading || apError" :unavailable-note="loading ? 'Loading…' : 'KAA Registry feed unavailable'" period="LIVE" description="Across all registered airports" to="#airport-registry" />
    <KpiCard label="Design Capacity" :value="`${fmtNum(totalDesignCapacity)}/yr`" :unavailable="loading || apError" :unavailable-note="loading ? 'Loading…' : 'KAA Registry feed unavailable'" period="LIVE" description="Sum of registered passenger design capacity" to="#terminal-capacity" />
    <KpiCard label="Active Airports" :value="fmtNum(activeCount)" :unavailable="loading || apError" :unavailable-note="loading ? 'Loading…' : 'KAA Registry feed unavailable'" period="LIVE" :description="`of ${fmtNum(airports.length)} registered`" to="#airport-registry" />
  </div>

  <!-- TBD infra KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Runway Availability" :value="infra ? pct(infra.kpis.runway_availability_pct) : '-'" :unavailable="!infra" :unavailable-note="loading ? 'Loading…' : 'KCAA AMS feed unavailable'" period="LIVE" description="Operational runways" :status="!infra ? undefined : infra.kpis.runway_availability_pct >= 95 ? 'healthy' : 'warning'" to="#runway-condition" />
    <KpiCard label="Navaid Availability" :value="infra ? pct(infra.kpis.navaid_operational_pct) : '-'" :unavailable="!infra" :unavailable-note="loading ? 'Loading…' : 'KCAA AMS feed unavailable'" period="LIVE" description="VOR/ILS/NDB/DME uptime" to="#navaids" />
    <KpiCard label="ATC Infra Health" :value="infra ? pct(infra.kpis.atc_infra_health_pct) : '-'" :unavailable="!infra" :unavailable-note="loading ? 'Loading…' : 'KCAA AMS feed unavailable'" period="LIVE" description="Air traffic control systems" to="#terminal-facilities" />
    <KpiCard label="Terminals Over Capacity" :value="infra ? fmtNum(infra.kpis.terminals_over_capacity) : fmtNum(overCapacityAirports.length)" :unavailable="loading || apError" :unavailable-note="loading ? 'Loading…' : 'KAA AMS feed unavailable'" period="LIVE" description="Utilisation above design" :status="loading || apError ? undefined : (infra ? infra.kpis.terminals_over_capacity : overCapacityAirports.length) > 0 ? 'warning' : 'healthy'" to="#terminal-capacity" />
    <KpiCard label="Fuel Farms Degraded" :value="infra ? fmtNum(infra.kpis.fuel_farms_degraded) : '-'" :unavailable="!infra" :unavailable-note="loading ? 'Loading…' : 'KAA AMS feed unavailable'" period="LIVE" description="Below operational status" :status="!infra ? undefined : infra.kpis.fuel_farms_degraded === 0 ? 'healthy' : 'warning'" to="#terminal-facilities" />
    <KpiCard label="Open Work Orders" :value="infra ? fmtNum(infra.kpis.open_work_orders) : fmtNum(openCapitalWorks.length)" :unavailable="loading || cwError" :unavailable-note="loading ? 'Loading…' : 'KAA AMS feed unavailable'" period="LIVE" description="Infrastructure maintenance" to="#capital-works" />
    <KpiCard label="Capital Works Value" :value="capitalWorksValue ? `KES ${fmtKES(capitalWorksValue)}` : (infra ? `KES ${fmtKES(infra.kpis.capital_works_value_kes)}` : '-')" :unavailable="loading || cwError" :unavailable-note="loading ? 'Loading…' : 'KAA / National Treasury feed unavailable'" period="LIVE" description="Active investment pipeline" to="#capital-works" />
    <KpiCard label="ICAO Annex 14 Compliance" :value="infra ? pct(infra.kpis.icao_annex14_compliance_pct) : '-'" :unavailable="!infra" :unavailable-note="loading ? 'Loading…' : 'KCAA feed unavailable'" period="LIVE" description="Aerodrome safety standards" :status="!infra ? undefined : infra.kpis.icao_annex14_compliance_pct >= 90 ? 'healthy' : 'warning'" to="#runway-condition" />
  </div>

  <!-- Capacity utilisation -->
  <SectionTitle pill="Computed · Live Registry × Passenger Stats">Terminal Capacity Utilisation</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Airport</th><th>IATA</th><th>Design Capacity/yr</th><th>Annualised Actual (est.)</th><th>Utilisation</th></tr></thead>
          <tbody v-if="capacityUtilisation.length">
            <tr v-for="c in capUtilPageRows" :key="c.iata">
              <td style="font-weight:600">{{ c.name }}</td>
              <td style="font-family:monospace">{{ c.iata }}</td>
              <td>{{ fmtNum(c.designCapacity) }}</td>
              <td>{{ c.annualisedActual != null ? fmtNum(c.annualisedActual) : '-' }}</td>
              <td>
                <div v-if="c.utilizationPct != null" class="util-bar-wrap">
                  <div class="util-bar" :style="{ transform: `scaleX(${Math.min(100, c.utilizationPct) / 100})`, background: c.utilizationPct > 100 ? 'var(--destructive)' : c.utilizationPct >= 70 ? 'var(--warning)' : 'var(--success)' }" />
                </div>
                <span style="font-size:11px">{{ c.utilizationPct != null ? `${c.utilizationPct.toFixed(0)}%` : '-' }}</span>
              </td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No passenger-stats data available to estimate utilisation.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="capUtilPage" :total-pages="capUtilTotalPages" :total="capUtilTotal"
          @prev="capUtilPrev" @next="capUtilNext"
        />
      </div>
      <div class="source-note">Annualised actual is estimated by scaling the {{ paxDays }}-day passenger total to a full year - directional only, not a reported annual figure.</div>
    </div>
  </div>

  <!-- Airport map -->
  <SectionTitle pill="Live Registry">Airport Map</SectionTitle>
  <div class="card map-card">
    <div class="card-header">Registered Airports</div>
    <ClientOnly>
      <UaptsMap
        :markers="airportMarkers"
        :center="[0.0, 37.9]"
        :zoom="6"
        height="380px"
      />
    </ClientOnly>
  </div>

  <!-- Airport registry -->
  <SectionTitle pill="Live Registry">Airport Registry</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="search" class="select-sm" placeholder="Search name / IATA / city…" style="min-width:180px" />
        <select v-model="typeFilter" class="select-sm">
          <option value="">All types</option>
          <option value="international">International</option>
          <option value="regional">Regional</option>
          <option value="domestic">Domestic</option>
          <option value="military">Military</option>
          <option value="private">Private</option>
        </select>
        <button class="btn" @click="search=''; typeFilter=''">Clear</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Airport</th><th>IATA/ICAO</th><th>City</th><th>Type</th><th>Runways</th><th>Elevation (ft)</th><th>Operator</th><th>International</th><th>Status</th></tr></thead>
          <tbody v-if="filteredAirports.length">
            <tr v-for="a in airportsPageRows" :key="a.id">
              <td style="font-weight:600">{{ a.name }}</td>
              <td style="font-family:monospace;font-size:12px">{{ a.iata_code }} / {{ a.icao_code }}</td>
              <td style="font-size:12px">{{ a.city }}</td>
              <td><BadgePill variant="info">{{ a.airport_type }}</BadgePill></td>
              <td>{{ a.runway_count }}</td>
              <td>{{ fmtNum(a.elevation_ft) }}</td>
              <td style="font-size:12px">{{ a.operator }}</td>
              <td style="text-align:center">{{ a.has_international ? '✓' : '-' }}</td>
              <td><BadgePill :variant="a.active ? 'success' : 'neutral'">{{ a.active ? 'Active' : 'Inactive' }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="9" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading airports…' : 'No airports match the current filters.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="airportsPage" :total-pages="airportsTotalPages" :total="airportsTotal"
          @prev="airportsPrev" @next="airportsNext"
        />
      </div>
    </div>
  </div>

  <!-- Runway condition -->
  <SectionTitle pill="KCAA AMS · Pending Integration">Runway Condition</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Airport</th><th>Runway</th><th>Length (m)</th><th>Surface</th><th>PCN Rating</th><th>Status</th><th>Last Inspection</th><th>Next Inspection</th><th>Defect Notes</th></tr></thead>
          <tbody v-if="runways.length">
            <tr v-for="r in runwaysPageRows" :key="r.id">
              <td style="font-weight:600;font-family:monospace">{{ r.airport_iata }}</td>
              <td>{{ r.runway_id }}</td>
              <td>{{ r.length_m }}</td>
              <td style="font-size:12px">{{ r.surface_type }}</td>
              <td>{{ r.pcn_rating ?? '-' }}</td>
              <td><BadgePill :variant="runwayBadge(r.status)">{{ r.status.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-size:11px">{{ fmtDate(r.last_inspection) }}</td>
              <td style="font-size:11px">{{ fmtDate(r.next_inspection) }}</td>
              <td style="font-size:12px">{{ r.defect_notes ?? '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="9" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'Runway condition/PCN survey data has not been integrated from KCAA asset management yet.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="runwaysPage" :total-pages="runwaysTotalPages" :total="runwaysTotal"
          @prev="runwaysPrev" @next="runwaysNext"
        />
      </div>
    </div>
  </div>

  <!-- Navaids -->
  <SectionTitle pill="KCAA AMS · Pending Integration">Navigational Aids</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Airport</th><th>Type</th><th>Status</th><th>Last Calibration</th><th>Next Calibration</th></tr></thead>
          <tbody v-if="navaids.length">
            <tr v-for="n in navaidsPageRows" :key="n.id">
              <td style="font-weight:600;font-family:monospace">{{ n.airport_iata }}</td>
              <td><BadgePill variant="info">{{ n.navaid_type.toUpperCase() }}</BadgePill></td>
              <td><BadgePill :variant="facilityStatusBadge(n.status)">{{ n.status.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-size:11px">{{ fmtDate(n.last_calibration) }}</td>
              <td style="font-size:11px">{{ fmtDate(n.next_calibration) }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'Navaid status has not been integrated from KCAA asset management yet.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="navaidsPage" :total-pages="navaidsTotalPages" :total="navaidsTotal"
          @prev="navaidsPrev" @next="navaidsNext"
        />
      </div>
    </div>
  </div>

  <!-- Terminal / ATC / fuel-farm facilities -->
  <SectionTitle pill="KAA AMS · Pending Integration">Terminal, ATC &amp; Ground Facilities</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Airport</th><th>Facility</th><th>Type</th><th>Status</th><th>Capacity/hr</th><th>Utilisation</th><th>Maintenance Due</th></tr></thead>
          <tbody v-if="facilities.length">
            <tr v-for="f in facilitiesPageRows" :key="f.id">
              <td style="font-weight:600;font-family:monospace">{{ f.airport_iata }}</td>
              <td style="font-size:12px">{{ f.name }}</td>
              <td><BadgePill variant="info">{{ f.facility_type.replace(/_/g,' ') }}</BadgePill></td>
              <td><BadgePill :variant="facilityStatusBadge(f.status)">{{ f.status.replace(/_/g,' ') }}</BadgePill></td>
              <td>{{ f.capacity_pax_hour ?? '-' }}</td>
              <td>{{ f.utilization_pct != null ? `${f.utilization_pct.toFixed(0)}%` : '-' }}</td>
              <td style="font-size:11px">{{ fmtDate(f.maintenance_due) }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="7" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'Terminal/ATC/fuel-farm facility status has not been integrated from KAA asset management yet.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="facilitiesPage" :total-pages="facilitiesTotalPages" :total="facilitiesTotal"
          @prev="facilitiesPrev" @next="facilitiesNext"
        />
      </div>
    </div>
  </div>

  <!-- Capital works -->
  <SectionTitle pill="KAA / National Treasury · Pending Integration">Capital Works Pipeline</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead><tr><th>Project</th><th>Airport</th><th>Contractor</th><th>Scope</th><th>Physical</th><th>Financial</th><th>Capacity Impact</th></tr></thead>
        <tbody v-if="capitalWorks.length">
          <tr v-for="c in capitalWorksPageRows" :key="c.id">
            <td style="font-weight:600;font-size:12px">{{ c.project_name }}</td>
            <td style="font-family:monospace">{{ c.airport_iata }}</td>
            <td style="font-size:12px">{{ c.contractor ?? '-' }}</td>
            <td style="font-size:12px">{{ c.scope }}</td>
            <td style="font-size:12px">{{ c.physical_progress_pct != null ? `${c.physical_progress_pct.toFixed(0)}%` : '-' }}</td>
            <td style="font-size:12px">{{ c.financial_progress_pct != null ? `${c.financial_progress_pct.toFixed(0)}%` : '-' }}</td>
            <td style="font-size:12px">{{ c.expected_capacity_impact ?? '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="7" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'Capital-works pipeline has not been integrated from KAA/National Treasury yet.' }}</td></tr></tbody>
      </table>
      <TablePagination
        :page="capitalWorksPage" :total-pages="capitalWorksTotalPages" :total="capitalWorksTotal"
        @prev="capitalWorksPrev" @next="capitalWorksNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useAviationMaritime, useAviationInfrastructure } from '~/composables/api'
import type { Airport, PassengerByAirport, Runway, Navaid, AviationFacility, AviationCapitalWork, AviationInfraSummary } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

const airports     = ref<Airport[]>([])
const pax          = ref<PassengerByAirport[]>([])
const runways      = ref<Runway[]>([])
const navaids      = ref<Navaid[]>([])
const facilities   = ref<AviationFacility[]>([])
const capitalWorks = ref<AviationCapitalWork[]>([])
const infra        = ref<AviationInfraSummary | null>(null)
const loading      = ref(true)
const error        = ref<string | null>(null)
const apError      = ref(false)
const cwError      = ref(false)
const paxDays       = ref(30)

const search     = ref('')
const typeFilter = ref('')

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()
  const ai  = useAviationInfrastructure()

  const [apRes, paxRes, rwRes, ndRes, faRes, cwRes, sumRes] = await Promise.allSettled([
    avm.airports(),
    avm.passengersByAirport({ days: paxDays.value }),
    ai.runways({ page_size: 200 }),
    ai.navaids({ page_size: 200 }),
    ai.facilities({ page_size: 200 }),
    ai.capitalWorks({ page_size: 100 }),
    ai.summary(),
  ])

  if (apRes.status  === 'fulfilled') airports.value     = (apRes.value as any).results ?? []
  if (paxRes.status === 'fulfilled') pax.value          = (paxRes.value as any).results ?? []
  if (rwRes.status  === 'fulfilled') runways.value      = (rwRes.value as any).results ?? []
  if (ndRes.status  === 'fulfilled') navaids.value      = (ndRes.value as any).results ?? []
  if (faRes.status  === 'fulfilled') facilities.value   = (faRes.value as any).results ?? []
  if (cwRes.status  === 'fulfilled') capitalWorks.value = (cwRes.value as any).results ?? []
  if (sumRes.status === 'fulfilled') infra.value        = sumRes.value

  apError.value = apRes.status === 'rejected'
  cwError.value = cwRes.status === 'rejected'
  if (apError.value)
    error.value = 'Unable to reach the UAPTS Aviation API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Real registry KPIs ───────────────────────────────────────────────────
const internationalCount  = computed(() => airports.value.filter(a => a.has_international).length)
const activeCount         = computed(() => airports.value.filter(a => a.active).length)
const totalRunways        = computed(() => airports.value.reduce((s, a) => s + (a.runway_count ?? 0), 0))
const totalDesignCapacity = computed(() => airports.value.reduce((s, a) => s + (a.design_capacity_passengers ?? 0), 0))

const openCapitalWorks  = computed(() => capitalWorks.value.filter(c => c.physical_progress_pct != null && c.physical_progress_pct < 100))
// value_kes comes back as a string (Django DecimalField JSON serialization) -
// Number() it explicitly, otherwise `0 + "123.45"` string-concatenates instead
// of adding, and the garbled result renders as "KES NaN".
const capitalWorksValue = computed(() => capitalWorks.value.reduce((s, c) => s + Number(c.value_kes ?? 0), 0) || null)

// ── Capacity utilisation (real cross-reference) ─────────────────────────
const capacityUtilisation = computed(() => pax.value.map(p => {
  const airport = airports.value.find(a => a.iata_code === p.airport__iata_code)
  const designCapacity = airport?.design_capacity_passengers ?? null
  const annualisedActual = p.total_pax != null ? Math.round((p.total_pax / paxDays.value) * 365) : null
  const utilizationPct = designCapacity && annualisedActual != null && designCapacity > 0
    ? (annualisedActual / designCapacity) * 100
    : null
  return { iata: p.airport__iata_code, name: p.airport__name, designCapacity, annualisedActual, utilizationPct }
}).sort((a, b) => (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0)))

const overCapacityAirports = computed(() => capacityUtilisation.value.filter(c => (c.utilizationPct ?? 0) > 100))

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: capUtilPageRows, page: capUtilPage, totalPages: capUtilTotalPages,
  total: capUtilTotal, next: capUtilNext, prev: capUtilPrev,
} = usePagination(capacityUtilisation, 15)

const {
  pageRows: runwaysPageRows, page: runwaysPage, totalPages: runwaysTotalPages,
  total: runwaysTotal, next: runwaysNext, prev: runwaysPrev,
} = usePagination(runways, 15)

const {
  pageRows: navaidsPageRows, page: navaidsPage, totalPages: navaidsTotalPages,
  total: navaidsTotal, next: navaidsNext, prev: navaidsPrev,
} = usePagination(navaids, 15)

const {
  pageRows: facilitiesPageRows, page: facilitiesPage, totalPages: facilitiesTotalPages,
  total: facilitiesTotal, next: facilitiesNext, prev: facilitiesPrev,
} = usePagination(facilities, 15)

const {
  pageRows: capitalWorksPageRows, page: capitalWorksPage, totalPages: capitalWorksTotalPages,
  total: capitalWorksTotal, next: capitalWorksNext, prev: capitalWorksPrev,
} = usePagination(capitalWorks, 15)

const airportMarkers = computed((): MarkerSpec[] =>
  airports.value
    .filter(a => a.latitude != null && a.longitude != null)
    .map(a => ({
      id: `ap-${a.id}`,
      lat: a.latitude!,
      lon: a.longitude!,
      title: a.name,
      subtitle: `${a.iata_code} / ${a.icao_code} · ${a.runway_count} runway(s) · ${a.active ? 'active' : 'inactive'}`,
      color: a.airport_type === 'international' ? 'red' : a.airport_type === 'regional' ? 'blue' : 'green',
      size: a.airport_type === 'international' ? 'lg' : 'md',
    })),
)

// ── Registry filters ─────────────────────────────────────────────────────
const filteredAirports = computed(() => airports.value.filter(a => {
  if (search.value) {
    const q = search.value.toLowerCase()
    if (!a.name.toLowerCase().includes(q) && !a.iata_code.toLowerCase().includes(q) && !a.city.toLowerCase().includes(q)) return false
  }
  if (typeFilter.value && a.airport_type !== typeFilter.value) return false
  return true
}))

const {
  pageRows: airportsPageRows, page: airportsPage, totalPages: airportsTotalPages,
  total: airportsTotal, next: airportsNext, prev: airportsPrev,
} = usePagination(filteredAirports, 15)

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(n: number | null | undefined) {
  if (n == null) return '-'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}k`
  return Math.round(n).toLocaleString()
}
function pct(v: number | null | undefined) { return v == null ? '-' : `${v.toFixed(1)}%` }
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function runwayBadge(s: string) {
  const m: Record<string,string> = { operational:'success', restricted:'warning', closed:'danger', under_maintenance:'warning' }
  return m[s] ?? 'neutral'
}
function facilityStatusBadge(s: string) {
  const m: Record<string,string> = { operational:'success', degraded:'warning', out_of_service:'danger', under_maintenance:'warning' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.map-card { overflow:hidden; margin-bottom:16px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.table-scroll { overflow-x:auto; }
.util-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.util-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
.source-note { margin-top:10px; font-size:11px; color:var(--fg-3); border-top:1px solid var(--border-subtle); padding-top:10px; }
</style>
