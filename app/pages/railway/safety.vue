<template>
  <PageHeader
    eyebrow="Railway"
    title="Rail Safety"
    subtitle="KRC · RSSB · NTSA - Incident tracking, level crossing safety, regulatory compliance, and predictive risk indicators"
  >
    <template #actions>
      <NuxtLink to="/railway/infrastructure" class="btn">Rail Infrastructure<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/railway/network-inventory" class="btn">Network Inventory<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs: counted by the server over ALL incidents in the chosen period / county -->
  <div class="kpi-grid">
    <KpiCard label="Open Incidents" :value="fmtNum(openStats.count.value)" :unavailable="openStats.count.value === null" :unavailable-note="note" period="LIVE" description="Open or investigating" :status="unavailable ? undefined : (openStats.count.value ?? 0) > 0 ? 'warning' : 'healthy'" to="#incident-registry" />
    <KpiCard label="Fatal / Serious" :value="fmtNum(fatalSerious)" :unavailable="unavailable" :unavailable-note="note" :period="rangeTag" :description="`${fmtNum(sevStats.groupCount('severity', 'fatal'))} fatal · ${fmtNum(sevStats.groupCount('severity', 'serious'))} serious`" :status="unavailable || fatalSerious === null ? undefined : fatalSerious > 0 ? 'critical' : 'healthy'" to="#incident-registry" />
    <KpiCard label="Derailments" :value="fmtNum(derailments)" :unavailable="unavailable" :unavailable-note="note" :period="rangeTag" description="Incl. minor derailments" to="#incident-registry" />
    <KpiCard label="Collisions" :value="fmtNum(typeStats.groupCount('incident_type', 'collision'))" :unavailable="unavailable" :unavailable-note="note" :period="rangeTag" description="Rolling stock collisions" to="#incident-registry" />
    <KpiCard label="Level Crossing Incidents" :value="fmtNum(typeStats.groupCount('incident_type', 'level_crossing'))" :unavailable="unavailable" :unavailable-note="note" :period="rangeTag" description="At grade crossings" to="#incident-registry" />
    <KpiCard label="Signal Failures / SPAD" :value="fmtNum(typeStats.groupCount('incident_type', 'signal_failure'))" :unavailable="unavailable" :unavailable-note="note" :period="rangeTag" description="Signal-passed-at-danger events" to="#incident-registry" />
    <KpiCard label="Trespasser Incidents" :value="fmtNum(typeStats.groupCount('incident_type', 'trespasser'))" :unavailable="unavailable" :unavailable-note="note" :period="rangeTag" description="Unauthorized track access" to="#incident-registry" />
    <KpiCard label="Total Casualties" :value="fmtNum(sevStats.sum('casualties'))" :unavailable="unavailable" :unavailable-note="note" :period="rangeTag" description="All incidents in view" to="#incident-registry" />
    <KpiCard label="Days Since Last Serious Incident" :value="daysSinceSerious != null ? fmtNum(daysSinceSerious) : '-'" :unavailable="lastSerious.count.value === null" :unavailable-note="note" period="LIVE" description="Fatal or serious severity (all time)" :status="daysSinceSerious == null ? undefined : daysSinceSerious >= 30 ? 'healthy' : 'warning'" />
    <KpiCard label="Corrective Actions Overdue" :value="actionStats.count.value ? fmtNum(overdueActions.count.value) : '-'" :unavailable="actionStats.count.value === null" :unavailable-note="actionStats.loading.value ? 'Loading…' : 'RSSB / KRC feed unavailable'" period="LIVE" description="Past due date, not closed" to="#compliance-corrective-action" />
  </div>

  <!-- Incident table -->
  <CollapsibleSection id="incident-registry" class="card drill-target" default-open title="Incident Registry" source="KRC Safety Dept · Live" :count="incidentTable.total.value" :tone="(openStats.count.value ?? 0) ? 'warning' : 'success'" storage-key="inc:railway/safety:incident-registry">
    <div class="card-body">
      <DataTable :table="incidentTable" row-key="id" title="Incident registry" export-name="uapts-rail-incidents" filters-open
                 placeholder="Search reference, station, description…" empty="No incidents match the current filters.">
        <template #cell-incident_ref="{ row }"><span style="font-family:monospace;font-size:11px">{{ row.incident_ref }}</span></template>
        <template #cell-station_name="{ row }">{{ row.station_name ?? row.station_code ?? '-' }}</template>
        <template #cell-network="{ row }"><BadgePill :variant="row.network === 'sgr' ? 'info' : 'success'">{{ String(row.network ?? 'unknown').toUpperCase() }}</BadgePill></template>
      </DataTable>
      <div class="source-note">Incident core fields (type, severity, casualties, status) are live from KRC Safety reporting. Response owner and corrective-action status are tracked in the corrective-action register below (awaiting the RSSB compliance-tracking integration); train/rolling-stock involvement and root cause are not yet captured upstream.</div>
    </div>
  </CollapsibleSection>

  <!-- Level crossing safety -->
  <SectionTitle pill="KRC Level Crossings · Live">Level Crossing Safety</SectionTitle>
  <div class="card">
    <div class="card-body">
      <DataTable :table="crossingTable" row-key="id" title="Level crossings" export-name="uapts-level-crossings"
                 placeholder="Search crossing, road, line…" empty="No level crossings on file.">
        <template #cell-crossing_ref="{ row }"><span style="font-family:monospace;font-size:12px">{{ row.crossing_ref }}</span></template>
        <template #cell-line_name="{ row }">{{ row.line_name ?? row.line }}</template>
      </DataTable>
    </div>
  </div>

  <!-- Compliance & corrective action -->
  <SectionTitle pill="RSSB · Pending Integration">Compliance &amp; Corrective Action</SectionTitle>
  <div id="compliance-corrective-action" class="card drill-target">
    <div class="card-body">
      <DataTable :table="actionTable" row-key="id" title="Corrective actions" export-name="uapts-rail-corrective-actions"
                 placeholder="Search incident, owner, reference…" empty="Corrective-action tracking has not been integrated from RSSB yet.">
        <template #cell-incident_ref="{ row }"><span style="font-family:monospace;font-size:11px">{{ row.incident_ref }}</span></template>
        <template #cell-due_date="{ row }"><span :style="{ color: isOverdue(row) ? 'var(--danger-fg)' : 'inherit' }">{{ fmtDate(row.due_date) }}</span></template>
        <template #cell-recurrence_flag="{ row }">{{ row.recurrence_flag ? '⚠' : '-' }}</template>
      </DataTable>
    </div>
  </div>

  <!-- Safety analytics -->
  <SectionTitle pill="Computed · Live Incidents">Safety Analytics</SectionTitle>
  <div class="two-col">
    <div class="card">
      <div class="card-header">Incident Trend</div>
      <div class="card-body">
        <TrendLineChart
          :points="trendChartPoints"
          color="#ef4444"
          :height="180"
          :format-value="v => v.toFixed(0)"
          :empty-text="trendLoading ? 'Loading…' : 'No incident history available.'"
        />
      </div>
    </div>
    <div class="card">
      <div class="card-header">Incidents by Type</div>
      <div class="card-body">
        <div v-if="byType.length" class="bar-list">
          <div v-for="ty in byType" :key="ty.type" class="bar-row">
            <span class="bar-label">{{ ty.type.replace(/_/g,' ') }}</span>
            <div class="bar-wrap"><div class="bar-fill" :style="{ transform: `scaleX(${maxByType > 0 ? ty.count / maxByType : 0})` }" /></div>
            <span class="bar-val">{{ ty.count }}</span>
          </div>
        </div>
        <EmptyState v-else :loading="typeStats.loading.value" message="No incident data." compact />
      </div>
    </div>
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-header">High-Risk Line Sections (by incident count)</div>
      <div class="card-body">
        <div v-if="highRiskLines.length" class="bar-list">
          <div v-for="l in highRiskLines" :key="l.line" class="bar-row">
            <span class="bar-label">{{ l.line }}</span>
            <div class="bar-wrap"><div class="bar-fill" :style="{ transform: `scaleX(${maxLineRisk > 0 ? l.count / maxLineRisk : 0})`, background: 'var(--destructive)' }" /></div>
            <span class="bar-val">{{ l.count }}</span>
          </div>
        </div>
        <EmptyState v-else :loading="lineStats.loading.value" message="No line-linked incidents recorded." icon="search" compact />
      </div>
    </div>
    <div class="card">
      <div class="card-header">High-Risk Crossings</div>
      <div class="card-body">
        <div v-if="highRiskCrossings.length">
          <AlertItem v-for="c in highRiskCrossings" :key="c.id" :severity="c.risk_rating === 'critical' ? 'critical' : 'warning'" :title="c.road_name" :meta="`${c.near_miss_count} near-misses · ${String(c.protection_type).replace(/_/g,' ')}${c.last_incident_at ? ' · last incident ' + fmtDate(c.last_incident_at) : ''}`" />
        </div>
        <EmptyState v-else :loading="crossingsLoading" message="No high-risk crossings on file yet." icon="search" compact />
      </div>
    </div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">Predictive Derailment / Signal Risk Indicators</div>
    <div class="card-body">
      <DataTable :table="riskTable" row-key="id" title="Risk indicators" export-name="uapts-rail-risk-indicators"
                 placeholder="Search line, risk type…" empty="ML-based derailment/signal risk scoring has not been integrated yet.">
        <template #cell-network="{ row }"><BadgePill :variant="row.network === 'sgr' ? 'info' : 'success'">{{ String(row.network).toUpperCase() }}</BadgePill></template>
        <template #cell-risk_score="{ row }"><span :style="{ color: row.risk_score >= 70 ? 'var(--danger-fg)' : row.risk_score >= 40 ? 'var(--warning-fg)' : 'var(--success-fg)', fontWeight: '600' }">{{ Number(row.risk_score).toFixed(0) }}</span></template>
        <template #cell-contributing_factors="{ row }">{{ (row.contributing_factors ?? []).join(', ') || '-' }}</template>
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
import { useTimeRange } from '~/composables/useTimeRange'
import { eatDate } from '~/utils/timeRange'
import type { TableColumn } from '~/types/dataTable'

