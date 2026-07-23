<template>
  <PageHeader
    eyebrow="Platform Notifications"
    title="Notification Center"
    subtitle="Real-time alerts from all UAPTS modules - traffic, fleet, safety, infrastructure and more"
  >
    <template #actions>
      <div v-if="liveUnread > 0" class="unread-pill">{{ liveUnread }} unread</div>
      <button class="btn" :disabled="markingAll" @click="markAll">
        {{ markingAll ? 'Marking…' : '✓ Mark all read' }}
      </button>
      <NuxtLink to="/notifications/rules" class="btn-primary">Alert Rules →</NuxtLink>
    </template>
  </PageHeader>

  <!-- Live connection status -->
  <div
    class="live-status"
    :class="streamError ? 'live-status--error' : streamConnected ? 'live-status--ok' : 'live-status--idle'"
  >
    <span class="live-dot" />
    <span v-if="streamError">Live feed unavailable - {{ streamError }}</span>
    <span v-else-if="streamConnected">Live · Connected to notification stream</span>
    <span v-else>Connecting to live feed…</span>
  </div>

  <!-- KPI strip -->
  <div class="nkpi-strip">
    <button class="nkpi" :class="{ 'nkpi--active': !severityFilter && !unreadOnly }" @click="severityFilter = ''; unreadOnly = false">
      <span class="nkpi-val">{{ notifications.length }}</span>
      <span class="nkpi-lbl">Total</span>
    </button>
    <button class="nkpi nkpi--unread" :class="{ 'nkpi--active': unreadOnly }" @click="unreadOnly = !unreadOnly; severityFilter = ''">
      <span class="nkpi-val">{{ unreadCount }}</span>
      <span class="nkpi-lbl">Unread</span>
    </button>
    <button class="nkpi nkpi--critical" :class="{ 'nkpi--active': severityFilter === 'critical' }" @click="toggleSev('critical')">
      <span class="nkpi-val">{{ bySeverity('critical') }}</span>
      <span class="nkpi-lbl">Critical</span>
    </button>
    <button class="nkpi nkpi--high" :class="{ 'nkpi--active': severityFilter === 'high' }" @click="toggleSev('high')">
      <span class="nkpi-val">{{ bySeverity('high') }}</span>
      <span class="nkpi-lbl">High</span>
    </button>
    <button class="nkpi nkpi--warning" :class="{ 'nkpi--active': severityFilter === 'warning' }" @click="toggleSev('warning')">
      <span class="nkpi-val">{{ bySeverity('warning') }}</span>
      <span class="nkpi-lbl">Warning</span>
    </button>
    <button class="nkpi nkpi--info" :class="{ 'nkpi--active': severityFilter === 'info' }" @click="toggleSev('info')">
      <span class="nkpi-val">{{ bySeverity('info') }}</span>
      <span class="nkpi-lbl">Info</span>
    </button>
  </div>

  <!-- Filter row -->
  <div class="filter-row">
    <div class="sev-pills">
      <button class="sev-pill" :class="{ 'sev-pill--active': !severityFilter }" @click="severityFilter = ''">All</button>
      <button
        v-for="s in SEVERITIES"
        :key="s"
        class="sev-pill"
        :class="{ 'sev-pill--active': severityFilter === s }"
        :style="severityFilter === s
          ? `background:${sevColor(s)};border-color:${sevColor(s)};color:#fff`
          : `border-color:${sevColor(s)}33;color:${sevColor(s)}`"
        @click="toggleSev(s)"
      >{{ s }}</button>
    </div>

    <label class="toggle-wrap">
      <div class="pill-toggle" :class="{ on: unreadOnly }" @click="unreadOnly = !unreadOnly" />
      <span>Unread only</span>
    </label>

    <span class="result-count">
      {{ filteredNotifications.length }} notification{{ filteredNotifications.length !== 1 ? 's' : '' }}
    </span>
  </div>

  <!-- Error banner -->
  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Notification feed -->
  <div v-if="filteredNotifications.length" class="notif-feed">
    <template v-for="group in grouped" :key="group.label">
      <div class="group-label">
        <span class="group-label-text">{{ group.label }}</span>
        <span class="group-label-count">{{ group.items.length }}</span>
      </div>

      <div
        v-for="n in group.items"
        :key="n.id"
        class="notif-card"
        :class="{ 'notif-card--unread': !n.read }"
        :style="{ '--sev': sevColor(n.severity) }"
      >
        <div class="notif-icon" :style="{ background: sevColor(n.severity) + '16', color: sevColor(n.severity) }">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9.5" />
            <line x1="12" y1="8" x2="12" y2="12.5" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div class="notif-content">
          <div class="notif-header">
            <span class="notif-title" :class="{ 'notif-title--bold': !n.read }">{{ n.title }}</span>
            <span class="sev-chip" :style="{ background: sevColor(n.severity) + '14', color: sevColor(n.severity), borderColor: sevColor(n.severity) + '40' }">{{ n.severity }}</span>
            <span class="notif-time" :title="fmtTime(n.created_at)">{{ relTime(n.created_at) }}</span>
          </div>
          <p class="notif-body">{{ n.body ?? n.message ?? '' }}</p>
          <div v-if="n.channels?.length" class="ch-row">
            <span v-for="ch in n.channels" :key="ch" class="ch-pill">{{ ch }}</span>
          </div>
        </div>

        <div class="notif-actions">
          <button
            v-if="!n.read"
            class="na-btn na-btn--read"
            :disabled="readingId === n.id"
            title="Mark as read"
            @click.stop="markRead(n.id)"
          >✓</button>
          <button
            class="na-btn na-btn--del"
            :disabled="deletingId === n.id"
            title="Delete"
            @click.stop="deleteNotif(n.id)"
          >✕</button>
        </div>
      </div>
    </template>
  </div>

  <!-- Empty state -->
  <div v-else class="empty-state">
    <div class="empty-icon">
      <span>🔔</span>
    </div>
    <div class="empty-title">{{ loading ? 'Loading notifications…' : 'All clear' }}</div>
    <div class="empty-sub">
      {{ loading ? 'Please wait…' : severityFilter || unreadOnly ? 'No notifications match the current filters.' : 'You have no notifications yet.' }}
    </div>
    <button v-if="(severityFilter || unreadOnly) && !loading" class="btn" style="margin-top:12px" @click="severityFilter = ''; unreadOnly = false">
      Clear filters
    </button>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Notifications')

