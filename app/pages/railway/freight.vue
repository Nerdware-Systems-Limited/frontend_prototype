<template>
  <PageHeader
    eyebrow="Railway - Freight & Logistics"
    title="Freight Operations"
    subtitle="KRC · KPA · KenTrade · NCTTCA - Freight manifests, corridor analysis, KenTrade single-window clearances, NCTTCA transit tracking, and KPA port-rail reconciliation"
  >
    <template #actions>
      <NuxtLink to="/railway/infrastructure" class="btn">Freight Terminals<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner banner-icon-warn" role="alert">{{ error }}</div>

  <!-- KPIs: counted and summed by the server over ALL manifests in the chosen period / county -->
  <div class="kpi-grid">
    <KpiCard label="Total Shipments" :value="fmtNum(stats.count.value)" :unavailable="unavailable" :unavailable-note="note" :period="rangeTag" description="Manifests in view" to="#manifest-log" />
    <KpiCard label="Total Tonnage" :value="totalTons != null ? `${fmtNum(totalTons)} t` : '-'" :unavailable="unavailable" :unavailable-note="note" :period="rangeTag" description="Freight carried" to="#cargo-type-mix" />
    <KpiCard label="Total Revenue" :value="totalRevenue != null ? `KES ${fmtKES(totalRevenue)}` : '-'" :unavailable="unavailable" :unavailable-note="note" :period="rangeTag" description="Freight revenue" to="#manifest-log" />
    <KpiCard label="Avg Wagons/Shipment" :value="avgWagons != null ? avgWagons.toFixed(1) : '-'" :unavailable="unavailable" :unavailable-note="note" :period="rangeTag" description="Average wagon count" />
    <KpiCard label="Port-Rail Manifests" :value="fmtNum(portStats.count.value)" :unavailable="portStats.count.value === null" :unavailable-note="note" :period="rangeTag" description="Rail-nominated containers (KPA)" to="#port-rail-reconciliation" />
    <KpiCard label="Transit Manifests" :value="fmtNum(transitStats.count.value)" :unavailable="transitStats.count.value === null" :unavailable-note="note" :period="rangeTag" description="From port of origin" to="#intermodal-transfer" />
  </div>

  <!-- Cargo type mix + corridor breakdown -->
  <div class="two-col">
    <div id="cargo-type-mix" class="card drill-target">
      <div class="card-header">Cargo Type Mix</div>
      <div class="card-body">
        <div v-if="byCargoType.length" class="type-list">
          <div v-for="c in byCargoType" :key="c.type" class="type-row">
            <span class="type-label">{{ c.type.replace(/_/g,' ') }}</span>
            <div class="type-bar-wrap">
              <div class="type-bar" :style="{ transform: `scaleX(${maxCargoTons > 0 ? c.tons / maxCargoTons : 0})`, background: cargoColor(c.type) }" />
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end">
              <span style="font-size:12px;font-weight:600">{{ fmtNum(c.tons) }}t</span>
              <span style="font-size:11px;color:var(--fg-3)">{{ c.count }} ships</span>
            </div>
          </div>
        </div>
        <EmptyState v-else :loading="stats.loading.value" message="No cargo data." compact />
      </div>
    </div>

    <div class="card">
      <div class="card-header">Top Freight Corridors ({{ timeRange.period.value.toLowerCase() }})</div>
      <div class="card-body">
        <div v-if="corridors.length" class="corridor-list">
          <div v-for="c in corridors.slice(0, 8)" :key="`${c.origin_station__code}-${c.destination_station__code}-${c.cargo_type}`" class="corridor-item">
            <div class="ci-header">
              <span class="ci-route">{{ c.origin_station__code ?? c.origin }} → {{ c.destination_station__code ?? c.destination }}</span>
              <BadgePill variant="neutral">{{ (c.cargo_type ?? 'mixed').replace(/_/g,' ') }}</BadgePill>
            </div>
            <div class="ci-stats">
              <span><strong>{{ fmtNum(c.tons ?? c.total_tons) }}</strong> t</span>
              <span><strong>{{ fmtNum(c.shipments) }}</strong> shipments</span>
            </div>
            <div class="ci-bar-wrap">
              <div class="ci-bar" :style="{ transform: `scaleX(${maxCorridorTons > 0 ? (c.tons ?? c.total_tons ?? 0) / maxCorridorTons : 0})` }" />
            </div>
          </div>
        </div>
        <EmptyState v-else :loading="corridorsLoading" message="No corridor data." compact />
      </div>
    </div>
  </div>

  <!-- Port-Rail reconciliation -->
  <SectionTitle pill="KRC / KPA · Rail-Nominated Containers">Port-Rail Container Reconciliation</SectionTitle>

  <div id="port-rail-reconciliation" class="card drill-target">
    <div class="card-body">
      <div class="recon-note">
        Rail-nominated containers are manifests with a KPA customs clearance reference or declared port origin.
        This view replaces the manual KRC-KPA reconciliation process.
      </div>
      <DataTable :table="portRailTable" row-key="id" title="Port-rail manifests" export-name="uapts-port-rail-manifests"
                 placeholder="Search manifest, customs ref, port…" empty="No port-rail manifests found.">
        <template #cell-manifest_ref="{ row }"><span style="font-family:monospace;font-weight:700;font-size:12px">{{ row.manifest_ref }}</span></template>
        <template #cell-customs_clearance_ref="{ row }"><span style="font-family:monospace;font-size:12px;color:var(--link)">{{ row.customs_clearance_ref || '-' }}</span></template>
        <template #cell-tonnage="{ row }"><span style="font-weight:600">{{ fmtNum(row.tonnage) }}t</span></template>
        <template #cell-route="{ row }">{{ row.origin_station_code }} → {{ row.destination_station_code }}</template>
        <template #cell-arrived_at="{ row }">
          <span v-if="row.arrived_at">{{ fmtTime(row.arrived_at) }}</span>
          <span v-else style="color:var(--warning-fg)">Pending</span>
        </template>
      </DataTable>
    </div>
  </div>

  <!-- Intermodal transfer analysis -->
  <SectionTitle pill="Computed · Rail-Port">Intermodal Transfer Analysis</SectionTitle>
  <div id="intermodal-transfer" class="card drill-target" style="margin-bottom:16px">
    <div class="card-body">
      <div class="recon-note">
        Rail-port intermodal performance, grouped by the server over manifests with a declared port of origin. Rail-road intermodal transfer is not yet modelled - no road-leg linkage exists in the freight data today.
      </div>
      <div v-if="intermodalByPort.length" class="port-list">
        <div class="port-head"><span>Port of Origin</span><span>Manifests</span><span>Tonnage</span><span>Pending Arrival</span></div>
        <div v-for="p in intermodalByPort" :key="p.port" class="port-row">
          <span style="font-weight:600">{{ p.port }}</span>
          <span>{{ fmtNum(p.count) }}</span>
          <span>{{ fmtNum(p.tons) }}t</span>
          <span :style="{ color: p.pending > 0 ? 'var(--warning-fg)' : 'inherit' }">{{ p.pending }}</span>
        </div>
      </div>
      <EmptyState v-else :loading="transitStats.loading.value" message="No manifests with a declared port of origin in the current view." icon="search" compact />
    </div>
  </div>

  <!-- Full manifest log -->
  <SectionTitle>Freight Manifest Log</SectionTitle>

  <div id="manifest-log" class="card drill-target">
    <div class="card-body">
      <DataTable :table="manifestTable" row-key="id" title="Freight manifest log" export-name="uapts-freight-manifests" expandable filters-open
                 placeholder="Search manifest, station, train…" empty="No manifests match the current filters.">
        <template #cell-manifest_ref="{ row }"><span style="font-family:monospace;font-weight:700;font-size:12px">{{ row.manifest_ref }}</span></template>
        <template #cell-tonnage="{ row }"><span style="font-weight:600">{{ fmtNum(row.tonnage) }}t</span></template>
        <template #cell-route="{ row }">{{ row.origin_station_code }} → {{ row.destination_station_code }}</template>
        <template #cell-revenue_kes="{ row }">{{ fmtKES(parseFloat(row.revenue_kes)) }}</template>
        <template #cell-arrived_at="{ row }"><span style="color:var(--success-fg)">{{ row.arrived_at ? fmtTime(row.arrived_at) : '-' }}</span></template>
        <template #expanded="{ row }">
          <div class="drilldown">
            <div class="dd-item"><span class="dd-label">Operator</span><span>{{ row.operator_agency_code ?? row.operator ?? '-' }}</span></div>
            <div class="dd-item"><span class="dd-label">Port of Origin</span><span style="font-family:monospace">{{ row.port_origin || '-' }}</span></div>
            <div class="dd-item"><span class="dd-label">Customs Ref (KPA)</span><span style="font-family:monospace">{{ row.customs_clearance_ref || '-' }}</span></div>
          </div>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useApi } from '~/composables/api/_client'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useServerCount } from '~/composables/useServerCount'
