<script setup lang="ts">
/**
 * Waterways map: the OSM hydrology layers (KMA `hydrology-waterways` lines, `hydrology-water-bodies` polygons)
 * drawn for the current view, the selected waterway highlighted, and navigation aids on top.
 *
 * Features are fetched per view from /api/v1/gis/layers/<id>/features/ (bbox + attribute filter). What is
 * asked for depends on zoom - rivers and canals only when zoomed out, streams once close - so a national view
 * never pulls the ~45k streams and drains.
 */
import { useGisLayers } from '~/composables/api/useGisLayers'

interface Aid { id: string; name: string; aid_type: string; operational_status: string; latitude: number | null; longitude: number | null }
const props = withDefaults(defineProps<{
  navaids?: Aid[]
  /** GeoJSON FeatureCollection for the waterway picked in the table. */
  highlight?: any | null
  height?: string
}>(), { navaids: () => [], highlight: null, height: '460px' })

const el = ref<HTMLElement | null>(null)
const note = ref('')
const loading = ref(false)
let L: any = null
let map: any = null
let hydro: any = null, aids: any = null, picked: any = null
let ids: { lines?: string; bodies?: string } = {}
let timer: ReturnType<typeof setTimeout> | null = null
let seq = 0

const STATUS_COLOR: Record<string, string> = { operational: '#22c55e', maintenance: '#f59e0b', non_operational: '#ef4444' }

async function resolveLayers() {
  try {
    const rows = await useGisLayers().layers.list({ q: 'hydrology' })
    ids = {
      lines: rows.find(r => r.slug === 'hydrology-waterways' && r.status === 'ready')?.id,
      bodies: rows.find(r => r.slug === 'hydrology-water-bodies' && r.status === 'ready')?.id,
    }
  } catch { /* no GIS access for this user */ }
  if (!ids.lines && !ids.bodies) note.value = 'Hydrology layers are not available to your account; showing navigation aids only.'
}

async function redraw() {
  if (!map || !L || (!ids.lines && !ids.bodies)) return
  const mine = ++seq
  loading.value = true
  const z = map.getZoom()
  const b = map.getBounds()
  const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`
  const gis = useGisLayers().layers
  const lineKinds = z < 8 ? ['river'] : z < 10 ? ['river', 'canal'] : ['river', 'canal', 'stream']
  const simplify = z < 8 ? 0.01 : z < 10 ? 0.002 : 0.0003
  const jobs: Promise<any>[] = []
  if (ids.bodies) jobs.push(gis.features(ids.bodies, { bbox, limit: 600, simplify, prop: { water: 'lake' } }))
  if (ids.lines) for (const k of lineKinds) jobs.push(gis.features(ids.lines, { bbox, limit: k === 'stream' ? 4000 : 2000, simplify, prop: { waterway: k } }))
  const done = await Promise.allSettled(jobs)
  if (mine !== seq) return
  hydro.clearLayers()
  let truncated = false
  done.forEach((r, i) => {
    if (r.status !== 'fulfilled') return
    truncated ||= !!r.value.truncated
    const isBody = ids.bodies && i === 0
    L.geoJSON(r.value, {
      style: () => isBody ? { color: '#2563eb', weight: 1, fillColor: '#60a5fa', fillOpacity: 0.45 } : { color: '#3b82f6', weight: z < 8 ? 1.5 : 1, opacity: 0.8 },
      onEachFeature: (f: any, lyr: any) => { const n = f.properties?.name; if (n) lyr.bindTooltip(String(n), { sticky: true }) },
    }).addTo(hydro)
  })
  note.value = truncated ? 'Zoom in to see every feature in this view.' : ''
  loading.value = false
}

function drawAids() {
  if (!aids || !L) return
  aids.clearLayers()
  for (const a of props.navaids) {
    if (a.latitude == null || a.longitude == null) continue
    L.circleMarker([a.latitude, a.longitude], { radius: 6, color: '#0f172a', weight: 1, fillColor: STATUS_COLOR[a.operational_status] ?? '#94a3b8', fillOpacity: 1 })
      .bindTooltip(`${a.name} · ${a.aid_type.replace(/_/g, ' ')} · ${a.operational_status.replace(/_/g, ' ')}`).addTo(aids)
  }
}

function drawPicked() {
  if (!picked || !L) return
  picked.clearLayers()
  if (!props.highlight?.features?.length) return
  const g = L.geoJSON(props.highlight, { style: () => ({ color: '#f97316', weight: 4, fillColor: '#fdba74', fillOpacity: 0.5 }) }).addTo(picked)
  const bounds = g.getBounds()
  if (bounds.isValid()) map.fitBounds(bounds, { maxZoom: 11, padding: [24, 24] })
}

onMounted(async () => {
  const mod: any = await import('leaflet')
  L = mod.default ?? mod
  map = L.map(el.value!, { center: [0.2, 37.9], zoom: 6, preferCanvas: true })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors (ODbL)', maxZoom: 18 }).addTo(map)
  hydro = L.layerGroup().addTo(map)
  picked = L.layerGroup().addTo(map)
  aids = L.layerGroup().addTo(map)
  map.on('moveend', () => { if (timer) clearTimeout(timer); timer = setTimeout(redraw, 250) })
  await resolveLayers()
  drawAids(); drawPicked(); redraw()
})
watch(() => props.navaids, drawAids)
watch(() => props.highlight, drawPicked)
onBeforeUnmount(() => { if (timer) clearTimeout(timer); map?.remove(); map = null })
</script>

<template>
  <div class="ww-map">
    <div ref="el" :style="{ height }" />
    <div v-if="loading" class="ww-badge">Loading water features…</div>
    <div v-if="note" class="ww-note">{{ note }}</div>
    <div class="ww-key">
      <span><i style="background:#3b82f6" /> River / stream / canal</span>
      <span><i style="background:#60a5fa" /> Lake</span>
      <span><i style="background:#f97316" /> Selected waterway</span>
      <span><i style="background:#22c55e;border-radius:50%" /> Navigation aid</span>
    </div>
  </div>
</template>

<style scoped>
.ww-map { position: relative; }
.ww-badge { position: absolute; top: 8px; right: 8px; z-index: 500; background: var(--bg-1, #fff); border: 1px solid var(--border, #e2e8f0); padding: 3px 8px; border-radius: 6px; font-size: 11px; }
.ww-note { font-size: 11px; color: var(--fg-3, #64748b); padding-top: 6px; }
.ww-key { display: flex; flex-wrap: wrap; gap: 14px; font-size: 11px; padding-top: 8px; color: var(--fg-2, #475569); }
.ww-key i { display: inline-block; width: 10px; height: 10px; margin-right: 5px; vertical-align: -1px; }
</style>
