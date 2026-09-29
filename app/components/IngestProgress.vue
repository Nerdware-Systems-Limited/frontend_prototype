<template>
  <!--
    Like ProgressBar, but accepts pct=null for "we genuinely don't know
    yet" (a file mid-read has no byte-level parse progress from the
    backend - see app/utils/ingestStatus.ts's readPct) rather than forcing
    every caller to invent a number. null renders an indeterminate sweep;
    a real number renders the normal fixed-width bar.
  -->
  <div class="ingest-progress">
    <div
      class="progress" role="progressbar"
      :aria-label="label" :aria-valuenow="pct ?? undefined" aria-valuemin="0" aria-valuemax="100"
      :aria-busy="pct === null"
    >
      <div
        v-if="pct !== null" class="progress-bar" :class="variant !== 'default' ? variant : ''"
        :style="{ transform: `scaleX(${clamped / 100})` }"
      />
      <div v-else class="progress-bar progress-indeterminate" :class="variant !== 'default' ? variant : ''" />
    </div>
    <span v-if="label" class="ingest-progress-label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  pct: number | null
  variant?: 'default' | 'success' | 'warning' | 'danger'
  label?: string
}>(), { variant: 'default', label: '' })

const clamped = computed(() => props.pct === null ? 0 : Math.max(0, Math.min(100, props.pct)))
</script>

<style scoped>
.ingest-progress { display: flex; flex-direction: column; gap: 3px; }
.ingest-progress-label { font-size: 11px; color: var(--fg-3); }

/* Override the shared .progress-bar's width-based transition (theme.css,
   used app-wide) with a transform-based one scoped to this component only -
   animating width/height causes layout thrash; scaleX doesn't. The bar
   stays 100% wide in layout at all times and is only ever visually
   compressed, so the track's overflow:hidden still clips it correctly. */
.progress-bar { width: 100%; transform-origin: left center; transition: transform var(--dur-slow) var(--ease-out); }

.progress-indeterminate {
  width: 40%;
  animation: ingest-progress-sweep 1.4s ease-in-out infinite;
}
@keyframes ingest-progress-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}
@media (prefers-reduced-motion: reduce) {
  .progress-indeterminate { animation: none; width: 100%; opacity: 0.35; }
}
</style>
