// app/composables/api/useRailway.ts
// ─────────────────────────────────────────────────────────────────────
// M08 — Railway Management (FR-M08-001..015)
//
// Backend mounted at /api/v1/railway/. ViewSets implemented:
//   lines, stations, trains, schedules, operations, freight, incidents, tickets
// Plus the one-shot analytics endpoint at /summary/.
//
// Plus a parallel GeoJSON surface at /api/v1/geojson/rail-lines/
// and /api/v1/geojson/rail-stations/ for the Leaflet map.
//
// Data sources:
//   * RailLine + RailStation — real PostGIS geometries from
//     `hotosm_ken_railways_osm_shp/` (1,724 lines, 150 points) and
//     `hotosm_ken_railways_osm_geojson/`. Classified SGR / MGR / Uganda
//     Railway by OSM name tag.
//   * Schedules / Operations / Freight / Tickets / Incidents — simulated
//     but calibrated to KRC + ASRO published timetables + 2.4 Mt/yr freight
//     and SGR ridership.
//
// Usage:
//   const rail = useRailway()
//   const summary = await rail.summary()
//   const liveTrains = await rail.liveOperations()
//
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

// ── Domain types ──────────────────────────────────────────────────────

export type RailNetwork = 'sgr' | 'mgr' | 'uganda' | 'industrial' | 'heritage' | 'unknown'
export type RailGauge = 'standard' | 'metre' | 'narrow' | 'unknown'
export type RailStatus = 'operational' | 'under_construction' | 'planned' | 'suspended' | 'abandoned' | 'decommissioned'
export type StationType = 'terminal' | 'interchange' | 'intermediate' | 'halt' | 'freight' | 'depot'
export type ServiceType = 'sgr' | 'mgr' | 'freight' | 'mixed' | 'closed'
export type TrainType = 'sgr_emu' | 'sgr_dmu' | 'mgr_loco' | 'mgr_coach' | 'freight_loco' | 'maintenance'
export type TrainStatus = 'in_service' | 'standby' | 'maintenance' | 'retired' | 'inspection'
export type ServiceClass = 'express' | 'standard' | 'local' | 'freight'
export type DayType = 'weekday' | 'weekend' | 'holiday' | 'daily'
export type OpStatus = 'scheduled' | 'boarding' | 'departed' | 'in_transit' | 'arrived' | 'delayed' | 'cancelled' | 'diverted'
export type DelayReason = 'none' | 'weather' | 'mechanical' | 'track' | 'signalling' | 'passenger' | 'freight' | 'other'
export type CargoType = 'container' | 'bulk_fuel' | 'bulk_cement' | 'grain' | 'general' | 'vehicle' | 'steel' | 'other'
export type IncidentType = 'collision' | 'derailment' | 'level_crossing' | 'fire' | 'passenger' | 'trespasser' | 'signal_failure' | 'derailment_minor'
export type IncidentSeverity = 'fatal' | 'serious' | 'minor' | 'none'
export type TicketClass = 'first' | 'business' | 'economy' | 'student' | 'child' | 'senior'
export type Channel = 'counter' | 'online' | 'agent' | 'corporate' | 'mobile_money'

export interface RailLine {
  id: string
  osm_id: string
  name?: string | null
  network: RailNetwork
  gauge: RailGauge
  gauge_mm?: number | null
  status: RailStatus
  operator?: string
  max_speed_kmh?: number | null
  electrification: boolean
  electrified_voltage_kv?: number | null
  length_km?: number | null
  stations_count: number
  admin1_name?: string
  admin2_name?: string
  created_at?: string
  updated_at?: string
}

export interface RailStation {
  id: string
  osm_id: string
  code: string
  name: string
  network: RailNetwork
  station_type: StationType
  service: ServiceType
  has_passenger_service: boolean
  has_freight_terminal: boolean
  platforms: number
  passenger_capacity_daily: number
  city?: string
  admin1_name?: string
  elevation_m?: number | null
  created_at?: string
  updated_at?: string
}

export interface Train {
  id: string
  unit_id: string
  train_type: TrainType
  status: TrainStatus
  capacity_passengers: number
  capacity_freight_tons: number
  year_built?: number | null
  manufacturer?: string
  last_maintenance?: string | null
  next_maintenance?: string | null
  home_depot?: string
  current_location?: string | null
  current_location_code?: string | null
  created_at?: string
  updated_at?: string
}

