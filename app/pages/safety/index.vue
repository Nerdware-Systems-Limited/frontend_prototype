<template>
  <PageHeader
    eyebrow="Safety & Incident Management"
    title="Safety Overview"
    subtitle="NTSA · KeNHA · KMD - National road safety KPIs, active incidents, KMD weather correlation, KeNHA road intervention effectiveness, and predictive hotspot analysis"
  >
    <template #actions>
      <TimeRangeSelector :range="range" @change="load" />
      <NuxtLink to="/safety/incidents" class="btn">Incident Command<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI ribbon -->
  <SectionTitle :pill="summary ? 'NTSA IRSMS · ' + freshnessLabel(summary.generated_at) : ''">
    National Safety KPIs
  </SectionTitle>

  <p class="range-note">
    Showing <strong>{{ range.label.value }}</strong>. The period applies to incident, fatality and violation figures;
    active incidents, dispatches, black spots and hotspots are always current.
  </p>

  <div class="kpi-grid">
    <KpiCard
      label="Incidents"
      :value="summary ? fmtNum(windowTotal) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'NTSA IRSMS feed unavailable'"
      :period="range.period.value"
      :sub="`All severity levels · ${range.label.value}`"
      status="monitoring"
      to="#by-severity"
    />
    <KpiCard
      label="Fatalities"
      :value="summary ? fmtNum(windowFatalities) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'NTSA IRSMS + NPS feed unavailable'"
      :period="range.period.value"
      :sub="`People killed · ${range.label.value}`"
      :status="fatalityStatus"
      :series="fatalitySeries"
      to="#fatality-trend"
    />
    <KpiCard
      label="Active Incidents"
      :value="summary ? fmtNum(summary.kpis.active) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'NTSA IRSMS feed unavailable'"
      period="LIVE"
      sub="Currently open & dispatched"
      :status="!summary ? undefined : summary.kpis.active > 10 ? 'below' : 'monitoring'"
      to="/safety/incidents"
    />
    <KpiCard
      label="Active Dispatches"
      :value="summary ? fmtNum(summary.active_dispatches) : '-'"
      :unavailable="!summary"
      :unavailable-note="loading ? 'Loading…' : 'NPS / NTSA feed unavailable'"
      period="LIVE"
      sub="Emergency units deployed"
      status="monitoring"
      to="/safety/incidents#dispatch-log"
    />
    <KpiCard
      label="Intervention Effectiveness"
      :value="summary ? fmtPct(summary.intervention_effectiveness.average_pct) : '-'"
      :unavailable="!summary || summary.intervention_effectiveness.total_evaluated === 0"
      :unavailable-note="!summary ? (loading ? 'Loading…' : 'KeNHA / NTSA feed unavailable') : 'No interventions evaluated yet'"
      :sub="`${summary ? fmtNum(summary.intervention_effectiveness.total_evaluated) : '-'} evaluated`"
      :status="!summary ? undefined : summary.intervention_effectiveness.average_pct >= 60 ? 'ontarget' : summary.intervention_effectiveness.average_pct >= 45 ? 'below' : 'critical'"
      to="#intervention-effectiveness"
    />
  </div>

  <!-- 30-day fatality sparkline + severity/type breakdown -->
  <div class="three-col-stats">
    <div v-if="hasFatalityTrend" id="fatality-trend" class="card drill-target">
      <div class="card-header">Fatality Trend · {{ range.label.value }}</div>
      <div class="card-body sparkline-wrap">
        <div class="sparkline-bars">
          <div
            v-for="d in trendRows"
            :key="d.day"
            class="spark-bar"
            :class="d.fatalities >= maxFatalities * 0.66 ? 'spark-red' : d.fatalities >= maxFatalities * 0.33 ? 'spark-amber' : 'spark-green'"
            :style="{ height: `${Math.max(6, (d.fatalities / maxFatalities) * 100)}%` }"
            :title="`${bucketLabel(d.day)}: ${d.fatalities} fatalities`"
          />
        </div>
      </div>
      <div class="card-footer-hint">
        One bar per {{ bucketName }} · shaded against the peak ({{ fmtNum(maxFatalities) }}):
        <span class="hint-dot" style="background:var(--destructive)" /> high
        <span class="hint-dot" style="background:var(--warning);margin-left:8px" /> mid
        <span class="hint-dot" style="background:var(--success);margin-left:8px" /> low
      </div>
    </div>
    <div v-else id="fatality-trend" class="card drill-target">
      <div class="card-header">Fatality Trend · {{ range.label.value }}</div>
      <EmptyState
        :loading="loading"
        :message="trendRows.length
          ? `Only ${trendRows.length} ${bucketName}-bucket(s) of trend data in this period - too sparse for a chart.`
          : 'No fatality trend data for this period.'"
        compact
      />
    </div>

    <div v-if="summary?.incidents_by_severity" id="by-severity" class="card drill-target">
      <div class="card-header">By Severity · {{ range.label.value }}</div>
      <div class="card-body">
        <div class="breakdown-list">
          <div v-for="(count, sev) in summary.incidents_by_severity" :key="sev" class="breakdown-row">
            <span class="breakdown-label">{{ String(sev).replace(/_/g,' ') }}</span>
            <div class="breakdown-bar-wrap">
              <div
                class="breakdown-bar"
                :style="{
                  transform: `scaleX(${maxSevCount > 0 ? count / maxSevCount : 0})`,
                  background: sevColor(String(sev)),
                }"
              />
            </div>
            <span class="breakdown-count">{{ fmtNum(count) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="summary?.incidents_by_type" id="by-type" class="card drill-target">
      <div class="card-header">By Type · {{ range.label.value }}</div>
      <div class="card-body">
        <div class="breakdown-list">
          <div v-for="(count, type) in summary.incidents_by_type" :key="type" class="breakdown-row">
            <span class="breakdown-label">{{ String(type).replace(/_/g,' ') }}</span>
            <div class="breakdown-bar-wrap">
              <div
                class="breakdown-bar"
                :style="{
                  transform: `scaleX(${maxTypeCount > 0 ? count / maxTypeCount : 0})`,
                  background: 'var(--primary-fill)',
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
    <CollapsibleSection class="card map-card" title="Predictive Hotspots &amp; Black Spots" storage-key="map:safety/index">
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
    </CollapsibleSection>

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
                transform: `scaleX(${tierPct(tier) / 100})`,
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

        <!-- Violations in the chosen period -->
        <div class="section-mini">Traffic Violations · {{ range.label.value }}</div>
        <div class="stat-pair">
          <span>Total violations</span>
          <strong>{{ summary ? fmtNum(summary.violations_window ?? summary.recent_violations_24h) : '-' }}</strong>
        </div>
      </div>
    </div>
  </div>

  <!-- Intervention effectiveness table -->
  <SectionTitle pill="KeNHA / NTSA Batch">Intervention Effectiveness</SectionTitle>

  <div id="intervention-effectiveness" class="card drill-target">
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
          <tr v-for="iv in interventionsPageRows" :key="iv.id">
            <td>{{ iv.segment_road_code ?? '-' }}</td>
            <td><BadgePill variant="info">{{ iv.intervention_type.replace(/_/g,' ') }}</BadgePill></td>
            <td>{{ iv.cost_kes != null ? `KES ${fmtKsh(iv.cost_kes)}` : '-' }}</td>
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
      <TablePagination
        :page="interventionsPage" :total-pages="interventionsTotalPages" :total="interventionsTotal"
        @prev="interventionsPrev" @next="interventionsNext"
      />
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

import { ArrowRight } from 'lucide-vue-next'
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

// The reporting period for the incident / fatality / violation figures. Agencies can hold many
// years of history, so beyond the presets there is a calendar year and a free from/to period.
const range = useTimeRange('safety', { default: '30d', years: true, custom: true })

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: interventionsPageRows, page: interventionsPage, totalPages: interventionsTotalPages,
  total: interventionsTotal, next: interventionsNext, prev: interventionsPrev,
} = usePagination(interventions, 15)

async function load() {
  loading.value = true
  error.value = null
  const safety = useSafety()
  const gis    = useGis()

  const [sumRes, hsRes, bsRes, ivRes, roadsRes] = await Promise.allSettled([
    safety.summary(range.query.value),
    safety.hotspots({ page_size: 20 }),
    safety.topBlackspots(),
    safety.interventions({ page_size: 20, ordering: '-effectiveness_pct' }),
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
function fmtKsh(v: number | string | null | undefined) {
  // cost_kes comes back as a string - DRF serializes DecimalField as string, not number.
  if (v == null) return '-'
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (Number.isNaN(n)) return '-'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString()
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
  if (v == null) return 'var(--border-strong)'
  return v >= 50 ? 'var(--success)' : v >= 20 ? 'var(--warning)' : 'var(--destructive)'
}

// ── Derived ────────────────────────────────────────────────────────────
// Scale against the same last-30 slice the bars render, not the full
// fetched history - an older, off-screen day would otherwise silently
// compress every bar actually on screen.
// Older API builds only return the fixed 30-day trend, so fall back to it.
const trendRows = computed(() => summary.value?.fatality_trend ?? summary.value?.fatality_trend_30d ?? [])
const maxFatalities = computed(() => Math.max(1, ...trendRows.value.map(d => d.fatalities)))
// A single bucket (or very few) renders as one misleading full-width bar
// under the flex layout below - require a minimum spread before charting it.
const hasFatalityTrend = computed(() => trendRows.value.length >= 5)
const fatalitySeries = computed(() => {
  const t = trendRows.value
  return t.length > 1 ? t.map(d => d.fatalities) : undefined
})

const windowTotal = computed(() => summary.value?.kpis.total_window ?? summary.value?.kpis.total_30d ?? 0)
const windowFatalities = computed(() => summary.value?.kpis.fatal_window ?? summary.value?.kpis.fatal_30d ?? 0)
// The 10 / 20-a-month thresholds only mean something over a month-ish window, so they are
// scaled to a 30-day rate and not applied at all to windows too short to judge.
const fatalityStatus = computed(() => {
  if (!summary.value) return undefined
  const days = summary.value.window?.days ?? range.days.value
  if (days < 7) return 'monitoring'
  const per30 = (windowFatalities.value / days) * 30
  return per30 > 20 ? 'critical' : per30 > 10 ? 'below' : 'monitoring'
})

const bucketName = computed(() => summary.value?.window?.bucket ?? 'day')
function bucketLabel(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const opts: Intl.DateTimeFormatOptions =
    bucketName.value === 'month' ? { month: 'short', year: 'numeric' }
      : bucketName.value === 'hour' ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }
        : { day: '2-digit', month: 'short', year: 'numeric' }
  // A bare date (daily buckets) is a calendar day, not an instant - don't shift it by a timezone.
  return new Intl.DateTimeFormat('en-KE', { ...opts, timeZone: iso.length <= 10 ? 'UTC' : 'Africa/Nairobi' }).format(d)
}

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
  const map: Record<string, string> = { very_high: 'danger', critical: 'danger', high: 'warning', medium: 'fair', low: 'success' }
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
      color: hs.risk_tier === 'very_high' ? 'red' : hs.risk_tier === 'high' ? 'orange' : 'yellow',
      size: hs.risk_tier === 'very_high' ? 'lg' : 'md',
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
.link-sm { font-size:12px; color:var(--link); text-decoration:none; font-weight:600; }
.link-sm:hover { text-decoration:underline; }
.range-note { font-size:12px; color:var(--fg-3); margin:-4px 0 10px; }
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
.spark-red   { background:var(--destructive); }
.spark-amber { background:var(--warning); }
.spark-green { background:var(--success); }
.card-footer-hint { font-size:11px; color:var(--fg-3); padding:6px 16px 10px; border-top:1px solid var(--border-subtle); display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
.hint-dot { display:inline-block; width:8px; height:8px; border-radius:50%; }

/* ── Breakdown bars (severity / type) ── */
.breakdown-list { display:flex; flex-direction:column; gap:9px; }
.breakdown-row { display:grid; grid-template-columns:90px 1fr 36px; gap:6px; align-items:center; }
.breakdown-label { font-size:12px; color:var(--fg-2); text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.breakdown-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:8px; overflow:hidden; }
.breakdown-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
.breakdown-count { font-size:12px; font-weight:600; color:var(--fg-1); text-align:right; font-variant-numeric:tabular-nums; }

/* ── Map ── */
.map-card { overflow:hidden; }
.map-legend-strip { display:flex; gap:16px; flex-wrap:wrap; padding:8px 16px; border-top:1px solid var(--border-subtle); background:var(--surface-1); }
.legend-item { display:flex; align-items:center; gap:5px; font-size:11px; color:var(--fg-2); }
.legend-dot { border-radius:50%; display:inline-block; flex-shrink:0; }

/* ── Tier bars ── */
.tier-row { display:grid; grid-template-columns:120px 1fr 60px; gap:8px; align-items:center; margin-bottom:8px; }
.tier-label { display:flex; align-items:center; gap:6px; font-size:13px; }
.tier-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
.tier-critical { background:#ef4444; }
.tier-high     { background:#f97316; }
.tier-medium   { background:#f59e0b; }
.tier-low      { background:#22c55e; }
.tier-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.tier-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
.tier-count { font-size:13px; text-align:right; font-weight:600; }
.tier-legend { display:flex; gap:6px; flex-wrap:wrap; margin:12px 0 8px; }
.section-mini { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--fg-3); margin:12px 0 6px; }
.stat-pair { display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px; }

/* ── Hotspot list ── */
.hotspot-list { display:flex; flex-direction:column; gap:4px; }
.hotspot-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--border-subtle); }
.hotspot-row:last-child { border-bottom:none; }
.hs-rank { width:28px; font-size:11px; font-weight:700; color:var(--fg-3); flex-shrink:0; }
.hs-info { flex:1; min-width:0; }
.hs-segment { font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:3px; }
.hs-factor-chips { display:flex; gap:4px; flex-wrap:wrap; }
.hs-factor-chip { font-size:10px; padding:1px 5px; border-radius:4px; background:var(--surface-sunken); color:var(--fg-2); white-space:nowrap; }
.hs-factors { font-size:11px; color:var(--fg-3); }
.hs-score { font-size:14px; font-weight:700; color:var(--danger-fg); min-width:36px; text-align:right; }
.hs-horizon { font-size:11px; color:var(--fg-3); white-space:nowrap; }
.hs-empty { color:var(--fg-3); font-size:13px; padding:8px 0; }

/* ── Interventions table ── */
td.effect-good { color:var(--success-fg); font-weight:600; }
td.effect-warn { color:var(--warning-fg); font-weight:600; }
td.effect-bad  { color:var(--danger-fg); font-weight:600; }
.empty-td { text-align:center; color:var(--fg-3); padding:16px; }
</style>
