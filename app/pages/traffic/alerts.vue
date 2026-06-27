<template>
  <PageHeader
    eyebrow="Traffic - Alerts"
    title="Traffic Alerts"
    subtitle="KeNHA · KURA · KMD · NCTTCA - Active traffic alerts, congestion events, KMD weather warnings, and NCTTCA corridor risk forecasts"
  >
    <template #actions>
      
      <BadgePill variant="danger">{{ activeAlerts.length }} Active</BadgePill>
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Active Alerts"
      :value="fmtNum(activeAlerts.length)"
      sub="Unresolved right now"
      trend-direction="down"
      source="live" source-title="KeNHA RTMS"
    />
    <KpiCard
      label="Critical"
      :value="fmtNum(bySeverity('critical'))"
      sub="Immediate action needed"
      source="live" source-title="KeNHA RTMS"
    />
    <KpiCard
      label="Warning"
      :value="fmtNum(bySeverity('warning'))"
      sub="Monitor closely"
      source="live" source-title="KeNHA RTMS"
    />
    <KpiCard
      label="Active Congestion Events"
      :value="fmtNum(congestion.length)"
      sub="Network congestion live"
      source="live" source-title="KeNHA RTMS"
    />
    <KpiCard
      label="Forecast Risk Events"
      :value="fmtNum(riskForecasts.length)"
      sub="Predicted congestion in 12h"
      source="batch" source-title="AI Model"
    />
    <KpiCard
      label="Resolved (all)"
      :value="fmtNum(alerts.filter(a => !a.is_active).length)"
      sub="Cleared alerts in log"
      source="live" source-title="KeNHA RTMS"
    />
  </div>

  <!-- Filters -->
  <div class="filter-row">
    <select v-model="sevFilter" class="select-sm">
      <option value="">All severities</option>
      <option value="critical">Critical</option>
      <option value="warning">Warning</option>
      <option value="info">Info</option>
    </select>
    <select v-model="typeFilter" class="select-sm">
      <option value="">All types</option>
      <option value="congestion">Congestion</option>
      <option value="incident">Incident</option>
      <option value="weather">Weather</option>
      <option value="road_closure">Road Closure</option>
    </select>
    <label class="checkbox-label">
      <input v-model="activeOnly" type="checkbox" />
      Active only
    </label>
    <button class="btn" @click="sevFilter=''; typeFilter=''; activeOnly=true">Reset</button>
  </div>

  <!-- Active alert cards -->
  <SectionTitle pill="KeNHA RTMS · Live">Active Alerts</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="filteredAlerts.filter(a => a.is_active).length">
        <AlertItem
          v-for="al in filteredAlerts.filter(a => a.is_active)"
          :key="al.id"
          :severity="al.severity === 'critical' ? 'critical' : al.severity === 'warning' ? 'warning' : 'info'"
          :title="al.title"
          :meta="`${al.alert_type.replace(/_/g,' ')} · Segment: ${al.segment} · Issued: ${fmtTime(al.issued_at)}`"
          ackable
          :acked="resolving === al.id"
          @ack="resolveAlert(al.id)"
        />
      </div>
      <div v-else style="color:#94a3b8;font-size:13px;padding:8px 0">
        {{ loading ? 'Loading alerts…' : 'No active alerts match the current filters.' }}
      </div>
    </div>
  </div>

  <!-- Full alert log table -->
  <SectionTitle>Alert Log</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Segment</th>
            <th>Status</th>
            <th>Issued</th>
            <th>Resolved</th>
            <th></th>
          </tr>
        </thead>
        <tbody v-if="filteredAlerts.length">
          <tr v-for="al in filteredAlerts" :key="al.id">
            <td style="font-weight:600;max-width:200px">
              <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ al.title }}</div>
              <div v-if="al.message" style="font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                {{ al.message.slice(0, 80) }}
              </div>
            </td>
            <td><BadgePill variant="info">{{ al.alert_type.replace(/_/g,' ') }}</BadgePill></td>
            <td><BadgePill :variant="sevBadge(al.severity)">{{ al.severity }}</BadgePill></td>
            <td style="font-size:12px;font-family:monospace">{{ al.segment }}</td>
            <td>
              <BadgePill :variant="al.is_active ? 'danger' : 'success'">
                {{ al.is_active ? 'Active' : 'Resolved' }}
              </BadgePill>
            </td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtTime(al.issued_at) }}</td>
            <td style="font-size:12px;white-space:nowrap">{{ al.resolved_at ? fmtTime(al.resolved_at) : '-' }}</td>
            <td>
              <button
                v-if="al.is_active"
                class="btn btn-sm"
                :disabled="resolving === al.id"
                @click="resolveAlert(al.id)"
              >
                {{ resolving === al.id ? '…' : 'Resolve' }}
              </button>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading alerts…' : 'No alerts found.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Active congestion events -->
  <SectionTitle pill="KeNHA RTMS · Live">Active Congestion Events</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Segment</th>
            <th>Severity</th>
            <th>Avg Speed (km/h)</th>
            <th>Delay (min)</th>
            <th>Impact (km)</th>
            <th>Expected Duration</th>
            <th>Started</th>
          </tr>
        </thead>
        <tbody v-if="congestion.length">
          <tr v-for="ev in congestion" :key="ev.id">
            <td>
              <div style="font-weight:600">{{ ev.segment }}</div>
              <div v-if="ev.description" style="font-size:11px;color:#94a3b8">{{ ev.description.slice(0, 60) }}</div>
            </td>
            <td><BadgePill :variant="sevBadge(ev.severity)">{{ ev.severity }}</BadgePill></td>
            <td :style="{ color: ev.avg_speed_kmh < 20 ? '#ef4444' : ev.avg_speed_kmh < 40 ? '#f59e0b' : '#22c55e', fontWeight:'600' }">
              {{ ev.avg_speed_kmh.toFixed(0) }}
            </td>
            <td style="font-weight:700">{{ ev.delay_minutes.toFixed(0) }}</td>
            <td>{{ ev.impact_radius_km.toFixed(1) }}</td>
            <td>{{ ev.expected_duration_min.toFixed(0) }} min</td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtTime(ev.started_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading…' : 'No active congestion events.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Forecast risk events -->
  <SectionTitle pill="AI Model · Next 12h">Upcoming Congestion Risk</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Segment</th>
            <th>Model</th>
            <th>Target Time</th>
            <th>Predicted Congestion</th>
            <th>Predicted Volume</th>
            <th>Predicted Speed (km/h)</th>
            <th>Horizon</th>
          </tr>
        </thead>
        <tbody v-if="riskForecasts.length">
          <tr v-for="f in riskForecasts" :key="f.id">
            <td style="font-family:monospace;font-size:12px;font-weight:600">{{ f.segment }}</td>
            <td><BadgePill variant="info">{{ f.model_name }}</BadgePill></td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtTime(f.target_at) }}</td>
            <td><BadgePill :variant="congBadge(f.predicted_congestion)">{{ f.predicted_congestion.replace(/_/g,' ') }}</BadgePill></td>
            <td>{{ fmtNum(f.predicted_volume) }}</td>
            <td>{{ f.predicted_speed_kmh.toFixed(0) }}</td>
            <td>{{ f.horizon_hours }}h</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading forecast…' : 'No congestion risk events predicted.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Traffic Alerts')

