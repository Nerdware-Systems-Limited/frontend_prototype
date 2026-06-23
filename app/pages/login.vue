<template>
  <div class="login-root">

    <!-- Left panel: form -->
    <div class="form-panel" :class="{ 'high-contrast': highContrast, 'grayscale': grayscale }" :style="{ fontSize: fontSizes[fontSize] }">

      <!-- Logo -->
      <div class="logo-wrapper">
        <img src="/logo.png" alt="UAPTS Logo" class="logo-img" />
      </div>

      <!-- Headline -->
      <div class="form-heading">
        <h1 class="heading-main">UAPTS Login</h1>
        <p class="heading-sub">Kenya State Department for Transport</p>
      </div>

      <!-- Login step -->
      <template v-if="step === 'login'">
        <form class="auth-form" @submit.prevent="handleLogin" novalidate>
          <div class="field-group">
            <label class="field-label" for="uapts-email">Email address or Staff ID</label>
            <input
              id="uapts-email"
              v-model="email"
              type="text"
              class="field-input"
              placeholder="officer@transport.go.ke"
              autocomplete="username"
              required
            />
          </div>

          <div class="field-group">
            <div class="field-label-row">
              <label class="field-label" for="uapts-pwd">Password</label>
              <a href="#" class="forgot-link">Forgot Password</a>
            </div>
            <div class="field-input-wrap">
              <input
                id="uapts-pwd"
                v-model="password"
                :type="showPwd ? 'text' : 'password'"
                class="field-input field-input-icon-right"
                placeholder="Enter your password"
                autocomplete="current-password"
                required
              />
              <button type="button" class="toggle-pwd-btn" @click="showPwd = !showPwd">
                <span class="toggle-pwd-text">{{ showPwd ? 'Hide' : 'Show' }} Password</span>
                <svg v-if="!showPwd" class="eye-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <svg v-else class="eye-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
              </button>
            </div>
          </div>

          <div class="remember-row">
            <label class="remember-label">
              <input type="checkbox" v-model="rememberMe" class="remember-check"> Remember for 30 days
            </label>
          </div>

          <div v-if="loginError" class="error-bar">
            <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
            {{ loginError }}
          </div>

          <button type="submit" class="submit-btn" :disabled="isLoading">
            <svg v-if="isLoading" class="spinner" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40" stroke-dashoffset="10" stroke-linecap="round"/></svg>
            <span>{{ isLoading ? 'Signing in…' : 'Sign In' }}</span>
          </button>
        </form>
      </template>

      <!-- MFA step -->
      <template v-else-if="step === 'mfa'">
        <div class="mfa-header">
          <button class="back-btn" @click="step = 'login'" title="Back">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="back-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
          </button>
          <h1 class="heading-main">Two-Factor Auth</h1>
        </div>
        <p class="mfa-hint">A 6-digit code has been sent to your registered authenticator app.</p>

        <form class="auth-form" @submit.prevent="handleMFA" novalidate>
          <div class="field-group">
            <label class="field-label">Verification Code</label>
            <div class="otp-row">
              <input
                v-for="(_, i) in 6"
                :key="i"
                :ref="el => { if (el) otpRefs[i] = el as HTMLInputElement }"
                v-model="otpDigits[i]"
                type="text"
                inputmode="numeric"
                maxlength="1"
                class="otp-box"
                @input="onOTPInput(i)"
                @keydown.backspace="onOTPBackspace(i)"
                @paste="onOTPPaste"
              />
            </div>
          </div>

          <div v-if="mfaError" class="error-bar">
            <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
            {{ mfaError }}
          </div>

          <button type="submit" class="submit-btn" :disabled="isLoading || otpCode.length < 6">
            <svg v-if="isLoading" class="spinner" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40" stroke-dashoffset="10" stroke-linecap="round"/></svg>
            <span>{{ isLoading ? 'Verifying…' : 'Verify & Sign In' }}</span>
          </button>

          <div class="skip-block">
            <div class="or-divider"><span></span><em>or</em><span></span></div>
            <button type="button" class="skip-btn" @click="skipMFA">
              Skip 2FA for now
            </button>
            <p class="skip-note">Development mode · 2FA enforcement is disabled</p>
          </div>
        </form>

        <div class="form-footer-center">
          <button class="resend-link" @click="resendCode">Resend code</button>
        </div>
      </template>
    </div>

    <!-- Right panel: hero image -->
    <div class="hero-panel">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-badge">Kenya State Department for Transport</div>
        <h2 class="hero-headline">Unified Transport Analytics</h2>
        <p class="hero-body">Centralized data intelligence for roads, rail, and air across all 47 counties.</p>
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-num">16K+</span>
            <span class="stat-label">Data Points Daily</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-num">47</span>
            <span class="stat-label">Counties Connected</span>
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
const langOpen = ref(false)
const a11yOpen = ref(false)
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
/* ─── Layout ─────────────────────────────────────────────── */
.login-root {
  min-height: 100vh;
  width: 100%;
  display: flex;
  background: #ffffff;
  font-family: 'Lexend', 'Inter', system-ui, sans-serif;
  position: relative;
}

