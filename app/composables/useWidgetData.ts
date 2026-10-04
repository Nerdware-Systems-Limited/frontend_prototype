/**
 * Widget data layer - one primitive every dashboard widget loads through.
 *
 *   const { data, state, reload } = useWidgetData(() => 'safety.summary', () => context.value)
 *
 * - Requests are keyed by source + honoured params + options and cached for
 *   the source's TTL, so ten safety widgets on one dashboard make ONE call.
 *   A failure is never cached.
 * - Each widget ignores responses that arrive after a newer request
 *   (out-of-order guard), so a slow old response can't overwrite a new one.
 * - A refresh keeps the previous data on screen (state 'refreshing'); only
 *   the very first load is 'loading'.
 * - Errors become honest states: 403 -> 'forbidden', 404/501 on a source
 *   built ahead of its backend -> 'not-integrated', anything else -> 'error'.
 * - The surrounding WidgetFrame is told which sources fed the widget and
 *   when, for its "source · tier · time" footer.
 */
import { inject, onScopeDispose, ref, shallowRef, watch, computed, type InjectionKey, type Ref } from 'vue'
import {
  SOURCES_BY_ID, filterParams, honouredParams,
  type SourceOptions, type WidgetSource,
} from '~/utils/dataSources'
import type { WidgetFilterContext } from '~/types/dashboard'

const DEFAULT_TTL_MS = 60_000
const cache = new Map<string, { at: number; ttl: number; promise: Promise<unknown> }>()

export type WidgetDataState =
  | 'idle' | 'loading' | 'refreshing' | 'ready' | 'empty' | 'partial'
  | 'not-integrated' | 'forbidden' | 'error'

export type SourceErrorKind = 'not-integrated' | 'forbidden' | 'error'

export interface SourceFailure { kind: SourceErrorKind; status: number | null; message: string }

function statusOf(err: unknown): number | null {
  const e = err as { status?: number; statusCode?: number; response?: { status?: number } } | null
  return e?.status ?? e?.statusCode ?? e?.response?.status ?? null
}

/** Turn a thrown fetch error into the state a widget should show. */
export function classifyError(err: unknown, source: Pick<WidgetSource, 'backend'> | undefined): SourceFailure {
  const status = statusOf(err)
  const e = err as { data?: { detail?: string; message?: string }; message?: string } | null
  const message = e?.data?.detail || e?.data?.message || e?.message || 'Request failed'
  if (status === 403 || status === 401) return { kind: 'forbidden', status, message }
  if ((status === 404 || status === 501) && source?.backend === 'ahead-of-backend') {
    return { kind: 'not-integrated', status, message }
  }
  return { kind: 'error', status, message }
}

function cacheKey(id: string, params: Record<string, unknown>, options: SourceOptions): string {
  const q = (o: Record<string, unknown>) => Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`).join('&')
  return `${id}?${q(params)}#${q(options)}`
}

/** Fetch one source for a filter context, de-duplicated and cached. */
export function loadSource<T = unknown>(
  id: string, ctx: WidgetFilterContext, options: SourceOptions = {}, force = false,
): Promise<T> {
  const source = SOURCES_BY_ID[id]
  if (!source) return Promise.reject(new Error(`Unknown data source '${id}'.`))
  const params = honouredParams(source.honours, filterParams(ctx))
  const key = cacheKey(id, params, options)
  const hit = cache.get(key)
  if (!force && hit && Date.now() - hit.at < hit.ttl) return hit.promise as Promise<T>
  const promise = Promise.resolve().then(() => source.fetch(params, options))
  cache.set(key, { at: Date.now(), ttl: source.ttlMs ?? DEFAULT_TTL_MS, promise })
  promise.catch(() => { if (cache.get(key)?.promise === promise) cache.delete(key) })
  return promise as Promise<T>
}

/** Drop every cached response - the renderer calls this before a refresh tick. */
export function invalidateWidgetData() { cache.clear() }

// ── Frame footer reporting ───────────────────────────────────────────────

export interface WidgetDataMeta { sourceIds: string[]; state: WidgetDataState; refreshedAt: Date | null }
export type WidgetMetaRegistry = Ref<Map<symbol, WidgetDataMeta>>
export const WIDGET_META_KEY: InjectionKey<WidgetMetaRegistry> = Symbol('widget-data-meta')

// ── Reactive wrappers ────────────────────────────────────────────────────