import { useCountyScope } from '~/composables/useCountyScope'
import { useTimeRange } from '~/composables/useTimeRange'
import type { TableColumn } from '~/types/dataTable'

// Every table and KPI asks the server for the page's period (the global one unless picked here) and county, so they always
// agree - nothing is derived from a first page of manifests (see docs/data-tables.md).
const RAIL = '/api/v1/railway'
const F = `${RAIL}/freight/`
const api = useApi()
const timeRange = useTimeRange('railway', { default: '30d', years: true, custom: true })
const county = useCountyScope('railway')
const rangeTag = computed(() => timeRange.period.value)
const scope = () => ({ ...timeRange.query.value, ...county.query.value })

const CARGO = ['container', 'bulk_fuel', 'bulk_cement', 'grain', 'general', 'vehicle', 'steel'].map(value => ({ value, label: value.replace(/_/g, ' ') }))
const CARGO_BADGE: Record<string, string> = { container: 'info', bulk_fuel: 'warning', bulk_cement: 'neutral', grain: 'success', vehicle: 'fair', steel: 'neutral' }

// ── Tables ───────────────────────────────────────────────────────────────
const portRailColumns: TableColumn[] = [
  { key: 'manifest_ref', label: 'Manifest Ref', priority: 1, pin: 'left' },
  { key: 'customs_clearance_ref', label: 'Customs Ref (KPA)', priority: 2 },
  { key: 'port_origin', label: 'Port of Origin', type: 'mono', priority: 2 },
  { key: 'cargo_type', label: 'Cargo Type', type: 'badge', badge: CARGO_BADGE, options: CARGO, priority: 1 },
  { key: 'tonnage', label: 'Tonnage', type: 'num', priority: 1 },
  { key: 'wagon_count', label: 'Wagons', type: 'num', priority: 3 },
  { key: 'route', label: 'Route', sortable: 'origin_station_code', filter: false, exportAs: r => `${r.origin_station_code} - ${r.destination_station_code}`, priority: 2 },
  { key: 'operator_agency_code', label: 'Operator', priority: 3 },
  { key: 'dispatched_at', label: 'Dispatched', type: 'datetime', priority: 1 },
  { key: 'arrived_at', label: 'Arrived', type: 'datetime', priority: 2 },
]
const portRailTable = useEndpointTable({
  key: 'rail-port-rail', path: F, columns: portRailColumns, countyKey: 'railway', pageSize: 15,
  params: () => ({ ...timeRange.query.value, port_linked: 'true' }), defaultSort: [{ key: 'dispatched_at', dir: 'desc' }],
})

