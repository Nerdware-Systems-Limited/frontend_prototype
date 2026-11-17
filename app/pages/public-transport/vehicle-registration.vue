<template>
  <PageHeader
    eyebrow="Public Transport · NTSA"
    title="Vehicle Registration"
    subtitle="NTSA - Vehicle registry, compliance linkage (inspection, insurance, tracking), and drill-down"
  >
    <template #actions>
      <NuxtLink to="/public-transport/vehicle-inspections" class="btn">Inspections<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner banner-icon-warn" role="alert">{{ error }}</div>

  <!-- KPI cards: counted by the server over ALL vehicles in the chosen window, not over a first page -->
  <div class="kpi-grid">
    <KpiCard label="Total Registered Vehicles" :value="fmtNum(stats.count.value)" :unavailable="unavailable" :unavailable-note="note" :period="period" :description="windowSel ? `Registered · ${windowSel.label}` : 'Cumulative to date'" to="#vehicle-registry" />
    <KpiCard label="Operational" :value="fmtNum(stats.groupCount('status', 'operational'))" :unavailable="unavailable" :unavailable-note="note" :period="period" :description="'Currently in service'" />
    <KpiCard label="In Maintenance" :value="fmtNum(stats.groupCount('status', 'maintenance'))" :unavailable="unavailable" :unavailable-note="note" :period="period" :description="'Off-road for service'" />
    <KpiCard label="Impounded" :value="fmtNum(stats.groupCount('status', 'impounded'))" :unavailable="unavailable" :unavailable-note="note" :period="period" :description="'Held by enforcement'" />
    <KpiCard
      label="Speed Governor Online"
      :value="summary?.governor_compliance.online_pct != null ? summary.governor_compliance.online_pct.toFixed(1) + '%' : '-'"
      :unavailable="!summary" :unavailable-note="summaryLoading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE" description="Fleet-wide compliance · not affected by the registration-date filter"
      :status="summary?.governor_compliance.online_pct == null ? undefined : summary.governor_compliance.online_pct >= 90 ? 'healthy' : 'warning'"
    />
    <KpiCard label="Inspection Expiring ≤30d" :value="fmtNum(inspectionExpiring.count.value)" :unavailable="unavailable" :unavailable-note="note" :period="period" :description="'Needs renewal'" />
    <KpiCard label="Insurance Expiring ≤30d" :value="fmtNum(insuranceExpiring.count.value)" :unavailable="unavailable" :unavailable-note="note" :period="period" :description="'Needs renewal'" />
  </div>

  <div class="two-col">
    <div class="card">
      <div class="card-header">Registrations by Vehicle Type</div>
      <div class="card-body">
        <div v-if="byType.length" class="bar-list">
          <div v-for="r in byType" :key="r.label" class="bar-row">
            <span class="bar-label">{{ r.label }}</span>
            <div class="bar-wrap"><div class="bar-fill" :style="{ transform: `scaleX(${maxType > 0 ? r.count / maxType : 0})` }" /></div>
            <span class="bar-val">{{ fmtNum(r.count) }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:var(--fg-3)">{{ stats.loading.value ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">Registrations by Fuel Type</div>
      <div class="card-body">
        <div v-if="byFuel.length" class="bar-list">
          <div v-for="r in byFuel" :key="r.label" class="bar-row">
            <span class="bar-label">{{ r.label }}</span>
            <div class="bar-wrap"><div class="bar-fill" :style="{ transform: `scaleX(${maxFuel > 0 ? r.count / maxFuel : 0})`, background: 'var(--success)' }" /></div>
            <span class="bar-val">{{ fmtNum(r.count) }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:var(--fg-3)">{{ stats.loading.value ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>
  </div>

  <div class="two-col">
    <div class="card">
      <div class="card-header">Registrations by Age Band</div>
      <div class="card-body">
        <div v-if="byAgeBand.length" class="bar-list">
          <div v-for="r in byAgeBand" :key="r.label" class="bar-row">
            <span class="bar-label">{{ r.label }}</span>
            <div class="bar-wrap"><div class="bar-fill" :style="{ transform: `scaleX(${maxAge > 0 ? r.count / maxAge : 0})`, background: 'var(--warning)' }" /></div>
            <span class="bar-val">{{ fmtNum(r.count) }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:var(--fg-3)">{{ stats.loading.value ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">Top Operators</div>
      <div class="card-body">
        <div v-if="byOperator.length" class="bar-list">
          <div v-for="r in byOperator" :key="r.label" class="bar-row">
            <span class="bar-label">{{ r.label }}</span>
            <div class="bar-wrap"><div class="bar-fill" :style="{ transform: `scaleX(${maxOperator > 0 ? r.count / maxOperator : 0})`, background: 'var(--accent-purple)' }" /></div>
            <span class="bar-val">{{ fmtNum(r.count) }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:var(--fg-3)">{{ stats.loading.value ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>
  </div>

  <!-- Registry table -->
  <SectionTitle pill="NTSA VREG · Rolling">Vehicle Registry</SectionTitle>
  <div id="vehicle-registry" class="card drill-target">
    <div class="card-body">
      <DataTable :table="vehicleTable" row-key="id" title="Vehicle registry" export-name="uapts-vehicle-registry" expandable filters-open
                 placeholder="Search make, operator…" empty="No vehicles match the current filters.">
        <template #cell-make="{ row }">{{ row.make }} {{ row.model_name }}</template>
        <template #cell-operator_name="{ row }">{{ row.operator_name ?? row.agency_code ?? '-' }}</template>
        <template #cell-inspection_expiry="{ row }"><BadgePill :variant="expiryBadge(row.inspection_expiry)">{{ expiryLabel(row.inspection_expiry) }}</BadgePill></template>
        <template #cell-insurance_expiry="{ row }"><BadgePill :variant="expiryBadge(row.insurance_expiry)">{{ expiryLabel(row.insurance_expiry) }}</BadgePill></template>
        <template #cell-has_recent_track="{ row }">
          <span :style="{ color: row.has_recent_track ? 'var(--success-fg)' : 'var(--fg-3)' }">{{ row.has_recent_track ? '● live' : '○ none' }}</span>
        </template>
        <template #expanded="{ row }"><VehicleDetailPanel :vehicle="row" /></template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useFleet } from '~/composables/api'
import type { FleetSummary } from '~/composables/api'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useServerCount } from '~/composables/useServerCount'
import { useCountyScope } from '~/composables/useCountyScope'
import { eatDate, periodBadge, rangeBounds } from '~/utils/timeRange'
import { useGlobalScope } from '~/composables/useGlobalScope'
import type { TableColumn } from '~/types/dataTable'

// The registry is a window onto ALL vehicles (search, filters, sorting, paging on the server) and every KPI / breakdown is a
// server count or group over the same filter - county and the "registered in the last N days" window included - so nothing is
// derived from a first page (see docs/data-tables.md).
const V = '/api/v1/fleet/vehicles/'

// County filter for this module, following the global filter in the top bar until a county is picked here.
const county = useCountyScope('public-transport')
// The registration window is the global period (top bar); with none set the registry shows every vehicle.
const globalScope = useGlobalScope()
const windowSel = computed(() => (globalScope.range.value ? rangeBounds(globalScope.range.value) : null))

// Dates are EAT calendar days, like the rest of the platform.
const today = () => eatDate(new Date())
const plusDays = (n: number) => eatDate(new Date(Date.now() + n * 86_400_000))
const windowQuery = () => (windowSel.value ? { 'f.created_at__gte': windowSel.value.from, 'f.created_at__lte': windowSel.value.to } : {})
const scope = () => ({ ...county.query.value, ...windowQuery() })

const STATUSES = ['operational', 'maintenance', 'impounded'].map(value => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))
const STATUS_BADGE: Record<string, string> = { operational: 'success', maintenance: 'warning', impounded: 'danger' }

// ── Vehicle registry ─────────────────────────────────────────────────────
const vehicleColumns: TableColumn[] = [
  // Personal identifiers (registration / plate no., chassis no., engine no., owner name / ID / phone) are deliberately not displayed.
  { key: 'make', label: 'Make / Model', priority: 1, pin: 'left', exportAs: r => `${r.make} ${r.model_name}` },
  { key: 'year_of_manufacture', label: 'Year', type: 'num', digits: 0, priority: 3 },
  { key: 'vehicle_type', label: 'Type', priority: 2 },
  { key: 'fuel_type', label: 'Fuel', priority: 3 },
  { key: 'operator_name', label: 'Operator / Agency', priority: 2 },
  { key: 'route_name', label: 'Route', priority: 3 },
  { key: 'inspection_expiry', label: 'Inspection', type: 'date', priority: 2 },
  { key: 'insurance_expiry', label: 'Insurance', type: 'date', priority: 2 },
  { key: 'has_recent_track', label: 'Tracking', sortable: 'last_seen_at', filter: false, exportAs: r => (r.has_recent_track ? 'live' : 'none'), priority: 3 },
  { key: 'status', label: 'Status', type: 'badge', badge: STATUS_BADGE, options: STATUSES, priority: 1 },
  { key: 'updated_at', label: 'Last Update', type: 'date', priority: 3 },
]
const vehicleTable = useEndpointTable({
  key: 'pt-vehicle-registry', path: V, columns: vehicleColumns, countyKey: 'public-transport', pageSize: 15,
  params: windowQuery, defaultSort: [{ key: 'updated_at', dir: 'desc' }],
})

// ── KPIs and breakdowns: counted by the server ───────────────────────────
const stats = useServerCount(V, scope, { groupBy: ['status', 'vehicle_type', 'fuel_type'] })
// The API allows at most 3 group_by columns per request, so the operator breakdown is its own count.
const operatorStats = useServerCount(V, scope, { groupBy: ['operator_name'] })
const inspectionExpiring = useServerCount(V, () => ({ ...scope(), 'f.inspection_expiry__gte': today(), 'f.inspection_expiry__lte': plusDays(30) }))
const insuranceExpiring = useServerCount(V, () => ({ ...scope(), 'f.insurance_expiry__gte': today(), 'f.insurance_expiry__lte': plusDays(30) }))
// Age bands by year of manufacture (a vehicle's age is this year minus the year it was made).
const thisYear = new Date().getFullYear()
const BANDS: { label: string; q: Record<string, unknown> }[] = [
  { label: '0-3 yrs', q: { 'f.year_of_manufacture__gte': thisYear - 3 } },
  { label: '4-7 yrs', q: { 'f.year_of_manufacture__gte': thisYear - 7, 'f.year_of_manufacture__lt': thisYear - 3 } },
  { label: '8-15 yrs', q: { 'f.year_of_manufacture__gte': thisYear - 15, 'f.year_of_manufacture__lt': thisYear - 7 } },
  { label: '16+ yrs', q: { 'f.year_of_manufacture__lt': thisYear - 15 } },
  { label: 'Unknown', q: { 'f.year_of_manufacture__isnull': 'true' } },
]
const ageStats = BANDS.map(b => ({ label: b.label, stat: useServerCount(V, () => ({ ...scope(), ...b.q })) }))
const allStats = [stats, operatorStats, inspectionExpiring, insuranceExpiring, ...ageStats.map(a => a.stat)]

const unavailable = computed(() => stats.count.value === null)
const note = computed(() => stats.loading.value ? 'Loading…' : 'NTSA VREG feed unavailable')
const period = computed(() => (globalScope.range.value ? periodBadge(globalScope.range.value) : 'ALL'))
const error = computed(() => stats.failed.value && !stats.loading.value ? 'Unable to reach the UAPTS Fleet / NTSA VREG API.' : null)

const named = (col: string, fallback = 'Unknown', src = stats) =>
  (src.groups.value?.[col] ?? []).map((g: any) => ({ label: String(g.value ?? fallback).replace(/_/g, ' '), count: g.count as number }))
const byType = computed(() => named('vehicle_type'))
const byFuel = computed(() => named('fuel_type'))
const byOperator = computed(() => named('operator_name', 'Unassigned', operatorStats).slice(0, 8))
const byAgeBand = computed(() => ageStats.map(a => ({ label: a.label, count: a.stat.count.value ?? 0 })).filter(a => a.count > 0))
const maxOf = (rows: { count: number }[]) => Math.max(1, ...rows.map(r => r.count))
const maxType = computed(() => maxOf(byType.value))
const maxFuel = computed(() => maxOf(byFuel.value))
const maxAge = computed(() => maxOf(byAgeBand.value))
const maxOperator = computed(() => maxOf(byOperator.value))

// ── Fleet-wide governor compliance (not tied to the window) ──────────────
const summary = ref<FleetSummary | null>(null)
const summaryLoading = ref(true)
async function loadSummary() {
  try { summary.value = await useFleet().summary() } catch { /* the card shows its unavailable state */ } finally { summaryLoading.value = false }
}
onMounted(loadSummary)

function refreshAll() { void Promise.all([vehicleTable.refresh(), ...allStats.map(s => s.refresh()), loadSummary()]) }
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(refreshAll, 120_000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

// ── Helpers ──────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
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
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:900px) { .two-col { grid-template-columns:1fr; } }
.bar-list { display:flex; flex-direction:column; gap:8px; }
.bar-row { display:grid; grid-template-columns:130px 1fr 40px; align-items:center; gap:8px; }
.bar-label { font-size:12px; color:var(--fg-2); text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-wrap { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.bar-fill { height:100%; width:100%; background:var(--primary-fill); border-radius:4px; transform-origin:left; transition:transform .4s; }
.bar-val { font-size:12px; color:var(--fg-2); text-align:right; }
</style>
