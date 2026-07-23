<template>
  <PageHeader
    eyebrow="GIS & Spatial Analysis"
    title="GIS Explorer"
    subtitle="KeNHA · KURA · KeRRA · KRB · KRC · KPA · KMA · KAA · NCTTCA - National road network, PT routes, rail lines, port infrastructure, and UAPTS spatial layers"
  >
    <template #actions>
      <button class="btn btn-ghost" type="button" @click="copyShareLink">
        {{ copyLinkStatus === 'copied' ? '✓ Link copied' : copyLinkStatus === 'error' ? 'Copy failed' : '⚲ Copy link' }}
      </button>
      <button class="btn" :disabled="loading" @click="load">↻ Reload Layers</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">
    <span>⚠ {{ error }}</span>
    <button type="button" class="error-dismiss" aria-label="Dismiss" @click="error = null">×</button>
  </div>

  <div class="gis-workspace">

    <!-- ── Left control panel ─────────────────────────────────────── -->
    <aside class="gis-panel">

      <!-- Search -->
      <div v-if="layers.boundary && adminLevel !== 0" class="panel-section panel-search">
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <path d="M21 21l-4.3-4.3"/>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Jump to a county or constituency…"
            role="combobox"
            aria-controls="gis-search-listbox"
            :aria-expanded="searchOpen && searchResults.length > 0"
            @focus="searchOpen = true"
            @blur="onSearchBlur"
            @keydown="onSearchKeydown"
          />
          <button v-if="searchQuery" type="button" class="search-clear" aria-label="Clear search" @mousedown.prevent="searchQuery = ''">×</button>
        </div>
        <ul v-if="searchOpen && searchResults.length" id="gis-search-listbox" role="listbox" class="search-results">
          <li
            v-for="(r, i) in searchResults" :key="r.id"
            role="option" :aria-selected="i === searchActiveIndex"
            class="search-result-row" :class="{ active: i === searchActiveIndex }"
            @mousedown.prevent="selectSearchResult(r)"
          >
            <span class="search-result-kind">{{ r.kind }}</span>
            <span class="search-result-name">{{ r.name }}</span>
          </li>
        </ul>
        <div v-else-if="searchOpen && searchQuery && !searchResults.length" class="search-empty">
          No matches in the loaded boundary layer.
        </div>
      </div>

      <!-- Layers -->
      <div class="panel-section">
        <div class="panel-section-title">Map Layers</div>

        <button type="button" class="layer-row" role="switch" :aria-checked="layers.boundary" @click="toggleLayer('boundary')">
          <span class="layer-swatch" :style="{ background: layers.boundary ? '#818cf8' : '#334155' }" aria-hidden="true" />
          <span class="layer-name" :class="{ 'layer-dim': !layers.boundary }">Kenya Boundary</span>
          <div class="layer-switch" :class="{ on: layers.boundary }" aria-hidden="true"><span class="layer-thumb" /></div>
        </button>

        <button type="button" class="layer-row" role="switch" :aria-checked="layers.roads" @click="toggleLayer('roads')">
          <span class="layer-swatch" :style="{ background: layers.roads ? '#f59e0b' : '#334155' }" aria-hidden="true" />
          <span class="layer-name" :class="{ 'layer-dim': !layers.roads }">Road Network</span>
          <span v-if="roadCount" class="layer-badge">{{ fmtNum(roadCount) }}</span>
          <div class="layer-switch" :class="{ on: layers.roads }" aria-hidden="true"><span class="layer-thumb" /></div>
        </button>
        <div v-if="layerErrors.boundary" class="layer-error">⚠ {{ layerErrors.boundary }}</div>

        <button type="button" class="layer-row" role="switch" :aria-checked="layers.routes" @click="toggleLayer('routes')">
          <span class="layer-swatch" :style="{ background: layers.routes ? '#34d399' : '#334155' }" aria-hidden="true" />
          <span class="layer-name" :class="{ 'layer-dim': !layers.routes }">PT Routes</span>
          <span v-if="routeCount" class="layer-badge">{{ fmtNum(routeCount) }}</span>
          <div class="layer-switch" :class="{ on: layers.routes }" aria-hidden="true"><span class="layer-thumb" /></div>
        </button>
        <div v-if="layerErrors.routes" class="layer-error">⚠ {{ layerErrors.routes }}</div>
      </div>

      <!-- Additional spatial layers (GeoJSON catalog - fetched/rendered by UaptsMap itself) -->
      <div class="panel-section">
        <div class="panel-section-title">Additional Spatial Layers</div>
        <button
          v-for="c in CATALOG_LAYER_LIST" :key="c.key"
          type="button" class="layer-row" role="switch" :aria-checked="catalogLayers[c.key]"
          @click="toggleCatalogLayer(c.key)"
        >
          <span class="layer-swatch" :style="{ background: catalogLayers[c.key] ? c.color : '#334155' }" aria-hidden="true" />
          <span class="layer-name" :class="{ 'layer-dim': !catalogLayers[c.key] }">{{ c.label }}</span>
          <div class="layer-switch" :class="{ on: catalogLayers[c.key] }" aria-hidden="true"><span class="layer-thumb" /></div>
        </button>
        <div class="source-note">Counts for these layers show in the map's own legend overlay.</div>
      </div>

      <!-- County detail level (shown when boundary is on) -->
      <div v-if="layers.boundary" class="panel-section">
        <div class="panel-section-title">Boundary Detail</div>
        <div class="admin-level-group">
          <button
            v-for="opt in adminLevelOptions" :key="opt.value"
            class="admin-level-btn"
            :class="{ active: adminLevel === opt.value }"
            @click="setAdminLevel(opt.value)"
          >{{ opt.label }}</button>
        </div>
        <div v-if="selectedCounty" class="selected-county">
          <span class="selected-county-dot" />
          {{ selectedCounty }}
        </div>
      </div>

      <!-- Filters (shown contextually) -->
      <div v-if="layers.roads" class="panel-section">
        <div class="panel-section-title">Road Filter</div>
        <select v-model="highwayFilter" class="panel-select" @change="reloadRoads">
          <option value="">All highway types</option>
          <option value="trunk">Trunk roads</option>
          <option value="primary">Primary roads</option>
          <option value="secondary">Secondary roads</option>
          <option value="tertiary">Tertiary roads</option>
          <option value="unclassified">Unclassified</option>
        </select>
      </div>

      <div v-if="layers.routes" class="panel-section">
        <div class="panel-section-title">Route Service Type</div>
        <select v-model="serviceTypeFilter" class="panel-select" @change="reloadRoutes">
          <option value="">All service types</option>
          <option value="bus">Bus</option>
          <option value="brt">BRT (Rapid Transit)</option>
          <option value="matatu">Matatu</option>
          <option value="rail">Rail</option>
          <option value="ferry">Ferry</option>
        </select>
      </div>

      <!-- Detail level -->
      <div class="panel-section">
        <div class="panel-section-title">
          Detail Level
          <span class="detail-label">{{ detailLabel }}</span>
        </div>
        <input
          type="range" v-model.number="simplify"
          min="0.001" max="0.05" step="0.005"
          class="detail-slider"
          @change="load"
        />
        <div class="detail-hints">
          <span>High</span>
          <span>Med</span>
          <span>Fast</span>
        </div>
      </div>

      <!-- Road legend -->
      <div v-if="layers.roads" class="panel-section">
        <div class="panel-section-title">Road Classification</div>
        <div class="legend-list">
          <div v-for="l in roadLegend" :key="l.label" class="legend-row">
            <span class="legend-line" :style="{ background: l.color, height: l.weight + 'px' }" />
            <span class="legend-text">{{ l.label }}</span>
            <span class="legend-agency">{{ l.agency }}</span>
          </div>
        </div>
      </div>

      <!-- Route legend -->
      <div v-if="layers.routes" class="panel-section">
        <div class="panel-section-title">Route Service Types</div>
        <div class="legend-list">
          <div v-for="l in routeLegend" :key="l.label" class="legend-row">
            <span class="legend-dash" :style="{ background: l.color }" />
            <span class="legend-text">{{ l.label }}</span>
          </div>
        </div>
      </div>

      <!-- Feature stats -->
      <div class="panel-section panel-stats">
        <div class="panel-section-title">Loaded Features</div>
        <div class="stat-row">
          <span class="stat-dot" :style="{ background: boundary ? '#818cf8' : '#334155' }" />
          <span class="stat-label">Boundary</span>
          <span class="stat-val" :class="{ 'stat-ok': !!boundary, 'stat-off': !boundary }">
            {{ boundary ? 'Loaded' : 'Off' }}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-dot" :style="{ background: roadCount ? '#f59e0b' : '#334155' }" />
          <span class="stat-label">Road segments</span>
          <span class="stat-val" :class="{ 'stat-ok': !!roadCount }">{{ fmtNum(roadCount) }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-dot" :style="{ background: routeCount ? '#34d399' : '#334155' }" />
          <span class="stat-label">PT routes</span>
          <span class="stat-val" :class="{ 'stat-ok': !!routeCount }">{{ fmtNum(routeCount) }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-dot" :style="{ background: activeCatalogKeys.length ? '#3b82f6' : '#334155' }" />
          <span class="stat-label">Additional layers</span>
          <span class="stat-val" :class="{ 'stat-ok': activeCatalogKeys.length > 0 }">{{ activeCatalogKeys.length }} on</span>
        </div>
        <div class="stat-total">
          {{ fmtNum(featureCount) }} total features
        </div>
      </div>

      <!-- Agency footer -->
      <div class="panel-footer">
        <div class="panel-footer-title">Data Sources</div>
        <div class="agency-chips">
          <span class="agency-chip">KeNHA</span>
          <span class="agency-chip">KURA</span>
          <span class="agency-chip">KeRRA</span>
          <span class="agency-chip">KRB</span>
          <span class="agency-chip">KRC</span>
          <span class="agency-chip">KPA</span>
          <span class="agency-chip">KMA</span>
          <span class="agency-chip">KAA</span>
          <span class="agency-chip">NCTTCA</span>
        </div>
      </div>
    </aside>

    <!-- ── Map ─────────────────────────────────────────────────────── -->
    <div class="gis-map-col">
      <div class="gis-map-wrap">
        <ClientOnly>
          <UaptsMap
            ref="mapComponentRef"
            :boundary="layers.boundary ? boundary : undefined"
            :roads="layers.roads ? roads : undefined"
            :lines="layers.routes ? routeLines : undefined"
            :layers="activeCatalogKeys"
            :show-legend="activeCatalogKeys.length > 0"
            :center="[-0.5, 37.5]"
            :zoom="6"
            :height="mapHeight"
            @feature-click="handleFeatureClick"
          />
          <template #fallback>
            <div class="map-placeholder" :style="{ height: mapHeight }">
              <div class="map-placeholder-inner">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7"/>
                </svg>
                <span>Initialising map…</span>
              </div>
            </div>
          </template>
        </ClientOnly>

        <!-- Loading overlay -->
        <div v-if="loading" class="map-loading-overlay">
          <div class="map-loading-pill">
            <span class="loading-spinner" />
            Loading layers…
          </div>
        </div>
      </div>

      <!-- Status bar -->
      <div class="map-statusbar">
        <span class="statusbar-item">
          <span class="statusbar-dot" :class="loading ? 'loading' : 'ready'" />
          {{ loading ? 'Loading…' : 'Ready' }}
        </span>
        <span class="statusbar-sep" />
        <span class="statusbar-item">{{ fmtNum(featureCount) }} features</span>
        <span v-if="layers.roads" class="statusbar-sep" />
        <span v-if="layers.roads" class="statusbar-item">
          Roads: {{ highwayFilter || 'All types' }}
        </span>
        <span v-if="layers.routes" class="statusbar-sep" />
        <span v-if="layers.routes" class="statusbar-item">
          Routes: {{ serviceTypeFilter || 'All services' }}
        </span>
        <span class="statusbar-spacer" />
        <span v-if="selectedCounty" class="statusbar-item statusbar-county">
          <span class="statusbar-dot ready" />{{ selectedCounty }}
        </span>
        <span v-if="selectedCounty" class="statusbar-sep" />
        <span class="statusbar-item statusbar-dim">Detail: {{ detailLabel }}</span>
        <span class="statusbar-sep" />
        <span class="statusbar-item statusbar-dim">UAPTS GIS · M17</span>
      </div>
    </div>
  </div>

  <!-- ── Tabular feature registry - independent of map rendering ────── -->
  <!-- Always rendered (not gated on the map/ClientOnly above) so the page
       stays useful if Leaflet fails to load. -->
  <div class="two-col" style="margin-top:16px">
    <div v-if="layers.roads" class="card">
      <div class="card-header">Road Segments ({{ roadCount }})</div>
      <div class="card-body table-scroll" style="max-height:360px;overflow-y:auto">
        <table>
          <thead><tr><th>Name</th><th>Highway Type</th><th>Feature ID</th></tr></thead>
          <tbody v-if="roadFeatureRows.length">
            <tr v-for="r in roadFeatureRows" :key="r.id">
              <td style="font-weight:600;font-size:12px">{{ r.name }}</td>
              <td><BadgePill variant="info">{{ r.highway }}</BadgePill></td>
              <td style="font-size:11px;color:#94a3b8;font-family:monospace">{{ r.id }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No road features loaded.' }}</td></tr></tbody>
        </table>
      </div>
    </div>

    <div v-if="layers.routes" class="card">
      <div class="card-header">PT Routes ({{ routeCount }})</div>
      <div class="card-body table-scroll" style="max-height:360px;overflow-y:auto">
        <table>
          <thead><tr><th>Name</th><th>Service Type</th><th>Feature ID</th></tr></thead>
          <tbody v-if="routeFeatureRows.length">
            <tr v-for="r in routeFeatureRows" :key="r.id">
              <td style="font-weight:600;font-size:12px">{{ r.name }}</td>
              <td><BadgePill variant="info">{{ r.serviceType }}</BadgePill></td>
              <td style="font-size:11px;color:#94a3b8;font-family:monospace">{{ r.id }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No route features loaded.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('GIS Explorer')

import { useGis } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'
import type { LineSpec } from '~/components/UaptsMap.vue'

type CatalogLayerKey = 'rail-lines' | 'rail-stations' | 'stations' | 'brt-stops' | 'congestion' | 'weather' | 'od-flow' | 'segments'

// Matches UaptsMap.vue's own LAYER_CATALOG - kept here only for the
// toggle-row label/color, the actual fetch+render is entirely inside
// UaptsMap (catalog mode via the `:layers` prop).
const CATALOG_LAYER_LIST: { key: CatalogLayerKey; label: string; color: string }[] = [
  { key: 'rail-lines',    label: 'Rail Lines (SGR/MGR)', color: '#3b82f6' },
  { key: 'rail-stations', label: 'Rail Stations',        color: '#ef4444' },
  { key: 'stations',      label: 'Counting Stations',    color: '#10b981' },
  { key: 'brt-stops',     label: 'BRT Stops',            color: '#3b82f6' },
  { key: 'congestion',    label: 'Active Congestion',    color: '#ef4444' },
  { key: 'weather',       label: 'Weather (KMD)',        color: '#06b6d4' },
  { key: 'od-flow',       label: 'OD Trip Flows',        color: '#f59e0b' },
  { key: 'segments',      label: 'Road Segments (Infra)', color: '#64748b' },
]

const boundary   = ref<GeoJSONFeatureCollection | null>(null)
const roads      = ref<GeoJSONFeatureCollection | null>(null)
const gisRoutes  = ref<GeoJSONFeatureCollection | null>(null)
const loading    = ref(true)
const error      = ref<string | null>(null)
// Per-layer soft errors (e.g. routes failed but boundary loaded fine) -
// shown inline next to the relevant control instead of blocking the page.
const layerErrors = ref<Record<string, string>>({})

const simplify          = ref(0.01)
const highwayFilter     = ref('')
const serviceTypeFilter = ref('')
const adminLevel        = ref<0 | 1 | 2>(1)   // 0=country, 1=counties, 2=constituencies

// Highlighted county name (set via feature-click emit from UaptsMap)
const selectedCounty = ref<string | null>(null)

const layers = ref({ boundary: true, roads: true, routes: false })
const catalogLayers = ref<Record<CatalogLayerKey, boolean>>({
  'rail-lines': false, 'rail-stations': false, stations: false, 'brt-stops': false,
  congestion: false, weather: false, 'od-flow': false, segments: false,
})
const activeCatalogKeys = computed(() =>
  (Object.keys(catalogLayers.value) as CatalogLayerKey[]).filter(k => catalogLayers.value[k]),
)

const mapHeight = 'calc(100vh - 232px)'
const mapComponentRef = ref<{ flyTo: (lat: number, lon: number, zoom?: number) => void } | null>(null)

// ── URL state sync: makes the current view bookmarkable / shareable ───
const route  = useRoute()
const router = useRouter()

function hydrateFromQuery() {
  const q = route.query
  if (typeof q.layers === 'string') {
    const active = q.layers.split(',')
    layers.value.boundary = active.includes('boundary')
    layers.value.roads    = active.includes('roads')
    layers.value.routes   = active.includes('routes')
    for (const k of Object.keys(catalogLayers.value) as CatalogLayerKey[])
      catalogLayers.value[k] = active.includes(k)
  }
  if (q.admin === '0' || q.admin === '1' || q.admin === '2') adminLevel.value = Number(q.admin) as 0 | 1 | 2
  if (typeof q.hwy === 'string') highwayFilter.value = q.hwy
  if (typeof q.svc === 'string') serviceTypeFilter.value = q.svc
  const simplifyNum = Number(q.simplify)
  if (typeof q.simplify === 'string' && Number.isFinite(simplifyNum)) simplify.value = simplifyNum
}
hydrateFromQuery()

let urlSyncTimer: ReturnType<typeof setTimeout> | null = null
function scheduleUrlSync() {
  if (urlSyncTimer) clearTimeout(urlSyncTimer)
  urlSyncTimer = setTimeout(syncStateToUrl, 400)
}
function syncStateToUrl() {
  const active = [
    ...(layers.value.boundary ? ['boundary'] : []),
    ...(layers.value.roads ? ['roads'] : []),
    ...(layers.value.routes ? ['routes'] : []),
    ...activeCatalogKeys.value,
  ]
  const query: Record<string, string> = { layers: active.join(','), admin: String(adminLevel.value) }
  if (highwayFilter.value) query.hwy = highwayFilter.value
  if (serviceTypeFilter.value) query.svc = serviceTypeFilter.value
  query.simplify = String(simplify.value)
  router.replace({ query }).catch(() => {})
}
watch(
  () => [layers.value.boundary, layers.value.roads, layers.value.routes, activeCatalogKeys.value.join(','),
         adminLevel.value, highwayFilter.value, serviceTypeFilter.value, simplify.value],
  scheduleUrlSync,
)

const copyLinkStatus = ref<'idle' | 'copied' | 'error'>('idle')
async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copyLinkStatus.value = 'copied'
  } catch {
    copyLinkStatus.value = 'error'
  }
  setTimeout(() => { copyLinkStatus.value = 'idle' }, 1800)
}

// ── Data loading ────────────────────────────────────────────────────
// requestToken guards every async load path below against out-of-order
// responses (e.g. hitting "Reload" twice quickly) - whichever call
// started most recently "wins"; older ones drop their result on arrival.
let requestToken = 0

function describeError(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  if (typeof reason === 'string') return reason
  return 'Request failed.'
}
function setLayerError(key: string, message: string) {
  layerErrors.value = { ...layerErrors.value, [key]: message }
}
function clearLayerError(key: string) {
  if (!(key in layerErrors.value)) return
  const next = { ...layerErrors.value }
  delete next[key]
  layerErrors.value = next
}

async function load() {
  loading.value = true
  error.value   = null
  const myToken = ++requestToken
  const gis     = useGis()

  const tasks: Record<string, Promise<any>> = {
    boundary: gis.kenyaBoundary({ admin_level: adminLevel.value }),
    roads: gis.roads({ limit: 500, simplify: simplify.value, highway: highwayFilter.value || undefined }),
  }
  if (layers.value.routes)
    tasks.routes = gis.routes({ limit: 200, simplify: simplify.value, service_type: serviceTypeFilter.value || undefined })

  const keys = Object.keys(tasks)
  const settled = await Promise.allSettled(keys.map(k => tasks[k]))
  if (myToken !== requestToken) return // superseded by a newer load

  settled.forEach((result, i) => {
    const key = keys[i]
    if (result.status === 'fulfilled') {
      clearLayerError(key)
      if (key === 'boundary') boundary.value = result.value
      else if (key === 'roads') roads.value = result.value
      else if (key === 'routes') gisRoutes.value = result.value
    } else {
      setLayerError(key, describeError(result.reason))
    }
  })

  if (settled.every(r => r.status === 'rejected'))
    error.value = 'Unable to load GIS layers from the UAPTS API.'

  loading.value = false
}

async function reloadBoundary() {
  const myToken = ++requestToken
  try {
    const res = await useGis().kenyaBoundary({ admin_level: adminLevel.value })
    if (myToken !== requestToken) return
    boundary.value = res
    selectedCounty.value = null
    clearLayerError('boundary')
  } catch (err) {
    if (myToken !== requestToken) return
    setLayerError('boundary', describeError(err))
  }
}

function setAdminLevel(v: number) {
  adminLevel.value = v as 0 | 1 | 2
  reloadBoundary()
}

function handleFeatureClick({ layer, feature }: { layer: string; feature: any }) {
  if (layer === 'boundary') {
    const p = feature?.properties ?? {}
    if (p.kind === 'county' || p.kind === 'constituency') {
      selectedCounty.value = p.adm1_name || p.adm2_name || p.name || null
    }
  }
}

async function reloadRoads() {
  const myToken = ++requestToken
  try {
    const res = await useGis().roads({ limit: 500, simplify: simplify.value, highway: highwayFilter.value || undefined })
    if (myToken !== requestToken) return
    roads.value = res
    clearLayerError('roads')
  } catch (err) {
    if (myToken !== requestToken) return
    setLayerError('roads', describeError(err))
  }
}

async function reloadRoutes() {
  const myToken = ++requestToken
  try {
    const res = await useGis().routes({ limit: 200, simplify: simplify.value, service_type: serviceTypeFilter.value || undefined })
    if (myToken !== requestToken) return
    gisRoutes.value = res
    clearLayerError('routes')
  } catch (err) {
    if (myToken !== requestToken) return
    setLayerError('routes', describeError(err))
  }
}

async function toggleLayer(key: 'boundary' | 'roads' | 'routes') {
  layers.value[key] = !layers.value[key]
  if (key === 'routes' && layers.value.routes && !gisRoutes.value) await reloadRoutes()
}
function toggleCatalogLayer(key: CatalogLayerKey) {
  catalogLayers.value[key] = !catalogLayers.value[key]
}

onMounted(load)

const routeLines = computed<LineSpec[]>(() => {
  if (!gisRoutes.value) return []
  return (gisRoutes.value.features ?? []).flatMap((f: any, i: number) => {
    const coords = f.geometry?.coordinates ?? []
    if (!coords.length) return []
    const pts: [number, number][] = f.geometry.type === 'MultiLineString'
      ? coords.flat().map(([lon, lat]: [number, number]) => [lat, lon])
      : coords.map(([lon, lat]: [number, number]) => [lat, lon])
    if (pts.length < 2) return []
    return [{
      id:     f.properties?.id ?? String(i),
      points: pts,
      color:  serviceColor(f.properties?.service_type),
      weight: 2,
    }]
  })
})

const roadCount    = computed(() => roads.value?.features?.length ?? 0)
const routeCount   = computed(() => gisRoutes.value?.features?.length ?? 0)

// ── Tabular registry rows (mirrors what's plotted on the map, so the page
// stays usable if the map itself fails to render) ──────────────────────
const roadFeatureRows = computed(() =>
  (roads.value?.features ?? []).map((f: any, i: number) => ({
    id: f.id ?? f.properties?.id ?? String(i),
    name: f.properties?.name ?? f.properties?.ref ?? '(unnamed)',
    highway: (f.properties?.highway ?? 'unclassified').replace(/_/g, ' '),
  })),
)
const routeFeatureRows = computed(() =>
  (gisRoutes.value?.features ?? []).map((f: any, i: number) => ({
    id: f.properties?.id ?? f.id ?? String(i),
    name: f.properties?.name ?? f.properties?.route_name ?? '(unnamed)',
    serviceType: f.properties?.service_type ?? 'unknown',
  })),
)
const featureCount = computed(() =>
  (layers.value.boundary && boundary.value ? 1 : 0) +
  (layers.value.roads ? roadCount.value : 0) +
  (layers.value.routes ? routeCount.value : 0),
)

const detailLabel = computed(() => {
  if (simplify.value <= 0.005) return 'Very High'
  if (simplify.value <= 0.015) return 'High'
  if (simplify.value <= 0.030) return 'Medium'
  return 'Fast'
})

function serviceColor(s: string) {
  const m: Record<string, string> = {
    bus: '#3b82f6', brt: '#8b5cf6', matatu: '#f97316', rail: '#ef4444', ferry: '#06b6d4',
  }
  return m[s] ?? '#64748b'
}

const adminLevelOptions = [
  { value: 0, label: 'Outline' },
  { value: 1, label: 'Counties' },
  { value: 2, label: 'Constituencies' },
]

function fmtNum(v: number) { return v.toLocaleString() }

const roadLegend = [
  { label: 'Trunk',        color: '#dc2626', weight: 3, agency: 'KeNHA' },
  { label: 'Primary',      color: '#ea580c', weight: 2.5, agency: 'KeNHA' },
  { label: 'Secondary',    color: '#ca8a04', weight: 2, agency: 'KeNHA / KURA' },
  { label: 'Tertiary',     color: '#16a34a', weight: 1.5, agency: 'KeRRA / KURA' },
  { label: 'Unclassified', color: '#64748b', weight: 1, agency: 'KeRRA' },
]

const routeLegend = [
  { label: 'Bus',    color: '#3b82f6' },
  { label: 'BRT',    color: '#8b5cf6' },
  { label: 'Matatu', color: '#f97316' },
  { label: 'Rail',   color: '#ef4444' },
  { label: 'Ferry',  color: '#06b6d4' },
]

// ── County/constituency search (client-side, over the loaded boundary
// layer - `center_lat`/`center_lon` are provided per-feature by the
// backend, so "jump to" is a direct flyTo, no bbox math needed) ───────
interface SearchResult { id: string; kind: string; name: string; lat: number; lon: number }
const searchQuery = ref('')
const searchOpen = ref(false)
const searchActiveIndex = ref(-1)

const searchResults = computed<SearchResult[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q || !boundary.value) return []
  const out: SearchResult[] = []
  for (const f of boundary.value.features ?? []) {
    const p = f.properties ?? {}
    if (p.kind !== 'county' && p.kind !== 'constituency') continue
    const name = p.kind === 'county' ? p.adm1_name : p.adm2_name
    if (!name || !String(name).toLowerCase().includes(q)) continue
    if (p.center_lat == null || p.center_lon == null) continue
    out.push({ id: p.adm2_pcode || p.adm1_pcode || name, kind: p.kind, name, lat: p.center_lat, lon: p.center_lon })
    if (out.length >= 8) break
  }
  return out
})

