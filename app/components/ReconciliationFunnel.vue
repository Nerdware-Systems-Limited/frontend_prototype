<template>
  <!--
    declared -> parsed -> valid -> written (file uploads) or
    received -> attempted -> written (API feeds) — same component either
    way, driven entirely by the stages/branches props. The spine of both
    the file-detail page and the API-feed page (design doc §1.2).
  -->
  <div class="funnel">
    <template v-for="(stage, i) in stages" :key="stage.label">
      <div class="funnel-stage">
        <div class="funnel-value" :class="stage.variant && stage.variant !== 'default' ? stage.variant : ''">
          {{ formatNum(stage.value) }}
        </div>
        <div class="funnel-label">{{ stage.label }}</div>
      </div>
      <div v-if="i < stages.length - 1" class="funnel-arrow" aria-hidden="true">→</div>
    </template>

    <div v-if="branches && branches.length" class="funnel-branches">
      <div
        v-for="b in branches" :key="b.label" class="funnel-branch"
        :class="b.variant && b.variant !== 'default' ? b.variant : ''"
      >
        <span class="funnel-branch-value">{{ formatNum(b.value) }}</span> {{ b.label }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type FunnelStage = { label: string; value: number; variant?: 'default' | 'success' | 'warning' | 'danger' }

defineProps<{
  stages: FunnelStage[]
  branches?: FunnelStage[]
}>()

function formatNum(n: number): string {
  return n.toLocaleString('en-KE')
}
</script>

<style scoped>
.funnel { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 4px; padding: 14px 0; }
.funnel-stage { display: flex; flex-direction: column; align-items: center; min-width: 76px; }
.funnel-value {
  font-family: var(--font-mono); font-variant-numeric: tabular-nums;
  font-size: 20px; font-weight: 700; color: var(--fg-1); line-height: 1.2;
}
.funnel-value.success { color: var(--success-fg); }
.funnel-value.warning { color: var(--warning-fg); }
.funnel-value.danger { color: var(--danger-fg); }
.funnel-label { font-size: 11px; color: var(--fg-3); margin-top: 2px; text-align: center; }
.funnel-arrow { font-size: 16px; color: var(--border-strong); padding: 0 6px; margin-top: 4px; }

.funnel-branches {
  flex-basis: 100%; display: flex; gap: 16px; flex-wrap: wrap;
  margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-subtle);
}
.funnel-branch { font-size: 12px; color: var(--fg-2); }
.funnel-branch-value { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-weight: 700; }
.funnel-branch.warning .funnel-branch-value { color: var(--warning-fg); }
.funnel-branch.danger .funnel-branch-value { color: var(--danger-fg); }
</style>
