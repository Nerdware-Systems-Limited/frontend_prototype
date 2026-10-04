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
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'NTSA IRSMS feed unavailable'"
      period="LIVE"
      sub="Currently open"
      :status="!summary ? undefined : summary.kpis.active > 10 ? 'below' : 'monitoring'"
      to="#active-queue"
    />
    <KpiCard
      label="Incidents Today"
      :value="summary ? fmtNum(summary.kpis.total_24h) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'NTSA IRSMS feed unavailable'"
      period="24H"
      sub="All severities"
      status="monitoring"
      to="#all-incidents"
    />
    <KpiCard
      label="Fatalities (30d)"
      :value="summary ? fmtNum(summary.kpis.fatal_30d) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'NTSA IRSMS feed unavailable'"
      period="30D"
      sub="Fatal incidents this month"
      :status="!summary ? undefined : summary.kpis.fatal_30d > 20 ? 'critical' : summary.kpis.fatal_30d > 10 ? 'below' : 'monitoring'"
      to="#all-incidents"
      :filter="{ severity: 'fatal' }"
    />
    <KpiCard
      label="Active Dispatches"
      :value="summary ? fmtNum(summary.active_dispatches) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'NPS / NTSA feed unavailable'"
      period="LIVE"
      sub="Emergency units en route"
      status="monitoring"
      to="#dispatch-log"
    />
  </div>

  <!-- Incidents table with filtering -->
  <SectionTitle>All Incidents</SectionTitle>

  <div id="all-incidents" class="filter-row drill-target">
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
            <th>County</th>
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
          <template v-for="inc in incidentsPageRows" :key="inc.id">
            <tr class="expand-row" @click="expanded = expanded === inc.id ? null : inc.id">
              <td class="expand-cell">{{ expanded === inc.id ? '▾' : '▸' }}</td>
              <td>{{ countyFromCoords(inc) }}</td>
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
                  <div class="dd-item"><span class="dd-label">Reference</span><span style="font-family:monospace">{{ inc.reference_code }}</span></div>
                  <div class="dd-item"><span class="dd-label">County</span><span>{{ countyFromCoords(inc) }}</span></div>
                  <div class="dd-item"><span class="dd-label">Reporting Agency</span><span>{{ inc.reporting_agency_code ?? '-' }}</span></div>
                  <div class="dd-item"><span class="dd-label">Coordinates</span><span style="font-family:monospace">{{ inc.latitude != null && inc.longitude != null ? `${inc.latitude.toFixed(4)}, ${inc.longitude.toFixed(4)}` : '-' }}</span></div>
                  <div class="dd-item"><span class="dd-label">Triaged</span><span>{{ inc.triaged_at ? fmtTime(inc.triaged_at) : '-' }}</span></div>
                  <div class="dd-item"><span class="dd-label">Resolved</span><span>{{ inc.resolved_at ? fmtTime(inc.resolved_at) : '-' }}</span></div>
                </div>

                <div class="dd-verify">
                  <div class="dd-verify-state">
                    <span class="dd-verify-dot" :class="inc.is_verified ? 'is-on' : 'is-off'" aria-hidden="true" />
                    <span v-if="inc.is_verified">
                      Verified<template v-if="inc.verified_by_email"> by {{ inc.verified_by_email }}</template><template v-if="inc.verified_at"> &middot; {{ fmtTime(inc.verified_at) }}</template>
                    </span>
                    <span v-else>Not verified</span>
                  </div>
                  <button
                    v-if="hasMinRole('operator')"
                    type="button"
                    class="dd-verify-btn"
                    :class="{ 'is-remove': inc.is_verified }"
                    :disabled="acting === inc.id"
                    @click.stop="inc.is_verified ? doUnverify(inc.id) : doVerify(inc.id)"
                  >
                    <span v-if="acting === inc.id">Working&hellip;</span>
                    <span v-else>{{ inc.is_verified ? 'Remove verification' : 'Verify incident' }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="12" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading…' : 'No incidents found' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="incidentsPage" :total-pages="incidentsTotalPages" :total="incidentsTotal"
        @prev="incidentsPrev" @next="incidentsNext"
      />
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

    <div id="active-queue" class="card drill-target">
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
        <EmptyState v-if="activeIncidents.length === 0" :loading="loading" message="No active incidents matching current filters." icon="search" compact />
      </div>
    </div>
  </div>

  <!-- Dispatch log -->
  <SectionTitle pill="NPS / NTSA · Live">Emergency Dispatch Log</SectionTitle>

  <div id="dispatch-log" class="card drill-target">
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
          <tr v-for="d in dispatchesPageRows" :key="d.id">
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
            <td colspan="7" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading…' : 'No dispatch records found' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="dispatchesPage" :total-pages="dispatchesTotalPages" :total="dispatchesTotal"
        @prev="dispatchesPrev" @next="dispatchesNext"
      />
    </div>
  </div>

  <AppModal
    v-model="reportersModalOpen"
    title="Reporters"
    :subtitle="reportersFor ? `${reportersFor.reference_code} · ${reportersFor.incident_type.replace(/_/g,' ')}` : ''"
  >
    <EmptyState v-if="reportersLoading || reporters.length === 0" :loading="reportersLoading" message="No individual reports found for this incident." compact />
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
import { useSafety, useGis } from '~/composables/api'
import type { SafetySummary, EmergencyDispatch } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'
// Imported from the module directly (not the `~/composables/api` barrel,
// which re-exports Incident as `SafetyIncident` - pulling IncidentReport
// the same way would hit the same alias, so this sidesteps it).
import type { Incident, IncidentReport } from '~/composables/api/useSafety'

const { hasMinRole } = usePermissions()

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'purple' | 'gray'; size?: 'sm' | 'md' | 'lg' }

