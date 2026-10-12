/**
 * Cross-tab session sharing for the auth store.
 *
 * Why: with a session-only login ("Remember me" unticked) the refresh token
 * lives in sessionStorage, which belongs to ONE tab - so a new tab found no
 * session and went to /login. This module lets tabs of the same browser
 * (same origin) share that session over a BroadcastChannel instead of
 * persisting it: nothing extra is written to disk, and closing every tab still
 * ends the session.
 *
 * It also fixes a refresh race. The backend rotates refresh tokens and
 * blacklists the old one, so two tabs refreshing with the same token made the
 * second fail and log everyone out. A Web Lock serialises refreshes across
 * tabs, and each rotation is announced so every tab holds the newest token.
 *
 * Messages (all same-origin, never leave the browser):
 *   request  a tab with no session asks the others for theirs
 *   session  a tab's answer, addressed to the asker
 *   tokens   a tab logged in or rotated its tokens: everyone take these
 *   logout   a tab signed out (or its session died): everyone clear
 *
 * Pure and injectable (channel + locks passed in) so it is unit-tested with
 * fakes; the store wires in the real BroadcastChannel and navigator.locks.
 */

export interface SessionSnapshot {
  access: string | null
  refresh: string
  user: unknown
  /** Whether the originating login was "remember me" (decides where a tab persists the refresh token). */
  remember: boolean
}

export interface ChannelLike {
  postMessage(message: unknown): void
  onmessage: ((event: { data: unknown }) => void) | null
  close(): void
}

export interface LocksLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>
  /** `ifAvailable`: the callback gets null instead of waiting when another tab holds the lock. */
  request<T>(name: string, options: { ifAvailable: boolean }, callback: (lock: unknown) => Promise<T>): Promise<T>
}

export interface TabSyncOptions {
  channel?: ChannelLike | null
  locks?: LocksLike | null
  /** This tab's session, or null if it has none (it then does not answer requests). */
  getSession: () => SessionSnapshot | null
  /** Another tab logged in or rotated tokens. */
  onSession: (session: SessionSnapshot) => void
  /** Another tab signed out. */
  onLogout: () => void
  /** Unique per tab; defaults to a random id. */
  id?: string
}

export interface TabSync {
  /** Ask the other tabs for their session. Resolves null if none answers in time. */
  requestSession(timeoutMs?: number): Promise<SessionSnapshot | null>
  announceSession(session: SessionSnapshot): void
  announceLogout(): void
  /**
   * Run a token refresh with at most one tab refreshing at a time. `waited` is
   * true when another tab held the lock first - that tab has probably just
   * rotated the token, so the caller should look for its announcement.
   */
  withRefreshLock<T>(fn: (waited: boolean) => Promise<T>): Promise<T>
  /** Resolves with the next session another tab announces, or null after `timeoutMs`. */
  nextSession(timeoutMs?: number): Promise<SessionSnapshot | null>
  /** A short pause so announcements already in flight can arrive (no-op without a channel). */
  drain(ms?: number): Promise<void>
  close(): void
}

export const CHANNEL_NAME = 'uapts-auth'
export const REFRESH_LOCK = 'uapts-auth-refresh'
const APP = 'uapts-auth'
const VERSION = 1

type Message =
  | { type: 'request'; from: string }
  | { type: 'session'; from: string; to: string; session: SessionSnapshot }
  | { type: 'tokens'; from: string; session: SessionSnapshot }
  | { type: 'logout'; from: string }

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isSession(v: unknown): v is SessionSnapshot {
  const s = v as SessionSnapshot | null
  return !!s && typeof s === 'object' && typeof s.refresh === 'string' && s.refresh !== ''
    && (s.access === null || typeof s.access === 'string') && typeof s.remember === 'boolean'
}

