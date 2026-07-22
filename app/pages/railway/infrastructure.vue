<template>
  <PageHeader
    eyebrow="Railway"
    title="Rail Infrastructure"
    subtitle="KRC - Track section condition, level crossings, signalling, culverts, and the capital works pipeline"
  >
    <template #actions>
      <NuxtLink to="/railway/network-inventory" class="btn">Network Inventory →</NuxtLink>
      <NuxtLink to="/railway/safety" class="btn">Rail Safety →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Operational Track"
      :value="`${fmtNum(operationalTrackKm, 0)} km`"
      :sub="`of ${fmtNum(totalTrackKm, 0)} km total network`"
      source="live" source-title="Rail Line Registry"
    />
    <KpiCard label="Sections Needing Repair" :value="fmtNum(poorCriticalSections.length)" :sub="`of ${fmtNum(trackSections.length)} track sections`" trend-direction="down" source="live" source-title="KRC Track Registry" />
    <KpiCard label="Signal Availability" :value="signalAvailabilityPct != null ? `${signalAvailabilityPct.toFixed(1)}%` : '-'" :sub="`${fmtNum(signals.length)} signals registered`" :trend-direction="(signalAvailabilityPct ?? 0) >= 95 ? 'up' : 'down'" source="live" source-title="KRC Signalling" />
    <KpiCard label="Crossings Needing Action" :value="fmtNum(highRiskCrossings.length)" sub="High / critical risk rating" trend-direction="down" source="live" source-title="KRC Level Crossings" />
    <KpiCard label="Culverts Poor / Critical" :value="fmtNum(poorCriticalCulverts.length)" :sub="`of ${fmtNum(culverts.length)} culverts`" trend-direction="down" source="live" source-title="KRC Track Registry" />
    <KpiCard label="Open Capital Works" :value="fmtNum(openCapitalWorks.length)" :sub="`of ${fmtNum(capitalWorks.length)} projects`" source="live" source-title="KRC / National Treasury" />
    <KpiCard label="Capital Works Budget" :value="capitalWorksBudget ? `KES ${fmtKES(capitalWorksBudget)}` : '-'" sub="Sum of active project budgets" source="live" source-title="KRC / National Treasury" />
  </div>

  <!-- Track sections -->
  <SectionTitle pill="KRC Track Registry · Live">Track Sections</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="trackSearch" class="select-sm" placeholder="Search section / line…" style="min-width:180px" />
        <select v-model="conditionFilter" class="select-sm">
          <option value="">All conditions</option>
          <option value="excellent">Excellent</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
          <option value="critical">Critical</option>
        </select>
        <button class="btn" @click="trackSearch=''; conditionFilter=''">Clear</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Line</th><th>Section</th><th>Chainage (km)</th><th>Rail Type</th><th>Sleeper</th>
              <th>Condition</th><th>Posted Speed</th><th>Last Inspected</th><th>Next Inspection Due</th>
            </tr>
          </thead>
          <tbody v-if="filteredTrackSections.length">
            <tr v-for="t in filteredTrackSections" :key="t.id">
              <td style="font-weight:600;font-size:12px">{{ t.line_name ?? t.line }}</td>
              <td style="font-family:monospace;font-size:12px">{{ t.section_ref }}</td>
              <td style="font-size:12px">{{ t.chainage_start_km }} - {{ t.chainage_end_km }}</td>
              <td style="font-size:12px">{{ t.rail_type }}</td>
              <td style="font-size:12px">{{ t.sleeper_type }}</td>
              <td><BadgePill :variant="condBadge(t.track_condition)">{{ t.track_condition }}</BadgePill></td>
              <td style="font-size:12px">{{ t.posted_speed_kmh != null ? `${t.posted_speed_kmh} km/h` : '-' }}</td>
              <td style="font-size:11px">{{ fmtDate(t.last_inspected_at) }}</td>
              <td style="font-size:11px">{{ fmtDate(t.next_inspection_due) }}</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading track sections…' : 'No track sections match the current filters.' }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Level crossings -->
  <SectionTitle pill="KRC Level Crossings · Live">Level Crossings</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="crossingSearch" class="select-sm" placeholder="Search road / line…" style="min-width:180px" />
        <select v-model="riskFilter" class="select-sm">
          <option value="">All risk ratings</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button class="btn" @click="crossingSearch=''; riskFilter=''">Clear</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Crossing</th><th>Road</th><th>Line</th><th>Protection</th><th>Risk</th>
              <th>Near-Misses</th><th>Daily Road Traffic</th><th>Daily Trains</th><th>Last Incident</th><th>Active</th>
            </tr>
          </thead>
          <tbody v-if="filteredCrossings.length">
            <tr v-for="c in filteredCrossings" :key="c.id">
              <td style="font-family:monospace;font-weight:700;font-size:12px">{{ c.crossing_ref }}</td>
              <td style="font-weight:600;font-size:12px">{{ c.road_name }}</td>
              <td style="font-size:12px">{{ c.line_name ?? c.line }}</td>
              <td style="font-size:12px">{{ c.protection_type.replace(/_/g,' ') }}</td>
              <td><BadgePill :variant="riskBadge(c.risk_rating)">{{ c.risk_rating }}</BadgePill></td>
              <td>{{ fmtNum(c.near_miss_count) }}</td>
              <td>{{ c.daily_road_traffic != null ? fmtNum(c.daily_road_traffic) : '-' }}</td>
              <td>{{ c.daily_train_movements != null ? fmtNum(c.daily_train_movements) : '-' }}</td>
              <td style="font-size:11px">{{ c.last_incident_at ? fmtDate(c.last_incident_at) : '-' }}</td>
              <td><BadgePill :variant="c.is_active ? 'success' : 'neutral'">{{ c.is_active ? 'Active' : 'Inactive' }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading crossings…' : 'No level crossings match the current filters.' }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Signals + Culverts -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">Signalling</div>
      <div class="card-body">
        <table>
          <thead><tr><th>Signal</th><th>Line</th><th>Type</th><th>Status</th><th>Automatic</th></tr></thead>
          <tbody v-if="signals.length">
            <tr v-for="s in signals" :key="s.id">
              <td style="font-family:monospace;font-weight:600;font-size:12px">{{ s.signal_ref }}</td>
              <td style="font-size:12px">{{ s.line_name ?? s.line }}</td>
              <td style="font-size:12px">{{ s.signal_type.replace(/_/g,' ') }}</td>
              <td><BadgePill :variant="signalBadge(s.status)">{{ s.status.replace(/_/g,' ') }}</BadgePill></td>
              <td style="text-align:center">{{ s.is_automatic ? '✓' : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No signals registered.' }}</td></tr></tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Culverts</div>
      <div class="card-body">
        <table>
          <thead><tr><th>Culvert</th><th>Line</th><th>Type</th><th>Span (m)</th><th>Condition</th></tr></thead>
          <tbody v-if="culverts.length">
            <tr v-for="c in culverts" :key="c.id">
              <td style="font-family:monospace;font-weight:600;font-size:12px">{{ c.culvert_ref }}</td>
              <td style="font-size:12px">{{ c.line_name ?? c.line }}</td>
              <td style="font-size:12px">{{ c.culvert_type }}</td>
              <td>{{ c.span_m ?? '-' }}</td>
              <td><BadgePill :variant="condBadge(c.condition)">{{ c.condition }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No culverts registered.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Capital works -->
  <SectionTitle pill="KRC / National Treasury · Live">Capital Works Pipeline</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr><th>Project</th><th>Type</th><th>Line</th><th>Status</th><th>Budget (KES)</th><th>Spent (KES)</th><th>Progress</th><th>Funding Source</th><th>Contractor</th><th>Expected Completion</th></tr>
        </thead>
        <tbody v-if="capitalWorks.length">
          <tr v-for="c in capitalWorks" :key="c.id">
            <td style="font-weight:600;font-size:12px">{{ c.project_name }}</td>
            <td style="font-size:12px">{{ c.project_type.replace(/_/g,' ') }}</td>
            <td style="font-size:12px">{{ c.line_name ?? c.line ?? '-' }}</td>
            <td><BadgePill :variant="capitalWorkBadge(c.status)">{{ c.status.replace(/_/g,' ') }}</BadgePill></td>
            <td style="font-size:12px">{{ fmtKES(parseFloat(c.budget_kes)) }}</td>
            <td style="font-size:12px">{{ fmtKES(parseFloat(c.spent_kes)) }}</td>
            <td style="font-size:12px">{{ c.progress_pct.toFixed(0) }}%</td>
            <td style="font-size:12px">{{ c.funding_source || '-' }}</td>
            <td style="font-size:12px">{{ c.contractor || '-' }}</td>
            <td style="font-size:11px">{{ c.expected_completion ? fmtDate(c.expected_completion) : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading capital works…' : 'No capital works projects on file.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Rail Infrastructure')

import { useRailway, useRailInfrastructure } from '~/composables/api'
import type { RailLine, TrackSection, LevelCrossing, RailCapitalWork, RailCulvert, RailSignal } from '~/composables/api'

const lines         = ref<RailLine[]>([])
const trackSections = ref<TrackSection[]>([])
const crossings     = ref<LevelCrossing[]>([])
const capitalWorks  = ref<RailCapitalWork[]>([])
const culverts      = ref<RailCulvert[]>([])
const signals       = ref<RailSignal[]>([])
const loading       = ref(true)
const error         = ref<string | null>(null)

const trackSearch     = ref('')
const conditionFilter  = ref('')
const crossingSearch   = ref('')
const riskFilter       = ref('')

async function load() {
  loading.value = true
  error.value = null
  const rail = useRailway()
  const ri   = useRailInfrastructure()

  const [linesRes, trackRes, crossRes, capRes, culvRes, sigRes] = await Promise.allSettled([
    rail.lines({ page_size: 200 }),
    ri.trackSections({ page_size: 200 }),
    ri.levelCrossings({ page_size: 200 }),
    ri.capitalWorks({ page_size: 100 }),
    ri.culverts({ page_size: 200 }),
    ri.signals({ page_size: 200 }),
  ])

  if (linesRes.status === 'fulfilled') lines.value        = (linesRes.value as any).results ?? []
  if (trackRes.status === 'fulfilled') trackSections.value = (trackRes.value as any).results ?? []
  if (crossRes.status === 'fulfilled') crossings.value     = (crossRes.value as any).results ?? []
  if (capRes.status   === 'fulfilled') capitalWorks.value  = (capRes.value as any).results ?? []
  if (culvRes.status  === 'fulfilled') culverts.value      = (culvRes.value as any).results ?? []
  if (sigRes.status   === 'fulfilled') signals.value       = (sigRes.value as any).results ?? []

  if ([linesRes, trackRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Railway API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const totalTrackKm = computed(() => lines.value.reduce((s, l) => s + (l.length_km ?? 0), 0))
const operationalTrackKm = computed(() => lines.value.filter(l => l.status === 'operational').reduce((s, l) => s + (l.length_km ?? 0), 0))

const poorCriticalSections = computed(() => trackSections.value.filter(t => t.track_condition === 'poor' || t.track_condition === 'critical'))
const filteredTrackSections = computed(() => trackSections.value.filter(t => {
  if (conditionFilter.value && t.track_condition !== conditionFilter.value) return false
  if (trackSearch.value) {
    const q = trackSearch.value.toLowerCase()
    if (!t.section_ref.toLowerCase().includes(q) && !(t.line_name ?? '').toLowerCase().includes(q)) return false
  }
  return true
}))

const highRiskCrossings = computed(() => crossings.value.filter(c => c.risk_rating === 'high' || c.risk_rating === 'critical'))
const filteredCrossings = computed(() => crossings.value.filter(c => {
  if (riskFilter.value && c.risk_rating !== riskFilter.value) return false
  if (crossingSearch.value) {
    const q = crossingSearch.value.toLowerCase()
    if (!c.road_name.toLowerCase().includes(q) && !(c.line_name ?? '').toLowerCase().includes(q)) return false
  }
  return true
}))

const poorCriticalCulverts = computed(() => culverts.value.filter(c => c.condition === 'poor' || c.condition === 'critical'))

const signalAvailabilityPct = computed(() => {
  if (!signals.value.length) return null
  return (signals.value.filter(s => s.status === 'operational').length / signals.value.length) * 100
})

const openCapitalWorks = computed(() => capitalWorks.value.filter(c => c.status === 'planned' || c.status === 'in_progress'))
const capitalWorksBudget = computed(() =>
  openCapitalWorks.value.reduce((s, c) => s + (parseFloat(c.budget_kes) || 0), 0) || null,
)

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
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function condBadge(s: string) {
  const m: Record<string,string> = { excellent:'success', good:'success', fair:'fair', poor:'warning', critical:'danger' }
  return m[s] ?? 'neutral'
}
function riskBadge(s: string) {
  const m: Record<string,string> = { critical:'danger', high:'warning', medium:'fair', low:'success' }
  return m[s] ?? 'neutral'
}
function signalBadge(s: string) {
  const m: Record<string,string> = { operational:'success', faulty:'danger', maintenance:'warning', decommissioned:'neutral' }
  return m[s] ?? 'neutral'
}
function capitalWorkBadge(s: string) {
  const m: Record<string,string> = { planned:'neutral', in_progress:'info', completed:'success', suspended:'warning' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
</style>
