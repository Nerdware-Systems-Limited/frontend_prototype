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
      sub="NTSA iTIMS national registry"
      source="batch" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="Live GPS-Tracked"
      :value="summary ? fmtNum(summary.kpis.live_vehicles) : '-'"
      sub="Active PSVs with signal"
      trend-direction="up"
      source="live" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="Trips (7d)"
      :value="summary ? fmtNum(summary.kpis.trips_7d) : '-'"
      sub="PSV trips recorded this week"
      trend-direction="up"
      source="live" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="Distance (7d)"
      :value="summary ? `${fmtNum(summary.kpis.distance_7d_km)} km` : '-'"
      sub="Total network kilometres"
      source="live" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="Critical Events (24h)"
      :value="summary ? fmtNum(summary.behaviour_critical_24h) : '-'"
      sub="Speeding · harsh brake · deviation"
      trend-direction="down"
      source="live" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="Governor Compliance"
      :value="summary ? fmtPct(summary.governor_compliance.online_pct) : '-'"
      :sub="`Tamper rate: ${summary ? fmtPct(summary.governor_compliance.tamper_rate_pct) : '-'}`"
      :trend-direction="summary && summary.governor_compliance.tamper_rate_pct < 5 ? 'up' : 'down'"
      source="live" source-title="NTSA iTIMS"
    />
  </div>

  <!-- Governor compliance + vehicle types side by side -->
  <div class="two-col">
    <!-- Governor compliance bar -->
    <div class="card">
      <div class="card-header">Speed Governor Status</div>
      <div class="card-body">
        <div v-if="summary">
          <div class="gov-row">
            <span>Online / Compliant</span>
            <div class="gov-bar-wrap">
              <div class="gov-bar" style="background:#22c55e" :style="{ width: `${summary.governor_compliance.online_pct}%` }" />
            </div>
            <strong>{{ fmtPct(summary.governor_compliance.online_pct) }}</strong>
          </div>
          <div class="gov-row">
            <span>Tampered / Fault</span>
            <div class="gov-bar-wrap">
              <div class="gov-bar" style="background:#ef4444" :style="{ width: `${summary.governor_compliance.tamper_rate_pct}%` }" />
            </div>
            <strong style="color:#ef4444">{{ fmtPct(summary.governor_compliance.tamper_rate_pct) }}</strong>
          </div>

          <div v-if="governorDetail" class="gov-detail">
            <div class="gov-detail-row">
              <span>Online</span><strong>{{ fmtNum(governorDetail.online) }}</strong>
            </div>
            <div class="gov-detail-row">
              <span>Tampered</span><strong style="color:#ef4444">{{ fmtNum(governorDetail.tampered) }}</strong>
            </div>
            <div class="gov-detail-row">
              <span>Fault</span><strong style="color:#f59e0b">{{ fmtNum(governorDetail.fault) }}</strong>
            </div>
            <div class="gov-detail-row">
              <span>Offline</span><strong style="color:#94a3b8">{{ fmtNum(governorDetail.offline) }}</strong>
            </div>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>

    <!-- Vehicle type breakdown -->
    <div class="card">
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
                  width: `${maxType > 0 ? (t.total / maxType) * 100 : 0}%`,
                }"
              />
            </div>
            <strong class="type-count">{{ fmtNum(t.total) }}</strong>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No type data' }}</div>
      </div>
    </div>
  </div>

  <!-- Recent critical behaviour events -->
  <SectionTitle pill="NTSA iTIMS · Live">Critical Driver Behaviour Events (24h)</SectionTitle>

  <div class="card">
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
          <tr v-for="ev in criticalEvents.slice(0, 8)" :key="ev.id">
            <td style="font-weight:600">{{ ev.plate_number }}</td>
            <td><BadgePill variant="warning">{{ ev.event_type.replace(/_/g,' ') }}</BadgePill></td>
            <td><BadgePill :variant="sevBadge(ev.severity)">{{ ev.severity }}</BadgePill></td>
            <td>{{ ev.speed_kmh ?? '-' }}</td>
            <td style="white-space:nowrap;font-size:12px">{{ fmtTime(ev.detected_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading…' : 'No critical behaviour events in the last 24h' }}
            </td>
          </tr>
        </tbody>
      </table>
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
          <tr v-for="(u, i) in utilization.slice(0, 8)" :key="u.id">
            <td style="font-weight:700;color:#94a3b8">#{{ i + 1 }}</td>
            <td style="font-weight:600">{{ u.plate_number }}</td>
            <td>{{ u.operator_name ?? '-' }}</td>
            <td>
              <div class="util-bar-wrap">
                <div class="util-bar" :style="{ width: `${u.utilization_pct ?? 0}%`, background: utilColor(u.utilization_pct) }" />
              </div>
              <span style="font-size:12px">{{ u.utilization_pct != null ? fmtPct(u.utilization_pct) : '-' }}</span>
            </td>
            <td>{{ fmtNum(u.trips_count) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading…' : 'No utilization data available' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Fleet Overview')

import { useFleet } from '~/composables/api'
import type { FleetSummary, DriverBehaviorEvent, FleetUtilization } from '~/composables/api'

const summary       = ref<FleetSummary | null>(null)
const criticalEvents = ref<DriverBehaviorEvent[]>([])
const utilization   = ref<FleetUtilization[]>([])
const governorDetail = ref<any>(null)
const loading       = ref(true)
const error         = ref<string | null>(null)
const lastRefreshed = ref('-')

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
function sevBadge(s: string) {
  const m: Record<string,string> = { critical:'danger', high:'warning', medium:'fair', low:'success' }
  return m[s] ?? 'neutral'
}
function utilColor(pct: number | null | undefined) {
  if (pct == null) return '#94a3b8'
  return pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.link-sm { font-size:12px; color:#3b82f6; text-decoration:none; font-weight:600; }
.link-sm:hover { text-decoration:underline; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:900px){ .two-col { grid-template-columns:1fr; } }
.gov-row { display:grid; grid-template-columns:160px 1fr 70px; align-items:center; gap:10px; margin-bottom:10px; font-size:13px; }
.gov-bar-wrap { background:#f1f5f9; border-radius:4px; height:12px; overflow:hidden; }
.gov-bar { height:100%; border-radius:4px; transition:width .4s; }
.gov-detail { margin-top:16px; border-top:1px solid #f1f5f9; padding-top:12px; display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.gov-detail-row { display:flex; justify-content:space-between; font-size:12px; }
.type-list { display:flex; flex-direction:column; gap:8px; }
.type-row { display:grid; grid-template-columns:140px 1fr 60px; align-items:center; gap:8px; }
.type-label { font-size:12px; text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.type-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.type-bar { height:100%; background:#3b82f6; border-radius:4px; transition:width .4s; }
.type-count { font-size:12px; text-align:right; }
.util-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.util-bar { height:100%; border-radius:4px; transition:width .4s; }
</style>
