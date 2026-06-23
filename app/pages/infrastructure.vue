<script setup lang="ts">
// pages/infrastructure.vue — M06 Infrastructure Asset Management
// Backend: /api/v1/infrastructure/ — road segments, bridges, streetlights,
//          construction projects, maintenance orders, deterioration
//          forecasts, WIM overload, maintenance budget, traffic signals.
definePageMeta({ title: 'Infrastructure' })

import { useInfrastructure } from '~/composables/api'
import type {
  InfrastructureSummary, RoadSegment, Bridge, Streetlight,
  ConstructionProject, MaintenanceOrder, DeteriorationForecast,
  ConditionClass,
} from '~/composables/api'

const infra = useInfrastructure()

const summary = ref<InfrastructureSummary | null>(null)
const segments = ref<RoadSegment[]>([])
const bridges = ref<Bridge[]>([])
const streetlights = ref<Streetlight[]>([])
const projects = ref<ConstructionProject[]>([])
const orders = ref<MaintenanceOrder[]>([])
const forecasts = ref<DeteriorationForecast[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const conditionFilter = ref<ConditionClass | ''>('')

async function load() {
  loading.value = true
  error.value = null
  try {
    const [sum, seg, br, sl, prj, mo, fc] = await Promise.all([
      infra.summary(),
      infra.segments({ page_size: 20, condition_class: conditionFilter.value || undefined }),
      infra.bridges({ page_size: 20 }),
      infra.streetlights({ page_size: 20 }),
      infra.projects({ page_size: 12 }),
      infra.maintenanceOrders({ page_size: 15 }),
      infra.atRiskForecasts(),
    ])
    summary.value = sum
    segments.value = (seg as any).results ?? []
    bridges.value = (br as any).results ?? []
    streetlights.value = (sl as any).results ?? []
    projects.value = (prj as any).results ?? []
    orders.value = (mo as any).results ?? []
    forecasts.value = (fc as any).results ?? []
  } catch (err: any) {
    error.value = err?.status === 401
      ? 'Not authenticated — please log in.'
      : err?.message ?? 'Failed to load infrastructure data.'
  } finally {
    loading.value = false
  }
}

watch(conditionFilter, () => { load() })
onMounted(load)

function fmtKES(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1e9) return `KES ${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `KES ${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `KES ${(n / 1e3).toFixed(0)}K`
  return `KES ${n.toFixed(0)}`
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-KE', { dateStyle: 'medium' })
}
function conditionBadge(c: string) {
  return c === 'good' ? 'badge-success'
       : c === 'fair' ? 'badge-info'
       : c === 'poor' ? 'badge-warning'
       : 'badge-danger'
}
function statusBadge(s: string) {
  return s === 'operational' || s === 'completed' ? 'badge-success'
       : s === 'in_progress' ? 'badge-info'
       : s === 'planned' || s === 'scheduled' ? 'badge-neutral'
       : 'badge-warning'
}
</script>

<template>
  <div class="infra-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M06</div>
        <h1 class="text-display">Infrastructure Asset Management</h1>
        <p class="text-sm text-fg-muted mt-1">
          National road network, bridges, streetlights, construction portfolio, maintenance &amp; ML deterioration forecasts.
        </p>
      </div>
      <button class="btn btn-secondary" :disabled="loading" @click="load">↻ Refresh</button>
    </div>

    <!-- KPI strip -->
    <div v-if="summary" class="kpi-grid">
      <div class="card kpi">
        <div class="kpi-label">Network</div>
        <div class="kpi-value">{{ summary.network.total_length_km.toLocaleString() }} km</div>
        <div class="kpi-sub">{{ summary.network.total_segments }} segments</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">IRI (avg)</div>
        <div class="kpi-value">{{ summary.network.iri_average.toFixed(2) }}</div>
        <div class="kpi-sub">PCI {{ summary.network.pci_average.toFixed(0) }}</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Critical Bridges</div>
        <div class="kpi-value">{{ summary.bridges.critical_count }}</div>
        <div class="kpi-sub">of {{ summary.bridges.total }} total</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Streetlights</div>
        <div class="kpi-value">{{ summary.streetlights.operational_pct }}%</div>
        <div class="kpi-sub">{{ summary.streetlights.operational }}/{{ summary.streetlights.total }} operational</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Budget {{ summary.budget.fiscal_year }}</div>
        <div class="kpi-value">{{ summary.budget.utilization_pct }}%</div>
        <div class="kpi-sub">{{ fmtKES(summary.budget.disbursed_kes) }} of {{ fmtKES(summary.budget.allocated_kes) }}</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">WIM Overload (30d)</div>
        <div class="kpi-value">{{ summary.wim.overload_rate_pct }}%</div>
        <div class="kpi-sub">{{ summary.wim.overloads_30d }} of {{ summary.wim.total_passings_30d }} passings</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Open Maintenance</div>
        <div class="kpi-value">{{ summary.maintenance.open_orders }}</div>
        <div class="kpi-sub">{{ fmtKES(summary.maintenance.open_value_kes) }} value</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">At-Risk (12mo ML)</div>
        <div class="kpi-value">{{ summary.predictive.at_risk_segments_12mo }}</div>
        <div class="kpi-sub">Deterioration forecast</div>
      </div>
    </div>

    <!-- Condition distribution + construction portfolio -->
    <div v-if="summary" class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Network Condition Distribution</div>
        </div>
        <div class="bar-list">
          <div v-for="row in summary.network.condition_distribution" :key="row.condition_class" class="bar-row">
            <span class="bar-label">{{ row.condition_class }}</span>
            <div class="bar-track">
              <div class="bar-fill" :class="`cond-${row.condition_class}`"
                   :style="{ width: ((row.total / summary.network.total_segments) * 100) + '%' }"></div>
            </div>
            <span class="bar-value">{{ row.total }} ({{ row.length?.toFixed(0) ?? '?' }} km)</span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Construction Portfolio by Corridor</div>
          <span class="badge badge-info">{{ summary.construction.in_progress }} active</span>
        </div>
        <div v-if="!summary.construction.portfolio_by_corridor.length" class="card-body text-fg-muted">No data.</div>
        <div v-else class="portfolio-list">
          <div v-for="p in summary.construction.portfolio_by_corridor" :key="p.corridor" class="portfolio-row">
            <div>
              <div class="text-sm font-medium">{{ p.corridor }}</div>
              <div class="text-xs text-fg-muted">
                {{ p.count }} projects · {{ fmtKES(p.contract_sum) }} ·
                avg {{ p.avg_physical?.toFixed(0) ?? '?' }}% physical
              </div>
            </div>
            <span class="text-sm font-mono">{{ fmtKES(p.disbursed) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Road segments -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Road Segments</div>
        <select v-model="conditionFilter" class="select">
          <option value="">All conditions</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
          <option value="critical">Critical</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div v-if="error" class="card-body text-fg-muted">{{ error }}</div>
      <div v-else-if="loading && !segments.length" class="card-body text-fg-muted">Loading…</div>
      <div v-else-if="!segments.length" class="card-body text-fg-muted">No segments match.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Road</th><th>Class</th><th>Length</th><th>Surface</th>
            <th>IRI</th><th>PCI</th><th>Condition</th><th>AADT</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in segments" :key="s.id">
            <td>
              <div class="text-sm font-medium">{{ s.road_name }}</div>
              <div class="text-xs text-fg-muted font-mono">{{ s.road_code }}</div>
            </td>
            <td><span class="badge badge-neutral">{{ s.road_class.replace('_', ' ') }}</span></td>
            <td class="font-mono text-xs">{{ s.length_km?.toFixed(1) ?? '—' }} km</td>
            <td class="text-xs">{{ s.surface_type }}</td>
            <td class="font-mono text-xs">{{ s.iri_value?.toFixed(2) ?? '—' }}</td>
            <td class="font-mono text-xs">{{ s.pci_value?.toFixed(0) ?? '—' }}</td>
            <td><span class="badge" :class="`badge-${conditionBadge(s.condition_class)}`">{{ s.condition_class }}</span></td>
            <td class="font-mono text-xs">{{ s.annual_avg_daily_traffic?.toLocaleString() ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Bridges + Streetlights -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Bridges</div>
          <span class="badge badge-neutral">{{ bridges.length }} of {{ summary?.bridges.total ?? '?' }}</span>
        </div>
        <div v-if="!bridges.length" class="card-body text-fg-muted">No bridge data.</div>
        <table v-else class="data-table">
          <thead><tr><th>Name</th><th>Type</th><th>Condition</th><th>Capacity</th></tr></thead>
          <tbody>
            <tr v-for="b in bridges.slice(0, 12)" :key="b.id">
              <td>
                <div class="text-sm font-medium">{{ b.bridge_name }}</div>
                <div class="text-xs text-fg-muted font-mono">{{ b.bridge_code }}</div>
              </td>
              <td class="text-xs">{{ b.bridge_type.replace('_', ' ') }}</td>
              <td>
                <span class="badge" :class="`badge-${conditionBadge(b.condition_class)}`">
                  {{ b.condition_class }}
                </span>
                <span v-if="b.condition_score != null" class="text-xs text-fg-muted ml-1">({{ b.condition_score.toFixed(0) }})</span>
              </td>
              <td class="font-mono text-xs">{{ b.load_capacity_tonnes?.toFixed(0) ?? '—' }} t</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Streetlights</div>
          <span class="badge badge-success" v-if="summary">{{ summary.streetlights.operational_pct }}% operational</span>
        </div>
        <table v-if="streetlights.length" class="data-table">
          <thead><tr><th>Pole</th><th>Type</th><th>Wattage</th><th>Status</th><th>Segment</th></tr></thead>
          <tbody>
            <tr v-for="s in streetlights.slice(0, 12)" :key="s.id">
              <td class="font-mono text-xs">{{ s.pole_id }}</td>
              <td class="text-xs">{{ s.lamp_type }}</td>
              <td class="font-mono text-xs">{{ s.wattage ?? '—' }}W</td>
              <td><span class="badge" :class="`badge-${statusBadge(s.status)}`">{{ s.status }}</span></td>
              <td class="font-mono text-xs">{{ s.segment_road_code ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="card-body text-fg-muted">No streetlights.</div>
      </div>
    </div>

    <!-- Construction projects -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Active Construction Projects</div>
        <span class="badge badge-neutral">{{ projects.length }}</span>
      </div>
      <div v-if="!projects.length" class="card-body text-fg-muted">No active projects.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Project</th><th>Corridor</th><th>County</th><th>Status</th>
            <th>Physical</th><th>Contract</th><th>Disbursed</th><th>Util.</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in projects" :key="p.id">
            <td>
              <div class="text-sm font-medium">{{ p.project_name }}</div>
              <div class="text-xs text-fg-muted font-mono">{{ p.project_code }}</div>
            </td>
            <td class="text-xs">{{ p.corridor }}</td>
            <td class="text-xs">{{ p.county }}</td>
            <td><span class="badge" :class="`badge-${statusBadge(p.status)}`">{{ p.status.replace('_', ' ') }}</span></td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: (p.physical_progress_pct ?? 0) + '%' }"></div>
              </div>
              <span class="font-mono text-xs">{{ p.physical_progress_pct?.toFixed(0) ?? '—' }}%</span>
            </td>
            <td class="font-mono text-xs">{{ fmtKES(p.contract_sum_kes) }}</td>
            <td class="font-mono text-xs">{{ fmtKES(p.disbursed_kes) }}</td>
            <td class="font-mono text-xs">{{ p.budget_utilization_pct?.toFixed(0) ?? '—' }}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Maintenance orders + forecasts -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Maintenance Orders</div>
          <span class="badge badge-neutral">{{ orders.length }}</span>
        </div>
        <div v-if="!orders.length" class="card-body text-fg-muted">No orders.</div>
        <table v-else class="data-table">
          <thead><tr><th>Segment</th><th>Work</th><th>Priority</th><th>Status</th><th>Cost</th></tr></thead>
          <tbody>
            <tr v-for="o in orders.slice(0, 12)" :key="o.id">
              <td class="font-mono text-xs">{{ o.segment_road_code ?? '—' }}</td>
              <td class="text-xs">{{ o.work_type }}</td>
              <td>
                <span class="badge" :class="o.priority === 'urgent' || o.priority === 'high' ? 'badge-danger' : o.priority === 'medium' ? 'badge-warning' : 'badge-neutral'">
                  {{ o.priority }}
                </span>
              </td>
              <td><span class="badge" :class="`badge-${statusBadge(o.status)}`">{{ o.status.replace('_', ' ') }}</span></td>
              <td class="font-mono text-xs">{{ fmtKES(o.cost_kes) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">At-Risk Deterioration Forecasts (ML)</div>
          <span class="badge badge-warning">{{ forecasts.length }} at risk</span>
        </div>
        <div v-if="!forecasts.length" class="card-body text-fg-muted">No forecasts flagged.</div>
        <table v-else class="data-table">
          <thead><tr><th>Segment</th><th>Predicted PCI</th><th>Failure Prob.</th><th>Horizon</th><th>Target</th></tr></thead>
          <tbody>
            <tr v-for="f in forecasts.slice(0, 12)" :key="f.id">
              <td class="font-mono text-xs">{{ f.segment_road_code ?? '—' }}</td>
              <td class="font-mono text-xs">
                {{ f.predicted_pci?.toFixed(0) ?? '—' }}
                <span class="text-fg-muted">[{{ f.lower_pci?.toFixed(0) ?? '?' }}–{{ f.upper_pci?.toFixed(0) ?? '?' }}]</span>
              </td>
              <td>
                <span class="badge" :class="(f.failure_probability ?? 0) > 0.7 ? 'badge-danger' : 'badge-warning'">
                  {{ ((f.failure_probability ?? 0) * 100).toFixed(0) }}%
                </span>
              </td>
              <td class="text-xs">{{ f.horizon_months }}mo</td>
              <td class="font-mono text-xs">{{ fmtDate(f.target_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.infra-page { display: flex; flex-direction: column; gap: 20px; }
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.kpi { padding: 14px 18px; }
.kpi-label { font-size: 0.7rem; text-transform: uppercase; color: var(--fg-muted, #8fa3b8); letter-spacing: 0.05em; }
.kpi-value { font-size: 1.5rem; font-weight: 700; margin: 6px 0 4px; }
.kpi-sub { font-size: 0.72rem; color: var(--fg-muted, #8fa3b8); }
.grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.bar-list, .portfolio-list { padding: 6px 0; }
.bar-row {
  display: grid;
  grid-template-columns: 100px 1fr 140px;
  align-items: center;
  gap: 12px;
  padding: 8px 18px;
  font-size: 0.8125rem;
}
.bar-label { text-transform: capitalize; }
.bar-track { background: rgba(255,255,255,0.04); border-radius: 4px; height: 10px; overflow: hidden; }
.bar-fill { height: 100%; }
.cond-good { background: linear-gradient(90deg, #10b981, #34d399); }
.cond-fair { background: linear-gradient(90deg, #22d3ee, #67e8f9); }
.cond-poor { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.cond-critical, .cond-failed { background: linear-gradient(90deg, #ef4444, #f87171); }
.bar-value { font-family: 'JetBrains Mono', monospace; text-align: right; color: var(--fg-muted); font-size: 0.75rem; }
.portfolio-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 18px; border-bottom: 1px solid var(--border, #1e2d42);
}
.portfolio-row:last-child { border-bottom: 0; }
.select, .search-input {
  background: var(--bg-2, #0f1623);
  border: 1px solid var(--border, #1e2d42);
  color: var(--fg, #e2eaf5);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.8125rem;
}
.progress-bar {
  display: inline-block;
  width: 70px;
  height: 6px;
  background: rgba(255,255,255,0.06);
  border-radius: 3px;
  overflow: hidden;
  margin-right: 6px;
  vertical-align: middle;
}
.progress-fill { background: linear-gradient(90deg, #3b82f6, #22d3ee); height: 100%; }
.card-body { padding: 18px; }
.ml-1 { margin-left: 4px; }
</style>