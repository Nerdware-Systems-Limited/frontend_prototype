<template>
  <aside class="wp" aria-label="Widget catalog">
    <div class="wp-search">
      <Search :size="14" class="wp-search-icon" aria-hidden="true" />
      <input v-model="q" type="search" placeholder="Search widgets…" aria-label="Search widgets" @keydown.esc="q = ''">
    </div>
    <div v-for="group in groups" :key="group.category" class="wp-group">
      <div class="wp-group-label">{{ group.category }}</div>
      <button
        v-for="w in group.items" :key="w.type" type="button" class="wp-item"
        draggable="true" :title="w.description"
        @dragstart="onDragStart($event, w.type)" @click="emit('add', w.type)"
      >
        <span class="wp-item-title">{{ w.title }}</span>
        <span class="wp-item-desc">{{ w.description }}</span>
        <span class="wp-item-meta">
          <span class="wp-size">{{ w.defaultSize.w }}×{{ w.defaultSize.h }}</span>
          <span v-if="w.emits?.length" class="wp-tag"><MousePointerClick :size="11" aria-hidden="true" />Clickable</span>
          <span v-if="w.requiredPermissions?.length" class="wp-tag" :title="`Needs ${w.requiredPermissions.join(' or ')}`"><Lock :size="11" aria-hidden="true" />{{ w.requiredPermissions.join(' / ') }}</span>
        </span>
      </button>
    </div>
    <p v-if="!groups.length" class="wp-none">No widget matches “{{ q }}”.</p>
  </aside>
</template>

<script setup lang="ts">
import { Lock, MousePointerClick, Search } from 'lucide-vue-next'
import type { WidgetCategory } from '~/types/dashboard'
import { WIDGETS } from '~/utils/widgetRegistry'

const emit = defineEmits<{ add: [type: string] }>()
const q = ref('')
const ORDER: WidgetCategory[] = ['KPIs', 'Charts', 'Maps', 'Operations', 'Agency', 'Layout']

const groups = computed(() => {
  const term = q.value.trim().toLowerCase()
  const hits = WIDGETS.filter(w => !term || `${w.title} ${w.description} ${w.category}`.toLowerCase().includes(term))
  return ORDER.map(category => ({ category, items: hits.filter(w => w.category === category) })).filter(g => g.items.length)
})

function onDragStart(e: DragEvent, type: string) {
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('application/x-uapts-widget', type)
  // readable during dragover (getData isn't), so the canvas can size its ghost
  e.dataTransfer.setData(`application/x-uapts-widget+${type}`, '')
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
.wp-none { font-size: 11.5px; color: var(--fg-3); }
</style>
