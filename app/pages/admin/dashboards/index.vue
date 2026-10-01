<template>
  <PageHeader
    eyebrow="Access Control"
    title="Dashboard Manager"
    subtitle="Build dashboards from widgets, then choose which agencies, departments, roles and people land on them"
  >
    <template v-if="allowed" #actions>
      <button type="button" class="btn-primary" @click="openCreate">
        <Plus :size="14" aria-hidden="true" /> New dashboard
      </button>
    </template>
  </PageHeader>

  <EmptyState v-if="!allowed" icon="inbox" message="You need the dashboards.manage or dashboards.manage_agency permission to open the Dashboard Manager." />

  <template v-else>
    <div v-if="error" class="error-banner dm-error" role="alert" aria-live="polite">
      <span>⚠ {{ error }}</span>
      <button type="button" class="error-retry-btn" @click="error = null; load()">Retry</button>
    </div>

    <TabStrip v-model="view" :tabs="tabs" />

    <!-- ── List ── -->
    <section v-if="view === 'list'" aria-label="Dashboards">
      <div class="filter-bar dm-filters" role="search" aria-label="Filter dashboards">
        <div class="search-field">
          <Search :size="14" class="search-icon" aria-hidden="true" />
          <input
            v-model="search" type="search" class="select-sm search-input"
            placeholder="Search name, description or owner…" aria-label="Search dashboards"
            @keydown.esc="search = ''"
          >
        </div>
        <label class="filter-group">
          <span class="filter-label">Status</span>
          <select v-model="statusFilter" class="select-sm">
            <option value="">Any</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <button v-if="search || statusFilter" type="button" class="btn btn-sm" @click="search = ''; statusFilter = ''">Clear</button>
        <ul v-if="dashboards.length" class="dm-pills" aria-label="Dashboards by status">
          <li class="badge success"><span class="pill-num">{{ counts.published }}</span> Published</li>
          <li class="badge"><span class="pill-num">{{ counts.draft }}</span> Draft</li>
          <li class="badge pill-muted"><span class="pill-num">{{ counts.archived }}</span> Archived</li>
        </ul>
      </div>

      <EmptyState v-if="loading" loading />
      <div v-else-if="!dashboards.length && !error" class="card dm-seed">
        <div class="card-body">
          <p class="dm-seed-title">No dashboards on the server yet</p>
          <p class="dm-seed-text">
            Ask a platform engineer to load the starter set on the backend machine with
            <code>python manage.py seed_dashboards --publish-national</code>,
            or start one yourself from a template.
          </p>
          <button type="button" class="btn btn-sm" @click="openCreate"><Plus :size="14" aria-hidden="true" /> New dashboard</button>
        </div>
      </div>
      <div v-else-if="dashboards.length" class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Dashboards</div>
            <div class="card-subtitle">
              <template v-if="search || statusFilter">{{ filtered.length }} of {{ dashboards.length }} match. </template>
              Viewers see the published version. Edits stay in the draft until you publish.
            </div>
          </div>
        </div>
        <div class="card-body table-scroll">
          <table class="dm-table stack-table">
            <colgroup><col class="col-name"><col><col><col><col><col class="col-actions"></colgroup>
            <thead>
              <tr>
                <th scope="col">Dashboard</th>
                <th scope="col">Owner</th>
                <th scope="col">Status</th>
                <th scope="col">Audience</th>
                <th scope="col">Updated</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filtered.length">
                <td colspan="6" class="empty-row">No dashboards match these filters.</td>
              </tr>
              <tr v-for="d in filtered" :key="d.id">
                <td class="stack-title">
                  <div class="dm-name-row">
                    <NuxtLink :to="`/admin/dashboards/${d.id}`" class="dm-name">{{ d.name }}</NuxtLink>
                    <span v-if="d.isSystem" class="badge badge-sm" title="Seeded by the platform. It can be edited but not archived or deleted.">Built-in</span>
                  </div>
                  <p v-if="d.description" class="dm-desc">{{ d.description }}</p>
                </td>
                <td data-label="Owner">
                  <span v-if="d.ownerAgency" class="dm-code">{{ d.ownerAgency }}</span>
                  <span v-else class="dm-muted">National</span>
                </td>
                <td data-label="Status">
                  <div class="dm-status">
                    <span class="badge" :class="STATUS_CLASS[d.status]">{{ STATUS_LABEL[d.status] }}<template v-if="d.publishedVersion"> v{{ d.publishedVersion }}</template></span>
                    <span v-if="d.publishedVersion && d.draftVersion !== d.publishedVersion" class="dm-ahead">Unpublished edits</span>
                  </div>
                </td>
                <td data-label="Audience" class="dm-aud-cell">
                  <span v-if="!d.assignments.length" class="dm-muted">Not assigned</span>
                  <ul v-else class="dm-aud-list">
                    <li v-for="a in d.assignments.slice(0, 3)" :key="a.id" class="badge info dm-aud" :title="a.locked ? 'Locked: nothing narrower can override it' : undefined">
                      <Lock v-if="a.locked" :size="10" aria-label="Locked" />{{ describeScope(a) }}
                    </li>
                    <li v-if="d.assignments.length > 3" class="dm-muted">+{{ d.assignments.length - 3 }} more</li>
                  </ul>
                </td>
                <td data-label="Updated" class="stack-block">
                  <time class="dm-when" :datetime="d.updatedAt" :title="new Date(d.updatedAt).toLocaleString('en-KE')">{{ ago(d.updatedAt) }}</time>
                  <span class="dm-by" :title="d.updatedBy">{{ d.updatedBy }}</span>
                </td>
                <td class="stack-actions dm-actions">
                  <OverflowMenu :items="menuFor(d)" :label="`Actions for ${d.name}`" @select="onMenu(d, $event)" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ── Coverage: resolve every agency × department × role ── -->
    <section v-else aria-label="Who sees what">
      <div v-if="directoryError" class="error-banner dm-error" role="alert">
        <span>⚠ {{ directoryError }}</span>
        <button type="button" class="error-retry-btn" @click="loadDirectory()">Retry</button>
      </div>
      <div v-else-if="directory?.source === 'accounts'" class="notice" role="note">
        <Info :size="15" class="notice-icon" aria-hidden="true" />
        <p>Agencies, departments and roles come from UAPTS accounts, because the Dashboard Manager directory on the server is empty.</p>
      </div>

      <div class="filter-bar">
        <label class="filter-group dm-agency">
          <span class="filter-label">Agency</span>
          <select v-model="coverageAgency" class="select-sm" :disabled="!directory?.agencies.length">
            <option v-for="a in directory?.agencies ?? []" :key="a.code" :value="a.code">{{ a.code }} - {{ a.name }}</option>
          </select>
        </label>
      </div>

      <EmptyState v-if="directoryLoading" loading />
      <div v-else-if="directory" class="card">
        <div class="card-header">
          <div>
            <div class="card-title">What each audience lands on</div>
            <div class="card-subtitle">Resolved with the same rules the server uses, from published dashboards only.</div>
          </div>
        </div>
        <div v-if="coverageRows.length" class="card-body table-scroll">
          <table class="dm-matrix">
            <thead>
              <tr>
                <th scope="col">Department</th>
                <th scope="col">Everyone in it</th>
                <th v-for="r in coverageRoles" :key="r.code" scope="col">{{ r.name }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in coverageRows" :key="row.dept.code">
                <th scope="row">{{ row.dept.name }}</th>
                <td v-for="(cell, i) in row.cells" :key="i">
                  <NuxtLink v-if="cell" :to="`/admin/dashboards/${cell.id}`" class="dm-cell-link">{{ cell.name }}</NuxtLink>
                  <span v-else class="dm-muted">Built-in fallback</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="card-body">
          <p class="empty-row">No departments registered for this agency.</p>
        </div>
      </div>
    </section>
  </template>

  <!-- ── Create ── -->
  <SideDrawer :open="createOpen" title="New dashboard" subtitle="Start from a template or a blank canvas." @close="createOpen = false">
    <form id="dm-create" class="dm-create" @submit.prevent="create">
      <div v-if="createError" class="error-banner" role="alert">⚠ {{ createError }}</div>
      <label class="dm-field">
        <span class="filter-label">Name</span>
        <input v-model="newName" type="text" required placeholder="e.g. KeNHA Maintenance Board">
      </label>
      <label class="dm-field">
        <span class="filter-label">Owner agency</span>
        <select v-model="newOwner" :disabled="!canManageDashboards">
          <option v-if="canManageDashboards" :value="null">National (SDT)</option>
          <option v-for="a in ownerOptions" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
      <fieldset class="dm-templates">
        <legend class="filter-label">Start from</legend>
        <label v-for="t in TEMPLATES" :key="t.key" class="dm-template" :class="{ on: newTemplate === t.key }">
          <input v-model="newTemplate" type="radio" name="tpl" :value="t.key">
          <span class="dm-template-name">{{ t.name }}</span>
          <span class="dm-template-desc">{{ t.description }}</span>
          <span class="dm-template-aud">Suits {{ t.suggestedAudience }}</span>
        </label>
      </fieldset>
    </form>
    <template #footer>
      <div class="dm-drawer-actions">
        <button type="button" class="btn" @click="createOpen = false">Cancel</button>
        <button type="submit" form="dm-create" class="btn-primary" :disabled="!newName.trim() || creating">{{ creating ? 'Creating…' : 'Create and open editor' }}</button>
      </div>
    </template>
  </SideDrawer>

  <ConfirmDialog
    :open="!!confirming"
    :title="confirming?.kind === 'delete' ? 'Delete dashboard?' : 'Archive dashboard?'"
    :message="confirmMessage"
    :confirm-label="confirming?.kind === 'delete' ? 'Delete permanently' : 'Archive'"
    :busy-label="confirming?.kind === 'delete' ? 'Deleting…' : 'Archiving…'"
    :busy="confirmBusy"
    danger
    @confirm="runConfirmed"
    @cancel="confirming = null"
  />
</template>

<script setup lang="ts">
import { Archive, Copy, Eye, Info, Lock, Pencil, Plus, Search, Trash2 } from 'lucide-vue-next'
import type { DashboardAssignment, DashboardStatus, DashboardSummary } from '~/types/dashboard'
import { TEMPLATES } from '~/utils/dashboardTemplates'
import { describeScope as describeScopeRaw, resolveDashboard } from '~/utils/resolveDashboard'
import { useDashboardApi, toDashboardApiError } from '~/composables/useDashboardApi'
import { useDashboardDirectory } from '~/composables/useDashboardDirectory'
import { useUserEmailLookup } from '~/composables/useUserEmailLookup'
import type { OverflowMenuItem } from '~/components/OverflowMenu.vue'

definePageMeta({ layout: 'default' })

const STATUS_LABEL: Record<DashboardStatus, string> = { published: 'Published', draft: 'Draft', archived: 'Archived' }
const STATUS_CLASS: Record<DashboardStatus, string> = { published: 'success', draft: '', archived: 'pill-muted' }

const api = useDashboardApi()
const { realViewer, canManageDashboards, canManageAgencyDashboards } = useViewerContext()
const allowed = computed(() => canManageDashboards.value || canManageAgencyDashboards.value)

const dashboards = ref<DashboardSummary[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const view = ref<'list' | 'coverage'>('list')
const search = ref('')
const statusFilter = ref('')

const tabs = computed(() => [
  { key: 'list', label: 'Dashboards', count: loading.value ? undefined : dashboards.value.length },
  { key: 'coverage', label: 'Who sees what' },
])

async function load() {
  loading.value = true
  try { dashboards.value = await api.list() } catch (e) { error.value = `Couldn't load dashboards: ${toDashboardApiError(e).message}` } finally { loading.value = false }
}
onMounted(() => { if (allowed.value) load() })

// ── user-assignment emails (the backend only stores the raw user id) ──
const { emailFor, ensure: ensureEmails } = useUserEmailLookup()
function describeScope(a: Pick<DashboardAssignment, 'scopeType' | 'scopeValue'>) { return describeScopeRaw(a, emailFor) }
watchEffect(() => {
  const ids = dashboards.value.flatMap(d => d.assignments).filter(a => a.scopeType === 'user').map(a => a.scopeValue.split(':')[0]!)
  if (ids.length) ensureEmails(ids)
})

const counts = computed(() => {
  const c = { published: 0, draft: 0, archived: 0 }
  for (const d of dashboards.value) c[d.status]++
  return c
})
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return dashboards.value
    .filter(d => !statusFilter.value || d.status === statusFilter.value)
    .filter(d => !q || `${d.name} ${d.description} ${d.ownerAgency ?? 'national'}`.toLowerCase().includes(q))
})

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
function ago(iso: string) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute')
  const hours = Math.round(mins / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 14) return rtf.format(days, 'day')
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function menuFor(d: DashboardSummary): OverflowMenuItem[] {
  const canRetire = !d.isSystem
  return [
    { key: 'edit', label: 'Open editor', icon: Pencil },
    { key: 'view', label: 'View as published', icon: Eye },
    { key: 'duplicate', label: 'Duplicate', icon: Copy },
    ...(canRetire && d.status !== 'archived' ? [{ key: 'archive', label: 'Archive', icon: Archive, separatorBefore: true }] : []),
    ...(canRetire ? [{ key: 'delete', label: 'Delete permanently', icon: Trash2, danger: true, separatorBefore: d.status === 'archived' }] : []),
  ]
}

