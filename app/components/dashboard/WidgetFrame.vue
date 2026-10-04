<template>
  <!--
    WidgetFrame - the chrome around every placed widget: optional title bar,
    background/border/padding/accent from the instance's style, a "filter not
    applied" note, and an error boundary so one broken widget never blanks
    the dashboard. Widgets that draw their own card (KPIs, agency cards,
    headings) default to frameless.
  -->
  <section
    class="wf" :class="[`wf--bg-${style.background}`, `wf--pad-${style.padding}`, `wf--accent-${style.accent}`, { 'wf--border': style.border, 'wf--frameless': frameless }]"
    :aria-label="displayTitle"
  >
    <header v-if="style.showTitle" class="wf-head">
      <span class="wf-title">{{ displayTitle }}</span>
      <span v-if="ignored.length" class="wf-ignored" :title="`This widget can't be filtered by ${ignored.join(', ')} - it shows unfiltered figures for those fields.`">
        Not filtered by {{ ignored.map(f => f.replace('_', ' ')).join(', ') }}
      </span>
      <slot name="actions" />
    </header>

    <div ref="bodyEl" class="wf-body" :data-size="size.sizeClass.value">
      <div v-if="crashed" class="wf-crash" role="alert">
        <strong>This widget failed to render.</strong>
        <span>{{ crashed }}</span>
        <button type="button" class="btn btn-sm" @click="retry">Retry</button>
      </div>
      <component
        :is="comp" v-else-if="comp" :key="renderKey"
        :instance="instance" :config="config" :body-height="bodyHeight"
      />
      <div v-else class="wf-crash">Unknown widget type <code>{{ instance.type }}</code>.</div>
    </div>

    <!-- Which agency / which feed / how fresh (Product Principle 1). -->
    <footer v-if="!frameless && footer" class="wf-foot" :title="footer.title">
      <span class="wf-foot-src">{{ footer.source }}</span>
      <span v-if="footer.tier" class="wf-foot-tier" :class="`wf-foot-tier--${footer.tierKey}`">{{ footer.tier }}</span>
      <span class="wf-foot-time" aria-live="polite">{{ footer.time }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onErrorCaptured } from 'vue'
import type { WidgetInstance, WidgetStyle } from '~/types/dashboard'
import { WIDGETS_BY_TYPE, WIDGET_COMPONENTS, isFramed } from '~/utils/widgetRegistry'
import { useWidgetFilters } from '~/composables/useDashboardFilters'
import { WIDGET_META_KEY, type WidgetDataMeta } from '~/composables/useWidgetData'
import { SOURCES_BY_ID, TIER_LABELS } from '~/utils/dataSources'
import { WIDGET_SIZE_KEY, makeWidgetSize } from '~/composables/useWidgetSize'

const props = defineProps<{ instance: WidgetInstance }>()

const def = computed(() => WIDGETS_BY_TYPE[props.instance.type])
const config = computed(() => ({ ...(def.value?.defaultConfig ?? {}), ...(props.instance.config ?? {}) }))
const frameless = computed(() => !isFramed(props.instance.type))

const style = computed<Required<WidgetStyle>>(() => ({
  showTitle: props.instance.style?.showTitle ?? !frameless.value,
  background: props.instance.style?.background ?? (frameless.value ? 'transparent' : 'surface'),
  border: props.instance.style?.border ?? !frameless.value,
  padding: props.instance.style?.padding ?? (frameless.value ? 'none' : 'normal'),
  accent: props.instance.style?.accent ?? 'none',
}))
const displayTitle = computed(() => props.instance.title || def.value?.title || props.instance.type)

const loaders = new Map<string, ReturnType<typeof defineAsyncComponent>>()
const comp = computed(() => {
  const t = props.instance.type
  const loader = WIDGET_COMPONENTS[t]
  if (!loader) return null
  if (!loaders.has(t)) loaders.set(t, defineAsyncComponent({ loader, delay: 0 }))
  return loaders.get(t)!
})

const { ignored } = useWidgetFilters(() => props.instance.id)

// Body height lets charts/maps size themselves to the grid cell.
const bodyEl = ref<HTMLElement | null>(null)
const { width: bodyWidth, height: bodyHeight } = useElementSize(bodyEl)
// Width + height -> size class, so visuals pick their form for the cell.
const size = makeWidgetSize(bodyWidth, bodyHeight)
provide(WIDGET_SIZE_KEY, size)

