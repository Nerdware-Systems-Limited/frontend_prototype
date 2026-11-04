<script setup lang="ts">
/**
 * LiveMap.vue - the live operations map.
 *
 * Wraps UaptsMap with everything an operator needs to watch the network
 * *as it changes*, not just look at a snapshot:
 *
 *   - a status HUD: LIVE / PAUSED / STALE / OFFLINE pill, "updated 12s ago",
 *     manual refresh, pause/resume, refresh-interval picker, fullscreen;
 *   - severity chips with live counts that filter the map and the feed;
 *   - a ranked live feed (most urgent first) - click to fly to and open the
 *     marker; items that arrived since the page opened carry a NEW tag;
 *   - a transient banner when new items land on a refresh, and a radar ping
 *     on the new marker itself (UaptsMap does the ping).
 *
 * The component owns no data: the page feeds it `markers` and a `live`
 * controller from useLivePoll(), and refreshes land in place (UaptsMap
 * reconciles markers by id), so a refresh never flickers or closes a popup.
 *
 * Always wrap in <ClientOnly> - it embeds Leaflet.
 */
import { Maximize2, Minimize2, Pause, Play, RefreshCw, PanelRightClose, PanelRightOpen } from 'lucide-vue-next'
import type { MarkerSpec, GeoJSONFeatureCollection } from '~/components/UaptsMap.vue'
import { MAP_COLORS, MAP_COLOR_RANK, type MapColor } from '~/utils/mapBasemap'
import type { useLivePoll } from '~/composables/useLivePoll'

interface Props {
  markers: MarkerSpec[]
  /** The controller returned by useLivePoll(). */
  live: ReturnType<typeof useLivePoll>
  roads?: GeoJSONFeatureCollection | null
  center?: [number, number]
  zoom?: number
  height?: string
  /** Name of the things on the map, plural, e.g. "incidents". Used in HUD copy. */
  noun?: string
  /** Label for each marker colour present, in legend order. Colours not listed are hidden from the chips. */
  legend?: Array<{ color: MapColor; label: string }>
  /** Heading for the feed panel. */
  feedTitle?: string
  /** How long an item keeps its NEW tag after it first appears, in seconds. */
  newForSeconds?: number
}

const props = withDefaults(defineProps<Props>(), {
  roads: null,
  center: () => [-1.286, 36.817],
  zoom: 7,
  height: '560px',
  noun: 'items',
  legend: () => [],
  feedTitle: 'Live feed',
  newForSeconds: 120,
})

const emit = defineEmits<{
  (e: 'select', marker: MarkerSpec): void
}>()

const shellEl = ref<HTMLElement | null>(null)
const mapRef = ref<any>(null)
const isFullscreen = ref(false)
const feedOpen = ref(true)
const hiddenColors = ref<Set<MapColor>>(new Set())
const activeId = ref<string | null>(null)

// ── Live status ─────────────────────────────────────────────────────────
const status = computed(() => props.live.status.value)
const STATUS_COPY: Record<string, string> = {
  live: 'LIVE', paused: 'PAUSED', stale: 'STALE', error: 'OFFLINE', connecting: 'CONNECTING',
}
const statusLabel = computed(() => STATUS_COPY[status.value] ?? 'LIVE')

const updatedLabel = computed(() => {
  const s = props.live.ageSeconds.value
  if (s == null) return props.live.lastError.value ? 'No data yet' : 'Waiting for first update'
  if (s < 5) return 'Updated just now'
  if (s < 60) return `Updated ${s}s ago`
  if (s < 3600) return `Updated ${Math.floor(s / 60)}m ago`
  return `Updated ${Math.floor(s / 3600)}h ago`
})

const INTERVALS = [
  { ms: 5_000, label: '5s' },
  { ms: 15_000, label: '15s' },
  { ms: 30_000, label: '30s' },
  { ms: 60_000, label: '1m' },
]
const intervalModel = computed({
  get: () => props.live.intervalMs.value,
  set: (v: number) => props.live.setInterval(Number(v)),
})

