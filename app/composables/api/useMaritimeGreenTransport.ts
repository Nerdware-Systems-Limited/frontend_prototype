// app/composables/api/useMaritimeGreenTransport.ts
// ─────────────────────────────────────────────────────────────────────
// Maritime Green Transport (Design Doc Section 8) - cuts across water,
// rail, and road: vessel fuel type / emissions per TEU-km, shore power
// (cold ironing) usage, EV truck/train fleets in the port hinterland,
// and cold-chain (reefer) energy tracking. Marine pollution incident
// counts already exist live via useAviationMaritime().maritimeIncidentStats() -
// this composable covers the emissions/EV/cold-chain fields the backend
// doesn't expose yet.
//
// Backend surface not yet implemented - written against the expected
// shape so the UI ships ahead of the API (mirrors useMaritimeInfrastructure).
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type VesselFuelType = 'hfo' | 'mgo' | 'lng' | 'methanol' | 'zero_emission'
export interface VesselEmissionRecord {
  id: string
  vessel_imo: string
  vessel_name: string
  port_unlocode?: string | null
  fuel_type: VesselFuelType
  fuel_consumption_tonnes: number
  teu_moved?: number | null
  co2_per_teu_km_g?: number | null
  shore_power_used: boolean
  shore_power_pct_of_port_time?: number | null
  voyage_date: string
}

export type GreenModeCategory = 'water' | 'rail' | 'ev_vehicle'
export interface GreenTransportModeStat {
  category: GreenModeCategory
  label: string
  metric_label: string
  metric_value: number | null
  metric_unit: string
  target_value?: number | null
}

export interface EvFleetStat {
  fleet_type: 'ev_truck' | 'ev_train'
  count_in_service: number
  kwh_consumed_month: number
  km_driven_month?: number | null
  co2_saved_tonnes_month: number
}

export interface ReeferEnergyRecord {
  id: string
  port_unlocode: string
  reefer_plugs_total: number
  reefer_plugs_in_use: number
  kwh_consumed_month: number
  commodity?: string | null
}

export interface MaritimeGreenSummary {
  kpis: {
    avg_co2_per_teu_km_g: number
    shore_power_usage_pct: number
    ev_truck_fleet_size: number
    ev_train_share_pct: number
    co2_saved_tonnes_month: number
    reefer_plug_utilisation_pct: number
  }
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
    summary: () => api<MaritimeGreenSummary>(`${M}/summary/`),
    vesselEmissions: (q?: MaritimeGreenQuery) =>
      api<Paged<VesselEmissionRecord>>(`${M}/vessel-emissions/`, { query: cleanQuery(q as Record<string, unknown>) }),
    modeStats: () =>
      api<{ results: GreenTransportModeStat[] }>(`${M}/mode-stats/`),
    evFleet: () =>
      api<{ results: EvFleetStat[] }>(`${M}/ev-fleet/`),
    reeferEnergy: (q?: { port?: string }) =>
      api<Paged<ReeferEnergyRecord>>(`${M}/reefer-energy/`, { query: cleanQuery(q as Record<string, unknown>) }),
  }
}
