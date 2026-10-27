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

import { useApi, cleanQuery, type SummaryFilterParams } from './_client'
import type { Paged } from '~/types/uapts'

// ── Domain types ──────────────────────────────────────────────────────

export type AirportType = 'international' | 'regional' | 'domestic' | 'military' | 'private' | 'heliport' | 'airstrip'
export interface Airport {
  id: string
  /** Null for airstrips / heliports loaded from the OSM airports layer (they have no IATA code). */
  iata_code: string | null
  icao_code: string | null
  osm_id?: string | null
  county?: string
  certificate_no?: string
  certificate_issued?: string | null
  certificate_expires?: string | null
  certificate_status?: '' | 'certified' | 'provisional' | 'restricted' | 'closed'
  fire_category?: number | null
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

export type PortType = 'sea' | 'inland_dry' | 'oil' | 'fishing' | 'marina' | 'ferry'
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
  latitude: number | null
  longitude: number | null
  terminal: string
  terminal_operator: string
  draught_restriction_m: number | null
  sts_crane_count: number
  rtg_crane_count: number
  mobile_crane_count: number
  yard_area_ha: number
  teu_ground_slots: number
  reefer_plug_count: number
  gate_lanes_in: number
  gate_lanes_out: number
  warehouse_area_m2: number
  equipment_availability_pct: number | null
  operational_status: 'operational' | 'limited' | 'maintenance' | 'closed'
}

export type VesselType = 'container' | 'bulk_carrier' | 'tanker' | 'general_cargo' | 'vehicle' | 'cruise' | 'fishing' | 'other' | 'passenger' | 'tug' | 'supply' | 'dredger'
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
  registration_number: string
  licensing_status: string
  registered_at: string | null
  net_tonnage: number
  home_port: string
  managing_company: string
  owner_address: string
  registry_certificate_number: string
  registry_certificate_issued: string | null
  class_society: string
  seaworthiness_certificate_number: string
  seaworthiness_expiry: string | null
  trading_area: string
  operational_status: '' | 'in_service' | 'laid_up' | 'under_survey' | 'total_loss' | 'deregistered'
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

// `container-throughput/` and `yard-dwell/` don't support server-side
// `port`/`direction`/`days` filtering despite older callers assuming
// otherwise (confirmed live - the schema declares no filterset fields
// for either viewset). Fetch a full page and aggregate/filter
// client-side instead, same pattern as maritime/cargo's cargo-type
// breakdown.
export type ContainerDirection = 'import' | 'export' | 'transit' | 'empty'
export interface ContainerThroughputRecord {
  id: string
  report_date: string
  port: string
  port_unlocode: string
  direction: ContainerDirection
  teu_count: number
  boxes_count: number
  weight_tons: number
  agency: string | null
  created_at: string
  updated_at: string
}
export interface ContainerByPort {
  port__unlocode: string
  port__name: string
  teus: number
  boxes: number
  tons: number
}
export interface ContainerTrendPoint {
  report_date: string
  direction: ContainerDirection
  teus: number
}

// `direction` here excludes 'empty' - empties aren't dwell-tracked.
export type YardDwellDirection = 'import' | 'export' | 'transit'
export interface YardDwellRecord {
  id: string
  port: string
  port_unlocode: string
  direction: YardDwellDirection
  container_count: number
  avg_dwell_days: number
  p50_dwell_days: number
  p95_dwell_days: number
  max_dwell_days: number
  report_date: string
  created_at: string
  updated_at: string
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
  latitude: number | null
  longitude: number | null
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
    /** `registered` drops the code-less airstrips (OSM layer); `page_size` is capped at 100 server-side. */
    airports: (q?: { iata?: string; city?: string; airport_type?: string; county?: string; registered?: boolean; page_size?: number; page?: number }) =>
      api<Paged<Airport>>(`${AV}/airports/`, { query: cleanQuery(q as Record<string, unknown>) }),
    /** Every airport, following the pages (a few hundred rows once the OSM airstrips are loaded). */
    airportsAll: async (q?: { registered?: boolean; airport_type?: string }) => {
      const out: Airport[] = []
      for (let page = 1; page <= 20; page++) {
        const res = await api<Paged<Airport>>(`${AV}/airports/`, { query: cleanQuery({ ...q, page, page_size: 100 } as Record<string, unknown>) })
        out.push(...(res.results ?? []))
        if (!res.next) break
      }
      return out
    },
    airportPerformance: (q?: { airport?: string; date_from?: string; date_to?: string; hourly?: '0' | '1'; page_size?: number }) =>
      api<Paged<any>>(`${AV}/airport-performance/`, { query: cleanQuery(q as Record<string, unknown>) }),
    airlines: (q?: { aoc_status?: string; cargo_only?: boolean; page_size?: number }) =>
      api<Paged<Airline>>(`${AV}/airlines/`, { query: cleanQuery(q as Record<string, unknown>) }),
    aircraft: (q?: { aircraft_type?: string; airline?: string; page_size?: number }) =>
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
    airCargoStats: (q?: { airport?: string; airline?: string; cargo_category?: string; customs_status?: string; days?: number; page_size?: number }) =>
      api<Paged<any>>(`${AV}/air-cargo-stats/`, { query: cleanQuery(q as Record<string, unknown>) }),
    airCargoByCategory: (q?: { airport?: string; days?: number }) =>
      api<{ results: Array<{ cargo_category: string; import_t: number; export_t: number; transit_t: number; total_t: number; avg_dwell_h: number | null; rows: number }> }>(
        `${AV}/air-cargo-stats/by-category/`, { query: cleanQuery(q as Record<string, unknown>) }),
    groundHandlers: (q?: { airport?: string; compliance_status?: string; expiring_days?: number; page_size?: number }) =>
      api<Paged<any>>(`${AV}/ground-handlers/`, { query: cleanQuery(q as Record<string, unknown>) }),
    airOperatorCertificates: (q?: { status?: string; ops_spec_type?: string; expiring_days?: number; search?: string; page_size?: number }) =>
      api<Paged<any>>(`${AV}/air-operator-certificates/`, { query: cleanQuery(q as Record<string, unknown>) }),
    airOperatorCertificateStats: () =>
      api<{ total: number; valid: number; suspended: number; revoked: number; under_renewal: number; expiring_90d: number }>(`${AV}/air-operator-certificates/stats/`),
    atmPerformance: (q?: { sector?: string; days?: number; page_size?: number }) =>
      api<Paged<any>>(`${AV}/atm-performance/`, { query: cleanQuery(q as Record<string, unknown>) }),
    atmPerformanceSummary: (days = 30) =>
      api<{ results: Array<Record<string, number | string | null>> }>(`${AV}/atm-performance/summary/?days=${days}`),
    safetyReports: (q?: { airport?: string; airline?: string; severity?: string; days?: number; page_size?: number }) =>
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
    aviationSummary: (days = 7, params?: SummaryFilterParams) =>
      api<AviationSummary>(`${AV}/summary/`, { query: cleanQuery({ ...params, days }) }),