export interface UseWidgetSourcesOptions {
  /** Per-source request options (part of the cache key). */
  options?: () => Record<string, SourceOptions | undefined>
}

/**
 * Several sources at once (an agency card reads safety + fleet, the alerts
 * rail reads every domain). One failure doesn't hide the rest: the state is
 * 'partial' and `failures` says which sources are missing and why.
 */
export function useWidgetSources(
  ids: () => string[],
  ctx: () => WidgetFilterContext,
  opts: UseWidgetSourcesOptions = {},
) {
  const data = shallowRef<Record<string, unknown>>({})
  const failures = shallowRef<Record<string, SourceFailure>>({})
  const state = ref<WidgetDataState>('idle')
  const refreshedAt = shallowRef<Date | null>(null)
  const tick = inject<Ref<number>>('dashboard:refreshTick', ref(0))
  let seq = 0

  async function run(force = false) {
    const list = ids()
    const mine = ++seq
    if (!list.length) {
      data.value = {}
      failures.value = {}
      state.value = 'idle'
      return
    }
    state.value = Object.keys(data.value).length ? 'refreshing' : 'loading'
    const options = opts.options?.() ?? {}
    const res = await Promise.allSettled(list.map(id => loadSource(id, ctx(), options[id] ?? {}, force)))
    if (mine !== seq) return // a newer request owns the widget now

    const nextData: Record<string, unknown> = {}
    const nextFail: Record<string, SourceFailure> = {}
    res.forEach((r, i) => {
      const id = list[i]!
      if (r.status === 'fulfilled') nextData[id] = r.value
      else nextFail[id] = classifyError(r.reason, SOURCES_BY_ID[id])
    })
    data.value = nextData
    failures.value = nextFail
    refreshedAt.value = new Date()

    const failed = Object.values(nextFail)
    if (!failed.length) state.value = 'ready'
    else if (failed.length < list.length) state.value = 'partial'
    else state.value = failed.every(f => f.kind === failed[0]!.kind) ? failed[0]!.kind : 'error'
  }

  watch([() => ids().join('|'), () => JSON.stringify(ctx()), () => JSON.stringify(opts.options?.() ?? {})], () => run(), { immediate: true })
  // The renderer clears the cache before bumping the tick, so a plain run()
  // still de-duplicates: ten widgets on one refresh -> one request per source.
  watch(tick, () => run())

  // Tell the frame (if any) what fed this widget.
  const registry = inject(WIDGET_META_KEY, null)
  if (registry) {
    const me = Symbol('widget-data')
    watch([state, refreshedAt, () => ids().join('|')], () => {
      const next = new Map(registry.value)
      next.set(me, { sourceIds: ids(), state: state.value, refreshedAt: refreshedAt.value })
      registry.value = next
    }, { immediate: true })
    onScopeDispose(() => {
      const next = new Map(registry.value)
      next.delete(me)
      registry.value = next
    })
  }

  const loading = computed(() => state.value === 'loading' || state.value === 'refreshing')
  return { data, failures, state, refreshedAt, loading, reload: () => run(true) }
}

export interface UseWidgetDataOptions<T> {
  options?: () => SourceOptions
  /** Treat a successful but empty payload as the 'empty' state. */
  isEmpty?: (data: T) => boolean
}

/** One source. `sourceId` returning null means "nothing to load" ('idle'). */
export function useWidgetData<T = unknown>(
  sourceId: () => string | null,
  ctx: () => WidgetFilterContext,
  opts: UseWidgetDataOptions<T> = {},
) {
  const multi = useWidgetSources(
    () => { const id = sourceId(); return id ? [id] : [] },
    ctx,
    { options: () => { const id = sourceId(); return id ? { [id]: opts.options?.() } : {} } },
  )
  const data = computed<T | null>(() => {
    const id = sourceId()
    return id ? ((multi.data.value[id] as T | undefined) ?? null) : null
  })
  const failure = computed<SourceFailure | null>(() => {
    const id = sourceId()
    return id ? multi.failures.value[id] ?? null : null
  })
  const state = computed<WidgetDataState>(() => {
    const s = multi.state.value
    if (s === 'ready' && data.value != null && opts.isEmpty?.(data.value)) return 'empty'
    return s
  })
  return {
    data,
    state,
    failure,
    /** Plain message for the failure, or null. */
    error: computed(() => failure.value?.message ?? null),
    refreshedAt: multi.refreshedAt,
    loading: multi.loading,
    reload: multi.reload,
  }
}
