<template>
  <PageHeader
    eyebrow="Public Transport · NTSA"
    title="Vehicle Inspections"
    subtitle="NTSA - Roadworthiness inspection records, pass/fail outcomes, re-inspection chains, and inspection-centre/inspector workload"
  >
    <template #actions>
      <NuxtLink to="/public-transport/vehicle-registration" class="btn">Vehicle Registration<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/public-transport/operators" class="btn">Public Operators<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI strip: counted by the server over ALL inspections, not over a first page of them -->
  <div class="kpi-grid">
    <KpiCard label="Inspections" :value="fmtNum(resultStats.count.value)" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="All records" to="#inspection-registry" />
    <KpiCard label="Passed" :value="fmtNum(resultStats.groupCount('result', 'pass'))" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="Roadworthy" />
    <KpiCard label="Failed" :value="fmtNum(resultStats.groupCount('result', 'fail'))" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="Not roadworthy" />
    <KpiCard label="Conditional Pass" :value="fmtNum(resultStats.groupCount('result', 'conditional_pass'))" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="Passed with conditions" />
    <KpiCard label="Pass Rate" :value="passRate != null ? `${passRate.toFixed(1)}%` : '-'" :unavailable="unavailable" :unavailable-note="note" period="LIVE" description="Pass / (pass + fail)" :status="passRate == null ? undefined : passRate >= 80 ? 'healthy' : 'warning'" />
    <KpiCard label="Re-inspections" :value="fmtNum(reinspectionStats.count.value)" :unavailable="reinspectionStats.count.value === null" :unavailable-note="note" period="LIVE" description="Follow-up records" />
    <KpiCard label="Overdue" :value="fmtNum(overdueStats.count.value)" :unavailable="overdueStats.count.value === null" :unavailable-note="note" period="LIVE" description="Next inspection due date passed" to="#overdue-queue" />
    <KpiCard label="Due ≤30d" :value="fmtNum(dueSoonStats.count.value)" :unavailable="dueSoonStats.count.value === null" :unavailable-note="note" period="30D" description="Next inspection approaching" />
    <KpiCard label="Active Centres" :value="fmtNum(centreStats.distinct('inspection_centre'))" :unavailable="centreStats.count.value === null" :unavailable-note="note" period="LIVE" description="Distinct inspection centres" to="#inspections-by-centre" />
    <KpiCard label="Active Inspectors" :value="fmtNum(centreStats.distinct('inspector_name'))" :unavailable="centreStats.count.value === null" :unavailable-note="note" period="LIVE" description="Distinct inspectors on file" />
  </div>

  <!-- Analytics: grouped by the server -->
  <SectionTitle pill="Computed · Rolling">Inspections by Centre</SectionTitle>
  <div id="inspections-by-centre" class="card drill-target">
    <div class="card-body">
      <div v-if="byCentre.length" class="bar-list bar-list-wide">
        <div v-for="c in byCentre" :key="c.centre" class="bar-row bar-row-wide">
          <span class="bar-label">{{ c.centre }}</span>
          <div class="bar-wrap"><div class="bar-fill" :style="{ transform: `scaleX(${maxCentre > 0 ? c.count / maxCentre : 0})` }" /></div>
          <span class="bar-val">{{ c.count }} · {{ c.passRate.toFixed(0) }}% pass</span>
        </div>
      </div>
      <div v-else style="font-size:13px;color:var(--fg-3)">{{ centreStats.loading.value ? 'Loading…' : 'No inspection records.' }}</div>
    </div>
  </div>

  <!-- Overdue queue: the longest-overdue first -->
  <SectionTitle pill="Computed · Rolling">Overdue Inspections</SectionTitle>
  <div id="overdue-queue" class="card drill-target">
    <div class="card-body">
      <div v-if="overdue.length">
        <AlertItem
          v-for="i in overdue" :key="i.id"
          :severity="i.result === 'fail' ? 'critical' : 'warning'"
          :title="`${i.plate_number} - inspection overdue`"
          :meta="`Due ${fmtDate(i.next_inspection_due)} · Last result ${i.result} · ${i.inspection_centre}`"
        />
      </div>
      <EmptyState v-else :loading="overdueLoading" message="No overdue inspections." icon="search" compact />
    </div>
  </div>

  <!-- Registry -->
  <SectionTitle pill="NTSA Fleet Inspections · Rolling">Inspection Registry</SectionTitle>
  <div id="inspection-registry" class="card drill-target">
    <div class="card-body">
      <DataTable :table="inspectionTable" row-key="id" title="Inspection registry" export-name="uapts-vehicle-inspections" expandable filters-open
                 placeholder="Search plate, centre, inspector, sticker…" empty="No inspection records match the current filters.">
        <template #toolbar>
          <label class="checkbox-label"><input v-model="reinspectionOnly" type="checkbox" /> Re-inspections only</label>
        </template>
        <template #cell-plate_number="{ row }"><span style="font-weight:700;font-family:monospace">{{ row.plate_number }}</span></template>
        <template #cell-next_inspection_due="{ row }">
          <span :style="{ color: isOverdue(row.next_inspection_due) ? 'var(--danger-fg)' : 'inherit' }">{{ fmtDate(row.next_inspection_due) }}</span>
        </template>
        <template #cell-report_url="{ row }">
          <a v-if="row.report_url" :href="row.report_url" target="_blank" rel="noopener" class="link-sm" @click.stop>View →</a>
          <span v-else style="color:var(--fg-3);font-size:11px">-</span>
        </template>
        <template #expanded="{ row }"><ReinspectionChain :inspection="row.id" /></template>
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