function selectSearchResult(r: SearchResult) {
  searchQuery.value = r.name
  searchOpen.value = false
  searchActiveIndex.value = -1
  selectedCounty.value = r.name
  mapComponentRef.value?.flyTo(r.lat, r.lon, r.kind === 'county' ? 9 : 11)
}
function onSearchBlur() {
  // Delay so a click on a result (which fires @mousedown before blur) still registers.
  setTimeout(() => { searchOpen.value = false }, 150)
}
function onSearchKeydown(e: KeyboardEvent) {
  if (!searchResults.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    searchActiveIndex.value = (searchActiveIndex.value + 1) % searchResults.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    searchActiveIndex.value = searchActiveIndex.value <= 0 ? searchResults.value.length - 1 : searchActiveIndex.value - 1
  } else if (e.key === 'Enter' && searchActiveIndex.value >= 0) {
    e.preventDefault()
    selectSearchResult(searchResults.value[searchActiveIndex.value])
  } else if (e.key === 'Escape') {
    searchOpen.value = false
  }
}
</script>

<style scoped>
/* ── Layout ──────────────────────────────────────────────────────── */
.gis-workspace {
  display: grid;
  grid-template-columns: 272px 1fr;
  gap: 0;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.07);
}
@media (max-width: 900px) {
  .gis-workspace { grid-template-columns: 1fr; }
}

