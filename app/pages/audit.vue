<template>
  <PageHeader
    eyebrow="Compliance & Governance"
    title="Audit Trail"
    subtitle="Full platform audit log - every user action, data change, and system event across all modules"
  >
    <template #actions>
      <ExportButton
        filename="uapts-audit.csv"
        :rows="exportRows"
        :columns="exportColumns"
        label="Export CSV (current page)"
      />
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- WebSocket status -->
  <div v-if="streamError" class="ws-banner">⚡ Live feed unavailable - {{ streamError }}</div>
  <div v-else-if="streamConnected && isDefaultView" class="ws-connected">⚡ Live - connected</div>
  <div v-else-if="streamConnected" class="ws-paused">⏸ Live - connected, but paused while filtered/paginated</div>

  <!-- Filter bar -->
  <div class="filter-bar">
    <input v-model="filters.search" class="select-sm" placeholder="Search…" style="min-width:200px" @change="reload" />
    <input v-model="filters.user" class="select-sm" placeholder="User email…" style="min-width:160px" @change="reload" />
    <select v-model="filters.action" class="select-sm" @change="reload">
      <option value="">All actions</option>
      <option value="create">Create</option>
      <option value="update">Update</option>
      <option value="delete">Delete</option>
      <option value="login">Login</option>
      <option value="logout">Logout</option>
      <option value="export">Export</option>
      <option value="generate">Generate</option>
      <option value="view">View</option>
    </select>
    <input v-model="filters.resource" class="select-sm" placeholder="Resource type…" @change="reload" />
    <input type="date" v-model="filters.date_from" class="select-sm" @change="reload" />
    <input type="date" v-model="filters.date_to" class="select-sm" @change="reload" />
    <select v-model.number="pageSize" class="select-sm" @change="reload">
      <option :value="25">25 / page</option>
      <option :value="50">50 / page</option>
      <option :value="100">100 / page</option>
      <option :value="200">200 / page</option>
    </select>
    <button class="btn" @click="resetFilters">Reset</button>
    <span style="flex:1" />
    <span style="font-size:12px;color:#64748b">Showing {{ entries.length }} of {{ fmtNum(total) }}</span>
  </div>

  <!-- Audit table -->
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>User</th>
            <th>Action</th>
            <th>Resource / Path</th>
            <th>Method · Status</th>
            <th>IP Address</th>
            <th>Changes</th>
          </tr>
        </thead>
        <tbody v-if="entries.length">
          <tr v-for="e in entries" :key="e.id" @click="toggleExpand(e)" class="audit-row">
            <!-- Timestamp: API field is created_at -->
            <td style="font-size:12px;white-space:nowrap;font-family:monospace">{{ fmtTime(entryField(e, 'created_at') ?? e.timestamp) }}</td>
            <!-- User: username (nullable) → user_id → 'System' -->
            <td style="font-size:12px">{{ entryUser(e) }}</td>
            <td><BadgePill :variant="actionBadge(e.action)">{{ e.action }}</BadgePill></td>
            <!-- Resource type + id; fall back to request_path when both are blank -->
            <td style="font-family:monospace;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                :title="entryResource(e)">{{ entryResource(e) }}</td>
            <!-- request_method + status_code -->
            <td style="font-size:12px;font-family:monospace;white-space:nowrap">
              <span v-if="entryField(e,'request_method')" :style="{ color: methodColor(entryField(e,'request_method')) }">
                {{ entryField(e, 'request_method') }}
              </span>
              <span v-if="entryField(e,'status_code')" :style="{ color: statusColor(entryField(e,'status_code')) }"
                    style="margin-left:4px">{{ entryField(e, 'status_code') }}</span>
              <span v-if="!entryField(e,'request_method') && !entryField(e,'status_code')" style="color:#94a3b8">-</span>
            </td>
            <td style="font-size:12px;font-family:monospace;color:#64748b">{{ entryField(e, 'ip_address') ?? '-' }}</td>
            <!-- Changes: built from old_values / new_values diff -->
            <td style="font-size:12px">
              <template v-if="entryDiffKeys(e).length">
                <span style="color:#3b82f6;cursor:pointer">{{ expanded === e.id ? '▾' : '▸' }} {{ entryDiffKeys(e).length }} fields</span>
              </template>
              <span v-else style="color:#94a3b8">-</span>
            </td>
          </tr>
          <template v-for="e in entries" :key="`${e.id}-expanded`">
            <tr v-if="expanded === e.id && entryDiffKeys(e).length">
              <td colspan="7" class="change-detail">
                <table class="diff-table">
                  <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                  <tbody>
                    <tr v-for="field in entryDiffKeys(e)" :key="field">
                      <td style="font-family:monospace;font-size:11px">{{ field }}</td>
                      <td style="font-size:11px;color:#dc2626">{{ JSON.stringify(entryField(e,'old_values')?.[field] ?? null) }}</td>
                      <td style="font-size:11px;color:#16a34a">{{ JSON.stringify(entryField(e,'new_values')?.[field] ?? null) }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
        <tbody v-else>
          <tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px">{{ loading ? 'Loading audit log…' : 'No audit entries match the current filters.' }}</td></tr>
        </tbody>
      </table>

      <!-- Pagination - driven by next/previous URLs returned by the API.
           No client-side page_size math: the server controls page size. -->
      <div v-if="prevUrl || nextUrl" class="pagination">
        <button class="btn" :disabled="!prevUrl || loading" @click="loadUrl(prevUrl!)">← Prev</button>
        <span style="font-size:13px;color:#64748b">Page {{ page }} · {{ fmtNum(total) }} total</span>
        <button class="btn" :disabled="!nextUrl || loading" @click="loadUrl(nextUrl!)">Next →</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Audit Trail')

import { useAudit } from '~/composables/api'
import type { AuditEntry, AuditQuery } from '~/composables/api'
import { useAuditSocket } from '~/composables/useAuditSocket'
import type { AuditLog } from '~/composables/useAuditSocket'

const entries  = ref<AuditEntry[]>([])
const total    = ref(0)
const loading  = ref(true)
const error    = ref<string | null>(null)
const expanded = ref<string | null>(null)

// ── Pagination state ───────────────────────────────────────────────────────
// The API returns `next` / `previous` as absolute URLs (or null).
// We track page number locally only for display; navigation is URL-driven.
const page    = ref(1)
const nextUrl = ref<string | null>(null)
const prevUrl = ref<string | null>(null)

const filters = ref({
  search:    '',
  user:      '',
  action:    '',
  resource:  '',
  date_from: '',
  date_to:   '',
})
// Server default page size is small (10-20 rows) unless `limit` is passed
// explicitly - this is what was making the log feel like it was missing entries.
const pageSize = ref(100)

/** Apply a page response envelope to local state. */
function applyPage(data: { count: number; next: string | null; previous: string | null; results: AuditEntry[] }) {
  entries.value = data.results ?? []
  total.value   = data.count ?? entries.value.length
  nextUrl.value = data.next ?? null
  prevUrl.value = data.previous ?? null
}

/** Load page 1 with current filters (resets pagination). */
async function load() {
  page.value  = 1
  loading.value = true
  error.value   = null

  const q: AuditQuery = { limit: pageSize.value }
  if (filters.value.search)    q.search    = filters.value.search
  if (filters.value.user)      q.user      = filters.value.user
  if (filters.value.action)    q.action    = filters.value.action
  if (filters.value.resource)  q.resource  = filters.value.resource
  if (filters.value.date_from) q.date_from = filters.value.date_from
  if (filters.value.date_to)   q.date_to   = filters.value.date_to

  try {
    applyPage(await useAudit().list(q))
  } catch {
    error.value = 'Unable to reach the UAPTS Audit API.'
  } finally {
    loading.value = false
  }
}

/** Navigate to an absolute next/previous URL from the API response. */
async function loadUrl(absoluteUrl: string) {
  loading.value = true
  error.value   = null
  // Determine direction before awaiting so we can update page number
  const goingForward = absoluteUrl === nextUrl.value
  try {
    applyPage(await useAudit().listFromUrl(absoluteUrl))
    page.value += goingForward ? 1 : -1
  } catch {
    error.value = 'Unable to load the requested page.'
  } finally {
    loading.value = false
  }
}

function reload() { load() }

function resetFilters() {
  filters.value = { search: '', user: '', action: '', resource: '', date_from: '', date_to: '' }
  reload()
}

onMounted(() => load())
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(() => load(), 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Live feed ───────────────────────────────────────────────────────────
// Used directly here (not via a shared store) since this is the only page
// that needs it right now. If a system-health page later needs `metrics`
// from the same socket, wrap this in a Pinia setup store the same way
// notifications.ts wraps useNotificationSocket - see the note in
// useAuditSocket.ts for why a bare onUnmounted(disconnect) only stays safe
// as long as it's used directly like this, in exactly one component.
const { logs: liveLogs, isConnected: streamConnected, error: streamError, connect, disconnect }
  = useAuditSocket()

onMounted(connect)
onUnmounted(disconnect)

// Only the unfiltered first page is "the live tip of the log" - splicing a
// brand-new row into a filtered view or page 2+ could show an entry that
// doesn't belong there until the next reload.
const isDefaultView = computed(() =>
  page.value === 1 &&
  !filters.value.search && !filters.value.user && !filters.value.action &&
  !filters.value.resource && !filters.value.date_from && !filters.value.date_to,
)

watch(
  () => liveLogs.value[0],
  (latest) => {
    if (!latest || !isDefaultView.value) return
    if (entries.value.some((e) => e.id === latest.id)) return

    // Reconcile the WS AuditLog shape with the REST AuditEntry shape.
    // The API uses created_at (not timestamp) and username/user_id (not user_email).
    // The changes diff is not available on live rows - it appears on the next REST reload.
    entries.value.unshift({
      ...latest,
      id:         String(latest.id),
      created_at: latest.created_at ?? latest.timestamp,
      username:   latest.username,
      user_id:    latest.user_id,
      // Keep user_email as fallback for any REST-side AuditEntry code paths
      user_email: latest.username ?? (latest.user_id && latest.user_id !== 'None' ? latest.user_id : null) ?? 'System',
    } as unknown as AuditEntry)

    total.value += 1
    // Cap the live-list at the page size we actually requested, so it doesn't
    // grow past one page's worth of rows between REST reloads.
    if (entries.value.length > pageSize.value) entries.value.pop()
  },
)

// No backend audit-export endpoint exists (verified against the live API),
// so this exports the currently-loaded, currently-filtered page client-side -
// hence the "(current page)" label rather than claiming a full export.
const exportColumns = [
  { key: 'created_at', label: 'Timestamp' },
  { key: 'user', label: 'User' },
  { key: 'action', label: 'Action' },
  { key: 'resource', label: 'Resource / Path' },
  { key: 'request_method', label: 'Method' },
  { key: 'status_code', label: 'Status' },
  { key: 'ip_address', label: 'IP Address' },
]
const exportRows = computed(() => entries.value.map(e => ({
  created_at: entryField(e, 'created_at') ?? e.timestamp,
  user: entryUser(e),
  action: e.action,
  resource: entryResource(e),
  request_method: entryField(e, 'request_method'),
  status_code: entryField(e, 'status_code'),
  ip_address: entryField(e, 'ip_address'),
})))

// ── Field-access helpers (bridge REST AuditEntry ↔ raw API shape) ────────
// The REST serializer uses snake_case field names that may not be typed on
// AuditEntry yet. Cast to `any` in one place so the template stays clean.
function entryField(e: AuditEntry, key: string): any {
  return (e as any)[key] ?? null
}

// Resolve the display name for a row: username → user_id (skip "None") → 'System'
function entryUser(e: AuditEntry): string {
  const u = entryField(e, 'username')
  if (u && u !== 'None' && u !== 'null') return u
  // fall back to user_email for REST rows reconciled before this fix
  if (e.user_email && e.user_email !== 'System') return e.user_email
  const uid = entryField(e, 'user_id')
  if (uid && uid !== 'None' && uid !== 'null') return uid
  return 'System'
}

// Build a human-readable resource label.
// Falls back to request_path when resource_type/resource_id are both blank.
function entryResource(e: AuditEntry): string {
  const rt = entryField(e, 'resource_type') as string
  const ri = entryField(e, 'resource_id')   as string
  if (rt) return ri ? `${rt} · ${ri}` : rt
  // No structured resource - show the path so system/integration rows are readable
  const path = entryField(e, 'request_path') as string
  return path ?? entryField(e, 'description') ?? '-'
}

// Compute the union of keys changed between old_values and new_values.
function entryDiffKeys(e: AuditEntry): string[] {
  const oldV = entryField(e, 'old_values') as Record<string, unknown> | null
  const newV = entryField(e, 'new_values') as Record<string, unknown> | null
  // Also support the legacy `changes` shape that live WS rows may carry
  const legacy = entryField(e, 'changes') as Record<string, unknown> | null
  if (legacy && Object.keys(legacy).length) return Object.keys(legacy)
  const keys = new Set([...Object.keys(oldV ?? {}), ...Object.keys(newV ?? {})])
  return [...keys]
}

function toggleExpand(e: AuditEntry) {
  expanded.value = expanded.value === e.id ? null : e.id
}

function methodColor(method: string): string {
  const m: Record<string,string> = { GET:'#0284c7', POST:'#16a34a', PUT:'#d97706', PATCH:'#9333ea', DELETE:'#dc2626' }
  return m[method?.toUpperCase()] ?? '#64748b'
}
function statusColor(code: number | string): string {
  const n = Number(code)
  if (n >= 500) return '#dc2626'
  if (n >= 400) return '#d97706'
  if (n >= 300) return '#0284c7'
  return '#16a34a'
}

function actionBadge(a: string) {
  const m: Record<string,string> = { create:'success', update:'info', delete:'danger', login:'fair', logout:'neutral', export:'fair', generate:'fair' }
  return m[a] ?? 'neutral'
}
function fmtTime(iso: string) {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleString('en-KE', { year:'2-digit', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }) }
  catch { return iso }
}
function fmtNum(v: number) {
  return v.toLocaleString()
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f8fafc; color:#475569; border:1px solid #e2e8f0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.ws-banner { margin-bottom:8px; padding:6px 12px; border-radius:6px; background:#fef2f2; border:1px solid #fecaca; font-size:12px; color:#dc2626; }
.ws-connected { margin-bottom:8px; padding:4px 10px; display:inline-block; border-radius:6px; background:#f0fdf4; border:1px solid #bbf7d0; font-size:11px; color:#15803d; }
.ws-paused { margin-bottom:8px; padding:4px 10px; display:inline-block; border-radius:6px; background:#f8fafc; border:1px solid #e2e8f0; font-size:11px; color:#64748b; }
.audit-row { cursor:pointer; }
.audit-row:hover { background:#f8fafc; }
.change-detail { background:#f8fafc; padding:12px !important; }
.diff-table { width:100%; border-collapse:collapse; }
.diff-table th, .diff-table td { padding:4px 8px; border:1px solid #e2e8f0; text-align:left; }
.diff-table th { background:#f1f5f9; font-size:11px; font-weight:600; }
.pagination { display:flex; justify-content:center; align-items:center; gap:16px; padding-top:12px; border-top:1px solid #f1f5f9; margin-top:8px; }
</style>