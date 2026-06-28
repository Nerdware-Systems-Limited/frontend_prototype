<template>
  <PageHeader
    eyebrow="Public Transport - Operators"
    title="Operator Performance"
    subtitle="NaMATA · NTSA · NCTTCA - SACCO ranking, service quality scores, NCTTCA corridor operator benchmarks, fleet utilization, and passenger feedback"
  >
    <!-- <template #actions>
      
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template> -->
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Operators Ranked"
      :value="fmtNum(metrics.length)"
      sub="SACCOs with performance data"
      source="batch" source-title="NTSA"
    />
    <KpiCard
      label="Avg On-Time %"
      :value="avgOnTime ? `${avgOnTime.toFixed(1)}%` : '-'"
      sub="Across all ranked operators"
      :trend-direction="avgOnTime && avgOnTime >= 80 ? 'up' : 'down'"
      source="live" source-title="NaMATA"
    />
    <KpiCard
      label="Total Trips (period)"
      :value="fmtNum(totalTrips)"
      sub="Sum across all SACCOs"
      trend-direction="up"
      source="live" source-title="NaMATA GTFS-RT"
    />
    <KpiCard
      label="Avg Fleet Utilization"
      :value="avgUtil ? `${avgUtil.toFixed(0)}%` : '-'"
      sub="Across all ranked SACCOs"
      source="live" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="Open Complaints"
      :value="fmtNum(openComplaints)"
      sub="Unresolved passenger feedback"
      trend-direction="down"
      source="live" source-title="NaMATA Feedback"
    />
    <KpiCard
      label="Service Quality Records"
      :value="fmtNum(quality.length)"
      sub="Composite scores computed"
      source="batch" source-title="NaMATA"
    />
  </div>

  <!-- Operator ranking table -->
  <SectionTitle pill="NaMATA / NTSA · Rolling">Operator Leaderboard</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="saccoSearch" class="select-sm" placeholder="Search SACCO…" style="min-width:180px" />
        <select v-model="sortKey" class="select-sm">
          <option value="rank_position">Rank</option>
          <option value="on_time_pct">On-Time %</option>
          <option value="revenue_kes">Revenue</option>
          <option value="fleet_utilization_pct">Utilization %</option>
          <option value="complaint_count">Complaints</option>
        </select>
        <button class="btn" @click="saccoSearch = ''; sortKey = 'rank_position'">Clear</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>SACCO</th>
            <th>Period</th>
            <th>Total Trips</th>
            <th>On-Time %</th>
            <th>Fleet Util %</th>
            <th>Revenue (KES)</th>
            <th>Complaints</th>
          </tr>
        </thead>
        <tbody v-if="sortedMetrics.length">
          <tr v-for="op in sortedMetrics" :key="op.id">
            <td style="font-weight:700;color:#94a3b8">#{{ op.rank_position }}</td>
            <td style="font-weight:600">{{ op.sacco_name ?? op.sacco }}</td>
            <td style="font-size:11px">{{ fmtDate(op.period_start) }} – {{ fmtDate(op.period_end) }}</td>
            <td>{{ fmtNum(op.total_trips) }}</td>
            <td>
              <div class="util-bar-wrap">
                <div class="util-bar" :style="{ width: `${op.on_time_pct}%`, background: onTimeBg(op.on_time_pct) }" />
              </div>
              <span style="font-size:11px">{{ op.on_time_pct.toFixed(1) }}%</span>
            </td>
            <td>
              <div class="util-bar-wrap">
                <div class="util-bar" :style="{ width: `${op.fleet_utilization_pct}%`, background: utilBg(op.fleet_utilization_pct) }" />
              </div>
              <span style="font-size:11px">{{ op.fleet_utilization_pct.toFixed(0) }}%</span>
            </td>
            <td style="font-size:12px">{{ fmtKES(Number(op.revenue_kes)) }}</td>
            <td>
              <span :style="{ color: op.complaint_count > 10 ? '#ef4444' : op.complaint_count > 5 ? '#f59e0b' : '#22c55e' }">
                {{ fmtNum(op.complaint_count) }}
              </span>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading metrics…' : 'No operator metrics available.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Service quality scores + feedback side by side -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">Service Quality Scores</div>
      <div class="card-body">
        <table>
          <thead>
            <tr>
              <th>SACCO / Route</th>
              <th>Composite</th>
              <th>On-Time</th>
              <th>Complaint Rate</th>
              <th>Vehicle Age</th>
              <th>Occupancy</th>
            </tr>
          </thead>
          <tbody v-if="quality.length">
            <tr v-for="q in quality" :key="q.id">
              <td style="font-weight:600;font-size:12px">{{ q.sacco_name ?? q.route_name ?? '-' }}</td>
              <td>
                <div class="util-bar-wrap">
                  <div class="util-bar" :style="{ width: `${q.composite_score}%`, background: onTimeBg(q.composite_score) }" />
                </div>
                <span style="font-size:11px">{{ q.composite_score.toFixed(0) }}</span>
              </td>
              <td style="font-size:12px">{{ q.on_time_pct.toFixed(1) }}%</td>
              <td style="font-size:12px">{{ q.complaint_rate.toFixed(2) }}</td>
              <td style="font-size:12px">{{ q.vehicle_age_score.toFixed(0) }}</td>
              <td style="font-size:12px">{{ q.occupancy_score.toFixed(0) }}</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr>
              <td colspan="6" style="text-align:center;color:#94a3b8;padding:14px">
                {{ loading ? 'Loading…' : 'No quality scores available.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Recent Passenger Feedback</div>
      <div class="scroll-body">
        <div v-for="f in feedback" :key="f.id" class="fb-item">
          <div class="fb-header">
            <BadgePill :variant="fbCatBadge(f.category)">{{ f.category.replace(/_/g,' ') }}</BadgePill>
            <span class="fb-rating">{{ f.rating }}★</span>
          </div>
          <div class="fb-route">{{ f.route_name ?? '-' }} · {{ f.sacco_name ?? '-' }}</div>
          <div class="fb-text">{{ f.text || '(no comment)' }}</div>
          <div class="fb-meta">
            <BadgePill :variant="fbStatusBadge(f.status)">{{ f.status }}</BadgePill>
            <span style="font-size:11px;color:#94a3b8">{{ fmtTime(f.submitted_at) }}</span>
          </div>
        </div>
        <div v-if="!loading && !feedback.length" style="color:#94a3b8;font-size:13px;padding:12px">
          No recent feedback.
        </div>
      </div>
    </div>
  </div>

  <!-- Demand forecasts -->
  <SectionTitle pill="AI Model · NaMATA">Demand Forecasts (Next 24h)</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Route</th>
            <th>Target Time</th>
            <th>Predicted Pax</th>
            <th>Range</th>
            <th>Model</th>
            <th>Horizon (h)</th>
          </tr>
        </thead>
        <tbody v-if="forecasts.length">
          <tr v-for="f in forecasts" :key="f.id">
            <td style="font-weight:600;font-size:12px">{{ f.route_name ?? f.route }}</td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtTime(f.target_at) }}</td>
            <td style="font-weight:700">{{ fmtNum(f.predicted_passengers) }}</td>
            <td style="font-size:12px;color:#64748b">
              {{ fmtNum(f.lower_passengers) }} – {{ fmtNum(f.upper_passengers) }}
            </td>
            <td style="font-size:11px">
              <BadgePill variant="info">{{ f.model_name }}</BadgePill>
            </td>
            <td>{{ f.horizon_hours }}h</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading forecasts…' : 'No demand forecast data available.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Operator Performance')

