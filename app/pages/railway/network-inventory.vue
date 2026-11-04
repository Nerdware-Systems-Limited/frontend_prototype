<template>
  <PageHeader
    eyebrow="Railway"
    title="Rail Network Inventory"
    subtitle="KRC · NCTTCA - Line, station and rolling-stock registry with an SGR/MGR comparison panel and cross-network data quality checks"
  >
    <template #actions>
      <NuxtLink to="/railway/infrastructure" class="btn">Rail Infrastructure<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/railway/live" class="btn">Train Operations<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- SGR / MGR comparison: grouped by the server over the chosen period and county -->
  <SectionTitle pill="Computed · Live Registry">SGR / MGR Comparison</SectionTitle>
  <div class="compare-grid">
    <div v-for="c in comparison" :key="c.network" class="compare-card">
      <div class="cc-header">
        <BadgePill :variant="c.network === 'sgr' ? 'info' : 'success'">{{ c.network.toUpperCase() }}</BadgePill>
        <span class="cc-lines">{{ fmtNum(c.lineCount) }} line(s)</span>
      </div>
      <div class="cc-grid">
        <div><span class="cc-label">Track km</span><span class="cc-val">{{ fmtNum(c.trackKm, 0) }}</span></div>
        <div><span class="cc-label">Active Stations</span><span class="cc-val">{{ fmtNum(c.activeStations) }}</span></div>
        <div><span class="cc-label">Active Trains</span><span class="cc-val">{{ fmtNum(c.activeTrains) }}</span></div>
        <div><span class="cc-label">Weekly Services</span><span class="cc-val">{{ fmtNum(c.scheduleCount) }}</span></div>
        <div><span class="cc-label">On-Time %</span><span class="cc-val">{{ c.onTimePct != null ? c.onTimePct.toFixed(1) + '%' : '-' }}</span></div>
        <div><span class="cc-label">Bookings ({{ rangeTag.toLowerCase() }})</span><span class="cc-val">{{ fmtNum(c.bookings) }}</span></div>
        <div><span class="cc-label">Freight (t, {{ rangeTag.toLowerCase() }})</span><span class="cc-val">{{ fmtNum(c.freightTons) }}</span></div>
        <div><span class="cc-label">Revenue ({{ rangeTag.toLowerCase() }})</span><span class="cc-val">KES {{ fmtKES(c.revenueKes) }}</span></div>
        <div><span class="cc-label">Active Incidents</span><span class="cc-val" :class="{ 'val-danger': (c.activeIncidents ?? 0) > 0 }">{{ fmtNum(c.activeIncidents) }}</span></div>
      </div>
    </div>
  </div>

  <!-- Network map -->
  <SectionTitle pill="Live · OSM-Sourced Geometry">Network Map</SectionTitle>
  <CollapsibleSection class="card map-card" title="Lines &amp; Stations" storage-key="map:railway/network-inventory">
    <ClientOnly>
      <UaptsMap
        :markers="stationMarkers"
        :lines="railLines"
        :center="[-1.0, 37.5]"
        :zoom="6"
        height="440px"
        show-legend
      />
    </ClientOnly>
    <div class="map-key">
      <span class="mk"><span class="line-seg" style="background:#3b82f6" /> SGR</span>
      <span class="mk"><span class="line-seg" style="background:#10b981" /> MGR</span>
    </div>
  </CollapsibleSection>

  <!-- Line inventory -->
  <SectionTitle pill="Live · OSM-Sourced Geometry">Line Inventory</SectionTitle>
  <div class="card">
    <div class="card-body">
      <DataTable :table="lineTable" row-key="id" title="Rail lines" export-name="uapts-rail-lines" filters-open
                 placeholder="Search line, operator, region…" empty="No lines available.">
        <template #cell-name="{ row }"><span style="font-weight:600">{{ row.name || row.osm_id }}</span></template>
        <template #cell-gauge="{ row }">{{ row.gauge }}{{ row.gauge_mm ? ` (${row.gauge_mm}mm)` : '' }}</template>
        <template #cell-admin1_name="{ row }">{{ [row.admin1_name, row.admin2_name].filter(Boolean).join(' / ') || '-' }}</template>
        <template #cell-length_km="{ row }">{{ row.length_km != null ? Number(row.length_km).toFixed(1) : '-' }}</template>
        <template #cell-electrification="{ row }">{{ row.electrification ? `Electrified${row.electrified_voltage_kv ? ` (${row.electrified_voltage_kv}kV)` : ''}` : 'Non-electrified' }}</template>
      </DataTable>
      <div class="source-note">Origin/destination termini and dedicated signalling status are not yet modelled per line - region shown is the OSM administrative boundary the line traverses.</div>
    </div>
  </div>

  <!-- Station inventory -->
  <SectionTitle pill="Live · OSM-Sourced Geometry">Station Inventory</SectionTitle>
  <div class="card">
    <div class="card-body">
      <DataTable :table="stationTable" row-key="id" title="Stations" export-name="uapts-rail-stations" expandable filters-open
                 placeholder="Search station name or code…" empty="No stations match the current filters.">
        <template #cell-code="{ row }"><span style="font-family:monospace;font-weight:700">{{ row.code }}</span></template>
        <template #cell-name="{ row }"><span style="font-weight:600">{{ row.name }}</span></template>
        <template #cell-latitude="{ row }"><span style="font-size:11px;font-family:monospace">{{ row.latitude != null && row.longitude != null ? `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}` : '-' }}</span></template>
        <template #expanded="{ row }"><StationActivityPanel :code="row.code" :scope="scope()" /></template>
      </DataTable>
    </div>
  </div>

  <!-- Rolling stock registry -->
  <SectionTitle pill="Live Registry">Rolling Stock Registry</SectionTitle>
  <div class="card">
    <div class="card-body">
      <DataTable :table="trainTable" row-key="id" title="Rolling stock" export-name="uapts-rolling-stock" filters-open
                 placeholder="Search unit, type, depot…" empty="No rolling stock matches the current filters.">
        <template #cell-unit_id="{ row }"><span style="font-family:monospace;font-weight:700">{{ row.unit_id }}</span></template>
        <template #cell-capacity_passengers="{ row }">{{ row.capacity_passengers ? `${fmtNum(row.capacity_passengers)} pax` : `${fmtNum(row.capacity_freight_tons)}t` }}</template>
        <template #cell-next_maintenance="{ row }"><span :style="{ color: isDue(row.next_maintenance) ? 'var(--danger-fg)' : 'inherit' }">{{ fmtDate(row.next_maintenance) }}</span></template>
        <template #cell-year_built="{ row }">{{ row.year_built ? new Date().getFullYear() - row.year_built : '-' }}</template>
      </DataTable>
    </div>
  </div>

  <!-- Data quality: each check is a server query -->
  <SectionTitle pill="Computed · Cross-Network">Data Quality Checks</SectionTitle>
  <div class="two-col">
    <div class="card">
      <div class="card-header">Missing Geometry ({{ missingGeometryTotal }})</div>
      <div class="card-body scroll-body">
        <div v-if="quality.missingLines.length || missingStations > 0">
          <AlertItem v-for="l in quality.missingLines" :key="l.id" severity="warning" :title="l.name || l.osm_id" meta="Line - no length/geometry" />
          <AlertItem v-if="missingStations > 0" severity="warning" :title="`${missingStations} station${missingStations > 1 ? 's' : ''} without coordinates`" meta="Station - no coordinates in GeoJSON layer" />
        </div>
        <EmptyState v-else :loading="qualityLoading" message="All lines and stations have usable geometry." icon="search" compact />
      </div>
    </div>
    <div class="card">
      <div class="card-header">Stale Station Records ({{ quality.staleTotal }})</div>
      <div class="card-body scroll-body">
        <div v-if="quality.stale.length">
          <AlertItem v-for="s in quality.stale" :key="s.id" severity="info" :title="`${s.name} (${s.code})`" :meta="`Last updated ${s.updated_at ? fmtDate(s.updated_at) : 'never'}`" />
        </div>
        <EmptyState v-else :loading="qualityLoading" message="No stale station records (>365d) detected." icon="search" compact />
      </div>
    </div>
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-header">Unknown Rolling Stock Status ({{ quality.unknownTotal }})</div>
      <div class="card-body scroll-body">
        <div v-if="quality.unknown.length">
          <AlertItem v-for="tr in quality.unknown" :key="tr.id" severity="warning" :title="tr.unit_id" meta="No status recorded" />
        </div>
        <EmptyState v-else :loading="qualityLoading" message="Every rolling-stock unit has a recorded status." icon="search" compact />
      </div>
    </div>
    <div class="card">
      <div class="card-header">Inconsistent Network / Gauge Classification ({{ quality.gaugeTotal }})</div>
      <div class="card-body scroll-body">
        <div v-if="quality.gauge.length">
          <AlertItem v-for="l in quality.gauge" :key="l.id" severity="warning" :title="l.name || l.osm_id" :meta="`${String(l.network).toUpperCase()} line classified with ${l.gauge} gauge`" />
        </div>
        <EmptyState v-else :loading="qualityLoading" message="No network/gauge inconsistencies detected." icon="search" compact />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useRailway } from '~/composables/api'
