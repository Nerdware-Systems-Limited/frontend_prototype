<template>
  <!-- First cell of a module row on the Module Access tables: the whole label is the disclosure control for the module's pages. -->
  <button type="button" class="module-toggle" :aria-expanded="expanded" @click="emit('toggle')">
    <ChevronRight :size="14" class="module-chevron" :class="{ open: expanded }" aria-hidden="true" />
    <span class="module-text">
      <span class="module-label">{{ label }}</span>
      <span class="module-meta">
        <span class="module-id">{{ moduleId }}</span>
        <span v-if="hint" class="module-hint">{{ hint }}</span>
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'

defineProps<{ moduleId: string; label: string; expanded: boolean; hint?: string | null }>()
const emit = defineEmits<{ toggle: [] }>()
</script>

<style scoped>
.module-toggle {
  display: flex; align-items: flex-start; gap: 6px; width: 100%;
  padding: 0; background: none; border: 0; text-align: left; cursor: pointer;
  font-family: inherit; color: inherit;
}
.module-toggle:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: var(--r-xs); }
.module-chevron {
  flex-shrink: 0; margin-top: 2px; color: var(--fg-3);
  transition: transform var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
.module-chevron.open { transform: rotate(90deg); }
.module-toggle:hover .module-chevron { color: var(--primary); }
.module-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.module-label { font-size: 12.5px; font-weight: 600; color: var(--fg-1); }
.module-toggle:hover .module-label { color: var(--primary); }
.module-meta { display: flex; gap: 6px; font-size: 11px; color: var(--fg-3); }
.module-id { font-family: var(--font-mono); font-size: 10.5px; }
</style>
