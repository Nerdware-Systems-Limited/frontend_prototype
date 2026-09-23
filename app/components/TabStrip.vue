<template>
  <!--
    Generic section-tab switcher. No reusable Tabs component existed
    before this — every page that needed a mode switch hand-rolled its
    own (see query-builder.vue's .mode-tab, the closest prior art, whose
    visual pattern this borrows).
  -->
  <div class="tab-strip" role="tablist">
    <button
      v-for="t in tabs" :key="t.key" type="button" role="tab"
      class="tab-strip-tab" :class="{ active: modelValue === t.key, disabled: t.disabled }"
      :aria-selected="modelValue === t.key" :aria-disabled="t.disabled"
      :title="t.disabled ? t.disabledReason : undefined"
      @click="!t.disabled && emit('update:modelValue', t.key)"
    >
      {{ t.label }}
      <span v-if="t.count !== undefined" class="tab-strip-count">{{ t.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tabs: { key: string; label: string; count?: number; disabled?: boolean; disabledReason?: string }[]
  modelValue: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<style scoped>
.tab-strip { display: flex; gap: 4px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 14px; }
.tab-strip-tab {
  background: none; border: none; border-bottom: 2px solid transparent;
  padding: 8px 4px; margin-bottom: -1px; font-size: 13px; font-weight: 500;
  color: var(--fg-3); cursor: pointer; display: flex; align-items: center; gap: 6px;
  transition: color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
.tab-strip-tab:hover:not(.active):not(.disabled) { color: var(--fg-1); }
.tab-strip-tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.tab-strip-tab.disabled { cursor: not-allowed; opacity: 0.5; }
.tab-strip-tab.disabled:hover { color: var(--fg-3); }
.tab-strip-count {
  font-size: 11px; background: var(--surface-sunken); color: var(--fg-2);
  border-radius: var(--r-pill); padding: 1px 7px; font-weight: 600;
}
.tab-strip-tab.active .tab-strip-count { background: var(--primary); color: #fff; }
</style>
