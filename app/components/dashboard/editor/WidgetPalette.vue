<template>
  <aside class="wp" aria-label="Widget catalog">
    <div class="wp-search">
      <Search :size="14" class="wp-search-icon" aria-hidden="true" />
      <input v-model="q" type="search" placeholder="Search widgets…" aria-label="Search widgets" @keydown.esc="q = ''">
    </div>
    <p v-if="scope" class="wp-scope">Showing data from pages <strong>{{ scope.agency }}</strong> can open.</p>
    <div v-for="group in groups" :key="group.key" class="wp-group">
      <div class="wp-group-label">{{ group.label }}</div>
      <button
        v-for="w in group.items" :key="w.key" type="button" class="wp-item"
        draggable="true" :title="w.description"
        @dragstart="onDragStart($event, w.key)" @click="emit('add', w.key)"
      >
        <span class="wp-item-title"><component :is="w.icon" :size="14" class="wp-icon" aria-hidden="true" />{{ w.title }}</span>
        <span class="wp-item-desc">{{ w.description }}</span>
        <span class="wp-item-meta">
          <span class="wp-size">{{ w.size.w }}×{{ w.size.h }}</span>
          <span class="wp-tag">{{ w.category }}</span>
          <span v-if="w.source" class="wp-tag">{{ w.source }}</span>
          <span v-if="w.clickable" class="wp-tag"><MousePointerClick :size="11" aria-hidden="true" />Clickable</span>
          <span v-if="w.perms.length" class="wp-tag" :title="`Needs ${w.perms.join(' or ')}`"><Lock :size="11" aria-hidden="true" />{{ w.perms.join(' / ') }}</span>
        </span>
      </button>
    </div>
    <p v-if="!groups.length" class="wp-none">No widget matches “{{ q }}”.</p>
  </aside>
</template>

<script setup lang="ts">
import {
  Activity, BellRing, Building2, ChartArea, ChartBar, ChartColumn, ChartLine, Gauge, Grid3x3, Hash, Heading, LayoutDashboard,
  Image as ImageIcon, ListChecks, Lock, Map as MapIcon, MapPinned, MousePointerClick, Search, Table2, Target,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { WidgetCategory, WidgetSize } from '~/types/dashboard'
import { STARTERS, WIDGETS } from '~/utils/widgetRegistry'
import { PRESETS } from '~/utils/widgetPresets'
import { PERMISSION_MODULE, SOURCES_BY_ID } from '~/utils/dataSources'
import { BASE_SETTINGS } from '~/utils/resolveAccess'
import { catalogItemInScope, type CatalogScope } from '~/utils/agencyCatalog'

const props = defineProps<{ scope?: CatalogScope | null }>()
const emit = defineEmits<{ add: [item: string] }>()
const q = ref('')
const ORDER: WidgetCategory[] = ['KPIs', 'Charts', 'Maps', 'Operations', 'Agency', 'Layout']
const GENERAL = 'general'
/** Groups: general widgets first, then one per module in access-control order. */
const MODULE_ORDER = [GENERAL, ...Object.keys(BASE_SETTINGS.modules)]
/** Modules sources use that the access config doesn't list (yet). */
const EXTRA_MODULE_LABELS: Record<string, string> = { M16: 'Predictive analytics' }
const moduleLabel = (m: string) => (m === GENERAL ? 'General' : BASE_SETTINGS.modules[m]?.label ?? EXTRA_MODULE_LABELS[m] ?? m)

/** A schematic glyph per visual - never sample numbers (docs/Widgets.md §7). */
const ICONS: Record<string, Component> = {
  'kpi': Hash, 'stat': Hash, 'kpi-row': Gauge, 'fatality-bars': ChartColumn, 'incident-trend': ChartLine,
  'series': ChartLine, 'series:bars': ChartColumn, 'series:area': ChartArea, 'breakdown': ChartBar, 'table': Table2,
  'risk-map': MapIcon, 'alerts': BellRing, 'feed-health': Activity, 'agency-card': Building2, 'text': Heading,
  'national-command-centre': LayoutDashboard,
  'image': ImageIcon, 'starter:table': Table2, 'starter:chart': ChartColumn,
  'points': MapPinned, 'status-list': ListChecks, 'progress': Target, 'heatmap': Grid3x3,
}
const iconFor = (type: string, mode?: unknown) => ICONS[mode ? `${type}:${String(mode)}` : type] ?? ICONS[type] ?? LayoutDashboard

/** One catalog: the hand-built widgets plus every preset on the generic primitives. */
interface Entry { key: string; title: string; description: string; category: WidgetCategory; module: string; size: WidgetSize; clickable: boolean; perms: string[]; source?: string; icon: Component }
const ENTRIES: Entry[] = [
  ...WIDGETS.filter(w => w.palette !== false).map(w => ({
    key: w.type, title: w.title, description: w.description, category: w.category, size: w.defaultSize,
    module: PERMISSION_MODULE[w.requiredPermissions?.[0] ?? ''] ?? GENERAL,
    clickable: !!w.emits?.length, perms: w.requiredPermissions ?? [], icon: iconFor(w.type),
  })),
  ...STARTERS.map(st => ({
    key: `starter:${st.id}`, title: st.title, description: st.description, category: st.category, size: st.size,
    module: GENERAL, clickable: false, perms: [] as string[], icon: ICONS[`starter:${st.id}`]!,
  })),
  ...PRESETS.map((p) => {
    const src = SOURCES_BY_ID[p.binding.source]
    return {
      key: `preset:${p.id}`, title: p.title, description: p.description, category: p.category, size: p.defaultSize,
      module: src?.module ?? GENERAL, clickable: !!p.binding.emits, perms: src ? [src.permission] : [], source: src?.source,
      icon: iconFor(p.type, p.config?.mode),
    }
  }),
]

const groups = computed(() => {
  const term = q.value.trim().toLowerCase()
  const hits = ENTRIES
    .filter(w => catalogItemInScope(w.key, props.scope ?? null))
    .filter(w => !term || `${w.title} ${w.description} ${w.category} ${moduleLabel(w.module)} ${w.source ?? ''}`.toLowerCase().includes(term))
  const byCategory = (a: Entry, b: Entry) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category)
  // A module the access config doesn't list still gets a group, after the listed ones - never dropped.
  const extra = [...new Set(hits.map(w => w.module))].filter(m => !MODULE_ORDER.includes(m)).sort()
  return [...MODULE_ORDER, ...extra]
    .map(m => ({ key: m, label: moduleLabel(m), items: hits.filter(w => w.module === m).sort(byCategory) }))
    .filter(g => g.items.length)
})

