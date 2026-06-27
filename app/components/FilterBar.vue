<template>
  <!--
    FilterBar - wireframe's .filter-bar pattern.
    Horizontal row of filter groups + slot for filter chips/selects.
  -->
  <div class="filter-bar">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Just a wrapper - the actual filter groups are passed as slot content.
</script>
