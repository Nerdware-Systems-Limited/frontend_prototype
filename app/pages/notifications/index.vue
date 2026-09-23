<template>
  <PageHeader
    eyebrow="Platform Notifications"
    title="Notification Center"
    subtitle="Real-time alerts from all UAPTS modules - traffic, fleet, safety, infrastructure and more"
  >
    <template #actions>
      <NuxtLink to="/notifications/rules" class="btn">Alert Rules →</NuxtLink>
    </template>
  </PageHeader>

  <!-- Only shown when something's actually wrong - keeps the page clean the rest of the time -->
  <div v-if="streamError" class="live-error-banner">⚠ Live feed unavailable - {{ streamError }}</div>
  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <div class="notif-panel">
    <div class="notif-panel-header">
      <div class="panel-title">
        All Notifications
        <span class="help-icon" title="Real-time alerts pushed from every UAPTS module you have access to.">?</span>
      </div>
      <label class="unread-toggle-wrap">
        <span>Only Show Unread</span>
        <div class="pill-toggle" :class="{ on: unreadOnly }" @click="unreadOnly = !unreadOnly" />
      </label>
    </div>

    <div class="notif-toolbar">
      <div class="toolbar-left">
        <label class="show-entries">
          Show
          <select v-model.number="pageSize" class="entries-select">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
          entries
        </label>
        <select v-model="severityFilter" class="entries-select" title="Filter by severity">
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select v-model="timeRangeFilter" class="entries-select" title="Filter by time range">
          <option value="all">All Time</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
        <span class="result-count">{{ filteredNotifications.length }} notification{{ filteredNotifications.length !== 1 ? 's' : '' }}</span>
      </div>
      <button class="mark-all-link" :disabled="markingAll || !unreadCount" @click="markAll">
        {{ markingAll ? 'Marking…' : 'Mark All as Read' }}
      </button>
    </div>

    <div class="notif-table">
      <div
        v-for="n in displayedNotifications"
        :key="n.id"
        class="notif-row"
        :class="{ 'notif-row--read': n.read }"
      >
        <div class="notif-row-icon" :style="{ background: sevColor(n.severity) + '14', color: sevColor(n.severity) }">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9.5" />
            <line x1="12" y1="8" x2="12" y2="12.5" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div class="notif-row-main">
          <span class="notif-row-title">{{ n.title }}</span>
          <span class="notif-row-msg">{{ n.body ?? '' }}</span>
        </div>

        <div class="notif-row-time">{{ fmtRowTime(n.created_at) }}</div>

        <div class="notif-row-actions">
          <button v-if="!n.read" class="mark-read-link" :disabled="readingId === n.id" @click="markRead(n.id)">
            {{ readingId === n.id ? 'Marking…' : 'Mark as Read' }}
          </button>
          <span v-else class="mark-read-done">Mark as Read</span>
          <button class="row-del-btn" :disabled="deletingId === n.id" title="Delete" @click="deleteNotif(n.id)">×</button>
        </div>
      </div>

      <EmptyState
        v-if="!displayedNotifications.length"
        :loading="loading"
        icon="inbox"
        :message="unreadOnly ? 'No unread notifications.' : 'No notifications yet.'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { storeToRefs } from 'pinia'
import { useNotifications } from '~/composables/api'
import type { Notification } from '~/composables/api'
import { useNotificationStore } from '~/stores/notifications'

const notifications   = ref<Notification[]>([])
const loading         = ref(true)
const error           = ref<string | null>(null)
const unreadOnly      = ref(false)
const severityFilter  = ref('')
const timeRangeFilter = ref<'all' | '24h' | '7d' | '30d'>('all')
const pageSize        = ref(20)
const readingId       = ref<string | null>(null)
const deletingId      = ref<string | null>(null)
const markingAll      = ref(false)

const TIME_RANGE_MS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

