// tests/unit/tab-sync.test.ts
// ─────────────────────────────────────────────────────────────────────
// Cross-tab session sharing (utils/tabSync.ts + the auth store's use of it).
//
// "Tabs" are simulated with an in-memory channel hub and lock, so several
// stores - one per pinia - behave like several tabs of one browser. The fake
// backend blacklists a refresh token after one use, like the real one
// (ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION), which is what makes the
// refresh race reproducible.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createTabSync, tokenExpiry, type ChannelLike, type LocksLike, type SessionSnapshot } from '~/utils/tabSync'

const $fetchMock = vi.fn()
;(globalThis as any).$fetch = $fetchMock

import { useAuthStore } from '~/stores/auth'

// ── fakes ───────────────────────────────────────────────────────────────────

/** A BroadcastChannel hub: a message from one channel reaches every OTHER channel, asynchronously. */
function createHub() {
  const channels = new Set<FakeChannel>()
  class FakeChannel implements ChannelLike {
    onmessage: ((e: { data: unknown }) => void) | null = null
    closed = false
    constructor() { channels.add(this) }
    postMessage(data: unknown) {
      for (const c of channels) {
        if (c !== this && !c.closed) setTimeout(() => c.onmessage?.({ data: structuredClone(data) }), 0)
      }
    }
    close() { this.closed = true; channels.delete(this) }
  }
  return { channel: (): ChannelLike => new FakeChannel() }
}

/** navigator.locks stand-in: exclusive, FIFO. */
function createLocks(): LocksLike & { held: number } {
  let tail: Promise<unknown> = Promise.resolve()
  let queued = 0
  const l = {
    held: 0,
    request(_name: string, a: any, b?: any): Promise<any> {
      const opts = typeof a === 'function' ? {} : a
      const cb = typeof a === 'function' ? a : b
      if (opts.ifAvailable && queued > 0) return Promise.resolve(cb(null))
      queued++
      const run = tail.then(async () => { l.held++; try { return await cb({}) } finally { l.held--; queued-- } })
      tail = run.catch(() => undefined)
      return run
    },
  }
  return l as LocksLike & { held: number }
}

const jwt = (exp: number) => `h.${btoa(JSON.stringify({ exp })).replace(/=+$/, '')}.s`
const inFuture = (s: number) => Math.floor(Date.now() / 1000) + s

const settle = (ms = 20) => new Promise(r => setTimeout(r, ms))

const USER = { id: 'u1', email: 'a@ntsa.go.ke', role_type: 'admin' }

/** Fake backend: login hands out refresh R0; each refresh token works once, then is blacklisted. */
function installBackend() {
  const used = new Set<string>()
  let n = 0
  const calls: string[] = []
  $fetchMock.mockImplementation(async (url: string, opts: any) => {
    if (url.includes('/auth/login/')) return { access: jwt(inFuture(900)), refresh: 'R0', user: USER }
    if (url.includes('/auth/token/refresh/')) {
      const sent = opts.body.refresh as string
      calls.push(sent)
      if (used.has(sent)) throw Object.assign(new Error('token blacklisted'), { status: 401 })
      used.add(sent)
      n += 1
      await settle(5) // network latency, so concurrent refreshes really overlap
      return { access: jwt(inFuture(900 + n)), refresh: `R${n}` }
    }
    if (url.includes('/auth/logout/')) return {}
    throw new Error(`unexpected ${url}`)
  })
  return { calls }
}

function makeTab(hub: ReturnType<typeof createHub>, locks: LocksLike, onRemoteLogout = vi.fn()) {
  const store = useAuthStore(createPinia())
  store.initTabSync({ channel: hub.channel(), locks, onRemoteLogout })
  return { store, onRemoteLogout }
}

beforeEach(() => {
  $fetchMock.mockReset()
  localStorage.clear()
  sessionStorage.clear()
})

// ── tabSync primitive ───────────────────────────────────────────────────────

