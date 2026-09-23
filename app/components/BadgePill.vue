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
  /** 'sm' shrinks font-size/padding for dense contexts (e.g. a table cell's secondary tag). */
  size?: 'sm' | 'md'
}>(), { variant: 'neutral', size: 'md' })

const cls = computed(() => {
  const v = props.variant
  const sizeClass = props.size === 'sm' ? ' badge-sm' : ''
  // IRI road-condition variants use a separate .iri-pill.iri-* pair in theme.css,
  // not .badge.* - they render unstyled grey if given the badge class instead.
  const iriVariants = ['very-good', 'good', 'fair', 'poor', 'vpoor']
  if (iriVariants.includes(v)) return `iri-pill iri-${v}${sizeClass}`

  // These are single hyphenated classes in theme.css (.badge-blue etc), not .badge.blue
  const hyphenated = ['blue', 'cyan', 'red', 'amber']
  if (hyphenated.includes(v)) return `badge-${v}${sizeClass}`

  // 'critical' has no dedicated style - it's semantically the same as 'danger'
  if (v === 'critical') return `badge danger${sizeClass}`

  // Pass-through classes already defined in theme.css
  const allowed = ['success', 'warning', 'danger', 'info', 'neutral']
  if (allowed.includes(v)) return `badge ${v === 'neutral' ? '' : v}${sizeClass}`
  return `badge${sizeClass}`
})
</script>
