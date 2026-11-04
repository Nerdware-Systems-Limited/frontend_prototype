<template>
  <PageHeader
    eyebrow="Maritime - Vessel Registry"
    title="Vessel Registry & Movements"
    subtitle="KMA · KPA - Full vessel registry with safety certification, and the complete port-call movement log"
  >
    <template #actions>
      <NuxtLink to="/maritime" class="btn">Live Map<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/maritime/port-ops" class="btn">Port Operations<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/maritime/accidents" class="btn">Accidents & Safety<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <!-- KPIs: counted by the server, so they are right however many vessels there are -->
  <div class="kpi-grid">
    <KpiCard
      label="Registered Vessels" :value="fmtNum(vesselCount.count.value)"
      :unavailable="vesselCount.count.value === null" :unavailable-note="vesselCount.loading.value ? 'Loading…' : 'KMA feed unavailable'"
      period="LIVE" description="KMA vessel registry" to="#vessel-registry"
    />
    <KpiCard
      label="Valid Safety Certs" :value="fmtNum(validCertCount.count.value)"
      :unavailable="validCertCount.count.value === null" :unavailable-note="validCertCount.loading.value ? 'Loading…' : 'KMA PSC feed unavailable'"
      period="LIVE" :description="`of ${fmtNum(vesselCount.count.value)} registered`" to="#vessel-registry"
    />
    <KpiCard
      label="Movements Recorded" :value="fmtNum(movementCount.count.value)"
      :unavailable="movementCount.count.value === null" :unavailable-note="movementCount.loading.value ? 'Loading…' : 'KMA AIS feed unavailable'"
      period="LIVE" description="Port-call log" to="#vessel-movements"
    />
    <KpiCard
      label="Vessels In Port" :value="fmtNum(inPortCount.count.value)"
      :unavailable="inPortCount.count.value === null" :unavailable-note="inPortCount.loading.value ? 'Loading…' : 'KMA AIS feed unavailable'"
      period="LIVE" description="Currently berthed / anchored" to="#vessel-movements"
    />
  </div>

  <!-- Vessel registry -->
  <SectionTitle pill="KMA · NAV 2018 · Continuous">Vessel Registry</SectionTitle>
  <div id="vessel-registry" class="card drill-target">
    <div class="card-body">
      <DataTable :table="vesselTable" row-key="id" title="Vessel registry" export-name="uapts-vessel-registry" expandable filters-open
                 placeholder="Search vessel name / IMO / owner…" empty="No vessels registered yet.">
        <template #cell-vessel_name="{ row }"><span class="strong">{{ row.vessel_name }}</span></template>
        <template #cell-imo_number="{ row }"><span class="mono">{{ row.imo_number }} / {{ row.mmsi || '-' }}</span></template>
        <template #cell-vessel_type="{ row }"><BadgePill variant="info">{{ String(row.vessel_type ?? '').replace(/_/g, ' ') }}</BadgePill></template>
        <template #cell-gross_tonnage="{ row }">{{ fmtNum(row.gross_tonnage) }} / {{ fmtNum(row.deadweight_tonnage) }}</template>
        <template #expanded="{ row }">
          <div class="drilldown">
            <div class="dd-item"><span class="dd-label">Owner</span><span>{{ row.owner || '-' }}</span></div>
            <div class="dd-item"><span class="dd-label">Operator</span><span>{{ row.operator || '-' }}</span></div>
            <div class="dd-item"><span class="dd-label">Year Built</span><span>{{ row.year_built ?? '-' }}</span></div>
            <div class="dd-item"><span class="dd-label">Length Overall</span><span>{{ row.length_overall_m }}m</span></div>
            <div class="dd-item"><span class="dd-label">Beam</span><span>{{ row.beam_m }}m</span></div>
            <div class="dd-item"><span class="dd-label">Max Draft</span><span>{{ row.max_draft_m }}m</span></div>
          </div>
        </template>
      </DataTable>
    </div>
  </div>

  <!-- Vessel movements -->
  <SectionTitle pill="KMA AIS · Live">Vessel Movements</SectionTitle>
  <div id="vessel-movements" class="card drill-target">
    <div class="card-body">
      <DataTable :table="movementTable" row-key="id" title="Vessel movements" export-name="uapts-vessel-movements" expandable filters-open
                 placeholder="Search vessel, port, cargo…" empty="No vessel movements recorded yet.">
        <template #cell-vessel_name="{ row }"><span class="strong">{{ row.vessel_name }}</span></template>
        <template #cell-eta="{ row }">
          <div v-if="row.eta">ETA: {{ fmtDate(row.eta) }}</div>
          <div v-if="row.etd">ETD: {{ fmtDate(row.etd) }}</div>
          <span v-if="!row.eta && !row.etd">-</span>
        </template>
        <template #expanded="{ row }">
          <div class="drilldown">
            <div class="dd-item"><span class="dd-label">IMO</span><span class="mono">{{ row.vessel_imo }}</span></div>
            <div class="dd-item"><span class="dd-label">ATA</span><span>{{ row.ata ? fmtDate(row.ata) : '-' }}</span></div>
            <div class="dd-item"><span class="dd-label">ATD</span><span>{{ row.atd ? fmtDate(row.atd) : '-' }}</span></div>
            <div class="dd-item"><span class="dd-label">Cargo Tonnage</span><span>{{ fmtNum(row.cargo_tonnage) }}t</span></div>
            <div class="dd-item"><span class="dd-label">International</span><span>{{ row.is_international ? 'Yes' : 'No' }}</span></div>
            <div class="dd-item"><span class="dd-label">Agency</span><span>{{ row.agency || '-' }}</span></div>
          </div>
        </template>
      </DataTable>
    </div>
  </div>

  <!-- KPA vessel calls (kpa-vessel-calls upload) -->
  <MaritimeRawPanel id="vessel-calls" dataset="vessel-calls" default-open />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useServerCount } from '~/composables/useServerCount'
