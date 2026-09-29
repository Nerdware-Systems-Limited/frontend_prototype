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

// Auth flows live in the `useAuthStore` Pinia store (app/stores/auth.ts),
// not a `useAuth` API composable - see tests/unit/store.test.ts for coverage.

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
import { useSafety } from '~/composables/api/useSafety'
import { useAudit } from '~/composables/api/useAudit'
import { useNotifications } from '~/composables/api/useNotifications'
import { useReports } from '~/composables/api/useReports'
import { useIntegrations } from '~/composables/api/useIntegrations'
import { useFleet } from '~/composables/api/useFleet'
import { useSystemApi } from '~/composables/api/useSystem'

describe('domain composables - endpoint mapping', () => {
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

  it('useSafety.createIncident POSTs to /incidents/ and kpis/blackspots list', async () => {
    $api.mockResolvedValue({ id: 'i' })
    const safety = useSafety()
    await safety.createIncident({ incident_type: 'road', severity: 'serious', title: 'Crash' } as any)
    expect($api).toHaveBeenLastCalledWith('/api/v1/safety/incidents/',
      { method: 'POST', body: { incident_type: 'road', severity: 'serious', title: 'Crash' } })

    await safety.kpis({ agency: 'NTSA' } as any)
    expect($api).toHaveBeenLastCalledWith('/api/v1/safety/kpis/', { query: { agency: 'NTSA' } })

    await safety.blackspots()
    expect($api).toHaveBeenLastCalledWith('/api/v1/safety/black-spots/', { query: {} })
  })

  it('useAudit.list fetches the audit log page', async () => {
    $api.mockResolvedValue({ count: 0, results: [] })
    await useAudit().list({ action: 'login', date_from: '2026-06-01' } as any)
    expect($api).toHaveBeenLastCalledWith('/api/v1/audit/logs/',
      { query: { action: 'login', date_from: '2026-06-01' } })
  })

  it('useNotifications - list, unread count, mark one read, mark all read', async () => {
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

  it('useReports.generate POSTs and run() finds the run by id', async () => {
    const r = useReports()
    $api.mockResolvedValueOnce({ id: 'r1' })
    await r.generate({ template_id: 't1', format: 'pdf' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/reports/generate/',
      { method: 'POST', body: { template_id: 't1', format: 'pdf' } })

    $api.mockResolvedValueOnce({ count: 1, results: [{ id: 'r1' }] })
    const found = await r.run('r1')
    expect($api).toHaveBeenLastCalledWith('/api/v1/reports/runs/', { query: { page_size: 50 } })
    expect(found.id).toBe('r1')
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

  it('useFleet.summary / vehicles / tripPath', async () => {
    $api.mockResolvedValue({ results: [] })
    const f = useFleet()
    await f.summary()
    expect($api).toHaveBeenLastCalledWith('/api/v1/fleet/summary/', { query: {} })
    // Dashboard filters are forwarded as query params (empty values dropped).
    await f.summary({ county: 'Kiambu', road: '' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/fleet/summary/', { query: { county: 'Kiambu' } })

    await f.vehicles({ status: 'active' } as any)
    expect($api).toHaveBeenLastCalledWith('/api/v1/fleet/vehicles/', { query: { status: 'active' } })

    await f.tripPath('trip-1')
    expect($api).toHaveBeenLastCalledWith('/api/v1/fleet/trip-playbacks/trip-1/path/')
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