// ── Filtering + counts ──────────────────────────────────────────────────
const colorOf = (m: MarkerSpec): MapColor => m.color ?? 'blue'

const chips = computed(() =>
  props.legend.map(l => ({
    ...l,
    hex: MAP_COLORS[l.color],
    count: props.markers.filter(m => colorOf(m) === l.color).length,
    off: hiddenColors.value.has(l.color),
  })),
)

const visibleMarkers = computed(() =>
  hiddenColors.value.size ? props.markers.filter(m => !hiddenColors.value.has(colorOf(m))) : props.markers,
)

function toggleColor(c: MapColor) {
  const next = new Set(hiddenColors.value)
  next.has(c) ? next.delete(c) : next.add(c)
  hiddenColors.value = next
}

const urgentCount = computed(() => props.markers.filter(m => colorOf(m) === 'red').length)

// ── NEW tracking ────────────────────────────────────────────────────────
// id -> epoch ms first seen on a refresh *after* the initial load.
const firstSeen = ref<Record<string, number>>({})
const banner = ref<{ text: string; tone: MapColor } | null>(null)
let bannerTimer: ReturnType<typeof setTimeout> | null = null
const clock = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | null = null

function isNew(id: string): boolean {
  const t = firstSeen.value[id]
  return t != null && clock.value - t < props.newForSeconds * 1000
}

function onSynced(p: { added: string[]; removed: string[]; total: number }) {
  if (!p.added.length) return
  const now = Date.now()
  const next = { ...firstSeen.value }
  for (const id of p.added) next[id] = now
  firstSeen.value = next
  const worst = p.added
    .map(id => props.markers.find(m => m.id === id))
    .filter((m): m is MarkerSpec => !!m)
    .sort((a, b) => MAP_COLOR_RANK[colorOf(a)] - MAP_COLOR_RANK[colorOf(b)])[0]
  const n = p.added.length
  banner.value = {
    tone: worst ? colorOf(worst) : 'blue',
    text: n === 1 && worst?.title ? `New: ${worst.title}` : `${n} new ${props.noun}${worst?.title ? ` - most urgent: ${worst.title}` : ''}`,
  }
  if (bannerTimer) clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => { banner.value = null }, 7000)
}

// ── Feed ────────────────────────────────────────────────────────────────
const FEED_CAP = 150
const feed = computed(() =>
  [...visibleMarkers.value]
    .sort((a, b) => {
      const r = MAP_COLOR_RANK[colorOf(a)] - MAP_COLOR_RANK[colorOf(b)]
      if (r) return r
      return (Date.parse(b.updatedAt ?? '') || 0) - (Date.parse(a.updatedAt ?? '') || 0)
    })
    .slice(0, FEED_CAP),
)

function pick(m: MarkerSpec) {
  activeId.value = m.id
  mapRef.value?.openMarker(m.id)
  emit('select', m)
}

function onMapClick(p: { layer: string; feature: any }) {
  if (p.layer === 'markers' && p.feature?.id) {
    activeId.value = p.feature.id
    emit('select', p.feature as MarkerSpec)
  }
}

// ── Fullscreen (wraps the HUD + feed, not just the map) ─────────────────
function onFsChange() {
  isFullscreen.value = document.fullscreenElement === shellEl.value
}
function toggleFullscreen() {
  const el = shellEl.value
  if (!el) return
  if (document.fullscreenElement) document.exitFullscreen?.()
  else el.requestFullscreen?.()
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFsChange)
  clockTimer = setInterval(() => { clock.value = Date.now() }, 5000)
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFsChange)
  if (clockTimer) clearInterval(clockTimer)
  if (bannerTimer) clearTimeout(bannerTimer)
})

const mapHeight = computed(() => (isFullscreen.value ? '100%' : props.height))
</script>

