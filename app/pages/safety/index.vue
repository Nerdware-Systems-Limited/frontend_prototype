<template>
  <PageHeader
    eyebrow="Safety & Incident Management"
    title="Safety Overview"
    subtitle="NTSA · KeNHA · KMD - National road safety KPIs, active incidents, KMD weather correlation, KeNHA road intervention effectiveness, and predictive hotspot analysis"
  >
    <template #actions>
      
      <!-- <button class="btn" :disabled="loading" @click="load">↻ Refresh</button> -->
      <NuxtLink to="/safety/incidents" class="btn-primary">Incident Command →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI ribbon -->
  <SectionTitle :pill="summary ? 'NTSA IRSMS · ' + freshnessLabel(summary.generated_at) : ''">
    National Safety KPIs
  </SectionTitle>

  <div class="kpi-grid">
    <KpiCard
      label="Incidents (24h)"
      :value="summary ? fmtNum(summary.kpis.total_24h) : '-'"
      sub="All severity levels"
      source="live" source-title="NTSA IRSMS"
    />
    <KpiCard
      label="Incidents (7d)"
      :value="summary ? fmtNum(summary.kpis.total_7d) : '-'"
      sub="Rolling 7-day window"
      source="live" source-title="NTSA IRSMS"
    />
    <KpiCard
      label="Fatalities (30d)"
      :value="summary ? fmtNum(summary.kpis.fatal_30d) : '-'"
      sub="Fatal incidents this month"
      trend-direction="down"
      source="live" source-title="NTSA IRSMS + NPS"
    />
    <KpiCard
      label="Active Incidents"
      :value="summary ? fmtNum(summary.kpis.active) : '-'"
      sub="Currently open & dispatched"
      :trend-direction="summary && summary.kpis.active > 10 ? 'down' : 'up'"
      source="live" source-title="NTSA IRSMS"
    />
    <KpiCard
      label="Active Dispatches"
      :value="summary ? fmtNum(summary.active_dispatches) : '-'"
      sub="Emergency units deployed"
      source="live" source-title="NPS / NTSA"
    />
    <KpiCard
      label="Intervention Effectiveness"
      :value="summary ? fmtPct(summary.intervention_effectiveness.average_pct) : '-'"
      :sub="`${summary ? fmtNum(summary.intervention_effectiveness.total_evaluated) : '-'} evaluated`"
      trend-direction="up"
      source="batch" source-title="KeNHA / NTSA"
    />
  </div>

  <!-- 30-day fatality sparkline + severity/type breakdown -->
  <div class="three-col-stats">
    <div v-if="summary?.fatality_trend_30d?.length" class="card">
      <div class="card-header">30-Day Fatality Trend</div>
      <div class="card-body sparkline-wrap">
        <div class="sparkline-bars">
          <div
            v-for="d in summary.fatality_trend_30d.slice(-30)"
            :key="d.day"
            class="spark-bar"
            :class="d.fatalities > 5 ? 'spark-red' : d.fatalities > 2 ? 'spark-amber' : 'spark-green'"
            :style="{ height: `${Math.max(6, (d.fatalities / maxFatalities) * 100)}%` }"
            :title="`${d.day}: ${d.fatalities} fatalities`"
          />
        </div>
      </div>
      <div class="card-footer-hint">
        <span class="hint-dot" style="background:#ef4444" /> &gt;5 fatal
        <span class="hint-dot" style="background:#f59e0b;margin-left:8px" /> 3–5
        <span class="hint-dot" style="background:#10b981;margin-left:8px" /> 0–2
      </div>
    </div>

    <div v-if="summary?.incidents_by_severity" class="card">
      <div class="card-header">By Severity</div>
      <div class="card-body">
        <div class="breakdown-list">
          <div v-for="(count, sev) in summary.incidents_by_severity" :key="sev" class="breakdown-row">
            <span class="breakdown-label">{{ String(sev).replace(/_/g,' ') }}</span>
            <div class="breakdown-bar-wrap">
              <div
                class="breakdown-bar"
                :style="{
                  width: `${maxSevCount > 0 ? (count / maxSevCount) * 100 : 0}%`,
                  background: sevColor(String(sev)),
                }"
              />
            </div>
            <span class="breakdown-count">{{ fmtNum(count) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="summary?.incidents_by_type" class="card">
      <div class="card-header">By Type</div>
      <div class="card-body">
        <div class="breakdown-list">
          <div v-for="(count, type) in summary.incidents_by_type" :key="type" class="breakdown-row">
            <span class="breakdown-label">{{ String(type).replace(/_/g,' ') }}</span>
            <div class="breakdown-bar-wrap">
              <div
                class="breakdown-bar"
                :style="{
                  width: `${maxTypeCount > 0 ? (count / maxTypeCount) * 100 : 0}%`,
                  background: '#3b82f6',
                }"
              />
            </div>
            <span class="breakdown-count">{{ fmtNum(count) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Map + Black spot tiers -->
  <SectionTitle pill="NTSA KDE + IRSMS">Incident Hotspot Map</SectionTitle>

  <div class="two-col">
    <div class="card map-card">
      <div class="card-header">Predictive Hotspots &amp; Black Spots</div>
      <ClientOnly>
        <UaptsMap
          :markers="mapMarkers"
          :roads="roadsGeo"
          :center="[-1.286, 36.817]"
          :zoom="7"
          height="440px"
        />
      </ClientOnly>
      <div class="map-legend-strip">
        <span class="legend-item"><span class="legend-dot" style="background:#ef4444;width:12px;height:12px" /> Critical hotspot</span>
        <span class="legend-item"><span class="legend-dot" style="background:#f97316;width:10px;height:10px" /> High risk</span>
        <span class="legend-item"><span class="legend-dot" style="background:#f59e0b;width:8px;height:8px" /> Medium risk</span>
        <span class="legend-item"><span class="legend-dot" style="background:#ef4444;width:7px;height:7px;opacity:.6" /> Black spot</span>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        Black Spot Tier Distribution
        <NuxtLink to="/safety/blackspots" class="link-sm">Black Spot Inventory →</NuxtLink>
      </div>
      <div class="card-body">
        <div v-for="tier in tierOrder" :key="tier" class="tier-row">
          <div class="tier-label">
            <span :class="`tier-dot tier-${tier}`" />
            {{ capitalize(tier) }}
          </div>
          <div class="tier-bar-wrap">
            <div
              class="tier-bar"
              :style="{
                width: `${tierPct(tier)}%`,
                background: tierColor(tier),
              }"
            />
          </div>
          <div class="tier-count">
            <strong>{{ summary ? fmtNum(summary.black_spots_by_tier[tier] ?? 0) : '-' }}</strong>
          </div>
        </div>

        <div class="tier-legend">
          <BadgePill variant="danger">Critical</BadgePill>
          <BadgePill variant="warning">High</BadgePill>
          <BadgePill variant="fair">Medium</BadgePill>
          <BadgePill variant="success">Low</BadgePill>
        </div>

        <!-- Recent violations 24h -->
        <div class="section-mini">Recent Violations (24h)</div>
        <div class="stat-pair">
          <span>Total violations</span>
          <strong>{{ summary ? fmtNum(summary.recent_violations_24h) : '-' }}</strong>
        </div>
      </div>
    </div>
  </div>

  <!-- Intervention effectiveness table -->
  <SectionTitle pill="KeNHA / NTSA Batch">Intervention Effectiveness</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Road Segment</th>
            <th>Intervention Type</th>
            <th>Cost (KES)</th>
            <th>Before Count</th>
            <th>After Count</th>
            <th>Effectiveness</th>
            <th>Installed</th>
          </tr>
        </thead>
        <tbody v-if="interventions.length">
          <tr v-for="iv in interventions" :key="iv.id">
            <td>{{ iv.segment_road_code ?? '-' }}</td>
            <td><BadgePill variant="info">{{ iv.intervention_type.replace(/_/g,' ') }}</BadgePill></td>
            <td>{{ iv.cost_kes ? `KES ${fmtKsh(iv.cost_kes)}` : '-' }}</td>
            <td>{{ iv.before_count ?? '-' }}</td>
            <td>{{ iv.after_count ?? '-' }}</td>
            <td>
              <span :style="{ color: effectColor(iv.effectiveness_pct) }">
                {{ iv.effectiveness_pct != null ? fmtPct(iv.effectiveness_pct) : '-' }}
              </span>
            </td>
            <td>{{ iv.installed_at ? fmtDate(iv.installed_at) : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="7" class="empty-td">{{ loading ? 'Loading…' : 'No intervention data available' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Top predictive hotspots list -->
  <SectionTitle pill="ML Model · Batch">Top Predictive Risk Hotspots</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="hotspots.length" class="hotspot-list">
        <div v-for="(hs, i) in hotspots.slice(0, 10)" :key="hs.id" class="hotspot-row">
          <span class="hs-rank">#{{ i + 1 }}</span>
          <div class="hs-info">
            <div class="hs-segment">{{ hs.segment_road_code ?? `Grid ${hs.grid_cell_id}` }}</div>
            <div class="hs-factor-chips">
              <template v-if="hs.contributing_factors && Object.keys(hs.contributing_factors).length">
                <span
                  v-for="factor in Object.keys(hs.contributing_factors).slice(0, 4)"
                  :key="factor"
                  class="hs-factor-chip"
                >{{ factor.replace(/_/g,' ') }}</span>
              </template>
              <span v-else class="hs-factors">No factors listed</span>
            </div>
          </div>
          <BadgePill :variant="riskBadge(hs.risk_tier)">{{ hs.risk_tier }}</BadgePill>
          <div class="hs-score">{{ hs.predicted_risk_score.toFixed(2) }}</div>
          <div class="hs-horizon">{{ hs.horizon_days }}d horizon</div>
        </div>
      </div>
      <div v-else class="hs-empty">{{ loading ? 'Loading hotspots…' : 'No predictive hotspot data available' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Safety Overview')

import { useSafety, useGis } from '~/composables/api'
import type { SafetySummary, PredictiveHotspot, BlackSpot, SafetyIntervention } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'purple' | 'gray'; size?: 'sm' | 'md' | 'lg' }

const summary       = ref<SafetySummary | null>(null)
const hotspots      = ref<PredictiveHotspot[]>([])
const blackspots    = ref<BlackSpot[]>([])
const interventions = ref<SafetyIntervention[]>([])
const roadsGeo      = ref<GeoJSONFeatureCollection | null>(null)
const loading       = ref(true)
const error         = ref<string | null>(null)
const lastRefreshed = ref('-')

async function load() {
  loading.value = true
  error.value = null
  const safety = useSafety()
  const gis    = useGis()

  const [sumRes, hsRes, bsRes, ivRes, roadsRes] = await Promise.allSettled([
    safety.summary(),
    safety.hotspots({ page_size: 20 }),
    safety.topBlackspots(),
    safety.interventionEffectiveness(),
    gis.roads({ limit: 300, simplify: 0.01 }),
  ])

  if (sumRes.status === 'fulfilled') summary.value       = sumRes.value
  if (hsRes.status  === 'fulfilled') hotspots.value      = (hsRes.value as any).results ?? []
  if (bsRes.status  === 'fulfilled') blackspots.value    = (bsRes.value as any).results ?? []
  if (ivRes.status  === 'fulfilled') interventions.value = (ivRes.value as any).results ?? []
  if (roadsRes.status === 'fulfilled') roadsGeo.value    = roadsRes.value

  const allFailed = [sumRes, hsRes].every(r => r.status === 'rejected')
  if (allFailed) error.value = 'Unable to reach the UAPTS Safety API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Formatters ─────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtPct(v: number | null | undefined) {
  if (v == null) return '-'
  return `${v.toFixed(1)}%`
}
function fmtKsh(v: number | null | undefined) {
  if (v == null) return '-'
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return v.toLocaleString()
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) }
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
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function effectColor(v: number | null | undefined) {
  if (v == null) return '#94a3b8'
  return v >= 50 ? '#22c55e' : v >= 20 ? '#f59e0b' : '#ef4444'
}

// ── Derived ────────────────────────────────────────────────────────────
const maxFatalities = computed(() =>
  Math.max(1, ...(summary.value?.fatality_trend_30d ?? []).map(d => d.fatalities)),
)

const maxSevCount = computed(() => {
  if (!summary.value?.incidents_by_severity) return 1
  return Math.max(1, ...Object.values(summary.value.incidents_by_severity))
})

const maxTypeCount = computed(() => {
  if (!summary.value?.incidents_by_type) return 1
  return Math.max(1, ...Object.values(summary.value.incidents_by_type))
})

function sevColor(sev: string) {
  const map: Record<string, string> = { fatal: '#7f1d1d', critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' }
  return map[sev.toLowerCase()] ?? '#94a3b8'
}

const tierOrder = ['critical', 'high', 'medium', 'low'] as const
const tierTotals = computed(() => {
  if (!summary.value) return 0
  return tierOrder.reduce((s, t) => s + (summary.value!.black_spots_by_tier[t] ?? 0), 0)
})
function tierPct(tier: string) {
  if (!summary.value || tierTotals.value === 0) return 0
  return ((summary.value.black_spots_by_tier[tier] ?? 0) / tierTotals.value) * 100
}
function tierColor(tier: string) {
  const map: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' }
  return map[tier] ?? '#94a3b8'
}
function riskBadge(tier: string) {
  const map: Record<string, string> = { critical: 'danger', high: 'warning', medium: 'fair', low: 'success' }
  return map[tier] ?? 'neutral'
}

const mapMarkers = computed((): MarkerSpec[] => {
  const markers: MarkerSpec[] = []
  hotspots.value.forEach(hs => {
    markers.push({
      id: `hs-${hs.id}`,
      lat: hs.latitude,
      lon: hs.longitude,
      title: `Risk: ${hs.predicted_risk_score.toFixed(2)}`,
      subtitle: `${hs.risk_tier} · ${hs.horizon_days}d horizon`,
      color: hs.risk_tier === 'critical' ? 'red' : hs.risk_tier === 'high' ? 'orange' : 'yellow',
      size: hs.risk_tier === 'critical' ? 'lg' : 'md',
    })
  })
  blackspots.value.forEach(bs => {
    if (bs.centroid_latitude && bs.centroid_longitude) {
      markers.push({
        id: `bs-${bs.id}`,
        lat: bs.centroid_latitude,
        lon: bs.centroid_longitude,
        title: `Black Spot · ${bs.ranking_tier}`,
        subtitle: `${bs.accident_count_rolling} accidents / ${bs.fatality_count_rolling} fatalities`,
        color: bs.ranking_tier === 'critical' ? 'red' : bs.ranking_tier === 'high' ? 'orange' : 'yellow',
        size: 'sm',
      })
    }
  })
  return markers
})
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.link-sm { font-size:12px; color:#3b82f6; text-decoration:none; font-weight:600; }
.link-sm:hover { text-decoration:underline; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:900px) { .two-col { grid-template-columns:1fr; } }

/* ── 3-col stats row ── */
.three-col-stats { display:grid; grid-template-columns:2fr 1.2fr 1.2fr; gap:14px; margin-bottom:16px; }
@media(max-width:960px) { .three-col-stats { grid-template-columns:1fr 1fr; } }
@media(max-width:640px) { .three-col-stats { grid-template-columns:1fr; } }

/* ── Sparkline ── */
.sparkline-wrap { padding-bottom:0; }
.sparkline-bars { display:flex; align-items:flex-end; gap:2px; height:72px; }
.spark-bar { flex:1; border-radius:2px 2px 0 0; cursor:default; transition:opacity .1s; }
.spark-bar:hover { opacity:.75; }
.spark-red   { background:#ef4444; }
.spark-amber { background:#f59e0b; }
.spark-green { background:#10b981; }
.card-footer-hint { font-size:11px; color:#94a3b8; padding:6px 16px 10px; border-top:1px solid #f1f5f9; display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
.hint-dot { display:inline-block; width:8px; height:8px; border-radius:50%; }

/* ── Breakdown bars (severity / type) ── */
.breakdown-list { display:flex; flex-direction:column; gap:9px; }
.breakdown-row { display:grid; grid-template-columns:90px 1fr 36px; gap:6px; align-items:center; }
.breakdown-label { font-size:12px; color:#374151; text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.breakdown-bar-wrap { background:#f1f5f9; border-radius:4px; height:8px; overflow:hidden; }
.breakdown-bar { height:100%; border-radius:4px; transition:width .4s; }
.breakdown-count { font-size:12px; font-weight:600; color:#1e293b; text-align:right; font-variant-numeric:tabular-nums; }

/* ── Map ── */
.map-card { overflow:hidden; }
.map-legend-strip { display:flex; gap:16px; flex-wrap:wrap; padding:8px 16px; border-top:1px solid #f1f5f9; background:#fafafa; }
.legend-item { display:flex; align-items:center; gap:5px; font-size:11px; color:#64748b; }
.legend-dot { border-radius:50%; display:inline-block; flex-shrink:0; }

/* ── Tier bars ── */
.tier-row { display:grid; grid-template-columns:120px 1fr 60px; gap:8px; align-items:center; margin-bottom:8px; }
.tier-label { display:flex; align-items:center; gap:6px; font-size:13px; }
.tier-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
.tier-critical { background:#ef4444; }
.tier-high     { background:#f97316; }
.tier-medium   { background:#f59e0b; }
.tier-low      { background:#22c55e; }
.tier-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.tier-bar { height:100%; border-radius:4px; transition:width .4s; }
.tier-count { font-size:13px; text-align:right; font-weight:600; }
.tier-legend { display:flex; gap:6px; flex-wrap:wrap; margin:12px 0 8px; }
.section-mini { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; margin:12px 0 6px; }
.stat-pair { display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px; }

/* ── Hotspot list ── */
.hotspot-list { display:flex; flex-direction:column; gap:4px; }
.hotspot-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid #f1f5f9; }
.hotspot-row:last-child { border-bottom:none; }
.hs-rank { width:28px; font-size:11px; font-weight:700; color:#94a3b8; flex-shrink:0; }
.hs-info { flex:1; min-width:0; }
.hs-segment { font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:3px; }
.hs-factor-chips { display:flex; gap:4px; flex-wrap:wrap; }
.hs-factor-chip { font-size:10px; padding:1px 5px; border-radius:4px; background:#f1f5f9; color:#475569; white-space:nowrap; }
.hs-factors { font-size:11px; color:#94a3b8; }
.hs-score { font-size:14px; font-weight:700; color:#ef4444; min-width:36px; text-align:right; }
.hs-horizon { font-size:11px; color:#94a3b8; white-space:nowrap; }
.hs-empty { color:#94a3b8; font-size:13px; padding:8px 0; }

/* ── Interventions table ── */
td.effect-good { color:#16a34a; font-weight:600; }
td.effect-warn { color:#d97706; font-weight:600; }
td.effect-bad  { color:#dc2626; font-weight:600; }
.empty-td { text-align:center; color:#94a3b8; padding:16px; }
</style>
