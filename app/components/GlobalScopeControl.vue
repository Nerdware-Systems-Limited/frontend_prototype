<template>
  <!--
    GlobalScopeControl - the system-wide period + county, in the top bar.
    It sets the DEFAULT every module follows until its user picks their own.
  -->
  <div ref="root" class="gsc">
    <button
      ref="btn" type="button" class="gsc-btn" :class="{ 'gsc-btn--on': global.isActive.value }"
      aria-haspopup="dialog" :aria-expanded="open" :title="`Global filter: ${summary}`"
      @click="toggle"
    >
      <SlidersHorizontal :size="14" aria-hidden="true" />
      <span class="gsc-label">{{ summary }}</span>
    </button>

    <!-- Teleported: the top bar is overflow:hidden (it clips anything absolutely positioned inside
         it), so the panel lives on <body> and is placed from the button's position instead. -->
    <Teleport to="body">
    <div v-if="open" ref="pop" class="gsc-pop" role="dialog" aria-label="Global filter" :style="popStyle">
      <p class="gsc-help">Applies to every module you haven't filtered yourself.</p>
      <div class="gsc-row">
        <TimeRangeSelector :range="editor" default-open @change="applyRange" />
      </div>
      <div class="gsc-row">
        <CountySelect :scope="countyEditor" @change="applyCounty" />
      </div>
      <button v-if="global.isActive.value" type="button" class="gsc-clear" @click="clearAll">Clear global filter</button>
    </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { SlidersHorizontal } from 'lucide-vue-next'
import { PRESET_LABEL, rangeBounds, type RangePreset } from '~/utils/timeRange'
import { useGlobalScope } from '~/composables/useGlobalScope'
import { useTimeRange } from '~/composables/useTimeRange'
import { useCountyScope } from '~/composables/useCountyScope'

const global = useGlobalScope()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const btn = ref<HTMLButtonElement | null>(null)
const pop = ref<HTMLElement | null>(null)
const popStyle = ref<Record<string, string>>({})

// Fixed position under the button, right-aligned to it and kept inside the viewport.
function place() {
  const b = btn.value
  if (!b) return
  const r = b.getBoundingClientRect()
  popStyle.value = {
    top: `${Math.round(r.bottom + 8)}px`,
    right: `${Math.max(8, Math.round(window.innerWidth - r.right))}px`,
  }
}
function toggle() {
  open.value = !open.value
  if (open.value) place()
}

// Editors with their own state: they let the shared TimeRangeSelector / CountySelect drive
// this control, and each change is copied into the global store.
const editor = useTimeRange('global-control', { default: '7d', years: true, custom: true })
const countyEditor = useCountyScope('global-control')

const summary = computed(() => {
  const r = global.range.value
  const range = !r ? null : r.mode === 'year' ? `Year ${r.year}` : r.mode === 'custom' ? rangeBounds(r).label : PRESET_LABEL[r.mode as RangePreset]
  return [range, global.county.value].filter(Boolean).join(' · ') || 'All data'
})

function applyRange() { global.setRange(editor.selection.value) }
function applyCounty() { global.setCounty(countyEditor.county.value) }
function clearAll() {
  global.clear()
  editor.reset()
  countyEditor.reset()
}

function onDocClick(e: MouseEvent) {
  const t = e.target as Node
  // The panel is teleported out of `root`, so "inside" means the button wrapper OR the panel.
  if (open.value && !root.value?.contains(t) && !pop.value?.contains(t)) open.value = false
}
function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && open.value) open.value = false }
onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', place)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', place)
})
</script>

<style scoped>
.gsc { position: relative; }
.gsc-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; max-width: 220px;
  font: 600 12px/1 var(--font-ui); cursor: pointer; white-space: nowrap;
  color: rgba(255, 255, 255, .9); background: rgba(255, 255, 255, .08);
  border: 1px solid rgba(255, 255, 255, .22); border-radius: var(--r-sm);
}
.gsc-btn:hover { background: rgba(255, 255, 255, .16); }
.gsc-btn--on { background: var(--accent); color: var(--accent-fg); border-color: var(--accent-dark); }
.gsc-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.gsc-label { overflow: hidden; text-overflow: ellipsis; }
.gsc-pop {
  position: fixed; z-index: 1300; width: max-content; max-width: min(92vw, 460px);
  display: flex; flex-direction: column; gap: 10px; padding: 12px;
  color: var(--fg-1); background: var(--surface-2);
  border: 1px solid var(--border-strong); border-radius: var(--r-lg); box-shadow: var(--elev-3);
}
.gsc-help { margin: 0; font-size: 11px; color: var(--fg-3); }
.gsc-row { display: flex; }
.gsc-clear {
  align-self: flex-start; border: 0; background: transparent; padding: 2px 0; cursor: pointer;
  font: 600 11px/1 var(--font-ui); color: var(--danger-fg); text-decoration: underline; text-underline-offset: 2px;
}
@media (max-width: 700px) { .gsc-label { display: none; } }
</style>
