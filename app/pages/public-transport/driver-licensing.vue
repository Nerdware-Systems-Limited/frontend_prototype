<template>
  <PageHeader
    eyebrow="Public Transport · NTSA"
    title="Driver Licensing"
    subtitle="NTSA - Driver identity registry, driving-licence classes, endorsements, demerit points, PSV badges and expiry tracking"
  >
    <template #actions>
      <NuxtLink to="/public-transport/operators" class="btn">Public Operators<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>
  
  <!-- KPI strip: counted and averaged by the server over ALL licences, not over the first page of them -->
  <div class="kpi-grid">
    <KpiCard label="Licences" :value="fmtNum(stats.count.value)" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="All licence records" to="#driver-registry" />
    <KpiCard label="Active" :value="fmtNum(stats.groupCount('status', 'active'))" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="Valid to drive" />
    <KpiCard label="Suspended" :value="fmtNum(stats.groupCount('status', 'suspended'))" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="Driving privileges paused" />
    <KpiCard label="Revoked" :value="fmtNum(stats.groupCount('status', 'revoked'))" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="Permanently withdrawn" />
    <KpiCard label="Expired" :value="fmtNum(stats.groupCount('status', 'expired'))" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="Renewal overdue" />
    <KpiCard label="PSV Endorsed" :value="fmtNum(psvStats.count.value)" :unavailable="psvStats.count.value === null" :unavailable-note="note" period="LIVE" description="Licensed to carry passengers" to="#psv-licences-table" />
    <KpiCard label="Avg Demerit Points" :value="avgDemerit != null ? avgDemerit.toFixed(1) : '-'" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="Across all licences" />
    <KpiCard label="High Demerit (≥8)" :value="fmtNum(highStats.count.value)" :unavailable="highStats.count.value === null" :unavailable-note="note" period="LIVE" description="Approaching suspension threshold" to="#expiry-alerts" />
    <KpiCard label="Expiring ≤30d" :value="fmtNum(expiringStats.count.value)" :unavailable="expiringStats.count.value === null" :unavailable-note="note" period="30D" description="Renewal due soon" to="#expiry-alerts" />
    <KpiCard label="Expired-but-Active" :value="fmtNum(staleStats.count.value)" :unavailable="staleStats.count.value === null" :unavailable-note="note" period="LIVE" description="Data-quality risk flag" to="#expiry-alerts" />
  </div>

  <!-- Expiry & compliance alerts: the worst few of each kind, asked of the server -->
  <SectionTitle pill="Computed · Rolling">Expiry &amp; Compliance Alerts</SectionTitle>
  <div id="expiry-alerts" class="card drill-target">
    <div class="card-body">
      <div v-if="alerts.length">
        <AlertItem v-for="(a, i) in alerts" :key="i" :severity="a.severity" :title="a.title" :meta="a.meta" />
      </div>
      <EmptyState v-else :loading="alertsLoading" message="No expiry or compliance alerts." icon="search" compact />
    </div>
  </div>

  <!-- Renewals: driving licences that are expired or expiring, most urgent first -->
  <CertificateExpiryPanel title="Driving licence renewals" :sources="['driver']" storage-key="driver-licensing" style="margin-bottom:16px" />

  <!-- PSV-endorsed drivers -->
  <SectionTitle pill="Class D / PSV Badge">PSV-Endorsed Licences</SectionTitle>
  <div id="psv-licences-table" class="card drill-target">
    <div class="card-body">
      <DataTable :table="psvTable" row-key="id" title="PSV-endorsed licences" export-name="uapts-psv-endorsed-licences"
                 placeholder="Search licence number, driver, badge…" empty="No PSV-endorsed licences.">
        <template #cell-demerit_points="{ row }">
          <span :style="{ color: row.demerit_points >= 8 ? 'var(--danger-fg)' : row.demerit_points >= 4 ? 'var(--warning-fg)' : 'var(--success-fg)' }">{{ row.demerit_points }}</span>
        </template>
      </DataTable>
    </div>
  </div>

  <!-- Driver registry -->
  <SectionTitle pill="NTSA Fleet Drivers · Rolling">Driver Registry</SectionTitle>
  <div id="driver-registry" class="card drill-target">
    <div class="card-body">
      <DataTable :table="driverTable" row-key="id" title="Driver registry" export-name="uapts-drivers"
                 placeholder="Search name, phone, operator…" empty="No drivers in the registry.">
        <template #cell-full_name="{ row }"><span style="font-weight:600">{{ row.full_name }}</span></template>
        <template #cell-national_id="{ row }"><span style="font-family:monospace;font-size:11px;color:var(--fg-3)">{{ row.national_id ?? 'masked' }}</span></template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useApi } from '~/composables/api/_client'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useServerCount } from '~/composables/useServerCount'
import { useCountyScope } from '~/composables/useCountyScope'
import { eatDate } from '~/utils/timeRange'
import type { TableColumn } from '~/types/dataTable'

// Both tables are windows onto the WHOLE registry (search, filters, sorting and paging run on the server) and every KPI is a
// server count / average - nothing is computed from a first page of licences (see docs/data-tables.md).
const L = '/api/v1/fleet/driver-licenses/'
const D = '/api/v1/fleet/drivers/'
const api = useApi()

// County filter for this module, following the global filter in the top bar until a county is picked here.
const county = useCountyScope('public-transport')

const STATUSES = ['active', 'suspended', 'revoked', 'expired'].map(value => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))
const STATUS_BADGE: Record<string, string> = { active: 'success', suspended: 'warning', revoked: 'danger', expired: 'danger' }
const CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(value => ({ value, label: `Class ${value}` }))

