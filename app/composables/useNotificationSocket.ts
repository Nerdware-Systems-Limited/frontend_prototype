/**
 * useNotificationSocket
 * =====================
 * WebSocket composable for the notifications app.
 *
 * Connects to ws://<host>/ws/notifications/?token=<jwt>
 * and handles every message type the Django consumer sends:
 *
 *   hello        → sets unreadCount and userId on connect
 *   notification → prepends to the notifications list, bumps badge
 *   count        → syncs unreadCount after a mark-read elsewhere
 *   ping         → server keepalive; we send our own client-side ping too
 *   pong         → response to our client ping; nothing to do
 *
 * Auth: the Django consumer validates the JWT from the query-string
 * (?token=...) before accepting. We read it from the auth store so
 * this composable is auth-aware without owning any auth logic itself.
 *
 * Usage:
 *   const { notifications, unreadCount, isConnected, error, connect, disconnect, markRead } =
 *     useNotificationSocket()
 *
 *   // call connect() in onMounted after the user is authenticated
 */

import { ref } from 'vue'
import { useAuthStore } from '~/stores/auth'

export type NotificationDoc = {
  id: string
  user_id: string
  event_type: string
  rule_id: string | null
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  body: string
  context: Record<string, unknown>
  channels: string[]
  delivered: Record<string, { status: string; at: string }>
  read: boolean
  read_at: string | null
  created_at: string
  expires_at: string | null
}

const KEEPALIVE_INTERVAL = 30_000   // ms - mirrors KEEPALIVE_INTERVAL in consumers.py
const RECONNECT_DELAY    = 3_000    // ms
const MAX_NOTIFICATIONS  = 200      // cap in-memory list