const crashed = ref<string | null>(null)
const renderKey = ref(0)
onErrorCaptured((err) => {
  crashed.value = err instanceof Error ? err.message : String(err)
  console.error(`[dashboard] widget ${props.instance.id} (${props.instance.type}) crashed`, err)
  return false // stop propagation: the rest of the dashboard keeps rendering
})
function retry() { crashed.value = null; renderKey.value++ }

// ── Footer: widgets report the sources they loaded through useWidgetData ──
const meta = ref(new Map<symbol, WidgetDataMeta>())
provide(WIDGET_META_KEY, meta)

const timeFmt = new Intl.DateTimeFormat('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' })
const footer = computed(() => {
  const entries = [...meta.value.values()]
  const ids = [...new Set(entries.flatMap(e => e.sourceIds))]
  const sources = ids.map(id => SOURCES_BY_ID[id]).filter(s => !!s)
  if (!sources.length) return null
  const times = entries.map(e => e.refreshedAt?.getTime() ?? 0).filter(Boolean)
  const refreshing = entries.some(e => e.state === 'loading' || e.state === 'refreshing')
  const tiers = [...new Set(sources.map(s => s.tier))]
  const single = sources.length === 1 ? sources[0]! : null
  return {
    source: single ? single.source : `${sources.length} sources`,
    title: sources.map(s => `${s.source} - ${TIER_LABELS[s.tier]}, ${s.cadence.toLowerCase()}`).join('\n'),
    tier: tiers.length === 1 ? TIER_LABELS[tiers[0]!] : null,
    tierKey: tiers[0],
    time: refreshing ? 'Refreshing…' : times.length ? `${timeFmt.format(Math.max(...times))} EAT` : '',
  }
})
</script>

<style scoped>
.wf {
  position: relative; display: flex; flex-direction: column; height: 100%; min-width: 0; min-height: 0;
  border-radius: var(--radius); overflow: hidden; container: widget / inline-size;
}
.wf--bg-surface { background: var(--surface-2); }
.wf--bg-sunken { background: var(--surface-sunken); }
.wf--bg-transparent { background: transparent; }
.wf--border { border: 1px solid var(--border-subtle); }
/* 1px status rule, same as .kpi-card::before (DESIGN.md Hairline Rule). */
.wf::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 1px; background: transparent; z-index: 1; }
.wf--accent-primary::before { background: var(--primary); }
.wf--accent-success::before { background: var(--success); }
.wf--accent-warning::before { background: var(--warning); }
.wf--accent-danger::before { background: var(--destructive); }
.wf--accent-info::before { background: var(--info); }

.wf-head {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; flex-shrink: 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--fg-3);
}
.wf--frameless .wf-head { border-bottom: 0; padding: 0 0 6px; }
.wf-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wf-ignored {
  font-size: 9px; font-weight: 600; letter-spacing: .03em; text-transform: none; color: var(--warning-fg);
  background: var(--warning-bg); border-radius: var(--r-xs); padding: 1px 6px; white-space: nowrap; cursor: help;
}
.wf-body { flex: 1; min-height: 0; overflow: hidden; }
.wf-foot {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0; min-width: 0; padding: 5px 12px;
  border-top: 1px solid var(--border-subtle);
  font-family: var(--font-mono); font-size: 9.5px; font-variant-numeric: tabular-nums; letter-spacing: .02em; color: var(--fg-3);
}
.wf-foot-src { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wf-foot-tier { text-transform: uppercase; display: inline-flex; align-items: center; gap: 4px; }
.wf-foot-tier::before { content: ''; width: 5px; height: 5px; border-radius: var(--r-pill); background: var(--fg-3); }
.wf-foot-tier--live::before { background: var(--success); }
.wf-foot-tier--file::before { background: var(--warning); }
.wf-foot-time { margin-left: auto; white-space: nowrap; }
.wf--pad-normal .wf-body { padding: 10px 12px; }
.wf--pad-compact .wf-body { padding: 6px 8px; }
.wf--pad-none .wf-body { padding: 0; }
.wf-body > :deep(.kpi-card) { height: 100%; }

.wf-crash {
  height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  text-align: center; font-size: 11.5px; color: var(--fg-3); padding: 12px;
}
.wf-crash strong { color: var(--danger-fg); font-size: 12px; }
</style>
