<template>
  <!--
    VizHeatmap - two categories x one measure (e.g. hour of day x weekday).
      xs / s  the busiest cell, in words
      m       the grid; one hue whose strength follows the value (magnitude,
              not identity), empty cells hatched, every value in a tooltip
              and in the table view
      l       + row and column totals (only for counts and sums, which add up)
  -->
  <div v-if="size === 'xs' || size === 's'" class="vh-head">
    <template v-if="peak">
      <span class="vh-head-val">{{ formatCell(peak[mKey], measure) }}</span>
      <span class="vh-head-lbl">Highest: {{ peak.yLabel }} · {{ peak.xLabel }}</span>
    </template>
    <span v-else class="vh-head-lbl">Nothing recorded yet</span>
  </div>

  <VizShell v-else :frame="frame" :size="size" :summary="summary">
    <div class="vh">
      <div class="vh-grid" role="presentation" :style="{ gridTemplateColumns: columns }">
        <span class="vh-corner" />
        <span v-for="(x, i) in xs" :key="`x-${x.key}`" class="vh-xl">{{ showX(i) ? x.label : '' }}</span>
        <span v-if="totals" class="vh-xl vh-tot-h">Total</span>

        <template v-for="y in ys" :key="`y-${y.key}`">
          <span class="vh-yl">{{ y.label }}</span>
          <span
            v-for="x in xs" :key="`${x.key}-${y.key}`" class="vh-cell" :class="{ 'is-empty': cell(x.key, y.key) == null }"
            :style="{ background: fill(cell(x.key, y.key)) }"
            :title="`${y.label} · ${x.label}: ${formatCell(cell(x.key, y.key), measure)}`"
          />
          <span v-if="totals" class="vh-tot">{{ formatCell(rowTotal(y.key), measure) }}</span>
        </template>

        <template v-if="totals">
          <span class="vh-yl">Total</span>
          <span v-for="x in xs" :key="`t-${x.key}`" class="vh-tot vh-tot-col">{{ formatCell(colTotal(x.key), measure) }}</span>
          <span class="vh-tot">{{ formatCell(grand, measure) }}</span>
        </template>
      </div>
      <div class="vh-scale" aria-hidden="true">
        <span>{{ formatCell(0, measure) }}</span><span class="vh-ramp" /><span>{{ formatCell(max, measure) }}</span>
      </div>
    </div>
  </VizShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Frame, FrameField } from '~/types/frame'
import { formatCell, type SizeClass } from '~/utils/viz'
import VizShell from './VizShell.vue'

const props = withDefaults(defineProps<{
  frame: Frame
  size: SizeClass
  title?: string
  /** Show row/column totals at l (true only when the measure adds up: counts, sums). */
  additive?: boolean
}>(), { title: 'Heatmap', additive: false })

const measure = computed<FrameField>(() => props.frame.fields.find(f => f.kind === 'measure') ?? { key: 'value', label: 'Value', kind: 'measure' })
const mKey = computed(() => measure.value.key)
const num = (v: unknown) => (typeof v === 'number' ? v : null)

const uniq = (key: 'x' | 'y') => {
  const seen = new Map<string, string>()
  for (const r of props.frame.rows) if (!seen.has(String(r[key]))) seen.set(String(r[key]), String(r[`${key}Label`]))
  return [...seen].map(([k, label]) => ({ key: k, label }))
}
const xs = computed(() => uniq('x'))
const ys = computed(() => uniq('y'))
const cells = computed(() => new Map(props.frame.rows.map(r => [`${r.x}\u0000${r.y}`, num(r[mKey.value])])))
const cell = (x: string, y: string) => cells.value.get(`${x}\u0000${y}`) ?? null
const max = computed(() => Math.max(0, ...props.frame.rows.map(r => num(r[mKey.value]) ?? 0)))

/** One hue; strength from 8% (smallest non-zero) to 100% (the maximum). Zero is the faint track. */
function fill(v: number | null): string | undefined {
  if (v == null) return undefined
  if (v <= 0 || max.value <= 0) return 'var(--surface-sunken)'
  return `color-mix(in srgb, var(--viz-1) ${Math.round(8 + 92 * (v / max.value))}%, var(--surface-1))`
}

// The busiest cell - none when every cell is zero or empty (nothing stands out).
const peak = computed(() => {
  const best = props.frame.rows.reduce<Record<string, unknown> | null>((b, r) =>
    (num(r[mKey.value]) ?? -Infinity) > (b ? (num(b[mKey.value]) ?? -Infinity) : -Infinity) ? r : b, null)
  return best && (num(best[mKey.value]) ?? 0) > 0 ? best : null
})

const totals = computed(() => props.size === 'l' && props.additive)
const sum = (vals: (number | null)[]) => (vals.some(v => v != null) ? vals.reduce<number>((s, v) => s + (v ?? 0), 0) : null)
const rowTotal = (y: string) => sum(xs.value.map(x => cell(x.key, y)))
const colTotal = (x: string) => sum(ys.value.map(y => cell(x, y.key)))
const grand = computed(() => sum(props.frame.rows.map(r => num(r[mKey.value]))))

/** Label every column up to 12; beyond that every 3rd (24 hours -> 00, 03, 06 …). */
const showX = (i: number) => xs.value.length <= 12 || i % 3 === 0
const labelWidth = computed(() => `${Math.min(110, Math.max(28, ...ys.value.map(y => y.label.length * 6.5)))}px`)
/** Row labels, one column per x, and a totals column only when totals show. */
const columns = computed(() => `${labelWidth.value} repeat(${xs.value.length}, minmax(8px, 1fr))${totals.value ? ' auto' : ''}`)

const summary = computed(() => {
  const p = peak.value
  return `${props.title}: ${measure.value.label} by ${props.frame.fields[1]?.label ?? 'row'} and ${props.frame.fields[0]?.label ?? 'column'}.${p ? ` Highest: ${p.yLabel}, ${p.xLabel}, ${formatCell(p[mKey.value], measure.value)}.` : ''}`
})
</script>

<style scoped>
.vh { display: flex; flex-direction: column; gap: 6px; height: 100%; min-height: 0; overflow: auto; }
.vh-grid { display: grid; gap: 2px; align-items: center; }
.vh-corner { display: block; }
.vh-xl { font-size: 9.5px; color: var(--fg-3); text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums; }
.vh-yl { font-size: 10.5px; color: var(--fg-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 4px; }
.vh-cell { display: block; height: 18px; border-radius: 2px; background: var(--surface-sunken); }
.vh-cell.is-empty { background: repeating-linear-gradient(45deg, transparent 0 3px, var(--border-subtle) 3px 4px); }
.vh-tot { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 10px; color: var(--fg-2); text-align: right; padding-left: 6px; }
.vh-tot-col { text-align: center; padding-left: 0; font-size: 9px; }
.vh-tot-h { padding-left: 6px; }
.vh-scale { display: flex; align-items: center; gap: 6px; font-size: 9.5px; color: var(--fg-3); font-family: var(--font-mono); }
.vh-ramp { flex: 0 0 80px; height: 6px; border-radius: 3px; background: linear-gradient(90deg, color-mix(in srgb, var(--viz-1) 8%, var(--surface-1)), var(--viz-1)); }
.vh-head { display: flex; flex-direction: column; gap: 2px; height: 100%; justify-content: center; min-width: 0; }
.vh-head-val { font-family: var(--font-mono); font-size: 22px; font-weight: 600; color: var(--fg-1); line-height: 1.1; }
.vh-head-lbl { font-size: 11px; color: var(--fg-2); }
</style>
