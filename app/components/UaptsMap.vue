<script setup lang="ts">
/**
 * UaptsMap.vue
 * ─────────────────────────────────────────────────────────────────────
 * Reusable Leaflet map component for the M02 (Road Traffic Management)
 * and M04 (Public Transport Operations) modules.
 *
 * Two calling styles are supported:
 *
 *   1. Layer-catalog API (preferred for catalog layers):
 *      <UaptsMap :layers="['kenya','segments','stations','congestion']"
 *                :center="[-1.286,36.817]" :zoom="11" />
 *
 *   2. Data-props API (preferred for ad-hoc shapes):
 *      <UaptsMap :boundary="boundaryGeoJSON"
 *                :roads="roadsGeoJSON" :routes="routesGeoJSON"
 *                :markers="markers" :arrows="arrows" :lines="lines"
 *                :initial-bbox="[-4.677,33.913,4.677,41.859]" />
 *
 * Always wrap usage in <ClientOnly> - Leaflet touches `window` at
 * import time and the page is SSR-rendered.
 */
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'

// ── Public types ─────────────────────────────────────────────────────
// Re-exported so composables (useTraffic/usePublicTransport) can
// import them with a single canonical source of truth and stop
// referencing the (non-existent) UAPTSMap.vue path.
export type MarkerColor = 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'purple' | 'gray'
export type MarkerSize = 'sm' | 'md' | 'lg'

export interface MarkerSpec {
  id: string
  lat: number
  lon: number
  title?: string
  subtitle?: string
  /** Short type label shown above the title in the popup header. */
  badge?: string
  /** Structured key/value rows shown in the popup body. Takes precedence over subtitle. */
  rows?: Array<{ label: string; value: string }>
  color?: MarkerColor
  size?: MarkerSize
}

export interface LineSpec {
  id: string
  /** Array of [lat, lon] tuples. */
  points: [number, number][]
  color?: string
  weight?: number
  opacity?: number
  label?: string
}

export interface ArrowSpec {
  id: string
  from: [number, number]
  to: [number, number]
  label?: string
  weight?: number
  color?: MarkerColor
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: { type: string; coordinates: any }
    properties?: Record<string, any>
  }>
  [k: string]: any
}

// ── Props ────────────────────────────────────────────────────────────
interface Props {
  // Layer-catalog API
  /** Catalogue layer keys to fetch + render. See LAYER_CATALOG below. */
  layers?: string[]
  /** Initial map centre [lat, lon]. Defaults to Nairobi CBD. */
  center?: [number, number]
  /** Initial zoom level. */
  zoom?: number
  /** Whether to show the catalogue layer-toggle UI. */
  showLayerControl?: boolean
  /** Whether to show the bottom-right data readout. */
  showReadout?: boolean

  // Data-props API
  /** Country boundary GeoJSON FeatureCollection. */
  boundary?: GeoJSONFeatureCollection | null
  /** Road network GeoJSON FeatureCollection. */
  roads?: GeoJSONFeatureCollection | null
  /** Public-transport routes GeoJSON FeatureCollection. */
  routes?: GeoJSONFeatureCollection | null
  /** Pre-shaped markers (counting stations, congestion events, etc). */
  markers?: MarkerSpec[]
  /** Pre-shaped polylines (PT routes). */
  lines?: LineSpec[]
  /** Pre-shaped OD-pair arrows. */
  arrows?: ArrowSpec[]
  /** Initial bbox [S, W, N, E] - overrides `center`/`zoom` if set. */
  initialBbox?: [number, number, number, number]
  /** Show the legend overlay (data-props mode). */
  showLegend?: boolean

  // Shared
  /** Map height in CSS units. Defaults to 600px. */
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  layers: () => [],
  center: () => [-1.286, 36.817],
  zoom: 11,
  height: '600px',
  showLayerControl: false,
  showReadout: false,
  boundary: null,
  roads: null,
  routes: null,
  markers: () => [],
  lines: () => [],
  arrows: () => [],
  initialBbox: undefined,
  showLegend: false,
})

const emit = defineEmits<{
  (e: 'feature-click', payload: { layer: string; feature: any }): void
}>()

