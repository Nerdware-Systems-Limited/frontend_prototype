<template>
  <Teleport to="body">
    <Transition name="nudge-fade">
      <div
        v-if="showMfaNudge"
        class="nudge-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mfa-nudge-title"
      >
        <div class="nudge-card">
          <!-- Header -->
          <div class="nudge-hero">
            <div class="nudge-avatar" aria-hidden="true">
              <span class="nudge-initials">{{ userInitials }}</span>
              <span class="nudge-badge"><ShieldAlert :size="13" /></span>
            </div>
            <h2 id="mfa-nudge-title" class="nudge-title">
              {{ step === 'choose' ? 'Secure Your Account with 2FA' : 'Enter your verification code' }}
            </h2>
          </div>

          <div v-if="error" class="nudge-error" role="alert">
            <AlertCircle :size="15" />
            <span>{{ error }}</span>
          </div>

          <!-- Step 1: benefits + channel -->
          <template v-if="step === 'choose'">
            <ul class="nudge-benefits">
              <li class="nudge-benefit">
                <span class="nudge-benefit-icon"><KeyRound :size="16" /></span>
                <div>
                  <div class="nudge-benefit-title">Your account stays safe even if your login is stolen</div>
                  <div class="nudge-benefit-sub">Signing in also requires a one-time code sent to you</div>
                </div>
              </li>
              <li class="nudge-benefit">
                <span class="nudge-benefit-icon"><Database :size="16" /></span>
                <div>
                  <div class="nudge-benefit-title">Protects transport data and agency settings</div>
                  <div class="nudge-benefit-sub">Keep analytics, reports and access policies behind a second check</div>
                </div>
              </li>
            </ul>

            <div class="nudge-channels" role="radiogroup" aria-label="Where should we send your codes?">
              <button
                type="button"
                class="nudge-channel"
                :class="{ active: channel === 'email' }"
                role="radio"
                :aria-checked="channel === 'email'"
                @click="channel = 'email'"
              >
                <Mail :size="16" />
                <div class="nudge-channel-text">
                  <div class="nudge-channel-title">Email</div>
                  <div class="nudge-channel-sub">{{ user?.email }}</div>
                </div>
              </button>
              <button
                type="button"
                class="nudge-channel"
                :class="{ active: channel === 'sms' }"
                role="radio"
                :aria-checked="channel === 'sms'"
                :disabled="!user?.phone_number"
                @click="channel = 'sms'"
              >
                <Smartphone :size="16" />
                <div class="nudge-channel-text">
                  <div class="nudge-channel-title">Phone number (SMS)</div>
                  <div class="nudge-channel-sub">{{ user?.phone_number || 'Add a phone number in your profile first' }}</div>
                </div>
              </button>
            </div>

            <p class="nudge-hint">UAPTS recommends turning on two-factor authentication</p>

            <button type="button" class="nudge-primary" :disabled="busy" @click="sendCode">
              {{ busy ? 'Sending…' : 'Set Up Two-Factor Authentication' }}
            </button>
          </template>

          <!-- Step 2: verify -->
          <template v-else>
            <p class="nudge-lead">
              A code was sent to your {{ channel === 'sms' ? 'phone number' : 'email address' }}.
            </p>
            <input
              ref="codeInput"
              v-model="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              class="nudge-code"
              placeholder="000000"
              aria-label="Verification code"
              @input="code = code.replace(/\D/g, '')"
              @keyup.enter="confirm"
            />
            <button type="button" class="nudge-primary" :disabled="busy" @click="confirm">
              {{ busy ? 'Verifying…' : 'Verify & enable' }}
            </button>
            <div class="nudge-row">
              <button type="button" class="nudge-link" :disabled="busy" @click="resend">Resend code</button>
              <button type="button" class="nudge-link" :disabled="busy" @click="step = 'choose'; error = ''">Change method</button>
            </div>
          </template>

          <button type="button" class="nudge-skip" :disabled="busy" @click="dismissMfaNudge">
            Skip securing my account
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ShieldAlert, KeyRound, Database, Mail, Smartphone, AlertCircle } from 'lucide-vue-next'

const {
  user, userInitials, showMfaNudge, dismissMfaNudge,
  mfaEnroll, mfaEnrollVerify, mfaResend,
} = useAuth()

const step = ref<'choose' | 'code'>('choose')
const channel = ref<'email' | 'sms'>('email')
const otpId = ref('')
const code = ref('')
const busy = ref(false)
const error = ref('')
const codeInput = ref<HTMLInputElement | null>(null)

function errorDetail(err: unknown, fallback: string): string {
  const status = (err as { status?: number })?.status
  const detail = (err as { data?: { detail?: string } })?.data?.detail
  if (status === 429) return 'Too many attempts. Please wait and try again.'
  return detail ?? fallback
}

async function sendCode() {
  busy.value = true
  error.value = ''
  try {
    const res = await mfaEnroll(channel.value)
    otpId.value = res.otp_id
    code.value = ''
    step.value = 'code'
    nextTick(() => codeInput.value?.focus())
  } catch (err) {
    error.value = errorDetail(err, 'Could not send a code. Please try again.')
  } finally {
    busy.value = false
  }
}

