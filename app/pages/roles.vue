<template>
  <PageHeader
    eyebrow="Access Control"
    title="Roles & Permissions"
    subtitle="RBAC role assignments, user status management, and organisational departments across UAPTS agencies"
  >
    <template #actions>
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
      <NuxtLink to="/users" class="btn-primary">Users →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error"         class="error-banner">⚠ {{ error }}</div>
  <div v-if="actionError"   class="error-banner action-error">⚠ {{ actionError }}</div>
  <div v-if="actionSuccess" class="success-banner">✓ {{ actionSuccess }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Total Users"    :value="String(users.length)"                              sub="Platform accounts"   source="live" source-title="UAPTS" />
    <KpiCard label="Admins"         :value="String(byRoleType('admin'))"                       sub="Full access"         source="live" source-title="UAPTS" />
    <KpiCard label="Analysts"       :value="String(byRoleType('analyst'))"                     sub="Read + report"       source="live" source-title="UAPTS" />
    <KpiCard label="Operators"      :value="String(byRoleType('operator'))"                    sub="Operational access"  source="live" source-title="UAPTS" />
    <KpiCard label="Active"         :value="String(users.filter(u => u.is_active !== false).length)" sub="Enabled accounts" trend-direction="up" source="live" source-title="UAPTS" />
    <KpiCard label="MFA Enrolled"   :value="String(users.filter(u => u.mfa_active).length)"   sub="2FA active"          source="live" source-title="UAPTS" />
  </div>

  <!-- Role overview cards - click to filter the table -->
  <div class="role-cards">
    <div
      v-for="r in ROLE_DEFS"
      :key="r.key"
      class="role-card"
      :class="{ 'role-card--active': roleFilter === r.key }"
      @click="toggleRoleFilter(r.key)"
    >
      <div class="role-card-count">{{ byRoleType(r.key) }}</div>
      <div class="role-card-label"><BadgePill :variant="roleBadge(r.key)">{{ r.key }}</BadgePill></div>
      <div class="role-card-desc">{{ r.short }}</div>
    </div>
  </div>

  <!-- Filter bar -->
  <div class="filter-bar">
    <input
      v-model="search"
      class="select-sm"
      placeholder="Search by email…"
      style="min-width:200px"
      @keyup.enter="applyFilters"
    />
    <select v-model="roleFilter" class="select-sm">
      <option value="">All roles</option>
      <option value="admin">admin</option>
      <option value="analyst">analyst</option>
      <option value="operator">operator</option>
      <option value="public">public</option>
    </select>
    <select v-model="agencyFilter" class="select-sm">
      <option value="">All agencies</option>
      <option v-for="code in agencyCodes" :key="code" :value="code">{{ code }}</option>
    </select>
    <select v-model="activeFilter" class="select-sm">
      <option value="">All statuses</option>
      <option value="true">Active only</option>
      <option value="false">Inactive only</option>
    </select>
    <button class="btn" @click="applyFilters">Apply</button>
    <button class="btn" @click="resetFilters">Reset</button>
    <span style="flex:1" />
    <span class="result-count">{{ filteredUsers.length }} users</span>
  </div>

  <!-- Users table -->
  <SectionTitle>
    Users
    <template v-if="roleFilter"> - <em>{{ roleFilter }}</em></template>
  </SectionTitle>

  <div class="card" style="margin-bottom:20px">
    <div class="card-body">
      <table class="users-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Agency</th>
            <th>Role Type</th>
            <th>Active</th>
            <th>MFA</th>
            <th>Staff</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody v-if="filteredUsers.length">
          <template v-for="u in filteredUsers" :key="u.id">

            <!-- ── Normal row ── -->
            <tr v-if="editingId !== u.id" :class="{ 'row-inactive': u.is_active === false }">
              <td>
                <span class="email-cell">{{ u.email }}</span>
                <span v-if="u.is_staff" class="staff-pip" title="Django admin / staff access">★</span>
              </td>
              <td>
                <BadgePill v-if="u.agency_code" variant="neutral">{{ u.agency_code }}</BadgePill>
                <span v-else class="dim">-</span>
              </td>
              <td>
                <BadgePill :variant="roleBadge(u.role_type)">{{ u.role_type }}</BadgePill>
                <span v-if="u.role_name && u.role_name !== u.role_type" class="role-sub">{{ u.role_name }}</span>
              </td>
              <td>
                <BadgePill :variant="u.is_active !== false ? 'success' : 'danger'">
                  {{ u.is_active !== false ? 'Active' : 'Inactive' }}
                </BadgePill>
              </td>
              <td>
                <BadgePill :variant="u.mfa_active ? 'success' : 'neutral'">{{ u.mfa_active ? 'On' : 'Off' }}</BadgePill>
              </td>
              <td>
                <BadgePill :variant="u.is_staff ? 'warning' : 'neutral'">{{ u.is_staff ? 'Staff' : 'No' }}</BadgePill>
              </td>
              <td class="dim date-cell">{{ fmtDate(u.created_at) }}</td>
              <td>
                <div class="action-group">
                  <button class="btn btn-sm" @click="startEdit(u)">Edit</button>
                  <button
                    class="btn btn-sm"
                    :class="u.is_active !== false ? 'btn-warn' : 'btn-ok'"
                    :disabled="savingId === u.id"
                    @click="toggleActive(u)"
                  >{{ u.is_active !== false ? 'Deactivate' : 'Activate' }}</button>
                  <button
                    class="btn btn-sm btn-danger"
                    :disabled="savingId === u.id"
                    @click="deleteUser(u)"
                  >Delete</button>
                </div>
              </td>
            </tr>

            <!-- ── Editing row ── -->
            <tr v-else class="row-editing">
              <td>
                <span class="email-cell">{{ u.email }}</span>
              </td>
              <td>
                <BadgePill v-if="u.agency_code" variant="neutral">{{ u.agency_code }}</BadgePill>
                <span v-else class="dim">-</span>
              </td>
              <td>
                <select v-model="editForm.role_type" class="select-inline">
                  <option value="admin">admin</option>
                  <option value="analyst">analyst</option>
                  <option value="operator">operator</option>
                  <option value="public">public</option>
                </select>
              </td>
              <td>
                <label class="toggle-label">
                  <input type="checkbox" v-model="editForm.is_active" />
                  <span>{{ editForm.is_active ? 'Active' : 'Inactive' }}</span>
                </label>
              </td>
              <td>
                <BadgePill :variant="u.mfa_active ? 'success' : 'neutral'">{{ u.mfa_active ? 'On' : 'Off' }}</BadgePill>
              </td>
              <td>
                <label class="toggle-label">
                  <input type="checkbox" v-model="editForm.is_staff" />
                  <span>{{ editForm.is_staff ? 'Staff' : 'No' }}</span>
                </label>
              </td>
              <td class="dim date-cell">{{ fmtDate(u.created_at) }}</td>
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

      <div v-if="hasMore" class="load-more">
        <button class="btn" :disabled="loading" @click="loadMore">Load more…</button>
      </div>
    </div>
  </div>

  <!-- Bottom two-column: Role Catalog + Departments -->
  <div class="two-col">

    <!-- Role Catalog -->
    <div>
      <SectionTitle pill="RBAC">Role Catalog</SectionTitle>
      <div class="card">
        <div class="card-body">
          <table>
            <thead>
              <tr>
                <th>Role Name</th>
                <th style="text-align:center">Users</th>
                <th>Type</th>
                <th>Permissions</th>
                <th></th>
              </tr>
            </thead>
            <tbody v-if="roles.length">
              <tr v-for="r in roles" :key="r.id">
                <td style="font-weight:600">
                  <BadgePill :variant="roleBadge(r.role_name)">{{ r.role_name }}</BadgePill>
                </td>
                <td style="text-align:center;font-weight:700;color:#1e293b">{{ userCountForRole(r.role_name) }}</td>
                <td>
                  <BadgePill v-if="isBuiltinRole(r.role_name)" variant="info"    size="sm">built-in</BadgePill>
                  <BadgePill v-else                             variant="neutral" size="sm">custom</BadgePill>
                </td>
                <td class="dim" style="font-size:11px">{{ rolePermDesc(r.role_name) }}</td>
                <td>
                  <button
                    v-if="!isBuiltinRole(r.role_name)"
                    class="btn btn-sm btn-danger"
                    :disabled="deletingRoleId === r.id"
                    @click="deleteRole(r)"
                  >Delete</button>
                  <span v-else class="lock-icon" title="Built-in roles cannot be deleted">🔒</span>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr><td colspan="5" class="empty-row">{{ loading ? 'Loading roles…' : 'No roles found.' }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add custom role -->
      <div class="add-role-form">
        <input
          v-model="newRoleName"
          class="select-sm"
          placeholder="New custom role name…"
          style="flex:1;min-width:160px"
          @keyup.enter="createRole"
        />
        <button class="btn" :disabled="!newRoleName.trim() || creatingRole" @click="createRole">
          {{ creatingRole ? 'Creating…' : '+ Add Role' }}
        </button>
      </div>

      <!-- Role legend -->
      <div class="role-legend">
        <div v-for="r in ROLE_DEFS" :key="r.key" class="role-legend-item">
          <BadgePill :variant="roleBadge(r.key)">{{ r.key }}</BadgePill>
          <span class="dim">{{ r.description }}</span>
        </div>
      </div>
    </div>

    <!-- Departments -->
    <div>
      <SectionTitle pill="Org Structure">Departments</SectionTitle>
      <div class="card">
        <div class="card-body">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Code</th>
                <th>Agency</th>
                <th>Parent</th>
              </tr>
            </thead>
            <tbody v-if="departments.length">
              <tr v-for="d in departments" :key="d.id">
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
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Roles')

import { useRoles as _useRoles, useDepartments as _useDepartments, useUsers as _useUsers } from '~/composables/api'
import type { Role, Department, User } from '~/types/uapts'

// ── State ──────────────────────────────────────────────────────────────

const roles       = ref<Role[]>([])
const users       = ref<User[]>([])
const departments = ref<Department[]>([])
const loading     = ref(true)
const error       = ref<string | null>(null)
const actionError  = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)
const hasMore     = ref(false)
let   currentPage = 1

const search       = ref('')
const roleFilter   = ref('')
const agencyFilter = ref('')
const activeFilter = ref('')

const editingId = ref<string | null>(null)
const savingId  = ref<string | null>(null)
const editForm  = reactive({ role_type: 'public', is_active: true, is_staff: false })

const newRoleName    = ref('')
const creatingRole   = ref(false)
const deletingRoleId = ref<string | null>(null)

// ── Load ───────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value   = null
  editingId.value = null
  currentPage = 1

  const [rRes, uRes, dRes] = await Promise.allSettled([
    _useRoles().list({ page_size: 100 }),
    _useUsers().list({
      page_size: 100,
      search:    search.value    || undefined,
      role_type: roleFilter.value || undefined,
      is_active: activeFilter.value ? activeFilter.value === 'true' : undefined,
    }),
    _useDepartments().list({ page_size: 100 }),
  ])

  if (rRes.status === 'fulfilled') roles.value       = (rRes.value as any).results ?? rRes.value ?? []
  if (uRes.status === 'fulfilled') {
    users.value = (uRes.value as any).results ?? uRes.value ?? []
    hasMore.value = !!((uRes.value as any).next)
  }
  if (dRes.status === 'fulfilled') departments.value = (dRes.value as any).results ?? dRes.value ?? []

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
    })
    const more = (res as any).results ?? []
    users.value.push(...more)
    hasMore.value = !!((res as any).next)
  } finally { loading.value = false }
}

