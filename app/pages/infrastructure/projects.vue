<template>
  <PageHeader
    eyebrow="Infrastructure - Construction Projects"
    title="Construction Projects"
    subtitle="KeNHA · KURA · KeRRA · KRB · LAPSSET - Project portfolio, physical &amp; financial progress, disbursement, delays, and county breakdown"
  >
    <template #actions>
      <span class="freshness-badge" :class="{ loading }">
        {{ loading ? 'Refreshing…' : `Updated ${lastRefreshed}` }}
      </span>
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Projects"
      :value="fmtNum(projects.length)"
      sub="In portfolio"
      source="batch" source-title="KeNHA / KURA / KRB"
    />
    <KpiCard
      label="In Progress"
      :value="fmtNum(countByStatus('in_progress'))"
      sub="Active construction"
      trend-direction="up"
      source="batch" source-title="KeNHA / KURA"
    />
    <KpiCard
      label="On Hold"
      :value="fmtNum(countByStatus('on_hold'))"
      sub="Suspended works"
      trend-direction="down"
      source="batch" source-title="KeNHA"
    />
    <KpiCard
      label="Delayed Projects"
      :value="fmtNum(delayed.length)"
      sub="Behind planned schedule"
      trend-direction="down"
      source="batch" source-title="KeNHA PMU"
    />
    <KpiCard
      label="Total Contract Value"
      :value="totalContract ? `KES ${fmtKES(totalContract)}` : '-'"
      sub="Across active portfolio"
      source="batch" source-title="KeNHA / KURA"
    />
    <KpiCard
      label="Total Disbursed"
      :value="totalDisbursed ? `KES ${fmtKES(totalDisbursed)}` : '-'"
      :sub="totalContract ? `${((totalDisbursed / totalContract) * 100).toFixed(0)}% absorption` : '-'"
      source="batch" source-title="National Treasury"
    />
  </div>

  <!-- Delay alerts -->
  <SectionTitle pill="KeNHA PMU · Batch">Delayed Projects</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="delayed.length">
        <AlertItem
          v-for="p in delayed"
          :key="p.id"
          severity="warning"
          :title="`${p.project_name} (${p.project_code})`"
          :meta="`${p.county} · ${p.status.replace(/_/g,' ')} · Physical: ${p.physical_progress_pct ?? '-'}% · Planned end: ${fmtDate(p.planned_end)}`"
        />
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">
        {{ loading ? 'Loading…' : 'No delayed projects found.' }}
      </div>
    </div>
  </div>

  <!-- Project table with filters -->
  <SectionTitle>Project Portfolio</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="statusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input v-model="countySearch" class="select-sm" placeholder="Filter by county…" style="min-width:150px" />
        <input v-model="nameSearch" class="select-sm" placeholder="Project name…" style="min-width:200px" />
        <button class="btn" @click="statusFilter=''; countySearch=''; nameSearch=''">Clear</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>County</th>
            <th>Agency</th>
            <th>Status</th>
            <th>Contractor</th>
            <th>Physical Progress</th>
            <th>Financial Progress</th>
            <th>Contract (KES)</th>
            <th>Planned End</th>
          </tr>
        </thead>
        <tbody v-if="filteredProjects.length">
          <tr v-for="p in filteredProjects" :key="p.id">
            <td>
              <div style="font-weight:600;font-size:13px">{{ p.project_name }}</div>
              <div style="font-size:11px;color:#94a3b8;font-family:monospace">{{ p.project_code }}</div>
            </td>
            <td style="font-size:12px">{{ p.county }}</td>
            <td style="font-size:12px">{{ p.agency_code ?? '-' }}</td>
            <td><BadgePill :variant="statusBadge(p.status)">{{ p.status.replace(/_/g,' ') }}</BadgePill></td>
            <td style="font-size:12px">{{ p.contractor || '-' }}</td>
            <td>
              <div class="prog-wrap">
                <div class="prog-bar" :style="{ width: `${p.physical_progress_pct ?? 0}%`, background: progColor(p.physical_progress_pct) }" />
              </div>
              <span style="font-size:11px">{{ p.physical_progress_pct != null ? `${p.physical_progress_pct.toFixed(0)}%` : '-' }}</span>
            </td>
            <td>
              <div class="prog-wrap">
                <div class="prog-bar" :style="{ width: `${p.financial_progress_pct ?? 0}%`, background: '#3b82f6' }" />
              </div>
              <span style="font-size:11px">{{ p.financial_progress_pct != null ? `${p.financial_progress_pct.toFixed(0)}%` : '-' }}</span>
            </td>
            <td style="font-size:12px;white-space:nowrap">
              {{ p.contract_sum_kes != null ? `KES ${fmtKES(p.contract_sum_kes)}` : '-' }}
            </td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtDate(p.planned_end) }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading projects…' : 'No projects match the current filters.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- By-county breakdown -->
  <SectionTitle>Projects by County</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="countyBreakdown.length" class="county-grid">
        <div v-for="c in countyBreakdown" :key="c.county" class="county-card">
          <div class="cc-name">{{ c.county }}</div>
          <div class="cc-count">{{ c.count }} project{{ c.count > 1 ? 's' : '' }}</div>
          <div class="cc-bar-wrap">
            <div class="cc-bar" :style="{ width: `${maxCountyCount > 0 ? (c.count / maxCountyCount) * 100 : 0}%` }" />
          </div>
          <div class="cc-val">
            <span v-if="c.avg_physical != null">{{ c.avg_physical.toFixed(0) }}% avg progress</span>
          </div>
        </div>
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">
        {{ loading ? 'Loading county data…' : 'No county breakdown available.' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Construction Projects')

import { useInfrastructure } from '~/composables/api'
import type { ConstructionProject } from '~/composables/api'

const projects      = ref<ConstructionProject[]>([])
const delayed       = ref<ConstructionProject[]>([])
const countyRaw     = ref<any[]>([])
const loading       = ref(true)
const error         = ref<string | null>(null)
const lastRefreshed = ref('-')
const statusFilter  = ref('')
const countySearch  = ref('')
const nameSearch    = ref('')

async function load() {
  loading.value = true
  error.value = null
  const infra = useInfrastructure()

  const [projRes, delayRes, countyRes] = await Promise.allSettled([
    infra.projects({ page_size: 100 }),
    infra.delayedProjects(),
    infra.projectsByCounty(),
  ])

  if (projRes.status   === 'fulfilled') projects.value  = (projRes.value as any).results ?? []
  if (delayRes.status  === 'fulfilled') delayed.value   = (delayRes.value as any).results ?? []
  if (countyRes.status === 'fulfilled') countyRaw.value = Array.isArray(countyRes.value) ? countyRes.value : ((countyRes.value as any).results ?? [])

  if ([projRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Infrastructure API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const filteredProjects = computed(() =>
  projects.value.filter(p => {
    if (statusFilter.value && p.status !== statusFilter.value) return false
    if (countySearch.value && !p.county.toLowerCase().includes(countySearch.value.toLowerCase())) return false
    if (nameSearch.value   && !p.project_name.toLowerCase().includes(nameSearch.value.toLowerCase())) return false
    return true
  }),
)

const totalContract  = computed(() => projects.value.reduce((s, p) => s + (p.contract_sum_kes ?? 0), 0))
const totalDisbursed = computed(() => projects.value.reduce((s, p) => s + (p.disbursed_kes ?? 0), 0))

function countByStatus(s: string) { return projects.value.filter(p => p.status === s).length }

const countyBreakdown = computed(() => {
  if (countyRaw.value.length) return countyRaw.value
  const map = new Map<string, { county: string; count: number; avg_physical: number | null }>()
  projects.value.forEach(p => {
    const ex = map.get(p.county)
    if (ex) { ex.count++; if (p.physical_progress_pct != null) ex.avg_physical = ((ex.avg_physical ?? 0) + p.physical_progress_pct) / 2 }
    else map.set(p.county, { county: p.county, count: 1, avg_physical: p.physical_progress_pct })
  })
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
})

const maxCountyCount = computed(() => Math.max(1, ...countyBreakdown.value.map(c => c.count)))

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(n: number | null | undefined) {
  if (n == null) return '-'
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
  const m: Record<string,string> = { in_progress:'info', completed:'success', on_hold:'warning', planned:'neutral', cancelled:'danger' }
  return m[s] ?? 'neutral'
}
function progColor(pct: number | null | undefined) {
  if (pct == null) return '#94a3b8'
  return pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.prog-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.prog-bar { height:100%; border-radius:4px; transition:width .4s; }
.county-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; }
.county-card { border:1px solid #f1f5f9; border-radius:6px; padding:10px 12px; }
.cc-name { font-size:13px; font-weight:600; margin-bottom:2px; }
.cc-count { font-size:12px; color:#64748b; margin-bottom:6px; }
.cc-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:4px; }
.cc-bar { height:100%; background:#3b82f6; border-radius:4px; }
.cc-val { font-size:11px; color:#94a3b8; }
</style>