import { useApi } from '~/composables/api/_client'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useServerCount } from '~/composables/useServerCount'
import { useCountyScope } from '~/composables/useCountyScope'
import { useTimeRange } from '~/composables/useTimeRange'
import type { TableColumn } from '~/types/dataTable'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

// Registries (lines, stations, rolling stock) are shown in full for the county in force; the comparison panel's activity figures
// (operations, bookings, freight, incidents) follow the page's period. Every number is a server count / sum / group, and each
// data-quality check is its own query - nothing is derived from a first page (see docs/data-tables.md).
const RAIL = '/api/v1/railway'
const api = useApi()
const timeRange = useTimeRange('railway', { default: '30d', years: true, custom: true })
const county = useCountyScope('railway')
const rangeTag = computed(() => timeRange.period.value)
const regScope = () => county.query.value
const scope = () => ({ ...timeRange.query.value, ...county.query.value })

const opt = (values: string[]) => values.map(value => ({ value, label: value.replace(/_/g, ' ') }))
const NETWORKS = opt(['sgr', 'mgr', 'uganda'])
const NET_BADGE: Record<string, string> = { sgr: 'info', mgr: 'success', uganda: 'neutral', other: 'neutral' }
const LINE_STATUS_BADGE: Record<string, string> = { operational: 'success', under_construction: 'warning', planned: 'neutral', suspended: 'danger', abandoned: 'danger', decommissioned: 'neutral' }
const TRAIN_BADGE: Record<string, string> = { in_service: 'success', standby: 'fair', maintenance: 'warning', retired: 'neutral', inspection: 'info' }

