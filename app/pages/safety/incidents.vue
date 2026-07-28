<template>
  <PageHeader
    eyebrow="Safety - Incident Command"
    title="Incident Command"
    subtitle="NTSA · NPS · KMD - Real-time active incidents, NPS emergency dispatch coordination, KMD weather context, and investigation workflows"
  >
    <!-- <template #actions>
      
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template> -->
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>
  <div v-if="successMsg" class="success-banner">✓ {{ successMsg }}</div>

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

  <!-- Incidents table with filtering -->
  <SectionTitle>All Incidents</SectionTitle>

  <div class="filter-row">
    <input v-model="incidentSearch" class="select-sm" placeholder="Search reference / title…" style="min-width:180px" />
    <select v-model="severityFilter" class="select-sm">
      <option value="">All severities</option>
      <option value="fatal">Fatal</option>
      <option value="serious">Serious</option>
      <option value="minor">Minor</option>
    </select>
    <select v-model="statusFilter" class="select-sm">
      <option value="">All statuses</option>
      <option value="reported">Reported</option>
      <option value="triaged">Triaged</option>
      <option value="dispatched">Dispatched</option>
      <option value="on_scene">On Scene</option>
      <option value="resolved">Resolved</option>
    </select>
    <select v-model="verifiedFilter" class="select-sm">
      <option value="">Verified + unverified</option>
      <option value="true">Verified only</option>
      <option value="false">Unverified only</option>
    </select>
    <button class="btn" @click="load">Apply</button>
    <button class="btn" @click="incidentSearch = ''; severityFilter = ''; statusFilter = ''; verifiedFilter = ''; load()">Clear</button>
    <ExportButton filename="uapts-incidents.csv" :rows="filteredIncidents" :columns="incidentExportColumns" style="margin-left:auto" />
  </div>

  <div class="card" style="margin-bottom:16px">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Reference</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Verified</th>
            <th>Reporters</th>
            <th>Casualties</th>
            <th>Vehicles</th>
            <th>Channel</th>
            <th>Reported</th>
            <th>Dispatches</th>
          </tr>
        </thead>
        <tbody v-if="filteredIncidents.length">
          <template v-for="inc in filteredIncidents" :key="inc.id">
            <tr class="expand-row" @click="expanded = expanded === inc.id ? null : inc.id">
              <td class="expand-cell">{{ expanded === inc.id ? '▾' : '▸' }}</td>
              <td style="font-family:monospace;font-size:12px">{{ inc.reference_code }}</td>
              <td>{{ inc.incident_type.replace(/_/g,' ') }}</td>
              <td><BadgePill :variant="sevBadge(inc.severity)">{{ inc.severity }}</BadgePill></td>
              <td><BadgePill variant="neutral">{{ inc.status.replace(/_/g,' ') }}</BadgePill></td>
              <td><BadgePill :variant="inc.is_verified ? 'success' : 'neutral'">{{ inc.is_verified ? 'Verified' : 'Unverified' }}</BadgePill></td>
              <td>
                <button class="link-btn" @click.stop="openReporters(inc)">{{ inc.reporter_count }}</button>
              </td>
              <td>{{ inc.casualties }}</td>
              <td>{{ inc.vehicles_involved }}</td>
              <td style="font-size:12px">{{ inc.reporting_channel.replace(/_/g,' ') }}</td>
              <td style="white-space:nowrap;font-size:12px">{{ fmtTime(inc.reported_at) }}</td>
              <td>{{ inc.dispatch_count }}</td>
            </tr>
            <tr v-if="expanded === inc.id" class="detail-row">
              <td :colspan="12">
                <div class="drilldown">
                  <div class="dd-item" style="grid-column:1/-1"><span class="dd-label">Description</span><span>{{ inc.description || '-' }}</span></div>
                  <div class="dd-item"><span class="dd-label">Reporting Agency</span><span>{{ inc.reporting_agency_code ?? '-' }}</span></div>
                  <div class="dd-item"><span class="dd-label">Coordinates</span><span style="font-family:monospace">{{ inc.latitude != null && inc.longitude != null ? `${inc.latitude.toFixed(4)}, ${inc.longitude.toFixed(4)}` : '-' }}</span></div>
                  <div class="dd-item"><span class="dd-label">Triaged</span><span>{{ inc.triaged_at ? fmtTime(inc.triaged_at) : '-' }}</span></div>
                  <div class="dd-item"><span class="dd-label">Resolved</span><span>{{ inc.resolved_at ? fmtTime(inc.resolved_at) : '-' }}</span></div>
                  <div class="dd-item"><span class="dd-label">Verified By</span><span>{{ inc.is_verified ? (inc.verified_by_email ?? '-') : '-' }}</span></div>
                  <div v-if="hasMinRole('operator')" class="dd-item">
                    <span class="dd-label">Verification</span>
                    <button
                      class="btn btn-sm"
                      :disabled="acting === inc.id"
                      @click.stop="inc.is_verified ? doUnverify(inc.id) : doVerify(inc.id)"
                    >{{ inc.is_verified ? 'Remove verification' : 'Verify' }}</button>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="12" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading…' : 'No incidents found' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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
            <BadgePill v-if="inc.is_verified" variant="success">VERIFIED</BadgePill>
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
            <button
              v-if="hasMinRole('operator')"
              class="btn btn-sm"
              :disabled="acting === inc.id"
              @click="inc.is_verified ? doUnverify(inc.id) : doVerify(inc.id)"
            >{{ inc.is_verified ? 'Unverify' : 'Verify' }}</button>
            <button class="link-btn" @click="openReporters(inc)">{{ inc.reporter_count }} reporter{{ inc.reporter_count === 1 ? '' : 's' }}</button>
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

  <AppModal
    v-model="reportersModalOpen"
    title="Reporters"
    :subtitle="reportersFor ? `${reportersFor.reference_code} · ${reportersFor.incident_type.replace(/_/g,' ')}` : ''"
  >
    <div v-if="reportersLoading" style="color:#94a3b8;font-size:13px;padding:8px 0">Loading…</div>
    <div v-else-if="reporters.length === 0" style="color:#94a3b8;font-size:13px;padding:8px 0">
      No individual reports found for this incident.
    </div>
    <div v-else class="reporters-list">
      <div v-for="r in reporters" :key="r.id" class="reporter-item">
        <div class="reporter-item-head">
          <span class="reporter-email">{{ r.reported_by_email ?? 'Unknown reporter' }}</span>
          <BadgePill :variant="sevBadge(r.severity)">{{ r.severity }}</BadgePill>
        </div>
        <div class="reporter-title">{{ r.title || '(no title)' }}</div>
        <div v-if="r.description" class="reporter-desc">{{ r.description }}</div>
        <div class="reporter-meta">
          {{ r.reference_code }} · {{ fmtTime(r.created_at) }}
          <span v-if="r.latitude != null && r.longitude != null"> · {{ r.latitude.toFixed(4) }}, {{ r.longitude.toFixed(4) }}</span>
        </div>
      </div>
    </div>
  </AppModal>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Incident Command')

