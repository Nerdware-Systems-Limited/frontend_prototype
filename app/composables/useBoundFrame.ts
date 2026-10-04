/**
 * Source + binding -> Frame, with honest states. The one data hook behind
 * every generic widget (stat / series / breakdown / table).
 */
import { computed } from 'vue'
import type { Binding, Frame } from '~/types/frame'
import type { WidgetInstance } from '~/types/dashboard'
import { applyBinding } from '~/utils/bindings'
import { useWidgetData, type WidgetDataState } from '~/composables/useWidgetData'
import { useWidgetFilters } from '~/composables/useDashboardFilters'
import { useSelectable } from '~/composables/useSelectable'
import { SOURCES_BY_ID } from '~/utils/dataSources'

export function bindingOf(config: Record<string, unknown>): Binding | null {
  const b = config.binding as Binding | undefined
  return b && typeof b === 'object' && b.source && b.path !== undefined ? b : null
}

export function useBoundFrame(instance: () => WidgetInstance, config: () => Record<string, unknown>) {
  const binding = computed(() => bindingOf(config()))
  const { context } = useWidgetFilters(() => instance().id)
  const { data, state: loadState, error, reload } = useWidgetData(() => binding.value?.source ?? null, () => context.value)

  const result = computed<{ frame: Frame | null; error: string | null }>(() => {
    const b = binding.value
    if (!b || data.value == null) return { frame: null, error: null }
    try {
      return { frame: applyBinding(data.value, b), error: null }
    } catch (e) {
      return { frame: null, error: e instanceof Error ? e.message : 'Unexpected response shape' }
    }
  })

  const state = computed<WidgetDataState>(() => {
    if (!binding.value) return 'idle'
    if (result.value.error) return 'error'
    const s = loadState.value
    if ((s === 'ready' || s === 'refreshing') && result.value.frame && !result.value.frame.rows.length) return 'empty'
    return s
  })

  const select = useSelectable(() => instance().id, () => binding.value?.emits)

  return {
    binding,
    frame: computed(() => result.value.frame),
    state,
    /** True when there is a Frame to draw (ready, or refreshing over old data). */
    hasFrame: computed(() => !!result.value.frame && (state.value === 'ready' || state.value === 'refreshing')),
    error: computed(() => result.value.error ?? error.value),
    sourceLabel: computed(() => SOURCES_BY_ID[binding.value?.source ?? '']?.source ?? 'This'),
    reload,
    ...select,
  }
}
