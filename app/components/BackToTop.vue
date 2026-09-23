<template>
  <Transition name="back-to-top-fade">
    <button
      v-if="showBackToTop" type="button" class="back-to-top-btn"
      aria-label="Back to top" title="Back to top"
      @click="scrollToTop"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  </Transition>
</template>

<script setup lang="ts">
const showBackToTop = ref(false)
function onScroll() { showBackToTop.value = window.scrollY > 800 }
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }) }
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<style scoped>
.back-to-top-btn {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 900;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-pill);
  border: 1px solid var(--border-subtle);
  background: var(--primary);
  color: var(--primary-fg);
  box-shadow: var(--elev-3);
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard);
}
.back-to-top-btn:hover { background: var(--primary-dark, var(--primary)); transform: translateY(-2px); }
.back-to-top-btn svg { width: 18px; height: 18px; }
.back-to-top-fade-enter-active, .back-to-top-fade-leave-active {
  transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out);
}
.back-to-top-fade-enter-from, .back-to-top-fade-leave-to { opacity: 0; transform: translateY(8px); }
@media (prefers-reduced-motion: reduce) {
  .back-to-top-btn { transition: none; }
  .back-to-top-fade-enter-active, .back-to-top-fade-leave-active { transition: opacity var(--dur-fast) linear; }
}
</style>
