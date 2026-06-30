<template>
  <PageHeader
    eyebrow="GIS & Spatial Analysis"
    title="GIS Explorer"
    subtitle="KeNHA · KURA · KeRRA · KRB · KRC · KPA · KMA · KAA · NCTTCA - National road network, PT routes, rail lines, port infrastructure, and UAPTS spatial layers"
  >
    <template #actions>
      <button class="btn" :disabled="loading" @click="load">↻ Reload Layers</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <div class="gis-workspace">

    <!-- ── Left control panel ─────────────────────────────────────── -->
    <aside class="gis-panel">

      <!-- Layers -->
      <div class="panel-section">
        <div class="panel-section-title">Map Layers</div>

        <div class="layer-row" @click="toggleLayer('boundary')">
          <span class="layer-swatch" :style="{ background: layers.boundary ? '#818cf8' : '#334155' }" />
          <span class="layer-name" :class="{ 'layer-dim': !layers.boundary }">Kenya Boundary</span>
          <div class="layer-switch" :class="{ on: layers.boundary }">
            <span class="layer-thumb" />
          </div>
        </div>

        <div class="layer-row" @click="toggleLayer('roads')">
          <span class="layer-swatch" :style="{ background: layers.roads ? '#f59e0b' : '#334155' }" />
          <span class="layer-name" :class="{ 'layer-dim': !layers.roads }">Road Network</span>
          <span v-if="roadCount" class="layer-badge">{{ fmtNum(roadCount) }}</span>
          <div class="layer-switch" :class="{ on: layers.roads }">
            <span class="layer-thumb" />
          </div>
        </div>

        <div class="layer-row" @click="toggleLayer('routes')">
          <span class="layer-swatch" :style="{ background: layers.routes ? '#34d399' : '#334155' }" />
          <span class="layer-name" :class="{ 'layer-dim': !layers.routes }">PT Routes</span>
          <span v-if="routeCount" class="layer-badge">{{ fmtNum(routeCount) }}</span>
          <div class="layer-switch" :class="{ on: layers.routes }">
            <span class="layer-thumb" />
          </div>
        </div>
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
            :boundary="layers.boundary ? boundary : undefined"
            :roads="layers.roads ? roads : undefined"
            :lines="layers.routes ? routeLines : undefined"
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
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('GIS Explorer')

import { useGis } from '~/composables/api'
import type { GeoJSONFeatureCollection, LineSpec } from '~/composables/api'

const boundary   = ref<GeoJSONFeatureCollection | null>(null)
const roads      = ref<GeoJSONFeatureCollection | null>(null)
const gisRoutes  = ref<GeoJSONFeatureCollection | null>(null)
const loading    = ref(true)
const error      = ref<string | null>(null)

const simplify          = ref(0.01)
const highwayFilter     = ref('')
const serviceTypeFilter = ref('')
const adminLevel        = ref<0 | 1 | 2>(1)   // 0=country, 1=counties, 2=constituencies

// Highlighted county name (set via feature-click emit from UaptsMap)
const selectedCounty = ref<string | null>(null)

const layers = ref({ boundary: true, roads: true, routes: false })

const mapHeight = 'calc(100vh - 232px)'

async function load() {
  loading.value = true
  error.value   = null
  const gis     = useGis()

  const calls: Promise<any>[] = [
    gis.kenyaBoundary({ admin_level: adminLevel.value }),
    gis.roads({ limit: 500, simplify: simplify.value, highway: highwayFilter.value || undefined }),
  ]
  if (layers.value.routes)
    calls.push(gis.routes({ limit: 200, simplify: simplify.value, service_type: serviceTypeFilter.value || undefined }))

  const results = await Promise.allSettled(calls)

  if (results[0].status === 'fulfilled') boundary.value   = results[0].value
  if (results[1].status === 'fulfilled') roads.value      = results[1].value
  if (results[2]?.status === 'fulfilled') gisRoutes.value = results[2].value

  if (results.slice(0, 2).every(r => r.status === 'rejected'))
    error.value = 'Unable to load GIS layers from the UAPTS API.'

  loading.value = false
}

async function reloadBoundary() {
  const [res] = await Promise.allSettled([
    useGis().kenyaBoundary({ admin_level: adminLevel.value }),
  ])
  if (res.status === 'fulfilled') {
    boundary.value = res.value
    selectedCounty.value = null
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
  const [res] = await Promise.allSettled([
    useGis().roads({ limit: 500, simplify: simplify.value, highway: highwayFilter.value || undefined }),
  ])
  if (res.status === 'fulfilled') roads.value = res.value
}

async function reloadRoutes() {
  const [res] = await Promise.allSettled([
    useGis().routes({ limit: 200, simplify: simplify.value, service_type: serviceTypeFilter.value || undefined }),
  ])
  if (res.status === 'fulfilled') gisRoutes.value = res.value
}

async function toggleLayer(key: 'boundary' | 'roads' | 'routes') {
  layers.value[key] = !layers.value[key]
  if (key === 'routes' && layers.value.routes && !gisRoutes.value) await reloadRoutes()
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
  padding: 7px 8px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.12s;
  margin-bottom: 2px;
  user-select: none;
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

/* ── Misc ────────────────────────────────────────────────────────── */
.error-banner {
  margin: 0 0 12px;
  padding: 10px 16px;
  border-radius: 8px;
  background: #fef9c3;
  border: 1px solid #ca8a04;
  font-size: 13px;
}
</style>