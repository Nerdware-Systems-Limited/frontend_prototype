<template>
  <PageHeader
    eyebrow="Public Transport - PSV Compliance"
    title="PSV Compliance & Licensing"
    subtitle="NTSA · NaMATA - PSV licence status, expiry alerts, NaMATA route compliance, GPS tracking rates, and operator registration"
  >
    <template #actions>
      <NuxtLink to="/public-transport/vehicle-inspections" class="btn">Vehicle Inspections<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/public-transport/operators" class="btn">Public Operators<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="licenceFailed" class="error-banner banner-icon-warn" role="alert">Unable to reach the UAPTS Public Transport API.</div>

  <!-- KPI strip: counted and averaged by the server over ALL licences / operators, not over the first page of them -->
  <div class="kpi-grid">
    <KpiCard
      label="Active Licences" :value="fmtNum(statusStats.groupCount('status', 'active'))"
      :unavailable="statusStats.count.value === null" :unavailable-note="statusStats.loading.value ? 'Loading…' : 'NTSA PSV Registry feed unavailable'"
      period="LIVE" description="Currently valid PSV licences" to="#licence-registry"
    />
    <KpiCard
      label="Expiring ≤30d" :value="fmtNum(exp30.count.value)"
      :unavailable="exp30.count.value === null" :unavailable-note="exp30.loading.value ? 'Loading…' : 'NTSA PSV Registry feed unavailable'"
      period="30D" description="Urgent renewal required" to="#expiry-alerts"
    />
    <KpiCard
      label="Expiring 31–90d" :value="fmtNum(exp90.count.value)"
      :unavailable="exp90.count.value === null" :unavailable-note="exp90.loading.value ? 'Loading…' : 'NTSA PSV Registry feed unavailable'"
      period="90D" description="Plan renewals ahead" to="#expiry-alerts"
    />
    <KpiCard
      label="Expired / Suspended" :value="fmtNum(expiredOrSuspended)"
      :unavailable="statusStats.count.value === null" :unavailable-note="statusStats.loading.value ? 'Loading…' : 'NTSA PSV Registry feed unavailable'"
      period="LIVE" description="Immediate enforcement action" to="#licence-registry"
    />
    <KpiCard
      label="Avg GPS Compliance" :value="avgGps ? `${avgGps.toFixed(1)}%` : '-'"
      :unavailable="gpsStats.count.value === null" :unavailable-note="gpsStats.loading.value ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE" description="Across all active licences"
      :status="!avgGps ? undefined : avgGps >= 90 ? 'healthy' : 'warning'"
    />
    <KpiCard
      label="Active Operators" :value="fmtNum(operatorStats.groupCount('registration_status', 'active'))"
      :unavailable="operatorStats.count.value === null" :unavailable-note="operatorStats.loading.value ? 'Loading…' : 'NTSA feed unavailable'"
      period="LIVE" :description="`${fmtNum(operatorStats.count.value)} total registered`" to="#operator-status"
    />
  </div>

  <!-- Expiry alerts: PSV licences that are expired or expiring, most urgent first -->
  <CertificateExpiryPanel id="expiry-alerts" class="drill-target" title="Licence expiry alerts" :sources="['psv']" storage-key="psv-compliance" style="margin-bottom:16px" />

  <!-- PSV licences: the whole register, searched / filtered / sorted / paged on the server -->
  <SectionTitle>PSV Licence Registry</SectionTitle>

  <div id="licence-registry" class="card drill-target">
    <div class="card-body">
      <DataTable :table="licenceTable" row-key="id" title="PSV licence registry" export-name="uapts-psv-licences" filters-open
                 placeholder="Search licence number, operator, route…" empty="No PSV licences have been registered.">
        <template #cell-sacco_name="{ row }"><span class="strong">{{ row.sacco_name ?? '-' }}</span></template>
        <template #cell-days_left="{ row }">
          <span class="days" :style="{ color: daysColor(daysUntil(row.expiry_date)) }">{{ daysUntil(row.expiry_date) }}d</span>
        </template>
        <template #cell-gps_compliance_pct="{ row }">
          <div class="gps-bar-wrap"><div class="gps-bar" :style="{ transform: `scaleX(${row.gps_compliance_pct / 100})`, background: gpsBg(row.gps_compliance_pct) }" /></div>
          <span style="font-size:11px">{{ row.gps_compliance_pct.toFixed(0) }}%</span>
        </template>
      </DataTable>
    </div>
  </div>

  <!-- Operator registration status -->
  <div id="operator-status" class="card drill-target">
    <div class="card-header">
      Operator Registration Status
      <NuxtLink to="/public-transport/operators" class="link-sm">Full operator registry →</NuxtLink>
    </div>
    <div class="card-body">
      <DataTable :table="operatorTable" row-key="id" title="Operator registration status" export-name="uapts-operator-status"
                 placeholder="Search operator…" empty="No operator data">
        <template #cell-sacco_name="{ row }"><span class="strong">{{ row.sacco_name }}</span></template>
        <template #cell-service_quality_score="{ row }">
          <div class="gps-bar-wrap"><div class="gps-bar" :style="{ transform: `scaleX(${row.service_quality_score / 100})`, background: gpsBg(row.service_quality_score) }" /></div>
          <span style="font-size:11px">{{ row.service_quality_score.toFixed(0) }}/100</span>
        </template>
      </DataTable>
    </div>
  </div>

  <!-- Compliance summary by check type -->
  <SectionTitle pill="NaMATA / NTSA">Compliance by Check Type</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="Object.keys(complianceSummary).length" class="compliance-grid">
        <div
          v-for="(val, checkType) in complianceSummary"
          :key="checkType"
          class="chk-card"
        >
          <div class="chk-name">{{ String(checkType).replace(/_/g,' ') }}</div>
          <div class="chk-row">
            <span class="chk-ok">{{ fmtNum(val.compliant) }} OK</span>
            <span class="chk-flag">{{ fmtNum(val.flagged) }} flagged</span>
            <span class="chk-viol">{{ fmtNum(val.violation) }} violation</span>
          </div>
          <div class="chk-bar-wrap">
            <div class="chk-bar chk-ok-bar" :style="{ width: `${val.total > 0 ? (val.compliant / val.total) * 100 : 0}%` }" />
            <div class="chk-bar chk-flag-bar" :style="{ width: `${val.total > 0 ? (val.flagged / val.total) * 100 : 0}%` }" />
            <div class="chk-bar chk-viol-bar" :style="{ width: `${val.total > 0 ? (val.violation / val.total) * 100 : 0}%` }" />
          </div>
        </div>
      </div>
      <EmptyState v-else :loading="loadingSummary" message="No compliance summary available." compact />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { usePublicTransport } from '~/composables/api'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useServerCount } from '~/composables/useServerCount'
