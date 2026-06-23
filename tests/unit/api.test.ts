// tests/unit/api.test.ts
// ─────────────────────────────────────────────────────────────────────
// Domain API composable unit tests. Each composable is exercised by
// stubbing the $api plugin via useNuxtApp() and asserting the call
// shape and response mapping.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Test-time Nuxt app stub ─────────────────────────────────────────────────
// The composables call `useNuxtApp()` to get `$api`. We override it
// for the duration of each test.
function installNuxtApp() {
  const $api = vi.fn()
  ;(globalThis as any).useNuxtApp = () => ({ $api })
  ;(globalThis as any).useRuntimeConfig = () => ({
    public: { apiBase: 'http://test.local:8000' },
  })
  ;(globalThis as any).useState = <T>(_k: string, init: () => T): { value: T } => {
    // minimal reactive state stub
    return { value: init() } as any
  }
  return $api
}

// ── cleanQuery tests (no Nuxt needed) ───────────────────────────────────────
import { cleanQuery } from '~/composables/api/_client'

describe('cleanQuery', () => {
  it('drops null / undefined / empty-string values', () => {
    expect(cleanQuery({ a: 1, b: null, c: undefined, d: '', e: 'x' })).toEqual({ a: 1, e: 'x' })
  })
  it('keeps booleans, numbers and strings as-is', () => {
    expect(cleanQuery({ flag: true, n: 0, s: 'hello' })).toEqual({ flag: true, n: 0, s: 'hello' })
  })
  it('handles undefined input', () => {
    expect(cleanQuery(undefined)).toEqual({})
  })
})

// ── Auth API composable ────────────────────────────────────────────────────
import { useAuthApi } from '~/composables/api/useAuth'

describe('useAuthApi', () => {
  let $api: any
  beforeEach(() => { $api = installNuxtApp() })

  it('login POSTs to /api/v1/auth/login/ with credentials', async () => {
    $api.mockResolvedValueOnce({ access: 'A', refresh: 'R', user: { id: '1' } })
    const out = await useAuthApi().login({ email: 'a@b.c', password: 'pw' })
    expect($api).toHaveBeenCalledWith('/api/v1/auth/login/', { method: 'POST', body: { email: 'a@b.c', password: 'pw' } })
    expect(out.access).toBe('A')
  })

  it('refresh POSTs the refresh token', async () => {
    $api.mockResolvedValueOnce({ access: 'NEW_A' })
    await useAuthApi().refresh('OLD_R')
    expect($api).toHaveBeenCalledWith('/api/v1/auth/token/refresh/', { method: 'POST', body: { refresh: 'OLD_R' } })
  })

  it('logout attaches the access token to Authorization header', async () => {
    $api.mockResolvedValueOnce({})
    await useAuthApi().logout('R', 'A')
    expect($api).toHaveBeenCalledWith('/api/v1/auth/logout/', {
      method: 'POST',
      headers: { Authorization: 'Bearer A' },
      body: { refresh: 'R' },
    })
  })

  it('register / changePassword / passwordReset map to their endpoints', async () => {
    $api.mockResolvedValue({})
    const api = useAuthApi()
    await api.register({ email: 'x@y.z', password1: 'a', password2: 'a' })
    await api.changePassword({ old_password: 'o', new_password1: 'n', new_password2: 'n' })
    await api.requestPasswordReset({ email: 'x@y.z' })
    await api.confirmPasswordReset({ uid: 'u', token: 't', new_password1: 'n', new_password2: 'n' })

    expect($api.mock.calls[0][0]).toBe('/api/v1/auth/register/')
    expect($api.mock.calls[1][0]).toBe('/api/v1/auth/password/change/')
    expect($api.mock.calls[2][0]).toBe('/api/v1/auth/password/reset/')
    expect($api.mock.calls[3][0]).toBe('/api/v1/auth/password/reset/confirm/')
  })
})

// ── Accounts API composables ────────────────────────────────────────────────
import { useAgencies, useUsers } from '~/composables/api/useAccounts'

