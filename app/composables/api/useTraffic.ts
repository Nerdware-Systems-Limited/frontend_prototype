// app/composables/api/useTraffic.ts
// ─────────────────────────────────────────────────────────────────────
// M02 - Road Traffic Management (FR-M02-001..014)
//
// Backend mounted at /api/v1/traffic/. ViewSets implemented:
//   counting-stations, counts, classifications, speed-observations,
//   congestion-events, route-optimizations, forecasts, od-matrices,
//   weather, alerts.
// Plus the one-shot analytics endpoint at /summary/.

import { useApi, cleanQuery, scopeArgs } from './_client'
import type { Paged } from '~/types/uapts'

export type CongestionLevel = 'free_flow' | 'moderate' | 'heavy' | 'severe'
export type TrafficSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface CountingStation {
  id: string
  station_code: string
  station_name: string
  agency?: string | null
  agency_code?: string | null
  station_type: 'atc' | 'wim' | 'manual' | 'video'
  segment?: string | null
  segment_id?: string | null
  latitude?: number | null
  longitude?: number | null
  speed_limit_kmh?: number | null
  equipment_status: 'operational' | 'degraded' | 'offline' | 'maintenance'
  last_calibration_at?: string | null
  data_quality_score: number
  created_at?: string
  updated_at?: string
}

export interface TrafficCount {
  id: string
  segment: string
  segment_id?: string
  station?: string | null
  station_code?: string | null
  vehicle_vol: number
  avg_speed?: number | null
  occupancy_pct?: number | null
  congestion_level: CongestionLevel
  recorded_at: string
}

export interface VehicleClassification {
  id: string
  station: string
  station_code?: string
  vehicle_class: 'motorcycle' | 'car' | 'light_truck' | 'heavy_truck' | 'bus' | 'other'
  count: number
  avg_speed_kmh?: number | null
  recorded_at: string
}

export interface SpeedObservation {
  id: string
  station: string
  station_code?: string
  avg_speed_kmh: number
  p50_speed_kmh?: number | null
  p85_speed_kmh?: number | null
  speed_limit_kmh: number
  compliance_pct: number
  sample_count: number
  recorded_at: string
}

export interface CongestionEvent {
  id: string
  segment: string
  segment_id?: string
  segment_road_code?: string | null
  severity: TrafficSeverity
  status: 'active' | 'cleared' | 'scheduled'
  avg_speed_kmh: number
  free_flow_speed_kmh: number
  delay_minutes: number
  impact_radius_km: number
  expected_duration_min: number
  started_at: string
  ended_at?: string | null
  description: string
}

export interface RouteOptimization {
  id: string
  event: string
  origin_label: string
  destination_label: string
  detour_distance_km: number
  estimated_time_saving_min: number
  confidence_pct: number
  polyline: [number, number][]
  created_at: string
}

export interface TrafficForecast {
  id: string
  segment: string
  segment_id?: string
  segment_road_code?: string | null
  model_name: 'arima' | 'lstm' | 'gradient_boost' | 'timesfm'
  model_version: string
  target_at: string
  horizon_hours: number
  predicted_volume: number
  predicted_speed_kmh: number
  predicted_congestion: CongestionLevel
  lower_volume: number
  upper_volume: number
  lower_speed_kmh: number
  upper_speed_kmh: number
  generated_at: string
}

export interface ODMatrix {
  id: string
  origin_zone: string
  destination_zone: string
  trip_count: number
  avg_travel_time_min: number
  recorded_hour: string
}

export interface WeatherObservation {
  id: string
  station?: string | null
  station_code?: string | null
  latitude: number
  longitude: number
  temperature_c?: number | null
  rainfall_mm: number
  humidity_pct?: number | null
  wind_kmh?: number | null
  visibility_km?: number | null
  condition: 'clear' | 'cloudy' | 'rain' | 'heavy_rain' | 'fog' | 'storm'
  traffic_impact_score: number
  observed_at: string
  created_at?: string
  updated_at?: string
}

export interface TrafficAlert {
  id: string
  alert_type: 'congestion' | 'incident' | 'weather' | 'road_closure'
  severity: 'info' | 'warning' | 'critical'
  segment: string
  segment_id?: string
  segment_road_code?: string | null
  event?: string | null
  title: string
  message: string
  is_active: boolean
  issued_at: string
  resolved_at?: string | null
}

export interface TrafficSummary {
  kpis: {
    active_stations: number
    total_stations: number
    active_congestion_events: number
    total_segments_observed: number
    avg_speed_24h_kmh: number | null
    total_volume_24h: number
  }
  volume_24h: { hour: string; volume: number; avg_speed: number | null }[]
  class_breakdown: { vehicle_class: string; total: number; share_pct: number }[]
  congestion_distribution: Record<CongestionLevel, number>
  speed_compliance: { avg_compliance_pct: number; observation_count: number }
  forecast_next_hour: { model_name: string; avg_volume: number; avg_speed: number }[]
  generated_at: string
}

