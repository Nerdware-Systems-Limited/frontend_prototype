<template>
  <!--
    Vertical step timeline - real timestamps only. A step with no
    timestamp yet renders as pending with an hyphen rather than a
    fabricated time; there is no backend field for "queued at" or
    "validated at" etc., only created_at/commit_started_at/committed_at
    (see DataUpload), so this only ever renders exactly what's passed in.
  -->
  <ol class="upload-timeline">
    <li v-for="(step, i) in steps" :key="step.label" class="upload-timeline-step" :class="{ done: !!step.at }">
      <span class="upload-timeline-dot" aria-hidden="true" />
      <span v-if="i < steps.length - 1" class="upload-timeline-line" aria-hidden="true" />
      <div class="upload-timeline-body">
        <div class="upload-timeline-label">{{ step.label }}</div>
        <div class="upload-timeline-time">{{ step.at ? fmt(step.at) : '-' }}</div>
      </div>
    </li>
  </ol>
</template>

<script setup lang="ts">
defineProps<{
  steps: { label: string; at: string | null }[]
}>()

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.upload-timeline { list-style: none; margin: 0; padding: 0; }
.upload-timeline-step { position: relative; display: flex; gap: 12px; padding-bottom: 18px; }
.upload-timeline-step:last-child { padding-bottom: 0; }
.upload-timeline-dot {
  width: 10px; height: 10px; border-radius: 50%; margin-top: 3px; flex-shrink: 0;
  background: var(--surface-2); border: 2px solid var(--border-interactive);
}
.upload-timeline-step.done .upload-timeline-dot { background: var(--primary); border-color: var(--primary); }
.upload-timeline-line {
  position: absolute; left: 4px; top: 16px; bottom: -3px; width: 1px; background: var(--border-subtle);
}
.upload-timeline-body { flex: 1; }
.upload-timeline-label { font-size: 12.5px; color: var(--fg-1); font-weight: 500; }
.upload-timeline-step:not(.done) .upload-timeline-label { color: var(--fg-3); }
.upload-timeline-time { font-size: 11px; color: var(--fg-3); margin-top: 1px; }
</style>
