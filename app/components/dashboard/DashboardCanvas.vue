<template>
  <!--
    DashboardCanvas - the editable grid. Used by the admin editor (mode
    "edit") and by viewers customizing their own copy (mode "personal":
    move / resize / hide only - no adding, deleting or config changes).

    Widgets render LIVE inside (real data, real filters) under a shield that
    swallows clicks, so what you arrange is exactly what viewers get.

    Mouse/touch: drag the grip to move, the corner to resize.
    Keyboard:   Tab to a widget, arrows move, Shift+arrows resize,
                Delete removes (edit) / hides (personal), Esc deselects.
  -->
  <div
    ref="canvasEl" class="dc" :class="{ 'dc--dragging': !!drag, 'dc--dropping': dropCell }"
    :style="{ '--row-h': `${rowHeight}px`, '--gap': `${gap}px`, '--cols': GRID_COLUMNS, minHeight: `${canvasMinHeight}px` }"
    @dragover.prevent="onDragOver" @dragleave="dropCell = null" @drop.prevent="onDrop"
    @pointerdown.self="emit('select', null)"
  >
    <!-- column guides -->
    <div class="dc-guides" aria-hidden="true">
      <span v-for="c in GRID_COLUMNS" :key="c" />
    </div>

    <div
      v-for="w in rendered" :key="w.id"
      class="dc-cell" :class="{ selected: w.id === selectedId, hidden: w.hidden, moving: drag?.id === w.id }"
      :style="cellStyle(w)"
      tabindex="0" role="group"
      :aria-label="`${labelFor(w)}, column ${w.x + 1}, row ${w.y + 1}, ${w.w} by ${w.h}${w.hidden ? ', hidden' : ''}`"
      @focus="emit('select', w.id)" @keydown="onKey($event, w)"
    >
      <WidgetFrame :instance="w" class="dc-content" />
      <div class="dc-shield" @pointerdown="emit('select', w.id)" />

      <div class="dc-toolbar">
        <button type="button" class="dc-grip" title="Drag to move" aria-hidden="true" tabindex="-1" @pointerdown.stop.prevent="startDrag($event, w, 'move')"><GripVertical :size="13" /></button>
        <span class="dc-name">{{ labelFor(w) }}</span>
        <button
          v-if="mode === 'personal'" type="button" class="dc-btn dc-btn--text" :aria-label="`${w.hidden ? 'Show' : 'Hide'} ${labelFor(w)}`"
          @click.stop="toggleHidden(w)"
        ><component :is="w.hidden ? Eye : EyeOff" :size="12" aria-hidden="true" />{{ w.hidden ? 'Show' : 'Hide' }}</button>
        <template v-else>
          <button type="button" class="dc-btn" title="Duplicate" :aria-label="`Duplicate ${labelFor(w)}`" @click.stop="emit('duplicate', w.id)"><Copy :size="12" aria-hidden="true" /></button>
          <button type="button" class="dc-btn dc-btn--danger" title="Remove" :aria-label="`Remove ${labelFor(w)}`" @click.stop="emit('remove', w.id)"><X :size="13" aria-hidden="true" /></button>
        </template>
      </div>
      <div class="dc-resize" title="Drag to resize" aria-hidden="true" @pointerdown.stop.prevent="startDrag($event, w, 'resize')" />
    </div>

    <!-- landing preview while dragging / dropping from the palette -->
    <div v-if="ghost" class="dc-ghost" :style="cellStyle(ghost)" aria-hidden="true" />

    <div v-if="!widgets.length && !dropCell" class="dc-empty">
      <strong>Nothing on the canvas yet</strong>
      <span>Drag a widget from the catalog, or click one to add it.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Copy, Eye, EyeOff, GripVertical, X } from 'lucide-vue-next'
import { GRID_COLUMNS, type WidgetInstance } from '~/types/dashboard'
import { WIDGETS_BY_TYPE } from '~/utils/widgetRegistry'
import { bottom, clampBox, settle } from '~/utils/layoutEngine'
import WidgetFrame from '~/components/dashboard/WidgetFrame.vue'

const props = withDefaults(defineProps<{
  widgets: WidgetInstance[]
  rowHeight: number
  gap: number
  selectedId?: string | null
  mode?: 'edit' | 'personal'
}>(), { selectedId: null, mode: 'edit' })

const emit = defineEmits<{
  'update:widgets': [WidgetInstance[]]
  select: [string | null]
  remove: [string]
  duplicate: [string]
  add: [type: string, at: { x: number; y: number }]
}>()

const canvasEl = ref<HTMLElement | null>(null)
const { width: canvasWidth } = useElementSize(canvasEl)

