<template>
  <PageHeader
    eyebrow="Public Transport - PSV Compliance"
    title="PSV Compliance & Licensing"
    subtitle="NTSA · NaMATA - PSV licence status, expiry alerts, NaMATA route compliance, GPS tracking rates, and SACCO registration"
  >
    <template #actions>
      <NuxtLink to="/public-transport/vehicle-inspections" class="btn">Vehicle Inspections →</NuxtLink>
      <NuxtLink to="/public-transport/operators" class="btn">Public Operators →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI strip -->
  <div class="kpi-grid">
    <KpiCard
      label="Active Licences"
      :value="fmtNum(kpis.active)"
      sub="Currently valid PSV licences"
      source="batch" source-title="NTSA PSV Registry"
    />
    <KpiCard
      label="Expiring ≤30d"
      :value="fmtNum(kpis.exp30)"
      sub="Urgent renewal required"
      trend-direction="down"
      source="batch" source-title="NTSA PSV Registry"
    />
    <KpiCard
      label="Expiring 31–90d"
      :value="fmtNum(kpis.exp90)"
      sub="Plan renewals ahead"
      source="batch" source-title="NTSA PSV Registry"
    />
    <KpiCard
      label="Expired / Suspended"
      :value="fmtNum(kpis.expired + kpis.suspended)"
      sub="Immediate enforcement action"
      trend-direction="down"
      source="batch" source-title="NTSA PSV Registry"
    />
    <KpiCard
      label="Avg GPS Compliance"
      :value="avgGpsCompliance ? `${avgGpsCompliance.toFixed(1)}%` : '-'"
      sub="Across all active licences"
      :trend-direction="avgGpsCompliance && avgGpsCompliance >= 90 ? 'up' : 'down'"
      source="live" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="Active SACCOs"
      :value="fmtNum(activeSaccos)"
      :sub="`${fmtNum(saccos.length)} total registered`"
      source="batch" source-title="NTSA"
    />
  </div>

  <!-- Expiry alerts -->
  <SectionTitle pill="NTSA PSV Registry · Batch">Upcoming Expiry Alerts</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="expiringLicenses.length">
        <AlertItem
          v-for="l in expiringLicenses.slice(0, 20)"
          :key="l.id"
          :severity="daysUntil(l.expiry_date) <= 30 ? 'critical' : daysUntil(l.expiry_date) <= 60 ? 'warning' : 'info'"
          :title="`${l.license_number} - ${l.sacco_name ?? 'Unknown SACCO'}`"
          :meta="`Route: ${l.route_name ?? '-'} · Expires: ${fmtDate(l.expiry_date)} · ${daysUntil(l.expiry_date)}d remaining · GPS: ${l.gps_compliance_pct.toFixed(0)}%`"
        />
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">
        {{ loading ? 'Loading expiry data…' : 'No licences expiring in the next 90 days.' }}
      </div>
    </div>
  </div>

  <!-- Licence table with filters -->
  <SectionTitle>PSV Licence Registry</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="statusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
          <option value="revoked">Revoked</option>
        </select>
        <input v-model="saccoSearch" class="select-sm" placeholder="Search SACCO…" style="min-width:160px" />
        <button class="btn" @click="load">Apply</button>
        <button class="btn" @click="statusFilter = ''; saccoSearch = ''">Clear</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Licence No.</th>
            <th>SACCO</th>
            <th>Route</th>
            <th>Issued</th>
            <th>Expires</th>
            <th>Days Left</th>
            <th>GPS Compliance</th>
            <th>Vehicles</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody v-if="filteredLicenses.length">
          <tr v-for="l in filteredLicenses" :key="l.id">
            <td style="font-family:monospace;font-size:12px">{{ l.license_number }}</td>
            <td style="font-weight:600">{{ l.sacco_name ?? '-' }}</td>
            <td style="font-size:12px">{{ l.route_name ?? '-' }}</td>
            <td style="font-size:12px">{{ fmtDate(l.issue_date) }}</td>
            <td style="font-size:12px">{{ fmtDate(l.expiry_date) }}</td>
            <td>
              <span :style="{ color: daysColor(daysUntil(l.expiry_date)), fontWeight: '600' }">
                {{ daysUntil(l.expiry_date) }}d
              </span>
            </td>
            <td>
              <div class="gps-bar-wrap">
                <div class="gps-bar" :style="{ width: `${l.gps_compliance_pct}%`, background: gpsBg(l.gps_compliance_pct) }" />
              </div>
              <span style="font-size:11px">{{ l.gps_compliance_pct.toFixed(0) }}%</span>
            </td>
            <td>{{ fmtNum(l.vehicle_count) }}</td>
            <td><BadgePill :variant="statusBadge(l.status)">{{ l.status }}</BadgePill></td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading licences…' : 'No licences match the current filters.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- SACCO compliance status table -->
  <div class="card">
    <div class="card-header">
      SACCO Registration Status
      <NuxtLink to="/public-transport/operators" class="link-sm">Full operator registry →</NuxtLink>
    </div>
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>SACCO Name</th>
            <th>Status</th>
            <th>Fleet Size</th>
            <th>Routes</th>
            <th>Service Quality</th>
          </tr>
        </thead>
        <tbody v-if="saccos.length">
          <tr v-for="s in saccos" :key="s.id">
            <td style="font-weight:600">{{ s.sacco_name }}</td>
            <td><BadgePill :variant="saccoStatus(s.registration_status)">{{ s.registration_status }}</BadgePill></td>
            <td>{{ fmtNum(s.fleet_size) }}</td>
            <td>{{ fmtNum(s.route_count) }}</td>
            <td>
              <div class="gps-bar-wrap">
                <div class="gps-bar" :style="{ width: `${s.service_quality_score}%`, background: gpsBg(s.service_quality_score) }" />
              </div>
              <span style="font-size:11px">{{ s.service_quality_score.toFixed(0) }}/100</span>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading…' : 'No SACCO data' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Compliance summary by check type -->
  <SectionTitle pill="NaMATA / NTSA">Compliance by Check Type</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="Object.keys(complianceSummary).length" class="compliance-grid">
        <div
          v-for="(val, checkType) in complianceSummary"
          :key="checkType"
          class="chk-card"
        >
          <div class="chk-name">{{ String(checkType).replace(/_/g,' ') }}</div>
          <div class="chk-row">
            <span class="chk-ok">{{ fmtNum(val.compliant) }} OK</span>
            <span class="chk-flag">{{ fmtNum(val.flagged) }} flagged</span>
            <span class="chk-viol">{{ fmtNum(val.violation) }} violation</span>
          </div>
          <div class="chk-bar-wrap">
            <div class="chk-bar chk-ok-bar" :style="{ width: `${val.total > 0 ? (val.compliant / val.total) * 100 : 0}%` }" />
            <div class="chk-bar chk-flag-bar" :style="{ width: `${val.total > 0 ? (val.flagged / val.total) * 100 : 0}%` }" />
            <div class="chk-bar chk-viol-bar" :style="{ width: `${val.total > 0 ? (val.violation / val.total) * 100 : 0}%` }" />
          </div>
        </div>
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">
        {{ loading ? 'Loading compliance summary…' : 'No compliance summary available.' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('PSV Compliance')

import { usePublicTransport } from '~/composables/api'
import type { PSVLicense, Sacco } from '~/composables/api'

const licenses          = ref<PSVLicense[]>([])
const expiringLicenses  = ref<PSVLicense[]>([])
const saccos            = ref<Sacco[]>([])
const complianceSummary = ref<Record<string, { compliant: number; flagged: number; violation: number; total: number }>>({})
const loading      = ref(true)
const error        = ref<string | null>(null)
const lastRefreshed = ref('-')
const statusFilter = ref('')
const saccoSearch  = ref('')

async function load() {
  loading.value = true
  error.value = null
  const pt = usePublicTransport()

  const [licRes, expRes, saccosRes, compRes] = await Promise.allSettled([
    pt.psvLicenses({ page_size: 100 }),
    pt.expiringLicenses(90),
    pt.saccos({ page_size: 50 }),
    pt.complianceSummary(),
  ])

  if (licRes.status     === 'fulfilled') licenses.value          = (licRes.value as any).results ?? []
  if (expRes.status     === 'fulfilled') expiringLicenses.value  = Array.isArray(expRes.value) ? expRes.value : ((expRes.value as any).results ?? [])
  if (saccosRes.status  === 'fulfilled') saccos.value            = (saccosRes.value as any).results ?? []
  if (compRes.status    === 'fulfilled') complianceSummary.value = (compRes.value as any) ?? {}

  if ([licRes, expRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Public Transport API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ─────────────────────────────────────────────────────────────
const filteredLicenses = computed(() =>
  licenses.value.filter(l => {
    if (statusFilter.value && l.status !== statusFilter.value) return false
    if (saccoSearch.value  && !(l.sacco_name ?? '').toLowerCase().includes(saccoSearch.value.toLowerCase())) return false
    return true
  }),
)

const kpis = computed(() => ({
  active:    licenses.value.filter(l => l.status === 'active').length,
  exp30:     expiringLicenses.value.filter(l => daysUntil(l.expiry_date) <= 30).length,
  exp90:     expiringLicenses.value.filter(l => daysUntil(l.expiry_date) > 30).length,
  expired:   licenses.value.filter(l => l.status === 'expired').length,
  suspended: licenses.value.filter(l => l.status === 'suspended').length,
}))

const avgGpsCompliance = computed(() => {
  const active = licenses.value.filter(l => l.status === 'active')
  if (!active.length) return null
  return active.reduce((s, l) => s + l.gps_compliance_pct, 0) / active.length
})

const activeSaccos = computed(() => saccos.value.filter(s => s.registration_status === 'active').length)

// ── Helpers ──────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function daysUntil(dateStr: string): number {
  try { return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000) }
  catch { return 999 }
}
function daysColor(d: number) {
  return d <= 30 ? '#ef4444' : d <= 60 ? '#f59e0b' : '#22c55e'
}
function gpsBg(pct: number) {
  return pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'
}
function statusBadge(s: string) {
  const m: Record<string,string> = { active:'success', expired:'danger', suspended:'warning', revoked:'neutral' }
  return m[s] ?? 'neutral'
}
function saccoStatus(s: string) {
  const m: Record<string,string> = { active:'success', suspended:'warning', revoked:'danger' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(165px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.gps-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; display:flex; }
.gps-bar { height:100%; border-radius:4px; transition:width .4s; }
.compliance-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
.chk-card { border:1px solid #f1f5f9; border-radius:6px; padding:10px 12px; }
.chk-name { font-size:12px; font-weight:600; text-transform:capitalize; margin-bottom:6px; }
.chk-row { display:flex; gap:12px; font-size:11px; margin-bottom:6px; }
.chk-ok { color:#22c55e; }
.chk-flag { color:#f59e0b; }
.chk-viol { color:#ef4444; }
.chk-bar-wrap { display:flex; height:6px; border-radius:4px; overflow:hidden; }
.chk-bar { height:100%; }
.chk-ok-bar { background:#22c55e; }
.chk-flag-bar { background:#f59e0b; }
.chk-viol-bar { background:#ef4444; }
.link-sm { font-size:12px; color:#3b82f6; text-decoration:none; }
</style>
