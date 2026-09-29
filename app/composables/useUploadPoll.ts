// app/composables/useUploadPoll.ts
// ─────────────────────────────────────────────────────────────────────
// One polling implementation for pages 1–3 of the Integration Hub,
// replacing three near-identical hand-rolled pollers (UploadModal.vue,
// the old uploads/[id].vue, the old uploads/index.vue) - the last of
// which re-created its setInterval on every single tick (load() called
// maybePoll(), which cleared+rebuilt the interval, and load() was itself
// the interval callback).
//
// This uses a chain of setTimeout calls instead of setInterval - there is
// only ever one live timer, it backs off (3s → 5s → 10s, then holds), it
// pauses while the tab is backgrounded (no point burning a poll the user
// can't see), and it stops for good once the caller's isInFlight()
// predicate goes false (a terminal DataUpload status).
// ─────────────────────────────────────────────────────────────────────

const BACKOFF_MS = [3_000, 5_000, 10_000]

export function useUploadPoll(fetcher: () => Promise<void>, isInFlight: () => boolean) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0
  let stopped = true

  function delayFor(n: number): number {
    return BACKOFF_MS[Math.min(n, BACKOFF_MS.length - 1)] as number
  }

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null }
  }

  function tick() {
    timer = setTimeout(async () => {
      timer = null
      attempt += 1
      try { await fetcher() } finally { scheduleNext() }
    }, delayFor(attempt))
  }

  function scheduleNext() {
    if (stopped || !isInFlight()) return
    // Backgrounded tab: don't arm a timer at all - visibilitychange below
    // resumes with an immediate fetch once it's visible again, rather
    // than a burst of missed ticks firing all at once on return.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    clearTimer()
    tick()
  }

  function onVisibilityChange() {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'hidden') {
      clearTimer()
      return
    }
    if (!stopped && isInFlight() && !timer) {
      // Resume immediately (not after another backoff wait) - the last
      // known state could be several minutes stale by the time the tab
      // comes back.
      timer = setTimeout(async () => {
        timer = null
        try { await fetcher() } finally { scheduleNext() }
      }, 0)
    }
  }

  function start() {
    stopped = false
    attempt = 0
    scheduleNext()
  }

  function stop() {
    stopped = true
    clearTimer()
  }

  onMounted(() => {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onUnmounted(() => {
    stop()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { start, stop }
}
