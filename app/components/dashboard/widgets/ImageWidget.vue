<template>
  <figure v-if="src && !failed" class="iw">
    <img class="iw-img" :src="src" :alt="alt" :style="{ objectFit: fit }" loading="lazy" referrerpolicy="no-referrer" @error="failed = true">
    <figcaption v-if="caption" class="iw-cap">{{ caption }}</figcaption>
  </figure>
  <p v-else class="iw-empty">
    {{ !raw ? 'No image yet. Paste an https:// image link in the inspector.' : failed ? 'The image could not be loaded.' : 'This address can’t be used. Use an https:// link.' }}
  </p>
</template>

<script setup lang="ts">
import type { WidgetInstance } from '~/types/dashboard'
import { safeImageUrl } from '~/utils/safeUrl'

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const failed = ref(false)
const raw = computed(() => String(props.config.url ?? '').trim())
const src = computed(() => safeImageUrl(raw.value))
const alt = computed(() => String(props.config.alt ?? ''))
const caption = computed(() => String(props.config.caption ?? ''))
const fit = computed(() => (props.config.fit === 'cover' ? 'cover' : 'contain'))
watch(src, () => { failed.value = false })
</script>

<style scoped>
.iw { margin: 0; height: 100%; display: flex; flex-direction: column; gap: 6px; }
.iw-img { flex: 1; min-height: 0; width: 100%; display: block; }
.iw-cap { font-size: 11px; color: var(--fg-3); text-align: center; }
.iw-empty { margin: 0; font-size: 11.5px; color: var(--fg-3); }
</style>
