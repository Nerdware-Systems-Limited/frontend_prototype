<template>
  <PageHeader
    eyebrow="Public Transport - Public Operators"
    title="Public Operators"
    subtitle="NaMATA · NTSA · NCTTCA - SACCO/operator registry, service quality, fleet & route compliance, revenue and complaint drill-down"
  >
    <template #actions>
      <NuxtLink to="/public-transport/compliance" class="btn">PSV Compliance →</NuxtLink>
      <NuxtLink to="/public-transport/vehicle-inspections" class="btn">Inspections →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Registered Operators"
      :value="fmtNum(saccos.length)"
      :sub="`${fmtNum(kpis.active)} active`"
      source="batch" source-title="NTSA PSV Registry"
    />
    <KpiCard
      label="Suspended"
      :value="fmtNum(kpis.suspended)"
      sub="Registration suspended"
      trend-direction="down"
      source="batch" source-title="NTSA PSV Registry"
    />
    <KpiCard
      label="Revoked"
      :value="fmtNum(kpis.revoked)"
      sub="Registration revoked"
      trend-direction="down"
      source="batch" source-title="NTSA PSV Registry"
    />
    <KpiCard
      label="Total Fleet Size"
      :value="fmtNum(kpis.fleetSize)"
      sub="Across all operators"
      source="batch" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="Active Routes"
      :value="fmtNum(kpis.activeRoutes)"
      :sub="`${fmtNum(routes.length)} total routes served`"
      source="live" source-title="NaMATA GTFS-RT"
    />
    <KpiCard
      label="Avg Service Quality"
      :value="kpis.avgQuality != null ? kpis.avgQuality.toFixed(0) + '/100' : '-'"
      sub="Composite score, all operators"
      :trend-direction="kpis.avgQuality && kpis.avgQuality >= 70 ? 'up' : 'down'"
      source="batch" source-title="NaMATA"
    />
    <KpiCard
      label="Open Complaints"
      :value="fmtNum(kpis.openComplaints)"
      sub="Unresolved passenger feedback"
      trend-direction="down"
      source="live" source-title="NaMATA Feedback"
    />
    <KpiCard
      label="Route Compliance"
      :value="kpis.routeCompliance != null ? kpis.routeCompliance.toFixed(1) + '%' : '-'"
      sub="Compliant checks / total checks"
      :trend-direction="kpis.routeCompliance && kpis.routeCompliance >= 85 ? 'up' : 'down'"
      source="batch" source-title="NaMATA / NTSA"
    />
    <KpiCard
      label="Avg GPS Compliance"
      :value="kpis.avgGps != null ? kpis.avgGps.toFixed(1) + '%' : '-'"
      sub="Across active PSV licences"
      :trend-direction="kpis.avgGps && kpis.avgGps >= 90 ? 'up' : 'down'"
      source="live" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="PSV Licence Compliance"
      :value="kpis.licenceCompliance != null ? kpis.licenceCompliance.toFixed(1) + '%' : '-'"
      sub="Active licences / total issued"
      source="batch" source-title="NTSA PSV Registry"
    />
  </div>

  <!-- Registry -->
  <SectionTitle pill="NaMATA / NTSA · Rolling">Operator / SACCO Registry</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="search" class="select-sm" placeholder="Search SACCO name…" style="min-width:180px" />
        <select v-model="statusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="revoked">Revoked</option>
        </select>
        <select v-model="serviceTypeFilter" class="select-sm">
          <option value="">All service types</option>
          <option value="matatu">Matatu</option>
          <option value="brt">BRT</option>
          <option value="ferry">Ferry</option>
          <option value="rail">Rail</option>
        </select>
        <select v-model="fleetBandFilter" class="select-sm">
          <option value="">All fleet sizes</option>
          <option value="small">Small (&lt; 20 vehicles)</option>
          <option value="medium">Medium (20-49)</option>
          <option value="large">Large (50+)</option>
        </select>
        <select v-model="complaintFilter" class="select-sm">
          <option value="">All complaint levels</option>
          <option value="open">Has open complaints</option>
          <option value="none">No open complaints</option>
        </select>
        <select v-model="sortKey" class="select-sm">
          <option value="sacco_name">Name</option>
          <option value="fleet_size">Fleet size</option>
          <option value="service_quality_score">Service quality</option>
          <option value="route_compliance">Route compliance</option>
          <option value="complaint_count">Complaints</option>
          <option value="revenue">Revenue</option>
        </select>
        <button class="btn" @click="clearFilters">Clear</button>
        <ExportButton
          filename="uapts-operators.csv"
          :rows="exportRows"
          :columns="exportColumns"
          style="margin-left:auto"
        />
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>SACCO / Operator</th>
              <th>Status</th>
              <th>Contact</th>
              <th>Routes</th>
              <th>Fleet</th>
              <th>Service Quality</th>
              <th>Route Compliance</th>
              <th>Complaints</th>
              <th>Revenue (period)</th>
              <th>Fleet Util %</th>
              <th>Payment Channels</th>
              <th>Last Refresh</th>
            </tr>
          </thead>
          <tbody v-if="filteredOperators.length">
            <template v-for="op in filteredOperators" :key="op.id">
              <tr class="op-row" @click="toggleExpand(op.id)">
                <td class="expand-cell">{{ expandedId === op.id ? '▾' : '▸' }}</td>
                <td style="font-weight:600">{{ op.sacco_name }}</td>
                <td><BadgePill :variant="statusBadge(op.registration_status)">{{ op.registration_status }}</BadgePill></td>
                <td style="font-size:12px">{{ op.contact_phone ?? '-' }}</td>
                <td>{{ fmtNum(op.route_count) }}</td>
                <td>{{ fmtNum(op.fleet_size) }}</td>
                <td>
                  <div class="util-bar-wrap">
                    <div class="util-bar" :style="{ width: `${op.service_quality_score}%`, background: scoreBg(op.service_quality_score) }" />
                  </div>
                  <span style="font-size:11px">{{ op.service_quality_score.toFixed(0) }}/100</span>
                </td>
                <td>
                  <span v-if="op.route_compliance != null" :style="{ color: scoreBg(op.route_compliance) }">
                    {{ op.route_compliance.toFixed(0) }}%
                  </span>
                  <span v-else style="color:#94a3b8">-</span>
                </td>
                <td>
                  <span :style="{ color: op.complaint_count > 5 ? '#ef4444' : op.complaint_count > 0 ? '#f59e0b' : '#22c55e' }">
                    {{ fmtNum(op.complaint_count) }}
                  </span>
                </td>
                <td style="font-size:12px">{{ op.revenue != null ? fmtKES(op.revenue) : '-' }}</td>
                <td style="font-size:12px">{{ op.fleet_utilization_pct != null ? op.fleet_utilization_pct.toFixed(0) + '%' : '-' }}</td>
                <td style="font-size:11px;text-transform:capitalize">{{ op.payment_channels.join(', ') || '-' }}</td>
                <td style="font-size:11px">{{ op.last_refresh ? fmtDate(op.last_refresh) : '-' }}</td>
              </tr>
              <tr v-if="expandedId === op.id" class="op-detail-row">
                <td :colspan="13">
                  <div class="drilldown">
                    <div class="dd-col">
                      <div class="dd-title">Routes Served ({{ op.routesForSacco.length }})</div>
                      <div v-if="op.routesForSacco.length" class="dd-list">
                        <div v-for="r in op.routesForSacco" :key="r.id" class="dd-item">
                          <span style="font-weight:600">{{ r.route_name }}</span>
                          <BadgePill variant="info">{{ r.service_type }}</BadgePill>
                          <span style="color:#94a3b8">{{ r.stop_count }} stops · KES {{ r.fare_kes }}</span>
                        </div>
                      </div>
                      <div v-else class="dd-empty">No routes on file.</div>
                    </div>

                    <div class="dd-col">
                      <div class="dd-title">PSV Licences ({{ op.licensesForSacco.length }})</div>
                      <div v-if="op.licensesForSacco.length" class="dd-list">
                        <div v-for="l in op.licensesForSacco" :key="l.id" class="dd-item">
                          <span style="font-family:monospace">{{ l.license_number }}</span>
                          <BadgePill :variant="statusBadge(l.status)">{{ l.status }}</BadgePill>
                          <span style="color:#94a3b8">exp {{ fmtDate(l.expiry_date) }} · GPS {{ l.gps_compliance_pct.toFixed(0) }}%</span>
                        </div>
                      </div>
                      <div v-else class="dd-empty">No PSV licences on file.</div>
                    </div>

                    <div class="dd-col">
                      <div class="dd-title">Service Quality Components</div>
                      <div v-if="op.qualityForSacco.length" class="dd-list">
                        <div v-for="q in op.qualityForSacco" :key="q.id" class="dd-item dd-item-block">
                          <span style="color:#94a3b8">{{ fmtDate(q.period_start) }} – {{ fmtDate(q.period_end) }}</span>
                          <span>On-time {{ q.on_time_pct.toFixed(0) }}% · Complaint rate {{ q.complaint_rate.toFixed(2) }} · Vehicle age {{ q.vehicle_age_score.toFixed(0) }} · Occupancy {{ q.occupancy_score.toFixed(0) }}</span>
                        </div>
                      </div>
                      <div v-else class="dd-empty">No service-quality records.</div>
                    </div>

                    <div class="dd-col">
                      <div class="dd-title">Complaints / Feedback ({{ op.feedbackForSacco.length }})</div>
                      <div v-if="op.feedbackForSacco.length" class="dd-list">
                        <div v-for="f in op.feedbackForSacco.slice(0, 8)" :key="f.id" class="dd-item dd-item-block">
                          <span>
                            <BadgePill :variant="fbStatusBadge(f.status)">{{ f.status }}</BadgePill>
                            {{ f.category.replace(/_/g,' ') }} · {{ f.rating }}★
                          </span>
                          <span style="color:#94a3b8">{{ f.text || '(no comment)' }}</span>
                        </div>
                      </div>
                      <div v-else class="dd-empty">No feedback on file.</div>
                    </div>

                    <div class="dd-col">
                      <div class="dd-title">Enforcement / Compliance Flags</div>
                      <div v-if="op.complianceForSacco.length" class="dd-list">
                        <div v-for="c in op.complianceForSacco.slice(0, 8)" :key="c.id" class="dd-item">
                          <BadgePill :variant="complianceBadge(c.status)">{{ c.status }}</BadgePill>
                          <span>{{ c.check_type }} · {{ c.route_name ?? c.route }}</span>
                        </div>
                      </div>
                      <div v-else class="dd-empty">No compliance checks recorded.</div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
          <tbody v-else>
            <tr>
              <td colspan="13" style="text-align:center;color:#94a3b8;padding:16px">
                {{ loading ? 'Loading operators…' : 'No operators match the current filters.' }}
              </td>
            </tr>
          </tbody>
        </table>
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
useNavSubtitle('Public Operators')

