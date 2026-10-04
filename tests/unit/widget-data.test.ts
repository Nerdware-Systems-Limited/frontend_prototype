// tests/unit/widget-data.test.ts
// ─────────────────────────────────────────────────────────────────────
// useWidgetData - the one data primitive every dashboard widget loads
// through (docs/Widgets.md §5.4):
//   - de-duplicates identical requests, never caches failures
//   - sends only the filters a source honours
//   - a slow old response can't overwrite a newer one
//   - refresh keeps the previous data on screen ('refreshing')
//   - 403 -> forbidden, 404 on an ahead-of-backend source -> not-integrated
//   - several sources: one failure -> 'partial', not a blank widget
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { SOURCES, SOURCES_BY_ID, type WidgetSource } from '~/utils/dataSources'
import {
  classifyError, invalidateWidgetData, loadSource, useWidgetData, useWidgetSources,
} from '~/composables/useWidgetData'

/** Register throwaway sources for the duration of a test. */
function fakeSource(id: string, fetch: WidgetSource['fetch'], extra: Partial<WidgetSource> = {}): WidgetSource {
  const s: WidgetSource = {
    id, module: 'M00', label: id, source: id, tier: 'live', cadence: 'Continuous',
    permission: 'x.view', honours: [], backend: 'live', fetch, ...extra,
  }
  SOURCES_BY_ID[id] = s
  return s
}

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); await nextTick() }

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  invalidateWidgetData()
  for (const k of Object.keys(SOURCES_BY_ID)) if (k.startsWith('t.')) delete SOURCES_BY_ID[k]
})

