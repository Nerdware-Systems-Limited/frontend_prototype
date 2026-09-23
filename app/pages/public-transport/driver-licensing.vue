<template>
  <PageHeader
    eyebrow="Public Transport · NTSA"
    title="Driver Licensing"
    subtitle="NTSA - Driver identity registry, driving-licence classes, endorsements, demerit points, PSV badges and expiry tracking"
  >
    <template #actions>
      <NuxtLink to="/public-transport/operators" class="btn">Public Operators →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>
  
  <!-- KPI strip (computed client-side - no dashboard summary endpoint exists for this module) -->
  <div class="kpi-grid">
    <KpiCard label="Licences (loaded)" :value="fmtNum(licences.length)" :unavailable="loading || licencesError" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Drivers feed unavailable'" period="LIVE" description="Most recent records" to="#driver-registry" />
    <KpiCard label="Active" :value="fmtNum(countByStatus('active'))" :unavailable="loading || licencesError" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Drivers feed unavailable'" period="LIVE" description="Valid to drive" />
    <KpiCard label="Suspended" :value="fmtNum(countByStatus('suspended'))" :unavailable="loading || licencesError" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Drivers feed unavailable'" period="LIVE" description="Driving privileges paused" />
    <KpiCard label="Revoked" :value="fmtNum(countByStatus('revoked'))" :unavailable="loading || licencesError" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Drivers feed unavailable'" period="LIVE" description="Permanently withdrawn" />
    <KpiCard label="Expired" :value="fmtNum(countByStatus('expired'))" :unavailable="loading || licencesError" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Drivers feed unavailable'" period="LIVE" description="Renewal overdue" />
    <KpiCard label="PSV Endorsed" :value="fmtNum(psvLicences.length)" :unavailable="loading || licencesError" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Drivers feed unavailable'" period="LIVE" description="Licensed to carry passengers" to="#psv-licences-table" />
    <KpiCard label="Avg Demerit Points" :value="avgDemerit != null ? avgDemerit.toFixed(1) : '-'" :unavailable="loading || licencesError" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Drivers feed unavailable'" period="LIVE" description="Across loaded licences" />
    <KpiCard label="High Demerit (≥8)" :value="fmtNum(highDemerit.length)" :unavailable="loading || licencesError" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Drivers feed unavailable'" period="LIVE" description="Approaching suspension threshold" to="#expiry-alerts" />
    <KpiCard label="Expiring ≤30d" :value="fmtNum(expiring.length)" :unavailable="loading || expiringError" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Drivers feed unavailable'" period="30D" description="Renewal due soon" to="#expiry-alerts" />
    <KpiCard label="Expired-but-Active" :value="fmtNum(expiredButActive.length)" :unavailable="loading || licencesError" :unavailable-note="loading ? 'Loading…' : 'Computed feed unavailable'" period="LIVE" description="Data-quality risk flag" to="#expiry-alerts" />
  </div>

  <!-- Expiry & compliance alerts -->
  <SectionTitle pill="Computed · Rolling">Expiry &amp; Compliance Alerts</SectionTitle>
  <div id="expiry-alerts" class="card drill-target">
    <div class="card-body">
      <div v-if="alerts.length">
        <AlertItem v-for="(a, i) in alerts" :key="i" :severity="a.severity" :title="a.title" :meta="a.meta" />
      </div>
      <EmptyState v-else :loading="loading" message="No expiry or compliance alerts in the loaded registry." icon="search" compact />
    </div>
  </div>

  <!-- PSV-endorsed drivers -->
  <SectionTitle pill="Class D / PSV Badge">PSV-Endorsed Licences</SectionTitle>
  <div id="psv-licences-table" class="card drill-target">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Licence No.</th><th>Driver</th><th>Class</th><th>PSV Badge No.</th><th>Badge Expiry</th><th>Demerit Points</th><th>Status</th>
            </tr>
          </thead>
          <tbody v-if="psvLicences.length">
            <tr v-for="d in psvPageRows" :key="d.id">
              <td style="font-family:monospace;font-size:11px">{{ d.license_number }}</td>
              <td style="font-size:12px">{{ d.driver_name }}</td>
              <td>{{ formatClass(d.license_class) }}</td>
              <td style="font-family:monospace;font-size:12px">{{ d.psv_badge_no || '-' }}</td>
              <td style="font-size:11px">{{ fmtDate(d.psv_badge_expiry) }}</td>
              <td>
                <span :style="{ color: d.demerit_points >= 8 ? 'var(--danger-fg)' : d.demerit_points >= 4 ? 'var(--warning-fg)' : 'var(--success-fg)' }">{{ d.demerit_points }}</span>
              </td>
              <td><BadgePill :variant="statusBadge(d.status)">{{ d.status }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="7" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No PSV-endorsed licences in the loaded registry.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="psvPage" :total-pages="psvTotalPages" :total="psvTotal"
          @prev="psvPrev" @next="psvNext"
        />
      </div>
    </div>
  </div>

  <!-- Driver registry -->
  <SectionTitle pill="NTSA Fleet Drivers · Rolling">Driver Registry</SectionTitle>
  <div id="driver-registry" class="card drill-target">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Full Name</th><th>Phone</th><th>Date of Birth</th><th>Agency</th><th>Operator</th><th>National ID</th></tr></thead>
          <tbody v-if="drivers.length">
            <tr v-for="d in driversPageRows" :key="d.id">
              <td style="font-weight:600;font-size:12px">{{ d.full_name }}</td>
              <td style="font-size:12px">{{ d.phone || '-' }}</td>
              <td style="font-size:11px">{{ fmtDate(d.date_of_birth) }}</td>
              <td style="font-size:12px">{{ d.agency_code ?? '-' }}</td>
              <td style="font-size:12px">{{ d.operator_name ?? '-' }}</td>
              <td style="font-family:monospace;font-size:11px;color:var(--fg-3)">{{ d.national_id ?? 'masked' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="6" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading drivers…' : 'No drivers in the loaded registry.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="driversPage" :total-pages="driversTotalPages" :total="driversTotal"
          @prev="driversPrev" @next="driversNext"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useDriverLicensing } from '~/composables/api'
import type { Driver, DriverLicence } from '~/composables/api'

const drivers  = ref<Driver[]>([])
const licences = ref<DriverLicence[]>([])
const expiring = ref<DriverLicence[]>([])
const loading  = ref(true)
const error    = ref<string | null>(null)
const licencesError = ref(false)
const expiringError = ref(false)

const search       = ref('')
const statusFilter = ref('')
const psvOnly      = ref(false)

async function load() {
  loading.value = true
  error.value = null
  const dl = useDriverLicensing()

  // Note: the backend endpoint has no full-text search param (search=
  // is a silent no-op there - see useDriverLicensing.ts), so the search
  // box below filters the loaded page client-side instead.
  const [drvRes, licRes, expRes] = await Promise.allSettled([
    dl.drivers({ page_size: 100 }),
    dl.licences({ page_size: 100 }),
    dl.expiring(30),
  ])

  if (drvRes.status === 'fulfilled') drivers.value  = (drvRes.value as any).results ?? []
  if (licRes.status === 'fulfilled') licences.value = (licRes.value as any).results ?? []
  if (expRes.status === 'fulfilled') expiring.value = Array.isArray(expRes.value) ? expRes.value : ((expRes.value as any).results ?? [])

  licencesError.value = licRes.status === 'rejected'
  expiringError.value = expRes.status === 'rejected'

  if ([drvRes, licRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Fleet Drivers/Licences API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

function clearFilters() {
  search.value = ''; statusFilter.value = ''; psvOnly.value = false
  load()
}

// ── Filters ──────────────────────────────────────────────────────────────
const filteredLicences = computed(() => licences.value.filter(d => {
  if (statusFilter.value && d.status !== statusFilter.value) return false
  if (psvOnly.value && !d.is_psv) return false
  if (search.value) {
    const q = search.value.toLowerCase()
    const hay = `${d.license_number} ${d.driver_name}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}))

const psvLicences = computed(() => licences.value.filter(d => d.is_psv))

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: psvPageRows, page: psvPage, totalPages: psvTotalPages,
  total: psvTotal, next: psvNext, prev: psvPrev,
} = usePagination(psvLicences, 15)

const {
  pageRows: driversPageRows, page: driversPage, totalPages: driversTotalPages,
  total: driversTotal, next: driversNext, prev: driversPrev,
} = usePagination(drivers, 15)

// ── KPIs (all computed client-side from real loaded records) ────────────
function countByStatus(s: string) { return licences.value.filter(d => d.status === s).length }
const avgDemerit = computed(() => licences.value.length ? licences.value.reduce((s, d) => s + d.demerit_points, 0) / licences.value.length : null)
const highDemerit = computed(() => licences.value.filter(d => d.demerit_points >= 8))
const expiredButActive = computed(() => licences.value.filter(d => d.is_expired && d.status === 'active'))

const alerts = computed(() => {
  const list: { severity: 'critical' | 'warning' | 'info'; title: string; meta: string }[] = []
  for (const d of expiredButActive.value)
    list.push({ severity: 'critical', title: `${d.license_number} - expired but marked active`, meta: `${d.driver_name} · expired ${fmtDate(d.expiry_date)}` })
  for (const d of highDemerit.value)
    list.push({ severity: 'warning', title: `${d.license_number} - demerit points at ${d.demerit_points}`, meta: `${d.driver_name} · approaching suspension threshold` })
  for (const d of expiring.value)
    list.push({ severity: 'info', title: `${d.license_number} - renewal due`, meta: `${d.driver_name} · expires ${fmtDate(d.expiry_date)}` })
  return list.slice(0, 20)
})

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'2-digit' }) }
  catch { return s }
}
function formatClass(c: string | string[]) {
  return Array.isArray(c) ? c.join(', ') : c
}
function statusBadge(s: string) {
  const m: Record<string,string> = { active:'success', suspended:'warning', revoked:'danger', expired:'danger' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.privacy-note { margin:0 0 14px; padding:8px 14px; border-radius:6px; background:var(--info-bg); border:1px solid color-mix(in srgb, var(--info-fg) 30%, transparent); font-size:12px; color:var(--info-fg); }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.checkbox-label { display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; }
.table-scroll { overflow-x:auto; }
</style>
