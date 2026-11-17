<template>
  <PageHeader
    eyebrow="Public Transport - BRT"
    title="BRT Stops & Headway"
    subtitle="NaMATA · NTSA - BRT stop facilities, boarding counts, NTSA vehicle compliance, headway compliance, and schedule adherence"
  >
    <template #actions>
      <NuxtLink to="/public-transport/operators" class="btn">Public Operators<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/public-transport/compliance" class="btn">PSV Compliance<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="stopStats.failed.value && !stopStats.loading.value" class="error-banner banner-icon-warn" role="alert">Unable to reach the UAPTS Public Transport API.</div>

  <!-- KPIs: counted and averaged by the server over ALL stops, not over the first page of them -->
  <div class="kpi-grid">
    <KpiCard
      label="BRT Stops" :value="fmtNum(stopStats.count.value)"
      :unavailable="stopStats.count.value === null" :unavailable-note="stopStats.loading.value ? 'Loading…' : 'NaMATA GIS feed unavailable'"
      period="LIVE" description="NaMATA network stations" to="#stop-inventory"
    />
    <KpiCard
      label="Active Stops" :value="fmtNum(stopStats.groupCount('is_active', true))"
      :unavailable="stopStats.count.value === null" :unavailable-note="stopStats.loading.value ? 'Loading…' : 'NaMATA GTFS-RT feed unavailable'"
      period="LIVE" description="Currently operational" to="#stop-inventory"
    />
    <KpiCard
      label="Avg Dwell Time" :value="stopStats.avg('avg_dwell_seconds') ? `${stopStats.avg('avg_dwell_seconds')!.toFixed(0)}s` : '-'"
      :unavailable="stopStats.count.value === null" :unavailable-note="stopStats.loading.value ? 'Loading…' : 'NaMATA feed unavailable'"
      period="LIVE" description="Average boarding dwell"
    />
    <KpiCard
      label="Avg Boardings/Stop" :value="stopStats.avg('avg_boarding_count') ? fmtNum(stopStats.avg('avg_boarding_count'), 0) : '-'"
      :unavailable="stopStats.count.value === null" :unavailable-note="stopStats.loading.value ? 'Loading…' : 'NaMATA GTFS-RT feed unavailable'"
      period="LIVE" description="Daily average per stop"
    />
    <KpiCard
      label="BRT Routes (Headway)" :value="fmtNum(headwayData.length)"
      :unavailable="loadingHeadway || headwayError" :unavailable-note="loadingHeadway ? 'Loading…' : 'NaMATA feed unavailable'"
      period="LIVE" description="Routes with headway data" to="#headway-compliance"
    />
    <KpiCard
      label="Shelter Coverage" :value="stopStats.groupPct('has_shelter', true) !== null ? `${stopStats.groupPct('has_shelter', true)!.toFixed(0)}%` : '-'"
      :unavailable="stopStats.count.value === null" :unavailable-note="stopStats.loading.value ? 'Loading…' : 'NaMATA GIS feed unavailable'"
      period="LIVE" description="Stops with passenger shelter"
    />
  </div>

  <!-- Map + headway side by side -->
  <div class="two-col-map">
    <CollapsibleSection class="card map-card" title="BRT Stop Network" storage-key="map:public-transport/brt">
      <ClientOnly>
        <UaptsMap
          :markers="stopMarkers"
          :roads="roadsGeo"
          :center="[-1.286, 36.817]"
          :zoom="11"
          height="460px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#22c55e" /> Accessibility ≥ 80%</span>
        <span class="mk"><span class="dot" style="background:#f59e0b" /> Accessibility 50–79%</span>
        <span class="mk"><span class="dot" style="background:#ef4444" /> Accessibility &lt; 50%</span>
        <span class="mk"><span class="dot" style="background:#94a3b8" /> Inactive</span>
      </div>
    </CollapsibleSection>

    <div id="headway-compliance" class="card drill-target">
      <div class="card-header">Headway Compliance by Route</div>
      <div class="card-body">
        <div v-if="headwayData.length" class="hw-list hw-scroll">
          <div v-for="h in headwayData" :key="h.route_id ?? h.route__route_name" class="hw-row">
            <div class="hw-name">{{ h.route__route_name ?? h.route_id }}</div>
            <div class="hw-meta">
              <span>{{ h.buses_per_day }} buses/day</span>
              <span>{{ h.avg_frequency }} min avg freq</span>
            </div>
            <div class="hw-bar-wrap">
              <!-- Bar length = compliance toward the 10-min target (same threshold the
                   color uses) so a longer/fuller green bar always reads as "better",
                   matching the fuller-is-better convention used elsewhere in the app -
                   previously the bar grew LONGER for worse (higher-minute) headways
                   while still being colored red, which read backwards. -->
              <div
                class="hw-bar"
                :style="{
                  transform: `scaleX(${Math.max(4, Math.min(100, (10 / Math.max(h.avg_frequency, 0.1)) * 100)) / 100})`,
                  background: h.avg_frequency <= 10 ? 'var(--success)' : h.avg_frequency <= 20 ? 'var(--warning)' : 'var(--destructive)',
                }"
              />
            </div>
          </div>
        </div>
        <EmptyState v-else :loading="loadingHeadway" message="No headway data" compact />
      </div>
    </div>
  </div>

  <!-- BRT stops: the whole inventory, searched / filtered / sorted / paged on the server -->
  <SectionTitle>Stop Inventory</SectionTitle>

  <div id="stop-inventory" class="card drill-target">
    <div class="card-body">
      <DataTable :table="stopTable" row-key="id" title="BRT stop inventory" export-name="uapts-brt-stops" filters-open
                 placeholder="Search stop ID, name, route…" empty="No BRT stops have been registered.">
        <template #cell-stop_name="{ row }"><span class="strong">{{ row.stop_name }}</span></template>
        <template #cell-has_shelter="{ row }"><span class="tick">{{ row.has_shelter ? 'Yes' : '-' }}</span></template>
        <template #cell-has_ticket_machine="{ row }"><span class="tick">{{ row.has_ticket_machine ? 'Yes' : '-' }}</span></template>
        <template #cell-accessibility_score="{ row }">
          <div class="acc-bar-wrap">
            <div class="acc-bar" :style="{ transform: `scaleX(${row.accessibility_score})`, background: row.accessibility_score >= 0.8 ? 'var(--success)' : row.accessibility_score >= 0.5 ? 'var(--warning)' : 'var(--destructive)' }" />
          </div>
          <span class="acc-pct">{{ (row.accessibility_score * 100).toFixed(0) }}%</span>
        </template>
        <template #cell-is_active="{ row }">
          <span :style="{ color: row.is_active ? 'var(--success-fg)' : 'var(--fg-3)' }">{{ row.is_active ? '● Active' : '○ Inactive' }}</span>
        </template>
      </DataTable>
    </div>
  </div>

  <!-- Schedule adherence -->
  <SectionTitle pill="NaMATA GTFS-RT · Live">Recent Schedule Adherence</SectionTitle>

  <div class="card">
    <div class="card-body">
      <DataTable :table="adherenceTable" row-key="id" title="Schedule adherence" export-name="uapts-schedule-adherence"
                 placeholder="Search route, stop…" empty="No adherence records available.">
        <template #cell-route_name="{ row }"><span class="strong">{{ row.route_name ?? row.route }}</span></template>
        <template #cell-stop_name="{ row }">{{ row.stop_name ?? row.stop ?? '-' }}</template>
        <template #cell-deviation_seconds="{ row }">
          <span :style="{ color: Math.abs(row.deviation_seconds) <= 180 ? 'var(--success-fg)' : 'var(--danger-fg)' }">
            {{ row.deviation_seconds > 0 ? '+' : '' }}{{ (row.deviation_seconds / 60).toFixed(1) }}min
          </span>
        </template>
        <template #cell-on_time="{ row }">
          <BadgePill :variant="row.on_time ? 'success' : 'danger'">{{ row.on_time ? 'On time' : 'Late' }}</BadgePill>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { usePublicTransport, useGis } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'
