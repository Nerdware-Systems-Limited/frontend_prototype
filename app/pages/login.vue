<template>
  <div class="login-root">

    <!-- Left panel: form -->
    <div class="form-panel" :class="{ 'high-contrast': highContrast, 'grayscale': grayscale }" :style="{ fontSize: fontSizes[fontSize] }">

      <!-- Brand lockup -->
      <header class="brand-header">
        <div class="brand-row">
          <div class="brand-logo" aria-hidden="true">
            <img src="/uapts-logo.png" alt="" class="logo-img" />
          </div>
          <div class="brand-text">
            <div class="brand-name">UAPTS</div>
            <div class="brand-tag">Unified Analytics &amp; Predictive Transport System</div>
          </div>
        </div>
        <div class="brand-rule" aria-hidden="true"></div>
      </header>

      <!-- Login step -->
      <template v-if="step === 'login'">
        <div class="form-heading">
          <h1 class="heading-main">Sign in to UAPTS</h1>
          <p class="heading-sub">Use your work email or staff identification number.</p>
        </div>

        <form class="auth-form" @submit.prevent="handleLogin" novalidate>
          <div class="field-group">
            <label class="field-label" for="uapts-email">Email address or Staff ID</label>
            <div class="field-input-wrap">
              <svg class="field-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                id="uapts-email"
                v-model="email"
                type="text"
                class="field-input has-icon"
                placeholder="officer@transport.go.ke"
                autocomplete="username"
                required
              />
            </div>
          </div>

          <div class="field-group">
            <div class="field-label-row">
              <label class="field-label" for="uapts-pwd">Password</label>
              <a href="#" class="forgot-link">Forgot Password</a>
            </div>
            <div class="field-input-wrap">
              <svg class="field-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                id="uapts-pwd"
                v-model="password"
                :type="showPwd ? 'text' : 'password'"
                class="field-input has-icon has-trailing"
                placeholder="Enter your password"
                autocomplete="current-password"
                required
              />
              <button type="button" class="toggle-pwd-btn" @click="showPwd = !showPwd" :aria-label="showPwd ? 'Hide password' : 'Show password'" :aria-pressed="showPwd">
                <svg v-if="!showPwd" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>

          <label class="remember-label">
            <input type="checkbox" v-model="rememberMe" class="remember-check">
            <span class="remember-text">Remember for 30 days</span>
          </label>

          <div v-if="loginError" class="error-bar" role="alert" aria-live="polite">
            <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div class="error-text">
              <strong>Sign-in failed</strong>
              <span>{{ loginError }}</span>
            </div>
          </div>

          <button type="submit" class="submit-btn" :disabled="isLoading">
            <svg v-if="isLoading" class="spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40" stroke-dashoffset="10" stroke-linecap="round"/>
            </svg>
            <span>{{ isLoading ? 'Signing you in…' : 'Sign in' }}</span>
            <svg v-if="!isLoading" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </form>
      </template>

      <!-- MFA step -->
      <template v-else-if="step === 'mfa'">
        <div class="form-heading">
          <button class="back-link" @click="step = 'login'" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            <span>Back to sign in</span>
          </button>
          <p class="eyebrow">Step 2 of 2</p>
          <h1 class="heading-main">Two-factor verification</h1>
          <p class="heading-sub">A 6-digit code has been sent to your registered authenticator app.</p>
        </div>

        <div class="mfa-icon-ring" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
        </div>

        <form class="auth-form" @submit.prevent="handleMFA" novalidate>
          <div class="field-group">
            <label class="field-label field-label-center">Verification Code</label>
            <div class="otp-row" role="group" aria-label="One-time password, 6 digits">
              <input
                v-for="(_, i) in 6"
                :key="i"
                :ref="el => { if (el) otpRefs[i] = el as HTMLInputElement }"
                v-model="otpDigits[i]"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="1"
                class="otp-box"
                :aria-label="`Digit ${i + 1} of 6`"
                :autocomplete="i === 0 ? 'one-time-code' : 'off'"
                @input="onOTPInput(i)"
                @keydown.backspace="onOTPBackspace(i)"
                @keydown.left="i > 0 && otpRefs[i-1]?.focus()"
                @keydown.right="i < 5 && otpRefs[i+1]?.focus()"
                @paste="onOTPPaste"
              />
            </div>
          </div>

          <div v-if="mfaError" class="error-bar" role="alert" aria-live="polite">
            <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div class="error-text">
              <strong>Verification failed</strong>
              <span>{{ mfaError }}</span>
            </div>
          </div>

          <button type="submit" class="submit-btn" :disabled="isLoading || otpCode.length < 6">
            <svg v-if="isLoading" class="spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40" stroke-dashoffset="10" stroke-linecap="round"/>
            </svg>
            <span>{{ isLoading ? 'Verifying…' : 'Verify &amp; Sign In' }}</span>
            <svg v-if="!isLoading" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>

          <div class="skip-block">
            <div class="or-divider"><span></span><em>or</em><span></span></div>
            <button type="button" class="skip-btn" @click="skipMFA">Skip 2FA for now</button>
            <p class="skip-note">Development mode · 2FA enforcement is disabled</p>
          </div>
        </form>

        <div class="resend-row">
          <span class="resend-text">Didn't receive a code?</span>
          <button type="button" class="resend-link" @click="resendCode">Resend code</button>
        </div>
      </template>
    </div>

    <!-- Right panel: hero image -->
    <div class="hero-panel">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-badge">Kenya State Department for Transport</div>
        <h2 class="hero-headline">Unified Analytics and Predictive Transport System</h2>
        <p class="hero-body">Centralized data intelligence for roads, rail, and air across all transport agencies.</p>
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-num">16K+</span>
            <span class="stat-label">Data Points Daily</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-num">15</span>
            <span class="stat-label">agencies Connected</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-num">99.8%</span>
            <span class="stat-label">Uptime SLA</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const step = ref<'login' | 'mfa'>('login')
