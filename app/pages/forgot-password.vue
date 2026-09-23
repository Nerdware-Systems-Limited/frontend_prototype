<template>
  <div class="auth-page">
    <div class="auth-card">
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

      <template v-if="!sent">
        <div class="form-heading">
          <h1 class="heading-main">Forgot your password?</h1>
          <p class="heading-sub">Enter the email address on your account and we'll send you a link to reset it.</p>
        </div>

        <form class="auth-form" @submit.prevent="handleSubmit" novalidate>
          <div class="field-group">
            <label class="field-label" for="fp-email">Email address</label>
            <input
              id="fp-email"
              v-model="email"
              type="email"
              class="field-input"
              placeholder="officer@transport.go.ke"
              autocomplete="username"
              required
            />
          </div>

          <div v-if="error" class="error-bar" role="alert" aria-live="polite">
            <span class="error-text">{{ error }}</span>
          </div>

          <button type="submit" class="submit-btn" :disabled="isLoading">
            <span v-if="isLoading" class="spinner" />
            <span>{{ isLoading ? 'Sending…' : 'Send reset link' }}</span>
          </button>
        </form>
      </template>

      <template v-else>
        <div class="form-heading">
          <h1 class="heading-main">Check your email</h1>
          <p class="heading-sub">
            If an account exists for <strong>{{ email }}</strong>, a password-reset link is on its way.
            It expires after a few days.
          </p>
        </div>
      </template>

      <NuxtLink to="/login" class="back-link">
        <span>&larr; Back to sign in</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { requestPasswordReset } = useAuth()

const email = ref('')
const error = ref('')
const isLoading = ref(false)
const sent = ref(false)

async function handleSubmit() {
  error.value = ''
  if (!email.value.trim()) {
    error.value = 'Please enter your email address.'
    return
  }
  isLoading.value = true
  try {
    await requestPasswordReset(email.value.trim())
    // Backend always returns 200 here regardless of whether the account
    // exists, to avoid disclosing account presence - so this branch is the
    // only outcome on success.
    sent.value = true
  } catch {
    error.value = 'Unable to reach the server. Check your connection and try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  --brand: #0D4C8B;
  --brand-dark: #093A6B;
  --brand-darker: #06294D;
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f4f6f9;
  font-family: 'Lexend', 'Inter', system-ui, sans-serif;
  padding: 32px 20px;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(6, 41, 77, 0.10);
  padding: 40px 36px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.brand-header { display: flex; flex-direction: column; gap: 14px; }
.brand-row { display: flex; align-items: center; gap: 12px; }
.brand-logo {
  width: 40px; height: 40px; flex-shrink: 0; border-radius: 8px; overflow: hidden;
  box-shadow: 0 2px 4px rgba(13, 76, 139, .18);
}
.logo-img { width: 40px; height: 40px; object-fit: contain; }
.brand-text { line-height: 1.2; }
.brand-name { font-size: 18px; font-weight: 800; letter-spacing: 0.04em; color: var(--brand-darker); }
.brand-tag {
  font-size: 10.5px; font-weight: 600; color: #6b7280;
  letter-spacing: 0.06em; text-transform: uppercase; margin-top: 3px;
}
.brand-rule {
  height: 3px;
  background: linear-gradient(90deg, #FDB913 0%, #FDB913 56px, #e5e7eb 56px, #e5e7eb 100%);
  border-radius: 2px;
}

.form-heading { display: flex; flex-direction: column; gap: 8px; }
.heading-main { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; color: #111827; margin: 0; }
.heading-sub { font-size: 0.875rem; line-height: 1.6; color: #6b7280; margin: 0; }
.heading-sub strong { color: #111827; }

.auth-form { display: flex; flex-direction: column; gap: 18px; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 0.8125rem; font-weight: 600; color: #374151; }
.field-input {
  width: 100%; padding: 12px 14px;
  border: 1px solid #d1d5db; border-radius: 6px;
  font-size: 0.9375rem; font-family: inherit; color: #111827; background: #fff;
  outline: none; transition: border-color .12s, box-shadow .12s; min-height: 46px;
}
.field-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(13, 76, 139, .16); }

.error-bar {
  padding: 12px 14px; background: rgba(185, 28, 28, .04);
  border: 1px solid rgba(185, 28, 28, .22); border-left: 3px solid #b91c1c;
  border-radius: 6px; color: #b91c1c;
}
.error-text { font-size: 0.8125rem; font-weight: 500; }

.submit-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; padding: 14px 20px; border-radius: 6px;
  background: var(--brand); color: #fff; font-size: 0.9375rem; font-weight: 600;
  font-family: inherit; border: 1px solid var(--brand); cursor: pointer;
  transition: background .15s; min-height: 48px;
}
.submit-btn:hover:not(:disabled) { background: var(--brand-dark); border-color: var(--brand-dark); }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.4);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.75s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.back-link {
  font-size: 0.8125rem; font-weight: 600; color: var(--brand);
  text-decoration: none; align-self: flex-start;
}
.back-link:hover { text-decoration: underline; }

@media (prefers-reduced-motion: reduce) {
  .spinner { animation-duration: 0.001ms !important; }
}
</style>