/* ── Left panel ──────────────────────────────────────────────────── */
.gis-panel {
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: calc(100vh - 180px);
}

.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
}

.panel-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ── Search ──────────────────────────────────────────────────────── */
.panel-search { position: relative; }
.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  background: #fff;
}
.search-icon { width: 14px; height: 14px; color: #94a3b8; flex-shrink: 0; }
.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 12px;
  color: #1e293b;
  background: transparent;
  min-width: 0;
}
.search-clear {
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}
.search-clear:hover { color: #475569; }
.search-results {
  position: absolute;
  left: 16px; right: 16px; top: 100%;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,.1);
  list-style: none;
  padding: 4px;
  z-index: 20;
  max-height: 220px;
  overflow-y: auto;
}
.search-result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.search-result-row:hover, .search-result-row.active { background: #eff6ff; }
.search-result-kind {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.search-result-name { color: #1e293b; font-weight: 500; }
.search-empty {
  position: absolute;
  left: 16px; right: 16px; top: 100%;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  color: #94a3b8;
  z-index: 20;
}

/* ── Layer rows ──────────────────────────────────────────────────── */
.layer-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.12s;
  margin-bottom: 2px;
  user-select: none;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  font: inherit;
}
.layer-row:hover { background: #f1f5f9; }

.layer-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
  transition: background 0.15s;
}

.layer-name {
  flex: 1;
  font-size: 13px;
  color: #1e293b;
  font-weight: 500;
  transition: color 0.15s;
}
.layer-dim { color: #94a3b8; }

.layer-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #e2e8f0;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.layer-error {
  font-size: 11px;
  color: #b45309;
  padding: 2px 8px 6px;
}

.source-note { margin-top: 6px; font-size: 10px; color: #94a3b8; }

/* Custom toggle switch */
.layer-switch {
  width: 32px;
  height: 18px;
  border-radius: 9px;
  background: #e2e8f0;
  border: 1.5px solid #cbd5e1;
  position: relative;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}
.layer-switch.on {
  background: #2563eb;
  border-color: #3b82f6;
}
.layer-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #94a3b8;
  transition: transform 0.15s, background 0.15s;
}
.layer-switch.on .layer-thumb {
  transform: translateX(14px);
  background: #fff;
}

/* ── Filters ─────────────────────────────────────────────────────── */
.panel-select {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  font-size: 12px;
  background: #fff;
  color: #374151;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
  cursor: pointer;
  transition: border-color 0.12s;
}
.panel-select:hover { border-color: #cbd5e1; }
.panel-select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,.12); }

/* ── Detail slider ───────────────────────────────────────────────── */
.detail-label {
  font-size: 10px;
  font-weight: 600;
  color: #2563eb;
  text-transform: none;
  letter-spacing: 0;
}

.detail-slider {
  width: 100%;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: #e2e8f0;
  outline: none;
  margin: 6px 0 4px;
  cursor: pointer;
}
.detail-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  border: 2.5px solid #3b82f6;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,.15);
}
.detail-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2.5px solid #3b82f6;
  cursor: pointer;
}