// ── Tables ───────────────────────────────────────────────────────────────
const lineTable = useEndpointTable({
  key: 'rail-lines', path: `${RAIL}/lines/`, countyKey: 'railway', pageSize: 15, defaultSort: [{ key: 'name', dir: 'asc' }],
  columns: [
    { key: 'name', label: 'Line', priority: 1, pin: 'left', minWidth: 160 },
    { key: 'network', label: 'Network', type: 'badge', badge: NET_BADGE, options: NETWORKS, priority: 1 },
    { key: 'gauge', label: 'Gauge', priority: 3 },
    { key: 'admin1_name', label: 'Region', priority: 2 },
    { key: 'length_km', label: 'Length (km)', type: 'num', digits: 1, priority: 2 },
    { key: 'stations_count', label: 'Stations', type: 'num', priority: 2 },
    { key: 'status', label: 'Status', type: 'badge', badge: LINE_STATUS_BADGE, options: opt(Object.keys(LINE_STATUS_BADGE)), priority: 1 },
    { key: 'operator', label: 'Operator', priority: 3 },
    { key: 'electrification', label: 'Electrification', type: 'bool', priority: 3 },
    { key: 'updated_at', label: 'Source Updated', type: 'date', priority: 3 },
  ] as TableColumn[],
})

const stationTable = useEndpointTable({
  key: 'rail-stations', path: `${RAIL}/stations/`, countyKey: 'railway', pageSize: 15, defaultSort: [{ key: 'code', dir: 'asc' }],
  columns: [
    { key: 'code', label: 'Code', priority: 1, pin: 'left' },
    { key: 'name', label: 'Name', priority: 1, minWidth: 150 },
    { key: 'station_type', label: 'Type', options: opt(['terminal', 'interchange', 'intermediate', 'halt', 'freight', 'depot']), priority: 2 },
    { key: 'network', label: 'Network', type: 'badge', badge: NET_BADGE, options: NETWORKS, priority: 2 },
    { key: 'latitude', label: 'Coordinates', sortable: false, filter: false, exportAs: r => `${r.latitude}, ${r.longitude}`, priority: 3 },
    { key: 'admin1_name', label: 'County', priority: 2 },
    { key: 'passenger_capacity_daily', label: 'Capacity/day', type: 'num', priority: 3 },
    { key: 'has_freight_terminal', label: 'Freight Terminal', type: 'bool', priority: 3 },
    { key: 'platforms', label: 'Platforms', type: 'num', priority: 3 },
  ] as TableColumn[],
})

