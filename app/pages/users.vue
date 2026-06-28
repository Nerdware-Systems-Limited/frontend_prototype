<template>
  <PageHeader
    eyebrow="User Management"
    title="Users"
    subtitle="Platform account directory - create accounts, manage status, and view profiles across all UAPTS agencies"
  >
    <template #actions>
      <NuxtLink to="/roles" class="btn">Roles & Permissions →</NuxtLink>
      <button class="btn-primary" @click="openCreate">+ Create User</button>
    </template>
  </PageHeader>

  <div v-if="error"          class="error-banner">⚠ {{ error }}</div>
  <div v-if="actionError"    class="error-banner action-error">⚠ {{ actionError }}</div>
  <div v-if="actionSuccess"  class="success-banner">✓ {{ actionSuccess }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Total Accounts"   :value="String(users.length)"                                    sub="All platform users"         source="live" source-title="UAPTS" />
    <KpiCard label="Active"           :value="String(activeCount)"                                     sub="Login enabled"               trend-direction="up" source="live" source-title="UAPTS" />
    <KpiCard label="Inactive"         :value="String(users.length - activeCount)"                      sub="Login disabled"              :trend-direction="(users.length - activeCount) === 0 ? 'up' : 'down'" source="live" source-title="UAPTS" />
    <KpiCard label="MFA Enrolled"     :value="mfaCount + ' / ' + users.length"                        sub="2FA set up"                  trend-direction="up" source="live" source-title="UAPTS" />
    <KpiCard label="No MFA"           :value="String(users.length - mfaCount)"                        sub="2FA not configured"          :trend-direction="(users.length - mfaCount) === 0 ? 'up' : 'down'" source="live" source-title="UAPTS" />
    <KpiCard label="Staff / Admin"    :value="String(users.filter(u => u.is_staff).length)"           sub="Django admin access"         source="live" source-title="UAPTS" />
  </div>

  <!-- Agency breakdown -->
  <SectionTitle>Users by Agency</SectionTitle>
  <div class="agency-strip">
    <div
      v-for="ag in agencyStats"
      :key="ag.code"
      class="agency-chip"
      :class="{ 'agency-chip--active': agencyFilter === ag.code }"
      @click="agencyFilter = agencyFilter === ag.code ? '' : ag.code"
    >
      <span class="agency-chip-code">{{ ag.code }}</span>
      <span class="agency-chip-count">{{ ag.total }}</span>
      <span class="agency-chip-active">{{ ag.active }} active</span>
    </div>
    <div v-if="!agencyStats.length" class="dim" style="font-size:12px;padding:8px 0">{{ loading ? 'Loading…' : 'No agency data.' }}</div>
  </div>

  <!-- Filters -->
  <div class="filter-bar">
    <input
      v-model="search"
      class="select-sm"
      placeholder="Search email…"
      style="min-width:200px"
      @keyup.enter="applyFilters"
    />
    <select v-model="agencyFilter" class="select-sm">
      <option value="">All agencies</option>
      <option v-for="a in agencies" :key="a.id" :value="a.agency_code">{{ a.agency_code }} - {{ a.agency_name }}</option>
    </select>
    <select v-model="roleFilter" class="select-sm">
      <option value="">All roles</option>
      <option value="admin">Admin</option>
      <option value="analyst">Analyst</option>
      <option value="operator">Operator</option>
      <option value="public">Public</option>
    </select>
    <select v-model="activeFilter" class="select-sm">
      <option value="">All statuses</option>
      <option value="true">Active only</option>
      <option value="false">Inactive only</option>
    </select>
    <select v-model="mfaFilter" class="select-sm">
      <option value="">All MFA</option>
      <option value="true">MFA enrolled</option>
      <option value="false">No MFA</option>
    </select>
    <button class="btn" @click="applyFilters">Apply</button>
    <button class="btn" @click="resetFilters">Reset</button>
    <span style="flex:1" />
    <span class="result-count">{{ filteredUsers.length }} of {{ users.length }}</span>
  </div>

  <!-- User directory table -->
  <SectionTitle>Account Directory</SectionTitle>
  <div class="card">
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
            <th>Last Login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody v-if="filteredUsers.length">
          <template v-for="u in filteredUsers" :key="u.id">

            <!-- Main row -->
            <tr
              :class="{ 'row-inactive': u.is_active === false, 'row-expanded': expanded === u.id }"
              @click="expanded = expanded === u.id ? null : u.id"
              style="cursor:pointer"
            >
              <td class="expand-cell">
                <span class="expand-icon">{{ expanded === u.id ? '▾' : '▸' }}</span>
              </td>
              <td>
                <span class="email-cell">{{ u.email }}</span>
                <span v-if="u.is_staff" class="staff-pip" title="Has Django admin / staff access">★</span>
              </td>
              <td>
                <BadgePill v-if="u.agency_code" variant="neutral">{{ u.agency_code }}</BadgePill>
                <span v-else class="dim">-</span>
              </td>
              <td>
                <BadgePill :variant="roleBadge(u.role_type)">{{ u.role_type }}</BadgePill>
              </td>
              <td>
                <BadgePill :variant="u.is_active !== false ? 'success' : 'danger'">
                  {{ u.is_active !== false ? 'Active' : 'Inactive' }}
                </BadgePill>
              </td>
              <td>
                <BadgePill :variant="u.mfa_active ? 'success' : 'neutral'">
                  {{ u.mfa_active ? '2FA On' : 'No 2FA' }}
                </BadgePill>
              </td>
              <td class="dim date-cell">{{ fmtDate(u.created_at) }}</td>
              <td class="dim date-cell">{{ (u as any).last_login ? fmtDateTime((u as any).last_login) : 'Never' }}</td>
              <td @click.stop>
                <div class="action-group">
                  <button
                    class="btn btn-sm"
                    :class="u.is_active !== false ? 'btn-warn' : 'btn-ok'"
                    :disabled="actionId === u.id"
                    @click="toggleActive(u)"
                  >{{ u.is_active !== false ? 'Deactivate' : 'Activate' }}</button>
                  <button
                    class="btn btn-sm btn-danger"
                    :disabled="actionId === u.id"
                    @click="deleteUser(u)"
                  >Delete</button>
                </div>
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
                      <span class="detail-value">{{ fmtDateTime(u.created_at) }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Last Login</span>
                      <span class="detail-value">{{ (u as any).last_login ? fmtDateTime((u as any).last_login) : 'Never' }}</span>
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

      <div v-if="hasMore" class="load-more">
        <button class="btn" :disabled="loading" @click="loadMore">Load more users…</button>
      </div>
    </div>
  </div>

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
              <option value="public">Public - read only</option>
            </select>
          </div>
          <div class="form-group">
            <label>Agency</label>
            <select v-model="form.agency" class="input-full">
              <option value="">No agency (public user)</option>
              <option v-for="a in agencies" :key="a.id" :value="a.id">
                {{ a.agency_code }} - {{ a.agency_name }}
              </option>
            </select>
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
useNavSubtitle('Users')

import { useUsers as _useUsers, useAgencies as _useAgencies } from '~/composables/api'
import type { User, Agency } from '~/types/uapts'

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

// ── Load ───────────────────────────────────────────────────────────────

async function load() {
  loading.value  = true
  error.value    = null
  expanded.value = null
  currentPage    = 1

  const [uRes, aRes] = await Promise.allSettled([
    _useUsers().list({ page_size: 100, ordering: '-created_at' }),
    _useAgencies().list({ page_size: 100 }),
  ])

  if (uRes.status === 'fulfilled') {
    users.value   = (uRes.value as any).results ?? []
    hasMore.value = !!((uRes.value as any).next)
  }
  if (aRes.status === 'fulfilled') agencies.value = (aRes.value as any).results ?? aRes.value ?? []
  if (uRes.status === 'rejected') error.value = 'Unable to reach the UAPTS Accounts API.'

  loading.value = false
}

async function loadMore() {
  loading.value = true
  currentPage++
  try {
    const res = await _useUsers().list({ page_size: 100, page: currentPage, ordering: '-created_at' })
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
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ───────────────────────────────────────────────────────────

const activeCount = computed(() => users.value.filter(u => u.is_active !== false).length)
const mfaCount    = computed(() => users.value.filter(u => u.mfa_active).length)

const agencyStats = computed(() => {
  const map: Record<string, { code: string; total: number; active: number }> = {}
  for (const u of users.value) {
    const code = u.agency_code
    if (!code) continue
    if (!map[code]) map[code] = { code, total: 0, active: 0 }
    map[code].total++
    if (u.is_active !== false) map[code].active++
  }
  return Object.values(map).sort((a, b) => b.total - a.total)
})

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

// ── Actions ────────────────────────────────────────────────────────────

async function toggleActive(u: User) {
  actionId.value    = u.id
  actionError.value = null
  const activate    = u.is_active === false
  try {
    await _useUsers().update(u.id, { is_active: activate })
    const idx = users.value.findIndex(x => x.id === u.id)
    if (idx !== -1) users.value[idx] = { ...users.value[idx], is_active: activate }
    flash(`${u.email} ${activate ? 'activated' : 'deactivated'}.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail ?? err?.message ?? 'Failed to update account status.'
  } finally { actionId.value = null }
}

async function deleteUser(u: User) {
  if (!window.confirm(`Permanently delete account "${u.email}"?\n\nThis cannot be undone. Audit log entries will be preserved.`)) return
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

// ── Create user ────────────────────────────────────────────────────────

function openCreate() {
  form.value = { email: '', role_type: 'analyst', agency: '', department: '', is_active: true, is_staff: false }
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
    flash(`Account ${created.email} created.`)
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
  const m: Record<string, string> = { admin: 'danger', analyst: 'info', operator: 'fair', public: 'neutral' }
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
</script>

<style scoped>
/* Banners */
.error-banner   { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.action-error   { background:#fee2e2; border-color:#f87171; color:#b91c1c; }
.success-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#f0fdf4; border:1px solid #86efac; font-size:13px; color:#15803d; }

/* KPIs */
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(145px,1fr)); gap:12px; margin-bottom:16px; }

/* Agency strip */
.agency-strip {
  display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px;
  padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;
}
.agency-chip {
  display:flex; flex-direction:column; align-items:center;
  background:#fff; border:2px solid #e2e8f0; border-radius:8px;
  padding:8px 14px; cursor:pointer; transition:border-color .15s;
  min-width:80px; user-select:none;
}
.agency-chip:hover { border-color:#94a3b8; }
.agency-chip--active { border-color:#3b82f6; background:#eff6ff; }
.agency-chip-code   { font-weight:700; font-size:13px; color:#1e293b; }
.agency-chip-count  { font-size:20px; font-weight:800; color:#0f172a; line-height:1.1; }
.agency-chip-active { font-size:10px; color:#64748b; white-space:nowrap; }

/* Filters */
.filter-bar  { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
.result-count { font-size:12px; color:#64748b; }

/* Table */
.users-table { width:100%; }
.expand-cell { width:24px; text-align:center; padding:0 4px; }
.expand-icon { font-size:11px; color:#94a3b8; }
.row-inactive { opacity:.55; }
.row-expanded > td { background:#f8fafc; }
.email-cell  { font-size:13px; font-weight:500; color:#0f172a; }
.staff-pip   { margin-left:5px; font-size:11px; color:#b45309; }
.date-cell   { font-size:12px; white-space:nowrap; }
.dim         { color:#94a3b8; }

/* Action buttons */
.action-group  { display:flex; gap:4px; flex-wrap:wrap; }
.btn-sm        { font-size:12px !important; padding:3px 8px !important; }
.btn-warn      { color:#b45309; }
.btn-ok        { color:#15803d; }
.btn-danger    { color:#dc2626; }

/* Expanded detail panel */
.detail-row > td { padding:0; }
.detail-panel {
  padding:16px 20px;
  background:#f8fafc;
  border-left:3px solid #3b82f6;
  border-bottom:1px solid #e2e8f0;
}
.detail-grid {
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(240px,1fr));
  gap:10px 24px;
  margin-bottom:12px;
}
.detail-item   { display:flex; flex-direction:column; gap:2px; }
.detail-label  { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; }
.detail-value  { font-size:12px; color:#1e293b; word-break:break-all; }
.detail-value.mono { font-family:monospace; font-size:11px; color:#475569; }
.detail-footer { border-top:1px solid #e2e8f0; padding-top:10px; display:flex; gap:8px; }

/* Load more */
.load-more { text-align:center; padding:12px 0 4px; }

/* Modal */
.modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.5); z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; }
.modal { background:#fff; border-radius:12px; width:480px; max-width:100%; box-shadow:0 24px 64px rgba(0,0,0,.22); display:flex; flex-direction:column; }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; font-weight:600; font-size:15px; border-bottom:1px solid #f1f5f9; }
.modal-close  { background:none; border:none; font-size:22px; cursor:pointer; color:#94a3b8; line-height:1; padding:0 4px; }
.modal-close:hover { color:#475569; }
.modal-body   { padding:20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; max-height:70vh; }
.modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:14px 20px; border-top:1px solid #f1f5f9; }

/* Form elements */
.form-group { display:flex; flex-direction:column; gap:4px; }
.form-group label { font-size:12px; font-weight:600; color:#374151; }
.form-row   { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.input-full { width:100%; padding:7px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; background:#fff; box-sizing:border-box; }
.input-full:focus { outline:none; border-color:#3b82f6; box-shadow:0 0 0 2px #dbeafe; }
.input-error { border-color:#f87171; }
.field-error { font-size:11px; color:#dc2626; margin-top:2px; }
.hint       { font-weight:400; color:#94a3b8; }
.required   { color:#dc2626; }
.form-check-row { display:flex; flex-wrap:wrap; gap:16px; }
.check-label { display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; user-select:none; }
.api-error  { font-size:12px; color:#dc2626; padding:8px 12px; background:#fee2e2; border-radius:6px; border:1px solid #fca5a5; }

/* Empty */
.empty-row { text-align:center; color:#94a3b8; font-size:13px; padding:28px; }
</style>
