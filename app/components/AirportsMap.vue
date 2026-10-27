<script setup lang="ts">
/**
 * Aviation map: airports (registered ones large, code-less airstrips small), runway centre lines, and - once zoomed
 * in - the OSM airport layers (taxiways, aprons, terminals) for the view. Airports and runways come from the
 * aviation API; the context layers come from the GIS layer API when the account may read them.
 */
import { useGisLayers } from '~/composables/api/useGisLayers'
import type { Airport, RunwayFeature } from '~/composables/api'

const props = withDefaults(defineProps<{
  airports: Airport[]
  runways?: RunwayFeature[]
  height?: string
  /** Start with the code-less airstrips shown. */
  showAirstrips?: boolean
}>(), { runways: () => [], height: '460px', showAirstrips: true })

const el = ref<HTMLElement | null>(null)
const strips = ref(props.showAirstrips)
const context = ref('')
let L: any = null
let map: any = null
let apLayer: any = null, rwLayer: any = null, ctxLayer: any = null
let ids: { taxi?: string; areas?: string } = {}
let timer: ReturnType<typeof setTimeout> | null = null
let seq = 0

const COLORS: Record<string, string> = {
  international: '#ef4444', regional: '#3b82f6', domestic: '#22c55e', military: '#6b7280', private: '#a855f7',
  heliport: '#f59e0b', airstrip: '#94a3b8',
}
const CONTEXT_MIN_ZOOM = 12

const counts = computed(() => ({
  registered: props.airports.filter(a => a.iata_code).length,
  strips: props.airports.filter(a => !a.iata_code).length,
}))

function code(a: Airport) { return a.iata_code ? `${a.iata_code}${a.icao_code ? ' / ' + a.icao_code : ''}` : 'no IATA code' }

function drawAirports() {
  if (!apLayer || !L) return
  apLayer.clearLayers()
  for (const a of props.airports) {
    if (a.latitude == null || a.longitude == null) continue
    const registered = !!a.iata_code
    if (!registered && !strips.value) continue
    L.circleMarker([a.latitude, a.longitude], {
      radius: registered ? (a.airport_type === 'international' ? 9 : 7) : 4,
      color: '#0f172a', weight: registered ? 1.5 : 0.5, fillColor: COLORS[a.airport_type] ?? '#64748b', fillOpacity: registered ? 0.95 : 0.7,
    }).bindTooltip(`<b>${a.name}</b><br>${code(a)}<br>${a.airport_type}${a.county ? ' · ' + a.county : ''}${a.runway_count ? ' · ' + a.runway_count + ' runway(s)' : ''}`).addTo(apLayer)
  }
}

function drawRunways() {
  if (!rwLayer || !L) return
  rwLayer.clearLayers()
  if (!props.runways.length) return
  L.geoJSON({ type: 'FeatureCollection', features: props.runways }, {
    style: (f: any) => ({ color: f.properties.status === 'closed' ? '#ef4444' : '#111827', weight: 3, opacity: 0.9 }),
    onEachFeature: (f: any, lyr: any) => {
      const p = f.properties
      lyr.bindTooltip(`${p.airport} ${p.runway_id} · ${Number(p.length_m).toLocaleString()} m${p.ils_category && p.ils_category !== 'none' ? ' · ILS ' + p.ils_category : ''}`, { sticky: true })
    },
  }).addTo(rwLayer)
}

async function resolveLayers() {
  try {
    const rows = await useGisLayers().layers.list({ q: 'airport' })
    ids = {
      taxi: rows.find(r => r.slug === 'airport-taxiways' && r.status === 'ready')?.id,
      areas: rows.find(r => r.slug === 'airport-areas' && r.status === 'ready')?.id,
    }
  } catch { /* no GIS access: the map still shows airports and runways */ }
}