const labelFor = (w: WidgetInstance) => w.title || WIDGETS_BY_TYPE[w.type]?.title || w.type
const minFor = (w: WidgetInstance) => WIDGETS_BY_TYPE[w.type]?.minSize ?? { w: 1, h: 1 }
const colW = computed(() => (canvasWidth.value + props.gap) / GRID_COLUMNS)
const rowStep = computed(() => props.rowHeight + props.gap)

// ── drag state ──────────────────────────────────────────────────────────
interface DragState { id: string; kind: 'move' | 'resize'; startX: number; startY: number; origin: WidgetInstance; preview: WidgetInstance[] }
const drag = shallowRef<DragState | null>(null)
const rendered = computed(() => drag.value?.preview ?? props.widgets)
const ghost = computed<WidgetInstance | null>(() => {
  if (drag.value) return rendered.value.find(w => w.id === drag.value!.id) ?? null
  return dropCell.value
})
const canvasMinHeight = computed(() => (bottom(rendered.value) + 4) * rowStep.value)

function cellStyle(w: Pick<WidgetInstance, 'x' | 'y' | 'w' | 'h'>) {
  return { gridColumn: `${w.x + 1} / span ${w.w}`, gridRow: `${w.y + 1} / span ${w.h}` }
}

function startDrag(e: PointerEvent, w: WidgetInstance, kind: 'move' | 'resize') {
  emit('select', w.id)
  drag.value = { id: w.id, kind, startX: e.clientX, startY: e.clientY, origin: { ...w }, preview: props.widgets }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', endDrag, { once: true })
  window.addEventListener('pointercancel', cancelDrag, { once: true })
}

function onMove(e: PointerEvent) {
  const d = drag.value
  if (!d) return
  const dx = Math.round((e.clientX - d.startX) / colW.value)
  const dy = Math.round((e.clientY - d.startY) / rowStep.value)
  const o = d.origin
  const next = d.kind === 'move'
    ? clampBox({ ...o, x: o.x + dx, y: o.y + dy }, minFor(o))
    : clampBox({ ...o, w: o.w + dx, h: o.h + dy }, minFor(o))
  if (d.kind === 'resize' && next.x + next.w > GRID_COLUMNS) next.w = GRID_COLUMNS - next.x
  const cur = d.preview.find(x => x.id === d.id)!
  if (cur.x === next.x && cur.y === next.y && cur.w === next.w && cur.h === next.h) return
  const base = props.widgets.map(x => (x.id === d.id ? next : x))
  drag.value = { ...d, preview: settle(base, d.id) }
}

function endDrag() {
  window.removeEventListener('pointermove', onMove)
  const d = drag.value
  drag.value = null
  if (d && d.preview !== props.widgets) emit('update:widgets', d.preview)
}
function cancelDrag() { window.removeEventListener('pointermove', onMove); drag.value = null }
onUnmounted(cancelDrag)

// ── drop from palette ───────────────────────────────────────────────────
const dropCell = ref<WidgetInstance | null>(null)
function cellAt(e: DragEvent, w: number, h: number) {
  const rect = canvasEl.value!.getBoundingClientRect()
  const x = Math.floor((e.clientX - rect.left) / colW.value)
  const y = Math.floor((e.clientY - rect.top) / rowStep.value)
  return clampBox({ id: '__drop__', type: '', x, y, w, h })
}
function onDragOver(e: DragEvent) {
  if (props.mode !== 'edit') return
  const type = [...(e.dataTransfer?.types ?? [])].find(t => t.startsWith('application/x-uapts-widget+'))
  if (!type) return
  const def = WIDGETS_BY_TYPE[type.split('+')[1]!]
  if (!def) return
  e.dataTransfer!.dropEffect = 'copy'
  dropCell.value = cellAt(e, def.defaultSize.w, def.defaultSize.h)
}
function onDrop(e: DragEvent) {
  const type = e.dataTransfer?.getData('application/x-uapts-widget')
  const at = dropCell.value
  dropCell.value = null
  if (type && at && props.mode === 'edit') emit('add', type, { x: at.x, y: at.y })
}

// ── keyboard ────────────────────────────────────────────────────────────
function onKey(e: KeyboardEvent, w: WidgetInstance) {
  const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  if (arrows[e.key]) {
    e.preventDefault()
    const [dx, dy] = arrows[e.key]!
    const next = e.shiftKey
      ? clampBox({ ...w, w: w.w + dx, h: w.h + dy }, minFor(w))
      : clampBox({ ...w, x: w.x + dx, y: w.y + dy }, minFor(w))
    if (next.x + next.w > GRID_COLUMNS) next.w = GRID_COLUMNS - next.x
    emit('update:widgets', settle(props.widgets.map(x => (x.id === w.id ? next : x)), w.id))
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    if (props.mode === 'personal') toggleHidden(w)
    else emit('remove', w.id)
  } else if (e.key === 'Escape') {
    emit('select', null);
    (e.target as HTMLElement).blur()
  }
}