/** Parse an incoming event; anything that is not one of ours is dropped. */
function parse(data: unknown): Message | null {
  const m = data as { app?: string; v?: number; msg?: Message } | null
  if (!m || m.app !== APP || m.v !== VERSION || !m.msg || typeof m.msg !== 'object') return null
  const msg = m.msg
  if (typeof msg.from !== 'string') return null
  switch (msg.type) {
    case 'request': case 'logout': return msg
    case 'session': return typeof msg.to === 'string' && isSession(msg.session) ? msg : null
    case 'tokens': return isSession(msg.session) ? msg : null
    default: return null
  }
}

/** Expiry (seconds since epoch) of a JWT access token, or 0 if unreadable. */
export function tokenExpiry(token: string | null | undefined): number {
  if (!token) return 0
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp : 0
  } catch { return 0 }
}

export function createTabSync(opts: TabSyncOptions): TabSync {
  const id = opts.id ?? randomId()
  const channel = opts.channel ?? null
  let pending: { resolve: (s: SessionSnapshot | null) => void; timer: ReturnType<typeof setTimeout> } | null = null
  let inFlight: Promise<SessionSnapshot | null> | null = null
  const waiters = new Set<(s: SessionSnapshot | null) => void>()

  // JSON round-trip first: the store's `user` is a Vue reactive proxy, which a real
  // BroadcastChannel cannot structured-clone (DataCloneError) - the session would
  // silently never be shared.
  const send = (msg: Message) => {
    try { channel?.postMessage(JSON.parse(JSON.stringify({ app: APP, v: VERSION, msg }))) } catch { /* channel closed */ }
  }

  if (channel) {
    channel.onmessage = (event) => {
      const msg = parse(event.data)
      if (!msg || msg.from === id) return
      switch (msg.type) {
        case 'request': {
          const session = opts.getSession()
          if (session) send({ type: 'session', from: id, to: msg.from, session })
          break
        }
        case 'session':
          if (msg.to === id && pending) {
            clearTimeout(pending.timer)
            const { resolve } = pending
            pending = null
            resolve(msg.session) // first answer wins; later ones find no pending request
          }
          break
        case 'tokens':
          opts.onSession(msg.session)
          for (const w of [...waiters]) w(msg.session)
          break
        case 'logout': opts.onLogout(); break
      }
    }
  }

  return {
    requestSession(timeoutMs = 250) {
      if (!channel) return Promise.resolve(null)
      if (inFlight) return inFlight // concurrent navigations share one request
      inFlight = new Promise<SessionSnapshot | null>((resolve) => {
        const done = (s: SessionSnapshot | null) => { inFlight = null; resolve(s) }
        pending = { resolve: done, timer: setTimeout(() => { pending = null; done(null) }, timeoutMs) }
        send({ type: 'request', from: id })
      })
      return inFlight
    },
    announceSession(session) { send({ type: 'tokens', from: id, session }) },
    announceLogout() { send({ type: 'logout', from: id }) },
    withRefreshLock(fn) {
      const locks = opts.locks
      if (!locks) return fn(false)
      // Not available means another tab is mid-refresh: queue behind it and say so.
      return locks.request(REFRESH_LOCK, { ifAvailable: true }, (lock) =>
        lock ? fn(false) : locks.request(REFRESH_LOCK, () => fn(true)))
    },
    nextSession(timeoutMs = 500) {
      if (!channel) return Promise.resolve(null)
      return new Promise<SessionSnapshot | null>((resolve) => {
        const finish = (s: SessionSnapshot | null) => { clearTimeout(timer); waiters.delete(finish); resolve(s) }
        const timer = setTimeout(() => finish(null), timeoutMs)
        waiters.add(finish)
      })
    },
    drain(ms = 50) { return channel ? new Promise<void>(r => setTimeout(r, ms)) : Promise.resolve() },
    close() {
      for (const w of [...waiters]) w(null)
      if (pending) { clearTimeout(pending.timer); pending.resolve(null); pending = null }
      if (channel) { channel.onmessage = null; channel.close() }
    },
  }
}