async function resend() {
  busy.value = true
  error.value = ''
  try {
    const res = await mfaResend(otpId.value)
    otpId.value = res.otp_id
    code.value = ''
  } catch (err) {
    error.value = errorDetail(err, 'Could not resend the code. Please try again.')
  } finally {
    busy.value = false
  }
}

async function confirm() {
  if (code.value.length < 4) {
    error.value = 'Enter the code you were sent.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    await mfaEnrollVerify(otpId.value, code.value)
    dismissMfaNudge()
  } catch (err) {
    error.value = errorDetail(err, 'Incorrect or expired code.')
  } finally {
    busy.value = false
  }
}

// Reset internal state each time the nudge is (re)shown by a fresh sign-in.
watch(showMfaNudge, (open) => {
  if (open) {
    step.value = 'choose'
    channel.value = 'email'
    code.value = ''
    error.value = ''
  }
})

// Lock body scroll while the dialog is up.
watch(showMfaNudge, (open) => {
  if (typeof document !== 'undefined') document.body.style.overflow = open ? 'hidden' : ''
}, { immediate: true })
onUnmounted(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<style scoped>
.nudge-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--scrim);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  overflow-y: auto;
}

.nudge-card {
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 28px 24px 20px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--elev-3);
  /* soft accent glow across the top edge */
  background-image: linear-gradient(to bottom, rgba(253, 185, 19, .12), transparent 140px);
}

/* ── Hero ── */
.nudge-hero { display: flex; flex-direction: column; align-items: center; gap: 12px; }

.nudge-avatar { position: relative; width: 56px; height: 56px; }
.nudge-initials {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--primary-fill);
  color: var(--primary-fg);
  font-size: 1.1rem;
  font-weight: 600;
}
.nudge-badge {
  position: absolute;
  right: -4px;
  bottom: -2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-fg);
  border: 2px solid var(--card);
}

.nudge-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
  color: var(--fg);
}

/* ── Benefits ── */
.nudge-benefits { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.nudge-benefit {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--surface-1);
}
.nudge-benefit-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-md);
  background: var(--primary-wash);
  color: var(--primary);
}
.nudge-benefit-title { font-size: .875rem; font-weight: 600; color: var(--fg); line-height: 1.3; }
.nudge-benefit-sub { font-size: .8125rem; color: var(--fg3); margin-top: 2px; line-height: 1.35; }

/* ── Channel picker ── */
.nudge-channels { display: flex; flex-direction: column; gap: 8px; }
.nudge-channel {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  color: var(--fg2);
  background: var(--card);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  cursor: pointer;
  transition: border-color .12s, background .12s;
}
.nudge-channel:hover:not(:disabled) { border-color: var(--primary); }
.nudge-channel.active { border-color: var(--primary); background: var(--primary-wash); color: var(--primary); }
.nudge-channel:disabled { opacity: .55; cursor: not-allowed; }
.nudge-channel-text { min-width: 0; }
.nudge-channel-title { font-size: .875rem; font-weight: 600; color: var(--fg); }
.nudge-channel-sub { font-size: .75rem; color: var(--fg3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.nudge-hint, .nudge-lead { margin: 4px 0 0; text-align: center; font-size: .875rem; color: var(--fg3); }

/* ── Code entry ── */
.nudge-code {
  width: 100%;
  padding: 12px;
  text-align: center;
  font-size: 1.5rem;
  letter-spacing: .5em;
  font-variant-numeric: tabular-nums;
  color: var(--fg);
  background: var(--card);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
}
.nudge-code:focus { outline: 2px solid var(--primary); outline-offset: 1px; border-color: var(--primary); }

/* ── Actions ── */
.nudge-primary {
  width: 100%;
  padding: 11px 16px;
  font-size: .9375rem;
  font-weight: 600;
  color: var(--primary-fg);
  background: var(--primary-fill);
  border: 1px solid var(--primary-fill);
  border-radius: var(--r-md);
  cursor: pointer;
  transition: background .12s;
}
.nudge-primary:hover:not(:disabled) { background: var(--primary-dark); }
.nudge-primary:disabled { opacity: .6; cursor: not-allowed; }

.nudge-row { display: flex; justify-content: space-between; }
.nudge-link, .nudge-skip {
  background: none;
  border: none;
  cursor: pointer;
  font-size: .8125rem;
  color: var(--fg3);
}
.nudge-link { color: var(--link); }
.nudge-link:hover:not(:disabled) { text-decoration: underline; }
.nudge-skip { align-self: center; padding: 6px 10px; font-size: .875rem; }
.nudge-skip:hover:not(:disabled) { color: var(--fg); text-decoration: underline; }
.nudge-link:disabled, .nudge-skip:disabled { opacity: .5; cursor: not-allowed; }

.nudge-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: .8125rem;
  color: var(--danger-fg);
  background: var(--danger-bg);
  border-radius: var(--r-md);
}

.nudge-primary:focus-visible, .nudge-link:focus-visible, .nudge-skip:focus-visible, .nudge-channel:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.nudge-fade-enter-active, .nudge-fade-leave-active { transition: opacity .2s ease; }
.nudge-fade-enter-from, .nudge-fade-leave-to { opacity: 0; }
</style>
