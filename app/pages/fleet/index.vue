<template>
  <PageHeader
    eyebrow="Fleet & Vehicle Tracking"
    title="Fleet Overview"
    subtitle="NTSA · KMD - Fleet utilization, speed governor compliance, KMD weather-correlated driver behaviour events, and operator leaderboard"
  >
    <template #actions>
      
      <!-- <button class="btn" :disabled="loading" @click="load">↻ Refresh</button> -->
      <NuxtLink to="/fleet/live" class="btn-primary">Live Map →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI ribbon -->
  <SectionTitle :pill="summary ? 'NTSA iTIMS / iTIMS · ' + freshnessLabel(summary.generated_at) : ''">
    Fleet KPIs
  </SectionTitle>

  <div class="kpi-grid">
    <KpiCard
      label="Total Registered"
      :value="summary ? fmtNum(summary.kpis.total_vehicles) : '-'"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE" description="NTSA iTIMS national registry"
      to="#fleet-composition"
    />
    <KpiCard
      label="Live GPS-Tracked"
      :value="summary ? fmtNum(summary.kpis.live_vehicles) : '-'"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE" description="Active PSVs with signal"
    />
    <KpiCard
      label="Trips (7d)"
      :value="summary ? fmtNum(summary.kpis.trips_7d) : '-'"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="7D" description="PSV trips recorded this week"
    />
    <KpiCard
      label="Distance (7d)"
      :value="summary ? `${fmtNum(summary.kpis.distance_7d_km)} km` : '-'"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="7D" description="Total network kilometres"
    />
    <KpiCard
      label="Critical Events (24h)"
      :value="summary ? fmtNum(summary.behaviour_critical_24h) : '-'"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="24H" description="Speeding · harsh brake · deviation"
      to="#critical-events"
    />
    <KpiCard
      label="Governor Compliance"
      :value="governorDetail ? fmtPct(governorDetail.online_pct) : '-'"
      :unavailable="!governorDetail" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE"
      :description="`Tamper rate: ${governorDetail ? fmtPct(governorDetail.tamper_rate_pct) : '-'}`"
      :status="!governorDetail ? undefined : governorDetail.tamper_rate_pct < 5 ? 'healthy' : 'warning'"
      to="#governor-status"
    />
  </div>

  <!-- Governor compliance + vehicle types side by side -->
  <div class="two-col">
    <!-- Governor compliance bar -->
    <div id="governor-status" class="card drill-target">
      <div class="card-header">Speed Governor Status</div>
      <div class="card-body">
        <div v-if="governorDetail">
          <div class="gov-stack" role="img" :aria-label="governorSegments.map(s => `${s.label} ${fmtPct(s.pct)}`).join(', ')">
            <span
              v-for="s in governorSegments" :key="s.key"
              class="gov-stack-seg"
              :style="{ width: `${s.pct}%`, background: `var(${s.statusVar})` }"
            />
          </div>
          <div class="gov-legend">
            <div v-for="s in governorSegments" :key="`legend-${s.key}`" class="gov-legend-row">
              <span class="gov-legend-dot" :style="{ background: `var(${s.statusVar})` }" />
              <span class="gov-legend-label">{{ s.label }}</span>
              <strong class="gov-legend-count">{{ fmtNum(s.count) }}</strong>
              <span class="gov-legend-pct">{{ fmtPct(s.pct) }}</span>
            </div>
          </div>
          <p class="gov-total">{{ fmtNum(governorDetail.total_tracked_vehicles) }} tracked vehicles</p>
        </div>
        <EmptyState v-else :loading="loading" message="No data" compact />
      </div>
    </div>

    <!-- Vehicle type breakdown -->
    <div id="fleet-composition" class="card drill-target">
      <div class="card-header">Fleet Composition</div>
      <div class="card-body">
        <div v-if="summary?.vehicles_by_type?.length" class="type-list">
          <div
            v-for="t in summary.vehicles_by_type"
            :key="t.vehicle_type"
            class="type-row"
          >
            <span class="type-label">{{ t.vehicle_type.replace(/_/g, ' ') }}</span>
            <div class="type-bar-wrap">
              <div
                class="type-bar"
                :style="{
                  transform: `scaleX(${maxType > 0 ? t.total / maxType : 0})`,
                }"
              />
            </div>
            <strong class="type-count">{{ fmtNum(t.total) }}</strong>
          </div>
        </div>
        <EmptyState v-else :loading="loading" message="No type data" compact />
      </div>
    </div>
  </div>

  <!-- Recent critical behaviour events -->
  <SectionTitle pill="NTSA iTIMS · Live">Critical Driver Behaviour Events (24h)</SectionTitle>

  <div id="critical-events" class="card drill-target">
    <div class="card-header">
      Latest Events
      <NuxtLink to="/fleet/behaviour" class="link-sm">Full event log →</NuxtLink>
    </div>
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Plate</th>
            <th>Event Type</th>
            <th>Severity</th>
            <th>Speed (km/h)</th>
            <th>Detected</th>
          </tr>
        </thead>
        <tbody v-if="criticalEvents.length">
          <tr v-for="ev in eventsPageRows" :key="ev.id">
            <td style="font-weight:600">{{ ev.plate_number }}</td>
            <td><BadgePill variant="warning">{{ ev.event_type.replace(/_/g,' ') }}</BadgePill></td>
            <td><BadgePill :variant="sevBadge(ev.severity)">{{ ev.severity }}</BadgePill></td>
            <td>{{ ev.speed_kmh != null ? ev.speed_kmh.toFixed(1) : '-' }}</td>
            <td style="white-space:nowrap;font-size:12px">{{ fmtTime(ev.detected_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="5" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading…' : 'No critical behaviour events in the last 24h' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="eventsPage" :total-pages="eventsTotalPages" :total="eventsTotal"
        @prev="eventsPrev" @next="eventsNext"
      />
    </div>
  </div>

  <!-- Utilization leaderboard -->
  <SectionTitle pill="NTSA iTIMS · Batch">Fleet Utilization Leaderboard</SectionTitle>

  <div class="card">
    <div class="card-header">
      Top Vehicles
      <NuxtLink to="/fleet/behaviour" class="link-sm">Full leaderboard →</NuxtLink>
    </div>
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Plate / Vehicle</th>
            <th>Operator</th>
            <th>Utilization %</th>
            <th>Trips</th>
          </tr>
        </thead>
        <tbody v-if="utilization.length">
          <tr v-for="(u, i) in utilPageRows" :key="u.id">
            <td style="font-weight:700;color:var(--fg-3)">#{{ i + 1 }}</td>
            <td style="font-weight:600">{{ u.plate_number }}</td>
            <td>{{ u.operator_name ?? '-' }}</td>
            <td>
              <div class="util-bar-wrap">
                <div class="util-bar" :style="{ transform: `scaleX(${(u.utilization_pct ?? 0) / 100})`, background: utilColor(u.utilization_pct) }" />
              </div>
              <span style="font-size:12px">{{ u.utilization_pct != null ? fmtPct(u.utilization_pct) : '-' }}</span>
            </td>
            <td>{{ fmtNum(u.trips_count) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="5" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading…' : 'No utilization data available' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="utilPage" :total-pages="utilTotalPages" :total="utilTotal"
        @prev="utilPrev" @next="utilNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useFleet } from '~/composables/api'
import type { FleetSummary, DriverBehaviorEvent, FleetUtilization, SpeedGovernorCompliance } from '~/composables/api'

const summary       = ref<FleetSummary | null>(null)
const criticalEvents = ref<DriverBehaviorEvent[]>([])
const utilization   = ref<FleetUtilization[]>([])
const governorDetail = ref<SpeedGovernorCompliance | null>(null)
const loading       = ref(true)
const error         = ref<string | null>(null)
const lastRefreshed = ref('-')

// Single stacked-bar breakdown for the Speed Governor Status card - one
// proportional segment per real status count, instead of two unrelated
// percentage bars (online_pct, tamper_rate_pct) sitting above a separate
// four-row list that repeated the same by_status counts a second time.
type GovStatusKey = 'online' | 'tampered' | 'fault' | 'offline'
const GOV_STATUS_META: Record<GovStatusKey, { label: string; statusVar: string }> = {
  online:   { label: 'Online',   statusVar: '--success' },
  tampered: { label: 'Tampered', statusVar: '--destructive' },
  fault:    { label: 'Fault',    statusVar: '--warning' },
  offline:  { label: 'Offline',  statusVar: '--border-strong' },
}
const governorSegments = computed(() => {
  const g = governorDetail.value
  if (!g) return []
  const total = g.total_tracked_vehicles || 1
  return (Object.keys(GOV_STATUS_META) as GovStatusKey[]).map(key => {
    const count = g.by_status?.[key] ?? 0
    return { key, ...GOV_STATUS_META[key], count, pct: (count / total) * 100 }
  })
})

async function load() {
  loading.value = true
  error.value = null
  const fleet = useFleet()

  const [sumRes, critRes, utilRes, govRes] = await Promise.allSettled([
    fleet.summary(),
    fleet.behaviourCritical(),
    fleet.utilization({ page_size: 20 }),
    fleet.speedGovernorCompliance(),
  ])

  if (sumRes.status  === 'fulfilled') summary.value        = sumRes.value
  if (critRes.status === 'fulfilled') criticalEvents.value = (critRes.value as any).results ?? []
  if (utilRes.status === 'fulfilled') utilization.value    = (utilRes.value as any).results ?? []
  if (govRes.status  === 'fulfilled') governorDetail.value = govRes.value

  if ([sumRes, critRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Fleet API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ────────────────────────────────────────────────────────────
const maxType = computed(() =>
  Math.max(1, ...(summary.value?.vehicles_by_type ?? []).map(t => t.total)),
)

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: eventsPageRows, page: eventsPage, totalPages: eventsTotalPages,
  total: eventsTotal, next: eventsNext, prev: eventsPrev,
} = usePagination(criticalEvents, 15)

const {
  pageRows: utilPageRows, page: utilPage, totalPages: utilTotalPages,
  total: utilTotal, next: utilNext, prev: utilPrev,
} = usePagination(utilization, 15)

// ── Helpers ─────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtPct(v: number | null | undefined) {
  if (v == null) return '-'
  return `${v.toFixed(1)}%`
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function freshnessLabel(iso: string | undefined) {
  if (!iso) return 'unknown'
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    if (mins < 2) return 'Live'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  } catch { return 'unknown' }
}
const { riskBadge: sevBadge } = useSeverityBadge()
function utilColor(pct: number | null | undefined) {
  if (pct == null) return 'var(--border-strong)'
  return pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--destructive)'
}
</script>

<style scoped>
.link-sm { font-size:12px; color:var(--link); text-decoration:none; font-weight:600; }
.link-sm:hover { text-decoration:underline; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:900px){ .two-col { grid-template-columns:1fr; } }
/* Speed Governor Status - one proportional stacked bar (all four real
   counts, always summing to the full width) plus a compact legend,
   instead of two partial percentage bars duplicated by a raw count list. */
.gov-stack { display:flex; width:100%; height:12px; border-radius:6px; overflow:hidden; background:var(--surface-sunken); }
.gov-stack-seg { display:block; height:100%; transition:width .4s; }
.gov-stack-seg:first-child { border-top-left-radius:6px; border-bottom-left-radius:6px; }
.gov-stack-seg:last-child { border-top-right-radius:6px; border-bottom-right-radius:6px; }
.gov-legend { margin-top:14px; display:grid; grid-template-columns:1fr 1fr; gap:8px 16px; }
.gov-legend-row { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--fg-2); }
.gov-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.gov-legend-label { flex:1; }
.gov-legend-count { color:var(--fg-1); font-variant-numeric:tabular-nums; }
.gov-legend-pct { font-size:11px; color:var(--fg-3); font-variant-numeric:tabular-nums; min-width:4ch; text-align:right; }
.gov-total { margin:12px 0 0; font-size:11px; color:var(--fg-3); border-top:1px solid var(--border-subtle); padding-top:10px; }
.type-list { display:flex; flex-direction:column; gap:8px; }
.type-row { display:grid; grid-template-columns:140px 1fr 60px; align-items:center; gap:8px; }
.type-label { font-size:12px; text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.type-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.type-bar { height:100%; width:100%; background:var(--primary-fill); border-radius:4px; transform-origin:left; transition:transform .4s; }
.type-count { font-size:12px; text-align:right; }
.util-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.util-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
</style>