import { useCountyScope } from '~/composables/useCountyScope'
import type { TableColumn } from '~/types/dataTable'

// Both tables are windows onto the WHOLE dataset: search, filters, sorting and paging run on the server
// (see docs/data-tables.md), so nothing is capped at the first few hundred rows.
const MA = '/api/v1/aviation-maritime/maritime'

// County filter for this module, following the global filter in the top bar until a county is picked here.
// Passed to every request explicitly, so a change refetches and the page cache is keyed by it.
const county = useCountyScope('maritime')
const scope = () => county.query.value

const CERT_BADGE: Record<string, string> = { valid: 'success', pending: 'warning', expired: 'danger' }
const MVMT_BADGE: Record<string, string> = { in_port: 'success', in_transit: 'info', scheduled: 'neutral', departed: 'fair', delayed: 'warning', cancelled: 'danger' }
// The model's own choices (Vessel.vessel_type, VesselMovement.movement_type / status). The old page's type menu was
// missing cruise, fishing and other, so those vessels could never be filtered to.
const VESSEL_TYPES = [
  { value: 'container', label: 'Container' }, { value: 'bulk_carrier', label: 'Bulk Carrier' }, { value: 'tanker', label: 'Tanker' },
  { value: 'general_cargo', label: 'General Cargo' }, { value: 'vehicle', label: 'Vehicle Carrier' }, { value: 'cruise', label: 'Cruise' },
  { value: 'fishing', label: 'Fishing' }, { value: 'passenger', label: 'Passenger' }, { value: 'tug', label: 'Tug' },
  { value: 'supply', label: 'Supply' }, { value: 'dredger', label: 'Dredger' }, { value: 'other', label: 'Other' },
]
const MOVEMENT_TYPES = ['arrival', 'berthing', 'departure', 'anchor', 'pilot_board', 'tug'].map(value => ({ value, label: value.replace(/_/g, ' ') }))
const MOVEMENT_STATUSES = Object.keys(MVMT_BADGE).map(value => ({ value, label: value.replace(/_/g, ' ') }))

const vesselColumns: TableColumn[] = [
  { key: 'vessel_name', label: 'Vessel', priority: 1, pin: 'left', minWidth: 160 },
  { key: 'imo_number', label: 'IMO / MMSI', type: 'mono', priority: 2 },
  { key: 'vessel_type', label: 'Type', priority: 2, options: VESSEL_TYPES },
  { key: 'flag_state', label: 'Flag', priority: 2 },
  { key: 'gross_tonnage', label: 'GRT / DWT', type: 'num', priority: 3, sortable: 'gross_tonnage', filterKey: 'gross_tonnage' },
  { key: 'safety_cert_status', label: 'Safety Cert', type: 'badge', badge: CERT_BADGE, priority: 1 },
]
const movementColumns: TableColumn[] = [
  { key: 'vessel_name', label: 'Vessel', priority: 1, pin: 'left', minWidth: 160 },
  { key: 'port_unlocode', label: 'Port', type: 'mono', priority: 1 },
  { key: 'berth_code', label: 'Berth', type: 'mono', priority: 3 },
  { key: 'movement_type', label: 'Movement', type: 'badge', badge: Object.fromEntries(MOVEMENT_TYPES.map(o => [o.value, 'neutral'])), options: MOVEMENT_TYPES, priority: 2 },
  { key: 'status', label: 'Status', type: 'badge', badge: MVMT_BADGE, options: MOVEMENT_STATUSES, priority: 1 },
  { key: 'eta', label: 'ETA / ETD', type: 'datetime', priority: 2, sortable: 'eta', filterKey: 'eta' },
  { key: 'cargo_type', label: 'Cargo', priority: 3 },
  { key: 'teu_count', label: 'TEU', type: 'num', priority: 3 },
]

const vesselTable = useEndpointTable({ key: 'maritime-vessels', path: `${MA}/vessels/`, columns: vesselColumns, countyKey: 'maritime', pageSize: 25 })
const movementTable = useEndpointTable({ key: 'maritime-vessel-movements', path: `${MA}/vessel-movements/`, columns: movementColumns, countyKey: 'maritime', pageSize: 25 })

// ── KPIs: counted by the server ──────────────────────────────────────────
const vesselCount = useServerCount(`${MA}/vessels/`, scope)
const validCertCount = useServerCount(`${MA}/vessels/`, () => ({ ...scope(), 'f.safety_cert_status__exact': 'valid' }))
const movementCount = useServerCount(`${MA}/vessel-movements/`, scope)
const inPortCount = useServerCount(`${MA}/vessel-movements/`, () => ({ ...scope(), 'f.status__exact': 'in_port' }))

// Keep the live numbers live (the page used to re-fetch every two minutes).
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    void vesselTable.refresh(); void movementTable.refresh()
    for (const c of [vesselCount, validCertCount, movementCount, inPortCount]) void c.refresh()
  }, 120_000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string | null) {
  if (!s) return '-'
  try { return new Date(s).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  catch { return s }
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.strong { font-weight:600; }
.mono { font-family:var(--font-mono, monospace); font-size:12px; }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; padding:14px 18px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--fg-3); }
</style>