import { useTraffic } from '~/composables/api'
import type { TrafficAlert, CongestionEvent, TrafficForecast } from '~/composables/api'

const alerts      = ref<TrafficAlert[]>([])
const congestion  = ref<CongestionEvent[]>([])
const forecasts   = ref<TrafficForecast[]>([])
const loading     = ref(true)
const error       = ref<string | null>(null)
const resolving   = ref<string | null>(null)
const lastRefreshed = ref('-')
const sevFilter   = ref('')
const typeFilter  = ref('')
const activeOnly  = ref(true)

async function load() {
  loading.value = true
  error.value = null
  const traffic = useTraffic()

  const [alertRes, congRes, fcRes] = await Promise.allSettled([
    traffic.alerts({ page_size: 100 }),
    traffic.activeCongestion(),
    traffic.forecasts({ page_size: 24 }),
  ])

  if (alertRes.status === 'fulfilled') alerts.value     = (alertRes.value as any).results ?? []
  if (congRes.status  === 'fulfilled') congestion.value = (congRes.value as any).results ?? []
  if (fcRes.status    === 'fulfilled') forecasts.value  = (fcRes.value as any).results ?? []

  if ([alertRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Traffic API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

async function resolveAlert(id: string) {
  resolving.value = id
  try {
    await useTraffic().resolveAlert(id)
    await load()
  } finally {
    resolving.value = null
  }
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 60_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const activeAlerts = computed(() => alerts.value.filter(a => a.is_active))

const filteredAlerts = computed(() =>
  alerts.value.filter(a => {
    if (activeOnly.value   && !a.is_active)                              return false
    if (sevFilter.value    && a.severity   !== sevFilter.value)          return false
    if (typeFilter.value   && a.alert_type !== typeFilter.value)         return false
    return true
  }),
)

const riskForecasts = computed(() =>
  forecasts.value.filter(f =>
    f.predicted_congestion === 'heavy' || f.predicted_congestion === 'severe',
  ),
)

function bySeverity(s: string) { return activeAlerts.value.filter(a => a.severity === s).length }

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function sevBadge(s: string) {
  const m: Record<string,string> = { critical:'danger', high:'warning', warning:'warning', medium:'fair', low:'success', info:'info' }
  return m[s] ?? 'neutral'
}
function congBadge(s: string) {
  const m: Record<string,string> = { free_flow:'success', moderate:'fair', heavy:'warning', severe:'danger' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.checkbox-label { display:flex; align-items:center; gap:4px; font-size:13px; cursor:pointer; }
.btn-sm { padding:3px 10px; font-size:12px; }
</style>