    // ── Maritime catalog ──────────────────────────────────────────
    ports: (q?: { port_type?: string }) =>
      api<Paged<Port>>(`${MA}/ports/`, { query: cleanQuery(q as Record<string, unknown>) }),
    berths: (q?: { port?: string; berth_type?: string; page_size?: number }) =>
      api<Paged<Berth>>(`${MA}/berths/`, { query: cleanQuery(q as Record<string, unknown>) }),
    vessels: (q?: { vessel_type?: string; flag_state?: string; page_size?: number }) =>
      api<Paged<Vessel>>(`${MA}/vessels/`, { query: cleanQuery(q as Record<string, unknown>) }),
    vesselMovements: (q?: PortQuery) =>
      api<Paged<VesselMovement>>(`${MA}/vessel-movements/`, { query: cleanQuery(q as Record<string, unknown>) }),
    vesselMovementsLive: () =>
      api<VesselMovement[]>(`${MA}/vessel-movements/live/`),
    /** No server-side filtering despite the query shape - fetch a full page (~100) and aggregate/filter client-side. */
    containerThroughput: (q?: { port?: string; direction?: string; days?: number; page_size?: number }) =>
      api<Paged<ContainerThroughputRecord>>(`${MA}/container-throughput/`, { query: cleanQuery(q as Record<string, unknown>) }),
    containerByPort: (q?: { days?: number }) =>
      api<{ results: ContainerByPort[] }>(`${MA}/container-throughput/by-port/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    /** Daily TEU totals per direction, last `days`. */
    containerTrend: (days = 60) =>
      api<{ days: number; results: ContainerTrendPoint[] }>(`${MA}/container-throughput/trend/?days=${days}`),
    /** No server-side filtering despite the query shape - fetch a full page (~100) and aggregate/filter client-side. */
    yardDwell: (q?: { port?: string; direction?: string; days?: number; page_size?: number }) =>
      api<Paged<YardDwellRecord>>(`${MA}/yard-dwell/`, { query: cleanQuery(q as Record<string, unknown>) }),
    maritimeInspections: (q?: { port?: string; result?: string; days?: number }) =>
      api<Paged<any>>(`${MA}/maritime-inspections/`, { query: cleanQuery(q as Record<string, unknown>) }),
    maritimeIncidents: (q?: { port?: string; incident_type?: string; severity?: string; days?: number }) =>
      api<Paged<any>>(`${MA}/maritime-incidents/`, { query: cleanQuery(q as Record<string, unknown>) }),
    maritimeIncidentStats: (days = 90) =>
      api<{ days: number; total_incidents: number; fatal_incidents: number; casualties: number; pollution_tons: number }>(
        `${MA}/maritime-incidents/stats/?days=${days}`,
      ),
    // KPA / KMA upload tables (read-only)
    vesselCalls: (q?: { port?: string; vessel?: string; stage?: string; search?: string; page_size?: number }) =>
      api<Paged<any>>(`${MA}/vessel-calls/`, { query: cleanQuery(q as Record<string, unknown>) }),
    containerMovements: (q?: { port?: string; movement_type?: string; container_number?: string; page_size?: number }) =>
      api<Paged<any>>(`${MA}/container-movements/`, { query: cleanQuery(q as Record<string, unknown>) }),
    containerDwell: (q?: { port?: string; container_number?: string; exam_type?: string; detention_alert?: string; page_size?: number }) =>
      api<Paged<any>>(`${MA}/container-dwell/`, { query: cleanQuery(q as Record<string, unknown>) }),
    bulkCargo: (q?: { port?: string; cargo_category?: string; page_size?: number }) =>
      api<Paged<any>>(`${MA}/bulk-cargo/`, { query: cleanQuery(q as Record<string, unknown>) }),
    pollutionIncidents: (q?: { containment_status?: string; substance?: string; days?: number; page_size?: number }) =>
      api<Paged<any>>(`${MA}/pollution-incidents/`, { query: cleanQuery(q as Record<string, unknown>) }),
    pollutionStats: (days = 365) =>
      api<{ days: number; total: number; ongoing: number; legal_action: number; by_substance: { substance: string; count: number }[] }>(
        `${MA}/pollution-incidents/stats/?days=${days}`,
      ),
    maritimeOperations: (days = 30, params?: SummaryFilterParams) =>
      api<MaritimeOps>(`${MA}/operations/`, { query: cleanQuery({ ...params, days }) }),
  }
}
