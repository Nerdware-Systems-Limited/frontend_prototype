<template>
  <!--
    Source chip - small pill indicating where data came from.
    Wireframes use:
      <span class="src-chip live" title="KeNHA Weighbridge API">Live API</span>
      <span class="src-chip batch" title="KeNHA RAMS Excel">Manual/Batch</span>
  -->
  <span :class="['src-chip', variant]" :title="title">
    <slot>{{ defaultLabel }}</slot>
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** "live" = real-time feed, "batch" = manual/batch upload, "manual" alias for batch */
  variant?: 'live' | 'batch' | 'manual'
  title?: string
}>(), {
  variant: 'live',
  title: '',
})

const defaultLabel = computed(() => {
  if (props.variant === 'live') return 'Live API'
  return 'Manual/Batch'
})
</script>
