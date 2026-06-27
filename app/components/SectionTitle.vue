<template>
  <!--
    SectionTitle - wireframe's .section-title with optional .st-pill badge.
  -->
  <div class="section-title">
    <slot />
    <span v-if="pill" class="st-pill">{{ pill }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ pill?: string }>(), { pill: '' })
</script>
