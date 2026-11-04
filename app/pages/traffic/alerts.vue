<template>
  <PageHeader
    eyebrow="Traffic - Alerts"
    title="Traffic Alerts"
    subtitle="KeNHA · KURA · KMD · NCTTCA - Active traffic alerts, congestion events, KMD weather warnings, and NCTTCA corridor risk forecasts"
  >
    <template #actions>
      <BadgePill variant="danger">{{ fmtNum(activeCount.count.value) }} Active</BadgePill>
    </template>
  </PageHeader>

  <div v-if="actionError" class="error-banner" role="alert">⚠ {{ actionError }}</div>

  <!-- KPIs: every figure is counted by the server, so none depends on how many rows a page happened to load -->
  <div class="kpi-grid">
    <KpiCard
      label="Active Alerts" :value="fmtNum(activeCount.count.value)"
      :unavailable="activeCount.count.value === null" :unavailable-note="activeCount.loading.value ? 'Loading…' : 'KeNHA RTMS feed unavailable'"
      period="LIVE" description="Unresolved right now" to="#active-alerts-list"
    />
    <KpiCard
      label="Critical" :value="fmtNum(criticalCount.count.value)"
      :unavailable="criticalCount.count.value === null" :unavailable-note="criticalCount.loading.value ? 'Loading…' : 'KeNHA RTMS feed unavailable'"
      period="LIVE" description="Immediate action needed"
      :status="criticalCount.count.value === null ? undefined : criticalCount.count.value > 0 ? 'critical' : 'healthy'" to="#active-alerts-list"
    />
    <KpiCard
      label="Warning" :value="fmtNum(warningCount.count.value)"
      :unavailable="warningCount.count.value === null" :unavailable-note="warningCount.loading.value ? 'Loading…' : 'KeNHA RTMS feed unavailable'"
      period="LIVE" description="Monitor closely"
      :status="warningCount.count.value === null ? undefined : warningCount.count.value > 0 ? 'warning' : 'healthy'" to="#active-alerts-list"
    />
    <KpiCard
      label="Active Congestion Events" :value="fmtNum(congestionCount.count.value)"
      :unavailable="congestionCount.count.value === null" :unavailable-note="congestionCount.loading.value ? 'Loading…' : 'KeNHA RTMS feed unavailable'"
      period="LIVE" description="Network congestion live" to="#congestion-events-table"
    />
    <KpiCard
      label="Forecast Risk Events" :value="fmtNum(riskCount.count.value)"
      :unavailable="riskCount.count.value === null" :unavailable-note="riskCount.loading.value ? 'Loading…' : 'AI model feed unavailable'"
      period="12H" description="Heavy or severe congestion predicted in the next 12h"
      :status="riskCount.count.value === null ? undefined : riskCount.count.value > 0 ? 'warning' : 'healthy'" to="#risk-forecast-table"
    />
    <KpiCard
      label="Resolved (all)" :value="fmtNum(resolvedCount.count.value)"
      :unavailable="resolvedCount.count.value === null" :unavailable-note="resolvedCount.loading.value ? 'Loading…' : 'KeNHA RTMS feed unavailable'"
      period="ALL" description="Cleared alerts in log" to="#alert-log"
    />
  </div>

  <!-- Active alert cards -->
  <CollapsibleSection
    id="active-alerts-list" class="card drill-target" default-open title="Active Alerts" source="KeNHA RTMS · Live"
    :count="activeCount.count.value ?? 0"
    :tone="(criticalCount.count.value ?? 0) > 0 ? 'danger' : (activeCount.count.value ?? 0) > 0 ? 'warning' : 'success'"
    storage-key="inc:traffic/alerts:active-alerts"
  >
    <div class="card-body">
      <div class="filter-row">
        <select v-model="sevFilter" class="select-sm" aria-label="Severity">
          <option value="">All severities</option>
          <option v-for="o in ALERT_SEVERITIES" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <select v-model="typeFilter" class="select-sm" aria-label="Alert type">
          <option value="">All types</option>
          <option v-for="o in ALERT_TYPES" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <button class="btn" @click="sevFilter = ''; typeFilter = ''">Reset</button>
      </div>
      <div v-if="activeList.length">
        <AlertItem
          v-for="al in activeList" :key="al.id"
          :severity="al.severity === 'critical' ? 'critical' : al.severity === 'warning' ? 'warning' : 'info'"
          :title="al.title"
          :meta="`${al.alert_type.replace(/_/g,' ')} · Segment: ${al.segment_road_code ?? '-'} · Issued: ${fmtTime(al.issued_at)}`"
          ackable :acked="resolving === al.id" @ack="resolveAlert(al.id)"
        />
        <p v-if="activeListTotal > activeList.length" class="more-note">
          Showing the {{ activeList.length }} most recent of {{ fmtNum(activeListTotal) }} matching active alerts - narrow the filters, or use the Alert Log below to see them all.
        </p>
      </div>
      <EmptyState v-else :loading="activeListLoading" :message="activeListError ? 'Unable to load active alerts.' : 'No active alerts match the current filters.'" icon="search" compact />
    </div>
  </CollapsibleSection>

  <!-- Full alert log: the whole history, searched / filtered / sorted / paged on the server -->
  <SectionTitle>Alert Log</SectionTitle>
  <div id="alert-log" class="card drill-target">
    <div class="card-body">
      <DataTable :table="alertTable" row-key="id" title="Alert log" export-name="uapts-traffic-alerts" filters-open
                 placeholder="Search title, message, type, segment…" empty="No alerts have been raised.">
        <template #cell-title="{ row }">
          <div class="cell-title">{{ row.title }}</div>
          <div v-if="row.message" class="cell-sub">{{ String(row.message).slice(0, 80) }}</div>
        </template>
        <template #cell-is_active="{ row }">
          <BadgePill :variant="row.is_active ? 'danger' : 'success'">{{ row.is_active ? 'Active' : 'Resolved' }}</BadgePill>
        </template>
        <template #cell-actions="{ row }">
          <button v-if="row.is_active" class="btn btn-sm" :disabled="resolving === row.id" @click.stop="resolveAlert(row.id)">
            {{ resolving === row.id ? '…' : 'Resolve' }}
          </button>
        </template>
      </DataTable>
    </div>
  </div>

  <!-- Active congestion events -->
  <CollapsibleSection
    id="congestion-events-table" class="card drill-target" default-open title="Active Congestion Events" source="KeNHA RTMS · Live"
    :count="congestionCount.count.value ?? 0" :tone="(congestionCount.count.value ?? 0) > 0 ? 'warning' : 'success'"
    storage-key="inc:traffic/alerts:active-congestion-events"
  >
    <div class="card-body">
      <DataTable :table="congestionTable" row-key="id" title="Active congestion events" export-name="uapts-active-congestion"
                 placeholder="Search segment, description…" empty="No active congestion events.">
        <template #cell-segment_road_code="{ row }">
          <div class="cell-title">{{ row.segment_road_code ?? '-' }}</div>
          <div v-if="row.description" class="cell-sub">{{ String(row.description).slice(0, 60) }}</div>
        </template>
        <template #cell-avg_speed_kmh="{ row }">
          <span class="speed" :class="row.avg_speed_kmh < 20 ? 'is-bad' : row.avg_speed_kmh < 40 ? 'is-warn' : 'is-ok'">{{ Number(row.avg_speed_kmh).toFixed(0) }}</span>
        </template>
        <template #cell-expected_duration_min="{ row }">{{ Number(row.expected_duration_min).toFixed(0) }} min</template>
      </DataTable>
    </div>
  </CollapsibleSection>

  <!-- Forecast risk events -->
  <SectionTitle pill="AI Model · Next 12h">Upcoming Congestion Risk</SectionTitle>
  <div id="risk-forecast-table" class="card drill-target">
    <div class="card-body">
      <DataTable :table="forecastTable" row-key="id" title="Upcoming congestion risk" export-name="uapts-congestion-forecast"
                 placeholder="Search segment, model…" empty="No heavy or severe congestion is predicted in the next 12 hours.">
        <template #cell-horizon_hours="{ row }">{{ row.horizon_hours }}h</template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useTraffic } from '~/composables/api'
