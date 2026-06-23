<script setup lang="ts">
// pages/notifications.vue — M11 Notification Center.
//
// Wires to:
//   • /api/v1/notifications/                — paged inbox for current user
//   • /api/v1/notifications/unread-count/   — bell badge count
//   • /api/v1/notifications/<id>/read/      — mark single read
//   • /api/v1/notifications/read-all/       — mark all read
//   • /api/v1/notifications/rules/          — alert rule list
//   • /api/v1/notifications/_health/        — backend status
import { RefreshCw, Bell, Check, AlertTriangle, AlertCircle, Info, Zap } from 'lucide-vue-next'
import { useNotifications } from '~/composables/api'

definePageMeta({ layout: 'default', title: 'Notifications' })

const api = useNotifications()
const items = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const unread = ref(0)
const backendOnline = ref<boolean | null>(null)
const rulesCount = ref<number>(0)
const filter = ref<string>('')    // severity filter
const showUnread = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [listRes, unreadRes, healthRes, rulesRes] = await Promise.allSettled([
      api.list({ limit: 100, unread_only: showUnread.value }),
      api.unreadCount(),
      api.health(),
      api.rules.list({ limit: 1 }),
    ])
    items.value = listRes.status === 'fulfilled' ? (listRes.value as any).results ?? [] : []
    unread.value = unreadRes.status === 'fulfilled' ? (unreadRes.value as any).count : 0
    backendOnline.value = healthRes.status === 'fulfilled'
      ? (healthRes.value as any).status === 'ok'
      : false
    rulesCount.value = rulesRes.status === 'fulfilled' ? (rulesRes.value as any).count ?? 0 : 0
  } catch (err: any) {
    error.value = err?.status === 404
      ? 'Notifications endpoints not yet wired up on the backend.'
      : err?.message ?? 'Failed to load notifications.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filtered = computed(() =>
  items.value.filter((n) => !filter.value || n.severity === filter.value),
)

async function markRead(n: any) {
  if (n.read) return
  try {
    await api.markRead(n.id)
    n.read = true
    n.read_at = new Date().toISOString()
    unread.value = Math.max(0, unread.value - 1)
  } catch { /* ignore */ }
}

async function markAllRead() {
  try {
    await api.markAllRead()
    for (const n of items.value) { n.read = true; n.read_at ||= new Date().toISOString() }
    unread.value = 0
  } catch { /* ignore */ }
}

function severityIcon(sev: string) {
  switch (sev) {
    case 'critical': return AlertCircle
    case 'high':     return AlertTriangle
    case 'warning':  return AlertTriangle
    case 'info':     return Info
    default:         return Bell
  }
}
function severityClass(sev: string) {
  return `sev-${sev}`
}

function fmt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-KE', { hour12: false })
}
</script>