describe('createTabSync', () => {
  const snap = (over: Partial<SessionSnapshot> = {}): SessionSnapshot =>
    ({ access: 'A', refresh: 'R', user: { id: 'u' }, remember: false, ...over })

  function pair(a: Partial<Parameters<typeof createTabSync>[0]> = {}, b: Partial<Parameters<typeof createTabSync>[0]> = {}) {
    const hub = createHub()
    const mk = (o: Partial<Parameters<typeof createTabSync>[0]>) =>
      createTabSync({ channel: hub.channel(), getSession: () => null, onSession: vi.fn(), onLogout: vi.fn(), ...o })
    return { a: mk(a), b: mk(b) }
  }

  it('a tab with no session gets the session of a tab that has one', async () => {
    const { a, b } = pair({ getSession: () => snap() })
    expect(await b.requestSession(200)).toEqual(snap())
    a.close(); b.close()
  })

  it('resolves null when no other tab answers', async () => {
    const { a, b } = pair({ getSession: () => null })
    expect(await b.requestSession(30)).toBeNull()
    a.close(); b.close()
  })

  it('resolves null straight away when there is no channel', async () => {
    const t = createTabSync({ channel: null, getSession: () => snap(), onSession: vi.fn(), onLogout: vi.fn() })
    expect(await t.requestSession()).toBeNull()
  })

  it('takes the first answer and ignores later ones', async () => {
    const hub = createHub()
    const mk = (session: SessionSnapshot | null) =>
      createTabSync({ channel: hub.channel(), getSession: () => session, onSession: vi.fn(), onLogout: vi.fn() })
    mk(snap({ refresh: 'FIRST' })); mk(snap({ refresh: 'SECOND' }))
    const asker = mk(null)
    const got = await asker.requestSession(200)
    expect(['FIRST', 'SECOND']).toContain(got!.refresh)
  })

  it('concurrent requests share one round trip', async () => {
    const getSession = vi.fn(() => snap())
    const { b } = pair({ getSession })
    const [x, y] = await Promise.all([b.requestSession(200), b.requestSession(200)])
    expect(x).toEqual(y)
    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('announces tokens and logout to the other tabs, never back to itself', async () => {
    const onSession = vi.fn(); const onLogout = vi.fn()
    const selfSession = vi.fn(); const selfLogout = vi.fn()
    const { a, b } = pair({ onSession, onLogout }, { onSession: selfSession, onLogout: selfLogout })
    b.announceSession(snap({ refresh: 'R9' }))
    b.announceLogout()
    await settle()
    expect(onSession).toHaveBeenCalledWith(snap({ refresh: 'R9' }))
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(selfSession).not.toHaveBeenCalled()
    expect(selfLogout).not.toHaveBeenCalled()
    a.close(); b.close()
  })

  it('ignores messages that are not its own protocol or are malformed', async () => {
    const hub = createHub()
    const onSession = vi.fn(); const onLogout = vi.fn()
    createTabSync({ channel: hub.channel(), getSession: () => null, onSession, onLogout })
    const stranger = hub.channel()
    for (const junk of [
      'hello', null, { app: 'other', v: 1, msg: { type: 'logout', from: 'x' } },
      { app: 'uapts-auth', v: 2, msg: { type: 'logout', from: 'x' } },
      { app: 'uapts-auth', v: 1, msg: { type: 'tokens', from: 'x', session: { refresh: '' , remember: true, access: null } } },
      { app: 'uapts-auth', v: 1, msg: { type: 'tokens', from: 'x', session: { refresh: 'R', remember: 'yes', access: null } } },
      { app: 'uapts-auth', v: 1, msg: { type: 'explode', from: 'x' } },
    ]) stranger.postMessage(junk)
    await settle()
    expect(onSession).not.toHaveBeenCalled()
    expect(onLogout).not.toHaveBeenCalled()
  })

  it('runs the refresh directly when there is no lock support', async () => {
    const t = createTabSync({ channel: null, locks: null, getSession: () => null, onSession: vi.fn(), onLogout: vi.fn() })
    expect(await t.withRefreshLock(async () => 42)).toBe(42)
  })

  it('serialises refreshes through the lock', async () => {
    const locks = createLocks()
    const t = createTabSync({ channel: null, locks, getSession: () => null, onSession: vi.fn(), onLogout: vi.fn() })
    let concurrent = 0; let max = 0
    const job = () => t.withRefreshLock(async () => { concurrent++; max = Math.max(max, concurrent); await settle(5); concurrent-- })
    await Promise.all([job(), job(), job()])
    expect(max).toBe(1)
  })

  it('reads the expiry of a JWT and treats junk as 0', () => {
    expect(tokenExpiry(jwt(1234))).toBe(1234)
    for (const bad of [null, undefined, '', 'nope', 'a.b.c']) expect(tokenExpiry(bad as any)).toBe(0)
  })
})

// ── the store, across tabs ──────────────────────────────────────────────────

describe('auth store across tabs', () => {
  it('a new tab of a session-only login adopts the session from the open tab (the reported bug)', async () => {
    installBackend()
    const hub = createHub(); const locks = createLocks()
    const tab1 = makeTab(hub, locks).store
    await tab1.login('a@ntsa.go.ke', 'pw', /* remember */ false)
    expect(localStorage.getItem('uapts_refresh')).toBeNull() // session-only: nothing on disk

    const tab2 = makeTab(hub, locks).store
    expect(tab2.isAuthenticated).toBe(false)
    expect(await tab2.adoptFromOtherTab()).toBe(true)
    expect(tab2.isAuthenticated).toBe(true)
    expect(tab2.accessToken).toBe(tab1.accessToken)
    expect(tab2.refreshToken).toBe('R0')
    expect(tab2.user?.email).toBe('a@ntsa.go.ke')
    expect(localStorage.getItem('uapts_refresh')).toBeNull() // still nothing persisted
  })

  it('stays signed out when no other tab is open', async () => {
    const hub = createHub()
    const lonely = makeTab(hub, createLocks()).store
    expect(await lonely.adoptFromOtherTab()).toBe(false)
    expect(lonely.isAuthenticated).toBe(false)
  })

  it('does not hand out a session once the tab has signed out', async () => {
    installBackend()
    const hub = createHub(); const locks = createLocks()
    const tab1 = makeTab(hub, locks).store
    await tab1.login('a@ntsa.go.ke', 'pw', false)
    await tab1.logout()
    await settle()
    const tab2 = makeTab(hub, locks).store
    expect(await tab2.adoptFromOtherTab()).toBe(false)
  })

  it('a rotation in one tab reaches the others', async () => {
    installBackend()
    const hub = createHub(); const locks = createLocks()
    const tab1 = makeTab(hub, locks).store
    const tab2 = makeTab(hub, locks).store
    await tab1.login('a@ntsa.go.ke', 'pw', false)
    await tab2.adoptFromOtherTab()
    await tab1.refreshAccessToken()
    await settle()
    expect(tab1.refreshToken).toBe('R1')
    expect(tab2.refreshToken).toBe('R1')
    expect(tab2.accessToken).toBe(tab1.accessToken)
  })

  it('two tabs refreshing at once spend the token once and stay signed in (the rotation race)', async () => {
    const backend = installBackend()
    const hub = createHub(); const locks = createLocks()
    const a = makeTab(hub, locks); const b = makeTab(hub, locks)
    await a.store.login('a@ntsa.go.ke', 'pw', false)
    await b.store.adoptFromOtherTab()

    const [ta, tb] = await Promise.all([a.store.refreshAccessToken(), b.store.refreshAccessToken()])
    await settle()

    expect(backend.calls).toEqual(['R0']) // the old token was used exactly once
    expect(ta).toBeTruthy(); expect(tb).toBeTruthy()
    expect(a.store.isAuthenticated).toBe(true)
    expect(b.store.isAuthenticated).toBe(true)
    expect(a.store.refreshToken).toBe('R1')
    expect(b.store.refreshToken).toBe('R1')
    expect(a.onRemoteLogout).not.toHaveBeenCalled()
    expect(b.onRemoteLogout).not.toHaveBeenCalled()
  })

  it('even without lock support, a rejected token recovers from the other tab\'s announcement', async () => {
    const backend = installBackend()
    const hub = createHub()
    const a = makeTab(hub, null as any); const b = makeTab(hub, null as any)
    await a.store.login('a@ntsa.go.ke', 'pw', false)
    await b.store.adoptFromOtherTab()
    const results = await Promise.all([a.store.refreshAccessToken(), b.store.refreshAccessToken()])
    await settle()
    expect(backend.calls).toEqual(['R0', 'R0']) // no lock: both spent it, the backend rejected one...
    expect(results.every(Boolean)).toBe(true) // ...and that tab took the winner's tokens instead of logging out
    expect(a.store.refreshToken).toBe('R1')
    expect(b.store.refreshToken).toBe('R1')
    expect(a.onRemoteLogout).not.toHaveBeenCalled()
    expect(b.onRemoteLogout).not.toHaveBeenCalled()
  })

  it('a genuinely dead session still ends in sign-out, after a short wait for another tab', async () => {
    installBackend()
    const hub = createHub(); const locks = createLocks()
    const a = makeTab(hub, locks); const b = makeTab(hub, locks)
    await a.store.login('a@ntsa.go.ke', 'pw', false)
    await b.store.adoptFromOtherTab()
    $fetchMock.mockReset()
    $fetchMock.mockRejectedValue(Object.assign(new Error('expired'), { status: 401 }))
    expect(await a.store.refreshAccessToken()).toBeNull()
    await settle()
    expect(a.store.isAuthenticated).toBe(false)
    expect(b.store.isAuthenticated).toBe(false)
    expect(b.onRemoteLogout).toHaveBeenCalledTimes(1)
  })

  it('"remember me" tabs pick up the newest stored token before refreshing', async () => {
    installBackend()
    const hub = createHub(); const locks = createLocks()
    const a = makeTab(hub, locks).store
    await a.login('a@ntsa.go.ke', 'pw', /* remember */ true)
    const b = makeTab(hub, locks).store
    b.hydrate() // reads R0 from localStorage
    expect(b.refreshToken).toBe('R0')
    // Another tab rotates meanwhile and writes R7 to the shared storage; b has not heard yet.
    localStorage.setItem('uapts_refresh', 'R7')
    $fetchMock.mockReset()
    $fetchMock.mockResolvedValueOnce({ access: jwt(inFuture(900)), refresh: 'R8' })
    await b.refreshAccessToken()
    expect($fetchMock.mock.calls[0]![1].body.refresh).toBe('R7')
  })

  it('signing out in one tab signs out the others and tells them to leave', async () => {
    installBackend()
    const hub = createHub(); const locks = createLocks()
    const a = makeTab(hub, locks); const b = makeTab(hub, locks)
    await a.store.login('a@ntsa.go.ke', 'pw', false)
    await b.store.adoptFromOtherTab()
    await a.store.logout()
    await settle()
    expect(b.store.isAuthenticated).toBe(false)
    expect(b.store.refreshToken).toBeNull()
    expect(b.store.user).toBeNull()
    expect(b.onRemoteLogout).toHaveBeenCalledTimes(1)
    expect(a.onRemoteLogout).not.toHaveBeenCalled() // no echo back to the tab that signed out
  })

  it('a dead session in one tab signs out the others', async () => {
    installBackend()
    const hub = createHub(); const locks = createLocks()
    const a = makeTab(hub, locks); const b = makeTab(hub, locks)
    await a.store.login('a@ntsa.go.ke', 'pw', false)
    await b.store.adoptFromOtherTab()
    a.store.forceLogout()
    await settle()
    expect(b.store.isAuthenticated).toBe(false)
    expect(b.onRemoteLogout).toHaveBeenCalledTimes(1)
  })

  it('a login in one tab signs the other open tabs in (one session per browser)', async () => {
    installBackend()
    const hub = createHub(); const locks = createLocks()
    const a = makeTab(hub, locks).store; const b = makeTab(hub, locks).store
    await a.login('a@ntsa.go.ke', 'pw', false)
    await settle()
    expect(b.isAuthenticated).toBe(true)
    expect(b.user?.email).toBe('a@ntsa.go.ke')
  })

  it('ignores an older token that arrives late', async () => {
    installBackend()
    const hub = createHub(); const locks = createLocks()
    const a = makeTab(hub, locks).store
    const b = makeTab(hub, locks).store
    await a.login('a@ntsa.go.ke', 'pw', false)
    await settle()
    const newer = b.accessToken!
    const stranger = hub.channel()
    stranger.postMessage({ app: 'uapts-auth', v: 1, msg: { type: 'tokens', from: 'old', session: { access: jwt(inFuture(5)), refresh: 'STALE', user: USER, remember: false } } })
    await settle()
    expect(b.accessToken).toBe(newer)
    expect(b.refreshToken).not.toBe('STALE')
  })

  it('works unchanged when tab sync was never started (SSR, scripts, other tests)', async () => {
    installBackend()
    const s = useAuthStore(createPinia())
    await s.login('a@ntsa.go.ke', 'pw', true)
    expect(await s.adoptFromOtherTab()).toBe(true) // already signed in
    expect(await s.refreshAccessToken()).toBeTruthy()
    await s.logout()
    expect(s.isAuthenticated).toBe(false)
  })
})