const manifestColumns: TableColumn[] = [
  { key: 'manifest_ref', label: 'Manifest Ref', priority: 1, pin: 'left' },
  { key: 'cargo_type', label: 'Cargo Type', type: 'badge', badge: CARGO_BADGE, options: CARGO, priority: 1 },
  { key: 'tonnage', label: 'Tonnage', type: 'num', priority: 1 },
  { key: 'wagon_count', label: 'Wagons', type: 'num', priority: 3 },
  { key: 'route', label: 'Route', sortable: 'origin_station_code', filter: false, exportAs: r => `${r.origin_station_code} - ${r.destination_station_code}`, priority: 2 },
  { key: 'schedule_train_number', label: 'Train', type: 'mono', priority: 2 },
  { key: 'revenue_kes', label: 'Revenue (KES)', type: 'num', priority: 2 },
  { key: 'dispatched_at', label: 'Dispatched', type: 'datetime', priority: 1 },
  { key: 'arrived_at', label: 'Arrived', type: 'datetime', priority: 2 },
]
const manifestTable = useEndpointTable({
  key: 'rail-freight-manifests', path: F, columns: manifestColumns, countyKey: 'railway', pageSize: 15,
  params: () => timeRange.query.value, defaultSort: [{ key: 'dispatched_at', dir: 'desc' }],
})

