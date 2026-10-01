<template>
  <PageHeader
    class="header-actions-fill"
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
  <div class="filter-bar filter-bar--grid">
    <input
      v-model="search"
      class="select-sm filter-input filter-span"
      placeholder="Search by email…"
      aria-label="Search by email"
      @keyup.enter="applyFilters"
    />
    <select v-model="roleFilter" class="select-sm" aria-label="Filter by role">
      <option value="">All roles</option>
      <option v-for="r in visibleRoles" :key="r.id" :value="r.role_name">{{ r.role_name }}</option>
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
    <div class="mini-pager filter-span">
      <span class="result-count">{{ userTableTotal }} users · Page {{ userTablePage }} of {{ userTableTotalPages }}</span>
      <button type="button" class="icon-btn" :disabled="userTablePage <= 1" aria-label="Previous page" @click="userTablePrev">‹</button>
      <button type="button" class="icon-btn" :disabled="userTablePage >= userTableTotalPages" aria-label="Next page" @click="userTableNext">›</button>
    </div>
  </div>

  <div id="users-table" class="card drill-target">
    <div class="card-body">
      <table class="users-table stack-table">
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
              <td class="stack-title">
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
              <td class="stack-actions">
                <div class="action-group">
                  <button v-if="canManageUsers" class="btn btn-sm" @click="startEdit(u)">Edit</button>
                  <button
                    v-if="canManageUsers"
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
              <td class="stack-title">
                <span class="email-cell" :title="u.email">{{ u.email }}</span>
              </td>
              <td data-label="Agency">
                <BadgePill v-if="u.agency_code" variant="neutral">{{ u.agency_code }}</BadgePill>
                <span v-else class="dim">-</span>
              </td>
              <td data-label="Role">
                <select
                  v-model="editForm.roleSelection" class="select-inline" aria-label="Role"
                  :disabled="roleOptionsFor(u).length < 2 && !customRoleOptionsFor(u).length"
                  :title="roleOptionsFor(u).length < 2 ? 'Only a super_admin can change a super_admin account\'s role' : undefined"
                >
                  <optgroup label="Built-in">
                    <option v-for="r in roleOptionsFor(u)" :key="r" :value="r">{{ r }}</option>
                  </optgroup>
                  <optgroup v-if="customRoleOptionsFor(u).length" label="Custom">
                    <option v-for="r in customRoleOptionsFor(u)" :key="r.id" :value="r.id">{{ r.role_name }}</option>
                  </optgroup>
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
              <td class="stack-actions">
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
    >Roles ({{ visibleRoles.length }})</button>
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
      <table class="compact-table stack-table">
        <thead>
          <tr>
            <th>Role</th>
            <th v-if="unscoped">Agency</th>
            <th style="text-align:center">Users</th>
            <th>Type</th>
            <th>Permissions</th>
            <th></th>
          </tr>
        </thead>
        <tbody v-if="visibleRoles.length">
          <tr v-for="r in rolesPageRows" :key="r.id">
            <td class="stack-title" style="font-weight:600">
              <BadgePill :variant="roleBadge(r)">{{ r.role_name }}</BadgePill>
            </td>
            <td v-if="unscoped" data-label="Agency">
              <BadgePill v-if="r.agency_code" variant="neutral">{{ r.agency_code }}</BadgePill>
              <span v-else class="dim">All agencies</span>
            </td>
            <td class="num" data-label="Users" style="text-align:center;font-weight:700;color:var(--fg-1)">{{ userCountForRole(r.role_name) }}</td>
            <td data-label="Type">
              <BadgePill v-if="isBuiltinRole(r)" variant="info"    size="sm">built-in</BadgePill>
              <BadgePill v-else                   variant="neutral" size="sm">custom</BadgePill>
            </td>
            <td class="dim perm-desc stack-block" data-label="Permissions">
              <div v-if="!isBuiltinRole(r) && !r.base_tier" class="set-base-tier">
                <span>No base tier yet - not assignable.</span>
                <select :value="pendingBaseTier[r.id] ?? ''" class="select-sm" aria-label="`Base tier for ${r.role_name}`" @change="pendingBaseTier[r.id] = ($event.target as HTMLSelectElement).value">
                  <option value="" disabled>Base tier…</option>
                  <option v-for="t in CUSTOM_ROLE_BASE_TIERS" :key="t" :value="t">{{ t }}</option>
                </select>
                <button class="btn btn-sm" :disabled="!pendingBaseTier[r.id] || settingBaseTierId === r.id" @click="setBaseTier(r)">
                  {{ settingBaseTierId === r.id ? 'Setting…' : 'Set' }}
                </button>
              </div>
              <template v-else>{{ rolePermDesc(r) }}</template>
            </td>
            <td :class="isBuiltinRole(r) ? 'role-lock' : 'stack-actions'">
              <button
                v-if="!isBuiltinRole(r)"
                class="btn btn-sm btn-tone-danger"
                :disabled="deletingRoleId === r.id"
                @click="confirmDeleteRole(r)"
              >Delete</button>
              <span v-else class="lock-icon" title="Built-in roles cannot be deleted">🔒</span>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td :colspan="unscoped ? 6 : 5" class="empty-row">{{ loading ? 'Loading roles…' : 'No roles found.' }}</td></tr>
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
        @keyup.enter="canCreateRole && createRole()"
      />
      <select v-if="unscoped" v-model="newRoleAgencyId" class="select-sm" aria-label="Agency">
        <option value="" disabled>Agency…</option>
        <option v-for="a in agencies" :key="a.id" :value="a.id">{{ a.agency_code }} - {{ a.agency_name }}</option>
      </select>
      <span v-else class="dim" style="font-size:12px">for {{ ownAgencyCode }}</span>
      <button class="btn" :disabled="!canCreateRole" @click="createRole">
        {{ creatingRole ? 'Creating…' : '+ Add Role' }}
      </button>
    </div>
  </div>

  <!-- Departments -->
  <div v-show="orgTab === 'departments'" id="panel-departments" role="tabpanel" aria-labelledby="tab-departments" class="card">
    <div class="card-body">
      <table class="compact-table stack-table">
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
            <td class="stack-title" style="font-weight:600">{{ d.department_name }}</td>
            <td class="mono-sm" data-label="Code">{{ d.department_code }}</td>
            <td data-label="Agency"><BadgePill variant="neutral">{{ d.agency_code ?? d.agency }}</BadgePill></td>
            <td class="dim" data-label="Parent" style="font-size:12px">{{ d.parent_department ?? '-' }}</td>
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
    <div class="card-footer add-role-footer">
      <input
        v-model="newDeptName"
        class="select-sm"
        placeholder="New department name…"
        aria-label="New department name"
        style="flex:1;min-width:160px"
        @keyup.enter="canCreateDept && createDepartment()"
      />
      <input
        v-model="newDeptCode"
        class="select-sm mono-sm"
        placeholder="Code (e.g. ENG)"
        aria-label="New department code"
        style="width:120px"
        @keyup.enter="canCreateDept && createDepartment()"
      />
      <select v-if="unscoped" v-model="newDeptAgencyId" class="select-sm" aria-label="Agency">
        <option value="" disabled>Agency…</option>
        <option v-for="a in agencies" :key="a.id" :value="a.id">{{ a.agency_code }} - {{ a.agency_name }}</option>
      </select>
      <span v-else class="dim" style="font-size:12px">for {{ ownAgencyCode }}</span>
      <button class="btn" :disabled="!canCreateDept" @click="createDepartment">
        {{ creatingDept ? 'Creating…' : '+ Add Department' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useRoles as _useRoles, useDepartments as _useDepartments, useUsers as _useUsers, useAgencies as _useAgencies } from '~/composables/api'
import type { Role, Department, User, Agency } from '~/types/uapts'
import {
  isUnscopedAdmin, scopedAgencyCode, agencyListQueryFor, canManageUser,
  canChangeRole, assignableRoleTypes, canViewRole, ROLE_TYPES,
} from '~/composables/useAgencyScope'
import { roleBadgeVariant, roleSummary } from '~/utils/accessLabels'

// ── Agency scoping ───────────────────────────────────────────────────────
// Same gap /users.vue already closed: an agency admin manages only their
// own tenant's users/departments here too (this page's Users table and
// Departments tab are the same underlying data, just presented
// differently) - super_admin is still the only tier that sees/manages
// every agency. Client-side convenience only, same as every other RBAC
// check in this app - the backend list() calls are the real gate via
// agencyListQueryFor()'s `agency` filter.
const { user: viewer } = useAuth()
// Editing, (de)activating and deleting accounts also needs the `manage_users` capability (Module Access).
const { canManageUsers } = usePermissions()
const MANAGE_USERS_OFF = 'Managing users is switched off for your role in this agency.'
const viewerScope  = computed(() => viewer.value as any)
const unscoped     = computed(() => isUnscopedAdmin(viewerScope.value))
const ownAgencyCode = computed(() => scopedAgencyCode(viewerScope.value))

// ── State ──────────────────────────────────────────────────────────────

const roles       = ref<Role[]>([])
const users       = ref<User[]>([])
const departments = ref<Department[]>([])
/** Full agency list, for super_admin's "which agency owns this role" picker only - not fetched (or needed) for a scoped viewer. */
const agencies    = ref<Agency[]>([])
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
// roleSelection is either a built-in role_type ('admin', ...) or a custom
// Role's id - saveEdit() below resolves it back to role_type + role.
const editForm  = reactive({ roleSelection: 'public' as string, is_active: true, is_staff: false })

const newRoleName    = ref('')
const newRoleAgencyId = ref('')
// A custom role can be based on any built-in tier except super_admin (already
// bypasses everything - a "custom" sub-role adds nothing) and public (the
// resolver hard-denies it unconditionally - see the Role model's docstring
// on the backend, apps/accounts/models.py). Derived from ROLE_TYPES, not a
// separately maintained list.
const CUSTOM_ROLE_BASE_TIERS = ROLE_TYPES.filter(t => t !== 'super_admin' && t !== 'public')
// A role is always created without a base tier - it's set afterward via the
// inline "Set" control below (setBaseTier), keeping the creation form to
// just a name (and agency, for a super_admin). Not assignable to a user
// until it has one.
const canCreateRole = computed(() =>
  !!newRoleName.value.trim() && (!unscoped.value || !!newRoleAgencyId.value) && !creatingRole.value,
)
const creatingRole   = ref(false)
const deletingRoleId = ref<string | null>(null)

const newDeptName     = ref('')
const newDeptCode     = ref('')
const newDeptAgencyId = ref('')
const canCreateDept = computed(() =>
  !!newDeptName.value.trim() && !!newDeptCode.value.trim() && (!unscoped.value || !!newDeptAgencyId.value) && !creatingDept.value,
)
const creatingDept = ref(false)

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

  const [rRes, uRes, dRes, aRes] = await Promise.allSettled([
    _useRoles().list({ page_size: 100 }),
    _useUsers().list({
      page_size: 100,
      search:    search.value    || undefined,
      role_type: roleFilter.value || undefined,
      is_active: activeFilter.value ? activeFilter.value === 'true' : undefined,
      ...agencyListQueryFor(viewerScope.value),
    }),
    _useDepartments().list({ page_size: 100, ...agencyListQueryFor(viewerScope.value) }),
    unscoped.value ? _useAgencies().list({ page_size: 200 }) : Promise.resolve(null),
  ])

  if (rRes.status === 'fulfilled') roles.value       = (rRes.value as any).results ?? rRes.value ?? []
  if (uRes.status === 'fulfilled') {
    users.value = (uRes.value as any).results ?? uRes.value ?? []
    hasMore.value = !!((uRes.value as any).next)
  }
  if (dRes.status === 'fulfilled') departments.value = (dRes.value as any).results ?? dRes.value ?? []
  if (aRes.status === 'fulfilled' && aRes.value) agencies.value = (aRes.value as any).results ?? aRes.value ?? []

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
    // Matches either the built-in tier (role_type) or a specific custom role's own name (role_name).
    if (roleFilter.value && u.role_type !== roleFilter.value && u.role_name !== roleFilter.value) return false
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

/** The catalog omits super_admin for anyone who isn't one - they shouldn't even see it exists. */
const visibleRoles = computed(() => roles.value.filter(r => canViewRole(viewerScope.value, r.role_name)))

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: userTablePageRows, page: userTablePage, totalPages: userTableTotalPages,
  total: userTableTotal, next: userTableNext, prev: userTablePrev,
} = usePagination(filteredUsers, 15)

