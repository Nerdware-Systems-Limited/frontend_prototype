/**
 * Click-to-filter for a visual primitive: picking a mark emits the binding's
 * filter field through the dashboard action engine, and a highlight action
 * aimed at this widget dims the marks that don't match. One implementation,
 * so every primitive selects and dims the same way.
 */
import { computed, ref } from 'vue'
import type { FilterField, FilterValue } from '~/types/dashboard'
import { useWidgetFilters } from '~/composables/useDashboardFilters'

const matches = (v: FilterValue, key: string) =>
  v == null ? true : Array.isArray(v) ? v.includes(key) : typeof v === 'string' ? v === key : true

export function useSelectable(widgetId: () => string, field: () => FilterField | undefined) {
  const { highlight, emit } = useWidgetFilters(widgetId)
  const picked = ref<string | null>(null)

  const enabled = computed(() => !!field())

  function pick(key: string) {
    const f = field()
    if (!f) return
    picked.value = picked.value === key ? null : key
    emit(f, picked.value)
  }

  /** Dimmed when a highlight on this field is active and the key isn't in it. */
  function isDimmed(key: string): boolean {
    const h = highlight.value
    if (!h || h.field !== field()) return false
    return !matches(h.value, key)
  }

  const isPicked = (key: string) => picked.value === key

  return { enabled, pick, isPicked, isDimmed, picked }
}