.detail-hints {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #cbd5e1;
  margin-top: 2px;
}

/* ── Legend ──────────────────────────────────────────────────────── */
.legend-list { display: flex; flex-direction: column; gap: 5px; }

.legend-row {
  display: flex;
  align-items: center;
  gap: 9px;
}

.legend-line {
  display: inline-block;
  width: 22px;
  min-height: 2px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-dash {
  display: inline-block;
  width: 22px;
  height: 2px;
  border-radius: 1px;
  flex-shrink: 0;
  border: none;
  background: currentColor;
}

.legend-text { font-size: 12px; color: #475569; flex: 1; }
.legend-agency { font-size: 10px; color: #cbd5e1; white-space: nowrap; }

/* ── Stats ───────────────────────────────────────────────────────── */
.panel-stats { flex: 1; }

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid #f1f5f9;
}

.stat-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background 0.15s;
}

.stat-label { flex: 1; font-size: 12px; color: #64748b; }

.stat-val {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}
.stat-ok  { color: #16a34a; }
.stat-off { color: #cbd5e1; }

.stat-total {
  margin-top: 8px;
  font-size: 11px;
  color: #94a3b8;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* ── Agency footer ───────────────────────────────────────────────── */
.panel-footer {
  padding: 12px 16px 16px;
  border-top: 1px solid #f1f5f9;
  margin-top: auto;
  background: #f8fafc;
}

.panel-footer-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #cbd5e1;
  margin-bottom: 8px;
}

.agency-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.agency-chip {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  background: #fff;
  color: #64748b;
  border: 1px solid #e2e8f0;
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* ── Map area ────────────────────────────────────────────────────── */
.gis-map-col {
  display: flex;
  flex-direction: column;
  background: #f1f5f9;
}

.gis-map-wrap {
  position: relative;
  flex: 1;
}

.map-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
}
.map-placeholder-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #94a3b8;
}
.map-placeholder-inner svg { color: #cbd5e1; }
.map-placeholder-inner span { font-size: 13px; }

/* Loading overlay - stays dark for contrast against map tiles */
.map-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 20px;
  pointer-events: none;
  z-index: 1000;
}
.map-loading-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(15, 23, 42, 0.82);
  color: #e2e8f0;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 20px;
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.1);
}
.loading-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Status bar ──────────────────────────────────────────────────── */
.map-statusbar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 14px;
  height: 30px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  font-size: 11px;
  color: #64748b;
  flex-shrink: 0;
}

