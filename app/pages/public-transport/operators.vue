<template>
  <PageHeader
    eyebrow="Public Transport - Public Operators"
    title="Public Operators"
    subtitle="NaMATA · NTSA · NCTTCA - Operator registry, service quality, fleet & route compliance, revenue and complaint drill-down"
  >
    <template #actions>
      <NuxtLink to="/public-transport/compliance" class="btn">PSV Compliance<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/public-transport/vehicle-inspections" class="btn">Inspections<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner banner-icon-warn" role="alert">{{ error }}</div>

  <!-- KPIs: counted, summed and averaged by the server over ALL operators / routes / licences, not over a first page -->
  <div class="kpi-grid">
    <KpiCard label="Registered Operators" :value="fmtNum(operatorStats.count.value)" :unavailable="operatorStats.count.value === null" :unavailable-note="note(operatorStats)" period="LIVE" :description="`${fmtNum(operatorStats.groupCount('registration_status', 'active'))} active`" to="#operator-registry" />
    <KpiCard label="Suspended" :value="fmtNum(operatorStats.groupCount('registration_status', 'suspended'))" :unavailable="operatorStats.count.value === null" :unavailable-note="note(operatorStats)" period="LIVE" description="Registration suspended" />
    <KpiCard label="Revoked" :value="fmtNum(operatorStats.groupCount('registration_status', 'revoked'))" :unavailable="operatorStats.count.value === null" :unavailable-note="note(operatorStats)" period="LIVE" description="Registration revoked" />
    <KpiCard label="Total Fleet Size" :value="fmtNum(operatorStats.sum('fleet_size'))" :unavailable="operatorStats.count.value === null" :unavailable-note="note(operatorStats)" period="LIVE" description="Across all operators" />
    <KpiCard label="Active Routes" :value="fmtNum(activeRoutes.count.value)" :unavailable="activeRoutes.count.value === null" :unavailable-note="note(activeRoutes)" period="LIVE" :description="`${fmtNum(routeStats.count.value)} total routes served`" />
    <KpiCard label="Avg Service Quality" :value="avgQuality != null ? avgQuality.toFixed(0) + '/100' : '-'" :unavailable="operatorStats.count.value === null" :unavailable-note="note(operatorStats)" period="LIVE" description="Composite score, all operators" :status="avgQuality == null ? undefined : avgQuality >= 70 ? 'healthy' : 'warning'" />
    <KpiCard label="Open Complaints" :value="fmtNum(openComplaints.count.value)" :unavailable="openComplaints.count.value === null" :unavailable-note="note(openComplaints)" period="LIVE" description="Unresolved passenger feedback" />
    <KpiCard label="Route Compliance" :value="routeCompliance != null ? routeCompliance.toFixed(1) + '%' : '-'" :unavailable="complianceStats.count.value === null" :unavailable-note="note(complianceStats)" period="LIVE" description="Compliant checks / total checks" :status="routeCompliance == null ? undefined : routeCompliance >= 85 ? 'healthy' : 'warning'" />
    <KpiCard label="Avg GPS Compliance" :value="avgGps != null ? avgGps.toFixed(1) + '%' : '-'" :unavailable="gpsStats.count.value === null" :unavailable-note="note(gpsStats)" period="LIVE" description="Across active PSV licences" :status="avgGps == null ? undefined : avgGps >= 90 ? 'healthy' : 'warning'" />
    <KpiCard label="PSV Licence Compliance" :value="licenceCompliance != null ? licenceCompliance.toFixed(1) + '%' : '-'" :unavailable="licenceStats.count.value === null" :unavailable-note="note(licenceStats)" period="LIVE" description="Active licences / total issued" />
  </div>

  <!-- Registry -->
  <SectionTitle pill="NaMATA / NTSA · Rolling">Operator Registry</SectionTitle>

  <div id="operator-registry" class="card drill-target">
    <div class="card-body">
      <DataTable :table="operatorTable" row-key="id" title="Operator registry" export-name="uapts-operators" expandable filters-open
                 placeholder="Search operator name…" empty="No operators match the current filters.">
        <template #cell-sacco_name="{ row }"><span style="font-weight:600">{{ row.sacco_name }}</span></template>
        <template #cell-service_quality_score="{ row }">
          <div class="util-bar-wrap"><div class="util-bar" :style="{ transform: `scaleX(${row.service_quality_score / 100})`, background: scoreBg(row.service_quality_score) }" /></div>
          <span style="font-size:11px">{{ Number(row.service_quality_score).toFixed(0) }}/100</span>
        </template>
        <template #expanded="{ row }"><OperatorDetailPanel :sacco="row.id" /></template>
      </DataTable>
    </div>
  </div>

  <!-- Demand forecasts -->
  <SectionTitle pill="AI Model · NaMATA">Demand Forecasts (Next 24h)</SectionTitle>

  <div class="card">
    <div class="card-body">
      <DataTable :table="forecastTable" row-key="id" title="Demand forecasts" export-name="uapts-demand-forecasts"
                 placeholder="Search route, model…" empty="No demand forecast data available.">
        <template #cell-route_name="{ row }"><span style="font-weight:600">{{ row.route_name ?? row.route }}</span></template>
        <template #cell-predicted_passengers="{ row }"><span style="font-weight:700">{{ fmtNum(row.predicted_passengers) }}</span></template>
        <template #cell-range="{ row }">{{ fmtNum(row.lower_passengers) }} – {{ fmtNum(row.upper_passengers) }}</template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useServerCount } from '~/composables/useServerCount'
