<script setup lang="ts">
// pages/incidents.vue — M05 Safety & Incident Management
// Backend: /api/v1/safety/incidents/ + /accidents/ + /black-spots/
//          + /emergency-dispatches/ + /predictive-hotspots/ + /summary/
definePageMeta({ title: 'Incidents' })

import { useSafety } from '~/composables/api'
import type {
  SafetySummary, SafetyIncident, BlackSpot, EmergencyDispatch,
  PredictiveHotspot, IncidentSeverity,
} from '~/composables/api'

const safety = useSafety()

const summary = ref<SafetySummary | null>(null)
const incidents = ref<SafetyIncident[]>([])
const dispatches = ref<EmergencyDispatch[]>([])
const blackspots = ref<BlackSpot[]>([])
const hotspots = ref<PredictiveHotspot[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const severityFilter = ref<IncidentSeverity | ''>('')
const statusFilter = ref<string>('')

async function load() {
  loading.value = true
  error.value = null
  try {
    const [sum, inc, disp, bs, hs] = await Promise.all([
      safety.summary(),
      safety.incidents({
        page_size: 50,
        severity: severityFilter.value || undefined,
        status: statusFilter.value || undefined,
      }),
      safety.activeDispatches(),
      safety.topBlackspots(),
      safety.hotspots({ page_size: 12 }),
    ])
    summary.value = sum
    incidents.value = (inc as any).results ?? []
    dispatches.value = (disp as any).results ?? []
    blackspots.value = (bs as any).results ?? []
    hotspots.value = (hs as any).results ?? []
  } catch (err: any) {
    error.value = err?.status === 401
      ? 'Not authenticated — please log in.'
      : err?.message ?? 'Failed to load incidents.'
  } finally {
    loading.value = false
  }
}

watch([severityFilter, statusFilter], () => { load() })
onMounted(load)

function sevBadge(s: string) {
  return s === 'critical' || s === 'fatal' ? 'danger'
       : s === 'high' ? 'danger'
       : s === 'medium' ? 'warning'
       : 'neutral'
}
function statusBadge(s: string) {
  return s === 'closed' || s === 'resolved' ? 'success'
       : s === 'on_scene' ? 'info'
       : s === 'cancelled' ? 'neutral'
       : 'warning'
}
function dispatchBadge(s: string) {
  return s === 'completed' ? 'success'
       : s === 'on_scene' ? 'info'
       : s === 'en_route' ? 'warning'
       : s === 'cancelled' ? 'neutral'
       : 'info'
}
function tierBadge(t: string) {
  return t === 'critical' ? 'danger' : t === 'high' ? 'warning' : 'info'
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="incidents-page">
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M05</div>
        <h1 class="text-display">Incidents</h1>
        <p class="text-sm text-fg-muted mt-1">
          Road-safety incidents, dispatch coordination, black-spot clusters &amp; ML predictive hotspots.
        </p>
      </div>
      <button class="btn btn-primary">+ Report Incident</button>
    </div>

    <!-- KPIs -->
    <div v-if="summary" class="kpi-grid">
      <div class="card kpi">
        <div class="kpi-label">Active Incidents</div>
        <div class="kpi-value">{{ summary.kpis.active }}</div>
        <div class="kpi-sub">Reported / triaged / dispatched / on-scene</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Last 24h</div>
        <div class="kpi-value">{{ summary.kpis.total_24h }}</div>
        <div class="kpi-sub">7d: {{ summary.kpis.total_7d }} · 30d: {{ summary.kpis.total_30d }}</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Fatal (30d)</div>
        <div class="kpi-value text-danger">{{ summary.kpis.fatal_30d }}</div>
        <div class="kpi-sub">Reported fatalities</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Active Dispatches</div>
        <div class="kpi-value">{{ summary.active_dispatches }}</div>
        <div class="kpi-sub">Ambulance / police / tow / fire</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Violations (24h)</div>
        <div class="kpi-value">{{ summary.recent_violations_24h }}</div>
        <div class="kpi-sub">NPS-sourced</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Intervention Effectiveness</div>
        <div class="kpi-value">{{ summary.intervention_effectiveness.average_pct.toFixed(1) }}%</div>
        <div class="kpi-sub">{{ summary.intervention_effectiveness.total_evaluated }} evaluated</div>
      </div>
    </div>

    <!-- Severity / type distribution + fatality trend -->
    <div v-if="summary" class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Incidents by Severity (30d)</div>
        </div>
        <div class="bar-list">
          <div v-for="(c, sev) in summary.incidents_by_severity" :key="sev" class="bar-row">
            <span class="bar-label">{{ sev }}</span>
            <div class="bar-track">
              <div class="bar-fill" :class="`sev-${sev}`"
                   :style="{ width: ((c / summary.kpis.total_30d) * 100) + '%' }"></div>
            </div>
            <span class="bar-value">{{ c }}</span>
          </div>
        </div>
        <div class="mt-3">
          <div class="text-label text-fg-dim mb-2">By Type</div>
          <div class="type-chips">
            <span v-for="(c, t) in summary.incidents_by_type" :key="t" class="type-chip">
              <span class="text-xs">{{ t.replace('_', ' ') }}</span>
              <span class="badge badge-neutral">{{ c }}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Predictive Hotspots &amp; Black Spots</div>
        </div>
        <div v-if="!summary.top_predictive_hotspots.length" class="card-body text-fg-muted">No hotspots.</div>
        <div v-else class="hotspot-list">
          <div v-for="h in summary.top_predictive_hotspots.slice(0, 8)" :key="h.id" class="hotspot-row">
            <span class="badge" :class="`badge-${tierBadge(h.risk_tier)}`">{{ h.risk_tier }}</span>
            <div>
              <div class="text-sm font-mono">{{ h.latitude.toFixed(4) }}, {{ h.longitude.toFixed(4) }}</div>
              <div class="text-xs text-fg-muted">Score: {{ h.predicted_risk_score.toFixed(2) }}</div>
            </div>
          </div>
        </div>
        <div v-if="summary.black_spots_by_tier && Object.keys(summary.black_spots_by_tier).length" class="mt-3">
          <div class="text-label text-fg-dim mb-2">Black Spots by Tier</div>
          <div class="bs-tiers">
            <div v-for="(c, tier) in summary.black_spots_by_tier" :key="tier" class="bs-tier">
              <span class="badge" :class="`badge-${tierBadge(String(tier))}`">{{ tier }}</span>
              <span class="font-mono text-sm">{{ c }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters + table -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">All Incidents</div>
        <div class="filter-row">
          <select v-model="severityFilter" class="select">
            <option value="">All severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
            <option value="fatal">Fatal</option>
          </select>
          <select v-model="statusFilter" class="select">
            <option value="">All statuses</option>
            <option value="reported">Reported</option>
            <option value="triaged">Triaged</option>
            <option value="dispatched">Dispatched</option>
            <option value="on_scene">On scene</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <div v-if="error" class="card-body text-fg-muted">{{ error }}</div>
      <div v-else-if="loading && !incidents.length" class="card-body text-fg-muted">Loading…</div>
      <div v-else-if="!incidents.length" class="card-body text-fg-muted">No incidents match.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Ref</th><th>Severity</th><th>Status</th><th>Type</th>
            <th>Title</th><th>Segment</th><th>Casualties</th>
            <th>Dispatches</th><th>Reported</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in incidents" :key="i.id">
            <td class="font-mono text-xs">{{ i.reference_code }}</td>
            <td><span class="badge" :class="`badge-${sevBadge(i.severity)}`">{{ i.severity }}</span></td>
            <td><span class="badge" :class="`badge-${statusBadge(i.status)}`">{{ i.status.replace('_', ' ') }}</span></td>
            <td class="text-xs">{{ i.incident_type.replace('_', ' ') }}</td>
            <td class="text-sm">{{ i.title }}</td>
            <td class="font-mono text-xs">{{ i.segment_code ?? '—' }}</td>
            <td class="font-mono text-xs">
              <span v-if="i.casualties > 0" class="text-danger">{{ i.casualties }}</span>
              <span v-else class="text-fg-dim">0</span>
            </td>
            <td class="font-mono text-xs">{{ i.dispatch_count }}</td>
            <td class="font-mono text-xs">{{ fmtDate(i.reported_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Active dispatches + Black spots -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Active Dispatches</div>
          <span class="badge badge-info">{{ dispatches.length }} active</span>
        </div>
        <div v-if="!dispatches.length" class="card-body text-fg-muted">No active dispatches.</div>
        <table v-else class="data-table">
          <thead><tr><th>Incident</th><th>Service</th><th>Status</th><th>ETA</th><th>Units</th></tr></thead>
          <tbody>
            <tr v-for="d in dispatches.slice(0, 12)" :key="d.id">
              <td class="font-mono text-xs">{{ d.incident_ref }}</td>
              <td class="text-xs">{{ d.service_type.replace('_', ' ') }}</td>
              <td><span class="badge" :class="`badge-${dispatchBadge(d.status)}`">{{ d.status.replace('_', ' ') }}</span></td>
              <td class="font-mono text-xs">{{ d.recommended_eta_minutes ?? '—' }} min</td>
              <td class="font-mono text-xs">{{ d.recommended_units ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Top Black Spots</div>
        </div>
        <div v-if="!blackspots.length" class="card-body text-fg-muted">No black spots.</div>
        <table v-else class="data-table">
          <thead><tr><th>Road</th><th>Tier</th><th>Accidents</th><th>Fatalities</th></tr></thead>
          <tbody>
            <tr v-for="b in blackspots.slice(0, 12)" :key="b.id">
              <td>
                <div class="text-sm font-medium">{{ b.segment_road_name ?? '—' }}</div>
                <div class="text-xs text-fg-muted font-mono">{{ b.segment_road_code ?? '—' }}</div>
              </td>
              <td><span class="badge" :class="`badge-${tierBadge(b.ranking_tier)}`">{{ b.ranking_tier }}</span></td>
              <td class="font-mono text-xs">{{ b.accident_count_rolling }}</td>
              <td class="font-mono text-xs text-danger">{{ b.fatality_count_rolling }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.incidents-page { display: flex; flex-direction: column; gap: 20px; }
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.kpi { padding: 14px 18px; }
.kpi-label { font-size: 0.7rem; text-transform: uppercase; color: var(--fg-muted, #8fa3b8); letter-spacing: 0.05em; }
.kpi-value { font-size: 1.6rem; font-weight: 700; margin: 6px 0 4px; }
.kpi-sub { font-size: 0.72rem; color: var(--fg-muted, #8fa3b8); }
.grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.bar-list { padding: 6px 0; }
.bar-row {
  display: grid;
  grid-template-columns: 100px 1fr 60px;
  align-items: center;
  gap: 12px;
  padding: 8px 18px;
  font-size: 0.8125rem;
}
.bar-label { text-transform: capitalize; }
.bar-track { background: rgba(255,255,255,0.04); border-radius: 4px; height: 10px; overflow: hidden; }
.bar-fill { height: 100%; }
.sev-fatal, .sev-critical { background: linear-gradient(90deg, #ef4444, #f87171); }
.sev-high { background: linear-gradient(90deg, #f97316, #fb923c); }
.sev-medium { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.sev-low { background: linear-gradient(90deg, #22d3ee, #67e8f9); }
.bar-value { font-family: 'JetBrains Mono', monospace; text-align: right; color: var(--fg-muted); }
.type-chips, .bs-tiers {
  display: flex; flex-wrap: wrap; gap: 8px; padding: 0 18px;
}
.type-chip, .bs-tier {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.03);
  padding: 4px 8px; border-radius: 4px;
}
.hotspot-list { padding: 6px 0; }
.hotspot-row {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 18px; border-bottom: 1px solid var(--border);
}
.hotspot-row:last-child { border-bottom: 0; }
.filter-row { display: flex; gap: 8px; }
.select {
  background: var(--bg-2, #0f1623);
  border: 1px solid var(--border, #1e2d42);
  color: var(--fg, #e2eaf5);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.8125rem;
}
.text-danger { color: #ef4444; }
.card-body { padding: 18px; }
.mt-3 { margin-top: 16px; }
</style>