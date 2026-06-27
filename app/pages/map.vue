<script setup lang="ts">
// app/pages/map.vue - Kenya Live Map
// ─────────────────────────────────────────────────────────────────────
// Dedicated page that combines:
//   * Kenya country outline + 8 regions + 12 landmarks (boundary)
//   * OSM road network as coloured polylines (roads)
//   * Public transport routes as polylines (routes)
//   * Counting stations + active congestion events (markers)
//   * OD matrix top-pairs (arrows)
//
// All GeoJSON layers come from /api/v1/gis/*. The page is the
// frontend mirror of the "include the Kenyan map to visualize
// routes/traffic etc." request - the map shows the entire country
// with traffic + transit overlays, just like a GIS dashboard.

import { ref, computed, onMounted } from 'vue'
import { useGis, useTraffic } from '~/composables/api'
import type { CongestionEvent, ODMatrix, CountingStation } from '~/composables/api'

definePageMeta({ title: 'Map' })

const gis = useGis()
const traffic = useTraffic()

const boundary = ref<any>(null)
const roads = ref<any>(null)
const routes = ref<any>(null)
const mapMarkers = ref<any[]>([])
const mapArrows = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// Map UI state - layer toggles + map extent.
const showBoundary = ref(true)
const showRoads = ref(true)
const showRoutes = ref(true)
const showStations = ref(true)
const showEvents = ref(true)
const showOd = ref(true)

// Map extent presets.
type ExtentKey = 'kenya' | 'nairobi' | 'mombasa' | 'kisumu'
const extent = ref<ExtentKey>('kenya')
const initialBbox = computed<[number, number, number, number]>(() => {
  switch (extent.value) {
    case 'kenya':   return [-4.677, 33.913, 4.677, 41.859]
    case 'nairobi': return [-1.45, 36.65, -1.10, 37.05]
    case 'mombasa': return [-4.20, 39.40, -3.85, 39.85]
    case 'kisumu':  return [-0.30, 34.55,  0.05, 34.95]
  }
})

// Layer counts (for status badge).
const layerCounts = computed(() => ({
  boundary: boundary.value?.features?.length ?? 0,
  roads: roads.value?.features?.length ?? 0,
  routes: routes.value?.features?.length ?? 0,
  markers: mapMarkers.value.length,
  arrows: mapArrows.value.length,
}))

// Stats for the KPI strip.
const kpiStats = ref<{
  stations: number
  activeCongestion: number
  totalRoutes: number
  totalRoads: number
} | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    // 1. Boundary is small, always fetched.
    boundary.value = await gis.kenyaBoundary()
    // 2. Decide roads limit based on extent.
    const ext = initialBbox.value
    const isNarrow = extent.value !== 'kenya'
    const limitRoads = isNarrow ? 2500 : 800
    const limitRoutes = isNarrow ? 200 : 100

    const [roadData, routeData, stationRes, evRes, odRes] = await Promise.all([
      gis.roads({
        bbox: ext, limit: limitRoads, simplify: isNarrow ? 0.3 : 0.5,
      }),
      gis.routes({
        bbox: ext, limit: limitRoutes, simplify: 0.5,
      }),
      traffic.countingStations({ page_size: 200 }),
      traffic.activeCongestion(),
      traffic.topOdPairs(8),
    ])
    roads.value = roadData
    routes.value = routeData

    // Build markers: counting stations + congestion events.
    const stations = (stationRes as any).results ?? []
    const events = ((evRes as any).results ?? []) as CongestionEvent[]
    const markers: any[] = []
    for (const s of stations) {
      if (s.latitude == null || s.longitude == null) continue
      const color =
        s.equipment_status === 'operational' ? 'green' :
        s.equipment_status === 'degraded' ? 'yellow' :
        s.equipment_status === 'offline' ? 'red' : 'gray'
      markers.push({
        id: `station-${s.id}`,
        lat: s.latitude,
        lon: s.longitude,
        title: `${s.station_code} - ${s.station_name}`,
        subtitle: `${s.agency_code ?? ''} · ${s.station_type?.toUpperCase?.() ?? ''} · ${s.equipment_status}`,
        color,
        size: 'sm',
      })
    }
    // Resolve congestion events → station lat/lon via traffic_counts.
    for (const e of events) {
      try {
        const tc = await traffic.counts({ segment: e.segment_id, page_size: 1 })
        const tcRow = (tc as any).results?.[0]
        if (!tcRow?.station?.latitude) continue
        const color =
          e.severity === 'critical' ? 'red' :
          e.severity === 'high' ? 'orange' :
          e.severity === 'medium' ? 'yellow' : 'blue'
        markers.push({
          id: `event-${e.id}`,
          lat: tcRow.station.latitude,
          lon: tcRow.station.longitude,
          title: `[${e.severity.toUpperCase()}] Congestion`,
          subtitle: `Delay ${e.delay_minutes} min · Impact radius ${e.impact_radius_km?.toFixed?.(1)} km`,
          color,
          size: 'lg',
        })
      } catch { /* ignore */ }
    }
    mapMarkers.value = markers

    // OD arrows - same deterministic zone-coordinate scatter as traffic.vue.
    const odPairs = ((odRes as any).results ?? []).slice(0, 8)
    mapArrows.value = odPairs.map((p: any) => ({
      id: `${p.origin_zone}-${p.destination_zone}`,
      from: zoneCoord(p.origin_zone),
      to: zoneCoord(p.destination_zone),
      label: `${p.origin_zone} → ${p.destination_zone}: ${p.trips?.toLocaleString?.() ?? p.trips} trips`,
      weight: Math.min(6, 1 + Math.log10(Math.max(1, p.trips ?? 1))),
      color: 'purple',
    }))

    kpiStats.value = {
      stations: stations.length,
      activeCongestion: events.length,
      totalRoutes: routeData?.features?.length ?? 0,
      totalRoads: roadData?.features?.length ?? 0,
    }
  } catch (err: any) {
    error.value = err?.status === 401
      ? 'Sign in to view the Kenya map.'
      : err?.message ?? 'Failed to load Kenya map data.'
  } finally {
    loading.value = false
  }
}