/* ─── Top controls ───────────────────────────────────────── */

/* Flag placeholders */
.flag-ke, .flag-gb {
  display: inline-block;
  width: 18px;
  height: 14px;
  border-radius: 2px;
  flex-shrink: 0;
}
.flag-ke { background: linear-gradient(to bottom, #006600 33%, #000 33%, #000 66%, #ce1126 66%); }
.flag-gb { background: linear-gradient(135deg, #012169 50%, #C8102E 50%); }

/* ─── Form Panel ─────────────────────────────────────────── */
.form-panel {
  width: 100%;
  max-width: 600px;
  min-height: 100vh;
  padding: 56px 64px 40px;
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  overflow-y: auto;
  transition: filter 0.2s;
}

@media (max-width: 1023px) {
  .form-panel { width: 100%; max-width: 100%; padding: 56px 24px 40px; }
  .hero-panel {
    display: none !important;
  }
}

.form-panel.high-contrast {
  background: #000;
  color: #fff;
}
.form-panel.grayscale { filter: grayscale(1); }

.logo-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 28px;
}

.logo-img {
  width: 72px;
  height: 72px;
  object-fit: contain;
}
/* ─── Heading ────────────────────────────────────────────── */
.form-heading { text-align: center; margin-bottom: 32px; }
.heading-main {
  font-size: clamp(1.75rem, 3vw, 2.25rem);
  font-weight: 700;
  color: #111827;
  letter-spacing: -0.025em;
  line-height: 1.15;
}
.heading-sub {
  margin-top: 6px;
  font-size: 0.9375rem;
  color: #6b7280;
  font-weight: 400;
}

/* ─── Form ───────────────────────────────────────────────── */
.auth-form { display: flex; flex-direction: column; gap: 18px; }

.field-group { display: flex; flex-direction: column; gap: 6px; }

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
  letter-spacing: 0.01em;
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.forgot-link {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #065f46;
  text-decoration: none;
}
.forgot-link:hover { text-decoration: underline; }

.field-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-family: inherit;
  color: #111827;
  background: #fff;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.field-input:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
}
.field-input::placeholder { color: #9ca3af; }

.field-input-wrap { position: relative; }
.field-input-icon-right { padding-right: 110px; }

.toggle-pwd-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #6b7280;
  padding: 4px 2px;
  transition: color 0.15s;
}
.toggle-pwd-btn:hover { color: #111827; }
.toggle-pwd-text { font-size: 0.75rem; font-weight: 500; white-space: nowrap; }
.eye-icon { width: 18px; height: 18px; }

.remember-row { display: flex; align-items: center; }
.remember-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
}
.remember-check { accent-color: #065f46; width: 16px; height: 16px; border-radius: 4px; }

.error-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #b91c1c;
  font-size: 0.8125rem;
}
.error-icon { width: 16px; height: 16px; flex-shrink: 0; }

/* ─── Submit button ──────────────────────────────────────── */
.submit-btn {
  width: 100%;
  padding: 12px 24px;
  border-radius: 9999px;
  background: #1a5f3f;
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 600;
  font-family: inherit;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.15s, box-shadow 0.15s, opacity 0.15s;
  letter-spacing: 0.01em;
  margin-top: 4px;
}
.submit-btn:hover:not(:disabled) { background: #145034; box-shadow: 0 2px 12px rgba(26,95,63,0.25); }
.submit-btn:disabled { opacity: 0.65; cursor: not-allowed; }

.spinner {
  width: 16px;
  height: 16px;
  animation: spin 0.75s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }


/* ─── MFA ────────────────────────────────────────────────── */
.mfa-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.back-btn {
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  color: #374151;
  display: flex;
  align-items: center;
  transition: background 0.1s;
}
.back-btn:hover { background: #f3f4f6; }
.back-icon { width: 16px; height: 16px; }
.mfa-hint { font-size: 0.875rem; color: #6b7280; margin-bottom: 28px; line-height: 1.5; }

.otp-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}
.otp-box {
  aspect-ratio: 1;
  text-align: center;
  font-size: 1.25rem;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #111827;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.otp-box:focus { border-color: #059669; box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12); }

.skip-block { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
.or-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #9ca3af;
  font-size: 0.75rem;
  font-style: normal;
}
.or-divider span { flex: 1; height: 1px; background: #e5e7eb; }
.or-divider em { font-style: normal; }
.skip-btn {
  width: 100%;
  padding: 10px;
  border-radius: 9999px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s;
}
.skip-btn:hover { background: #f3f4f6; }
.skip-note { font-size: 0.75rem; color: #9ca3af; text-align: center; }

.form-footer-center {
  margin-top: 16px;
  text-align: center;
}
.resend-link {
  background: none;
  border: none;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #065f46;
  cursor: pointer;
  font-family: inherit;
}
.resend-link:hover { text-decoration: underline; }

/* ─── Sign up note ───────────────────────────────────────── */
.signup-note {
  margin-top: auto;
  padding-top: 32px;
  text-align: center;
  font-size: 0.875rem;
  color: #6b7280;
}
.signup-link { color: #065f46; font-weight: 600; text-decoration: none; margin-left: 4px; }
.signup-link:hover { text-decoration: underline; }

/* ─── Hero panel ─────────────────────────────────────────── */
.hero-panel {
  flex: 1;
  min-height: 100vh;
  width: 100%;
  background:
    linear-gradient(160deg, rgba(5, 46, 22, 0.82) 0%, rgba(6, 95, 70, 0.65) 50%, rgba(16, 185, 129, 0.3) 100%),
    url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80') center/cover no-repeat;
  display: flex;
  align-items: flex-end;
  padding: 48px;
  position: relative;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(2, 44, 26, 0.6) 0%, transparent 60%);
}

.hero-content {
  position: relative;
  z-index: 1;
  color: #fff;
}

.hero-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 9999px;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.25);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 16px;
  backdrop-filter: blur(4px);
}

.hero-headline {
  font-size: clamp(1.75rem, 2.5vw, 2.5rem);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.15;
  margin-bottom: 12px;
  max-width: 400px;
}

.hero-body {
  font-size: 0.9375rem;
  color: rgba(255,255,255,0.8);
  line-height: 1.6;
  max-width: 380px;
  margin-bottom: 32px;
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 20px;
}

.stat-item { display: flex; flex-direction: column; gap: 2px; }
.stat-num { font-size: 1.375rem; font-weight: 700; line-height: 1; }
.stat-label { font-size: 0.6875rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.6); }
.stat-divider { width: 1px; height: 36px; background: rgba(255,255,255,0.2); }
</style>