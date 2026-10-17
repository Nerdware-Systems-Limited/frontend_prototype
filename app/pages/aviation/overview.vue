<template>
  <PageHeader
    eyebrow="Aviation & Airport Management"
    title="Aviation Overview"
    subtitle="KAA · KCAA - headline fleet, flight, punctuality and passenger figures at a glance"
  >
    <template #actions>
      <TimeRangeSelector :range="timeRange" @change="load" />
      <NuxtLink to="/aviation" class="btn">Flight Movements<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <SectionTitle :pill="summary ? 'KAA / KCAA · ' + rangeTag : ''">Key metrics</SectionTitle>
  <div class="kpi-grid">
    <KpiCard
      label="Airports" :value="summary ? fmtNum(summary.kpis.total_airports) : '-'"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KAA feed unavailable'"
      period="LIVE" description="KAA managed" to="/aviation/infrastructure"
    />
    <KpiCard
      label="Aircraft in Service" :value="summary ? fmtNum(summary.kpis.aircraft_in_service) : '-'"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KCAA feed unavailable'"
      period="LIVE" :description="summary ? `${fmtNum(summary.kpis.total_airlines)} active airlines` : ''" to="/aviation/licensing"
    />
    <KpiCard
      label="Flights" :value="summary ? fmtNum(summary.kpis.flights_total) : '-'"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KAA ATC feed unavailable'"
      :period="timeRange.period.value"
      :description="summary ? `${fmtNum(summary.kpis.flights_delayed)} delayed · ${fmtNum(summary.kpis.flights_cancelled)} cancelled` : ''"
      to="/aviation/flights"
    />
    <KpiCard
      label="On-Time Performance" :value="summary ? `${summary.kpis.otp_pct.toFixed(1)}%` : '-'"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KAA ATC feed unavailable'"
      :period="timeRange.period.value" :description="summary ? `Avg delay ${summary.kpis.avg_delay_min.toFixed(0)} min` : ''"
      :status="!summary ? undefined : summary.kpis.otp_pct >= 80 ? 'healthy' : 'warning'"
    />
    <KpiCard
      label="Passengers" :value="summary ? fmtNum(summary.kpis.pax_total) : '-'"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KAA feed unavailable'"
      :period="timeRange.period.value" description="All airports" to="/aviation/passenger-stats"
    />
    <KpiCard
      label="Cargo" :value="summary ? `${fmtNum(summary.kpis.cargo_kg_total / 1000)} t` : '-'"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KAA feed unavailable'"
      :period="timeRange.period.value" description="Tonnes handled"
    />
  </div>

  <SectionTitle pill="Flight status">Status breakdown</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div v-for="s in summary?.by_status ?? []" :key="s.status ?? 'unknown'" class="bar-row">
        <span class="bar-label">{{ (s.status ?? 'unknown').replace(/_/g, ' ') }}</span>
        <div class="bar-wrap"><div class="bar" :style="{ width: `${(s.c / maxStatus) * 100}%` }" /></div>
        <span class="bar-val">{{ fmtNum(s.c) }}</span>
      </div>
      <EmptyState v-if="!summary?.by_status?.length" :loading="loading" message="No flight status data." compact />
    </div>
  </div>

  <SectionTitle>Explore</SectionTitle>
  <OverviewLinks label="Aviation pages" :links="links" />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useAviationMaritime } from '~/composables/api'
import type { AviationSummary } from '~/composables/api'

const summary = ref<AviationSummary | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const timeRange = useTimeRange('aviation', { default: '7d' })
const rangeTag = computed(() => timeRange.period.value.toLowerCase())

async function load() {
  loading.value = true
  error.value = null
  try {
    summary.value = await useAviationMaritime().aviationSummary(timeRange.days.value)
  } catch {
    error.value = 'Unable to reach the UAPTS Aviation API.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const maxStatus = computed(() => Math.max(1, ...(summary.value?.by_status ?? []).map(s => s.c)))
const links = [
  { to: '/aviation', title: 'Flight Movements', desc: 'Live tracking, OTP, weather and safety' },
  { to: '/aviation/flights', title: 'Flight Log', desc: 'Every recorded movement' },
  { to: '/aviation/passenger-stats', title: 'Passenger Stats', desc: 'Volumes by airport' },
  { to: '/aviation/licensing', title: 'Aircraft Licencing', desc: 'Certificates and renewals' },
  { to: '/aviation/infrastructure', title: 'Aviation Infrastructure', desc: 'Runways, ATC and work orders' },
]

function fmtNum(v: number | null | undefined) {
  return v == null ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
.bar-row { display: grid; grid-template-columns: 140px 1fr 60px; align-items: center; gap: 8px; padding: 4px 0; }
.bar-label { font-size: 12px; text-transform: capitalize; }
.bar-wrap { background: var(--surface-sunken); border-radius: 4px; height: 10px; overflow: hidden; }
.bar { height: 100%; background: var(--primary-fill); border-radius: 4px; }
.bar-val { font-size: 12px; text-align: right; }
</style>