import { useApi } from '~/composables/api/_client'
import { useEndpointTable } from '~/composables/useEndpointTable'
import { useServerCount } from '~/composables/useServerCount'
import { useCountyScope } from '~/composables/useCountyScope'
import type { PagedResult, TableColumn } from '~/types/dataTable'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

// Both tables are windows onto the WHOLE dataset: search, filters, sorting and paging run on the server, and the KPIs are
// server aggregates (see docs/data-tables.md) - nothing is computed from a first page of stops.
const PT = '/api/v1/public-transport'
const api = useApi()

// County filter for this module, following the global filter in the top bar until a county is picked here.
const county = useCountyScope('public-transport')
const scope = () => county.query.value

// ── Stop inventory ───────────────────────────────────────────────────────
const PLATFORMS = ['center', 'side', 'island'].map(value => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))
const stopColumns: TableColumn[] = [
  { key: 'stop_id', label: 'Stop ID', type: 'mono', priority: 2, pin: 'left' },
  { key: 'stop_name', label: 'Stop Name', priority: 1, minWidth: 170 },
  { key: 'route_name', label: 'Route', priority: 2 },
  { key: 'platform_type', label: 'Platform', type: 'badge', badge: Object.fromEntries(PLATFORMS.map(o => [o.value, 'info'])), options: PLATFORMS, priority: 2 },
  { key: 'has_shelter', label: 'Shelter', type: 'bool', priority: 3 },
  { key: 'has_ticket_machine', label: 'Ticket Machine', type: 'bool', priority: 3 },
  { key: 'accessibility_score', label: 'Accessibility', type: 'num', digits: 2, priority: 1 },
  { key: 'avg_boarding_count', label: 'Avg Boardings', type: 'num', priority: 2 },
  { key: 'avg_dwell_seconds', label: 'Avg Dwell (s)', type: 'num', priority: 3 },
  { key: 'is_active', label: 'Active', type: 'bool', priority: 1 },
]
const stopTable = useEndpointTable({
  key: 'pt-brt-stops', path: `${PT}/brt-stops/`, columns: stopColumns, countyKey: 'public-transport', pageSize: 25,
  defaultSort: [{ key: 'stop_name', dir: 'asc' }],
})

