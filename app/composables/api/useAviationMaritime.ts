// app/composables/api/useAviationMaritime.ts
// ─────────────────────────────────────────────────────────────────────
// M07 - Aviation & Maritime Data Module.
//
// Two top-level surfaces mounted at:
//
//   /api/v1/aviation-maritime/aviation/  (KAA + KCAA catalog)
//   /api/v1/aviation-maritime/maritime/  (KPA + KMA + LAPSSET catalog)
//
// Each surface has a one-shot summary endpoint (aviation/summary/ and
// maritime/operations/) that powers the dashboard.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

// ── Domain types ──────────────────────────────────────────────────────

export type AirportType = 'international' | 'regional' | 'domestic' | 'military' | 'private'
export interface Airport {
  id: string
  iata_code: string
  icao_code: string
  name: string
  city: string
  country: string
  airport_type: AirportType
  runway_count: number
  has_international: boolean
  design_capacity_passengers: number
  elevation_ft: number
  operator: string
  active: boolean
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

export type AocStatus = 'valid' | 'suspended' | 'pending' | 'revoked'
export interface Airline {
  id: string
  iata_code: string
  icao_code: string
  name: string
  country: string
  is_cargo_only: boolean
  aoc_status: AocStatus
  fleet_size: number
  agency: string | null
  agency_code: string | null
}

export type AircraftType = 'narrow_body' | 'wide_body' | 'regional' | 'cargo' | 'business'
export interface Aircraft {
  id: string
  registration: string
  aircraft_type: AircraftType
  manufacturer: string
  model: string
  mtow_kg: number
  seats_capacity: number
  year_built: number | null
  airline: string | null
  airline_iata: string | null
  in_service: boolean
}

export type FlightStatus = 'scheduled' | 'boarding' | 'departed' | 'in_flight'
  | 'landed' | 'arrived' | 'delayed' | 'cancelled' | 'diverted'
export interface Flight {
  id: string
  schedule: string
  schedule_flight_number: string
  airline_iata: string
  origin_code: string
  destination_code: string
  flight_date: string
  status: FlightStatus
  aircraft: string | null
  aircraft_registration: string | null
  delay_departure_min: number
  delay_arrival_min: number
  delay_reason: string
  passengers_booked: number
  passengers_actual: number | null
  cargo_kg: number
  gate: string
  agency: string | null
}

export interface FlightOTP {
  total_flights: number
  on_time_flights: number
  on_time_pct: number
  avg_delay_min: number
}

export type Commodity = 'general' | 'perishable' | 'pharma' | 'textile'
  | 'machinery' | 'electronics' | 'mail' | 'other'
export interface CargoByCommodity {
  commodity: Commodity
  total_kg: number
  shipments: number
}

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first' | 'transit'
export interface PassengerByAirport {
  airport__iata_code: string
  airport__name: string
  total_pax: number
  domestic: number
  intl: number
  revenue_kes: number
}

export type SafetySeverity = 'fatal' | 'serious' | 'minor' | 'none' | 'incident'
export type SafetyReportType = 'accident' | 'serious_incident' | 'incident' | 'occurrence' | 'ground_damage'

// ── Maritime types ───────────────────────────────────────────────────

export type PortType = 'sea' | 'inland_dry' | 'oil' | 'fishing' | 'marina'
export interface Port {
  id: string
  unlocode: string
  name: string
  port_type: PortType
  operator: string
  design_throughput_teu: number
  latitude: number | null
  longitude: number | null
  country: string
  active: boolean
  agency: string | null
  agency_code: string | null
}

export type BerthType = 'container' | 'general_cargo' | 'bulk' | 'tanker' | 'fishing' | 'ro_ro' | 'cruise'
export interface Berth {
  id: string
  port: string
  port_unlocode: string
  berth_code: string
  name: string
  berth_type: BerthType
  length_m: number
  max_draft_m: number
  max_vessel_loa: number
  crane_count: number
  active: boolean
}

export type VesselType = 'container' | 'bulk_carrier' | 'tanker' | 'general_cargo' | 'vehicle' | 'cruise' | 'fishing' | 'other'
export interface Vessel {
  id: string
  imo_number: string
  mmsi: string
  vessel_name: string
  vessel_type: VesselType
  flag_state: string
  gross_tonnage: number
  deadweight_tonnage: number
  length_overall_m: number
  beam_m: number
  max_draft_m: number
  year_built: number | null
  owner: string
  operator: string
  safety_cert_status: 'valid' | 'expired' | 'pending'
}

export type VesselMovementType = 'arrival' | 'berthing' | 'departure' | 'anchor' | 'pilot_board' | 'tug'
export type VesselMovementStatus = 'scheduled' | 'in_transit' | 'in_port' | 'departed' | 'delayed' | 'cancelled'
export interface VesselMovement {
  id: string
  vessel: string
  vessel_name: string
  vessel_imo: string
  port: string
  port_unlocode: string
  berth: string | null
  berth_code: string | null
  movement_type: VesselMovementType
  status: VesselMovementStatus
  eta: string | null
  etd: string | null
  ata: string | null
  atd: string | null
  cargo_type: string
  cargo_tonnage: number
  teu_count: number
  is_international: boolean
  agency: string | null
}

export type ContainerDirection = 'import' | 'export' | 'transit' | 'empty'
export interface ContainerByPort {
  port__unlocode: string
  port__name: string
  teus: number
  boxes: number
  tons: number
}

export type ConnectionType = 'port_to_rail' | 'port_to_road' | 'port_to_air' | 'air_to_road' | 'air_to_rail' | 'rail_to_road'
export type ConnectionDirection = 'import' | 'export' | 'transit'
export interface IntermodalOnTime {
  origin_port__unlocode: string
  origin_port__name: string
  connection_type: ConnectionType
  destination_label: string
  avg_median: number
  avg_on_time: number
  samples: number
}

export interface AviationSummary {
  days: number
  kpis: {
    total_airports: number
    total_airlines: number
    aircraft_in_service: number
    flights_total: number
    flights_delayed: number
    flights_cancelled: number
    pax_total: number
    cargo_kg_total: number
    otp_pct: number
    avg_delay_min: number
  }
  by_status: Array<{ status: string; c: number }>
  generated_at: string
}

export interface PortOps {
  port_unlocode: string
  port_name: string
  port_type: PortType
  arrivals_30d: number
  departures_30d: number
  currently_in_port: number
  teu_throughput_30d: number
  avg_yard_dwell_days: number
}

export interface MaritimeOps {
  days: number
  kpis: {
    active_ports: number
    live_vessels: number
    incidents_30d: number
    inspections_30d: number
    detentions_30d: number
  }
  ports: PortOps[]
  generated_at: string
}

// ── Query types ───────────────────────────────────────────────────────

export interface AviationQuery {
  days?: number
  airport?: string
  airline?: string
  status?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}
export interface PortQuery {
  port?: string
  vessel_type?: string
  days?: number
}

// ── Composable ───────────────────────────────────────────────────────

/**
 * `FlightViewSet` and `PassengerStatViewSet` (backend) don't support a
 * `days` filter - only `date`/`date_from`/`date_to` (confirmed against
 * apps/aviation_maritime/views.py `get_queryset()` for both). Passing
 * `days=` straight through to `/flights/*` or `/passenger-stats/*` is
 * silently ignored server-side, so the day-range buttons on the aviation
 * pages had no effect. Translate `days` into `date_from` (same window the
 * backend already computes for endpoints that DO support `days`, e.g.
 * cargo-manifests/by-commodity) before it hits those two viewsets.
 */
function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
function withDaysAsDateFrom(
  q: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const { days, ...rest } = q
  if (days != null && rest.date_from == null) {
    rest.date_from = daysAgoISO(Number(days))
  }
  return rest
}

export function useAviationMaritime() {
  const api = useApi()
  const AV = '/api/v1/aviation-maritime/aviation'
  const MA = '/api/v1/aviation-maritime/maritime'

  return {
    // ── Aviation catalog ──────────────────────────────────────────
    airports: (q?: { iata?: string; city?: string; airport_type?: string }) =>
      api<Paged<Airport>>(`${AV}/airports/`, { query: cleanQuery(q as Record<string, unknown>) }),
    airlines: (q?: { aoc_status?: string; cargo_only?: boolean }) =>
      api<Paged<Airline>>(`${AV}/airlines/`, { query: cleanQuery(q as Record<string, unknown>) }),
    aircraft: (q?: { aircraft_type?: string; airline?: string }) =>
      api<Paged<Aircraft>>(`${AV}/aircraft/`, { query: cleanQuery(q as Record<string, unknown>) }),
    flightSchedules: (q?: { flight_number?: string; origin?: string; destination?: string; airline?: string }) =>
      api<Paged<any>>(`${AV}/flight-schedules/`, { query: cleanQuery(q as Record<string, unknown>) }),
    flights: (q?: AviationQuery) =>
      api<Paged<Flight>>(`${AV}/flights/`, { query: withDaysAsDateFrom(cleanQuery(q as Record<string, unknown>)) }),
    flightsOTP: (days = 14) =>
      api<FlightOTP>(`${AV}/flights/otp/`, { query: { date_from: daysAgoISO(days) } }),
    flightsByStatus: (q?: AviationQuery) =>
      api<{ results: Array<{ status: string; count: number }> }>(`${AV}/flights/by-status/`, {
        query: withDaysAsDateFrom(cleanQuery(q as Record<string, unknown>)),
      }),
    cargoManifests: (q?: { commodity?: string; days?: number }) =>
      api<Paged<any>>(`${AV}/cargo-manifests/`, { query: cleanQuery(q as Record<string, unknown>) }),
    cargoByCommodity: (days = 14) =>
      api<{ results: CargoByCommodity[] }>(`${AV}/cargo-manifests/by-commodity/?days=${days}`),
    passengerStats: (q?: { airport?: string; airline?: string; days?: number; page_size?: number }) =>
      api<Paged<any>>(`${AV}/passenger-stats/`, {
        query: withDaysAsDateFrom(cleanQuery(q as Record<string, unknown>)),
      }),
    passengersByAirport: (q?: { days?: number }) =>
      api<{ results: PassengerByAirport[] }>(`${AV}/passenger-stats/by-airport/`, {
        query: withDaysAsDateFrom(cleanQuery(q as Record<string, unknown>)),
      }),
    safetyReports: (q?: { airport?: string; airline?: string; severity?: string; days?: number }) =>
      api<Paged<any>>(`${AV}/safety-reports/`, { query: cleanQuery(q as Record<string, unknown>) }),
    safetyReportStats: (days = 365) =>
      api<{ days: number; total_reports: number; fatal: number; serious: number; casualties: number }>(
        `${AV}/safety-reports/stats/?days=${days}`,
      ),
    intermodalConnections: (q?: { port?: string; connection_type?: string; days?: number }) =>
      api<Paged<any>>(`${AV}/intermodal-connections/`, { query: cleanQuery(q as Record<string, unknown>) }),
    intermodalOnTime: (days = 30) =>
      api<{ days: number; results: IntermodalOnTime[] }>(`${AV}/intermodal-connections/on-time/?days=${days}`),
    metObservations: (q?: { station?: string; scope?: string; hours?: number }) =>
      api<Paged<any>>(`${AV}/met-observations/`, { query: cleanQuery(q as Record<string, unknown>) }),
    metObservationsLatest: () =>
      api<{ results: any[] }>(`${AV}/met-observations/latest/`),
    aviationSummary: (days = 7) =>
      api<AviationSummary>(`${AV}/summary/?days=${days}`),

    // ── Maritime catalog ──────────────────────────────────────────
    ports: (q?: { port_type?: string }) =>
      api<Paged<Port>>(`${MA}/ports/`, { query: cleanQuery(q as Record<string, unknown>) }),
    berths: (q?: { port?: string; berth_type?: string }) =>
      api<Paged<Berth>>(`${MA}/berths/`, { query: cleanQuery(q as Record<string, unknown>) }),
    vessels: (q?: { vessel_type?: string; flag_state?: string }) =>
      api<Paged<Vessel>>(`${MA}/vessels/`, { query: cleanQuery(q as Record<string, unknown>) }),
    vesselMovements: (q?: PortQuery) =>
      api<Paged<VesselMovement>>(`${MA}/vessel-movements/`, { query: cleanQuery(q as Record<string, unknown>) }),
    vesselMovementsLive: () =>
      api<VesselMovement[]>(`${MA}/vessel-movements/live/`),
    containerThroughput: (q?: { port?: string; direction?: string; days?: number }) =>
      api<Paged<any>>(`${MA}/container-throughput/`, { query: cleanQuery(q as Record<string, unknown>) }),
    containerByPort: (q?: { days?: number }) =>
      api<{ results: ContainerByPort[] }>(`${MA}/container-throughput/by-port/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    containerTrend: (days = 60) =>
      api<{ days: number; results: any[] }>(`${MA}/container-throughput/trend/?days=${days}`),
    yardDwell: (q?: { port?: string; direction?: string; days?: number }) =>
      api<Paged<any>>(`${MA}/yard-dwell/`, { query: cleanQuery(q as Record<string, unknown>) }),
    maritimeInspections: (q?: { port?: string; result?: string; days?: number }) =>
      api<Paged<any>>(`${MA}/maritime-inspections/`, { query: cleanQuery(q as Record<string, unknown>) }),
    maritimeIncidents: (q?: { port?: string; incident_type?: string; severity?: string; days?: number }) =>
      api<Paged<any>>(`${MA}/maritime-incidents/`, { query: cleanQuery(q as Record<string, unknown>) }),
    maritimeIncidentStats: (days = 90) =>
      api<{ days: number; total_incidents: number; fatal_incidents: number; casualties: number; pollution_tons: number }>(
        `${MA}/maritime-incidents/stats/?days=${days}`,
      ),
    maritimeOperations: (days = 30) =>
      api<MaritimeOps>(`${MA}/operations/?days=${days}`),
  }
}
