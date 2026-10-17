<template>
  <nav class="ov-links" :aria-label="label">
    <NuxtLink v-for="l in visible" :key="l.to" :to="l.to" class="ov-link">
      <span class="ov-link-title">{{ l.title }}</span>
      <span class="ov-link-desc">{{ l.desc }}</span>
      <ArrowRight :size="14" aria-hidden="true" class="ov-link-arrow" />
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'

// Detail pages a module overview points at; only the ones the viewer may open are shown.
const props = defineProps<{ links: { to: string; title: string; desc: string }[]; label?: string }>()
const { canAccessRoute } = useAccessControl()
const visible = computed(() => props.links.filter(l => canAccessRoute(l.to)))
</script>

<style scoped>
.ov-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px; }
.ov-link { position: relative; display: flex; flex-direction: column; gap: 2px; padding: 12px 36px 12px 14px; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--surface); text-decoration: none; color: inherit; }
.ov-link:hover { border-color: var(--border); }
.ov-link-title { font-size: 13px; font-weight: 600; color: var(--fg-1); }
.ov-link-desc { font-size: 12px; color: var(--fg-3); }
.ov-link-arrow { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--fg-3); }
</style>