const trainTable = useEndpointTable({
  key: 'rail-rolling-stock', path: `${RAIL}/trains/`, countyKey: 'railway', pageSize: 15, defaultSort: [{ key: 'unit_id', dir: 'asc' }],
  columns: [
    { key: 'unit_id', label: 'Unit ID', priority: 1, pin: 'left' },
    { key: 'train_type', label: 'Type', priority: 2 },
    { key: 'status', label: 'Status', type: 'badge', badge: TRAIN_BADGE, options: opt(Object.keys(TRAIN_BADGE)), priority: 1 },
    { key: 'capacity_passengers', label: 'Capacity', type: 'num', priority: 2 },
    { key: 'current_location_code', label: 'Current Assignment', priority: 2 },
    { key: 'next_maintenance', label: 'Maintenance', type: 'date', priority: 1 },
    { key: 'year_built', label: 'Age (yrs)', sortable: 'year_built', filter: false, exportAs: r => (r.year_built ? String(new Date().getFullYear() - r.year_built) : ''), priority: 3 },
    { key: 'home_depot', label: 'Depot', priority: 3 },
  ] as TableColumn[],
})

// ── SGR / MGR comparison: a handful of grouped server queries ────────────
const lineStats = useServerCount(`${RAIL}/lines/`, regScope, { groupBy: ['network'], groupAggregate: ['sum:length_km'] })
const stationStats = useServerCount(`${RAIL}/stations/`, () => ({ ...regScope(), 'f.has_passenger_service__exact': 'true' }), { groupBy: ['network'] })
const stationTotal = useServerCount(`${RAIL}/stations/`, regScope)
const trainStats = useServerCount(`${RAIL}/trains/`, () => ({ ...regScope(), 'f.status__exact': 'in_service' }), { groupBy: ['train_type'] })
const scheduleStats = useServerCount(`${RAIL}/schedules/`, () => ({ ...regScope(), 'f.is_active__exact': 'true' }), { groupBy: ['network'] })
const doneOps = useServerCount(`${RAIL}/operations/`, () => ({ ...scope(), 'f.status__in': 'arrived,departed' }), { groupBy: ['network'] })
const punctualOps = useServerCount(`${RAIL}/operations/`, () => ({ ...scope(), 'f.status__in': 'arrived,departed', 'f.delay_arrival_min__lte': 0 }), { groupBy: ['network'] })
const ticketStats = useServerCount(`${RAIL}/tickets/`, scope, { groupBy: ['network'], groupAggregate: ['sum:fare_kes'] })
const freightStats = useServerCount(`${RAIL}/freight/`, scope, { groupBy: ['network'], groupAggregate: ['sum:tonnage'] })
const incidentStats = useServerCount(`${RAIL}/incidents/`, () => ({ ...county.query.value, 'f.status__in': 'open,investigating' }), { groupBy: ['network'] })
const allStats = [lineStats, stationStats, stationTotal, trainStats, scheduleStats, doneOps, punctualOps, ticketStats, freightStats, incidentStats]

const error = computed(() => lineStats.failed.value && !lineStats.loading.value ? 'Unable to reach the UAPTS Railway API.' : null)
const comparison = computed(() => (['sgr', 'mgr'] as const).map((network) => {
  const done = doneOps.groupCount('network', network), ok = punctualOps.groupCount('network', network)
  const activeTrains = (trainStats.groups.value.train_type ?? []).filter(g => String(g.value).startsWith(network)).reduce((s, g) => s + g.count, 0)
  return {
    network,
    lineCount: lineStats.groupCount('network', network),
    trackKm: lineStats.groupValue('network', network, 'sum:length_km'),
    activeStations: stationStats.groupCount('network', network),
    activeTrains: trainStats.count.value === null ? null : activeTrains,
    scheduleCount: scheduleStats.groupCount('network', network),
    onTimePct: done && ok !== null ? (ok / done) * 100 : null,
    bookings: ticketStats.groupCount('network', network),
    revenueKes: ticketStats.groupValue('network', network, 'sum:fare_kes') ?? 0,
    freightTons: freightStats.groupValue('network', network, 'sum:tonnage') ?? 0,
    activeIncidents: incidentStats.groupCount('network', network),
  }
}))