const confirming = ref<{ kind: 'archive' | 'delete'; dashboard: DashboardSummary } | null>(null)
const confirmBusy = ref(false)
const confirmMessage = computed(() => {
  const c = confirming.value
  if (!c) return ''
  return c.kind === 'delete'
    ? `“${c.dashboard.name}” and all its versions will be removed. This can't be undone.`
    : `Viewers assigned to “${c.dashboard.name}” will fall back to the next matching dashboard. You can still open it here and duplicate it.`
})
async function runConfirmed() {
  const c = confirming.value
  if (!c) return
  confirmBusy.value = true
  try {
    if (c.kind === 'delete') await api.remove(c.dashboard.id)
    else await api.archive(c.dashboard.id)
    confirming.value = null
    await load()
  } catch (e) {
    confirming.value = null
    error.value = `${c.kind === 'delete' ? 'Not deleted' : 'Not archived'}: ${toDashboardApiError(e).message}`
  } finally { confirmBusy.value = false }
}

async function onMenu(d: DashboardSummary, key: string) {
  if (key === 'edit') return navigateTo(`/admin/dashboards/${d.id}`)
  if (key === 'view') return navigateTo(`/dashboard?id=${d.id}`)
  if (key === 'archive' || key === 'delete') { confirming.value = { kind: key, dashboard: d }; return }
  if (key === 'duplicate') {
    try {
      const c = await api.duplicate(d.id, `${d.name} (copy)`)
      return navigateTo(`/admin/dashboards/${c.id}`)
    } catch (e) { error.value = `Not duplicated: ${toDashboardApiError(e).message}` }
  }
}