function onDragStart(e: DragEvent, item: string) {
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('application/x-uapts-widget', item)
  // readable during dragover (getData isn't), so the canvas can size its ghost
  e.dataTransfer.setData(`application/x-uapts-widget+${item}`, '')
}
</script>

<style scoped>
.wp { display: flex; flex-direction: column; gap: 10px; }
.wp-search { position: relative; display: flex; align-items: center; }
.wp-search input { height: 32px; padding-left: 29px; font-size: 12px; }
.wp-search-icon { position: absolute; left: 9px; color: var(--fg-3); pointer-events: none; }
.wp-group-label { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-3); margin: 6px 0 2px; }
.wp-group { display: flex; flex-direction: column; gap: 6px; }
.wp-item {
  display: flex; flex-direction: column; gap: 4px; text-align: left; padding: 9px 10px; cursor: grab;
  background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--r-sm);
  transition: border-color var(--dur-fast) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard), transform 120ms var(--ease-out);
}
.wp-item:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.wp-item:active { cursor: grabbing; transform: scale(0.98); }
.wp-item-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--fg-1); }
.wp-icon { flex-shrink: 0; color: var(--fg-3); }
.wp-item-desc { font-size: 11px; color: var(--fg-3); line-height: 1.45; }
.wp-item-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 10px; color: var(--fg-3); }
.wp-size { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.wp-tag { display: inline-flex; align-items: center; gap: 3px; }
.wp-tag { font-family: var(--font-mono); }
@media (hover: hover) {
  .wp-item:hover { border-color: var(--primary); background: var(--primary-wash); }
}
@media (prefers-reduced-motion: reduce) {
  .wp-item:active { transform: none; }
}
.wp-scope { font-size: 11px; color: var(--fg-3); line-height: 1.45; margin: 0; }
.wp-scope strong { color: var(--fg-2); font-weight: 600; }
.wp-none { font-size: 11.5px; color: var(--fg-3); }
</style>