function applyFilters() { editingId.value = null; load() }
function resetFilters()  { search.value = ''; roleFilter.value = ''; agencyFilter.value = ''; activeFilter.value = ''; load() }

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ───────────────────────────────────────────────────────────

const agencyCodes = computed(() =>
  [...new Set(users.value.map(u => u.agency_code).filter(Boolean))] as string[],
)

const filteredUsers = computed(() =>
  users.value.filter(u => {
    if (roleFilter.value   && u.role_type     !== roleFilter.value)   return false
    if (agencyFilter.value && u.agency_code   !== agencyFilter.value) return false
    if (activeFilter.value) {
      const want = activeFilter.value === 'true'
      if (want !== (u.is_active !== false)) return false
    }
    return true
  }),
)

function byRoleType(rt: string) { return users.value.filter(u => u.role_type === rt).length }
function userCountForRole(name: string) {
  return users.value.filter(u => u.role_name === name || u.role_type === name).length
}
function isBuiltinRole(name: string) { return ['admin', 'analyst', 'operator', 'public'].includes(name) }
function toggleRoleFilter(key: string) { roleFilter.value = roleFilter.value === key ? '' : key }

// ── Row editing ────────────────────────────────────────────────────────

function startEdit(u: User) {
  editingId.value     = u.id
  editForm.role_type  = u.role_type
  editForm.is_active  = u.is_active !== false
  editForm.is_staff   = u.is_staff ?? false
  actionError.value   = null
  actionSuccess.value = null
}