// ── KPIs and breakdowns: computed by the server ──────────────────────────
const stats = useServerCount(F, scope, { aggregate: ['sum:tonnage', 'sum:revenue_kes', 'avg:wagon_count'], groupBy: ['cargo_type'], groupAggregate: ['sum:tonnage'] })
const portStats = useServerCount(F, () => ({ ...scope(), port_linked: 'true' }))
const transitStats = useServerCount(F, () => ({ ...scope(), port_origin_set: 'true' }), { groupBy: ['port_origin'], groupAggregate: ['sum:tonnage'] })
const pendingStats = useServerCount(F, () => ({ ...scope(), port_origin_set: 'true', 'f.arrived_at__isnull': 'true' }), { groupBy: ['port_origin'] })
const allStats = [stats, portStats, transitStats, pendingStats]

const unavailable = computed(() => stats.count.value === null)
const note = computed(() => stats.loading.value ? 'Loading…' : 'KRC feed unavailable')
const error = computed(() => stats.failed.value && !stats.loading.value ? 'Unable to reach the UAPTS Railway API.' : null)
const totalTons = computed(() => stats.sum('tonnage'))
const totalRevenue = computed(() => stats.sum('revenue_kes'))
const avgWagons = computed(() => stats.avg('wagon_count'))

const byCargoType = computed(() =>
  (stats.groups.value.cargo_type ?? [])
    .map(g => ({ type: String(g.value), tons: stats.groupValue('cargo_type', g.value, 'sum:tonnage') ?? 0, count: g.count }))
    .sort((a, b) => b.tons - a.tons))
const intermodalByPort = computed(() =>
  (transitStats.groups.value.port_origin ?? []).map(g => ({
    port: String(g.value), count: g.count, tons: transitStats.groupValue('port_origin', g.value, 'sum:tonnage') ?? 0,
    pending: pendingStats.groupCount('port_origin', g.value) ?? 0,
  })))
const maxCargoTons = computed(() => Math.max(1, ...byCargoType.value.map(c => c.tons)))

// ── Corridors: a ranked top-N the server rolls up ────────────────────────
const corridors = ref<any[]>([])
const corridorsLoading = ref(true)
async function loadCorridors() {
  try { corridors.value = (await api<any>(`${F}by-corridor/`, { query: scope() }))?.results ?? [] } catch { corridors.value = [] } finally { corridorsLoading.value = false }
}
const maxCorridorTons = computed(() => Math.max(1, ...corridors.value.map(c => c.tons ?? c.total_tons ?? 0)))
watch(() => JSON.stringify(scope()), loadCorridors)
onMounted(loadCorridors)

function refreshAll() { void Promise.all([portRailTable.refresh(), manifestTable.refresh(), ...allStats.map(s => s.refresh()), loadCorridors()]) }
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(refreshAll, 120_000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

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
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; margin-bottom:16px; }

/* ── Layout ── */
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; align-items:start; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }

/* ── Cargo type list ── */
.type-list { display:flex; flex-direction:column; gap:10px; }
.type-row { display:grid; grid-template-columns:110px 1fr 70px; align-items:center; gap:8px; }
.type-label { font-size:12px; text-transform:capitalize; font-weight:500; color:var(--fg-2); }
.type-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.type-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s ease; }

/* ── Corridor list ── */
.corridor-list { display:flex; flex-direction:column; gap:0; }
.corridor-item {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-subtle);
}
.corridor-item:last-child { border-bottom: none; }
.ci-header { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
.ci-route { font-family:monospace; font-size:13px; font-weight:700; color:var(--fg-1); flex:1; }
.ci-stats { display:flex; gap:14px; font-size:12px; color:var(--fg-2); margin-bottom:5px; }
.ci-stats strong { color:var(--fg-1); font-weight:700; }
.ci-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:5px; overflow:hidden; }
.ci-bar { height:100%; width:100%; background:var(--primary-fill); border-radius:4px; transform-origin:left; transition:transform .4s ease; }

/* ── Reconciliation note ── */
.recon-note { font-size:12px; color:var(--info-fg); background:var(--info-bg); border:1px solid var(--info-fg); border-radius:7px; padding:9px 13px; margin-bottom:12px; line-height:1.5; }

/* ── Filters & table ── */
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--fg-3); }
.port-list { display:flex; flex-direction:column; max-height:420px; overflow-y:auto; }
.port-head, .port-row { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:10px; padding:7px 4px; font-size:13px; align-items:center; }
.port-head { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--fg-3); border-bottom:1px solid var(--border-subtle); position:sticky; top:0; background:var(--surface-1, var(--surface)); }
.port-row { border-bottom:1px solid var(--border-subtle); }
</style>