// Stable hash-based scatter - matches the convention used elsewhere.
function zoneCoord(zone: string): [number, number] {
  let hash = 0
  for (let i = 0; i < zone.length; i++) {
    hash = (hash * 31 + zone.charCodeAt(i)) | 0
  }
  const fx = ((hash & 0xffff) / 0xffff) * 2 - 1
  const fy = (((hash >> 16) & 0xffff) / 0xffff) * 2 - 1
  return [-1.275 + fy * 0.18, 36.85 + fx * 0.20]
}

function setExtent(key: ExtentKey) {
  extent.value = key
  load()
}

onMounted(load)

// ── Layer visibility filtering ──────────────────────────────────────
// We re-build the GeoJSON FeatureCollections when toggles change so
// that L.geoJSON picks up the new feature set immediately.
const visibleBoundary = computed(() => showBoundary.value ? boundary.value : null)
const visibleRoads = computed(() => showRoads.value ? roads.value : null)
const visibleRoutes = computed(() => showRoutes.value ? routes.value : null)
const visibleMarkers = computed(() => {
  return mapMarkers.value.filter(m => {
    if (m.id.startsWith('station-')) return showStations.value
    if (m.id.startsWith('event-'))    return showEvents.value
    return true
  })
})
const visibleArrows = computed(() => showOd.value ? mapArrows.value : [])

function onFeatureClick(layer: string, feature: any) {
  console.log(`[map] clicked ${layer}:`, feature.properties)
}
</script>