describe('useAgencies', () => {
  let $api: any
  beforeEach(() => { $api = installNuxtApp() })

  it('list / get / create / update / remove hit the right endpoints', async () => {
    $api.mockResolvedValue({ id: 'x' })
    const a = useAgencies()
    await a.list({ page: 1 })
    expect($api).toHaveBeenLastCalledWith('/api/v1/accounts/agencies/', { query: { page: 1 } })

    await a.get('id1')
    expect($api).toHaveBeenLastCalledWith('/api/v1/accounts/agencies/id1/')

    await a.create({ agency_code: 'NTSA', agency_name: 'X' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/accounts/agencies/',
      { method: 'POST', body: { agency_code: 'NTSA', agency_name: 'X' } })

    await a.update('id1', { agency_name: 'Y' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/accounts/agencies/id1/',
      { method: 'PATCH', body: { agency_name: 'Y' } })

    await a.remove('id1')
    expect($api).toHaveBeenLastCalledWith('/api/v1/accounts/agencies/id1/', { method: 'DELETE' })
  })
})

describe('useUsers', () => {
  let $api: any
  beforeEach(() => { $api = installNuxtApp() })

  it('me() hits /api/v1/auth/user/', async () => {
    $api.mockResolvedValue({ id: 'me' })
    await useUsers().me()
    expect($api).toHaveBeenLastCalledWith('/api/v1/auth/user/')
  })
})

// ── Domain API composables ──────────────────────────────────────────────────
import { useTraffic } from '~/composables/api/useTraffic'
import { usePublicTransport } from '~/composables/api/usePublicTransport'
import { useIncidents } from '~/composables/api/useIncidents'
import { useAudit } from '~/composables/api/useAudit'
import { useNotifications } from '~/composables/api/useNotifications'
import { useReports } from '~/composables/api/useReports'
import { useIntegrations } from '~/composables/api/useIntegrations'
import { useFleet } from '~/composables/api/useFleet'
import { useSystemApi } from '~/composables/api/useSystem'

describe('domain composables — endpoint mapping', () => {
  let $api: any
  beforeEach(() => { $api = installNuxtApp() })

  it('useTraffic.summary / counts / countingStations / forecasts', async () => {
      $api.mockResolvedValue({ results: [], count: 0 })
      const t = useTraffic()
      await t.summary()
      expect($api).toHaveBeenLastCalledWith('/api/v1/traffic/summary/')

      await t.counts({ segment: 's-1', congestion: 'heavy' })
      expect($api).toHaveBeenLastCalledWith('/api/v1/traffic/counts/', { query: { segment: 's-1', congestion: 'heavy' } })

      await t.countingStations()
      expect($api).toHaveBeenLastCalledWith('/api/v1/traffic/counting-stations/', { query: {} })

      await t.forecasts({ horizon: 12 })
      expect($api).toHaveBeenLastCalledWith('/api/v1/traffic/forecasts/', { query: { horizon: 12 } })

      await t.activeCongestion()
      expect($api).toHaveBeenLastCalledWith('/api/v1/traffic/congestion-events/active/')

      await t.resolveAlert('alert-42')
      expect($api).toHaveBeenLastCalledWith('/api/v1/traffic/alerts/alert-42/resolve/', { method: 'POST' })
    })

    it('usePublicTransport.summary / routes / saccos / leaderboard / payments', async () => {
      $api.mockResolvedValue({ results: [], count: 0 })
      const pt = usePublicTransport()
      await pt.summary()
      expect($api).toHaveBeenLastCalledWith('/api/v1/public-transport/summary/')

      await pt.routes({ service_type: 'matatu' })
      expect($api).toHaveBeenLastCalledWith('/api/v1/public-transport/routes/', { query: { service_type: 'matatu' } })

      await pt.saccos({ status: 'active' })
      expect($api).toHaveBeenLastCalledWith('/api/v1/public-transport/saccos/', { query: { status: 'active' } })

      await pt.leaderboard()
      expect($api).toHaveBeenLastCalledWith('/api/v1/public-transport/operator-metrics/leaderboard/')

      await pt.expiringLicenses(180)
      expect($api).toHaveBeenLastCalledWith('/api/v1/public-transport/psv-licenses/expiring/?days=180')

      await pt.publishFeed('feed-1')
      expect($api).toHaveBeenLastCalledWith('/api/v1/public-transport/feeds/feed-1/publish/', { method: 'POST' })
    })

  it('useIncidents.report POSTs to /incidents/ and kpis/blackspots work', async () => {
    $api.mockResolvedValue({ id: 'i' })
    const inc = useIncidents()
    await inc.report({ mode: 'road', severity: 'high', title: 'Crash' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/incidents/',
      { method: 'POST', body: { mode: 'road', severity: 'high', title: 'Crash' } })

    await inc.kpis('NTSA')
    expect($api).toHaveBeenLastCalledWith('/api/v1/safety/kpis/NTSA/')

    await inc.blackspots()
    expect($api).toHaveBeenLastCalledWith('/api/v1/safety/blackspots/')
  })

  it('useAudit.exportUrl builds a query string', () => {
    const url = useAudit().exportUrl({ action: 'login', date_from: '2026-06-01' })
    expect(url).toContain('/api/v1/audit/export/')
    expect(url).toContain('action=login')
    expect(url).toContain('date_from=2026-06-01')
  })

  it('useNotifications — list, unread count, mark one read, mark all read', async () => {
    $api.mockResolvedValue({})
    const n = useNotifications()
    // list (unread only)
    await n.list({ unread: true })
    expect($api).toHaveBeenLastCalledWith(
      '/api/v1/notifications/',
      expect.objectContaining({ query: expect.objectContaining({ unread: 'true' }) }),
    )
    // unread count
    await n.unreadCount()
    expect($api).toHaveBeenLastCalledWith('/api/v1/notifications/unread-count/')
    // mark one read
    await n.markRead('abc')
    expect($api).toHaveBeenLastCalledWith('/api/v1/notifications/abc/read/', { method: 'POST' })
    // mark all read
    await n.markAllRead()
    expect($api).toHaveBeenLastCalledWith('/api/v1/notifications/read-all/', { method: 'POST', body: {} })
  })

  it('useReports.generate and downloadUrl', async () => {
    $api.mockResolvedValue({ id: 'r1' })
    const r = useReports()
    await r.generate({ template_id: 't1', format: 'pdf' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/reports/generate/',
      { method: 'POST', body: { template_id: 't1', format: 'pdf' } })

    expect(r.downloadUrl('r1')).toBe('/api/v1/reports/r1/download/')
  })

  it('useIntegrations.trigger / pause / resume', async () => {
    $api.mockResolvedValue({})
    const i = useIntegrations()
    await i.trigger('int1')
    expect($api).toHaveBeenLastCalledWith('/api/v1/integrations/int1/trigger/', { method: 'POST' })
    await i.pause('int1')
    expect($api).toHaveBeenLastCalledWith('/api/v1/integrations/int1/pause/', { method: 'POST' })
    await i.resume('int1')
    expect($api).toHaveBeenLastCalledWith('/api/v1/integrations/int1/resume/', { method: 'POST' })
  })

  it('useFleet.positions / history / maintenance', async () => {
    $api.mockResolvedValue({ results: [] })
    const f = useFleet()
    await f.positions({ mode: 'rail' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/fleet/positions/', { query: { mode: 'rail' } })

    await f.history('v1')
    expect($api).toHaveBeenLastCalledWith('/api/v1/fleet/v1/history/', { query: {} })

    await f.maintenance('v1')
    expect($api).toHaveBeenLastCalledWith('/api/v1/fleet/v1/maintenance/')
  })

  it('useSystemApi.banner / health / schema', async () => {
    $api.mockResolvedValue({})
    const sys = useSystemApi()
    await sys.banner()
    expect($api).toHaveBeenLastCalledWith('/api/')
    await sys.health()
    expect($api).toHaveBeenLastCalledWith('/api/v1/health/')
    await sys.schema()
    expect($api).toHaveBeenLastCalledWith('/api/schema/?format=json')
  })
})