export interface TrainSchedule {
  id: string
  train_number: string
  service_class: ServiceClass
  network: RailNetwork
  origin: string
  origin_code: string
  destination: string
  destination_code: string
  departure_time: string
  arrival_time: string
  duration_minutes: number
  days_of_week: string
  day_type: DayType
  train_unit?: string | null
  train_unit_code?: string | null
  fare_first_class_kes: string
  fare_economy_kes: string
  fare_freight_per_ton_kes: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface TrainOperation {
  id: string
  schedule: string
  schedule_train_number: string
  origin_code: string
  destination_code: string
  train_unit?: string | null
  train_unit_code?: string | null
  service_date: string
  status: OpStatus
  actual_departure?: string | null
  actual_arrival?: string | null
  delay_departure_min: number
  delay_arrival_min: number
  delay_reason: DelayReason
  passengers_actual?: number | null
  occupancy_pct?: number | null
  current_lat?: number | null
  current_lon?: number | null
  current_station?: string | null
  current_station_code?: string | null
  created_at?: string
  updated_at?: string
}

export interface FreightManifest {
  id: string
  manifest_ref: string
  cargo_type: CargoType
  tonnage: number
  wagon_count: number
  origin_station: string
  origin_station_code: string
  destination_station: string
  destination_station_code: string
  operator?: string
  customs_clearance_ref?: string
  port_origin?: string
  revenue_kes: string
  dispatched_at: string
  arrived_at?: string | null
  schedule?: string | null
  schedule_train_number?: string | null
  operator_agency?: string | null
  operator_agency_code?: string | null
  created_at?: string
  updated_at?: string
}

export interface RailIncident {
  id: string
  incident_ref: string
  incident_type: IncidentType
  severity: IncidentSeverity
  status: 'open' | 'investigating' | 'resolved' | 'closed'
  station?: string | null
  station_name?: string | null
  station_code?: string | null
  line?: string | null
  occurred_at: string
  description: string
  casualties: number
  estimated_loss_kes: string
  reported_by_agency?: string | null
  reported_by_agency_code?: string | null
  created_at?: string
  updated_at?: string
}

export interface RailTicket {
  id: string
  pnr: string
  schedule: string
  origin: string
  destination: string
  ticket_class: TicketClass
  channel: Channel
  passenger_name_hash: string
  fare_kes: string
  seat_number?: string
  booking_date: string
  travel_date: string
  is_no_show: boolean
  operator_agency?: string | null
  created_at?: string
  updated_at?: string
}

// ── One-shot summary payload ──────────────────────────────────────────

export interface RailwayKpis {
  total_lines: number
  total_stations: number
  total_trains: number
  trains_in_service: number
  active_schedules: number
  sgr_lines: number
  mgr_lines: number
  operations_24h: number
  freight_30d_shipments: number
  passenger_bookings_30d: number
  open_incidents: number
}

export interface LiveOperation {
  id: string
  train_number: string
  origin_code: string
  destination_code: string
  status: OpStatus
  delay_arrival_min: number
  current_station_code: string | null
  service_date: string
  occupancy_pct: number | null
}

export interface OnTimeStats {
  days: number
  total_operations: number
  on_time_pct: number
  avg_delay_min: number
  cancelled: number
  cancellation_pct: number
  delayed: number
}

export interface FreightSummary {
  shipments: number
  total_tons: number
  total_revenue_kes: number
  top_corridors: Array<{
    origin_station__code: string
    destination_station__code: string
    cargo_type: CargoType
    tons: number
    shipments: number
  }>
}

export interface IncidentSummary {
  total: number
  casualties: number
  loss_kes: number
  fatal: number
  level_crossing: number
}

export interface RidershipSummary {
  bookings: number
  passengers: number
  revenue_kes: number
  no_show_rate_pct: number
}

export interface RailwaySummary {
  kpis: RailwayKpis
  live_operations: LiveOperation[]
  on_time_30d: OnTimeStats
  freight_30d: FreightSummary
  incidents_90d: IncidentSummary
  ridership_30d: RidershipSummary
  top_routes: Array<{
    origin__code: string
    origin__name: string
    destination__code: string
    destination__name: string
    bookings: number
    revenue: number
  }>
  generated_at: string
}

// ── Composable ────────────────────────────────────────────────────────

export interface RailQuery {
  page?: number
  page_size?: number
  network?: string
  status?: string
  station_type?: string
  train_type?: string
  cargo_type?: string
  incident_type?: string
  severity?: string
  ticket_class?: string
  channel?: string
  train_number?: string
  origin?: string
  destination?: string
  date_from?: string
  date_to?: string
  days?: number
  search?: string
}

export function useRailway() {
  const api = useApi()

  return {
    // ── Catalog ────────────────────────────────────────────────────
    lines: (q?: RailQuery) =>
      api<Paged<RailLine>>('/api/v1/railway/lines/', { query: cleanQuery(q as Record<string, unknown>) }),
    stations: (q?: RailQuery) =>
      api<Paged<RailStation>>('/api/v1/railway/stations/', { query: cleanQuery(q as Record<string, unknown>) }),
    trains: (q?: RailQuery) =>
      api<Paged<Train>>('/api/v1/railway/trains/', { query: cleanQuery(q as Record<string, unknown>) }),
    schedules: (q?: RailQuery) =>
      api<Paged<TrainSchedule>>('/api/v1/railway/schedules/', { query: cleanQuery(q as Record<string, unknown>) }),
    operations: (q?: RailQuery) =>
      api<Paged<TrainOperation>>('/api/v1/railway/operations/', { query: cleanQuery(q as Record<string, unknown>) }),
    freight: (q?: RailQuery) =>
      api<Paged<FreightManifest>>('/api/v1/railway/freight/', { query: cleanQuery(q as Record<string, unknown>) }),
    incidents: (q?: RailQuery) =>
      api<Paged<RailIncident>>('/api/v1/railway/incidents/', { query: cleanQuery(q as Record<string, unknown>) }),
    tickets: (q?: RailQuery) =>
      api<Paged<RailTicket>>('/api/v1/railway/tickets/', { query: cleanQuery(q as Record<string, unknown>) }),

    // ── One-shot dashboard ────────────────────────────────────────
    summary: () => api<RailwaySummary>('/api/v1/railway/summary/'),

    // ── Custom actions (FR-M08-*) ────────────────────────────────
    liveOperations: () =>
      api<TrainOperation[]>('/api/v1/railway/operations/live/'),
    onTimeStats: (days = 30) =>
      api<OnTimeStats>(`/api/v1/railway/operations/on-time-stats/?days=${days}`),
    freightByCorridor: (days = 30) =>
      api<{ count: number; results: any[] }>(
        `/api/v1/railway/freight/by-corridor/?days=${days}`,
      ),
    incidentStats: (days = 90) =>
      api<IncidentSummary>(`/api/v1/railway/incidents/stats/?days=${days}`),
    revenueByRoute: (days = 30) =>
      api<{ count: number; results: any[] }>(
        `/api/v1/railway/tickets/by-route/?days=${days}`,
      ),

    // ── Map data: rail lines + stations as polylines + markers ────
    mapData: async () => {
      const [linesFC, stationsFC] = await Promise.all([
        api<{ type: 'FeatureCollection'; features: any[]; count: number }>('/api/v1/geojson/rail-lines/'),
        api<{ type: 'FeatureCollection'; features: any[]; count: number }>('/api/v1/geojson/rail-stations/'),
      ])
      const lines: import('~/components/UaptsMap.vue').LineSpec[] = []
      const markers: import('~/components/UaptsMap.vue').MarkerSpec[] = []

      for (const f of linesFC.features ?? []) {
        const coords = f?.geometry?.coordinates
        if (!coords || coords.length < 2) continue
        // GeoJSON is [lon, lat]; we need [lat, lon] for LineSpec
        const pts: [number, number][] = coords.map(
          (c: number[]) => [c[1], c[0]] as [number, number],
        )
        const p = f.properties || {}
        const color =
          p.network === 'sgr' ? '#3b82f6'      // SGR: blue
          : p.network === 'mgr' ? '#10b981'   // MGR: green
          : p.network === 'uganda' ? '#f59e0b' // legacy: amber
          : p.electrification ? '#a855f7'      // industrial: purple
          : '#64748b'                          // unknown: gray
        lines.push({
          id: `rail-${f.properties?.id ?? Math.random()}`,
          points: pts,
          color,
          weight: p.network === 'sgr' ? 4 : 3,
          opacity: 0.8,
          label: p.name || p.network || 'Rail line',
        })
      }

      for (const f of stationsFC.features ?? []) {
        const coords = f?.geometry?.coordinates
        if (!coords || coords.length < 2) continue
        const p = f.properties || {}
        const isTerminal = p.station_type === 'terminal' || p.station_type === 'interchange'
        markers.push({
          id: `station-${f.properties?.id ?? Math.random()}`,
          lat: coords[1],
          lon: coords[0],
          title: p.name || p.code,
          subtitle:
            `${p.code ?? ''} · ${p.station_type ?? ''} · ${p.network ?? ''}`.trim(' ·'),
          color: isTerminal ? 'red' : p.network === 'sgr' ? 'blue' : 'green',
          size: isTerminal ? 'lg' : 'sm',
        })
      }
      return { lines, markers }
    },
  }
}