// ── create ──
const createOpen = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)
const newName = ref('')
const newTemplate = ref('blank')
const newOwner = ref<string | null>(null)
const ownerOptions = computed(() => canManageDashboards.value
  ? (directory.value?.agencies ?? []).map(a => a.code)
  : [realViewer.value?.agencyCode].filter(Boolean) as string[])
watch(canManageDashboards, (can) => { if (!can) newOwner.value = realViewer.value?.agencyCode ?? null }, { immediate: true })

function openCreate() {
  createError.value = null
  createOpen.value = true
}
async function create() {
  if (!newName.value.trim() || creating.value) return
  creating.value = true
  createError.value = null
  try {
    const tpl = TEMPLATES.find(t => t.key === newTemplate.value) ?? TEMPLATES[0]!
    const rec = await api.create({ name: newName.value.trim(), description: tpl.description, ownerAgency: newOwner.value, definition: tpl.build() })
    await navigateTo(`/admin/dashboards/${rec.id}`)
  } catch (e) {
    createError.value = `Dashboard not created: ${toDashboardApiError(e).message}`
  } finally { creating.value = false }
}

// ── coverage matrix ──
const { directory, error: directoryError, loading: directoryLoading, load: loadDirectory } = useDashboardDirectory()
const coverageAgency = ref('')
onMounted(async () => {
  if (!allowed.value) return
  await loadDirectory()
  // useAccessControl's agencyCode is upper-cased for display; Agency.agency_code
  // (and every dropdown option here) keeps its real casing (e.g. "KeNHA"), so
  // match case-insensitively and use the directory's own casing for the value -
  // an exact-case mismatch left the select bound to a value with no matching
  // option, and coverageRows' own exact match then always came up empty.
  const own = (realViewer.value?.agencyCode ?? '').toLowerCase()
  const match = directory.value?.agencies.find(a => a.code.toLowerCase() === own)
  coverageAgency.value = match?.code ?? directory.value?.agencies[0]?.code ?? ''
})
const coverageRoles = computed(() => (directory.value?.roles ?? []).filter(r => !r.agency || r.agency === coverageAgency.value))
const coverageRows = computed(() => {
  const agency = directory.value?.agencies.find(a => a.code === coverageAgency.value)
  if (!agency) return []
  const who = (dept: string, role?: string) => resolveDashboard(dashboards.value, {
    userId: '__coverage__', agencyCode: agency.code, departmentCode: dept, roles: role ? [role] : [], permissions: [], isSuperAdmin: false,
  }).winner?.dashboard ?? null
  // The backend's default directory comes from settings and may omit departments.
  return (agency.departments ?? []).map(dept => ({
    dept,
    cells: [who(dept.code), ...coverageRoles.value.map(r => who(dept.code, r.code))],
  }))
})
</script>

