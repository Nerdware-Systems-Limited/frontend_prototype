<template>
  <!--
    VizStatusList - rows ranked worst status first (the binding sorts them).
      xs   the worst status and how many rows carry each status
      s    the top 3
      m/l  the full list (scrolls)
    Status is an icon + word + colour, never colour alone. A row opens its
    route when the binding has a link, or picks its key for dashboard actions.
  -->
  <div v-if="size === 'xs'" class="vsl-head" :class="`is-${worst}`">
    <component :is="ICONS[worst]" :size="18" aria-hidden="true" />
    <span class="vsl-head-lbl">{{ counts.length ? counts.map(c => `${c.n} ${STATUS_WORDS[c.status].toLowerCase()}`).join(' · ') : 'Nothing to list' }}</span>
  </div>

  <div v-else class="vsl">
    <ul class="vsl-list" :aria-label="summary">
      <li v-for="(r, i) in shown" :key="i" class="vsl-row" :class="[`is-${r.status}`, { 'is-dim': isDimmed(keyOf(r)), 'is-picked': isPicked(keyOf(r)) }]">
        <component
          :is="hrefOf(r) ? NuxtLink : selectable && keyOf(r) ? 'button' : 'div'"
          :to="hrefOf(r) || undefined" :type="!hrefOf(r) && selectable && keyOf(r) ? 'button' : undefined"
          class="vsl-item" :aria-pressed="!hrefOf(r) && selectable && keyOf(r) ? isPicked(keyOf(r)) : undefined"
          @click="!hrefOf(r) && selectable && keyOf(r) && emit('pick', keyOf(r))"
        >
          <span class="vsl-status">
            <component :is="ICONS[r.status as Status]" :size="13" aria-hidden="true" />
            <span class="vsl-word">{{ STATUS_WORDS[r.status as Status] }}</span>
          </span>
          <span class="vsl-main">
            <span class="vsl-label">{{ r.label }}</span>
            <span v-if="r.detail" class="vsl-detail">{{ r.detail }}</span>
          </span>
          <span v-if="measure" class="vsl-val">{{ formatCell(r[measure.key], measure) }}</span>
        </component>
      </li>
    </ul>
    <p v-if="frame.meta.total > shown.length" class="vsl-more">+ {{ frame.meta.total - shown.length }} more</p>
  </div>
</template>

<script setup lang="ts">
import { computed, resolveComponent } from 'vue'
import { CircleAlert, CircleCheck, CircleMinus, TriangleAlert } from 'lucide-vue-next'
import type { Frame, FrameField } from '~/types/frame'
import type { Status } from '~/utils/thresholds'
import { formatCell, type SizeClass } from '~/utils/viz'

const props = withDefaults(defineProps<{
  frame: Frame
  size: SizeClass
  title?: string
  /** Route template; {key} is replaced with the row's key. */
  link?: string
  selectable?: boolean
  isPicked?: (key: string) => boolean
  isDimmed?: (key: string) => boolean
}>(), { title: 'Status', link: '', selectable: false, isPicked: () => false, isDimmed: () => false })
const emit = defineEmits<{ pick: [key: string] }>()

const NuxtLink = resolveComponent('NuxtLink')
const ICONS = { critical: CircleAlert, warning: TriangleAlert, neutral: CircleMinus, healthy: CircleCheck } as const
const STATUS_WORDS: Record<Status, string> = { critical: 'Critical', warning: 'Warning', neutral: 'Info', healthy: 'OK' }
const ORDER: Status[] = ['critical', 'warning', 'neutral', 'healthy']

const measure = computed<FrameField | undefined>(() => props.frame.fields.find(f => f.kind === 'measure'))
const shown = computed(() => (props.size === 's' ? props.frame.rows.slice(0, 3) : props.frame.rows))
const keyOf = (r: Record<string, unknown>) => (r.key == null ? '' : String(r.key))
const hrefOf = (r: Record<string, unknown>) => (props.link && keyOf(r) ? props.link.replaceAll('{key}', encodeURIComponent(keyOf(r))) : '')

// Counted over every row (meta.statusCounts), not just the ones a row limit keeps.
const counts = computed(() => ORDER
  .map(status => ({ status, n: props.frame.meta.statusCounts?.[status] ?? props.frame.rows.filter(r => r.status === status).length }))
  .filter(c => c.n > 0))
const worst = computed<Status>(() => counts.value[0]?.status ?? 'healthy')
const summary = computed(() => `${props.title}: ${counts.value.map(c => `${c.n} ${STATUS_WORDS[c.status].toLowerCase()}`).join(', ') || 'no rows'}.`)
</script>

<style scoped>
.vsl { display: flex; flex-direction: column; gap: 4px; height: 100%; min-height: 0; }
.vsl-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; min-height: 0; }
.vsl-row { transition: opacity var(--dur-fast) var(--ease-standard); }
.vsl-item {
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; text-align: left;
  border: 1px solid var(--border-subtle); border-radius: var(--r-xs); background: var(--surface-1);
  color: var(--fg-1); text-decoration: none; font: inherit;
}
a.vsl-item, button.vsl-item { cursor: pointer; }
.vsl-item:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.vsl-status { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; min-width: 66px; }
.vsl-main { display: flex; flex-direction: column; min-width: 0; }
.vsl-label { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vsl-detail { font-size: 10.5px; color: var(--fg-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vsl-val { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 11.5px; }
.is-critical .vsl-status, .vsl-head.is-critical { color: var(--danger-fg); }
.is-warning .vsl-status, .vsl-head.is-warning { color: var(--warning-fg); }
.is-healthy .vsl-status, .vsl-head.is-healthy { color: var(--success-fg); }
.is-neutral .vsl-status, .vsl-head.is-neutral { color: var(--fg-3); }
.is-dim { opacity: .35; }
.is-picked .vsl-item { border-color: var(--primary); }
.vsl-more { margin: 0; font-size: 10.5px; color: var(--fg-3); }
.vsl-head { display: flex; align-items: center; gap: 8px; height: 100%; }
.vsl-head-lbl { font-size: 12px; font-weight: 600; }
@media (hover: hover) and (pointer: fine) {
  a.vsl-item:hover, button.vsl-item:hover { border-color: var(--border-interactive); }
}
</style>
