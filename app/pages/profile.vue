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
        <div class="card skeleton-card" style="height:160px" />
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
              <img v-if="userData?.avatar" :src="userData.avatar" alt="Profile photo" class="profile-avatar-img" />
              <div v-else class="profile-avatar">{{ avatarInitials }}</div>
              <button class="avatar-overlay" :class="{ 'is-uploading': isUploadingAvatar }" @click="triggerAvatarPick" title="Change photo">
                <span v-if="isUploadingAvatar" class="spinner-xs" />
                <Camera v-else :size="16" />
              </button>
              <input ref="avatarInput" type="file" accept="image/*" class="hidden" @change="onAvatarChange" />
            </div>
            <div v-if="avatarError" class="text-xs text-danger mt-1">{{ avatarError }}</div>
          </div>
          <div class="identity-info">
            <div class="text-subhead text-center">{{ form.first_name }} {{ form.last_name }}</div>
            <div class="text-xs text-fg-muted text-center mt-1">{{ form.email }}</div>
            <div class="flex items-center justify-center gap-2 mt-3">
              <span class="badge badge-primary">{{ roleLabel }}</span>
              <span class="badge badge-success">Active</span>
            </div>
          </div>
          <div class="divider" />
          <div class="identity-meta">
            <div class="meta-item">
              <Building2 :size="13" class="text-fg-dim" />
              <div>
                <div class="text-xs text-fg-dim">Organization</div>
                <div class="text-sm font-medium">{{ userData?.organization_name || 'State Dept. Transport' }}</div>
              </div>
            </div>
            <div class="meta-item">
              <GitBranch :size="13" class="text-fg-dim" />
              <div>
                <div class="text-xs text-fg-dim">Department</div>
                <div class="text-sm font-medium">{{ userData?.department_name || '—' }}</div>
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
              <Clock :size="13" class="text-fg-dim" />
              <div>
                <div class="text-xs text-fg-dim">Last login</div>
                <div class="text-sm font-medium font-mono">{{ lastLoginTime }}</div>
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
              <span class="badge badge-success">Enabled</span>
            </div>
            <div class="security-row">
              <div>
                <div class="text-sm font-medium">Active sessions</div>
                <div class="text-xs text-fg-muted">2 devices</div>
              </div>
              <button class="btn btn-ghost text-xs py-1 px-2 text-danger">Revoke all</button>
            </div>
            <div class="security-row">
              <div>
                <div class="text-sm font-medium">Password</div>
                <div class="text-xs text-fg-muted">Last changed 45 days ago</div>
              </div>
              <button class="btn btn-secondary text-xs py-1 px-3">Change</button>
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

        <!-- Personal Info -->
        <div class="card">
          <div class="form-section-header">
            <User :size="15" class="text-primary" />
            <span class="text-subhead">Personal information</span>
          </div>
          <div class="form-grid">
            <div>
              <label class="input-label">First name</label>
              <input v-model="form.first_name" type="text" class="input" :disabled="!editing" />
            </div>
            <div>
              <label class="input-label">Last name</label>
              <input v-model="form.last_name" type="text" class="input" :disabled="!editing" />
            </div>
            <div class="col-span-2">
              <label class="input-label">Email address</label>
              <input v-model="form.email" type="email" class="input" :disabled="!editing" />
            </div>
            <div>
              <label class="input-label">Phone number</label>
              <input v-model="form.phone" type="tel" class="input" :disabled="!editing" placeholder="+254 7XX XXX XXX" />
            </div>
            <div>
              <label class="input-label">Employee ID</label>
              <input v-model="form.employee_id" type="text" class="input" :disabled="true" />
            </div>
            <div class="col-span-2">
              <label class="input-label">Bio</label>
              <textarea v-model="form.bio" class="input" rows="3" :disabled="!editing" placeholder="A brief description about yourself…" style="resize:vertical" />
            </div>
          </div>
        </div>

        <!-- Preferences -->
        <div class="card">
          <div class="form-section-header">
            <Settings :size="15" class="text-primary" />
            <span class="text-subhead">Preferences</span>
          </div>
          <div class="form-grid">
            <div>
              <label class="input-label">Timezone</label>
              <select v-model="form.timezone" class="input" :disabled="!editing">
                <option value="Africa/Nairobi">Africa/Nairobi (EAT +3)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label class="input-label">Language</label>
              <select v-model="form.locale" class="input" :disabled="!editing">
                <option value="en-US">English</option>
                <option value="sw">Swahili</option>
              </select>
            </div>
            <div>
              <label class="input-label">Theme</label>
              <select v-model="form.theme" class="input" :disabled="!editing">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Emergency Contact -->
        <div class="card">
          <div class="form-section-header">
            <Phone :size="15" class="text-amber-400" />
            <span class="text-subhead">Emergency contact</span>
          </div>
          <div class="form-grid">
            <div>
              <label class="input-label">Contact name</label>
              <input v-model="form.emergency_contact_name" type="text" class="input" :disabled="!editing" />
            </div>
            <div>
              <label class="input-label">Contact phone</label>
              <input v-model="form.emergency_contact_phone" type="tel" class="input" :disabled="!editing" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Edit2, Save, Camera, Building2, GitBranch, Calendar, Clock, Shield,
  User, Settings, Phone, AlertCircle, CheckCircle
} from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

// ── Nuxt / plugin refs ───────────────────────────────────────────────────────
const { $api } = useNuxtApp()

