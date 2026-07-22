<template>
  <PageHeader
    eyebrow="Railway"
    title="Rail Safety"
    subtitle="KRC · RSSB · NTSA - Incident tracking, level crossing safety, regulatory compliance, and predictive risk indicators"
  >
    <template #actions>
      <NuxtLink to="/railway/infrastructure" class="btn">Rail Infrastructure →</NuxtLink>
      <NuxtLink to="/railway/network-inventory" class="btn">Network Inventory →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Open Incidents" :value="fmtNum(openIncidents.length)" sub="Investigating or unresolved" trend-direction="down" source="live" source-title="KRC Safety" />
    <KpiCard label="Fatal / Serious" :value="fmtNum(countBySeverity('fatal') + countBySeverity('serious'))" :sub="`${countBySeverity('fatal')} fatal · ${countBySeverity('serious')} serious`" trend-direction="down" source="live" source-title="KRC Safety" />
    <KpiCard label="Derailments" :value="fmtNum(countByType('derailment') + countByType('derailment_minor'))" sub="Incl. minor derailments" trend-direction="down" source="batch" source-title="KRC Safety" />
    <KpiCard label="Collisions" :value="fmtNum(countByType('collision'))" sub="Rolling stock collisions" trend-direction="down" source="batch" source-title="KRC Safety" />
    <KpiCard label="Level Crossing Incidents" :value="fmtNum(countByType('level_crossing'))" sub="At grade crossings" trend-direction="down" source="batch" source-title="KRC Safety" />
    <KpiCard label="Signal Failures / SPAD" :value="fmtNum(countByType('signal_failure'))" sub="Signal-passed-at-danger events" trend-direction="down" source="batch" source-title="KRC Safety" />
    <KpiCard label="Trespasser Incidents" :value="fmtNum(countByType('trespasser'))" sub="Unauthorized track access" trend-direction="down" source="batch" source-title="KRC Safety" />
    <KpiCard label="Total Casualties" :value="fmtNum(totalCasualties)" sub="All incidents in view" trend-direction="down" source="live" source-title="KRC Safety" />
    <KpiCard label="Days Since Last Serious Incident" :value="daysSinceSerious != null ? fmtNum(daysSinceSerious) : '-'" sub="Fatal or serious severity" :trend-direction="(daysSinceSerious ?? 0) >= 30 ? 'up' : 'down'" source="live" source-title="KRC Safety" />
    <KpiCard label="Corrective Actions Overdue" :value="correctiveActions.length ? fmtNum(overdueActions.length) : '-'" sub="Past due date, not closed" trend-direction="down" source="batch" source-title="RSSB / KRC" />
  </div>

  <!-- Incident table -->
  <SectionTitle pill="KRC Safety Dept · Live">Incident Registry</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="typeFilter" class="select-sm">
          <option value="">All incident types</option>
          <option value="collision">Collision</option>
          <option value="derailment">Derailment</option>
          <option value="derailment_minor">Minor Derailment</option>
          <option value="level_crossing">Level Crossing</option>
          <option value="fire">Fire</option>
          <option value="passenger">Passenger</option>
          <option value="trespasser">Trespasser</option>
          <option value="signal_failure">Signal Failure</option>
        </select>
        <select v-model="severityFilter" class="select-sm">
          <option value="">All severities</option>
          <option value="fatal">Fatal</option>
          <option value="serious">Serious</option>
          <option value="minor">Minor</option>
          <option value="none">None</option>
        </select>
        <select v-model="statusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <button class="btn" @click="typeFilter=''; severityFilter=''; statusFilter=''">Clear</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Incident Ref</th><th>Date/Time</th><th>Location</th><th>Network</th><th>Type</th><th>Severity</th>
              <th>Casualties</th><th>Status</th><th>Response Owner</th><th>Corrective Action</th>
            </tr>
          </thead>
          <tbody v-if="filteredIncidents.length">
            <tr v-for="i in filteredIncidents" :key="i.id">
              <td style="font-family:monospace;font-size:11px">{{ i.incident_ref }}</td>
              <td style="font-size:11px;white-space:nowrap">{{ fmtDateTime(i.occurred_at) }}</td>
              <td style="font-size:12px">{{ i.station_name ?? i.station_code ?? '-' }}</td>
              <td><BadgePill :variant="incidentNetwork(i) === 'sgr' ? 'info' : 'success'">{{ incidentNetwork(i).toUpperCase() }}</BadgePill></td>
              <td style="font-size:12px">{{ i.incident_type.replace(/_/g,' ') }}</td>
              <td><BadgePill :variant="severityBadge(i.severity)">{{ i.severity }}</BadgePill></td>
              <td>{{ i.casualties }}</td>
              <td><BadgePill :variant="statusBadge(i.status)">{{ i.status }}</BadgePill></td>
              <td style="font-size:12px">{{ actionFor(i.incident_ref)?.action_owner ?? '-' }}</td>
              <td style="font-size:12px">{{ actionFor(i.incident_ref) ? actionFor(i.incident_ref)!.investigation_status.replace(/_/g,' ') : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading incidents…' : 'No incidents match the current filters.' }}</td></tr></tbody>
        </table>
      </div>
      <div class="source-note">Incident core fields (type, severity, casualties, status) are live from KRC Safety reporting. Response owner and corrective-action status await the RSSB compliance-tracking integration; train/rolling-stock involvement and root cause are not yet captured upstream.</div>
    </div>
  </div>

  <!-- Level crossing safety -->
  <SectionTitle pill="KRC Level Crossings · Live">Level Crossing Safety</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Crossing</th><th>Road</th><th>Line</th><th>Risk Rating</th><th>Protection</th><th>Near Misses</th><th>Daily Road Traffic</th><th>Daily Trains</th><th>Last Incident</th></tr></thead>
          <tbody v-if="levelCrossings.length">
            <tr v-for="c in levelCrossings" :key="c.id">
              <td style="font-family:monospace;font-size:12px">{{ c.crossing_ref }}</td>
              <td style="font-size:12px">{{ c.road_name }}</td>
              <td style="font-size:12px">{{ c.line_name ?? c.line }}</td>
              <td><BadgePill :variant="riskBadge(c.risk_rating)">{{ c.risk_rating }}</BadgePill></td>
              <td style="font-size:12px">{{ c.protection_type.replace(/_/g,' ') }}</td>
              <td>{{ fmtNum(c.near_miss_count) }}</td>
              <td>{{ c.daily_road_traffic != null ? fmtNum(c.daily_road_traffic) : '-' }}</td>
              <td>{{ c.daily_train_movements != null ? fmtNum(c.daily_train_movements) : '-' }}</td>
              <td style="font-size:11px">{{ c.last_incident_at ? fmtDate(c.last_incident_at) : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading crossings…' : 'No level crossings on file.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Compliance & corrective action -->
  <SectionTitle pill="RSSB · Pending Integration">Compliance &amp; Corrective Action</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Incident Ref</th><th>Investigation Status</th><th>Regulatory Reference</th><th>Action Owner</th><th>Due Date</th><th>Closure Evidence</th><th>Recurrence</th></tr></thead>
          <tbody v-if="correctiveActions.length">
            <tr v-for="a in correctiveActions" :key="a.id">
              <td style="font-family:monospace;font-size:11px">{{ a.incident_ref }}</td>
              <td><BadgePill :variant="investigationBadge(a.investigation_status)">{{ a.investigation_status.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-size:12px">{{ a.regulatory_reference ?? '-' }}</td>
              <td style="font-size:12px">{{ a.action_owner ?? '-' }}</td>
              <td style="font-size:11px">
                <span :style="{ color: isOverdue(a) ? '#ef4444' : 'inherit' }">{{ fmtDate(a.due_date) }}</span>
              </td>
              <td style="font-size:12px">{{ a.closure_evidence ?? '-' }}</td>
              <td style="text-align:center">{{ a.recurrence_flag ? '⚠' : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'Corrective-action tracking has not been integrated from RSSB yet.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Safety analytics -->
  <SectionTitle pill="Computed · Live Incidents">Safety Analytics</SectionTitle>
  <div class="two-col">
    <div class="card">
      <div class="card-header">Incident Trend by Month</div>
      <div class="card-body">
        <TrendLineChart
          :points="trendChartPoints"
          color="#ef4444"
          :height="180"
          :format-value="v => v.toFixed(0)"
          :empty-text="loading ? 'Loading…' : 'No incident history available.'"
        />
      </div>
    </div>
    <div class="card">
      <div class="card-header">Incidents by Type</div>
      <div class="card-body">
        <div v-if="byType.length" class="bar-list">
          <div v-for="ty in byType" :key="ty.type" class="bar-row">
            <span class="bar-label">{{ ty.type.replace(/_/g,' ') }}</span>
            <div class="bar-wrap"><div class="bar-fill" :style="{ width: `${maxByType > 0 ? (ty.count / maxByType) * 100 : 0}%` }" /></div>
            <span class="bar-val">{{ ty.count }}</span>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No incident data.' }}</div>
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
            <div class="bar-wrap"><div class="bar-fill" style="background:#ef4444" :style="{ width: `${maxLineRisk > 0 ? (l.count / maxLineRisk) * 100 : 0}%` }" /></div>
            <span class="bar-val">{{ l.count }}</span>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No line-linked incidents recorded.' }}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">High-Risk Crossings</div>
      <div class="card-body">
        <div v-if="highRiskCrossings.length">
          <AlertItem v-for="c in highRiskCrossings" :key="c.id" :severity="c.risk_rating === 'critical' ? 'critical' : 'warning'" :title="c.road_name" :meta="`${c.near_miss_count} near-misses · ${c.protection_type.replace(/_/g,' ')}${c.last_incident_at ? ' · last incident ' + fmtDate(c.last_incident_at) : ''}`" />
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No high-risk crossings on file yet.' }}</div>
      </div>
    </div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">Predictive Derailment / Signal Risk Indicators</div>
    <div class="card-body">
      <table>
        <thead><tr><th>Line</th><th>Network</th><th>Risk Type</th><th>Risk Score</th><th>Contributing Factors</th><th>Generated</th></tr></thead>
        <tbody v-if="riskIndicators.length">
          <tr v-for="r in riskIndicators" :key="r.id">
            <td style="font-weight:600;font-size:12px">{{ r.line_name ?? r.line }}</td>
            <td><BadgePill :variant="r.network === 'sgr' ? 'info' : 'success'">{{ r.network.toUpperCase() }}</BadgePill></td>
            <td style="font-size:12px">{{ r.risk_type.replace(/_/g,' ') }}</td>
            <td :style="{ color: r.risk_score >= 70 ? '#ef4444' : r.risk_score >= 40 ? '#f59e0b' : '#22c55e', fontWeight:'600' }">{{ r.risk_score.toFixed(0) }}</td>
            <td style="font-size:12px">{{ (r.contributing_factors ?? []).join(', ') || '-' }}</td>
            <td style="font-size:11px">{{ fmtDate(r.generated_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'ML-based derailment/signal risk scoring has not been integrated yet.' }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Rail Safety')

import { useRailway, useRailInfrastructure, useRailSafety } from '~/composables/api'
import type { RailIncident, RailLine, LevelCrossing, CorrectiveAction, RailRiskIndicator, RailNetwork } from '~/composables/api'

const incidents        = ref<RailIncident[]>([])
const lines             = ref<RailLine[]>([])
const levelCrossings    = ref<LevelCrossing[]>([])
const correctiveActions = ref<CorrectiveAction[]>([])
const riskIndicators    = ref<RailRiskIndicator[]>([])
const loading = ref(true)
const error   = ref<string | null>(null)

const typeFilter     = ref('')
const severityFilter = ref('')
const statusFilter   = ref('')

async function load() {
  loading.value = true
  error.value = null
  const rail = useRailway()
  const ri   = useRailInfrastructure()
  const rs   = useRailSafety()

  const [incRes, linesRes, crossRes, actionsRes, riskRes] = await Promise.allSettled([
    rail.incidents({ page_size: 200 }),
    rail.lines({ page_size: 200 }),
    ri.levelCrossings({ page_size: 200 }),
    rs.correctiveActions({ page_size: 200 }),
    rs.riskIndicators(),
  ])

  if (incRes.status    === 'fulfilled') incidents.value        = (incRes.value as any).results ?? []
  if (linesRes.status  === 'fulfilled') lines.value             = (linesRes.value as any).results ?? []
  if (crossRes.status  === 'fulfilled') levelCrossings.value    = (crossRes.value as any).results ?? []
  if (actionsRes.status === 'fulfilled') correctiveActions.value = (actionsRes.value as any).results ?? []
  if (riskRes.status   === 'fulfilled') riskIndicators.value    = (riskRes.value as any).results ?? []

  if (incRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Railway API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Lookups ──────────────────────────────────────────────────────────────
const lineNetworkMap = computed(() => {
  const m = new Map<string, RailNetwork>()
  lines.value.forEach(l => m.set(l.id, l.network))
  return m
})
function incidentNetwork(i: RailIncident): RailNetwork {
  return (i.line && lineNetworkMap.value.get(i.line)) || 'unknown'
}
const actionMap = computed(() => {
  const m = new Map<string, CorrectiveAction>()
  correctiveActions.value.forEach(a => m.set(a.incident_ref, a))
  return m
})
function actionFor(ref: string) { return actionMap.value.get(ref) }

// ── Filters ──────────────────────────────────────────────────────────────
const filteredIncidents = computed(() => incidents.value.filter(i => {
  if (typeFilter.value && i.incident_type !== typeFilter.value) return false
  if (severityFilter.value && i.severity !== severityFilter.value) return false
  if (statusFilter.value && i.status !== statusFilter.value) return false
  return true
}))

// ── KPIs ─────────────────────────────────────────────────────────────────
const openIncidents = computed(() => incidents.value.filter(i => i.status === 'open' || i.status === 'investigating'))
function countBySeverity(s: string) { return incidents.value.filter(i => i.severity === s).length }
function countByType(ty: string) { return incidents.value.filter(i => i.incident_type === ty).length }
const totalCasualties = computed(() => incidents.value.reduce((s, i) => s + i.casualties, 0))
const daysSinceSerious = computed(() => {
  const serious = incidents.value.filter(i => i.severity === 'fatal' || i.severity === 'serious')
  if (!serious.length) return null
  const latest = Math.max(...serious.map(i => new Date(i.occurred_at).getTime()))
  return Math.floor((Date.now() - latest) / 86_400_000)
})
function isOverdue(a: CorrectiveAction) {
  return !!a.due_date && a.investigation_status !== 'closed' && new Date(a.due_date).getTime() < Date.now()
}
const overdueActions = computed(() => correctiveActions.value.filter(isOverdue))
const highRiskCrossings = computed(() => levelCrossings.value.filter(c => c.risk_rating === 'high' || c.risk_rating === 'critical'))

// ── Analytics ────────────────────────────────────────────────────────────
const trendByMonth = computed(() => {
  const m = new Map<string, number>()
  for (const i of incidents.value) {
    const key = new Date(i.occurred_at).toLocaleDateString('en-KE', { month: 'short', year: '2-digit' })
    m.set(key, (m.get(key) ?? 0) + 1)
  }
  return [...m.entries()].map(([month, count]) => ({ month, count }))
})
const trendChartPoints = computed(() => trendByMonth.value.map(t => ({ label: t.month, value: t.count })))

const byType = computed(() => {
  const m = new Map<string, number>()
  for (const i of incidents.value) m.set(i.incident_type, (m.get(i.incident_type) ?? 0) + 1)
  return [...m.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
})
const maxByType = computed(() => Math.max(1, ...byType.value.map(t => t.count)))

const highRiskLines = computed(() => {
  const m = new Map<string, number>()
  for (const i of incidents.value) {
    if (!i.line) continue
    const name = lines.value.find(l => l.id === i.line)?.name ?? i.line
    m.set(name, (m.get(name) ?? 0) + 1)
  }
  return [...m.entries()].map(([line, count]) => ({ line, count })).sort((a, b) => b.count - a.count).slice(0, 10)
})
const maxLineRisk = computed(() => Math.max(1, ...highRiskLines.value.map(l => l.count)))

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
function fmtDateTime(s: string) {
  try { return new Date(s).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return s }
}
function severityBadge(s: string) {
  const m: Record<string,string> = { fatal:'danger', serious:'danger', minor:'warning', none:'neutral' }
  return m[s] ?? 'neutral'
}
function statusBadge(s: string) {
  const m: Record<string,string> = { open:'danger', investigating:'warning', resolved:'success', closed:'neutral' }
  return m[s] ?? 'neutral'
}
function riskBadge(s: string) {
  const m: Record<string,string> = { low:'success', medium:'fair', high:'warning', critical:'danger' }
  return m[s] ?? 'neutral'
}
function investigationBadge(s: string) {
  const m: Record<string,string> = { open:'danger', in_progress:'warning', closed:'success' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
.source-note { margin-top:10px; font-size:11px; color:#94a3b8; border-top:1px solid #f1f5f9; padding-top:10px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.bar-list { display:flex; flex-direction:column; gap:8px; }
.bar-row { display:grid; grid-template-columns:140px 1fr 40px; align-items:center; gap:8px; }
.bar-label { font-size:12px; text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.bar-fill { height:100%; background:#3b82f6; border-radius:4px; transition:width .4s; }
.bar-val { font-size:11px; text-align:right; }
</style>