import { useCountyScope } from '~/composables/useCountyScope'
import type { TableColumn } from '~/types/dataTable'

// The registry and the forecasts are windows onto the WHOLE dataset (search, filters, sorting, paging on the server) and every
// KPI is a server count / sum / average - nothing is computed from a first page (see docs/data-tables.md). The per-operator
// drill-down loads only the opened operator's records.
const PT = '/api/v1/public-transport'

// County filter for this module, following the global filter in the top bar until a county is picked here.
const county = useCountyScope('public-transport')
const scope = () => county.query.value

const REG_STATUSES = ['active', 'suspended', 'revoked'].map(value => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))
const REG_BADGE: Record<string, string> = { active: 'success', suspended: 'warning', revoked: 'danger' }

// ── Operator registry ────────────────────────────────────────────────────
const operatorColumns: TableColumn[] = [
  { key: 'sacco_name', label: 'Operator', priority: 1, pin: 'left', minWidth: 170 },
  { key: 'registration_status', label: 'Status', type: 'badge', badge: REG_BADGE, options: REG_STATUSES, priority: 1 },
  { key: 'route_count', label: 'Routes', type: 'num', priority: 2 },
  { key: 'fleet_size', label: 'Fleet', type: 'num', priority: 1 },
  { key: 'service_quality_score', label: 'Service Quality', type: 'num', digits: 0, priority: 1 },
  { key: 'updated_at', label: 'Last Refresh', type: 'date', priority: 3 },
]
const operatorTable = useEndpointTable({
  key: 'pt-operators', path: `${PT}/saccos/`, columns: operatorColumns, countyKey: 'public-transport', pageSize: 15,
  defaultSort: [{ key: 'sacco_name', dir: 'asc' }],
})

// ── Demand forecasts (the endpoint serves only future targets, soonest first) ──
const forecastColumns: TableColumn[] = [
  { key: 'route_name', label: 'Route', priority: 1, pin: 'left', minWidth: 150 },
  { key: 'target_at', label: 'Target Time', type: 'datetime', priority: 1 },
  { key: 'predicted_passengers', label: 'Predicted Pax', type: 'num', priority: 1 },
  { key: 'range', label: 'Range', sortable: false, filter: false, exportAs: r => `${r.lower_passengers}-${r.upper_passengers}`, priority: 2 },
  { key: 'model_name', label: 'Model', priority: 3 },
  { key: 'horizon_hours', label: 'Horizon (h)', type: 'num', priority: 3 },
]
const forecastTable = useEndpointTable({
  key: 'pt-demand-forecasts', path: `${PT}/demand-forecasts/`, columns: forecastColumns, countyKey: 'public-transport', pageSize: 15,
  defaultSort: [{ key: 'target_at', dir: 'asc' }],
})

// ── KPIs: counted by the server ──────────────────────────────────────────
const operatorStats = useServerCount(`${PT}/saccos/`, scope, { aggregate: ['sum:fleet_size', 'avg:service_quality_score'], groupBy: ['registration_status'] })
const routeStats = useServerCount(`${PT}/routes/`, scope)
const activeRoutes = useServerCount(`${PT}/routes/`, () => ({ ...scope(), 'f.is_active__exact': 'true' }))
const openComplaints = useServerCount(`${PT}/feedback/`, () => ({ ...scope(), 'f.status__exact': 'open' }))
const complianceStats = useServerCount(`${PT}/compliance/`, scope, { groupBy: ['status'] })
const gpsStats = useServerCount(`${PT}/psv-licenses/`, () => ({ ...scope(), 'f.status__exact': 'active' }), { aggregate: ['avg:gps_compliance_pct'] })
const licenceStats = useServerCount(`${PT}/psv-licenses/`, scope, { groupBy: ['status'] })
const allStats = [operatorStats, routeStats, activeRoutes, openComplaints, complianceStats, gpsStats, licenceStats]

const avgQuality = computed(() => operatorStats.avg('service_quality_score'))
const avgGps = computed(() => gpsStats.avg('gps_compliance_pct'))
const pct = (num: number | null, den: number | null) => (num === null || !den ? null : (num / den) * 100)
const routeCompliance = computed(() => pct(complianceStats.groupCount('status', 'compliant'), complianceStats.count.value))
const licenceCompliance = computed(() => pct(licenceStats.groupCount('status', 'active'), licenceStats.count.value))
const note = (s: { loading: { value: boolean } }) => s.loading.value ? 'Loading…' : 'NTSA / NaMATA feed unavailable'
const error = computed(() => operatorStats.failed.value && !operatorStats.loading.value ? 'Unable to reach the UAPTS Public Transport API.' : null)

// Keep it live (the page used to reload every two minutes).
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(() => { void Promise.all([operatorTable.refresh(), forecastTable.refresh(), ...allStats.map(s => s.refresh())]) }, 120_000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function scoreBg(pct: number) {
  return pct >= 85 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--destructive)'
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(165px,1fr)); gap:12px; margin-bottom:16px; }
.util-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; min-width:70px; }
.util-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
</style>
