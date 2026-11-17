<template>
  <!--
    SectionTitle - wireframe's .section-title with optional .st-pill badge.
  -->
  <!-- A real level-2 heading, so a page outline runs h1 (PageHeader) -> h2 -> h3 without a gap. -->
  <h2 class="section-title">
    <slot />
    <span v-if="pill" class="st-pill">{{ pill }}</span>
  </h2>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ pill?: string }>(), { pill: '' })
</script>
