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
      <button class="btn" :disabled="loading" @click="load({ force: true })">
        <span class="btn-icon" :class="{ spinning: loading }">↻</span> Reload Layers
      </button>
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
      <div class="panel-section panel-search">
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
            :aria-activedescendant="searchActiveIndex >= 0 ? `search-opt-${searchActiveIndex}` : undefined"
            @focus="searchOpen = true"
            @blur="searchOpen = false"
            @keydown="onSearchKeydown"
          />
          <button v-if="searchQuery" type="button" class="search-clear" aria-label="Clear search" @mousedown.prevent="searchQuery = ''">×</button>
        </div>
        <ul v-if="searchOpen && searchResults.length" id="gis-search-listbox" role="listbox" class="search-results">
          <li
            v-for="(r, i) in searchResults" :key="r.id" :id="`search-opt-${i}`"
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
        <div v-if="layerErrors.boundary" class="layer-error">⚠ {{ layerErrors.boundary }}</div>

        <button type="button" class="layer-row" role="switch" :aria-checked="layers.roads" @click="toggleLayer('roads')">
          <span class="layer-swatch" :style="{ background: layers.roads ? '#f59e0b' : '#334155' }" aria-hidden="true" />
          <span class="layer-name" :class="{ 'layer-dim': !layers.roads }">Road Network</span>
          <span v-if="layers.roads" class="layer-badge">Live</span>
          <div class="layer-switch" :class="{ on: layers.roads }" aria-hidden="true"><span class="layer-thumb" /></div>
        </button>

        <button type="button" class="layer-row" role="switch" :aria-checked="layers.railway" @click="toggleLayer('railway')">
          <span class="layer-swatch" :style="{ background: layers.railway ? '#ec4899' : '#334155' }" aria-hidden="true" />
          <span class="layer-name" :class="{ 'layer-dim': !layers.railway }">Railway</span>
          <span v-if="layers.railway" class="layer-badge">Live</span>
          <div class="layer-switch" :class="{ on: layers.railway }" aria-hidden="true"><span class="layer-thumb" /></div>
        </button>

        <button type="button" class="layer-row" role="switch" :aria-checked="layers.routes" @click="toggleLayer('routes')">
          <span class="layer-swatch" :style="{ background: layers.routes ? '#34d399' : '#334155' }" aria-hidden="true" />
          <span class="layer-name" :class="{ 'layer-dim': !layers.routes }">PT Routes</span>
          <span v-if="routeCount" class="layer-badge">{{ fmtNum(routeCount) }}</span>
          <div class="layer-switch" :class="{ on: layers.routes }" aria-hidden="true"><span class="layer-thumb" /></div>
        </button>
        <div v-if="layerErrors.routes" class="layer-error">⚠ {{ layerErrors.routes }}</div>

        <button type="button" class="layer-row" role="switch" :aria-checked="layers.stations" @click="toggleLayer('stations')">
          <span class="layer-swatch" :style="{ background: layers.stations ? '#10b981' : '#334155' }" aria-hidden="true" />
          <span class="layer-name" :class="{ 'layer-dim': !layers.stations }">Stations</span>
          <span v-if="stationCount" class="layer-badge">{{ fmtNum(stationCount) }}</span>
          <div class="layer-switch" :class="{ on: layers.stations }" aria-hidden="true"><span class="layer-thumb" /></div>
        </button>

        <button type="button" class="layer-row" role="switch" :aria-checked="layers.events" @click="toggleLayer('events')">
          <span class="layer-swatch" :style="{ background: layers.events ? '#ef4444' : '#334155' }" aria-hidden="true" />
          <span class="layer-name" :class="{ 'layer-dim': !layers.events }">Live Events</span>
          <span v-if="eventCount" class="layer-badge">{{ fmtNum(eventCount) }}</span>
          <div class="layer-switch" :class="{ on: layers.events }" aria-hidden="true"><span class="layer-thumb" /></div>
        </button>
        <div v-if="layerErrors.overview" class="layer-error">⚠ {{ layerErrors.overview }}</div>
      </div>

      <!-- Live-data viewport sync (shown once anything bbox-scoped is on) -->
      <div v-if="layers.routes || layers.stations || layers.events" class="panel-section">
        <div class="panel-section-title">Live Data</div>
        <button type="button" class="layer-row" role="switch" :aria-checked="syncToView" @click="syncToView = !syncToView">
          <span class="layer-swatch" :style="{ background: syncToView ? '#818cf8' : '#334155' }" aria-hidden="true" />
          <span class="layer-name" :class="{ 'layer-dim': !syncToView }">Sync to map view</span>
          <div class="layer-switch" :class="{ on: syncToView }" aria-hidden="true"><span class="layer-thumb" /></div>
        </button>
        <p class="section-hint">
          {{ syncToView ? 'Routes, stations and events refresh as you pan and zoom.' : 'Showing a fixed nationwide snapshot.' }}
        </p>
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
        <div class="panel-section-title">Road Class</div>
        <select v-model="roadClassFilter" class="panel-select" aria-label="Filter roads by Road Class">
          <option value="">All classes</option>
          <option value="A">A — International trunk</option>
          <option value="B">B — National trunk</option>
          <option value="C">C — Primary</option>
          <option value="D">D — Secondary</option>
          <option value="E">E — Minor</option>
          <option value="F">F</option>
          <option value="G">G — Unclassified</option>
          <option value="S">S — Special purpose</option>
        </select>
      </div>

      <div v-if="layers.roads" class="panel-section">
        <div class="panel-section-title">Road Condition</div>
        <select v-model="conditionFilter" class="panel-select" aria-label="Filter roads by Surface Condition">
          <option value="">All conditions</option>
          <option value="Poor">Poor</option>
          <option value="Fair">Fair</option>
          <option value="Good">Good</option>
          <option value="Under Construction">Under Construction</option>
        </select>
      </div>

      <div v-if="layers.roads" class="panel-section">
        <div class="panel-section-title">Road Agency</div>
        <input
          v-model="roadAgencyFilterInput"
          type="text"
          class="panel-text-input"
          placeholder="e.g. KeNHA…"
          aria-label="Filter roads by Road Agency"
        />
      </div>

      <div v-if="layers.roads" class="panel-section">
        <div class="panel-section-title">Road County</div>
        <select v-model="roadCountyFilter" class="panel-select" aria-label="Filter roads by County">
          <option value="">All counties</option>
          <option v-for="c in KENYA_COUNTIES" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <div v-if="layers.routes" class="panel-section">
        <div class="panel-section-title">Route Service Type</div>
        <select v-model="serviceTypeFilter" class="panel-select" aria-label="Filter routes by service type" @change="reloadRoutes">
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
          aria-label="Geometry detail level"
          :aria-valuetext="detailLabel"
          @change="onSimplifyChange"
        />
        <div class="detail-hints">
          <span>High</span>
          <span>Med</span>
          <span>Fast</span>
        </div>
      </div>

      <!-- Road legend -->
      <div v-if="layers.roads" class="panel-section">
        <div class="panel-section-title">Road Condition</div>
        <div class="legend-list">
          <div v-for="l in roadLegend" :key="l.label" class="legend-row">
            <span class="legend-line" :style="{ background: l.color, height: l.weight + 'px' }" />
            <span class="legend-text">{{ l.label }}</span>
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
          <span class="stat-dot" :style="{ background: layers.roads ? '#f59e0b' : '#334155' }" />
          <span class="stat-label">Road segments</span>
          <span class="stat-val" :class="{ 'stat-ok': layers.roads }">
            {{ layers.roads ? 'Streaming (PMTiles)' : 'Off' }}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-dot" :style="{ background: layers.railway ? '#ec4899' : '#334155' }" />
          <span class="stat-label">Rail network</span>
          <span class="stat-val" :class="{ 'stat-ok': layers.railway }">
            {{ layers.railway ? 'Streaming (PMTiles)' : 'Off' }}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-dot" :style="{ background: routeCount ? '#34d399' : '#334155' }" />
          <span class="stat-label">PT routes</span>
          <span class="stat-val" :class="{ 'stat-ok': !!routeCount }">{{ fmtNum(routeCount) }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-dot" :style="{ background: stationCount ? '#10b981' : '#334155' }" />
          <span class="stat-label">Stations</span>
          <span class="stat-val" :class="{ 'stat-ok': !!stationCount }">{{ fmtNum(stationCount) }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-dot" :style="{ background: eventCount ? '#ef4444' : '#334155' }" />
          <span class="stat-label">Live events</span>
          <span class="stat-val" :class="{ 'stat-ok': !!eventCount }">{{ fmtNum(eventCount) }}</span>
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
            ref="mapComponent"
            :boundary="layers.boundary ? boundary : undefined"
            :roads-tiles-url="layers.roads ? roadsTilesUrl : undefined"
            :roads-class-filter="roadClassFilter"
            :roads-condition-filter="conditionFilter"
            :roads-agency-filter="roadAgencyFilter"
            :roads-county-filter="roadCountyFilter"
            :rails-tiles-url="layers.railway ? railsTilesUrl : undefined"
            :lines="layers.routes ? routeLines : undefined"
            :markers="activeMarkers"
            :center="initialCenter"
            :zoom="initialZoom"
            :height="mapHeight"
            v-model:basemap="basemap"
            show-map-toolbar
            @feature-click="handleFeatureClick"
            @bounds-change="onBoundsChange"
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
        <span v-if="currentZoom != null" class="statusbar-sep" />
        <span v-if="currentZoom != null" class="statusbar-item statusbar-dim">Zoom {{ currentZoom.toFixed(1) }}</span>
        <span v-if="layers.roads" class="statusbar-sep" />
        <span v-if="layers.roads" class="statusbar-item">
          Roads: {{ roadClassFilter || 'All classes' }}<template v-if="conditionFilter"> · {{ conditionFilter }}</template><template v-if="roadAgencyFilter"> · {{ roadAgencyFilter }}</template><template v-if="roadCountyFilter"> · {{ roadCountyFilter }}</template>
        </span>
        <span v-if="layers.routes" class="statusbar-sep" />
        <span v-if="layers.routes" class="statusbar-item">
          Routes: {{ serviceTypeFilter || 'All services' }}
        </span>
        <span v-if="(layers.routes || layers.stations || layers.events) && syncToView" class="statusbar-sep" />
        <span v-if="(layers.routes || layers.stations || layers.events) && syncToView" class="statusbar-item statusbar-county">
          <span class="statusbar-dot ready" />Synced to view
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
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('GIS Explorer')

import { useGis } from '~/composables/api'
import type { GeoJSONFeatureCollection, LineSpec, MarkerSpec, MarkerColor } from '~/composables/api'

type LayerKey = 'boundary' | 'roads' | 'routes' | 'stations' | 'events' | 'railway'

// boundary/routes/stations/events are always replaced wholesale, never
// mutated in place (see load()/reload*() below) - shallowRef skips Vue's
// deep-reactive-proxy wrap on what can be multi-thousand-point GeoJSON
// (esp. constituency boundaries) without losing any reactivity we
// actually rely on, since we only ever watch/read `.value` itself.
const boundary     = shallowRef<GeoJSONFeatureCollection | null>(null)
const gisRoutes    = shallowRef<GeoJSONFeatureCollection | null>(null)
const stationsData = shallowRef<GeoJSONFeatureCollection | null>(null)
const eventsData   = shallowRef<GeoJSONFeatureCollection | null>(null)
// Roads are served as pre-tiled PMTiles (see apps/gis - Tier 3 pipeline),
// not fetched as GeoJSON, so there's no ref to populate and no scan-cap
// or feature-count ceiling regardless of viewport/zoom.
const roadsTilesUrl = useGis().roadsPmtilesUrl()
// Same deal as roadsTilesUrl - the physical rail network (rails.pmtiles),
// streamed as PMTiles rather than fetched as GeoJSON. Distinct from the
// `routes` layer below, which is scheduled PT service routes (including
// any tagged service_type "rail") from tbl_pt_routes, not track infra.
const railsTilesUrl = useGis().railsPmtilesUrl()
const loading    = ref(true)
const error      = ref<string | null>(null)
// Per-layer soft errors (e.g. routes failed but boundary loaded fine) -
// shown inline next to the relevant control instead of blocking the page.
const layerErrors = ref<Record<string, string>>({})

const simplify          = ref(0.01)
const roadClassFilter   = ref('')   // Road Class, e.g. "A" / "D" — see UaptsMap's roadsClassFilter prop
const conditionFilter   = ref('')   // Surface Condition, e.g. "Poor" — see roadsConditionFilter prop
// Road Agency, e.g. "KeNHA" — see roadsAgencyFilter prop (substring match).
// roadAgencyFilterInput is what the text box binds to, updating on every
// keystroke; roadAgencyFilter is the debounced value that actually drives
// the map + URL, so typing doesn't tear down/rebuild the whole roads tile
// layer (see UaptsMap's watcher) on every keystroke.
const roadAgencyFilterInput = ref('')
const roadAgencyFilter      = ref('')
let agencyFilterTimer: ReturnType<typeof setTimeout> | null = null
watch(roadAgencyFilterInput, (v) => {
  if (agencyFilterTimer) clearTimeout(agencyFilterTimer)
  agencyFilterTimer = setTimeout(() => { roadAgencyFilter.value = v.trim() }, 300)
})
// County, e.g. "Nairobi" — see roadsCountyFilter prop. Deliberately named
// apart from selectedCounty below - that one's the boundary-click
// highlight (a different feature, unrelated to this road filter).
const roadCountyFilter  = ref('')
const serviceTypeFilter = ref('')
const adminLevel        = ref<0 | 1 | 2>(1)   // 0=country, 1=counties, 2=constituencies
const basemap           = ref<'light' | 'dark' | 'satellite'>('light')
const syncToView        = ref(true)           // scope routes/stations/events to the current map view

// Highlighted county name (set via feature-click emit from UaptsMap)
const selectedCounty = ref<string | null>(null)

const layers = ref<Record<LayerKey, boolean>>({
  boundary: true, roads: true, routes: false, stations: false, events: false, railway: false,
})

const mapHeight = 'calc(100vh - 232px)'
const mapComponent = ref<any>(null)

// Current viewport, reported by UaptsMap's @bounds-change. Drives the
// bbox on routes/stations/events fetches when syncToView is on, and gets
// persisted into the URL so a copied link reopens at the same place.
const currentBbox   = shallowRef<[number, number, number, number] | null>(null)
const currentZoom   = ref<number | null>(null)
const currentCenter = shallowRef<[number, number] | null>(null)
// Seed values for <UaptsMap :center :zoom> - only read once at mount, so
// these only need to be right once (from the URL, if present).
const initialCenter = ref<[number, number]>([-0.5, 37.5])
const initialZoom   = ref(6)

// ── URL state sync: makes the current view bookmarkable / shareable ───
const route  = useRoute()
const router = useRouter()

function hydrateFromQuery() {
  const q = route.query
  if (typeof q.layers === 'string') {
    const active = q.layers.split(',')
    const known: LayerKey[] = ['boundary', 'roads', 'routes', 'stations', 'events', 'railway']
    for (const k of known) layers.value[k] = active.includes(k)
  }
  if (q.admin === '0' || q.admin === '1' || q.admin === '2') adminLevel.value = Number(q.admin) as 0 | 1 | 2
  if (typeof q.class === 'string') roadClassFilter.value = q.class
  if (typeof q.cond === 'string') conditionFilter.value = q.cond
  if (typeof q.agency === 'string') { roadAgencyFilterInput.value = q.agency; roadAgencyFilter.value = q.agency }
  if (typeof q.county === 'string') roadCountyFilter.value = q.county
  if (typeof q.svc === 'string') serviceTypeFilter.value = q.svc
  const simplifyNum = Number(q.simplify)
  if (typeof q.simplify === 'string' && Number.isFinite(simplifyNum)) simplify.value = simplifyNum
  if (q.basemap === 'light' || q.basemap === 'dark' || q.basemap === 'satellite') basemap.value = q.basemap
  if (q.sync === '0') syncToView.value = false
  const lat = Number(q.lat), lng = Number(q.lng), z = Number(q.z)
  if (Number.isFinite(lat) && Number.isFinite(lng)) initialCenter.value = [lat, lng]
  if (Number.isFinite(z)) initialZoom.value = z
}
hydrateFromQuery()

let urlSyncTimer: ReturnType<typeof setTimeout> | null = null
function scheduleUrlSync() {
  if (urlSyncTimer) clearTimeout(urlSyncTimer)
  urlSyncTimer = setTimeout(syncStateToUrl, 400)
}
function syncStateToUrl() {
  const active = (Object.keys(layers.value) as LayerKey[]).filter(k => layers.value[k])
  const query: Record<string, string> = { layers: active.join(','), admin: String(adminLevel.value) }
  if (roadClassFilter.value) query.class = roadClassFilter.value
  if (conditionFilter.value) query.cond = conditionFilter.value
  if (roadAgencyFilter.value) query.agency = roadAgencyFilter.value
  if (roadCountyFilter.value) query.county = roadCountyFilter.value
  if (serviceTypeFilter.value) query.svc = serviceTypeFilter.value
  query.simplify = String(simplify.value)
  if (basemap.value !== 'light') query.basemap = basemap.value
  if (!syncToView.value) query.sync = '0'
  if (currentCenter.value) { query.lat = currentCenter.value[0].toFixed(4); query.lng = currentCenter.value[1].toFixed(4) }
  if (currentZoom.value != null) query.z = currentZoom.value.toFixed(2)
  router.replace({ query }).catch(() => {})
}
watch(
  () => [layers.value.boundary, layers.value.roads, layers.value.routes, layers.value.stations, layers.value.events, layers.value.railway,
         adminLevel.value, roadClassFilter.value, conditionFilter.value, roadAgencyFilter.value, roadCountyFilter.value,
         serviceTypeFilter.value, simplify.value, basemap.value, syncToView.value],
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
// responses (the user pans twice quickly, toggles a layer mid-fetch, or
// hits "Reload" while a viewport refresh is in flight) - whichever call
// started most recently "wins"; older ones drop their result on arrival
// instead of clobbering fresher state.
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

async function load(opts: { force?: boolean } = {}) {
  loading.value = true
  error.value   = null
  const myToken = ++requestToken
  const gis     = useGis()
  const bbox    = syncToView.value ? (currentBbox.value ?? undefined) : undefined

  // Named tasks (not a positional array) so every result's success or
  // failure is tracked against the layer it actually belongs to - a
  // rejected routes/stations/events call can no longer go unnoticed just
  // because it wasn't sitting at a hardcoded array index.
  const tasks: Record<string, Promise<any>> = {
    boundary: gis.kenyaBoundary({ admin_level: adminLevel.value, force: opts.force }),
  }
  if (layers.value.routes) {
    tasks.routes = gis.routes({
      limit: 200, simplify: simplify.value,
      service_type: serviceTypeFilter.value || undefined,
      bbox, force: opts.force,
    })
  }
  if (layers.value.stations || layers.value.events) {
    const include = [layers.value.stations && 'stations', layers.value.events && 'events'].filter(Boolean).join(',')
    tasks.overview = gis.mapOverview({ include, bbox, force: opts.force })
  }

  const keys = Object.keys(tasks)
  const settled = await Promise.allSettled(keys.map(k => tasks[k]))
  if (myToken !== requestToken) { loading.value = false; return } // superseded by a newer load

  settled.forEach((result, i) => {
    const key = keys[i]
    if (result.status === 'fulfilled') {
      clearLayerError(key)
      if (key === 'boundary') boundary.value = result.value
      else if (key === 'routes') gisRoutes.value = result.value
      else if (key === 'overview') {
        stationsData.value = result.value.stations ?? null
        eventsData.value   = result.value.events ?? null
      }
    } else {
      setLayerError(key, describeError(result.reason))
      if (key === 'boundary') error.value = 'Unable to load the Kenya boundary layer from the UAPTS API.'
    }
  })

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

async function reloadRoutes() {
  const myToken = ++requestToken
  try {
    const bbox = syncToView.value ? (currentBbox.value ?? undefined) : undefined
    const res = await useGis().routes({ limit: 200, simplify: simplify.value, service_type: serviceTypeFilter.value || undefined, bbox })
    if (myToken !== requestToken) return
    gisRoutes.value = res
    clearLayerError('routes')
  } catch (err) {
    if (myToken !== requestToken) return
    setLayerError('routes', describeError(err))
  }
}

async function reloadOverview() {
  const include = [layers.value.stations && 'stations', layers.value.events && 'events'].filter(Boolean).join(',')
  if (!include) return
  const myToken = ++requestToken
  try {
    const bbox = syncToView.value ? (currentBbox.value ?? undefined) : undefined
    const res = await useGis().mapOverview({ include, bbox })
    if (myToken !== requestToken) return
    stationsData.value = res.stations ?? null
    eventsData.value   = res.events ?? null
    clearLayerError('overview')
  } catch (err) {
    if (myToken !== requestToken) return
    setLayerError('overview', describeError(err))
  }
}

function onSimplifyChange() {
  // Boundary geometry doesn't take a `simplify` param, so only routes
  // (the one layer that does) need to reload here - not a full load().
  if (layers.value.routes) reloadRoutes()
}

async function toggleLayer(key: LayerKey) {
  layers.value[key] = !layers.value[key]
  if (key === 'routes' && layers.value.routes && !gisRoutes.value) await reloadRoutes()
  if ((key === 'stations' || key === 'events') && layers.value[key]) {
    const needStations = layers.value.stations && !stationsData.value
    const needEvents = layers.value.events && !eventsData.value
    if (needStations || needEvents) await reloadOverview()
  }
}

// ── Viewport tracking (from UaptsMap's @bounds-change) ─────────────────
let viewportDebounceTimer: ReturnType<typeof setTimeout> | null = null

function onBoundsChange(payload: { bbox: [number, number, number, number]; zoom: number; center: [number, number] }) {
  currentBbox.value   = payload.bbox
  currentZoom.value   = payload.zoom
  currentCenter.value = payload.center
  scheduleUrlSync()

  if (viewportDebounceTimer) clearTimeout(viewportDebounceTimer)
  viewportDebounceTimer = setTimeout(() => {
    if (syncToView.value && (layers.value.routes || layers.value.stations || layers.value.events)) refreshViewportData()
  }, 500)
}

async function refreshViewportData() {
  const gis = useGis()
  const bbox = currentBbox.value ?? undefined
  const tasks: Record<string, Promise<any>> = {}
  if (layers.value.routes) {
    tasks.routes = gis.routes({ limit: 200, simplify: simplify.value, service_type: serviceTypeFilter.value || undefined, bbox })
  }
  if (layers.value.stations || layers.value.events) {
    const include = [layers.value.stations && 'stations', layers.value.events && 'events'].filter(Boolean).join(',')
    tasks.overview = gis.mapOverview({ include, bbox })
  }
  const keys = Object.keys(tasks)
  if (!keys.length) return

  const myToken = ++requestToken
  const settled = await Promise.allSettled(keys.map(k => tasks[k]))
  if (myToken !== requestToken) return // a newer viewport change (or manual load) superseded this

  settled.forEach((result, i) => {
    const key = keys[i]
    if (result.status === 'fulfilled') {
      clearLayerError(key)
      if (key === 'routes') gisRoutes.value = result.value
      else if (key === 'overview') {
        stationsData.value = result.value.stations ?? null
        eventsData.value   = result.value.events ?? null
      }
    } else {
      setLayerError(key, describeError(result.reason))
    }
  })
}

onMounted(load)

// ── Derived render data for <UaptsMap> ───────────────────────────────
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

const STATION_MODE_COLOR: Record<string, MarkerColor> = { brt: 'purple', matatu: 'orange', bus: 'blue', rail: 'red', ferry: 'blue' }
function stationColor(p: Record<string, any>): MarkerColor {
  const mode = String(p.mode || p.station_type || '').toLowerCase()
  return STATION_MODE_COLOR[mode] ?? 'blue'
}
function stationRows(p: Record<string, any>) {
  const rows: Array<{ label: string; value: string }> = []
  if (p.route_count != null) rows.push({ label: 'Routes serving', value: String(p.route_count) })
  if (p.mode || p.station_type) rows.push({ label: 'Mode', value: String(p.mode ?? p.station_type) })
  if (p.adm1) rows.push({ label: 'County', value: String(p.adm1) })
  return rows.length ? rows : undefined
}
const stationMarkers = computed<MarkerSpec[]>(() => {
  if (!stationsData.value) return []
  return (stationsData.value.features ?? []).flatMap((f: any, i: number): MarkerSpec[] => {
    const [lon, lat] = f.geometry?.coordinates ?? []
    if (typeof lat !== 'number' || typeof lon !== 'number') return []
    const p = f.properties ?? {}
    return [{
      id: p.id != null ? String(p.id) : `station-${i}`,
      lat, lon,
      title: p.name || p.station_name || p.stop_name || `Station ${i + 1}`,
      badge: p.station_type || p.mode || 'Station',
      rows: stationRows(p),
      color: stationColor(p),
      size: 'sm',
    }]
  })
})

const EVENT_SEVERITY_COLOR: Record<string, MarkerColor> = {
  critical: 'red', high: 'red', incident: 'red',
  congestion: 'orange', medium: 'orange', roadworks: 'yellow', advisory: 'yellow', low: 'yellow',
}
function eventColor(p: Record<string, any>): MarkerColor {
  const key = String(p.severity || p.event_type || p.type || p.status || '').toLowerCase()
  return EVENT_SEVERITY_COLOR[key] ?? 'red'
}
function eventRows(p: Record<string, any>) {
  const rows: Array<{ label: string; value: string }> = []
  if (p.severity) rows.push({ label: 'Severity', value: String(p.severity) })
  if (p.delay_minutes != null) rows.push({ label: 'Delay (min)', value: String(p.delay_minutes) })
  if (p.reported_at) rows.push({ label: 'Reported', value: String(p.reported_at) })
  return rows.length ? rows : undefined
}
const eventMarkers = computed<MarkerSpec[]>(() => {
  if (!eventsData.value) return []
  return (eventsData.value.features ?? []).flatMap((f: any, i: number): MarkerSpec[] => {
    const [lon, lat] = f.geometry?.coordinates ?? []
    if (typeof lat !== 'number' || typeof lon !== 'number') return []
    const p = f.properties ?? {}
    return [{
      id: p.id != null ? String(p.id) : `event-${i}`,
      lat, lon,
      title: p.name || p.event_type || p.description || `Event ${i + 1}`,
      badge: p.event_type || p.severity || 'Event',
      rows: eventRows(p),
      color: eventColor(p),
      size: (p.severity === 'critical' || p.severity === 'high') ? 'lg' : 'md',
    }]
  })
})

const activeMarkers = computed<MarkerSpec[]>(() => [
  ...(layers.value.stations ? stationMarkers.value : []),
  ...(layers.value.events ? eventMarkers.value : []),
])

const routeCount   = computed(() => gisRoutes.value?.features?.length ?? 0)
const stationCount = computed(() => layers.value.stations ? (stationsData.value?.features?.length ?? 0) : 0)
const eventCount   = computed(() => layers.value.events ? (eventsData.value?.features?.length ?? 0) : 0)
// Roads no longer have a meaningful upfront count - PMTiles streams
// per-tile at whatever density the current zoom warrants, so "how many
// features" isn't a single number the way a fetched GeoJSON payload was.
const featureCount = computed(() =>
  (layers.value.boundary && boundary.value ? 1 : 0) +
  (layers.value.routes ? routeCount.value : 0) +
  stationCount.value + eventCount.value,
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

// Kenya's 47 counties (fixed since the 2010 constitution), for the road
// "County" filter dropdown. Matched case-insensitively in UaptsMap (see
// roadsCountyFilter), which absorbs an all-caps or all-lowercase source
// column - but NOT punctuation/spacing differences. If the rebuilt
// tileset's `county` values turn out to be formatted differently (e.g.
// hyphenated vs spaced, or with a numeric KRB code prefix), swap the
// values below to match rather than the display labels.
const KENYA_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa',
  'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi',
  'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu',
  'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa',
  "Murang'a", 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua',
  'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi',
  'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
]

function fmtNum(v: number) { return v.toLocaleString() }

// Mirrors conditionColorFor() in UaptsMap.vue - keep the two in sync.
const roadLegend = [
  { label: 'Poor',                color: '#dc2626', weight: 4 },
  { label: 'Fair',                color: '#f59e0b', weight: 4 },
  { label: 'Good',                color: '#16a34a', weight: 4 },
  { label: 'Under Construction',  color: '#2563eb', weight: 4 },
  { label: 'No RICS match',       color: '#94a3b8', weight: 4 },
]

const routeLegend = [
  { label: 'Bus',    color: '#3b82f6' },
  { label: 'BRT',    color: '#8b5cf6' },
  { label: 'Matatu', color: '#f97316' },
  { label: 'Rail',   color: '#ef4444' },
  { label: 'Ferry',  color: '#06b6d4' },
]

// ── County / constituency search ─────────────────────────────────────
interface SearchResult { id: string; name: string; kind: string; bbox: [number, number, number, number] }

function geometryBbox(geometry: any): [number, number, number, number] | null {
  let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity
  function walk(coords: any): void {
    if (typeof coords?.[0] === 'number') {
      const [lon, lat] = coords
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      return
    }
    for (const c of coords ?? []) walk(c)
  }
  try { walk(geometry?.coordinates) } catch { return null }
  if (![minLat, minLon, maxLat, maxLon].every(Number.isFinite)) return null
  return [minLat, minLon, maxLat, maxLon]
}

// County/constituency/country only - rivers and landmarks are treated as
// non-interactive background decoration elsewhere (UaptsMap skips their
// popup/click binding too), so they're not sensible "jump to" targets.
const searchableFeatures = computed<SearchResult[]>(() => {
  const feats = boundary.value?.features ?? []
  const out: SearchResult[] = []
  for (const f of feats) {
    const kind = f.properties?.kind
    if (kind !== 'county' && kind !== 'constituency' && kind !== 'country') continue
    const name = f.properties?.adm1_name || f.properties?.adm2_name || f.properties?.adm0_name || f.properties?.name
    const bbox = geometryBbox(f.geometry)
    if (!name || !bbox) continue
    out.push({ id: `${kind}-${name}-${out.length}`, name, kind, bbox })
  }
  return out
})

const searchQuery = ref('')
const searchOpen = ref(false)
const searchActiveIndex = ref(-1)

const searchResults = computed<SearchResult[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return searchableFeatures.value.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8)
})

watch(searchQuery, () => { searchOpen.value = searchQuery.value.trim().length > 0; searchActiveIndex.value = -1 })

function selectSearchResult(r: SearchResult) {
  mapComponent.value?.fitBounds(r.bbox)
  if (r.kind === 'county' || r.kind === 'constituency') selectedCounty.value = r.name
  searchQuery.value = ''
  searchOpen.value = false
  searchActiveIndex.value = -1
}

function onSearchKeydown(e: KeyboardEvent) {
  if (!searchResults.value.length) return
  if (e.key === 'ArrowDown') { e.preventDefault(); searchActiveIndex.value = Math.min(searchActiveIndex.value + 1, searchResults.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); searchActiveIndex.value = Math.max(searchActiveIndex.value - 1, 0) }
  else if (e.key === 'Enter') {
    e.preventDefault()
    const r = searchResults.value[searchActiveIndex.value] ?? searchResults.value[0]
    if (r) selectSearchResult(r)
  } else if (e.key === 'Escape') { searchOpen.value = false; searchActiveIndex.value = -1 }
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

/* ── Layer rows ──────────────────────────────────────────────────── */
.layer-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: 7px;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
  margin-bottom: 2px;
  user-select: none;
}
.layer-row:hover { background: #f1f5f9; }
.layer-row:focus-visible { outline: 2px solid #6366f1; outline-offset: 1px; }

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

.panel-text-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  font-size: 12px;
  background: #fff;
  color: #374151;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.panel-text-input::placeholder { color: #94a3b8; }
.panel-text-input:hover { border-color: #cbd5e1; }
.panel-text-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,.12); }

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

/* ── Search ──────────────────────────────────────────────────────── */
.panel-search { position: relative; }

.search-box { position: relative; display: flex; align-items: center; }

.search-icon {
  position: absolute;
  left: 9px;
  width: 14px;
  height: 14px;
  color: #94a3b8;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 7px 28px 7px 30px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  font-size: 12.5px;
  background: #fff;
  color: #1e293b;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.search-input::placeholder { color: #94a3b8; }
.search-input:hover { border-color: #cbd5e1; }
.search-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99, 102, 241, .12); }

.search-clear {
  position: absolute;
  right: 6px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #94a3b8;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.search-clear:hover { background: #f1f5f9; color: #475569; }

.search-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 14px;
  right: 14px;
  z-index: 20;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  max-height: 240px;
  overflow-y: auto;
}
.search-result-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 5px;
  cursor: pointer;
}
.search-result-row.active,
.search-result-row:hover { background: #eef2ff; }
.search-result-kind {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a5b4fc;
  flex-shrink: 0;
}
.search-result-name { font-size: 12.5px; color: #1e293b; }
.search-empty { margin-top: 6px; font-size: 11.5px; color: #94a3b8; padding: 0 2px; }

/* ── Section hint / inline layer error ──────────────────────────────── */
.section-hint { margin: 6px 0 0; font-size: 11px; color: #94a3b8; line-height: 1.4; }
.layer-error {
  margin: 2px 0 6px;
  padding: 5px 8px;
  border-radius: 6px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 11px;
  line-height: 1.4;
}

/* ── Header actions ──────────────────────────────────────────────────── */
.btn-ghost {
  background: transparent;
  border: 1px solid #e2e8f0;
  color: #475569;
}
.btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
.btn-icon { display: inline-block; }
.btn-icon.spinning { animation: spin 0.7s linear infinite; }

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
  gap: 12px;
}
.error-dismiss {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #92400e;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.error-dismiss:hover { background: rgba(202, 138, 4, 0.15); }
</style>