/** The shared scope parameters (core.scope on the backend): a period and/or one county. */
export interface TrafficScopeQuery {
  county?: string
  days?: number
  date_from?: string
  date_to?: string
}

export interface TrafficQuery extends TrafficScopeQuery {
  page?: number
  page_size?: number
  segment?: string
  station?: string
  severity?: TrafficSeverity
  status?: string
  congestion?: CongestionLevel
  vehicle_class?: string
  // NB: TrafficCountViewSet.get_queryset() reads these as `from`/`to`
  // (not `date_from`/`date_to`) - see apps/traffic/views.py.
  from?: string
  to?: string
}

export function useTraffic() {
  const api = useApi()

  return {
    // One-shot analytics
    summary: (q?: TrafficScopeQuery) => api<TrafficSummary>('/api/v1/traffic/summary/', ...scopeArgs(q)),

    // CRUD + list views
    countingStations: (q?: TrafficQuery) =>
      api<Paged<CountingStation>>('/api/v1/traffic/counting-stations/', { query: cleanQuery(q as Record<string, unknown>) }),
    counts: (q?: TrafficQuery) =>
      api<Paged<TrafficCount>>('/api/v1/traffic/counts/', { query: cleanQuery(q as Record<string, unknown>) }),
    classifications: (q?: TrafficQuery) =>
      api<Paged<VehicleClassification>>('/api/v1/traffic/classifications/', { query: cleanQuery(q as Record<string, unknown>) }),
    speedObservations: (q?: TrafficQuery) =>
      api<Paged<SpeedObservation>>('/api/v1/traffic/speed-observations/', { query: cleanQuery(q as Record<string, unknown>) }),
    congestionEvents: (q?: TrafficQuery) =>
      api<Paged<CongestionEvent>>('/api/v1/traffic/congestion-events/', { query: cleanQuery(q as Record<string, unknown>) }),
    activeCongestion: (q?: TrafficScopeQuery) =>
      api<Paged<CongestionEvent>>('/api/v1/traffic/congestion-events/active/', ...scopeArgs(q)),
    routeOptimizations: (q?: TrafficQuery) =>
      api<Paged<RouteOptimization>>('/api/v1/traffic/route-optimizations/', { query: cleanQuery(q as Record<string, unknown>) }),
    forecasts: (q?: TrafficQuery) =>
      api<Paged<TrafficForecast>>('/api/v1/traffic/forecasts/', { query: cleanQuery(q as Record<string, unknown>) }),
    odMatrix: (q?: TrafficQuery) =>
      api<Paged<ODMatrix>>('/api/v1/traffic/od-matrices/', { query: cleanQuery(q as Record<string, unknown>) }),
    topOdPairs: (days = 7) =>
      api<{ count: number; results: { origin_zone: string; destination_zone: string; trips: number; avg_min: number }[]; days: number }>(
        `/api/v1/traffic/od-matrices/top-pairs/?days=${days}`,
      ),
    weather: (q?: TrafficQuery) =>
      api<Paged<WeatherObservation>>('/api/v1/traffic/weather/', { query: cleanQuery(q as Record<string, unknown>) }),
    alerts: (q?: TrafficQuery & { active?: boolean }) =>
      api<Paged<TrafficAlert>>('/api/v1/traffic/alerts/', { query: cleanQuery(q as Record<string, unknown>) }),
    resolveAlert: (id: string) =>
      api<TrafficAlert>(`/api/v1/traffic/alerts/${id}/resolve/`, { method: 'POST' }),

    // Class share analytics
    // `days` as before, or the full scope (a period and/or county).
    classShare: (days: number | TrafficScopeQuery = 7) =>
      api<{ count: number; results: { vehicle_class: string; total: number; share_pct: number }[]; days: number }>(
        typeof days === 'number' ? `/api/v1/traffic/classifications/share/?days=${days}` : '/api/v1/traffic/classifications/share/',
        ...(typeof days === 'number' ? [] : scopeArgs(days)),
      ),

    // Map data: map domain entities into marker/line shapes the UAPTSMap
    // component understands. These are convenience selectors - the
    // component itself is decoupled from the API.
    mapData: async (scope?: { county?: string }) => {
      const county = scope?.county ? { county: scope.county } : {}
      const [stations, eventsRes] = await Promise.all([
        api<Paged<CountingStation>>('/api/v1/traffic/counting-stations/', { query: { page_size: 200, ...county } }),
        api<Paged<CongestionEvent>>('/api/v1/traffic/congestion-events/', { query: { status: 'active', page_size: 100, ...county } }),
      ])
      type Spec = import('~/components/UaptsMap.vue').MarkerSpec
      const markers: Spec[] = []
      const stationCoords = new Map<string, { latitude: number; longitude: number }>()
      // segment id -> a station on it, so most events resolve with no extra request.
      const stationBySegment = new Map<string, { latitude: number; longitude: number }>()
      for (const s of (stations as any).results ?? []) {
        if (s.latitude == null || s.longitude == null) continue
        const pt = { latitude: s.latitude, longitude: s.longitude }
        stationCoords.set(s.id, pt)
        if (s.segment_id) stationBySegment.set(s.segment_id, pt)
        const colour =
          s.equipment_status === 'operational' ? 'green'
          : s.equipment_status === 'degraded' ? 'yellow'
          : s.equipment_status === 'offline' ? 'red'
          : 'gray'
        markers.push({
          id: `station-${s.id}`,
          lat: s.latitude,
          lon: s.longitude,
          title: `${s.station_code} - ${s.station_name}`,
          badge: `${String(s.station_type).toUpperCase()} counting station`,
          subtitle: `${s.agency_code ?? ''} · ${String(s.station_type).toUpperCase()} · ${s.speed_limit_kmh ?? '-'} km/h · ${s.equipment_status}`,
          rows: [
            { label: 'Status', value: String(s.equipment_status) },
            { label: 'Agency', value: s.agency_code ?? '-' },
            { label: 'Speed limit', value: s.speed_limit_kmh != null ? `${s.speed_limit_kmh} km/h` : '-' },
            { label: 'Data quality', value: s.data_quality_score != null ? `${Number(s.data_quality_score).toFixed(0)}%` : '-' },
          ],
          updatedAt: s.updated_at,
          color: colour,
          size: 'sm',
        })
      }

      // Events whose segment has no station of its own fall back to a traffic
      // count lookup (a count row carries the station id) - fetched in
      // parallel, once per distinct segment, instead of one-by-one.
      const events: any[] = ((eventsRes as any).results ?? []).filter((e: any) => e.segment_id != null)
      const missing = [...new Set(events.filter(e => !stationBySegment.has(e.segment_id)).map(e => e.segment_id as string))]
      const fallback = new Map<string, { latitude: number; longitude: number }>()
      await Promise.all(missing.map(async (seg) => {
        try {
          const tc = await api<Paged<TrafficCount>>(`/api/v1/traffic/counts/?segment=${seg}&page_size=1`)
          const st = (tc as any).results?.[0]?.station
          const pt = st ? stationCoords.get(st) : undefined
          if (pt) fallback.set(seg, pt)
        } catch { /* one unresolvable segment must not blank the whole map */ }
      }))

      for (const e of events) {
        const coords = stationBySegment.get(e.segment_id) ?? fallback.get(e.segment_id)
        if (!coords) continue
        // Color by the event's own live speed vs its free-flow speed - the
        // same relative-speed banding Google's traffic layer uses - rather
        // than only the coarser severity enum, so the map reflects the
        // actual recorded numbers.
        const speedRatio = e.free_flow_speed_kmh > 0 ? e.avg_speed_kmh / e.free_flow_speed_kmh : null
        const colour =
          speedRatio == null ? (e.severity === 'critical' ? 'red' : e.severity === 'high' ? 'orange' : e.severity === 'medium' ? 'yellow' : 'blue')
          : speedRatio < 0.4 ? 'red'
          : speedRatio < 0.6 ? 'orange'
          : speedRatio < 0.85 ? 'yellow'
          : 'green'
        markers.push({
          id: `event-${e.id}`,
          lat: coords.latitude,
          lon: coords.longitude,
          title: `[${String(e.severity).toUpperCase()}] Congestion${e.segment_road_code ? ' · ' + e.segment_road_code : ''}`,
          badge: 'Congestion event',
          subtitle: `${e.avg_speed_kmh.toFixed(0)} km/h (free flow ${e.free_flow_speed_kmh.toFixed(0)} km/h) · Delay ${e.delay_minutes} min`,
          rows: [
            { label: 'Severity', value: String(e.severity) },
            { label: 'Speed', value: `${e.avg_speed_kmh.toFixed(0)} / ${e.free_flow_speed_kmh.toFixed(0)} km/h` },
            { label: 'Delay', value: `${e.delay_minutes} min` },
            { label: 'Impact radius', value: `${e.impact_radius_km} km` },
            { label: 'Started', value: new Date(e.started_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
          ],
          updatedAt: e.started_at,
          color: colour,
          size: 'lg',
          radiusKm: e.impact_radius_km,
          pulse: colour === 'red',
        })
      }
      return { markers }
    },
  }
}