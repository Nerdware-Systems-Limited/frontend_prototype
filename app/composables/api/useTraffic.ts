// app/composables/api/useTraffic.ts
// ─────────────────────────────────────────────────────────────────────
// M02 - Road Traffic Management (FR-M02-001..014)
//
// Backend mounted at /api/v1/traffic/. ViewSets implemented:
//   counting-stations, counts, classifications, speed-observations,
//   congestion-events, route-optimizations, forecasts, od-matrices,
//   weather, alerts.
// Plus the one-shot analytics endpoint at /summary/.

import { useApi, cleanQuery } from './_client'
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
  model_name: 'arima' | 'prophet' | 'lstm' | 'gradient_boost'
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
}

export interface TrafficAlert {
  id: string
  alert_type: 'congestion' | 'incident' | 'weather' | 'road_closure'
  severity: 'info' | 'warning' | 'critical'
  segment: string
  segment_id?: string
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

export interface TrafficQuery {
  page?: number
  page_size?: number
  segment?: string
  station?: string
  severity?: TrafficSeverity
  status?: string
  congestion?: CongestionLevel
  vehicle_class?: string
  date_from?: string
  date_to?: string
}

export function useTraffic() {
  const api = useApi()

  return {
    // One-shot analytics
    summary: () => api<TrafficSummary>('/api/v1/traffic/summary/'),

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
    activeCongestion: () =>
      api<Paged<CongestionEvent>>('/api/v1/traffic/congestion-events/active/'),
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
    classShare: (days = 7) =>
      api<{ count: number; results: { vehicle_class: string; total: number; share_pct: number }[]; days: number }>(
        `/api/v1/traffic/classifications/share/?days=${days}`,
      ),

    // Map data: map domain entities into marker/line shapes the UAPTSMap
    // component understands. These are convenience selectors - the
    // component itself is decoupled from the API.
    mapData: async () => {
      const [stations, events] = await Promise.all([
        api<Paged<CountingStation>>('/api/v1/traffic/counting-stations/', { query: { page_size: 200 } }),
        api<Paged<CongestionEvent>>('/api/v1/traffic/congestion-events/', { query: { status: 'active', page_size: 100 } }),
      ])
      const markers: import('~/components/UaptsMap.vue').MarkerSpec[] = []      
      for (const s of (stations as any).results ?? []) {
        if (s.latitude == null || s.longitude == null) continue
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
          subtitle: `${s.agency_code ?? ''} · ${s.station_type.toUpperCase()} · ${s.speed_limit_kmh ?? '-'} km/h · ${s.equipment_status}`,
          color: colour,
          size: 'sm',
        })
      }
      for (const e of (events as any).results ?? []) {
        if (e.segment_id == null) continue
        // Pull a single traffic count lat/lon for the segment if we have it.
        const tc = await api<Paged<TrafficCount>>(
          `/api/v1/traffic/counts/?segment=${e.segment_id}&page_size=1`,
        )
        const tcRow = (tc as any).results?.[0]
        if (!tcRow || tcRow.station?.latitude == null) continue
        const colour =
          e.severity === 'critical' ? 'red'
          : e.severity === 'high' ? 'orange'
          : e.severity === 'medium' ? 'yellow'
          : 'blue'
        markers.push({
          id: `event-${e.id}`,
          lat: tcRow.station.latitude,
          lon: tcRow.station.longitude,
          title: `[${e.severity.toUpperCase()}] Congestion`,
          subtitle: `Delay ${e.delay_minutes} min · Impact radius ${e.impact_radius_km.toFixed(1)} km`,
          color: colour,
          size: 'lg',
        })
      }
      return { markers }
    },
  }
}