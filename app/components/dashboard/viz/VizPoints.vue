<template>
  <!--
    VizPoints - rows with coordinates on the map.
      xs   how many places, by tier
      s+   the map, fitted to the markers whenever the data changes (never a
           hard-coded view), with a tier legend (dot + label + count, so tier
           isn't carried by hue alone)
    Rows without usable coordinates are counted under the map, not dropped.
  -->
  <div v-if="size === 'xs'" class="vp-head">
    <span class="vp-head-n">{{ formatValue(frame.rows.length, 'count') }}</span>
    <span class="vp-head-lbl">{{ frame.rows.length === 1 ? 'place' : 'places' }}</span>
    <ul v-if="tiers.length" class="vp-tiers">
      <li v-for="t in tiers.slice(0, 3)" :key="t.key"><span class="vp-dot" :class="`vp-dot--${t.color}`" aria-hidden="true" />{{ t.label }} {{ t.count }}</li>
    </ul>
  </div>

  <div v-else class="vp">
    <div class="vp-stage">
      <ClientOnly>
        <UaptsMap
          ref="mapRef" :markers="markers" :center="KENYA_CENTRE" :zoom="6" :height="`${height}px`"
          @feature-click="onFeatureClick"
        />
        <template #fallback><div class="vp-fallback" :style="{ height: `${height}px` }">Loading map…</div></template>
      </ClientOnly>
    </div>
    <div class="vp-foot">
      <ul v-if="tiers.length" class="vp-tiers" aria-label="Tiers">
        <li v-for="t in tiers" :key="t.key"><span class="vp-dot" :class="`vp-dot--${t.color}`" aria-hidden="true" />{{ t.label }} <span class="vp-n">{{ t.count }}</span></li>
      </ul>
      <span v-if="frame.meta.unplaced" class="vp-note">{{ frame.meta.unplaced }} without a location</span>
      <span v-if="frame.meta.partial" class="vp-note">First {{ formatValue(frame.meta.partial.count, 'count') }} of {{ formatValue(frame.meta.partial.total, 'count') }}</span>
    </div>
    <div class="vs-sr">
      <VizTable :frame="frame" size="m" :caption="summary" :max-rows="1000" :interactive="false" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Frame } from '~/types/frame'
import type { SizeClass } from '~/utils/viz'
import { formatCell } from '~/utils/viz'
import { humanize } from '~/utils/bindings'
import { formatValue } from '~/utils/units'
import VizTable from './VizTable.vue'

type MarkerSpec = import('~/components/UaptsMap.vue').MarkerSpec
type MarkerColor = NonNullable<MarkerSpec['color']>

const props = withDefaults(defineProps<{
  frame: Frame
  size: SizeClass
  height?: number
  title?: string
  selectable?: boolean
  isPicked?: (key: string) => boolean
  isDimmed?: (key: string) => boolean
}>(), { height: 260, title: 'Map', selectable: false, isPicked: () => false, isDimmed: () => false })
const emit = defineEmits<{ pick: [key: string] }>()

const KENYA_CENTRE: [number, number] = [0.2, 37.9]

/** Tier words the platform's feeds use, worst first. */
const TIER_COLORS: [RegExp, MarkerColor][] = [
  [/^(critical|very_high|severe|fatal)$/i, 'red'],
  [/^(high|heavy|serious)$/i, 'orange'],
  [/^(medium|moderate)$/i, 'yellow'],
  [/^(low|minor|free_flow)$/i, 'green'],
]
const tierColor = (t: unknown): MarkerColor => {
  const s = String(t ?? '')
  return TIER_COLORS.find(([re]) => re.test(s))?.[1] ?? 'blue'
}
const TIER_ORDER: MarkerColor[] = ['red', 'orange', 'yellow', 'green', 'blue']

const tiers = computed(() => {
  const counts = new Map<string, number>()
  for (const r of props.frame.rows) if (r.tier != null && r.tier !== '') counts.set(String(r.tier), (counts.get(String(r.tier)) ?? 0) + 1)
  return [...counts].map(([key, count]) => ({ key, label: humanize(key), count, color: tierColor(key) }))
    .sort((a, b) => TIER_ORDER.indexOf(a.color) - TIER_ORDER.indexOf(b.color))
})

