<template>
  <!--
    ConfirmDialog - themed replacement for window.confirm(), controlled by
    the parent (open/busy are props, not local state) so the parent's async
    action owns the loading/error handling exactly as it did before.
  -->
  <div v-if="open" class="modal-backdrop" @click.self="onCancel">
    <div class="modal" role="alertdialog" aria-modal="true" :aria-labelledby="titleId" aria-describedby="confirm-message">
      <div class="modal-header">
        <span :id="titleId">{{ title }}</span>
        <button class="modal-close" :disabled="busy" @click="onCancel">×</button>
      </div>
      <div class="modal-body">
        <p id="confirm-message" class="confirm-message">{{ message }}</p>
      </div>
      <div class="modal-footer">
        <button ref="cancelBtn" class="btn" :disabled="busy" @click="onCancel">Cancel</button>
        <button
          :class="danger ? 'btn-danger' : 'btn-primary'"
          :disabled="busy"
          @click="$emit('confirm')"
        >{{ busy ? busyLabel : confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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

const titleId = `confirm-title-${Math.random().toString(36).slice(2, 8)}`
const cancelBtn = ref<HTMLButtonElement | null>(null)

function onCancel() {
  if (props.busy) return
  emit('cancel')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') onCancel()
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
  position: fixed; inset: 0; background: var(--scrim); z-index: 1000;
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
.modal-close { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--fg-3); line-height: 1; padding: 0 4px; }
.modal-close:hover:not(:disabled) { color: var(--fg-2); }
.modal-close:disabled { opacity: .45; cursor: not-allowed; }
.modal-body { padding: 20px; }
.confirm-message { font-size: 13.5px; line-height: 1.5; color: var(--fg-2); white-space: pre-line; margin: 0; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--border-subtle); }
</style>
