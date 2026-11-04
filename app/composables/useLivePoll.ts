import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

/**
 * useLivePoll - drives a live-operations data feed.
 *
 * Calls `fetcher` every `intervalMs`, but:
 *  - never overlaps itself (an in-flight request skips the tick),
 *  - pauses while the browser tab is hidden and refreshes immediately when it
 *    comes back, so a wall display or background tab doesn't burn requests,
 *  - backs off (x2, capped at 60s) after consecutive failures and recovers on
 *    the next success,
 *  - exposes `lastUpdated` plus a 1s `now` tick so the UI can show
 *    "updated 12s ago" without its own timers.
 *
 * "Silent" refreshes never toggle a loading state - the map keeps showing the
 * previous data and only swaps once new data lands, so nothing flickers.
 */
export interface LivePollOptions {
  /** Poll period in ms. Default 15s. */
  intervalMs?: number
  /** Fetch once immediately on mount. Default true. */
  immediate?: boolean
  /** Start paused (the user can resume). Default false. */
  paused?: boolean
}

export type LiveStatus = 'live' | 'paused' | 'stale' | 'error' | 'connecting'

export function useLivePoll(fetcher: () => Promise<unknown>, opts: LivePollOptions = {}) {
  const intervalMs = ref(opts.intervalMs ?? 15_000)
  const paused = ref(!!opts.paused)
  const refreshing = ref(false)
  const failures = ref(0)
  const lastUpdated = ref<number | null>(null)
  const lastError = ref<string | null>(null)
  const now = ref(Date.now())
  const hidden = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let ticker: ReturnType<typeof setInterval> | null = null
  let disposed = false

  const effectiveDelay = computed(() =>
    Math.min(60_000, intervalMs.value * 2 ** Math.min(failures.value, 3)),
  )

  async function refresh(): Promise<void> {
    if (refreshing.value || disposed) return
    refreshing.value = true
    try {
      await fetcher()
      failures.value = 0
      lastError.value = null
      lastUpdated.value = Date.now()
    } catch (e: any) {
      failures.value++
      lastError.value = e?.data?.detail ?? e?.message ?? 'Live feed unavailable'
    } finally {
      refreshing.value = false
    }
  }

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null }
  }

  function schedule() {
    clearTimer()
    if (disposed || paused.value || hidden.value) return
    timer = setTimeout(async () => {
      await refresh()
      schedule()
    }, effectiveDelay.value)
  }

  function onVisibility() {
    hidden.value = document.visibilityState === 'hidden'
    if (hidden.value) { clearTimer(); return }
    if (!paused.value) refresh().finally(schedule)
  }

  function pause() { paused.value = true; clearTimer() }
  function resume() { paused.value = false; refresh().finally(schedule) }
  function toggle() { paused.value ? resume() : pause() }
  /** Manual refresh; restarts the countdown afterwards. */
  async function refreshNow() { await refresh(); schedule() }
  function setInterval_(ms: number) { intervalMs.value = ms; schedule() }

  const ageSeconds = computed(() =>
    lastUpdated.value == null ? null : Math.max(0, Math.round((now.value - lastUpdated.value) / 1000)),
  )

  const status = computed<LiveStatus>(() => {
    if (lastUpdated.value == null) return failures.value ? 'error' : 'connecting'
    if (failures.value >= 2) return 'error'
    if (paused.value) return 'paused'
    // Stale when we've gone 3 intervals without a successful update.
    if (ageSeconds.value != null && ageSeconds.value * 1000 > intervalMs.value * 3) return 'stale'
    return 'live'
  })

  onMounted(() => {
    hidden.value = document.visibilityState === 'hidden'
    document.addEventListener('visibilitychange', onVisibility)
    ticker = setInterval(() => { now.value = Date.now() }, 1000)
    if (opts.immediate !== false && !paused.value) refresh().finally(schedule)
    else schedule()
  })

  onBeforeUnmount(() => {
    disposed = true
    clearTimer()
    if (ticker) clearInterval(ticker)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
  })

  return {
    intervalMs, paused, refreshing, failures, lastUpdated, lastError, ageSeconds, status,
    refresh: refreshNow, pause, resume, toggle, setInterval: setInterval_,
  }
}
