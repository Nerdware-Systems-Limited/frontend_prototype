<template>
  <!--
    VizTable - a Frame as rows. Also the table view behind every chart
    (the accessibility relief for low-contrast series and the place every
    value lives without hovering).
      xs  row count only
      s   top 3 as a compact list
      m/l sortable table; long frames show the first rows + "Show all"
  -->
  <p v-if="size === 'xs'" class="vt-count">
    <span class="vt-count-n">{{ formatValue(frame.rows.length, 'count') }}</span>
    {{ frame.rows.length === 1 ? 'row' : 'rows' }}
  </p>

  <ol v-else-if="size === 's'" class="vt-list">
    <li v-for="(r, i) in sorted.slice(0, 3)" :key="i" class="vt-list-row" :class="rowClass(r)">
      <component
        :is="selectable ? 'button' : 'span'" :type="selectable ? 'button' : undefined" class="vt-list-label"
        :aria-pressed="selectable ? isPicked(rowKey(r)) : undefined" @click="selectable && pick(rowKey(r))"
      >{{ formatCell(r[labelField.key], labelField) }}</component>
      <span v-if="measure" class="vt-list-val">{{ formatCell(r[measure.key], measure) }}</span>
    </li>
    <li v-if="frame.rows.length > 3" class="vt-more">+ {{ frame.rows.length - 3 }} more</li>
  </ol>

  <div v-else class="vt-wrap">
    <table class="vt">
      <caption v-if="caption" class="vt-caption">{{ caption }}</caption>
      <thead>
        <tr>
          <th
            v-for="f in frame.fields" :key="f.key" scope="col"
            :class="{ 'vt-num': f.kind === 'measure' }"
            :aria-sort="sortKey === f.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined"
          >
            <span v-if="!interactive" class="vt-sort">{{ f.label }}</span>
            <button v-else type="button" class="vt-sort" @click="toggleSort(f.key)">
              {{ f.label }}
              <component :is="sortDir === 'asc' ? ArrowUp : ArrowDown" v-if="sortKey === f.key" :size="11" class="vt-sort-mark" aria-hidden="true" />
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in visible" :key="i" :class="rowClass(r)">
          <td v-for="(f, j) in frame.fields" :key="f.key" :class="{ 'num vt-num': f.kind === 'measure' }">
            <button
              v-if="j === 0 && selectable" type="button" class="vt-pick"
              :aria-pressed="isPicked(rowKey(r))" @click="pick(rowKey(r))"
            >{{ formatCell(r[f.key], f, true) }}</button>
            <template v-else>{{ formatCell(r[f.key], f, true) }}</template>
          </td>
        </tr>
      </tbody>
    </table>
    <button v-if="!showAll && sorted.length > maxRows" type="button" class="vt-all" @click="showAll = true">
      Show all {{ formatValue(sorted.length, 'count') }} rows
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp } from 'lucide-vue-next'
import type { Frame } from '~/types/frame'
import { formatCell, type SizeClass } from '~/utils/viz'
import { formatValue } from '~/utils/units'

const props = withDefaults(defineProps<{
  frame: Frame
  size?: SizeClass
  caption?: string
  maxRows?: number
  /** Row key for click-to-filter (raw category), or nothing. */
  keyField?: string
  selectable?: boolean
  isPicked?: (key: string) => boolean
  isDimmed?: (key: string) => boolean
  /** False for the visually hidden copy: no focusable controls inside it. */
  interactive?: boolean
}>(), { interactive: true, size: 'm', caption: '', maxRows: 8, keyField: undefined, selectable: false, isPicked: () => false, isDimmed: () => false })

const emit = defineEmits<{ pick: [key: string] }>()

const labelField = computed(() => props.frame.fields.find(f => f.kind !== 'measure') ?? props.frame.fields[0]!)
const measure = computed(() => props.frame.fields.find(f => f.kind === 'measure'))

const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc'>('desc')
function toggleSort(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  else { sortKey.value = key; sortDir.value = 'desc' }
}
const sorted = computed(() => {
  const k = sortKey.value
  if (!k) return props.frame.rows
  const dir = sortDir.value === 'desc' ? -1 : 1
  return [...props.frame.rows].sort((a, b) => {
    const av = a[k]; const bv = b[k]
    if (av == null) return 1
    if (bv == null) return -1
    return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * dir
  })
})

const showAll = ref(false)
const visible = computed(() => (showAll.value ? sorted.value : sorted.value.slice(0, props.maxRows)))

const rowKey = (r: Record<string, unknown>) => String(r[props.keyField ?? labelField.value.key] ?? '')
const rowClass = (r: Record<string, unknown>) => ({ 'is-dim': props.isDimmed(rowKey(r)), 'is-picked': props.isPicked(rowKey(r)) })
const pick = (key: string) => emit('pick', key)
</script>

<style scoped>
.vt-count { margin: auto 0; font-size: 11px; color: var(--fg-3); }
.vt-count-n { display: block; font-family: var(--font-mono); font-size: 20px; font-weight: 600; color: var(--fg-1); }

.vt-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.vt-list-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--border-subtle); }
.vt-list-row:last-of-type { border-bottom: 0; }
.vt-list-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; color: var(--fg-2); background: none; border: 0; padding: 0; text-align: left; }
button.vt-list-label { cursor: pointer; }
.vt-list-val { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 11.5px; color: var(--fg-1); white-space: nowrap; }
.vt-more { font-size: 10.5px; color: var(--fg-3); padding-top: 4px; }

.vt-wrap { height: 100%; overflow: auto; }
.vt { font-size: 11.5px; }
.vt th { position: sticky; top: 0; z-index: 1; padding: 0; }
.vt td { padding: 6px 10px; }
.vt-num { text-align: right; }
.vt-caption { caption-side: top; text-align: left; font-size: 10px; color: var(--fg-3); padding-bottom: 4px; }
.vt-sort {
  display: inline-flex; align-items: center; gap: 4px; width: 100%; padding: 7px 10px; background: none; border: 0; cursor: pointer;
  font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit;
}
.vt th.vt-num .vt-sort { justify-content: flex-end; }
.vt-sort-mark { flex-shrink: 0; }
.vt-pick { background: none; border: 0; padding: 0; font: inherit; color: var(--fg-1); cursor: pointer; text-align: left; }
.vt-all { margin-top: 6px; background: none; border: 0; padding: 0; font-size: 10.5px; font-weight: 600; color: var(--primary); cursor: pointer; }

.is-dim { opacity: .35; }
.is-picked td, .vt-list-row.is-picked { background: var(--primary-wash); }
.vt-pick:focus-visible, .vt-sort:focus-visible, .vt-all:focus-visible, button.vt-list-label:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
@media (hover: hover) and (pointer: fine) {
  .vt-pick:hover, button.vt-list-label:hover { color: var(--primary); }
  .vt-all:hover { text-decoration: underline; text-underline-offset: 3px; }
}
</style>