// ── Schedule adherence ───────────────────────────────────────────────────
const adherenceColumns: TableColumn[] = [
  { key: 'route_name', label: 'Route', priority: 1, pin: 'left', minWidth: 150 },
  { key: 'stop_name', label: 'Stop', priority: 2 },
  { key: 'scheduled_at', label: 'Scheduled', type: 'datetime', priority: 2 },
  { key: 'actual_at', label: 'Actual', type: 'datetime', priority: 2 },
  { key: 'deviation_seconds', label: 'Deviation', type: 'num', priority: 1 },
  { key: 'on_time', label: 'On-Time', type: 'bool', priority: 1 },
]
const adherenceTable = useEndpointTable({
  key: 'pt-schedule-adherence', path: `${PT}/schedule-adherence/`, columns: adherenceColumns, countyKey: 'public-transport', pageSize: 25,
  defaultSort: [{ key: 'scheduled_at', dir: 'desc' }],
})

// ── KPIs: server aggregates over ALL stops ───────────────────────────────
const stopStats = useServerCount(`${PT}/brt-stops/`, scope, {
  aggregate: ['avg:avg_dwell_seconds', 'avg:avg_boarding_count'],
  groupBy: ['is_active', 'has_shelter'],
})

// ── Headway by route: an aggregated per-route summary (a handful of rows), not a dataset ──
const headwayData = ref<any[]>([])
const loadingHeadway = ref(true)
const headwayError = ref(false)
async function loadHeadway() {
  try {
    headwayData.value = (await usePublicTransport().brtHeadway()).results ?? []
    headwayError.value = false
  } catch { headwayError.value = true } finally { loadingHeadway.value = false }
}

// ── Map: every stop (not just the page the table is on) + the road network ─
const MAP_LIMIT = 500
const mapStops = ref<any[]>([])
const mapStopsTotal = ref(0)
const roadsGeo = ref<GeoJSONFeatureCollection | null>(null)
async function loadMap() {
  const [stopsRes, roadsRes] = await Promise.allSettled([
    api<PagedResult>(`${PT}/brt-stops/`, { query: { ...scope(), page_size: MAP_LIMIT } }),
    useGis().roads({ limit: 300, simplify: 0.02 }),
  ])
  if (stopsRes.status === 'fulfilled') { mapStops.value = stopsRes.value.results ?? []; mapStopsTotal.value = stopsRes.value.count ?? mapStops.value.length }
  if (roadsRes.status === 'fulfilled') roadsGeo.value = roadsRes.value
}

const stopMarkers = computed((): MarkerSpec[] =>
  mapStops.value.map(s => ({
    id: `stop-${s.id}`, lat: s.latitude, lon: s.longitude, title: s.stop_name,
    subtitle: `${s.platform_type} platform · ${s.avg_boarding_count} boardings · ${s.avg_dwell_seconds}s dwell`,
    color: !s.is_active ? 'gray' : s.accessibility_score >= 0.8 ? 'green' : s.accessibility_score >= 0.5 ? 'yellow' : 'red',
    size: 'sm',
  })),
)

// County changed - here, on another page, or from the global filter in the top bar (the tables and stats refetch
// themselves; the map and headway are loaded here).
watch(() => county.county.value, () => { void loadMap(); void loadHeadway() })
onMounted(() => { void loadMap(); void loadHeadway() })

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    void Promise.all([stopTable.refresh(), adherenceTable.refresh(), stopStats.refresh(), loadMap(), loadHeadway()])
  }, 120_000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(165px,1fr)); gap:12px; margin-bottom:16px; }
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col-map { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid var(--border-subtle); }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.hw-list { display:flex; flex-direction:column; gap:12px; }
.hw-scroll { max-height:420px; overflow-y:auto; padding-right:4px; }
.hw-row { display:flex; flex-direction:column; gap:4px; }
.hw-name { font-size:13px; font-weight:600; }
.hw-meta { display:flex; gap:12px; font-size:11px; color:var(--fg-2); }
.hw-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:8px; overflow:hidden; }
.hw-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
.strong { font-weight:600; }
.tick { text-align:center; display:inline-block; min-width:1ch; }
.acc-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; min-width:70px; }
.acc-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
.acc-pct { font-size:11px; }
</style>