const detailFields = computed(() => props.frame.fields.filter(f => f.key !== 'label' && f.key !== 'tier'))
const markers = computed<MarkerSpec[]>(() => props.frame.rows.map((r, i) => {
  const key = r.key == null ? '' : String(r.key)
  const color = tierColor(r.tier)
  return {
    id: `p${i}`, lat: r.lat as number, lon: r.lon as number,
    title: r.label == null || r.label === '' ? (key || 'Location') : String(r.label),
    badge: r.tier == null ? undefined : humanize(r.tier),
    rows: detailFields.value.map(f => ({ label: f.label, value: formatCell(r[f.key], f) })),
    color: key && props.isDimmed(key) ? 'gray' : color,
    size: key && props.isPicked(key) ? 'lg' : color === 'red' ? 'md' : 'sm',
  }
}))

function onFeatureClick(e: { layer: string; feature: { id?: string } }) {
  if (e.layer !== 'markers' || !props.selectable) return
  const i = Number(String(e.feature?.id ?? '').slice(1))
  const key = props.frame.rows[i]?.key
  if (key != null && key !== '') emit('pick', String(key))
}

// ── fit to the markers (docs/Widgets.md finding 10) ──
const mapRef = ref<{ fitBounds: (b: [number, number, number, number], o?: { padding?: [number, number] }) => void; flyTo: (lat: number, lon: number, z?: number) => void; getMap: () => unknown } | null>(null)
let tries = 0
let timer: ReturnType<typeof setTimeout> | undefined
function fit() {
  timer = undefined
  const rows = props.frame.rows
  if (!rows.length) return
  const map = mapRef.value
  // Leaflet mounts asynchronously inside ClientOnly; retry briefly until it's there.
  if (typeof map?.getMap !== 'function' || !map.getMap()) { if (tries++ < 20) timer = setTimeout(fit, 150); return }
  tries = 0
  const lats = rows.map(r => r.lat as number)
  const lons = rows.map(r => r.lon as number)
  if (rows.length === 1) { map.flyTo(lats[0]!, lons[0]!, 11); return }
  map.fitBounds([Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)], { padding: [28, 28] })
}
watch(() => props.frame.rows.map(r => `${r.lat},${r.lon}`).join('|'), () => { tries = 0; nextTick(fit) }, { immediate: true })
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })

const summary = computed(() => `${props.title}: ${props.frame.rows.length} places${tiers.value.length ? `, ${tiers.value.map(t => `${t.count} ${t.label}`).join(', ')}` : ''}.`)
</script>

<style scoped>
.vp { display: flex; flex-direction: column; gap: 6px; height: 100%; min-height: 0; }
.vp-stage { position: relative; border-radius: var(--r-sm); overflow: hidden; flex: 1; min-height: 0; }
.vp-fallback { background: var(--surface-sunken); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--fg-3); }
.vp-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; min-height: 18px; }
.vp-tiers { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 10.5px; color: var(--fg-2); }
.vp-tiers li { display: inline-flex; align-items: center; gap: 5px; }
.vp-n { font-family: var(--font-mono); color: var(--fg-3); }
.vp-note { font-size: 10.5px; color: var(--warning-fg); }
.vp-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--viz-1); }
.vp-dot--red { background: var(--danger-fg); }
.vp-dot--orange { background: var(--viz-2); }
.vp-dot--yellow { background: var(--viz-6); }
.vp-dot--green { background: var(--success-fg); }
.vp-head { display: flex; flex-direction: column; gap: 2px; height: 100%; justify-content: center; }
.vp-head-n { font-family: var(--font-mono); font-size: 22px; font-weight: 600; color: var(--fg-1); line-height: 1.1; }
.vp-head-lbl { font-size: 11px; color: var(--fg-2); }
.vs-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
</style>
