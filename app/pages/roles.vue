<template>
  <PageHeader
    eyebrow="Access Control"
    title="Roles & Permissions"
    subtitle="RBAC role assignments, user status management, and organisational departments across UAPTS agencies"
  >
    <template #actions>
      <ExportButton :rows="exportRows" :columns="exportColumns" filename="uapts-users" label="Export" />
      <NuxtLink to="/users" class="btn-primary">+ Add User</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error"         class="error-banner">⚠ {{ error }}</div>
  <div v-if="actionError"   class="error-banner action-error">⚠ {{ actionError }}</div>
  <div v-if="actionSuccess" class="success-banner">✓ {{ actionSuccess }}</div>

  <!-- Metric strip - one flat row, not six separate cards -->
  <div class="metric-strip" role="group" aria-label="User account statistics">
    <div v-for="m in metrics" :key="m.label" class="metric-item">
      <span class="metric-label">{{ m.label }}</span>
      <span class="metric-value">{{ metricsUnavailable ? '-' : m.value }}</span>
      <span class="metric-sub">{{ metricsUnavailable ? (loading ? 'Loading…' : 'Unavailable') : m.sub }}</span>
    </div>
  </div>

  <!-- Users -->
  <SectionTitle>
    Users
    <template v-if="roleFilter"> - <em>{{ roleFilter }}</em></template>
  </SectionTitle>

  <!-- Filter toolbar -->
  <div class="filter-bar">
    <input
      v-model="search"
      class="select-sm"
      placeholder="Search by email…"
      aria-label="Search by email"
      style="min-width:220px;flex:1 1 220px"
      @keyup.enter="applyFilters"
    />
    <select v-model="roleFilter" class="select-sm" aria-label="Filter by role">
      <option value="">All roles</option>
      <option value="super_admin">super_admin</option>
      <option value="admin">admin</option>
      <option value="analyst">analyst</option>
      <option value="operator">operator</option>
      <option value="public">public</option>
    </select>
    <select
      v-model="agencyFilter" class="select-sm" aria-label="Filter by agency"
      :disabled="!unscoped" :title="!unscoped ? `Scoped to your own agency (${ownAgencyCode})` : undefined"
    >
      <option v-if="unscoped" value="">All agencies</option>
      <option v-for="code in agencyCodes" :key="code" :value="code">{{ code }}</option>
    </select>
    <select v-model="activeFilter" class="select-sm" aria-label="Filter by account status">
      <option value="">All statuses</option>
      <option value="true">Active only</option>
      <option value="false">Inactive only</option>
    </select>
    <select v-model="mfaFilter" class="select-sm" aria-label="Filter by MFA status">
      <option value="">All MFA</option>
      <option value="true">MFA enrolled</option>
      <option value="false">No MFA</option>
    </select>
    <button class="btn" @click="resetFilters">Reset</button>
    <span style="flex:1" />
    <div class="mini-pager">
      <span class="result-count">{{ userTableTotal }} users · Page {{ userTablePage }} of {{ userTableTotalPages }}</span>
      <button type="button" class="icon-btn" :disabled="userTablePage <= 1" aria-label="Previous page" @click="userTablePrev">‹</button>
      <button type="button" class="icon-btn" :disabled="userTablePage >= userTableTotalPages" aria-label="Next page" @click="userTableNext">›</button>
    </div>
  </div>

  <div id="users-table" class="card drill-target">
    <div class="card-body">
      <table class="users-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Agency</th>
            <th>Role</th>
            <th>Status</th>
            <th>MFA</th>
            <th>Staff</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody v-if="filteredUsers.length">
          <template v-for="u in userTablePageRows" :key="u.id">

            <!-- ── Normal row ── -->
            <tr v-if="editingId !== u.id" :class="{ 'row-inactive': u.is_active === false }">
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
                <span v-if="u.role_name && u.role_name !== u.role_type" class="role-sub">{{ u.role_name }}</span>
              </td>
              <td data-label="Status">
                <BadgePill :variant="u.is_active !== false ? 'success' : 'danger'">
                  {{ u.is_active !== false ? 'Active' : 'Inactive' }}
                </BadgePill>
              </td>
              <td data-label="MFA">
                <BadgePill :variant="u.mfa_active ? 'success' : 'neutral'">{{ u.mfa_active ? 'On' : 'Off' }}</BadgePill>
              </td>
              <td data-label="Staff">
                <BadgePill :variant="u.is_staff ? 'warning' : 'neutral'">{{ u.is_staff ? 'Staff' : 'No' }}</BadgePill>
              </td>
              <td class="dim date-cell" data-label="Joined">{{ fmtDate(u.created_at) }}</td>
              <td>
                <div class="action-group">
                  <button class="btn btn-sm" @click="startEdit(u)">Edit</button>
                  <button
                    type="button"
                    class="btn btn-sm row-menu-trigger"
                    aria-haspopup="true"
                    :aria-expanded="openMenuId === u.id"
                    :disabled="savingId === u.id"
                    @click="toggleMenu(u, $event)"
                  >More <span aria-hidden="true">▾</span></button>
                </div>
              </td>
            </tr>

            <!-- ── Editing row ── -->
            <tr v-else class="row-editing">
              <td>
                <span class="email-cell" :title="u.email">{{ u.email }}</span>
              </td>
              <td data-label="Agency">
                <BadgePill v-if="u.agency_code" variant="neutral">{{ u.agency_code }}</BadgePill>
                <span v-else class="dim">-</span>
              </td>
              <td data-label="Role">
                <select v-model="editForm.role_type" class="select-inline">
                  <option value="super_admin">super_admin</option>
                  <option value="admin">admin</option>
                  <option value="analyst">analyst</option>
                  <option value="operator">operator</option>
                  <option value="public">public</option>
                </select>
              </td>
              <td data-label="Status">
                <label class="toggle-label">
                  <input type="checkbox" v-model="editForm.is_active" />
                  <span>{{ editForm.is_active ? 'Active' : 'Inactive' }}</span>
                </label>
              </td>
              <td data-label="MFA">
                <BadgePill :variant="u.mfa_active ? 'success' : 'neutral'">{{ u.mfa_active ? 'On' : 'Off' }}</BadgePill>
              </td>
              <td data-label="Staff">
                <label class="toggle-label">
                  <input type="checkbox" v-model="editForm.is_staff" />
                  <span>{{ editForm.is_staff ? 'Staff' : 'No' }}</span>
                </label>
              </td>
              <td class="dim date-cell" data-label="Joined">{{ fmtDate(u.created_at) }}</td>
              <td>
                <div class="action-group">
                  <button
                    class="btn btn-sm btn-primary-sm"
                    :disabled="savingId === u.id"
                    @click="saveEdit(u)"
                  >{{ savingId === u.id ? 'Saving…' : 'Save' }}</button>
                  <button class="btn btn-sm" @click="cancelEdit">Cancel</button>
                </div>
              </td>
            </tr>

          </template>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="8" class="empty-row">
              {{ loading ? 'Loading users…' : 'No users match the current filters.' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="userTablePage" :total-pages="userTableTotalPages" :total="userTableTotal"
        @prev="userTablePrev" @next="userTableNext"
      />

      <div v-if="hasMore" class="load-more">
        <button class="btn" :disabled="loading" @click="loadMore">Load more…</button>
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
        :disabled="savingId === openMenuUser.id"
        @click="confirmToggleActive(openMenuUser); closeMenu()"
      >{{ openMenuUser.is_active !== false ? 'Deactivate' : 'Activate' }}</button>
      <button
        role="menuitem"
        class="row-menu-item row-menu-item--danger"
        :disabled="savingId === openMenuUser.id"
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
    :busy="confirmBusy"
    @confirm="runConfirmAction"
    @cancel="confirmAction = null"
  />

  <!-- Role & Organization - secondary to Users, split into two tab panels -->
  <SectionTitle>Role & Organization</SectionTitle>
  <div class="subtab-bar" role="tablist" aria-label="Role and organization views">
    <button
      id="tab-roles" type="button" role="tab" class="subtab"
      :class="{ active: orgTab === 'roles' }" :aria-selected="orgTab === 'roles'" aria-controls="panel-roles"
      @click="orgTab = 'roles'"
    >Roles ({{ roles.length }})</button>
    <button
      id="tab-departments" type="button" role="tab" class="subtab"
      :class="{ active: orgTab === 'departments' }" :aria-selected="orgTab === 'departments'" aria-controls="panel-departments"
      @click="orgTab = 'departments'"
    >Departments ({{ departments.length }})</button>
    <span class="subtab-spacer" />
    <NuxtLink to="/audit" class="subtab-link">Audit Trail →</NuxtLink>
  </div>

  <!-- Role Catalog -->
  <div v-show="orgTab === 'roles'" id="panel-roles" role="tabpanel" aria-labelledby="tab-roles" class="card">
    <div class="card-body">
      <table class="compact-table">
        <thead>
          <tr>
            <th>Role</th>
            <th style="text-align:center">Users</th>
            <th>Type</th>
            <th>Permissions</th>
            <th></th>
          </tr>
        </thead>
        <tbody v-if="roles.length">
          <tr v-for="r in rolesPageRows" :key="r.id">
            <td style="font-weight:600">
              <BadgePill :variant="roleBadge(r.role_name)">{{ r.role_name }}</BadgePill>
            </td>
            <td class="num" style="text-align:center;font-weight:700;color:var(--fg-1)">{{ userCountForRole(r.role_name) }}</td>
            <td>
              <BadgePill v-if="isBuiltinRole(r.role_name)" variant="info"    size="sm">built-in</BadgePill>
              <BadgePill v-else                             variant="neutral" size="sm">custom</BadgePill>
            </td>
            <td class="dim perm-desc">{{ rolePermDesc(r.role_name) }}</td>
            <td>
              <button
                v-if="!isBuiltinRole(r.role_name)"
                class="btn btn-sm btn-tone-danger"
                :disabled="deletingRoleId === r.id"
                @click="confirmDeleteRole(r)"
              >Delete</button>
              <span v-else class="lock-icon" title="Built-in roles cannot be deleted">🔒</span>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="5" class="empty-row">{{ loading ? 'Loading roles…' : 'No roles found.' }}</td></tr>
        </tbody>
      </table>
      <TablePagination
        :page="rolesPage" :total-pages="rolesTotalPages" :total="rolesTotal"
        @prev="rolesPrev" @next="rolesNext"
      />
    </div>
    <div class="card-footer add-role-footer">
      <input
        v-model="newRoleName"
        class="select-sm"
        placeholder="New custom role name…"
        aria-label="New custom role name"
        style="flex:1;min-width:160px"
        @keyup.enter="createRole"
      />
      <button class="btn" :disabled="!newRoleName.trim() || creatingRole" @click="createRole">
        {{ creatingRole ? 'Creating…' : '+ Add Role' }}
      </button>
    </div>
  </div>

  <!-- Departments -->
  <div v-show="orgTab === 'departments'" id="panel-departments" role="tabpanel" aria-labelledby="tab-departments" class="card">
    <div class="card-body">
      <table class="compact-table">
        <thead>
          <tr>
            <th>Department</th>
            <th>Code</th>
            <th>Agency</th>
            <th>Parent</th>
          </tr>
        </thead>
        <tbody v-if="departments.length">
          <tr v-for="d in departmentsPageRows" :key="d.id">
            <td style="font-weight:600">{{ d.department_name }}</td>
            <td class="mono-sm">{{ d.department_code }}</td>
            <td><BadgePill variant="neutral">{{ d.agency_code ?? d.agency }}</BadgePill></td>
            <td class="dim" style="font-size:12px">{{ d.parent_department ?? '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="4" class="empty-row">{{ loading ? 'Loading…' : 'No departments found.' }}</td></tr>
        </tbody>
      </table>
      <TablePagination
        :page="departmentsPage" :total-pages="departmentsTotalPages" :total="departmentsTotal"
        @prev="departmentsPrev" @next="departmentsNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useRoles as _useRoles, useDepartments as _useDepartments, useUsers as _useUsers } from '~/composables/api'
import type { Role, Department, User } from '~/types/uapts'
import { isUnscopedAdmin, scopedAgencyCode, agencyListQueryFor, canManageUser } from '~/composables/useAgencyScope'

// ── Agency scoping ───────────────────────────────────────────────────────
// Same gap /users.vue already closed: an agency admin manages only their
// own tenant's users/departments here too (this page's Users table and
// Departments tab are the same underlying data, just presented
// differently) - super_admin is still the only tier that sees/manages
// every agency. Client-side convenience only, same as every other RBAC
// check in this app - the backend list() calls are the real gate via
// agencyListQueryFor()'s `agency` filter.
const { user: viewer } = useAuth()
const viewerScope  = computed(() => viewer.value as any)
const unscoped     = computed(() => isUnscopedAdmin(viewerScope.value))
const ownAgencyCode = computed(() => scopedAgencyCode(viewerScope.value))

// ── State ──────────────────────────────────────────────────────────────

const roles       = ref<Role[]>([])
const users       = ref<User[]>([])
const departments = ref<Department[]>([])
const loading     = ref(true)
const error       = ref<string | null>(null)
const actionError  = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)
const usersError  = ref(false)
const hasMore     = ref(false)
let   currentPage = 1

const search       = ref('')
const roleFilter   = ref('')
const agencyFilter = ref('')
const activeFilter = ref('')
const mfaFilter    = ref('')

const editingId = ref<string | null>(null)
const savingId  = ref<string | null>(null)
const editForm  = reactive({ role_type: 'public', is_active: true, is_staff: false })

const newRoleName    = ref('')
const creatingRole   = ref(false)
const deletingRoleId = ref<string | null>(null)

/** Role Catalog / Departments live as tabs below the Users hero. */
const orgTab = ref<'roles' | 'departments'>('roles')

// ── Load ───────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value   = null
  editingId.value = null
  closeMenu()
  currentPage = 1

  // Scoped admins can't drift the filter to another tenant on a reload.
  if (!unscoped.value) agencyFilter.value = ownAgencyCode.value ?? ''

  const [rRes, uRes, dRes] = await Promise.allSettled([
    _useRoles().list({ page_size: 100 }),
    _useUsers().list({
      page_size: 100,
      search:    search.value    || undefined,
      role_type: roleFilter.value || undefined,
      is_active: activeFilter.value ? activeFilter.value === 'true' : undefined,
      ...agencyListQueryFor(viewerScope.value),
    }),
    _useDepartments().list({ page_size: 100, ...agencyListQueryFor(viewerScope.value) }),
  ])

  if (rRes.status === 'fulfilled') roles.value       = (rRes.value as any).results ?? rRes.value ?? []
  if (uRes.status === 'fulfilled') {
    users.value = (uRes.value as any).results ?? uRes.value ?? []
    hasMore.value = !!((uRes.value as any).next)
  }
  if (dRes.status === 'fulfilled') departments.value = (dRes.value as any).results ?? dRes.value ?? []

  usersError.value = uRes.status === 'rejected'

  if (rRes.status === 'rejected' && uRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Accounts API.'

  loading.value = false
}

async function loadMore() {
  loading.value = true
  currentPage++
  try {
    const res = await _useUsers().list({
      page_size: 100,
      page: currentPage,
      search: search.value || undefined,
      role_type: roleFilter.value || undefined,
      ...agencyListQueryFor(viewerScope.value),
    })
    const more = (res as any).results ?? []
    users.value.push(...more)
    hasMore.value = !!((res as any).next)
  } finally { loading.value = false }
}

function applyFilters() { editingId.value = null; load() }
function resetFilters()  { search.value = ''; roleFilter.value = ''; agencyFilter.value = ''; activeFilter.value = ''; mfaFilter.value = ''; load() }

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  // Skip a silent background refresh while an inline edit or the row-action
  // menu is open - a mid-task reset with no warning is real data loss.
  t = setInterval(() => { if (!editingId.value && !openMenuId.value) load() }, 120_000)
})
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ───────────────────────────────────────────────────────────

const agencyCodes = computed(() =>
  [...new Set(users.value.map(u => u.agency_code).filter(Boolean))] as string[],
)

const filteredUsers = computed(() =>
  users.value.filter(u => {
    if (search.value) {
      const q = search.value.toLowerCase()
      if (!u.email.toLowerCase().includes(q)) return false
    }
    if (roleFilter.value   && u.role_type     !== roleFilter.value)   return false
    if (agencyFilter.value && u.agency_code   !== agencyFilter.value) return false
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

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: userTablePageRows, page: userTablePage, totalPages: userTableTotalPages,
  total: userTableTotal, next: userTableNext, prev: userTablePrev,
} = usePagination(filteredUsers, 15)

const {
  pageRows: rolesPageRows, page: rolesPage, totalPages: rolesTotalPages,
  total: rolesTotal, next: rolesNext, prev: rolesPrev,
} = usePagination(roles, 15)

const {
  pageRows: departmentsPageRows, page: departmentsPage, totalPages: departmentsTotalPages,
  total: departmentsTotal, next: departmentsNext, prev: departmentsPrev,
} = usePagination(departments, 15)

function byRoleType(rt: string) { return users.value.filter(u => u.role_type === rt).length }
function userCountForRole(name: string) {
  return users.value.filter(u => u.role_name === name || u.role_type === name).length
}
function isBuiltinRole(name: string) { return ['super_admin', 'admin', 'analyst', 'operator', 'public'].includes(name) }

// ── Metric strip ─────────────────────────────────────────────────────────

const metricsUnavailable = computed(() => loading.value || usersError.value)
const metrics = computed(() => [
  { label: 'Total Users',  value: users.value.length,                                    sub: 'Platform accounts' },
  { label: 'Active',       value: users.value.filter(u => u.is_active !== false).length,  sub: 'Enabled accounts' },
  { label: 'Admins',       value: byRoleType('admin'),                                    sub: 'Full access' },
  { label: 'Analysts',     value: byRoleType('analyst'),                                  sub: 'Read + report' },
  { label: 'Operators',    value: byRoleType('operator'),                                 sub: 'Operational access' },
  { label: 'MFA Enrolled', value: users.value.filter(u => u.mfa_active).length,            sub: '2FA active' },
])

// ── Export ─────────────────────────────────────────────────────────────
// Client-side CSV of exactly what the table currently shows (already-loaded,
// already-filtered rows) - no backend export endpoint for this registry.

const exportColumns = [
  { key: 'email',  label: 'Email' },
  { key: 'agency', label: 'Agency' },
  { key: 'role',   label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'mfa',    label: 'MFA' },
  { key: 'staff',  label: 'Staff' },
  { key: 'joined', label: 'Joined' },
]
const exportRows = computed(() => filteredUsers.value.map(u => ({
  email:  u.email,
  agency: u.agency_code ?? '-',
  role:   u.role_type,
  status: u.is_active !== false ? 'Active' : 'Inactive',
  mfa:    u.mfa_active ? 'On' : 'Off',
  staff:  u.is_staff ? 'Staff' : 'No',
  joined: fmtDate(u.created_at),
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

// ── Row editing ────────────────────────────────────────────────────────

function startEdit(u: User) {
  closeMenu()
  editingId.value     = u.id
  editForm.role_type  = u.role_type
  editForm.is_active  = u.is_active !== false
  editForm.is_staff   = u.is_staff ?? false
  actionError.value   = null
  actionSuccess.value = null
}

function cancelEdit() { editingId.value = null }

async function saveEdit(u: User) {
  if (!canManageUser(viewerScope.value, u)) { actionError.value = 'You can only manage accounts in your own agency.'; return }
  savingId.value = u.id
  actionError.value = null
  try {
    const updated = await _useUsers().update(u.id, {
      role_type: editForm.role_type as User['role_type'],
      is_active: editForm.is_active,
      is_staff:  editForm.is_staff,
    }) as User
    const idx = users.value.findIndex(x => x.id === u.id)
    if (idx !== -1) users.value[idx] = { ...users.value[idx], ...updated }
    editingId.value = null
    flash(`${u.email} updated - role: ${editForm.role_type}.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.message ?? 'Failed to update user.'
  } finally {
    savingId.value = null
  }
}

async function toggleActive(u: User) {
  if (!canManageUser(viewerScope.value, u)) { actionError.value = 'You can only manage accounts in your own agency.'; return }
  savingId.value = u.id
  actionError.value = null
  const newActive = u.is_active === false
  try {
    await _useUsers().update(u.id, { is_active: newActive })
    const idx = users.value.findIndex(x => x.id === u.id)
    if (idx !== -1) users.value[idx] = { ...users.value[idx]!, is_active: newActive }
    flash(`${u.email} ${newActive ? 'activated' : 'deactivated'}.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.message ?? 'Failed to update user status.'
  } finally {
    savingId.value = null
  }
}

async function deleteUser(u: User) {
  if (!canManageUser(viewerScope.value, u)) { actionError.value = 'You can only manage accounts in your own agency.'; return }
  savingId.value = u.id
  actionError.value = null
  try {
    await _useUsers().remove(u.id)
    users.value = users.value.filter(x => x.id !== u.id)
    flash(`User ${u.email} deleted.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.message ?? 'Failed to delete user.'
  } finally {
    savingId.value = null
  }
}

// ── Confirmation dialog ──────────────────────────────────────────────────
// Replaces window.confirm() for every destructive/consequential action on
// this page (delete user, deactivate, delete role) with the app's own
// themed modal. Activating proceeds immediately as before; deactivating -
// the access-lockout direction - now asks first, same as delete already did.

interface ConfirmSpec { title: string; message: string; confirmLabel: string; danger: boolean; busyKey: string; run: () => void | Promise<void> }
const confirmAction = ref<ConfirmSpec | null>(null)
const confirmBusy   = computed(() => {
  const key = confirmAction.value?.busyKey
  return !!key && (savingId.value === key || deletingRoleId.value === key)
})

function confirmToggleActive(u: User) {
  if (u.is_active === false) { toggleActive(u); return } // activating - low risk, no confirmation
  confirmAction.value = {
    title: 'Deactivate account',
    message: `Deactivate "${u.email}"? They will immediately lose the ability to sign in.`,
    confirmLabel: 'Deactivate',
    danger: true,
    busyKey: u.id,
    run: () => toggleActive(u),
  }
}

function confirmDeleteUser(u: User) {
  confirmAction.value = {
    title: 'Delete user',
    message: `Delete user "${u.email}"?\n\nThis cannot be undone. Their audit log entries will be preserved.`,
    confirmLabel: 'Delete',
    danger: true,
    busyKey: u.id,
    run: () => deleteUser(u),
  }
}

async function runConfirmAction() {
  const action = confirmAction.value
  if (!action) return
  // Stay open (the :busy prop reflects savingId/deletingRoleId) so the user
  // sees the in-flight request; the underlying actions already catch their
  // own errors into actionError, so this always resolves and closes.
  await action.run()
  confirmAction.value = null
}

// ── Role management ────────────────────────────────────────────────────

async function createRole() {
  const name = newRoleName.value.trim()
  if (!name) return
  creatingRole.value = true
  actionError.value  = null
  try {
    const role = await _useRoles().create({ role_name: name }) as Role
    roles.value.push(role)
    newRoleName.value = ''
    flash(`Role "${name}" created.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.message ?? 'Failed to create role.'
  } finally {
    creatingRole.value = false
  }
}

async function deleteRole(r: Role) {
  deletingRoleId.value = r.id
  actionError.value    = null
  try {
    await _useRoles().remove(r.id)
    roles.value = roles.value.filter(x => x.id !== r.id)
    flash(`Role "${r.role_name}" deleted.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.message ?? 'Failed to delete role.'
  } finally {
    deletingRoleId.value = null
  }
}

function confirmDeleteRole(r: Role) {
  confirmAction.value = {
    title: 'Delete role',
    message: `Delete role "${r.role_name}"?\n\nUsers assigned this custom role will retain their role_type but lose the custom role link.`,
    confirmLabel: 'Delete',
    danger: true,
    busyKey: r.id,
    run: () => deleteRole(r),
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

let flashTimeout: ReturnType<typeof setTimeout> | null = null
function flash(msg: string) {
  actionSuccess.value = msg
  if (flashTimeout) clearTimeout(flashTimeout)
  flashTimeout = setTimeout(() => { actionSuccess.value = null }, 4000)
}

const ROLE_DEFS = [
  { key: 'super_admin', description: 'Full platform bypass - every module, every agency, all scope restrictions lifted.' },
  { key: 'admin',    description: 'Manage users, configure integrations, access all modules and administration.' },
  { key: 'analyst',  description: 'Read data, run ad-hoc queries, generate and download reports.' },
  { key: 'operator', description: 'Update incident status, dispatch resources, trigger feed sync.' },
  { key: 'public',   description: 'Read-only access to published dashboards and public data.' },
]

function rolePermDesc(name: string) {
  return ROLE_DEFS.find(r => r.key === name)?.description ?? 'Custom role - permissions configured server-side.'
}

function roleBadge(r: string) {
  const m: Record<string, string> = { super_admin: 'danger', admin: 'danger', analyst: 'info', operator: 'warning', public: 'neutral' }
  return m[r] ?? 'neutral'
}

function fmtDate(d?: string | null) {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}
</script>

<style scoped>
/* Banners */
.action-error    { background:var(--danger-bg); border-color:color-mix(in srgb, var(--danger-fg) 40%, transparent); color:var(--danger-fg); }
.success-banner  { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:var(--success-bg); border:1px solid color-mix(in srgb, var(--success-fg) 40%, transparent); font-size:13px; color:var(--success-fg); }

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
.metric-sub   { font-size:10.5px; color:var(--fg-3); }
@media (max-width:640px) {
  .metric-strip { display:grid; grid-template-columns:1fr 1fr; }
  .metric-item  { border-left:0; border-right:1px solid var(--border-subtle); border-bottom:1px solid var(--border-subtle); }
  .metric-item:nth-child(2n)      { border-right:0; }
  .metric-item:nth-last-child(-n+2) { border-bottom:0; }
}

/* Filters */
.filter-bar   { padding:8px 12px; margin-bottom:10px; }
.result-count { font-size:12px; color:var(--fg-2); white-space:nowrap; }
.mini-pager   { display:flex; align-items:center; gap:8px; }
.icon-btn {
  width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center;
  border:1px solid var(--border-interactive); border-radius:var(--r-sm);
  background:var(--surface-2); color:var(--fg-2); cursor:pointer; font-size:15px; line-height:1; padding:0;
}
.icon-btn:hover:not(:disabled) { border-color:var(--primary); color:var(--primary); background:var(--surface-quiet); }
.icon-btn:disabled { opacity:.4; cursor:not-allowed; }

/* Users table - card-body goes flush so the table's own cell padding sets
   the inset; the pagination/load-more rows below get their own horizontal
   padding back since TablePagination has none of its own. */
#users-table .card-body { padding:0; }
#users-table :deep(.table-pagination) { padding-left:12px; padding-right:12px; }
.users-table { width:100%; }
.users-table th, .users-table td { padding:6px 12px; }
.row-inactive { opacity:.55; background:var(--surface-1); }
.row-editing  { background:var(--warning-bg); }
.email-cell   {
  font-size:13px; font-weight:600; color:var(--fg-1);
  display:inline-block; max-width:260px; overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; vertical-align:middle;
}
.staff-pip    { margin-left:5px; font-size:11px; color:var(--warning-fg); }
.role-sub     { display:block; font-size:11px; color:var(--fg-3); margin-top:2px; }
.date-cell    { font-family:var(--font-mono); font-variant-numeric:tabular-nums; font-size:11.5px; white-space:nowrap; }
.dim          { color:var(--fg-3); }

/* Tablet - shed the least-important columns before forcing horizontal scroll */
@media (max-width:1100px) {
  .users-table th:nth-child(6), .users-table td:nth-child(6) { display:none; } /* Staff */
}
@media (max-width:900px) {
  .users-table th:nth-child(5), .users-table td:nth-child(5) { display:none; } /* MFA */
}

/* Mobile - each row becomes a compact record, email first, all fields kept */
@media (max-width:640px) {
  .users-table thead { display:none; }
  .users-table, .users-table tbody { display:block; width:100%; }
  .users-table tr {
    display:block; width:100%; margin-bottom:8px; padding:10px 12px;
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
  .users-table td:nth-child(5), .users-table td:nth-child(6) { display:flex; } /* MFA/Staff back on mobile cards */
  .users-table td:first-child {
    display:block; font-size:14px; font-weight:700;
    padding:0 0 8px; margin-bottom:6px; border-bottom:1px solid var(--border-subtle);
  }
  .users-table td:first-child::before { content:none; }
  .users-table td:last-child {
    display:flex; justify-content:flex-start;
    padding:8px 0 0; margin-top:4px; border-top:1px solid var(--border-subtle);
  }
  .users-table td:last-child::before { content:none; }
}

/* Action buttons */
.action-group    { display:flex; gap:4px; flex-wrap:wrap; }
.btn-primary-sm  { background:var(--primary-fill); color:#fff; border-color:var(--primary-fill); }
.btn-primary-sm:hover { background:var(--primary-dark); border-color:var(--primary-dark); }
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

/* Inline edit controls */
.select-inline { padding:4px 8px; border:1px solid var(--border-interactive); border-radius:4px; font-size:12px; background:var(--surface-2); cursor:pointer; }
.toggle-label  { display:flex; align-items:center; gap:5px; font-size:12px; cursor:pointer; white-space:nowrap; }

/* Load more */
.load-more { text-align:center; padding:12px 12px 4px; }

/* Role & Organization - tab switcher between the two secondary panels */
.subtab-bar {
  display:flex; align-items:center; gap:18px;
  border-bottom:1px solid var(--border-subtle); margin-bottom:12px;
}
.subtab {
  background:none; border:0; border-bottom:2px solid transparent; margin-bottom:-1px;
  padding:8px 2px; font-size:12.5px; font-weight:600; color:var(--fg-2); cursor:pointer;
  transition:color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
.subtab:hover { color:var(--fg-1); }
.subtab.active { color:var(--primary); border-bottom-color:var(--primary); }
.subtab:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }
.subtab-spacer { flex:1; }
.subtab-link { font-size:12px; color:var(--link); text-decoration:none; padding:8px 2px; }
.subtab-link:hover { text-decoration:underline; }

.card-body   { padding:10px 12px; }
.card-footer { padding:10px 12px; }
.compact-table { width:100%; }
.compact-table th, .compact-table td { padding:6px 10px; font-size:12px; }
.perm-desc { font-size:11px; max-width:1px; width:100%; }
.lock-icon { font-size:12px; color:var(--fg-3); opacity:.8; cursor:default; }
.mono-sm   { font-family:var(--font-mono); font-size:11.5px; font-variant-numeric:tabular-nums; }

.add-role-footer { display:flex; gap:8px; align-items:center; }

/* Empty states */
.empty-row { text-align:center; color:var(--fg-3); font-size:13px; padding:24px; }
</style>
