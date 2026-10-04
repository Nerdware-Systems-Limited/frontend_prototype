<template>
  <!--
    SideDrawer - right-hand panel over a scrim for secondary tasks that should
    not navigate away (previews, history). Modal: focus moves into the panel
    on open, Tab stays inside it, Esc / the × / a click on the scrim close it,
    and focus returns to whatever opened it.
  -->
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="drawer-root">
        <div class="drawer-scrim" aria-hidden="true" @click="emit('close')" />
        <aside
          ref="panel" class="drawer-panel" role="dialog" aria-modal="true" :aria-labelledby="titleId"
          tabindex="-1" @keydown="onKeydown"
        >
          <header class="drawer-header">
            <div class="drawer-heading">
              <h2 :id="titleId" class="drawer-title">{{ title }}</h2>
              <p v-if="subtitle" class="drawer-subtitle">{{ subtitle }}</p>
            </div>
            <button type="button" class="drawer-close" aria-label="Close" @click="emit('close')"><X :size="16" aria-hidden="true" /></button>
          </header>
          <div v-if="$slots.toolbar" class="drawer-toolbar"><slot name="toolbar" /></div>
          <div class="drawer-body"><slot /></div>
          <footer v-if="$slots.footer" class="drawer-footer"><slot name="footer" /></footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{ open: boolean; title: string; subtitle?: string }>()
const emit = defineEmits<{ close: [] }>()

const titleId = `drawer-title-${Math.random().toString(36).slice(2, 8)}`
const panel = ref<HTMLElement | null>(null)
let returnFocus: HTMLElement | null = null

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    returnFocus = document.activeElement as HTMLElement | null
    nextTick(() => panel.value?.focus())
  } else {
    returnFocus?.focus?.()
    returnFocus = null
  }
}, { immediate: true })

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); emit('close'); return }
  if (e.key !== 'Tab' || !panel.value) return
  const items = [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)]
  if (!items.length) return
  const first = items[0]!
  const last = items[items.length - 1]!
  if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

onBeforeUnmount(() => { if (props.open) returnFocus?.focus?.() })
</script>

<style scoped>
.drawer-root { position: fixed; inset: 0; z-index: 1000; display: flex; justify-content: flex-end; }
.drawer-scrim { position: absolute; inset: 0; background: var(--scrim); }
.drawer-panel {
  position: relative; display: flex; flex-direction: column;
  width: min(440px, 100%); height: 100%;
  background: var(--surface-2); border-left: 1px solid var(--border-strong); box-shadow: var(--elev-3);
  outline: none;
}
.drawer-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 16px 18px 14px; border-bottom: 1px solid var(--border-subtle); background: var(--surface-1);
}
.drawer-title { margin: 0; font-size: 15px; font-weight: 700; color: var(--fg-1); letter-spacing: -.01em; }
.drawer-subtitle { margin: 3px 0 0; font-size: 12px; color: var(--fg-3); }
.drawer-close {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 30px; height: 30px; padding: 0; border: 1px solid transparent; border-radius: var(--r-sm);
  background: transparent; color: var(--fg-3); cursor: pointer;
}
.drawer-close:hover { color: var(--fg-1); border-color: var(--border-interactive); background: var(--surface-quiet); }
.drawer-close:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.drawer-toolbar { padding: 12px 18px; border-bottom: 1px solid var(--border-subtle); }
.drawer-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px 18px 18px; }
.drawer-footer { padding: 12px 18px; border-top: 1px solid var(--border-subtle); background: var(--surface-1); }

.drawer-enter-active, .drawer-leave-active { transition: opacity var(--dur-base) var(--ease-out); }
.drawer-enter-active .drawer-panel, .drawer-leave-active .drawer-panel { transition: transform var(--dur-base) var(--ease-out); }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer-panel, .drawer-leave-to .drawer-panel { transform: translateX(24px); }
</style>