<style scoped>
.dm-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

/* ── filter row ── */
.dm-filters { gap: 10px 16px; }
.search-field { position: relative; display: flex; align-items: center; flex: 1 1 260px; min-width: 0; }
.search-icon { position: absolute; left: 9px; color: var(--fg-3); pointer-events: none; }
.search-input { width: 100%; padding-left: 29px; }
.dm-pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 0 auto; padding: 0; list-style: none; }
.dm-pills .badge { gap: 4px; font-size: 11px; font-weight: 600; padding: 3px 8px; }
.pill-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.pill-muted { color: var(--fg-3); }

/* ── table ── */
.table-scroll { overflow-x: auto; }
.empty-row { margin: 0; padding: 28px 16px; text-align: center; font-size: 12.5px; color: var(--fg-3); }
.dm-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dm-name { font-weight: 600; font-size: 13px; color: var(--fg-1); text-decoration: none; }
.dm-name:hover { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; }
.dm-desc { margin: 3px 0 0; font-size: 11.5px; line-height: 1.45; color: var(--fg-3); max-width: 52ch; font-weight: 400; }
.dm-code { font-family: var(--font-mono); font-size: 11.5px; color: var(--fg-1); }
.dm-muted { font-size: 12px; color: var(--fg-3); }
.dm-status { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.dm-status .badge { font-variant-numeric: tabular-nums; }
.dm-ahead { font-size: 11px; color: var(--warning-fg); }
.dm-aud-list { display: flex; flex-wrap: wrap; gap: 4px; margin: 0; padding: 0; list-style: none; }
.dm-aud { gap: 4px; }
.dm-when { display: block; font-size: 12px; color: var(--fg-1); white-space: nowrap; }
.dm-by { display: block; margin-top: 2px; font-family: var(--font-mono); font-size: 10.5px; color: var(--fg-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 24ch; }

/* ── coverage ── */
.dm-agency select { min-width: 0; }
.dm-matrix th[scope='row'] { font-size: 12px; font-weight: 600; text-transform: none; letter-spacing: 0; color: var(--fg-1); background: var(--surface-2); border-bottom: 1px solid var(--border-subtle); white-space: nowrap; }
.dm-matrix td { white-space: nowrap; }
.dm-cell-link { color: var(--primary); font-weight: 600; text-decoration: none; }
.dm-cell-link:hover { text-decoration: underline; text-underline-offset: 2px; }

/* ── seed prompt ── */
.dm-seed .card-body { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 24px; }
.dm-seed-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--fg-1); }
.dm-seed-text { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--fg-2); max-width: 70ch; }
.dm-seed-text code { font-family: var(--font-mono); font-size: 11.5px; background: var(--surface-sunken); border: 1px solid var(--border-subtle); border-radius: var(--r-xs); padding: 1px 5px; color: var(--fg-1); }

