import { ref, onUnmounted } from 'vue'

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
  ip_address: string
  user_agent: string
  request_path: string
  request_method: string
  status_code: number
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

export function useAuditSocket(url = 'ws://127.0.0.1:8000/ws/audit/') {
  const logs = ref<AuditLog[]>([])
  const metrics = ref<Metrics | null>(null)
  const isConnected = ref(false)
  const error = ref<string | null>(null)

  let ws: WebSocket | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null

  function connect() {
    ws = new WebSocket(url)

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