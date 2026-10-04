<template>
  <!--
    VizBreakdown - a measure split by category, largest first.
      xs  the top category and its share ("of N")
      s   the top 4 bars
      m   all bars, one hue (it's magnitude, not identity), value at the tip
      l   + each category's share of the total
    Top-N folding ("Other (n)") happens in the binding. No per-category
    colours: a colour slot by rank would repaint categories whenever a filter
    reorders them (dataviz: colour follows the entity, never its rank).
  -->
  <div v-if="size === 'xs'" class="vb-head">
    <template v-if="rows.length">
      <span class="vb-head-val">{{ formatCell(rows[0]![mKey], measure) }}</span>
      <span class="vb-head-lbl">{{ rows[0]!.label }}<template v-if="share(rows[0]!) != null"> · {{ pct(share(rows[0]!)) }}</template></span>
      <span class="vb-head-of">of {{ formatValue(frame.meta.total, 'count') }} {{ frame.meta.total === 1 ? 'category' : 'categories' }}</span>
    </template>
  </div>

  <VizShell
    v-else :frame="frame" :size="size" :summary="summary"
    key-field="category" :selectable="selectable" :is-picked="isPicked" :is-dimmed="isDimmed"
    @pick="k => emit('pick', k)"
  >
    <!-- s / m / l: horizontal bars (s shows the top 4) -->
    <ul class="vb-bars" :aria-label="summary">
      <li
        v-for="r in shown" :key="String(r.category)" class="vb-row"
        :class="{ 'is-dim': isDimmed(String(r.category)), 'is-picked': isPicked(String(r.category)) }"
      >
        <component
          :is="pickable(r) ? 'button' : 'span'" :type="pickable(r) ? 'button' : undefined" class="vb-label"
          :aria-pressed="pickable(r) ? isPicked(String(r.category)) : undefined"
          :title="String(r.label)" @click="pickable(r) && emit('pick', String(r.category))"
        >{{ r.label }}</component>
        <span class="vb-track">
          <span class="vb-bar" :style="{ width: barWidth(r) }" />
        </span>
        <span class="vb-val">{{ formatCell(r[mKey], measure) }}</span>
        <span v-if="size === 'l'" class="vb-share">{{ pct(share(r)) }}</span>
      </li>
    </ul>
  </VizShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Frame, FrameField } from '~/types/frame'
import { OTHER } from '~/utils/bindings'
import { formatCell, type SizeClass } from '~/utils/viz'
import { formatNumber, formatValue } from '~/utils/units'
import VizShell from './VizShell.vue'

const props = withDefaults(defineProps<{
  frame: Frame
  size: SizeClass
  title?: string
  selectable?: boolean
  isPicked?: (key: string) => boolean
  isDimmed?: (key: string) => boolean
}>(), { title: 'Breakdown', selectable: false, isPicked: () => false, isDimmed: () => false })

const emit = defineEmits<{ pick: [key: string] }>()

const measure = computed<FrameField>(() => props.frame.fields.find(f => f.kind === 'measure') ?? { key: 'value', label: 'Value', kind: 'measure' })
const mKey = computed(() => measure.value.key)
const rows = computed(() => props.frame.rows)
const num = (r: Record<string, unknown>) => (r[mKey.value] as number | null) ?? null

/** Share only makes sense when every value is a non-negative part of a whole. */
const total = computed(() => {
  const vals = rows.value.map(num)
  if (vals.some(v => v != null && v < 0)) return null
  const sum = vals.reduce<number>((s, v) => s + (v ?? 0), 0)
  return sum > 0 ? sum : null
})
const share = (r: Record<string, unknown>) => {
  const v = num(r)
  return v == null || total.value == null ? null : (v / total.value) * 100
}
const pct = (v: number | null) => (v == null ? '-' : `${formatNumber(v, v < 10 ? 1 : 0)}%`)

const maxVal = computed(() => Math.max(0, ...rows.value.map(r => num(r) ?? 0)))
const barWidth = (r: Record<string, unknown>) => {
  const v = num(r)
  return v == null || maxVal.value <= 0 ? '0%' : `${Math.max(0.5, (Math.max(v, 0) / maxVal.value) * 100)}%`
}
const shown = computed(() => (props.size === 's' ? rows.value.slice(0, 4) : rows.value))

const pickable = (r: Record<string, unknown>) => props.selectable && r.category !== OTHER

const summary = computed(() => {
  const top = rows.value[0]
  const lead = top ? ` Largest: ${top.label}, ${formatCell(top[mKey.value], measure.value)}.` : ''
  return `${props.title}: ${measure.value.label} across ${props.frame.meta.total} categories.${lead}`
})
</script>

<style scoped>
.vb-head { display: flex; flex-direction: column; gap: 2px; height: 100%; justify-content: center; min-width: 0; }
.vb-head-val { font-family: var(--font-mono); font-size: 22px; font-weight: 600; color: var(--fg-1); line-height: 1.1; }
.vb-head-lbl { font-size: 11px; color: var(--fg-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vb-head-of { font-size: 10px; color: var(--fg-3); }

.vb-bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; height: 100%; overflow-y: auto; }
.vb-row {
  display: grid; grid-template-columns: minmax(64px, 34%) 1fr auto; align-items: center; gap: 8px; min-height: 18px;
  transition: opacity var(--dur-fast) var(--ease-standard);
}
.vb-row:has(.vb-share) { grid-template-columns: minmax(64px, 30%) 1fr auto 40px; }
.vb-label {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;
  font-size: 11px; color: var(--fg-2); background: none; border: 0; padding: 0;
}
button.vb-label { cursor: pointer; }
.vb-label:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.vb-track { display: block; height: 12px; }
/* <= 24px thick, 4px rounded data-end, square at the baseline */
.vb-bar { display: block; height: 100%; background: var(--viz-1); border-radius: 0 4px 4px 0; }
.vb-val, .vb-share { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 11px; text-align: right; white-space: nowrap; }
.vb-val { color: var(--fg-1); }
.vb-share { color: var(--fg-3); }

.is-dim { opacity: .35; }
.vb-row.is-picked .vb-label { color: var(--primary); font-weight: 600; }
@media (hover: hover) and (pointer: fine) {
  button.vb-label:hover { color: var(--primary); }
}
</style>
