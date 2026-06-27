<script setup lang="ts">
// pages/kenya-map.vue - Full-screen interactive Kenyan transport map.
//
// Renders the full UAPTS transport network on top of an OpenStreetMap
// base layer: Kenya outline, OSM road segments, counting stations,
// BRT/matatu routes (from the Digital Matatus GTFS feed), BRT stops,
// live congestion events, weather radar cells, and OD trip-flow arcs.
//
// All data is fetched as GeoJSON from /api/v1/geojson/* + /api/v1/gis/*
// - the backend serves real PostGIS geometries wrapped in the GeoJSON
// spec, so Leaflet can render them directly with L.geoJSON().

definePageMeta({ title: 'Kenya Map' })

import { useTraffic, usePublicTransport } from '~/composables/api'

const traffic = useTraffic()
const pt = usePublicTransport()

// Side-panel data (KPI readout populated from the summary endpoints)
const trafficSummary = ref<any>(null)
const ptSummary = ref<any>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const [ts, ps] = await Promise.all([traffic.summary(), pt.summary()])
    trafficSummary.value = ts
    ptSummary.value = ps
  } catch (err) {
    console.error('Failed to load summaries', err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

// Default to all layers on for the "tour" experience.  The user can
// toggle them off via the layer control inside the map component.
const allLayers = [
  'kenya',
  'segments',
  'routes',
  'stations',
  'brt-stops',
  'congestion',
  'weather',
  'od-flow',
]

function fmtKES(n: number) {
  if (n >= 1_000_000) return 'KES ' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return 'KES ' + (n / 1_000).toFixed(1) + 'k'
  return 'KES ' + Math.round(n).toLocaleString()
}
</script>

<template>
  <div class="map-page">
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">Kenya Transport Map</div>
        <h1 class="text-display">Live Geo-Spatial View</h1>
        <p class="text-sm text-fg-muted mt-1">
          OSM road network · KeNHA / KURA / NTSA counting stations · Digital Matatus
          GTFS routes · BRT stops · live congestion · KMD weather · OD trip flows.
          All data served as GeoJSON from the UAPTS PostGIS backend.
        </p>
      </div>
      <button class="btn btn-secondary" @click="load" :disabled="loading">
        <span v-if="loading">Refreshing…</span><span v-else>Refresh</span>
      </button>
    </div>

    <!-- Map -->
    <ClientOnly>
      <div class="map-card">
        <UaptsMap
          :layers="allLayers"
          :center="[-1.286, 36.817]"
          :zoom="11"
          height="640px"
        />
      </div>
      <template #fallback>
        <div class="map-card" style="height: 660px; display: flex; align-items: center; justify-content: center;">
          <div class="text-fg-muted">Loading map…</div>
        </div>
      </template>
    </ClientOnly>

    <!-- KPI strip -->
    <div v-if="trafficSummary || ptSummary" class="kpi-grid">
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Road Segments</div>
        <div class="kpi-value">{{ trafficSummary?.kpis.total_segments_observed ?? 0 }}</div>
        <div class="text-xs text-fg-muted mt-1">OSM network · PostGIS LineString</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Counting Stations</div>
        <div class="kpi-value">{{ trafficSummary?.kpis.active_stations ?? 0 }}</div>
        <div class="text-xs text-fg-muted mt-1">{{ trafficSummary?.kpis.total_stations ?? 0 }} total · GeoJSON points</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Active Congestion</div>
        <div class="kpi-value">{{ trafficSummary?.kpis.active_congestion_events ?? 0 }}</div>
        <div class="text-xs text-fg-muted mt-1">FR-M02-005 · M02</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">PT Routes</div>
        <div class="kpi-value">{{ ptSummary?.kpis.active_routes ?? 0 }}</div>
        <div class="text-xs text-fg-muted mt-1">
          {{ ptSummary?.kpis.brt_routes ?? 0 }} BRT · {{ ptSummary?.kpis.matatu_routes ?? 0 }} matatu
        </div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">24h Revenue</div>
        <div class="kpi-value">{{ ptSummary ? fmtKES(ptSummary.kpis.revenue_24h_kes) : '-' }}</div>
        <div class="text-xs text-fg-muted mt-1">All payment channels</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">On-Time</div>
        <div class="kpi-value">{{ ptSummary ? ptSummary.on_time_pct.toFixed(1) + '%' : '-' }}</div>
        <div class="text-xs text-fg-muted mt-1">FR-M04-004 · 7d window</div>
      </div>
    </div>

    <!-- Layer legend -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Map Layer Legend</div>
        <span class="text-xs text-fg-muted">Click any layer name in the map's top-right panel to toggle visibility</span>
      </div>
      <div class="card-body">
        <div class="legend-grid">
          <div class="legend-item">
            <span class="legend-swatch" style="background: #3b82f6"></span>
            <div>
              <div class="legend-label">Kenya Outline</div>
              <div class="legend-desc">Country border + 8 regions + 10 landmarks</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: #ef4444"></span>
            <div>
              <div class="legend-label">Road Segments (Class A)</div>
              <div class="legend-desc">Trunk + motorway (KeNHA) · OSM Nairobi bbox</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: #f97316"></span>
            <div>
              <div class="legend-label">Road Segments (Class B)</div>
              <div class="legend-desc">Secondary highways · KURA</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: #eab308"></span>
            <div>
              <div class="legend-label">Urban Roads</div>
              <div class="legend-desc">Residential + service · KeRRA rural</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: #10b981"></span>
            <div>
              <div class="legend-label">Counting Stations</div>
              <div class="legend-desc">ATC + WIM + IVMS · 7,000+ real stations from shapefiles</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: #a855f7"></span>
            <div>
              <div class="legend-label">Matatu Routes</div>
              <div class="legend-desc">Digital Matatus GTFS · path_geometry + PostGIS LineString</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: #ef4444"></span>
            <div>
              <div class="legend-label">BRT Routes</div>
              <div class="legend-desc">High-frequency BRT corridors</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: #3b82f6"></span>
            <div>
              <div class="legend-label">BRT / PSV Stops</div>
              <div class="legend-desc">Stops from GIS_DATA_2019/stops.shp · PostGIS Point</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: #dc2626"></span>
            <div>
              <div class="legend-label">Active Congestion</div>
              <div class="legend-desc">FR-M02-005/006 · Color-coded by severity</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: #06b6d4"></span>
            <div>
              <div class="legend-label">Weather Radar</div>
              <div class="legend-desc">KMD observations · FR-M02-010 · size = impact score</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: #f59e0b"></span>
            <div>
              <div class="legend-label">OD Trip Flows</div>
              <div class="legend-desc">FR-M02-014 · Aggregated GPS · width = volume</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- API endpoints -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">GeoJSON API · Backend Sources</div>
        <span class="text-xs text-fg-muted">All endpoints return real PostGIS geometries as GeoJSON FeatureCollection</span>
      </div>
      <div class="card-body">
        <table class="data-table">
          <thead>
            <tr><th>Layer</th><th>Endpoint</th><th>Geometry</th><th>Source</th></tr>
          </thead>
          <tbody>
            <tr><td>Kenya outline</td><td class="font-mono text-xs">/api/v1/gis/kenya/boundary/</td><td>Polygon + Point</td><td>apps.gis.views</td></tr>
            <tr><td>Road segments</td><td class="font-mono text-xs">/api/v1/geojson/segments/</td><td>LineString</td><td>tbl_road_segments.geometry</td></tr>
            <tr><td>Counting stations</td><td class="font-mono text-xs">/api/v1/geojson/stations/</td><td>Point</td><td>tbl_counting_stations.location</td></tr>
            <tr><td>PT routes</td><td class="font-mono text-xs">/api/v1/geojson/routes/</td><td>LineString</td><td>tbl_pt_routes.geometry</td></tr>
            <tr><td>BRT stops</td><td class="font-mono text-xs">/api/v1/geojson/brt-stops/</td><td>Point</td><td>tbl_brt_stops.location</td></tr>
            <tr><td>Congestion</td><td class="font-mono text-xs">/api/v1/geojson/congestion/</td><td>LineString</td><td>tbl_congestion_events + segment geom</td></tr>
            <tr><td>Weather</td><td class="font-mono text-xs">/api/v1/geojson/weather/</td><td>Point</td><td>tbl_weather_observations.location</td></tr>
            <tr><td>OD flows</td><td class="font-mono text-xs">/api/v1/geojson/od-flow/</td><td>LineString</td><td>tbl_od_matrices (aggregated)</td></tr>
            <tr><td>All layers</td><td class="font-mono text-xs">/api/v1/geojson/all/</td><td>FeatureCollection</td><td>Combined bundle</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-page { display: flex; flex-direction: column; gap: 18px; }
.map-card { padding: 0; overflow: hidden; }
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.kpi-card { padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.kpi-value { font-size: 24px; font-weight: 600; line-height: 1.1; }
.legend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}
.legend-swatch {
  width: 20px; height: 20px;
  border-radius: 4px;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
}
.legend-label { font-size: 13px; font-weight: 500; }
.legend-desc { font-size: 11px; color: var(--fg-muted); }
.data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.data-table th {
  text-align: left; padding: 8px 6px;
  color: var(--fg-muted);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-weight: 500; font-size: 11px; text-transform: uppercase;
}
.data-table td { padding: 8px 6px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); }
.card-body { padding: 14px 18px; }
</style>