// ── Leaflet resolution ──────────────────────────────────────────────
// The plugin at app/plugins/leaflet.client.ts may or may not have
// resolved a usable Leaflet instance depending on CJS↔ESM interop. We
// fall back to a client-only dynamic import so the component always
// works regardless of plugin shape. We only ever do the dynamic import
// once per mount.
let L: any = null

function unwrapLeaflet(mod: any): any {
  let cur: any = mod
  for (let depth = 0; depth < 4 && cur; depth++) {
    if (cur && typeof cur.map === 'function') return cur
    if (cur && cur.default && typeof cur.default === 'object') { cur = cur.default; continue }
    break
  }
  return null
}

async function getLeaflet(): Promise<any> {
  if (L) return L
  try {
    const { $leaflet } = useNuxtApp() as unknown as { $leaflet: any }
    const fromPlugin = unwrapLeaflet($leaflet)
    if (fromPlugin) { L = fromPlugin; return L }
  } catch { /* no plugin / SSR */ }

  const mod: any = await import('leaflet')
  const found = unwrapLeaflet(mod)
  if (found) { L = found; return L }

  console.error('[UaptsMap] Could not resolve a usable Leaflet instance from plugin or dynamic import.')
  return null
}

// ── Refs ────────────────────────────────────────────────────────────
const mapEl = ref<HTMLDivElement | null>(null)
const mapRef = ref<any>(null)
const authStore = useAuthStore()
const layerStates = ref<Array<{ key: string; label: string; color: string; count: number; visible: boolean; instance: any }>>([])

// County highlight state (data-props boundary mode)
const selectedCountyLayer = ref<any>(null)

// Catalogue of layers that the LAYER_CATALOG API knows how to fetch.
const LAYER_CATALOG: Record<string, { label: string; color: string; endpoint: string }> = {
  kenya:       { label: 'Kenya Outline',         color: '#3b82f6', endpoint: '/api/v1/gis/kenya/boundary/' },
  segments:    { label: 'Road Segments',         color: '#64748b', endpoint: '/api/v1/geojson/segments/' },
  stations:    { label: 'Counting Stations',     color: '#10b981', endpoint: '/api/v1/geojson/stations/' },
  routes:      { label: 'Public Transport Routes', color: '#a855f7', endpoint: '/api/v1/geojson/routes/' },
  'brt-stops': { label: 'BRT Stops',             color: '#3b82f6', endpoint: '/api/v1/geojson/brt-stops/' },
  congestion:  { label: 'Active Congestion',     color: '#ef4444', endpoint: '/api/v1/geojson/congestion/' },
  weather:     { label: 'Weather (KMD)',         color: '#06b6d4', endpoint: '/api/v1/geojson/weather/' },
  'od-flow':   { label: 'OD Trip Flows',         color: '#f59e0b', endpoint: '/api/v1/geojson/od-flow/' },
  'rail-lines':    { label: 'Rail Lines (SGR/MGR)',   color: '#3b82f6', endpoint: '/api/v1/geojson/rail-lines/' },
  'rail-stations': { label: 'Rail Stations',          color: '#ef4444', endpoint: '/api/v1/geojson/rail-stations/' },
}

// ── Helpers ─────────────────────────────────────────────────────────
const markerColorMap: Record<MarkerColor, string> = {
  green: '#10b981', yellow: '#eab308', red: '#ef4444',
  orange: '#f97316', blue: '#3b82f6', purple: '#a855f7', gray: '#94a3b8',
}

function markerRadius(size: MarkerSize | undefined): number {
  if (size === 'lg') return 12
  if (size === 'sm') return 6
  return 9
}

