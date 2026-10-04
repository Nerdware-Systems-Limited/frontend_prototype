// tests/unit/access-policy-middleware.test.ts
// ─────────────────────────────────────────────────────────────────────
// The saved Module Access policy comes from the server and needs the access
// token, so middleware/auth.global.ts loads it right after authentication and
// BEFORE the first route is resolved - never for a public route, never for an
// unauthenticated visitor, and only once per session.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

const fetchMock = vi.fn()
;(globalThis as any).$fetch = fetchMock
const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })
const navigateTo = vi.fn((to: string) => ({ redirectedTo: to }))
;(globalThis as any).navigateTo = navigateTo
;(globalThis as any).defineNuxtRouteMiddleware = (fn: unknown) => fn

import { useAccessControl } from '~/composables/useAccessControl'
;(globalThis as any).useAccessControl = useAccessControl

import { useAuthStore } from '~/stores/auth'
import { setAccessPolicyStorage, useAccessPolicyStore } from '~/stores/accessPolicy'
import { localAccessPolicyStorage } from '~/utils/accessPolicyStorage'
import type { PolicyOverrides } from '~/utils/resolveAccess'

const { default: middleware } = await import('~/middleware/auth.global') as { default: (to: { path: string; fullPath: string }) => Promise<unknown> }

const to = (path: string) => ({ path, fullPath: path })
const capM02: PolicyOverrides = { version: 1, agencies: { KENHA: { enabled: { modules: { M02: 'none' } } } } }

function policyStorage(saved: PolicyOverrides) {
  const load = vi.fn(async () => JSON.parse(JSON.stringify(saved)))
  setAccessPolicyStorage({ load, save: vi.fn(async () => {}) })
  return load
}
function signIn(agency_code = 'KENHA', role_type = 'analyst') {
  const user = { id: 'u1', email: 'u1@example.com', agency_code, role_type }
  userRef.value = user
  const auth = useAuthStore()
  auth.user = user as any
  auth.accessToken = 'live-token'
}

beforeEach(() => {
  setActivePinia(createPinia())
  userRef.value = null
  navigateTo.mockClear()
  fetchMock.mockReset()
  localStorage.clear()
  sessionStorage.clear()
})

describe('auth.global - Module Access policy', () => {
  it("resolves the first route against the server's policy, not the baseline alone", async () => {
    const load = policyStorage(capM02)
    signIn()
    const result = await middleware(to('/traffic'))
    expect(load).toHaveBeenCalledTimes(1)
    // The baseline gives KENHA analysts /traffic; the saved policy took it away.
    expect(result).toEqual({ redirectedTo: '/dashboard' })
  })

  it('lets a route through that the policy still allows', async () => {
    policyStorage(capM02)
    signIn()
    expect(await middleware(to('/safety'))).toBeUndefined()
  })

  it('loads once per session, not on every navigation', async () => {
    const load = policyStorage(capM02)
    signIn()
    await middleware(to('/safety'))
    await middleware(to('/infrastructure'))
    await middleware(to('/dashboard'))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('never touches the policy API for a public route', async () => {
    const load = policyStorage(capM02)
    for (const path of ['/login', '/forgot-password', '/reset-password/abc/def']) {
      expect(await middleware(to(path))).toBeUndefined()
    }
    expect(load).not.toHaveBeenCalled()
  })

  it('sends an unauthenticated visitor to login without touching the policy API', async () => {
    const load = policyStorage(capM02)
    const result = await middleware(to('/traffic'))
    expect(load).not.toHaveBeenCalled()
    expect(result).toEqual({ redirectedTo: '/login?redirect=%2Ftraffic' })
  })

  it('loads after a silent refresh too (the come-back-tomorrow case)', async () => {
    const load = policyStorage(capM02)
    const user = { id: 'u1', email: 'u1@example.com', agency_code: 'KENHA', role_type: 'analyst' }
    userRef.value = user
    const auth = useAuthStore()
    auth.user = user as any
    auth.refreshToken = 'stored-refresh'
    fetchMock.mockResolvedValue({ access: 'fresh-access', refresh: 'rotated-refresh' })

    const result = await middleware(to('/traffic'))
    expect(fetchMock).toHaveBeenCalled() // the refresh
    expect(load).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ redirectedTo: '/dashboard' })
  })

  it('a failed policy load falls back to the baseline instead of blocking navigation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setAccessPolicyStorage({ load: vi.fn(async () => { throw new Error('offline') }), save: vi.fn(async () => {}) })
    signIn()
    expect(await middleware(to('/traffic'))).toBeUndefined()
    warn.mockRestore()
  })

  it("does not carry one account's policy over to the next sign-in", async () => {
    const load = policyStorage(capM02)
    signIn('KENHA', 'analyst')
    await middleware(to('/safety'))
    expect(useAccessPolicyStore().overrides.agencies.KENHA).toBeDefined()

    load.mockResolvedValue({ version: 1, agencies: {} })
    const other = { id: 'u2', email: 'u2@example.com', agency_code: 'KENHA', role_type: 'analyst' }
    userRef.value = other
    useAuthStore().user = other as any
    // Same agency, different account: the policy is fetched again, and now allows /traffic.
    expect(await middleware(to('/traffic'))).toBeUndefined()
    expect(load).toHaveBeenCalledTimes(2)
  })
})

// The store keeps its adapter in a module singleton; restore the default for any file sharing this worker.
import { afterAll } from 'vitest'
afterAll(() => setAccessPolicyStorage(localAccessPolicyStorage))