// The registry is a window onto ALL inspections (search, filters, sorting, paging on the server); every KPI and the per-centre
// breakdown are server counts / groups (see docs/data-tables.md). A row's re-inspection chain loads when it is opened.
const V = '/api/v1/fleet/vehicle-inspections/'
const api = useApi()

// County filter for this module, following the global filter in the top bar until a county is picked here.
const county = useCountyScope('public-transport')
const scope = () => county.query.value

const RESULTS = [{ value: 'pass', label: 'Pass' }, { value: 'fail', label: 'Fail' }, { value: 'conditional_pass', label: 'Conditional pass' }]
const RESULT_BADGE: Record<string, string> = { pass: 'success', fail: 'danger', conditional_pass: 'warning' }

const reinspectionOnly = ref(false)
const inspectionColumns: TableColumn[] = [
  { key: 'plate_number', label: 'Vehicle', priority: 1, pin: 'left' },
  { key: 'inspection_centre', label: 'Centre', priority: 2 },
  { key: 'inspector_name', label: 'Inspector', priority: 2 },
  { key: 'inspected_at', label: 'Inspected', type: 'date', priority: 1 },
  { key: 'result', label: 'Result', type: 'badge', badge: RESULT_BADGE, options: RESULTS, priority: 1 },
  { key: 'sticker_no', label: 'Sticker No.', type: 'mono', priority: 3 },
  { key: 'next_inspection_due', label: 'Next Due', type: 'date', priority: 1 },
  { key: 'is_reinspection', label: 'Re-inspection', type: 'bool', sortable: 'reinspection_of', filter: false, priority: 3 },
  { key: 'report_url', label: 'Report', sortable: false, filter: false, noExport: true, priority: 3 },
]
const inspectionTable = useEndpointTable({
  key: 'pt-vehicle-inspections', path: V, columns: inspectionColumns, countyKey: 'public-transport', pageSize: 15,
  params: () => (reinspectionOnly.value ? { 'f.reinspection_of__isnull': 'false' } : {}),
  defaultSort: [{ key: 'inspected_at', dir: 'desc' }],
})