import { storeToRefs } from 'pinia'
import { useNotifications } from '~/composables/api'
import type { Notification } from '~/composables/api'
import { useNotificationStore } from '~/stores/notifications'

const SEVERITIES = ['critical', 'high', 'warning', 'info'] as const

const notifications  = ref<Notification[]>([])
const loading        = ref(true)
const error          = ref<string | null>(null)
const severityFilter = ref('')
const unreadOnly     = ref(false)
const readingId      = ref<string | null>(null)
const deletingId     = ref<string | null>(null)
const markingAll     = ref(false)

// ── WebSocket live feed ──────────────────────────────────────────────────
// Reuses the app-wide socket connection (connected/disconnected once from
// AppTopNav.vue for the whole session) rather than opening a second,
// independent connection just for this page.
const socket = useNotificationStore()
// Pinia auto-unwraps refs when read directly off the store instance, which
// loses reactivity on plain destructuring - storeToRefs keeps these reactive.
const { notifications: liveNotifications, isConnected: streamConnected, unreadCount: liveUnread, error: streamError } = storeToRefs(socket)

watch(() => liveNotifications.value.length, () => {
  const newest = liveNotifications.value[0]
  if (newest && !notifications.value.some(n => n.id === newest.id))
    notifications.value.unshift(newest)
})