import { useSafety, useGis } from '~/composables/api'
import type { SafetySummary, Incident, EmergencyDispatch } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'
// Imported from the module directly (not the `~/composables/api` barrel,
// which re-exports Incident as `SafetyIncident` — pulling IncidentReport
// the same way would hit the same alias, so this sidesteps it).
import type { IncidentReport } from '~/composables/api/useSafety'

const { hasMinRole } = usePermissions()

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
const verifiedFilter = ref('')
const incidentSearch = ref('')
const expanded       = ref<string | null>(null)
const successMsg     = ref<string | null>(null)
let successTimeout: ReturnType<typeof setTimeout> | null = null

/** Brief self-clearing confirmation banner — same spirit as roles.vue's flash(). */
function flash(msg: string) {
  successMsg.value = msg
  if (successTimeout) clearTimeout(successTimeout)
  successTimeout = setTimeout(() => { successMsg.value = null }, 4000)
}

// ── Reporters drilldown ───────────────────────────────────────────────
const reportersModalOpen = ref(false)
const reportersLoading   = ref(false)
const reporters          = ref<IncidentReport[]>([])
const reportersFor       = ref<Incident | null>(null)

async function openReporters(inc: Incident) {
  reportersFor.value = inc
  reportersModalOpen.value = true
  reportersLoading.value = true
  reporters.value = []
  try {
    reporters.value = await useSafety().incidentReporters(inc.id)
  } catch (e: any) {
    error.value = e?.data?.detail ?? e?.message ?? 'Failed to load reporters.'
  } finally {
    reportersLoading.value = false
  }
}

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
      ...(verifiedFilter.value ? { verified: verifiedFilter.value } : {}),
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
  try { await useSafety().triageIncident(id); await load(); flash('Incident triaged.') }
  catch (e: any) { error.value = e?.data?.detail ?? e?.message ?? 'Failed to triage incident.' }
  finally { acting.value = null }
}
async function doDispatch(id: string) {
  acting.value = id
  try { await useSafety().dispatchIncident(id); await load(); flash('Response dispatched.') }
  catch (e: any) { error.value = e?.data?.detail ?? e?.message ?? 'Failed to dispatch incident.' }
  finally { acting.value = null }
}
async function doResolve(id: string) {
  acting.value = id
  try { await useSafety().resolveIncident(id); await load(); flash('Incident resolved.') }
  catch (e: any) { error.value = e?.data?.detail ?? e?.message ?? 'Failed to resolve incident.' }
  finally { acting.value = null }
}
async function doClose(id: string) {
  acting.value = id
  try { await useSafety().closeIncident(id); await load(); flash('Incident closed.') }
  catch (e: any) { error.value = e?.data?.detail ?? e?.message ?? 'Failed to close incident.' }
  finally { acting.value = null }
}
async function doVerify(id: string) {
  acting.value = id
  try { await useSafety().verifyIncident(id); await load(); flash('Incident verified.') }
  catch (e: any) { error.value = e?.data?.detail ?? e?.message ?? 'Failed to verify incident.' }
  finally { acting.value = null }
}
async function doUnverify(id: string) {
  acting.value = id
  try { await useSafety().unverifyIncident(id); await load(); flash('Verification removed.') }
  catch (e: any) { error.value = e?.data?.detail ?? e?.message ?? 'Failed to unverify incident.' }
  finally { acting.value = null }
}