import { useCountyScope } from '~/composables/useCountyScope'
import { eatDate } from '~/utils/timeRange'
import type { TableColumn } from '~/types/dataTable'

// Both tables are windows onto the WHOLE register: search, filters, sorting and paging run on the server, and every KPI is
// a server count / average (see docs/data-tables.md) - nothing is computed from a first page of licences.
const PT = '/api/v1/public-transport'

// County filter for this module, following the global filter in the top bar until a county is picked here.
const county = useCountyScope('public-transport')
const scope = () => county.query.value

const LICENCE_STATUSES = ['active', 'expired', 'suspended', 'revoked'].map(value => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))
const SACCO_STATUSES = ['active', 'suspended', 'revoked'].map(value => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))
const LICENCE_BADGE: Record<string, string> = { active: 'success', expired: 'danger', suspended: 'warning', revoked: 'neutral' }
const SACCO_BADGE: Record<string, string> = { active: 'success', suspended: 'warning', revoked: 'danger' }

// ── PSV licence registry ─────────────────────────────────────────────────
const licenceColumns: TableColumn[] = [
  { key: 'license_number', label: 'Licence No.', type: 'mono', priority: 1, pin: 'left' },
  { key: 'sacco_name', label: 'Operator', priority: 1, minWidth: 160 },
  { key: 'route_name', label: 'Route', priority: 2 },
  { key: 'issue_date', label: 'Issued', type: 'date', priority: 3 },
  { key: 'expiry_date', label: 'Expires', type: 'date', priority: 1 },
  // Derived from the expiry date: sorts by it on the server, and exports as a number of days.
  { key: 'days_left', label: 'Days Left', sortable: 'expiry_date', filter: false, exportAs: r => String(daysUntil(r.expiry_date)), priority: 2 },
  { key: 'gps_compliance_pct', label: 'GPS Compliance', type: 'num', digits: 0, priority: 2 },
  { key: 'vehicle_count', label: 'Vehicles', type: 'num', priority: 3 },
  { key: 'status', label: 'Status', type: 'badge', badge: LICENCE_BADGE, options: LICENCE_STATUSES, priority: 1 },
]
const licenceTable = useEndpointTable({
  key: 'pt-psv-licences', path: `${PT}/psv-licenses/`, columns: licenceColumns, countyKey: 'public-transport', pageSize: 25,
  defaultSort: [{ key: 'expiry_date', dir: 'asc' }],
})