// ── WebSocket live feed ──────────────────────────────────────────────────
// Reuses the app-wide socket connection (connected/disconnected once from
// AppTopNav.vue for the whole session) rather than opening a second,
// independent connection just for this page.
const socket = useNotificationStore()
// Pinia auto-unwraps refs when read directly off the store instance, which
// loses reactivity on plain destructuring - storeToRefs keeps these reactive.
const { notifications: liveNotifications, error: streamError } = storeToRefs(socket)

watch(() => liveNotifications.value.length, () => {
  const newest = liveNotifications.value[0]
  if (newest && !notifications.value.some(n => n.id === newest.id))
    notifications.value.unshift(newest as unknown as Notification)
})

async function load() {
  loading.value = true
  error.value   = null
  // Fetched once at the backend's max page size - the time-range filter
  // (24h/7d/30d) below operates client-side on this set, so a bigger
  // fetch gives it more to work with rather than re-querying per filter.
  const [res] = await Promise.allSettled([
    useNotifications().list({ limit: 200 }),
  ])
  if (res.status === 'fulfilled') notifications.value = (res.value as any).results ?? res.value ?? []
  else error.value = 'Unable to reach the UAPTS Notifications API.'
  loading.value = false
}

onMounted(() => { load() })
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 60_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ─────────────────────────────────────────────────────────────
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

const filteredNotifications = computed(() => {
  let list = notifications.value
  if (unreadOnly.value) list = list.filter(n => !n.read)
  if (severityFilter.value) list = list.filter(n => n.severity === severityFilter.value)
  if (timeRangeFilter.value !== 'all') {
    const cutoff = Date.now() - TIME_RANGE_MS[timeRangeFilter.value]!
    list = list.filter(n => new Date(n.created_at).getTime() >= cutoff)
  }
  return list
})
const displayedNotifications = computed(() => filteredNotifications.value.slice(0, pageSize.value))

// ── Actions ──────────────────────────────────────────────────────────────
async function markRead(id: string) {
  readingId.value = id
  try {
    const idx = notifications.value.findIndex(n => n.id === id)
    if (idx !== -1) notifications.value[idx] = { ...notifications.value[idx]!, read: true }
    socket.markRead(id)
    await useNotifications().markRead(id)
  } catch {} finally { readingId.value = null }
}

async function markAll() {
  markingAll.value = true
  try {
    await useNotifications().markAllRead()
    notifications.value = notifications.value.map(n => ({ ...n, read: true }))
  } catch {} finally { markingAll.value = false }
}

async function deleteNotif(id: string) {
  deletingId.value = id
  try {
    await useNotifications().delete(id)
    notifications.value = notifications.value.filter(n => n.id !== id)
  } catch {} finally { deletingId.value = null }
}

// ── Helpers ──────────────────────────────────────────────────────────────
function sevColor(s: string) {
  const m: Record<string, string> = {
    critical: '#dc2626', high: '#ea580c', warning: '#d97706', info: '#2563eb',
  }
  return m[s] ?? '#94a3b8'
}
function fmtRowTime(iso: string) {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    const now = new Date()
    const time = d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === now.toDateString()) return `Today ${time}`
    const yday = new Date(now)
    yday.setDate(yday.getDate() - 1)
    if (d.toDateString() === yday.toDateString()) return `Yesterday ${time}`
    return `${d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })} ${time}`
  } catch { return iso }
}
</script>

<style scoped>
/* ── Banners ──────────────────────────────────────────────────────── */
.live-error-banner {
  padding: 8px 14px; border-radius: 8px;
  background: var(--danger-bg); border: 1px solid color-mix(in srgb, var(--danger-fg) 30%, transparent); color: var(--danger-fg);
  font-size: 12px; font-weight: 500; margin-bottom: 12px;
}

/* ── Panel ────────────────────────────────────────────────────────── */
.notif-panel {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;
}

