// tests/unit/store.test.ts
// ─────────────────────────────────────────────────────────────────────
// Pinia auth store unit tests. These don't hit the network - they
// stub `$fetch` so we can verify the store's contract:
//
//   - login() persists tokens & user
//   - refreshAccessToken() rotates the access token
//   - forceLogout() clears state
//   - hydrate() restores from localStorage
//
// `tests/setup.ts` polyfills Nuxt's auto-imports (`ref`, `computed`,
// `useRuntimeConfig`, `useNuxtApp`) as globals so the store source can
// be imported unchanged. We only need to stub `$fetch` here.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Stub Nuxt's $fetch (used by the store) so we can drive it from tests.
const $fetchMock = vi.fn()
;(globalThis as any).$fetch = $fetchMock

import { useAuthStore } from '~/stores/auth'

beforeEach(() => {
  setActivePinia(createPinia())
  $fetchMock.mockReset()
  // Reset browser storage between tests (tests/setup.ts also does this in
  // afterEach, but we reset here too so each test starts fresh).
  localStorage.clear()
  sessionStorage.clear()
})

describe('useAuthStore', () => {
  it('starts unauthenticated with no tokens', () => {
    const s = useAuthStore()
    expect(s.isAuthenticated).toBe(false)
    expect(s.accessToken).toBeNull()
    expect(s.refreshToken).toBeNull()
    expect(s.user).toBeNull()
  })

  it('login() stores tokens, persists to localStorage, sets user', async () => {
    $fetchMock.mockResolvedValueOnce({
      access: 'ACCESS.1',
      refresh: 'REFRESH.1',
      user: { id: 'u1', email: 'a@ntsa.go.ke', role_type: 'admin' },
    })
    const s = useAuthStore()
    await s.login('a@ntsa.go.ke', 'pw', /*remember=*/true)

    expect(s.isAuthenticated).toBe(true)
    expect(s.accessToken).toBe('ACCESS.1')
    expect(s.refreshToken).toBe('REFRESH.1')
    expect(s.user?.email).toBe('a@ntsa.go.ke')
    // remember=true → localStorage (not sessionStorage)
    expect(localStorage.getItem('uapts_refresh')).toBe('REFRESH.1')
    expect(JSON.parse(localStorage.getItem('uapts_user')!).email).toBe('a@ntsa.go.ke')
  })

  it('login() with remember=false persists to sessionStorage', async () => {
    $fetchMock.mockResolvedValueOnce({
      access: 'A', refresh: 'R', user: { id: 'u', email: 'x@x.x', role_type: 'public' },
    })
    const s = useAuthStore()
    await s.login('x@x.x', 'pw', false)
    expect(sessionStorage.getItem('uapts_refresh')).toBe('R')
  })

  it('refreshAccessToken() updates access token, persists rotated refresh', async () => {
    const s = useAuthStore()
    s.accessToken = 'OLD_ACCESS'
    s.refreshToken = 'OLD_REFRESH'

    $fetchMock.mockResolvedValueOnce({ access: 'NEW_ACCESS', refresh: 'NEW_REFRESH' })

    const newTok = await s.refreshAccessToken()
    expect(newTok).toBe('NEW_ACCESS')
    expect(s.accessToken).toBe('NEW_ACCESS')
    expect(s.refreshToken).toBe('NEW_REFRESH')
    expect(localStorage.getItem('uapts_refresh')).toBe('NEW_REFRESH')
  })

  it('refreshAccessToken() returns null and clears state on failure', async () => {
    const s = useAuthStore()
    s.accessToken = 'A'
    s.refreshToken = 'R'
    $fetchMock.mockRejectedValueOnce(new Error('expired'))

    const newTok = await s.refreshAccessToken()
    expect(newTok).toBeNull()
    expect(s.accessToken).toBeNull()
    expect(s.refreshToken).toBeNull()
  })

  it('hydrate() restores tokens from localStorage', () => {
    localStorage.setItem('uapts_refresh', 'PERSISTED')
    localStorage.setItem('uapts_user', JSON.stringify({ id: 'u1', email: 'h@y.z', role_type: 'analyst' }))

    const s = useAuthStore()
    s.hydrate()
    expect(s.refreshToken).toBe('PERSISTED')
    expect(s.user?.email).toBe('h@y.z')
  })

  it('forceLogout() clears all state and storage', () => {
    localStorage.setItem('uapts_refresh', 'X')
    localStorage.setItem('uapts_user', '{"email":"a@b.c"}')

    const s = useAuthStore()
    s.accessToken = 'A'
    s.refreshToken = 'X'
    s.user = { id: '1', email: 'a@b.c', role_type: 'public' } as any

    s.forceLogout()
    expect(s.accessToken).toBeNull()
    expect(s.refreshToken).toBeNull()
    expect(s.user).toBeNull()
    expect(localStorage.getItem('uapts_refresh')).toBeNull()
  })

  it('userInitials is derived from full_name / email', () => {
    const s = useAuthStore()
    s.user = { id: '1', email: 'jane.doe@ntsa.go.ke', full_name: 'Jane Doe', role_type: 'analyst' } as any
    expect(s.userInitials).toBe('JD')

    s.user = { id: '2', email: 'solo@ntsa.go.ke', role_type: 'public' } as any
    // email local-part "solo" → capitalised = "Solo" → first letter only
    expect(s.userInitials.length).toBeGreaterThan(0)
  })

  it('logout() calls the logout endpoint and clears state', async () => {
    const s = useAuthStore()
    s.accessToken = 'A'
    s.refreshToken = 'R'

    $fetchMock.mockResolvedValueOnce({})  // POST /auth/logout/

    await s.logout()
    expect($fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/logout/'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(s.accessToken).toBeNull()
    expect(s.refreshToken).toBeNull()
  })

  it('fetchMe() normalises the user payload (no full_name → derived from email)', async () => {
    $fetchMock.mockResolvedValueOnce({
      id: 'u1', email: 'alice@ntsa.go.ke', role_type: 'operator',
      role: null, role_name: null, agency: null, agency_code: null, department: null,
      mfa_active: false, is_active: true, is_staff: false, created_at: '2026-06-18T12:00:00Z',
    })
    const s = useAuthStore()
    s.accessToken = 'A'
    await s.fetchMe()
    expect(s.user?.email).toBe('alice@ntsa.go.ke')
    expect(s.user?.full_name).toBe('Alice')
  })
})