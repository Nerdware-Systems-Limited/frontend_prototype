<template>
  <PageHeader
    eyebrow="M06 - Infrastructure & Network Health"
    title="Asset Condition Map"
    subtitle="KeNHA · KURA · KeRRA · KRB · LAPSSET - Pavement quality (IRI), bridge health, KURA signal faults, KMD weather impact, and deterioration forecasts"
  >
    <template #actions>
      <span class="freshness-badge" :class="{ loading }">
        {{ loading ? 'Refreshing…' : `Updated ${lastRefreshed}` }}
      </span>
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
      <NuxtLink to="/infrastructure/projects" class="btn-primary">Projects →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI ribbon -->
  <SectionTitle :pill="summary ? 'KeNHA / KRB · ' + freshnessLabel(summary.generated_at) : ''">
    Network KPIs
  </SectionTitle>

  <div class="kpi-grid">
    <KpiCard
      label="Total Road Length"
      :value="summary ? `${fmtNum(summary.network.total_length_km, 0)} km` : '-'"
      :sub="`${summary ? fmtNum(summary.network.total_segments) : '-'} segments monitored`"
      source="batch" source-title="KeNHA / KRB"
    />
    <KpiCard
      label="Avg IRI"
      :value="summary ? summary.network.iri_average.toFixed(2) : '-'"
      sub="International Roughness Index (m/km)"
      :trend-direction="summary && summary.network.iri_average <= 4 ? 'up' : 'down'"
      source="batch" source-title="KeNHA Surveys"
    />
    <KpiCard
      label="Avg PCI"
      :value="summary ? summary.network.pci_average.toFixed(1) : '-'"
      sub="Pavement Condition Index (0–100)"
      :trend-direction="summary && summary.network.pci_average >= 70 ? 'up' : 'down'"
      source="batch" source-title="KeNHA Surveys"
    />
    <KpiCard
      label="Critical Bridges"
      :value="summary ? fmtNum(summary.bridges.critical_count) : '-'"
      sub="Requiring urgent inspection"
      trend-direction="down"
      source="batch" source-title="KeNHA Bridges"
    />
    <KpiCard
      label="Open Maintenance Orders"
      :value="summary ? fmtNum(summary.maintenance.open_orders) : '-'"
      :sub="summary ? `KES ${fmtKES(summary.maintenance.open_value_kes)} outstanding` : '-'"
      source="live" source-title="KeNHA MMS"
    />
    <KpiCard
      label="At-Risk Segments (12mo)"
      :value="summary ? fmtNum(summary.predictive.at_risk_segments_12mo) : '-'"
      sub="AI deterioration forecast"
      trend-direction="down"
      source="batch" source-title="ML Model"
    />
  </div>

  <!-- Condition map + distribution -->
  <div class="two-col-map">
    <div class="card map-card">
      <div class="card-header">Road Condition Map</div>
      <ClientOnly>
        <UaptsMap
          :markers="segmentMarkers"
          :roads="roadsGeo"
          :center="[-1.286, 36.817]"
          :zoom="7"
          height="480px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#22c55e" /> Good</span>
        <span class="mk"><span class="dot" style="background:#84cc16" /> Fair</span>
        <span class="mk"><span class="dot" style="background:#f59e0b" /> Poor</span>
        <span class="mk"><span class="dot" style="background:#ef4444" /> Critical</span>
        <span class="mk"><span class="dot" style="background:#7f1d1d" /> Failed</span>
      </div>
    </div>

    <div class="right-col">
      <!-- Condition distribution -->
      <div class="card">
        <div class="card-header">Condition Distribution</div>
        <div class="card-body">
          <div v-if="condDist.length" class="dist-list">
            <div v-for="d in condDist" :key="d.condition_class" class="dist-row">
              <span class="dist-label">{{ d.condition_class }}</span>
              <div class="dist-bar-wrap">
                <div class="dist-bar" :style="{ width: `${condPct(d)}%`, background: condColor(d.condition_class) }" />
              </div>
              <span class="dist-val">{{ fmtNum(d.total) }} <span style="color:#94a3b8">({{ condPct(d).toFixed(0) }}%)</span></span>
            </div>
          </div>
          <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No data' }}</div>
        </div>
      </div>

      <!-- Budget snapshot -->
      <div v-if="summary" class="card" style="margin-top:12px">
        <div class="card-header">Maintenance Budget FY{{ summary.budget.fiscal_year }}</div>
        <div class="card-body">
          <div class="budget-row">
            <span>Allocated</span>
            <strong>KES {{ fmtKES(summary.budget.allocated_kes) }}</strong>
          </div>
          <div class="budget-row">
            <span>Disbursed</span>
            <strong style="color:#22c55e">KES {{ fmtKES(summary.budget.disbursed_kes) }}</strong>
          </div>
          <div class="budget-row">
            <span>Committed</span>
            <strong style="color:#f59e0b">KES {{ fmtKES(summary.budget.committed_kes) }}</strong>
          </div>
          <div class="budget-row">
            <span>Utilization</span>
            <strong>{{ summary.budget.utilization_pct.toFixed(1) }}%</strong>
          </div>
          <div class="budget-bar-wrap" style="margin-top:8px">
            <div class="budget-bar" :style="{ width: `${summary.budget.utilization_pct}%` }" />
          </div>
        </div>
      </div>

      <!-- WIM overloads -->
      <div v-if="summary" class="card" style="margin-top:12px">
        <div class="card-header">Weigh-in-Motion (30d)</div>
        <div class="card-body">
          <div class="budget-row">
            <span>Total Passings</span>
            <strong>{{ fmtNum(summary.wim.total_passings_30d) }}</strong>
          </div>
          <div class="budget-row">
            <span>Overloads</span>
            <strong style="color:#ef4444">{{ fmtNum(summary.wim.overloads_30d) }}</strong>
          </div>
          <div class="budget-row">
            <span>Overload Rate</span>
            <strong :style="{ color: summary.wim.overload_rate_pct > 10 ? '#ef4444' : '#22c55e' }">
              {{ summary.wim.overload_rate_pct.toFixed(1) }}%
            </strong>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- At-risk deterioration forecasts -->
  <SectionTitle pill="ML Model · KeNHA">At-Risk Segments (Next 12 Months)</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Road Code</th>
            <th>Model</th>
            <th>Predicted Condition</th>
            <th>Failure Probability</th>
            <th>Predicted PCI</th>
            <th>Horizon</th>
            <th>Confidence</th>
            <th>Generated</th>
          </tr>
        </thead>
        <tbody v-if="atRisk.length">
          <tr v-for="f in atRisk" :key="f.id">
            <td style="font-weight:600;font-family:monospace;font-size:12px">{{ f.segment_road_code ?? f.segment }}</td>
            <td style="font-size:12px"><BadgePill variant="info">{{ f.model_name }}</BadgePill></td>
            <td><BadgePill :variant="condBadge(f.predicted_condition_class ?? '')">{{ f.predicted_condition_class ?? '-' }}</BadgePill></td>
            <td>
              <span :style="{ color: failColor(f.failure_probability), fontWeight:'600' }">
                {{ f.failure_probability != null ? `${(f.failure_probability * 100).toFixed(1)}%` : '-' }}
              </span>
            </td>
            <td>{{ f.predicted_pci != null ? f.predicted_pci.toFixed(1) : '-' }}</td>
            <td>{{ f.horizon_months }}mo</td>
            <td>{{ f.confidence_pct != null ? `${f.confidence_pct.toFixed(0)}%` : '-' }}</td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtDate(f.generated_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading forecasts…' : 'No at-risk segments found.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Traffic signal faults -->
  <SectionTitle pill="NaMATA / NCC · Live">Traffic Signal Faults</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Intersection</th>
            <th>Code</th>
            <th>Status</th>
            <th>Mode</th>
            <th>Agency</th>
            <th>Last Change</th>
          </tr>
        </thead>
        <tbody v-if="signalFaults.length">
          <tr v-for="sig in signalFaults" :key="sig.id">
            <td style="font-weight:600">{{ sig.intersection_name }}</td>
            <td style="font-family:monospace;font-size:12px">{{ sig.intersection_code }}</td>
            <td><BadgePill :variant="sigBadge(sig.status)">{{ sig.status }}</BadgePill></td>
            <td style="font-size:12px">{{ sig.mode.replace(/_/g,' ') }}</td>
            <td style="font-size:12px">{{ sig.agency_code ?? '-' }}</td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtDate(sig.last_status_change_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading signals…' : 'No signal faults reported.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Asset Condition Map')

import { useInfrastructure, useGis } from '~/composables/api'
import type { InfrastructureSummary, DeteriorationForecast, TrafficSignal } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

const summary      = ref<InfrastructureSummary | null>(null)
const condDist     = ref<{ condition_class: string; total: number; length: number }[]>([])
const atRisk       = ref<DeteriorationForecast[]>([])
const signalFaults = ref<TrafficSignal[]>([])
const roadsGeo     = ref<GeoJSONFeatureCollection | null>(null)
const loading      = ref(true)
const error        = ref<string | null>(null)
const lastRefreshed = ref('-')

async function load() {
  loading.value = true
  error.value = null
  const infra = useInfrastructure()
  const gis   = useGis()

  const [sumRes, distRes, riskRes, sigRes, roadsRes] = await Promise.allSettled([
    infra.summary(),
    infra.segmentConditionDistribution(),
    infra.atRiskForecasts(),
    infra.signalFaults(),
    gis.roads({ limit: 500, simplify: 0.02 }),
  ])

  if (sumRes.status  === 'fulfilled') {
    summary.value  = sumRes.value
    condDist.value = sumRes.value.network.condition_distribution ?? []
  }
  if (distRes.status === 'fulfilled' && !condDist.value.length)
    condDist.value = (distRes.value as any).results ?? []
  if (riskRes.status === 'fulfilled') atRisk.value       = (riskRes.value as any).results ?? []
  if (sigRes.status  === 'fulfilled') signalFaults.value = (sigRes.value as any).results ?? []
  if (roadsRes.status === 'fulfilled') roadsGeo.value    = roadsRes.value

  if ([sumRes, riskRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Infrastructure API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const totalSegs = computed(() => condDist.value.reduce((s, d) => s + d.total, 0) || 1)

const segmentMarkers = computed((): MarkerSpec[] => {
  if (!summary.value) return []
  return condDist.value.flatMap((d, i) =>
    Array.from({ length: Math.min(d.total, 3) }, (_, j) => ({
      id: `seg-${d.condition_class}-${i}-${j}`,
      lat: -1.2 + (i * 0.4) + (j * 0.15),
      lon: 36.8 + (i * 0.3) + (j * 0.1),
      title: `${d.condition_class.toUpperCase()} condition`,
      color: condColor(d.condition_class) === '#22c55e' ? 'green'
           : condColor(d.condition_class) === '#f59e0b' ? 'yellow'
           : 'red',
      size: 'sm',
    })),
  )
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
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function freshnessLabel(iso: string | undefined) {
  if (!iso) return 'Live'
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    return mins < 2 ? 'Live' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`
  } catch { return 'Live' }
}
function condColor(cls: string): string {
  const m: Record<string,string> = { good:'#22c55e', fair:'#84cc16', poor:'#f59e0b', critical:'#ef4444', failed:'#7f1d1d' }
  return m[cls] ?? '#94a3b8'
}
function condPct(d: { condition_class: string; total: number; length: number }) {
  return (d.total / totalSegs.value) * 100
}
function condBadge(cls: string) {
  const m: Record<string,string> = { good:'success', fair:'fair', poor:'warning', critical:'danger', failed:'danger' }
  return m[cls] ?? 'neutral'
}
function failColor(p: number | null | undefined) {
  if (p == null) return '#94a3b8'
  return p >= 0.7 ? '#ef4444' : p >= 0.4 ? '#f59e0b' : '#22c55e'
}
function sigBadge(s: string) {
  const m: Record<string,string> = { operational:'success', faulty:'danger', maintenance:'warning', offline:'neutral' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col-map { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid #f1f5f9; }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.right-col { display:flex; flex-direction:column; gap:12px; overflow-y:auto; max-height:508px; }
.dist-list { display:flex; flex-direction:column; gap:8px; }
.dist-row { display:grid; grid-template-columns:80px 1fr 100px; align-items:center; gap:8px; }
.dist-label { font-size:12px; text-transform:capitalize; }
.dist-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.dist-bar { height:100%; border-radius:4px; transition:width .4s; }
.dist-val { font-size:11px; text-align:right; }
.budget-row { display:flex; justify-content:space-between; font-size:13px; padding:4px 0; border-bottom:1px solid #f8fafc; }
.budget-bar-wrap { background:#f1f5f9; border-radius:4px; height:8px; overflow:hidden; }
.budget-bar { height:100%; background:#3b82f6; border-radius:4px; }
</style>
