<template>
  <div class="profile-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">My Account</div>
        <h1 class="text-heading">Profile</h1>
      </div>
      <div class="flex gap-2">
        <button v-if="editing" class="btn btn-secondary" @click="cancelEdit">Cancel</button>
        <button class="btn btn-primary" :disabled="isSaving" @click="editing ? saveProfile() : (editing = true)">
          <template v-if="!editing"><Edit2 :size="13" /> Edit profile</template>
          <template v-else-if="isSaving"><span class="spinner-xs" /> Saving…</template>
          <template v-else><Save :size="13" /> Save changes</template>
        </button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="profile-grid">
      <div class="identity-col">
        <div class="card skeleton-card" style="height:340px" />
        <div class="card skeleton-card" style="height:160px" />
      </div>
      <div class="form-col">
        <div class="card skeleton-card" style="height:260px" />
      </div>
    </div>

    <!-- Error banner -->
    <div v-else-if="loadError" class="error-banner">
      <AlertCircle :size="15" />
      <span>{{ loadError }}</span>
      <button class="btn btn-secondary text-xs py-1 px-3" @click="loadProfile">Retry</button>
    </div>

    <div v-else class="profile-grid">
      <!-- Left: Identity card -->
      <div class="identity-col">
        <div class="card">
          <div class="avatar-section">
            <div class="profile-avatar-wrap">
              <div class="profile-avatar">{{ avatarInitials }}</div>
            </div>
          </div>
          <div class="identity-info">
            <div class="text-subhead text-center">{{ displayName }}</div>
            <div class="text-xs text-fg-muted text-center mt-1">{{ form.email }}</div>
            <div class="flex items-center justify-center gap-2 mt-3">
              <span class="badge badge-primary">{{ roleLabel }}</span>
              <span class="badge" :class="userData?.is_active !== false ? 'badge-success' : 'badge-warn'">
                {{ userData?.is_active !== false ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>
          <div class="divider" />
          <div class="identity-meta">
            <div class="meta-item">
              <Building2 :size="13" class="text-fg-dim" />
              <div>
                <div class="text-xs text-fg-dim">Agency</div>
                <div class="text-sm font-medium">{{ userData?.agency_code || 'No agency (public user)' }}</div>
              </div>
            </div>
            <div class="meta-item">
              <GitBranch :size="13" class="text-fg-dim" />
              <div>
                <div class="text-xs text-fg-dim">Department</div>
                <div class="text-sm font-medium font-mono">{{ userData?.department || '-' }}</div>
              </div>
            </div>
            <div class="meta-item">
              <Calendar :size="13" class="text-fg-dim" />
              <div>
                <div class="text-xs text-fg-dim">Joined</div>
                <div class="text-sm font-medium">{{ joinedDate }}</div>
              </div>
            </div>
            <div class="meta-item">
              <Shield :size="13" class="text-fg-dim" />
              <div>
                <div class="text-xs text-fg-dim">Staff access</div>
                <div class="text-sm font-medium">{{ userData?.is_staff ? 'Yes - /admin/ console' : 'No' }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- MFA Status -->
        <div class="card">
          <div class="card-header-sm">
            <Shield :size="14" class="text-primary" />
            <span class="text-sm font-semibold">Security</span>
          </div>
          <div class="security-list">
            <div class="security-row">
              <div>
                <div class="text-sm font-medium">Two-factor auth</div>
                <div class="text-xs text-fg-muted">TOTP via authenticator</div>
              </div>
              <span class="badge" :class="userData?.mfa_active ? 'success' : 'warning'">
                {{ userData?.mfa_active ? 'Enabled' : 'Not enrolled' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Edit form -->
      <div class="form-col">
        <!-- Save error / success toast -->
        <div v-if="saveError" class="error-banner">
          <AlertCircle :size="15" />
          <span>{{ saveError }}</span>
        </div>
        <div v-if="saveSuccess" class="success-banner">
          <CheckCircle :size="15" />
          <span>Profile updated successfully.</span>
        </div>

        <!-- Account Info -->
        <div class="card">
          <div class="form-section-header">
            <User :size="15" class="text-primary" />
            <span class="text-subhead">Account information</span>
          </div>
          <div class="form-grid">
            <div class="col-span-2">
              <label class="input-label">Email address</label>
              <input v-model="form.email" type="email" class="input" :disabled="!editing" />
              <div class="text-xs text-fg-dim mt-1">Used as your login identifier.</div>
            </div>
            <div>
              <label class="input-label">Role</label>
              <input :value="roleLabel" type="text" class="input" disabled />
            </div>
            <div>
              <label class="input-label">Account status</label>
              <input :value="userData?.is_active !== false ? 'Active' : 'Inactive'" type="text" class="input" disabled />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Edit2, Save, Building2, GitBranch, Calendar, Shield,
  User, AlertCircle, CheckCircle
} from 'lucide-vue-next'
import type { AuthUser } from '~/types/uapts'

definePageMeta({ layout: 'default' })

// ── Nuxt / plugin refs ───────────────────────────────────────────────────────
const { $api } = useNuxtApp()

// ── State ────────────────────────────────────────────────────────────────────
// Profile shape mirrors the real backend response: GET/PATCH /api/v1/auth/user/
// is backed by apps.accounts.serializers.user.UserSerializer, which only emits
// id, email, role_type, role, role_name, agency, agency_code, department,
// mfa_active, is_active, is_staff, created_at. There is no first/last name,
// phone, bio, avatar, employee_id, or preferences object on this User model.
const isLoading  = ref(true)
const isSaving   = ref(false)
const loadError  = ref<string | null>(null)
const saveError  = ref<string | null>(null)
const saveSuccess = ref(false)
const editing    = ref(false)
const userData   = ref<AuthUser | null>(null)

const form = reactive({
  email: '',
})

// Snapshot for cancel
let formSnapshot = { ...form }

// ── Computed ─────────────────────────────────────────────────────────────────
// The backend doesn't emit a display name, so derive one from the email
// local-part (same convention used by the auth store's normaliseUser()).
const displayName = computed(() => {
  const email = userData.value?.email ?? ''
  const local = email.split('@')[0] ?? ''
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : (email || 'Unknown user')
})

const avatarInitials = computed(() => {
  const name = displayName.value
  return name.slice(0, 2).toUpperCase() || '??'
})

const roleLabel = computed(() => userData.value?.role_type ?? '-')

const joinedDate = computed(() => {
  const d = userData.value?.created_at
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
})

// ── Helpers ──────────────────────────────────────────────────────────────────
function populateForm(u: AuthUser) {
  form.email = u.email ?? ''
}

// ── Load ─────────────────────────────────────────────────────────────────────
async function loadProfile() {
  isLoading.value = true
  loadError.value = null
  try {
    const u = await $api<AuthUser>('/api/v1/auth/user/')
    userData.value = u
    populateForm(u)
    formSnapshot = { ...form }
  } catch (err: unknown) {
    loadError.value = (err as { data?: { detail?: string } })?.data?.detail
      ?? 'Failed to load profile. Please try again.'
  } finally {
    isLoading.value = false
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function saveProfile() {
  isSaving.value  = true
  saveError.value = null
  saveSuccess.value = false
  try {
    // Only `email` is an editable field on the real UserSerializer.
    const updated = await $api<AuthUser>('/api/v1/auth/user/', {
      method: 'PATCH',
      body: { email: form.email },
    })

    userData.value = updated
    populateForm(updated)
    formSnapshot = { ...form }
    editing.value = false
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 4000)
  } catch (err: unknown) {
    const data = (err as { data?: Record<string, unknown> })?.data
    if (data) {
      // Surface the first field error from DRF
      const firstKey = Object.keys(data)[0] ?? 'error'
      const msg = Array.isArray(data[firstKey]) ? (data[firstKey] as string[])[0] : String(data[firstKey])
      saveError.value = firstKey === 'non_field_errors' ? msg : `${firstKey}: ${msg}`
    } else {
      saveError.value = 'Save failed. Please try again.'
    }
  } finally {
    isSaving.value = false
  }
}

function cancelEdit() {
  Object.assign(form, formSnapshot)
  editing.value   = false
  saveError.value = null
}

// ── Boot ──────────────────────────────────────────────────────────────────────
onMounted(loadProfile)
</script>

<style scoped>
.profile-page { display: flex; flex-direction: column; gap: 20px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }

.profile-grid { display: grid; grid-template-columns: 280px 1fr; gap: 16px; align-items: start; }
@media (max-width: 900px) { .profile-grid { grid-template-columns: 1fr; } }

.identity-col, .form-col { display: flex; flex-direction: column; gap: 14px; }

.avatar-section { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 20px 16px; }
.profile-avatar-wrap { position: relative; width: 80px; height: 80px; border-radius: 50%; flex-shrink: 0; }
.profile-avatar {
  width: 80px; height: 80px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary) 0%, #a855f7 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700; color: white;
}

.identity-info { padding: 0 20px; }
.identity-meta { display: flex; flex-direction: column; gap: 0; padding: 0 4px 8px; }
.meta-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; }

.card-header-sm { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--border); }
.security-list { display: flex; flex-direction: column; }
.security-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px; border-bottom: 1px solid rgba(30,45,66,0.5); }
.security-row:last-child { border-bottom: none; }

.form-section-header { display: flex; align-items: center; gap: 8px; padding: 16px 20px; border-bottom: 1px solid var(--border); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 20px; }
.col-span-2 { grid-column: span 2; }
@media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } .col-span-2 { grid-column: span 1; } }

.text-danger { color: var(--danger); }

.skeleton-card { animation: pulse 1.5s ease-in-out infinite; background: var(--surface-2, #1e2d42); }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

.error-banner {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; border-radius: var(--radius-sm);
  background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
  color: #f87171; font-size: 0.85rem;
}
.success-banner {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; border-radius: var(--radius-sm);
  background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3);
  color: #4ade80; font-size: 0.85rem;
}

.spinner-xs {
  display: inline-block; width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
  border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
