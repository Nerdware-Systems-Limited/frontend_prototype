// app/composables/api/useMaritimeGreenTransport.ts
// ─────────────────────────────────────────────────────────────────────
// Maritime Green Transport (Design Doc §8) - cuts across water, rail,
// and road: vessel fuel type / emissions per TEU-km, shore power (cold
// ironing) usage, EV truck/train fleets in the port hinterland, and
// cold-chain (reefer) energy tracking.
//
// Backend: apps/aviation_maritime/{models,serializers,views}.py.
// Live-verified against the real DRF responses. Notable deviations from
// the design doc / earlier guessed shape:
//   - `summary()` is a per-port array (`{ports: [...]}`), not a flat
//     `kpis` object - same rollup shape as every other maritime summary.
//   - `modeStats()`'s "water" row and "ev_truck"/"ev_train" rows carry
//     DIFFERENT fields (water has co2/shore-power stats, EV rows have
//     fleet_size/energy/km/co2_saved) - it's a discriminated union keyed
//     by `mode`, not a uniform row shape.
//   - `ReeferEnergyRecord` only tracks `plugged_in_containers` (a count
//     of containers currently plugged in) - there's no total-capacity
//     ("reefer_plugs_total") or `commodity` field on this backend.
//   - Marine pollution incidents reuse the existing `MaritimeIncident`
//     model (`incident_type="oil_spill"`) rather than a new one - only
//     surfaced as a per-port count inside `summary()`.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type VesselFuelType = 'hfo' | 'mgo' | 'lng' | 'methanol' | 'zero_emission'
export interface VesselEmissionRecord {
  id: string
  vessel: string
  vessel_name: string | null
  port: string | null
  port_unlocode: string | null
  report_date: string
  fuel_type: VesselFuelType
  fuel_consumption_tonnes: number
  teu_carried: number
  voyage_distance_km: number | null
  co2_emissions_tonnes: number
  /** Server-computed - null when teu_carried or voyage_distance_km is 0/unset. */
  co2_g_per_teu_km: number | null
  shore_power_pct: number | null
  agency: string | null
  created_at: string
  updated_at: string
}

export type EVFleetVehicleType = 'ev_truck' | 'ev_train'
export interface EVFleetRecord {
  id: string
  vehicle_type: EVFleetVehicleType
  port: string
  port_unlocode: string | null
  report_date: string
  fleet_size: number
  energy_kwh: number
  km_driven: number
  co2_saved_tonnes: number
  agency: string | null
  created_at: string
  updated_at: string
}

export interface ReeferEnergyRecord {
  id: string
  port: string
  port_unlocode: string
  report_date: string
  plugged_in_containers: number
  energy_kwh: number
  agency: string | null
  created_at: string
  updated_at: string
}

// ── §8.1 mode-stats - discriminated union: "water" carries different
// fields than "ev_truck"/"ev_train" ──────────────────────────────────
export interface GreenModeWaterStat {
  mode: 'water'
  label: string
  co2_emissions_tonnes: number
  avg_g_co2_per_teu_km: number | null
  avg_shore_power_pct: number | null
  target: string
}
export interface GreenModeEvStat {
  mode: EVFleetVehicleType
  label: string
  fleet_size: number
  energy_kwh: number
  km_driven: number
  co2_saved_tonnes: number
}
export type GreenTransportModeStat = GreenModeWaterStat | GreenModeEvStat

// ── Summary (§8 dashboard rollup - per-port array) ──────────────────────
export interface GreenSummaryPort {
  port_unlocode: string
  port_name: string
  vessel_co2_emissions_tonnes: number
  avg_shore_power_pct: number | null
  ev_truck_fleet_size: number
  ev_truck_co2_saved_tonnes: number
  reefer_energy_kwh: number
  marine_pollution_incidents: number
}
export interface MaritimeGreenSummary {
  days: number
  ports: GreenSummaryPort[]
  generated_at: string
}

export interface MaritimeGreenQuery {
  page?: number
  page_size?: number
  port?: string
  fuel_type?: VesselFuelType
  days?: number
}

export function useMaritimeGreenTransport() {
  const api = useApi()
  const M = '/api/v1/aviation-maritime/maritime/green-transport'

  return {
    summary: (days = 30) => api<MaritimeGreenSummary>(`${M}/summary/`, { query: { days } }),
    vesselEmissions: (q?: MaritimeGreenQuery) =>
      api<Paged<VesselEmissionRecord>>(`${M}/vessel-emissions/`, { query: cleanQuery(q as Record<string, unknown>) }),
    modeStats: (days = 30) =>
      api<{ days: number; modes: GreenTransportModeStat[]; generated_at: string }>(`${M}/mode-stats/`, { query: { days } }),
    evFleet: (q?: MaritimeGreenQuery & { vehicle_type?: EVFleetVehicleType }) =>
      api<Paged<EVFleetRecord>>(`${M}/ev-fleet/`, { query: cleanQuery(q as Record<string, unknown>) }),
    reeferEnergy: (q?: MaritimeGreenQuery) =>
      api<Paged<ReeferEnergyRecord>>(`${M}/reefer-energy/`, { query: cleanQuery(q as Record<string, unknown>) }),
  }
}