.statusbar-item { white-space: nowrap; }
.statusbar-dim  { color: #94a3b8; }
.statusbar-sep  { width: 1px; height: 12px; background: #e2e8f0; margin: 0 10px; flex-shrink: 0; }
.statusbar-spacer { flex: 1; }

.statusbar-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
}
.statusbar-dot.ready   { background: #22c55e; }
.statusbar-dot.loading {
  background: #f59e0b;
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}

/* ── Admin level buttons ─────────────────────────────────────────── */
.admin-level-group {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.admin-level-btn {
  flex: 1;
  padding: 5px 0;
  font-size: 11px;
  font-weight: 600;
  border: 1.5px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  transition: all 0.12s;
  text-align: center;
}
.admin-level-btn:hover { border-color: #6366f1; color: #6366f1; }
.admin-level-btn.active {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
}

.selected-county {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #6366f1;
  padding: 4px 0;
}
.selected-county-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #6366f1;
  flex-shrink: 0;
}

.statusbar-county { color: #6366f1; font-weight: 600; }

/* ── Feature registry tables ─────────────────────────────────────── */
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media (max-width:900px) { .two-col { grid-template-columns:1fr; } }
.table-scroll { overflow-x:auto; }

/* ── Misc ────────────────────────────────────────────────────────── */
.error-banner {
  margin: 0 0 12px;
  padding: 10px 16px;
  border-radius: 8px;
  background: #fef9c3;
  border: 1px solid #ca8a04;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.error-dismiss {
  border: none;
  background: none;
  color: #92400e;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}
.error-dismiss:hover { color: #713f12; }
</style>