function cancelEdit() { editingId.value = null }

async function saveEdit(u: User) {
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
  savingId.value = u.id
  actionError.value = null
  const newActive = u.is_active === false
  try {
    await _useUsers().update(u.id, { is_active: newActive })
    const idx = users.value.findIndex(x => x.id === u.id)
    if (idx !== -1) users.value[idx] = { ...users.value[idx], is_active: newActive }
    flash(`${u.email} ${newActive ? 'activated' : 'deactivated'}.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.message ?? 'Failed to update user status.'
  } finally {
    savingId.value = null
  }
}

async function deleteUser(u: User) {
  if (!window.confirm(`Delete user "${u.email}"?\n\nThis cannot be undone. Their audit log entries will be preserved.`)) return
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
  if (!window.confirm(`Delete role "${r.role_name}"?\n\nUsers assigned this custom role will retain their role_type but lose the custom role link.`)) return
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

// ── Helpers ────────────────────────────────────────────────────────────

let flashTimeout: ReturnType<typeof setTimeout> | null = null
function flash(msg: string) {
  actionSuccess.value = msg
  if (flashTimeout) clearTimeout(flashTimeout)
  flashTimeout = setTimeout(() => { actionSuccess.value = null }, 4000)
}

const ROLE_DEFS = [
  {
    key: 'admin',
    short: 'Full platform access',
    description: 'Manage users, configure integrations, access all modules and admin console.',
  },
  {
    key: 'analyst',
    short: 'Read + query + reports',
    description: 'Read all data, run ad-hoc queries, generate and download reports.',
  },
  {
    key: 'operator',
    short: 'Operational actions',
    description: 'Update incident status, dispatch resources, trigger feed sync.',
  },
  {
    key: 'public',
    short: 'Read-only summaries',
    description: 'Read-only access to published dashboards and public data.',
  },
]

function rolePermDesc(name: string) {
  return ROLE_DEFS.find(r => r.key === name)?.description ?? 'Custom role - permissions configured server-side.'
}

function roleBadge(r: string) {
  const m: Record<string, string> = { admin: 'danger', analyst: 'info', operator: 'fair', public: 'neutral' }
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
.error-banner    { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.action-error    { background:#fee2e2; border-color:#f87171; color:#b91c1c; }
.success-banner  { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#f0fdf4; border:1px solid #86efac; font-size:13px; color:#15803d; }

/* KPIs */
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:16px; }

/* Role overview cards */
.role-cards { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
@media(max-width:800px) { .role-cards { grid-template-columns:repeat(2,1fr); } }
.role-card {
  background:#fff; border:2px solid #e2e8f0; border-radius:10px;
  padding:16px 12px; cursor:pointer; text-align:center;
  transition:border-color .15s, background .15s; user-select:none;
}
.role-card:hover { border-color:#94a3b8; }
.role-card--active { border-color:#3b82f6; background:#eff6ff; }
.role-card-count { font-size:36px; font-weight:800; color:#1e293b; line-height:1; margin-bottom:6px; }
.role-card-label { margin-bottom:4px; }
.role-card-desc  { font-size:11px; color:#64748b; }

/* Filters */
.filter-bar  { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
.result-count { font-size:12px; color:#64748b; }

/* Users table */
.users-table { width:100%; }
.row-inactive { opacity:.55; background:#fafafa; }
.row-editing  { background:#fffbeb; }
.email-cell   { font-size:13px; font-weight:500; color:#0f172a; }
.staff-pip    { margin-left:5px; font-size:11px; color:#b45309; }
.role-sub     { display:block; font-size:11px; color:#94a3b8; margin-top:2px; }
.date-cell    { font-size:12px; white-space:nowrap; }
.dim          { color:#94a3b8; }

/* Action buttons */
.action-group    { display:flex; gap:4px; flex-wrap:wrap; }
.btn-sm          { font-size:12px !important; padding:3px 8px !important; }
.btn-warn        { color:#b45309; }
.btn-ok          { color:#15803d; }
.btn-danger      { color:#dc2626; }
.btn-primary-sm  { background:#2563eb; color:#fff; border-color:#2563eb; }
.btn-primary-sm:hover { background:#1d4ed8; }

/* Inline edit controls */
.select-inline { padding:4px 8px; border:1px solid #94a3b8; border-radius:4px; font-size:12px; background:#fff; cursor:pointer; }
.toggle-label  { display:flex; align-items:center; gap:5px; font-size:12px; cursor:pointer; white-space:nowrap; }

/* Load more */
.load-more { text-align:center; padding:12px 0 4px; }

/* Role catalog */
.add-role-form  { display:flex; gap:8px; margin-top:10px; align-items:center; }
.role-legend    { display:flex; flex-direction:column; gap:7px; margin-top:14px; padding:12px; background:#f8fafc; border-radius:8px; }
.role-legend-item { display:flex; align-items:baseline; gap:8px; }
.lock-icon      { font-size:14px; cursor:default; }
.mono-sm        { font-family:monospace; font-size:12px; }

/* Bottom two-column */
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
@media(max-width:900px) { .two-col { grid-template-columns:1fr; } }

/* Empty states */
.empty-row { text-align:center; color:#94a3b8; font-size:13px; padding:24px; }
</style>
