<template>
  <PageHeader
    eyebrow="Road Infrastructure"
    title="Funding Allocations"
    subtitle="KeNHA · KURA · KeRRA · KRB · LAPSSET · National Treasury - Budget allocations, disbursements, absorption, and variance analytics per agency and fiscal year"
  >
    <template #actions>
      <NuxtLink :to="agencyLink('/infrastructure')" class="btn">Road Network →</NuxtLink>
      <NuxtLink :to="agencyLink('/infrastructure/projects')" class="btn-primary">Project Status →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Agency tabs -->
  <div class="agency-tabs">
    <button class="agency-tab" :class="{ active: selectedAgency === '' }" @click="selectAgency('')">
      All Agencies <span class="agency-tab-count">{{ budgets.length }}</span>
    </button>
    <button
      v-for="a in agencyOptions" :key="a.code"
      class="agency-tab" :class="{ active: selectedAgency === a.code }"
      @click="selectAgency(a.code)"
    >
      {{ a.code }} <span class="agency-tab-count">{{ a.count }}</span>
    </button>
  </div>

  <!-- KPI ribbon -->
  <SectionTitle :pill="agencyLabel">Funding KPIs</SectionTitle>
  <div class="kpi-grid">
    <KpiCard label="Total Allocated" :value="kpi.allocated ? `KES ${fmtKES(kpi.allocated)}` : '-'" :sub="`Latest FY per agency · ${agencyLabel}`" source="batch" source-title="National Treasury" />
    <KpiCard label="Disbursed" :value="kpi.disbursed ? `KES ${fmtKES(kpi.disbursed)}` : '-'" :sub="kpi.allocated ? `${((kpi.disbursed / kpi.allocated) * 100).toFixed(1)}% of allocation` : '-'" trend-direction="up" source="batch" source-title="National Treasury" />
    <KpiCard label="Committed" :value="kpi.committed ? `KES ${fmtKES(kpi.committed)}` : '-'" sub="Contractually obligated" source="batch" source-title="Agency PMU" />
    <KpiCard label="Balance" :value="kpi.balance != null ? `KES ${fmtKES(kpi.balance)}` : '-'" sub="Allocated minus disbursed" :trend-direction="kpi.balance != null && kpi.balance >= 0 ? 'up' : 'down'" source="batch" source-title="National Treasury" />
    <KpiCard label="Absorption Rate" :value="kpi.absorptionPct != null ? `${kpi.absorptionPct.toFixed(1)}%` : '-'" sub="Disbursed / allocated" :trend-direction="kpi.absorptionPct != null && kpi.absorptionPct >= 70 ? 'up' : 'down'" source="batch" source-title="National Treasury" />
    <KpiCard label="Allocation / km" :value="kpi.perKm != null ? `KES ${fmtKES(kpi.perKm)}` : '-'" :sub="`Across ${fmtNum(kpi.networkKm,0)} km network`" source="batch" source-title="Computed" />
    <KpiCard label="AI-Flagged Critical Needs" :value="fmtNum(atRisk.length)" sub="At-risk segments (12mo) - proxy for unfunded need" trend-direction="down" source="batch" source-title="ML Model" />
    <KpiCard label="Avg Utilization" :value="kpi.avgUtilization != null ? `${kpi.avgUtilization.toFixed(1)}%` : '-'" :sub="`${agencyBudgetsScoped.length} budget line(s)`" source="batch" source-title="Agency PMU" />
  </div>

  <!-- Budget allocations by fiscal year and agency -->
  <SectionTitle pill="National Treasury · Batch">Budget Allocations by Fiscal Year ({{ agencyLabel }})</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <ExportButton filename="uapts-funding-allocations.csv" :href="budgetExportHref" style="margin-left:auto" />
      </div>
      <div v-if="agencyBudgetsScoped.length" class="budget-list">
        <div v-for="b in agencyBudgetsScoped" :key="b.id" class="budget-item">
          <div class="bi-header">
            <span class="bi-fy">FY{{ b.fiscal_year }}</span>
            <span class="bi-agency">{{ b.agency_code ?? 'All Agencies' }}{{ b.agency_code === 'KRB' ? ' · Road Maintenance Fund' : '' }}</span>
            <BadgePill :variant="utilBadge(b.utilization_pct)">{{ b.utilization_pct.toFixed(1) }}% utilized</BadgePill>
            <NuxtLink v-if="b.agency_code" :to="{ path: '/infrastructure/projects', query: { agency: b.agency_code } }" class="link-sm">Projects →</NuxtLink>
            <NuxtLink v-if="b.agency_code" :to="{ path: '/infrastructure', query: { agency: b.agency_code } }" class="link-sm">Network →</NuxtLink>
          </div>
          <div class="bi-bars">
            <div class="bi-bar-row">
              <span>Allocated</span>
              <div class="bi-bar-wrap"><div class="bi-bar" style="background:#3b82f6;width:100%" /></div>
              <span class="bi-val">KES {{ fmtKES(b.allocated_kes) }}</span>
            </div>
            <div class="bi-bar-row">
              <span>Disbursed</span>
              <div class="bi-bar-wrap"><div class="bi-bar" style="background:#22c55e" :style="{ width: `${budgetPct(b.disbursed_kes, b.allocated_kes)}%` }" /></div>
              <span class="bi-val">KES {{ fmtKES(b.disbursed_kes) }}</span>
            </div>
            <div class="bi-bar-row">
              <span>Committed</span>
              <div class="bi-bar-wrap"><div class="bi-bar" style="background:#f59e0b" :style="{ width: `${budgetPct(b.committed_kes, b.allocated_kes)}%` }" /></div>
              <span class="bi-val">KES {{ fmtKES(b.committed_kes) }}</span>
            </div>
          </div>
          <div v-if="b.notes" class="bi-notes">{{ b.notes }}</div>
        </div>
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading budget data…' : 'No funding allocation data available.' }}</div>
    </div>
  </div>

  <!-- Variance analytics -->
  <SectionTitle pill="Computed · Cross-Dataset">Variance Analytics</SectionTitle>
  <div class="two-col">
    <div class="card">
      <div class="card-header">Allocation vs. Condition Need</div>
      <div class="card-body">
        <div v-if="allocationVsCondition.length" class="variance-list">
          <div v-for="r in allocationVsCondition" :key="r.agency" class="variance-row">
            <span class="variance-agency">{{ r.agency }}</span>
            <span>Avg PCI {{ r.avgPci != null ? r.avgPci.toFixed(0) : '-' }} / Utilization {{ r.utilizationPct.toFixed(0) }}%</span>
            <BadgePill :variant="r.flag ? 'warning' : 'success'">{{ r.flag ? 'low PCI, low spend' : 'aligned' }}</BadgePill>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'Not enough agency-linked data to compute.' }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Disbursement vs. Physical Progress</div>
      <div class="card-body">
        <div v-if="disbursementVsProgress.length" class="variance-list">
          <div v-for="r in disbursementVsProgress" :key="r.agency" class="variance-row">
            <span class="variance-agency">{{ r.agency }}</span>
            <span>Disbursed {{ r.absorptionPct.toFixed(0) }}% / Physical {{ r.avgPhysical != null ? r.avgPhysical.toFixed(0) : '-' }}%</span>
            <BadgePill :variant="r.flag ? 'danger' : 'success'">{{ r.flag ? 'funding ahead of work' : 'aligned' }}</BadgePill>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'Not enough agency-linked data to compute.' }}</div>
      </div>
    </div>
  </div>

  <div class="two-col">
    <div class="card">
      <div class="card-header">Low Disbursement ({{ lowDisbursement.length }})</div>
      <div class="card-body scroll-body">
        <div v-if="lowDisbursement.length">
          <AlertItem v-for="b in lowDisbursement" :key="b.id" severity="warning" :title="`${b.agency_code ?? 'Unknown'} - FY${b.fiscal_year}`" :meta="`Utilization ${b.utilization_pct.toFixed(1)}% · Allocated KES ${fmtKES(b.allocated_kes)}`" />
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No budget lines with utilization below 30%.' }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Over / Under-Utilized Allocations</div>
      <div class="card-body scroll-body">
        <div v-if="overUnderUtilized.length">
          <AlertItem v-for="b in overUnderUtilized" :key="b.id" :severity="b.utilization_pct > 100 ? 'critical' : 'info'" :title="`${b.agency_code ?? 'Unknown'} - FY${b.fiscal_year}`" :meta="`${b.utilization_pct > 100 ? 'Committed beyond allocation' : 'Under-utilized'} · ${b.utilization_pct.toFixed(1)}%`" />
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No over- or severely under-utilized allocations.' }}</div>
      </div>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px">
    <div class="card-header">Contractor / Project Funding Risk</div>
    <div class="card-body scroll-body">
      <div v-if="fundingRisk.length">
        <AlertItem
          v-for="p in fundingRisk" :key="p.id"
          severity="critical"
          :title="`${p.project_name} (${p.project_code})`"
          :meta="`${p.agency_code ?? '-'} · ${p.contractor || 'contractor n/a'} · Financial ${p.financial_progress_pct?.toFixed(0)}% vs physical ${p.physical_progress_pct?.toFixed(0)}%`"
        />
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No high-risk contractor funding gaps detected.' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Funding Allocations')

