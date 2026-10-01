// tests/unit/dashboard-api.test.ts
// ─────────────────────────────────────────────────────────────────────
// Dashboard Manager client: DRF error normalisation, 204 -> "no dashboard",
// the /api/v1/dashboards prefix, per-domain filter params, and the dev-proxy
// URL helpers.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { describeApiError, toDashboardApiError, useDashboardApi } from '~/composables/useDashboardApi'
import { domainParams, filterParams } from '~/composables/useDomainData'
import { apiBaseUrl, wsUrl } from '~/utils/apiBase'

const $api = vi.fn()
beforeEach(() => {
  $api.mockReset()
  ;(globalThis as any).useNuxtApp = () => ({ $api })
})

describe('describeApiError', () => {
  it('flattens the three DRF error shapes', () => {
    expect(describeApiError({ detail: "agency 'NTSA': You can only assign within your own agency." }, 403))
      .toBe("agency 'NTSA': You can only assign within your own agency.")
    expect(describeApiError({ definition: ['Widgets w1 and w2 overlap.'] }, 400)).toBe('definition: Widgets w1 and w2 overlap.')
    expect(describeApiError([{ non_field_errors: ['Global scope value must be \'*\'.'] }, {}], 400)).toBe('Global scope value must be \'*\'.')
  })
  it('falls back to a status-based sentence', () => {
    expect(describeApiError(null, 403)).toMatch(/permission/)
    expect(describeApiError(undefined, null)).toMatch(/Couldn't reach the server/)
    expect(describeApiError('', 502)).toMatch(/HTTP 502/)
    expect(describeApiError('<!DOCTYPE html><html>Server Error</html>', 500)).toMatch(/HTTP 500/)
  })
  it('reads status from ofetch errors', () => {
    const e = toDashboardApiError({ status: 403, data: { detail: 'Nope.' } })
    expect(e.status).toBe(403)
    expect(e.message).toBe('Nope.')
  })
})

describe('useDashboardApi', () => {
  it('uses the deployed /api/v1/dashboards prefix', async () => {
    $api.mockResolvedValue([])
    await useDashboardApi().list({ status: 'published' })
    expect($api).toHaveBeenCalledWith('/api/v1/dashboards/', { query: { status: 'published' } })
  })
  it('resolve() maps HTTP 204 (empty body) to null', async () => {
    $api.mockResolvedValue(undefined)
    expect(await useDashboardApi().resolve()).toBeNull()
    $api.mockResolvedValue('')
    expect(await useDashboardApi().resolve()).toBeNull()
  })
  it('resolve() passes ?id= and returns the payload', async () => {
    const payload = { dashboard: { id: 'd1' }, matchedAssignment: null, personalized: false, canPersonalize: false, strippedWidgetIds: [] }
    $api.mockResolvedValue(payload)
    expect(await useDashboardApi().resolve({ dashboardId: 'd1' })).toEqual(payload)
    expect($api).toHaveBeenCalledWith('/api/v1/dashboards/resolve/', { query: { id: 'd1' } })
  })
  it('rejects with a readable DashboardApiError', async () => {
    $api.mockRejectedValue({ status: 403, data: { detail: 'This dashboard belongs to another agency.' } })
    await expect(useDashboardApi().get('x')).rejects.toMatchObject({ status: 403, message: 'This dashboard belongs to another agency.' })
  })
})

describe('domain filter params', () => {
  const all = filterParams({ county: 'Kiambu', road: 'A8', agency: 'KeNHA', date_range: { from: '2026-09-01', to: '2026-09-10' } })
  it('sends only what each endpoint honours', () => {
    expect(domainParams('safety', all)).toEqual({})
    expect(domainParams('fleet', all)).toEqual({})
    expect(domainParams('infra', all)).toEqual({ agency: 'KeNHA' })
  })
})

describe('apiBase helpers', () => {
  it('uses the absolute backend URL when not proxied (tests / production)', () => {
    expect(apiBaseUrl()).toBe('http://test.local:8000')
    expect(wsUrl('ws://192.168.0.110:8000/ws/audit/')).toBe('ws://192.168.0.110:8000/ws/audit/')
  })
  it('HTTP goes same-origin when the dev proxy is on, but WebSockets always go straight to the backend', () => {
    const original = (globalThis as any).useRuntimeConfig
    ;(globalThis as any).useRuntimeConfig = () => ({ public: { apiBase: 'http://192.168.0.110:8000', apiProxy: true } })
    try {
      expect(apiBaseUrl()).toBe('')
      // Not rewritten to this page's own host: nuxi dev's WS proxy never
      // upgrades the connection (Vite's own HMR WebSocket server claims the
      // `upgrade` event first), so wsUrl() is a passthrough - see its docstring.
      expect(wsUrl('ws://192.168.0.110:8000/ws/notifications/')).toBe('ws://192.168.0.110:8000/ws/notifications/')
    } finally {
      ;(globalThis as any).useRuntimeConfig = original
    }
  })
})