const email = ref('')
const password = ref('')
const showPwd = ref(false)
const rememberMe = ref(false)
const { login, isLoading } = useAuth()
const loginError = ref('')
const mfaError = ref('')
const highContrast = ref(false)
const grayscale = ref(false)
const fontSize = ref(0)
const fontSizes = ['14px', '15px', '16px', '18px']

const otpDigits = ref(['','','','','',''])
const otpRefs = ref<HTMLInputElement[]>([])
const otpCode = computed(() => otpDigits.value.join(''))

async function handleLogin() {
  loginError.value = ''
  if (!email.value.trim() || !password.value) {
    loginError.value = 'Please enter your email and password.'
    return
  }
  try {
    await login(email.value.trim(), password.value, rememberMe.value)
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    if (status === 401) loginError.value = 'Invalid email or password.'
    else if (status === 429) loginError.value = 'Too many attempts. Please wait and try again.'
    else loginError.value = 'Unable to reach the server. Check your connection.'
  }
}

async function handleMFA() {
  mfaError.value = ''
  await new Promise(r => setTimeout(r, 700))
  navigateTo('/dashboard')
}

function skipMFA() {
  navigateTo('/dashboard')
}

function resendCode() {
  // TODO: call /api/v1/auth/mfa/otp/send/
}

function onOTPInput(idx: number) {
  const val = otpDigits.value[idx] ?? ''
  if (val.length > 1) otpDigits.value[idx] = val.slice(-1)
  if (otpDigits.value[idx] && idx < 5) nextTick(() => otpRefs.value[idx + 1]?.focus())
  if (otpCode.value.length === 6) handleMFA()
}

function onOTPBackspace(idx: number) {
  if (!otpDigits.value[idx] && idx > 0) {
    otpDigits.value[idx - 1] = ''
    nextTick(() => otpRefs.value[idx - 1]?.focus())
  }
}

function onOTPPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) ?? ''
  if (text.length === 6) {
    e.preventDefault()
    otpDigits.value = text.split('')
    nextTick(() => otpRefs.value[5]?.focus())
  }
}
</script>

<style scoped>
/* ============================================================================
   Login + MFA — editorial style
   - White form panel, 6px radii (no pill buttons)
   - Gold accent rule beneath brand lockup
   - Leading field icons, structured error bar with shake animation
   - Arrow icon on submit button
   - Eyebrow / h1 / sub heading hierarchy
   ============================================================================ */

.login-root {
  min-height: 100vh;
  height: 100vh;
  width: 100%;
  display: flex;
  background: #fff;
  font-family: 'Lexend', 'Inter', system-ui, sans-serif;
}

