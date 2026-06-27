<template>
  <!--
    KpiCard - wireframe's .kpi-card pattern.
    Has a colored top stripe (auto-rotates per index, matching theme.css rules),
    optional source chip badge top-right, label, big value, sub-text, optional trend.
  -->
  <div class="kpi-card">
    <SourceChip v-if="source" :variant="source" :title="sourceTitle" class="kpi-source" />
    <div class="kpi-label"><slot name="label">{{ label }}</slot></div>
    <div class="kpi-value">
      <slot>{{ value }}</slot>
    </div>
    <div v-if="$slots.sub || sub" class="kpi-sub">
      <slot name="sub">{{ sub }}</slot>
    </div>
    <div v-if="trend" :class="['kpi-trend', trendDirection]">
      <span>{{ trendArrow }}</span> {{ trend }}
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  value?: string | number
  sub?: string
  trend?: string
  trendDirection?: 'up' | 'down'
  source?: 'live' | 'batch' | 'manual'
  sourceTitle?: string
}>(), {
  label: '',
  value: '',
  sub: '',
  trend: '',
  trendDirection: 'up',
  source: undefined,
  sourceTitle: '',
})

const trendArrow = computed(() => props.trendDirection === 'up' ? '▲' : '▼')
</script>
