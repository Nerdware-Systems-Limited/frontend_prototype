<template>
  <PageHeader
    eyebrow="Safety - Incident Command"
    title="Incident Command"
    subtitle="NTSA · NPS · KMD - Real-time active incidents, NPS emergency dispatch coordination, KMD weather context, and investigation workflows"
  >
    <template #actions>
      <span class="freshness-badge" :class="{ loading }">
        {{ loading ? 'Refreshing…' : `Updated ${lastRefreshed}` }}
      </span>
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI row -->
  <div class="kpi-grid">
    <KpiCard
      label="Active Incidents"
      :value="summary ? fmtNum(summary.kpis.active) : '-'"
      sub="Currently open"
      source="live" source-title="NTSA IRSMS"
    />
    <KpiCard
      label="Incidents Today"
      :value="summary ? fmtNum(summary.kpis.total_24h) : '-'"
      sub="All severities"
      source="live" source-title="NTSA IRSMS"
    />
    <KpiCard
      label="Fatalities (30d)"
      :value="summary ? fmtNum(summary.kpis.fatal_30d) : '-'"
      trend-direction="down"
      source="live" source-title="NTSA IRSMS"
    />
    <KpiCard
      label="Active Dispatches"
      :value="summary ? fmtNum(summary.active_dispatches) : '-'"
      sub="Emergency units en route"
      source="live" source-title="NPS / NTSA"
    />
  </div>

  <!-- Filter bar -->
  <div class="filter-row">
    <select v-model="severityFilter" class="select-sm">
      <option value="">All severities</option>
      <option value="fatal">Fatal</option>
      <option value="critical">Critical</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
    <select v-model="statusFilter" class="select-sm">
      <option value="">All statuses</option>
      <option value="reported">Reported</option>
      <option value="triaged">Triaged</option>
      <option value="dispatched">Dispatched</option>
      <option value="on_scene">On Scene</option>
      <option value="resolved">Resolved</option>
    </select>
    <button class="btn" @click="load">Apply</button>
    <button class="btn" @click="severityFilter = ''; statusFilter = ''; load()">Clear</button>
  </div>

  <!-- Map + active list -->
  <div class="two-col">
    <div class="card map-card">
      <div class="card-header">Active Incident Map</div>
      <ClientOnly>
        <UaptsMap
          :markers="incidentMarkers"
          :roads="roadsGeo"
          :center="[-1.286, 36.817]"
          :zoom="7"
          height="480px"
          show-legend
        />
      </ClientOnly>
    </div>

    <div class="card">
      <div class="card-header">
        Active Incidents
        <span class="count-badge">{{ activeIncidents.length }}</span>
      </div>
      <div class="card-body scroll-body">
        <div
          v-for="inc in activeIncidents"
          :key="inc.id"
          class="incident-card"
          :class="`sev-${inc.severity}`"
        >
          <div class="inc-header">
            <BadgePill :variant="sevBadge(inc.severity)">{{ inc.severity.toUpperCase() }}</BadgePill>
            <span class="inc-ref">{{ inc.reference_code }}</span>
            <span class="inc-time">{{ fmtTime(inc.reported_at) }}</span>
          </div>
          <div class="inc-title">{{ inc.title }}</div>
          <div class="inc-meta">
            {{ inc.incident_type.replace(/_/g,' ') }} ·
            {{ inc.casualties }} casualt{{ inc.casualties === 1 ? 'y' : 'ies' }} ·
            {{ inc.vehicles_involved }} vehicle{{ inc.vehicles_involved === 1 ? '' : 's' }}
          </div>
          <div class="inc-actions">
            <button
              v-if="inc.status === 'reported'"
              class="btn btn-sm"
              :disabled="acting === inc.id"
              @click="doTriage(inc.id)"
            >Triage</button>
            <button
              v-if="['reported','triaged'].includes(inc.status)"
              class="btn btn-sm btn-primary"
              :disabled="acting === inc.id"
              @click="doDispatch(inc.id)"
            >Dispatch</button>
            <button
              v-if="['dispatched','on_scene'].includes(inc.status)"
              class="btn btn-sm"
              :disabled="acting === inc.id"
              @click="doResolve(inc.id)"
            >Resolve</button>
            <button
              v-if="inc.status === 'resolved'"
              class="btn btn-sm"
              :disabled="acting === inc.id"
              @click="doClose(inc.id)"
            >Close</button>
            <BadgePill variant="neutral">{{ inc.status.replace(/_/g,' ') }}</BadgePill>
          </div>
        </div>
        <div v-if="!loading && activeIncidents.length === 0" style="color:#94a3b8;font-size:13px;padding:12px 0">
          No active incidents matching current filters.
        </div>
        <div v-if="loading && activeIncidents.length === 0" style="color:#94a3b8;font-size:13px;padding:12px 0">
          Loading incidents…
        </div>
      </div>
    </div>
  </div>

  <!-- Full incident table -->
  <SectionTitle>All Incidents</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Casualties</th>
            <th>Vehicles</th>
            <th>Channel</th>
            <th>Reported</th>
            <th>Dispatches</th>
          </tr>
        </thead>
        <tbody v-if="incidents.length">
          <tr v-for="inc in incidents" :key="inc.id">
            <td style="font-family:monospace;font-size:12px">{{ inc.reference_code }}</td>
            <td>{{ inc.incident_type.replace(/_/g,' ') }}</td>
            <td><BadgePill :variant="sevBadge(inc.severity)">{{ inc.severity }}</BadgePill></td>
            <td><BadgePill variant="neutral">{{ inc.status.replace(/_/g,' ') }}</BadgePill></td>
            <td>{{ inc.casualties }}</td>
            <td>{{ inc.vehicles_involved }}</td>
            <td style="font-size:12px">{{ inc.reporting_channel.replace(/_/g,' ') }}</td>
            <td style="white-space:nowrap;font-size:12px">{{ fmtTime(inc.reported_at) }}</td>
            <td>{{ inc.dispatch_count }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading…' : 'No incidents found' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Dispatch log -->
  <SectionTitle pill="NPS / NTSA · Live">Emergency Dispatch Log</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Incident</th>
            <th>Service</th>
            <th>Target Agency</th>
            <th>Status</th>
            <th>ETA (min)</th>
            <th>Arrived</th>
            <th>Completed</th>
          </tr>
        </thead>
        <tbody v-if="dispatches.length">
          <tr v-for="d in dispatches" :key="d.id">
            <td style="font-family:monospace;font-size:12px">{{ d.incident_ref }}</td>
            <td><BadgePill variant="info">{{ d.service_type.replace(/_/g,' ') }}</BadgePill></td>
            <td>{{ d.target_agency_code ?? '-' }}</td>
            <td><BadgePill :variant="dispatchBadge(d.status)">{{ d.status.replace(/_/g,' ') }}</BadgePill></td>
            <td>{{ d.recommended_eta_minutes ?? '-' }}</td>
            <td style="font-size:12px">{{ d.arrived_at ? fmtTime(d.arrived_at) : '-' }}</td>
            <td style="font-size:12px">{{ d.completed_at ? fmtTime(d.completed_at) : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading…' : 'No dispatch records found' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Incident Command')

import { useSafety, useGis } from '~/composables/api'
import type { SafetySummary, Incident, EmergencyDispatch } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'purple' | 'gray'; size?: 'sm' | 'md' | 'lg' }

const summary    = ref<SafetySummary | null>(null)
const incidents  = ref<Incident[]>([])
const dispatches = ref<EmergencyDispatch[]>([])
const roadsGeo   = ref<GeoJSONFeatureCollection | null>(null)
const loading    = ref(true)
const error      = ref<string | null>(null)
const acting     = ref<string | null>(null)
const lastRefreshed = ref('-')

const severityFilter = ref('')
const statusFilter   = ref('')

async function load() {
  loading.value = true
  error.value = null
  const safety = useSafety()
  const gis    = useGis()

  const [sumRes, incRes, dispRes, roadsRes] = await Promise.allSettled([
    safety.summary(),
    safety.incidents({
      page_size: 50,
      ...(severityFilter.value ? { severity: severityFilter.value } : {}),
      ...(statusFilter.value   ? { status:   statusFilter.value }   : {}),
    }),
    safety.dispatches({ page_size: 30 }),
    gis.roads({ limit: 300, simplify: 0.01 }),
  ])

  if (sumRes.status   === 'fulfilled') summary.value    = sumRes.value
  if (incRes.status   === 'fulfilled') incidents.value  = (incRes.value as any).results ?? []
  if (dispRes.status  === 'fulfilled') dispatches.value = (dispRes.value as any).results ?? []
  if (roadsRes.status === 'fulfilled') roadsGeo.value   = roadsRes.value

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 60_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Actions ────────────────────────────────────────────────────────────
async function doTriage(id: string) {
  acting.value = id
  try { await useSafety().triageIncident(id); await load() }
  catch { /* silent */ }
  finally { acting.value = null }
}
async function doDispatch(id: string) {
  acting.value = id
  try { await useSafety().dispatchIncident(id); await load() }
  catch { /* silent */ }
  finally { acting.value = null }
}
async function doResolve(id: string) {
  acting.value = id
  try { await useSafety().resolveIncident(id); await load() }
  catch { /* silent */ }
  finally { acting.value = null }
}
async function doClose(id: string) {
  acting.value = id
  try { await useSafety().closeIncident(id); await load() }
  catch { /* silent */ }
  finally { acting.value = null }
}

// ── Computed ───────────────────────────────────────────────────────────
const activeIncidents = computed(() =>
  incidents.value.filter(i => !['resolved','closed','cancelled'].includes(i.status)),
)

const incidentMarkers = computed((): MarkerSpec[] =>
  incidents.value
    .filter(i => i.latitude && i.longitude)
    .map(i => ({
      id: `inc-${i.id}`,
      lat: i.latitude!,
      lon: i.longitude!,
      title: i.title,
      subtitle: `${i.severity} · ${i.status}`,
      color: i.severity === 'fatal' || i.severity === 'critical' ? 'red'
           : i.severity === 'high' ? 'orange'
           : i.severity === 'medium' ? 'yellow'
           : 'blue',
      size: i.severity === 'fatal' ? 'lg' : i.severity === 'critical' ? 'md' : 'sm',
    })),
)

// ── Formatters ─────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function sevBadge(sev: string) {
  const m: Record<string,string> = { fatal:'danger', critical:'danger', high:'warning', medium:'fair', low:'success' }
  return m[sev] ?? 'neutral'
}
function dispatchBadge(status: string) {
  const m: Record<string,string> = { recommended:'info', acknowledged:'fair', en_route:'warning', on_scene:'success', completed:'success', cancelled:'neutral' }
  return m[status] ?? 'neutral'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.two-col { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:900px) { .two-col { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.count-badge { font-size:11px; background:#f1f5f9; border-radius:10px; padding:1px 7px; margin-left:6px; }
.scroll-body { max-height:460px; overflow-y:auto; padding:0!important; }
.incident-card { padding:12px 14px; border-left:3px solid #e2e8f0; margin-bottom:1px; }
.incident-card.sev-fatal, .incident-card.sev-critical { border-left-color:#ef4444; background:rgba(239,68,68,.04); }
.incident-card.sev-high { border-left-color:#f97316; background:rgba(249,115,22,.03); }
.incident-card.sev-medium { border-left-color:#f59e0b; }
.inc-header { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
.inc-ref { font-size:11px; font-family:monospace; color:#64748b; }
.inc-time { font-size:11px; color:#94a3b8; margin-left:auto; }
.inc-title { font-size:13px; font-weight:600; margin-bottom:3px; }
.inc-meta { font-size:12px; color:#64748b; margin-bottom:6px; }
.inc-actions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.btn-sm { padding:3px 10px; font-size:12px; }
</style>
