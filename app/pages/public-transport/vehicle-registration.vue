<template>
  <PageHeader
    eyebrow="Public Transport · NTSA"
    title="Vehicle Registration"
    subtitle="NTSA - Vehicle registry, compliance linkage (inspection, insurance, tracking), search by plate/chassis, and drill-down"
  >
    <template #actions>
      <DayRangeToggle v-model="registeredDays" :options="[7, 14, 30]" deselectable />
      <NuxtLink to="/public-transport/vehicle-inspections" class="btn">Inspections →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI cards -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Registered Vehicles"
      :value="fmtNum(registeredDays ? scopedVehicles.length : summary?.kpis.total_vehicles)"
      :unavailable="registeredDays ? (loading || vehiclesError) : (loading || summaryError)"
      :unavailable-note="loading ? 'Loading…' : 'NTSA VREG feed unavailable'"
      :period="registeredDays ? `${registeredDays}D` : 'ALL'"
      :description="registeredDays ? `Registered in last ${registeredDays}d · loaded page` : 'Cumulative to date'"
      to="#vehicle-registry"
    />
    <KpiCard
      label="Operational"
      :value="fmtNum(byStatus.operational)"
      :unavailable="registeredDays ? (loading || vehiclesError) : (loading || summaryError)"
      :unavailable-note="loading ? 'Loading…' : 'NTSA VREG feed unavailable'"
      :period="registeredDays ? `${registeredDays}D` : 'LIVE'"
      :description="registeredDays ? `Currently in service · last ${registeredDays}d` : 'Currently in service'"
    />
    <KpiCard
      label="In Maintenance"
      :value="fmtNum(byStatus.maintenance)"
      :unavailable="registeredDays ? (loading || vehiclesError) : (loading || summaryError)"
      :unavailable-note="loading ? 'Loading…' : 'NTSA VREG feed unavailable'"
      :period="registeredDays ? `${registeredDays}D` : 'LIVE'"
      :description="registeredDays ? `Off-road for service · last ${registeredDays}d` : 'Off-road for service'"
    />
    <KpiCard
      label="Impounded"
      :value="fmtNum(byStatus.impounded)"
      :unavailable="registeredDays ? (loading || vehiclesError) : (loading || summaryError)"
      :unavailable-note="loading ? 'Loading…' : 'NTSA VREG feed unavailable'"
      :period="registeredDays ? `${registeredDays}D` : 'LIVE'"
      :description="registeredDays ? `Held by enforcement · last ${registeredDays}d` : 'Held by enforcement'"
    />
    <KpiCard
      label="Speed Governor Online"
      :value="summary?.governor_compliance.online_pct != null ? summary.governor_compliance.online_pct.toFixed(1) + '%' : '-'"
      :unavailable="loading || summaryError"
      :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE"
      description="Fleet-wide compliance · not affected by the registration-date filter"
      :status="summary?.governor_compliance.online_pct == null ? undefined : summary.governor_compliance.online_pct >= 90 ? 'healthy' : 'warning'"
    />
    <KpiCard
      label="Inspection Expiring ≤30d"
      :value="fmtNum(expiring.inspection)"
      :unavailable="loading || vehiclesError"
      :unavailable-note="loading ? 'Loading…' : 'NTSA VREG feed unavailable'"
      :period="registeredDays ? `${registeredDays}D` : 'LIVE'"
      :description="registeredDays ? `Loaded page · last ${registeredDays}d · needs renewal` : 'Loaded page · needs renewal'"
    />
    <KpiCard
      label="Insurance Expiring ≤30d"
      :value="fmtNum(expiring.insurance)"
      :unavailable="loading || vehiclesError"
      :unavailable-note="loading ? 'Loading…' : 'NTSA VREG feed unavailable'"
      :period="registeredDays ? `${registeredDays}D` : 'LIVE'"
      :description="registeredDays ? `Loaded page · last ${registeredDays}d · needs renewal` : 'Loaded page · needs renewal'"
    />
  </div>

  <div class="two-col">
    <!-- By vehicle type (real aggregate) -->
    <div class="card">
      <div class="card-header">Registrations by Vehicle Type</div>
      <div class="card-body">
        <div v-if="byType.length" class="bar-list">
          <div v-for="t in byType" :key="t.vehicle_type" class="bar-row">
            <span class="bar-label">{{ t.vehicle_type.replace(/_/g,' ') }}</span>
            <div class="bar-wrap"><div class="bar-fill" :style="{ transform: `scaleX(${maxType > 0 ? t.total / maxType : 0})` }" /></div>
            <span class="bar-val">{{ fmtNum(t.total) }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:var(--fg-3)">{{ loading ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>

    <!-- By fuel type (computed from loaded page) -->
    <div class="card">
      <div class="card-header">Registrations by Fuel Type</div>
      <div class="card-body">
        <div v-if="byFuel.length" class="bar-list">
          <div v-for="f in byFuel" :key="f.fuel_type" class="bar-row">
            <span class="bar-label">{{ f.fuel_type }}</span>
            <div class="bar-wrap"><div class="bar-fill" :style="{ transform: `scaleX(${maxFuel > 0 ? f.count / maxFuel : 0})`, background: 'var(--success)' }" /></div>
            <span class="bar-val">{{ fmtNum(f.count) }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:var(--fg-3)">{{ loading ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>
  </div>

  <div class="two-col">
    <!-- By age band -->
    <div class="card">
      <div class="card-header">Registrations by Age Band</div>
      <div class="card-body">
        <div v-if="byAgeBand.length" class="bar-list">
          <div v-for="a in byAgeBand" :key="a.band" class="bar-row">
            <span class="bar-label">{{ a.band }}</span>
            <div class="bar-wrap"><div class="bar-fill" :style="{ transform: `scaleX(${maxAge > 0 ? a.count / maxAge : 0})`, background: 'var(--warning)' }" /></div>
            <span class="bar-val">{{ fmtNum(a.count) }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:var(--fg-3)">{{ loading ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>

    <!-- By operator category -->
    <div class="card">
      <div class="card-header">Top Operator Categories</div>
      <div class="card-body">
        <div v-if="byOperator.length" class="bar-list">
          <div v-for="o in byOperator" :key="o.operator" class="bar-row">
            <span class="bar-label">{{ o.operator }}</span>
            <div class="bar-wrap"><div class="bar-fill" :style="{ transform: `scaleX(${maxOperator > 0 ? o.count / maxOperator : 0})`, background: 'var(--accent-purple)' }" /></div>
            <span class="bar-val">{{ fmtNum(o.count) }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:var(--fg-3)">{{ loading ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>
  </div>

  <!-- Registry table -->
  <SectionTitle pill="NTSA VREG · Rolling">Vehicle Registry</SectionTitle>
  <div id="vehicle-registry" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="search" class="select-sm" placeholder="Search plate or chassis no…" style="min-width:200px" />
        <select v-model="statusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="operational">Operational</option>
          <option value="maintenance">Maintenance</option>
          <option value="impounded">Impounded</option>
        </select>
        <select v-model="typeFilter" class="select-sm">
          <option value="">All vehicle types</option>
          <option v-for="t in vehicleTypes" :key="t" :value="t">{{ t.replace(/_/g,' ') }}</option>
        </select>
        <select v-model="fuelFilter" class="select-sm">
          <option value="">All fuel types</option>
          <option v-for="f in fuelTypes" :key="f" :value="f">{{ f }}</option>
        </select>
        <span v-if="registeredDays" class="reg-filter-label">Registered ≤{{ registeredDays }}d · {{ fmtNum(filteredVehicles.length) }} match</span>
        <button class="btn" @click="clearFilters">Clear</button>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Plate No.</th>
              <th>Chassis No.</th>
              <th>Make / Model</th>
              <th>Year</th>
              <th>Type</th>
              <th>Fuel</th>
              <th>Operator / Agency</th>
              <th>Route</th>
              <th>Inspection</th>
              <th>Insurance</th>
              <th>Tracking</th>
              <th>Status</th>
              <th>Last Update</th>
            </tr>
          </thead>
          <tbody v-if="filteredVehicles.length">
            <template v-for="v in vehiclesPageRows" :key="v.id">
              <tr class="veh-row" @click="toggleExpand(v)">
                <td class="expand-cell">{{ expandedId === v.id ? '▾' : '▸' }}</td>
                <td style="font-weight:700;font-family:monospace">{{ v.plate_number }}</td>
                <td style="font-family:monospace;font-size:11px">{{ v.chassis_no }}</td>
                <td style="font-size:12px">{{ v.make }} {{ v.model_name }}</td>
                <td>{{ v.year_of_manufacture ?? '-' }}</td>
                <td style="font-size:12px">{{ v.vehicle_type.replace(/_/g,' ') }}</td>
                <td style="font-size:12px;text-transform:capitalize">{{ v.fuel_type }}</td>
                <td style="font-size:12px">{{ v.operator_name ?? v.agency_code ?? '-' }}</td>
                <td style="font-size:12px">{{ v.route_name ?? '-' }}</td>
                <td>
                  <BadgePill :variant="expiryBadge(v.inspection_expiry)">{{ expiryLabel(v.inspection_expiry) }}</BadgePill>
                </td>
                <td>
                  <BadgePill :variant="expiryBadge(v.insurance_expiry)">{{ expiryLabel(v.insurance_expiry) }}</BadgePill>
                </td>
                <td style="text-align:center">
                  <span :style="{ color: v.has_recent_track ? 'var(--success-fg)' : 'var(--fg-3)' }">{{ v.has_recent_track ? '● live' : '○ none' }}</span>
                </td>
                <td><BadgePill :variant="statusBadge(v.status)">{{ v.status }}</BadgePill></td>
                <td style="font-size:11px">{{ fmtDate(v.updated_at) }}</td>
              </tr>
              <tr v-if="expandedId === v.id" class="veh-detail-row">
                <td :colspan="14">
                  <div class="drilldown">
                    <div class="dd-col">
                      <div class="dd-title">Vehicle / Operator Link</div>
                      <div class="dd-list">
                        <div class="dd-item dd-item-block"><span style="color:var(--fg-3)">Engine no.</span><span>{{ v.engine_no || '-' }}</span></div>
                        <div class="dd-item dd-item-block"><span style="color:var(--fg-3)">Seating / Load</span><span>{{ v.seating_capacity ?? '-' }} seats · {{ fmtNum(v.load_capacity_kg) }} kg</span></div>
                        <div class="dd-item dd-item-block"><span style="color:var(--fg-3)">Operator / Agency</span><span>{{ v.operator_name ?? '-' }} ({{ v.agency_code ?? '-' }})</span></div>
                        <div class="dd-item dd-item-block"><span style="color:var(--fg-3)">Assigned route</span><span>{{ v.route_name ?? 'Unassigned' }}</span></div>
                        <div class="dd-item dd-item-block"><span style="color:var(--fg-3)">Speed governor</span><span>{{ v.has_speed_governor ? `Fitted · cap ${v.speed_limit_kmh} km/h` : 'Not fitted' }}</span></div>
                      </div>
                    </div>

                    <div class="dd-col">
                      <div class="dd-title">Inspection History</div>
                      <div v-if="drillCache[v.id]?.inspections?.length" class="dd-list">
                        <div v-for="ins in drillCache[v.id]?.inspections ?? []" :key="ins.id" class="dd-item">
                          <BadgePill :variant="resultBadge(ins.result)">{{ ins.result }}</BadgePill>
                          <span>{{ fmtDate(ins.inspected_at) }} · {{ ins.inspection_centre }}</span>
                        </div>
                      </div>
                      <div v-else class="dd-empty">{{ drillCache[v.id]?.loaded ? 'No inspection records available.' : 'Loading…' }}</div>
                    </div>

                    <div class="dd-col">
                      <div class="dd-title">Route Adherence</div>
                      <div v-if="drillCache[v.id]?.adherence?.length" class="dd-list">
                        <div v-for="a in drillCache[v.id]?.adherence ?? []" :key="a.id" class="dd-item">
                          <BadgePill :variant="adherenceBadge(a.verdict)">{{ a.verdict.replace(/_/g,' ') }}</BadgePill>
                          <span>{{ fmtDate(a.sampled_at) }} · {{ a.deviation_m != null ? a.deviation_m + 'm' : '-' }}</span>
                        </div>
                      </div>
                      <div v-else class="dd-empty">{{ drillCache[v.id]?.loaded ? 'No route-adherence records available.' : 'Loading…' }}</div>
                    </div>

                    <div class="dd-col">
                      <div class="dd-title">Behaviour / Incident Events</div>
                      <div v-if="drillCache[v.id]?.behaviour?.length" class="dd-list">
                        <div v-for="b in drillCache[v.id]?.behaviour ?? []" :key="b.id" class="dd-item">
                          <BadgePill :variant="severityBadge(b.severity)">{{ b.severity }}</BadgePill>
                          <span>{{ b.event_type.replace(/_/g,' ') }} · {{ fmtDate(b.detected_at) }}</span>
                        </div>
                      </div>
                      <div v-else class="dd-empty">{{ drillCache[v.id]?.loaded ? 'No behaviour events on file.' : 'Loading…' }}</div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
          <tbody v-else>
            <tr>
              <td colspan="14" style="text-align:center;color:var(--fg-3);padding:16px">
                {{ loading ? 'Loading vehicles…' : 'No vehicles match the current filters.' }}
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
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useFleet, useVehicleInspections } from '~/composables/api'
import type { Vehicle, FleetSummary, VehicleType, DriverBehaviorEvent, RouteAdherence } from '~/composables/api'
import type { VehicleInspection } from '~/composables/api'

const summary   = ref<FleetSummary | null>(null)
const vehicles  = ref<Vehicle[]>([])
const loading   = ref(true)
const error     = ref<string | null>(null)
const summaryError = ref(false)
const vehiclesError = ref(false)
const lastRefreshed = ref('-')

const search       = ref('')
const statusFilter = ref('')
const typeFilter   = ref('')
const fuelFilter   = ref('')
const registeredDays = ref<number | null>(null)
const expandedId   = ref<string | null>(null)

const drillCache = reactive<Record<string, { loaded: boolean; inspections: VehicleInspection[]; adherence: RouteAdherence[]; behaviour: DriverBehaviorEvent[] }>>({})

async function load() {
  loading.value = true
  error.value = null
  const fleet = useFleet()

  const [sumRes, vehRes] = await Promise.allSettled([
    fleet.summary(),
    fleet.vehicles({ page_size: 100 }),
  ])

  if (sumRes.status === 'fulfilled') summary.value = sumRes.value
  if (vehRes.status === 'fulfilled') vehicles.value = (vehRes.value as any).results ?? []

  summaryError.value = sumRes.status === 'rejected'
  vehiclesError.value = vehRes.status === 'rejected'

  if ([sumRes, vehRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Fleet / NTSA VREG API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

async function toggleExpand(v: Vehicle) {
  if (expandedId.value === v.id) { expandedId.value = null; return }
  expandedId.value = v.id
  if (drillCache[v.id]) return

  const fleet = useFleet()
  const vi = useVehicleInspections()
  const [insRes, adhRes, behRes] = await Promise.allSettled([
    vi.forVehicle(v.id),
    fleet.routeAdherence({ vehicle: v.id, page_size: 10 }),
    fleet.behaviourEvents({ vehicle: v.id, page_size: 10 }),
  ])
  drillCache[v.id] = {
    loaded: true,
    inspections: insRes.status === 'fulfilled' ? ((insRes.value as any).results ?? []) : [],
    adherence: adhRes.status === 'fulfilled' ? ((adhRes.value as any).results ?? []) : [],
    behaviour: behRes.status === 'fulfilled' ? ((behRes.value as any).results ?? []) : [],
  }
}
function clearFilters() {
  search.value = ''; statusFilter.value = ''; typeFilter.value = ''; fuelFilter.value = ''; registeredDays.value = null
}

// ── Computed ─────────────────────────────────────────────────────────────
// Built on top of scopedVehicles (below) so the registry table and every
// KPI/chart on the page apply the 7d/14d/30d window consistently.
const filteredVehicles = computed(() => scopedVehicles.value.filter(v => {
  if (search.value) {
    const q = search.value.toLowerCase()
    if (!v.plate_number.toLowerCase().includes(q) && !v.chassis_no.toLowerCase().includes(q)) return false
  }
  if (statusFilter.value && v.status !== statusFilter.value) return false
  if (typeFilter.value && v.vehicle_type !== typeFilter.value) return false
  if (fuelFilter.value && v.fuel_type !== fuelFilter.value) return false
  return true
}))

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: vehiclesPageRows, page: vehiclesPage, totalPages: vehiclesTotalPages,
  total: vehiclesTotal, next: vehiclesNext, prev: vehiclesPrev,
} = usePagination(filteredVehicles, 15)

const vehicleTypes = computed(() => [...new Set(vehicles.value.map(v => v.vehicle_type))].sort())
const fuelTypes    = computed(() => [...new Set(vehicles.value.map(v => v.fuel_type))].sort())

// Vehicles registered within the selected 7d/14d/30d window - the source
// every KPI/chart below switches to once a window is picked, instead of
// only the registry table filtering while everything above it stays static.
const scopedVehicles = computed(() => {
  if (!registeredDays.value) return vehicles.value
  const horizon = registeredDays.value * 86_400_000
  return vehicles.value.filter(v => v.created_at && (Date.now() - new Date(v.created_at).getTime()) <= horizon)
})

// Unscoped: real backend-wide aggregate (summary.vehicles_by_status).
// Scoped: no backend endpoint computes status counts for a registration-date
// window, so derive it from the loaded (page_size:100-capped) vehicle page -
// same "exact unscoped / computed-from-loaded-page when scoped" pattern used
// for agency filtering elsewhere in this app.
const byStatus = computed(() => {
  if (!registeredDays.value) return summary.value?.vehicles_by_status ?? {}
  const m: Record<string, number> = {}
  for (const v of scopedVehicles.value) m[v.status] = (m[v.status] ?? 0) + 1
  return m
})
const byType = computed(() => {
  if (!registeredDays.value) return summary.value?.vehicles_by_type ?? []
  const m = new Map<string, number>()
  for (const v of scopedVehicles.value) m.set(v.vehicle_type, (m.get(v.vehicle_type) ?? 0) + 1)
  return [...m.entries()].map(([vehicle_type, total]) => ({ vehicle_type, total })).sort((a, b) => b.total - a.total)
})
const maxType  = computed(() => Math.max(1, ...byType.value.map(t => t.total ?? 0)))

const byFuel = computed(() => {
  const m = new Map<string, number>()
  for (const v of scopedVehicles.value) m.set(v.fuel_type, (m.get(v.fuel_type) ?? 0) + 1)
  return [...m.entries()].map(([fuel_type, count]) => ({ fuel_type, count })).sort((a, b) => b.count - a.count)
})
const maxFuel = computed(() => Math.max(1, ...byFuel.value.map(f => f.count)))

const byAgeBand = computed(() => {
  const bands = { '0-3 yrs': 0, '4-7 yrs': 0, '8-15 yrs': 0, '16+ yrs': 0, Unknown: 0 }
  const thisYear = new Date().getFullYear()
  for (const v of scopedVehicles.value) {
    if (!v.year_of_manufacture) { bands.Unknown++; continue }
    const age = thisYear - v.year_of_manufacture
    if (age <= 3) bands['0-3 yrs']++
    else if (age <= 7) bands['4-7 yrs']++
    else if (age <= 15) bands['8-15 yrs']++
    else bands['16+ yrs']++
  }
  return Object.entries(bands).filter(([, c]) => c > 0).map(([band, count]) => ({ band, count }))
})
const maxAge = computed(() => Math.max(1, ...byAgeBand.value.map(a => a.count)))

const byOperator = computed(() => {
  const m = new Map<string, number>()
  for (const v of scopedVehicles.value) {
    const key = v.operator_name ?? v.agency_code ?? 'Unassigned'
    m.set(key, (m.get(key) ?? 0) + 1)
  }
  return [...m.entries()].map(([operator, count]) => ({ operator, count })).sort((a, b) => b.count - a.count).slice(0, 8)
})
const maxOperator = computed(() => Math.max(1, ...byOperator.value.map(o => o.count)))

const expiring = computed(() => {
  let inspection = 0, insurance = 0
  for (const v of scopedVehicles.value) {
    if (v.inspection_expiry && daysUntil(v.inspection_expiry) <= 30 && daysUntil(v.inspection_expiry) >= 0) inspection++
    if (v.insurance_expiry && daysUntil(v.insurance_expiry) <= 30 && daysUntil(v.insurance_expiry) >= 0) insurance++
  }
  return { inspection, insurance }
})

// ── Helpers ──────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'2-digit' }) }
  catch { return s }
}
function daysUntil(dateStr: string): number {
  try { return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000) }
  catch { return 999 }
}
function expiryLabel(s: string | null) {
  if (!s) return 'Unknown'
  const d = daysUntil(s)
  if (d < 0) return 'Expired'
  if (d <= 30) return `${d}d left`
  return 'Valid'
}
function expiryBadge(s: string | null) {
  if (!s) return 'neutral'
  const d = daysUntil(s)
  if (d < 0) return 'danger'
  if (d <= 30) return 'warning'
  return 'success'
}
function statusBadge(s: string) {
  const m: Record<string,string> = { operational:'success', maintenance:'warning', impounded:'danger' }
  return m[s] ?? 'neutral'
}
function resultBadge(r: string) {
  const m: Record<string,string> = { pass:'success', fail:'danger', conditional_pass:'warning', pending:'neutral' }
  return m[r] ?? 'neutral'
}
function adherenceBadge(v: string) {
  const m: Record<string,string> = { on_route:'success', deviation:'warning', unknown:'neutral' }
  return m[v] ?? 'neutral'
}
function severityBadge(s: string) {
  const m: Record<string,string> = { low:'info', medium:'warning', high:'danger', critical:'danger' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:900px) { .two-col { grid-template-columns:1fr; } }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.reg-filter-label { font-size:12px; color:var(--fg-2); font-weight:600; }
.table-scroll { overflow-x:auto; }
.bar-list { display:flex; flex-direction:column; gap:8px; }
.bar-row { display:grid; grid-template-columns:130px 1fr 40px; align-items:center; gap:8px; }
.bar-label { font-size:12px; color:var(--fg-2); text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-wrap { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.bar-fill { height:100%; width:100%; background:var(--primary-fill); border-radius:4px; transform-origin:left; transition:transform .4s; }
.bar-val { font-size:12px; color:var(--fg-2); text-align:right; }
.veh-row { cursor:pointer; }
.expand-cell { width:18px; color:var(--fg-3); font-size:11px; }
.veh-detail-row td { background:var(--surface-1); padding:14px 18px; border-bottom:1px solid var(--border-subtle); }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; }
.dd-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--fg-2); margin-bottom:8px; }
.dd-list { display:flex; flex-direction:column; gap:6px; }
.dd-item { display:flex; align-items:center; gap:8px; font-size:12px; flex-wrap:wrap; }
.dd-item-block { flex-direction:column; align-items:flex-start; gap:2px; }
.dd-empty { font-size:12px; color:var(--fg-3); }
</style>
