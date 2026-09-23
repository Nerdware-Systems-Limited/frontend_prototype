<template>
  <div class="profile-page">
    <PageHeader eyebrow="My Account" title="Profile">
      <template #actions>
        <button v-if="editing" class="btn btn-secondary" @click="cancelEdit">Cancel</button>
        <button class="btn btn-primary" :disabled="isSaving" @click="editing ? saveProfile() : (editing = true)">
          <template v-if="!editing"><Edit2 :size="13" /> Edit profile</template>
          <template v-else-if="isSaving"><span class="spinner-xs" /> Saving…</template>
          <template v-else><Save :size="13" /> Save changes</template>
        </button>
      </template>
    </PageHeader>

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
      <button class="btn btn-secondary btn-sm" @click="loadProfile">Retry</button>
    </div>

    <div v-else class="profile-grid">
      <!-- Left: Identity card -->
      <div class="identity-col">
        <div class="card identity-card">
          <div class="avatar-section">
            <div class="profile-avatar">{{ avatarInitials }}</div>
            <div class="identity-name">{{ displayName }}</div>
            <div class="identity-email">{{ form.email }}</div>
            <div class="identity-badges">
              <BadgePill variant="info">{{ roleLabel }}</BadgePill>
              <BadgePill :variant="userData?.is_active !== false ? 'success' : 'warning'">
                {{ userData?.is_active !== false ? 'Active' : 'Inactive' }}
              </BadgePill>
            </div>
          </div>
          <div class="identity-meta">
            <div class="meta-item">
              <Building2 :size="14" class="meta-icon" />
              <div>
                <div class="meta-label">Agency</div>
                <div class="meta-value">{{ userData?.agency_code || 'No agency (public user)' }}</div>
              </div>
            </div>
            <div class="meta-item">
              <GitBranch :size="14" class="meta-icon" />
              <div>
                <div class="meta-label">Department</div>
                <div class="meta-value meta-value-mono">{{ userData?.department || '-' }}</div>
              </div>
            </div>
            <div class="meta-item">
              <Calendar :size="14" class="meta-icon" />
              <div>
                <div class="meta-label">Joined</div>
                <div class="meta-value">{{ joinedDate }}</div>
              </div>
            </div>
            <div class="meta-item">
              <Shield :size="14" class="meta-icon" />
              <div>
                <div class="meta-label">Staff access</div>
                <div class="meta-value">{{ userData?.is_staff ? 'Yes - /admin/ console' : 'No' }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- MFA Status -->
        <div class="card">
          <div class="card-header">
            <span class="card-header-title"><Shield :size="14" /> Security</span>
          </div>
          <div class="security-row">
            <div>
              <div class="security-label">Two-factor auth</div>
              <div class="security-sub">
                {{ userData?.mfa_active ? `One-time code by ${userData.mfa_channel === 'sms' ? 'SMS' : 'email'}` : 'Not enrolled' }}
              </div>
            </div>
            <BadgePill :variant="userData?.mfa_active ? 'success' : 'warning'">
              {{ userData?.mfa_active ? 'Enabled' : 'Not enrolled' }}
            </BadgePill>
          </div>
          <div class="security-actions">
            <button v-if="!userData?.mfa_active" class="btn btn-secondary btn-sm" @click="openEnrollModal">
              Enable two-factor auth
            </button>
            <button v-else class="btn btn-secondary btn-sm" @click="openDisableModal">
              Disable two-factor auth
            </button>
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
          <div class="card-header">
            <span class="card-header-title"><User :size="14" /> Account information</span>
          </div>
          <div class="form-grid">
            <div class="col-span-2">
              <label class="input-label">Email address</label>
              <input v-model="form.email" type="email" class="input" :disabled="!editing" />
              <div class="input-hint">Used as your login identifier.</div>
            </div>
            <div class="col-span-2">
              <label class="input-label">Username</label>
              <input v-model="form.username" type="text" class="input" :disabled="!editing" placeholder="Not set" autocomplete="username" />
              <div class="input-hint">Optional. Lets you sign in with a username instead of your email.</div>
            </div>
            <div class="col-span-2">
              <label class="input-label">Phone number</label>
              <input v-model="form.phone_number" type="tel" class="input" :disabled="!editing" placeholder="+254712345678" />
              <div class="input-hint">E.164 format. Required to receive MFA codes by SMS.</div>
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

        <!-- Change password -->
        <div class="card">
          <div class="card-header">
            <span class="card-header-title"><Lock :size="14" /> Change password</span>
          </div>
          <form class="form-grid" @submit.prevent="submitPasswordChange">
            <div v-if="pwdError" class="col-span-2 error-banner">
              <AlertCircle :size="15" />
              <span>{{ pwdError }}</span>
            </div>
            <div v-if="pwdSuccess" class="col-span-2 success-banner">
              <CheckCircle :size="15" />
              <span>Password changed. Please sign in again.</span>
            </div>
            <div class="col-span-2">
              <label class="input-label">Current password</label>
              <input v-model="pwdForm.old" type="password" class="input" autocomplete="current-password" required />
            </div>
            <div>
              <label class="input-label">New password</label>
              <input v-model="pwdForm.new1" type="password" class="input" autocomplete="new-password" required />
            </div>
            <div>
              <label class="input-label">Confirm new password</label>
              <input v-model="pwdForm.new2" type="password" class="input" autocomplete="new-password" required />
            </div>
            <div class="col-span-2">
              <button type="submit" class="btn btn-primary" :disabled="isPwdSaving">
                {{ isPwdSaving ? 'Saving…' : 'Change password' }}
              </button>
              <div class="input-hint">You'll be signed out of every device after this - sign back in with the new password.</div>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- MFA enroll modal -->
    <AppModal v-model="showEnrollModal" title="Enable two-factor authentication" :subtitle="enrollStep === 'channel' ? 'Choose how you want to receive your codes.' : 'Enter the code we sent you.'">
      <div v-if="enrollError" class="error-banner" style="margin-bottom: 14px;">
        <AlertCircle :size="15" />
        <span>{{ enrollError }}</span>
      </div>

      <div v-if="enrollStep === 'channel'" class="channel-options">
        <button type="button" class="channel-option" :class="{ active: enrollChannel === 'email' }" @click="enrollChannel = 'email'">
          <Mail :size="16" />
          <div>
            <div class="channel-title">Email</div>
            <div class="channel-sub">{{ userData?.email }}</div>
          </div>
        </button>
        <button
          type="button"
          class="channel-option"
          :class="{ active: enrollChannel === 'sms', disabled: !userData?.phone_number }"
          :disabled="!userData?.phone_number"
          @click="enrollChannel = 'sms'"
        >
          <Smartphone :size="16" />
          <div>
            <div class="channel-title">SMS</div>
            <div class="channel-sub">{{ userData?.phone_number || 'Add a phone number first' }}</div>
          </div>
        </button>
      </div>

      <div v-else class="field-group">
        <label class="input-label">Verification code</label>
        <input v-model="enrollCode" type="text" inputmode="numeric" maxlength="6" class="input" placeholder="000000" />
      </div>

      <template #footer>
        <button v-if="enrollStep === 'code'" class="btn btn-secondary" :disabled="isEnrolling" @click="resendEnrollCode">Resend code</button>
        <button class="btn btn-primary" :disabled="isEnrolling" @click="enrollStep === 'channel' ? startEnroll() : confirmEnroll()">
          {{ isEnrolling ? 'Please wait…' : enrollStep === 'channel' ? 'Send code' : 'Verify & enable' }}
        </button>
      </template>
    </AppModal>

    <!-- MFA disable modal -->
    <AppModal v-model="showDisableModal" title="Disable two-factor authentication" subtitle="Confirm your password to continue.">
      <div v-if="disableError" class="error-banner" style="margin-bottom: 14px;">
        <AlertCircle :size="15" />
        <span>{{ disableError }}</span>
      </div>
      <div class="field-group">
        <label class="input-label">Password</label>
        <input v-model="disablePassword" type="password" class="input" autocomplete="current-password" @keyup.enter="confirmDisable" />
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showDisableModal = false">Cancel</button>
        <button class="btn btn-danger" :disabled="isDisabling" @click="confirmDisable">
          {{ isDisabling ? 'Disabling…' : 'Disable MFA' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import {
  Edit2, Save, Building2, GitBranch, Calendar, Shield,
  User, AlertCircle, CheckCircle, Lock, Mail, Smartphone,
} from 'lucide-vue-next'
import type { AuthUser } from '~/types/uapts'

definePageMeta({ layout: 'default' })

// ── Nuxt / plugin refs ───────────────────────────────────────────────────────
const { $api } = useNuxtApp()
const { mfaEnroll, mfaEnrollVerify, mfaResend, mfaDisable, changePassword, fetchMe } = useAuth()

// ── State ────────────────────────────────────────────────────────────────────
// Profile shape mirrors the real backend response: GET/PATCH /api/v1/auth/user/
// is backed by apps.accounts.serializers.user.UserSerializer, which emits
// id, email, username, role_type, role, role_name, agency, agency_code,
// department, mfa_active, mfa_channel, phone_number, is_active, is_staff,
// created_at. There is no first/last name, bio, avatar, employee_id, or
// preferences object on this User model.
// `username` is optional and self-service (null means email-only login) -
// see stores/auth.ts login() for how the login page uses either.
const isLoading  = ref(true)
const isSaving   = ref(false)
const loadError  = ref<string | null>(null)
const saveError  = ref<string | null>(null)
const saveSuccess = ref(false)
const editing    = ref(false)
const userData   = ref<AuthUser | null>(null)

const form = reactive({
  email: '',
  username: '',
  phone_number: '',
})

// ── Change password ───────────────────────────────────────────────────────────
const pwdForm = reactive({ old: '', new1: '', new2: '' })
const isPwdSaving = ref(false)
const pwdError = ref('')
const pwdSuccess = ref(false)

async function submitPasswordChange() {
  pwdError.value = ''
  pwdSuccess.value = false
  if (!pwdForm.old || !pwdForm.new1 || !pwdForm.new2) {
    pwdError.value = 'Please fill in all three fields.'
    return
  }
  if (pwdForm.new1 !== pwdForm.new2) {
    pwdError.value = 'New passwords do not match.'
    return
  }
  isPwdSaving.value = true
  try {
    await changePassword(pwdForm.old, pwdForm.new1, pwdForm.new2)
    pwdSuccess.value = true
    pwdForm.old = ''; pwdForm.new1 = ''; pwdForm.new2 = ''
    // Backend blacklists every outstanding refresh token on change - the
    // current session is effectively over, so send the user back to login
    // rather than let them keep working on a session that's about to die.
    setTimeout(() => navigateTo('/login'), 1800)
  } catch (err: unknown) {
    const data = (err as { data?: Record<string, unknown> })?.data
    if (data) {
      const firstKey = Object.keys(data)[0] ?? 'error'
      const msg = Array.isArray(data[firstKey]) ? ((data[firstKey] as string[])[0] ?? '') : String(data[firstKey])
      pwdError.value = firstKey === 'non_field_errors' ? msg : `${firstKey}: ${msg}`
    } else {
      pwdError.value = 'Password change failed. Please try again.'
    }
  } finally {
    isPwdSaving.value = false
  }
}

// ── MFA: enroll ────────────────────────────────────────────────────────────────
const showEnrollModal = ref(false)
const enrollStep = ref<'channel' | 'code'>('channel')
const enrollChannel = ref<'email' | 'sms'>('email')
const enrollOtpId = ref('')
const enrollCode = ref('')
const isEnrolling = ref(false)
const enrollError = ref('')

function openEnrollModal() {
  enrollStep.value = 'channel'
  enrollChannel.value = 'email'
  enrollCode.value = ''
  enrollError.value = ''
  showEnrollModal.value = true
}

async function startEnroll() {
  isEnrolling.value = true
  enrollError.value = ''
  try {
    const res = await mfaEnroll(enrollChannel.value)
    enrollOtpId.value = res.otp_id
    enrollStep.value = 'code'
  } catch {
    enrollError.value = 'Could not send a code. Please try again.'
  } finally {
    isEnrolling.value = false
  }
}

async function resendEnrollCode() {
  isEnrolling.value = true
  enrollError.value = ''
  try {
    const res = await mfaResend(enrollOtpId.value)
    enrollOtpId.value = res.otp_id
    enrollCode.value = ''
  } catch {
    enrollError.value = 'Could not resend the code. Please try again.'
  } finally {
    isEnrolling.value = false
  }
}

async function confirmEnroll() {
  if (enrollCode.value.length < 4) {
    enrollError.value = 'Enter the code you were sent.'
    return
  }
  isEnrolling.value = true
  enrollError.value = ''
  try {
    await mfaEnrollVerify(enrollOtpId.value, enrollCode.value)
    showEnrollModal.value = false
    await loadProfile()
  } catch (err: unknown) {
    enrollError.value = (err as { data?: { detail?: string } })?.data?.detail ?? 'Incorrect or expired code.'
  } finally {
    isEnrolling.value = false
  }
}

// ── MFA: disable ───────────────────────────────────────────────────────────────
const showDisableModal = ref(false)
const disablePassword = ref('')
const isDisabling = ref(false)
const disableError = ref('')

function openDisableModal() {
  disablePassword.value = ''
  disableError.value = ''
  showDisableModal.value = true
}

async function confirmDisable() {
  if (!disablePassword.value) {
    disableError.value = 'Enter your password to confirm.'
    return
  }
  isDisabling.value = true
  disableError.value = ''
  try {
    await mfaDisable(disablePassword.value)
    showDisableModal.value = false
    await loadProfile()
  } catch (err: unknown) {
    disableError.value = (err as { data?: { detail?: string; password?: string[] } })?.data?.detail
      ?? (err as { data?: { password?: string[] } })?.data?.password?.[0]
      ?? 'Incorrect password.'
  } finally {
    isDisabling.value = false
  }
}

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
  form.username = u.username ?? ''
  form.phone_number = u.phone_number ?? ''
}

// ── Load ─────────────────────────────────────────────────────────────────────
async function loadProfile() {
  isLoading.value = true
  loadError.value = null
  try {
    const u = await $api<AuthUser>('/api/v1/auth/user/')
    userData.value = u
    // Keep the auth store's cached profile (topnav, sidebar) in sync too.
    fetchMe()
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
    const updated = await $api<AuthUser>('/api/v1/auth/user/', {
      method: 'PATCH',
      // Backend rejects an empty-string username (blank != "not set" -
      // that's `null`), so an emptied field must PATCH as null to clear it.
      body: { email: form.email, username: form.username.trim() || null, phone_number: form.phone_number },
    })

    userData.value = updated
    populateForm(updated)
    formSnapshot = { ...form }
    editing.value = false
    saveSuccess.value = true
    fetchMe()
    setTimeout(() => { saveSuccess.value = false }, 4000)
  } catch (err: unknown) {
    const data = (err as { data?: Record<string, unknown> })?.data
    if (data) {
      // Surface the first field error from DRF
      const firstKey = Object.keys(data)[0] ?? 'error'
      const msg = Array.isArray(data[firstKey]) ? ((data[firstKey] as string[])[0] ?? '') : String(data[firstKey])
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
.profile-page { display: flex; flex-direction: column; gap: 16px; }

.profile-grid { display: grid; grid-template-columns: 300px 1fr; gap: 16px; align-items: start; }
@media (max-width: 900px) { .profile-grid { grid-template-columns: 1fr; } }

.identity-col, .form-col { display: flex; flex-direction: column; gap: 14px; }

/* Identity card - same colored top accent used on every KPI/content card
   elsewhere in the app, so this reads as part of the same system rather
   than a one-off settings-page template. */
.identity-card { position: relative; overflow: hidden; }
.identity-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--primary);
}
.avatar-section { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 28px 20px 18px; text-align: center; }
.profile-avatar {
  width: 72px; height: 72px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  border: 2px solid var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700; color: var(--primary-fg);
  margin-bottom: 10px;
}
.identity-name { font-size: 15px; font-weight: 700; color: var(--fg-1); }
.identity-email { font-size: 12px; color: var(--fg-3); margin-top: 2px; }
.identity-badges { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; }

.identity-meta { display: flex; flex-direction: column; border-top: 1px solid var(--border-subtle); }
.meta-item { display: flex; align-items: center; gap: 10px; padding: 11px 20px; border-bottom: 1px solid var(--border-subtle); }
.meta-item:last-child { border-bottom: none; }
.meta-icon { color: var(--fg-3); flex-shrink: 0; }
.meta-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-3); }
.meta-value { font-size: 12.5px; font-weight: 500; color: var(--fg-1); margin-top: 1px; }
.meta-value-mono { font-family: 'JetBrains Mono', 'SF Mono', monospace; }

.card-header-title { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--fg-1); }

