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
      sub="Across all KPI records"
      source="batch" source-title="NTSA IRSMS"
    />
    <KpiCard
      label="Total Fatalities"
      :value="fmtNum(totalFatalities)"
      sub="Period aggregate"
      trend-direction="down"
      source="batch" source-title="NTSA IRSMS"
    />
    <KpiCard
      label="Avg Intervention Effectiveness"
      :value="avgEffectiveness ? fmtPct(avgEffectiveness) : '-'"
      sub="Across evaluated interventions"
      trend-direction="up"
      source="batch" source-title="KeNHA / NTSA"
    />
    <KpiCard
      label="Counties with Data"
      :value="fmtNum(countyData.length)"
      sub="Reporting county KPI records"
      source="batch" source-title="NTSA"
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
      </div>
    </div>
    <div class="card-body">
      <div v-if="trendData.length" class="bar-chart-wrap">
        <div class="bar-chart">
          <div
            v-for="d in trendData.slice(-30)"
            :key="d.date"
            class="bar-col"
          >
            <div class="bar-tip">{{ getMetric(d) }}</div>
            <div
              class="bar-fill"
              :style="{
                height: `${maxTrendVal > 0 ? (getMetric(d) / maxTrendVal) * 100 : 0}%`,
                background: trendMetric === 'fatalities' ? '#ef4444' : '#3b82f6',
              }"
              :title="`${d.date}: ${getMetric(d)}`"
            />
            <div class="bar-date">{{ shortDate(d.date) }}</div>
          </div>
        </div>
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading trend…' : 'No trend data available' }}</div>
    </div>
  </div>

  <!-- County breakdown -->
  <SectionTitle>Crash Statistics by County</SectionTitle>

  <div class="card">
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
          <tr v-for="row in countyData" :key="row.county">
            <td><strong>{{ row.county }}</strong></td>
            <td>{{ fmtNum(row.total_incidents) }}</td>
            <td style="color:#ef4444;font-weight:600">{{ fmtNum(row.fatal_count) }}</td>
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
            <td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading…' : 'No county KPI data available' }}
            </td>
          </tr>
        </tbody>
      </table>
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
      <div v-else style="color:#94a3b8;font-size:13px">
        {{ loading ? 'Loading violations…' : 'No violation data available' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Safety KPIs')

import { useSafety } from '~/composables/api'
import type { SafetyKPI } from '~/composables/api'

const kpis         = ref<SafetyKPI[]>([])
const trendData    = ref<any[]>([])
const countyRaw    = ref<any[]>([])
const violationData = ref<any[]>([])
const loading      = ref(true)
const error        = ref<string | null>(null)
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
    // /kpis/by-county/ returns {county, incidents, fatalities, serious} — remap onto the
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
const maxTrendVal = computed(() => Math.max(1, ...trendData.value.map(d => getMetric(d))))
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
  if (v == null) return '#94a3b8'
  return v >= 50 ? '#22c55e' : v >= 20 ? '#f59e0b' : '#ef4444'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row-inline { display:flex; gap:8px; align-items:center; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.card-header { display:flex; align-items:center; justify-content:space-between; }
.bar-chart-wrap { overflow-x:auto; }
.bar-chart { display:flex; align-items:flex-end; gap:3px; height:120px; min-width:400px; }
.bar-col { display:flex; flex-direction:column; align-items:center; flex:1; min-width:14px; }
.bar-tip { font-size:9px; color:#64748b; margin-bottom:2px; }
.bar-fill { width:100%; min-height:4px; border-radius:2px 2px 0 0; flex-shrink:0; }
.bar-date { font-size:9px; color:#94a3b8; margin-top:2px; white-space:nowrap; transform:rotate(-45deg); transform-origin:top left; }
.violations-grid { display:flex; flex-direction:column; gap:8px; }
.viol-row { display:grid; grid-template-columns:180px 1fr 70px; align-items:center; gap:10px; }
.viol-label { font-size:13px; }
.viol-bar-wrap { background:#f1f5f9; border-radius:4px; height:12px; overflow:hidden; }
.viol-bar { height:100%; background:#f59e0b; border-radius:4px; }
.viol-count { font-size:13px; font-weight:600; text-align:right; }
</style>
