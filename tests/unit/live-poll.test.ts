// tests/unit/live-poll.test.ts
// The live operations feed: polls on a timer, never overlaps itself, backs off on failure,
// and goes quiet while the tab is hidden.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useLivePoll } from '~/composables/useLivePoll'

function host(fetcher: () => Promise<unknown>, opts = {}) {
  let api!: ReturnType<typeof useLivePoll>
  const C = defineComponent({ setup() { api = useLivePoll(fetcher, opts); return () => null } })
  const w = mount(C)
  return { w, get api() { return api } }
}
const flush = async () => { await vi.advanceTimersByTimeAsync(0) }

beforeEach(() => { vi.useFakeTimers(); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }) })
afterEach(() => { vi.useRealTimers() })

describe('useLivePoll', () => {
  it('fetches immediately, then on every interval, and reports live', async () => {
    const f = vi.fn().mockResolvedValue(null)
    const h = host(f, { intervalMs: 10_000 })
    await flush()
    expect(f).toHaveBeenCalledTimes(1)
    expect(h.api.status.value).toBe('live')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(f).toHaveBeenCalledTimes(2)
    h.w.unmount()
  })

  it('does not start a second request while one is in flight', async () => {
    let release!: () => void
    const f = vi.fn(() => new Promise<void>(r => { release = r }))
    const h = host(f, { intervalMs: 5_000 })
    await flush()
    await h.api.refresh() // a manual refresh while the first is pending is a no-op
    expect(f).toHaveBeenCalledTimes(1)
    release()
    h.w.unmount()
  })

  it('backs off after failures, shows offline, and recovers on success', async () => {
    const f = vi.fn().mockRejectedValue(new Error('down'))
    const h = host(f, { intervalMs: 5_000 })
    await flush()
    expect(h.api.status.value).toBe('error')
    expect(h.api.lastError.value).toBe('down')
    await vi.advanceTimersByTimeAsync(10_000) // 1 failure -> delay doubles to 10s
    expect(f).toHaveBeenCalledTimes(2)
    f.mockResolvedValue(null)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(h.api.failures.value).toBe(0)
    expect(h.api.status.value).toBe('live')
    h.w.unmount()
  })

  it('pauses and resumes', async () => {
    const f = vi.fn().mockResolvedValue(null)
    const h = host(f, { intervalMs: 5_000 })
    await flush()
    h.api.pause()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(f).toHaveBeenCalledTimes(1)
    expect(h.api.status.value).toBe('paused')
    h.api.resume()
    await flush()
    expect(f).toHaveBeenCalledTimes(2)
    h.w.unmount()
  })

  it('stops polling while the tab is hidden and refreshes when it returns', async () => {
    const f = vi.fn().mockResolvedValue(null)
    const h = host(f, { intervalMs: 5_000 })
    await flush()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(f).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(f).toHaveBeenCalledTimes(2)
    h.w.unmount()
  })

  it('goes stale after three missed intervals (e.g. a hidden tab on a wall display)', async () => {
    const f = vi.fn().mockResolvedValue(null)
    const h = host(f, { intervalMs: 5_000 })
    await flush()
    expect(h.api.status.value).toBe('live')
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(20_000)
    expect(h.api.status.value).toBe('stale')
    h.w.unmount()
  })
})
