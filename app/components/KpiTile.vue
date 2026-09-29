<template>
  <!--
    Label / big mono number / sub-label, same visual footprint as
    KpiCard.vue but with an explicit tri-state: loading / unavailable / ok.
    A failed fetch must never render as "0" - that's a real number meaning
    "confirmed zero", not "we don't know". Introduced for the Integration
    Hub redesign; KpiCard itself is left alone since other pages rely on
    its always-a-value contract.
  -->
  <div class="kpi-tile">
    <div class="kpi-tile-label">{{ label }}</div>
    <div v-if="state === 'loading'" class="kpi-tile-skeleton" aria-hidden="true" />
    <div v-else-if="state === 'unavailable'" class="kpi-tile-value kpi-tile-value--unavailable">-</div>
    <div v-else class="kpi-tile-value">{{ value }}</div>
    <div v-if="state === 'unavailable'" class="kpi-tile-sub kpi-tile-sub--unavailable">Unavailable</div>
    <div v-else-if="sub" class="kpi-tile-sub">{{ sub }}</div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  value?: string | number
  sub?: string
  state?: 'loading' | 'ok' | 'unavailable'
}>(), { value: '', sub: '', state: 'ok' })
</script>

<style scoped>
.kpi-tile {
  background: var(--surface-1); border: 1px solid var(--border-subtle); border-radius: var(--r-md);
  padding: 14px 16px; box-shadow: var(--elev-1);
}
.kpi-tile-label { font-size: 11px; color: var(--fg-3); font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
.kpi-tile-value {
  font-family: var(--font-mono); font-variant-numeric: tabular-nums;
  font-size: 24px; font-weight: 700; color: var(--fg-1); margin-top: 6px; line-height: 1.15;
}
.kpi-tile-value--unavailable { color: var(--fg-3); }
.kpi-tile-sub { font-size: 11px; color: var(--fg-3); margin-top: 3px; }
.kpi-tile-sub--unavailable { color: var(--danger-fg); }

.kpi-tile-skeleton {
  height: 24px; width: 60%; margin-top: 6px; border-radius: var(--r-xs);
  background: var(--border-subtle); animation: pulse 1.4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .kpi-tile-skeleton { animation-duration: 2.8s; }
}
</style>
