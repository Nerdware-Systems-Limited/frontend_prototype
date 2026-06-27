// @vitest-environment node
// tests/integration/live.test.ts
// ─────────────────────────────────────────────────────────────────────
// Live-integration tests - talk to the actual UAPTS backend running at
// http://127.0.0.1:8000 (per uapts_frontend/.env NUXT_PUBLIC_API_BASE).
//
// Runs under the `node` Vitest environment so the native fetch is used
// (happy-dom strips Authorization headers on cross-origin requests,
// which silently breaks every authenticated probe).
//
// Skipped automatically when:
//   - The backend is unreachable (e.g. CI without the dev server)
//   - UAPTS_SKIP_LIVE=1 is set in the env
//
// Run locally with: `npm run test` while `manage.py runserver` is up.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll } from 'vitest'

// Vitest + happy-dom doesn't always expose Node's process.env - fall back
// to import.meta.env if the conventional one is missing.
const _env: any = (typeof process !== 'undefined' && process.env) ? process.env : (import.meta as any).env ?? {}
const BASE = _env.UAPTS_API_BASE ?? 'http://127.0.0.1:8000'
const SKIP = _env.UAPTS_SKIP_LIVE === '1' || _env.VITEST_SKIP_LIVE === '1'

const EMAIL    = _env.UAPTS_TEST_EMAIL    ?? 'admin@uapts.go.ke'
// Default password matches the superuser seeded by `seed_admin.py`.
// Override via env var `UAPTS_TEST_PASSWORD` for CI / staging.
const PASSWORD = _env.UAPTS_TEST_PASSWORD ?? 'devpass123'

async function reachable(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const r = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    return r.ok || r.status < 500
  } catch (e) {
    // Surface the error in CI logs.
    if (process?.env?.VITEST_DEBUG) console.error('reachable failed for', url, e)
    return false
  }
}

async function req(path: string, opts: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', ...(opts.headers as any),
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { ...opts, headers })
  const text = await res.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (_env.VITEST_DEBUG) console.log('REQ', opts.method || 'GET', path, '->', res.status, body?.detail ?? body)
  return { status: res.status, body }
}

let liveAvailable = false
let accessToken = ''
let refreshToken = ''

beforeAll(async () => {
  if (SKIP) return
  liveAvailable = await reachable(`${BASE}/api/`)
  if (!liveAvailable) {
    if (_env.VITEST_DEBUG) console.warn(`live.test.ts: backend at ${BASE} not reachable; live tests will be skipped`)
    return
  }

  // Bootstrap: login to get a real token for the protected tests below.
  const r = await req('/api/v1/auth/login/', {
    method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (_env.VITEST_DEBUG) console.log('login response status', r.status, JSON.stringify(r.body).slice(0, 200))
  if (r.status === 200 && r.body?.access) {
    accessToken = String(r.body.access).trim()
    refreshToken = String(r.body.refresh ?? '').trim()
  } else {
    accessToken = ''
    if (_env.VITEST_DEBUG) console.warn('login did not return tokens - live tests will fail')
  }
})

const itLive = SKIP ? it.skip : (liveAvailable ? it : it.skip)

describe('live backend @ ' + BASE + (SKIP ? ' [SKIPPED via env]' : ''), () => {
  it('GET /api/ returns the UAPTS banner', async () => {
    if (SKIP) return
    if (!liveAvailable) { expect.fail('Backend not reachable') ; return }
    const r = await req('/api/')
    expect(r.status).toBe(200)
    expect(r.body.name).toBe('UAPTS API')
  })

  it('GET /api/v1/health/ reports Redis + Mongo ok', async () => {
    if (SKIP) return
    if (!liveAvailable) { expect.fail('Backend not reachable') ; return }
    const r = await req('/api/v1/health/')
    expect(r.status).toBe(200)
    expect(r.body.components.redis_cache?.status).toBe('ok')
    expect(r.body.components.mongodb?.status).toBe('ok')
  })

  it('POST /api/v1/auth/login/ yields access+refresh tokens', async () => {
    if (SKIP) return
    if (!liveAvailable) { expect.fail('Backend not reachable') ; return }
    expect(accessToken).toBeTruthy()
    expect(refreshToken).toBeTruthy()
  })

  it('GET /api/v1/auth/user/ returns the logged-in user', async () => {
    if (SKIP) return
    if (!liveAvailable) { expect.fail('Backend not reachable') ; return }
    if (!accessToken) { expect.fail('Login failed; cannot test /auth/user/') ; return }
    // Inline debug if token unexpectedly fails
    const r = await req('/api/v1/auth/user/', {}, accessToken)
    if (r.status !== 200) {
      expect.fail(`auth/user/ returned ${r.status}; body=${JSON.stringify(r.body).slice(0, 200)}; access=${accessToken.slice(0, 20)}…`)
    }
    expect(r.body.email).toBe(EMAIL)
  })

  it('GET /api/v1/accounts/agencies/ is paginated', async () => {
    if (SKIP) return
    if (!liveAvailable) { expect.fail('Backend not reachable') ; return }
    if (!accessToken) { expect.fail('Login failed; cannot test /accounts/agencies/') ; return }
    const r = await req('/api/v1/accounts/agencies/', {}, accessToken)
    expect(r.status).toBe(200)
    expect(r.body).toHaveProperty('results')
    expect(Array.isArray(r.body.results)).toBe(true)
  })

  it('POST /api/v1/accounts/agencies/ duplicate → 409 conflict envelope', async () => {
    if (SKIP) return
    if (!liveAvailable) { expect.fail('Backend not reachable') ; return }
    if (!accessToken) { expect.fail('Login failed') ; return }
    const r = await req('/api/v1/accounts/agencies/', {
      method: 'POST',
      body: JSON.stringify({ agency_code: 'NTSA', agency_name: 'X', contact_email: 'x@ntsa.go.ke' }),
    }, accessToken)
    // Either 201 (no NTSA in the db yet) or 409 (already exists) - both valid.
    expect([201, 409]).toContain(r.status)
    if (r.status === 409) {
      expect(r.body.code).toBe('conflict')
      expect(Array.isArray(r.body.errors)).toBe(true)
    }
  })

  it('POST /api/v1/auth/token/refresh/ returns a new access token', async () => {
    if (SKIP) return
    if (!liveAvailable) { expect.fail('Backend not reachable') ; return }
    if (!refreshToken) { expect.fail('No refresh token from login') ; return }
    const r = await req('/api/v1/auth/token/refresh/', {
      method: 'POST', body: JSON.stringify({ refresh: refreshToken }),
    })
    expect(r.status).toBe(200)
    expect(typeof r.body.access).toBe('string')
    expect(r.body.access.length).toBeGreaterThan(20)
  })
})