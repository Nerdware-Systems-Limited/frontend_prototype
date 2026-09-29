<template>
  <!--
    Thin wrapper around theme.css's .progress/.progress-bar - this was
    previously hand-rolled three separate times (infrastructure/maintenance.vue,
    infrastructure/projects.vue, UploadModal.vue's byte-upload bar), each
    with its own near-identical markup. One component from here on.
  -->
  <div
    class="progress" role="progressbar"
    :aria-label="label" :aria-valuenow="clamped" aria-valuemin="0" aria-valuemax="100"
  >
    <div class="progress-bar" :class="variant !== 'default' ? variant : ''" :style="{ width: clamped + '%' }" />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** 0-100. Values outside that range are clamped. */
  pct: number
  variant?: 'default' | 'success' | 'warning' | 'danger'
  label?: string
}>(), { variant: 'default' })

const clamped = computed(() => Math.max(0, Math.min(100, props.pct)))
</script>
