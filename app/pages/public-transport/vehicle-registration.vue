<template>
  <PageHeader
    eyebrow="Public Transport · NTSA"
    title="Vehicle Registration"
    subtitle="NTSA - Vehicle registry, compliance linkage (inspection, insurance, tracking), search by plate/chassis, and drill-down"
  >
    <template #actions>
      <NuxtLink to="/public-transport/vehicle-inspections" class="btn">Inspections →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI cards -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Registered Vehicles"
      :value="fmtNum(summary?.kpis.total_vehicles)"
      sub="Cumulative to date"
      source="batch" source-title="NTSA VREG"
    />
    <KpiCard
      label="Operational"
      :value="fmtNum(byStatus.operational)"
      sub="Currently in service"
      source="live" source-title="NTSA VREG"
    />
    <KpiCard
      label="In Maintenance"
      :value="fmtNum(byStatus.maintenance)"
      sub="Off-road for service"
      source="live" source-title="NTSA VREG"
    />
    <KpiCard
      label="Impounded"
      :value="fmtNum(byStatus.impounded)"
      sub="Held by enforcement"
      trend-direction="down"
      source="live" source-title="NTSA VREG"
    />
    <KpiCard
      label="Registered Today"
      :value="fmtNum(registeredCounts.today)"
      sub="New registrations (loaded page)"
      source="batch" source-title="NTSA VREG"
    />
    <KpiCard
      label="Registered (7 Days)"
      :value="fmtNum(registeredCounts.week)"
      sub="7-day rolling total"
      source="batch" source-title="NTSA VREG"
    />
    <KpiCard
      label="Registered (This Month)"
      :value="fmtNum(registeredCounts.month)"
      sub="Current month"
      trend-direction="up"
      source="batch" source-title="NTSA VREG"
    />
    <KpiCard
      label="Speed Governor Online"
      :value="summary?.governor_compliance.online_pct != null ? summary.governor_compliance.online_pct.toFixed(1) + '%' : '-'"
      sub="Fleet-wide compliance"
      :trend-direction="(summary?.governor_compliance.online_pct ?? 0) >= 90 ? 'up' : 'down'"
      source="live" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="Inspection Expiring ≤30d"
      :value="fmtNum(expiring.inspection)"
      sub="Loaded page · needs renewal"
      trend-direction="down"
      source="batch" source-title="NTSA VREG"
    />
    <KpiCard
      label="Insurance Expiring ≤30d"
      :value="fmtNum(expiring.insurance)"
      sub="Loaded page · needs renewal"
      trend-direction="down"
      source="batch" source-title="NTSA VREG"
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
            <div class="bar-wrap"><div class="bar-fill" :style="{ width: `${maxType > 0 ? (t.total / maxType) * 100 : 0}%` }" /></div>
            <span class="bar-val">{{ fmtNum(t.total) }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:#94a3b8">{{ loading ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>

    <!-- By fuel type (computed from loaded page) -->
    <div class="card">
      <div class="card-header">Registrations by Fuel Type</div>
      <div class="card-body">
        <div v-if="byFuel.length" class="bar-list">
          <div v-for="f in byFuel" :key="f.fuel_type" class="bar-row">
            <span class="bar-label">{{ f.fuel_type }}</span>
            <div class="bar-wrap"><div class="bar-fill" style="background:#22c55e" :style="{ width: `${maxFuel > 0 ? (f.count / maxFuel) * 100 : 0}%` }" /></div>
            <span class="bar-val">{{ fmtNum(f.count) }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:#94a3b8">{{ loading ? 'Loading…' : 'No data' }}</div>
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
            <div class="bar-wrap"><div class="bar-fill" style="background:#f59e0b" :style="{ width: `${maxAge > 0 ? (a.count / maxAge) * 100 : 0}%` }" /></div>
            <span class="bar-val">{{ fmtNum(a.count) }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:#94a3b8">{{ loading ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>

    <!-- By operator category -->
    <div class="card">
      <div class="card-header">Top Operator Categories</div>
      <div class="card-body">
        <div v-if="byOperator.length" class="bar-list">
          <div v-for="o in byOperator" :key="o.operator" class="bar-row">
            <span class="bar-label">{{ o.operator }}</span>
            <div class="bar-wrap"><div class="bar-fill" style="background:#8b5cf6" :style="{ width: `${maxOperator > 0 ? (o.count / maxOperator) * 100 : 0}%` }" /></div>
            <span class="bar-val">{{ fmtNum(o.count) }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:#94a3b8">{{ loading ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>
  </div>

  <!-- Registry table -->
  <SectionTitle pill="NTSA VREG · Rolling">Vehicle Registry</SectionTitle>
  <div class="card">
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
            <template v-for="v in filteredVehicles" :key="v.id">
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
                  <span :style="{ color: v.has_recent_track ? '#22c55e' : '#94a3b8' }">{{ v.has_recent_track ? '● live' : '○ none' }}</span>
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
                        <div class="dd-item dd-item-block"><span style="color:#94a3b8">Engine no.</span><span>{{ v.engine_no || '-' }}</span></div>
                        <div class="dd-item dd-item-block"><span style="color:#94a3b8">Seating / Load</span><span>{{ v.seating_capacity ?? '-' }} seats · {{ fmtNum(v.load_capacity_kg) }} kg</span></div>
                        <div class="dd-item dd-item-block"><span style="color:#94a3b8">Operator / Agency</span><span>{{ v.operator_name ?? '-' }} ({{ v.agency_code ?? '-' }})</span></div>
                        <div class="dd-item dd-item-block"><span style="color:#94a3b8">Assigned route</span><span>{{ v.route_name ?? 'Unassigned' }}</span></div>
                        <div class="dd-item dd-item-block"><span style="color:#94a3b8">Speed governor</span><span>{{ v.has_speed_governor ? `Fitted · cap ${v.speed_limit_kmh} km/h` : 'Not fitted' }}</span></div>
                      </div>
                    </div>

                    <div class="dd-col">
                      <div class="dd-title">Inspection History</div>
                      <div v-if="drillCache[v.id]?.inspections?.length" class="dd-list">
                        <div v-for="ins in drillCache[v.id].inspections" :key="ins.id" class="dd-item">
                          <BadgePill :variant="resultBadge(ins.result)">{{ ins.result }}</BadgePill>
                          <span>{{ fmtDate(ins.inspected_at) }} · {{ ins.inspection_centre }}</span>
                        </div>
                      </div>
                      <div v-else class="dd-empty">{{ drillCache[v.id]?.loaded ? 'No inspection records available.' : 'Loading…' }}</div>
                    </div>

                    <div class="dd-col">
                      <div class="dd-title">Route Adherence</div>
                      <div v-if="drillCache[v.id]?.adherence?.length" class="dd-list">
                        <div v-for="a in drillCache[v.id].adherence" :key="a.id" class="dd-item">
                          <BadgePill :variant="adherenceBadge(a.verdict)">{{ a.verdict.replace(/_/g,' ') }}</BadgePill>
                          <span>{{ fmtDate(a.sampled_at) }} · {{ a.deviation_m != null ? a.deviation_m + 'm' : '-' }}</span>
                        </div>
                      </div>
                      <div v-else class="dd-empty">{{ drillCache[v.id]?.loaded ? 'No route-adherence records available.' : 'Loading…' }}</div>
                    </div>

                    <div class="dd-col">
                      <div class="dd-title">Behaviour / Incident Events</div>
                      <div v-if="drillCache[v.id]?.behaviour?.length" class="dd-list">
                        <div v-for="b in drillCache[v.id].behaviour" :key="b.id" class="dd-item">
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
              <td colspan="14" style="text-align:center;color:#94a3b8;padding:16px">
                {{ loading ? 'Loading vehicles…' : 'No vehicles match the current filters.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Vehicle Registration')

import { useFleet, useVehicleInspections } from '~/composables/api'
import type { Vehicle, FleetSummary, VehicleType, DriverBehaviorEvent, RouteAdherence } from '~/composables/api'
import type { VehicleInspection } from '~/composables/api'

const summary   = ref<FleetSummary | null>(null)
const vehicles  = ref<Vehicle[]>([])
const loading   = ref(true)
const error     = ref<string | null>(null)
const lastRefreshed = ref('-')

const search       = ref('')
const statusFilter = ref('')
const typeFilter   = ref('')
const fuelFilter   = ref('')
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
  search.value = ''; statusFilter.value = ''; typeFilter.value = ''; fuelFilter.value = ''
}

// ── Computed ─────────────────────────────────────────────────────────────
const filteredVehicles = computed(() => vehicles.value.filter(v => {
  if (search.value) {
    const q = search.value.toLowerCase()
    if (!v.plate_number.toLowerCase().includes(q) && !v.chassis_no.toLowerCase().includes(q)) return false
  }
  if (statusFilter.value && v.status !== statusFilter.value) return false
  if (typeFilter.value && v.vehicle_type !== typeFilter.value) return false
  if (fuelFilter.value && v.fuel_type !== fuelFilter.value) return false
  return true
}))

const vehicleTypes = computed(() => [...new Set(vehicles.value.map(v => v.vehicle_type))].sort())
const fuelTypes    = computed(() => [...new Set(vehicles.value.map(v => v.fuel_type))].sort())

const byStatus = computed(() => summary.value?.vehicles_by_status ?? {})
const byType   = computed(() => summary.value?.vehicles_by_type ?? [])
const maxType  = computed(() => Math.max(1, ...byType.value.map(t => t.total ?? 0)))

const byFuel = computed(() => {
  const m = new Map<string, number>()
  for (const v of vehicles.value) m.set(v.fuel_type, (m.get(v.fuel_type) ?? 0) + 1)
  return [...m.entries()].map(([fuel_type, count]) => ({ fuel_type, count })).sort((a, b) => b.count - a.count)
})
const maxFuel = computed(() => Math.max(1, ...byFuel.value.map(f => f.count)))

const byAgeBand = computed(() => {
  const bands = { '0-3 yrs': 0, '4-7 yrs': 0, '8-15 yrs': 0, '16+ yrs': 0, Unknown: 0 }
  const thisYear = new Date().getFullYear()
  for (const v of vehicles.value) {
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
  for (const v of vehicles.value) {
    const key = v.operator_name ?? v.agency_code ?? 'Unassigned'
    m.set(key, (m.get(key) ?? 0) + 1)
  }
  return [...m.entries()].map(([operator, count]) => ({ operator, count })).sort((a, b) => b.count - a.count).slice(0, 8)
})
const maxOperator = computed(() => Math.max(1, ...byOperator.value.map(o => o.count)))

const registeredCounts = computed(() => {
  const now = Date.now()
  const day = 86_400_000
  let today = 0, week = 0, month = 0
  for (const v of vehicles.value) {
    if (!v.created_at) continue
    const age = now - new Date(v.created_at).getTime()
    if (age <= day) today++
    if (age <= 7 * day) week++
    if (age <= 30 * day) month++
  }
  return { today, week, month }
})

const expiring = computed(() => {
  let inspection = 0, insurance = 0
  for (const v of vehicles.value) {
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
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:900px) { .two-col { grid-template-columns:1fr; } }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
.bar-list { display:flex; flex-direction:column; gap:8px; }
.bar-row { display:grid; grid-template-columns:130px 1fr 40px; align-items:center; gap:8px; }
.bar-label { font-size:12px; color:#475569; text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.bar-fill { height:100%; background:#3b82f6; border-radius:4px; transition:width .4s; }
.bar-val { font-size:12px; color:#64748b; text-align:right; }
.veh-row { cursor:pointer; }
.expand-cell { width:18px; color:#94a3b8; font-size:11px; }
.veh-detail-row td { background:#fafbfc; padding:14px 18px; border-bottom:1px solid #f1f5f9; }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; }
.dd-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#64748b; margin-bottom:8px; }
.dd-list { display:flex; flex-direction:column; gap:6px; }
.dd-item { display:flex; align-items:center; gap:8px; font-size:12px; flex-wrap:wrap; }
.dd-item-block { flex-direction:column; align-items:flex-start; gap:2px; }
.dd-empty { font-size:12px; color:#94a3b8; }
</style>
