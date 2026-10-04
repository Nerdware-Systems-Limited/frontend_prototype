/**
 * Filter & action engine for one rendered dashboard.
 *
 * Tableau equivalents:
 *   Filter -> "Apply to worksheets: All using this data source / Selected"
 *             = DashboardFilter.appliesTo ('all' | widget ids), intersected
 *               with the fields each widget can actually honour.
 *   Filter action  -> click a mark in widget A, filter widgets B, C…
 *   Highlight action -> same, but targets dim non-matching marks instead.
 *   URL action     -> navigate with {value} substituted.
 *
 * State is URL-synced (?f.county=Kiambu&a.<actionId>=Kiambu) so a filtered
 * view is shareable and survives refresh.
 *
 * Usage: the renderer calls provideDashboardFilters(); widgets call
 * useWidgetFilters(widgetId) to get their context + an emit() for clicks.
 */
import type { InjectionKey } from 'vue'
import type {
  DashboardAction, DashboardDefinition, FilterField, FilterValue,
  ViewerContext, WidgetFilterContext,
} from '~/types/dashboard'
import { widgetFilterFields } from '~/utils/widgetRegistry'

export interface DashboardFilterEngine {
  /** filterId -> value */
  values: Ref<Record<string, FilterValue>>
  /** actionId -> selected value (from a click) */
  selections: Ref<Record<string, FilterValue>>
  setFilter: (filterId: string, value: FilterValue) => void
  clearAll: () => void
  contextFor: (widgetId: string) => WidgetFilterContext
  /** Fields filtered on the dashboard that this widget can NOT honour. */
  ignoredFieldsFor: (widgetId: string) => FilterField[]
  highlightFor: (widgetId: string) => { field: FilterField; value: FilterValue } | null
  emit: (sourceWidgetId: string, field: FilterField, value: FilterValue) => void
  activeSelections: ComputedRef<{ action: DashboardAction; value: FilterValue }[]>
  clearSelection: (actionId: string) => void
}

const KEY: InjectionKey<DashboardFilterEngine> = Symbol('dashboard-filters')

const isEmpty = (v: FilterValue) =>
  v == null || v === '' || (Array.isArray(v) && v.length === 0)

function encode(v: FilterValue): string | undefined {
  if (isEmpty(v)) return undefined
  if (Array.isArray(v)) return v.join('|')
  if (typeof v === 'object') return `${v!.from}..${v!.to}`
  return String(v)
}
function decode(raw: unknown, control: string): FilterValue {
  if (typeof raw !== 'string' || !raw) return null
  if (control === 'daterange') {
    const [from, to] = raw.split('..')
    return from && to ? { from, to } : null
  }
  if (control === 'multiselect') return raw.split('|')
  return raw
}

