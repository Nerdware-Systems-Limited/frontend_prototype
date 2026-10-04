<template>
  <PageHeader
    class="header-actions-fill"
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
  <div class="filter-bar filter-bar--grid">
    <input v-model="filters.user_id" class="select-sm filter-input filter-span" placeholder="User ID (UUID)…" aria-label="Filter by user ID" @change="reload" />
    <select v-model="filters.action" class="select-sm filter-select" aria-label="Filter by action" @change="reload">
      <option value="">All actions</option>
      <option v-for="a in actionOptions" :key="a.value" :value="a.value">{{ a.label }}</option>
    </select>
    <input v-model="filters.resource_type" class="select-sm filter-input" placeholder="Resource type…" aria-label="Filter by resource type" @change="reload" />
    <select v-model="filters.severity" class="select-sm filter-select" aria-label="Filter by severity" @change="reload">
      <option value="">All severities</option>
      <option v-for="s in severityOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
    </select>
    <select v-model="filters.outcome" class="select-sm filter-select" aria-label="Filter by outcome" @change="reload">
      <option value="">All outcomes</option>
      <option v-for="o in outcomeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <label class="filter-group">
      <span class="filter-label">From</span>
      <input type="date" v-model="filters.since" class="select-sm filter-date" @change="reload" />
    </label>
    <label class="filter-group">
      <span class="filter-label">To</span>
      <input type="date" v-model="filters.until" class="select-sm filter-date" @change="reload" />
    </label>
    <button class="btn" @click="resetFilters">Reset</button>
    <span class="result-count filter-span">Showing {{ entries.length }} of {{ fmtNum(total) }}</span>
  </div>

  <!-- Audit table -->
  <div class="card">
    <div class="card-body">
      <table class="audit-table stack-table">
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
          <!-- One loop, two rows per entry: the diff row has to sit directly
               under the entry it belongs to, not after the last entry. -->
          <template v-for="e in entries" :key="e.id">
            <tr class="audit-row" :class="{ 'is-open': expanded === e.id && entryDiffKeys(e).length }" @click="toggleExpand(e)">
              <!-- Timestamp: API field is created_at -->
              <td class="cell-time stack-title">{{ fmtTime(entryField(e, 'created_at') ?? e.timestamp) }}</td>
              <!-- User: username (nullable) → user_id → 'System' -->
              <td class="cell-user" data-label="User">{{ entryUser(e) }}</td>
              <td data-label="Action">
                <span>
                  <BadgePill :variant="actionBadge(e.action)">{{ e.action }}</BadgePill>
                  <span v-if="entryField(e,'severity') && !['info','debug'].includes(entryField(e,'severity'))"
                        class="cell-severity" :style="{ color: severityColor(entryField(e,'severity')) }">
                    {{ entryField(e, 'severity') }}
                  </span>
                </span>
              </td>
              <!-- Resource type + id; fall back to request_path when both are blank -->
              <td class="cell-resource stack-block" data-label="Resource / Path" :title="entryResource(e)">{{ entryResource(e) }}</td>
              <!-- request_method + status_code -->
              <td class="cell-method" data-label="Method · Status">
                <span>
                  <span v-if="entryField(e,'request_method')" :style="{ color: methodColor(entryField(e,'request_method')) }">
                    {{ entryField(e, 'request_method') }}
                  </span>
                  <span v-if="entryField(e,'status_code')" :style="{ color: statusColor(entryField(e,'status_code')) }"
                        class="cell-status">{{ entryField(e, 'status_code') }}</span>
                  <span v-if="!entryField(e,'request_method') && !entryField(e,'status_code')" class="dim">-</span>
                </span>
              </td>
              <td class="cell-ip" data-label="IP Address">{{ entryField(e, 'ip_address') ?? '-' }}</td>
              <!-- Changes: built from old_values / new_values diff -->
              <td class="cell-changes" data-label="Changes">
                <span v-if="entryDiffKeys(e).length" class="diff-toggle">{{ expanded === e.id ? '▾' : '▸' }} {{ entryDiffKeys(e).length }} fields</span>
                <span v-else class="dim">-</span>
              </td>
            </tr>
            <tr v-if="expanded === e.id && entryDiffKeys(e).length" class="detail-row">
              <td colspan="7" class="change-detail">
                <table class="diff-table">
                  <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                  <tbody>
                    <tr v-for="field in entryDiffKeys(e)" :key="field">
                      <td class="diff-field">{{ field }}</td>
                      <td class="diff-before" data-label="Before">{{ JSON.stringify(entryField(e,'old_values')?.[field] ?? null) }}</td>
                      <td class="diff-after" data-label="After">{{ JSON.stringify(entryField(e,'new_values')?.[field] ?? null) }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
        <tbody v-else>
          <tr><td colspan="7" class="empty-row">{{ loading ? 'Loading audit log…' : 'No audit entries match the current filters.' }}</td></tr>
        </tbody>
      </table>

      <!-- Pagination - driven by next/previous URLs returned by the API.
           No client-side page_size math: the server controls page size. -->
      <div v-if="prevUrl || nextUrl" class="pagination">
        <button class="btn" :disabled="!prevUrl || loading" @click="loadUrl(prevUrl!)">← Prev</button>
        <span style="font-size:13px;color:var(--fg-2)">Page {{ page }} · {{ fmtNum(total) }} total</span>
        <button class="btn" :disabled="!nextUrl || loading" @click="loadUrl(nextUrl!)">Next →</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
// Known gap, not fixed here: unlike /users.vue and /roles.vue, this page is
// NOT scoped to the viewer's own agency - every admin sees the full
// platform-wide audit log. Scoping it properly needs backend support that
// doesn't exist yet: `AuditQuery` (useAudit.ts) has no `agency`/`agency_code`
// filter param (confirmed against the real `_build_queryset()` params), and
// `AuditEntry` carries no agency field per row to filter by client-side
// either - only `user_id`/`username`. A client-side "filter by whether
// user_id belongs to my agency's roster" approximation was considered and
// rejected: it would silently misattribute system/anonymous events and any
// user who has since changed agencies, which is worse than the honest
// platform-wide view this page already shows. Revisit once the backend adds
// per-entry agency attribution or an `agency` query param.
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

// Names match apps/audit/views.py `_build_queryset()` exactly - there is
// no `search` param on this backend (nor `user`/`resource`/`date_from`/
// `date_to` - those were guessed and silently ignored by the API).
const filters = ref({
  user_id:       '',
  action:        '',
  resource_type: '',
  severity:      '',
  outcome:       '',
  since:         '',
  until:         '',
})

// AuditLog.Severity / AuditLog.Outcome choices (apps/audit/models.py) - no
// backend "choices" endpoint exists for these (only /audit/actions/ does),
// so mirrored here directly. Order matches the model's TextChoices order.
const severityOptions = [
  { value: 'debug',    label: 'Debug' },
  { value: 'info',     label: 'Info' },
  { value: 'notice',   label: 'Notice' },
  { value: 'warning',  label: 'Warning' },
  { value: 'critical', label: 'Critical' },
]
const outcomeOptions = [
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
  { value: 'denied',  label: 'Denied' },
  { value: 'error',   label: 'Error' },
  { value: 'unknown', label: 'Unknown' },
]
// Server default page size is small (10-20 rows) unless `limit` is passed
// explicitly - this is what was making the log feel like it was missing entries.
const pageSize = ref(15)

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
  if (filters.value.user_id)       q.user_id       = filters.value.user_id
  if (filters.value.action)        q.action        = filters.value.action
  if (filters.value.resource_type) q.resource_type = filters.value.resource_type
  if (filters.value.severity)      q.severity      = filters.value.severity
  if (filters.value.outcome)       q.outcome       = filters.value.outcome
  if (filters.value.since)         q.since         = filters.value.since
  if (filters.value.until)         q.until         = filters.value.until

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
  filters.value = { user_id: '', action: '', resource_type: '', severity: '', outcome: '', since: '', until: '' }
  reload()
}