// ── PSV-endorsed licences ────────────────────────────────────────────────
const psvColumns: TableColumn[] = [
  { key: 'license_number', label: 'Licence No.', type: 'mono', priority: 1, pin: 'left' },
  { key: 'driver_name', label: 'Driver', priority: 1, minWidth: 150 },
  { key: 'license_class', label: 'Class', options: CLASSES, priority: 2 },
  { key: 'psv_badge_no', label: 'PSV Badge No.', type: 'mono', priority: 1 },
  { key: 'psv_badge_expiry', label: 'Badge Expiry', type: 'date', priority: 2 },
  { key: 'demerit_points', label: 'Demerit Points', type: 'num', priority: 2 },
  { key: 'status', label: 'Status', type: 'badge', badge: STATUS_BADGE, options: STATUSES, priority: 1 },
]
// `psv=1` is the endpoint's own "has a PSV badge" switch (is_psv is computed, so it cannot be a column filter).
const psvTable = useEndpointTable({
  key: 'pt-psv-endorsed', path: L, columns: psvColumns, pageSize: 15, params: { psv: '1' },
  defaultSort: [{ key: 'psv_badge_expiry', dir: 'asc' }],
})

// ── Driver registry ──────────────────────────────────────────────────────
const driverColumns: TableColumn[] = [
  { key: 'full_name', label: 'Full Name', priority: 1, pin: 'left', minWidth: 160 },
  { key: 'phone', label: 'Phone', priority: 2 },
  { key: 'date_of_birth', label: 'Date of Birth', type: 'date', priority: 3 },
  { key: 'agency_code', label: 'Agency', priority: 2 },
  { key: 'operator_name', label: 'Operator', priority: 2 },
  // Masked on the server and never searchable / sortable: the value shown is the only one that exists for this viewer.
  { key: 'national_id', label: 'National ID', sortable: false, filter: false, priority: 3 },
]
const driverTable = useEndpointTable({
  key: 'pt-drivers', path: D, columns: driverColumns, pageSize: 15, defaultSort: [{ key: 'full_name', dir: 'asc' }],
})

// ── KPIs: counted by the server ──────────────────────────────────────────
// Dates are EAT calendar days, like the rest of the platform.
const today = () => eatDate(new Date())
const plusDays = (n: number) => eatDate(new Date(Date.now() + n * 86_400_000))
const none = () => ({})
const stats = useServerCount(L, none, { aggregate: ['avg:demerit_points'], groupBy: ['status'] })
const psvStats = useServerCount(L, () => ({ psv: '1' }))
const highStats = useServerCount(L, () => ({ 'f.demerit_points__gte': 8 }))
// Renewal due: active licences whose expiry falls in the next 30 days (already-expired ones are the "expired-but-active" flag).
const expiringStats = useServerCount(L, () => ({ 'f.status__exact': 'active', 'f.expiry_date__gte': today(), 'f.expiry_date__lte': plusDays(30) }))
const staleStats = useServerCount(L, () => ({ 'f.status__exact': 'active', 'f.expiry_date__lt': today() }))
const allStats = [stats, psvStats, highStats, expiringStats, staleStats]

const avgDemerit = computed(() => stats.avg('demerit_points'))
const unavailable = computed(() => stats.count.value === null)
const note = computed(() => stats.loading.value ? 'Loading…' : 'NTSA Fleet Drivers feed unavailable')
const error = computed(() => stats.failed.value && !stats.loading.value ? 'Unable to reach the UAPTS Fleet Drivers/Licences API.' : null)

// ── Alerts: the most urgent few of each kind, from the server ────────────
interface Alert { severity: 'critical' | 'warning' | 'info'; title: string; meta: string }
const alerts = ref<Alert[]>([])
const alertsLoading = ref(true)
async function loadAlerts() {
  const q = (extra: Record<string, unknown>) => api<any>(L, { query: { page_size: 10, ...extra } }).then(r => r?.results ?? []).catch(() => [])
  const [stale, high, soon] = await Promise.all([
    q({ 'f.status__exact': 'active', 'f.expiry_date__lt': today(), ordering: 'expiry_date' }),
    q({ 'f.demerit_points__gte': 8, ordering: '-demerit_points' }),
    q({ 'f.status__exact': 'active', 'f.expiry_date__gte': today(), 'f.expiry_date__lte': plusDays(30), ordering: 'expiry_date' }),
  ])
  alerts.value = [
    ...stale.map((d: any) => ({ severity: 'critical' as const, title: `${d.license_number} - expired but marked active`, meta: `${d.driver_name} · expired ${fmtDate(d.expiry_date)}` })),
    ...high.map((d: any) => ({ severity: 'warning' as const, title: `${d.license_number} - demerit points at ${d.demerit_points}`, meta: `${d.driver_name} · approaching suspension threshold` })),
    ...soon.map((d: any) => ({ severity: 'info' as const, title: `${d.license_number} - renewal due`, meta: `${d.driver_name} · expires ${fmtDate(d.expiry_date)}` })),
  ].slice(0, 20)
  alertsLoading.value = false
}
onMounted(loadAlerts)

// Keep it live (the page used to reload every two minutes) - and follow a county change like every other module page.
function refreshAll() {
  void Promise.all([psvTable.refresh(), driverTable.refresh(), ...allStats.map(s => s.refresh()), loadAlerts()])
}
watch(() => county.county.value, refreshAll)
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(refreshAll, 120_000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'2-digit' }) }
  catch { return s }
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
</style>