async function authedFetch(url: string): Promise<any> {
  const token = authStore?.accessToken
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`)
  return res.json()
}

// ── Rendering: layer-catalog mode ───────────────────────────────────
async function renderCatalogLayer(Lc: any, key: string) {
  const meta = LAYER_CATALOG[key]
  if (!meta) return
  if (layerStates.value.find(s => s.key === key)) return  // already rendered
  const apiBase = (useRuntimeConfig().public.apiBase as string)
  let data: any
  try {
    data = await authedFetch(apiBase + meta.endpoint)
  } catch (err: any) {
    console.warn(`[UaptsMap] catalog layer ${key} failed:`, err?.message)
    return
  }
  const features = data?.features ?? []
  const layer = Lc.geoJSON(data, {
    pointToLayer: (_f: any, latlng: any) =>
      Lc.circleMarker(latlng, { radius: 7, color: '#fff', weight: 1.5, fillColor: meta.color, fillOpacity: 0.9 }),
    onEachFeature: (feature: any, lyr: any) => {
      lyr.bindPopup(buildPopup(key, feature))
      lyr.on('click', () => emit('feature-click', { layer: key, feature }))
    },
  })
  if (mapRef.value) layer.addTo(mapRef.value)
  layerStates.value.push({ key, label: meta.label, color: meta.color, count: features.length, visible: true, instance: layer })
}

async function renderAllCatalogLayers(Lc: any) {
  for (const key of props.layers) await renderCatalogLayer(Lc, key)
}

// ── Rendering: data-props mode ───────────────────────────────────────
function boundaryStyle(feature: any) {
  const kind = feature?.properties?.kind
  if (kind === 'country')      return { color: '#6366f1', weight: 2.5, fillOpacity: 0.03, fillColor: '#6366f1', interactive: false }
  if (kind === 'county')       return { color: '#94a3b8', weight: 1,   fillOpacity: 0.04, fillColor: '#64748b', dashArray: undefined }
  if (kind === 'constituency') return { color: '#cbd5e1', weight: 0.5, fillOpacity: 0.02, fillColor: '#94a3b8', dashArray: '3 4' }
  if (kind === 'river')        return { color: '#38bdf8', weight: 1,   opacity: 0.3,      fillOpacity: 0,       dashArray: '2 5' }
  return { color: '#94a3b8', weight: 1, fillOpacity: 0.03 }
}

function renderBoundary(Lc: any) {
  if (!props.boundary || !mapRef.value) return
  const layer = Lc.geoJSON(props.boundary, {
    style: (feature: any) => boundaryStyle(feature),
    pointToLayer: (f: any, latlng: any) => {
      const p = f.properties || {}
      // Landmarks: very faint small dots
      if (p.kind === 'landmark') {
        return Lc.circleMarker(latlng, { radius: 3, color: '#94a3b8', weight: 1, fillColor: '#cbd5e1', fillOpacity: 0.5 })
      }
      const size = p.size === 'lg' ? 12 : p.size === 'sm' ? 6 : 9
      const fill = p.color === 'red' ? '#ef4444'
        : p.color === 'blue' ? '#3b82f6'
        : p.color === 'green' ? '#10b981'
        : p.color === 'orange' ? '#f97316' : '#eab308'
      return Lc.circleMarker(latlng, { radius: size, color: '#fff', weight: 1.5, fillColor: fill, fillOpacity: 0.9 })
    },
    onEachFeature: (feature: any, lyr: any) => {
      const kind = feature?.properties?.kind
      // Rivers and landmarks: no popup, not interactive
      if (kind === 'river' || kind === 'landmark') return
      lyr.bindPopup(buildPopup('boundary', feature))
      lyr.on('click', () => {
        emit('feature-click', { layer: 'boundary', feature })
        // County / constituency highlight
        if (kind === 'county' || kind === 'constituency') {
          if (selectedCountyLayer.value) {
            selectedCountyLayer.value.setStyle(boundaryStyle(selectedCountyLayer.value.feature))
          }
          selectedCountyLayer.value = lyr
          lyr.setStyle({ color: '#6366f1', weight: 2.5, fillColor: '#6366f1', fillOpacity: 0.18 })
          lyr.bringToFront()
        }
      })
    },
  })
  layer.addTo(mapRef.value)
  layerStates.value.push({ key: 'boundary', label: 'Kenya Outline', color: '#3b82f6', count: props.boundary.features?.length ?? 0, visible: true, instance: layer })
}

// Road style by highway type (matches API properties.highway)
function roadStyle(feature: any) {
  const hw = feature?.properties?.highway ?? ''
  const surface = feature?.properties?.surface ?? ''
  const paved = surface === 'asphalt' || surface === 'paved' || surface === 'concrete'
  const unpaved = surface === 'unpaved' || surface === 'gravel' || surface === 'dirt'

  if (hw === 'motorway')     return { color: '#dc2626', weight: 4,   opacity: 0.9,  dashArray: undefined }
  if (hw === 'trunk')        return { color: '#ea580c', weight: 3.5, opacity: 0.88, dashArray: undefined }
  if (hw === 'primary')      return { color: '#d97706', weight: 2.5, opacity: 0.85, dashArray: undefined }
  if (hw === 'secondary')    return { color: '#16a34a', weight: 2,   opacity: 0.80, dashArray: unpaved ? '6 3' : undefined }
  if (hw === 'tertiary')     return { color: '#0284c7', weight: 1.5, opacity: 0.75, dashArray: unpaved ? '4 4' : undefined }
  if (hw === 'unclassified') return { color: '#64748b', weight: 1,   opacity: 0.55, dashArray: '3 5' }
  return                            { color: '#94a3b8', weight: 1,   opacity: 0.45, dashArray: '2 5' }
}

function renderRoads(Lc: any) {
  if (!props.roads || !mapRef.value) return
  const layer = Lc.geoJSON(props.roads, {
    style: (feature: any) => roadStyle(feature),
    onEachFeature: (feature: any, lyr: any) => {
      lyr.bindPopup(buildPopup('roads', feature))
      lyr.on('mouseover', () => {
        const base = roadStyle(feature)
        lyr.setStyle({ ...base, weight: (base.weight as number) + 2, opacity: 1, color: '#f8fafc' })
        lyr.bringToFront()
      })
      lyr.on('mouseout',  () => lyr.setStyle(roadStyle(feature)))
      lyr.on('click',     () => emit('feature-click', { layer: 'roads', feature }))
    },
  })
  layer.addTo(mapRef.value)
  layerStates.value.push({ key: 'roads', label: 'Roads', color: '#ea580c', count: props.roads.features?.length ?? 0, visible: true, instance: layer })
}

function renderRoutes(Lc: any) {
  if (!props.routes || !mapRef.value) return
  const layer = Lc.geoJSON(props.routes, {
    style: (p: any) => ({
      color: p?.service_type === 'brt' ? '#ef4444' : '#a855f7',
      weight: p?.service_type === 'brt' ? 4 : 2,
      opacity: 0.75,
    }),
    onEachFeature: (feature: any, lyr: any) => {
      lyr.bindPopup(buildPopup('routes', feature))
      lyr.on('click', () => emit('feature-click', { layer: 'routes', feature }))
    },
  })
  layer.addTo(mapRef.value)
  layerStates.value.push({ key: 'routes', label: 'PT Routes', color: '#a855f7', count: props.routes.features?.length ?? 0, visible: true, instance: layer })
}

function renderMarkers(Lc: any) {
  if (!props.markers?.length || !mapRef.value) return
  const group = Lc.layerGroup()
  for (const m of props.markers) {
    if (m.lat == null || m.lon == null) continue
    const radius = markerRadius(m.size)
    const fill = markerColorMap[m.color ?? 'blue']
    const marker = Lc.circleMarker([m.lat, m.lon], {
      radius, color: '#fff', weight: 1.5, fillColor: fill, fillOpacity: 0.9,
    })
    marker.bindPopup(buildMarkerPopup(m, fill), { maxWidth: 300, minWidth: 210 })
    marker.on('click', () => emit('feature-click', { layer: 'markers', feature: m }))
    marker.addTo(group)
  }
  group.addTo(mapRef.value)
  layerStates.value.push({ key: 'markers', label: 'Markers', color: '#22d3ee', count: props.markers.length, visible: true, instance: group })
}

function renderLines(Lc: any) {
  if (!props.lines?.length || !mapRef.value) return
  const group = Lc.layerGroup()
  for (const ln of props.lines) {
    if (!ln.points || ln.points.length < 2) continue
    const color = ln.color && ln.color.startsWith('#') ? ln.color : (markerColorMap[ln.color as MarkerColor] ?? '#3b82f6')
    const polyline = Lc.polyline(ln.points, {
      color, weight: ln.weight ?? 3, opacity: ln.opacity ?? 0.85,
    })
    if (ln.label) polyline.bindPopup(`<div class="uapts-popup"><div class="uapts-popup-title">${escape(ln.label)}</div></div>`)
    polyline.on('click', () => emit('feature-click', { layer: 'lines', feature: ln }))
    polyline.addTo(group)
  }
  group.addTo(mapRef.value)
  layerStates.value.push({ key: 'lines', label: 'Lines', color: '#3b82f6', count: props.lines.length, visible: true, instance: group })
}

function renderArrows(Lc: any) {
  if (!props.arrows?.length || !mapRef.value) return
  const group = Lc.layerGroup()
  for (const a of props.arrows) {
    const color = markerColorMap[a.color ?? 'purple']
    const weight = a.weight ?? 3
    // Curved dashed arrow via a quadratic offset on the midpoint.
    const midLat = (a.from[0] + a.to[0]) / 2
    const midLon = (a.from[1] + a.to[1]) / 2
    // Perpendicular offset (~10% of distance, biased upward)
    const dLat = a.to[0] - a.from[0]
    const dLon = a.to[1] - a.from[1]
    const offsetFactor = 0.15
    const ctrlLat = midLat - dLon * offsetFactor
    const ctrlLon = midLon + dLat * offsetFactor
    const curve = Lc.polyline([a.from, [ctrlLat, ctrlLon], a.to], {
      color, weight, opacity: 0.7, dashArray: '6 5',
    })
    if (a.label) curve.bindPopup(`<div class="uapts-popup"><div class="uapts-popup-title">${escape(a.label)}</div></div>`)
    curve.on('click', () => emit('feature-click', { layer: 'arrows', feature: a }))
    curve.addTo(group)
  }
  group.addTo(mapRef.value)
  layerStates.value.push({ key: 'arrows', label: 'OD Arrows', color: '#a855f7', count: props.arrows.length, visible: true, instance: group })
}

// ── Popup builders ──────────────────────────────────────────────────
// All popups use inline styles - Leaflet injects popup DOM outside the
// component's scoped CSS scope, so class-based styles never apply.

const POPUP_WRAP = 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-width:210px;max-width:280px;overflow:hidden;border-radius:7px;box-shadow:0 4px 16px rgba(0,0,0,.18)'
const POPUP_HEAD_BASE = 'padding:9px 12px 8px;border-radius:7px 7px 0 0'
const POPUP_ROW_EVEN  = 'background:#f8fafc'
const POPUP_ROW_ODD   = 'background:#fff'
const POPUP_CELL_L = 'font-size:11px;color:#64748b;padding:4px 6px 4px 12px;white-space:nowrap'
const POPUP_CELL_R = 'font-size:11px;font-weight:600;color:#1e293b;padding:4px 12px 4px 6px;text-align:right'

function buildMarkerPopup(m: MarkerSpec, fill: string): string {
  const head = `
    <div style="${POPUP_HEAD_BASE};background:${fill}">
      ${m.badge ? `<div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.75);margin-bottom:3px">${escape(m.badge)}</div>` : ''}
      <div style="font-size:13px;font-weight:600;color:#fff;line-height:1.3">${escape(m.title ?? m.id)}</div>
    </div>`

  let body = ''
  if (m.rows?.length) {
    const trs = m.rows.map((r, i) =>
      `<tr style="${i % 2 === 0 ? POPUP_ROW_EVEN : POPUP_ROW_ODD}">
        <td style="${POPUP_CELL_L}">${escape(r.label)}</td>
        <td style="${POPUP_CELL_R}">${escape(r.value)}</td>
       </tr>`
    ).join('')
    body = `<table style="border-collapse:collapse;width:100%">${trs}</table>`
  } else if (m.subtitle) {
    body = `<div style="font-size:12px;color:#475569;padding:8px 12px">${escape(m.subtitle)}</div>`
  }

  return `<div style="${POPUP_WRAP}">${head}${body}</div>`
}

function buildPopup(layerKey: string, feature: any): string {
  const p = feature.properties || {}
  const title = p.name || p.route_name || p.station_name || p.stop_name ||
                p.road_name || p.adm1 || p.segment_id || p.origin_zone || feature.geometry?.type || layerKey
  const LABEL_MAP: Record<string, string> = {
    // Road fields (from API)
    highway: 'Highway type', surface: 'Surface', adm1: 'County', adm2: 'Sub-county',
    // Generic
    road_class: 'Road class', length_m: 'Length (m)',
    speed_limit_kmh: 'Speed limit', service_type: 'Service type',
    route_name: 'Route', station_name: 'Station', stop_name: 'Stop',
    origin_zone: 'Origin', destination_zone: 'Destination',
    congestion_level: 'Congestion', delay_minutes: 'Delay (min)',
    // Boundary
    adm0_name: 'Country', cod_version: 'COD version', area_sqkm: 'Area (km²)',
    kind: 'Feature type',
  }
  const rows = Object.entries(p)
    .filter(([k, v]) => v !== null && v !== undefined && v !== '' && k !== 'name' && k !== 'id')
    .slice(0, 10)
    .map(([k, v], i) => {
      const label = LABEL_MAP[k] ?? k.replace(/_/g, ' ')
      return `<tr style="${i % 2 === 0 ? POPUP_ROW_EVEN : POPUP_ROW_ODD}">
        <td style="${POPUP_CELL_L}">${escape(label)}</td>
        <td style="${POPUP_CELL_R}">${escape(formatValue(v))}</td>
      </tr>`
    }).join('')

  const LAYER_LABELS: Record<string, string> = {
    roads: 'Road Segment', boundary: 'Kenya', routes: 'PT Route',
    markers: 'Marker', lines: 'Line', arrows: 'OD Flow',
  }
  const LAYER_COLORS: Record<string, string> = {
    roads: '#ea580c', boundary: '#6366f1', routes: '#a855f7',
    markers: '#0ea5e9', lines: '#3b82f6', arrows: '#8b5cf6',
  }
  const layerLabel = LAYER_LABELS[layerKey] ?? layerKey
  const headBg = LAYER_COLORS[layerKey] ?? '#1e293b'
  const head = `
    <div style="${POPUP_HEAD_BASE};background:${headBg}">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.65);margin-bottom:3px">${escape(layerLabel)}</div>
      <div style="font-size:13px;font-weight:600;color:#fff;line-height:1.3">${escape(String(title))}</div>
    </div>`
  const body = rows
    ? `<table style="border-collapse:collapse;width:100%">${rows}</table>`
    : `<div style="font-size:12px;color:#94a3b8;padding:8px 12px">No properties</div>`

  return `<div style="${POPUP_WRAP}">${head}${body}</div>`
}

function formatValue(v: any): string {
  if (typeof v === 'number') {
    if (!Number.isInteger(v) || (Math.abs(v) < 1 && v !== 0)) return v.toFixed(3)
    return v.toLocaleString()
  }
  if (typeof v === 'string' && v.length > 60) return v.slice(0, 60) + '…'
  return String(v)
}

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}

// ── Catalogue layer toggles ─────────────────────────────────────────
function toggleLayer(key: string) {
  const s = layerStates.value.find(x => x.key === key)
  if (!s || !s.instance || !mapRef.value) return
  s.visible = !s.visible
  if (s.visible) s.instance.addTo(mapRef.value)
  else mapRef.value.removeLayer(s.instance)
}

// ── Lifecycle ───────────────────────────────────────────────────────
onMounted(async () => {
  if (!mapEl.value) return
  const Lc = await getLeaflet()
  if (!Lc) return

  const map = Lc.map(mapEl.value, {
    zoomControl: true,
    preferCanvas: true,
  })
  mapRef.value = map

  // OSM tile layer
  Lc.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)
  Lc.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map)

  // Initial view: bbox wins, otherwise center/zoom.
  if (props.initialBbox && props.initialBbox.length === 4) {
    const [s, w, n, e] = props.initialBbox
    map.fitBounds([[s, w], [n, e]], { padding: [20, 20] })
  } else {
    map.setView(props.center, props.zoom)
  }

  // Render - both modes are independent and can be combined.
  await renderAllCatalogLayers(Lc)
  renderBoundary(Lc)
  renderRoads(Lc)
  renderRoutes(Lc)
  renderLines(Lc)
  renderMarkers(Lc)
  renderArrows(Lc)
})

onBeforeUnmount(() => {
  if (mapRef.value) {
    mapRef.value.remove()
    mapRef.value = null
  }
})

// Watchers: when data-props change after mount, re-render.
// We rebuild from scratch because the shapes are independent and
// doing a proper diff would be more code than the map will ever
// realistically need at this volume.
watch(
  () => [
    props.boundary, props.roads, props.routes,
    props.markers, props.lines, props.arrows,
    props.layers,
  ],
  async () => {
    if (!mapRef.value) return
    // Tear down existing layer instances.
    for (const s of layerStates.value) {
      if (s.instance) mapRef.value.removeLayer(s.instance)
    }
    layerStates.value = []
    selectedCountyLayer.value = null
    const Lc = await getLeaflet()
    if (!Lc) return
    await renderAllCatalogLayers(Lc)
    renderBoundary(Lc)
    renderRoads(Lc)
    renderRoutes(Lc)
    renderLines(Lc)
    renderMarkers(Lc)
    renderArrows(Lc)
  },
  { deep: true },
)

const legendItems = computed(() => layerStates.value.filter(s => s.key !== 'kenya' || true))
</script>

<template>
  <div class="uapts-map-wrapper" :style="{ height: props.height }">
    <div ref="mapEl" class="uapts-map" />

    <!-- Layer-catalog toggle UI -->
    <div v-if="props.showLayerControl" class="uapts-layer-control">
      <div class="uapts-layer-control-title">Map Layers</div>
      <div
        v-for="s in layerStates"
        :key="s.key"
        class="uapts-layer-row"
        :class="{ active: s.visible }"
      >
        <button class="uapts-layer-toggle" @click="toggleLayer(s.key)">
          <span class="uapts-layer-dot" :style="{ background: s.color }"></span>
          <span class="uapts-layer-label">
            <span class="uapts-layer-name">{{ s.label }}</span>
          </span>
          <span class="uapts-layer-count">{{ s.count.toLocaleString() }}</span>
        </button>
      </div>
    </div>

    <!-- Data-props legend overlay -->
    <div v-if="props.showLegend && layerStates.length" class="uapts-legend">
      <div class="uapts-legend-title">Layers</div>
      <div v-for="s in layerStates" :key="`legend-${s.key}`" class="uapts-legend-row">
        <span class="uapts-legend-dot" :style="{ background: s.color }"></span>
        <span class="uapts-legend-label">{{ s.label }}</span>
        <span class="uapts-legend-count">{{ s.count.toLocaleString() }}</span>
      </div>
    </div>

    <!-- Readout (catalog mode) -->
    <div v-if="props.showReadout" class="uapts-readout">
      <div class="uapts-readout-title">UAPTS GeoJSON Layers</div>
      <div class="uapts-readout-grid">
        <div v-for="s in layerStates" :key="`readout-${s.key}`" class="uapts-readout-cell">
          <div class="uapts-readout-cell-key" :style="{ color: s.color }">{{ s.label }}</div>
          <div class="uapts-readout-cell-val">{{ s.count.toLocaleString() }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.uapts-map-wrapper {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.uapts-map { position: absolute; inset: 0; }

.uapts-layer-control,
.uapts-legend {
  position: absolute;
  top: 12px;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.94);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
  min-width: 200px;
  max-width: 260px;
  backdrop-filter: blur(8px);
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
.uapts-layer-control { right: 12px; }
.uapts-legend { left: 12px; }

.uapts-layer-control-title,
.uapts-legend-title {
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.uapts-layer-row,
.uapts-legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.uapts-layer-row { border-radius: 4px; overflow: hidden; margin: 2px 0; }

.uapts-layer-toggle {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: transparent;
  border: 1px solid transparent;
  color: #cbd5e1;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  border-radius: 4px;
  transition: all 0.1s;
}
.uapts-layer-toggle:hover { background: rgba(255, 255, 255, 0.05); }

.uapts-layer-dot,
.uapts-legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.uapts-layer-label,
.uapts-legend-label {
  flex: 1;
  font-size: 12px;
}
.uapts-layer-name {
  font-weight: 500;
  display: block;
}

.uapts-layer-count,
.uapts-legend-count {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: #94a3b8;
}

.uapts-readout {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.94);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px 10px;
  backdrop-filter: blur(8px);
  font-size: 11px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  max-width: 280px;
}
.uapts-readout-title {
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  margin-bottom: 4px;
}
.uapts-readout-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
}
.uapts-readout-cell-key {
  font-size: 10px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.uapts-readout-cell-val {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 12px;
}
</style>