import type { TrafficAlert } from '~/composables/api'
import { useApi } from '~/composables/api/_client'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useServerCount } from '~/composables/useServerCount'
import { useCountyScope } from '~/composables/useCountyScope'
import { useSeverityBadge } from '~/composables/useSeverityBadge'
import type { PagedResult, TableColumn } from '~/types/dataTable'

// Every table here is a window onto the WHOLE server-side dataset (see docs/data-tables.md): search, column filters,
// sorting and paging run on the server, and every KPI is a server count. Nothing is derived from a first page of rows.
const TRAFFIC = '/api/v1/traffic'
const api = useApi()
const { riskBadge: sevBadge, congestionBadge: congBadge } = useSeverityBadge()

// County filter for this module, following the global filter in the top bar until a county is picked here.
const county = useCountyScope('traffic')
const scope = () => county.query.value

const ALERT_TYPES = [
  { value: 'congestion', label: 'Congestion' }, { value: 'incident', label: 'Incident' },
  { value: 'weather', label: 'Weather' }, { value: 'road_closure', label: 'Road Closure' },
]
const ALERT_SEVERITIES = [{ value: 'critical', label: 'Critical' }, { value: 'warning', label: 'Warning' }, { value: 'info', label: 'Info' }]
// Congestion events have their own scale (CongestionEvent.severity), not the alert one.
const CONGESTION_SEVERITIES = ['low', 'medium', 'high', 'critical'].map(value => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))
const badgeMap = (values: string[], fn: (v: string) => string) => Object.fromEntries(values.map(v => [v, fn(v)]))

