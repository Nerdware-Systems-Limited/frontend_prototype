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
 * Both styles can additionally opt into:
 *
 *   - `basemap` ("light" | "dark" | "satellite", v-model-able via
 *     :basemap + @update:basemap) to swap the underlying tile layer.
 *   - `show-map-toolbar` for a self-contained fullscreen / locate-me /
 *     reset-view / cycle-basemap button cluster. Off by default so
 *     existing M02/M04 usages render exactly as before.
 *   - `@bounds-change="{ bbox, zoom, center } => …"`, fired on every
 *     Leaflet `moveend`, for callers that want to scope their own
 *     fetches (bbox params already exist on useGis().routes/roads/
 *     mapOverview) to whatever's actually in view.
 *   - A template ref exposing `flyTo()`, `fitBounds()` and `getMap()`
 *     for parent-driven navigation (e.g. "jump to this county").
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
  /** Road network GeoJSON FeatureCollection. Prefer roadsTilesUrl for the full network - this is best for small ad-hoc shapes. */
  roads?: GeoJSONFeatureCollection | null
  /**
   * URL to a PMTiles archive (e.g. /media/roads.pmtiles) rendered via
   * protomaps-leaflet. Use this instead of `roads` for the full-network
   * layer - the browser only fetches the current viewport/zoom's tiles,
   * so there's no server-side scan cap and no payload-size ceiling
   * regardless of total feature count.
   *
   * NOTE: since the KRB + RICS road-condition merge, this tileset's
   * `roads` data layer carries "Road Class" / "Road Agency" / "Surface
   * Condition" properties (the KRB scheme), not the old OSM `highway`
   * tag - filter with roadsClassFilter/roadsConditionFilter/
   * roadsAgencyFilter/roadsCountyFilter below, not the highway values
   * this prop used to take. The small ad-hoc `roads` GeoJSON prop above
   * is a separate code path (still OSM-based, via /api/v1/gis/roads/)
   * and is unaffected.
   */
  roadsTilesUrl?: string | null
  /** Optional Road Class filter for the PMTiles roads layer, e.g. "A" or "D". Matched as a prefix so "D" also catches the urban "Du" variant. Empty/undefined shows all classes. */
  roadsClassFilter?: string
  /** Optional Surface Condition filter for the PMTiles roads layer, e.g. "Poor". Empty/undefined shows all conditions. */
  roadsConditionFilter?: string
  /**
   * Optional Road Agency filter for the PMTiles roads layer, e.g. "KeNHA".
   * Matched case-insensitively as a *substring* (unlike the exact/prefix
   * matches above) since the source data's exact agency-string formatting
   * isn't fixed or fully known ahead of time. Empty/undefined shows all
   * agencies. Requires the tileset to carry a `road_agency` property -
   * see the tippecanoe `-y` flags noted above.
   */
  roadsAgencyFilter?: string
  /**
   * Optional County filter for the PMTiles roads layer, e.g. "Nairobi".
   * Matched case-insensitively as an exact match. Empty/undefined shows
   * all counties. Requires the tileset to carry a `county` property - see
   * the tippecanoe `-y` flags noted above.
   */
  roadsCountyFilter?: string
  /**
   * URL to the rail network PMTiles archive (e.g. rails.pmtiles), rendered
   * via protomaps-leaflet exactly like roadsTilesUrl above. The single
   * `railways` data layer inside carries rail line, station point, and
   * station-area polygon features together (see renderRailsTiles()) - they're
   * told apart by GeomType, not by a separate tileset per geometry type.
   */
  railsTilesUrl?: string | null
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
  /** Basemap tile style. v-model-able via :basemap + @update:basemap. Defaults to the classic OSM raster layer, so existing callers are unaffected. */
  basemap?: 'light' | 'dark' | 'satellite'
  /**
   * Self-contained fullscreen / locate-me / reset-view / cycle-basemap
   * button cluster, top-right. Off by default so existing callers keep
   * their current appearance untouched.
   */
  showMapToolbar?: boolean
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
  roadsTilesUrl: null,
  roadsClassFilter: '',
  roadsConditionFilter: '',
  roadsAgencyFilter: '',
  roadsCountyFilter: '',
  railsTilesUrl: null,
  routes: null,
  markers: () => [],
  lines: () => [],
  arrows: () => [],
  initialBbox: undefined,
  showLegend: false,
  basemap: 'light',
  showMapToolbar: false,
})

