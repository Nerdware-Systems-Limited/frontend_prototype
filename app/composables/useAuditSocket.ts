import { ref, onUnmounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

export type AuditLog = {
  _id: string
  id: number                    // integer from API
  user_id: string | null        // "None" as string or null
  username: string | null
  action: string
  resource_type: string
  resource_id: string
  description: string
  old_values: Record<string, unknown>
  new_values: Record<string, unknown>
  metadata: Record<string, unknown>
  ip_address: string | null      // GenericIPAddressField(null=True)
  user_agent: string
  request_path: string
  request_method: string
  status_code: number | null     // PositiveSmallIntegerField(null=True)
  response_time: number | null  // null is valid
  created_at: string            // ISO string with tz offset
}

export type Metrics = {
  timestamp: string
  cpu: {
    overall_percent: number
    per_core: number[]
    core_count: number
    physical_cores: number
  }
  memory: {
    percent: number
    used_gb: number
    available_gb: number
    total_gb: number
  }
  disk: {
    percent: number
    used_gb: number
    free_gb: number
    total_gb: number
  }
  network: {
    bytes_sent_mb: number
    bytes_recv_mb: number
    packets_sent: number
    packets_recv: number
  }
  processes: {
    total: number
    threads: number
  }
  cache: {
    status: string
    used_memory_mb: number
    connected_clients: number
    keyspace_hits: number
    keyspace_misses: number
    hit_rate_percent: number
    total_keys: number
  }
  active_sessions: number
}

// The Django consumer authenticates via ?token=<jwt> query-string (see
// core/ws_auth.py JWTAuthMiddleware) - a browser WebSocket can't set a
// custom Authorization header, so the token has to travel in the URL.
// Without it every connection resolves to AnonymousUser (the consumer
// doesn't reject anonymous connections, so this was a silent auth gap,
// not a hard failure - WebSocketSession rows just never carried a real
// user_id). Mirrors useNotificationSocket.ts's buildUrl().
function buildUrl(baseUrl: string, token: string | null): string {
  const url = new URL(baseUrl)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

export function useAuditSocket(urlOverride?: string) {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()

  // `wsUrl` is only set when NUXT_PUBLIC_WS_URL is explicitly configured
  // (see nuxt.config.ts) - otherwise derive a same-host ws(s):// URL from
  // `apiBase`, which is always correctly configured per-environment
  // (confirmed live: NUXT_PUBLIC_API_BASE=http://localhost:8000 in dev).
  // The previous hardcoded fallback ('ws://http://uapts.eu.cc/ws/audit/')
  // had a doubled protocol and was never a valid WebSocket URL at all.
  function deriveUrlFromApiBase(): string {
    const apiBase = (config.public.apiBase as string) || 'http://localhost:8000'
    const wsBase = apiBase.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
    return `${wsBase.replace(/\/$/, '')}/ws/audit/`
  }

  const baseUrl = urlOverride || (config.public.wsUrl as string) || deriveUrlFromApiBase()

  const logs = ref<AuditLog[]>([])
  const metrics = ref<Metrics | null>(null)
  const isConnected = ref(false)
  const error = ref<string | null>(null)

  let ws: WebSocket | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null

  async function connect() {
    // WebSocket doesn't exist during SSR, and this composable can be
    // touched before any onMounted() guard kicks in.
    if (typeof window === 'undefined') return

    // `accessToken` is memory-only (never persisted - see stores/auth.ts),
    // so a fresh page load lands here with it still null until the app's
    // silent-refresh flow completes. Without this wait, connect() would
    // race that refresh and open the socket token-less nearly every time
    // (reproduced live: WebSocketSession rows kept recording user_id='').
    // Mirrors useNotificationSocket.ts's connect().
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
      ws = new WebSocket(buildUrl(baseUrl, authStore.accessToken))
    } catch (err) {
      error.value = `Failed to open WebSocket: ${err}`
      return
    }

    ws.onopen = () => {
      isConnected.value = true
      error.value = null

      // Keepalive ping every 30s
      pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30_000)
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      if (msg.type === 'initial') {
        logs.value = msg.logs         // replace with the last 50 entries

      } else if (msg.type === 'new_log') {
        logs.value.unshift(msg.log)   // prepend newest entry
        if (logs.value.length > 200) logs.value.pop()  // cap list size

      } else if (msg.type === 'metrics') {
        metrics.value = msg.data

      } else if (msg.type === 'pong') {
        // keepalive confirmed, nothing to do
      }
    }

    ws.onerror = () => {
      error.value = 'WebSocket error'
    }

    ws.onclose = (event) => {
      isConnected.value = false
      if (pingInterval) clearInterval(pingInterval)

      // Auto-reconnect after 3s unless closed intentionally (code 1000)
      if (event.code !== 1000) {
        setTimeout(connect, 3_000)
      }
    }
  }

  function disconnect() {
    ws?.close(1000)
    if (pingInterval) clearInterval(pingInterval)
  }

  // Filter logs by sending a filter message to the server
  function filterLogs(action?: string, userId?: number, limit = 50) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'filter', action, user_id: userId, limit }))
    }
  }

  onUnmounted(disconnect)

  return { logs, metrics, isConnected, error, connect, disconnect, filterLogs }
}