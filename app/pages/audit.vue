<template>
  <div class="audit-page">

    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">System · Compliance</div>
        <h1 class="text-heading">Audit Trail</h1>
        <p class="text-xs text-fg-muted mt-1">
          Immutable log of all system actions —
          <span v-if="totalCount > 0">{{ totalCount.toLocaleString() }} records</span>
          <span v-else class="text-fg-dim">loading…</span>
        </p>
      </div>
      <div class="flex gap-2 items-center">
        <!-- Live indicator -->
        <div class="live-badge" :class="isConnected ? 'live-badge--on' : 'live-badge--off'">
          <span class="live-dot" />
          {{ isConnected ? 'Live' : 'Reconnecting…' }}
        </div>
        <button class="btn btn-secondary" @click="exportCsv">
          <Download :size="13" /> Export CSV
        </button>
      </div>
    </div>

    <!-- Metrics Strip -->
    <div v-if="metrics" class="metrics-strip">
      <div class="metric-tile">
        <div class="metric-label">CPU</div>
        <div class="metric-value">{{ metrics.cpu.overall_percent }}<span class="metric-unit">%</span></div>
        <div class="metric-bar">
          <div class="metric-bar-fill" :class="barColor(metrics.cpu.overall_percent)"
            :style="{ width: metrics.cpu.overall_percent + '%' }" />
        </div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">Memory</div>
        <div class="metric-value">{{ metrics.memory.percent }}<span class="metric-unit">%</span></div>
        <div class="metric-bar">
          <div class="metric-bar-fill" :class="barColor(metrics.memory.percent)"
            :style="{ width: metrics.memory.percent + '%' }" />
        </div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">Disk</div>
        <div class="metric-value">{{ metrics.disk.percent }}<span class="metric-unit">%</span></div>
        <div class="metric-bar">
          <div class="metric-bar-fill" :class="barColor(metrics.disk.percent)"
            :style="{ width: metrics.disk.percent + '%' }" />
        </div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">Sessions</div>
        <div class="metric-value">{{ metrics.active_sessions }}</div>
        <div class="metric-sub">active users</div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">Processes</div>
        <div class="metric-value">{{ metrics.processes.total }}</div>
        <div class="metric-sub">{{ metrics.processes.threads }} threads</div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">Cache</div>
        <div class="metric-value" :class="metrics.cache.status === 'connected' ? 'text-green-400' : 'text-red-400'">
          {{ metrics.cache.status === 'connected' ? metrics.cache.hit_rate_percent + '%' : 'down' }}
        </div>
        <div class="metric-sub">
          {{ metrics.cache.status === 'connected' ? 'hit rate' : metrics.cache.detail?.slice(0, 24) }}
        </div>
      </div>
      <div class="metric-tile metric-tile--wide">
        <div class="metric-label">Network</div>
        <div class="metric-net">
          <span class="text-xs text-fg-dim">↑</span>
          <span class="metric-value-sm">{{ metrics.network.bytes_sent_mb }} MB</span>
          <span class="text-xs text-fg-dim ml-2">↓</span>
          <span class="metric-value-sm">{{ metrics.network.bytes_recv_mb }} MB</span>
        </div>
        <div class="metric-sub">since process start</div>
      </div>
    </div>
    <div v-else-if="isConnected" class="metrics-strip metrics-strip--skeleton">
      <div v-for="n in 7" :key="n" class="skeleton-tile" />
    </div>

    <!-- Filter Bar -->
    <div class="card filter-bar">
      <div class="filter-group">
        <Search :size="13" class="filter-icon" />
        <input v-model="search" type="text" class="filter-input" placeholder="Search user, action, resource…" />
        <button v-if="search" class="filter-clear" @click="search = ''">
          <X :size="11" />
        </button>
      </div>
      <div class="filter-divider" />
      <div class="filter-chips">
        <button v-for="action in actionFilters" :key="action.value"
          class="filter-chip"
          :class="{ active: selectedAction === action.value }"
          @click="setActionFilter(action.value)">
          {{ action.label }}
        </button>
      </div>
      <div class="filter-right">
        <select v-model="selectedStatus" class="input filter-select">
          <option value="">All status</option>
          <option value="200">200 OK</option>
          <option value="201">201 Created</option>
          <option value="400">400 Error</option>
          <option value="401">401 Unauth</option>
          <option value="403">403 Forbidden</option>
          <option value="500">500 Server Err</option>
        </select>
        <input v-model="dateFrom" type="date" class="input filter-date" />
        <span class="text-xs text-fg-dim">to</span>
        <input v-model="dateTo" type="date" class="input filter-date" />
        <button v-if="hasActiveFilters" class="btn btn-ghost btn-sm" @click="clearFilters">
          Clear
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="card table-card">
      <!-- Loading skeleton -->
      <div v-if="loading && logs.length === 0" class="table-empty">
        <div class="skeleton-rows">
          <div v-for="n in 6" :key="n" class="skeleton-row" />
        </div>
      </div>

      <template v-else>
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Method & Path</th>
              <th>IP Address</th>
              <th>Status</th>
              <th>Response</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in pagedLogs" :key="log.id"
              class="log-row"
              :class="{ 'log-row--fresh': freshIds[log.id] }"
              @click="openDetail(log)">
              <td class="font-mono text-xs text-fg-muted">{{ log.timestamp }}</td>
              <td>
                <div class="flex items-center gap-2">
                  <div class="user-mini-avatar">{{ log.user_initials }}</div>
                  <span class="text-sm">{{ log.user_display || '—' }}</span>
                </div>
              </td>
              <td>
                <span class="badge" :class="actionBadge(log.action)">{{ log.action }}</span>
              </td>
              <td>
                <span class="text-sm">{{ log.resource_type }}</span>
                <span v-if="log.resource_id" class="text-xs text-fg-dim font-mono ml-1">#{{ log.resource_id }}</span>
              </td>
              <td class="font-mono text-xs text-fg-muted">
                <span v-if="log.request_method" class="method-tag" :class="methodClass(log.request_method)">
                  {{ log.request_method }}
                </span>
                <span class="ml-1 text-fg-dim truncate-path">{{ log.request_path || '—' }}</span>
              </td>
              <td class="font-mono text-xs text-fg-muted">{{ log.ip_address || '—' }}</td>
              <td>
                <span class="font-mono text-xs px-2 py-0.5 rounded"
                  :class="statusClass(log.status_code)">{{ log.status_code || '—' }}</span>
              </td>
              <td class="font-mono text-xs text-fg-dim">
                {{ log.response_time ? formatResponseTime(log.response_time) : '—' }}
              </td>
              <td>
                <button class="btn btn-ghost btn-icon" @click.stop="openDetail(log)">
                  <ChevronRight :size="13" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Empty -->
        <div v-if="filteredLogs.length === 0 && !loading" class="table-empty">
          <ScrollText :size="32" class="text-fg-dim" />
          <div class="text-sm text-fg-muted mt-2">No audit logs match your filters</div>
          <button v-if="hasActiveFilters" class="btn btn-ghost btn-sm mt-3" @click="clearFilters">
            Clear filters
          </button>
        </div>
      </template>

      <!-- Pagination -->
      <div class="table-pagination">
        <span class="text-xs text-fg-dim">
          Showing {{ pagedRange }} of {{ filteredLogs.length }}
          <span v-if="filteredLogs.length < totalCount">({{ totalCount.toLocaleString() }} total)</span>
        </span>
        <div class="flex items-center gap-1">
          <button class="btn btn-ghost btn-icon" :disabled="page <= 1" @click="page--">
            <ChevronLeft :size="13" />
          </button>
          <span class="text-xs px-3">Page {{ page }} / {{ totalPages }}</span>
          <button class="btn btn-ghost btn-icon" :disabled="page >= totalPages" @click="page++">
            <ChevronRight :size="13" />
          </button>
        </div>
      </div>
    </div>

    <!-- Detail Drawer -->
    <Transition name="drawer">
      <div v-if="selectedLog" class="detail-overlay" @click="selectedLog = null">
        <div class="detail-drawer" @click.stop>
          <div class="detail-header">
            <div>
              <div class="text-subhead">Audit Log #{{ selectedLog.id }}</div>
              <div class="text-xs text-fg-dim font-mono">{{ selectedLog.timestamp }}</div>
            </div>
            <button class="btn btn-ghost btn-icon" @click="selectedLog = null">
              <X :size="15" />
            </button>
          </div>
          <div class="detail-body">
            <!-- Action + status side by side -->
            <div class="detail-row">
              <span class="text-xs text-fg-dim">Action</span>
              <span class="badge" :class="actionBadge(selectedLog.action)">{{ selectedLog.action }}</span>
            </div>
            <div class="detail-row">
              <span class="text-xs text-fg-dim">Status</span>
              <span class="font-mono text-xs px-2 py-0.5 rounded" :class="statusClass(selectedLog.status_code)">
                {{ selectedLog.status_code || '—' }}
              </span>
            </div>
            <div class="detail-divider" />
            <div class="detail-row">
              <span class="text-xs text-fg-dim">User</span>
              <div class="flex items-center gap-2">
                <div class="user-mini-avatar">{{ selectedLog.user_initials }}</div>
                <span class="text-sm">{{ selectedLog.user_display || 'System' }}</span>
              </div>
            </div>
            <div class="detail-row">
              <span class="text-xs text-fg-dim">IP Address</span>
              <span class="text-sm font-mono">{{ selectedLog.ip_address || '—' }}</span>
            </div>
            <div class="detail-divider" />
            <div class="detail-row">
              <span class="text-xs text-fg-dim">Resource</span>
              <span class="text-sm font-mono">
                {{ selectedLog.resource_type }}{{ selectedLog.resource_id ? ` #${selectedLog.resource_id}` : '' }}
              </span>
            </div>
            <div class="detail-row">
              <span class="text-xs text-fg-dim">Method</span>
              <span class="method-tag" :class="methodClass(selectedLog.request_method)">
                {{ selectedLog.request_method || '—' }}
              </span>
            </div>
            <div class="detail-row detail-row--block">
              <span class="text-xs text-fg-dim">Path</span>
              <span class="text-sm font-mono detail-path">{{ selectedLog.request_path || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="text-xs text-fg-dim">Response time</span>
              <span class="text-sm font-mono">
                {{ selectedLog.response_time ? formatResponseTime(selectedLog.response_time) : '—' }}
              </span>
            </div>
            <div class="detail-divider" />
            <div class="detail-row detail-row--block">
              <span class="text-xs text-fg-dim">Description</span>
              <span class="text-sm detail-description">{{ selectedLog.description || 'No description' }}</span>
            </div>
          </div>
          <!-- Drawer footer actions -->
          <div class="detail-footer">
            <button class="btn btn-ghost btn-sm" @click="filterByUser(selectedLog)">
              <Search :size="12" /> Filter this user
            </button>
            <button class="btn btn-ghost btn-sm" @click="filterByAction(selectedLog)">
              Filter this action
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import { Search, Download, ChevronRight, ChevronLeft, X, ScrollText } from 'lucide-vue-next'
import { useAudit } from '~/composables/api'

definePageMeta({ layout: 'default' })

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string        // MongoDB _id serialized as hex string
  timestamp: string
  user_display: string
  user_initials: string
  action: string
  resource_type: string
  resource_id: string
  ip_address: string | null
  status_code: number | null
  response_time: number | null
  request_method: string | null
  request_path: string | null
  description: string | null
}

interface Metrics {
  timestamp: string
  cpu: { overall_percent: number; per_core: number[]; core_count: number; physical_cores: number }
  memory: { percent: number; used_gb: number; available_gb: number; total_gb: number }
  disk: { percent: number; used_gb: number; free_gb: number; total_gb: number }
  network: { bytes_sent_mb: number; bytes_recv_mb: number; packets_sent: number; packets_recv: number }
  processes: { total: number; threads: number }
  cache: { status: string; used_memory_mb?: number; hit_rate_percent?: number; detail?: string }
  active_sessions: number
}

// ── State ────────────────────────────────────────────────────────────────────

const search = ref('')
const selectedAction = ref('all')
const selectedStatus = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)
const selectedLog = ref<AuditLog | null>(null)
const loading = ref(true)

