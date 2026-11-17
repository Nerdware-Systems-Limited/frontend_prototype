<template>
  <PageHeader
    eyebrow="Railway"
    title="Rail Infrastructure"
    subtitle="KRC - Track section condition, level crossings, signalling, culverts, and the capital works pipeline"
  >
    <template #actions>
      <NuxtLink to="/railway/network-inventory" class="btn">Network Inventory<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/railway/safety" class="btn">Rail Safety<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner banner-icon-warn" role="alert">{{ error }}</div>

  <!-- KPIs: counted and summed by the server over the whole registers -->
  <div class="kpi-grid">
    <KpiCard label="Operational Track" :value="opKm != null ? `${fmtNum(opKm, 0)} km` : '-'" :unavailable="lineStats.count.value === null" :unavailable-note="note" period="LIVE" :description="`of ${fmtNum(lineStats.sum('length_km'), 0)} km total network`" />
    <KpiCard label="Sections Needing Repair" :value="fmtNum(poorSections.count.value)" :unavailable="poorSections.count.value === null" :unavailable-note="note" period="LIVE" :description="`of ${fmtNum(trackStats.count.value)} track sections`" :status="poorSections.count.value === null ? undefined : poorSections.count.value > 0 ? 'warning' : 'healthy'" to="#track-sections" />
    <KpiCard label="Signal Availability" :value="signalAvailabilityPct != null ? `${signalAvailabilityPct.toFixed(1)}%` : '-'" :unavailable="signalStats.count.value === null" :unavailable-note="note" period="LIVE" :description="`${fmtNum(signalStats.count.value)} signals registered`" :status="signalAvailabilityPct == null ? undefined : signalAvailabilityPct >= 95 ? 'healthy' : 'warning'" to="#signalling" />
    <KpiCard label="Crossings Needing Action" :value="fmtNum(riskCrossings.count.value)" :unavailable="riskCrossings.count.value === null" :unavailable-note="note" period="LIVE" description="High / critical risk rating" :status="riskCrossings.count.value === null ? undefined : riskCrossings.count.value > 0 ? 'warning' : 'healthy'" to="#level-crossings" />
    <KpiCard label="Culverts Poor / Critical" :value="fmtNum(poorCulverts.count.value)" :unavailable="poorCulverts.count.value === null" :unavailable-note="note" period="LIVE" :description="`of ${fmtNum(culvertStats.count.value)} culverts`" :status="poorCulverts.count.value === null ? undefined : poorCulverts.count.value > 0 ? 'warning' : 'healthy'" to="#culverts" />
    <KpiCard label="Open Capital Works" :value="fmtNum(openWorks.count.value)" :unavailable="openWorks.count.value === null" :unavailable-note="note" period="LIVE" :description="`of ${fmtNum(workStats.count.value)} projects`" to="#capital-works" />
    <KpiCard label="Capital Works Budget" :value="openBudget ? `KES ${fmtKES(openBudget)}` : '-'" :unavailable="openWorks.count.value === null" :unavailable-note="note" period="LIVE" description="Sum of active project budgets" to="#capital-works" />
  </div>

  <!-- Track sections -->
  <SectionTitle pill="KRC Track Registry · Live">Track Sections</SectionTitle>
  <div id="track-sections" class="card drill-target">
    <div class="card-body">
      <DataTable :table="trackTable" row-key="id" title="Track sections" export-name="uapts-rail-track-sections" filters-open
                 placeholder="Search section, line…" empty="No track sections match the current filters.">
        <template #cell-chainage_start_km="{ row }">{{ row.chainage_start_km }} - {{ row.chainage_end_km }}</template>
        <template #cell-posted_speed_kmh="{ row }">{{ row.posted_speed_kmh != null ? `${row.posted_speed_kmh} km/h` : '-' }}</template>
      </DataTable>
    </div>
  </div>

  <!-- Level crossings -->
  <SectionTitle pill="KRC Level Crossings · Live">Level Crossings</SectionTitle>
  <div id="level-crossings" class="card drill-target">
    <div class="card-body">
      <DataTable :table="crossingTable" row-key="id" title="Level crossings" export-name="uapts-rail-level-crossings" filters-open
                 placeholder="Search crossing, road, line…" empty="No level crossings match the current filters.">
        <template #cell-crossing_ref="{ row }"><span style="font-family:monospace;font-weight:700;font-size:12px">{{ row.crossing_ref }}</span></template>
        <template #cell-protection_type="{ row }">{{ String(row.protection_type).replace(/_/g,' ') }}</template>
      </DataTable>
    </div>
  </div>

  <!-- Signals + Culverts -->
  <div class="two-col">
    <div id="signalling" class="card drill-target">
      <div class="card-header">Signalling</div>
      <div class="card-body">
        <DataTable :table="signalTable" row-key="id" title="Signals" export-name="uapts-rail-signals"
                   placeholder="Search signal, line…" empty="No signals registered.">
          <template #cell-signal_ref="{ row }"><span style="font-family:monospace;font-weight:600;font-size:12px">{{ row.signal_ref }}</span></template>
        </DataTable>
      </div>
    </div>

    <div id="culverts" class="card drill-target">
      <div class="card-header">Culverts</div>
      <div class="card-body">
        <DataTable :table="culvertTable" row-key="id" title="Culverts" export-name="uapts-rail-culverts"
                   placeholder="Search culvert, line…" empty="No culverts registered.">
          <template #cell-culvert_ref="{ row }"><span style="font-family:monospace;font-weight:600;font-size:12px">{{ row.culvert_ref }}</span></template>
        </DataTable>
      </div>
    </div>
  </div>

  <!-- Capital works -->
  <SectionTitle pill="KRC / National Treasury · Live">Capital Works Pipeline</SectionTitle>
  <div id="capital-works" class="card drill-target">
    <div class="card-body">
      <DataTable :table="workTable" row-key="id" title="Capital works" export-name="uapts-rail-capital-works"
                 placeholder="Search project, contractor, line…" empty="No capital works projects on file.">
        <template #cell-project_name="{ row }"><span style="font-weight:600">{{ row.project_name }}</span></template>
        <template #cell-budget_kes="{ row }">{{ fmtKES(parseFloat(row.budget_kes)) }}</template>
        <template #cell-spent_kes="{ row }">{{ fmtKES(parseFloat(row.spent_kes)) }}</template>
        <template #cell-progress_pct="{ row }">{{ Number(row.progress_pct).toFixed(0) }}%</template>
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

