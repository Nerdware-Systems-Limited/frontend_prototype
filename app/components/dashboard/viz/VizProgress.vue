<template>
  <!--
    VizProgress - one figure against its target (a bullet bar).
      xs   the share of target as a percentage
      s+   bar from 0, a tick at the target, value / target / share as text
    With no target, a percentage still draws on 0-100; any other unit says
    "No target set" rather than inventing one. Status comes from the
    binding's threshold (never from how full the bar looks).
  -->
  <div class="vpg" :class="[`vpg--${size}`, `is-${status}`]">
    <p v-if="value == null" class="vpg-empty">{{ label }}: not reported yet</p>
    <template v-else>
      <div class="vpg-top">
        <span class="vpg-label">{{ label }}</span>
        <span class="vpg-share">{{ share == null ? formatCell(value, measure) : `${formatNumber(share, share < 10 ? 1 : 0)}%` }}</span>
      </div>
      <div
        v-if="size !== 'xs' && scaleMax != null" class="vpg-track" role="img"
        :aria-label="`${label}: ${formatCell(value, measure)}${target != null ? ` of ${formatCell(target, measure)} target` : ''}`"
      >
        <span class="vpg-fill" :style="{ width: pos(value) }" />
        <span v-if="target != null" class="vpg-target" :style="{ left: pos(target) }" aria-hidden="true" />
      </div>
      <div v-if="size !== 'xs'" class="vpg-foot">
        <span>{{ formatCell(value, measure) }}</span>
        <span v-if="target != null">{{ targetLabel }} {{ formatCell(target, measure) }}</span>
        <span v-else-if="scaleMax == null" class="vpg-muted">No target set</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Frame, FrameField } from '~/types/frame'
import type { Status } from '~/utils/thresholds'
import { formatCell, type SizeClass } from '~/utils/viz'
import { formatNumber } from '~/utils/units'

const props = withDefaults(defineProps<{
  frame: Frame
  size: SizeClass
  title?: string
  status?: Status
}>(), { title: 'Progress', status: 'neutral' })

const measure = computed<FrameField>(() => props.frame.fields.find(f => f.kind === 'measure' && f.key !== 'target') ?? { key: 'value', label: 'Value', kind: 'measure' })
const targetField = computed(() => props.frame.fields.find(f => f.key === 'target'))
const row = computed(() => props.frame.rows[0] ?? {})
const value = computed(() => (typeof row.value[measure.value.key] === 'number' ? row.value[measure.value.key] as number : null))
const target = computed(() => (targetField.value && typeof row.value.target === 'number' ? row.value.target : null))
const label = computed(() => props.title || measure.value.label)
const targetLabel = computed(() => (targetField.value?.label && targetField.value.label !== 'Target' ? targetField.value.label : 'Target'))

/** Share of target; for a percentage with no target, the value itself is the share. */
const share = computed(() => {
  if (value.value == null) return null
  if (target.value != null) return target.value > 0 ? (value.value / target.value) * 100 : null
  return measure.value.unit === 'pct' ? value.value : null
})
/** The bar's end: 110% of the larger of value and target, so both always fit. */
const scaleMax = computed(() => {
  if (target.value != null) return Math.max(target.value, value.value ?? 0) * 1.1 || null
  return measure.value.unit === 'pct' ? Math.max(100, value.value ?? 0) : null
})
const pos = (v: number) => `${Math.min(100, Math.max(0, (v / (scaleMax.value || 1)) * 100))}%`
</script>

<style scoped>
.vpg { display: flex; flex-direction: column; justify-content: center; gap: 6px; height: 100%; min-width: 0; }
.vpg-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.vpg-label { font-size: 12px; font-weight: 600; color: var(--fg-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vpg-share { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 20px; font-weight: 600; color: var(--fg-1); }
.vpg--xs .vpg-share { font-size: 22px; }
.vpg-track { position: relative; height: 14px; background: var(--surface-sunken); border-radius: 0 4px 4px 0; }
.vpg-fill { position: absolute; inset: 0 auto 0 0; background: var(--viz-1); border-radius: 0 4px 4px 0; }
.is-healthy .vpg-fill { background: var(--success-fg); }
.is-warning .vpg-fill { background: var(--warning-fg); }
.is-critical .vpg-fill { background: var(--danger-fg); }
/* the target: a hairline that reads against both fill and track */
.vpg-target { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: var(--fg-1); }
.vpg-foot { display: flex; justify-content: space-between; gap: 8px; font-size: 10.5px; color: var(--fg-2); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.vpg-muted, .vpg-empty { color: var(--fg-3); font-family: inherit; }
.vpg-empty { margin: 0; font-size: 12px; }
</style>