export function useNotificationSocket(wsBaseUrl?: string) {
  const config   = useRuntimeConfig()
  const authStore = useAuthStore()

  // Allow explicit override; fall back to runtimeConfig; fall back to hard default.
  const baseUrl = wsBaseUrl ?? config.public.notificationsWsUrl ?? 'ws://127.0.0.1:8000/ws/notifications/'

  // ── Reactive state ──────────────────────────────────────────────
  const notifications = ref<NotificationDoc[]>([])
  const unreadCount   = ref(0)
  const isConnected   = ref(false)
  const error         = ref<string | null>(null)
  const userId        = ref<string | null>(null)

  // ── Internal refs ───────────────────────────────────────────────
  let ws: WebSocket | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null
  let intentionalClose = false

  // ── Helpers ─────────────────────────────────────────────────────
  function buildUrl(): string {
    // The Django consumer authenticates via ?token=<jwt> query param
    // (see core/ws_auth.py JWTAuthMiddleware).
    const token = authStore.accessToken   // adjust if your store uses a different key
    const url   = new URL(baseUrl)
    if (token) url.searchParams.set('token', token)
    return url.toString()
  }

  function clearPing() {
    if (pingInterval !== null) {
      clearInterval(pingInterval)
      pingInterval = null
    }
  }

  // ── connect ─────────────────────────────────────────────────────
  async function connect() {
    // Never attempt this on the server - `WebSocket` doesn't exist there,
    // and this composable/store can be touched during SSR (e.g. a layout's
    // setup()) before any onMounted() guard kicks in.
    if (typeof window === 'undefined') return

    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    intentionalClose = false
    error.value = null

    // Only refresh if the current access token is missing or actually close to
    // expiring - not on every (re)connect. Without this check, a WS that keeps
    // getting dropped (e.g. a proxy/idle timeout) would hammer the refresh
    // endpoint every reconnect cycle instead of only once every ~15 minutes.
    if (!authStore.isAccessTokenFresh()) {
      if (authStore.refreshToken) {
        const token = await authStore.refreshAccessToken()

        if (!token) {
          error.value = 'Session expired. Please log in again.'
          return
        }
      } else if (!authStore.accessToken) {
        error.value = 'Not authenticated.'
        return
      }
    }

    try {
      ws = new WebSocket(buildUrl())
    } catch (err) {
      error.value = `Failed to open WebSocket: ${err}`
      return
    }

    ws.onopen = () => {
      isConnected.value = true
      error.value = null

      pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, KEEPALIVE_INTERVAL)
    }

    ws.onmessage = (event: MessageEvent) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(event.data as string)
      } catch {
        return   // malformed frame - ignore
      }

      switch (msg.type) {
        // ── hello: sent on connect with current unread count ───────
        case 'hello':
          userId.value      = msg.user_id as string
          unreadCount.value = (msg.unread_count as number) ?? 0
          break

        // ── notification: a new notification has arrived ───────────
        case 'notification': {
          const doc = msg.notification as NotificationDoc | undefined
          if (!doc) break
          // Dedupe: a reconnect, or a race with a REST poll fetching the
          // same row, can otherwise insert the same notification twice.
          if (notifications.value.some((n) => n.id === doc.id)) break
          // Prepend and cap
          notifications.value.unshift(doc)
          if (notifications.value.length > MAX_NOTIFICATIONS) {
            notifications.value.pop()
          }
          // The server sends a separate count frame right after, but we
          // also bump optimistically so the badge reacts immediately.
          if (!doc.read) unreadCount.value += 1
          break
        }

        // ── count: unread count changed (mark-read from another tab) ─
        case 'count':
          unreadCount.value = (msg.unread_count as number) ?? 0
          break

        // ── ping: server keepalive ping - we don't need to pong back ─
        // (the server sends these; we don't send pongs - the server's
        // _keepalive just fires to keep proxies happy)
        case 'ping':
          break

        // ── pong: response to our client ping - nothing to do ──────
        case 'pong':
          break

        default:
          break
      }
    }

    ws.onerror = () => {
      // onerror always precedes onclose, so we set the flag here and
      // let onclose decide whether to reconnect.
      error.value = 'WebSocket connection error'
    }

    ws.onclose = (event: CloseEvent) => {
      isConnected.value = false
      clearPing()

      if (event.code === 4001) {
        // Auth rejected by the consumer - don't reconnect, surface the error.
        error.value = 'WebSocket authentication failed (4001). Please log in again.'
        return
      }

      if (!intentionalClose && event.code !== 1000) {
        // Unexpected close - auto-reconnect after a short delay.
        setTimeout(connect, RECONNECT_DELAY)
      }
    }
  }

  // ── disconnect ──────────────────────────────────────────────────
  function disconnect() {
    intentionalClose = true
    clearPing()
    ws?.close(1000)
    ws = null
  }

  // ── markRead (client-side optimistic update + WS message) ───────
  // Sends a mark_read message over the socket so the server flips the
  // flag and pushes a fresh count frame back. The REST composable's
  // api.markRead() can be used for the authoritative POST if preferred.
  function markRead(notifId: string) {
    const doc = notifications.value.find((n) => n.id === notifId)
    if (!doc || doc.read) return

    // Optimistic update
    doc.read    = true
    doc.read_at = new Date().toISOString()
    unreadCount.value = Math.max(0, unreadCount.value - 1)

    // Tell the server (consumer.receive_json handles 'mark_read')
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'mark_read', id: notifId }))
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────
  // Deliberately NOT calling onUnmounted(disconnect) here.
  //
  // This composable is wrapped by the `notifications` Pinia *setup* store
  // (stores/notifications.ts), which is meant to live for the whole app
  // session - not for the lifetime of a single component. Pinia setup
  // stores run their setup() the first time any component calls
  // useNotificationStore(), and Vue's onUnmounted() attaches to whatever
  // component instance happens to be active at that moment. In practice
  // that meant: whichever page (or the header) first touched the store
  // got the socket torn down the moment *it* unmounted, even though every
  // other page/the header still needed the connection. Connect/disconnect
  // are called explicitly instead from a long-lived place - see the
  // onMounted/onUnmounted pair in layouts/default.vue.
  return {
    // state
    notifications,
    unreadCount,
    isConnected,
    error,
    userId,
    // actions
    connect,
    disconnect,
    markRead,
  }
}