// ── Map: the station pins and line geometry the OSM layer provides ───────
const railLines = ref<any[]>([])
const stationMarkers = ref<MarkerSpec[]>([])
async function loadMap() {
  try {
    const m: any = await useRailway().mapData()
    railLines.value = m.lines ?? []
    stationMarkers.value = (m.markers ?? []).map((mk: any) => ({ ...mk, color: String(mk.color ?? '') || (String(mk.subtitle ?? '').startsWith('SGR') ? 'blue' : 'green') }))
    mapStations.value = (m.markers ?? []).length
  } catch { /* the map keeps its previous pins */ }
}
const mapStations = ref<number | null>(null)

// ── Data quality: one query per check ────────────────────────────────────
interface Quality { missingLines: any[]; missingTotal: number; stale: any[]; staleTotal: number; unknown: any[]; unknownTotal: number; gauge: any[]; gaugeTotal: number }
const quality = ref<Quality>({ missingLines: [], missingTotal: 0, stale: [], staleTotal: 0, unknown: [], unknownTotal: 0, gauge: [], gaugeTotal: 0 })
const qualityLoading = ref(true)
const yearAgo = () => new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
async function loadQuality() {
  const ask = (path: string, query: Record<string, unknown>) => api<any>(`${RAIL}/${path}/`, { query: { page_size: 10, ...regScope(), ...query } }).catch(() => ({ results: [], count: 0 }))
  const [lines, stale, unknown, sgrBad, mgrBad] = await Promise.all([
    ask('lines', { 'f.length_km__isnull': 'true' }),
    ask('stations', { 'f.updated_at__lt': yearAgo(), ordering: 'updated_at' }),
    ask('trains', { 'f.status__isnull': 'true' }),
    ask('lines', { 'f.network__exact': 'sgr', 'f.gauge__in': 'metre,narrow,unknown' }),
    ask('lines', { 'f.network__exact': 'mgr', 'f.gauge__in': 'standard,narrow,unknown' }),
  ])
  quality.value = {
    missingLines: lines.results ?? [], missingTotal: lines.count ?? 0,
    stale: stale.results ?? [], staleTotal: stale.count ?? 0,
    unknown: unknown.results ?? [], unknownTotal: unknown.count ?? 0,
    gauge: [...(sgrBad.results ?? []), ...(mgrBad.results ?? [])].slice(0, 10), gaugeTotal: (sgrBad.count ?? 0) + (mgrBad.count ?? 0),
  }
  qualityLoading.value = false
}
// Stations the OSM layer has no pin for (the registry total minus the pins on the map).
const missingStations = computed(() => (stationTotal.count.value !== null && mapStations.value !== null ? Math.max(0, stationTotal.count.value - mapStations.value) : 0))
const missingGeometryTotal = computed(() => quality.value.missingTotal + missingStations.value)

watch(() => JSON.stringify(scope()), () => { void loadQuality(); void loadMap() })
onMounted(() => { void loadQuality(); void loadMap() })
function refreshAll() { void Promise.all([lineTable, stationTable, trainTable].map(t => t.refresh()).concat(allStats.map(s => s.refresh()), [loadQuality(), loadMap()])) }
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
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function isDue(s: string | null | undefined) { return !!s && new Date(s).getTime() <= Date.now() }
</script>

<style scoped>
.map-card { overflow:hidden; margin-bottom:16px; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid var(--border-subtle); color:var(--fg-2); }
.mk { display:flex; align-items:center; gap:5px; }
.line-seg { width:20px; height:4px; border-radius:2px; display:inline-block; flex-shrink:0; }
.compare-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:16px; margin-bottom:16px; }
.compare-card { background:var(--surface-2); border:1px solid var(--border-subtle); border-radius:10px; padding:16px 18px; }
.cc-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
.cc-lines { font-size:12px; color:var(--fg-3); }
.cc-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.cc-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--fg-3); display:block; margin-bottom:2px; }
.cc-val { font-size:15px; font-weight:700; color:var(--fg-1); }
.val-danger { color:var(--danger-fg); }
.source-note { margin-top:10px; font-size:11px; color:var(--fg-3); border-top:1px solid var(--border-subtle); padding-top:10px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.scroll-body { max-height:280px; overflow-y:auto; }
</style>
