<template>
  <PageHeader
    eyebrow="User Management"
    title="Users"
    subtitle="Manage UAPTS platform users - create, activate, deactivate, and assign roles across agencies"
  >
    <template #actions>
      <span class="freshness-badge">{{ totalUsers }} users total</span>
      <button class="btn-primary" @click="showInviteModal = true">+ Create User</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Create user modal -->
  <div v-if="showInviteModal" class="modal-backdrop" @click.self="showInviteModal = false">
    <div class="modal">
      <div class="modal-header">
        Create User
        <button class="modal-close" @click="showInviteModal = false">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Email *</label>
          <input type="email" v-model="inviteForm.email" class="select-full" placeholder="user@agency.go.ke" />
        </div>
        <div class="form-group">
          <label>Full Name</label>
          <input v-model="inviteForm.full_name" class="select-full" placeholder="First Last" />
        </div>
        <div class="form-group">
          <label>Agency</label>
          <select v-model="inviteForm.agency" class="select-full">
            <option value="">Select agency…</option>
            <option v-for="a in agencies" :key="a.id" :value="a.id">{{ a.agency_name }} ({{ a.agency_code }})</option>
          </select>
        </div>
        <div class="form-group">
          <label>Role</label>
          <select v-model="inviteForm.role_type" class="select-full">
            <option value="analyst">Analyst</option>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
            <option value="public">Public</option>
          </select>
        </div>
        <div v-if="inviteError" style="font-size:12px;color:#ef4444">⚠ {{ inviteError }}</div>
      </div>
      <div class="modal-footer">
        <button class="btn" @click="showInviteModal = false">Cancel</button>
        <button class="btn-primary" :disabled="!inviteForm.email || inviting" @click="doInvite">
          {{ inviting ? 'Creating…' : 'Create User' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="filter-bar">
    <input v-model="search" class="select-sm" placeholder="Search email or name…" style="min-width:200px" />
    <select v-model="agencyFilter" class="select-sm">
      <option value="">All agencies</option>
      <option v-for="a in agencies" :key="a.id" :value="a.agency_code">{{ a.agency_code }}</option>
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
      <option value="true">Active</option>
      <option value="false">Inactive</option>
    </select>
    <button class="btn" @click="search=''; agencyFilter=''; roleFilter=''; activeFilter=''">Reset</button>
    <span style="flex:1" />
    <span style="font-size:12px;color:#64748b">{{ filteredUsers.length }} of {{ users.length }} shown</span>
  </div>

  <!-- User table -->
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Full Name</th>
            <th>Agency</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody v-if="filteredUsers.length">
          <tr v-for="u in filteredUsers.slice(0, 100)" :key="u.id" :class="{ inactive: !u.is_active }">
            <td style="font-weight:600;font-size:13px">{{ u.email }}</td>
            <td style="font-size:13px">{{ (u as any).full_name ?? (u as any).name ?? '-' }}</td>
            <td><BadgePill variant="neutral">{{ (u as any).agency_code ?? '-' }}</BadgePill></td>
            <td>
              <BadgePill :variant="roleBadge(u.role_type)">{{ u.role_type }}</BadgePill>
            </td>
            <td>
              <BadgePill :variant="u.is_active ? 'success' : 'neutral'">
                {{ u.is_active ? 'Active' : 'Inactive' }}
              </BadgePill>
            </td>
            <td style="font-size:12px;color:#64748b">{{ (u as any).last_login ? fmtTime((u as any).last_login) : 'Never' }}</td>
            <td>
              <button
                v-if="u.is_active"
                class="btn" style="font-size:12px;color:#dc2626"
                :disabled="actionId === u.id"
                @click="toggleUser(u.id, false)"
              >
                {{ actionId === u.id ? '…' : 'Deactivate' }}
              </button>
              <button
                v-else
                class="btn" style="font-size:12px;color:#16a34a"
                :disabled="actionId === u.id"
                @click="toggleUser(u.id, true)"
              >
                {{ actionId === u.id ? '…' : 'Activate' }}
              </button>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px">{{ loading ? 'Loading users…' : 'No users match the current filters.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Users')

import { useUsers as _useUsers, useAgencies as _useAgencies, useRoles as _useRoles } from '~/composables/api'
import type { User, Agency, Role } from '~/composables/api'

const users   = ref<User[]>([])
const agencies = ref<Agency[]>([])
const roles   = ref<Role[]>([])
const loading = ref(true)
const error   = ref<string | null>(null)

const search       = ref('')
const agencyFilter = ref('')
const roleFilter   = ref('')
const activeFilter = ref('')
const actionId     = ref<string | null>(null)

const showInviteModal = ref(false)
const inviting  = ref(false)
const inviteError = ref<string | null>(null)
const inviteForm = ref({ email: '', full_name: '', agency: '', role_type: 'analyst' })

async function load() {
  loading.value = true
  error.value = null
  const [uRes, aRes, rRes] = await Promise.allSettled([
    _useUsers().list({ page_size: 200 }),
    _useAgencies().list(),
    _useRoles().list(),
  ])

  if (uRes.status === 'fulfilled') users.value    = (uRes.value as any).results ?? []
  if (aRes.status === 'fulfilled') agencies.value = (aRes.value as any).results ?? aRes.value ?? []
  if (rRes.status === 'fulfilled') roles.value    = (rRes.value as any).results ?? rRes.value ?? []

  if (uRes.status === 'rejected') error.value = 'Unable to reach the UAPTS Accounts API.'
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

const totalUsers = computed(() => users.value.length)

const filteredUsers = computed(() =>
  users.value.filter(u => {
    if (search.value) {
      const q = search.value.toLowerCase()
      const name = ((u as any).full_name ?? (u as any).name ?? '').toLowerCase()
      if (!u.email.toLowerCase().includes(q) && !name.includes(q)) return false
    }
    if (agencyFilter.value && (u as any).agency_code !== agencyFilter.value) return false
    if (roleFilter.value   && u.role_type !== roleFilter.value) return false
    if (activeFilter.value !== '') {
      const want = activeFilter.value === 'true'
      if (u.is_active !== want) return false
    }
    return true
  }),
)

async function toggleUser(id: string, activate: boolean) {
  actionId.value = id
  try {
    await _useUsers().update(id, { is_active: activate })
    const idx = users.value.findIndex(u => u.id === id)
    if (idx !== -1) users.value[idx] = { ...users.value[idx], is_active: activate }
  } catch {}
  finally { actionId.value = null }
}

async function doInvite() {
  if (!inviteForm.value.email) return
  inviting.value = true
  inviteError.value = null
  try {
    const created = await _useUsers().create({
      email: inviteForm.value.email,
      full_name: inviteForm.value.full_name || undefined,
      agency: inviteForm.value.agency || undefined,
      role_type: inviteForm.value.role_type as User['role_type'],
    } as any)
    users.value.unshift(created)
    showInviteModal.value = false
    inviteForm.value = { email: '', full_name: '', agency: '', role_type: 'analyst' }
  } catch (e: any) {
    inviteError.value = e?.message ?? 'Create failed.'
  } finally {
    inviting.value = false
  }
}

function roleBadge(r: string) {
  const m: Record<string,string> = { admin:'danger', analyst:'info', operator:'fair', public:'neutral' }
  return m[r] ?? 'neutral'
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f8fafc; color:#475569; border:1px solid #e2e8f0; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.select-full { width:100%; padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.inactive td { color:#94a3b8 !important; }
.modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:1000; display:flex; align-items:center; justify-content:center; }
.modal { background:#fff; border-radius:10px; width:420px; max-width:95vw; box-shadow:0 24px 64px rgba(0,0,0,.2); }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; font-weight:600; font-size:15px; border-bottom:1px solid #f1f5f9; }
.modal-close { background:none; border:none; font-size:20px; cursor:pointer; color:#94a3b8; line-height:1; }
.modal-body { padding:16px 20px; display:flex; flex-direction:column; gap:12px; }
.modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:12px 20px; border-top:1px solid #f1f5f9; }
.form-group { display:flex; flex-direction:column; gap:4px; }
.form-group label { font-size:12px; font-weight:600; color:#374151; }
</style>