// ── Alert log ────────────────────────────────────────────────────────────
const alertColumns: TableColumn[] = [
  { key: 'title', label: 'Title', priority: 1, pin: 'left', minWidth: 220 },
  { key: 'alert_type', label: 'Type', type: 'badge', badge: badgeMap(ALERT_TYPES.map(o => o.value), () => 'info'), options: ALERT_TYPES, priority: 2 },
  { key: 'severity', label: 'Severity', type: 'badge', badge: badgeMap(ALERT_SEVERITIES.map(o => o.value), sevBadge), options: ALERT_SEVERITIES, priority: 1 },
  { key: 'segment_road_code', label: 'Segment', type: 'mono', priority: 2 },
  { key: 'is_active', label: 'Status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Resolved' }], priority: 1 },
  { key: 'issued_at', label: 'Issued', type: 'datetime', priority: 2 },
  { key: 'resolved_at', label: 'Resolved', type: 'datetime', priority: 3 },
  { key: 'actions', label: '', sortable: false, filter: false, noExport: true, priority: 1 },
]
const alertTable = useEndpointTable({
  key: 'traffic-alert-log', path: `${TRAFFIC}/alerts/`, columns: alertColumns, countyKey: 'traffic', pageSize: 25,
  defaultSort: [{ key: 'issued_at', dir: 'desc' }],
})

// ── Active congestion events ─────────────────────────────────────────────
const congestionColumns: TableColumn[] = [
  { key: 'segment_road_code', label: 'Segment', priority: 1, pin: 'left', minWidth: 150 },
  { key: 'severity', label: 'Severity', type: 'badge', badge: badgeMap(CONGESTION_SEVERITIES.map(o => o.value), sevBadge), options: CONGESTION_SEVERITIES, priority: 1 },
  { key: 'avg_speed_kmh', label: 'Avg Speed (km/h)', type: 'num', digits: 0, priority: 1 },
  { key: 'delay_minutes', label: 'Delay (min)', type: 'num', digits: 0, priority: 2 },
  { key: 'impact_radius_km', label: 'Impact (km)', type: 'num', digits: 1, priority: 3 },
  { key: 'expected_duration_min', label: 'Expected Duration', type: 'num', digits: 0, priority: 3 },
  { key: 'started_at', label: 'Started', type: 'datetime', priority: 2 },
]
const congestionTable = useEndpointTable({
  key: 'traffic-active-congestion', path: `${TRAFFIC}/congestion-events/`, columns: congestionColumns, countyKey: 'traffic', pageSize: 25,
  params: { status: 'active' }, defaultSort: [{ key: 'started_at', dir: 'desc' }],
})

// ── Upcoming congestion risk: heavy / severe in the next 12 hours ─────────
// The window is computed on the server's data, not by trimming a first page client-side. `minute` keeps the query
// stable within a minute (so the page cache works) and rolls the window forward as time passes.
const minute = ref(Math.floor(Date.now() / 60_000))
const horizonIso = computed(() => new Date((minute.value * 60 + 12 * 3600) * 1000).toISOString())
const RISK = { 'f.predicted_congestion__in': 'heavy,severe' }
const riskParams = () => ({ ...RISK, 'f.target_at__lte': horizonIso.value })

const forecastColumns: TableColumn[] = [
  { key: 'segment_road_code', label: 'Segment', type: 'mono', priority: 1, pin: 'left' },
  { key: 'model_name', label: 'Model', type: 'badge', badge: {}, priority: 3 },
  { key: 'target_at', label: 'Target Time', type: 'datetime', priority: 1 },
  { key: 'predicted_congestion', label: 'Predicted Congestion', type: 'badge', badge: badgeMap(['heavy', 'severe'], congBadge), options: [{ value: 'heavy', label: 'Heavy' }, { value: 'severe', label: 'Severe' }], priority: 1 },
  { key: 'predicted_volume', label: 'Predicted Volume', type: 'num', priority: 2 },
  { key: 'predicted_speed_kmh', label: 'Predicted Speed (km/h)', type: 'num', digits: 0, priority: 2 },
  { key: 'horizon_hours', label: 'Horizon', type: 'num', priority: 3 },
]
const forecastTable = useEndpointTable({
  key: 'traffic-forecast-risk', path: `${TRAFFIC}/forecasts/`, columns: forecastColumns, countyKey: 'traffic', pageSize: 25,
  params: riskParams, defaultSort: [{ key: 'target_at', dir: 'asc' }],
})

