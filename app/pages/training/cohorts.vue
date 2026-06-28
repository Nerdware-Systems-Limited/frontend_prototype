<template>
  <PageHeader
    eyebrow="Training Institutes"
    title="Cohort Management"
    subtitle="Schedule and track training cohorts across all NTSA · KMA · KCAA accredited institutes - capacity, fill rates, sessions, and enrollment counts"
  >
    <template #actions>
      <NuxtLink to="/training" class="btn">← Overview</NuxtLink>
      <NuxtLink to="/training/enrollments" class="btn-primary">Enrollments →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Total Cohorts" :value="fmtNum(cohorts.length)" sub="This page" source="live" source-title="UAPTS Training API" />
    <KpiCard label="Ongoing" :value="fmtNum(byStatus('ongoing'))" sub="Currently running" source="live" source-title="UAPTS Training API" />
    <KpiCard label="Scheduled" :value="fmtNum(byStatus('scheduled'))" sub="Not yet started" source="live" source-title="UAPTS Training API" />
    <KpiCard label="Completed" :value="fmtNum(byStatus('completed'))" sub="Closed cohorts" source="batch" source-title="UAPTS Training API" />
    <KpiCard label="Total Enrolled" :value="fmtNum(totalEnrolled)" sub="Across all cohorts" source="live" source-title="UAPTS Training API" />
    <KpiCard label="Avg Fill Rate" :value="avgFillRate ? avgFillRate.toFixed(0) + '%' : '-'" sub="Capacity utilisation" :trend-direction="avgFillRate >= 70 ? 'up' : 'down'" source="live" source-title="UAPTS Training API" />
  </div>

  <!-- Filters -->
  <div class="filter-row" style="margin-bottom:10px">
    <input v-model="search" class="filter-input" placeholder="Search cohort code or course…" />
    <select v-model="statusFilter" class="select-sm">
      <option value="">All statuses</option>
      <option value="scheduled">Scheduled</option>
      <option value="ongoing">Ongoing</option>
      <option value="completed">Completed</option>
      <option value="cancelled">Cancelled</option>
    </select>
    <button class="btn" @click="load">Apply</button>
    <span v-if="loading" class="loading-note">Loading…</span>
  </div>

  <!-- Cohort table -->
  <SectionTitle>Cohorts</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Cohort Code</th>
            <th>Course</th>
            <th>Institute</th>
            <th>Category</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Capacity</th>
            <th>Enrolled</th>
            <th>Fill Rate</th>
            <th>Facilitator</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody v-if="filtered.length">
          <tr v-for="h in filtered" :key="h.id">
            <td class="mono-cell">{{ h.cohort_code }}</td>
            <td class="name-cell">{{ h.course_detail?.name ?? '-' }}</td>
            <td class="dim-cell">{{ h.course_detail?.institute_name ?? '-' }}</td>
            <td>
              <BadgePill :variant="catBadge(h.course_detail?.course_category)" size="sm">
                {{ catLabel(h.course_detail?.course_category) }}
              </BadgePill>
            </td>
            <td class="dim-cell">{{ fmtDate(h.start_date) }}</td>
            <td class="dim-cell">{{ fmtDate(h.end_date) }}</td>
            <td class="num-cell">{{ h.capacity }}</td>
            <td class="num-bold">{{ h.enrolled_count }}</td>
            <td>
              <div class="fill-wrap">
                <div class="fill-track">
                  <div class="fill-bar" :style="{ width: Math.min(h.fill_rate_pct ?? 0, 100) + '%', background: fillColor(h.fill_rate_pct ?? 0) }" />
                </div>
                <span class="fill-label">{{ (h.fill_rate_pct ?? 0).toFixed(0) }}%</span>
              </div>
            </td>
            <td class="dim-cell">{{ h.facilitator_name ?? '-' }}</td>
            <td>
              <BadgePill :variant="statusBadge(h.status)" size="sm">{{ h.status }}</BadgePill>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="11" class="empty-row">{{ loading ? 'Loading cohorts…' : 'No cohorts match the selected filters.' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Sessions panel (for selected cohort - static summary) -->
  <SectionTitle style="margin-top:20px">Session Schedule</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Cohort Code</th>
            <th>Title</th>
            <th>Type</th>
            <th>Scheduled</th>
            <th>Duration</th>
            <th>Venue</th>
            <th>Facilitator</th>
            <th>Completed</th>
          </tr>
        </thead>
        <tbody v-if="sessions.length">
          <tr v-for="s in sessions" :key="s.id">
            <td class="mono-cell">{{ s.cohort_code }}</td>
            <td class="name-cell">{{ s.title || '-' }}</td>
            <td>
              <BadgePill :variant="sessionTypeBadge(s.session_type)" size="sm">{{ sessionTypeLabel(s.session_type) }}</BadgePill>
            </td>
            <td class="dim-cell">{{ fmtDateTime(s.scheduled_at) }}</td>
            <td class="dim-cell">{{ s.duration_minutes ? s.duration_minutes + ' min' : '-' }}</td>
            <td class="dim-cell">{{ s.venue || '-' }}</td>
            <td class="dim-cell">{{ s.facilitator_name ?? '-' }}</td>
            <td>
              <BadgePill :variant="s.is_completed ? 'success' : 'neutral'" size="sm">
                {{ s.is_completed ? 'Done' : 'Pending' }}
              </BadgePill>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="8" class="empty-row">{{ loading ? 'Loading sessions…' : 'No sessions found.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Training')

import { useTraining } from '~/composables/api'
import type { TrainingCohort, TrainingSession } from '~/composables/api'

const cohorts  = ref<TrainingCohort[]>([])
const sessions = ref<TrainingSession[]>([])
const loading  = ref(true)
const error    = ref<string | null>(null)
const search       = ref('')
const statusFilter = ref('')

const training = useTraining()

async function load() {
  loading.value = true
  error.value   = null

  const [hRes, sRes] = await Promise.allSettled([
    training.cohorts({
      page_size: 100,
      ordering: 'start_date',
      ...(statusFilter.value ? { status: statusFilter.value } : {}),
      ...(search.value        ? { search: search.value }        : {}),
    }),
    training.sessions({ page_size: 50, ordering: 'scheduled_at' }),
  ])

  if (hRes.status === 'fulfilled') cohorts.value  = (hRes.value as any).results ?? []
  if (sRes.status === 'fulfilled') sessions.value = (sRes.value as any).results ?? []

  if (hRes.status === 'rejected' && sRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Training API.'

  loading.value = false
}

onMounted(load)

// ── Computed ──────────────────────────────────────────────────────────

const filtered = computed(() => {
  if (!search.value && !statusFilter.value) return cohorts.value
  return cohorts.value.filter(h => {
    const matchStatus = !statusFilter.value || h.status === statusFilter.value
    const q = search.value.toLowerCase()
    const matchSearch = !q
      || h.cohort_code.toLowerCase().includes(q)
      || (h.course_detail?.name ?? '').toLowerCase().includes(q)
      || (h.course_detail?.institute_name ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })
})

function byStatus(s: string) { return cohorts.value.filter(h => h.status === s).length }
const totalEnrolled = computed(() => cohorts.value.reduce((sum, h) => sum + (h.enrolled_count ?? 0), 0))
const avgFillRate = computed(() => {
  const active = cohorts.value.filter(h => h.fill_rate_pct != null)
  if (!active.length) return 0
  return active.reduce((sum, h) => sum + h.fill_rate_pct, 0) / active.length
})

// ── Helpers ───────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined) { return v == null ? '-' : v.toLocaleString() }
function fmtDate(d: string | null | undefined) {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return '-'
  try { return new Date(d).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  catch { return d }
}

function statusBadge(s: string) {
  const m: Record<string, string> = { scheduled: 'info', ongoing: 'success', completed: 'neutral', cancelled: 'danger' }
  return m[s] ?? 'neutral'
}
function fillColor(pct: number) {
  if (pct >= 90) return '#22c55e'
  if (pct >= 60) return '#f59e0b'
  return '#ef4444'
}

const CAT_LABELS: Record<string, string> = {
  class_a_motorcycle: 'Class A', class_b_light: 'Class B', class_c_heavy: 'Class C',
  class_d_psv: 'Class D PSV', class_e_special: 'Class E', defensive_driving: 'Defensive',
  first_aid: 'First Aid', maritime_basic: 'Maritime', maritime_advanced: 'Maritime Adv.',
  aviation_ground: 'Aviation', aviation_cabin_crew: 'Cabin Crew', other: 'Other',
}
function catLabel(c?: string | null) { return CAT_LABELS[c ?? ''] ?? c ?? '-' }
function catBadge(c?: string | null) {
  if (!c) return 'neutral'
  if (c.startsWith('class_')) return 'info'
  if (c === 'defensive_driving') return 'warning'
  if (c.startsWith('maritime')) return 'fair'
  if (c.startsWith('aviation')) return 'success'
  return 'neutral'
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  theory: 'Theory', practical: 'Practical', simulation: 'Simulator',
  assessment: 'Assessment', remedial: 'Remedial',
}
function sessionTypeLabel(t?: string | null) { return SESSION_TYPE_LABELS[t ?? ''] ?? t ?? '-' }
function sessionTypeBadge(t?: string | null) {
  const m: Record<string, string> = {
    theory: 'info', practical: 'success', simulation: 'fair',
    assessment: 'warning', remedial: 'danger',
  }
  return m[t ?? ''] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.filter-input { padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; min-width:180px; }
.filter-select { padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; cursor:pointer; }
.loading-note { font-size:12px; color:#94a3b8; }
.mono-cell  { font-family:monospace; font-size:12px; font-weight:600; color:#1e293b; white-space:nowrap; }
.name-cell  { font-weight:500; color:#1e293b; }
.num-bold   { font-weight:700; color:#1e293b; }
.num-cell   { color:#374151; }
.dim-cell   { font-size:12px; color:#64748b; white-space:nowrap; }
.empty-row  { text-align:center; color:#94a3b8; font-size:13px; padding:24px; }
.fill-wrap  { display:flex; align-items:center; gap:6px; min-width:110px; }
.fill-track { background:#f1f5f9; border-radius:4px; height:6px; flex:1; overflow:hidden; }
.fill-bar   { height:100%; border-radius:4px; transition:width .3s ease; }
.fill-label { font-size:11px; color:#64748b; font-variant-numeric:tabular-nums; white-space:nowrap; }
</style>
