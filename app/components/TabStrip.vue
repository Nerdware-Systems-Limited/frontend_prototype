<template>
  <!--
    Generic section-tab switcher. No reusable Tabs component existed
    before this - every page that needed a mode switch hand-rolled its
    own (see query-builder.vue's .mode-tab, the closest prior art, whose
    visual pattern this borrows).
  -->
  <div ref="strip" class="tab-strip" role="tablist" @keydown="onKeydown">
    <button
      v-for="t in tabs" :key="t.key" type="button" role="tab"
      class="tab-strip-tab" :class="{ active: modelValue === t.key, disabled: t.disabled }"
      :aria-selected="modelValue === t.key" :aria-disabled="t.disabled"
      :tabindex="modelValue === t.key ? 0 : -1"
      :title="t.disabled ? t.disabledReason : undefined"
      @click="!t.disabled && emit('update:modelValue', t.key)"
    >
      {{ t.label }}
      <span v-if="t.count !== undefined" class="tab-strip-count">{{ t.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  tabs: { key: string; label: string; count?: number; disabled?: boolean; disabledReason?: string }[]
  modelValue: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

// WAI-ARIA tabs: one tab stop for the strip; Left/Right/Home/End move the
// selection across the enabled tabs and take focus with it.
const strip = ref<HTMLElement | null>(null)
function onKeydown(e: KeyboardEvent) {
  const enabled = props.tabs.filter(t => !t.disabled)
  if (!enabled.length) return
  const at = enabled.findIndex(t => t.key === props.modelValue)
  let next = -1
  if (e.key === 'ArrowRight') next = (at + 1) % enabled.length
  else if (e.key === 'ArrowLeft') next = (at - 1 + enabled.length) % enabled.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = enabled.length - 1
  if (next < 0) return
  e.preventDefault()
  const key = enabled[next]!.key
  emit('update:modelValue', key)
  const i = props.tabs.findIndex(t => t.key === key)
  nextTick(() => strip.value?.querySelectorAll<HTMLElement>('[role="tab"]')[i]?.focus())
}
</script>

<style scoped>
/* Scrolls sideways when the tabs outgrow a narrow screen instead of being
   clipped by the card/page; the scrollbar is hidden, the swipe still works. */
.tab-strip {
  display: flex; gap: 4px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 14px;
  overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none;
}
.tab-strip::-webkit-scrollbar { display: none; }
.tab-strip-tab {
  background: none; border: none; border-bottom: 2px solid transparent;
  padding: 8px 4px; margin-bottom: -1px; font-size: 13px; font-weight: 500;
  color: var(--fg-3); cursor: pointer; display: flex; align-items: center; gap: 6px;
  flex-shrink: 0; white-space: nowrap;
  transition: color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
.tab-strip-tab:hover:not(.active):not(.disabled) { color: var(--fg-1); }
.tab-strip-tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.tab-strip-tab:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.tab-strip-tab.disabled { cursor: not-allowed; opacity: 0.5; }
.tab-strip-tab.disabled:hover { color: var(--fg-3); }
.tab-strip-count {
  font-size: 11px; font-variant-numeric: tabular-nums; background: var(--surface-sunken); color: var(--fg-2);
  border-radius: var(--r-pill); padding: 1px 7px; font-weight: 600;
}
.tab-strip-tab.active .tab-strip-count { background: var(--primary-fill); color: #fff; }
</style>
