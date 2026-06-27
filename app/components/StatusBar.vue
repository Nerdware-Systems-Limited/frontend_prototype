<template>
  <!--
    StatusBar - wireframe's .status-bar pattern.
    Row of agency online/offline indicators (green/red dots).
  -->
  <div class="status-bar">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Wrapper. Children should be <div class="stat"><span class="dot" />Name</div>.
</script>