const emit = defineEmits<{
  (e: 'feature-click', payload: { layer: string; feature: any }): void
  (e: 'update:basemap', value: 'light' | 'dark' | 'satellite'): void
  (e: 'bounds-change', payload: { bbox: [number, number, number, number]; zoom: number; center: [number, number] }): void
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

// protomaps-leaflet resolution — same rationale as getLeaflet(): it touches
// `window`/Leaflet at import time, so it must be a client-only dynamic
// import, loaded once and cached for the component's lifetime.
let PM: any = null

async function getProtomaps(): Promise<any> {
  if (PM) return PM
  const mod: any = await import('protomaps-leaflet')
  PM = mod
  return PM
}

// ── Refs ────────────────────────────────────────────────────────────
const mapEl = ref<HTMLDivElement | null>(null)
const mapRef = ref<any>(null)
const authStore = useAuthStore()
const layerStates = ref<Array<{ key: string; label: string; color: string; count: number; visible: boolean; instance: any }>>([])

// County highlight state (data-props boundary mode)
const selectedCountyLayer = ref<any>(null)

// ── Basemap + toolbar state (opt-in chrome) ────────────────────────────
const mapWrapperEl = ref<HTMLDivElement | null>(null)   // fullscreen target - the whole wrapper, not just the Leaflet <div>
// Mirrors props.basemap locally so cycleBasemap() works whether or not
// the parent binds @update:basemap - "controlled" via v-model AND usable
// as a plain one-shot initial value. See setBasemap()/cycleBasemap().
const currentBasemap = ref<'light' | 'dark' | 'satellite'>(props.basemap)
const isFullscreen = ref(false)
const locateStatus = ref<'idle' | 'locating' | 'found' | 'error'>('idle')
let baseLayer: any = null            // active Lc.tileLayer instance, tracked separately from layerStates
let locateMarkerGroup: any = null    // "you are here" dot + accuracy circle
let homeView: { bbox: [number, number, number, number] } | { center: [number, number]; zoom: number } | null = null

// Free, no-API-key raster tile sources for the basemap switcher.
const BASEMAP_CATALOG: Record<'light' | 'dark' | 'satellite', { url: string; options: Record<string, any> }> = {
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 },
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd', maxZoom: 20, detectRetina: true,
    },
  },
  satellite: {
    // Esri's legacy free tile endpoint - fine for dev/demo traffic. Esri
    // has been steering high-volume users toward a newer, API-key-gated
    // basemap service (ibasemaps-api.arcgis.com); swap this out if usage
    // ever grows enough for that to matter.
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community', maxZoom: 19 },
  },
}

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

// Road color/weight by OSM `highway` tag — used only by the GeoJSON-mode
// roadStyle() below, for the small ad-hoc `props.roads` shapes that come
// from the separate /api/v1/gis/roads/ REST endpoint (still OSM-based).
// The PMTiles roads layer no longer uses these - see conditionColorFor()/
// classWeightFor() below.
function roadColorFor(hw: string): string {
  if (hw === 'motorway')     return '#dc2626'
  if (hw === 'trunk')        return '#ea580c'
  if (hw === 'primary')      return '#d97706'
  if (hw === 'secondary')    return '#16a34a'
  if (hw === 'tertiary')     return '#0284c7'
  if (hw === 'unclassified') return '#64748b'
  return '#94a3b8'
}

function roadWeightFor(hw: string): number {
  if (hw === 'motorway')  return 4
  if (hw === 'trunk')     return 3.5
  if (hw === 'primary')   return 2.5
  if (hw === 'secondary') return 2
  if (hw === 'tertiary')  return 1.5
  if (hw === 'unclassified') return 1
  return 1
}

// Road color/weight for the KRB + RICS roads.pmtiles layer. Color encodes
// worst_condition (the actual point of the merge - which roads need
// attention, not just whatever condition happened to be in the first
// surveyed sub-segment). Weight encodes Road Class hierarchy (A =
// international trunk … G = unclassified). "Au"/"Bu"/etc (urban variants)
// share their base letter's weight.
//
// Property names confirmed against the real roads_joined.geojson output
// (snake_case: road_class, worst_condition, …) - NOT the space-cased
// "Road Class" names from the earlier tile-inspector screenshot, which
// must have come from a field-alias display rather than the raw schema.
function conditionColorFor(condition: string): string {
  if (condition === 'Poor')               return '#dc2626'
  if (condition === 'Fair')               return '#f59e0b'
  if (condition === 'Good')               return '#16a34a'
  if (condition === 'Under Construction') return '#2563eb'
  return '#94a3b8' // no RICS match for this road
}

function classWeightFor(roadClass: string): number {
  const base = (roadClass || '').trim().toUpperCase().replace(/U$/, '') // Au/Bu/… -> A/B/…
  if (base === 'A') return 7
  if (base === 'B') return 6
  if (base === 'S') return 6 // special purpose - KeNHA-managed, same tier as B
  if (base === 'C') return 5
  if (base === 'D') return 4
  if (base === 'E') return 3
  if (base === 'F') return 2.5
  return 1.5 // G / unclassified
}

