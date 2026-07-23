<template>
  <PageHeader
    eyebrow="Infrastructure - Maintenance"
    title="Maintenance Orders"
    subtitle="KeNHA · KURA · KeRRA · KRB - Road maintenance work orders, contractor progress, KRB budget allocation, and utilization tracking"
  >
    <!-- <template #actions>
      
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template> -->
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Open Orders"
      :value="fmtNum(countByStatus('planned') + countByStatus('scheduled'))"
      sub="Not yet started"
      source="live" source-title="KeNHA MMS"
    />
    <KpiCard
      label="In Progress"
      :value="fmtNum(countByStatus('in_progress'))"
      sub="Active works on-site"
      trend-direction="up"
      source="live" source-title="KeNHA MMS"
    />
    <KpiCard
      label="Completed"
      :value="fmtNum(countByStatus('completed'))"
      sub="This period"
      trend-direction="up"
      source="live" source-title="KeNHA MMS"
    />
    <KpiCard
      label="Urgent Priority"
      :value="fmtNum(urgentCount)"
      sub="Immediate action required"
      trend-direction="down"
      source="live" source-title="KeNHA MMS"
    />
    <KpiCard
      label="Total Cost (Open)"
      :value="openCost ? `KES ${fmtKES(openCost)}` : '-'"
      sub="Estimated outstanding value"
      source="batch" source-title="KeNHA MMS"
    />
    <KpiCard
      label="Budget Utilization"
      :value="summary?.budget.utilization_pct != null ? `${summary.budget.utilization_pct.toFixed(1)}%` : '-'"
      :sub="summary ? `FY${summary.budget.fiscal_year}` : '-'"
      source="batch" source-title="National Treasury"
    />
  </div>

  <!-- Work type + budget side by side -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">Orders by Work Type</div>
      <div class="card-body">
        <div v-if="byType.length" class="type-list">
          <div v-for="t in byType" :key="t.work_type ?? t.label" class="type-row">
            <span class="type-label">{{ (t.work_type ?? t.label ?? 'Other').replace(/_/g,' ') }}</span>
            <div class="type-bar-wrap">
              <div class="type-bar" :style="{ width: `${maxType > 0 ? ((t.count ?? t.total ?? 0) / maxType) * 100 : 0}%` }" />
            </div>
            <span class="type-val">{{ fmtNum(t.count ?? t.total ?? 0) }}</span>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No work type data.' }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Maintenance Budgets</div>
      <div class="card-body">
        <div v-if="budgets.length" class="budget-list">
          <div v-for="b in budgets" :key="b.id" class="budget-item">
            <div class="bi-header">
              <span style="font-weight:600">FY{{ b.fiscal_year }}</span>
              <span style="font-size:11px;color:#64748b">{{ b.agency_code ?? 'All agencies' }}</span>
              <BadgePill :variant="utilBadge(b.utilization_pct)">{{ b.utilization_pct.toFixed(0) }}%</BadgePill>
            </div>
            <div class="bi-bars">
              <div class="bi-bar-row">
                <span>Allocated</span>
                <div class="bi-bar-wrap"><div class="bi-bar" style="background:#3b82f6;width:100%" /></div>
                <span>KES {{ fmtKES(b.allocated_kes) }}</span>
              </div>
              <div class="bi-bar-row">
                <span>Disbursed</span>
                <div class="bi-bar-wrap">
                  <div class="bi-bar" style="background:#22c55e"
                    :style="{ width: `${budgetPct(b.disbursed_kes, b.allocated_kes)}%` }" />
                </div>
                <span>KES {{ fmtKES(b.disbursed_kes) }}</span>
              </div>
              <div class="bi-bar-row">
                <span>Committed</span>
                <div class="bi-bar-wrap">
                  <div class="bi-bar" style="background:#f59e0b"
                    :style="{ width: `${budgetPct(b.committed_kes, b.allocated_kes)}%` }" />
                </div>
                <span>KES {{ fmtKES(b.committed_kes) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No budget data.' }}</div>
      </div>
    </div>
  </div>

  <!-- Orders table -->
  <SectionTitle>Work Orders</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="orderSearch" class="select-sm" placeholder="Search road name…" style="min-width:180px" />
        <select v-model="statusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select v-model="priorityFilter" class="select-sm">
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select v-model="typeFilter" class="select-sm">
          <option value="">All work types</option>
          <option value="pavement">Pavement</option>
          <option value="lighting">Lighting</option>
          <option value="bridge">Bridge</option>
          <option value="drainage">Drainage</option>
          <option value="signage">Signage</option>
          <option value="marking">Road Marking</option>
          <option value="vegetation">Vegetation Control</option>
          <option value="emergency">Emergency Repair</option>
        </select>
        <button class="btn" @click="orderSearch=''; statusFilter=''; priorityFilter=''; typeFilter=''">Clear</button>
        <ExportButton filename="uapts-maintenance-orders.csv" :href="ordersExportHref" style="margin-left:auto" />
      </div>
      <table>
        <thead>
          <tr>
            <th>Road</th>
            <th>Work Type</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Contractor</th>
            <th>Progress</th>
            <th>Cost (KES)</th>
            <th>Scheduled</th>
          </tr>
        </thead>
        <tbody v-if="filteredOrders.length">
          <tr v-for="o in filteredOrders" :key="o.id">
            <td>
              <div style="font-weight:600;font-size:13px">{{ o.segment_road_name ?? o.segment_road_code ?? '-' }}</div>
              <div v-if="o.description" style="font-size:11px;color:#94a3b8">{{ o.description.slice(0,60) }}{{ o.description.length > 60 ? '…' : '' }}</div>
            </td>
            <td><BadgePill variant="info">{{ o.work_type.replace(/_/g,' ') }}</BadgePill></td>
            <td><BadgePill :variant="statusBadge(o.status)">{{ o.status.replace(/_/g,' ') }}</BadgePill></td>
            <td><BadgePill :variant="priorityBadge(o.priority)">{{ o.priority }}</BadgePill></td>
            <td style="font-size:12px">{{ o.contractor_name || '-' }}</td>
            <td>
              <div v-if="o.status === 'in_progress'" class="prog-wrap">
                <div class="prog-bar" :style="{ width: `${o.progress_pct ?? 0}%`, background: progColor(o.progress_pct) }" />
              </div>
              <span style="font-size:11px">
                {{ o.progress_pct != null ? `${o.progress_pct.toFixed(0)}%` : '-' }}
              </span>
            </td>
            <td style="font-size:12px;white-space:nowrap">
              {{ o.cost_kes != null ? `KES ${fmtKES(o.cost_kes)}` : '-' }}
            </td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtDate(o.scheduled_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading orders…' : 'No orders match the current filters.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- At-risk deterioration forecasts -->
  <SectionTitle pill="ML Model · Agency Survey">At-Risk Segments (Next 12 Months)</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="riskSearch" class="select-sm" placeholder="Search road code…" style="min-width:180px" />
        <button class="btn" @click="riskSearch=''">Clear</button>
        <ExportButton filename="uapts-at-risk-segments.csv" :rows="filteredAtRisk" :columns="atRiskExportColumns" style="margin-left:auto" />
      </div>
      <div class="table-scroll">
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
          <tbody v-if="filteredAtRisk.length">
            <tr v-for="f in filteredAtRisk" :key="f.id">
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
                {{ loading ? 'Loading forecasts…' : 'No at-risk segments match the current filters.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Traffic signal faults -->
  <SectionTitle pill="NaMATA / NCC · Live">Traffic Signal Faults</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="signalSearch" class="select-sm" placeholder="Search intersection…" style="min-width:180px" />
        <select v-model="signalStatusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="operational">Operational</option>
          <option value="faulty">Faulty</option>
          <option value="maintenance">Maintenance</option>
          <option value="offline">Offline</option>
        </select>
        <button class="btn" @click="signalSearch=''; signalStatusFilter=''">Clear</button>
        <ExportButton filename="uapts-signal-faults.csv" :rows="filteredSignalFaults" :columns="signalExportColumns" style="margin-left:auto" />
      </div>
      <div class="table-scroll">
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
          <tbody v-if="filteredSignalFaults.length">
            <tr v-for="sig in filteredSignalFaults" :key="sig.id">
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
                {{ loading ? 'Loading signals…' : 'No signal faults match the current filters.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Maintenance Orders')

import { useInfrastructure } from '~/composables/api'
import type { MaintenanceOrder, MaintenanceBudget, InfrastructureSummary, DeteriorationForecast, TrafficSignal } from '~/composables/api'

const orders  = ref<MaintenanceOrder[]>([])
const budgets = ref<MaintenanceBudget[]>([])
const byType  = ref<any[]>([])
const summary = ref<InfrastructureSummary | null>(null)
const atRisk       = ref<DeteriorationForecast[]>([])
const signalFaults = ref<TrafficSignal[]>([])
const loading = ref(true)
const error   = ref<string | null>(null)
const lastRefreshed  = ref('-')
const orderSearch    = ref('')
const statusFilter   = ref('')
const priorityFilter = ref('')
const typeFilter     = ref('')
const riskSearch         = ref('')
const signalSearch       = ref('')
const signalStatusFilter = ref('')

async function load() {
  loading.value = true
  error.value = null
  const infra = useInfrastructure()

  const [ordRes, budRes, typeRes, sumRes, riskRes, sigRes] = await Promise.allSettled([
    infra.maintenanceOrders({ page_size: 100 }),
    infra.budgets({ page_size: 10 }),
    infra.maintenanceByType(),
    infra.summary(),
    infra.atRiskForecasts(),
    infra.signalFaults(),
  ])

  if (ordRes.status  === 'fulfilled') orders.value  = (ordRes.value as any).results ?? []
  if (budRes.status  === 'fulfilled') budgets.value = (budRes.value as any).results ?? []
  if (typeRes.status === 'fulfilled') byType.value  = Array.isArray(typeRes.value) ? typeRes.value : ((typeRes.value as any).results ?? [])
  if (sumRes.status  === 'fulfilled') summary.value = sumRes.value
  if (riskRes.status === 'fulfilled') atRisk.value       = (riskRes.value as any).results ?? []
  if (sigRes.status  === 'fulfilled') signalFaults.value = (sigRes.value as any).results ?? []

  if ([ordRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Infrastructure API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const filteredOrders = computed(() =>
  orders.value.filter(o => {
    if (orderSearch.value && !(o.segment_road_name ?? o.segment_road_code ?? '').toLowerCase().includes(orderSearch.value.toLowerCase())) return false
    if (statusFilter.value   && o.status    !== statusFilter.value)   return false
    if (priorityFilter.value && o.priority  !== priorityFilter.value) return false
    if (typeFilter.value     && o.work_type !== typeFilter.value)     return false
    return true
  }),
)
// Real server-side export (honors the same django-filter params as the list
// endpoint) - more complete than exporting only the currently-loaded page.
const ordersExportHref = computed(() => {
  const q = new URLSearchParams({ format: 'csv' })
  if (statusFilter.value) q.set('status', statusFilter.value)
  if (priorityFilter.value) q.set('priority', priorityFilter.value)
  if (typeFilter.value) q.set('work_type', typeFilter.value)
  if (orderSearch.value) q.set('search', orderSearch.value)
  return `/api/v1/infrastructure/maintenance-orders/export/?${q.toString()}`
})

const filteredAtRisk = computed(() =>
  atRisk.value.filter(f => {
    if (riskSearch.value) {
      const q = riskSearch.value.toLowerCase()
      if (!(f.segment_road_code ?? f.segment ?? '').toLowerCase().includes(q)) return false
    }
    return true
  }),
)
const atRiskExportColumns = [
  { key: 'segment_road_code', label: 'Road Code' },
  { key: 'model_name', label: 'Model' },
  { key: 'predicted_condition_class', label: 'Predicted Condition' },
  { key: 'failure_probability', label: 'Failure Probability' },
  { key: 'predicted_pci', label: 'Predicted PCI' },
  { key: 'horizon_months', label: 'Horizon (months)' },
  { key: 'confidence_pct', label: 'Confidence %' },
  { key: 'generated_at', label: 'Generated' },
]

const filteredSignalFaults = computed(() =>
  signalFaults.value.filter(sig => {
    if (signalSearch.value && !sig.intersection_name.toLowerCase().includes(signalSearch.value.toLowerCase())) return false
    if (signalStatusFilter.value && sig.status !== signalStatusFilter.value) return false
    return true
  }),
)
const signalExportColumns = [
  { key: 'intersection_name', label: 'Intersection' },
  { key: 'intersection_code', label: 'Code' },
  { key: 'status', label: 'Status' },
  { key: 'mode', label: 'Mode' },
  { key: 'agency_code', label: 'Agency' },
  { key: 'last_status_change_at', label: 'Last Change' },
]

function countByStatus(s: string) { return orders.value.filter(o => o.status === s).length }
const urgentCount = computed(() => orders.value.filter(o => o.priority === 'urgent').length)
const openCost    = computed(() =>
  orders.value
    .filter(o => !['completed','cancelled'].includes(o.status))
    .reduce((s, o) => s + (parseFloat(o.cost_kes ?? '') || 0), 0),
)
const maxType = computed(() => Math.max(1, ...byType.value.map(t => t.count ?? t.total ?? 0)))

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(v: number | string | null | undefined) {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (n == null || isNaN(n)) return '-'
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
function statusBadge(s: string) {
  const m: Record<string,string> = { in_progress:'info', completed:'success', scheduled:'fair', planned:'neutral', on_hold:'warning', cancelled:'danger' }
  return m[s] ?? 'neutral'
}
function priorityBadge(s: string) {
  const m: Record<string,string> = { urgent:'danger', high:'warning', medium:'fair', low:'success' }
  return m[s] ?? 'neutral'
}
function progColor(pct: number | null | undefined) {
  if (pct == null) return '#94a3b8'
  return pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#3b82f6'
}
function utilBadge(pct: number) {
  return pct >= 80 ? 'success' : pct >= 50 ? 'fair' : 'warning'
}
function budgetPct(part: string, whole: string) {
  const w = parseFloat(whole) || 0
  const p = parseFloat(part) || 0
  return w > 0 ? (p / w) * 100 : 0
}
function condBadge(cls: string) {
  const m: Record<string,string> = { very_good:'success', good:'success', fair:'fair', poor:'warning', very_poor:'danger', under_con:'info' }
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
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(165px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.type-list { display:flex; flex-direction:column; gap:8px; }
.type-row { display:grid; grid-template-columns:110px 1fr 40px; align-items:center; gap:8px; }
.type-label { font-size:12px; text-transform:capitalize; }
.type-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.type-bar { height:100%; background:#3b82f6; border-radius:4px; }
.type-val { font-size:11px; text-align:right; }
.budget-list { display:flex; flex-direction:column; gap:14px; }
.budget-item { border:1px solid #f1f5f9; border-radius:6px; padding:10px 12px; }
.bi-header { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.bi-bars { display:flex; flex-direction:column; gap:5px; }
.bi-bar-row { display:grid; grid-template-columns:60px 1fr 80px; align-items:center; gap:6px; font-size:11px; }
.bi-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; }
.bi-bar { height:100%; border-radius:4px; transition:width .4s; }
.prog-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.prog-bar { height:100%; border-radius:4px; transition:width .4s; }
</style>
