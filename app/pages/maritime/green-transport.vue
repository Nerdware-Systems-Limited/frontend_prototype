<template>
  <PageHeader
    eyebrow="Maritime - Green Transport"
    title="Green Transport"
    subtitle="KPA / KMA - Vessel fuel type &amp; emissions per TEU-km, shore power (cold ironing), EV trucks &amp; trains in the port hinterland, and cold-chain reefer energy"
  >
    <template #actions>
      <NuxtLink to="/maritime/cargo" class="btn">Cargo →</NuxtLink>
      <NuxtLink to="/maritime/accidents" class="btn">Pollution Incidents →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">
    ⚠ {{ error }} Vessel emissions, EV fleet, and reefer-energy tracking is not yet integrated from KPA/KMA.
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Avg CO₂ / TEU-km" :value="summary ? `${summary.kpis.avg_co2_per_teu_km_g.toFixed(0)}g` : '-'" sub="IMO target: -40% by 2030" source="batch" source-title="KPA" />
    <KpiCard label="Shore Power Usage" :value="summary ? pct(summary.kpis.shore_power_usage_pct) : '-'" sub="% of port time cold-ironed" trend-direction="up" source="batch" source-title="KPA" />
    <KpiCard label="EV Truck Fleet" :value="summary ? fmtNum(summary.kpis.ev_truck_fleet_size) : '-'" sub="Registered in port access zones" source="batch" source-title="KPA / Private Operators" />
    <KpiCard label="EV Train Share" :value="summary ? pct(summary.kpis.ev_train_share_pct) : '-'" sub="Of SGR locomotive fleet" source="batch" source-title="Kenya Railways" />
    <KpiCard label="CO₂ Saved / month" :value="summary ? `${fmtNum(summary.kpis.co2_saved_tonnes_month)}t` : '-'" sub="EV trucks/trains vs diesel" trend-direction="up" source="batch" source-title="KPA" />
    <KpiCard label="Reefer Plug Utilisation" :value="summary ? pct(summary.kpis.reefer_plug_utilisation_pct) : '-'" sub="Capacity planning" source="batch" source-title="KPA Terminal Mgmt" />
  </div>

  <!-- Three sub-categories -->
  <SectionTitle pill="KPA / KMA · Pending Integration">Green Transport - Three Sub-Categories</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead><tr><th>Category</th><th>Metric</th><th>Value</th><th>Target</th></tr></thead>
        <tbody v-if="modeStats.length">
          <tr v-for="m in modeStats" :key="m.label">
            <td><BadgePill :variant="categoryBadge(m.category)">{{ categoryLabel(m.category) }}</BadgePill></td>
            <td style="font-size:12px">{{ m.metric_label }}</td>
            <td style="font-weight:600">{{ m.metric_value != null ? `${m.metric_value} ${m.metric_unit}` : '-' }}</td>
            <td style="font-size:12px">{{ m.target_value != null ? `${m.target_value} ${m.metric_unit}` : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'Green-transport mode statistics have not been integrated yet.' }}</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Vessel emissions -->
  <SectionTitle pill="KPA · Pending Integration">Vessel Emissions by Fuel Type</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Vessel</th><th>Port</th><th>Fuel Type</th><th>Consumption (t)</th><th>CO₂/TEU-km</th><th>Shore Power</th><th>Voyage Date</th></tr></thead>
          <tbody v-if="emissions.length">
            <tr v-for="e in emissions.slice(0, 30)" :key="e.id">
              <td style="font-weight:600;font-size:12px">{{ e.vessel_name }}</td>
              <td style="font-family:monospace;font-size:12px">{{ e.port_unlocode ?? '-' }}</td>
              <td><BadgePill :variant="fuelBadge(e.fuel_type)">{{ e.fuel_type.toUpperCase() }}</BadgePill></td>
              <td>{{ fmtNum(e.fuel_consumption_tonnes, 1) }}</td>
              <td>{{ e.co2_per_teu_km_g != null ? `${e.co2_per_teu_km_g.toFixed(0)}g` : '-' }}</td>
              <td><BadgePill :variant="e.shore_power_used ? 'success' : 'neutral'">{{ e.shore_power_used ? 'Connected' : 'No' }}</BadgePill></td>
              <td style="font-size:12px">{{ fmtDay(e.voyage_date) }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'Vessel emissions data has not been integrated from KPA yet.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- EV Fleet + Reefer energy -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">EV Fleet (Trucks &amp; Trains)</div>
      <div class="card-body">
        <table>
          <thead><tr><th>Fleet Type</th><th>In Service</th><th>kWh / month</th><th>km / month</th><th>CO₂ Saved / month</th></tr></thead>
          <tbody v-if="evFleet.length">
            <tr v-for="f in evFleet" :key="f.fleet_type">
              <td><BadgePill variant="success">{{ f.fleet_type.replace(/_/g,' ') }}</BadgePill></td>
              <td>{{ fmtNum(f.count_in_service) }}</td>
              <td>{{ fmtNum(f.kwh_consumed_month) }}</td>
              <td>{{ f.km_driven_month != null ? fmtNum(f.km_driven_month) : '-' }}</td>
              <td>{{ fmtNum(f.co2_saved_tonnes_month, 1) }}t</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px">{{ loading ? 'Loading…' : 'EV fleet data not yet integrated.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-header">Cold Chain - Reefer Energy</div>
      <div class="card-body">
        <table>
          <thead><tr><th>Port</th><th>Plugs (in use / total)</th><th>kWh / month</th><th>Commodity</th></tr></thead>
          <tbody v-if="reeferEnergy.length">
            <tr v-for="r in reeferEnergy" :key="r.id">
              <td style="font-family:monospace;font-weight:600;font-size:12px">{{ r.port_unlocode }}</td>
              <td>{{ r.reefer_plugs_in_use }} / {{ r.reefer_plugs_total }}</td>
              <td>{{ fmtNum(r.kwh_consumed_month) }}</td>
              <td style="font-size:12px">{{ r.commodity ?? '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:14px">{{ loading ? 'Loading…' : 'Reefer energy data not yet integrated.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Green Transport')

import { useMaritimeGreenTransport } from '~/composables/api'
import type { MaritimeGreenSummary, VesselEmissionRecord, GreenTransportModeStat, EvFleetStat, ReeferEnergyRecord, VesselFuelType, GreenModeCategory } from '~/composables/api'

const summary      = ref<MaritimeGreenSummary | null>(null)
const modeStats    = ref<GreenTransportModeStat[]>([])
const emissions    = ref<VesselEmissionRecord[]>([])
const evFleet      = ref<EvFleetStat[]>([])
const reeferEnergy = ref<ReeferEnergyRecord[]>([])
const loading      = ref(true)
const error        = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const gt = useMaritimeGreenTransport()

  const [sumRes, msRes, emRes, evRes, rfRes] = await Promise.allSettled([
    gt.summary(),
    gt.modeStats(),
    gt.vesselEmissions({ page_size: 50 }),
    gt.evFleet(),
    gt.reeferEnergy({}),
  ])

  if (sumRes.status === 'fulfilled') summary.value = sumRes.value
  if (msRes.status  === 'fulfilled') modeStats.value = (msRes.value as any).results ?? []
  if (emRes.status  === 'fulfilled') emissions.value = (emRes.value as any).results ?? []
  if (evRes.status  === 'fulfilled') evFleet.value = (evRes.value as any).results ?? []
  if (rfRes.status  === 'fulfilled') reeferEnergy.value = (rfRes.value as any).results ?? []

  if ([sumRes, msRes, emRes, evRes, rfRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime Green Transport API.'

  loading.value = false
}

onMounted(load)

function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function pct(v: number | null | undefined) { return v == null ? '-' : `${v.toFixed(1)}%` }
function fmtDay(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function categoryLabel(c: GreenModeCategory) {
  const m: Record<GreenModeCategory,string> = { water: 'Water (Vessels)', rail: 'Trains', ev_vehicle: 'EV Vehicles' }
  return m[c] ?? c
}
function categoryBadge(c: GreenModeCategory) {
  const m: Record<GreenModeCategory,string> = { water: 'info', rail: 'neutral', ev_vehicle: 'success' }
  return m[c] ?? 'neutral'
}
function fuelBadge(f: VesselFuelType) {
  const m: Record<VesselFuelType,string> = { hfo:'danger', mgo:'warning', lng:'info', methanol:'info', zero_emission:'success' }
  return m[f] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.table-scroll { overflow-x:auto; }
</style>