// Road style by highway type (matches API properties.highway)
function roadStyle(feature: any) {
  const hw = feature?.properties?.highway ?? ''
  const surface = feature?.properties?.surface ?? ''
  const unpaved = surface === 'unpaved' || surface === 'gravel' || surface === 'dirt'
  const dashArray =
    hw === 'secondary' || hw === 'tertiary' ? (unpaved ? (hw === 'secondary' ? '6 3' : '4 4') : undefined)
    : hw === 'unclassified' ? '3 5'
    : hw === 'motorway' || hw === 'trunk' || hw === 'primary' ? undefined
    : '2 5'
  const opacity =
    hw === 'motorway' ? 0.9 : hw === 'trunk' ? 0.88 : hw === 'primary' ? 0.85
    : hw === 'secondary' ? 0.80 : hw === 'tertiary' ? 0.75 : hw === 'unclassified' ? 0.55 : 0.45

  return { color: roadColorFor(hw), weight: roadWeightFor(hw), opacity, dashArray }
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

// Holds the live protomaps-leaflet layer instance so we can tear it down
// cleanly on re-render (it's not a standard Lc.geoJSON layer, but it does
// implement Leaflet's Layer interface, so addTo()/removeLayer() both work).
let roadsTileLayer: any = null

async function renderRoadsTiles() {
  if (!props.roadsTilesUrl || !mapRef.value) {
    console.debug('[UaptsMap] renderRoadsTiles skipped — url:', props.roadsTilesUrl, 'map ready:', !!mapRef.value)
    return
  }
  console.debug('[UaptsMap] loading roads PMTiles from', props.roadsTilesUrl)
  const PMm = await getProtomaps()
  if (!PMm) {
    console.error('[UaptsMap] protomaps-leaflet failed to load')
    return
  }

  const classFilter     = (props.roadsClassFilter || '').trim().toUpperCase()
  const conditionFilter = props.roadsConditionFilter || ''
  const agencyFilter    = (props.roadsAgencyFilter || '').trim().toLowerCase()
  const countyFilter    = (props.roadsCountyFilter || '').trim().toLowerCase()
  const filterFn = (classFilter || conditionFilter || agencyFilter || countyFilter)
    ? (_z: number, f: any) => {
        if (classFilter) {
          const cls = String(f.props.road_class ?? '').toUpperCase()
          if (!cls.startsWith(classFilter)) return false // "D" also matches "Du"
        }
        if (conditionFilter && f.props.worst_condition !== conditionFilter) return false
        // Substring (not exact) - agency-string formatting in the source
        // data isn't fixed, so this is deliberately more forgiving than
        // the class/condition/county matches.
        if (agencyFilter && !String(f.props.road_agency ?? '').toLowerCase().includes(agencyFilter)) return false
        if (countyFilter && String(f.props.county ?? '').toLowerCase() !== countyFilter) return false
        return true
      }
    : undefined // confirmed safe: paint() only calls filter when it's truthy, so leaving it undefined means "show everything"

  // Two passes over the same 'roads' data layer, painted in array order:
  // a dark casing first (bottom), then the condition-colored line on top
  // (narrower), so the casing only peeks out as a thin outline - the
  // standard road-map technique for roads that read clearly against any
  // basemap instead of looking like flat, thin scratches.
  const casingRule: any = {
    dataLayer: 'roads',
    symbolizer: new PMm.LineSymbolizer({
      color: '#1e293b',
      width: (_z: number, f: any) => classWeightFor(f.props.road_class ?? '') + 2.5,
      opacity: 0.5,
      lineCap: 'round',
      lineJoin: 'round',
    }),
    filter: filterFn,
  }
  const fillRule: any = {
    dataLayer: 'roads',
    symbolizer: new PMm.LineSymbolizer({
      color: (_z: number, f: any) => conditionColorFor(f.props.worst_condition ?? ''),
      width: (_z: number, f: any) => classWeightFor(f.props.road_class ?? ''),
      opacity: (_z: number, f: any) => (f.props.worst_condition && f.props.worst_condition !== 'No data' ? 1 : 0.65),
      lineCap: 'round',
      lineJoin: 'round',
    }),
    filter: filterFn,
  }

  roadsTileLayer = PMm.leafletLayer({
    url: props.roadsTilesUrl,
    maxDataZoom: 14,
    paintRules: [casingRule, fillRule],
  })
  roadsTileLayer.addTo(mapRef.value)
  console.debug('[UaptsMap] roads PMTiles layer attached to map')
  layerStates.value.push({
    key: 'roads-tiles',
    label: 'Roads (vector tiles)',
    color: '#ea580c',
    count: 0, // PMTiles streams per-tile; there's no meaningful upfront total to show.
    visible: true,
    instance: roadsTileLayer,
  })
}

// Holds the live protomaps-leaflet layer instance for the rail network,
// same rationale as roadsTileLayer above.
let railsTileLayer: any = null

// Rail accent color - deliberately distinct from every other top-level
// layer swatch already in use (boundary indigo #818cf8, roads amber
// #f59e0b, routes emerald #34d399, stations green #10b981, events/
// congestion red #ef4444, and the legacy LAYER_CATALOG's own blue/violet/
// cyan). Also intentionally NOT the same red used for `railway`-mode PT
// routes/stations (serviceColor()/STATION_MODE_COLOR above) - that's a
// different data source (scheduled PT services) from this one (physical
// track + station infrastructure from OSM), and both can be on screen
// at once.
const RAIL_COLOR = '#ec4899'

async function renderRailsTiles() {
  if (!props.railsTilesUrl || !mapRef.value) {
    console.debug('[UaptsMap] renderRailsTiles skipped — url:', props.railsTilesUrl, 'map ready:', !!mapRef.value)
    return
  }
  console.debug('[UaptsMap] loading rail PMTiles from', props.railsTilesUrl)
  const PMm = await getProtomaps()
  if (!PMm) {
    console.error('[UaptsMap] protomaps-leaflet failed to load')
    return
  }

  // The `railways` data layer holds three geometry types together (rail
  // LineStrings, station Points, and a handful of station-area Polygons -
  // see rails.pmtiles' build). protomaps-leaflet doesn't route a rule to a
  // symbolizer by geometry type automatically, so each rule filters on
  // Feature.geomType itself to keep e.g. the LineSymbolizer from ever
  // being handed a Point feature.
  const isLine    = (_z: number, f: any) => f.geomType === PMm.GeomType.Line
  const isPoint   = (_z: number, f: any) => f.geomType === PMm.GeomType.Point
  const isPolygon = (_z: number, f: any) => f.geomType === PMm.GeomType.Polygon

  // Casing-then-fill, same technique as the roads PMTiles layer above, so
  // the line reads clearly against any basemap. The dashed fill (rather
  // than solid) echoes the railway treatment in protomaps' own default
  // basemap style (a fine dash on the OSM `railway=rail` equivalent).
  const railCasingRule: any = {
    dataLayer: 'railways',
    filter: isLine,
    symbolizer: new PMm.LineSymbolizer({
      color: '#1e293b',
      width: 3,
      opacity: 0.4,
      lineCap: 'round',
      lineJoin: 'round',
    }),
  }
  const railFillRule: any = {
    dataLayer: 'railways',
    filter: isLine,
    symbolizer: new PMm.LineSymbolizer({
      color: RAIL_COLOR,
      width: 1.5,
      opacity: 0.95,
      dash: [4, 3],
      lineCap: 'butt',
    }),
  }
  const stationAreaRule: any = {
    dataLayer: 'railways',
    filter: isPolygon,
    symbolizer: new PMm.PolygonSymbolizer({
      fill: RAIL_COLOR,
      opacity: 0.35,
      stroke: RAIL_COLOR,
      width: 1,
    }),
  }
  const stationPointRule: any = {
    dataLayer: 'railways',
    filter: isPoint,
    symbolizer: new PMm.CircleSymbolizer({
      radius: 4,
      fill: RAIL_COLOR,
      stroke: '#fff',
      width: 1.5,
      opacity: 0.95,
    }),
  }

  railsTileLayer = PMm.leafletLayer({
    url: props.railsTilesUrl,
    maxDataZoom: 14, // matches the tippecanoe --maximum-zoom used to build rails.pmtiles
    paintRules: [railCasingRule, railFillRule, stationAreaRule, stationPointRule],
  })
  railsTileLayer.addTo(mapRef.value)
  console.debug('[UaptsMap] rail PMTiles layer attached to map')
  layerStates.value.push({
    key: 'rails-tiles',
    label: 'Railways (vector tiles)',
    color: RAIL_COLOR,
    count: 0, // PMTiles streams per-tile; there's no meaningful upfront total to show.
    visible: true,
    instance: railsTileLayer,
  })
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
    route_description: 'Route', road_name: 'Local Name',
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
  // On a road popup, always surface route_description/road_name when
  // present - see prioritizeEntries().
  const PRIORITY_KEYS = layerKey === 'roads' ? ['route_description', 'road_name'] : []
  const rows = prioritizeEntries(
    Object.entries(p).filter(([k, v]) => v !== null && v !== undefined && v !== '' && k !== 'name' && k !== 'id'),
    PRIORITY_KEYS,
  )
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

/**
 * Stable-sorts [key, value] property entries so any key listed in
 * `priority` (in the order given) moves to the front, leaving every other
 * entry in its original relative order. Popup row lists are capped below
 * (buildPopup/buildRoadsTilePopup) so a feature with more properties than
 * the cap can silently lose whichever ones happen to sit later in the
 * source data's own key order - this pulls the fields that identify the
 * feature (e.g. a road's route_description/road_name) out of that lottery
 * so they always render when present, regardless of raw property order.
 */
function prioritizeEntries(entries: [string, any][], priority: string[]): [string, any][] {
  if (!priority.length) return entries
  return [...entries].sort(([ka], [kb]) => {
    const pa = priority.indexOf(ka)
    const pb = priority.indexOf(kb)
    if (pa === -1 && pb === -1) return 0
    if (pa === -1) return 1
    if (pb === -1) return -1
    return pa - pb
  })
}

// ── Roads-tile click-to-inspect ─────────────────────────────────────
// The PMTiles roads layer paints to canvas, so unlike renderRoads() above
// there's no per-feature DOM element to bindPopup() to. protomaps-leaflet
// exposes queryTileFeaturesDebug(lng, lat) on the layer instance for point
// hit-testing instead (confirmed against protomaps-leaflet 5.1.0's type
// defs - double check if your installed version differs). Note the
// lng/lat argument order, which is reversed from Leaflet's lat/lng.
//
// It can legitimately return more than one feature at a point (e.g. two
// separate KRB records that trace the same physical corridor under
// different classifications) - all matches are shown stacked rather than
// silently picking one, so that's visible in the app instead of only
// showing up when inspecting the tiles externally.
const ROADS_TILE_HIDDEN = new Set(['key', 'OBJECTID'])
const ROADS_TILE_LABELS: Record<string, string> = {
  RID_8: 'Road Number',
  road_class: 'Road Class',
  road_agency: 'Road Agency',
  route_description: 'Route',
  road_name: 'Local Name',
  aggregate_surface_type: 'Surface Type',
  aggregate_surface_type_b: 'Surface Type (detail)',
  surface_condition: 'Surface Condition (first record)',
  worst_condition: 'Worst Condition',
  pct_poor: '% Segments Poor',
  county: 'County',
  Length_km: 'Geometry Length (km)',   // from the shapefile geometry itself
  length_km: 'Survey Length (km)',     // summed from RICS - the two won't always match exactly
}
// Always shown on a clicked road, regardless of where they land in the
// tile's own property order - see prioritizeEntries().
const ROADS_TILE_PRIORITY = ['route_description', 'road_name']

function buildRoadsTilePopup(picked: { feature: any; layerName: string }[]): string {
  const cards = picked.slice(0, 5).map((pf, idx) => {
    const p = pf.feature.props || {}
    const title = p.RID_8 || p.key || p.road_name || `Feature ${idx + 1}`
    const condition = p.worst_condition
    const badge = condition
      ? `<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:10px;font-size:9px;font-weight:700;color:#fff;background:${conditionColorFor(condition)}">${escape(condition)}</span>`
      : ''
    const rows = prioritizeEntries(
      Object.entries(p).filter(([k, v]) => v !== null && v !== undefined && v !== '' && !ROADS_TILE_HIDDEN.has(k)),
      ROADS_TILE_PRIORITY,
    )
      .slice(0, 12)
      .map(([k, v], i) => {
        const label = ROADS_TILE_LABELS[k] ?? k.replace(/_/g, ' ')
        return `
        <tr style="${i % 2 === 0 ? POPUP_ROW_EVEN : POPUP_ROW_ODD}">
          <td style="${POPUP_CELL_L}">${escape(label)}</td>
          <td style="${POPUP_CELL_R}">${escape(formatValue(v))}</td>
        </tr>`
      }).join('')
    return `
      <div style="${idx > 0 ? 'border-top:1px solid #e2e8f0' : ''}">
        ${picked.length > 1 ? `<div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;background:#f1f5f9;padding:5px 12px">Feature ${idx + 1} of ${picked.length}</div>` : ''}
        <div style="font-size:12px;font-weight:600;color:#1e293b;padding:7px 12px 2px">${escape(String(title))}${badge}</div>
        <table style="border-collapse:collapse;width:100%">${rows}</table>
      </div>`
  }).join('')
  return `<div style="${POPUP_WRAP}">${cards}</div>`
}

function handleRoadsTileClick(e: any) {
  if (!roadsTileLayer || !L) return // no-op until the roads PMTiles layer exists
  let picked: { feature: any; layerName: string }[] = []
  try {
    const byLayer = roadsTileLayer.queryTileFeaturesDebug(e.latlng.lng, e.latlng.lat)
    for (const arr of byLayer.values()) picked.push(...arr.filter((pf: any) => pf.layerName === 'roads'))
  } catch (err) {
    console.debug('[UaptsMap] roads tile feature query failed', err)
    return
  }
  if (!picked.length) return
  L.popup({ maxWidth: 300, minWidth: 210 })
    .setLatLng(e.latlng)
    .setContent(buildRoadsTilePopup(picked))
    .openOn(mapRef.value)
  emit('feature-click', { layer: 'roads-tiles', feature: picked[0].feature })
}

// ── Rail-tile click-to-inspect ───────────────────────────────────────
// Same technique as handleRoadsTileClick above - protomaps-leaflet paints
// to canvas, so hit-testing goes through queryTileFeaturesDebug() rather
// than a per-feature DOM binding.
const RAILS_TILE_HIDDEN = new Set(['adm0_pcode', 'adm0_name']) // always KEN/Kenya - not worth repeating per feature
const RAILS_TILE_LABELS: Record<string, string> = {
  name: 'Name',
  name_latin: 'Name (Latin)',
  railway: 'Type',
  layer: 'Layer (bridge/tunnel stacking)',
  id: 'OSM ID',
  adm1_name: 'County',
  adm2_name: 'Sub-County',
  addr_city: 'City',
}

function buildRailsTilePopup(picked: { feature: any; layerName: string }[]): string {
  const cards = picked.slice(0, 5).map((pf, idx) => {
    const p = pf.feature.props || {}
    const title = p.name || (p.railway === 'station' ? 'Station' : 'Rail line')
    const badge = p.railway
      ? `<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:10px;font-size:9px;font-weight:700;color:#fff;background:${p.railway === 'station' ? RAIL_COLOR : '#1e293b'}">${escape(p.railway)}</span>`
      : ''
    const rows = Object.entries(p)
      .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !RAILS_TILE_HIDDEN.has(k))
      .slice(0, 12)
      .map(([k, v], i) => {
        const label = RAILS_TILE_LABELS[k] ?? k.replace(/_/g, ' ')
        return `
        <tr style="${i % 2 === 0 ? POPUP_ROW_EVEN : POPUP_ROW_ODD}">
          <td style="${POPUP_CELL_L}">${escape(label)}</td>
          <td style="${POPUP_CELL_R}">${escape(formatValue(v))}</td>
        </tr>`
      }).join('')
    return `
      <div style="${idx > 0 ? 'border-top:1px solid #e2e8f0' : ''}">
        ${picked.length > 1 ? `<div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;background:#f1f5f9;padding:5px 12px">Feature ${idx + 1} of ${picked.length}</div>` : ''}
        <div style="font-size:12px;font-weight:600;color:#1e293b;padding:7px 12px 2px">${escape(String(title))}${badge}</div>
        <table style="border-collapse:collapse;width:100%">${rows}</table>
      </div>`
  }).join('')
  return `<div style="${POPUP_WRAP}">${cards}</div>`
}

function handleRailsTileClick(e: any) {
  if (!railsTileLayer || !L) return // no-op until the rail PMTiles layer exists
  let picked: { feature: any; layerName: string }[] = []
  try {
    const byLayer = railsTileLayer.queryTileFeaturesDebug(e.latlng.lng, e.latlng.lat)
    for (const arr of byLayer.values()) picked.push(...arr.filter((pf: any) => pf.layerName === 'railways'))
  } catch (err) {
    console.debug('[UaptsMap] rail tile feature query failed', err)
    return
  }
  if (!picked.length) return
  L.popup({ maxWidth: 300, minWidth: 210 })
    .setLatLng(e.latlng)
    .setContent(buildRailsTilePopup(picked))
    .openOn(mapRef.value)
  emit('feature-click', { layer: 'rails-tiles', feature: picked[0].feature })
}

// ── Catalogue layer toggles ─────────────────────────────────────────
function toggleLayer(key: string) {
  const s = layerStates.value.find(x => x.key === key)
  if (!s || !s.instance || !mapRef.value) return
  s.visible = !s.visible
  if (s.visible) s.instance.addTo(mapRef.value)
  else mapRef.value.removeLayer(s.instance)
}

// ── Basemap switching ────────────────────────────────────────────────
function createBaseLayer(Lc: any, key: 'light' | 'dark' | 'satellite'): any {
  const spec = BASEMAP_CATALOG[key] ?? BASEMAP_CATALOG.light
  return Lc.tileLayer(spec.url, spec.options)
}

function setBasemap(Lc: any, key: 'light' | 'dark' | 'satellite') {
  if (!mapRef.value) return
  if (baseLayer) mapRef.value.removeLayer(baseLayer)
  baseLayer = createBaseLayer(Lc, key)
  baseLayer.addTo(mapRef.value)
  currentBasemap.value = key
}

async function cycleBasemap() {
  const order: Array<'light' | 'dark' | 'satellite'> = ['light', 'dark', 'satellite']
  const next = order[(order.indexOf(currentBasemap.value) + 1) % order.length]
  const Lc = await getLeaflet()
  if (Lc) setBasemap(Lc, next)
  emit('update:basemap', next) // lets a v-model-bound parent (e.g. for URL-state sync) stay in sync
}

// ── Viewport reporting ──────────────────────────────────────────────
// Fired on every Leaflet moveend so a parent can scope its own fetches
// (useGis().routes/roads/mapOverview all already accept a bbox) to
// whatever's actually in view, instead of always loading a fixed extent.
function emitBoundsChange() {
  if (!mapRef.value) return
  const b = mapRef.value.getBounds()
  const c = mapRef.value.getCenter()
  emit('bounds-change', {
    bbox: [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()],
    zoom: mapRef.value.getZoom(),
    center: [c.lat, c.lng],
  })
}

// ── Fullscreen ──────────────────────────────────────────────────────
// Note: iOS Safari historically only supports the Fullscreen API on
// <video> elements, not arbitrary containers - the button is a graceful
// no-op there rather than an error.
function onFullscreenChange() {
  isFullscreen.value = !!(document.fullscreenElement || (document as any).webkitFullscreenElement)
  // The container just resized outside Vue's control; Leaflet needs an
  // explicit nudge or it keeps painting the old viewport size.
  requestAnimationFrame(() => mapRef.value?.invalidateSize())
}

function toggleFullscreen() {
  const el = mapWrapperEl.value as any
  if (!el) return
  const current = document.fullscreenElement || (document as any).webkitFullscreenElement
  if (!current) {
    const request = el.requestFullscreen || el.webkitRequestFullscreen
    request?.call(el)?.catch?.(() => {})
  } else {
    const exit = document.exitFullscreen || (document as any).webkitExitFullscreen
    exit?.call(document)?.catch?.(() => {})
  }
}

// ── Locate me ───────────────────────────────────────────────────────
// Plain Leaflet geolocation - no plugin needed for a simple "centre on
// me" action.
function locateMe() {
  if (!mapRef.value) return
  locateStatus.value = 'locating'
  mapRef.value.locate({ setView: true, maxZoom: 15, enableHighAccuracy: true })
}

function onLocationFound(e: any) {
  locateStatus.value = 'found'
  if (!mapRef.value || !L) return
  if (locateMarkerGroup) mapRef.value.removeLayer(locateMarkerGroup)
  locateMarkerGroup = L.layerGroup([
    L.circle(e.latlng, { radius: e.accuracy, color: '#3b82f6', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.08 }),
    L.circleMarker(e.latlng, { radius: 7, color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 })
      .bindPopup('<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:12px;font-weight:600;padding:2px 4px">You are here</div>'),
  ]).addTo(mapRef.value)
}

function onLocationError() {
  locateStatus.value = 'error'
}

// ── Reset view ──────────────────────────────────────────────────────
function resetView() {
  if (!mapRef.value || !homeView) return
  if ('bbox' in homeView) {
    const [s, w, n, e] = homeView.bbox
    mapRef.value.fitBounds([[s, w], [n, e]], { padding: [20, 20] })
  } else {
    mapRef.value.setView(homeView.center, homeView.zoom)
  }
}

// ── Parent-facing navigation (template ref) ─────────────────────────
function flyTo(lat: number, lon: number, zoom?: number) {
  if (!mapRef.value) return
  mapRef.value.flyTo([lat, lon], zoom ?? mapRef.value.getZoom())
}

function fitBounds(bbox: [number, number, number, number], opts?: { padding?: [number, number] }) {
  if (!mapRef.value) return
  const [s, w, n, e] = bbox
  mapRef.value.fitBounds([[s, w], [n, e]], { padding: opts?.padding ?? [24, 24] })
}

function getMap() {
  return mapRef.value
}

defineExpose({ flyTo, fitBounds, getMap })

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

  setBasemap(Lc, currentBasemap.value)
  Lc.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map)

  // Initial view: bbox wins, otherwise center/zoom. Remembered as the
  // "home" view for the toolbar's reset-view button.
  if (props.initialBbox && props.initialBbox.length === 4) {
    const [s, w, n, e] = props.initialBbox
    map.fitBounds([[s, w], [n, e]], { padding: [20, 20] })
    homeView = { bbox: props.initialBbox }
  } else {
    map.setView(props.center, props.zoom)
    homeView = { center: props.center, zoom: props.zoom }
  }

  map.on('moveend', emitBoundsChange)
  map.on('locationfound', onLocationFound)
  map.on('locationerror', onLocationError)
  map.on('click', handleRoadsTileClick) // no-op until the roads PMTiles layer exists; see handleRoadsTileClick
  // NOTE: two independent canvas-hit-test handlers means that at a point
  // where a road and a rail line coincide (a level crossing, essentially
  // by definition), whichever handler finds a feature LAST wins the
  // popup - the other's result is silently discarded rather than shown
  // alongside it. Narrow edge case today since this is the first second
  // PMTiles layer added; worth a combined query if a third one ever
  // shows up here too.
  map.on('click', handleRailsTileClick) // no-op until the rail PMTiles layer exists; see handleRailsTileClick
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  emitBoundsChange() // give the parent an initial reading before any user interaction

  // Render - both modes are independent and can be combined.
  await renderAllCatalogLayers(Lc)
  renderBoundary(Lc)
  renderRoads(Lc)
  await renderRoadsTiles()
  await renderRailsTiles()
  renderRoutes(Lc)
  renderLines(Lc)
  renderMarkers(Lc)
  renderArrows(Lc)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
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
    props.layers, props.roadsTilesUrl, props.roadsClassFilter, props.roadsConditionFilter,
    props.roadsAgencyFilter, props.roadsCountyFilter,
    props.railsTilesUrl,
  ],
  async () => {
    if (!mapRef.value) return
    // Tear down existing layer instances.
    for (const s of layerStates.value) {
      if (s.instance) mapRef.value.removeLayer(s.instance)
    }
    layerStates.value = []
    selectedCountyLayer.value = null
    roadsTileLayer = null
    railsTileLayer = null
    const Lc = await getLeaflet()
    if (!Lc) return
    await renderAllCatalogLayers(Lc)
    renderBoundary(Lc)
    renderRoads(Lc)
    await renderRoadsTiles()
    await renderRailsTiles()
    renderRoutes(Lc)
    renderLines(Lc)
    renderMarkers(Lc)
    renderArrows(Lc)
  },
  // No `deep: true`: the getter's own reactive dependencies (each prop
  // access below) already trigger this on wholesale reassignment, which
  // is the only kind of change these props ever undergo - the parent
  // always swaps in a brand-new object/array, never mutates one in
  // place. Deep-diffing multi-thousand-coordinate GeoJSON on every tick
  // for a case that can't happen was pure overhead.
)

// Basemap can be driven externally (v-model from a parent doing e.g.
// URL-state sync) as well as from the toolbar's own cycle button, so
// keep the internal ref in sync when the prop changes out from under us.
watch(() => props.basemap, async (v) => {
  if (!v || v === currentBasemap.value) return
  const Lc = await getLeaflet()
  if (Lc) setBasemap(Lc, v)
})

const legendItems = computed(() => layerStates.value.filter(s => s.key !== 'kenya' || true))
</script>

<template>
  <div ref="mapWrapperEl" class="uapts-map-wrapper" :style="{ height: props.height }">
    <div ref="mapEl" class="uapts-map" />

    <!-- Top-right stack: opt-in toolbar sits above the layer-catalog
         toggle UI so the two never overlap if a caller enables both. -->
    <div class="uapts-topright-stack">
      <div v-if="props.showMapToolbar" class="uapts-toolbar" role="toolbar" aria-label="Map controls">
        <button
          type="button" class="uapts-toolbar-btn"
          :aria-label="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
          :title="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
          @click="toggleFullscreen"
        >
          <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 4v4a1 1 0 01-1 1H4M15 4v4a1 1 0 001 1h4M20 15h-4a1 1 0 00-1 1v4M4 15h4a1 1 0 011 1v4"/>
          </svg>
        </button>
        <button
          type="button" class="uapts-toolbar-btn" :class="{ 'is-active': locateStatus === 'locating' }"
          aria-label="Find my location" title="Find my location"
          @click="locateMe"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v3M12 19v3M22 12h-3M5 12H2"/>
          </svg>
        </button>
        <button
          type="button" class="uapts-toolbar-btn"
          aria-label="Reset view" title="Reset view"
          @click="resetView"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 11.5L12 4l8 7.5M6 10v9a1 1 0 001 1h3v-5h4v5h3a1 1 0 001-1v-9"/>
          </svg>
        </button>
        <button
          type="button" class="uapts-toolbar-btn uapts-toolbar-btn--basemap"
          :aria-label="`Basemap: ${currentBasemap}. Tap to switch.`" :title="`Basemap: ${currentBasemap} (tap to switch)`"
          @click="cycleBasemap"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3L3 8l9 5 9-5-9-5z"/>
            <path d="M3 13l9 5 9-5"/>
          </svg>
        </button>
      </div>

      <!-- Layer-catalog toggle UI -->
      <div v-if="props.showLayerControl" class="uapts-layer-control">
        <div class="uapts-layer-control-title">Map Layers</div>
        <div
          v-for="s in layerStates"
          :key="s.key"
          class="uapts-layer-row"
          :class="{ active: s.visible }"
        >
          <button class="uapts-layer-toggle" :aria-pressed="s.visible" @click="toggleLayer(s.key)">
            <span class="uapts-layer-dot" :style="{ background: s.color }"></span>
            <span class="uapts-layer-label">
              <span class="uapts-layer-name">{{ s.label }}</span>
            </span>
            <span class="uapts-layer-count">{{ s.count.toLocaleString() }}</span>
          </button>
        </div>
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

/* Top-right overlays (toolbar + catalogue layer control) share one
   absolutely-positioned flex stack so enabling both never overlaps
   them - each is just a normal flex child inside it. */
.uapts-topright-stack {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none; /* empty when neither child renders - don't eat map drags */
}

.uapts-toolbar,
.uapts-layer-control,
.uapts-legend {
  pointer-events: auto;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.94);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  backdrop-filter: blur(8px);
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
.uapts-layer-control,
.uapts-legend {
  padding: 10px 12px;
  min-width: 200px;
  max-width: 260px;
}
.uapts-legend {
  position: absolute;
  /* Leaflet's native zoom control sits top-left by default; clear it
     rather than sitting directly underneath it. */
  top: 76px;
  left: 12px;
}

.uapts-toolbar {
  display: flex;
  gap: 2px;
  padding: 4px;
}
.uapts-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.uapts-toolbar-btn svg { width: 16px; height: 16px; }
.uapts-toolbar-btn:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
.uapts-toolbar-btn:focus-visible { outline: 2px solid #60a5fa; outline-offset: 1px; }
.uapts-toolbar-btn.is-active {
  color: #60a5fa;
  animation: uapts-toolbar-pulse 1.1s ease-in-out infinite;
}
@keyframes uapts-toolbar-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
}
@media (prefers-reduced-motion: reduce) {
  .uapts-toolbar-btn.is-active { animation: none; }
}

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