<template>
  <h2 v-if="variant === 'heading'" class="tw-heading">{{ text }}</h2>
  <div v-else-if="variant === 'section'" class="tw-section">{{ text }}</div>
  <p v-else class="tw-note">{{ text }}</p>
</template>

<script setup lang="ts">
import type { WidgetInstance } from '~/types/dashboard'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
// Plain text only - rendered as text nodes, never v-html, so a dashboard
// author can't inject markup into every viewer's page.
const text = computed(() => String(props.config.text ?? ''))
const variant = computed(() => String(props.config.variant ?? 'section') as 'heading' | 'section' | 'note')
</script>

<style scoped>
.tw-heading { font-size: 16px; font-weight: 700; color: var(--fg-1); margin: 0; letter-spacing: -.01em; }
/* Matches the Command Centre's .section-label rule-after style. */
.tw-section {
  display: flex; align-items: center; gap: 10px; height: 100%;
  font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--fg-3);
}
.tw-section::after { content: ''; flex: 1; height: 1px; background: var(--border-subtle); }
.tw-note { font-size: 12px; color: var(--fg-2); line-height: 1.55; margin: 0; max-width: 80ch; }
</style>