async function load() {
  loading.value = true
  error.value   = null
  const [res] = await Promise.allSettled([
    useNotifications().list({ limit: 60 }),
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
function bySeverity(s: string) { return notifications.value.filter(n => n.severity === s).length }

const filteredNotifications = computed(() =>
  notifications.value.filter(n => {
    if (severityFilter.value && n.severity !== severityFilter.value) return false
    if (unreadOnly.value && n.read) return false
    return true
  }),
)

const grouped = computed(() => {
  const now  = new Date()
  const tStr = now.toDateString()
  const yday = new Date(now)
  yday.setDate(yday.getDate() - 1)
  const yStr = yday.toDateString()

  const groups = [
    { label: 'Today',     items: [] as Notification[] },
    { label: 'Yesterday', items: [] as Notification[] },
    { label: 'Earlier',   items: [] as Notification[] },
  ]

  for (const n of filteredNotifications.value.slice(0, 60)) {
    const d = new Date(n.created_at).toDateString()
    if (d === tStr)      groups[0].items.push(n)
    else if (d === yStr) groups[1].items.push(n)
    else                 groups[2].items.push(n)
  }

  return groups.filter(g => g.items.length > 0)
})

// ── Actions ──────────────────────────────────────────────────────────────
function toggleSev(s: string) { severityFilter.value = severityFilter.value === s ? '' : s }

async function markRead(id: string) {
  readingId.value = id
  try {
    const idx = notifications.value.findIndex(n => n.id === id)
    if (idx !== -1) notifications.value[idx] = { ...notifications.value[idx], read: true }
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
    critical: '#dc2626', high: '#ea580c', warning: '#d97706', info: '#64748b',
  }
  return m[s] ?? '#94a3b8'
}
function fmtTime(iso: string) {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}
function relTime(iso: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m    = Math.floor(diff / 60_000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)  return `${d}d ago`
  return fmtTime(iso)
}
</script>

<style scoped>
/* ── Banners ──────────────────────────────────────────────────────── */
.error-banner {
  padding: 10px 16px; border-radius: 8px;
  background: #fef9c3; border: 1px solid #ca8a04;
  font-size: 13px; margin-bottom: 4px;
}

/* ── Live status bar ──────────────────────────────────────────────── */
.live-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 16px;
  border: 1px solid transparent;
}
.live-status--ok    { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
.live-status--error { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
.live-status--idle  { background: #f8fafc; border-color: #e2e8f0; color: #64748b; }
.live-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  background: currentColor;
}
.live-status--ok .live-dot { animation: pulse-dot 2s ease-in-out infinite; }
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: .5; transform: scale(.8); }
}

/* ── KPI strip ────────────────────────────────────────────────────── */
.nkpi-strip {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
@media (max-width: 900px) { .nkpi-strip { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 480px) { .nkpi-strip { grid-template-columns: repeat(2, 1fr); } }

.nkpi {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 14px 10px; border-radius: 10px;
  background: #fff; border: 1px solid #e2e8f0;
  cursor: pointer; transition: all .15s; gap: 4px; text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
}
.nkpi:hover { border-color: #94a3b8; box-shadow: 0 3px 8px rgba(0,0,0,.08); }
.nkpi--active { border-color: #006838 !important; box-shadow: 0 0 0 2px rgba(0,104,56,.12) !important; }
.nkpi-val { font-size: 22px; font-weight: 800; color: #1e293b; line-height: 1; font-variant-numeric: tabular-nums; }
.nkpi-lbl { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; }

.nkpi--unread   { border-top: 3px solid #2563eb; }
.nkpi--unread .nkpi-val   { color: #2563eb; }
.nkpi--critical { border-top: 3px solid #dc2626; }
.nkpi--critical .nkpi-val { color: #dc2626; }
.nkpi--high     { border-top: 3px solid #ea580c; }
.nkpi--high .nkpi-val     { color: #ea580c; }
.nkpi--warning  { border-top: 3px solid #d97706; }
.nkpi--warning .nkpi-val  { color: #d97706; }
.nkpi--info     { border-top: 3px solid #2563eb; }

/* ── Filter row ───────────────────────────────────────────────────── */
.filter-row {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin-bottom: 16px;
  padding: 10px 14px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
}
.sev-pills { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; }
.sev-pill {
  padding: 4px 12px; border-radius: 20px; border: 1px solid #e2e8f0;
  background: transparent; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all .12s; color: #64748b; white-space: nowrap;
  text-transform: capitalize;
}
.sev-pill:hover { border-color: #94a3b8; }
.sev-pill--active { background: #1e293b; border-color: #1e293b; color: #fff; }

.toggle-wrap { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #374151; cursor: pointer; white-space: nowrap; }
.pill-toggle {
  width: 36px; height: 20px; border-radius: 10px; background: #d1d5db;
  position: relative; cursor: pointer; transition: background .15s; flex-shrink: 0;
}
.pill-toggle::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%; background: #fff;
  transition: left .15s; box-shadow: 0 1px 3px rgba(0,0,0,.2);
}
.pill-toggle.on { background: #006838; }
.pill-toggle.on::after { left: 18px; }
.result-count { font-size: 12px; color: #94a3b8; white-space: nowrap; margin-left: auto; }

/* ── Notification feed ────────────────────────────────────────────── */
.notif-feed { display: flex; flex-direction: column; gap: 0; }

.group-label {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 2px; margin-top: 8px; margin-bottom: 6px;
}
.group-label-text {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .08em; color: #64748b;
}
.group-label-count {
  font-size: 10px; padding: 1px 6px; border-radius: 10px;
  background: #f1f5f9; color: #64748b; font-weight: 600;
}

/* Notification card */
.notif-card {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 14px 14px 14px 13px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #eef1f5;
  border-left: 3px solid #e2e8f0;
  margin-bottom: 8px;
  transition: box-shadow .15s, border-color .15s;
  position: relative;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
}
.notif-card:hover {
  border-color: #d7dee6;
  box-shadow: 0 3px 10px rgba(15,23,42,.07);
}
.notif-card--unread {
  background: #fbfcfe;
  border-color: #eaeff5;
  border-left-color: var(--sev, #2563eb);
}
.notif-card--unread:hover { border-color: #d7dee6; border-left-color: var(--sev, #2563eb); }

/* Severity icon */
.notif-icon {
  width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}

/* Content */
.notif-content { flex: 1; min-width: 0; }
.notif-header {
  display: flex; align-items: center; gap: 8px;
  flex-wrap: wrap; margin-bottom: 5px;
}
.notif-title { font-size: 13.5px; color: #4b5563; line-height: 1.3; }
.notif-title--bold { font-weight: 700; color: #0f172a; }
.sev-chip {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
  padding: 2px 8px; border-radius: 4px; border: 1px solid; line-height: 1.4;
}
.notif-time {
  font-size: 11px; color: #9ca3af; margin-left: auto;
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
.notif-body { font-size: 13px; color: #4b5563; line-height: 1.55; margin: 0 0 7px; }
.ch-row { display: flex; gap: 5px; flex-wrap: wrap; }
.ch-pill {
  font-size: 10px; padding: 2px 8px; border-radius: 20px;
  background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;
  font-weight: 600; letter-spacing: .02em;
}

/* Action buttons */
.notif-actions {
  display: flex; flex-direction: column; gap: 6px;
  flex-shrink: 0; padding-right: 6px; padding-top: 2px;
}
.na-btn {
  width: 30px; height: 30px; border-radius: 8px; border: 1px solid #e8ecf1;
  background: #f8fafc; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; transition: all .14s; color: #94a3b8;
}
.na-btn:disabled { opacity: .35; cursor: default; pointer-events: none; }
.na-btn--read:hover { background: #f0fdf4; border-color: #86efac; color: #15803d; }
.na-btn--del:hover  { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }

/* ── Unread pill in header ─────────────────────────────────────────── */
.unread-pill {
  font-size: 12px; font-weight: 700; padding: 3px 10px;
  border-radius: 12px; background: #dc2626; color: #fff;
}

/* ── Empty state ──────────────────────────────────────────────────── */
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  padding: 64px 24px; text-align: center;
  background: #fff; border: 1px solid #f1f5f9; border-radius: 12px;
}
.empty-icon {
  width: 64px; height: 64px; border-radius: 50%;
  background: #f8fafc; border: 1px solid #e2e8f0;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; margin-bottom: 16px;
}
.empty-title { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
.empty-sub   { font-size: 13px; color: #94a3b8; }
</style>