const logs = ref<AuditLog[]>([])
const metrics = ref<Metrics | null>(null)
const totalCount = ref(0)

// Track IDs of entries received live (for the flash animation).
// Use a plain reactive object instead of ref<Set> — Vue 3 does NOT track
// Set.add() / Set.delete() mutations on a ref, so the template never updates.
const freshIds = reactive<Record<string, boolean>>({})

const PAGE_SIZE = 25

const actionFilters = [
  { value: 'all',            label: 'All' },
  { value: 'login',          label: 'Login' },
  { value: 'logout',         label: 'Logout' },
  { value: 'create',         label: 'Create' },
  { value: 'update',         label: 'Update' },
  { value: 'delete',         label: 'Delete' },
  { value: 'mfa_failed',     label: 'MFA Failed' },
  { value: 'account_locked', label: 'Locked' },
]

// ── WebSocket ────────────────────────────────────────────────────────────────

const config = useRuntimeConfig()
const WS_BASE = (config.public?.wsUrl as string) || 'ws://127.0.0.1:8000/ws/audit/'

const auth = useAuthStore()

const isConnected = ref(false)
let ws: WebSocket | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function buildWsUrl(): string | null {
  const token = auth.accessToken
  if (!token) return null
  return `${WS_BASE}?token=${encodeURIComponent(token)}`
}