<template>
  <div class="map-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M02 · M04 · GIS</div>
        <h1 class="text-display">🇰🇪 Kenya Live Map</h1>
        <p class="text-sm text-fg-muted mt-1">
          Country outline · OSM road network · Public transport routes ·
          Traffic counting stations · Active congestion events · OD pairs
        </p>
      </div>
      <button class="btn btn-secondary" @click="load" :disabled="loading">
        <span v-if="loading">Refreshing…</span><span v-else>Refresh</span>
      </button>
    </div>

    <!-- Extent selector + layer toggles -->
    <div class="card toolbar">
      <div class="toolbar-row">
        <div class="ext-group">
          <span class="ext-label">View</span>
          <button
            v-for="opt in (['kenya','nairobi','mombasa','kisumu'] as ExtentKey[])"
            :key="opt"
            class="chip"
            :class="{ active: extent === opt }"
            @click="setExtent(opt)"
          >{{ opt[0].toUpperCase() + opt.slice(1) }}</button>
        </div>
        <div class="ext-group">
          <span class="ext-label">Layers</span>
          <label class="chip-toggle">
            <input type="checkbox" v-model="showBoundary" /> Kenya outline
          </label>
          <label class="chip-toggle">
            <input type="checkbox" v-model="showRoads" /> Roads
          </label>
          <label class="chip-toggle">
            <input type="checkbox" v-model="showRoutes" /> Routes
          </label>
          <label class="chip-toggle">
            <input type="checkbox" v-model="showStations" /> Stations
          </label>
          <label class="chip-toggle">
            <input type="checkbox" v-model="showEvents" /> Congestion
          </label>
          <label class="chip-toggle">
            <input type="checkbox" v-model="showOd" /> OD pairs
          </label>
        </div>
      </div>
    </div>

    <!-- Loading / error -->
    <div v-if="loading && !boundary" class="card">
      <div class="card-body text-fg-muted">Loading Kenya boundary + roads + routes…</div>
    </div>
    <div v-else-if="error" class="card">
      <div class="card-body text-fg-muted">{{ error }}</div>
    </div>

    <!-- The map -->
    <div class="card map-card">
      <div class="card-header">
        <div>
          <div class="text-subhead">UAPTS Kenya Operations Map</div>
          <div class="text-xs text-fg-muted">
            Boundary {{ layerCounts.boundary }} features ·
            Roads {{ layerCounts.roads }} ·
            Routes {{ layerCounts.routes }} ·
            Stations {{ layerCounts.markers }} markers
            <span v-if="layerCounts.arrows"> · {{ layerCounts.arrows }} OD arrows</span>
          </div>
        </div>
      </div>
      <ClientOnly>
        <UaptsMap
          :boundary="visibleBoundary"
          :roads="visibleRoads"
          :routes="visibleRoutes"
          :markers="visibleMarkers"
          :arrows="visibleArrows"
          :initial-bbox="initialBbox"
          height="640px"
          show-legend
          @feature-click="onFeatureClick"
        />
        <template #fallback>
          <div class="card-body text-fg-muted">Loading map…</div>
        </template>
      </ClientOnly>
    </div>

    <!-- KPI strip -->
    <div v-if="kpiStats" class="kpi-grid">
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Boundary</div>
        <div class="kpi-value">{{ kpiStats.totalRoads }}</div>
        <div class="text-xs text-fg-muted mt-1">OSM road segments rendered</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Routes</div>
        <div class="kpi-value">{{ kpiStats.totalRoutes }}</div>
        <div class="text-xs text-fg-muted mt-1">Public transport routes</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Stations</div>
        <div class="kpi-value">{{ kpiStats.stations }}</div>
        <div class="text-xs text-fg-muted mt-1">KeNHA · KURA · NTSA counters</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Live Congestion</div>
        <div class="kpi-value">{{ kpiStats.activeCongestion }}</div>
        <div class="text-xs text-fg-muted mt-1">FR-M02-005 events</div>
      </div>
    </div>

    <!-- Layer legend table -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Layers</div>
        <span class="text-xs text-fg-muted">Source: UAPTS GIS endpoints</span>
      </div>
      <div class="card-body">
        <table class="data-table">
          <thead>
            <tr><th>Layer</th><th>Endpoint</th><th>Features</th><th>Notes</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Kenya outline + landmarks</td>
              <td><code>GET /api/v1/gis/kenya/boundary/</code></td>
              <td>{{ layerCounts.boundary }}</td>
              <td>Country polygon + 8 regions + 12 landmarks (Nairobi, Mombasa, Mt Kenya, lakes, parks)</td>
            </tr>
            <tr>
              <td>Road network (OSM)</td>
              <td><code>GET /api/v1/gis/roads/</code></td>
              <td>{{ layerCounts.roads }}</td>
              <td>Filtered by bbox + highway class. Colour-coded by class.</td>
            </tr>
            <tr>
              <td>Public transport routes</td>
              <td><code>GET /api/v1/gis/routes/</code></td>
              <td>{{ layerCounts.routes }}</td>
              <td>Live polylines from tbl_pt_routes.path_geometry</td>
            </tr>
            <tr>
              <td>Counting stations + events</td>
              <td><code>/api/v1/traffic/*</code></td>
              <td>{{ layerCounts.markers }}</td>
              <td>Markers coloured by status / severity</td>
            </tr>
            <tr>
              <td>OD pairs</td>
              <td><code>/api/v1/traffic/od-matrices/top/</code></td>
              <td>{{ layerCounts.arrows }}</td>
              <td>Curved dashed arrows between origin/destination zones</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-page { display: flex; flex-direction: column; gap: 16px; }
.map-card { padding: 0; overflow: hidden; }
.toolbar { padding: 12px 16px; }
.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}
.ext-group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ext-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-fg-dim, #64748b);
  margin-right: 6px;
}
.chip {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.08);
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}
.chip:hover { background: rgba(255,255,255,0.04); }
.chip.active {
  background: #1e293b;
  border-color: #22d3ee;
  color: #22d3ee;
}
.chip-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.08);
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}
.chip-toggle input { accent-color: #22d3ee; }
</style>