<template>
  <div class="map-widget">
    <div class="map-stage">
      <ClientOnly>
        <UaptsMap
          :markers="markers"
          :roads="config.showRoads ? roads ?? undefined : undefined"
          :center="[-0.5, 37.5]" :zoom="6" :height="`${mapHeight}px`"
          @feature-click="onFeatureClick"
        />
        <template #fallback><div class="map-fallback" :style="{ height: `${mapHeight}px` }">Loading map…</div></template>
      </ClientOnly>
      <div v-if="emptyMessage" class="map-empty" role="status">{{ emptyMessage }}</div>
    </div>

    <!-- Click targets that work regardless of whether the map emits marker
         events: the top clusters, each of which drives the dashboard action. -->
    <div v-if="topRoads.length" class="map-chips" role="group" aria-label="Filter linked widgets by road">
      <span class="map-chips-label">Top roads</span>
      <button
        v-for="r in topRoads" :key="r.code" type="button" class="map-chip"
        :class="{ active: selectedRoad === r.code }" :aria-pressed="selectedRoad === r.code"
        @click="selectRoad(r.code)"
      >{{ r.label }} <span class="map-chip-n">{{ r.count }}</span></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSafety, useGis } from '~/composables/api'
import type { PredictiveHotspot, BlackSpot, GeoJSONFeatureCollection } from '~/composables/api'
import type { WidgetInstance } from '~/types/dashboard'
import { filterParams } from '~/composables/useDomainData'
import { useWidgetFilters } from '~/composables/useDashboardFilters'

type MarkerSpec = import('~/components/UaptsMap.vue').MarkerSpec

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown>; bodyHeight?: number }>()
const { context, emit } = useWidgetFilters(() => props.instance.id)
const tick = inject<Ref<number>>('dashboard:refreshTick', ref(0))

const hotspots = ref<PredictiveHotspot[]>([])
const blackspots = ref<BlackSpot[]>([])
const roads = ref<GeoJSONFeatureCollection | null>(null)
const loading = ref(true)
const failed = ref(false)

const mapHeight = computed(() => Math.max(200, (props.bodyHeight ?? 300) - (topRoads.value.length ? 40 : 0)))

async function load() {
  loading.value = true
  const params = filterParams(context.value)
  const safety = useSafety()
  const [h, b] = await Promise.allSettled([
    safety.hotspots({ page_size: Number(props.config.hotspotLimit ?? 30), ...params }),
    safety.topBlackspots(params),
  ])
  hotspots.value = h.status === 'fulfilled' ? (h.value.results ?? []) : []
  blackspots.value = b.status === 'fulfilled' ? (b.value.results ?? []) : []
  failed.value = h.status === 'rejected' && b.status === 'rejected'
  loading.value = false
}
watch(() => JSON.stringify(context.value), load, { immediate: true })
watch(tick, load)
onMounted(async () => {
  if (!props.config.showRoads) return
  try { roads.value = await useGis().roads({ limit: 300, simplify: 0.02 }) } catch { /* map still useful without roads */ }
})

const ok = (lat: unknown, lon: unknown) => Number.isFinite(lat) && Number.isFinite(lon)
const tierColor = (t: string | null | undefined): MarkerSpec['color'] =>
  t === 'very_high' || t === 'critical' ? 'red' : t === 'high' ? 'orange' : t === 'medium' ? 'yellow' : 'gray'

const markers = computed<MarkerSpec[]>(() => [
  ...hotspots.value.filter(h => ok(h.latitude, h.longitude)).map(h => ({
    id: `hs-${h.id}`, lat: h.latitude, lon: h.longitude, badge: 'Predictive Hotspot',
    title: h.segment_road_code ?? `Grid ${h.id.slice(0, 8)}`,
    rows: [
      { label: 'Risk tier', value: h.risk_tier },
      { label: 'Risk score', value: `${h.predicted_risk_score.toFixed(0)}%` },
      { label: 'Horizon', value: `${h.horizon_days} days` },
    ],
    color: tierColor(h.risk_tier), size: h.risk_tier === 'very_high' ? 'lg' : 'md',
    road: h.segment_road_code ?? null,
  } as MarkerSpec & { road: string | null })),
  ...blackspots.value.filter(b => ok(b.centroid_latitude, b.centroid_longitude)).map(b => ({
    id: `bs-${b.id}`, lat: b.centroid_latitude!, lon: b.centroid_longitude!, badge: 'Accident Black Spot',
    title: b.segment_road_name ?? b.segment_road_code ?? 'Black Spot Cluster',
    rows: [
      { label: 'Tier', value: b.ranking_tier ?? 'unranked' },
      { label: 'Accidents (rolling)', value: String(b.accident_count_rolling) },
      { label: 'Fatalities', value: String(b.fatality_count_rolling) },
    ],
    color: tierColor(b.ranking_tier), size: 'sm',
    road: b.segment_road_code ?? null,
  } as MarkerSpec & { road: string | null })),
])

const topRoads = computed(() => {
  const counts = new Map<string, { code: string; label: string; count: number }>()
  for (const b of blackspots.value) {
    const code = b.segment_road_code
    if (!code) continue
    const cur = counts.get(code) ?? { code, label: b.segment_road_name ?? code, count: 0 }
    cur.count += b.accident_count_rolling ?? 1
    counts.set(code, cur)
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 6)
})

const selectedRoad = ref<string | null>(null)
function selectRoad(code: string | null) {
  selectedRoad.value = selectedRoad.value === code ? null : code
  emit('road', selectedRoad.value)
}
/** UaptsMap reports every click as feature-click; a marker click carries the MarkerSpec. */
function onFeatureClick(e: { layer: string; feature: unknown }) {
  if (e.layer === 'markers') onMarker(e.feature as { id: string })
}
function onMarker(m: { id: string }) {
  const hit = markers.value.find(x => x.id === m?.id) as (MarkerSpec & { road: string | null }) | undefined
  if (hit?.road) selectRoad(hit.road)
}

const emptyMessage = computed(() => {
  if (loading.value || markers.value.length) return null
  return failed.value
    ? 'Hotspot and black-spot feed unavailable - retry to refresh'
    : 'No predictive hotspots or black spots for the current filters.'
})
</script>

<style scoped>
.map-widget { display: flex; flex-direction: column; height: 100%; gap: 6px; }
.map-stage { position: relative; border-radius: var(--r-sm); overflow: hidden; }
.map-fallback { background: var(--surface-sunken); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--fg-3); }
.map-empty {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 800;
  max-width: min(340px, calc(100% - 32px)); padding: 10px 14px; text-align: center;
  font-size: 12px; color: var(--fg-2); background: color-mix(in srgb, var(--surface-2) 94%, transparent);
  border: 1px solid var(--border-subtle); border-radius: var(--r-sm); box-shadow: var(--elev-2); pointer-events: none;
}
.map-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.map-chips-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--fg-3); }
.map-chip {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; font-size: 10.5px; font-weight: 600;
  border: 1px solid var(--border-subtle); border-radius: var(--r-xs); background: var(--surface-1); color: var(--fg-2); cursor: pointer;
}
.map-chip:hover { border-color: var(--border-interactive); }
.map-chip.active { background: var(--primary-fill); border-color: var(--primary-fill); color: #fff; }
.map-chip:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.map-chip-n { font-family: var(--font-mono); opacity: .75; }
</style>
