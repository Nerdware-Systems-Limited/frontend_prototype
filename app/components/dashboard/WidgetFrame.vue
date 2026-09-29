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

    <div ref="bodyEl" class="wf-body">
      <div v-if="crashed" class="wf-crash" role="alert">
        <strong>{{ chunkFailed ? "This widget couldn't be downloaded." : 'This widget failed to render.' }}</strong>
        <span class="wf-crash-detail">{{ chunkFailed ? 'The app may have been updated, or the connection dropped. Reloading fetches it again.' : crashed }}</span>
        <button v-if="chunkFailed" type="button" class="btn btn-sm" @click="reloadPage">Reload page</button>
        <button v-else type="button" class="btn btn-sm" @click="retry">Retry</button>
      </div>
      <component
        :is="comp" v-else-if="comp" :key="renderKey"
        :instance="instance" :config="config" :body-height="bodyHeight"
      />
      <div v-else class="wf-crash">Unknown widget type <code>{{ instance.type }}</code>.</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onErrorCaptured } from 'vue'
import type { WidgetInstance, WidgetStyle } from '~/types/dashboard'
import { WIDGETS_BY_TYPE, WIDGET_COMPONENTS } from '~/utils/widgetRegistry'
import { useWidgetFilters } from '~/composables/useDashboardFilters'

const props = defineProps<{ instance: WidgetInstance }>()

const def = computed(() => WIDGETS_BY_TYPE[props.instance.type])
const config = computed(() => ({ ...(def.value?.defaultConfig ?? {}), ...(props.instance.config ?? {}) }))
const SELF_FRAMED = new Set(['kpi', 'kpi-row', 'text', 'embed', 'agency-card'])
const frameless = computed(() => SELF_FRAMED.has(def.value?.kind ?? ''))

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
const { height: bodyHeight } = useElementSize(bodyEl)

const crashed = ref<string | null>(null)
const renderKey = ref(0)
onErrorCaptured((err) => {
  crashed.value = err instanceof Error ? err.message : String(err)
  console.error(`[dashboard] widget ${props.instance.id} (${props.instance.type}) crashed`, err)
  return false // stop propagation: the rest of the dashboard keeps rendering
})
function retry() { crashed.value = null; renderKey.value++ }
// A failed dynamic import is cached by the browser for the page's lifetime,
// so Retry can't recover it (e.g. stale chunks after a deploy); only a reload can.
const chunkFailed = computed(() => !!crashed.value && /dynamically imported module|importing a module script failed|loading chunk/i.test(crashed.value))
function reloadPage() { window.location.reload() }
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
.wf::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 2px; background: transparent; z-index: 1; }
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
.wf--pad-normal .wf-body { padding: 10px 12px; }
.wf--pad-compact .wf-body { padding: 6px 8px; }
.wf--pad-none .wf-body { padding: 0; }
.wf-body > :deep(.kpi-card) { height: 100%; }

.wf-crash {
  height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  text-align: center; font-size: 11.5px; color: var(--fg-3); padding: 12px;
}
.wf-crash strong { color: var(--danger-fg); font-size: 12px; }
.wf-crash-detail { max-width: 36ch; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
</style>