export function provideDashboardFilters(
  definition: Ref<DashboardDefinition | null>,
  viewer: Ref<ViewerContext | null>,
  opts: { syncUrl?: boolean } = { syncUrl: true },
): DashboardFilterEngine {
  const route = useRoute()
  const router = useRouter()
  const values = ref<Record<string, FilterValue>>({})
  const selections = ref<Record<string, FilterValue>>({})

  // ── Initial values: viewer-bound > URL > default ─────────────────────
  function init() {
    const def = definition.value
    if (!def) return
    const next: Record<string, FilterValue> = {}
    for (const f of def.filters) {
      if (f.bindToViewer === 'agency' && viewer.value?.agencyCode) { next[f.id] = viewer.value.agencyCode; continue }
      if (f.bindToViewer === 'department' && viewer.value?.departmentCode) { next[f.id] = viewer.value.departmentCode; continue }
      const fromUrl = opts.syncUrl ? decode(route.query[`f.${f.field}`], f.control) : null
      next[f.id] = f.locked ? (f.defaultValue ?? null) : (fromUrl ?? f.defaultValue ?? null)
    }
    values.value = next
    const sel: Record<string, FilterValue> = {}
    if (opts.syncUrl) for (const a of def.actions) {
      const raw = route.query[`a.${a.id}`]
      if (typeof raw === 'string' && raw) sel[a.id] = raw
    }
    selections.value = sel
  }
  watch(() => definition.value, init, { immediate: true })

  // ── URL sync ─────────────────────────────────────────────────────────
  if (opts.syncUrl) {
    watch([values, selections], () => {
      const def = definition.value
      if (!def) return
      const q: Record<string, any> = { ...route.query }
      for (const k of Object.keys(q)) if (k.startsWith('f.') || k.startsWith('a.')) delete q[k]
      for (const f of def.filters) {
        if (f.locked || f.bindToViewer) continue
        const enc = encode(values.value[f.id] ?? null)
        if (enc && enc !== encode(f.defaultValue ?? null)) q[`f.${f.field}`] = enc
      }
      for (const [id, v] of Object.entries(selections.value)) {
        const enc = encode(v)
        if (enc) q[`a.${id}`] = enc
      }
      router.replace({ query: q })
    }, { deep: true })
  }

  const widgetById = computed(() => new Map((definition.value?.widgets ?? []).map(w => [w.id, w])))
  const supported = (widgetId: string): FilterField[] => {
    const w = widgetById.value.get(widgetId)
    return w ? widgetFilterFields(w.type, w.config) : []
  }
  const targets = (list: 'all' | string[], widgetId: string) => list === 'all' || list.includes(widgetId)

  function contextFor(widgetId: string): WidgetFilterContext {
    const def = definition.value
    if (!def) return {}
    const fields = supported(widgetId)
    const ctx: WidgetFilterContext = {}
    for (const f of def.filters) {
      const v = values.value[f.id]
      if (isEmpty(v ?? null) || !fields.includes(f.field) || !targets(f.appliesTo, widgetId)) continue
      ctx[f.field] = v
    }
    // Filter actions layer on top (a click is more specific than the bar).
    // Tableau convention: the source widget itself is not filtered.
    for (const a of def.actions) {
      if (a.type !== 'filter' || a.sourceWidgetId === widgetId) continue
      const v = selections.value[a.id]
      if (isEmpty(v ?? null) || !fields.includes(a.field) || !targets(a.targetWidgetIds, widgetId)) continue
      ctx[a.field] = v
    }
    return ctx
  }

  function ignoredFieldsFor(widgetId: string): FilterField[] {
    const def = definition.value
    if (!def) return []
    const fields = supported(widgetId)
    const out = new Set<FilterField>()
    for (const f of def.filters) {
      if (!isEmpty(values.value[f.id] ?? null) && targets(f.appliesTo, widgetId) && !fields.includes(f.field)) out.add(f.field)
    }
    return [...out]
  }

  function highlightFor(widgetId: string) {
    for (const a of definition.value?.actions ?? []) {
      if (a.type !== 'highlight' || !targets(a.targetWidgetIds, widgetId)) continue
      const v = selections.value[a.id]
      if (!isEmpty(v ?? null)) return { field: a.field, value: v! }
    }
    return null
  }

  function emit(sourceWidgetId: string, field: FilterField, value: FilterValue) {
    for (const a of definition.value?.actions ?? []) {
      if (a.sourceWidgetId !== sourceWidgetId || a.field !== field) continue
      if (a.type === 'navigate') {
        if (!isEmpty(value) && a.urlTemplate) {
          router.push(a.urlTemplate.replace('{value}', encodeURIComponent(encode(value)!)))
        }
        continue
      }
      // clicking the same mark again toggles the selection off
      const same = encode(selections.value[a.id] ?? null) === encode(value)
      const next = { ...selections.value }
      if (isEmpty(value) || same) {
        if (a.onClear === 'keep' && !same) continue
        delete next[a.id]
      } else {
        next[a.id] = value
      }
      selections.value = next
    }
  }

  const activeSelections = computed(() =>
    (definition.value?.actions ?? [])
      .filter(a => !isEmpty(selections.value[a.id] ?? null))
      .map(a => ({ action: a, value: selections.value[a.id]! })),
  )

  const engine: DashboardFilterEngine = {
    values, selections,
    setFilter: (id, v) => {
      const f = definition.value?.filters.find(x => x.id === id)
      if (f?.locked || f?.bindToViewer) return
      values.value = { ...values.value, [id]: v }
    },
    clearAll: () => {
      const def = definition.value
      if (!def) return
      const next = { ...values.value }
      for (const f of def.filters) if (!f.locked && !f.bindToViewer) next[f.id] = f.defaultValue ?? null
      values.value = next
      selections.value = {}
    },
    contextFor, ignoredFieldsFor, highlightFor, emit, activeSelections,
    clearSelection: (id) => { const n = { ...selections.value }; delete n[id]; selections.value = n },
  }
  provide(KEY, engine)
  return engine
}

/** For widgets. Works outside a dashboard too (returns an inert engine). */
export function useWidgetFilters(widgetId: () => string) {
  const engine = inject(KEY, null)
  return {
    context: computed<WidgetFilterContext>(() => engine?.contextFor(widgetId()) ?? {}),
    ignored: computed<FilterField[]>(() => engine?.ignoredFieldsFor(widgetId()) ?? []),
    highlight: computed(() => engine?.highlightFor(widgetId()) ?? null),
    emit: (field: FilterField, value: FilterValue) => engine?.emit(widgetId(), field, value),
  }
}

export function useDashboardFilterEngine() {
  return inject(KEY, null)
}
