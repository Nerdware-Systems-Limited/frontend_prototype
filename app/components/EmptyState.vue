<template>
  <!--
    EmptyState - shared "nothing here yet" treatment.
    Replaces the app's inconsistent mix of bare "-", bare "0", silent blank
    boxes, and stuck "Loading..." text with one sentence-based pattern
    (originally proven in Query Builder / Flight Log / Waterways).
  -->
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <div v-if="loading" class="empty-state-spinner" aria-hidden="true" />
    <svg
      v-else class="empty-state-icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true"
    >
      <path v-if="icon === 'search'" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
      <path v-else-if="icon === 'inbox'" d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
      <path v-else d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
    <span class="empty-state-message"><slot>{{ message }}</slot></span>
    <span v-if="$slots.action" class="empty-state-action"><slot name="action" /></span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /** Sentence shown when no default slot content is given, e.g. "No flights match the current filters." */
  message?: string
  /** true while data is still loading - shows a spinner instead of the icon */
  loading?: boolean
  icon?: 'dataset' | 'search' | 'inbox'
  /** Smaller footprint for use inside a chart/panel rather than a full page section */
  compact?: boolean
}>(), {
  message: 'Nothing here yet.',
  loading: false,
  icon: 'dataset',
  compact: false,
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 200px;
  padding: 24px;
  color: var(--fg-3, #94a3b8);
  font-size: 13px;
  text-align: center;
  line-height: 1.5;
}
.empty-state-message { max-width: 32ch; }
.empty-state--compact { min-height: 100px; padding: 16px; gap: 8px; font-size: 12px; }
.empty-state-icon { width: 32px; height: 32px; flex-shrink: 0; opacity: 0.7; }
.empty-state--compact .empty-state-icon { width: 22px; height: 22px; }
.empty-state-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-subtle, #e2e8f0);
  border-top-color: var(--primary, #0D4C8B);
  border-radius: 50%;
  animation: empty-state-spin 0.7s linear infinite;
}
.empty-state-action { margin-top: 2px; }
@keyframes empty-state-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .empty-state-spinner { animation-duration: 1.4s; }
}
</style>
