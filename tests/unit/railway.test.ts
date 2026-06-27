// tests/unit/railway.test.ts
// ─────────────────────────────────────────────────────────────────────
// Unit tests for the M08 Railway Management composable (useRailway).
//
// Mirrors the test pattern used for useTraffic / usePublicTransport:
// stub $api, exercise each method, and assert the call shape.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'

function installNuxtApp() {
  const $api = vi.fn()
  ;(globalThis as any).useNuxtApp = () => ({ $api })
  ;(globalThis as any).useRuntimeConfig = () => ({
    public: { apiBase: 'http://test.local:8000' },
  })
  return $api
}

import { useRailway } from '~/composables/api/useRailway'

describe('useRailway - catalog', () => {
  let $api: any
  beforeEach(() => { $api = installNuxtApp() })

  it('lines() hits /api/v1/railway/lines/', async () => {
    $api.mockResolvedValueOnce({ count: 500, results: [] })
    const out = await useRailway().lines({ network: 'sgr' })
    expect($api).toHaveBeenCalledWith(
      '/api/v1/railway/lines/',
      expect.objectContaining({
        query: expect.objectContaining({ network: 'sgr' }),
      }),
    )
    expect(out.count).toBe(500)
  })

  it('stations() forwards filter params', async () => {
    $api.mockResolvedValueOnce({ count: 28, results: [] })
    await useRailway().stations({ station_type: 'terminal' })
    const [path, opts] = $api.mock.calls[0]
    expect(path).toBe('/api/v1/railway/stations/')
    expect(opts.query.station_type).toBe('terminal')
  })

  it('trains() / schedules() / operations() hit the right URL', async () => {
    $api.mockResolvedValue({ count: 0, results: [] })
    const r = useRailway()
    await r.trains()
    await r.schedules()
    await r.operations()
    expect($api.mock.calls[0][0]).toBe('/api/v1/railway/trains/')
    expect($api.mock.calls[1][0]).toBe('/api/v1/railway/schedules/')
    expect($api.mock.calls[2][0]).toBe('/api/v1/railway/operations/')
  })

  it('freight() forwards days + cargo filter', async () => {
    $api.mockResolvedValueOnce({ count: 0, results: [] })
    await useRailway().freight({ days: 7, cargo_type: 'container' })
    const [, opts] = $api.mock.calls[0]
    expect(opts.query.days).toBe(7)
    expect(opts.query.cargo_type).toBe('container')
  })

  it('incidents() and tickets() hit the right URL', async () => {
    $api.mockResolvedValue({ count: 0, results: [] })
    await useRailway().incidents()
    await useRailway().tickets()
    expect($api.mock.calls[0][0]).toBe('/api/v1/railway/incidents/')
    expect($api.mock.calls[1][0]).toBe('/api/v1/railway/tickets/')
  })
})

describe('useRailway - summary + actions', () => {
  let $api: any
  beforeEach(() => { $api = installNuxtApp() })

  it('summary() hits /api/v1/railway/summary/ with no body', async () => {
    $api.mockResolvedValueOnce({ kpis: {}, live_operations: [], on_time_30d: {} })
    await useRailway().summary()
    expect($api).toHaveBeenCalledWith('/api/v1/railway/summary/')
  })

  it('liveOperations() hits /operations/live/', async () => {
    $api.mockResolvedValueOnce([])
    await useRailway().liveOperations()
    expect($api).toHaveBeenCalledWith('/api/v1/railway/operations/live/')
  })

  it('onTimeStats defaults to 30 days', async () => {
    $api.mockResolvedValueOnce({ days: 30, total_operations: 0 })
    await useRailway().onTimeStats()
    expect($api).toHaveBeenCalledWith('/api/v1/railway/operations/on-time-stats/?days=30')
  })

  it('onTimeStats honors custom days', async () => {
    $api.mockResolvedValueOnce({ days: 7 })
    await useRailway().onTimeStats(7)
    expect($api).toHaveBeenCalledWith('/api/v1/railway/operations/on-time-stats/?days=7')
  })

  it('freightByCorridor hits /freight/by-corridor/', async () => {
    $api.mockResolvedValueOnce({ count: 0, results: [] })
    await useRailway().freightByCorridor(60)
    expect($api).toHaveBeenCalledWith('/api/v1/railway/freight/by-corridor/?days=60')
  })

  it('incidentStats hits /incidents/stats/', async () => {
    $api.mockResolvedValueOnce({ total: 0 })
    await useRailway().incidentStats(90)
    expect($api).toHaveBeenCalledWith('/api/v1/railway/incidents/stats/?days=90')
  })

  it('revenueByRoute hits /tickets/by-route/', async () => {
    $api.mockResolvedValueOnce({ count: 0, results: [] })
    await useRailway().revenueByRoute(30)
    expect($api).toHaveBeenCalledWith('/api/v1/railway/tickets/by-route/?days=30')
  })
})

describe('useRailway - mapData()', () => {
  let $api: any
  beforeEach(() => { $api = installNuxtApp() })

  it('fetches rail-lines + rail-stations GeoJSON and converts to map spec', async () => {
    $api
      .mockResolvedValueOnce({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[36.8, -1.3], [37.1, -0.5]] },
            properties: { id: 'l1', name: 'Mombasa-Nairobi SGR', network: 'sgr', electrification: true },
          },
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[36.0, -0.4], [34.8, -0.1]] },
            properties: { id: 'l2', name: 'Nakuru-Kisumu MGR', network: 'mgr' },
          },
        ],
        count: 2,
      })
      .mockResolvedValueOnce({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [36.82, -1.29] },
            properties: { id: 's1', code: 'NBO', name: 'Nairobi Terminus', station_type: 'terminal', network: 'sgr' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [39.66, -4.04] },
            properties: { id: 's2', code: 'MSA', name: 'Mombasa', station_type: 'terminal', network: 'sgr' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [34.77, -0.09] },
            properties: { id: 's3', code: 'KSM', name: 'Kisumu', station_type: 'intermediate', network: 'mgr' },
          },
        ],
        count: 3,
      })

    const { lines, markers } = await useRailway().mapData()

    // 2 line segments
    expect(lines).toHaveLength(2)
    // SGR should be blue, MGR green
    const sgr = lines.find((l) => l.id === 'rail-l1')
    const mgr = lines.find((l) => l.id === 'rail-l2')
    expect(sgr?.color).toBe('#3b82f6')   // SGR blue
    expect(mgr?.color).toBe('#10b981')   // MGR green
    // GeoJSON [lon, lat] → [lat, lon]
    expect(sgr?.points[0]).toEqual([-1.3, 36.8])
    expect(sgr?.points[1]).toEqual([-0.5, 37.1])

    // 3 markers
    expect(markers).toHaveLength(3)
    const nbo = markers.find((m) => m.id === 'station-s1')
    expect(nbo?.color).toBe('red')      // terminal → red
    expect(nbo?.size).toBe('lg')        // terminal → large
    expect(nbo?.lat).toBe(-1.29)
    expect(nbo?.lon).toBe(36.82)
    const ksm = markers.find((m) => m.id === 'station-s3')
    expect(ksm?.color).toBe('green')    // MGR intermediate → green
    expect(ksm?.size).toBe('sm')        // not terminal → small
  })

  it('skips features with no geometry', async () => {
    $api
      .mockResolvedValueOnce({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: {} }], count: 0 })
      .mockResolvedValueOnce({ type: 'FeatureCollection', features: [], count: 0 })

    const { lines, markers } = await useRailway().mapData()
    expect(lines).toHaveLength(0)
    expect(markers).toHaveLength(0)
  })
})