// ── KPIs: counted by the server ──────────────────────────────────────────
const activeCount = useServerCount(`${TRAFFIC}/alerts/`, () => ({ ...scope(), active: 'true' }))
const criticalCount = useServerCount(`${TRAFFIC}/alerts/`, () => ({ ...scope(), active: 'true', 'f.severity__exact': 'critical' }))
const warningCount = useServerCount(`${TRAFFIC}/alerts/`, () => ({ ...scope(), active: 'true', 'f.severity__exact': 'warning' }))
const resolvedCount = useServerCount(`${TRAFFIC}/alerts/`, () => ({ ...scope(), 'f.is_active__exact': 'false' }))
const congestionCount = useServerCount(`${TRAFFIC}/congestion-events/`, () => ({ ...scope(), status: 'active' }))
const riskCount = useServerCount(`${TRAFFIC}/forecasts/`, () => ({ ...scope(), ...riskParams() }))
const counts = [activeCount, criticalCount, warningCount, resolvedCount, congestionCount, riskCount]

// ── Active alert cards (most recent 100 active, filtered on the server) ───
const sevFilter = ref('')
const typeFilter = ref('')
const activeList = ref<TrafficAlert[]>([])
const activeListTotal = ref(0)
const activeListLoading = ref(true)
const activeListError = ref(false)
const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 }
let listSeq = 0

async function loadActiveList() {
  const mine = ++listSeq
  activeListLoading.value = true
  try {
    const res = await api<PagedResult<TrafficAlert>>(`${TRAFFIC}/alerts/`, {
      query: {
        ...scope(), active: 'true', page_size: 100, ordering: '-issued_at',
        ...(sevFilter.value ? { 'f.severity__exact': sevFilter.value } : {}),
        ...(typeFilter.value ? { 'f.alert_type__exact': typeFilter.value } : {}),
      },
    })
    if (mine !== listSeq) return
    // Most urgent first; within a severity, newest first (the server already ordered by time).
    activeList.value = [...(res.results ?? [])].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9))
    activeListTotal.value = res.count ?? activeList.value.length
    activeListError.value = false
  } catch {
    if (mine === listSeq) { activeList.value = []; activeListTotal.value = 0; activeListError.value = true }
  } finally {
    if (mine === listSeq) activeListLoading.value = false
  }
}
watch([sevFilter, typeFilter, () => county.county.value], loadActiveList)
onMounted(loadActiveList)

// ── Updating: resolve an alert, then bring everything that depends on it up to date ──
const resolving = ref<string | null>(null)
const actionError = ref<string | null>(null)

/** Re-fetch everything on the page (the engine clears its page cache on refresh, so no table can show stale rows). */
function refreshAll() {
  return Promise.all([alertTable.refresh(), congestionTable.refresh(), forecastTable.refresh(), loadActiveList(), ...counts.map(c => c.refresh())])
}

async function resolveAlert(id: string) {
  if (resolving.value) return
  resolving.value = id
  actionError.value = null
  try {
    await useTraffic().resolveAlert(id)
    await refreshAll()
  } catch (e: any) {
    actionError.value = e?.data?.detail ?? 'Could not resolve that alert. It may already be resolved, or you may not have permission.'
    await refreshAll().catch(() => {})                   // show the truth either way
  } finally {
    resolving.value = null
  }
}

// Keep it live: every minute roll the forecast window forward (which refetches the forecast table by itself) and
// refresh the rest.
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    minute.value = Math.floor(Date.now() / 60_000)
    void Promise.all([alertTable.refresh(), congestionTable.refresh(), loadActiveList(), ...counts.map(c => c.refresh())])
  }, 60_000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.cell-title { font-weight:600; overflow:hidden; text-overflow:ellipsis; }
.cell-sub { font-size:11px; color:var(--fg-3); overflow:hidden; text-overflow:ellipsis; }
.speed { font-weight:600; }
.speed.is-bad { color:var(--danger-fg); }
.speed.is-warn { color:var(--warning-fg); }
.speed.is-ok { color:var(--success-fg); }
.more-note { margin:10px 0 0; font-size:12px; color:var(--fg-3); }
</style>