// ── Operator registration status ─────────────────────────────────────────
const operatorColumns: TableColumn[] = [
  { key: 'sacco_name', label: 'Operator Name', priority: 1, pin: 'left', minWidth: 170 },
  { key: 'registration_status', label: 'Status', type: 'badge', badge: SACCO_BADGE, options: SACCO_STATUSES, priority: 1 },
  { key: 'fleet_size', label: 'Fleet Size', type: 'num', priority: 2 },
  { key: 'route_count', label: 'Routes', type: 'num', priority: 2 },
  { key: 'service_quality_score', label: 'Service Quality', type: 'num', digits: 0, priority: 1 },
]
const operatorTable = useEndpointTable({
  key: 'pt-operator-status', path: `${PT}/saccos/`, columns: operatorColumns, countyKey: 'public-transport', pageSize: 25,
  defaultSort: [{ key: 'sacco_name', dir: 'asc' }],
})

// ── KPIs: counted by the server ──────────────────────────────────────────
// Dates are EAT calendar days, like the rest of the platform.
const today = () => eatDate(new Date())
const plusDays = (n: number) => eatDate(new Date(Date.now() + n * 86_400_000))
const statusStats = useServerCount(`${PT}/psv-licenses/`, scope, { groupBy: ['status'] })
const gpsStats = useServerCount(`${PT}/psv-licenses/`, () => ({ ...scope(), 'f.status__exact': 'active' }), { aggregate: ['avg:gps_compliance_pct'] })
// Expiring: from today up to N days ahead - the same window the backend's /expiring/ action uses.
const exp30 = useServerCount(`${PT}/psv-licenses/`, () => ({ ...scope(), 'f.expiry_date__gte': today(), 'f.expiry_date__lte': plusDays(30) }))
const exp90 = useServerCount(`${PT}/psv-licenses/`, () => ({ ...scope(), 'f.expiry_date__gt': plusDays(30), 'f.expiry_date__lte': plusDays(90) }))
const operatorStats = useServerCount(`${PT}/saccos/`, scope, { groupBy: ['registration_status'] })

const avgGps = computed(() => gpsStats.avg('gps_compliance_pct'))
const expiredOrSuspended = computed(() => {
  const e = statusStats.groupCount('status', 'expired'), s = statusStats.groupCount('status', 'suspended')
  return e === null || s === null ? null : e + s
})
const licenceFailed = computed(() => statusStats.failed.value && !statusStats.loading.value)

// ── Compliance by check type: an aggregate the backend computes (a handful of check types) ──
const complianceSummary = ref<Record<string, { compliant: number; flagged: number; violation: number; total: number }>>({})
const loadingSummary = ref(true)
async function loadSummary() {
  try { complianceSummary.value = ((await usePublicTransport().complianceSummary()) as any) ?? {} } catch { /* the card shows its empty state */ } finally { loadingSummary.value = false }
}
watch(() => county.county.value, loadSummary)
onMounted(loadSummary)

// Keep it live (the page used to reload every two minutes).
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    void Promise.all([licenceTable.refresh(), operatorTable.refresh(), statusStats.refresh(), gpsStats.refresh(), exp30.refresh(), exp90.refresh(), operatorStats.refresh(), loadSummary()])
  }, 120_000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function daysUntil(dateStr: string): number {
  try { return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000) }
  catch { return 999 }
}
function daysColor(d: number) {
  return d <= 30 ? 'var(--danger-fg)' : d <= 60 ? 'var(--warning-fg)' : 'var(--success-fg)'
}
function gpsBg(pct: number) {
  return pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--destructive)'
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(165px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.gps-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; display:flex; min-width:70px; }
.gps-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
.compliance-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
.chk-card { border:1px solid var(--border-subtle); border-radius:6px; padding:10px 12px; }
.chk-name { font-size:12px; font-weight:600; text-transform:capitalize; margin-bottom:6px; }
.chk-row { display:flex; gap:12px; font-size:11px; margin-bottom:6px; }
.chk-ok { color:var(--success-fg); }
.chk-flag { color:var(--warning-fg); }
.chk-viol { color:var(--danger-fg); }
.chk-bar-wrap { display:flex; height:6px; border-radius:4px; overflow:hidden; }
.chk-bar { height:100%; }
.chk-ok-bar { background:var(--success); }
.chk-flag-bar { background:var(--warning); }
.chk-viol-bar { background:var(--destructive); }
.strong { font-weight:600; }
.days { font-weight:600; }
.link-sm { font-size:12px; color:var(--link); text-decoration:none; }
</style>