// Every table and KPI asks the server for the page's period (the global one unless picked here) and county; the registers that
// have no date of their own (crossings, corrective actions, risk scores) are shown in full. Nothing is derived from a first page.
const RAIL = '/api/v1/railway'
const INC = `${RAIL}/incidents/`
const api = useApi()
const timeRange = useTimeRange('railway', { default: '30d', years: true, custom: true })
const county = useCountyScope('railway')
const rangeTag = computed(() => timeRange.period.value)
const scope = () => ({ ...timeRange.query.value, ...county.query.value })
const today = () => eatDate(new Date())

const opt = (values: string[]) => values.map(value => ({ value, label: value.replace(/_/g, ' ') }))
const TYPES = opt(['collision', 'derailment', 'derailment_minor', 'level_crossing', 'fire', 'passenger', 'trespasser', 'signal_failure'])
const SEVERITIES = opt(['fatal', 'serious', 'minor', 'none'])
const INC_STATUSES = opt(['open', 'investigating', 'resolved', 'closed'])
const SEV_BADGE: Record<string, string> = { fatal: 'danger', serious: 'danger', minor: 'warning', none: 'neutral' }
const INC_BADGE: Record<string, string> = { open: 'danger', investigating: 'warning', resolved: 'success', closed: 'neutral' }
const RISK_BADGE: Record<string, string> = { low: 'success', medium: 'fair', high: 'warning', critical: 'danger' }
const INV_BADGE: Record<string, string> = { open: 'danger', in_progress: 'warning', closed: 'success' }