import { usePublicTransport } from '~/composables/api'
import type { OperatorMetric, ServiceQualityScore, PassengerFeedback, DemandForecast } from '~/composables/api'

const metrics   = ref<OperatorMetric[]>([])
const quality   = ref<ServiceQualityScore[]>([])
const feedback  = ref<PassengerFeedback[]>([])
const forecasts = ref<DemandForecast[]>([])
const loading   = ref(true)
const error     = ref<string | null>(null)
const lastRefreshed = ref('-')
const saccoSearch   = ref('')
const sortKey = ref<keyof OperatorMetric>('rank_position')

async function load() {
  loading.value = true
  error.value = null
  const pt = usePublicTransport()

  const [metRes, qualRes, fbRes, fcRes] = await Promise.allSettled([
    pt.operatorMetrics({ page_size: 50 }),
    pt.serviceQuality({ page_size: 30 }),
    pt.feedback({ page_size: 25 }),
    pt.demandForecasts({ page_size: 24 }),
  ])

  if (metRes.status  === 'fulfilled') metrics.value   = (metRes.value as any).results ?? []
  if (qualRes.status === 'fulfilled') quality.value   = (qualRes.value as any).results ?? []
  if (fbRes.status   === 'fulfilled') feedback.value  = (fbRes.value as any).results ?? []
  if (fcRes.status   === 'fulfilled') forecasts.value = (fcRes.value as any).results ?? []

  if ([metRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Public Transport API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const sortedMetrics = computed(() => {
  let list = metrics.value.filter(m =>
    !saccoSearch.value || (m.sacco_name ?? '').toLowerCase().includes(saccoSearch.value.toLowerCase()),
  )
  const key = sortKey.value
  return [...list].sort((a, b) => {
    const av = Number(a[key] ?? 0), bv = Number(b[key] ?? 0)
    return key === 'rank_position' || key === 'complaint_count' ? av - bv : bv - av
  })
})

const avgOnTime    = computed(() => {
  if (!metrics.value.length) return null
  return metrics.value.reduce((s, m) => s + m.on_time_pct, 0) / metrics.value.length
})
const avgUtil      = computed(() => {
  if (!metrics.value.length) return null
  return metrics.value.reduce((s, m) => s + m.fleet_utilization_pct, 0) / metrics.value.length
})
const totalTrips   = computed(() => metrics.value.reduce((s, m) => s + m.total_trips, 0))
const openComplaints = computed(() => feedback.value.filter(f => f.status === 'open').length)

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(n: number | null | undefined) {
  if (n == null) return '-'
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `KES ${(n / 1_000).toFixed(1)}k`
  return `KES ${Math.round(n).toLocaleString()}`
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'2-digit' }) }
  catch { return s }
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function onTimeBg(pct: number) {
  return pct >= 85 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'
}
function utilBg(pct: number) {
  return pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'
}
function fbCatBadge(c: string) {
  const m: Record<string,string> = { safety:'danger', driver_behaviour:'warning', cleanliness:'info', punctuality:'fair', fare:'neutral', vehicle_condition:'warning', other:'neutral' }
  return m[c] ?? 'neutral'
}
function fbStatusBadge(s: string) {
  const m: Record<string,string> = { open:'warning', investigating:'info', resolved:'success', closed:'neutral' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(165px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.util-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.util-bar { height:100%; border-radius:4px; transition:width .4s; }
.scroll-body { max-height:480px; overflow-y:auto; }
.fb-item { padding:10px 14px; border-bottom:1px solid #f8fafc; }
.fb-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
.fb-rating { font-size:13px; font-weight:700; color:#f59e0b; }
.fb-route { font-size:12px; color:#64748b; margin-bottom:3px; }
.fb-text { font-size:13px; margin-bottom:4px; }
.fb-meta { display:flex; gap:8px; align-items:center; }
</style>
