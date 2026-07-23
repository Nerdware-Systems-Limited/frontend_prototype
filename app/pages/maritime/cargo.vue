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
    ⚠ {{ error }}
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Cargo Tonnes (30d)" :value="cargoTonnesTotal != null ? `${fmtNum(cargoTonnesTotal)}t` : '-'" :sub="cargoTeuTotal != null ? `${fmtNum(cargoTeuTotal)} TEU` : 'All cargo types'" source="live" source-title="KPA" />
    <KpiCard label="Imports (sampled)" :value="fmtNum(importsSampled)" sub="Of sampled pipeline page" source="live" source-title="KenTrade" />
    <KpiCard label="Exports (sampled)" :value="fmtNum(exportsSampled)" sub="Of sampled pipeline page" source="live" source-title="KenTrade" />
    <KpiCard label="FCL Share" :value="pct(fclSharePct)" sub="Of containerised cargo tonnage" source="live" source-title="KPA" />
    <KpiCard label="Reefer Shipments (30d)" :value="fmtNum(reeferShipments)" sub="Cold-chain cargo" source="live" source-title="KPA" />
    <KpiCard label="Avg Gate Processing" :value="gateProcessingMin != null ? `${gateProcessingMin.toFixed(0)} min` : '-'" sub="Target: <20 min" :trend-direction="gateProcessingMin != null && gateProcessingMin <= 20 ? 'up' : 'down'" source="live" source-title="KPA Gate System" />
  </div>

  <!-- Cargo type breakdown -->
  <SectionTitle pill="KPA · Live">Cargo Type Breakdown (30d)</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div v-if="cargoByType.length" class="cong-list">
        <div v-for="c in cargoByType" :key="c.cargo_type" class="cong-row">
          <span class="cong-label">{{ cargoTypeLabel(c.cargo_type) }}</span>
          <div class="cong-bar-wrap">
            <div class="cong-bar" style="background:#3b82f6" :style="{ width: `${maxTonnage > 0 ? (c.tonnes / maxTonnage) * 100 : 0}%` }" />
          </div>
          <span class="cong-val">{{ fmtNum(c.tonnes) }} t{{ c.teu ? ` · ${fmtNum(c.teu)} TEU` : '' }} · {{ fmtNum(c.count) }} records</span>
        </div>
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No cargo-type records in the current window.' }}</div>
    </div>
  </div>

  <!-- Import / Export pipeline -->
  <SectionTitle pill="KenTrade · Live">Import &amp; Export Pipeline</SectionTitle>
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
            <tr><th>Reference</th><th>Direction</th><th>Vessel</th><th>Port</th><th>Stage</th><th>Consignee</th><th>Dest. Mode</th><th>Booked</th><th>Transit Time</th></tr>
          </thead>
          <tbody v-if="filteredPipeline.length">
            <tr v-for="p in filteredPipeline" :key="p.id">
              <td style="font-family:monospace;font-size:12px">{{ p.reference }}</td>
              <td><BadgePill :variant="p.direction === 'import' ? 'info' : 'success'">{{ p.direction }}</BadgePill></td>
              <td style="font-size:12px">{{ p.vessel_name ?? '-' }}</td>
              <td style="font-family:monospace;font-size:12px">{{ p.port_unlocode }}</td>
              <td><BadgePill :variant="stageBadge(p)">{{ stageLabel(p) }}</BadgePill></td>
              <td style="font-size:12px">{{ p.consignee || '-' }}</td>
              <td style="font-size:12px">{{ p.final_destination_mode || '-' }}</td>
              <td style="font-size:11px">{{ p.booked_at ? fmtDate(p.booked_at) : '-' }}</td>
              <td style="font-size:12px">{{ p.total_transit_hours != null ? `${(p.total_transit_hours / 24).toFixed(1)}d` : 'in transit' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No pipeline shipments in the current view.' }}</td></tr></tbody>
        </table>
      </div>
      <div class="source-note">"Stage" is derived from the shipment's real milestone timestamps (booked → Kenya waters arrival → customs cleared → final delivery) - this backend doesn't track cargo type on a pipeline record (see the breakdown above for that).</div>
    </div>
  </div>

  <!-- Cargo handling stage KPIs -->
  <SectionTitle pill="KPA · Live">Cargo Handling at Port - Stage KPIs</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead><tr><th>Stage</th><th>Who Does It</th><th>KPI</th><th>Value</th><th>Target</th></tr></thead>
        <tbody v-if="stageKpiRows.length">
          <tr v-for="k in stageKpiRows" :key="k.stage">
            <td style="font-weight:600;font-size:12px">{{ k.stage }}</td>
            <td style="font-size:12px">{{ k.who }}</td>
            <td style="font-size:12px">{{ k.kpiLabel }}</td>
            <td v-if="k.tracked" :style="{ fontWeight:'600', color: k.meetsTarget === false ? '#ef4444' : '#22c55e' }">
              {{ k.displayValue }}
            </td>
            <td v-else style="color:#94a3b8;font-style:italic" :title="k.reason">not tracked</td>
            <td style="font-size:12px">{{ k.targetLabel ?? '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">Loading…</td></tr></tbody>
      </table>
      <div class="source-note">"Stacking accuracy" and "ICD transit time/damage" have no data source on this backend yet - shown as not tracked rather than a guessed figure.</div>
    </div>
  </div>

  <!-- Onward transport modes -->
  <SectionTitle pill="KPA / Kenya Railways · Live">Onward Transport Modes from Port</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead><tr><th>Mode</th><th>Containers (30d)</th><th>Tonnes</th><th>Avg Delivery Time</th><th>Green Flag</th></tr></thead>
        <tbody v-if="onwardTransport.length">
          <tr v-for="o in onwardTransport" :key="o.mode">
            <td style="font-weight:600;font-size:12px">{{ modeLabel(o.mode) }}</td>
            <td>{{ fmtNum(o.container_count) }}</td>
            <td>{{ fmtNum(o.tonnes) }}t</td>
            <td style="font-size:12px">{{ o.avg_delivery_time_hours != null ? `${o.avg_delivery_time_hours.toFixed(1)}h` : '-' }}</td>
            <td><BadgePill :variant="greenBadge(o.green_transport_flag)">{{ o.green_transport_flag }}</BadgePill></td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No onward transport records in the current window.' }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Cargo Tracking')

import { useMaritimeCargo } from '~/composables/api'
import type { MaritimeCargoSummary, CargoTypeStat, PipelineShipment, HandlingStageKpis, OnwardTransportStat, MaritimeCargoType, PipelineDirection, GreenFlag as CargoGreenFlag, OnwardTransportMode } from '~/composables/api'

const summary         = ref<MaritimeCargoSummary | null>(null)
const cargoByType     = ref<CargoTypeStat[]>([])
const pipeline        = ref<PipelineShipment[]>([])
const stageKpis       = ref<HandlingStageKpis | null>(null)
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
    mc.onwardTransport(30),
  ])

  if (sumRes.status === 'fulfilled') summary.value = sumRes.value
  if (btRes.status  === 'fulfilled') cargoByType.value = btRes.value.cargo_types ?? []
  if (plRes.status  === 'fulfilled') pipeline.value = plRes.value.results ?? []
  if (skRes.status  === 'fulfilled') stageKpis.value = skRes.value
  if (otRes.status  === 'fulfilled') onwardTransport.value = otRes.value.modes ?? []

  if ([sumRes, btRes, plRes, skRes, otRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime Cargo API.'

  loading.value = false
}

onMounted(load)

const maxTonnage = computed(() => Math.max(1, ...cargoByType.value.map(c => c.tonnes)))
const filteredPipeline = computed(() => pipeline.value.filter(p => !pipelineDirectionFilter.value || p.direction === pipelineDirectionFilter.value))
const pipelineExportColumns = [
  { key: 'reference', label: 'Reference' },
  { key: 'direction', label: 'Direction' },
  { key: 'vessel_name', label: 'Vessel' },
  { key: 'port_unlocode', label: 'Port' },
  { key: 'consignee', label: 'Consignee' },
  { key: 'final_destination_mode', label: 'Destination Mode' },
  { key: 'booked_at', label: 'Booked' },
  { key: 'final_delivery_at', label: 'Final Delivery' },
]

// ── Summary KPIs (aggregated from the per-port summary + supporting endpoints) ─
const cargoTonnesTotal = computed(() => summary.value?.ports.reduce((s, p) => s + p.cargo_tonnes, 0) ?? null)
const cargoTeuTotal    = computed(() => summary.value?.ports.reduce((s, p) => s + p.cargo_teu, 0) ?? null)
// Not in the summary endpoint - computed from the sampled pipeline page already fetched for the table below.
const importsSampled = computed(() => pipeline.value.filter(p => p.direction === 'import').length)
const exportsSampled = computed(() => pipeline.value.filter(p => p.direction === 'export').length)
const fclSharePct = computed(() => {
  if (!cargoByType.value.length) return null
  const total = cargoByType.value.reduce((s, c) => s + c.tonnes, 0)
  if (!total) return null
  const fcl = cargoByType.value.find(c => c.cargo_type === 'fcl')?.tonnes ?? 0
  return (fcl / total) * 100
})
const reeferShipments = computed(() => cargoByType.value.find(c => c.cargo_type === 'reefer')?.count ?? null)
const gateProcessingMin = computed(() => stageKpis.value?.stages.gate_processing_minutes.value ?? null)

// ── Pipeline stage, derived from real milestone timestamps ─────────────
function stageLabel(p: PipelineShipment): string {
  if (p.final_delivery_at) return 'Final Destination'
  if (p.customs_cleared_at) return 'Customs Cleared'
  if (p.kenya_waters_arrival_at) return 'Kenya Sea / Water Area'
  if (p.origin_departure_at) return 'International Sea'
  return 'Booked'
}
function stageBadge(p: PipelineShipment): string {
  if (p.final_delivery_at) return 'success'
  if (p.customs_cleared_at || p.kenya_waters_arrival_at) return 'info'
  return 'neutral'
}

// ── Handling-stage KPI rows, built from the fixed `stages` object ──────
const stageKpiRows = computed(() => {
  const s = stageKpis.value?.stages
  if (!s) return []
  return [
    {
      stage: 'Vessel arrival at berth', who: 'KPA / Pilot', kpiLabel: 'On-time arrival %',
      tracked: s.vessel_arrival.tracked, reason: undefined,
      displayValue: s.vessel_arrival.on_time_arrival_pct != null ? `${s.vessel_arrival.on_time_arrival_pct.toFixed(1)}%` : '-',
      meetsTarget: null, targetLabel: null,
    },
    {
      stage: 'Hatch opening & crane deployment', who: 'Stevedore company', kpiLabel: 'Time to first lift',
      tracked: s.first_lift.tracked, reason: undefined,
      displayValue: s.first_lift.avg_hours != null ? `${s.first_lift.avg_hours.toFixed(1)}h` : '-',
      meetsTarget: null, targetLabel: null,
    },
    {
      stage: 'Discharge - container offload', who: 'Stevedores + crane operators', kpiLabel: 'Moves per crane per hour (BCH)',
      tracked: s.discharge_bch.tracked, reason: undefined,
      displayValue: s.discharge_bch.value != null ? s.discharge_bch.value.toFixed(1) : '-',
      meetsTarget: s.discharge_bch.value != null ? s.discharge_bch.value >= s.discharge_bch.target : null,
      targetLabel: `≥${s.discharge_bch.target} BCH`,
    },
    {
      stage: 'Container placed on terminal', who: 'Terminal staff', kpiLabel: 'Stacking accuracy',
      tracked: s.stacking_accuracy.tracked, reason: s.stacking_accuracy.reason,
      displayValue: '-', meetsTarget: null, targetLabel: null,
    },
    {
      stage: 'Gate out to truck/rail', who: 'KPA gate system', kpiLabel: 'Gate processing time',
      tracked: s.gate_processing_minutes.tracked, reason: undefined,
      displayValue: s.gate_processing_minutes.value != null ? `${s.gate_processing_minutes.value.toFixed(0)} min` : '-',
      meetsTarget: s.gate_processing_minutes.value != null ? s.gate_processing_minutes.value <= s.gate_processing_minutes.target_minutes : null,
      targetLabel: `<${s.gate_processing_minutes.target_minutes} min`,
    },
    {
      stage: 'Cargo handling (general)', who: 'KPA Ops', kpiLabel: 'Damage rate',
      tracked: s.cargo_handling_damage_rate_pct.tracked, reason: undefined,
      displayValue: s.cargo_handling_damage_rate_pct.value != null ? `${s.cargo_handling_damage_rate_pct.value.toFixed(1)}%` : '-',
      meetsTarget: s.cargo_handling_damage_rate_pct.value != null ? s.cargo_handling_damage_rate_pct.value === 0 : null,
      targetLabel: '0%',
    },
    {
      stage: 'Delivery to ICD/CFS', who: 'Haulier', kpiLabel: 'Transit time, damage on arrival',
      tracked: s.icd_transit_hours.tracked, reason: s.icd_transit_hours.reason,
      displayValue: '-', meetsTarget: null, targetLabel: null,
    },
  ]
})

function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function pct(v: number | null | undefined) { return v == null ? '-' : `${v.toFixed(1)}%` }
function cargoTypeLabel(t: MaritimeCargoType) {
  const m: Record<MaritimeCargoType, string> = {
    fcl: 'Containerised (FCL)', lcl: 'Containerised (LCL)', bulk_dry: 'Bulk - Dry', bulk_liquid: 'Bulk - Liquid',
    roro: 'RoRo', roro_empty: 'RoRo - Empty Containers', break_bulk: 'Break Bulk', reefer: 'Reefer',
  }
  return m[t] ?? t
}
function modeLabel(m: OnwardTransportMode) {
  const labels: Record<OnwardTransportMode, string> = {
    truck: 'Road - Normal Truck', ev_truck: 'Road - EV Truck', reefer_truck: 'Road - Reefer Truck',
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