// ── Tables ───────────────────────────────────────────────────────────────
const incidentColumns: TableColumn[] = [
  { key: 'incident_ref', label: 'Incident Ref', priority: 1, pin: 'left' },
  { key: 'occurred_at', label: 'Date/Time', type: 'datetime', priority: 1 },
  { key: 'station_name', label: 'Location', priority: 2 },
  { key: 'network', label: 'Network', priority: 3 },
  { key: 'incident_type', label: 'Type', options: TYPES, priority: 1 },
  { key: 'severity', label: 'Severity', type: 'badge', badge: SEV_BADGE, options: SEVERITIES, priority: 1 },
  { key: 'casualties', label: 'Casualties', type: 'num', priority: 2 },
  { key: 'status', label: 'Status', type: 'badge', badge: INC_BADGE, options: INC_STATUSES, priority: 1 },
]
const incidentTable = useEndpointTable({
  key: 'rail-incidents', path: INC, columns: incidentColumns, countyKey: 'railway', pageSize: 15,
  params: () => timeRange.query.value, defaultSort: [{ key: 'occurred_at', dir: 'desc' }],
})

const crossingColumns: TableColumn[] = [
  { key: 'crossing_ref', label: 'Crossing', priority: 1, pin: 'left' },
  { key: 'road_name', label: 'Road', priority: 1 },
  { key: 'line_name', label: 'Line', priority: 2 },
  { key: 'risk_rating', label: 'Risk Rating', type: 'badge', badge: RISK_BADGE, options: opt(['low', 'medium', 'high', 'critical']), priority: 1 },
  { key: 'protection_type', label: 'Protection', priority: 2 },
  { key: 'near_miss_count', label: 'Near Misses', type: 'num', priority: 2 },
  { key: 'daily_road_traffic', label: 'Daily Road Traffic', type: 'num', priority: 3 },
  { key: 'daily_train_movements', label: 'Daily Trains', type: 'num', priority: 3 },
  { key: 'last_incident_at', label: 'Last Incident', type: 'date', priority: 3 },
]
const crossingTable = useEndpointTable({
  key: 'rail-level-crossings', path: `${RAIL}/level-crossings/`, columns: crossingColumns, countyKey: 'railway', pageSize: 15,
  defaultSort: [{ key: 'near_miss_count', dir: 'desc' }],
})

