<template>
  <PageHeader
    eyebrow="Maritime - Cargo"
    title="Cargo Tracking"
    subtitle="KPA · KRA/KenTrade - Cargo type breakdown, import &amp; export pipeline stage tracking, cargo handling KPIs, and onward transport modes from port"
  >
    <template #actions>
      <NuxtLink to="/maritime/port-ops" class="btn">Port Operations →</NuxtLink>
      <NuxtLink to="/maritime/services" class="btn">Port Services →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">
    ⚠ {{ error }} Cargo-type, pipeline-stage, and onward-transport detail is not yet integrated from KRA/KenTrade - container/TEU throughput on Port Operations remains live.
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Shipments (30d)" :value="summary ? fmtNum(summary.kpis.shipments_30d) : '-'" sub="All cargo types" source="batch" source-title="KRA/KenTrade" />
    <KpiCard label="Imports (30d)" :value="summary ? fmtNum(summary.kpis.import_shipments_30d) : '-'" sub="Port of origin → Kenya" source="batch" source-title="KenTrade" />
    <KpiCard label="Exports (30d)" :value="summary ? fmtNum(summary.kpis.export_shipments_30d) : '-'" sub="Kenya → port of destination" source="batch" source-title="KenTrade" />
    <KpiCard label="FCL Share" :value="summary ? pct(summary.kpis.fcl_share_pct) : '-'" sub="Of containerised cargo" source="batch" source-title="KPA" />
    <KpiCard label="Reefer Shipments (30d)" :value="summary ? fmtNum(summary.kpis.reefer_shipments_30d) : '-'" sub="Cold-chain cargo" source="batch" source-title="KPA" />
    <KpiCard label="Avg Gate Processing" :value="summary ? `${summary.kpis.avg_gate_processing_min.toFixed(0)} min` : '-'" sub="Target: <20 min" :trend-direction="summary && summary.kpis.avg_gate_processing_min <= 20 ? 'up' : 'down'" source="batch" source-title="KPA Gate System" />
  </div>

  <!-- Cargo type breakdown -->
  <SectionTitle pill="KenTrade · Pending Integration">Cargo Type Breakdown (30d)</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div v-if="cargoByType.length" class="cong-list">
        <div v-for="c in cargoByType" :key="c.cargo_type" class="cong-row">
          <span class="cong-label">{{ cargoTypeLabel(c.cargo_type) }}</span>
          <div class="cong-bar-wrap">
            <div class="cong-bar" style="background:#3b82f6" :style="{ width: `${maxTonnage > 0 ? (c.tonnage / maxTonnage) * 100 : 0}%` }" />
          </div>
          <span class="cong-val">{{ fmtNum(c.tonnage) }} t · {{ fmtNum(c.shipments) }} shpmts</span>
        </div>
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'Cargo-type breakdown has not been integrated from KenTrade yet.' }}</div>
    </div>
  </div>

  <!-- Import / Export pipeline -->
  <SectionTitle pill="KenTrade · Pending Integration">Import &amp; Export Pipeline</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="pipelineDirectionFilter" class="select-sm">
          <option value="">Both directions</option>
          <option value="import">Import</option>
          <option value="export">Export</option>
        </select>
        <button class="btn" @click="pipelineDirectionFilter=''">Clear</button>
        <ExportButton filename="uapts-cargo-pipeline.csv" :rows="filteredPipeline" :columns="pipelineExportColumns" style="margin-left:auto" />
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Reference</th><th>Direction</th><th>Cargo Type</th><th>Port</th><th>Origin/Destination</th><th>Stage</th><th>Customs</th><th>Weight</th></tr>
          </thead>
          <tbody v-if="filteredPipeline.length">
            <tr v-for="p in filteredPipeline" :key="p.id">
              <td style="font-family:monospace;font-size:12px">{{ p.reference }}</td>
              <td><BadgePill :variant="p.direction === 'import' ? 'info' : 'success'">{{ p.direction }}</BadgePill></td>
              <td><BadgePill variant="neutral">{{ cargoTypeLabel(p.cargo_type) }}</BadgePill></td>
              <td style="font-family:monospace;font-size:12px">{{ p.port_unlocode }}</td>
              <td style="font-size:12px">{{ p.origin_or_destination }}</td>
              <td style="font-size:12px">{{ stageLabel(p.current_stage) }}</td>
              <td style="font-size:12px">{{ p.customs_status ?? '-' }}</td>
              <td>{{ p.weight_tonnes != null ? `${fmtNum(p.weight_tonnes)}t` : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'Import/export pipeline tracking has not been integrated from KenTrade yet.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Cargo handling stage KPIs -->
  <SectionTitle pill="KPA · Pending Integration">Cargo Handling at Port - Stage KPIs</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead><tr><th>Stage</th><th>Who Does It</th><th>KPI</th><th>Value</th><th>Target</th></tr></thead>
        <tbody v-if="stageKpis.length">
          <tr v-for="k in stageKpis" :key="k.stage">
            <td style="font-weight:600;font-size:12px">{{ k.stage }}</td>
            <td style="font-size:12px">{{ k.who }}</td>
            <td style="font-size:12px">{{ k.kpi_label }}</td>
            <td :style="{ fontWeight:'600', color: k.target_value != null && k.kpi_value != null && k.kpi_value < k.target_value ? '#ef4444' : '#22c55e' }">
              {{ k.kpi_value != null ? `${k.kpi_value} ${k.kpi_unit}` : '-' }}
            </td>
            <td style="font-size:12px">{{ k.target_value != null ? `${k.target_value} ${k.kpi_unit}` : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'Cargo-handling stage KPIs have not been integrated from KPA yet.' }}</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Onward transport modes -->
  <SectionTitle pill="KPA / Kenya Railways · Pending Integration">Onward Transport Modes from Port</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead><tr><th>Mode</th><th>Moves (30d)</th><th>Avg Transit</th><th>Green Flag</th><th>CO₂ Saved</th></tr></thead>
        <tbody v-if="onwardTransport.length">
          <tr v-for="o in onwardTransport" :key="o.mode">
            <td style="font-weight:600;font-size:12px">{{ modeLabel(o.mode) }}</td>
            <td>{{ fmtNum(o.moves_30d) }}</td>
            <td style="font-size:12px">{{ o.avg_transit_hours != null ? `${o.avg_transit_hours.toFixed(1)}h` : '-' }}</td>
            <td><BadgePill :variant="greenBadge(o.green_flag)">{{ o.green_flag }}</BadgePill></td>
            <td style="font-size:12px">{{ o.co2_saved_tonnes != null ? `${fmtNum(o.co2_saved_tonnes)}t` : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'Onward transport mode tracking has not been integrated yet.' }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Cargo Tracking')

import { useMaritimeCargo } from '~/composables/api'
import type { MaritimeCargoSummary, CargoTypeStat, PipelineShipment, CargoHandlingStageKpi, OnwardTransportStat, MaritimeCargoType, PipelineDirection, GreenFlag as CargoGreenFlag, ImportStage, ExportStage, OnwardTransportMode } from '~/composables/api'

const summary         = ref<MaritimeCargoSummary | null>(null)
const cargoByType     = ref<CargoTypeStat[]>([])
const pipeline        = ref<PipelineShipment[]>([])
const stageKpis       = ref<CargoHandlingStageKpi[]>([])
const onwardTransport = ref<OnwardTransportStat[]>([])
const loading         = ref(true)
const error           = ref<string | null>(null)

const pipelineDirectionFilter = ref<'' | PipelineDirection>('')

async function load() {
  loading.value = true
  error.value = null
  const mc = useMaritimeCargo()

  const [sumRes, btRes, plRes, skRes, otRes] = await Promise.allSettled([
    mc.summary(),
    mc.byType({ days: 30 }),
    mc.pipeline({ page_size: 50 }),
    mc.handlingStageKpis(),
    mc.onwardTransport({ days: 30 }),
  ])

  if (sumRes.status === 'fulfilled') summary.value = sumRes.value
  if (btRes.status  === 'fulfilled') cargoByType.value = (btRes.value as any).results ?? []
  if (plRes.status  === 'fulfilled') pipeline.value = (plRes.value as any).results ?? []
  if (skRes.status  === 'fulfilled') stageKpis.value = (skRes.value as any).results ?? []
  if (otRes.status  === 'fulfilled') onwardTransport.value = (otRes.value as any).results ?? []

  if ([sumRes, btRes, plRes, skRes, otRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime Cargo API.'

  loading.value = false
}

onMounted(load)

const maxTonnage = computed(() => Math.max(1, ...cargoByType.value.map(c => c.tonnage)))
const filteredPipeline = computed(() => pipeline.value.filter(p => !pipelineDirectionFilter.value || p.direction === pipelineDirectionFilter.value))
const pipelineExportColumns = [
  { key: 'reference', label: 'Reference' },
  { key: 'direction', label: 'Direction' },
  { key: 'cargo_type', label: 'Cargo Type' },
  { key: 'port_unlocode', label: 'Port' },
  { key: 'origin_or_destination', label: 'Origin/Destination' },
  { key: 'current_stage', label: 'Stage' },
  { key: 'customs_status', label: 'Customs' },
  { key: 'weight_tonnes', label: 'Weight (t)' },
]

function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function pct(v: number | null | undefined) { return v == null ? '-' : `${v.toFixed(1)}%` }
function cargoTypeLabel(t: MaritimeCargoType) {
  const m: Record<MaritimeCargoType, string> = {
    fcl: 'Containerised (FCL)', lcl: 'Containerised (LCL)', bulk_dry: 'Bulk - Dry', bulk_liquid: 'Bulk - Liquid',
    roro: 'RoRo', roro_empty: 'RoRo - Empty Containers', break_bulk: 'Break Bulk', reefer: 'Reefer',
  }
  return m[t] ?? t
}
function stageLabel(s: ImportStage | ExportStage) {
  const m: Record<string, string> = {
    port_of_origin: 'Port of Origin', international_sea: 'International Sea', kenya_sea_water_area: 'Kenya Sea/Water Area', final_destination: 'Final Destination',
    inland_origin: 'Inland Origin', port_of_destination: 'Port of Destination',
  }
  return m[s] ?? s
}
function modeLabel(m: OnwardTransportMode) {
  const labels: Record<OnwardTransportMode, string> = {
    road_normal: 'Road - Normal Truck', road_ev: 'Road - EV Truck', road_reefer: 'Road - Reefer Truck',
    rail_standard: 'Rail - SGR/Metre-Gauge', rail_reefer: 'Rail - Cold Chain', rail_ev: 'Rail - EV Train', icd_transfer: 'ICD Transfer',
  }
  return labels[m] ?? m
}
function greenBadge(f: CargoGreenFlag) {
  const m: Record<CargoGreenFlag, string> = { yes: 'success', partial: 'warning', no: 'neutral' }
  return m[f] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
.cong-list { display:flex; flex-direction:column; gap:7px; }
.cong-row { display:grid; grid-template-columns:170px 1fr 150px; align-items:center; gap:8px; }
.cong-label { font-size:12px; }
.cong-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.cong-bar { height:100%; border-radius:4px; transition:width .4s; }
.cong-val { font-size:11px; text-align:right; }
</style>
