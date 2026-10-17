<template>
  <PageHeader
    eyebrow="Maritime & Port Operations"
    title="Maritime Overview"
    subtitle="KPA · KMA - headline port, vessel, inspection and safety figures at a glance"
  >
    <template #actions>
      <TimeRangeSelector :range="timeRange" @change="load" />
      <NuxtLink to="/maritime" class="btn">Vessel Movements<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <SectionTitle :pill="ops ? 'KPA / KMA · ' + rangeTag : ''">Key metrics</SectionTitle>
  <div class="kpi-grid">
    <KpiCard
      label="Active Ports" :value="ops ? fmtNum(ops.kpis.active_ports) : '-'"
      :unavailable="!ops" :unavailable-note="loading ? 'Loading…' : 'KPA VTMS feed unavailable'"
      period="LIVE" description="KPA/KMA managed" to="/maritime/port-ops"
    />
    <KpiCard
      label="Vessels in Port" :value="ops ? fmtNum(ops.kpis.live_vessels) : '-'"
      :unavailable="!ops" :unavailable-note="loading ? 'Loading…' : 'KMA AIS feed unavailable'"
      period="LIVE" description="Currently in Kenyan waters" to="/maritime"
    />
    <KpiCard
      label="Container Throughput" :value="ops ? fmtNum(totalTeu) : '-'"
      :unavailable="!ops" :unavailable-note="loading ? 'Loading…' : 'KPA feed unavailable'"
      :period="timeRange.period.value" description="TEU across all ports" to="/maritime/cargo"
    />
    <KpiCard
      label="Inspections" :value="ops ? fmtNum(ops.kpis.inspections_30d) : '-'"
      :unavailable="!ops" :unavailable-note="loading ? 'Loading…' : 'KMA PSC feed unavailable'"
      period="30D"
      :description="ops ? `${fmtNum(ops.kpis.detentions_30d)} detained` : ''"
      :status="!ops ? undefined : ops.kpis.detentions_30d === 0 ? 'healthy' : 'warning'"
    />
    <KpiCard
      label="Incidents" :value="incidentStats ? fmtNum(incidentStats.total_incidents) : '-'"
      :unavailable="!incidentStats" :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="90D"
      :description="incidentStats ? `${fmtNum(incidentStats.fatal_incidents)} fatal · ${fmtNum(incidentStats.casualties)} casualties` : ''"
      :status="!incidentStats ? undefined : incidentStats.fatal_incidents === 0 ? 'healthy' : 'critical'"
      to="/maritime/accidents"
    />
    <KpiCard
      label="Pollution" :value="incidentStats ? fmtNum(incidentStats.pollution_tons) : '-'"
      :unavailable="!incidentStats" :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="90D" description="Tonnes spilled" to="/maritime/accidents"
    />
  </div>

  <SectionTitle pill="Port ops">Ports</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table v-if="ops?.ports?.length">
        <thead>
          <tr><th>Port</th><th>In port</th><th>Arrivals</th><th>Departures</th><th>TEU</th><th>Yard dwell</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in ops.ports" :key="p.port_unlocode">
            <td style="font-weight:600">{{ p.port_name }}</td>
            <td>{{ fmtNum(p.currently_in_port) }}</td>
            <td>{{ fmtNum(p.arrivals_30d) }}</td>
            <td>{{ fmtNum(p.departures_30d) }}</td>
            <td>{{ fmtNum(p.teu_throughput_30d) }}</td>
            <td>{{ p.avg_yard_dwell_days != null ? `${p.avg_yard_dwell_days.toFixed(1)} d` : '-' }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else :loading="loading" message="No port data." compact />
    </div>
  </div>

  <SectionTitle>Explore</SectionTitle>
  <OverviewLinks label="Maritime pages" :links="links" />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useAviationMaritime } from '~/composables/api'
import type { MaritimeOps } from '~/composables/api'

const ops = ref<MaritimeOps | null>(null)
const incidentStats = ref<{ total_incidents: number; fatal_incidents: number; casualties: number; pollution_tons: number } | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const timeRange = useTimeRange('maritime', { default: '30d' })
const rangeTag = computed(() => timeRange.period.value.toLowerCase())

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()
  const [opRes, incRes] = await Promise.allSettled([
    avm.maritimeOperations(timeRange.days.value),
    avm.maritimeIncidentStats(90),
  ])
  if (opRes.status === 'fulfilled') ops.value = opRes.value
  if (incRes.status === 'fulfilled') incidentStats.value = incRes.value
  if (opRes.status === 'rejected' && incRes.status === 'rejected') error.value = 'Unable to reach the UAPTS Maritime API.'
  loading.value = false
}
onMounted(load)

const totalTeu = computed(() => (ops.value?.ports ?? []).reduce((s, p) => s + (p.teu_throughput_30d ?? 0), 0))
const links = [
  { to: '/maritime', title: 'Vessel Movements', desc: 'Live AIS traffic and berths' },
  { to: '/maritime/port-ops', title: 'Port Operations', desc: 'Per-port throughput and dwell' },
  { to: '/maritime/cargo', title: 'Cargo Tracking', desc: 'Tonnage and TEU by port' },
  { to: '/maritime/accidents', title: 'Accidents & Safety', desc: 'Incidents and pollution' },
  { to: '/maritime/performance', title: 'Performance & Ranking', desc: 'Port league table' },
  { to: '/maritime/vessels', title: 'Vessel Registry', desc: 'Registered vessels' },
]

function fmtNum(v: number | null | undefined) {
  return v == null ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
</style>
