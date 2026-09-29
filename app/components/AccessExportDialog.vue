<template>
  <!-- Export permissions: pick a format for the selected agency's effective access. Same themed modal shell as ConfirmDialog. -->
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true" :aria-labelledby="titleId" @keydown.esc="emit('close')">
      <div class="modal-header">
        <span :id="titleId">Export permissions</span>
        <button type="button" class="modal-close" aria-label="Close" @click="emit('close')"><X :size="16" aria-hidden="true" /></button>
      </div>
      <div class="modal-body">
        <p class="export-intro">{{ agencyName }}: pages, data categories and capabilities{{ includesUnsaved ? ', including unsaved changes' : '' }}.</p>
        <fieldset class="export-formats">
          <legend class="filter-label">Format</legend>
          <label v-for="(f, i) in FORMATS" :key="f.value" class="export-option">
            <input
              :ref="(el) => { if (i === 0) firstRadio = el as HTMLInputElement | null }"
              v-model="format" type="radio" name="export-format" :value="f.value"
            />
            <span class="export-option-text">
              <span class="export-option-label">{{ f.label }}</span>
              <span class="export-option-hint">{{ f.hint }}</span>
            </span>
          </label>
        </fieldset>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" @click="emit('close')">Cancel</button>
        <button type="button" class="btn-primary" @click="emit('export', format)">Export</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

export type ExportFormat = 'csv' | 'json' | 'pdf'

const props = defineProps<{ open: boolean; agencyName: string; includesUnsaved: boolean }>()
const emit = defineEmits<{ close: []; export: [ExportFormat] }>()

const FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: 'csv', label: 'CSV', hint: 'One row per page, for spreadsheets' },
  { value: 'json', label: 'JSON', hint: 'Pages, categories and capabilities, for systems' },
  { value: 'pdf', label: 'PDF', hint: "Opens your browser's print dialog; choose Save as PDF" },
]

const titleId = `export-title-${Math.random().toString(36).slice(2, 8)}`
const format = ref<ExportFormat>('csv')
const firstRadio = ref<HTMLInputElement | null>(null)

watch(() => props.open, (isOpen) => {
  if (isOpen) nextTick(() => firstRadio.value?.focus())
})
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
  padding: 14px 18px; font-weight: 600; font-size: 15px;
  border-bottom: 1px solid var(--border-subtle);
}
.modal-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; background: none; border: 0; border-radius: var(--r-sm);
  color: var(--fg-3); cursor: pointer;
}
.modal-close:hover { color: var(--fg-1); background: var(--surface-quiet); }
.modal-body { padding: 18px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--border-subtle); background: var(--surface-1); border-radius: 0 0 var(--r-lg) var(--r-lg); }
.export-intro { margin: 0 0 14px; font-size: 12.5px; color: var(--fg-2); line-height: 1.5; }
.export-formats { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.export-formats legend { margin-bottom: 6px; padding: 0; }
.export-option {
  display: flex; align-items: flex-start; gap: 10px; padding: 9px 11px; cursor: pointer;
  border: 1px solid var(--border-subtle); border-radius: var(--r-sm);
  transition: border-color var(--dur-fast) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard);
}
.export-option:hover { border-color: var(--border-interactive); }
.export-option:has(input:checked) { border-color: var(--primary); background: var(--primary-wash); }
.export-option input { margin-top: 2px; accent-color: var(--primary-fill); }
.export-option-text { display: flex; flex-direction: column; gap: 1px; }
.export-option-label { font-size: 12.5px; font-weight: 600; color: var(--fg-1); }
.export-option-hint { font-size: 11.5px; color: var(--fg-3); }
</style>
