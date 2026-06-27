<template>
  <PageHeader
    eyebrow="Railway - Freight & Logistics"
    title="Freight Operations"
    subtitle="KRC · KPA · KenTrade · NCTTCA - Freight manifests, corridor analysis, KenTrade single-window clearances, NCTTCA transit tracking, and KPA port-rail reconciliation"
  >
    <template #actions>
      <span class="freshness-badge" :class="{ loading }">
        {{ loading ? 'Refreshing…' : `Updated ${lastRefreshed}` }}
      </span>
      <div class="day-filter">
        <button v-for="d in [7, 30, 90]" :key="d" class="btn" :class="{ 'btn-active': days === d }" @click="days = d; load()">{{ d }}d</button>
      </div>
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Shipments"
      :value="fmtNum(manifests.length)"
      sub="Manifests in view"
      source="batch" source-title="KRC"
    />
    <KpiCard
      label="Total Tonnage"
      :value="totalTons ? `${fmtNum(totalTons)} t` : '-'"
      sub="Freight tonne-km"
      trend-direction="up"
      source="batch" source-title="KRC"
    />
    <KpiCard
      label="Total Revenue"
      :value="totalRevenue ? `KES ${fmtKES(totalRevenue)}` : '-'"
      sub="Freight revenue"
      trend-direction="up"
      source="batch" source-title="KRC"
    />
    <KpiCard
      label="Avg Wagons/Shipment"
      :value="avgWagons ? avgWagons.toFixed(1) : '-'"
      sub="Average wagon count"
      source="batch" source-title="KRC"
    />
    <KpiCard
      label="Port-Rail Manifests"
      :value="fmtNum(portRailManifests.length)"
      sub="Rail-nominated containers (KPA)"
      source="batch" source-title="KRC / KPA"
    />
    <KpiCard
      label="Transit Manifests"
      :value="fmtNum(manifests.filter(m => m.port_origin).length)"
      sub="From port of origin"
      source="batch" source-title="KRC"
    />
  </div>

  <!-- Cargo type mix + corridor breakdown -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">Cargo Type Mix</div>
      <div class="card-body">
        <div v-if="byCargoType.length" class="type-list">
          <div v-for="c in byCargoType" :key="c.type" class="type-row">
            <span class="type-label">{{ c.type.replace(/_/g,' ') }}</span>
            <div class="type-bar-wrap">
              <div class="type-bar" :style="{ width: `${maxCargoTons > 0 ? (c.tons / maxCargoTons) * 100 : 0}%`, background: cargoColor(c.type) }" />
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end">
              <span style="font-size:12px;font-weight:600">{{ fmtNum(c.tons) }}t</span>
              <span style="font-size:10px;color:#94a3b8">{{ c.count }} ships</span>
            </div>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No cargo data.' }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Top Freight Corridors ({{ days }}d)</div>
      <div class="card-body">
        <div v-if="corridors.length" class="corridor-list">
          <div v-for="c in corridors.slice(0, 8)" :key="`${c.origin_station__code}-${c.destination_station__code}`" class="corridor-item">
            <div class="ci-header">
              <span class="ci-route">{{ c.origin_station__code ?? c.origin }} → {{ c.destination_station__code ?? c.destination }}</span>
              <BadgePill variant="neutral">{{ (c.cargo_type ?? 'mixed').replace(/_/g,' ') }}</BadgePill>
            </div>
            <div class="ci-stats">
              <span><strong>{{ fmtNum(c.tons ?? c.total_tons) }}</strong> t</span>
              <span><strong>{{ fmtNum(c.shipments) }}</strong> shipments</span>
            </div>
            <div class="ci-bar-wrap">
              <div class="ci-bar" :style="{ width: `${maxCorridorTons > 0 ? ((c.tons ?? c.total_tons ?? 0) / maxCorridorTons) * 100 : 0}%` }" />
            </div>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No corridor data.' }}</div>
      </div>
    </div>
  </div>

  <!-- Port-Rail reconciliation -->
  <SectionTitle pill="KRC / KPA · Rail-Nominated Containers">Port-Rail Container Reconciliation</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="recon-note">
        Rail-nominated containers are manifests with a KPA customs clearance reference or declared port origin.
        This view replaces the manual KRC-KPA reconciliation process.
      </div>
      <table>
        <thead>
          <tr>
            <th>Manifest Ref</th>
            <th>Customs Ref (KPA)</th>
            <th>Port of Origin</th>
            <th>Cargo Type</th>
            <th>Tonnage</th>
            <th>Wagons</th>
            <th>Route</th>
            <th>Operator</th>
            <th>Dispatched</th>
            <th>Arrived</th>
          </tr>
        </thead>
        <tbody v-if="portRailManifests.length">
          <tr v-for="m in portRailManifests.slice(0, 30)" :key="m.id">
            <td style="font-family:monospace;font-weight:700;font-size:12px">{{ m.manifest_ref }}</td>
            <td style="font-family:monospace;font-size:12px;color:#3b82f6">{{ m.customs_clearance_ref ?? '-' }}</td>
            <td style="font-family:monospace;font-size:12px">{{ m.port_origin ?? '-' }}</td>
            <td><BadgePill :variant="cargoBadge(m.cargo_type)">{{ m.cargo_type.replace(/_/g,' ') }}</BadgePill></td>
            <td style="font-weight:600">{{ fmtNum(m.tonnage) }}t</td>
            <td>{{ m.wagon_count }}</td>
            <td style="font-size:12px">{{ m.origin_station_code }} → {{ m.destination_station_code }}</td>
            <td style="font-size:12px">{{ m.operator_agency_code ?? m.operator ?? '-' }}</td>
            <td style="font-size:11px;white-space:nowrap">{{ fmtTime(m.dispatched_at) }}</td>
            <td style="font-size:11px;white-space:nowrap">
              <span v-if="m.arrived_at">{{ fmtTime(m.arrived_at) }}</span>
              <span v-else style="color:#f59e0b">Pending</span>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading reconciliation data…' : 'No port-rail manifests found.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Full manifest log -->
  <SectionTitle>Freight Manifest Log</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="cargoFilter" class="select-sm">
          <option value="">All cargo types</option>
          <option value="container">Container</option>
          <option value="bulk_fuel">Bulk Fuel</option>
          <option value="bulk_cement">Bulk Cement</option>
          <option value="grain">Grain</option>
          <option value="general">General</option>
          <option value="vehicle">Vehicle</option>
          <option value="steel">Steel</option>
        </select>
        <input v-model="manifestSearch" class="select-sm" placeholder="Search manifest / route…" style="min-width:180px" />
        <button class="btn" @click="cargoFilter=''; manifestSearch=''">Clear</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Manifest Ref</th>
            <th>Cargo Type</th>
            <th>Tonnage</th>
            <th>Wagons</th>
            <th>Route</th>
            <th>Train</th>
            <th>Revenue (KES)</th>
            <th>Dispatched</th>
            <th>Arrived</th>
          </tr>
        </thead>
        <tbody v-if="filteredManifests.length">
          <tr v-for="m in filteredManifests.slice(0, 50)" :key="m.id">
            <td style="font-family:monospace;font-weight:700;font-size:12px">{{ m.manifest_ref }}</td>
            <td><BadgePill :variant="cargoBadge(m.cargo_type)">{{ m.cargo_type.replace(/_/g,' ') }}</BadgePill></td>
            <td style="font-weight:600">{{ fmtNum(m.tonnage) }}t</td>
            <td>{{ m.wagon_count }}</td>
            <td style="font-size:12px">{{ m.origin_station_code }} → {{ m.destination_station_code }}</td>
            <td style="font-family:monospace;font-size:12px">{{ m.schedule_train_number ?? '-' }}</td>
            <td style="font-size:12px">{{ fmtKES(parseFloat(m.revenue_kes)) }}</td>
            <td style="font-size:11px;white-space:nowrap">{{ fmtTime(m.dispatched_at) }}</td>
            <td style="font-size:11px;white-space:nowrap;color:#22c55e">{{ m.arrived_at ? fmtTime(m.arrived_at) : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading manifests…' : 'No manifests match filters.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Rail Freight')

import { useRailway } from '~/composables/api'
import type { FreightManifest } from '~/composables/api'

const manifests = ref<FreightManifest[]>([])
const corridors = ref<any[]>([])
const loading   = ref(true)
const error     = ref<string | null>(null)
const lastRefreshed = ref('-')
const days          = ref(30)
const cargoFilter   = ref('')
const manifestSearch = ref('')

async function load() {
  loading.value = true
  error.value = null
  const rail = useRailway()

  const [mfRes, corrRes] = await Promise.allSettled([
    rail.freight({ page_size: 100, days: days.value }),
    rail.freightByCorridor(days.value),
  ])

  if (mfRes.status   === 'fulfilled') manifests.value = (mfRes.value as any).results ?? []
  if (corrRes.status === 'fulfilled') corridors.value = (corrRes.value as any).results ?? []

  if ([mfRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Railway API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const portRailManifests = computed(() =>
  manifests.value.filter(m => m.customs_clearance_ref || m.port_origin),
)

const filteredManifests = computed(() =>
  manifests.value.filter(m => {
    if (cargoFilter.value    && m.cargo_type !== cargoFilter.value)                                               return false
    if (manifestSearch.value) {
      const q = manifestSearch.value.toLowerCase()
      if (!m.manifest_ref.toLowerCase().includes(q) &&
          !m.origin_station_code.toLowerCase().includes(q) &&
          !m.destination_station_code.toLowerCase().includes(q)) return false
    }
    return true
  }),
)

const byCargoType = computed(() => {
  const map = new Map<string, { type: string; tons: number; count: number }>()
  manifests.value.forEach(m => {
    const ex = map.get(m.cargo_type)
    if (ex) { ex.tons += m.tonnage; ex.count++ }
    else map.set(m.cargo_type, { type: m.cargo_type, tons: m.tonnage, count: 1 })
  })
  return Array.from(map.values()).sort((a, b) => b.tons - a.tons)
})

const totalTons    = computed(() => manifests.value.reduce((s, m) => s + m.tonnage, 0))
const totalRevenue = computed(() => manifests.value.reduce((s, m) => s + parseFloat(m.revenue_kes), 0))
const avgWagons    = computed(() => manifests.value.length > 0 ? manifests.value.reduce((s, m) => s + m.wagon_count, 0) / manifests.value.length : null)
const maxCargoTons    = computed(() => Math.max(1, ...byCargoType.value.map(c => c.tons)))
const maxCorridorTons = computed(() => Math.max(1, ...corridors.value.map(c => c.tons ?? c.total_tons ?? 0)))

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '-'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}k`
  return Math.round(n).toLocaleString()
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function cargoColor(t: string) {
  const m: Record<string,string> = { container:'#3b82f6', bulk_fuel:'#f59e0b', bulk_cement:'#94a3b8', grain:'#22c55e', vehicle:'#a855f7', steel:'#64748b', general:'#10b981' }
  return m[t] ?? '#6b7280'
}
function cargoBadge(t: string) {
  const m: Record<string,string> = { container:'info', bulk_fuel:'warning', bulk_cement:'neutral', grain:'success', vehicle:'fair', steel:'neutral' }
  return m[t] ?? 'neutral'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; margin-bottom:16px; }

/* ── Actions bar ── */
.day-filter { display:flex; gap:4px; }
.btn-active { background:#3b82f6; color:#fff; border-color:#3b82f6; }

/* ── Layout ── */
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; align-items:start; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }

/* ── Cargo type list ── */
.type-list { display:flex; flex-direction:column; gap:10px; }
.type-row { display:grid; grid-template-columns:110px 1fr 70px; align-items:center; gap:8px; }
.type-label { font-size:12px; text-transform:capitalize; font-weight:500; color:#374151; }
.type-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.type-bar { height:100%; border-radius:4px; transition:width .4s ease; }

/* ── Corridor list ── */
.corridor-list { display:flex; flex-direction:column; gap:0; }
.corridor-item {
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
}
.corridor-item:last-child { border-bottom: none; }
.ci-header { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
.ci-route { font-family:monospace; font-size:13px; font-weight:700; color:#1e293b; flex:1; }
.ci-stats { display:flex; gap:14px; font-size:12px; color:#475569; margin-bottom:5px; }
.ci-stats strong { color:#1e293b; font-weight:700; }
.ci-bar-wrap { background:#e2e8f0; border-radius:4px; height:5px; overflow:hidden; }
.ci-bar { height:100%; background:#3b82f6; border-radius:4px; transition:width .4s ease; }

/* ── Reconciliation note ── */
.recon-note { font-size:12px; color:#1e40af; background:#eff6ff; border:1px solid #bfdbfe; border-radius:7px; padding:9px 13px; margin-bottom:12px; line-height:1.5; }

/* ── Filters & table ── */
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; color:#374151; }
.select-sm:focus { outline:none; border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,.12); }
</style>