// These are registers (a track section has no event date), so the page filters them by county only. Every table is a window onto
// the whole register and every KPI a server count / sum, so nothing is derived from a first page (see docs/data-tables.md).
const RAIL = '/api/v1/railway'
const county = useCountyScope('railway')
const scope = () => county.query.value

const opt = (values: string[]) => values.map(value => ({ value, label: value.replace(/_/g, ' ') }))
const COND = opt(['excellent', 'good', 'fair', 'poor', 'critical'])
const COND_BADGE: Record<string, string> = { excellent: 'success', good: 'success', fair: 'fair', poor: 'warning', critical: 'danger' }
const RISK_BADGE: Record<string, string> = { critical: 'danger', high: 'warning', medium: 'fair', low: 'success' }
const SIGNAL_BADGE: Record<string, string> = { operational: 'success', faulty: 'danger', maintenance: 'warning', decommissioned: 'neutral' }
const WORK_BADGE: Record<string, string> = { planned: 'neutral', in_progress: 'info', completed: 'success', suspended: 'warning' }

const table = (key: string, path: string, columns: TableColumn[], sort: { key: string; dir: 'asc' | 'desc' }) =>
  useEndpointTable({ key, path: `${RAIL}/${path}/`, columns, countyKey: 'railway', pageSize: 15, defaultSort: [sort] })

const trackTable = table('rail-track-sections', 'track-sections', [
  { key: 'line_name', label: 'Line', priority: 1, pin: 'left' },
  { key: 'section_ref', label: 'Section', type: 'mono', priority: 1 },
  { key: 'chainage_start_km', label: 'Chainage (km)', type: 'num', priority: 2, filter: false },
  { key: 'rail_type', label: 'Rail Type', priority: 3 },
  { key: 'sleeper_type', label: 'Sleeper', priority: 3 },
  { key: 'track_condition', label: 'Condition', type: 'badge', badge: COND_BADGE, options: COND, priority: 1 },
  { key: 'posted_speed_kmh', label: 'Posted Speed', type: 'num', priority: 2 },
  { key: 'last_inspected_at', label: 'Last Inspected', type: 'date', priority: 3 },
  { key: 'next_inspection_due', label: 'Next Inspection Due', type: 'date', priority: 2 },
], { key: 'track_condition', dir: 'desc' })

const crossingTable = table('rail-infra-crossings', 'level-crossings', [
  { key: 'crossing_ref', label: 'Crossing', priority: 1, pin: 'left' },
  { key: 'road_name', label: 'Road', priority: 1 },
  { key: 'line_name', label: 'Line', priority: 2 },
  { key: 'protection_type', label: 'Protection', priority: 2 },
  { key: 'risk_rating', label: 'Risk', type: 'badge', badge: RISK_BADGE, options: opt(['critical', 'high', 'medium', 'low']), priority: 1 },
  { key: 'near_miss_count', label: 'Near-Misses', type: 'num', priority: 2 },
  { key: 'daily_road_traffic', label: 'Daily Road Traffic', type: 'num', priority: 3 },
  { key: 'daily_train_movements', label: 'Daily Trains', type: 'num', priority: 3 },
  { key: 'last_incident_at', label: 'Last Incident', type: 'date', priority: 3 },
  { key: 'is_active', label: 'Active', type: 'bool', priority: 3 },
], { key: 'near_miss_count', dir: 'desc' })

