// app/composables/api/useFleet.ts
// ─────────────────────────────────────────────────────────────────────
// M03 - Fleet Tracking & Vehicle Management.
// Backs KRC rolling stock + PSV fleet + SDR-MTD plant.
//
// Backend surface: /api/v1/fleet/
//   /vehicles/, /gps-tracks/, /weighbridge-stations/, /weighbridge-events/,
//   /government-fleet/, /equipment-leases/, /geofences/, /geofence-events/,
//   /driver-behavior-events/, /route-adherence/, /trip-playbacks/,
//   /speed-governor-status/, /utilization/, /summary/.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

// ── Common shapes ────────────────────────────────────────────────────

export type VehicleStatus = 'operational' | 'maintenance' | 'impounded'
export type VehicleType =
  | 'psv_matatu' | 'psv_bus' | 'brt' | 'taxi'
  | 'truck' | 'government' | 'private' | 'rail'
export type GovernorStatus = 'online' | 'tampered' | 'fault' | 'offline'
export type GeofenceEventType = 'entry' | 'exit' | 'dwell'
export type BehaviourEventType =
  | 'speeding' | 'harsh_brake' | 'harsh_accel' | 'excessive_idle' | 'sharp_turn'
export type BehaviourSeverity = 'low' | 'medium' | 'high' | 'critical'
export type RouteAdherenceVerdict = 'on_route' | 'deviation' | 'unknown'
export type TripStatus = 'completed' | 'in_progress' | 'cancelled'

// ── Vehicle ──────────────────────────────────────────────────────────

export interface Vehicle {
  id: string
  agency: string | null
  agency_code: string | null
  operator: string | null
  operator_name: string | null
  assigned_route: string | null
  route_name: string | null
  plate_number: string
  chassis_no: string
  engine_no: string
  engine_capacity_cc: number | null
  vehicle_type: VehicleType
  body_type: string | null
  make: string
  model_name: string
  year_of_manufacture: number | null
  seating_capacity: number | null
  gross_weight_kg: number | null
  load_capacity_kg: number | null
  axle_configuration: string
  fuel_type: string
  county: string | null
  speed_limit_kmh: number
  has_speed_governor: boolean
  insurance_expiry: string | null
  inspection_expiry: string | null
  logbook_status: string | null
  /**
   * Owner identity fields - confirmed live but blank ("") on every sampled
   * vehicle in this environment. Could be unseeded data, or redaction like
   * Driver.national_id (see useDriverLicensing.revealDriverId) - confirm
   * with backend before building UI that assumes these are populated.
   */
  owner_name: string | null
  owner_id_number: string | null
  owner_phone: string | null
  status: VehicleStatus
  last_seen_at: string | null
  last_latitude: number | null
  last_longitude: number | null
  last_speed_kmh: number | null
  has_recent_track: boolean
  created_at: string
  updated_at: string
}

export interface GPSTrack {
  id: string
  vehicle: string
  plate_number: string
  latitude: number
  longitude: number
  speed_kmh: number | null
  timestamp: string
}

// ── Geofences ────────────────────────────────────────────────────────

