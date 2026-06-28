<template>
  <PageHeader
    eyebrow="Training Institutes"
    title="Student Enrollments"
    subtitle="All student registrations across NTSA · KMA · KCAA · NITA-K cohorts - track confirmation, payment status, and attendance"
  >
    <template #actions>
      <NuxtLink to="/training/cohorts" class="btn">← Cohorts</NuxtLink>
      <NuxtLink to="/training/completions" class="btn-primary">Certificates →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Total Enrollments" :value="fmtNum(enrollments.length)" sub="This page" source="live" source-title="UAPTS Training API" />
    <KpiCard label="Confirmed" :value="fmtNum(byStatus('confirmed') + byStatus('attending'))" sub="Confirmed + Attending" source="live" source-title="UAPTS Training API" />
    <KpiCard label="Registered (Pending)" :value="fmtNum(byStatus('registered'))" sub="Awaiting confirmation" source="live" source-title="UAPTS Training API" />
    <KpiCard label="Fully Paid" :value="fmtNum(byPayment('paid'))" sub="Payment status: paid" source="live" source-title="UAPTS Training API" />
    <KpiCard label="Unpaid" :value="fmtNum(byPayment('unpaid'))" sub="Action required" :trend-direction="byPayment('unpaid') === 0 ? 'up' : 'down'" source="live" source-title="UAPTS Training API" />
    <KpiCard label="Withdrawn" :value="fmtNum(byStatus('withdrawn'))" sub="Withdrawn / deferred" source="batch" source-title="UAPTS Training API" />
  </div>

  <!-- Filters -->
  <div class="filter-row" style="margin-bottom:10px">
    <input v-model="search" class="filter-input" placeholder="Search name / National ID…" />
    <select v-model="statusFilter" class="select-sm">
      <option value="">All statuses</option>
      <option value="registered">Registered</option>
      <option value="confirmed">Confirmed</option>
      <option value="attending">Attending</option>
      <option value="completed">Completed</option>
      <option value="failed">Failed</option>
      <option value="withdrawn">Withdrawn</option>
      <option value="deferred">Deferred</option>
    </select>
    <select v-model="paymentFilter" class="select-sm">
      <option value="">All payment statuses</option>
      <option value="unpaid">Unpaid</option>
      <option value="partial">Partial</option>
      <option value="paid">Paid</option>
      <option value="waived">Waived</option>
      <option value="refunded">Refunded</option>
    </select>
    <button class="btn" @click="load">Apply</button>
    <span class="result-count" v-if="!loading">{{ filtered.length }} records</span>
    <span v-if="loading" class="loading-note">Loading…</span>
  </div>

  <!-- Enrollment table -->
  <SectionTitle>Enrollment Register</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>National ID</th>
            <th>Full Name</th>
            <th>Cohort</th>
            <th>Course</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Status</th>
            <th>Payment</th>
            <th>Paid (KES)</th>
            <th>Enrolled</th>
            <th>Confirmed</th>
          </tr>
        </thead>
        <tbody v-if="filtered.length">
          <tr v-for="e in filtered" :key="e.id">
            <td class="mono-cell">{{ e.national_id }}</td>
            <td class="name-cell">{{ e.full_name || '-' }}</td>
            <td class="mono-cell">{{ e.cohort_detail?.cohort_code ?? e.cohort }}</td>
            <td class="dim-cell">{{ e.cohort_detail?.course_name ?? '-' }}</td>
            <td class="dim-cell">{{ e.phone_number || '-' }}</td>
            <td class="dim-cell">{{ e.email || '-' }}</td>
            <td>
              <BadgePill :variant="statusBadge(e.status)" size="sm">{{ statusLabel(e.status) }}</BadgePill>
            </td>
            <td>
              <BadgePill :variant="paymentBadge(e.payment_status)" size="sm">{{ paymentLabel(e.payment_status) }}</BadgePill>
            </td>
            <td class="num-bold">{{ e.amount_paid_kes ? fmtKes(e.amount_paid_kes) : '-' }}</td>
            <td class="dim-cell">{{ fmtDate(e.enrolled_at) }}</td>
            <td class="dim-cell">{{ e.confirmed_at ? fmtDate(e.confirmed_at) : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="11" class="empty-row">
              {{ loading ? 'Loading enrollments…' : 'No enrollments match the selected filters.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Payment summary breakdown -->
  <SectionTitle pill="computed" style="margin-top:20px">Payment Status Breakdown</SectionTitle>
  <div class="payment-breakdown-grid">
    <div v-for="row in paymentBreakdown" :key="row.status" class="breakdown-card">
      <div class="breakdown-count">{{ fmtNum(row.count) }}</div>
      <div class="breakdown-label">
        <BadgePill :variant="paymentBadge(row.status)" size="sm">{{ row.label }}</BadgePill>
      </div>
      <div class="breakdown-amount">KES {{ fmtKes(String(row.totalKes)) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Training')

import { useTraining } from '~/composables/api'
import type { TrainingEnrollment } from '~/composables/api'

const enrollments   = ref<TrainingEnrollment[]>([])
const loading       = ref(true)
const error         = ref<string | null>(null)
const search        = ref('')
const statusFilter  = ref('')
const paymentFilter = ref('')

const training = useTraining()

async function load() {
  loading.value = true
  error.value   = null

  try {
    const res = await training.enrollments({
      page_size: 100,
      ordering: '-enrolled_at',
      ...(statusFilter.value  ? { status: statusFilter.value }          : {}),
      ...(paymentFilter.value ? { payment_status: paymentFilter.value } : {}),
      ...(search.value        ? { search: search.value }                : {}),
    })
    enrollments.value = res.results ?? []
  } catch {
    error.value = 'Unable to reach the UAPTS Training API.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ── Computed ──────────────────────────────────────────────────────────

const filtered = computed(() => {
  if (!search.value) return enrollments.value
  const q = search.value.toLowerCase()
  return enrollments.value.filter(e =>
    e.national_id.toLowerCase().includes(q)
    || (e.full_name ?? '').toLowerCase().includes(q)
    || (e.cohort_detail?.cohort_code ?? '').toLowerCase().includes(q),
  )
})

function byStatus(s: string) { return enrollments.value.filter(e => e.status === s).length }
function byPayment(s: string) { return enrollments.value.filter(e => e.payment_status === s).length }

const paymentBreakdown = computed(() => {
  const statuses = ['unpaid', 'partial', 'paid', 'waived', 'refunded'] as const
  const labels: Record<string, string> = {
    unpaid: 'Unpaid', partial: 'Partially Paid', paid: 'Fully Paid', waived: 'Waived', refunded: 'Refunded',
  }
  return statuses.map(s => {
    const rows = enrollments.value.filter(e => e.payment_status === s)
    const totalKes = rows.reduce((sum, e) => sum + (parseFloat(e.amount_paid_kes) || 0), 0)
    return { status: s, label: labels[s], count: rows.length, totalKes }
  }).filter(r => r.count > 0)
})

// ── Helpers ───────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined) { return v == null ? '-' : v.toLocaleString() }
function fmtDate(d: string | null | undefined) {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}
function fmtKes(v: string | null) {
  if (!v) return '0'
  const n = parseFloat(v)
  return isNaN(n) ? v : n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const STATUS_LABELS: Record<string, string> = {
  registered: 'Registered', confirmed: 'Confirmed', attending: 'Attending',
  completed: 'Completed', failed: 'Failed', withdrawn: 'Withdrawn', deferred: 'Deferred',
}
function statusLabel(s: string) { return STATUS_LABELS[s] ?? s }
function statusBadge(s: string) {
  const m: Record<string, string> = {
    registered: 'info', confirmed: 'success', attending: 'success',
    completed: 'neutral', failed: 'danger', withdrawn: 'warning', deferred: 'fair',
  }
  return m[s] ?? 'neutral'
}

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid', waived: 'Waived', refunded: 'Refunded',
}
function paymentLabel(s: string) { return PAYMENT_LABELS[s] ?? s }
function paymentBadge(s: string) {
  const m: Record<string, string> = {
    unpaid: 'danger', partial: 'warning', paid: 'success', waived: 'info', refunded: 'neutral',
  }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.filter-input { padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; min-width:180px; }
.filter-select { padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; cursor:pointer; }
.loading-note { font-size:12px; color:#94a3b8; }
.result-count { font-size:12px; color:#64748b; margin-left:4px; }

.mono-cell  { font-family:monospace; font-size:12px; font-weight:600; color:#1e293b; white-space:nowrap; }
.name-cell  { font-weight:500; color:#1e293b; }
.num-bold   { font-weight:700; color:#1e293b; }
.dim-cell   { font-size:12px; color:#64748b; white-space:nowrap; }
.empty-row  { text-align:center; color:#94a3b8; font-size:13px; padding:24px; }

.payment-breakdown-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-top:8px; }
.breakdown-card { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:16px; text-align:center; }
.breakdown-count { font-size:28px; font-weight:700; color:#1e293b; margin-bottom:6px; }
.breakdown-label { margin-bottom:8px; }
.breakdown-amount { font-size:12px; color:#64748b; font-weight:500; }
</style>