/* ─── Form Panel ─────────────────────────────────────────── */
.form-panel {
  width: 100%;
  max-width: 600px;
  height: 100vh;
  padding: 40px 64px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  background: #fff;
  transition: filter 0.2s;
}
.form-panel.high-contrast { background: #000; color: #fff; }
.form-panel.grayscale { filter: grayscale(1); }

@media (max-width: 1023px) {
  .form-panel { width: 100%; max-width: 100%; padding: 32px; }
  .hero-panel { display: none !important; }
}
@media (max-width: 600px) { .form-panel { padding: 24px 22px; gap: 24px; } }
@media (max-width: 380px) { .form-panel { padding: 20px 18px; } }

/* ─── Brand lockup ───────────────────────────────────────── */
.brand-header { margin-bottom: 4px; }
.brand-row {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 14px;
}
.brand-logo {
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; border-radius: 8px; overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 104, 56, .15);
}
.logo-img { width: 40px; height: 40px; object-fit: contain; }
.brand-text { line-height: 1.2; min-width: 0; }
.brand-name {
  font-size: 18px; font-weight: 800; letter-spacing: 0.04em;
  color: #003a1e; line-height: 1.1;
}
.brand-tag {
  font-size: 10.5px; font-weight: 600; color: #6b7280;
  letter-spacing: 0.06em; text-transform: uppercase;
  margin-top: 3px; line-height: 1.3;
}
.brand-rule {
  height: 3px;
  background: linear-gradient(90deg, #FDB913 0%, #FDB913 56px, #e5e7eb 56px, #e5e7eb 100%);
  border-radius: 2px;
}

/* ─── Heading ────────────────────────────────────────────── */
.form-heading { display: flex; flex-direction: column; gap: 6px; }
.eyebrow {
  font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
  text-transform: uppercase; color: #006838; margin-bottom: 2px;
}
.heading-main {
  font-size: clamp(1.625rem, 2vw, 1.875rem);
  font-weight: 700; letter-spacing: -0.025em;
  color: #111827; line-height: 1.2; margin: 2px 0 0 0;
}
.heading-sub {
  font-size: 0.875rem; line-height: 1.6;
  color: #6b7280; margin-top: 6px; max-width: 44ch;
}

/* ─── Form fields ────────────────────────────────────────── */
.auth-form { display: flex; flex-direction: column; gap: 18px; margin: 0; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.field-label {
  display: block; font-size: 0.8125rem; font-weight: 600;
  color: #374151; letter-spacing: 0.005em; line-height: 1.4;
}
.field-label-center { text-align: center; }

.forgot-link {
  font-size: 0.8125rem; font-weight: 600; color: #006838;
  text-decoration: none; letter-spacing: 0.005em;
}
.forgot-link:hover { text-decoration: underline; }
.forgot-link:focus-visible { outline: 3px solid #FDB913; outline-offset: 2px; border-radius: 4px; }

.field-input-wrap { position: relative; display: flex; align-items: center; }
.field-icon {
  position: absolute; left: 14px; color: #9ca3af;
  pointer-events: none; transition: color .15s;
}
.field-input-wrap:focus-within .field-icon { color: #006838; }

.field-input {
  width: 100%; padding: 12px 14px;
  border: 1px solid #d1d5db; border-radius: 6px;
  font-size: 0.9375rem; line-height: 1.45; font-family: inherit;
  color: #111827; background: #fff; outline: none;
  transition: border-color .12s, box-shadow .12s;
  min-height: 46px;
}
.field-input::placeholder { color: #9ca3af; }
.field-input.has-icon { padding-left: 42px; }
.field-input.has-trailing { padding-right: 50px; }
.field-input:hover:not(:focus) { border-color: #9ca3af; }
.field-input:focus,
.field-input:focus-visible {
  border-color: #006838;
  box-shadow: 0 0 0 3px rgba(0, 104, 56, .16);
  outline: none;
}
.field-input:disabled { background: #f9fafb; color: #9ca3af; cursor: not-allowed; }

.toggle-pwd-btn {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  background: transparent; border: 1px solid transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #6b7280; width: 38px; height: 38px; border-radius: 6px;
  transition: background .12s, color .12s;
}
.toggle-pwd-btn:hover { background: #f3f4f6; color: #111827; }
.toggle-pwd-btn:focus-visible { outline: 3px solid #FDB913; outline-offset: 2px; }

/* ─── Remember checkbox ──────────────────────────────────── */
.remember-label {
  display: flex; align-items: center; gap: 10px;
  cursor: pointer; padding: 2px 0; user-select: none;
}
.remember-check {
  width: 17px; height: 17px; accent-color: #006838;
  margin: 0; flex-shrink: 0; cursor: pointer;
}
.remember-text { font-size: 0.8125rem; color: #6b7280; line-height: 1.4; }

/* ─── Error bar ──────────────────────────────────────────── */
.error-bar {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 12px 14px;
  background: rgba(185, 28, 28, .04);
  border: 1px solid rgba(185, 28, 28, .22);
  border-left: 3px solid #b91c1c;
  border-radius: 6px; color: #b91c1c; line-height: 1.5;
  animation: shake .35s ease both;
}
.error-icon { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
.error-text { display: flex; flex-direction: column; gap: 2px; }
.error-text strong { font-weight: 700; font-size: 0.8125rem; }
.error-text span { font-size: 0.8125rem; font-weight: 500; opacity: .95; }
@keyframes shake {
  0%, 100% { transform: translateX(0) }
  20%, 60% { transform: translateX(-4px) }
  40%, 80% { transform: translateX(4px) }
}

/* ─── Submit button ──────────────────────────────────────── */
.submit-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; padding: 14px 20px; border-radius: 6px;
  background: #006838; color: #fff;
  font-size: 0.9375rem; font-weight: 600; font-family: inherit;
  border: 1px solid #006838; cursor: pointer;
  transition: background .15s, box-shadow .15s, transform .08s, opacity .15s;
  letter-spacing: 0.005em; min-height: 48px;
  box-shadow: 0 1px 2px rgba(0,104,56,.18);
  margin-top: 4px;
}
.submit-btn:hover:not(:disabled) {
  background: #004d29; border-color: #004d29;
  box-shadow: 0 4px 14px rgba(0,104,56,.26);
}
.submit-btn:active:not(:disabled) { transform: translateY(1px); }
.submit-btn:focus-visible { outline: 3px solid #FDB913; outline-offset: 2px; }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner { width: 18px; height: 18px; animation: spin 0.75s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── MFA: back link ─────────────────────────────────────── */
.back-link {
  display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
  background: transparent; border: none; padding: 4px 0; color: #6b7280;
  font-family: inherit; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; border-radius: 4px; transition: color .12s; margin-bottom: 4px;
}
.back-link:hover { color: #006838; }
.back-link:focus-visible { outline: 3px solid #FDB913; outline-offset: 2px; }

/* ─── MFA: shield icon ring ──────────────────────────────── */
.mfa-icon-ring {
  width: 64px; height: 64px; margin: 0 auto 8px; border-radius: 50%;
  background: rgba(0, 104, 56, .08); border: 1px solid rgba(0, 104, 56, .25);
  color: #006838; display: flex; align-items: center; justify-content: center;
}

/* ─── MFA: OTP row ───────────────────────────────────────── */
.otp-row {
  display: grid; grid-template-columns: repeat(6, 1fr);
  gap: 10px; margin: 8px 0 4px;
}
.otp-box {
  width: 100%; aspect-ratio: 0.9; text-align: center;
  font-size: 1.5rem; font-weight: 600;
  font-family: 'JetBrains Mono', 'Fira Mono', monospace;
  font-variant-numeric: tabular-nums;
  border: 1.5px solid #d1d5db; border-radius: 6px;
  background: #fff; color: #111827; outline: none;
  caret-color: #006838;
  transition: border-color .12s, box-shadow .12s, background .12s;
  min-height: 56px; padding: 0;
}
.otp-box:hover:not(:focus) { border-color: #9ca3af; }
.otp-box:focus,
.otp-box:focus-visible {
  border-color: #006838; background: rgba(0, 104, 56, .03);
  box-shadow: 0 0 0 3px rgba(0, 104, 56, .18); outline: none;
}

/* ─── MFA: skip block ────────────────────────────────────── */
.skip-block { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
.or-divider {
  display: flex; align-items: center; gap: 10px; color: #9ca3af; font-size: 0.75rem;
}
.or-divider span { flex: 1; height: 1px; background: #e5e7eb; }
.or-divider em { font-style: normal; }
.skip-btn {
  width: 100%; padding: 12px; border-radius: 6px;
  background: #f9fafb; border: 1px solid #e5e7eb; color: #374151;
  font-size: 0.875rem; font-weight: 600; font-family: inherit; cursor: pointer;
  transition: background .15s, border-color .15s;
}
.skip-btn:hover { background: #f3f4f6; border-color: #d1d5db; }
.skip-btn:focus-visible { outline: 3px solid #FDB913; outline-offset: 2px; }
.skip-note { font-size: 0.75rem; color: #9ca3af; text-align: center; }

/* ─── MFA: resend row ────────────────────────────────────── */
.resend-row {
  display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 4px;
}
.resend-text { font-size: 0.8125rem; color: #6b7280; }
.resend-link {
  background: transparent; border: none; padding: 4px 6px;
  font-size: 0.8125rem; font-weight: 600; color: #006838;
  font-family: inherit; cursor: pointer; border-radius: 4px; transition: color .12s;
}
.resend-link:hover { color: #004d29; text-decoration: underline; }
.resend-link:focus-visible { outline: 3px solid #FDB913; outline-offset: 2px; }

/* ─── Footer ─────────────────────────────────────────────── */
.form-footer {
  margin-top: auto; padding-top: 24px;
  display: flex; flex-direction: column; gap: 16px; position: relative;
}
.form-footer::before {
  content: "";
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent 0%, #e5e7eb 30%, #e5e7eb 70%, transparent 100%);
}
.footer-row { display: flex; align-items: flex-start; gap: 8px; }
.footer-icon { width: 14px; height: 14px; color: #9ca3af; flex-shrink: 0; margin-top: 1px; }
.footer-text {
  font-size: 0.6875rem; font-weight: 500; color: #9ca3af;
  letter-spacing: 0.04em; line-height: 1.6; text-transform: uppercase;
}
.footer-meta {
  display: flex; align-items: center; flex-wrap: wrap;
  gap: 16px; font-size: 0.8125rem; font-weight: 500; color: #6b7280; line-height: 1.4;
}
.footer-meta-copyright {
  color: #6b7280; font-size: 0.75rem; font-weight: 500;
  font-variant-numeric: tabular-nums; letter-spacing: 0.005em;
}
.footer-meta-links { display: inline-flex; align-items: center; gap: 0; }
.footer-meta-links a {
  color: #374151; text-decoration: none; padding: 5px 10px; border-radius: 4px;
  font-weight: 600; font-size: 0.8125rem; letter-spacing: 0.005em;
  transition: color .12s, background .12s;
}
.footer-meta-links a:hover { color: #006838; background: #f3f4f6; }
.footer-meta-links a:focus-visible { outline: 2px solid #FDB913; outline-offset: 1px; }
.footer-meta-sep {
  display: inline-block; width: 1px; height: 12px;
  background: #e5e7eb; user-select: none; flex-shrink: 0;
}

/* ─── Hero panel ─────────────────────────────────────────── */
.hero-panel {
  flex: 1; height: 100vh;
  background:
    linear-gradient(160deg, rgba(5, 46, 22, 0.82) 0%, rgba(6, 95, 70, 0.65) 50%, rgba(16, 185, 129, 0.3) 100%),
    url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80') center/cover no-repeat;
  display: flex; align-items: center; justify-content: center; padding: 48px;
  position: relative; overflow: hidden;
}
.hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(2, 44, 26, 0.6) 0%, transparent 60%);
}
.hero-content { position: relative; z-index: 1; color: #fff; }
.hero-badge {
  display: inline-block; padding: 6px 16px; border-radius: 9999px;
  background: rgba(0, 104, 56, .6); border: 1px solid rgba(253, 185, 19, .6);
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.14em;
  text-transform: uppercase; margin-bottom: 16px; backdrop-filter: blur(8px);
}
.hero-headline {
  font-size: clamp(1.75rem, 2.5vw, 2.5rem); font-weight: 700;
  letter-spacing: -0.025em; line-height: 1.1; margin-bottom: 12px; max-width: 400px;
  text-shadow: 0 2px 12px rgba(0,0,0,.4);
}
.hero-body {
  font-size: 0.9375rem; color: rgba(255,255,255,.8); line-height: 1.7;
  max-width: 380px; margin-bottom: 32px; text-shadow: 0 1px 6px rgba(0,0,0,.4);
}
.hero-stats { display: flex; align-items: center; gap: 20px; }
.stat-item { display: flex; flex-direction: column; gap: 2px; }
.stat-num { font-size: 1.375rem; font-weight: 700; line-height: 1; }
.stat-label {
  font-size: 0.6875rem; font-weight: 500; text-transform: uppercase;
  letter-spacing: 0.08em; color: rgba(255,255,255,.6);
}
.stat-divider { width: 1px; height: 36px; background: rgba(255,255,255,.2); }

/* ─── Reduced motion ─────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .error-bar { animation: none !important; }
  .spinner { animation-duration: 0.001ms !important; }
  * { transition-duration: 0.001ms !important; }
}
</style>