<template>
  <div ref="shellEl" class="gm-shell" :class="{ 'is-fullscreen': isFullscreen, 'feed-closed': !feedOpen }">
    <!-- HUD -->
    <div class="gm-hud" role="region" aria-label="Live map status">
      <div class="gm-status" :class="`is-${status}`" :title="live.lastError.value || undefined">
        <span class="um-live-dot" :class="{ 'is-live': status === 'live' }" />
        <span class="gm-status-label">{{ statusLabel }}</span>
      </div>
      <span class="gm-updated" aria-live="polite">{{ updatedLabel }}</span>

      <div class="gm-stats">
        <span class="gm-stat"><b>{{ markers.length }}</b> {{ noun }}</span>
        <span v-if="urgentCount" class="gm-stat gm-stat--urgent"><b>{{ urgentCount }}</b> critical</span>
      </div>

      <div class="gm-controls">
        <label class="gm-interval" title="Refresh interval">
          <span class="sr-only">Refresh interval</span>
          <select v-model.number="intervalModel" aria-label="Refresh interval">
            <option v-for="i in INTERVALS" :key="i.ms" :value="i.ms">every {{ i.label }}</option>
          </select>
        </label>
        <button type="button" class="gm-btn" :disabled="live.refreshing.value" title="Refresh now" aria-label="Refresh now" @click="live.refresh()">
          <RefreshCw :size="14" :class="{ 'gm-spin': live.refreshing.value }" aria-hidden="true" />
        </button>
        <button type="button" class="gm-btn" :title="live.paused.value ? 'Resume live updates' : 'Pause live updates'" :aria-label="live.paused.value ? 'Resume live updates' : 'Pause live updates'" :aria-pressed="live.paused.value" @click="live.toggle()">
          <Play v-if="live.paused.value" :size="14" aria-hidden="true" />
          <Pause v-else :size="14" aria-hidden="true" />
        </button>
        <button type="button" class="gm-btn" :title="feedOpen ? 'Hide feed' : 'Show feed'" :aria-label="feedOpen ? 'Hide feed' : 'Show feed'" @click="feedOpen = !feedOpen">
          <PanelRightClose v-if="feedOpen" :size="14" aria-hidden="true" />
          <PanelRightOpen v-else :size="14" aria-hidden="true" />
        </button>
        <button type="button" class="gm-btn" :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'" :aria-label="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'" @click="toggleFullscreen">
          <Minimize2 v-if="isFullscreen" :size="14" aria-hidden="true" />
          <Maximize2 v-else :size="14" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Severity chips -->
    <div v-if="chips.length" class="gm-chips" role="group" aria-label="Filter by severity">
      <button
        v-for="c in chips" :key="c.color" type="button" class="gm-chip" :class="{ 'is-off': c.off }"
        :aria-pressed="!c.off" :title="c.off ? `Show ${c.label}` : `Hide ${c.label}`" @click="toggleColor(c.color)"
      >
        <span class="gm-chip-dot" :style="{ background: c.hex }" />
        <span>{{ c.label }}</span>
        <b>{{ c.count }}</b>
      </button>
    </div>

    <div v-if="live.lastError.value && status === 'error'" class="gm-alert" role="alert">
      Live feed unavailable - showing the last known data. Retrying automatically.
    </div>

    <div class="gm-body">
      <div class="gm-map">
        <UaptsMap
          ref="mapRef"
          :markers="visibleMarkers"
          :roads="roads"
          :center="center"
          :zoom="zoom"
          :height="mapHeight"
          show-map-toolbar
          hide-fullscreen
          @markers-synced="onSynced"
          @feature-click="onMapClick"
        />
        <Transition name="gm-banner">
          <div v-if="banner" class="gm-banner" role="status" :style="{ '--tone': MAP_COLORS[banner.tone] }">
            <span class="gm-banner-dot" />
            {{ banner.text }}
          </div>
        </Transition>
      </div>

      <aside v-show="feedOpen" class="gm-feed" aria-label="Live feed">
        <div class="gm-feed-head">
          <span>{{ feedTitle }}</span>
          <span class="gm-feed-count">{{ visibleMarkers.length }}</span>
        </div>
        <ul v-if="feed.length" class="gm-feed-list">
          <li v-for="m in feed" :key="m.id">
            <button type="button" class="gm-item" :class="{ 'is-active': activeId === m.id }" @click="pick(m)">
              <span class="gm-item-dot" :style="{ background: MAP_COLORS[colorOf(m)] }" />
              <span class="gm-item-main">
                <span class="gm-item-title">{{ m.title ?? m.id }}</span>
                <span v-if="m.subtitle" class="gm-item-sub">{{ m.subtitle }}</span>
              </span>
              <span v-if="isNew(m.id)" class="gm-new">NEW</span>
            </button>
          </li>
        </ul>
        <p v-else class="gm-feed-empty">Nothing to show for the current filters.</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.gm-shell {
  display: flex; flex-direction: column; gap: 8px;
  background: var(--surface-2, #fff);
}
.gm-shell.is-fullscreen { padding: 12px; height: 100vh; background: var(--bg, #EEF1F5); }
.gm-shell.is-fullscreen .gm-body { flex: 1; min-height: 0; }
.gm-shell.is-fullscreen .gm-map { height: 100%; }

.gm-hud {
  display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px;
  padding: 8px 10px;
  border: 1px solid var(--border-strong, #C3CDDA); border-radius: var(--r-md, 6px);
  background: var(--surface-1, #F6F8FA);
}
.gm-status {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 3px 10px 3px 8px; border-radius: var(--r-pill, 999px);
  font-size: 10px; font-weight: 700; letter-spacing: .08em;
  color: var(--success-fg, #146C33); background: var(--success-bg, rgba(20,108,51,.12));
}
.gm-status.is-paused, .gm-status.is-connecting { color: var(--fg-2, #3F4C5C); background: var(--surface-sunken, #E4E9F0); }
.gm-status.is-paused .um-live-dot, .gm-status.is-connecting .um-live-dot { background: var(--fg-3, #5B6773); }
.gm-status.is-stale { color: var(--warning-fg, #8A5A00); background: var(--warning-bg, rgba(138,90,0,.12)); }
.gm-status.is-stale .um-live-dot { background: var(--map-warn); }
.gm-status.is-error { color: var(--danger-fg, #B42318); background: var(--danger-bg, rgba(180,35,24,.12)); }
.gm-status.is-error .um-live-dot { background: var(--map-danger); }

.gm-updated, .gm-stat { font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace; font-size: 11px; color: var(--fg-3, #5B6773); font-variant-numeric: tabular-nums; }
.gm-stats { display: flex; gap: 12px; }
.gm-stat b { color: var(--fg-1, #111823); font-weight: 600; }
.gm-stat--urgent, .gm-stat--urgent b { color: var(--danger-fg, #B42318); }
.gm-controls { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.gm-interval select {
  height: 28px; padding: 0 8px; font: inherit; font-size: 11px;
  color: var(--fg-2, #3F4C5C); background: var(--surface-2, #fff);
  border: 1px solid var(--border-interactive, #AEB9C8); border-radius: var(--r-sm, 4px);
}
.gm-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; cursor: pointer;
  color: var(--fg-2, #3F4C5C); background: var(--surface-2, #fff);
  border: 1px solid var(--border-interactive, #AEB9C8); border-radius: var(--r-sm, 4px);
  transition: background .12s, color .12s;
}
.gm-btn:hover:not(:disabled) { background: var(--surface-quiet, #EAEEF3); color: var(--primary, #0D4C8B); }
.gm-btn:focus-visible, .gm-chip:focus-visible, .gm-item:focus-visible { outline: 2px solid var(--primary, #0D4C8B); outline-offset: 1px; }
.gm-btn:disabled { opacity: .6; cursor: default; }
.gm-spin { animation: gm-spin .8s linear infinite; }
@keyframes gm-spin { to { transform: rotate(360deg); } }

.gm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.gm-chip {
  display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px;
  font: inherit; font-size: 11px; font-weight: 600; cursor: pointer;
  color: var(--fg-1, #111823); background: var(--surface-2, #fff);
  border: 1px solid var(--border-strong, #C3CDDA); border-radius: var(--r-pill, 999px);
  transition: opacity .12s, background .12s;
}
.gm-chip b { font-family: 'JetBrains Mono', ui-monospace, monospace; font-weight: 600; color: var(--fg-3, #5B6773); font-variant-numeric: tabular-nums; }
.gm-chip:hover { background: var(--surface-quiet, #EAEEF3); }
.gm-chip.is-off { opacity: .5; }
.gm-chip.is-off .gm-chip-dot { background: transparent !important; box-shadow: inset 0 0 0 1.5px var(--fg-3, #5B6773); }
.gm-chip-dot { width: 9px; height: 9px; border-radius: 50%; }

.gm-alert {
  padding: 6px 10px; font-size: 12px; border-radius: var(--r-sm, 4px);
  color: var(--danger-fg, #B42318); background: var(--danger-bg, rgba(180,35,24,.12));
}

.gm-body { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 8px; align-items: stretch; }
.feed-closed .gm-body { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 1000px) { .gm-body { grid-template-columns: minmax(0, 1fr); } }
.gm-map { position: relative; min-width: 0; }

.gm-banner {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 1100;
  display: inline-flex; align-items: center; gap: 8px; max-width: 80%;
  padding: 7px 14px; font-size: 12px; font-weight: 600;
  color: var(--map-chrome-fg); background: var(--map-chrome-bg);
  border: 1px solid var(--tone, var(--map-chrome-border)); border-radius: var(--r-pill, 999px);
  box-shadow: var(--map-chrome-shadow);
}
.gm-banner-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tone); flex-shrink: 0; }
.gm-banner-enter-active, .gm-banner-leave-active { transition: opacity .25s, transform .25s; }
.gm-banner-enter-from, .gm-banner-leave-to { opacity: 0; transform: translate(-50%, -8px); }

.gm-feed {
  display: flex; flex-direction: column; min-height: 0; max-height: v-bind(mapHeight);
  border: 1px solid var(--border-strong, #C3CDDA); border-radius: var(--r-md, 6px);
  background: var(--surface-2, #fff); overflow: hidden;
}
.is-fullscreen .gm-feed { max-height: none; }
.gm-feed-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: var(--fg-3, #5B6773); border-bottom: 1px solid var(--border-subtle, #D9E0EA);
}
.gm-feed-count { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; color: var(--fg-1, #111823); }
.gm-feed-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.gm-item {
  display: flex; align-items: flex-start; gap: 9px; width: 100%; padding: 9px 12px;
  text-align: left; font: inherit; cursor: pointer; color: inherit;
  background: transparent; border: 0; border-bottom: 1px solid var(--border-subtle, #D9E0EA);
  transition: background .1s;
}
.gm-item:hover { background: var(--surface-quiet, #EAEEF3); }
.gm-item.is-active { background: var(--primary-wash, rgba(13,76,139,.08)); }
.gm-item-dot { width: 9px; height: 9px; margin-top: 4px; border-radius: 50%; flex-shrink: 0; }
.gm-item-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.gm-item-title { font-size: 12px; font-weight: 600; color: var(--fg-1, #111823); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gm-item-sub { font-size: 11px; color: var(--fg-3, #5B6773); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gm-new {
  align-self: center; padding: 1px 6px; font-size: 9px; font-weight: 700; letter-spacing: .06em;
  color: #fff; background: var(--primary, #0D4C8B); border-radius: var(--r-pill, 999px);
}
.gm-feed-empty { padding: 16px 12px; font-size: 12px; color: var(--fg-3, #5B6773); }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .gm-spin { animation: none; } }
</style>
