<template>
  <PageHeader
    eyebrow="Maritime - Vessel Registry"
    title="Vessel Registry & Movements"
    subtitle="KMA · KPA - Full vessel registry with safety certification, and the complete port-call movement log"
  >
    <template #actions>
      <NuxtLink to="/maritime" class="btn">Live Map →</NuxtLink>
      <NuxtLink to="/maritime/port-ops" class="btn">Port Operations →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Registered Vessels" :value="fmtNum(vessels.length)" sub="KMA vessel registry" source="live" source-title="KMA · NAV 2018" />
    <KpiCard label="Valid Safety Certs" :value="fmtNum(vessels.filter(v => v.safety_cert_status === 'valid').length)" :sub="`of ${fmtNum(vessels.length)} registered`" source="batch" source-title="KMA PSC" />
    <KpiCard label="Movements Loaded" :value="fmtNum(movements.length)" sub="Port-call log" source="live" source-title="KMA AIS" />
    <KpiCard label="Vessels In Port" :value="fmtNum(movements.filter(m => m.status === 'in_port').length)" sub="Currently berthed / anchored" source="live" source-title="KMA AIS" />
  </div>

  <!-- Vessel registry -->
  <SectionTitle pill="KMA · NAV 2018 · Continuous">Vessel Registry</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="vesselSearch" class="select-sm" placeholder="Search vessel name / IMO…" style="min-width:200px" />
        <select v-model="vesselTypeFilter" class="select-sm">
          <option value="">All vessel types</option>
          <option value="container">Container</option>
          <option value="bulk_carrier">Bulk Carrier</option>
          <option value="tanker">Tanker</option>
          <option value="general_cargo">General Cargo</option>
          <option value="vehicle">Vehicle Carrier</option>
        </select>
        <select v-model="certFilter" class="select-sm">
          <option value="">All cert statuses</option>
          <option value="valid">Valid</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
        </select>
        <button class="btn" @click="vesselSearch=''; vesselTypeFilter=''; certFilter=''">Clear</button>
        <ExportButton filename="uapts-vessel-registry.csv" :rows="filteredVessels" :columns="vesselExportColumns" style="margin-left:auto" />
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Vessel</th>
              <th>IMO / MMSI</th>
              <th>Type</th>
              <th>Flag</th>
              <th>GRT / DWT</th>
              <th>Safety Cert</th>
            </tr>
          </thead>
          <tbody v-if="filteredVessels.length">
            <template v-for="v in filteredVessels" :key="v.id">
              <tr class="expand-row" @click="expandedVessel = expandedVessel === v.id ? null : v.id">
                <td class="expand-cell">{{ expandedVessel === v.id ? '▾' : '▸' }}</td>
                <td style="font-weight:600">{{ v.vessel_name }}</td>
                <td style="font-family:monospace;font-size:12px">{{ v.imo_number }} / {{ v.mmsi }}</td>
                <td><BadgePill variant="info">{{ v.vessel_type.replace(/_/g,' ') }}</BadgePill></td>
                <td style="font-size:12px">{{ v.flag_state }}</td>
                <td style="font-size:12px">{{ fmtNum(v.gross_tonnage) }} / {{ fmtNum(v.deadweight_tonnage) }}</td>
                <td><BadgePill :variant="certBadge(v.safety_cert_status)">{{ v.safety_cert_status }}</BadgePill></td>
              </tr>
              <tr v-if="expandedVessel === v.id" class="detail-row">
                <td :colspan="7">
                  <div class="drilldown">
                    <div class="dd-item"><span class="dd-label">Owner</span><span>{{ v.owner || '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Operator</span><span>{{ v.operator || '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Year Built</span><span>{{ v.year_built ?? '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Length Overall</span><span>{{ v.length_overall_m }}m</span></div>
                    <div class="dd-item"><span class="dd-label">Beam</span><span>{{ v.beam_m }}m</span></div>
                    <div class="dd-item"><span class="dd-label">Max Draft</span><span>{{ v.max_draft_m }}m</span></div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
          <tbody v-else><tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading vessels…' : 'No vessels match the current filters.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Vessel movements -->
  <SectionTitle pill="KMA AIS · Live">Vessel Movements</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="movementSearch" class="select-sm" placeholder="Search vessel name…" style="min-width:200px" />
        <select v-model="portFilter" class="select-sm">
          <option value="">All ports</option>
          <option v-for="p in portOptions" :key="p" :value="p">{{ p }}</option>
        </select>
        <select v-model="statusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_transit">In Transit</option>
          <option value="in_port">In Port</option>
          <option value="departed">Departed</option>
          <option value="delayed">Delayed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button class="btn" @click="movementSearch=''; portFilter=''; statusFilter=''">Clear</button>
        <ExportButton filename="uapts-vessel-movements.csv" :rows="filteredMovements" :columns="movementExportColumns" style="margin-left:auto" />
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Vessel</th>
              <th>Port</th>
              <th>Berth</th>
              <th>Movement</th>
              <th>Status</th>
              <th>ETA / ETD</th>
              <th>Cargo</th>
              <th>TEU</th>
            </tr>
          </thead>
          <tbody v-if="filteredMovements.length">
            <template v-for="m in filteredMovements" :key="m.id">
              <tr class="expand-row" @click="expandedMovement = expandedMovement === m.id ? null : m.id">
                <td class="expand-cell">{{ expandedMovement === m.id ? '▾' : '▸' }}</td>
                <td style="font-weight:600">{{ m.vessel_name }}</td>
                <td style="font-family:monospace;font-size:12px">{{ m.port_unlocode }}</td>
                <td style="font-family:monospace;font-size:12px">{{ m.berth_code || '-' }}</td>
                <td><BadgePill variant="neutral">{{ m.movement_type.replace(/_/g,' ') }}</BadgePill></td>
                <td><BadgePill :variant="mvmtBadge(m.status)">{{ m.status.replace(/_/g,' ') }}</BadgePill></td>
                <td style="font-size:11px;white-space:nowrap">
                  <div v-if="m.eta">ETA: {{ fmtDate(m.eta) }}</div>
                  <div v-if="m.etd">ETD: {{ fmtDate(m.etd) }}</div>
                </td>
                <td style="font-size:12px">{{ m.cargo_type }}</td>
                <td style="font-size:12px">{{ m.teu_count > 0 ? fmtNum(m.teu_count) : '-' }}</td>
              </tr>
              <tr v-if="expandedMovement === m.id" class="detail-row">
                <td :colspan="9">
                  <div class="drilldown">
                    <div class="dd-item"><span class="dd-label">IMO</span><span style="font-family:monospace">{{ m.vessel_imo }}</span></div>
                    <div class="dd-item"><span class="dd-label">ATA</span><span>{{ m.ata ? fmtDate(m.ata) : '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">ATD</span><span>{{ m.atd ? fmtDate(m.atd) : '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Cargo Tonnage</span><span>{{ fmtNum(m.cargo_tonnage) }}t</span></div>
                    <div class="dd-item"><span class="dd-label">International</span><span>{{ m.is_international ? 'Yes' : 'No' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Agency</span><span>{{ m.agency || '-' }}</span></div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
          <tbody v-else><tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading movements…' : 'No vessel movements match the current filters.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Vessel Registry & Movements')

import { useAviationMaritime } from '~/composables/api'
import type { Vessel, VesselMovement } from '~/composables/api'

const vessels   = ref<Vessel[]>([])
const movements = ref<VesselMovement[]>([])
const loading   = ref(true)
const error     = ref<string | null>(null)

const vesselSearch     = ref('')
const vesselTypeFilter = ref('')
const certFilter       = ref('')
const expandedVessel   = ref<string | null>(null)

const movementSearch = ref('')
const portFilter     = ref('')
const statusFilter   = ref('')
const expandedMovement = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()

  const [vsRes, mvRes] = await Promise.allSettled([
    avm.vessels({ page_size: 200 } as any),
    avm.vesselMovements({ page_size: 200 } as any),
  ])

  if (vsRes.status === 'fulfilled') vessels.value   = (vsRes.value as any).results ?? []
  if (mvRes.status === 'fulfilled') movements.value = (mvRes.value as any).results ?? []

  if ([vsRes, mvRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Filters ──────────────────────────────────────────────────────────────
const filteredVessels = computed(() => vessels.value.filter(v => {
  if (vesselSearch.value) {
    const q = vesselSearch.value.toLowerCase()
    if (!v.vessel_name.toLowerCase().includes(q) && !v.imo_number.toLowerCase().includes(q)) return false
  }
  if (vesselTypeFilter.value && v.vessel_type !== vesselTypeFilter.value) return false
  if (certFilter.value && v.safety_cert_status !== certFilter.value) return false
  return true
}))
const vesselExportColumns = [
  { key: 'vessel_name', label: 'Vessel' },
  { key: 'imo_number', label: 'IMO' },
  { key: 'mmsi', label: 'MMSI' },
  { key: 'vessel_type', label: 'Type' },
  { key: 'flag_state', label: 'Flag' },
  { key: 'gross_tonnage', label: 'GRT' },
  { key: 'deadweight_tonnage', label: 'DWT' },
  { key: 'owner', label: 'Owner' },
  { key: 'operator', label: 'Operator' },
  { key: 'safety_cert_status', label: 'Safety Cert' },
]

const portOptions = computed(() => [...new Set(movements.value.map(m => m.port_unlocode))].sort())
const filteredMovements = computed(() => movements.value.filter(m => {
  if (movementSearch.value && !m.vessel_name.toLowerCase().includes(movementSearch.value.toLowerCase())) return false
  if (portFilter.value && m.port_unlocode !== portFilter.value) return false
  if (statusFilter.value && m.status !== statusFilter.value) return false
  return true
}))
const movementExportColumns = [
  { key: 'vessel_name', label: 'Vessel' },
  { key: 'vessel_imo', label: 'IMO' },
  { key: 'port_unlocode', label: 'Port' },
  { key: 'berth_code', label: 'Berth' },
  { key: 'movement_type', label: 'Movement' },
  { key: 'status', label: 'Status' },
  { key: 'eta', label: 'ETA' },
  { key: 'etd', label: 'ETD' },
  { key: 'cargo_type', label: 'Cargo' },
  { key: 'teu_count', label: 'TEU' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string | null) {
  if (!s) return '-'
  try { return new Date(s).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return s }
}
function certBadge(s: string) {
  const m: Record<string,string> = { valid:'success', pending:'warning', expired:'danger' }
  return m[s] ?? 'neutral'
}
function mvmtBadge(s: string) {
  const m: Record<string,string> = { in_port:'success', in_transit:'info', scheduled:'neutral', departed:'fair', delayed:'warning', cancelled:'danger' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
.expand-row { cursor:pointer; }
.expand-cell { width:18px; color:#94a3b8; font-size:11px; }
.detail-row td { background:#fafbfc; padding:14px 18px; border-bottom:1px solid #f1f5f9; }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; }
</style>
