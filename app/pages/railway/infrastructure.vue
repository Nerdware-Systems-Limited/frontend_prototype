<template>
  <PageHeader
    eyebrow="Railway"
    title="Rail Infrastructure"
    subtitle="KRC · KeRRA · LAPSSET - Track condition, station/depot/terminal facilities, level crossings, signalling health, and capital works"
  >
    <template #actions>
      <NuxtLink to="/railway/network-inventory" class="btn">Network Inventory →</NuxtLink>
      <NuxtLink to="/railway/safety" class="btn">Rail Safety →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">
    ⚠ {{ error }} Track condition, facility health, and capital-works integration with KRC asset management is not yet live - network-length KPIs below are computed from the live line registry.
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Operational Track"
      :value="`${fmtNum(operationalTrackKm, 0)} km`"
      :sub="`of ${fmtNum(totalTrackKm, 0)} km total network`"
      source="live" source-title="Rail Line Registry"
    />
    <KpiCard label="Track Under Maintenance" :value="infra ? `${fmtNum(infra.kpis.track_km_under_maintenance)} km` : '-'" sub="KRC/asset mgmt (pending)" source="batch" source-title="KRC AMS" />
    <KpiCard label="Poor / Critical Sections" :value="infra ? fmtNum(infra.kpis.poor_critical_sections) : fmtNum(poorCriticalSections.length)" sub="Track sections needing repair" trend-direction="down" source="batch" source-title="KRC AMS" />
    <KpiCard label="Signal Availability" :value="infra ? pct(infra.kpis.signal_availability_pct) : '-'" sub="Signalling system uptime" :trend-direction="(infra?.kpis.signal_availability_pct ?? 0) >= 95 ? 'up' : 'down'" source="batch" source-title="KRC AMS" />
    <KpiCard label="Level Crossings Needing Action" :value="infra ? fmtNum(infra.kpis.level_crossings_needing_action) : fmtNum(highRiskCrossings.length)" sub="High / critical risk rating" trend-direction="down" source="batch" source-title="KRC Safety" />
    <KpiCard label="Station Facility Uptime" :value="infra ? pct(infra.kpis.station_facility_uptime_pct) : '-'" sub="Passenger-facing facilities" source="batch" source-title="KRC AMS" />
    <KpiCard label="Bridges / Culverts (Poor)" :value="infra ? fmtNum(infra.kpis.bridges_culverts_poor) : '-'" sub="Condition below standard" trend-direction="down" source="batch" source-title="KRC AMS" />
    <KpiCard label="Open Work Orders" :value="infra ? fmtNum(infra.kpis.open_work_orders) : fmtNum(openCapitalWorks.length)" sub="Infrastructure maintenance" source="batch" source-title="KRC AMS" />
    <KpiCard label="Capital Works Value" :value="capitalWorksValue ? `KES ${fmtKES(capitalWorksValue)}` : (infra ? `KES ${fmtKES(infra.kpis.capital_works_value_kes)}` : '-')" sub="Active investment pipeline" source="batch" source-title="KRC / National Treasury" />
  </div>

  <!-- Facilities -->
  <SectionTitle pill="Live registry + KRC AMS (pending)">Facilities</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="facilityTypeFilter" class="select-sm">
          <option value="">All facility types</option>
          <option value="station">Station</option>
          <option value="depot">Depot</option>
          <option value="freight_terminal">Freight Terminal</option>
          <option value="level_crossing">Level Crossing</option>
          <option value="signal">Signal</option>
          <option value="telecom">Telecom</option>
          <option value="bridge">Bridge</option>
          <option value="culvert">Culvert</option>
        </select>
        <select v-model="networkFilter" class="select-sm">
          <option value="">All networks</option>
          <option value="sgr">SGR</option>
          <option value="mgr">MGR</option>
          <option value="uganda">Uganda Railway</option>
          <option value="industrial">Industrial</option>
        </select>
        <button class="btn" @click="facilityTypeFilter=''; networkFilter=''">Clear</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Facility</th><th>Type</th><th>Network</th><th>Status</th><th>Health</th><th>Maintenance Due</th></tr></thead>
          <tbody v-if="filteredFacilities.length">
            <tr v-for="f in filteredFacilities" :key="f.id">
              <td style="font-weight:600">{{ f.name }}</td>
              <td><BadgePill variant="info">{{ f.facility_type.replace(/_/g,' ') }}</BadgePill></td>
              <td><BadgePill :variant="f.network === 'sgr' ? 'info' : 'success'">{{ f.network.toUpperCase() }}</BadgePill></td>
              <td><BadgePill :variant="facilityStatusBadge(f.status)">{{ f.status.replace(/_/g,' ') }}</BadgePill></td>
              <td>{{ f.health_score != null ? f.health_score.toFixed(0) : '-' }}</td>
              <td style="font-size:11px">{{ f.maintenance_due ? fmtDate(f.maintenance_due) : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading facilities…' : 'No facilities match the current filters.' }}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="source-note">Station and freight-terminal rows are seeded from the live rail station registry (presence only). Depot, level-crossing, signal, telecom, bridge and culvert health/status await the KRC asset-management integration.</div>
    </div>
  </div>

  <!-- Track condition -->
  <SectionTitle pill="KRC AMS · Pending Integration">Track Condition</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Network</th><th>Line / Section</th><th>Km Start</th><th>Km End</th><th>Gauge</th><th>Status</th>
            <th>Speed Restriction</th><th>Condition Score</th><th>Last Inspection</th><th>Next Inspection</th><th>Defect Type</th><th>Responsible Unit</th>
          </tr>
        </thead>
        <tbody v-if="trackSections.length">
          <tr v-for="t in trackSections" :key="t.id">
            <td><BadgePill :variant="t.network === 'sgr' ? 'info' : 'success'">{{ t.network.toUpperCase() }}</BadgePill></td>
            <td style="font-weight:600;font-size:12px">{{ t.line_name ?? t.line }} · {{ t.section_name }}</td>
            <td>{{ t.km_start }}</td>
            <td>{{ t.km_end }}</td>
            <td style="font-size:12px">{{ t.gauge }}</td>
            <td><BadgePill :variant="condBadge(t.status)">{{ t.status }}</BadgePill></td>
            <td style="font-size:12px">{{ t.speed_restriction_kmh != null ? `${t.speed_restriction_kmh} km/h` : '-' }}</td>
            <td>{{ t.condition_score != null ? t.condition_score.toFixed(0) : '-' }}</td>
            <td style="font-size:11px">{{ fmtDate(t.last_inspection) }}</td>
            <td style="font-size:11px">{{ fmtDate(t.next_inspection) }}</td>
            <td style="font-size:12px">{{ t.defect_type ?? '-' }}</td>
            <td style="font-size:12px">{{ t.responsible_unit ?? '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="12" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading track sections…' : 'Track-section survey data has not been integrated from KRC asset management yet.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Capital works -->
  <SectionTitle pill="KRC / National Treasury · Pending Integration">Capital Works &amp; Maintenance Pipeline</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr><th>Project</th><th>Network</th><th>Contractor</th><th>Scope</th><th>Physical</th><th>Financial</th><th>Dependency</th><th>Risk</th><th>Capacity Impact</th></tr>
        </thead>
        <tbody v-if="capitalWorks.length">
          <tr v-for="c in capitalWorks" :key="c.id">
            <td style="font-weight:600;font-size:12px">{{ c.project_name }}</td>
            <td><BadgePill :variant="c.network === 'sgr' ? 'info' : 'success'">{{ c.network.toUpperCase() }}</BadgePill></td>
            <td style="font-size:12px">{{ c.contractor ?? '-' }}</td>
            <td style="font-size:12px">{{ c.scope }}</td>
            <td style="font-size:12px">{{ c.physical_progress_pct != null ? `${c.physical_progress_pct.toFixed(0)}%` : '-' }}</td>
            <td style="font-size:12px">{{ c.financial_progress_pct != null ? `${c.financial_progress_pct.toFixed(0)}%` : '-' }}</td>
            <td style="font-size:12px">{{ c.dependency ?? '-' }}</td>
            <td style="font-size:12px">{{ c.risk ?? '-' }}</td>
            <td style="font-size:12px">{{ c.expected_capacity_impact ?? '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading capital works…' : 'Capital-works pipeline data has not been integrated from KRC/National Treasury yet.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Rail Infrastructure')

import { useRailway, useRailInfrastructure } from '~/composables/api'
import type { RailLine, RailStation, RailFacility, TrackSection, CapitalWork, RailInfraSummary } from '~/composables/api'

const lines         = ref<RailLine[]>([])
const stations       = ref<RailStation[]>([])
const facilitiesRaw  = ref<RailFacility[]>([])
const trackSections  = ref<TrackSection[]>([])
const capitalWorks   = ref<CapitalWork[]>([])
const infra          = ref<RailInfraSummary | null>(null)
const loading        = ref(true)
const error          = ref<string | null>(null)

const facilityTypeFilter = ref('')
const networkFilter      = ref('')

async function load() {
  loading.value = true
  error.value = null
  const rail = useRailway()
  const ri   = useRailInfrastructure()

  const [linesRes, stationsRes, facRes, trackRes, capRes, sumRes] = await Promise.allSettled([
    rail.lines({ page_size: 200 }),
    rail.stations({ page_size: 200 }),
    ri.facilities({ page_size: 200 }),
    ri.trackSections({ page_size: 200 }),
    ri.capitalWorks({ page_size: 100 }),
    ri.summary(),
  ])

  if (linesRes.status    === 'fulfilled') lines.value        = (linesRes.value as any).results ?? []
  if (stationsRes.status === 'fulfilled') stations.value     = (stationsRes.value as any).results ?? []
  if (facRes.status      === 'fulfilled') facilitiesRaw.value = (facRes.value as any).results ?? []
  if (trackRes.status    === 'fulfilled') trackSections.value = (trackRes.value as any).results ?? []
  if (capRes.status      === 'fulfilled') capitalWorks.value  = (capRes.value as any).results ?? []
  if (sumRes.status      === 'fulfilled') infra.value         = sumRes.value

  if (linesRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Railway API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Real network-length KPIs (from the live line registry) ──────────────
const totalTrackKm = computed(() => lines.value.reduce((s, l) => s + (l.length_km ?? 0), 0))
const operationalTrackKm = computed(() => lines.value.filter(l => l.status === 'operational').reduce((s, l) => s + (l.length_km ?? 0), 0))

const poorCriticalSections = computed(() => trackSections.value.filter(t => t.status === 'poor' || t.status === 'critical'))
const openCapitalWorks = computed(() => capitalWorks.value.filter(c => c.physical_progress_pct != null && c.physical_progress_pct < 100))
const capitalWorksValue = computed(() => capitalWorks.value.reduce((s, c) => s + (c.value_kes ?? 0), 0) || null)

// ── Facilities: merge real station/terminal presence with the (pending) asset registry ──
const seededFacilities = computed((): RailFacility[] => {
  const seeded: RailFacility[] = []
  for (const s of stations.value) {
    seeded.push({ id: `station-${s.id}`, facility_type: 'station', name: s.name, network: s.network, status: 'operational', health_score: null, maintenance_due: null, location: s.city ?? s.admin1_name ?? null })
    if (s.has_freight_terminal) {
      seeded.push({ id: `terminal-${s.id}`, facility_type: 'freight_terminal', name: `${s.name} Freight Terminal`, network: s.network, status: 'operational', health_score: null, maintenance_due: null, location: s.city ?? null })
    }
  }
  return [...seeded, ...facilitiesRaw.value]
})

const filteredFacilities = computed(() => seededFacilities.value.filter(f => {
  if (facilityTypeFilter.value && f.facility_type !== facilityTypeFilter.value) return false
  if (networkFilter.value && f.network !== networkFilter.value) return false
  return true
}))

// crossings are surfaced on the Rail Safety page; here we just need the count for the KPI fallback
const highRiskCrossings = ref<{ id: string }[]>([])
onMounted(async () => {
  const res = await useRailInfrastructure().levelCrossings({ page_size: 200 }).catch(() => null)
  if (res) highRiskCrossings.value = ((res as any).results ?? []).filter((c: any) => c.risk_rating === 'high' || c.risk_rating === 'critical')
})

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(n: number | null | undefined) {
  if (n == null) return '-'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}k`
  return Math.round(n).toLocaleString()
}
function pct(v: number | null | undefined) { return v == null ? '-' : `${v.toFixed(1)}%` }
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function facilityStatusBadge(s: string) {
  const m: Record<string,string> = { operational:'success', degraded:'warning', out_of_service:'danger', under_maintenance:'warning' }
  return m[s] ?? 'neutral'
}
function condBadge(s: string) {
  const m: Record<string,string> = { good:'success', fair:'fair', poor:'warning', critical:'danger' }
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
</style>