const actionColumns: TableColumn[] = [
  { key: 'incident_ref', label: 'Incident Ref', priority: 1, pin: 'left' },
  { key: 'investigation_status', label: 'Investigation Status', type: 'badge', badge: INV_BADGE, options: opt(['open', 'in_progress', 'closed']), priority: 1 },
  { key: 'regulatory_reference', label: 'Regulatory Reference', priority: 2 },
  { key: 'action_owner', label: 'Action Owner', priority: 2 },
  { key: 'due_date', label: 'Due Date', type: 'date', priority: 1 },
  { key: 'closure_evidence', label: 'Closure Evidence', priority: 3 },
  { key: 'recurrence_flag', label: 'Recurrence', type: 'bool', priority: 3 },
]
const actionTable = useEndpointTable({
  key: 'rail-corrective-actions', path: `${RAIL}/safety/corrective-actions/`, columns: actionColumns, pageSize: 15,
  defaultSort: [{ key: 'due_date', dir: 'asc' }],
})

const riskColumns: TableColumn[] = [
  { key: 'line_name', label: 'Line', priority: 1, pin: 'left' },
  { key: 'network', label: 'Network', priority: 2 },
  { key: 'risk_type', label: 'Risk Type', priority: 1 },
  { key: 'risk_score', label: 'Risk Score', type: 'num', digits: 0, priority: 1 },
  { key: 'contributing_factors', label: 'Contributing Factors', sortable: false, filter: false, priority: 3 },
  { key: 'generated_at', label: 'Generated', type: 'date', priority: 3 },
]
const riskTable = useEndpointTable({
  key: 'rail-risk-indicators', path: `${RAIL}/safety/risk-indicators/`, columns: riskColumns, countyKey: 'railway', pageSize: 15,
  defaultSort: [{ key: 'risk_score', dir: 'desc' }],
})

// ── KPIs and breakdowns: computed by the server ──────────────────────────
const sevStats = useServerCount(INC, scope, { aggregate: ['sum:casualties'], groupBy: ['severity'] })
const typeStats = useServerCount(INC, scope, { groupBy: ['incident_type'] })
const lineStats = useServerCount(INC, () => ({ ...scope(), 'f.line__isnull': 'false' }), { groupBy: ['line_name'] })
// Open means open or investigating, now - whatever the period.
const openStats = useServerCount(INC, () => ({ ...county.query.value, 'f.status__in': 'open,investigating' }))
// The latest fatal / serious incident, all time.
const lastSerious = useServerCount(INC, () => ({ ...county.query.value, 'f.severity__in': 'fatal,serious' }), { aggregate: ['max:occurred_at'] })
const actionStats = useServerCount(`${RAIL}/safety/corrective-actions/`)
const overdueActions = useServerCount(`${RAIL}/safety/corrective-actions/`, () => ({ 'f.due_date__lt': today(), 'f.investigation_status__in': 'open,in_progress' }))
const allStats = [sevStats, typeStats, lineStats, openStats, lastSerious, actionStats, overdueActions]

