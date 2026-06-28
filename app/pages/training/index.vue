<template>
  <PageHeader
    eyebrow="Training Institutes"
    title="Training Management"
    subtitle="NTSA · KMA · KCAA · NITA-K - Accredited transport & safety training: course catalogue, cohort scheduling, enrollments, and certificate issuance"
  >
    <template #actions>
      <NuxtLink to="/training/cohorts" class="btn">Cohorts →</NuxtLink>
      <NuxtLink to="/training/completions" class="btn-primary">Certificates →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI grid -->
  <div class="kpi-grid">
    <KpiCard
      label="Active Courses"
      :value="fmtNum(activeCourses.length)"
      sub="Across all institutes"
      source="live" source-title="UAPTS Training API"
    />
    <KpiCard
      label="Cohorts Running"
      :value="fmtNum(ongoingCohorts.length)"
      sub="Status: ongoing"
      source="live" source-title="UAPTS Training API"
    />
    <KpiCard
      label="Scheduled Cohorts"
      :value="fmtNum(scheduledCohorts.length)"
      sub="Upcoming - not started"
      source="live" source-title="UAPTS Training API"
    />
    <KpiCard
      label="Total Enrolled"
      :value="fmtNum(enrollments.length)"
      sub="Latest page · all statuses"
      source="live" source-title="UAPTS Training API"
    />
    <KpiCard
      label="Pass Rate"
      :value="passRateLabel"
      sub="Completions · pass + distinction"
      :trend-direction="passRate >= 70 ? 'up' : 'down'"
      source="batch" source-title="UAPTS Training API"
    />
    <KpiCard
      label="Certificates Issued"
      :value="fmtNum(validCerts.length)"
      sub="Valid & active"
      source="batch" source-title="NTSA / KCAA / KMA"
    />
  </div>

  <!-- Course catalogue -->
  <SectionTitle>Course Catalogue</SectionTitle>
  <div class="filter-row" style="margin-bottom:10px">
    <input v-model="courseSearch" class="filter-input" placeholder="Search courses…" />
    <select v-model="courseCategory" class="select-sm">
      <option value="">All categories</option>
      <option value="class_b_light">Class B - Light Vehicle</option>
      <option value="class_c_heavy">Class C - Heavy Goods</option>
      <option value="class_d_psv">Class D - PSV</option>
      <option value="defensive_driving">Defensive Driving</option>
      <option value="first_aid">First Aid</option>
      <option value="maritime_basic">Maritime Basic</option>
      <option value="aviation_ground">Aviation Ground</option>
    </select>
    <select v-model="courseDelivery" class="select-sm">
      <option value="">All modes</option>
      <option value="in_person">In Person</option>
      <option value="online">Online</option>
      <option value="blended">Blended</option>
    </select>
    <button class="btn" @click="loadCourses">Apply</button>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Course Name</th>
            <th>Institute</th>
            <th>Category</th>
            <th>Mode</th>
            <th>Cert. Body</th>
            <th>Duration</th>
            <th>Fee (KES)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody v-if="courses.length">
          <tr v-for="c in courses" :key="c.id">
            <td class="mono-cell">{{ c.course_code }}</td>
            <td class="name-cell">{{ c.name }}</td>
            <td>{{ c.institute_name }}</td>
            <td>
              <BadgePill :variant="catBadge(c.course_category)" size="sm">{{ catLabel(c.course_category) }}</BadgePill>
            </td>
            <td class="dim-cell">{{ modeLabel(c.delivery_mode) }}</td>
            <td><span class="cert-chip">{{ certLabel(c.certification_body) }}</span></td>
            <td class="dim-cell">{{ c.duration_hours ? c.duration_hours + 'h' : c.duration_days ? c.duration_days + 'd' : '-' }}</td>
            <td class="num-bold">{{ c.fee_kes ? fmtKes(c.fee_kes) : '-' }}</td>
            <td>
              <BadgePill :variant="c.is_active ? 'success' : 'neutral'" size="sm">
                {{ c.is_active ? 'Active' : 'Inactive' }}
              </BadgePill>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="9" class="empty-row">{{ loading ? 'Loading…' : 'No courses found.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Upcoming cohorts -->
  <SectionTitle>Upcoming & Running Cohorts</SectionTitle>
  <div class="card" style="margin-bottom:16px">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Cohort Code</th>
            <th>Course</th>
            <th>Institute</th>
            <th>Start</th>
            <th>End</th>
            <th>Capacity</th>
            <th>Fill Rate</th>
            <th>Facilitator</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody v-if="recentCohorts.length">
          <tr v-for="h in recentCohorts" :key="h.id">
            <td class="mono-cell">{{ h.cohort_code }}</td>
            <td class="name-cell">{{ h.course_detail?.name ?? '-' }}</td>
            <td class="dim-cell">{{ h.course_detail?.institute_name ?? '-' }}</td>
            <td class="dim-cell">{{ fmtDate(h.start_date) }}</td>
            <td class="dim-cell">{{ fmtDate(h.end_date) }}</td>
            <td>{{ h.enrolled_count }} / {{ h.capacity }}</td>
            <td>
              <div class="fill-bar-wrap">
                <div class="fill-bar" :style="{ width: Math.min(h.fill_rate_pct, 100) + '%', background: fillColor(h.fill_rate_pct) }" />
              </div>
              <span class="dim-cell">{{ h.fill_rate_pct?.toFixed(0) }}%</span>
            </td>
            <td class="dim-cell">{{ h.facilitator_name ?? '-' }}</td>
            <td>
              <BadgePill :variant="cohortBadge(h.status)" size="sm">{{ h.status }}</BadgePill>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="9" class="empty-row">{{ loading ? 'Loading…' : 'No cohorts found.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Recent completions snapshot -->
  <SectionTitle>Recent Certificate Issuances</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Certificate No.</th>
            <th>Student</th>
            <th>Outcome</th>
            <th>Score</th>
            <th>Attendance</th>
            <th>Issued By</th>
            <th>Issued</th>
            <th>Expiry</th>
            <th>Valid</th>
          </tr>
        </thead>
        <tbody v-if="completions.length">
          <tr v-for="cp in completions.slice(0, 10)" :key="cp.id">
            <td class="mono-cell">{{ cp.certificate_number || '-' }}</td>
            <td class="name-cell">{{ cp.enrollment_detail?.full_name ?? cp.enrollment }}</td>
            <td>
              <BadgePill :variant="outcomeBadge(cp.outcome)" size="sm">{{ outcomeLabel(cp.outcome) }}</BadgePill>
            </td>
            <td class="num-bold">{{ cp.score_pct != null ? cp.score_pct.toFixed(1) + '%' : '-' }}</td>
            <td class="dim-cell">{{ cp.attendance_rate_pct != null ? cp.attendance_rate_pct.toFixed(0) + '%' : '-' }}</td>
            <td class="dim-cell">{{ cp.issued_by_name || '-' }}</td>
            <td class="dim-cell">{{ fmtDate(cp.certificate_issued_at) }}</td>
            <td class="dim-cell">{{ cp.certificate_expiry ? fmtDate(cp.certificate_expiry) : 'No expiry' }}</td>
            <td>
              <BadgePill :variant="cp.is_certificate_valid ? 'success' : 'danger'" size="sm">
                {{ cp.is_certificate_valid ? 'Valid' : 'Expired' }}
              </BadgePill>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="9" class="empty-row">{{ loading ? 'Loading…' : 'No completions data.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Training')

import { useTraining } from '~/composables/api'
import type { TrainingCourse, TrainingCohort, TrainingEnrollment, TrainingCompletion } from '~/composables/api'

const courses     = ref<TrainingCourse[]>([])
const cohorts     = ref<TrainingCohort[]>([])
const enrollments = ref<TrainingEnrollment[]>([])
const completions = ref<TrainingCompletion[]>([])
const loading     = ref(true)
const error       = ref<string | null>(null)

// Filters
const courseSearch   = ref('')
const courseCategory = ref('')
const courseDelivery = ref('')

const training = useTraining()

async function loadCourses() {
  const res = await training.courses({
    page_size: 50,
    is_active: true,
    ...(courseSearch.value   ? { search: courseSearch.value }           : {}),
    ...(courseCategory.value ? { course_category: courseCategory.value } : {}),
    ...(courseDelivery.value ? { delivery_mode: courseDelivery.value }   : {}),
  })
  courses.value = res.results ?? []
}

async function load() {
  loading.value = true
  error.value   = null

  const [cRes, hRes, eRes, cpRes] = await Promise.allSettled([
    training.courses({ page_size: 50, is_active: true }),
    training.cohorts({ page_size: 50, ordering: 'start_date' }),
    training.enrollments({ page_size: 50 }),
    training.completions({ page_size: 20 }),
  ])

  if (cRes.status  === 'fulfilled') courses.value     = (cRes.value  as any).results ?? []
  if (hRes.status  === 'fulfilled') cohorts.value     = (hRes.value  as any).results ?? []
  if (eRes.status  === 'fulfilled') enrollments.value = (eRes.value  as any).results ?? []
  if (cpRes.status === 'fulfilled') completions.value = (cpRes.value as any).results ?? []

  if ([cRes, hRes, eRes, cpRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Training API.'

  loading.value = false
}

onMounted(load)

// ── Computed ──────────────────────────────────────────────────────────

const activeCourses    = computed(() => courses.value.filter(c => c.is_active))
const ongoingCohorts   = computed(() => cohorts.value.filter(h => h.status === 'ongoing'))
const scheduledCohorts = computed(() => cohorts.value.filter(h => h.status === 'scheduled'))
const recentCohorts    = computed(() =>
  cohorts.value.filter(h => h.status === 'scheduled' || h.status === 'ongoing').slice(0, 15),
)
const validCerts  = computed(() => completions.value.filter(c => c.is_certificate_valid))
const passedCerts = computed(() => completions.value.filter(c => c.outcome === 'pass' || c.outcome === 'distinction'))
const passRate    = computed(() => {
  const total = completions.value.length
  return total ? Math.round((passedCerts.value.length / total) * 100) : 0
})
const passRateLabel = computed(() => completions.value.length ? passRate.value + '%' : '-')

// ── Helpers ───────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined) {
  if (v == null) return '-'
  return v.toLocaleString()
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}
function fmtKes(v: string | null) {
  if (!v) return '-'
  const n = parseFloat(v)
  return isNaN(n) ? v : n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const CAT_LABELS: Record<string, string> = {
  class_a_motorcycle: 'Class A', class_b_light: 'Class B', class_c_heavy: 'Class C',
  class_d_psv: 'Class D - PSV', class_e_special: 'Class E', defensive_driving: 'Defensive',
  first_aid: 'First Aid', maritime_basic: 'Maritime Basic', maritime_advanced: 'Maritime Adv.',
  aviation_ground: 'Aviation Ground', aviation_cabin_crew: 'Cabin Crew', other: 'Other',
}
function catLabel(c: string | null) { return CAT_LABELS[c ?? ''] ?? c ?? '-' }
function catBadge(c: string | null) {
  if (!c) return 'neutral'
  if (c.startsWith('class_')) return 'info'
  if (c === 'defensive_driving') return 'warning'
  if (c.startsWith('maritime')) return 'fair'
  if (c.startsWith('aviation')) return 'success'
  return 'neutral'
}
const MODE_LABELS: Record<string, string> = { in_person: 'In Person', online: 'Online', blended: 'Blended' }
function modeLabel(m: string | null | undefined) { return MODE_LABELS[m ?? ''] ?? m ?? '-' }
const CERT_LABELS: Record<string, string> = { ntsa: 'NTSA', kcaa: 'KCAA', kma: 'KMA', nita: 'NITA-K', other: 'Other' }
function certLabel(b: string | null | undefined) { return CERT_LABELS[b ?? ''] ?? (b ?? '-') }

function cohortBadge(s: string) {
  const m: Record<string, string> = { scheduled: 'info', ongoing: 'success', completed: 'neutral', cancelled: 'danger' }
  return m[s] ?? 'neutral'
}
function fillColor(pct: number) {
  if (pct >= 90) return '#22c55e'
  if (pct >= 60) return '#f59e0b'
  return '#ef4444'
}

const OUTCOME_LABELS: Record<string, string> = {
  pass: 'Pass', fail: 'Fail', distinction: 'Distinction',
  incomplete: 'Incomplete', deferred_resit: 'Deferred',
}
function outcomeLabel(o: string) { return OUTCOME_LABELS[o] ?? o }
function outcomeBadge(o: string) {
  const m: Record<string, string> = {
    pass: 'success', distinction: 'success', fail: 'danger',
    incomplete: 'warning', deferred_resit: 'fair',
  }
  return m[o] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; margin-bottom:16px; }

.filter-row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.filter-input { padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; min-width:160px; }
.filter-select { padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; cursor:pointer; }

.mono-cell  { font-family:monospace; font-size:12px; font-weight:600; color:#1e293b; white-space:nowrap; }
.name-cell  { font-weight:500; color:#1e293b; max-width:220px; }
.num-bold   { font-weight:700; color:#1e293b; }
.dim-cell   { font-size:12px; color:#64748b; white-space:nowrap; }
.empty-row  { text-align:center; color:#94a3b8; font-size:13px; padding:24px; }

.cert-chip { font-size:11px; font-weight:700; padding:2px 7px; border-radius:4px; background:#f0f9ff; color:#0369a1; border:1px solid #bae6fd; }

.fill-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; width:80px; overflow:hidden; display:inline-block; vertical-align:middle; margin-right:6px; }
.fill-bar { height:100%; border-radius:4px; transition:width .3s ease; }
</style>