import { useInfrastructure } from '~/composables/api'
import type { MaintenanceBudget, RoadSegment, ConstructionProject, DeteriorationForecast, InfrastructureSummary } from '~/composables/api'

const route  = useRoute()
const router = useRouter()

const budgets  = ref<MaintenanceBudget[]>([])
const segments = ref<RoadSegment[]>([])
const projects = ref<ConstructionProject[]>([])
const atRisk   = ref<DeteriorationForecast[]>([])
const summary  = ref<InfrastructureSummary | null>(null)
const loading  = ref(true)
const error    = ref<string | null>(null)

const selectedAgency = ref(typeof route.query.agency === 'string' ? route.query.agency : '')

function selectAgency(code: string) {
  selectedAgency.value = code
  router.replace({ query: { ...route.query, agency: code || undefined } })
}
function agencyLink(path: string) {
  return selectedAgency.value ? { path, query: { agency: selectedAgency.value } } : path
}

async function load() {
  loading.value = true
  error.value = null
  const infra = useInfrastructure()

  const [budRes, segRes, projRes, riskRes, sumRes] = await Promise.allSettled([
    infra.budgets({ page_size: 50 }),
    infra.segments({ page_size: 200 }),
    infra.projects({ page_size: 100 }),
    infra.atRiskForecasts(),
    infra.summary(),
  ])

  if (budRes.status  === 'fulfilled') budgets.value  = (budRes.value as any).results ?? []
  if (segRes.status  === 'fulfilled') segments.value = (segRes.value as any).results ?? []
  if (projRes.status === 'fulfilled') projects.value = (projRes.value as any).results ?? []
  if (riskRes.status === 'fulfilled') atRisk.value   = (riskRes.value as any).results ?? []
  if (sumRes.status  === 'fulfilled') summary.value  = sumRes.value

  if (budRes.status === 'rejected') error.value = 'Unable to reach the UAPTS Infrastructure API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Agency tabs ──────────────────────────────────────────────────────────
const agencyOptions = computed(() => {
  const m = new Map<string, number>()
  for (const b of budgets.value) {
    if (!b.agency_code) continue
    m.set(b.agency_code, (m.get(b.agency_code) ?? 0) + 1)
  }
  return [...m.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => a.code.localeCompare(b.code))
})
const agencyLabel = computed(() => selectedAgency.value || 'All Agencies')

const agencyBudgetsScoped = computed(() =>
  selectedAgency.value ? budgets.value.filter(b => b.agency_code === selectedAgency.value) : budgets.value,
)

// latest-FY budget per agency (avoids double counting multi-year history in KPI totals)
const latestPerAgency = computed(() => {
  const m = new Map<string, MaintenanceBudget>()
  for (const b of agencyBudgetsScoped.value) {
    const key = b.agency_code ?? '__all__'
    const ex = m.get(key)
    if (!ex || b.fiscal_year > ex.fiscal_year) m.set(key, b)
  }
  return [...m.values()]
})

const kpi = computed(() => {
  const rows = latestPerAgency.value
  const allocated = rows.reduce((s, b) => s + (parseFloat(b.allocated_kes) || 0), 0)
  const disbursed  = rows.reduce((s, b) => s + (parseFloat(b.disbursed_kes) || 0), 0)
  const committed  = rows.reduce((s, b) => s + (parseFloat(b.committed_kes) || 0), 0)
  const balance = allocated - disbursed
  const absorptionPct = allocated > 0 ? (disbursed / allocated) * 100 : null
  const avgUtilization = agencyBudgetsScoped.value.length
    ? agencyBudgetsScoped.value.reduce((s, b) => s + b.utilization_pct, 0) / agencyBudgetsScoped.value.length
    : null
  const scopedSegments = selectedAgency.value ? segments.value.filter(s => s.agency_code === selectedAgency.value) : segments.value
  const networkKm = scopedSegments.length
    ? scopedSegments.reduce((s, r) => s + (r.length_km ?? 0), 0)
    : (summary.value?.network.total_length_km ?? 0)
  const perKm = networkKm > 0 ? allocated / networkKm : null
  return { allocated, disbursed, committed, balance, absorptionPct, avgUtilization, networkKm, perKm }
})

// ── Variance analytics ───────────────────────────────────────────────────
const allocationVsCondition = computed(() => {
  return latestPerAgency.value.filter(b => b.agency_code).map(b => {
    const segs = segments.value.filter(s => s.agency_code === b.agency_code && s.pci_value != null)
    const avgPci = segs.length ? segs.reduce((s, r) => s + (r.pci_value as number), 0) / segs.length : null
    const flag = avgPci != null && avgPci < 60 && b.utilization_pct < 50
    return { agency: b.agency_code as string, avgPci, utilizationPct: b.utilization_pct, flag }
  })
})

const disbursementVsProgress = computed(() => {
  return latestPerAgency.value.filter(b => b.agency_code).map(b => {
    const projs = projects.value.filter(p => p.agency_code === b.agency_code && p.physical_progress_pct != null)
    const avgPhysical = projs.length ? projs.reduce((s, p) => s + (p.physical_progress_pct as number), 0) / projs.length : null
    const allocated = parseFloat(b.allocated_kes) || 0
    const disbursedAmt = parseFloat(b.disbursed_kes) || 0
    const absorptionPct = allocated > 0 ? (disbursedAmt / allocated) * 100 : 0
    const flag = avgPhysical != null && absorptionPct - avgPhysical >= 25
    return { agency: b.agency_code as string, absorptionPct, avgPhysical, flag }
  })
})

const lowDisbursement = computed(() => agencyBudgetsScoped.value.filter(b => b.utilization_pct < 30))
const overUnderUtilized = computed(() => agencyBudgetsScoped.value.filter(b => b.utilization_pct > 100 || b.utilization_pct < 20))

const fundingRisk = computed(() => {
  const pool = selectedAgency.value ? projects.value.filter(p => p.agency_code === selectedAgency.value) : projects.value
  return pool.filter(p =>
    p.financial_progress_pct != null && p.physical_progress_pct != null &&
    p.financial_progress_pct - p.physical_progress_pct >= 25,
  )
})

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
function utilBadge(pct: number) {
  return pct >= 80 ? 'success' : pct >= 50 ? 'fair' : 'warning'
}
function budgetPct(part: string, whole: string) {
  const w = parseFloat(whole) || 0
  const p = parseFloat(part) || 0
  return w > 0 ? (p / w) * 100 : 0
}

// Real server-side export (honors the same django-filter params as the list
// endpoint) - more complete than exporting only the currently-loaded page.
const budgetExportHref = computed(() => {
  const q = new URLSearchParams({ format: 'csv' })
  if (selectedAgency.value) q.set('agency', selectedAgency.value)
  return `/api/v1/infrastructure/maintenance-budgets/export/?${q.toString()}`
})
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.agency-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px; }
.agency-tab { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:20px; border:1px solid #e2e8f0; background:#fff; font-size:12.5px; font-weight:600; color:#475569; cursor:pointer; transition:all .12s; }
.agency-tab:hover { border-color:#3b82f6; color:#3b82f6; }
.agency-tab.active { background:#3b82f6; border-color:#3b82f6; color:#fff; }
.agency-tab-count { font-size:11px; opacity:.75; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.scroll-body { max-height:280px; overflow-y:auto; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.budget-list { display:flex; flex-direction:column; gap:16px; }
.budget-item { border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; }
.bi-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
.bi-fy { font-size:15px; font-weight:700; color:#1e293b; }
.bi-agency { font-size:12px; color:#64748b; flex:1; }
.bi-bars { display:flex; flex-direction:column; gap:7px; }
.bi-bar-row { display:grid; grid-template-columns:70px 1fr 90px; align-items:center; gap:8px; font-size:12px; color:#64748b; }
.bi-bar-wrap { background:#f1f5f9; border-radius:4px; height:8px; overflow:hidden; }
.bi-bar { height:100%; border-radius:4px; transition:width .4s; }
.bi-val { font-size:11px; font-weight:600; text-align:right; color:#374151; }
.bi-notes { margin-top:8px; font-size:12px; color:#94a3b8; }
.link-sm { font-size:11px; color:#3b82f6; text-decoration:none; }
.variance-list { display:flex; flex-direction:column; gap:8px; }
.variance-row { display:grid; grid-template-columns:70px 1fr auto; align-items:center; gap:8px; font-size:12px; padding:4px 0; border-bottom:1px solid #f8fafc; }
.variance-agency { font-weight:700; }
</style>
