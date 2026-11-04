// Live probe speeds (traffic page) and editing a registered pull feed (feed details page).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTraffic } from '~/composables/api/useTraffic'
import { useIntegrations } from '~/composables/api/useIntegrations'

let $api: ReturnType<typeof vi.fn>
beforeEach(() => {
  $api = vi.fn()
  ;(globalThis as any).useNuxtApp = () => ({ $api })
})

describe('useTraffic.liveProbes', () => {
  it('reads the latest speed per probe point', async () => {
    $api.mockResolvedValue({ count: 0, results: [] })
    await useTraffic().liveProbes()
    expect($api).toHaveBeenCalledWith('/api/v1/traffic/counts/live-probes/')
  })

  it('mapData colours probe points by their live level and greys stale ones', async () => {
    const probe = (id: string, level: string, stale = false) => ({
      station_id: id, station_name: id, latitude: -1.3, longitude: 36.8, avg_speed: 20, free_flow_speed: 60,
      congestion_level: level, stale,
    })
    $api.mockImplementation(async (url: string) => {
      if (url.includes('live-probes')) return { results: [probe('a', 'severe'), probe('b', 'free_flow'), probe('c', 'heavy', true)] }
      if (url.includes('counting-stations')) return { results: [] }
      return { results: [] }
    })
    const { markers } = await useTraffic().mapData()
    const byId = Object.fromEntries(markers.map(m => [m.id, m.color]))
    expect(byId['probe-a']).toBe('red')
    expect(byId['probe-b']).toBe('green')
    expect(byId['probe-c']).toBe('gray')
  })

  it('mapData places a probe-detected congestion event by its own coordinates (no road segment needed)', async () => {
    $api.mockImplementation(async (url: string) => {
      if (url.includes('congestion-events')) {
        return { results: [{ id: 'e1', severity: 'high', segment_id: null, latitude: -1.31, longitude: 36.82,
          station_name: 'Mombasa Rd', avg_speed_kmh: 20, free_flow_speed_kmh: 60, delay_minutes: 4, impact_radius_km: 0 }] }
      }
      return { results: [] }
    })
    const { markers } = await useTraffic().mapData()
    const ev = markers.find(m => m.id === 'event-e1')
    expect(ev).toMatchObject({ lat: -1.31, lon: 36.82, color: 'red' })
  })

  it('mapData keeps probe points out of the generic station query', async () => {
    $api.mockResolvedValue({ results: [] })
    await useTraffic().mapData()
    const stationCall = $api.mock.calls.find(c => String(c[0]).includes('counting-stations'))!
    expect(stationCall[1].query.exclude_station_type).toBe('probe')
  })
})

describe('useIntegrations feed editing', () => {
  it('updateConnection PATCHes only what is passed, to the connection endpoint', async () => {
    $api.mockResolvedValue({ success: true, data: { source_id: 'tomtom-traffic' } })
    await useIntegrations().updateConnection('tomtom-traffic', { key: 'new-key' })
    expect($api).toHaveBeenCalledWith('/api/v1/integrations/tomtom-traffic/connection/', {
      method: 'PATCH', body: { key: 'new-key' },
    })
  })

  it('registerFeed sends just protocol + link + key for a pull feed', async () => {
    $api.mockResolvedValue({ success: true, data: {} })
    await useIntegrations().registerFeed({
      protocol: 'rest_pull', endpoint_value: 'https://api.tomtom.com', auth_method: 'api_key', credentials: { key: 'k' },
    })
    const [url, opts] = $api.mock.calls[0]!
    expect(url).toBe('/api/v1/integrations/register/')
    expect(opts.body).toEqual({ protocol: 'rest_pull', endpoint_value: 'https://api.tomtom.com', auth_method: 'api_key', credentials: { key: 'k' } })
    expect(opts.body.source_id).toBeUndefined()
    expect(opts.body.agency_code).toBeUndefined()
  })
})

describe('useIntegrations area options', () => {
  it('updateConnection can send the monitoring area and point cap', async () => {
    $api.mockResolvedValue({ success: true, data: {} })
    await useIntegrations().updateConnection('tomtom-traffic', { options: { bbox: '36.7,-1.4,36.9,-1.2', max_points: 10 } })
    expect($api).toHaveBeenCalledWith('/api/v1/integrations/tomtom-traffic/connection/', {
      method: 'PATCH', body: { options: { bbox: '36.7,-1.4,36.9,-1.2', max_points: 10 } },
    })
  })
})

describe('segment mapping fields reach the UI types', () => {
  it('live probes carry the UAPTS segment they sit on', async () => {
    $api.mockResolvedValue({ count: 1, results: [{ station_id: 's', segment_road_code: 'A8', segment_name: 'Waiyaki Way' }] })
    const res = await useTraffic().liveProbes()
    expect(res.results[0]!.segment_road_code).toBe('A8')
  })
})