/* ── create drawer ── */
.dm-create { display: flex; flex-direction: column; gap: 14px; }
.dm-field { display: flex; flex-direction: column; gap: 5px; }
.dm-templates { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.dm-templates legend { margin-bottom: 6px; padding: 0; }
.dm-template {
  display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; padding: 10px 12px; cursor: pointer;
  border: 1px solid var(--border-subtle); border-radius: var(--r-sm); background: var(--surface-2);
  transition: border-color var(--dur-fast) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard);
}
.dm-template:focus-within { outline: 2px solid var(--primary); outline-offset: 1px; }
.dm-template.on { border-color: var(--primary); background: var(--primary-wash); }
.dm-template input { grid-row: span 3; margin: 2px 0 0; width: auto; accent-color: var(--primary); }
.dm-template-name { font-size: 12.5px; font-weight: 600; color: var(--fg-1); }
.dm-template-desc { font-size: 11.5px; color: var(--fg-2); line-height: 1.45; }
.dm-template-aud { font-size: 11px; color: var(--fg-3); }
.dm-drawer-actions { display: flex; justify-content: flex-end; gap: 8px; }
@media (hover: hover) {
  .dm-template:hover:not(.on) { border-color: var(--border-interactive); }
}

@media (min-width: 769px) {
  .table-scroll.card-body { padding: 0; }
  .dm-table { min-width: 860px; }
  .dm-table td { vertical-align: top; padding-top: 12px; padding-bottom: 12px; }
  .col-name { width: 34%; }
  .col-actions { width: 52px; }
  .dm-actions { text-align: right; vertical-align: middle !important; }
  .search-field { max-width: 360px; }
  .search-input, .filter-group .select-sm { height: 30px; }
  .dm-agency select { width: 360px; }
}
@media (max-width: 768px) {
  .search-field { flex: none; width: 100%; }
  .filter-group { flex-direction: column; align-items: stretch; gap: 4px; flex: none; width: 100%; }
  .dm-pills { margin-left: 0; }
  .dm-table .stack-title { padding-right: 44px !important; }
  .dm-actions { position: absolute; top: 6px; right: 6px; padding: 0 !important; border: 0 !important; }
  .dm-aud-cell { align-items: flex-start !important; }
  .dm-aud-list { justify-content: flex-end; }
  .dm-desc { font-size: 12px; }
}
</style>