const summary    = ref<SafetySummary | null>(null)
const incidents  = ref<Incident[]>([])
const dispatches = ref<EmergencyDispatch[]>([])
const roadsGeo   = ref<GeoJSONFeatureCollection | null>(null)
const countyBoundary = ref<GeoJSONFeatureCollection | null>(null)
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

/** Brief self-clearing confirmation banner - same spirit as roles.vue's flash(). */
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

  const [sumRes, incRes, dispRes, roadsRes, boundaryRes] = await Promise.allSettled([
    safety.summary(),
    safety.incidents({
      page_size: 50,
      ...(severityFilter.value ? { severity: severityFilter.value } : {}),
      ...(statusFilter.value   ? { status:   statusFilter.value }   : {}),
      ...(verifiedFilter.value ? { verified: verifiedFilter.value } : {}),
    }),
    safety.dispatches({ page_size: 30 }),
    gis.roads({ limit: 300, simplify: 0.01 }),
    // 47-county polygons - used to derive the County column from an
    // incident's coordinates when the record has no `county` field.
    countyBoundary.value ? Promise.resolve(null) : gis.kenyaBoundary({ admin_level: 1 }),
  ])

  if (sumRes.status   === 'fulfilled') summary.value    = sumRes.value
  if (incRes.status   === 'fulfilled') incidents.value  = (incRes.value as any).results ?? []
  if (dispRes.status  === 'fulfilled') dispatches.value = (dispRes.value as any).results ?? []
  if (roadsRes.status === 'fulfilled') roadsGeo.value   = roadsRes.value
  if (boundaryRes.status === 'fulfilled' && boundaryRes.value) {
    countyBoundary.value = boundaryRes.value as GeoJSONFeatureCollection
    countyCache.clear()
  }

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

// Deep-link: a KPI card can arrive with ?severity=fatal (etc.) - adopt it
// into the table filter before the first load so the drill lands filtered.
const route = useRoute()
function adoptQueryFilters() {
  if (typeof route.query.severity === 'string') severityFilter.value = route.query.severity
  if (typeof route.query.status === 'string') statusFilter.value = route.query.status
  if (typeof route.query.verified === 'string') verifiedFilter.value = route.query.verified
}
adoptQueryFilters()
watch(() => route.query, () => { adoptQueryFilters(); load() })

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

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: incidentsPageRows, page: incidentsPage, totalPages: incidentsTotalPages,
  total: incidentsTotal, next: incidentsNext, prev: incidentsPrev,
} = usePagination(filteredIncidents, 15)

const {
  pageRows: dispatchesPageRows, page: dispatchesPage, totalPages: dispatchesTotalPages,
  total: dispatchesTotal, next: dispatchesNext, prev: dispatchesPrev,
} = usePagination(dispatches, 15)
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
const { incidentSeverityBadge: sevBadge, dispatchBadge } = useSeverityBadge()

// ── County from coordinates ──────────────────────────────────────────
// When an incident record carries no `county`, derive it by testing its
// lat/lon against the 47 county polygons from GET /gis/kenya/boundary/.
// Ray-casting point-in-polygon; GeoJSON rings are [lon, lat].
function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!
    const xj = ring[j]![0]!, yj = ring[j]![1]!
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function pointInPolygon(lon: number, lat: number, rings: number[][][]): boolean {
  // First ring is the outer boundary; the rest are holes.
  if (!rings.length || !pointInRing(lon, lat, rings[0]!)) return false
  for (let k = 1; k < rings.length; k++) if (pointInRing(lon, lat, rings[k]!)) return false
  return true
}

const countyCache = new Map<string, string>()

