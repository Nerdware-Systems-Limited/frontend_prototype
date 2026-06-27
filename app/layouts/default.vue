<template>
  <!--
    Default layout - top nav (fixed) + sidebar (fixed) + main content.
    Ported from the wireframe's index.html <body> structure:
      <nav class="top-nav"> (fixed top)
      <aside class="sidebar"> (fixed left, below topnav)
      <main class="main-content"> (margin-left = sidebar-w, margin-top = nav-h)
  -->
  <div>
    <AppTopNav />
    <AppSidebar />
    <main class="main-content animate-fade-in">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
// The wireframe's body class triggers the sidebar collapse animation.
// We mirror that here so the existing theme.css rules still apply.
useHead({
  bodyAttrs: {
    class: '',
  },
})
</script>
