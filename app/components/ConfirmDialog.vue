<template>
  <!--
    ConfirmDialog - themed replacement for window.confirm(), controlled by
    the parent (open/busy are props, not local state) so the parent's async
    action owns the loading/error handling exactly as it did before.
  -->
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="onCancel">
      <div ref="dialog" class="modal" role="alertdialog" aria-modal="true" :aria-labelledby="titleId" :aria-describedby="messageId" @keydown="onDialogKeydown">
        <div class="modal-header">
          <span :id="titleId">{{ title }}</span>
          <button type="button" class="modal-close" aria-label="Close" :disabled="busy" @click="onCancel"><X :size="16" aria-hidden="true" /></button>
        </div>
        <div class="modal-body">
          <p :id="messageId" class="confirm-message">{{ message }}</p>
        </div>
        <div class="modal-footer">
          <button ref="cancelBtn" type="button" class="btn" :disabled="busy" @click="onCancel">Cancel</button>
          <button
            type="button"
            :class="danger ? 'btn-danger' : 'btn-primary'"
            :disabled="busy"
            @click="$emit('confirm')"
          >{{ busy ? busyLabel : confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  busyLabel?: string
  danger?: boolean
  busy?: boolean
}>(), {
  confirmLabel: 'Confirm',
  busyLabel: 'Working…',
  danger: false,
  busy: false,
})

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const uid = Math.random().toString(36).slice(2, 8)
const titleId = `confirm-title-${uid}`
const messageId = `confirm-message-${uid}`
const cancelBtn = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLElement | null>(null)

function onCancel() {
  if (props.busy) return
  emit('cancel')
}

// Only while open: a closed dialog must not answer every Escape on the page.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) onCancel()
}

// Keep Tab inside the dialog while it is open.
function onDialogKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !dialog.value) return
  const items = [...dialog.value.querySelectorAll<HTMLElement>('button:not([disabled])')]
  if (!items.length) { e.preventDefault(); return }
  const first = items[0]!
  const last = items[items.length - 1]!
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

// Focus the safe (Cancel) button on open; return it to nothing in
// particular on close - the trigger that opened this dialog re-focuses
// itself via its own click handler, same as any other button press.
watch(() => props.open, (isOpen) => {
  if (isOpen) nextTick(() => cancelBtn.value?.focus())
})

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0; background: var(--scrim); z-index: 2000;
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.modal {
  background: var(--surface-2); border-radius: var(--r-lg); width: 440px; max-width: 100%;
  box-shadow: var(--elev-3); display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; font-weight: 600; font-size: 15px;
  border-bottom: 1px solid var(--border-subtle);
}
.modal-close {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 30px; height: 30px; margin: -4px -6px -4px 0; padding: 0;
  border: 1px solid transparent; border-radius: var(--r-sm); background: transparent; color: var(--fg-3); cursor: pointer;
}
.modal-close:hover:not(:disabled) { background: var(--surface-quiet); border-color: var(--border-interactive); color: var(--fg-1); }
.modal-close:disabled { opacity: .45; cursor: not-allowed; }
.modal-body { padding: 20px; }
.confirm-message { font-size: 13.5px; line-height: 1.5; color: var(--fg-2); white-space: pre-line; margin: 0; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--border-subtle); }
</style>