async function drawContext() {
  if (!map || !ctxLayer) return
  const mine = ++seq
  if (map.getZoom() < CONTEXT_MIN_ZOOM || (!ids.taxi && !ids.areas)) {
    ctxLayer.clearLayers()
    context.value = map.getZoom() < CONTEXT_MIN_ZOOM && (ids.taxi || ids.areas) ? `Zoom in to see taxiways, aprons and terminals (zoom ${CONTEXT_MIN_ZOOM}+).` : ''
    return
  }
  const b = map.getBounds()
  const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`
  const gis = useGisLayers().layers
  const [t, a] = await Promise.allSettled([
    ids.taxi ? gis.features(ids.taxi, { bbox, limit: 3000, simplify: 0.00002 }) : Promise.reject(),
    ids.areas ? gis.features(ids.areas, { bbox, limit: 3000, simplify: 0.00002 }) : Promise.reject(),
  ])
  if (mine !== seq) return
  ctxLayer.clearLayers()
  if (a.status === 'fulfilled') L.geoJSON(a.value, { style: () => ({ color: '#64748b', weight: 1, fillColor: '#cbd5e1', fillOpacity: 0.5 }), onEachFeature: (f: any, l: any) => f.properties?.aeroway && l.bindTooltip(String(f.properties.name || f.properties.aeroway)) }).addTo(ctxLayer)
  if (t.status === 'fulfilled') L.geoJSON(t.value, { style: () => ({ color: '#475569', weight: 1.5, opacity: 0.8 }) }).addTo(ctxLayer)
  context.value = (t.status === 'fulfilled' && t.value.truncated) || (a.status === 'fulfilled' && a.value.truncated) ? 'Zoom in to see every feature in this view.' : ''
}

onMounted(async () => {
  const mod: any = await import('leaflet')
  L = mod.default ?? mod
  map = L.map(el.value!, { center: [0.2, 37.9], zoom: 6, preferCanvas: true })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors (ODbL)', maxZoom: 19 }).addTo(map)
  ctxLayer = L.layerGroup().addTo(map)
  rwLayer = L.layerGroup().addTo(map)
  apLayer = L.layerGroup().addTo(map)
  map.on('moveend', () => { if (timer) clearTimeout(timer); timer = setTimeout(drawContext, 250) })
  drawAirports(); drawRunways()
  await resolveLayers()
  drawContext()
})
watch(() => props.airports, () => {
  if (props.airports.length && !counts.value.registered) strips.value = true   // nothing registered yet: show what there is
  drawAirports()
})
watch(() => props.runways, drawRunways)
watch(strips, drawAirports)
onBeforeUnmount(() => { if (timer) clearTimeout(timer); map?.remove(); map = null })
</script>

<template>
  <div class="ap-map">
    <div ref="el" :style="{ height }" />
    <div class="ap-bar">
      <label v-if="counts.strips" class="ap-toggle"><input v-model="strips" type="checkbox"> Show {{ counts.strips }} airstrips &amp; heliports without an IATA code</label>
      <span v-if="context" class="ap-note">{{ context }}</span>
    </div>
    <div class="ap-key">
      <span><i style="background:#ef4444" /> International</span>
      <span><i style="background:#3b82f6" /> Regional</span>
      <span><i style="background:#22c55e" /> Domestic</span>
      <span><i style="background:#a855f7" /> Private</span>
      <span><i style="background:#6b7280" /> Military</span>
      <span><i style="background:#94a3b8" /> Airstrip</span>
      <span><b class="ap-line" /> Runway</span>
    </div>
  </div>
</template>

<style scoped>
.ap-bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 6px 2px 0; font-size: 11px; }
.ap-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.ap-note { color: var(--fg-3, #64748b); }
.ap-key { display: flex; flex-wrap: wrap; gap: 14px; font-size: 11px; padding: 6px 2px 0; color: var(--fg-2, #475569); }
.ap-key i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; }
.ap-line { display: inline-block; width: 16px; height: 3px; background: #111827; margin-right: 5px; vertical-align: 2px; }
</style>