export interface Geofence {
  id: string
  agency: string | null
  agency_code: string | null
  zone_name: string
  zone_type: string
  severity: string
  radius_m: number | null
  latitude: number | null
  longitude: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GeofenceEvent {
  id: string
  geofence: string
  zone_name: string
  vehicle: string
  plate_number: string
  event_type: GeofenceEventType
  latitude: number | null
  longitude: number | null
  speed_kmh: number | null
  detected_at: string
}

// ── Driver behaviour / route adherence / governor ────────────────────

export interface DriverBehaviorEvent {
  id: string
  vehicle: string
  plate_number: string
  event_type: BehaviourEventType
  severity: BehaviourSeverity
  speed_kmh: number | null
  speed_limit_kmh: number | null
  latitude: number | null
  longitude: number | null
  duration_seconds: number | null
  deceleration_mps2: number | null
  detected_at: string
}

export interface RouteAdherence {
  id: string
  vehicle: string
  plate_number: string
  route: string | null
  route_name: string | null
  verdict: RouteAdherenceVerdict
  deviation_m: number | null
  sample_latitude: number | null
  sample_longitude: number | null
  sampled_at: string
}

export interface SpeedGovernorStatus {
  id: string
  vehicle: string
  plate_number: string
  status: GovernorStatus
  cap_kmh: number | null
  observed_max_kmh: number | null
  tamper_detected: boolean
  firmware_version: string
  reported_at: string
}

// ── Trips / utilization ─────────────────────────────────────────────

export interface TripPlayback {
  id: string
  vehicle: string
  plate_number: string
  route: string | null
  route_name: string | null
  operator: string | null
  operator_name: string | null
  origin_label: string
  destination_label: string
  started_at: string
  ended_at: string | null
  distance_km: number | null
  avg_speed_kmh: number | null
  max_speed_kmh: number | null
  duration_seconds: number | null
  stop_count: number
  boardings: number | null
  alightings: number | null
  /** GPS breadcrumb polyline for this trip, as [lon, lat] pairs (GeoJSON coordinate order). */
  path?: [number, number][]
  stops_served?: string[]
  status: TripStatus
  created_at: string
  updated_at: string
}

export interface FleetUtilization {
  id: string
  vehicle: string
  plate_number: string
  operator: string | null
  operator_name: string | null
  date: string
  trips_count: number
  distance_km: number | null
  active_hours: number | null
  idle_hours: number | null
  utilization_pct: number | null
  created_at: string
  updated_at: string
}

// ── Weighbridge / government plant ──────────────────────────────────

export interface WeighbridgeStation {
  id: string
  agency: string | null
  agency_code: string | null
  station_name: string
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

export interface WeighbridgeEvent {
  id: string
  vehicle: string
  plate_number: string
  station: string
  station_name: string
  axle_load_per_group: Record<string, number> | null
  overload_amount_kg: number | null
  recorded_at: string
}

export interface GovernmentFleet {
  id: string
  agency: string | null
  agency_code: string | null
  equipment_type: string
  serviceability: string
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

// ── Summary analytics payload ───────────────────────────────────────

export interface FleetSummary {
  kpis: {
    total_vehicles: number
    live_vehicles: number
    trips_7d: number
    distance_7d_km: number
  }
  vehicles_by_type: Array<{ vehicle_type: string; total: number }>
  vehicles_by_status: Record<string, number>
  governor_compliance: {
    online_pct: number
    tamper_rate_pct: number
    fault_rate_pct: number
  }
  behaviour_events_24h: Record<string, number>
  behaviour_critical_24h: number
  top_breaches_24h: Array<{
    geofence_id: string
    geofence__zone_name: string
    geofence__zone_type: string
    c: number
  }>
  generated_at: string
}

// ── Query type ──────────────────────────────────────────────────────

export interface FleetQuery {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
  [k: string]: unknown
}

// ── Composable ──────────────────────────────────────────────────────

export function useFleet() {
  const api = useApi()
  const F = '/api/v1/fleet'

  return {
    // ── Dashboard / summary ────────────────────────────────────────
    summary: () => api<FleetSummary>(`${F}/summary/`),

    // ── Vehicles ───────────────────────────────────────────────────
    vehicles: (q?: FleetQuery) =>
      api<Paged<Vehicle>>(`${F}/vehicles/`, { query: cleanQuery(q as Record<string, unknown>) }),
    getVehicle: (id: string) => api<Vehicle>(`${F}/vehicles/${id}/`),
    liveVehicles: () => api<Paged<Vehicle>>(`${F}/vehicles/live/`),
    playback: (vehicleId: string) => api<unknown>(`${F}/vehicles/${vehicleId}/playback/`),
    track: (vehicleId: string) => api<unknown>(`${F}/vehicles/${vehicleId}/track/`),

    // ── GPS tracks ─────────────────────────────────────────────────
    gpsTracks: (q?: FleetQuery) =>
      api<Paged<GPSTrack>>(`${F}/gps-tracks/`, { query: cleanQuery(q as Record<string, unknown>) }),

    // ── Geofences ──────────────────────────────────────────────────
    geofences: (q?: FleetQuery) =>
      api<Paged<Geofence>>(`${F}/geofences/`, { query: cleanQuery(q as Record<string, unknown>) }),
    activeGeofences: () => api<Paged<Geofence>>(`${F}/geofences/active/`),
    geofenceEvents: (q?: FleetQuery) =>
      api<Paged<GeofenceEvent>>(`${F}/geofence-events/`, { query: cleanQuery(q as Record<string, unknown>) }),
    recentBreaches: () => api<GeofenceEvent[]>(`${F}/geofence-events/recent/`),

    // ── Driver behaviour ───────────────────────────────────────────
    behaviourEvents: (q?: FleetQuery) =>
      api<Paged<DriverBehaviorEvent>>(`${F}/driver-behavior-events/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    behaviourSummary: () => api<{ results: any[] }>(`${F}/driver-behavior-events/summary/`),
    behaviourCritical: () => api<Paged<DriverBehaviorEvent>>(`${F}/driver-behavior-events/critical/`),

    // ── Route adherence ────────────────────────────────────────────
    routeAdherence: (q?: FleetQuery) =>
      api<Paged<RouteAdherence>>(`${F}/route-adherence/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    routeAdherenceScore: () => api<unknown>(`${F}/route-adherence/score/`),

    // ── Speed governors ────────────────────────────────────────────
    speedGovernorStatus: (q?: FleetQuery) =>
      api<Paged<SpeedGovernorStatus>>(`${F}/speed-governor-status/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    speedGovernorCompliance: () => api<unknown>(`${F}/speed-governor-status/compliance/`),

    // ── Trips / utilization ────────────────────────────────────────
    tripPlaybacks: (q?: FleetQuery) =>
      api<Paged<TripPlayback>>(`${F}/trip-playbacks/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    tripPath: (tripId: string) => api<unknown>(`${F}/trip-playbacks/${tripId}/path/`),
    utilization: (q?: FleetQuery) =>
      api<Paged<FleetUtilization>>(`${F}/utilization/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    utilizationLeaderboard: () => api<unknown>(`${F}/utilization/leaderboard/`),

    // ── Weighbridge / government ───────────────────────────────────
    weighbridgeStations: () => api<Paged<WeighbridgeStation>>(`${F}/weighbridge-stations/`),
    weighbridgeEvents: (q?: FleetQuery) =>
      api<Paged<WeighbridgeEvent>>(`${F}/weighbridge-events/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    governmentFleet: (q?: FleetQuery) =>
      api<Paged<GovernmentFleet>>(`${F}/government-fleet/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    equipmentLeases: (q?: FleetQuery) =>
      api<Paged<unknown>>(`${F}/equipment-leases/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
  }
}