function toggleHidden(w: WidgetInstance) {
  emit('update:widgets', props.widgets.map(x => (x.id === w.id ? { ...x, hidden: !x.hidden } : x)))
}
</script>

<style scoped>
.dc {
  position: relative; display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  grid-auto-rows: var(--row-h); gap: var(--gap);
  padding: 0; border-radius: var(--radius);
}
.dc-guides {
  position: absolute; inset: 0; display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: var(--gap);
  pointer-events: none; opacity: 0; transition: opacity var(--dur-fast) var(--ease-standard);
}
.dc-guides span { background: var(--primary-wash); border-radius: var(--r-xs); }
.dc--dragging .dc-guides, .dc--dropping .dc-guides { opacity: 1; }

.dc-cell {
  position: relative; min-width: 0; min-height: 0; border-radius: var(--radius);
  outline: 1px dashed var(--border-subtle); outline-offset: 2px;
  transition: outline-color var(--dur-fast) var(--ease-standard);
}
.dc--dragging .dc-cell:not(.moving) { transition: none; }
.dc-cell.selected { outline: 2px solid var(--primary); outline-offset: 2px; z-index: 5; }
.dc-cell:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.dc-cell.hidden .dc-content { opacity: .25; filter: grayscale(1); }
.dc-cell.moving { opacity: .55; z-index: 10; }
.dc-content { height: 100%; }
.dc-shield { position: absolute; inset: 0; z-index: 2; cursor: pointer; }

.dc-toolbar {
  position: absolute; top: -12px; left: 8px; right: 8px; z-index: 6;
  display: flex; align-items: center; gap: 2px; height: 24px; padding: 0 3px;
  background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: var(--r-sm); box-shadow: var(--elev-1);
  opacity: 0; transform: translateY(3px); pointer-events: none;
  transition: opacity 140ms var(--ease-out), transform 140ms var(--ease-out);
}
.dc-cell.selected .dc-toolbar, .dc-cell:focus-within .dc-toolbar { opacity: 1; transform: none; pointer-events: auto; }
.dc-grip {
  display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 18px;
  cursor: grab; border: 0; background: none; color: var(--fg-3); padding: 0; border-radius: var(--r-xs); touch-action: none;
}
.dc--dragging .dc-grip { cursor: grabbing; }
.dc-name { flex: 1; min-width: 0; font-size: 10.5px; font-weight: 600; color: var(--fg-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dc-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 20px; height: 18px; padding: 0 3px;
  border: 0; background: none; color: var(--fg-3); font-size: 10.5px; font-weight: 600; cursor: pointer; border-radius: var(--r-xs);
  transition: background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
.dc-btn--text { padding: 0 6px; }
.dc-btn:focus-visible, .dc-grip:focus-visible { outline: 2px solid var(--primary); outline-offset: 0; }
@media (hover: hover) {
  .dc-cell:hover { outline-color: var(--border-interactive); }
  .dc-cell:hover .dc-toolbar { opacity: 1; transform: none; pointer-events: auto; }
  .dc-cell:hover .dc-resize { opacity: 1; }
  .dc-grip:hover { background: var(--surface-quiet); color: var(--fg-1); }
  .dc-btn:hover { background: var(--surface-quiet); color: var(--fg-1); }
  .dc-btn--danger:hover { background: var(--danger-bg); color: var(--danger-fg); }
}
/* Touch has no hover: keep the controls reachable on the selected widget only (above). */
@media (prefers-reduced-motion: reduce) {
  .dc-toolbar { transition: opacity 140ms linear; transform: none; }
}

.dc-resize {
  position: absolute; right: -4px; bottom: -4px; width: 14px; height: 14px; z-index: 6; cursor: nwse-resize; touch-action: none;
  border-right: 2px solid var(--primary); border-bottom: 2px solid var(--primary); border-radius: 0 0 var(--r-xs) 0;
  opacity: 0; transition: opacity 140ms var(--ease-out);
}
.dc-cell.selected .dc-resize { opacity: 1; }

.dc-ghost {
  border: 2px dashed var(--primary); background: var(--primary-wash); border-radius: var(--radius);
  pointer-events: none; z-index: 1;
}
.dc-empty {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  border: 2px dashed var(--border-subtle); border-radius: var(--radius); color: var(--fg-3); font-size: 12px; pointer-events: none;
}
.dc-empty strong { color: var(--fg-2); font-size: 13px; }
</style>