function connectWs() {
  const url = buildWsUrl()
  if (!url) {
    if (auth.refreshToken) {
      // Access token not yet populated but we can get one — refresh then connect.
      reconnectTimer = setTimeout(async () => {
        await auth.refreshAccessToken()
        connectWs()
      }, 300)
    }
    // No refresh token either — user isn't authenticated; don't open a socket.
    return
  }

  if (ws) ws.close(1000)
  ws = new WebSocket(url)

  ws.onopen = () => {
    isConnected.value = true
    loading.value = false

    pingTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30_000)

    if (selectedAction.value !== 'all') sendFilter()
  }

  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data)

      if (msg.type === 'initial') {
        logs.value = msg.logs as AuditLog[]
        totalCount.value = msg.logs.length
        loading.value = false
        page.value = 1

      } else if (msg.type === 'new_log') {
        const entry = msg.log as AuditLog
        logs.value.unshift(entry)
        totalCount.value++
        if (logs.value.length > 500) logs.value.pop()

        // Flash new row for 2 s — assign/delete on reactive object (Vue 3 tracks this)
        freshIds[entry.id] = true
        setTimeout(() => delete freshIds[entry.id], 2_000)

      } else if (msg.type === 'metrics') {
        metrics.value = msg.data as Metrics
      }
      // pong: nothing to do
    } catch {
      // malformed frame — ignore
    }
  }

  ws.onerror = () => { isConnected.value = false }

  ws.onclose = (event: CloseEvent) => {
    isConnected.value = false
    if (pingTimer) clearInterval(pingTimer)
    if (event.code === 1000) return // intentional close, no reconnect

    // 4401/4403-style close codes from the consumer's reject-on-bad-token path:
    // refresh the access token first, then reconnect with the new one.
    if (event.code === 4401 || event.code === 4403) {
      reconnectTimer = setTimeout(async () => {
        await auth.refreshAccessToken()
        connectWs()
      }, 1_000)
      return
    }

    reconnectTimer = setTimeout(connectWs, 3_000)
  }
}