const {
  pageRows: rolesPageRows, page: rolesPage, totalPages: rolesTotalPages,
  total: rolesTotal, next: rolesNext, prev: rolesPrev,
} = usePagination(visibleRoles, 15)

const {
  pageRows: departmentsPageRows, page: departmentsPage, totalPages: departmentsTotalPages,
  total: departmentsTotal, next: departmentsNext, prev: departmentsPrev,
} = usePagination(departments, 15)

function byRoleType(rt: string) { return users.value.filter(u => u.role_type === rt).length }
function userCountForRole(name: string) {
  return users.value.filter(u => u.role_name === name || u.role_type === name).length
}
/** Not a per-agency custom role - either one of the 5 base tiers, or a platform-level one (ministry_admin, auditor, ...) neither agency admins nor super_admin manage from here. */
function isBuiltinRole(r: Role) { return r.agency == null }

// ── Metric strip ─────────────────────────────────────────────────────────

const metricsUnavailable = computed(() => loading.value || usersError.value)
// One tile per assignable built-in tier (CUSTOM_ROLE_BASE_TIERS, not a
// separate hardcoded set) - counts every account on that tier OR on a
// custom role based on it, since role_type is always the base tier
// (see the Role model's docstring on the backend).
const metrics = computed(() => [
  { label: 'Total Users',  value: users.value.length,                                    sub: 'Platform accounts' },
  { label: 'Active',       value: users.value.filter(u => u.is_active !== false).length,  sub: 'Enabled accounts' },
  ...CUSTOM_ROLE_BASE_TIERS.map(t => ({
    label: `${t.charAt(0).toUpperCase()}${t.slice(1)}s`, value: byRoleType(t), sub: 'Incl. custom roles based on it',
  })),
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
  nextTick(() => {
    const pop = menuPopRef.value
    if (!pop) return
    // Rows near the bottom of a short (phone) viewport would clip the menu -
    // measure it once rendered and open upward instead when there's no room below.
    const h = pop.offsetHeight
    if (rect.bottom + 4 + h > window.innerHeight - 8 && rect.top - 4 - h > 8) {
      menuPos.value = { ...menuPos.value, top: `${rect.top - 4 - h}px` }
    }
    pop.querySelector<HTMLElement>('.row-menu-item')?.focus()
  })
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

/** `u`'s current custom role, if `role_name` doesn't just mirror `role_type` (see User.save() on the backend). */
function customRoleOf(u: Pick<User, 'role' | 'role_name' | 'role_type'>): Role | null {
  return u.role && u.role_name && u.role_name !== u.role_type
    ? (roles.value.find(r => r.id === u.role) ?? null)
    : null
}

function startEdit(u: User) {
  if (!canManageUsers.value) { actionError.value = MANAGE_USERS_OFF; return }
  closeMenu()
  editingId.value        = u.id
  editForm.roleSelection = customRoleOf(u)?.id ?? u.role_type
  editForm.is_active     = u.is_active !== false
  editForm.is_staff      = u.is_staff ?? false
  actionError.value      = null
  actionSuccess.value    = null
}

function cancelEdit() { editingId.value = null }

/** Built-in role_types the viewer may pick for `u` - super_admin is only offered to (and only changeable by) a super_admin. */
function roleOptionsFor(u: User) { return assignableRoleTypes(viewerScope.value, u.role_type) }
/** Custom roles the viewer may pick for `u` - always its own agency's, never another's. */
function customRoleOptionsFor(u: User) { return roles.value.filter(r => r.base_tier && r.agency_code === u.agency_code) }

async function saveEdit(u: User) {
  if (!canManageUsers.value) { actionError.value = MANAGE_USERS_OFF; return }
  if (!canManageUser(viewerScope.value, u)) { actionError.value = 'You can only manage accounts in your own agency.'; return }
  const customRole = roles.value.find(r => r.id === editForm.roleSelection && r.base_tier) ?? null
  const roleType = (customRole ? customRole.base_tier : editForm.roleSelection) as User['role_type']
  // The dropdown already hides this, but the row's form state is plain data - re-check before it reaches the API.
  if (!canChangeRole(viewerScope.value, u.role_type, roleType)) {
    actionError.value = 'Only a super_admin can grant, revoke or change the super_admin role.'
    return
  }
  savingId.value = u.id
  actionError.value = null
  try {
    const updated = await _useUsers().update(u.id, {
      role_type: roleType,
      // Explicit even when null: reverting to a plain tier must clear a
      // previous custom-role assignment, not leave it looking still-valid
      // because its base_tier happens to match the new role_type.
      role: customRole?.id ?? null,
      is_active: editForm.is_active,
      is_staff:  editForm.is_staff,
    }) as User
    const idx = users.value.findIndex(x => x.id === u.id)
    if (idx !== -1) users.value[idx] = { ...users.value[idx], ...updated }
    editingId.value = null
    flash(`${u.email} updated - role: ${customRole ? customRole.role_name : roleType}.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.message ?? 'Failed to update user.'
  } finally {
    savingId.value = null
  }
}

async function toggleActive(u: User) {
  if (!canManageUsers.value) { actionError.value = MANAGE_USERS_OFF; return }
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
  if (!canManageUsers.value) { actionError.value = MANAGE_USERS_OFF; return }
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
  if (!canCreateRole.value || !name) return
  creatingRole.value = true
  actionError.value  = null
  try {
    // agency is only meaningful from a super_admin - an agency admin's own
    // agency is filled in server-side regardless of what's sent, so it's
    // simplest to just always send what we have (undefined when scoped).
    const role = await _useRoles().create({
      role_name: name,
      agency: unscoped.value ? newRoleAgencyId.value : undefined,
    }) as Role
    roles.value.push(role)
    newRoleName.value = ''
    newRoleAgencyId.value = ''
    flash(`Role "${name}" created${role.agency_code ? ` for ${role.agency_code}` : ''}.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.message ?? 'Failed to create role.'
  } finally {
    creatingRole.value = false
  }
}

async function createDepartment() {
  const name = newDeptName.value.trim()
  const code = newDeptCode.value.trim()
  if (!canCreateDept.value || !name || !code) return
  creatingDept.value = true
  actionError.value  = null
  try {
    // Same pattern as createRole() - agency is only meaningful from a
    // super_admin, an agency admin's own agency is filled in server-side.
    const dept = await _useDepartments().create({
      department_name: name,
      department_code: code,
      agency: unscoped.value ? newDeptAgencyId.value : undefined,
    }) as Department
    departments.value.push(dept)
    newDeptName.value = ''
    newDeptCode.value = ''
    newDeptAgencyId.value = ''
    flash(`Department "${name}" created${dept.agency_code ? ` for ${dept.agency_code}` : ''}.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.data?.department_code?.[0] ?? err?.message ?? 'Failed to create department.'
  } finally {
    creatingDept.value = false
  }
}

// ── Setting a base tier after the fact (role was created without one) ──
const pendingBaseTier = reactive<Record<string, string>>({})
const settingBaseTierId = ref<string | null>(null)
async function setBaseTier(r: Role) {
  const baseTier = pendingBaseTier[r.id]
  if (!baseTier) return
  settingBaseTierId.value = r.id
  actionError.value = null
  try {
    const updated = await _useRoles().update(r.id, { base_tier: baseTier as Role['base_tier'] }) as Role
    const idx = roles.value.findIndex(x => x.id === r.id)
    if (idx !== -1) roles.value[idx] = { ...roles.value[idx], ...updated }
    delete pendingBaseTier[r.id]
    flash(`"${r.role_name}" is now based on ${baseTier} - it can be assigned to users.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.message ?? 'Failed to set the base tier.'
  } finally {
    settingBaseTierId.value = null
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

const rolePermDesc = roleSummary
const roleBadge = roleBadgeVariant

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

/* Filters */
.filter-bar   { padding:8px 12px; margin-bottom:10px; }
.result-count { font-size:12px; color:var(--fg-2); white-space:nowrap; }
.mini-pager   { display:flex; align-items:center; gap:8px; flex-shrink:0; margin-left:auto; }
/* Desktop widths only - on phones .filter-bar--grid (theme.css) owns the layout. */
@media (min-width:769px) {
  .filter-input { flex:1 1 220px; min-width:220px; }
}
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
  display:flex; flex-wrap:wrap; align-items:center; gap:0 18px;
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
.set-base-tier { display:flex; flex-wrap:wrap; align-items:center; gap:6px; }
.set-base-tier span { color:var(--warning-fg); white-space:nowrap; }
.set-base-tier select { height:26px; font-size:11px; }
.lock-icon { font-size:12px; color:var(--fg-3); opacity:.8; cursor:default; }
.mono-sm   { font-family:var(--font-mono); font-size:11.5px; font-variant-numeric:tabular-nums; }

.add-role-footer { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
@media (max-width:480px) {
  .add-role-footer input { min-height:40px; font-size:16px; }
  .add-role-footer .btn  { min-height:40px; }
}

/* Empty states */
.empty-row { text-align:center; color:var(--fg-3); font-size:13px; padding:24px; }

/* Mobile - the stacked-card layout itself is .stack-table (theme.css). The
   MFA/Staff columns are hidden on tablet above, so bring them back for cards. */
@media (max-width:768px) {
  .users-table td:nth-child(5), .users-table td:nth-child(6) { display:flex; }
  /* Row-state tints live on the <tr>; the shared card background outranks the
     plain class rules above, so restate them at card specificity. */
  .users-table > tbody > tr.row-editing  { background:var(--warning-bg); }
  .users-table > tbody > tr.row-inactive { background:var(--surface-1); }
  .email-cell { max-width:calc(100% - 22px); }
  .select-inline { min-height:36px; font-size:16px; }
  .toggle-label  { min-height:36px; }
  .action-group  { gap:8px; }
  .row-menu-item { padding:11px 12px; font-size:14px; }
  .perm-desc     { max-width:none; width:auto; font-size:12px; }
  .compact-table > tbody > tr > td.role-lock { display:none; } /* built-in roles: the badge already says so */
}
</style>
