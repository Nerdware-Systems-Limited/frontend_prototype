<template>
  <PageHeader
    eyebrow="Road Infrastructure"
    title="Road Infrastructure Overview"
    subtitle="KeNHA · KURA · KeRRA · KRB - network condition, assets, projects and budget at a glance"
  >
    <template #actions>
      <NuxtLink to="/infrastructure" class="btn">Road Network Inventory<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <SectionTitle :pill="s ? 'Survey / BMS · ' + freshness(s.generated_at) : ''">Key metrics</SectionTitle>
  <div class="kpi-grid">
    <KpiCard
      label="Network Length" :value="s ? `${fmtNum(s.network.total_length_km)} km` : '-'"
      :unavailable="!s" :unavailable-note="loading ? 'Loading…' : 'Agency Survey feed unavailable'"
      period="LATEST" :description="s ? `${fmtNum(s.network.total_segments)} segments` : ''" to="/infrastructure"
    />
    <KpiCard
      label="Avg IRI" :value="s?.network.iri_average != null ? s.network.iri_average.toFixed(2) : '-'"
      :unavailable="!s || s.network.iri_average == null"
      :unavailable-note="loading ? 'Loading…' : s ? 'No IRI measurements recorded' : 'Agency Survey feed unavailable'"
      period="LATEST" description="m/km · lower is smoother"
      :status="s?.network.iri_average == null ? undefined : s.network.iri_average <= 4 ? 'healthy' : 'warning'"
    />
    <KpiCard
      label="Avg PCI" :value="s?.network.pci_average != null ? s.network.pci_average.toFixed(0) : '-'"
      :unavailable="!s || s.network.pci_average == null"
      :unavailable-note="loading ? 'Loading…' : s ? 'No PCI measurements recorded' : 'Agency Survey feed unavailable'"
      period="LATEST" description="Pavement condition index"
    />
    <KpiCard
      label="At-Risk Segments" :value="s ? fmtNum(s.predictive.at_risk_segments_12mo) : '-'"
      :unavailable="!s" :unavailable-note="loading ? 'Loading…' : 'Forecast unavailable'"
      period="12M" description="Predicted to deteriorate"
      :status="!s ? undefined : s.predictive.at_risk_segments_12mo === 0 ? 'healthy' : 'warning'"
    />
    <KpiCard
      label="Bridges" :value="s ? fmtNum(s.bridges.total) : '-'"
      :unavailable="!s" :unavailable-note="loading ? 'Loading…' : 'BMS feed unavailable'"
      period="LATEST" :description="s ? `${fmtNum(s.bridges.critical_count)} critical` : ''"
      :status="!s ? undefined : s.bridges.critical_count === 0 ? 'healthy' : 'critical'" to="/infrastructure/bridges"
    />
    <KpiCard
      label="Streetlights Operational" :value="s ? `${s.streetlights.operational_pct.toFixed(1)}%` : '-'"
      :unavailable="!s" :unavailable-note="loading ? 'Loading…' : 'KURA feed unavailable'"
      period="LIVE" :description="s ? `${fmtNum(s.streetlights.operational)} of ${fmtNum(s.streetlights.total)}` : ''"
    />
    <KpiCard
      label="Projects In Progress" :value="s ? fmtNum(s.construction.in_progress) : '-'"
      :unavailable="!s" :unavailable-note="loading ? 'Loading…' : 'Project feed unavailable'"
      period="LIVE" :description="s ? `${fmtNum(s.construction.total_projects)} in portfolio` : ''" to="/infrastructure/projects"
    />
    <KpiCard
      label="Budget Utilisation" :value="s ? `${s.budget.utilization_pct.toFixed(1)}%` : '-'"
      :unavailable="!s" :unavailable-note="loading ? 'Loading…' : 'Treasury feed unavailable'"
      :period="s ? `FY${s.budget.fiscal_year}` : ''"
      :description="s ? `${fmtKES(s.budget.disbursed_kes)} of ${fmtKES(s.budget.allocated_kes)}` : ''" to="/infrastructure/funding"
    />
    <KpiCard
      label="Open Maintenance Orders" :value="s ? fmtNum(s.maintenance.open_orders) : '-'"
      :unavailable="!s" :unavailable-note="loading ? 'Loading…' : 'Maintenance feed unavailable'"
      period="LIVE" :description="s ? `${fmtKES(s.maintenance.open_value_kes)} open value` : ''" to="/infrastructure/maintenance"
    />
  </div>

  <SectionTitle pill="Network">Condition distribution</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div v-for="c in s?.network.condition_distribution ?? []" :key="c.condition_class ?? 'unrecorded'" class="bar-row">
        <span class="bar-label">{{ (c.condition_class ?? 'unrecorded').replace(/_/g, ' ') }}</span>
        <div class="bar-wrap"><div class="bar" :style="{ width: `${((c.length ?? 0) / maxLength) * 100}%` }" /></div>
        <span class="bar-val">{{ fmtNum(c.length) }} km</span>
      </div>
      <EmptyState v-if="!s?.network.condition_distribution?.length" :loading="loading" message="No condition data." compact />
    </div>
  </div>

  <SectionTitle>Explore</SectionTitle>
  <OverviewLinks label="Road infrastructure pages" :links="links" />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useInfrastructure } from '~/composables/api'
import type { InfrastructureSummary } from '~/composables/api'

const s = ref<InfrastructureSummary | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    s.value = await useInfrastructure().summary()
  } catch {
    error.value = 'Unable to reach the UAPTS Infrastructure API.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const maxLength = computed(() => Math.max(1, ...(s.value?.network.condition_distribution ?? []).map(c => c.length ?? 0)))
const links = [
  { to: '/infrastructure', title: 'Road Network Inventory', desc: 'Segments, IRI/PCI and forecasts' },
  { to: '/infrastructure/projects', title: 'Road Infrastructure Status', desc: 'Construction portfolio' },
  { to: '/infrastructure/bridges', title: 'Bridges & Assets', desc: 'Bridges and streetlights' },
  { to: '/infrastructure/maintenance', title: 'Maintenance', desc: 'Work orders and budgets' },
  { to: '/infrastructure/funding', title: 'Funding Allocations', desc: 'Budget and disbursement' },
]

function fmtNum(v: number | null | undefined) {
  return v == null ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
function fmtKES(n: number | null | undefined) {
  if (n == null) return '-'
  if (n >= 1_000_000_000) return `KES ${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `KES ${(n / 1_000).toFixed(1)}k`
  return `KES ${Math.round(n).toLocaleString()}`
}
function freshness(iso: string | undefined) {
  if (!iso) return 'Batch'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  return mins < 2 ? 'Live' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`
}
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
.bar-row { display: grid; grid-template-columns: 140px 1fr 80px; align-items: center; gap: 8px; padding: 4px 0; }
.bar-label { font-size: 12px; text-transform: capitalize; }
.bar-wrap { background: var(--surface-sunken); border-radius: 4px; height: 10px; overflow: hidden; }
.bar { height: 100%; background: var(--primary-fill); border-radius: 4px; }
.bar-val { font-size: 12px; text-align: right; }
</style>