// Action filter options - fetched from the real backend rather than
// hardcoded, so this never drifts from the actual set of audited actions.
const actionOptions = ref<Array<{ value: string; label: string }>>([])
async function loadActions() {
  try { actionOptions.value = await useAudit().actions() } catch { /* keep dropdown empty on failure */ }
}

onMounted(() => load())
onMounted(loadActions)
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
  !filters.value.user_id && !filters.value.action &&
  !filters.value.resource_type && !filters.value.severity && !filters.value.outcome &&
  !filters.value.since && !filters.value.until,
)

watch(
  () => liveLogs.value[0],
  (latest) => {
    if (!latest || !isDefaultView.value) return
    if (entries.value.some((e) => e.id === String(latest.id))) return

    // Reconcile the WS AuditLog shape with the REST AuditEntry shape.
    // The API uses created_at (not timestamp) and username/user_id (not user_email).
    // The changes diff is not available on live rows - it appears on the next REST reload.
    entries.value.unshift({
      ...latest,
      id:         String(latest.id),
      created_at: latest.created_at,
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
function severityColor(sev: string): string {
  const m: Record<string,string> = { notice:'var(--info-fg)', warning:'var(--warning-fg)', critical:'var(--danger-fg)' }
  return m[sev] ?? 'var(--fg-2)'
}
function statusColor(code: number | string): string {
  const n = Number(code)
  if (n >= 500) return 'var(--danger-fg)'
  if (n >= 400) return 'var(--warning-fg)'
  if (n >= 300) return 'var(--info-fg)'
  return 'var(--success-fg)'
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
/* Filter bar - every control gets min-width:0 so it can actually shrink
   below its content's natural width (the flexbox default is min-width:auto,
   which silently blocks shrinking and forces the row to wrap awkwardly
   instead, leaving a ragged trailing control or the result text on its own
   line). The result-count text is pinned right and never wraps. */
.filter-bar > * { min-width:0; }
.result-count  { font-size:12px; color:var(--fg-2); white-space:nowrap; margin-left:auto; }
/* Desktop widths only. Left active under 769px these flex-basis values would
   size the controls' HEIGHT (the bar becomes a column) - .filter-bar--grid in
   theme.css owns the phone layout. */
@media (min-width:769px) {
  .filter-input  { flex:0 1 170px; width:170px; }
  .filter-select { flex:0 1 140px; max-width:140px; }
  .filter-date   { flex:0 1 150px; max-width:150px; }
}

.ws-banner { margin-bottom:8px; padding:6px 12px; border-radius:6px; background:var(--danger-bg); border:1px solid color-mix(in srgb, var(--danger-fg) 30%, transparent); font-size:12px; color:var(--danger-fg); }
.ws-connected { margin-bottom:8px; padding:4px 10px; display:inline-block; border-radius:6px; background:var(--success-bg); border:1px solid color-mix(in srgb, var(--success-fg) 30%, transparent); font-size:11px; color:var(--success-fg); }
.ws-paused { margin-bottom:8px; padding:4px 10px; display:inline-block; border-radius:6px; background:var(--surface-1); border:1px solid var(--border-subtle); font-size:11px; color:var(--fg-2); }

/* Table cells */
.audit-row { cursor:pointer; }
.audit-row:hover { background:var(--primary-wash); }
.cell-time     { font-size:12px; white-space:nowrap; font-family:monospace; }
.cell-user     { font-size:12px; }
.cell-severity { margin-left:6px; font-size:11px; font-weight:600; text-transform:uppercase; }
.cell-resource { font-family:monospace; font-size:12px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cell-method   { font-size:12px; font-family:monospace; white-space:nowrap; }
.cell-status   { margin-left:4px; }
.cell-ip       { font-size:12px; font-family:monospace; color:var(--fg-2); }
.cell-changes  { font-size:12px; }
.diff-toggle   { color:var(--link); cursor:pointer; }
.dim           { color:var(--fg-3); }
.empty-row     { text-align:center; color:var(--fg-3); padding:20px; }

.change-detail { background:var(--surface-1); padding:12px !important; }
.diff-table { width:100%; border-collapse:collapse; }
.diff-table th, .diff-table td { padding:4px 8px; border:1px solid var(--border-subtle); text-align:left; }
.diff-table th { background:var(--surface-sunken); font-size:11px; font-weight:600; }
.diff-field    { font-family:monospace; font-size:11px; }
.diff-before   { font-size:11px; color:var(--danger-fg); }
.diff-after    { font-size:11px; color:var(--success-fg); }

.pagination { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px 16px; padding-top:12px; border-top:1px solid var(--border-subtle); margin-top:8px; }

/* Phones - the stacked-card layout itself is .stack-table (theme.css). What's
   left is specific to this page: values that must wrap instead of truncating,
   the open entry visually joined to its diff, and the diff itself stacked
   (Field / Before / After) rather than a three-column grid. */
@media (max-width:768px) {
  .audit-row:hover  { background:var(--surface-2); }
  .audit-row:active { background:var(--primary-wash); }
  .audit-row.is-open { margin-bottom:0; border-bottom-left-radius:0; border-bottom-right-radius:0; }
  .cell-resource { max-width:none; overflow:visible; text-overflow:clip; overflow-wrap:anywhere; }
  .cell-ip       { color:var(--fg-2); }
  .change-detail { margin-bottom:8px; padding:8px 12px !important; border-radius:0 0 var(--r-sm) var(--r-sm); }
  /* Needs the full path: the shared card cell rule sets `border:0` at (0,2,3). */
  .audit-table > tbody > tr > td.change-detail { border:1px solid var(--border-subtle); border-top:0; }
  /* .card-body table gives every table a 480px floor at this width. */
  .card-body .diff-table { min-width:0; }
  .diff-table thead { display:none; }
  .diff-table, .diff-table tbody { display:block; width:100%; }
  .diff-table tr { display:block; padding:6px 0; border-bottom:1px solid var(--border-subtle); }
  .diff-table tr:last-child { border-bottom:0; }
  .diff-table td { display:block; padding:1px 0; border:0; white-space:normal; overflow-wrap:anywhere; }
  .diff-table td[data-label]::before {
    content:attr(data-label) ": "; font-size:10px; font-weight:700; text-transform:uppercase;
    letter-spacing:.06em; color:var(--fg-3);
  }
  .diff-field { font-size:12px; font-weight:600; color:var(--fg-1); }
}
</style>
