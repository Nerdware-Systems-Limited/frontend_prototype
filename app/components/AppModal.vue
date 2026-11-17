<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="modal-backdrop"
        @mousedown.self="closeOnBackdrop && close()"
      >
        <Transition name="modal-scale" appear>
          <div
            v-if="modelValue"
            ref="panel"
            class="modal-panel"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="titleId"
            :aria-describedby="subtitle ? subtitleId : undefined"
            tabindex="-1"
            :style="{ maxWidth }"
            @keydown="onPanelKeydown"
          >
            <!-- Header -->
            <div class="modal-header">
              <div class="modal-heading">
                <h2 :id="titleId" class="modal-title">{{ title }}</h2>
                <p v-if="subtitle" :id="subtitleId" class="modal-subtitle">{{ subtitle }}</p>
              </div>
              <button
                type="button"
                class="modal-close"
                aria-label="Close"
                @click="close"
              >
                <X :size="16" aria-hidden="true" />
              </button>
            </div>

            <!-- Body -->
            <div class="modal-body">
              <slot />
            </div>

            <!-- Footer (optional slot) -->
            <div v-if="$slots.footer" class="modal-footer">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  subtitle?: string
  maxWidth?: string
  closeOnBackdrop?: boolean
}>(), {
  maxWidth: '500px',
  closeOnBackdrop: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const uid = Math.random().toString(36).slice(2, 8)
const titleId = `modal-title-${uid}`
const subtitleId = `modal-subtitle-${uid}`
const panel = ref<HTMLElement | null>(null)
let returnFocus: HTMLElement | null = null

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function close() {
  emit('update:modelValue', false)
}

// Close on Escape key
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) close()
}

// Keep Tab inside the dialog while it is open.
function onPanelKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !panel.value) return
  const items = [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]!
  const last = items[items.length - 1]!
  if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

// Focus moves into the dialog on open (the first field in the body if there is
// one, else the panel itself) and back to whatever opened it on close.
function focusInside() {
  const body = panel.value?.querySelector<HTMLElement>('.modal-body')
  const field = body?.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])')
  ;(field ?? panel.value)?.focus()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  if (props.modelValue) onOpenChange(true)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  // A modal torn down while open (route change) must not leave the page unscrollable.
  if (props.modelValue) document.body.style.overflow = ''
})

// Prevent body scroll while modal is open
function onOpenChange(open: boolean) {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) {
    returnFocus = document.activeElement as HTMLElement | null
    nextTick(focusInside)
  } else {
    returnFocus?.focus?.()
    returnFocus = null
  }
}
watch(() => props.modelValue, onOpenChange)
</script>

<style scoped>
/* Same surface, scrim, radius and elevation as theme.css's .modal, so a
   component-driven dialog and a page-built one look like one system in both
   light and dark. */

/* ── Backdrop ─────────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--scrim);
}

/* ── Panel ────────────────────────────────────────────────────────────────── */
.modal-panel {
  position: relative;
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
  box-shadow: var(--elev-3);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 40px);
  overflow: hidden;
  outline: none;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-1);
  flex-shrink: 0;
}
.modal-heading { min-width: 0; }

.modal-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--fg-1);
  line-height: 1.4;
  margin: 0;
  text-wrap: balance;
}

.modal-subtitle {
  font-size: 12px;
  color: var(--fg-3);
  margin: 2px 0 0;
}

.modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  margin: -4px -6px 0 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--fg-3);
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
.modal-close:hover { background: var(--surface-quiet); border-color: var(--border-interactive); color: var(--fg-1); }

/* ── Body ─────────────────────────────────────────────────────────────────── */
.modal-body {
  padding: 18px;
  overflow-y: auto;
  flex: 1 1 auto;
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-1);
  flex-shrink: 0;
}

/* Phones: a bottom sheet, matching theme.css's .modal at the same width. */
@media (max-width: 600px) {
  .modal-backdrop { padding: 0; align-items: flex-end; }
  .modal-panel { border-radius: var(--r-lg) var(--r-lg) 0 0; max-height: 92vh; max-width: none !important; }
}

/* ── Transitions ──────────────────────────────────────────────────────────── */
.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity var(--dur-base) var(--ease-out); }
.modal-fade-enter-from,
.modal-fade-leave-to     { opacity: 0; }

.modal-scale-enter-active,
.modal-scale-leave-active { transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }
.modal-scale-enter-from,
.modal-scale-leave-to     { opacity: 0; transform: scale(.98) translateY(4px); }
</style>