// ── Full user shape returned by GET /api/v1/auth/user/ ──────────────────────
interface FullUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: string
  organization?: number | null
  organization_name?: string
  department?: number | null
  department_name?: string
  employee_id?: string
  phone?: string
  avatar?: string | null
  date_of_birth?: string | null
  date_of_joining?: string | null
  emergency_contact_name?: string
  emergency_contact_phone?: string
  bio?: string
  is_online?: boolean
  last_seen_at?: string | null
  date_joined?: string
  last_login?: string
  profile?: {
    timezone?: string
    locale?: string
    theme?: string
  }
}

// ── State ────────────────────────────────────────────────────────────────────
const isLoading  = ref(true)
const isSaving   = ref(false)
const loadError  = ref<string | null>(null)
const saveError  = ref<string | null>(null)
const saveSuccess = ref(false)
const editing    = ref(false)
const userData   = ref<FullUser | null>(null)

const isUploadingAvatar = ref(false)
const avatarError = ref<string | null>(null)
const avatarInput = ref<HTMLInputElement | null>(null)

const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  employee_id: '',
  bio: '',
  timezone: 'Africa/Nairobi',
  locale: 'en-US',
  theme: 'dark',
  emergency_contact_name: '',
  emergency_contact_phone: '',
})

// Snapshot for cancel
let formSnapshot = { ...form }

// ── Computed ─────────────────────────────────────────────────────────────────
const avatarInitials = computed(() => {
  const first = form.first_name?.[0] ?? ''
  const last  = form.last_name?.[0]  ?? ''
  return (first + last).toUpperCase() || '??'
})

const roleLabel = computed(() => userData.value?.role ?? '—')

const joinedDate = computed(() => {
  const d = userData.value?.date_of_joining || userData.value?.date_joined
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
})

const lastLoginTime = computed(() => {
  const d = userData.value?.last_login
  if (!d) return '—'
  return new Date(d).toLocaleString('en-KE', { hour12: false, dateStyle: 'short', timeStyle: 'short' })
})

// ── Helpers ──────────────────────────────────────────────────────────────────
function populateForm(u: FullUser) {
  form.first_name              = u.first_name ?? ''
  form.last_name               = u.last_name  ?? ''
  form.email                   = u.email      ?? ''
  form.phone                   = u.phone      ?? ''
  form.employee_id             = u.employee_id ?? ''
  form.bio                     = u.bio        ?? ''
  form.emergency_contact_name  = u.emergency_contact_name  ?? ''
  form.emergency_contact_phone = u.emergency_contact_phone ?? ''
  // Preferences live in the nested profile object
  form.timezone = u.profile?.timezone ?? 'Africa/Nairobi'
  form.locale   = u.profile?.locale   ?? 'en-US'
  form.theme    = u.profile?.theme    ?? 'dark'
}

// ── Load ─────────────────────────────────────────────────────────────────────
async function loadProfile() {
  isLoading.value = true
  loadError.value = null
  try {
    const u = await $api<FullUser>('/api/v1/auth/user/')
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
    // Top-level user fields
    const userPayload = {
      first_name:              form.first_name,
      last_name:               form.last_name,
      email:                   form.email,
      phone:                   form.phone,
      bio:                     form.bio,
      emergency_contact_name:  form.emergency_contact_name,
      emergency_contact_phone: form.emergency_contact_phone,
    }

    const updated = await $api<FullUser>('/api/v1/auth/user/', {
      method: 'PATCH',
      body: userPayload,
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

function triggerAvatarPick() {
  avatarInput.value?.click()
}

async function onAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { avatarError.value = 'Please select an image file.'; return }
  if (file.size > 5 * 1024 * 1024) { avatarError.value = 'Image must be under 5 MB.'; return }
  avatarError.value = null
  isUploadingAvatar.value = true
  try {
    const body = new FormData()
    body.append('avatar', file)
    const updated = await $api<FullUser>('/api/v1/auth/user/', {
      method: 'PATCH',
      body,
      headers: { 'Content-Type': undefined as unknown as string },
    })
    userData.value = updated
  } catch {
    avatarError.value = 'Photo upload failed. Please try again.'
  } finally {
    isUploadingAvatar.value = false
    if (avatarInput.value) avatarInput.value.value = ''
  }
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
.profile-avatar {
  width: 80px; height: 80px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary) 0%, #a855f7 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700; color: white;
}
.profile-avatar-wrap { position: relative; width: 80px; height: 80px; border-radius: 50%; flex-shrink: 0; }
.profile-avatar, .profile-avatar-img { width: 80px; height: 80px; border-radius: 50%; }
.profile-avatar {
  background: linear-gradient(135deg, var(--primary) 0%, #a855f7 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700; color: white;
}
.profile-avatar-img { object-fit: cover; display: block; }
.avatar-overlay {
  position: absolute; inset: 0; border-radius: 50%;
  background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;
  color: white; cursor: pointer; border: none; opacity: 0; transition: opacity 0.18s;
}
.profile-avatar-wrap:hover .avatar-overlay, .avatar-overlay.is-uploading { opacity: 1; }
.hidden { display: none; }
.avatar-change-btn {
  display: flex; align-items: center; gap: 6px;
  background: none; border: 1px solid var(--border); border-radius: var(--radius-sm);
  color: var(--fg-muted); font-size: 0.75rem; padding: 5px 12px; cursor: pointer;
  transition: all 0.15s;
}
.avatar-change-btn:hover { border-color: var(--border-light); color: var(--fg); }

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