import { usePublicTransport } from '~/composables/api'
import type {
  Sacco, Route, OperatorMetric, ServiceQualityScore,
  PassengerFeedback, DemandForecast, PSVLicense, PaymentTransaction,
} from '~/composables/api'

type ComplianceRecord = { id: string; route: string; route_name?: string; check_type: string; status: string; notes: string; checked_at: string }

const saccos       = ref<Sacco[]>([])
const routes       = ref<Route[]>([])
const metrics      = ref<OperatorMetric[]>([])
const quality      = ref<ServiceQualityScore[]>([])
const feedback     = ref<PassengerFeedback[]>([])
const licenses     = ref<PSVLicense[]>([])
const payments     = ref<PaymentTransaction[]>([])
const compliance   = ref<ComplianceRecord[]>([])
const forecasts    = ref<DemandForecast[]>([])
const loading      = ref(true)
const error        = ref<string | null>(null)
const lastRefreshed = ref('-')

const search            = ref('')
const statusFilter      = ref('')
const serviceTypeFilter = ref('')
const fleetBandFilter   = ref('')
const complaintFilter   = ref('')
const sortKey           = ref('sacco_name')
const expandedId        = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const pt = usePublicTransport()

  const [saccosRes, routesRes, metricsRes, qualityRes, feedbackRes, licensesRes, paymentsRes, complianceRes, forecastsRes] = await Promise.allSettled([
    pt.saccos({ page_size: 100 }),
    pt.routes({ page_size: 200 }),
    pt.operatorMetrics({ page_size: 200 }),
    pt.serviceQuality({ page_size: 200 }),
    pt.feedback({ page_size: 200 }),
    pt.psvLicenses({ page_size: 200 }),
    pt.payments({ page_size: 200 }),
    pt.compliance({ page_size: 200 }),
    pt.demandForecasts({ page_size: 24 }),
  ])

  if (saccosRes.status     === 'fulfilled') saccos.value     = (saccosRes.value as any).results ?? []
  if (routesRes.status     === 'fulfilled') routes.value     = (routesRes.value as any).results ?? []
  if (metricsRes.status    === 'fulfilled') metrics.value    = (metricsRes.value as any).results ?? []
  if (qualityRes.status    === 'fulfilled') quality.value    = (qualityRes.value as any).results ?? []
  if (feedbackRes.status   === 'fulfilled') feedback.value   = (feedbackRes.value as any).results ?? []
  if (licensesRes.status   === 'fulfilled') licenses.value   = (licensesRes.value as any).results ?? []
  if (paymentsRes.status   === 'fulfilled') payments.value   = (paymentsRes.value as any).results ?? []
  if (complianceRes.status === 'fulfilled') compliance.value = (complianceRes.value as any).results ?? []
  if (forecastsRes.status  === 'fulfilled') forecasts.value  = (forecastsRes.value as any).results ?? []

  if ([saccosRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Public Transport API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}
function clearFilters() {
  search.value = ''; statusFilter.value = ''; serviceTypeFilter.value = ''
  fleetBandFilter.value = ''; complaintFilter.value = ''; sortKey.value = 'sacco_name'
}

// ── Per-operator aggregation ────────────────────────────────────────────
const operators = computed(() => saccos.value.map(s => {
  const routesForSacco     = routes.value.filter(r => r.sacco === s.id)
  const routeIds           = new Set(routesForSacco.map(r => r.id))
  const licensesForSacco   = licenses.value.filter(l => l.sacco === s.id)
  const feedbackForSacco   = feedback.value.filter(f => f.sacco === s.id)
  const qualityForSacco    = quality.value.filter(q => q.sacco === s.id)
  const metricsForSacco    = metrics.value
    .filter(m => m.sacco === s.id)
    .sort((a, b) => (a.period_end < b.period_end ? 1 : -1))
  const latestMetric       = metricsForSacco[0] ?? null
  const complianceForSacco = compliance.value.filter(c => routeIds.has(c.route))
  const paymentsForSacco   = payments.value.filter(p => p.route && routeIds.has(p.route))

  const compliantCount = complianceForSacco.filter(c => c.status === 'compliant').length
  const routeCompliance = complianceForSacco.length ? (compliantCount / complianceForSacco.length) * 100 : null

  const revenue = latestMetric?.revenue_kes != null ? Number(latestMetric.revenue_kes)
    : (paymentsForSacco.length ? paymentsForSacco.reduce((sum, p) => sum + Number(p.amount_kes || 0), 0) : null)

  const paymentChannels = [...new Set(paymentsForSacco.map(p => p.provider))]

  return {
    id: s.id,
    sacco_name: s.sacco_name,
    registration_status: s.registration_status,
    contact_phone: s.contact_phone,
    route_count: s.route_count,
    fleet_size: s.fleet_size,
    service_quality_score: s.service_quality_score,
    route_compliance: routeCompliance,
    complaint_count: feedbackForSacco.filter(f => f.status === 'open').length,
    revenue,
    fleet_utilization_pct: latestMetric?.fleet_utilization_pct ?? null,
    payment_channels: paymentChannels,
    last_refresh: latestMetric?.period_end ?? s.updated_at ?? null,
    routesForSacco, licensesForSacco, feedbackForSacco, qualityForSacco, complianceForSacco,
  }
}))

const filteredOperators = computed(() => {
  let list = operators.value.filter(op => {
    if (search.value && !op.sacco_name.toLowerCase().includes(search.value.toLowerCase())) return false
    if (statusFilter.value && op.registration_status !== statusFilter.value) return false
    if (serviceTypeFilter.value && !op.routesForSacco.some(r => r.service_type === serviceTypeFilter.value)) return false
    if (fleetBandFilter.value === 'small'  && !(op.fleet_size < 20)) return false
    if (fleetBandFilter.value === 'medium' && !(op.fleet_size >= 20 && op.fleet_size < 50)) return false
    if (fleetBandFilter.value === 'large'  && !(op.fleet_size >= 50)) return false
    if (complaintFilter.value === 'open' && !(op.complaint_count > 0)) return false
    if (complaintFilter.value === 'none' && !(op.complaint_count === 0)) return false
    return true
  })
  const key = sortKey.value
  return [...list].sort((a: any, b: any) => {
    if (key === 'sacco_name') return a.sacco_name.localeCompare(b.sacco_name)
    const av = Number(a[key] ?? 0), bv = Number(b[key] ?? 0)
    return bv - av
  })
})

// ── Export (current filtered view) ──────────────────────────────────────
const exportColumns = [
  { key: 'sacco_name', label: 'SACCO / Operator' },
  { key: 'registration_status', label: 'Status' },
  { key: 'contact_phone', label: 'Contact' },
  { key: 'route_count', label: 'Routes' },
  { key: 'fleet_size', label: 'Fleet' },
  { key: 'service_quality_score', label: 'Service Quality' },
  { key: 'route_compliance', label: 'Route Compliance %' },
  { key: 'complaint_count', label: 'Complaints' },
  { key: 'revenue', label: 'Revenue (KES)' },
  { key: 'fleet_utilization_pct', label: 'Fleet Util %' },
  { key: 'payment_channels', label: 'Payment Channels' },
  { key: 'last_refresh', label: 'Last Refresh' },
]
const exportRows = computed(() => filteredOperators.value.map(op => ({
  ...op,
  payment_channels: op.payment_channels.join(', '),
})))

// ── KPIs ─────────────────────────────────────────────────────────────────
const kpis = computed(() => {
  const active    = saccos.value.filter(s => s.registration_status === 'active').length
  const suspended = saccos.value.filter(s => s.registration_status === 'suspended').length
  const revoked   = saccos.value.filter(s => s.registration_status === 'revoked').length
  const fleetSize = saccos.value.reduce((sum, s) => sum + (s.fleet_size ?? 0), 0)
  const activeRoutes = routes.value.filter(r => r.is_active).length
  const avgQuality = saccos.value.length
    ? saccos.value.reduce((sum, s) => sum + s.service_quality_score, 0) / saccos.value.length
    : null
  const openComplaints = feedback.value.filter(f => f.status === 'open').length
  const compliant = compliance.value.filter(c => c.status === 'compliant').length
  const routeCompliance = compliance.value.length ? (compliant / compliance.value.length) * 100 : null
  const activeLicenses = licenses.value.filter(l => l.status === 'active')
  const avgGps = activeLicenses.length
    ? activeLicenses.reduce((sum, l) => sum + l.gps_compliance_pct, 0) / activeLicenses.length
    : null
  const licenceCompliance = licenses.value.length
    ? (activeLicenses.length / licenses.value.length) * 100
    : null

  return { active, suspended, revoked, fleetSize, activeRoutes, avgQuality, openComplaints, routeCompliance, avgGps, licenceCompliance }
})

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
function scoreBg(pct: number) {
  return pct >= 85 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'
}
function statusBadge(s: string) {
  const m: Record<string,string> = { active:'success', expired:'danger', suspended:'warning', revoked:'danger' }
  return m[s] ?? 'neutral'
}
function fbStatusBadge(s: string) {
  const m: Record<string,string> = { open:'warning', investigating:'info', resolved:'success', closed:'neutral' }
  return m[s] ?? 'neutral'
}
function complianceBadge(s: string) {
  const m: Record<string,string> = { compliant:'success', flagged:'warning', violation:'danger' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(165px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
.util-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.util-bar { height:100%; border-radius:4px; transition:width .4s; }
.op-row { cursor:pointer; }
.expand-cell { width:18px; color:#94a3b8; font-size:11px; }
.op-detail-row td { background:#fafbfc; padding:14px 18px; border-bottom:1px solid #f1f5f9; }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; }
.dd-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#64748b; margin-bottom:8px; }
.dd-list { display:flex; flex-direction:column; gap:6px; }
.dd-item { display:flex; align-items:center; gap:8px; font-size:12px; flex-wrap:wrap; }
.dd-item-block { flex-direction:column; align-items:flex-start; gap:2px; }
.dd-empty { font-size:12px; color:#94a3b8; }
</style>
