<template>
  <!--
    The selected widget as JSON - the power-user view of what is stored in
    the dashboard definition. Apply checks the shape first; the id is fixed.
  -->
  <div class="wj">
    <p class="wj-note">Exactly what is saved for this widget. The id <code>{{ widget.id }}</code> can't change.</p>
    <textarea
      v-model="text" class="wj-text" spellcheck="false" rows="18" aria-label="Widget JSON"
      :aria-invalid="!!problem" @keydown.ctrl.enter.prevent="applyJson" @keydown.meta.enter.prevent="applyJson"
    />
    <p v-if="problem" class="wj-problem" role="alert">{{ problem }}</p>
    <div class="wj-actions">
      <button type="button" class="btn btn-sm" :disabled="!edited" @click="reset">Discard</button>
      <button type="button" class="btn btn-sm btn-primary" :disabled="!edited" title="Apply (Ctrl+Enter)" @click="applyJson">Apply</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WidgetInstance } from '~/types/dashboard'
import { parseWidgetJson } from '~/utils/widgetValidation'

const props = defineProps<{ widget: WidgetInstance }>()
const emit = defineEmits<{ change: [WidgetInstance] }>()

const pretty = (w: WidgetInstance) => {
  const { id: _id, ...rest } = w
  return JSON.stringify(rest, null, 2)
}
const text = ref(pretty(props.widget))
const problem = ref<string | null>(null)
const edited = computed(() => text.value !== pretty(props.widget))

// Follow outside edits (canvas drags, other tabs) unless the author is mid-edit.
let lastSeen = pretty(props.widget)
watch(() => props.widget, (w) => {
  const next = pretty(w)
  if (text.value === lastSeen) { text.value = next; problem.value = null }
  lastSeen = next
}, { deep: true })

function reset() { text.value = pretty(props.widget); problem.value = null }
function applyJson() {
  const r = parseWidgetJson(text.value, props.widget.id)
  if ('error' in r) { problem.value = r.error; return }
  problem.value = null
  emit('change', r.widget)
}
</script>

<style scoped>
.wj { display: flex; flex-direction: column; gap: 8px; }
.wj-note { font-size: 11.5px; color: var(--fg-3); margin: 0; line-height: 1.5; }
.wj-note code { font-family: var(--font-mono); font-size: 10.5px; color: var(--fg-2); }
.wj-text {
  font-family: var(--font-mono); font-size: 11px; line-height: 1.55; padding: 8px; resize: vertical; tab-size: 2;
  background: var(--surface-1); color: var(--fg-1); min-height: 240px;
}
.wj-text[aria-invalid="true"] { border-color: var(--danger-fg); }
.wj-problem { font-size: 11.5px; color: var(--danger-fg); margin: 0; line-height: 1.5; }
.wj-actions { display: flex; justify-content: flex-end; gap: 6px; }
</style>
