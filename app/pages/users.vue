<template>
  <PageHeader
    eyebrow="User Management"
    title="Users"
    :subtitle="unscoped ? 'Platform account directory - create accounts, manage status, and view profiles across all UAPTS agencies' : `Account directory for ${ownAgencyCode} - create accounts, manage status, and view profiles within your own agency`"
  >
    <template #actions>
      <ExportButton :rows="exportRows" :columns="exportColumns" filename="uapts-accounts" label="Export" />
      <NuxtLink to="/roles" class="btn">Roles & Permissions →</NuxtLink>
      <button class="btn-primary" @click="openCreate">+ Create User</button>
    </template>
  </PageHeader>

  <div v-if="error"          class="error-banner">⚠ {{ error }}</div>
  <div v-if="actionError"    class="error-banner action-error">⚠ {{ actionError }}</div>
  <div v-if="actionSuccess"  class="success-banner">✓ {{ actionSuccess }}</div>

  <!-- Metric strip - one flat row, not six separate cards -->
  <div class="metric-strip" role="group" aria-label="Account statistics">
    <div v-for="m in metrics" :key="m.label" class="metric-item">
      <span class="metric-label">{{ m.label }}</span>
      <span class="metric-value" :class="{ 'is-warn': m.warn }">{{ metricsUnavailable ? '-' : m.value }}</span>
      <span class="metric-sub">{{ metricsUnavailable ? (loading ? 'Loading…' : 'Unavailable') : m.sub }}</span>
    </div>
  </div>

  <!-- Filters -->
  <SectionTitle>Account Directory</SectionTitle>
  <div class="filter-bar">
    <input
      v-model="search"
      class="select-sm filter-input"
      placeholder="Search email…"
      aria-label="Search by email"
      @keyup.enter="applyFilters"
    />
    <select
      v-model="agencyFilter" class="select-sm filter-select filter-select--agency" aria-label="Filter by agency"
      :disabled="!unscoped" :title="!unscoped ? `Scoped to your own agency (${ownAgencyCode})` : undefined"
    >
      <option v-if="unscoped" value="">All agencies</option>
      <option v-for="a in visibleAgencies" :key="a.id" :value="a.agency_code">{{ a.agency_code }} - {{ a.agency_name }}</option>
    </select>
    <select v-model="roleFilter" class="select-sm filter-select" aria-label="Filter by role">
      <option value="">All roles</option>
      <option value="super_admin">Super Admin</option>
      <option value="admin">Admin</option>
      <option value="analyst">Analyst</option>
      <option value="operator">Operator</option>
      <option value="public">Public</option>
    </select>
    <select v-model="activeFilter" class="select-sm filter-select" aria-label="Filter by account status">
      <option value="">All statuses</option>
      <option value="true">Active only</option>
      <option value="false">Inactive only</option>
    </select>
    <select v-model="mfaFilter" class="select-sm filter-select" aria-label="Filter by MFA status">
      <option value="">All MFA</option>
      <option value="true">MFA enrolled</option>
      <option value="false">No MFA</option>
    </select>
    <button class="btn" @click="resetFilters">Reset</button>
    <div class="mini-pager">
      <span class="result-count">{{ usersTotal }} of {{ users.length }} · Page {{ usersPage }} of {{ usersTotalPages }}</span>
      <button type="button" class="icon-btn" :disabled="usersPage <= 1" aria-label="Previous page" @click="usersPrev">‹</button>
      <button type="button" class="icon-btn" :disabled="usersPage >= usersTotalPages" aria-label="Next page" @click="usersNext">›</button>
    </div>
  </div>

  <!-- User directory table -->
  <div id="account-directory" class="card drill-target">
    <div class="card-body">
      <table class="users-table">
        <thead>
          <tr>
            <th></th>
            <th>Email</th>
            <th>Agency</th>
            <th>Role</th>
            <th>Status</th>
            <th>MFA</th>
            <th>Created</th>
            <th title="Most recent 'login' event for this account from the audit log">Last Login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody v-if="filteredUsers.length">
          <template v-for="u in usersPageRows" :key="u.id">

            <!-- Main row -->
            <tr
              :class="{ 'row-inactive': u.is_active === false, 'row-expanded': expanded === u.id }"
              @click="expanded = expanded === u.id ? null : u.id"
              style="cursor:pointer"
            >
              <td class="expand-cell" data-label="" @click.stop>
                <button
                  type="button"
                  class="expand-toggle"
                  :aria-expanded="expanded === u.id"
                  :aria-label="`${expanded === u.id ? 'Collapse' : 'Expand'} details for ${u.email}`"
                  @click="expanded = expanded === u.id ? null : u.id"
                >
                  <span class="expand-icon" aria-hidden="true">{{ expanded === u.id ? '▾' : '▸' }}</span>
                </button>
              </td>
              <td>
                <span class="email-cell" :title="u.email">{{ u.email }}</span>
                <span v-if="u.is_staff" class="staff-pip" title="Has Django admin / staff access">★</span>
              </td>
              <td data-label="Agency">
                <BadgePill v-if="u.agency_code" variant="neutral">{{ u.agency_code }}</BadgePill>
                <span v-else class="dim">-</span>
              </td>
              <td data-label="Role">
                <BadgePill :variant="roleBadge(u.role_type)">{{ u.role_type }}</BadgePill>
              </td>
              <td data-label="Status">
                <BadgePill :variant="u.is_active !== false ? 'success' : 'danger'">
                  {{ u.is_active !== false ? 'Active' : 'Inactive' }}
                </BadgePill>
              </td>
              <td data-label="MFA">
                <BadgePill :variant="u.mfa_active ? 'success' : 'neutral'">
                  {{ u.mfa_active ? '2FA On' : 'No 2FA' }}
                </BadgePill>
              </td>
              <td class="dim date-cell" data-label="Created">{{ fmtDate(u.created_at) }}</td>
              <td class="dim date-cell" data-label="Last Login">{{ fmtLastLogin(u) }}</td>
              <td @click.stop>
                <button
                  type="button"
                  class="btn btn-sm row-menu-trigger"
                  aria-haspopup="true"
                  :aria-expanded="openMenuId === u.id"
                  :disabled="actionId === u.id"
                  @click="toggleMenu(u, $event)"
                >More <span aria-hidden="true">▾</span></button>
              </td>
            </tr>

            <!-- Expanded profile row -->
            <tr v-if="expanded === u.id" :key="`${u.id}-detail`" class="detail-row">
              <td colspan="9">
                <div class="detail-panel">
                  <div class="detail-grid">
                    <div class="detail-item">
                      <span class="detail-label">User ID</span>
                      <span class="detail-value mono">{{ u.id }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Email</span>
                      <span class="detail-value">{{ u.email }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Agency UUID</span>
                      <span class="detail-value mono">{{ u.agency ?? '-' }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Department UUID</span>
                      <span class="detail-value mono">{{ u.department ?? '-' }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Role (catalog)</span>
                      <span class="detail-value">{{ u.role_name ?? '-' }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Role Type</span>
                      <span class="detail-value">
                        <BadgePill :variant="roleBadge(u.role_type)">{{ u.role_type }}</BadgePill>
                      </span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">MFA Active</span>
                      <span class="detail-value">{{ u.mfa_active ? 'Yes' : 'No' }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Staff Access</span>
                      <span class="detail-value">{{ u.is_staff ? 'Yes - has /admin/ access' : 'No' }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Account Created</span>
                      <span class="detail-value mono">{{ fmtDateTime(u.created_at) }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Last Login</span>
                      <span class="detail-value mono">{{ fmtLastLogin(u) }}</span>
                    </div>
                  </div>
                  <div class="detail-footer">
                    <NuxtLink to="/roles" class="btn btn-sm">Manage Role & Permissions →</NuxtLink>
                  </div>
                </div>
              </td>
            </tr>

          </template>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="9" class="empty-row">
              {{ loading ? 'Loading users…' : 'No users match the current filters.' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="usersPage" :total-pages="usersTotalPages" :total="usersTotal"
        @prev="usersPrev" @next="usersNext"
      />

      <div v-if="hasMore" class="load-more">
        <button class="btn" :disabled="loading" @click="loadMore">Load more users…</button>
      </div>
    </div>
  </div>

  <!-- Row action menu - teleported so the card's clipped/scrolling body never cuts it off -->
  <Teleport to="body">
    <div
      v-if="openMenuUser"
      ref="menuPopRef"
      class="row-menu-pop"
      role="menu"
      :style="{ top: menuPos.top, left: menuPos.left }"
      @keydown="onMenuKeydown"
    >
      <button
        role="menuitem"
        class="row-menu-item"
        :disabled="actionId === openMenuUser.id"
        @click="confirmToggleActive(openMenuUser); closeMenu()"
      >{{ openMenuUser.is_active !== false ? 'Deactivate' : 'Activate' }}</button>
      <button
        role="menuitem"
        class="row-menu-item row-menu-item--danger"
        :disabled="actionId === openMenuUser.id"
        @click="confirmDeleteUser(openMenuUser); closeMenu()"
      >Delete</button>
    </div>
  </Teleport>

  <!-- Destructive/high-consequence action confirmation - replaces window.confirm() -->
  <ConfirmDialog
    :open="!!confirmAction"
    :title="confirmAction?.title ?? ''"
    :message="confirmAction?.message ?? ''"
    :confirm-label="confirmAction?.confirmLabel ?? 'Confirm'"
    busy-label="Working…"
    :danger="confirmAction?.danger ?? false"
    :busy="actionId === confirmAction?.userId"
    @confirm="runConfirmAction"
    @cancel="confirmAction = null"
  />

  <!-- Create User Modal -->
  <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
    <div class="modal">
      <div class="modal-header">
        <span>Create New User</span>
        <button class="modal-close" @click="closeModal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Email address <span class="required">*</span></label>
          <input
            type="email"
            v-model="form.email"
            class="input-full"
            placeholder="user@agency.go.ke"
            :class="{ 'input-error': formErrors.email }"
            @input="formErrors.email = ''"
          />
          <span v-if="formErrors.email" class="field-error">{{ formErrors.email }}</span>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Role type <span class="required">*</span></label>
            <select v-model="form.role_type" class="input-full">
              <option value="analyst">Analyst - read + reports</option>
              <option value="operator">Operator - operations</option>
              <option value="admin">Admin - full access</option>
              <option value="super_admin">Super Admin - full platform bypass</option>
              <option value="public">Public - read only</option>
            </select>
          </div>
          <div class="form-group">
            <label>Agency</label>
            <select v-if="unscoped" v-model="form.agency" class="input-full">
              <option value="">No agency (public user)</option>
              <option v-for="a in agencies" :key="a.id" :value="a.id">
                {{ a.agency_code }} - {{ a.agency_name }}
              </option>
            </select>
            <input v-else class="input-full" disabled :value="`${ownAgencyCode} (your agency)`" />
          </div>
        </div>
        <div class="form-group">
          <label>Department UUID <span class="hint">(optional)</span></label>
          <input v-model="form.department" class="input-full" placeholder="Leave blank to skip" />
        </div>
        <div class="form-check-row">
          <label class="check-label">
            <input type="checkbox" v-model="form.is_active" />
            Account active immediately
          </label>
          <label class="check-label">
            <input type="checkbox" v-model="form.is_staff" />
            Grant staff (admin console) access
          </label>
        </div>
        <div v-if="createApiError" class="api-error">⚠ {{ createApiError }}</div>
      </div>
      <div class="modal-footer">
        <button class="btn" @click="closeModal">Cancel</button>
        <button
          class="btn-primary"
          :disabled="!form.email || creating"
          @click="doCreate"
        >{{ creating ? 'Creating…' : 'Create User' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useUsers as _useUsers, useAgencies as _useAgencies, useAudit as _useAudit } from '~/composables/api'
import type { User, Agency } from '~/types/uapts'
import { isUnscopedAdmin, scopedAgencyCode, agencyListQueryFor, visibleAgencyOptions, canManageUser } from '~/composables/useAgencyScope'

// ── Agency scoping ───────────────────────────────────────────────────────
// An agency admin manages only their own tenant's accounts; super_admin is
// the only tier that sees/manages every agency (spec: access-control.json's
// M10 notes already call this out as the intended behaviour - this page
// just never enforced it). Client-side convenience only, same as every
// other RBAC check in this app - the backend list() call is the real gate
// via agencyListQueryFor()'s `agency` filter.
const { user: viewer } = useAuth()
const viewerScope = computed(() => viewer.value as any)
const unscoped = computed(() => isUnscopedAdmin(viewerScope.value))
const ownAgencyCode = computed(() => scopedAgencyCode(viewerScope.value))
const visibleAgencies = computed(() => visibleAgencyOptions(agencies.value, viewerScope.value))

// ── State ──────────────────────────────────────────────────────────────

const users    = ref<User[]>([])
const agencies = ref<Agency[]>([])
const loading  = ref(true)
const error    = ref<string | null>(null)
const actionError    = ref<string | null>(null)
const actionSuccess  = ref<string | null>(null)
const hasMore  = ref(false)
let   currentPage = 1

const search       = ref('')
const agencyFilter = ref('')
const roleFilter   = ref('')
const activeFilter = ref('')
const mfaFilter    = ref('')
const actionId     = ref<string | null>(null)
const expanded     = ref<string | null>(null)

const showModal    = ref(false)
const creating     = ref(false)
const createApiError = ref<string | null>(null)
const form         = ref({ email: '', role_type: 'analyst', agency: '', department: '', is_active: true, is_staff: false })
const formErrors   = ref({ email: '' })

// The User record has no reliable last-login field of its own (see
// fmtLastLogin() below) - derived instead from the audit log's real
// 'login' events, keyed by the same user UUID both APIs share.
const lastLoginByUser = ref<Record<string, string>>({})

// ── Load ───────────────────────────────────────────────────────────────

async function load() {
  loading.value  = true
  error.value    = null
  expanded.value = null
  closeMenu()
  currentPage    = 1

  // Scoped admins can't drift the filter to another tenant on a reload.
  if (!unscoped.value) agencyFilter.value = ownAgencyCode.value ?? ''

  const [uRes, aRes, auditRes] = await Promise.allSettled([
    _useUsers().list({ page_size: 100, ordering: '-created_at', ...agencyListQueryFor(viewerScope.value) }),
    _useAgencies().list({ page_size: 100 }),
    // Most-recent-first isn't guaranteed by the API contract, so this
    // reduces to the true max per user rather than trusting result order.
    // 300 covers this registry's ~44 accounts many times over even if
    // login frequency is uneven across them; a user genuinely absent from
    // this window just renders "-", same as any other untracked field.
    _useAudit().list({ action: 'login', limit: 300 }),
  ])

  if (uRes.status === 'fulfilled') {
    users.value   = (uRes.value as any).results ?? []
    hasMore.value = !!((uRes.value as any).next)
  }
  if (aRes.status === 'fulfilled') agencies.value = (aRes.value as any).results ?? aRes.value ?? []
  if (uRes.status === 'rejected') error.value = 'Unable to reach the UAPTS Accounts API.'

  if (auditRes.status === 'fulfilled') {
    const latest: Record<string, string> = {}
    for (const entry of auditRes.value.results) {
      const uid = entry.user_id
      if (!uid || uid === 'None') continue
      if (!latest[uid] || new Date(entry.created_at) > new Date(latest[uid]))
        latest[uid] = entry.created_at
    }
    lastLoginByUser.value = latest
  }
  // A rejected audit fetch (e.g. role-gated 403) just leaves the map as-is -
  // fmtLastLogin() already renders "-" for anyone missing from it.

  loading.value = false
}

async function loadMore() {
  loading.value = true
  currentPage++
  try {
    const res = await _useUsers().list({ page_size: 100, page: currentPage, ordering: '-created_at', ...agencyListQueryFor(viewerScope.value) })
    const more = (res as any).results ?? []
    users.value.push(...more)
    hasMore.value = !!((res as any).next)
  } finally { loading.value = false }
}

function applyFilters() { expanded.value = null; load() }
function resetFilters()  {
  search.value = ''; agencyFilter.value = ''; roleFilter.value = ''
  activeFilter.value = ''; mfaFilter.value = ''
  load()
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  // Skip a silent background refresh while the user has a detail row or the
  // row-action menu open - a mid-task reset with no warning is real data loss.
  t = setInterval(() => { if (!expanded.value && !openMenuId.value) load() }, 120_000)
})
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ───────────────────────────────────────────────────────────

const activeCount = computed(() => users.value.filter(u => u.is_active !== false).length)
const mfaCount    = computed(() => users.value.filter(u => u.mfa_active).length)

const filteredUsers = computed(() =>
  users.value.filter(u => {
    if (search.value) {
      const q = search.value.toLowerCase()
      if (!u.email.toLowerCase().includes(q)) return false
    }
    if (agencyFilter.value && u.agency_code !== agencyFilter.value) return false
    if (roleFilter.value   && u.role_type   !== roleFilter.value)   return false
    if (activeFilter.value) {
      const want = activeFilter.value === 'true'
      if (want !== (u.is_active !== false)) return false
    }
    if (mfaFilter.value) {
      const want = mfaFilter.value === 'true'
      if (want !== !!u.mfa_active) return false
    }
    return true
  }),
)

// ── Table pagination (max 15 rows visible) ──────────────────────────────
const {
  pageRows: usersPageRows, page: usersPage, totalPages: usersTotalPages,
  total: usersTotal, next: usersNext, prev: usersPrev,
} = usePagination(filteredUsers, 15)

// ── Metric strip ─────────────────────────────────────────────────────────

const metricsUnavailable = computed(() => loading.value || !!error.value)
const metrics = computed(() => {
  const inactive = users.value.length - activeCount.value
  const noMfa    = users.value.length - mfaCount.value
  return [
    { label: 'Total Accounts', value: users.value.length,                            sub: 'All platform users' },
    { label: 'Active',         value: activeCount.value,                             sub: 'Login enabled' },
    { label: 'Inactive',       value: inactive,                                      sub: 'Login disabled', warn: inactive > 0 },
    { label: 'MFA Enrolled',   value: `${mfaCount.value} / ${users.value.length}`,    sub: '2FA set up' },
    { label: 'No MFA',         value: noMfa,                                         sub: '2FA not configured', warn: noMfa > 0 },
    { label: 'Staff / Admin',  value: users.value.filter(u => u.is_staff).length,     sub: 'Django admin access' },
  ]
})

// ── Export ─────────────────────────────────────────────────────────────
// Client-side CSV of exactly what the table currently shows (already-loaded,
// already-filtered rows) - no backend export endpoint for this registry.

const exportColumns = [
  { key: 'email',     label: 'Email' },
  { key: 'agency',    label: 'Agency' },
  { key: 'role',      label: 'Role' },
  { key: 'status',    label: 'Status' },
  { key: 'mfa',       label: 'MFA' },
  { key: 'staff',     label: 'Staff' },
  { key: 'created',   label: 'Created' },
  { key: 'lastLogin', label: 'Last Login' },
]
const exportRows = computed(() => filteredUsers.value.map(u => ({
  email:     u.email,
  agency:    u.agency_code ?? '-',
  role:      u.role_type,
  status:    u.is_active !== false ? 'Active' : 'Inactive',
  mfa:       u.mfa_active ? '2FA On' : 'No 2FA',
  staff:     u.is_staff ? 'Staff' : 'No',
  created:   fmtDate(u.created_at),
  lastLogin: fmtLastLogin(u),
})))

// ── Row action menu ──────────────────────────────────────────────────────
// A single teleported popover shared by every row, positioned from the
// trigger button's own rect so a clipped/scrolling card body never cuts it
// off. Closes on outside click, Escape, or any scroll (cheaper and more
// robust than tracking every ancestor's scroll position to reposition it).

const openMenuId    = ref<string | null>(null)
const openMenuUser  = computed(() => users.value.find(u => u.id === openMenuId.value) ?? null)
const menuPos       = ref({ top: '0px', left: '0px' })
const menuPopRef    = ref<HTMLElement | null>(null)
const menuTriggerEl = ref<HTMLElement | null>(null)
const MENU_WIDTH    = 160

function toggleMenu(u: User, ev: MouseEvent) {
  if (openMenuId.value === u.id) { closeMenu(); return }
  const btn = ev.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  menuPos.value = {
    top:  `${rect.bottom + 4}px`,
    left: `${Math.max(8, rect.right - MENU_WIDTH)}px`,
  }
  menuTriggerEl.value = btn
  openMenuId.value = u.id
  nextTick(() => menuPopRef.value?.querySelector<HTMLElement>('.row-menu-item')?.focus())
}
/** `refocus` returns focus to the trigger - only wanted for a keyboard-driven
 *  close (Escape); an outside click, a scroll, or a background reload
 *  shouldn't yank focus back to wherever it happened to be. */
function closeMenu(refocus = false) {
  openMenuId.value = null
  if (refocus) menuTriggerEl.value?.focus()
}

function onMenuKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab') return
  const items = menuPopRef.value?.querySelectorAll<HTMLElement>('.row-menu-item:not(:disabled)')
  if (!items || items.length === 0) return
  const first = items[0]!, last = items[items.length - 1]!
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

function onDocClick(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (!el.closest('.row-menu-pop') && !el.closest('.row-menu-trigger')) closeMenu()
}
function onDocKeydown(e: KeyboardEvent) { if (e.key === 'Escape') closeMenu(true) }

function onScrollClose() { closeMenu() }

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKeydown)
  window.addEventListener('scroll', onScrollClose, true)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKeydown)
  window.removeEventListener('scroll', onScrollClose, true)
})

// ── Actions ────────────────────────────────────────────────────────────

async function toggleActive(u: User) {
  if (!canManageUser(viewerScope.value, u)) { actionError.value = 'You can only manage accounts in your own agency.'; return }
  actionId.value    = u.id
  actionError.value = null
  const activate    = u.is_active === false
  try {
    await _useUsers().update(u.id, { is_active: activate })
    const idx = users.value.findIndex(x => x.id === u.id)
    if (idx !== -1) users.value[idx] = { ...users.value[idx]!, is_active: activate }
    flash(`${u.email} ${activate ? 'activated' : 'deactivated'}.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.message ?? 'Failed to update account status.'
  } finally { actionId.value = null }
}

async function deleteUser(u: User) {
  if (!canManageUser(viewerScope.value, u)) { actionError.value = 'You can only manage accounts in your own agency.'; return }
  actionId.value    = u.id
  actionError.value = null
  try {
    await _useUsers().remove(u.id)
    users.value = users.value.filter(x => x.id !== u.id)
    if (expanded.value === u.id) expanded.value = null
    flash(`Account ${u.email} deleted.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.message ?? 'Failed to delete account.'
  } finally { actionId.value = null }
}

// ── Confirmation dialog ──────────────────────────────────────────────────
// Replaces window.confirm() - a themed modal that can carry the app's own
// copy and tone. Activating (re-enabling access) proceeds immediately as
// before, same as it always has; deactivating (an access-lockout, the
// consequential direction) now asks first, same as delete already did.

interface ConfirmSpec { title: string; message: string; confirmLabel: string; danger: boolean; userId: string; run: () => void | Promise<void> }
const confirmAction = ref<ConfirmSpec | null>(null)

function confirmToggleActive(u: User) {
  if (u.is_active === false) { toggleActive(u); return } // activating - low risk, no confirmation
  confirmAction.value = {
    title: 'Deactivate account',
    message: `Deactivate "${u.email}"? They will immediately lose the ability to sign in.`,
    confirmLabel: 'Deactivate',
    danger: true,
    userId: u.id,
    run: () => toggleActive(u),
  }
}

function confirmDeleteUser(u: User) {
  confirmAction.value = {
    title: 'Delete account',
    message: `Permanently delete account "${u.email}"?\n\nThis cannot be undone. Audit log entries will be preserved.`,
    confirmLabel: 'Delete',
    danger: true,
    userId: u.id,
    run: () => deleteUser(u),
  }
}

async function runConfirmAction() {
  const action = confirmAction.value
  if (!action) return
  // Stay open (the :busy prop reflects actionId) so the user sees the
  // in-flight request, not just a dialog that vanishes and hopes for the
  // best; toggleActive/deleteUser already catch their own errors into
  // actionError, so this always resolves and the dialog always closes.
  await action.run()
  confirmAction.value = null
}

// ── Create user ────────────────────────────────────────────────────────

function openCreate() {
  form.value = { email: '', role_type: 'analyst', agency: unscoped.value ? '' : (viewerScope.value?.agency ?? ''), department: '', is_active: true, is_staff: false }
  formErrors.value = { email: '' }
  createApiError.value = null
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function doCreate() {
  formErrors.value.email = ''
  createApiError.value   = null
  if (!form.value.email) { formErrors.value.email = 'Email is required.'; return }
  if (!form.value.email.includes('@')) { formErrors.value.email = 'Enter a valid email address.'; return }
  if (!unscoped.value && form.value.agency !== (viewerScope.value?.agency ?? '')) {
    createApiError.value = 'You can only create accounts in your own agency.'
    return
  }

  creating.value = true
  try {
    const payload: Record<string, unknown> = {
      email:     form.value.email,
      role_type: form.value.role_type,
      is_active: form.value.is_active,
      is_staff:  form.value.is_staff,
    }
    if (form.value.agency)     payload.agency     = form.value.agency
    if (form.value.department) payload.department = form.value.department

    const created = await _useUsers().create(payload as any) as User
    users.value.unshift(created)
    closeModal()
    flash(`Account ${created.email} created: a welcome email with a set-password link is on its way.`)
  } catch (err: any) {
    createApiError.value = err?.data?.detail
      ?? (err?.data?.errors?.[0]?.message)
      ?? err?.message
      ?? 'Failed to create user.'
  } finally { creating.value = false }
}

// ── Helpers ────────────────────────────────────────────────────────────

let flashTimer: ReturnType<typeof setTimeout> | null = null
function flash(msg: string) {
  actionSuccess.value = msg
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { actionSuccess.value = null }, 4000)
}

function roleBadge(r: string) {
  const m: Record<string, string> = { admin: 'danger', analyst: 'info', operator: 'warning', public: 'neutral' }
  return m[r] ?? 'neutral'
}

function fmtDate(d?: string | null) {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}

function fmtDateTime(d?: string | null) {
  if (!d) return '-'
  try { return new Date(d).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return String(d) }
}

// The User record itself carries no reliable last-login field - it's not
// part of the typed User shape (~/types/uapts.ts) or the OpenAPI fixture
// tests.unit/types.test.ts checks against, and it's used nowhere else in
// the app (not even the user's own profile page). Rather than assert a
// specific fact the platform doesn't actually track, this is derived from
// the audit log's genuine 'login' events (see lastLoginByUser in load()) -
// real data, honestly sourced, with "-" for anyone outside that window.
function fmtLastLogin(u: User) {
  return fmtDateTime(lastLoginByUser.value[u.id])
}
</script>

<style scoped>
/* Banners */
.action-error   { background:var(--danger-bg); border-color:color-mix(in srgb, var(--danger-fg) 40%, transparent); color:var(--danger-fg); }
.success-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:var(--success-bg); border:1px solid color-mix(in srgb, var(--success-fg) 40%, transparent); font-size:13px; color:var(--success-fg); }

/* Tighter section rhythm for this page - denser than the site default */
.section-title { margin: 18px 0 8px; }
.section-title:first-of-type { margin-top: 14px; }

/* Metric strip - one flat row with dividers, replaces six separate KPI cards */
.metric-strip {
  display:flex; flex-wrap:wrap;
  background:var(--surface-2); border:1px solid var(--border-subtle); border-radius:var(--radius);
  margin-bottom:14px;
}
.metric-item {
  flex:1 1 150px; min-width:130px;
  padding:10px 16px;
  border-left:1px solid var(--border-subtle);
  display:flex; flex-direction:column; gap:2px;
}
.metric-item:first-child { border-left:0; }
.metric-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--fg-3); }
.metric-value { font-family:var(--font-mono); font-variant-numeric:tabular-nums; font-size:22px; font-weight:700; color:var(--fg-1); line-height:1.15; }
.metric-value.is-warn { color:var(--warning-fg); }
.metric-sub   { font-size:10.5px; color:var(--fg-3); }
@media (max-width:640px) {
  .metric-strip { display:grid; grid-template-columns:1fr 1fr; }
  .metric-item  { border-left:0; border-right:1px solid var(--border-subtle); border-bottom:1px solid var(--border-subtle); }
  .metric-item:nth-child(2n)        { border-right:0; }
  .metric-item:nth-last-child(-n+2) { border-bottom:0; }
}

/* Filters - every control gets min-width:0 so it can actually shrink below
   its content's natural width (the flexbox default is min-width:auto, which
   silently blocks shrinking and forces the whole row - pager included - to
   wrap instead). The pager is the one thing that must never wrap or shrink;
   everything to its left gives way first. */
.result-count { font-size:12px; color:var(--fg-2); white-space:nowrap; }
.filter-bar   { padding:8px 12px; margin-bottom:10px; }
.filter-bar > * { min-width:0; }
.filter-input  { width:180px; flex:0 1 180px; }
.filter-select { flex:0 1 130px; max-width:130px; text-overflow:ellipsis; }
.filter-select--agency { flex-basis:170px; max-width:170px; }
.mini-pager   { display:flex; align-items:center; gap:8px; flex-shrink:0; margin-left:auto; }
.icon-btn {
  width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center;
  border:1px solid var(--border-interactive); border-radius:var(--r-sm);
  background:var(--surface-2); color:var(--fg-2); cursor:pointer; font-size:15px; line-height:1; padding:0;
}
.icon-btn:hover:not(:disabled) { border-color:var(--primary); color:var(--primary); background:var(--surface-quiet); }
.icon-btn:disabled { opacity:.4; cursor:not-allowed; }

/* Table - card-body goes flush so the table's own cell padding sets the
   inset; the pagination/load-more rows below get their own horizontal
   padding back since TablePagination has none of its own. */
#account-directory .card-body { padding:0; }
#account-directory :deep(.table-pagination) { padding-left:12px; padding-right:12px; }
.users-table { width:100%; }
.users-table th, .users-table td { padding:6px 12px; }
.expand-cell { width:24px; text-align:center; padding:0 4px; }
.expand-toggle {
  background:none; border:0; padding:4px; margin:-4px;
  cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
  border-radius:var(--r-xs);
}
.expand-toggle:focus-visible { outline:2px solid var(--primary); outline-offset:1px; }
.expand-icon { font-size:11px; color:var(--fg-3); }
.row-inactive { opacity:.55; background:var(--surface-1); }
.row-expanded > td { background:var(--surface-1); }
.email-cell  {
  font-size:13px; font-weight:600; color:var(--fg-1);
  display:inline-block; max-width:260px; overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; vertical-align:middle;
}
.staff-pip   { margin-left:5px; font-size:11px; color:var(--warning-fg); }
.date-cell   { font-family:var(--font-mono); font-variant-numeric:tabular-nums; font-size:11.5px; white-space:nowrap; }
.dim         { color:var(--fg-3); }

/* Tablet - shed the least-important columns before forcing horizontal scroll */
@media (max-width:1100px) {
  .users-table th:nth-child(8), .users-table td:nth-child(8) { display:none; } /* Last Login */
}
@media (max-width:900px) {
  .users-table th:nth-child(7), .users-table td:nth-child(7) { display:none; } /* Created */
}

/* Mobile - each row becomes a compact record, email first, all fields kept */
@media (max-width:640px) {
  .users-table thead { display:none; }
  .users-table, .users-table tbody { display:block; width:100%; }
  .users-table tr {
    position:relative; display:block; width:100%; margin-bottom:8px; padding:10px 12px;
    background:var(--surface-2); border:1px solid var(--border-subtle); border-radius:var(--r-sm);
  }
  .users-table td {
    display:flex; align-items:center; justify-content:space-between; gap:10px;
    padding:4px 0; border:0; font-size:12.5px;
  }
  .users-table td::before {
    content:attr(data-label); flex-shrink:0;
    font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--fg-3);
  }
  .users-table td:nth-child(7), .users-table td:nth-child(8) { display:flex; } /* Created/Last Login back on mobile cards */
  .users-table td.expand-cell {
    position:absolute; top:8px; right:8px; padding:0; margin:0; border:0; width:auto;
  }
  .users-table td.expand-cell::before { content:none; }
  .users-table td:nth-child(2) {
    display:block; font-size:14px; font-weight:700;
    padding:0 28px 8px 0; margin-bottom:6px; border-bottom:1px solid var(--border-subtle);
  }
  .users-table td:last-child {
    display:flex; justify-content:flex-start;
    padding:8px 0 0; margin-top:4px; border-top:1px solid var(--border-subtle);
  }
  /* The expanded detail panel keeps its own grid layout - it is not a data row. */
  .users-table tr.detail-row { border:0; background:none; padding:0; margin-bottom:8px; }
  .users-table .detail-row td { display:block; padding:0; }
}

/* Action buttons */
.row-menu-trigger { color:var(--fg-2); }

/* Row action popover - teleported to <body>, positioned via inline top/left */
.row-menu-pop {
  position:fixed; z-index:1500; min-width:160px;
  background:var(--surface-2); border:1px solid var(--border-subtle); border-radius:var(--r-sm);
  box-shadow:var(--elev-2); padding:4px; display:flex; flex-direction:column; gap:1px;
}
.row-menu-item {
  text-align:left; background:none; border:0; padding:7px 10px; font-size:12.5px;
  border-radius:var(--r-xs); cursor:pointer; color:var(--fg-1);
}
.row-menu-item:hover:not(:disabled) { background:var(--surface-1); }
.row-menu-item:disabled { opacity:.5; cursor:not-allowed; }
.row-menu-item--danger { color:var(--danger-fg); }
.row-menu-item--danger:hover:not(:disabled) { background:var(--danger-bg); }

/* Expanded detail panel */
.detail-row > td { padding:0; }
.detail-panel {
  padding:16px 20px;
  background:var(--surface-1);
  border-bottom:1px solid var(--border-subtle);
}
.detail-grid {
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(240px,1fr));
  gap:10px 24px;
  margin-bottom:12px;
}
.detail-item   { display:flex; flex-direction:column; gap:2px; }
.detail-label  { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--fg-3); }
.detail-value  { font-size:12px; color:var(--fg-1); word-break:break-all; }
.detail-value.mono { font-family:var(--font-mono); font-size:11px; color:var(--fg-2); }
.detail-footer { border-top:1px solid var(--border-subtle); padding-top:10px; display:flex; gap:8px; }

/* Load more */
.load-more { text-align:center; padding:12px 12px 4px; }

/* Modal */
.modal-backdrop { position:fixed; inset:0; background:var(--scrim); z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; }
.modal { background:var(--surface-2); border-radius:var(--r-lg); width:480px; max-width:100%; box-shadow:var(--elev-3); display:flex; flex-direction:column; }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; font-weight:600; font-size:15px; border-bottom:1px solid var(--border-subtle); }
.modal-close  { background:none; border:none; font-size:22px; cursor:pointer; color:var(--fg-3); line-height:1; padding:0 4px; }
.modal-close:hover { color:var(--fg-2); }
.modal-body   { padding:20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; max-height:70vh; }
.modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:14px 20px; border-top:1px solid var(--border-subtle); }

/* Form elements */
.form-group { display:flex; flex-direction:column; gap:4px; }
.form-group label { font-size:12px; font-weight:600; color:var(--fg-2); }
.form-row   { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.input-full { width:100%; padding:7px 10px; border:1px solid var(--border-interactive); border-radius:6px; font-size:13px; background:var(--surface-2); box-sizing:border-box; }
.input-full:focus { outline:none; border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-wash); }
.input-error { border-color:var(--destructive); }
.field-error { font-size:11px; color:var(--danger-fg); margin-top:2px; }
.hint       { font-weight:400; color:var(--fg-3); }
.required   { color:var(--danger-fg); }
.form-check-row { display:flex; flex-wrap:wrap; gap:16px; }
.check-label { display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; user-select:none; }
.api-error  { font-size:12px; color:var(--danger-fg); padding:8px 12px; background:var(--danger-bg); border-radius:6px; border:1px solid color-mix(in srgb, var(--danger-fg) 30%, transparent); }

/* Empty */
.empty-row { text-align:center; color:var(--fg-3); font-size:13px; padding:24px; }
</style>
