<template>
  <PageHeader
    eyebrow="Platform Notifications"
    title="Notifications"
    subtitle="Real-time alerts and platform notifications across all UAPTS modules"
  >
    <template #actions>
      <span class="unread-badge" v-if="liveUnread > 0">{{ liveUnread }} unread</span>
      <button class="btn" :disabled="markingAll" @click="markAll">
        {{ markingAll ? 'Marking…' : '✓ Mark all read' }}
      </button>
      <NuxtLink to="/notifications/rules" class="btn">Alert Rules →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- WebSocket status -->
  <div v-if="streamError" class="ws-banner">⚡ Live feed unavailable - {{ streamError }}</div>
  <div v-else-if="streamConnected" class="ws-connected">⚡ Live - connected</div>

  <!-- Filters -->
  <div class="filter-bar">
    <select v-model="severityFilter" class="select-sm">
      <option value="">All severities</option>
      <option value="critical">Critical</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
      <option value="info">Info</option>
    </select>
    <label class="checkbox-label">
      <input type="checkbox" v-model="unreadOnly" />
      Unread only
    </label>
    <span style="flex:1" />
    <span style="font-size:12px;color:#64748b">{{ filteredNotifications.length }} shown</span>
  </div>

  <!-- Notification list -->
  <div class="notification-list">
    <div
      v-for="n in filteredNotifications.slice(0, 60)"
      :key="n.id"
      class="notification-item"
      :class="{ unread: !n.read }"
    >
      <div class="notif-left">
        <span class="sev-dot" :style="{ background: sevColor(n.severity) }" />
      </div>
      <div class="notif-body">
        <div class="notif-top">
          <span class="notif-title">{{ n.title }}</span>
          <BadgePill :variant="sevBadge(n.severity)">{{ n.severity }}</BadgePill>
          <span class="notif-time">{{ fmtTime(n.created_at) }}</span>
        </div>
        <div class="notif-msg">{{ n.body ?? n.message ?? '-' }}</div>
        <div v-if="n.channels && n.channels.length" class="notif-channels">
          <span v-for="ch in n.channels" :key="ch" class="channel-chip">{{ ch }}</span>
        </div>
      </div>
      <div class="notif-actions">
        <button
          v-if="!n.read"
          class="btn" style="font-size:11px;padding:2px 8px"
          :disabled="readingId === n.id"
          @click.stop="markRead(n.id)"
        >✓ Read</button>
        <button
          class="btn" style="font-size:11px;padding:2px 8px;color:#dc2626"
          :disabled="deletingId === n.id"
          @click.stop="deleteNotif(n.id)"
        >✕</button>
      </div>
    </div>

    <div v-if="filteredNotifications.length === 0" class="empty-state">
      {{ loading ? 'Loading notifications…' : 'No notifications match the current filters.' }}
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Notifications')

import { useNotifications, useNotificationSocket } from '~/composables/api'
import type { Notification } from '~/composables/api'

const notifications  = ref<Notification[]>([])
const loading        = ref(true)
const error          = ref<string | null>(null)
const severityFilter = ref('')
const unreadOnly     = ref(false)
const readingId      = ref<string | null>(null)
const deletingId     = ref<string | null>(null)
const markingAll     = ref(false)

// ── WebSocket live feed ───────────────────────────────────────────────────
const socket = useNotificationSocket()
const streamConnected = socket.isConnected
const liveUnread      = socket.unreadCount
const streamError     = socket.error

// Merge new WS pushes into the page list as they arrive.
// The socket always prepends to index 0; we watch the length so mutations
// inside the array are detected without a deep scan of every field.
watch(() => socket.notifications.value.length, () => {
  const newest = socket.notifications.value[0]
  if (newest && !notifications.value.some(n => n.id === newest.id)) {
    notifications.value.unshift(newest)
  }
})

async function load() {
  loading.value = true
  error.value = null

  const [res] = await Promise.allSettled([
    useNotifications().list({ limit: 60 }),
  ])

  if (res.status === 'fulfilled') notifications.value = (res.value as any).results ?? res.value ?? []
  else error.value = 'Unable to reach the UAPTS Notifications API.'

  loading.value = false
}

onMounted(() => {
  socket.connect()
  load()
})
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 60_000) })
onUnmounted(() => { if (t) clearInterval(t) })

const filteredNotifications = computed(() =>
  notifications.value.filter(n => {
    if (severityFilter.value && n.severity !== severityFilter.value) return false
    if (unreadOnly.value && n.read) return false
    return true
  }),
)

async function markRead(id: string) {
  readingId.value = id
  try {
    // Optimistic update on page list immediately
    const idx = notifications.value.findIndex(n => n.id === id)
    if (idx !== -1) notifications.value[idx] = { ...notifications.value[idx], read: true }
    // WS mark: optimistic update in socket list + sends mark_read frame to server
    socket.markRead(id)
    // REST mark for authoritative persistence
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

function sevColor(s: string) {
  const m: Record<string,string> = { critical:'#dc2626', high:'#ea580c', medium:'#ca8a04', low:'#2563eb', info:'#64748b' }
  return m[s] ?? '#94a3b8'
}
function sevBadge(s: string) {
  const m: Record<string,string> = { critical:'danger', high:'warning', medium:'fair', low:'info', info:'neutral' }
  return m[s] ?? 'neutral'
}
function fmtTime(iso: string) {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.unread-badge { font-size:12px; font-weight:700; padding:3px 10px; border-radius:12px; background:#dc2626; color:#fff; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.ws-banner { margin-bottom:8px; padding:6px 12px; border-radius:6px; background:#fef2f2; border:1px solid #fecaca; font-size:12px; color:#dc2626; }
.ws-connected { margin-bottom:8px; padding:4px 10px; display:inline-block; border-radius:6px; background:#f0fdf4; border:1px solid #bbf7d0; font-size:11px; color:#15803d; }
.checkbox-label { display:flex; align-items:center; gap:4px; font-size:13px; cursor:pointer; }
.notification-list { display:flex; flex-direction:column; gap:6px; }
.notification-item { display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border-radius:8px; background:#fff; border:1px solid #f1f5f9; transition:background .15s; }
.notification-item.unread { background:#fefce8; border-color:#fde68a; }
.notification-item:hover { background:#f8fafc; }
.notification-item.unread:hover { background:#fef9c3; }
.notif-left { flex-shrink:0; padding-top:4px; }
.sev-dot { display:block; width:10px; height:10px; border-radius:50%; }
.notif-body { flex:1; min-width:0; }
.notif-top { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:3px; }
.notif-title { font-weight:600; font-size:14px; }
.notif-time { font-size:11px; color:#94a3b8; margin-left:auto; white-space:nowrap; }
.notif-msg { font-size:13px; color:#475569; line-height:1.45; }
.notif-channels { display:flex; gap:5px; flex-wrap:wrap; margin-top:5px; }
.channel-chip { font-size:10px; padding:2px 6px; border-radius:4px; background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; }
.notif-actions { display:flex; flex-direction:column; gap:4px; flex-shrink:0; }
.empty-state { text-align:center; color:#94a3b8; padding:32px; font-size:14px; }
</style>
