<template>
  <!--
    BadgePill - wireframe's .badge / .iri-pill / .alert-badge etc.
    Use variant="success" | "warning" | "danger" | "info" | "neutral"
    or "very-good" | "good" | "fair" | "poor" | "vpoor" for IRI road-condition pills.
  -->
  <span :class="cls">
    <slot />
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: string
}>(), { variant: 'neutral' })

const cls = computed(() => {
  const v = props.variant
  // Pass-through classes already defined in theme.css
  const allowed = [
    'success', 'warning', 'danger', 'info', 'neutral',
    'very-good', 'good', 'fair', 'poor', 'vpoor',
    'critical', 'blue', 'cyan', 'red', 'amber',
  ]
  if (allowed.includes(v)) return `badge ${v === 'neutral' ? '' : v}`
  return 'badge'
})
</script>
