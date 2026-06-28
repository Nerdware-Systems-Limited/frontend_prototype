// app/composables/api/useNotificationSocket.ts
// ─────────────────────────────────────────────────────────────────────
// WebSocket composable for the notifications app.
//
// Connects to ws://<host>/ws/notifications/?token=<jwt>
// and handles every message type the Django consumer sends:
//
//   hello        → sets unreadCount and userId on connect
//   notification → prepends to the notifications list, bumps badge
//   count        → syncs unreadCount after a mark-read elsewhere
//   ping         → server keepalive; we send our own client ping too
//   pong         → response to our client ping; nothing to do
//
// Auth: the Django consumer validates the JWT from the query-string
// (?token=...) via core/ws_auth.py JWTAuthMiddleware. We read it from
// the auth store so this composable is auth-aware without owning any
// auth logic itself.
//
// Usage:
//   const socket = useNotificationSocket()
//   // call socket.connect() inside onMounted after the user is authenticated
//   onMounted(() => socket.connect())
//   onUnmounted(() => socket.disconnect()) // also called automatically
// ─────────────────────────────────────────────────────────────────────

import { useAuthStore } from '~/stores/auth'
import type { Notification } from './useNotifications'

const KEEPALIVE_INTERVAL = 30_000  // ms - mirror KEEPALIVE_INTERVAL in consumers.py
const RECONNECT_DELAY    = 3_000   // ms
const MAX_NOTIFICATIONS  = 200     // cap in-memory list

export function useNotificationSocket(wsBaseUrl?: string) {
  const config    = useRuntimeConfig()
  const authStore = useAuthStore()

  // Allow explicit override; fall back to runtimeConfig; fall back to hard default.
  const baseUrl = wsBaseUrl
    ?? config.public.notificationsWsUrl as string
    ?? 'ws://127.0.0.1:8000/ws/notifications/'

  // ── Reactive state ──────────────────────────────────────────────────

  const notifications = ref<Notification[]>([])
  const unreadCount   = ref(0)
  const isConnected   = ref(false)
  const error         = ref<string | null>(null)
  const userId        = ref<string | null>(null)

  // ── Internal refs ───────────────────────────────────────────────────

  let ws: WebSocket | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null
  let intentionalClose = false

  // ── Helpers ─────────────────────────────────────────────────────────

  function buildUrl(): string {
    const token = authStore.accessToken
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

  // ── connect ─────────────────────────────────────────────────────────

  async function connect() {
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    intentionalClose = false
    error.value = null

    // Ensure a fresh access token before opening the socket.
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
        return  // malformed frame - ignore
      }

      switch (msg.type) {
        case 'hello':
          userId.value      = msg.user_id as string
          unreadCount.value = (msg.unread_count as number) ?? 0
          break

        case 'notification': {
          const doc = msg.notification as Notification | undefined
          if (!doc) break
          notifications.value.unshift(doc)
          if (notifications.value.length > MAX_NOTIFICATIONS) {
            notifications.value.pop()
          }
          // Optimistic badge bump; server sends a count frame right after too.
          if (!doc.read) unreadCount.value += 1
          break
        }

        case 'count':
          unreadCount.value = (msg.unread_count as number) ?? 0
          break

        case 'ping':
        case 'pong':
          break
      }
    }

    ws.onerror = () => {
      // onerror always precedes onclose - set flag here, let onclose handle reconnect.
      error.value = 'WebSocket connection error'
    }

    ws.onclose = (event: CloseEvent) => {
      isConnected.value = false
      clearPing()

      if (event.code === 4001) {
        // Auth rejected by the consumer - do not reconnect.
        error.value = 'WebSocket authentication failed (4001). Please log in again.'
        return
      }

      if (!intentionalClose && event.code !== 1000) {
        // Unexpected close - auto-reconnect after a short delay.
        setTimeout(connect, RECONNECT_DELAY)
      }
    }
  }

  // ── disconnect ──────────────────────────────────────────────────────

  function disconnect() {
    intentionalClose = true
    clearPing()
    ws?.close(1000)
    ws = null
  }

  // ── markRead ────────────────────────────────────────────────────────
  // Optimistic local update + WS mark_read frame.
  // The server flips the flag and pushes a fresh count frame back.
  // Use useNotifications().markRead() in parallel for REST persistence.

  function markRead(notifId: string) {
    const doc = notifications.value.find(n => n.id === notifId)
    if (!doc || doc.read) return

    doc.read    = true
    doc.read_at = new Date().toISOString()
    unreadCount.value = Math.max(0, unreadCount.value - 1)

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'mark_read', id: notifId }))
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  onUnmounted(disconnect)

  return {
    notifications,
    unreadCount,
    isConnected,
    error,
    userId,
    connect,
    disconnect,
    markRead,
  }
}