<template>
  <div class="notif-page">
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M11 · Notifications</div>
        <h1 class="text-display">Notification Center</h1>
        <p class="text-sm text-fg-muted mt-1">
          {{ unread }} unread · {{ items.length }} loaded · {{ rulesCount }} alert rules
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-secondary" @click="load">
          <RefreshCw :size="13" /> Refresh
        </button>
        <button class="btn btn-primary" :disabled="!unread" @click="markAllRead">
          <Check :size="13" /> Mark all read
        </button>
      </div>
    </div>

    <!-- Status strip -->
    <div class="status-strip card">
      <div class="status-item">
        <span
          class="dot"
          :class="backendOnline === null ? 'dot-pending' : backendOnline ? 'dot-live' : 'dot-dead'"
        />
        <span class="text-xs">Backend</span>
        <span class="badge ml-1" :class="backendOnline ? 'badge-success' : 'badge-danger'">
          {{ backendOnline === null ? 'unknown' : backendOnline ? 'online' : 'offline' }}
        </span>
      </div>
      <div class="status-item">
        <Bell :size="13" class="text-primary" />
        <span class="text-xs">Unread</span>
        <span class="badge badge-primary ml-1">{{ unread }}</span>
      </div>
      <div class="status-item">
        <Zap :size="13" class="text-amber-400" />
        <span class="text-xs">Alert rules</span>
        <span class="badge badge-neutral ml-1">{{ rulesCount }}</span>
      </div>
      <div class="status-item ml-auto flex items-center gap-2">
        <label class="text-xs flex items-center gap-1">
          <input v-model="showUnread" type="checkbox" @change="load" /> Unread only
        </label>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters card">
      <select v-model="filter" class="input filter-select">
        <option value="">All severities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="warning">Warning</option>
        <option value="info">Info</option>
      </select>
      <span class="text-xs text-fg-dim ml-auto">
        Showing {{ filtered.length }} / {{ items.length }}
      </span>
    </div>

    <!-- Inbox -->
    <div class="card">
      <div v-if="error" class="card-body text-fg-muted">{{ error }}</div>
      <div v-else-if="loading && !items.length" class="card-body text-fg-muted">
        Loading notifications…
      </div>
      <div v-else-if="!filtered.length" class="card-body text-fg-muted">
        <Bell :size="14" class="inline mr-1 text-fg-dim" />
        No notifications match the current filters.
      </div>
      <div v-else class="notif-list">
        <div
          v-for="n in filtered"
          :key="n.id"
          class="notif-row"
          :class="{ unread: !n.read }"
          @click="markRead(n)"
        >
          <div class="sev-icon" :class="severityClass(n.severity)">
            <component :is="severityIcon(n.severity)" :size="14" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium truncate">{{ n.title }}</span>
              <span class="badge badge-neutral text-xs">{{ n.severity }}</span>
              <span v-if="n.event_type" class="badge badge-neutral text-xs">{{ n.event_type }}</span>
            </div>
            <div v-if="n.body" class="text-xs text-fg-muted mt-0.5">{{ n.body }}</div>
          </div>
          <div class="text-xs text-fg-dim font-mono whitespace-nowrap">
            {{ fmt(n.created_at) }}
          </div>
          <div v-if="!n.read" class="unread-dot" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notif-page { display: flex; flex-direction: column; gap: 16px; }
.card-body { padding: 18px; }

.status-strip {
  display: flex; align-items: center; gap: 20px; padding: 10px 18px; flex-wrap: wrap;
}
.status-item { display: flex; align-items: center; gap: 6px; }

.dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot-live    { background: var(--success, #10b981); }
.dot-dead    { background: var(--danger,  #ef4444); }
.dot-pending { background: var(--fg-dim,  #475569); }

.badge { padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; }
.badge-success { background: rgba(16,185,129,0.15); color: #10b981; }
.badge-danger  { background: rgba(239,68,68,0.15);  color: #ef4444; }
.badge-primary { background: rgba(59,130,246,0.15); color: #3b82f6; }
.badge-neutral { background: rgba(148,163,184,0.15); color: #94a3b8; }

.filters { display: flex; align-items: center; gap: 8px; padding: 10px 14px; }
.filter-select { width: 180px; }
.input {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 6px 10px; color: var(--fg); font-size: 0.8rem;
}

.notif-list { padding: 4px 0; }
.notif-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 18px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
}
.notif-row:last-child { border-bottom: none; }
.notif-row:hover { background: rgba(255,255,255,0.025); }
.notif-row.unread { background: rgba(59,130,246,0.04); }

.sev-icon {
  width: 28px; height: 28px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.sev-critical { background: rgba(239,68,68,0.15);  color: #ef4444; }
.sev-high     { background: rgba(245,158,11,0.15); color: #f59e0b; }
.sev-warning  { background: rgba(245,158,11,0.12); color: #fbbf24; }
.sev-info     { background: rgba(59,130,246,0.12); color: #3b82f6; }

.unread-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--primary, #3b82f6);
  flex-shrink: 0;
}

.btn-primary {
  background: var(--primary, #3b82f6); color: white;
  border: none; border-radius: var(--radius-sm); padding: 6px 12px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 6px 12px; cursor: pointer; color: var(--fg);
  display: inline-flex; align-items: center; gap: 6px;
}
</style>