function countyFromCoords(inc: Incident): string {
  if (inc.county) return inc.county
  if (inc.latitude == null || inc.longitude == null || !countyBoundary.value) return '-'
  const cached = countyCache.get(inc.id)
  if (cached) return cached
  const lat = inc.latitude, lon = inc.longitude
  for (const f of countyBoundary.value.features ?? []) {
    const p = f.properties ?? {}
    // admin_level=1 also returns the national outline - skip anything that
    // isn't a county polygon.
    if (p.kind ? p.kind !== 'county' : (p.adm0_name != null || !(p.adm1_name || p.name))) continue
    const g = f.geometry
    if (!g) continue
    const polys: number[][][][] =
      g.type === 'Polygon' ? [g.coordinates]
      : g.type === 'MultiPolygon' ? g.coordinates
      : []
    if (polys.some(poly => pointInPolygon(lon, lat, poly))) {
      const name = String(p.adm1_name || p.name || p.county || '-')
      countyCache.set(inc.id, name)
      return name
    }
  }
  return '-'
}
</script>

<style scoped>
.success-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:var(--success-bg); border:1px solid color-mix(in srgb, var(--success-fg) 28%, transparent); color:var(--success-fg); font-size:13px; }
.link-btn { background:none; border:none; padding:0; color:var(--link); font-size:12px; cursor:pointer; text-decoration:underline; }
.link-btn:hover { color:var(--primary-dark); }
.reporters-list { display:flex; flex-direction:column; gap:12px; }
.reporter-item { padding:10px 12px; border:1px solid var(--border-subtle); border-radius:8px; }
.reporter-item-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; }
.reporter-email { font-size:12.5px; font-weight:600; color:var(--fg-1); }
.reporter-title { font-size:13px; font-weight:600; margin-bottom:2px; }
.reporter-desc { font-size:12.5px; color:var(--fg-2); margin-bottom:6px; }
.reporter-meta { font-size:11px; color:var(--fg-3); font-family:monospace; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
.two-col { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:900px) { .two-col { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.count-badge { font-size:11px; background:var(--surface-sunken); border-radius:10px; padding:1px 7px; margin-left:6px; }
.scroll-body { max-height:460px; overflow-y:auto; padding:0!important; }
/* Severity is already a badge in the header - the card itself is a flat
   tinted row (no coloured border-left slab). */
.incident-card { padding:12px 14px; border-bottom:1px solid var(--border-subtle); margin-bottom:1px; }
.incident-card.sev-fatal, .incident-card.sev-critical { background:var(--danger-bg); }
.incident-card.sev-high { background:var(--warning-bg); }
.incident-card.sev-medium { background:var(--warning-bg); }
.inc-header { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
.inc-ref { font-size:11px; font-family:monospace; color:var(--fg-2); }
.inc-time { font-size:11px; color:var(--fg-3); margin-left:auto; }
.inc-title { font-size:13px; font-weight:600; margin-bottom:3px; }
.inc-meta { font-size:12px; color:var(--fg-2); margin-bottom:6px; }
.inc-actions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.expand-row { cursor:pointer; }
.expand-cell { width:18px; color:var(--fg-3); font-size:11px; }
.detail-row td { background:var(--surface-1); padding:14px 18px; border-bottom:1px solid var(--border-subtle); }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--fg-3); }

/* Verification: its own action row, not a raw button jammed into the data grid. */
.dd-verify {
  display:flex; align-items:center; justify-content:space-between;
  gap:12px; flex-wrap:wrap;
  margin-top:14px; padding-top:12px;
  border-top:1px solid var(--border-subtle);
}
.dd-verify-state { display:inline-flex; align-items:center; gap:7px; font-size:12px; color:var(--fg-2); }
.dd-verify-dot { width:7px; height:7px; border-radius:999px; flex-shrink:0; }
.dd-verify-dot.is-on  { background:var(--success); }
.dd-verify-dot.is-off { background:var(--border-strong); }
.dd-verify-btn {
  font:inherit; font-size:12px; font-weight:600;
  padding:6px 14px; border-radius:var(--r-sm, 4px);
  cursor:pointer; white-space:nowrap;
  color:var(--success-fg);
  background:transparent;
  border:1px solid color-mix(in srgb, var(--success-fg) 45%, transparent);
  transition:background-color .15s var(--ease-standard, ease), border-color .15s var(--ease-standard, ease), color .15s var(--ease-standard, ease);
}
.dd-verify-btn:hover:not(:disabled) {
  background:var(--success-bg);
  border-color:color-mix(in srgb, var(--success-fg) 70%, transparent);
}
.dd-verify-btn.is-remove {
  color:var(--fg-2);
  border-color:var(--border-interactive);
}
.dd-verify-btn.is-remove:hover:not(:disabled) {
  color:var(--danger-fg);
  background:var(--danger-bg);
  border-color:color-mix(in srgb, var(--danger-fg) 45%, transparent);
}
.dd-verify-btn:disabled { opacity:.55; cursor:default; }
.dd-verify-btn:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }
</style>