// ── KPIs: counted by the server ──────────────────────────────────────────
// Dates are EAT calendar days, like the rest of the platform.
const today = () => eatDate(new Date())
const plusDays = (n: number) => eatDate(new Date(Date.now() + n * 86_400_000))
const resultStats = useServerCount(V, scope, { groupBy: ['result'] })
const reinspectionStats = useServerCount(V, () => ({ ...scope(), 'f.reinspection_of__isnull': 'false' }))
const overdueStats = useServerCount(V, () => ({ ...scope(), 'f.next_inspection_due__lt': today() }))
const dueSoonStats = useServerCount(V, () => ({ ...scope(), 'f.next_inspection_due__gte': today(), 'f.next_inspection_due__lte': plusDays(30) }))
// Per-centre totals (and distinct centres / inspectors), plus the passes per centre for the pass rate.
const centreStats = useServerCount(V, scope, { aggregate: ['distinct:inspection_centre', 'distinct:inspector_name'], groupBy: ['inspection_centre'] })
const centrePass = useServerCount(V, () => ({ ...scope(), 'f.result__exact': 'pass' }), { groupBy: ['inspection_centre'] })
const allStats = [resultStats, reinspectionStats, overdueStats, dueSoonStats, centreStats, centrePass]

const unavailable = computed(() => resultStats.count.value === null)
const note = computed(() => resultStats.loading.value ? 'Loading…' : 'NTSA Fleet Inspections feed unavailable')
const error = computed(() => resultStats.failed.value && !resultStats.loading.value ? 'Unable to reach the UAPTS Fleet Vehicle Inspections API.' : null)
const passRate = computed(() => {
  const pass = resultStats.groupCount('result', 'pass'), fail = resultStats.groupCount('result', 'fail')
  return pass === null || fail === null || pass + fail === 0 ? null : (pass / (pass + fail)) * 100
})
const byCentre = computed(() =>
  (centreStats.groups.value?.inspection_centre ?? [])
    .map((g: any) => ({ centre: String(g.value), count: g.count as number, passRate: g.count ? ((centrePass.groupCount('inspection_centre', g.value) ?? 0) / g.count) * 100 : 0 }))
    .sort((a, b) => b.count - a.count),
)
const maxCentre = computed(() => Math.max(1, ...byCentre.value.map(c => c.count)))

// ── Overdue queue: the longest-overdue few, from the server ───────────────
const overdue = ref<any[]>([])
const overdueLoading = ref(true)
async function loadOverdue() {
  try {
    const r = await api<any>(V, { query: { ...scope(), 'f.next_inspection_due__lt': today(), ordering: 'next_inspection_due', page_size: 20 } })
    overdue.value = r?.results ?? []
  } catch { overdue.value = [] } finally { overdueLoading.value = false }
}
onMounted(loadOverdue)

function refreshAll() { void Promise.all([inspectionTable.refresh(), ...allStats.map(s => s.refresh()), loadOverdue()]) }
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
function isOverdue(due: string | null | undefined) { return !!due && due < today() }
function resultBadge(r: string) { return RESULT_BADGE[r] ?? 'neutral' }
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.checkbox-label { display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; }
.bar-list { display:flex; flex-direction:column; gap:8px; }
.bar-row { display:grid; grid-template-columns:140px 1fr 90px; align-items:center; gap:8px; }
.bar-label { font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-wrap { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.bar-fill { height:100%; width:100%; background:var(--primary-fill); border-radius:4px; transform-origin:left; transition:transform .4s; }
.bar-val { font-size:11px; text-align:right; }
.bar-list-wide { gap:12px; }
.bar-row-wide { grid-template-columns:240px 1fr 130px; gap:14px; }
.bar-row-wide .bar-label { font-size:13px; font-weight:600; overflow:visible; white-space:normal; }
.bar-row-wide .bar-wrap { height:16px; }
.bar-row-wide .bar-val { font-size:12.5px; font-weight:600; }
.link-sm { font-size:11px; color:var(--link); text-decoration:none; }
</style>