const signalTable = table('rail-signals', 'signals', [
  { key: 'signal_ref', label: 'Signal', priority: 1, pin: 'left' },
  { key: 'line_name', label: 'Line', priority: 2 },
  { key: 'signal_type', label: 'Type', priority: 2 },
  { key: 'status', label: 'Status', type: 'badge', badge: SIGNAL_BADGE, options: opt(Object.keys(SIGNAL_BADGE)), priority: 1 },
  { key: 'is_automatic', label: 'Automatic', type: 'bool', priority: 3 },
], { key: 'signal_ref', dir: 'asc' })

const culvertTable = table('rail-culverts', 'culverts', [
  { key: 'culvert_ref', label: 'Culvert', priority: 1, pin: 'left' },
  { key: 'line_name', label: 'Line', priority: 2 },
  { key: 'culvert_type', label: 'Type', priority: 2 },
  { key: 'span_m', label: 'Span (m)', type: 'num', priority: 3 },
  { key: 'condition', label: 'Condition', type: 'badge', badge: COND_BADGE, options: COND, priority: 1 },
], { key: 'condition', dir: 'desc' })

const workTable = table('rail-capital-works', 'capital-works', [
  { key: 'project_name', label: 'Project', priority: 1, pin: 'left', minWidth: 170 },
  { key: 'project_type', label: 'Type', priority: 2 },
  { key: 'line_name', label: 'Line', priority: 3 },
  { key: 'status', label: 'Status', type: 'badge', badge: WORK_BADGE, options: opt(Object.keys(WORK_BADGE)), priority: 1 },
  { key: 'budget_kes', label: 'Budget (KES)', type: 'num', priority: 2 },
  { key: 'spent_kes', label: 'Spent (KES)', type: 'num', priority: 2 },
  { key: 'progress_pct', label: 'Progress', sortable: false, filter: false, priority: 2 },
  { key: 'funding_source', label: 'Funding Source', priority: 3 },
  { key: 'contractor', label: 'Contractor', priority: 3 },
  { key: 'expected_completion', label: 'Expected Completion', type: 'date', priority: 2 },
], { key: 'expected_completion', dir: 'asc' })

// ── KPIs: counted by the server ──────────────────────────────────────────
const lineStats = useServerCount(`${RAIL}/lines/`, scope, { aggregate: ['sum:length_km'] })
const opLines = useServerCount(`${RAIL}/lines/`, () => ({ ...scope(), 'f.status__exact': 'operational' }), { aggregate: ['sum:length_km'] })
const trackStats = useServerCount(`${RAIL}/track-sections/`, scope)
const poorSections = useServerCount(`${RAIL}/track-sections/`, () => ({ ...scope(), 'f.track_condition__in': 'poor,critical' }))
const signalStats = useServerCount(`${RAIL}/signals/`, scope, { groupBy: ['status'] })
const riskCrossings = useServerCount(`${RAIL}/level-crossings/`, () => ({ ...scope(), 'f.risk_rating__in': 'high,critical' }))
const culvertStats = useServerCount(`${RAIL}/culverts/`, scope)
const poorCulverts = useServerCount(`${RAIL}/culverts/`, () => ({ ...scope(), 'f.condition__in': 'poor,critical' }))
const workStats = useServerCount(`${RAIL}/capital-works/`, scope)
const openWorks = useServerCount(`${RAIL}/capital-works/`, () => ({ ...scope(), 'f.status__in': 'planned,in_progress' }), { aggregate: ['sum:budget_kes'] })
const allStats = [lineStats, opLines, trackStats, poorSections, signalStats, riskCrossings, culvertStats, poorCulverts, workStats, openWorks]

const opKm = computed(() => (opLines.count.value === null ? null : opLines.sum('length_km') ?? 0))
const signalAvailabilityPct = computed(() => signalStats.groupPct('status', 'operational'))
const openBudget = computed(() => openWorks.sum('budget_kes'))
const note = computed(() => lineStats.loading.value ? 'Loading…' : 'KRC Track Registry feed unavailable')
const error = computed(() => lineStats.failed.value && trackStats.failed.value && !lineStats.loading.value ? 'Unable to reach the UAPTS Railway API.' : null)

function refreshAll() { void Promise.all([trackTable, crossingTable, signalTable, culvertTable, workTable].map(t => t.refresh()).concat(allStats.map(s => s.refresh()))) }
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(refreshAll, 120_000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

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
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
</style>