function sendFilter() {
  if (ws?.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({
    type:   'filter',
    action: selectedAction.value !== 'all' ? selectedAction.value : undefined,
    limit:  200,
  }))
}

function setActionFilter(value: string) {
  selectedAction.value = value
  page.value = 1
  sendFilter()
}

onMounted(async () => {
  if (!auth.accessToken) auth.hydrate()

  // REST bootstrap — load initial page of audit entries from MongoDB via
  // /api/v1/audit/ so the table has something to show before (or instead of)
  // the WebSocket stream. Failures are silent: the WS will fill the page.
  try {
    const auditApi = useAudit()
    const data = await auditApi.list({ page: 1, page_size: 50 })
    if (data?.results?.length && !logs.value.length) {
      logs.value = data.results.map((r: any) => ({
        id: r.id,
        timestamp: r.timestamp,
        user_display: r.user_email || r.user_id || 'System',
        user_initials: (r.user_email || 'SY').slice(0, 2).toUpperCase(),
        action: r.action,
        resource_type: r.resource,
        resource_id: r.resource_id ?? '',
        ip_address: r.ip ?? null,
        status_code: null,
        response_time: null,
        request_method: null,
        request_path: null,
        description: r.detail ? JSON.stringify(r.detail) : null,
      }))
      totalCount.value = data.count ?? logs.value.length
      loading.value = false
    }
  } catch { /* WS will populate */ }

  connectWs()
})

onUnmounted(() => {
  ws?.close(1000)
  if (pingTimer)      clearInterval(pingTimer)
  if (reconnectTimer) clearTimeout(reconnectTimer)
})

// ── Filtering & pagination ────────────────────────────────────────────────────

const filteredLogs = computed(() => {
  return logs.value.filter(l => {
    if (selectedStatus.value && String(l.status_code) !== selectedStatus.value) return false
    if (dateFrom.value && l.timestamp < dateFrom.value) return false
    if (dateTo.value   && l.timestamp.slice(0, 10) > dateTo.value) return false
    if (search.value) {
      const q = search.value.toLowerCase()
      if (!(
        l.user_display?.toLowerCase().includes(q) ||
        l.action.includes(q) ||
        l.resource_type.includes(q) ||
        l.ip_address?.includes(q) ||
        l.request_path?.includes(q) ||
        l.description?.toLowerCase().includes(q)
      )) return false
    }
    return true
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredLogs.value.length / PAGE_SIZE)))

const pagedLogs = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredLogs.value.slice(start, start + PAGE_SIZE)
})

