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
    ⚠ {{ error }}
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Avg CO₂ / TEU-km" :value="waterMode ? (waterMode.avg_g_co2_per_teu_km != null ? `${waterMode.avg_g_co2_per_teu_km.toFixed(0)}g` : '-') : '-'" sub="IMO target: -40% by 2030" source="live" source-title="KMA" />
    <KpiCard label="Shore Power Usage" :value="waterMode ? pct(waterMode.avg_shore_power_pct) : '-'" sub="% of port time cold-ironed" trend-direction="up" source="live" source-title="KMA" />
    <KpiCard label="EV Truck Fleet" :value="evTruckMode ? fmtNum(evTruckMode.fleet_size) : '-'" sub="Registered in port access zones" source="live" source-title="KPA / Private Operators" />
    <KpiCard label="EV Train Fleet" :value="evTrainMode ? fmtNum(evTrainMode.fleet_size) : '-'" sub="Of SGR locomotive fleet" source="live" source-title="Kenya Railways" />
    <KpiCard label="CO₂ Saved" :value="fmtNum(co2SavedTotal, 1) + 't'" :sub="`EV trucks/trains vs diesel, last ${modeStatsSummary?.days ?? 30}d`" trend-direction="up" source="live" source-title="KPA" />
    <KpiCard label="Marine Pollution Incidents" :value="fmtNum(pollutionIncidentsTotal)" :sub="`Oil-spill incidents, last ${summary?.days ?? 30}d`" source="live" source-title="KMA" />
  </div>

  <!-- Three sub-categories -->
  <SectionTitle pill="KPA / KMA · Live">Green Transport - Three Sub-Categories</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead><tr><th>Category</th><th>Key Metric</th><th>Detail</th><th>Target</th></tr></thead>
        <tbody v-if="modeRows.length">
          <tr v-for="m in modeRows" :key="m.mode">
            <td><BadgePill :variant="categoryBadge(m.mode)">{{ m.label }}</BadgePill></td>
            <td style="font-size:12px;font-weight:600">{{ m.keyMetricLabel }}: {{ m.keyMetricValue }}</td>
            <td style="font-size:12px">{{ m.detail }}</td>
            <td style="font-size:12px">{{ m.target ?? '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No green-transport mode statistics for this period.' }}</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Vessel emissions -->
  <SectionTitle pill="KPA · Live">Vessel Emissions by Fuel Type</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Vessel</th><th>Port</th><th>Fuel Type</th><th>Consumption (t)</th><th>CO₂/TEU-km</th><th>Shore Power</th><th>Report Date</th></tr></thead>
          <tbody v-if="emissions.length">
            <tr v-for="e in emissions.slice(0, 30)" :key="e.id">
              <td style="font-weight:600;font-size:12px">{{ e.vessel_name ?? '-' }}</td>
              <td style="font-family:monospace;font-size:12px">{{ e.port_unlocode ?? '-' }}</td>
              <td><BadgePill :variant="fuelBadge(e.fuel_type)">{{ e.fuel_type.toUpperCase() }}</BadgePill></td>
              <td>{{ fmtNum(e.fuel_consumption_tonnes, 1) }}</td>
              <td>{{ e.co2_g_per_teu_km != null ? `${e.co2_g_per_teu_km.toFixed(0)}g` : '-' }}</td>
              <td>{{ e.shore_power_pct != null ? pct(e.shore_power_pct) : '-' }}</td>
              <td style="font-size:12px">{{ fmtDay(e.report_date) }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No vessel emissions records for this period.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- EV Fleet + Reefer energy -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">EV Fleet Records (Trucks &amp; Trains)</div>
      <div class="card-body">
        <div class="table-scroll">
          <table>
            <thead><tr><th>Vehicle Type</th><th>Port</th><th>Report Date</th><th>Fleet Size</th><th>kWh</th><th>km Driven</th><th>CO₂ Saved</th></tr></thead>
            <tbody v-if="evFleet.length">
              <tr v-for="f in evFleet.slice(0, 20)" :key="f.id">
                <td><BadgePill variant="success">{{ f.vehicle_type.replace(/_/g,' ') }}</BadgePill></td>
                <td style="font-family:monospace;font-size:12px">{{ f.port_unlocode ?? '-' }}</td>
                <td style="font-size:11px">{{ fmtDay(f.report_date) }}</td>
                <td>{{ fmtNum(f.fleet_size) }}</td>
                <td>{{ fmtNum(f.energy_kwh) }}</td>
                <td>{{ fmtNum(f.km_driven) }}</td>
                <td>{{ fmtNum(f.co2_saved_tonnes, 1) }}t</td>
              </tr>
            </tbody>
            <tbody v-else><tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:14px">{{ loading ? 'Loading…' : 'No EV fleet records for this period.' }}</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">Cold Chain - Reefer Energy</div>
      <div class="card-body">
        <div class="table-scroll">
          <table>
            <thead><tr><th>Port</th><th>Report Date</th><th>Plugged-in Containers</th><th>kWh</th></tr></thead>
            <tbody v-if="reeferEnergy.length">
              <tr v-for="r in reeferEnergy.slice(0, 20)" :key="r.id">
                <td style="font-family:monospace;font-weight:600;font-size:12px">{{ r.port_unlocode }}</td>
                <td style="font-size:11px">{{ fmtDay(r.report_date) }}</td>
                <td>{{ fmtNum(r.plugged_in_containers) }}</td>
                <td>{{ fmtNum(r.energy_kwh) }}</td>
              </tr>
            </tbody>
            <tbody v-else><tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:14px">{{ loading ? 'Loading…' : 'No reefer energy records for this period.' }}</td></tr></tbody>
          </table>
        </div>
        <div class="source-note">Total reefer plug capacity per port and per-shipment commodity aren't tracked on this backend - only energy drawn by plugged-in containers.</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Green Transport')

