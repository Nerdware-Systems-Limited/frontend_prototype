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
        <span class="wp-item-title">{{ w.title }}</span>
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
import { Lock, MousePointerClick, Search } from 'lucide-vue-next'
import type { WidgetCategory, WidgetSize } from '~/types/dashboard'
import { WIDGETS } from '~/utils/widgetRegistry'
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
const moduleLabel = (m: string) => (m === GENERAL ? 'General' : BASE_SETTINGS.modules[m]?.label ?? m)

/** One catalog: the hand-built widgets plus every preset on the generic primitives. */
interface Entry { key: string; title: string; description: string; category: WidgetCategory; module: string; size: WidgetSize; clickable: boolean; perms: string[]; source?: string }
const ENTRIES: Entry[] = [
  ...WIDGETS.filter(w => w.palette !== false).map(w => ({
    key: w.type, title: w.title, description: w.description, category: w.category, size: w.defaultSize,
    module: PERMISSION_MODULE[w.requiredPermissions?.[0] ?? ''] ?? GENERAL,
    clickable: !!w.emits?.length, perms: w.requiredPermissions ?? [],
  })),
  ...PRESETS.map((p) => {
    const src = SOURCES_BY_ID[p.binding.source]
    return {
      key: `preset:${p.id}`, title: p.title, description: p.description, category: p.category, size: p.defaultSize,
      module: src?.module ?? GENERAL, clickable: !!p.binding.emits, perms: src ? [src.permission] : [], source: src?.source,
    }
  }),
]

const groups = computed(() => {
  const term = q.value.trim().toLowerCase()
  const hits = ENTRIES
    .filter(w => catalogItemInScope(w.key, props.scope ?? null))
    .filter(w => !term || `${w.title} ${w.description} ${w.category} ${moduleLabel(w.module)} ${w.source ?? ''}`.toLowerCase().includes(term))
  const byCategory = (a: Entry, b: Entry) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category)
  return MODULE_ORDER
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
.wp-item-title { font-size: 12px; font-weight: 600; color: var(--fg-1); }
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
