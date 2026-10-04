<template>
  <PageHeader
    eyebrow="Maritime - Accidents &amp; Safety"
    title="Maritime Accidents & Safety"
    subtitle="KMA - Tracked using the same framework as the UAPTS Road Safety Module: location, incident classification, severity, investigation status, and marine pollution"
  >
    <template #actions>
      <NuxtLink to="/safety" class="btn">Road Safety Module →</NuxtLink>
      <NuxtLink to="/maritime" class="btn">Vessel Movements →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs (live) -->
  <div class="kpi-grid">
    <KpiCard
      label="Incidents (90d)"
      :value="stats ? fmtNum(stats.total_incidents) : '-'"
      :unavailable="!stats"
      :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="90D"
      description="All severities"
      to="#incident-log"
    />
    <KpiCard
      label="Fatal Incidents"
      :value="stats ? fmtNum(stats.fatal_incidents) : '-'"
      :unavailable="!stats"
      :unavailable-note="loading ? 'Loading…' : 'KMA Investigation Dept feed unavailable'"
      period="90D"
      description="Loss of life recorded"
      :status="!stats ? undefined : stats.fatal_incidents === 0 ? 'healthy' : 'critical'"
      to="#incident-log"
    />
    <KpiCard
      label="Casualties"
      :value="stats ? fmtNum(stats.casualties) : '-'"
      :unavailable="!stats"
      :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="90D"
      description="Total across incidents"
      to="#incident-log"
    />
    <KpiCard
      label="Pollution (tonnes)"
      :value="stats ? fmtNum(stats.pollution_tons) : '-'"
      :unavailable="!stats"
      :unavailable-note="loading ? 'Loading…' : 'NEMA / KMA feed unavailable'"
      period="90D"
      description="Oil/fuel spilled, 90d"
    />
  </div>

  <!-- Incident map -->
  <SectionTitle pill="KMA · Live">Incident Locations</SectionTitle>
  <div class="card map-card">
    <ClientOnly>
      <UaptsMap :markers="incidentMarkers" :center="[-3.5, 40.0]" :zoom="6" height="380px" show-legend />
    </ClientOnly>
    <EmptyState v-if="!incidentMarkers.length" :loading="loading" message="No incident could be matched to a known port position." compact />
  </div>

  <!-- Incident log -->
  <SectionTitle pill="KMA · Live">Incident Log</SectionTitle>
  <div id="incident-log" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="severityFilter" class="select-sm">
          <option value="">All severities</option>
          <option value="fatal">Fatal</option>
          <option value="serious">Serious</option>
          <option value="minor">Minor</option>
          <option value="none">None</option>
        </select>
        <button class="btn" @click="severityFilter=''">Clear</button>
        <ExportButton filename="uapts-maritime-incidents.csv" :rows="filteredIncidents" :columns="incidentExportColumns" style="margin-left:auto" />
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th></th><th>Reference</th><th>Port</th><th>Incident Type</th><th>Vessel</th><th>Severity</th><th>Status</th><th>Casualties</th><th>Pollution</th></tr>
          </thead>
          <tbody v-if="filteredIncidents.length">
            <template v-for="inc in incidentsPageRows" :key="inc.id">
              <tr class="expand-row" @click="expanded = expanded === inc.id ? null : inc.id">
                <td class="expand-cell">{{ expanded === inc.id ? '▾' : '▸' }}</td>
                <td style="font-family:monospace;font-size:12px">{{ inc.incident_ref || '-' }}</td>
                <td style="font-size:12px">{{ portLabel(inc.port_unlocode) }}</td>
                <td><BadgePill variant="info">{{ (inc.incident_type ?? '-').toString().replace(/_/g,' ') }}</BadgePill></td>
                <td style="font-size:12px">{{ inc.vessel_name ?? '-' }}</td>
                <td><BadgePill :variant="severityBadge(inc.severity)">{{ inc.severity ?? '-' }}</BadgePill></td>
                <td><BadgePill :variant="statusBadge(inc.status)">{{ (inc.status ?? '-').replace(/_/g,' ') }}</BadgePill></td>
                <td>{{ inc.casualties ?? 0 }}</td>
                <td style="font-size:12px">{{ inc.pollution_tons > 0 ? `${inc.pollution_tons}t` : '-' }}</td>
              </tr>
              <tr v-if="expanded === inc.id" class="detail-row">
                <td :colspan="9">
                  <div class="drilldown">
                    <div class="dd-item"><span class="dd-label">Occurred At</span><span>{{ fmtDate(inc.occurred_at) }}</span></div>
                    <div class="dd-item"><span class="dd-label">Port</span><span>{{ portLabel(inc.port_unlocode) }} ({{ inc.port_unlocode }})</span></div>
                    <div class="dd-item"><span class="dd-label">Reporting Agency</span><span>{{ inc.agency_code ?? '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Description</span><span>{{ inc.description || '-' }}</span></div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
          <tbody v-else><tr><td colspan="9" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No maritime incidents match the current filters.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="incidentsPage" :total-pages="incidentsTotalPages" :total="incidentsTotal"
          @prev="incidentsPrev" @next="incidentsNext"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useAviationMaritime } from '~/composables/api'
import type { Port } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

// Real GET /aviation-maritime/maritime/maritime-incidents/ response shape,
// confirmed live - see MissingApis.md §2.2. No lat/long or vessels-array
// on this endpoint: one vessel per incident, and position is resolved via
// the ports() catalog below rather than a per-incident coordinate.
interface MaritimeIncident {
  id: string
  incident_ref: string
  incident_type: string
  severity: 'fatal' | 'serious' | 'minor' | 'none' | string
  vessel: string
  vessel_name: string
  port: string
  port_unlocode: string
  occurred_at: string
  description: string
  casualties: number
  pollution_tons: number
  status: string
  reported_by_agency: string | null
  agency_code: string | null
  created_at: string
  updated_at: string
}

const stats      = ref<{ total_incidents: number; fatal_incidents: number; casualties: number; pollution_tons: number } | null>(null)
const incidents  = ref<MaritimeIncident[]>([])
const ports      = ref<Port[]>([])
const loading    = ref(true)
const error      = ref<string | null>(null)
const severityFilter = ref('')
const expanded   = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()

  const [statsRes, incRes, portsRes] = await Promise.allSettled([
    avm.maritimeIncidentStats(90),
    avm.maritimeIncidents({ days: 90, page_size: 100 } as any),
    avm.ports(),
  ])

  if (statsRes.status === 'fulfilled') stats.value = statsRes.value
  if (incRes.status   === 'fulfilled') incidents.value = (incRes.value as any).results ?? []
  if (portsRes.status === 'fulfilled') ports.value = (portsRes.value as any).results ?? []

  if ([statsRes, incRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime Incidents API.'

  loading.value = false
}

onMounted(load)

const portByUnlocode = computed(() => new Map(ports.value.map(p => [p.unlocode, p])))
function portLabel(unlocode: string) {
  return portByUnlocode.value.get(unlocode)?.name ?? unlocode ?? '-'
}

const filteredIncidents = computed(() => incidents.value.filter(i => !severityFilter.value || i.severity === severityFilter.value))

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: incidentsPageRows, page: incidentsPage, totalPages: incidentsTotalPages,
  total: incidentsTotal, next: incidentsNext, prev: incidentsPrev,
} = usePagination(filteredIncidents, 15)

const incidentExportColumns = [
  { key: 'incident_ref', label: 'Reference' },
  { key: 'incident_type', label: 'Incident Type' },
  { key: 'port_unlocode', label: 'Port' },
  { key: 'vessel_name', label: 'Vessel' },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'casualties', label: 'Casualties' },
  { key: 'pollution_tons', label: 'Pollution (t)' },
  { key: 'occurred_at', label: 'Occurred At' },
]