import { useMaritimeGreenTransport } from '~/composables/api'
import type { MaritimeGreenSummary, VesselEmissionRecord, GreenTransportModeStat, GreenModeWaterStat, GreenModeEvStat, EVFleetRecord, ReeferEnergyRecord, VesselFuelType } from '~/composables/api'

const summary      = ref<MaritimeGreenSummary | null>(null)
const modeStatsSummary = ref<{ days: number; modes: GreenTransportModeStat[]; generated_at: string } | null>(null)
const emissions    = ref<VesselEmissionRecord[]>([])
const evFleet      = ref<EVFleetRecord[]>([])
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
    gt.evFleet({ page_size: 50 }),
    gt.reeferEnergy({ page_size: 50 }),
  ])

  if (sumRes.status === 'fulfilled') summary.value = sumRes.value
  if (msRes.status  === 'fulfilled') modeStatsSummary.value = msRes.value
  if (emRes.status  === 'fulfilled') emissions.value = emRes.value.results ?? []
  if (evRes.status  === 'fulfilled') evFleet.value = evRes.value.results ?? []
  if (rfRes.status  === 'fulfilled') reeferEnergy.value = rfRes.value.results ?? []

  if ([sumRes, msRes, emRes, evRes, rfRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime Green Transport API.'

  loading.value = false
}

onMounted(load)

const modeStats = computed(() => modeStatsSummary.value?.modes ?? [])
const waterMode = computed(() => modeStats.value.find((m): m is GreenModeWaterStat => m.mode === 'water') ?? null)
const evTruckMode = computed(() => modeStats.value.find((m): m is GreenModeEvStat => m.mode === 'ev_truck') ?? null)
const evTrainMode = computed(() => modeStats.value.find((m): m is GreenModeEvStat => m.mode === 'ev_train') ?? null)
const co2SavedTotal = computed(() => (evTruckMode.value?.co2_saved_tonnes ?? 0) + (evTrainMode.value?.co2_saved_tonnes ?? 0))
const pollutionIncidentsTotal = computed(() => summary.value?.ports.reduce((s, p) => s + p.marine_pollution_incidents, 0) ?? 0)

const modeRows = computed(() => modeStats.value.map(m => {
  if (m.mode === 'water') {
    return {
      mode: m.mode,
      label: m.label,
      keyMetricLabel: 'Avg gCO₂/TEU-km',
      keyMetricValue: m.avg_g_co2_per_teu_km != null ? m.avg_g_co2_per_teu_km.toFixed(0) : '-',
      detail: `${fmtNum(m.co2_emissions_tonnes, 1)}t CO₂ total, ${pct(m.avg_shore_power_pct)} shore power`,
      target: m.target,
    }
  }
  return {
    mode: m.mode,
    label: m.label,
    keyMetricLabel: 'Fleet Size',
    keyMetricValue: fmtNum(m.fleet_size),
    detail: `${fmtNum(m.energy_kwh)} kWh, ${fmtNum(m.km_driven)} km, ${fmtNum(m.co2_saved_tonnes, 1)}t CO₂ saved`,
    target: null,
  }
}))

function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function pct(v: number | null | undefined) { return v == null ? '-' : `${v.toFixed(1)}%` }
function fmtDay(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function categoryBadge(mode: string) {
  const m: Record<string,string> = { water: 'info', ev_truck: 'success', ev_train: 'success' }
  return m[mode] ?? 'neutral'
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
.source-note { margin-top:10px; font-size:11px; color:#94a3b8; }
</style>