// ── Computed ───────────────────────────────────────────────────────────
const activeIncidents = computed(() =>
  incidents.value.filter(i => !['resolved','closed','cancelled'].includes(i.status)),
)

const filteredIncidents = computed(() => incidents.value.filter(i => {
  if (incidentSearch.value) {
    const q = incidentSearch.value.toLowerCase()
    if (!i.reference_code.toLowerCase().includes(q) && !i.title.toLowerCase().includes(q)) return false
  }
  return true
}))
const incidentExportColumns = [
  { key: 'reference_code', label: 'Reference' },
  { key: 'incident_type', label: 'Type' },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'casualties', label: 'Casualties' },
  { key: 'vehicles_involved', label: 'Vehicles' },
  { key: 'reporting_channel', label: 'Channel' },
  { key: 'reported_at', label: 'Reported' },
  { key: 'dispatch_count', label: 'Dispatches' },
]

const incidentMarkers = computed((): MarkerSpec[] =>
  incidents.value
    .filter(i => i.latitude && i.longitude)
    .map(i => ({
      id: `inc-${i.id}`,
      lat: i.latitude!,
      lon: i.longitude!,
      title: i.title,
      subtitle: `${i.severity} · ${i.status}`,
      color: i.severity === 'fatal' ? 'red'
           : i.severity === 'serious' ? 'orange'
           : 'blue',
      size: i.severity === 'fatal' ? 'lg' : i.severity === 'serious' ? 'md' : 'sm',
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
  const m: Record<string,string> = { fatal:'danger', serious:'warning', minor:'info' }
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
.success-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#f0fdf4; border:1px solid #86efac; color:#15803d; font-size:13px; }
.link-btn { background:none; border:none; padding:0; color:#2563eb; font-size:12px; cursor:pointer; text-decoration:underline; }
.link-btn:hover { color:#1d4ed8; }
.reporters-list { display:flex; flex-direction:column; gap:12px; }
.reporter-item { padding:10px 12px; border:1px solid #e5e7eb; border-radius:8px; }
.reporter-item-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; }
.reporter-email { font-size:12.5px; font-weight:600; color:#111827; }
.reporter-title { font-size:13px; font-weight:600; margin-bottom:2px; }
.reporter-desc { font-size:12.5px; color:#4b5563; margin-bottom:6px; }
.reporter-meta { font-size:11px; color:#94a3b8; font-family:monospace; }
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
.expand-row { cursor:pointer; }
.expand-cell { width:18px; color:#94a3b8; font-size:11px; }
.detail-row td { background:#fafbfc; padding:14px 18px; border-bottom:1px solid #f1f5f9; }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; }
</style>
