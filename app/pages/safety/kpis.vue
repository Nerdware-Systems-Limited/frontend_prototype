<template>
  <PageHeader
    eyebrow="Safety - KPI Tracking"
    title="Safety KPIs"
    subtitle="NTSA · KeNHA · KURA · KeRRA - National crash rates, injury severity, county breakdowns by road authority, and traffic violation trends"
  >
    <!-- <template #actions>
      
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template> -->
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Headline KPIs from trend aggregate -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Incidents (period)"
      :value="fmtNum(totalIncidents)"
      :unavailable="loading || kpisError"
      :unavailable-note="loading ? 'Loading…' : 'NTSA IRSMS feed unavailable'"
      period="ALL"
      description="Across all KPI records"
      to="#county-breakdown"
    />
    <KpiCard
      label="Total Fatalities"
      :value="fmtNum(totalFatalities)"
      :unavailable="loading || kpisError"
      :unavailable-note="loading ? 'Loading…' : 'NTSA IRSMS feed unavailable'"
      period="ALL"
      description="Period aggregate"
      to="#county-breakdown"
    />
    <KpiCard
      label="Avg Intervention Effectiveness"
      :value="avgEffectiveness ? fmtPct(avgEffectiveness) : '-'"
      :unavailable="loading || kpisError"
      :unavailable-note="loading ? 'Loading…' : 'KeNHA / NTSA feed unavailable'"
      period="ALL"
      description="Across evaluated interventions"
    />
    <KpiCard
      label="Counties with Data"
      :value="fmtNum(countyData.length)"
      :unavailable="loading || (countyError && kpisError)"
      :unavailable-note="loading ? 'Loading…' : 'NTSA feed unavailable'"
      period="ALL"
      description="Reporting county KPI records"
      to="#county-breakdown"
    />
  </div>

  <!-- Trend chart -->
  <SectionTitle pill="NTSA Batch · Rolling">Incident & Fatality Trend</SectionTitle>

  <div class="card">
    <div class="card-header">
      <span>Incident Trend</span>
      <div class="filter-row-inline">
        <select v-model="trendMetric" class="select-sm">
          <option value="incidents">Total Incidents</option>
          <option value="fatalities">Fatalities</option>
          <option value="injuries">Injuries</option>
        </select>
        <div class="chart-type-toggle" role="group" aria-label="Chart type">
          <button
            type="button" class="btn btn-sm" :class="{ 'btn-active': trendChartType === 'bar' }"
            @click="trendChartType = 'bar'"
          >Bar</button>
          <button
            type="button" class="btn btn-sm" :class="{ 'btn-active': trendChartType === 'line' }"
            @click="trendChartType = 'line'"
          >Line</button>
        </div>
      </div>
    </div>
    <div class="card-body">
      <template v-if="visibleTrend.length">
        <div v-if="trendChartType === 'bar'" class="bar-chart-wrap">
          <div class="bar-chart">
            <div
              v-for="(d, i) in visibleTrend"
              :key="d.date"
              class="bar-col"
            >
              <div class="bar-fill-track">
                <div
                  class="bar-fill"
                  :style="{
                    height: `${maxTrendVal > 0 ? (getMetric(d) / maxTrendVal) * 100 : 0}%`,
                    background: trendMetric === 'fatalities' ? 'var(--destructive)' : 'var(--primary-fill)',
                  }"
                  :title="`${d.date}: ${getMetric(d)}`"
                />
              </div>
              <div class="bar-date">{{ showDateLabel(i) ? shortDate(d.date) : '' }}</div>
            </div>
          </div>
        </div>
        <TrendLineChart
          v-else
          :points="trendLinePoints"
          :height="180"
          :color="trendMetric === 'fatalities' ? destructiveHex : undefined"
        />
      </template>
      <EmptyState v-else :loading="loading" message="No trend data available" compact />
    </div>
  </div>

  <!-- County breakdown -->
  <SectionTitle>Crash Statistics by County</SectionTitle>

  <div id="county-breakdown" class="card drill-target">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>County</th>
            <th>Total Incidents</th>
            <th>Fatalities</th>
            <th>Serious</th>
            <th>Minor</th>
            <th>Avg Response (min)</th>
            <th>Interventions</th>
            <th>Effectiveness</th>
          </tr>
        </thead>
        <tbody v-if="countyData.length">
          <tr v-for="row in countyDataPageRows" :key="row.county">
            <td><strong>{{ row.county }}</strong></td>
            <td>{{ fmtNum(row.total_incidents) }}</td>
            <td style="color:var(--danger-fg);font-weight:600">{{ fmtNum(row.fatal_count) }}</td>
            <td>{{ fmtNum(row.serious_count) }}</td>
            <td>{{ fmtNum(row.minor_count) }}</td>
            <td>{{ row.avg_response_minutes != null ? row.avg_response_minutes.toFixed(1) : '-' }}</td>
            <td>{{ fmtNum(row.interventions_evaluated) }}</td>
            <td>
              <span :style="{ color: effectColor(row.intervention_effectiveness_pct) }">
                {{ row.intervention_effectiveness_pct != null ? fmtPct(row.intervention_effectiveness_pct) : '-' }}
              </span>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="8" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading…' : 'No county KPI data available' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="countyDataPage" :total-pages="countyDataTotalPages" :total="countyDataTotal"
        @prev="countyDataPrev" @next="countyDataNext"
      />
    </div>
  </div>

  <!-- Violations by type -->
  <SectionTitle pill="NTSA Traffic Enforcement">Violations by Type</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="violationData.length" class="violations-grid">
        <div v-for="v in violationData" :key="v.violation_type ?? v.label" class="viol-row">
          <div class="viol-label">
            {{ (v.violation_type ?? v.label ?? 'Unknown').replace(/_/g,' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) }}
          </div>
          <div class="viol-bar-wrap">
            <div
              class="viol-bar"
              :style="{
                width: `${maxViolations > 0 ? ((v.count ?? v.total ?? 0) / maxViolations) * 100 : 0}%`,
              }"
            />
          </div>
          <div class="viol-count">{{ fmtNum(v.count ?? v.total ?? 0) }}</div>
        </div>
      </div>
      <EmptyState v-else :loading="loading" message="No violation data available" compact />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useSafety } from '~/composables/api'
import type { SafetyKPI } from '~/composables/api'

const kpis         = ref<SafetyKPI[]>([])
const trendData    = ref<any[]>([])
const countyRaw    = ref<any[]>([])
const violationData = ref<any[]>([])
const loading      = ref(true)
const error        = ref<string | null>(null)
const kpisError    = ref(false)
const countyError  = ref(false)
const lastRefreshed = ref('-')
const trendMetric  = ref<'incidents' | 'fatalities' | 'injuries'>('incidents')

async function load() {
  loading.value = true
  error.value = null
  const safety = useSafety()

  const [kpiRes, trendRes, countyRes, violRes] = await Promise.allSettled([
    safety.kpis({ page_size: 100 }),
    safety.kpiTrend(),
    safety.kpiByCounty(),
    safety.violationsByType(),
  ])

  if (kpiRes.status    === 'fulfilled') kpis.value         = (kpiRes.value as any).results ?? []
  if (trendRes.status  === 'fulfilled') {
    const raw = trendRes.value as any
    trendData.value = Array.isArray(raw) ? raw : (raw.results ?? raw.data ?? [])
  }
  if (countyRes.status === 'fulfilled') {
    const raw = countyRes.value as any
    const rows: any[] = Array.isArray(raw) ? raw : (raw.results ?? raw.data ?? [])
    // /kpis/by-county/ returns {county, incidents, fatalities, serious} - remap onto the
    // SafetyKPI-shaped field names the table below reads. minor_count / avg_response_minutes /
    // interventions_evaluated / intervention_effectiveness_pct aren't produced by this rollup.
    countyRaw.value = rows.map(r => ({
      county: r.county,
      total_incidents: r.incidents ?? 0,
      fatal_count: r.fatalities ?? 0,
      serious_count: r.serious ?? 0,
      minor_count: null,
      avg_response_minutes: null,
      interventions_evaluated: null,
      intervention_effectiveness_pct: null,
    }))
  }
  if (violRes.status   === 'fulfilled') {
    const raw = violRes.value as any
    violationData.value = Array.isArray(raw) ? raw : (raw.results ?? raw.data ?? [])
  }

  kpisError.value   = kpiRes.status    === 'rejected'
  countyError.value = countyRes.status === 'rejected'

  if ([kpiRes, trendRes, countyRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Safety API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ─────────────────────────────────────────────────────────────
const countyData = computed(() => {
  // Aggregate kpis by county if direct county data isn't returned
  if (countyRaw.value.length) return countyRaw.value
  const map = new Map<string, SafetyKPI>()
  kpis.value.forEach(k => {
    const existing = map.get(k.county)
    if (existing) {
      existing.total_incidents += k.total_incidents
      existing.fatal_count     += k.fatal_count
      existing.serious_count   += k.serious_count
      existing.minor_count     += k.minor_count
      existing.interventions_evaluated += k.interventions_evaluated
    } else {
      map.set(k.county, { ...k })
    }
  })
  return Array.from(map.values()).sort((a, b) => b.fatal_count - a.fatal_count)
})

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: countyDataPageRows, page: countyDataPage, totalPages: countyDataTotalPages,
  total: countyDataTotal, next: countyDataNext, prev: countyDataPrev,
} = usePagination(countyData, 15)

const totalIncidents = computed(() => kpis.value.reduce((s, k) => s + k.total_incidents, 0))
const totalFatalities = computed(() => kpis.value.reduce((s, k) => s + k.fatal_count, 0))
const avgEffectiveness = computed(() => {
  const vals = kpis.value.filter(k => k.intervention_effectiveness_pct != null)
  if (!vals.length) return null
  return vals.reduce((s, k) => s + k.intervention_effectiveness_pct!, 0) / vals.length
})

function getMetric(d: any): number {
  return d[trendMetric.value] ?? 0
}
// Bars render the last 30 days only - scale against that same visible
// window, not the full (possibly longer) fetched history. Scaling against
// the full history let an older, off-screen spike silently compress every
// bar actually on screen.
const visibleTrend = computed(() => trendData.value.slice(-30))
const maxTrendVal = computed(() => Math.max(1, ...visibleTrend.value.map(d => getMetric(d))))
// No permanent value labels on the bars (every value is reachable via the
// per-bar hover tooltip); every 5th date only (~6 labels across 30 bars),
// always including the last bar - a label on all 30 bars packed into a
// ~20px-wide column was unreadable.
function showDateLabel(i: number) {
  return i % 5 === 0 || i === visibleTrend.value.length - 1
}

// ── Chart type toggle (bar / line) ──────────────────────────────────────
const trendChartType = ref<'bar' | 'line'>('bar')
const trendLinePoints = computed(() => visibleTrend.value.map(d => ({
  label: shortDate(d.date),
  value: getMetric(d),
  meta: d.date,
})))
// TrendLineChart's `color` prop feeds an SVG stroke/fill attribute, which
// can't resolve a CSS var() reference - resolve --destructive to a literal
// hex per theme instead (same pattern as the validated chart palettes).
const theme = useTheme()
const destructiveHex = computed(() => theme.resolved.value === 'dark' ? '#F26559' : '#DA3B30')
const maxViolations = computed(() => Math.max(1, ...violationData.value.map(v => v.count ?? v.total ?? 0)))

// ── Formatters ─────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtPct(v: number | null | undefined) {
  if (v == null) return '-'
  return `${v.toFixed(1)}%`
}
function shortDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short' }) }
  catch { return s.slice(5) }
}
function effectColor(v: number | null | undefined) {
  if (v == null) return 'var(--border-strong)'
  return v >= 50 ? 'var(--success)' : v >= 20 ? 'var(--warning)' : 'var(--destructive)'
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row-inline { display:flex; gap:8px; align-items:center; }
.chart-type-toggle { display:flex; gap:4px; }
.card-header { display:flex; align-items:center; justify-content:space-between; }
.bar-chart-wrap { overflow-x:auto; }
.bar-chart { display:flex; align-items:stretch; gap:3px; height:150px; min-width:600px; padding-bottom:14px; }
.bar-col { display:flex; flex-direction:column; align-items:center; flex:1; min-width:16px; height:100%; }
/* Fixed height regardless of content: .bar-date sits below .bar-fill-track
   (flex:1) inside a column of fixed total height, so a label-bearing div
   that's *taller* than its empty siblings would steal real track height
   from that one column - every bar's percentage height would then be
   measured against a slightly different available track height, making
   bars not actually comparable to each other (this is what made the
   labeled peak bar visibly shorter than unlabeled taller bars). Values are
   reachable via the per-bar hover tooltip, not a permanent label. */
.bar-fill-track { flex:1; width:100%; display:flex; align-items:flex-end; min-height:0; }
.bar-fill { width:100%; min-height:4px; border-radius:2px 2px 0 0; }
/* Horizontal, not rotated: a rotate()'d label anchored below the bar swings
   its far end back up over the bar/neighbouring column instead of reading
   downward - the exact overlap this replaced. Shown on every Nth bar only
   (see showDateLabel()). */
.bar-date { height:11px; line-height:11px; font-size:9px; color:var(--fg-3); margin-top:4px; white-space:nowrap; flex-shrink:0; }
.violations-grid { display:flex; flex-direction:column; gap:8px; }
.viol-row { display:grid; grid-template-columns:180px 1fr 70px; align-items:center; gap:10px; }
.viol-label { font-size:13px; }
.viol-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:12px; overflow:hidden; }
.viol-bar { height:100%; background:var(--warning); border-radius:4px; }
.viol-count { font-size:13px; font-weight:600; text-align:right; }
</style>
