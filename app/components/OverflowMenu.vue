<template>
  <!--
    OverflowMenu - "•••" button with a small action menu (WAI-ARIA menu button).
    Arrow keys move between items, Enter/Space activates, Esc or a click
    outside closes and returns focus to the button. Items marked `danger`
    are drawn in the destructive colour; `separatorBefore` rules them off.
  -->
  <div ref="root" class="overflow-menu">
    <button
      ref="trigger" type="button" class="btn btn-sm menu-trigger"
      aria-haspopup="menu" :aria-expanded="open" :aria-controls="menuId" :aria-label="label" :title="label"
      @click="open ? close(false) : openMenu(0)"
      @keydown.down.prevent="openMenu(0)" @keydown.up.prevent="openMenu(items.length - 1)"
    ><MoreHorizontal :size="16" aria-hidden="true" /></button>
    <Transition name="menu-pop">
      <div v-if="open" :id="menuId" class="menu-pop" role="menu" :aria-label="label" @keydown="onMenuKeydown">
        <template v-for="(item, i) in items" :key="item.key">
          <div v-if="item.separatorBefore" class="menu-sep" role="separator" />
          <button
            :ref="(el) => { itemRefs[i] = el as HTMLButtonElement | null }"
            type="button" role="menuitem" tabindex="-1" class="menu-item" :class="{ danger: item.danger }"
            :data-key="item.key" @click="choose(item)"
          >
            <component :is="item.icon" v-if="item.icon" :size="14" aria-hidden="true" class="menu-icon" />
            <span>{{ item.label }}</span>
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, type Component } from 'vue'
import { MoreHorizontal } from 'lucide-vue-next'

export interface OverflowMenuItem {
  key: string
  label: string
  icon?: Component
  danger?: boolean
  separatorBefore?: boolean
}

const props = withDefaults(defineProps<{ items: OverflowMenuItem[]; label?: string }>(), { label: 'More actions' })
const emit = defineEmits<{ select: [string] }>()

const menuId = `overflow-menu-${Math.random().toString(36).slice(2, 8)}`
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const itemRefs = ref<(HTMLButtonElement | null)[]>([])

function focusItem(i: number) {
  const n = props.items.length
  itemRefs.value[((i % n) + n) % n]?.focus()
}
function openMenu(focusIndex: number) {
  open.value = true
  document.addEventListener('mousedown', onDocMousedown)
  nextTick(() => focusItem(focusIndex))
}
function close(refocus = true) {
  open.value = false
  document.removeEventListener('mousedown', onDocMousedown)
  if (refocus) trigger.value?.focus()
}
function choose(item: OverflowMenuItem) {
  close()
  emit('select', item.key)
}
function onDocMousedown(e: MouseEvent) {
  if (!root.value?.contains(e.target as Node)) close(false)
}
function onMenuKeydown(e: KeyboardEvent) {
  const current = itemRefs.value.indexOf(document.activeElement as HTMLButtonElement)
  if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(current + 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(current - 1) }
  else if (e.key === 'Home') { e.preventDefault(); focusItem(0) }
  else if (e.key === 'End') { e.preventDefault(); focusItem(props.items.length - 1) }
  else if (e.key === 'Escape') { e.preventDefault(); close() }
  else if (e.key === 'Tab') close(false)
}
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocMousedown))
</script>

<style scoped>
.overflow-menu { position: relative; display: inline-flex; }
.menu-trigger { display: inline-flex; align-items: center; justify-content: center; width: 30px; padding: 0; }
.menu-pop {
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 900;
  min-width: 220px; padding: 4px;
  background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: var(--r-md);
  box-shadow: var(--elev-2);
}
.menu-item {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 7px 10px; border: 0; border-radius: var(--r-sm); background: transparent;
  font-family: inherit; font-size: 12.5px; color: var(--fg-1); text-align: left; cursor: pointer;
}
.menu-icon { color: var(--fg-3); flex-shrink: 0; }
.menu-item:hover, .menu-item:focus-visible { background: var(--primary-wash); color: var(--primary); outline: none; }
.menu-item:hover .menu-icon, .menu-item:focus-visible .menu-icon { color: var(--primary); }
.menu-item.danger, .menu-item.danger .menu-icon { color: var(--danger-fg); }
.menu-item.danger:hover, .menu-item.danger:focus-visible { background: var(--danger-bg); color: var(--danger-fg); }
.menu-sep { height: 1px; margin: 4px 2px; background: var(--border-subtle); }
.menu-pop-enter-active, .menu-pop-leave-active { transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.menu-pop-enter-from, .menu-pop-leave-to { opacity: 0; transform: translateY(-4px); }
@media (max-width: 900px) {
  .menu-trigger { width: 40px; min-height: 36px; }
  .menu-item { min-height: 40px; }
}
</style>
