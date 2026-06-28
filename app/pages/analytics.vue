<template>
  <PageHeader
    eyebrow="M09 / M14 - Analytics & Predictive Intelligence"
    title="Analytics Workbench"
    subtitle="KeNHA · KURA · KMD · NTSA · NaMATA · KRC · KPA · KAA · KCAA - Multi-domain AI forecasts across traffic, safety risk, infrastructure deterioration, and public transport demand"
  >
    <template #actions>
      <NuxtLink to="/query-builder" class="btn">Query Builder →</NuxtLink>
      <NuxtLink to="/reports" class="btn-primary">Reports →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Summary KPIs across domains -->
  <div class="kpi-grid">
    <KpiCard
      label="Traffic Forecasts"
      :value="fmtNum(trafficForecasts.length)"
      sub="Predictive segments (24h)"
      source="batch" source-title="AI Model · KeNHA"
    />
    <KpiCard
      label="Safety Hotspots"
      :value="fmtNum(safetyHotspots.length)"
      sub="Predicted risk zones"
      source="batch" source-title="AI Model · NTSA"
    />
    <KpiCard
      label="At-Risk Road Segments"
      :value="fmtNum(atRiskSegments.length)"
      sub="Deterioration forecast (12mo)"
      source="batch" source-title="AI Model · KeNHA"
    />
    <KpiCard
      label="PT Demand Forecasts"
      :value="fmtNum(demandForecasts.length)"
      sub="Route demand predictions"
      source="batch" source-title="AI Model · NTSA"
    />
    <KpiCard
      label="High-Severity Congestion"
      :value="fmtNum(heavyCongestion.length)"
      sub="Predicted heavy/severe events"
      source="batch" source-title="AI Model · KeNHA"
    />
    <KpiCard
      label="Critical Failure Risk"
      :value="fmtNum(criticalFailure.length)"
      sub="Failure probability ≥ 70%"
      :trend-direction="criticalFailure.length === 0 ? 'up' : 'down'"
      source="batch" source-title="AI Model · KeNHA"
    />
  </div>

  <!-- Traffic forecast panel -->
  <SectionTitle pill="AI Model · KeNHA ATC · Next 24h">Traffic Forecasts</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="model-legend">
        <span v-for="m in trafficModels" :key="m" class="model-chip">
          <span class="model-dot" :style="{ background: modelColor(m) }" />{{ m }}
        </span>
        <span class="model-legend-note">{{ trafficForecasts.length }} forecasts</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Segment</th>
            <th>Model</th>
            <th>Target Time</th>
            <th>Volume</th>
            <th>Speed</th>
            <th>Congestion</th>
            <th>Horizon</th>
            <th>Computed</th>
          </tr>
        </thead>
        <tbody v-if="trafficForecasts.length">
          <tr v-for="f in trafficForecasts.slice(0, 20)" :key="f.id">
            <td class="mono-cell">{{ f.segment }}</td>
            <td>
              <span class="model-badge" :style="{ background: modelColor(f.model_name) + '1a', color: modelColor(f.model_name), borderColor: modelColor(f.model_name) + '44' }">
                {{ f.model_name }}
              </span>
            </td>
            <td class="ts-cell">{{ fmtTime(f.target_at) }}</td>
            <td class="num-bold">{{ fmtNum(f.predicted_volume) }}</td>
            <td class="num-cell">{{ f.predicted_speed_kmh.toFixed(0) }} km/h</td>
            <td><BadgePill :variant="congBadge(f.predicted_congestion)">{{ f.predicted_congestion.replace(/_/g,' ') }}</BadgePill></td>
            <td class="dim-cell">{{ f.horizon_hours }}h</td>
            <td class="dim-cell">{{ fmtTime(f.computed_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="8" class="empty-row">{{ loading ? 'Loading forecasts…' : 'No traffic forecast data.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Safety risk hotspots + infrastructure deterioration -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">
        Predictive Safety Hotspots
        <span class="card-header-meta">Risk Ranking · AI Model · NTSA</span>
      </div>
      <div class="card-body">
        <table>
          <thead>
            <tr>
              <th>Road Segment</th>
              <th>Tier</th>
              <th>Risk Score</th>
              <th>Horizon</th>
              <th>Factors</th>
            </tr>
          </thead>
          <tbody v-if="safetyHotspots.length">
            <tr v-for="h in safetyHotspots.slice(0, 10)" :key="h.id">
              <td class="mono-cell">{{ h.segment_road_code ?? h.road_segment }}</td>
              <td><BadgePill :variant="riskBadge(h.risk_tier)">{{ h.risk_tier }}</BadgePill></td>
              <td>
                <div class="score-bar-wrap">
                  <div class="score-bar" :style="{ width: `${(h.predicted_risk_score ?? 0) * 100}%`, background: riskColor(h.risk_tier) }" />
                </div>
                <span class="score-label">{{ ((h.predicted_risk_score ?? 0) * 100).toFixed(0) }}%</span>
              </td>
              <td class="dim-cell">{{ h.horizon_days }}d</td>
              <td>
                <div class="factor-chips">
                  <span v-for="fc in toFactors(h.contributing_factors).slice(0, 3)" :key="fc" class="factor-chip">{{ fc.replace(/_/g,' ') }}</span>
                  <span v-if="!(h.contributing_factors?.length)" class="dim-cell">-</span>
                </div>
              </td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr><td colspan="5" class="empty-row">{{ loading ? 'Loading…' : 'No safety hotspot data.' }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        Road Deterioration Forecasts
        <span class="card-header-meta">At-Risk Segments · AI Model · KeNHA</span>
      </div>
      <div class="card-body">
        <table>
          <thead>
            <tr>
              <th>Road Code</th>
              <th>Predicted Class</th>
              <th>Failure Probability</th>
              <th>Horizon</th>
              <th>Computed</th>
            </tr>
          </thead>
          <tbody v-if="atRiskSegments.length">
            <tr v-for="s in atRiskSegments.slice(0, 10)" :key="s.id">
              <td class="mono-cell">{{ s.road_code ?? s.segment_road_code }}</td>
              <td><BadgePill :variant="condBadge(s.predicted_condition_class)">{{ (s.predicted_condition_class ?? '-').replace(/_/g,' ') }}</BadgePill></td>
              <td>
                <div class="score-bar-wrap">
                  <div class="score-bar" :style="{ width: `${(s.failure_probability ?? 0) * 100}%`, background: (s.failure_probability ?? 0) >= 0.7 ? '#ef4444' : (s.failure_probability ?? 0) >= 0.4 ? '#f59e0b' : '#22c55e' }" />
                </div>
                <span class="score-label">{{ ((s.failure_probability ?? 0) * 100).toFixed(0) }}%</span>
              </td>
              <td class="dim-cell">{{ s.horizon_months }}mo</td>
              <td class="dim-cell">{{ s.computed_at ? fmtTime(s.computed_at) : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr><td colspan="5" class="empty-row">{{ loading ? 'Loading…' : 'No deterioration forecast data.' }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- PT demand forecasts -->
  <SectionTitle pill="AI Model · NTSA · PT Demand">Public Transport Demand Forecasts</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Route</th>
            <th>Model</th>
            <th>Version</th>
            <th>Predicted Passengers</th>
            <th>Confidence Range</th>
            <th>Horizon</th>
            <th>Computed</th>
          </tr>
        </thead>
        <tbody v-if="demandForecasts.length">
          <tr v-for="f in demandForecasts.slice(0, 15)" :key="f.id">
            <td class="num-bold">{{ f.route_name ?? f.route ?? '-' }}</td>
            <td>
              <span class="model-badge" :style="{ background: '#818cf81a', color: '#4f46e5', borderColor: '#818cf844' }">
                {{ f.model_name }}
              </span>
            </td>
            <td class="dim-cell">v{{ f.model_version }}</td>
            <td class="pax-big">{{ fmtNum(f.predicted_passengers) }}</td>
            <td class="conf-range">{{ fmtNum(f.lower_passengers) }} – {{ fmtNum(f.upper_passengers) }}</td>
            <td class="dim-cell">{{ f.horizon_hours }}h</td>
            <td class="ts-cell">{{ fmtTime(f.computed_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="7" class="empty-row">{{ loading ? 'Loading…' : 'No demand forecast data.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Analytics')

import { useTraffic, useSafety, useInfrastructure, usePublicTransport } from '~/composables/api'
import type { TrafficForecast } from '~/composables/api'

const trafficForecasts = ref<TrafficForecast[]>([])
const safetyHotspots   = ref<any[]>([])
const atRiskSegments   = ref<any[]>([])
const demandForecasts  = ref<any[]>([])
const loading          = ref(true)
const error            = ref<string | null>(null)
const lastRefreshed    = ref('-')

async function load() {
  loading.value = true
  error.value = null

  const [tfRes, shRes, arRes, dfRes] = await Promise.allSettled([
    useTraffic().forecasts({ page_size: 24 }),
    useSafety().hotspots({ page_size: 12 }),
    useInfrastructure().atRiskForecasts(),
    usePublicTransport().demandForecasts({ page_size: 15 }),
  ])

  if (tfRes.status === 'fulfilled') trafficForecasts.value = (tfRes.value as any).results ?? []
  if (shRes.status === 'fulfilled') safetyHotspots.value   = (shRes.value as any).results ?? []
  if (arRes.status === 'fulfilled') atRiskSegments.value   = (arRes.value as any).results ?? []
  if (dfRes.status === 'fulfilled') demandForecasts.value  = (dfRes.value as any).results ?? []

  if ([tfRes, shRes, arRes, dfRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Analytics API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const heavyCongestion = computed(() =>
  trafficForecasts.value.filter(f => f.predicted_congestion === 'heavy' || f.predicted_congestion === 'severe'),
)
const criticalFailure = computed(() =>
  atRiskSegments.value.filter(s => (s.failure_probability ?? 0) >= 0.7),
)
const trafficModels = computed(() =>
  [...new Set(trafficForecasts.value.map(f => f.model_name))],
)

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtTime(iso: string | undefined) {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function congBadge(s: string) {
  const m: Record<string,string> = { free_flow:'success', moderate:'fair', heavy:'warning', severe:'danger' }
  return m[s] ?? 'neutral'
}
function riskBadge(t: string) {
  const m: Record<string,string> = { critical:'danger', high:'warning', medium:'fair', low:'success' }
  return m[t] ?? 'neutral'
}
function riskColor(t: string) {
  const m: Record<string,string> = { critical:'#ef4444', high:'#f97316', medium:'#f59e0b', low:'#22c55e' }
  return m[t] ?? '#94a3b8'
}
function condBadge(c: string) {
  const m: Record<string,string> = { good:'success', fair:'fair', poor:'warning', critical:'danger', failed:'danger' }
  return m[c] ?? 'neutral'
}
function modelColor(m: string) {
  const c: Record<string,string> = { arima:'#3b82f6', prophet:'#22c55e', lstm:'#a855f7', gradient_boost:'#f59e0b', xgboost:'#ef4444' }
  return c[m] ?? '#64748b'
}
function toFactors(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string' && v) return v.split(',').map(s => s.trim())
  return []
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }

/* ── Section layout ── */
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; align-items:start; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }

/* ── Card header with meta ── */
.card-header-meta { font-size:11px; font-weight:400; color:#94a3b8; margin-left:auto; }

/* ── Model legend ── */
.model-legend { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
.model-chip { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; padding:3px 10px; border-radius:20px; background:#f8fafc; border:1px solid #e2e8f0; color:#374151; }
.model-dot { width:8px; height:8px; border-radius:50%; display:inline-block; flex-shrink:0; }
.model-legend-note { font-size:11px; color:#94a3b8; margin-left:auto; }
.model-badge { font-size:11px; padding:2px 8px; border-radius:4px; font-weight:700; border:1px solid transparent; }

/* ── Score bars ── */
.score-bar-wrap { background:#f1f5f9; border-radius:5px; height:8px; overflow:hidden; margin-bottom:3px; min-width:80px; }
.score-bar { height:100%; border-radius:5px; transition:width .4s ease; }
.score-label { font-size:11px; color:#64748b; font-weight:600; font-variant-numeric:tabular-nums; }

/* ── Factor chips ── */
.factor-chips { display:flex; flex-wrap:wrap; gap:3px; max-width:180px; }
.factor-chip { font-size:10px; padding:2px 6px; border-radius:4px; background:#f1f5f9; color:#475569; white-space:nowrap; font-weight:500; }

/* ── Table cell helpers ── */
.mono-cell  { font-family:monospace; font-size:12px; font-weight:600; color:#1e293b; }
.num-bold   { font-weight:700; color:#1e293b; }
.num-cell   { font-size:12px; color:#374151; }
.dim-cell   { font-size:11px; color:#94a3b8; white-space:nowrap; }
.ts-cell    { font-size:11px; white-space:nowrap; color:#64748b; }
.empty-row  { text-align:center; color:#94a3b8; padding:16px; }
.pax-big    { font-size:15px; font-weight:800; color:#1e293b; font-variant-numeric:tabular-nums; }
.conf-range { font-size:12px; color:#64748b; font-variant-numeric:tabular-nums; }
</style>