describe('loadSource', () => {
  it('de-duplicates identical requests and re-fetches when forced', async () => {
    const fetch = vi.fn(async () => ({ n: 1 }))
    fakeSource('t.a', fetch)
    await Promise.all([loadSource('t.a', {}), loadSource('t.a', {}), loadSource('t.a', {})])
    expect(fetch).toHaveBeenCalledTimes(1)
    await loadSource('t.a', {}, {}, true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('sends only honoured filters, so unhonoured filters share one request', async () => {
    const fetch = vi.fn(async () => ({}))
    fakeSource('t.agency', fetch, { honours: ['agency'] })
    await loadSource('t.agency', { agency: 'KeNHA', county: 'Kiambu' })
    await loadSource('t.agency', { agency: 'KeNHA', county: 'Nakuru' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith({ agency: 'KeNHA' }, {})
    await loadSource('t.agency', { agency: 'KURA' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keys the cache on request options', async () => {
    const fetch = vi.fn(async () => [])
    fakeSource('t.opts', fetch)
    await loadSource('t.opts', {}, { limit: 30 })
    await loadSource('t.opts', {}, { limit: 50 })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('never caches a failure', async () => {
    let fail = true
    const fetch = vi.fn(async () => { if (fail) throw new Error('boom'); return 'ok' })
    fakeSource('t.fail', fetch)
    await expect(loadSource('t.fail', {})).rejects.toThrow('boom')
    await flush()
    fail = false
    await expect(loadSource('t.fail', {})).resolves.toBe('ok')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('rejects unknown sources', async () => {
    await expect(loadSource('t.nope', {})).rejects.toThrow(/Unknown data source/)
  })
})

describe('classifyError', () => {
  const live = { backend: 'live' as const }
  const ahead = { backend: 'ahead-of-backend' as const }
  it('maps HTTP status to an honest state', () => {
    expect(classifyError({ status: 403 }, live).kind).toBe('forbidden')
    expect(classifyError({ statusCode: 401 }, live).kind).toBe('forbidden')
    expect(classifyError({ status: 404 }, ahead).kind).toBe('not-integrated')
    expect(classifyError({ response: { status: 501 } }, ahead).kind).toBe('not-integrated')
    expect(classifyError({ status: 404 }, live).kind).toBe('error')
    expect(classifyError({ status: 500, data: { detail: 'Server down' } }, live)).toEqual({ kind: 'error', status: 500, message: 'Server down' })
    expect(classifyError(new Error('offline'), live)).toEqual({ kind: 'error', status: null, message: 'offline' })
  })
})

describe('useWidgetData', () => {
  it('goes loading -> ready, then keeps data on screen while refreshing', async () => {
    let n = 0
    const gates: ReturnType<typeof deferred<number>>[] = []
    fakeSource('t.r', () => { const d = deferred<number>(); gates.push(d); n++; return d.promise })
    const scope = effectScope()
    const w = scope.run(() => useWidgetData<number>(() => 't.r', () => ({})))!

    expect(w.state.value).toBe('loading')
    await flush() // fetch starts on a microtask
    gates[0]!.resolve(1)
    await flush()
    expect(w.state.value).toBe('ready')
    expect(w.data.value).toBe(1)
    expect(w.refreshedAt.value).toBeInstanceOf(Date)

    w.reload()
    await flush()
    expect(w.state.value).toBe('refreshing')
    expect(w.data.value).toBe(1) // stale data stays while the refresh is in flight
    gates[1]!.resolve(2)
    await flush()
    expect(w.state.value).toBe('ready')
    expect(w.data.value).toBe(2)
    expect(n).toBe(2)
    scope.stop()
  })

  it('ignores a slow response that arrives after a newer one', async () => {
    const gates = new Map<string, ReturnType<typeof deferred<string>>>()
    fakeSource('t.race', (p) => { const d = deferred<string>(); gates.set(p.agency ?? '', d); return d.promise }, { honours: ['agency'] })
    const ctx = ref<{ agency: string }>({ agency: 'OLD' })
    const scope = effectScope()
    const w = scope.run(() => useWidgetData<string>(() => 't.race', () => ctx.value))!
    await flush()
    ctx.value = { agency: 'NEW' }
    await flush()
    gates.get('NEW')!.resolve('new data')
    await flush()
    gates.get('OLD')!.resolve('old data')
    await flush()
    expect(w.data.value).toBe('new data')
    scope.stop()
  })

  it('reports forbidden and not-integrated, and drops stale data on failure', async () => {
    fakeSource('t.403', async () => { throw { status: 403 } })
    fakeSource('t.ahead', async () => { throw { status: 404 } }, { backend: 'ahead-of-backend' })
    const scope = effectScope()
    const a = scope.run(() => useWidgetData(() => 't.403', () => ({})))!
    const b = scope.run(() => useWidgetData(() => 't.ahead', () => ({})))!
    await flush()
    expect(a.state.value).toBe('forbidden')
    expect(b.state.value).toBe('not-integrated')
    expect(b.data.value).toBeNull()
    scope.stop()
  })

  it('treats a successful but empty payload as empty', async () => {
    fakeSource('t.empty', async () => [])
    const scope = effectScope()
    const w = scope.run(() => useWidgetData<unknown[]>(() => 't.empty', () => ({}), { isEmpty: d => !d.length }))!
    await flush()
    expect(w.state.value).toBe('empty')
    scope.stop()
  })

  it('is idle when no source is selected', async () => {
    const scope = effectScope()
    const w = scope.run(() => useWidgetData(() => null, () => ({})))!
    await flush()
    expect(w.state.value).toBe('idle')
    scope.stop()
  })
})

describe('useWidgetSources', () => {
  it('shows what loaded when one source fails (partial)', async () => {
    fakeSource('t.ok', async () => 'fine')
    fakeSource('t.bad', async () => { throw { status: 500 } })
    const scope = effectScope()
    const w = scope.run(() => useWidgetSources(() => ['t.ok', 't.bad'], () => ({})))!
    await flush()
    expect(w.state.value).toBe('partial')
    expect(w.data.value).toEqual({ 't.ok': 'fine' })
    expect(Object.keys(w.failures.value)).toEqual(['t.bad'])
    scope.stop()
  })

  it('two widgets on the same source make one request', async () => {
    const fetch = vi.fn(async () => 'x')
    fakeSource('t.shared', fetch)
    const scope = effectScope()
    scope.run(() => {
      useWidgetSources(() => ['t.shared'], () => ({}))
      useWidgetSources(() => ['t.shared'], () => ({}))
    })
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1)
    scope.stop()
  })
})

describe('registry sanity', () => {
  it('every source has a unique id and a permission', () => {
    const ids = SOURCES.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of SOURCES) expect(s.permission).toMatch(/\.view$/)
  })
})