const pagedRange = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE + 1
  const end = Math.min(page.value * PAGE_SIZE, filteredLogs.value.length)
  return filteredLogs.value.length === 0 ? '0' : `${start}–${end}`
})

const hasActiveFilters = computed(() =>
  search.value || selectedStatus.value || dateFrom.value || dateTo.value || selectedAction.value !== 'all'
)

watch([search, selectedStatus, dateFrom, dateTo], () => { page.value = 1 })

// ── Actions ──────────────────────────────────────────────────────────────────

function openDetail(log: AuditLog) { selectedLog.value = log }

function filterByUser(log: AuditLog) {
  search.value = log.user_display || ''
  selectedLog.value = null
  page.value = 1
}

function filterByAction(log: AuditLog) {
  const match = actionFilters.find(f => f.value === log.action)
  selectedAction.value = match ? log.action : 'all'
  selectedLog.value = null
  page.value = 1
  sendFilter()
}

function clearFilters() {
  search.value = ''
  selectedStatus.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  selectedAction.value = 'all'
  page.value = 1
  sendFilter()
}

function exportCsv() {
  const cols: (keyof AuditLog)[] = [
    'id', 'timestamp', 'user_display', 'action', 'resource_type', 'resource_id',
    'ip_address', 'status_code', 'response_time', 'request_method', 'request_path', 'description',
  ]
  const header = cols.join(',')
  const rows = filteredLogs.value.map(l =>
    cols.map(c => {
      const v = l[c]
      if (v === null || v === undefined) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }).join(',')
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function actionBadge(action: string) {
  const map: Record<string, string> = {
    login: 'badge-success', logout: 'badge-neutral', create: 'badge-info',
    update: 'badge-primary', delete: 'badge-danger', export: 'badge-neutral',
    mfa_failed: 'badge-danger', account_locked: 'badge-danger', mfa_verified: 'badge-success',
    access: 'badge-neutral', import: 'badge-neutral',
  }
  return map[action] ?? 'badge-neutral'
}

function statusClass(code: number | null) {
  if (!code) return 'text-fg-dim'
  if (code < 300) return 'text-green-400 bg-green-400/10'
  if (code < 400) return 'text-cyan-400 bg-cyan-400/10'
  if (code < 500) return 'text-amber-400 bg-amber-400/10'
  return 'text-red-400 bg-red-400/10'
}

function methodClass(method: string | null) {
  const m = method?.toUpperCase()
  if (m === 'GET')    return 'method-get'
  if (m === 'POST')   return 'method-post'
  if (m === 'PUT' || m === 'PATCH') return 'method-patch'
  if (m === 'DELETE') return 'method-delete'
  return 'method-other'
}

function barColor(pct: number) {
  if (pct > 85) return 'bar-danger'
  if (pct > 65) return 'bar-warn'
  return 'bar-ok'
}

function formatResponseTime(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(2) + 's'
  return Math.round(ms) + 'ms'
}
</script>

<style scoped>
.audit-page { display: flex; flex-direction: column; gap: 16px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }

/* Live badge */
.live-badge {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.75rem; font-weight: 500;
  padding: 4px 10px; border-radius: 20px;
  border: 1px solid var(--border);
}
.live-badge--on  { color: #4ade80; border-color: rgba(74,222,128,0.3); background: rgba(74,222,128,0.08); }
.live-badge--off { color: var(--fg-dim); }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.live-badge--on .live-dot { animation: pulse-dot 1.8s ease-in-out infinite; }
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

/* ── Metrics strip ────────────────────────────────────────────────────────── */
.metrics-strip {
  display: grid;
  grid-template-columns: repeat(6, 1fr) 1.6fr;
  gap: 8px;
}
.metrics-strip--skeleton {
  grid-template-columns: repeat(7, 1fr);
}
.metric-tile {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.metric-tile--wide { grid-column: span 1; }
.metric-label {
  font-size: 0.6875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}
.metric-value {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
}
.metric-value-sm {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
}
.metric-unit { font-size: 0.75rem; font-weight: 400; color: var(--fg-dim); margin-left: 1px; }
.metric-sub { font-size: 0.6875rem; color: var(--fg-dim); }
.metric-net { display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap; }
.metric-bar {
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 2px;
}
.metric-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 1s ease;
}
.bar-ok     { background: #4ade80; }
.bar-warn   { background: #fbbf24; }
.bar-danger { background: #f87171; }
.skeleton-tile {
  height: 80px;
  background: linear-gradient(90deg, var(--bg-2) 25%, var(--border) 50%, var(--bg-2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: var(--radius);
}

/* Filter bar */
.filter-bar {
  display: flex; align-items: center; gap: 12px; padding: 10px 16px; flex-wrap: wrap;
}
.filter-group {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-2); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 0 12px;
}
.filter-icon { color: var(--fg-dim); flex-shrink: 0; }
.filter-input {
  background: transparent; border: none; outline: none;
  color: var(--fg); font-size: 0.8125rem; width: 200px;
  padding: 8px 0; font-family: var(--font-sans);
}
.filter-input::placeholder { color: var(--fg-dim); }
.filter-clear {
  background: none; border: none; cursor: pointer;
  color: var(--fg-dim); display: flex; align-items: center; padding: 2px;
}
.filter-clear:hover { color: var(--fg); }
.filter-divider { width: 1px; height: 24px; background: var(--border); }
.filter-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.filter-chip {
  padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 500;
  border: 1px solid var(--border); background: transparent;
  color: var(--fg-muted); cursor: pointer; transition: all 0.1s;
}
.filter-chip:hover, .filter-chip.active {
  border-color: var(--primary); color: var(--primary); background: rgba(59,130,246,0.08);
}
.filter-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.filter-select, .filter-date { width: auto; padding: 6px 10px; font-size: 0.75rem; }

/* Table */
.table-card { overflow: hidden; }
.log-row { cursor: pointer; }

/* New-entry flash */
@keyframes row-flash {
  0%   { background: rgba(74,222,128,0.10); }
  100% { background: transparent; }
}
.log-row--fresh { animation: row-flash 2s ease-out; }

.user-mini-avatar {
  width: 24px; height: 24px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), #a855f7);
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: white; flex-shrink: 0;
}

/* HTTP method tags */
.method-tag {
  display: inline-block; font-size: 0.6875rem; font-weight: 700;
  font-family: var(--font-mono, monospace); padding: 1px 5px;
  border-radius: 3px; letter-spacing: 0.03em;
}
.method-get    { color: #4ade80; background: rgba(74,222,128,0.10); }
.method-post   { color: #60a5fa; background: rgba(96,165,250,0.10); }
.method-patch  { color: #fbbf24; background: rgba(251,191,36,0.10); }
.method-delete { color: #f87171; background: rgba(248,113,113,0.10); }
.method-other  { color: var(--fg-dim); background: var(--bg-2); }

.truncate-path {
  display: inline-block; max-width: 180px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  vertical-align: bottom;
}

/* Skeleton loader */
.skeleton-rows { display: flex; flex-direction: column; gap: 1px; padding: 8px 0; }
.skeleton-row {
  height: 44px;
  background: linear-gradient(90deg, var(--bg-2) 25%, var(--border) 50%, var(--bg-2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: var(--radius-sm);
  margin: 0 16px;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.table-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px;
}
.table-pagination {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-top: 1px solid var(--border);
}

/* Detail Drawer */
.detail-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100;
  display: flex; align-items: stretch; justify-content: flex-end;
}
.detail-drawer {
  width: 420px; max-width: 100vw;
  background: var(--bg-2); border-left: 1px solid var(--border);
  display: flex; flex-direction: column; overflow: hidden;
}
.detail-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 20px 16px; border-bottom: 1px solid var(--border);
}
.detail-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.detail-footer {
  display: flex; gap: 8px; padding: 12px 16px;
  border-top: 1px solid var(--border);
}
.detail-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.detail-row--block { align-items: flex-start; flex-direction: column; gap: 6px; }
.detail-divider { height: 1px; background: var(--border); }
.detail-path {
  word-break: break-all; color: var(--fg-muted); font-size: 0.8125rem;
}
.detail-description { color: var(--fg-muted); line-height: 1.5; }

.btn-sm { padding: 5px 10px; font-size: 0.75rem; }

.drawer-enter-active, .drawer-leave-active { transition: opacity 0.2s; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-active .detail-drawer, .drawer-leave-active .detail-drawer { transition: transform 0.25s ease; }
.drawer-enter-from .detail-drawer, .drawer-leave-to .detail-drawer { transform: translateX(100%); }
</style>