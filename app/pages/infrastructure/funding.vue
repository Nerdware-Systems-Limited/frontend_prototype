<template>
  <PageHeader
    eyebrow="Road Infrastructure"
    title="Funding Allocations"
    subtitle="KeNHA · KURA · KeRRA · KRB · National Treasury - Budget allocations, disbursements, and utilization across road agencies and fiscal years"
  />

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI ribbon -->
  <div class="kpi-grid">
    <KpiCard
      label="Allocated (Current FY)"
      :value="currentBudget ? `KES ${fmtKES(currentBudget.allocated_kes)}` : '-'"
      sub="Total budget allocation"
      source="batch" source-title="National Treasury"
    />
    <KpiCard
      label="Disbursed"
      :value="currentBudget ? `KES ${fmtKES(currentBudget.disbursed_kes)}` : '-'"
      :sub="currentBudget ? `${((currentBudget.disbursed_kes / currentBudget.allocated_kes) * 100).toFixed(1)}% of allocation` : '-'"
      trend-direction="up"
      source="batch" source-title="National Treasury"
    />
    <KpiCard
      label="Committed"
      :value="currentBudget ? `KES ${fmtKES(currentBudget.committed_kes)}` : '-'"
      sub="Contractually obligated"
      source="batch" source-title="KeNHA / KURA"
    />
    <KpiCard
      label="Budget Utilization"
      :value="currentBudget ? `${currentBudget.utilization_pct.toFixed(1)}%` : '-'"
      :sub="currentBudget ? `FY${currentBudget.fiscal_year}` : '-'"
      :trend-direction="currentBudget && currentBudget.utilization_pct >= 70 ? 'up' : 'down'"
      source="batch" source-title="National Treasury"
    />
  </div>

  <!-- Budget allocations by fiscal year and agency -->
  <SectionTitle pill="National Treasury · Batch">Budget Allocations by Fiscal Year</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="budgets.length" class="budget-list">
        <div v-for="b in budgets" :key="b.id" class="budget-item">
          <div class="bi-header">
            <span class="bi-fy">FY{{ b.fiscal_year }}</span>
            <span class="bi-agency">{{ b.agency_code ?? 'All Agencies' }}</span>
            <BadgePill :variant="utilBadge(b.utilization_pct)">{{ b.utilization_pct.toFixed(1) }}% utilized</BadgePill>
          </div>
          <div class="bi-bars">
            <div class="bi-bar-row">
              <span>Allocated</span>
              <div class="bi-bar-wrap"><div class="bi-bar" style="background:#3b82f6;width:100%" /></div>
              <span class="bi-val">KES {{ fmtKES(b.allocated_kes) }}</span>
            </div>
            <div class="bi-bar-row">
              <span>Disbursed</span>
              <div class="bi-bar-wrap">
                <div class="bi-bar" style="background:#22c55e"
                  :style="{ width: `${b.allocated_kes > 0 ? (b.disbursed_kes / b.allocated_kes) * 100 : 0}%` }" />
              </div>
              <span class="bi-val">KES {{ fmtKES(b.disbursed_kes) }}</span>
            </div>
            <div class="bi-bar-row">
              <span>Committed</span>
              <div class="bi-bar-wrap">
                <div class="bi-bar" style="background:#f59e0b"
                  :style="{ width: `${b.allocated_kes > 0 ? (b.committed_kes / b.allocated_kes) * 100 : 0}%` }" />
              </div>
              <span class="bi-val">KES {{ fmtKES(b.committed_kes) }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">
        {{ loading ? 'Loading budget data…' : 'No funding allocation data available.' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Funding Allocations')

import { useInfrastructure } from '~/composables/api'
import type { MaintenanceBudget } from '~/composables/api'

const budgets = ref<MaintenanceBudget[]>([])
const loading = ref(true)
const error   = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const infra = useInfrastructure()

  const [budRes] = await Promise.allSettled([
    infra.budgets({ page_size: 20 }),
  ])

  if (budRes.status === 'fulfilled') budgets.value = (budRes.value as any).results ?? []
  if (budRes.status === 'rejected')  error.value = 'Unable to reach the UAPTS Infrastructure API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

const currentBudget = computed(() => {
  if (!budgets.value.length) return null
  return budgets.value.reduce((latest, b) =>
    !latest || b.fiscal_year > latest.fiscal_year ? b : latest,
  null as MaintenanceBudget | null)
})

function fmtKES(n: number | null | undefined) {
  if (n == null) return '-'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}k`
  return Math.round(n).toLocaleString()
}
function utilBadge(pct: number) {
  return pct >= 80 ? 'success' : pct >= 50 ? 'fair' : 'warning'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
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
</style>
