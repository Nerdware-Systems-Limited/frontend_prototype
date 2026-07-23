<template>
  <PageHeader
    eyebrow="Training Institutes"
    title="Certificates & Completions"
    subtitle="Certificate register for all accredited training completions - issued by NTSA · KCAA · KMA · NITA-K with validity tracking and pass/fail outcomes"
  >
    <template #actions>
      <NuxtLink to="/training/enrollments" class="btn">← Enrollments</NuxtLink>
      <NuxtLink to="/training" class="btn-primary">Overview →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Total Completions" :value="fmtNum(completions.length)" sub="This page" source="live" source-title="UAPTS Training API" />
    <KpiCard label="Pass + Distinction" :value="fmtNum(byOutcome('pass') + byOutcome('distinction'))" sub="Successful completions" source="live" source-title="UAPTS Training API" />
    <KpiCard label="Fail" :value="fmtNum(byOutcome('fail'))" sub="Failed assessments" :trend-direction="byOutcome('fail') === 0 ? 'up' : 'down'" source="live" source-title="UAPTS Training API" />
    <KpiCard label="Certificates Valid" :value="fmtNum(validCerts)" sub="Currently valid" source="live" source-title="NTSA / KCAA / KMA" />
    <KpiCard label="Certificates Expired" :value="fmtNum(expiredCerts)" sub="Renewal required" :trend-direction="expiredCerts === 0 ? 'up' : 'down'" source="live" source-title="NTSA / KCAA / KMA" />
    <KpiCard label="Avg Score" :value="avgScore ? avgScore.toFixed(1) + '%' : '-'" sub="Final assessment score" source="batch" source-title="UAPTS Training API" />
  </div>

  <!-- Outcome breakdown chips -->
  <div class="outcome-row" style="margin-bottom:16px">
    <span
      v-for="o in outcomeBreakdown"
      :key="o.outcome"
      class="outcome-chip"
      :style="{ background: outcomeColor(o.outcome) + '1a', borderColor: outcomeColor(o.outcome) + '44', color: outcomeColor(o.outcome) }"
    >
      <span class="outcome-dot" :style="{ background: outcomeColor(o.outcome) }"></span>
      {{ o.label }} - {{ o.count }}
    </span>
  </div>

  <!-- Filters -->
  <div class="filter-row" style="margin-bottom:10px">
    <input v-model="search" class="filter-input" placeholder="Search certificate no. or student…" />
    <select v-model="outcomeFilter" class="select-sm">
      <option value="">All outcomes</option>
      <option value="pass">Pass</option>
      <option value="distinction">Distinction</option>
      <option value="fail">Fail</option>
      <option value="incomplete">Incomplete</option>
      <option value="deferred_resit">Deferred</option>
    </select>
    <select v-model="validityFilter" class="select-sm">
      <option value="">All validity</option>
      <option value="valid">Valid only</option>
      <option value="expired">Expired only</option>
    </select>
    <button class="btn" @click="load">Apply</button>
    <span class="result-count" v-if="!loading">{{ filtered.length }} certificates</span>
    <span v-if="loading" class="loading-note">Loading…</span>
  </div>

  <!-- Certificate register -->
  <SectionTitle>Certificate Register</SectionTitle>
  <div class="card" style="margin-bottom:16px">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Certificate No.</th>
            <th>Student</th>
            <th>National ID</th>
            <th>Cohort</th>
            <th>Outcome</th>
            <th>Score</th>
            <th>Theory</th>
            <th>Practical</th>
            <th>Attendance</th>
            <th>Issued By</th>
            <th>Issued</th>
            <th>Expiry</th>
            <th>Validity</th>
          </tr>
        </thead>
        <tbody v-if="filtered.length">
          <tr v-for="c in filtered" :key="c.id">
            <td class="mono-cell cert-no">{{ c.certificate_number || '-' }}</td>
            <td class="name-cell">{{ c.enrollment_detail?.full_name ?? '-' }}</td>
            <td class="mono-cell">{{ c.enrollment_detail?.national_id ?? '-' }}</td>
            <td class="mono-cell">{{ c.enrollment_detail?.cohort ? c.enrollment_detail.cohort.slice(0, 8) : '-' }}</td>
            <td>
              <BadgePill :variant="outcomeBadge(c.outcome)" size="sm">{{ outcomeLabel(c.outcome) }}</BadgePill>
            </td>
            <td>
              <div class="score-wrap" v-if="c.score_pct != null">
                <div class="score-bar-bg">
                  <div class="score-bar-fill" :style="{ width: c.score_pct + '%', background: scoreColor(c.score_pct) }" />
                </div>
                <span class="score-text">{{ c.score_pct.toFixed(1) }}%</span>
              </div>
              <span v-else class="dim-cell">-</span>
            </td>
            <td class="dim-cell">{{ c.theory_score_pct != null ? c.theory_score_pct.toFixed(1) + '%' : '-' }}</td>
            <td class="dim-cell">{{ c.practical_score_pct != null ? c.practical_score_pct.toFixed(1) + '%' : '-' }}</td>
            <td class="dim-cell">{{ c.attendance_rate_pct != null ? c.attendance_rate_pct.toFixed(0) + '%' : '-' }}</td>
            <td>
              <span class="issuer-chip">{{ c.issued_by_name || '-' }}</span>
            </td>
            <td class="dim-cell">{{ fmtDate(c.certificate_issued_at) }}</td>
            <td class="dim-cell" :class="{ 'expiry-warn': isExpiringSoon(c.certificate_expiry) }">
              {{ c.certificate_expiry ? fmtDate(c.certificate_expiry) : 'No expiry' }}
            </td>
            <td>
              <BadgePill :variant="c.is_certificate_valid ? 'success' : 'danger'" size="sm">
                {{ c.is_certificate_valid ? 'Valid' : 'Expired' }}
              </BadgePill>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="13" class="empty-row">
              {{ loading ? 'Loading certificates…' : 'No certificates match the selected filters.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Score distribution summary -->
  <SectionTitle pill="computed">Score Distribution</SectionTitle>
  <div class="dist-grid">
    <div class="dist-card" v-for="band in scoreBands" :key="band.label">
      <div class="dist-bar-wrap">
        <div
          class="dist-bar"
          :style="{ height: bandHeight(band.count) + 'px', background: band.color }"
        ></div>
      </div>
      <div class="dist-count">{{ band.count }}</div>
      <div class="dist-label">{{ band.label }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Training')

import { useTraining } from '~/composables/api'
import type { TrainingCompletion } from '~/composables/api'

const completions    = ref<TrainingCompletion[]>([])
const loading        = ref(true)
const error          = ref<string | null>(null)
const search         = ref('')
const outcomeFilter  = ref('')
const validityFilter = ref('')

const training = useTraining()

async function load() {
  loading.value = true
  error.value   = null

  try {
    const res = await training.completions({
      page_size: 100,
      ordering: '-completed_at',
      ...(outcomeFilter.value ? { outcome: outcomeFilter.value } : {}),
    })
    completions.value = res.results ?? []
  } catch {
    error.value = 'Unable to reach the UAPTS Training API.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ── Computed ──────────────────────────────────────────────────────────

const filtered = computed(() => {
  return completions.value.filter(c => {
    if (validityFilter.value === 'valid'   && !c.is_certificate_valid) return false
    if (validityFilter.value === 'expired' && c.is_certificate_valid)  return false
    if (search.value) {
      const q = search.value.toLowerCase()
      const name = (c.enrollment_detail?.full_name ?? '').toLowerCase()
      const cert = (c.certificate_number ?? '').toLowerCase()
      const nid  = (c.enrollment_detail?.national_id ?? '').toLowerCase()
      if (!name.includes(q) && !cert.includes(q) && !nid.includes(q)) return false
    }
    return true
  })
})

function byOutcome(o: string) { return completions.value.filter(c => c.outcome === o).length }
const validCerts   = computed(() => completions.value.filter(c => c.is_certificate_valid).length)
const expiredCerts = computed(() => completions.value.filter(c => !c.is_certificate_valid).length)
const avgScore     = computed(() => {
  const scores = completions.value.filter(c => c.score_pct != null).map(c => c.score_pct!)
  if (!scores.length) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
})

const OUTCOME_LABELS: Record<string, string> = {
  pass: 'Pass', fail: 'Fail', distinction: 'Distinction',
  incomplete: 'Incomplete', deferred_resit: 'Deferred',
}
const outcomeBreakdown = computed(() => {
  const outcomes = ['distinction', 'pass', 'fail', 'incomplete', 'deferred_resit']
  return outcomes
    .map(o => ({ outcome: o, label: OUTCOME_LABELS[o], count: byOutcome(o) }))
    .filter(r => r.count > 0)
})

const scoreBands = computed(() => {
  const bands = [
    { label: '0–49', min: 0,  max: 49,  color: '#ef4444', count: 0 },
    { label: '50–59', min: 50, max: 59, color: '#f97316', count: 0 },
    { label: '60–69', min: 60, max: 69, color: '#f59e0b', count: 0 },
    { label: '70–79', min: 70, max: 79, color: '#84cc16', count: 0 },
    { label: '80–89', min: 80, max: 89, color: '#22c55e', count: 0 },
    { label: '90–100', min: 90, max: 100, color: '#10b981', count: 0 },
  ]
  for (const c of completions.value) {
    if (c.score_pct == null) continue
    const band = bands.find(b => c.score_pct! >= b.min && c.score_pct! <= b.max)
    if (band) band.count++
  }
  return bands
})

function bandHeight(count: number) {
  const max = Math.max(...scoreBands.value.map(b => b.count), 1)
  return Math.max(4, Math.round((count / max) * 80))
}

// ── Helpers ───────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined) { return v == null ? '-' : v.toLocaleString() }
function fmtDate(d: string | null | undefined) {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}
function isExpiringSoon(expiry: string | null | undefined) {
  if (!expiry) return false
  const days = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 60
}

function outcomeLabel(o: string) { return OUTCOME_LABELS[o] ?? o }
function outcomeBadge(o: string) {
  const m: Record<string, string> = {
    pass: 'success', distinction: 'success', fail: 'danger',
    incomplete: 'warning', deferred_resit: 'fair',
  }
  return m[o] ?? 'neutral'
}
function outcomeColor(o: string) {
  const m: Record<string, string> = {
    distinction: '#10b981', pass: '#22c55e', fail: '#ef4444',
    incomplete: '#f59e0b', deferred_resit: '#64748b',
  }
  return m[o] ?? '#94a3b8'
}
function scoreColor(pct: number) {
  if (pct >= 80) return '#22c55e'
  if (pct >= 60) return '#f59e0b'
  return '#ef4444'
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

.outcome-row { display:flex; gap:8px; flex-wrap:wrap; }
.outcome-chip { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; padding:4px 12px; border-radius:20px; border:1px solid; }
.outcome-dot { width:8px; height:8px; border-radius:50%; display:inline-block; flex-shrink:0; }

.mono-cell  { font-family:monospace; font-size:12px; font-weight:600; color:#1e293b; white-space:nowrap; }
.cert-no    { font-family:monospace; font-size:11px; color:#0369a1; font-weight:700; }
.name-cell  { font-weight:500; color:#1e293b; }
.dim-cell   { font-size:12px; color:#64748b; white-space:nowrap; }
.empty-row  { text-align:center; color:#94a3b8; font-size:13px; padding:24px; }
.expiry-warn { color:#b45309 !important; font-weight:600; }

.score-wrap { display:flex; align-items:center; gap:6px; min-width:90px; }
.score-bar-bg { background:#f1f5f9; border-radius:3px; height:6px; flex:1; overflow:hidden; }
.score-bar-fill { height:100%; border-radius:3px; transition:width .3s ease; }
.score-text { font-size:11px; font-weight:600; color:#374151; white-space:nowrap; }

.issuer-chip { font-size:11px; font-weight:700; padding:2px 7px; border-radius:4px; background:#f0f9ff; color:#0369a1; border:1px solid #bae6fd; white-space:nowrap; }

/* Score distribution chart */
.dist-grid { display:flex; gap:12px; align-items:flex-end; padding:12px 0; }
.dist-card { display:flex; flex-direction:column; align-items:center; gap:4px; min-width:56px; }
.dist-bar-wrap { display:flex; align-items:flex-end; height:88px; }
.dist-bar { width:36px; border-radius:4px 4px 0 0; transition:height .4s ease; min-height:4px; }
.dist-count { font-size:13px; font-weight:700; color:#1e293b; }
.dist-label { font-size:11px; color:#64748b; white-space:nowrap; }
</style>