const incidentMarkers = computed((): MarkerSpec[] => {
  const byPort = new Map<string, MaritimeIncident[]>()
  for (const inc of incidents.value) {
    if (!byPort.has(inc.port_unlocode)) byPort.set(inc.port_unlocode, [])
    byPort.get(inc.port_unlocode)!.push(inc)
  }
  const markers: MarkerSpec[] = []
  for (const [unlocode, list] of byPort) {
    const port = portByUnlocode.value.get(unlocode)
    if (!port || port.latitude == null || port.longitude == null) continue
    const worst = list.reduce((w, i) => severityRank(i.severity) > severityRank(w.severity) ? i : w, list[0]!)
    markers.push({
      id: `port-incidents-${unlocode}`,
      lat: port.latitude, lon: port.longitude,
      title: `${port.name} - ${list.length} incident${list.length !== 1 ? 's' : ''}`,
      subtitle: `Most severe: ${worst.severity} · ${worst.incident_type.replace(/_/g, ' ')}`,
      color: severityColor(worst.severity),
      size: 'md',
    })
  }
  return markers
})

function severityRank(s: string) {
  const m: Record<string, number> = { fatal: 3, serious: 2, minor: 1, none: 0 }
  return m[s] ?? 0
}
function severityColor(s: string): MarkerSpec['color'] {
  const m: Record<string, MarkerSpec['color']> = { fatal: 'red', serious: 'orange', minor: 'yellow', none: 'gray' }
  return m[s] ?? 'gray'
}
function severityBadge(s: string | undefined) {
  const m: Record<string,string> = { fatal:'danger', serious:'warning', minor:'neutral', none:'success' }
  return s ? (m[s] ?? 'neutral') : 'neutral'
}
function statusBadge(s: string | undefined) {
  const m: Record<string,string> = { investigating:'warning', open:'warning', resolved:'success', closed:'success' }
  return s ? (m[s] ?? 'neutral') : 'neutral'
}
function fmtDate(s: string | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleString('en-KE', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) }
  catch { return s }
}
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.map-card { overflow:hidden; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.table-scroll { overflow-x:auto; }
.expand-row { cursor:pointer; }
.expand-cell { width:18px; color:var(--fg-3); font-size:11px; }
.detail-row td { background:var(--surface-1); padding:14px 18px; border-bottom:1px solid var(--border-subtle); }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--fg-3); }
</style>