.security-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; }
.security-label { font-size: 12.5px; font-weight: 500; color: var(--fg-1); }
.security-sub { font-size: 11px; color: var(--fg-3); margin-top: 1px; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 18px 20px; }
.col-span-2 { grid-column: span 2; }
@media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } .col-span-2 { grid-column: span 1; } }
.input-hint { font-size: 11px; color: var(--fg-3); margin-top: 5px; }

.skeleton-card { animation: pulse 1.5s ease-in-out infinite; background: var(--surface-sunken); }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

.error-banner {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; border-radius: var(--r-sm);
  background: var(--danger-bg); border: 1px solid rgba(180,35,24,.25);
  color: var(--danger-fg); font-size: 12.5px;
}
.success-banner {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; border-radius: var(--r-sm);
  background: var(--success-bg); border: 1px solid rgba(20,108,51,.25);
  color: var(--success-fg); font-size: 12.5px;
}

.spinner-xs {
  display: inline-block; width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: currentColor;
  border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Security card actions ──────────────────────────────── */
.security-actions { padding: 0 20px 16px; }
.security-actions .btn { width: 100%; justify-content: center; }

/* ─── MFA enroll modal: channel picker ───────────────────── */
.channel-options { display: flex; flex-direction: column; gap: 10px; }
.channel-option {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: var(--r-sm);
  border: 1px solid var(--border-interactive); background: var(--surface-quiet);
  color: var(--fg-1); cursor: pointer; text-align: left;
  transition: border-color .12s, background .12s;
}
.channel-option:hover:not(.disabled) { border-color: var(--primary); }
.channel-option.active { border-color: var(--primary); background: var(--surface-2); }
.channel-option.disabled { opacity: 0.5; cursor: not-allowed; }
.channel-title { font-size: 12.5px; font-weight: 600; }
.channel-sub { font-size: 11px; color: var(--fg-3); margin-top: 1px; }

.field-group { display: flex; flex-direction: column; gap: 6px; }
</style>
