<template>
  <PageHeader
    eyebrow="Maritime - Waterways"
    title="Waterways"
    subtitle="KMA - Chartered (surveyed &amp; gazetted) and unchartered navigable waterway classification, plus navigation buoys, lighthouses, dredged channel depth, and VHF coverage"
  >
    <template #actions>
      <NuxtLink to="/maritime/infrastructure" class="btn">Port Infrastructure →</NuxtLink>
      <NuxtLink to="/maritime/accidents" class="btn">Accidents →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">
    ⚠ {{ error }} Waterway classification and infrastructure status is not yet integrated from KMA - per-port approach channel depth remains live under Port Infrastructure.
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Chartered Waterways" :value="summary ? fmtNum(summary.kpis.chartered_waterways) : '-'" sub="Surveyed &amp; gazetted" source="batch" source-title="KMA" />
    <KpiCard label="Unchartered Waterways" :value="summary ? fmtNum(summary.kpis.unchartered_waterways) : '-'" sub="Unsurveyed / artisanal use" source="batch" source-title="KMA" />
    <KpiCard label="Navaid Availability" :value="summary ? pct(summary.kpis.navaid_operational_pct) : '-'" sub="Buoys operational (target 100%)" :trend-direction="summary && summary.kpis.navaid_operational_pct >= 95 ? 'up' : 'down'" source="batch" source-title="KMA" />
    <KpiCard label="Lighthouse Uptime" :value="summary ? pct(summary.kpis.lighthouse_uptime_pct) : '-'" sub="Target 99.9%" :trend-direction="summary && summary.kpis.lighthouse_uptime_pct >= 99.9 ? 'up' : 'down'" source="batch" source-title="KMA" />
    <KpiCard label="VHF Coverage" :value="summary ? pct(summary.kpis.vhf_coverage_pct) : '-'" sub="Of chartered waterways" source="batch" source-title="KMA" />
    <KpiCard label="Incidents (30d)" :value="summary ? fmtNum(summary.kpis.incidents_30d) : '-'" sub="Waterway-related" :trend-direction="summary && summary.kpis.incidents_30d === 0 ? 'up' : 'down'" source="batch" source-title="KMA" />
  </div>

  <!-- Waterway registry -->
  <SectionTitle pill="KMA · Pending Integration">Waterway Classification</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="categoryFilter" class="select-sm">
          <option value="">All categories</option>
          <option value="chartered">Chartered</option>
          <option value="unchartered">Unchartered</option>
        </select>
        <button class="btn" @click="categoryFilter=''">Clear</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Waterway</th><th>Category</th><th>Region</th><th>Vessel Traffic (30d)</th><th>Dredging Depth</th><th>Incidents (30d)</th><th>Pollution (30d)</th></tr>
          </thead>
          <tbody v-if="filteredWaterways.length">
            <tr v-for="w in filteredWaterways" :key="w.id">
              <td style="font-weight:600;font-size:12px">{{ w.name }}</td>
              <td><BadgePill :variant="w.category === 'chartered' ? 'success' : 'warning'">{{ w.category }}</BadgePill></td>
              <td style="font-size:12px">{{ w.region }}</td>
              <td>{{ w.vessel_traffic_count_30d != null ? fmtNum(w.vessel_traffic_count_30d) : '-' }}</td>
              <td>{{ w.dredging_depth_m != null ? `${w.dredging_depth_m}m` : '-' }}</td>
              <td>{{ w.incidents_30d ?? '-' }}</td>
              <td>{{ w.pollution_incidents_30d ?? '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'Waterway classification registry has not been integrated from KMA yet.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Waterway infrastructure -->
  <SectionTitle pill="KMA · Pending Integration">Waterway Infrastructure</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr><th>Waterway</th><th>Item</th><th>Status</th><th>Operational %</th><th>Uptime %</th><th>Depth (below chart datum)</th><th>All-weather access</th><th>VHF Coverage</th></tr>
        </thead>
        <tbody v-if="infra.length">
          <tr v-for="i in infra" :key="i.id">
            <td style="font-weight:600;font-size:12px">{{ i.waterway_name }}</td>
            <td><BadgePill variant="info">{{ infraItemLabel(i.item) }}</BadgePill></td>
            <td><BadgePill :variant="statusBadge(i.status)">{{ i.status.replace(/_/g,' ') }}</BadgePill></td>
            <td>{{ i.operational_pct != null ? `${i.operational_pct.toFixed(0)}%` : '-' }}</td>
            <td>{{ i.uptime_pct != null ? `${i.uptime_pct.toFixed(1)}%` : '-' }}</td>
            <td>{{ i.depth_below_chart_datum_m != null ? `${i.depth_below_chart_datum_m}m` : '-' }}</td>
            <td>{{ i.all_weather_accessible != null ? (i.all_weather_accessible ? 'Yes' : 'No') : '-' }}</td>
            <td>{{ i.vhf_coverage_pct != null ? `${i.vhf_coverage_pct.toFixed(0)}%` : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'Waterway infrastructure status has not been integrated from KMA yet.' }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Waterways')

import { useMaritimeWaterways } from '~/composables/api'
import type { MaritimeWaterwaysSummary, Waterway, WaterwayInfrastructureRecord, WaterwayCategory, WaterwayInfraItem } from '~/composables/api'

const summary = ref<MaritimeWaterwaysSummary | null>(null)
const waterways = ref<Waterway[]>([])
const infra = ref<WaterwayInfrastructureRecord[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const categoryFilter = ref<'' | WaterwayCategory>('')

async function load() {
  loading.value = true
  error.value = null
  const ww = useMaritimeWaterways()

  const [sumRes, listRes, infraRes] = await Promise.allSettled([
    ww.summary(),
    ww.list({ page_size: 100 }),
    ww.infrastructure({}),
  ])

  if (sumRes.status   === 'fulfilled') summary.value = sumRes.value
  if (listRes.status  === 'fulfilled') waterways.value = (listRes.value as any).results ?? []
  if (infraRes.status === 'fulfilled') infra.value = (infraRes.value as any).results ?? []

  if ([sumRes, listRes, infraRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime Waterways API.'

  loading.value = false
}

onMounted(load)

const filteredWaterways = computed(() => waterways.value.filter(w => !categoryFilter.value || w.category === categoryFilter.value))

function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function pct(v: number | null | undefined) { return v == null ? '-' : `${v.toFixed(1)}%` }
function infraItemLabel(i: WaterwayInfraItem) {
  const m: Record<WaterwayInfraItem, string> = {
    navigation_buoy: 'Navigation Buoy', lighthouse: 'Lighthouse / Lightvessel', channel_depth: 'Channel Depth',
    pilotage_boarding_ground: 'Pilotage Boarding Ground', vhf_coverage: 'VHF Radio Coverage',
  }
  return m[i] ?? i
}
function statusBadge(s: string) {
  const m: Record<string,string> = { operational:'success', degraded:'warning', out_of_service:'danger' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
</style>