const unavailable = computed(() => sevStats.count.value === null)
const note = computed(() => sevStats.loading.value ? 'Loading…' : 'KRC Safety feed unavailable')
const error = computed(() => sevStats.failed.value && !sevStats.loading.value ? 'Unable to reach the UAPTS Railway API.' : null)
const fatalSerious = computed(() => {
  const f = sevStats.groupCount('severity', 'fatal'), s = sevStats.groupCount('severity', 'serious')
  return f === null || s === null ? null : f + s
})
const derailments = computed(() => {
  const a = typeStats.groupCount('incident_type', 'derailment'), b = typeStats.groupCount('incident_type', 'derailment_minor')
  return a === null || b === null ? null : a + b
})
const daysSinceSerious = computed(() => {
  const latest = lastSerious.aggregates.value['max:occurred_at']
  return typeof latest === 'string' ? Math.floor((Date.now() - new Date(latest).getTime()) / 86_400_000) : null
})

const byType = computed(() => (typeStats.groups.value.incident_type ?? []).map(g => ({ type: String(g.value), count: g.count })))
const maxByType = computed(() => Math.max(1, ...byType.value.map(t => t.count)))
const highRiskLines = computed(() => (lineStats.groups.value.line_name ?? []).slice(0, 10).map(g => ({ line: String(g.value), count: g.count })))
const maxLineRisk = computed(() => Math.max(1, ...highRiskLines.value.map(l => l.count)))

// ── Trend and high-risk crossings: small server roll-ups / top-N lists ───
const trend = ref<{ bucket: string; total: number }[]>([])
const trendLoading = ref(true)
const highRiskCrossings = ref<any[]>([])
const crossingsLoading = ref(true)
async function loadSide() {
  const [t, c] = await Promise.all([
    api<any>(`${INC}trend/`, { query: scope() }).catch(() => null),
    api<any>(`${RAIL}/level-crossings/`, { query: { ...county.query.value, 'f.risk_rating__in': 'high,critical', ordering: '-near_miss_count', page_size: 6 } }).catch(() => null),
  ])
  trend.value = t?.results ?? []; trendLoading.value = false
  highRiskCrossings.value = c?.results ?? []; crossingsLoading.value = false
}
const trendChartPoints = computed(() => trend.value.map(t => ({
  label: new Date(`${t.bucket}T00:00:00Z`).toLocaleDateString('en-KE', { month: 'short', day: trend.value.length > 40 ? undefined : '2-digit', year: '2-digit', timeZone: 'UTC' }),
  value: t.total,
})))
watch(() => JSON.stringify(scope()), loadSide)
onMounted(loadSide)

function refreshAll() { void Promise.all([incidentTable.refresh(), crossingTable.refresh(), actionTable.refresh(), riskTable.refresh(), ...allStats.map(s => s.refresh()), loadSide()]) }
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
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function isOverdue(a: { due_date?: string | null; investigation_status: string }) {
  return !!a.due_date && a.investigation_status !== 'closed' && a.due_date < today()
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.source-note { margin-top:10px; font-size:11px; color:var(--fg-3); border-top:1px solid var(--border-subtle); padding-top:10px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.bar-list { display:flex; flex-direction:column; gap:8px; }
.bar-row { display:grid; grid-template-columns:140px 1fr 40px; align-items:center; gap:8px; }
.bar-label { font-size:12px; text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-wrap { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.bar-fill { height:100%; width:100%; background:var(--primary-fill); border-radius:4px; transform-origin:left; transition:transform .4s; }
.bar-val { font-size:11px; text-align:right; }
</style>