.notif-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}
.panel-title {
  font-size: 15px; font-weight: 700; color: var(--fg-1);
  display: flex; align-items: center; gap: 8px;
}
.help-icon {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--surface-sunken); color: var(--fg-3);
  font-size: 10px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: help;
}
.unread-toggle-wrap { display: flex; align-items: center; gap: 10px; font-size: 12.5px; font-weight: 500; color: var(--fg-2); cursor: pointer; }
.pill-toggle {
  width: 36px; height: 20px; border-radius: 10px; background: var(--border-strong);
  position: relative; cursor: pointer; transition: background .15s; flex-shrink: 0;
}
.pill-toggle::after {
  /* Toggle knob stays white in both themes - same convention as the app's
     other .toggle switch (theme.css) - the track carries the theme. */
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%; background: #fff;
  transition: left .15s; box-shadow: 0 1px 3px rgba(0,0,0,.2);
}
.pill-toggle.on { background: var(--primary); }
.pill-toggle.on::after { left: 18px; }

/* ── Toolbar ──────────────────────────────────────────────────────── */
.notif-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; gap: 12px; flex-wrap: wrap;
  font-size: 13px;
}
.toolbar-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.show-entries { display: flex; align-items: center; gap: 6px; color: var(--fg-2); }
.entries-select {
  flex: 0 0 auto;
  width: auto;
  padding: 4px 8px; border: 1px solid var(--border-interactive); border-radius: 6px;
  font-size: 13px; background: var(--surface-2); color: var(--fg-1);
}
.entries-select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-wash); }
.result-count { color: var(--fg-3); font-size: 12px; white-space: nowrap; }
.mark-all-link {
  background: none; border: none; color: var(--link); font-size: 13px; font-weight: 600;
  cursor: pointer; padding: 0;
}
.mark-all-link:hover:not(:disabled) { text-decoration: underline; }
.mark-all-link:disabled { color: var(--fg-3); cursor: default; }

/* ── Table rows ───────────────────────────────────────────────────── */
.notif-table { display: flex; flex-direction: column; }

.notif-row {
  display: grid;
  grid-template-columns: 40px 1fr auto auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-subtle);
  transition: background .1s;
}
.notif-row:hover { background: var(--primary-wash); }

.notif-row-icon {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}

.notif-row-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.notif-row-title { font-size: 13.5px; font-weight: 700; color: var(--fg-1); }
.notif-row-msg {
  font-size: 12.5px; color: var(--fg-2);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.notif-row--read .notif-row-title { font-weight: 500; color: var(--fg-3); }
.notif-row--read .notif-row-msg { color: var(--fg-3); }

.notif-row-time {
  font-size: 12px; color: var(--fg-3); white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.notif-row-actions { display: flex; align-items: center; gap: 10px; }
.mark-read-link {
  background: none; border: none; color: var(--link); font-size: 12.5px; font-weight: 600;
  cursor: pointer; padding: 0; white-space: nowrap;
}
.mark-read-link:hover:not(:disabled) { text-decoration: underline; }
.mark-read-link:disabled { color: var(--fg-3); cursor: default; }
.mark-read-done { font-size: 12.5px; color: var(--fg-3); white-space: nowrap; }

.row-del-btn {
  width: 20px; height: 20px; border-radius: 5px; border: none; background: none;
  color: var(--fg-3); font-size: 14px; font-weight: 700; cursor: pointer;
  opacity: 0; transition: opacity .12s, color .12s, background .12s;
  display: flex; align-items: center; justify-content: center; line-height: 1;
}
.notif-row:hover .row-del-btn { opacity: 1; }
.row-del-btn:hover { background: var(--danger-bg); color: var(--danger-fg); }
.row-del-btn:disabled { opacity: .4; pointer-events: none; }

/* ── Empty state ──────────────────────────────────────────────────── */
.empty-row {
  padding: 48px 20px; text-align: center; color: var(--fg-3); font-size: 13px;
}
</style>
