// app/composables/api/useAviationInfrastructure.ts
// ─────────────────────────────────────────────────────────────────────
// Aviation infrastructure asset management - runway/taxiway condition,
// navigational aids, terminal/ATC/fuel-farm facilities, and KAA capital
// works.
//
// Backend surface not yet implemented - written against the expected
// shape so the UI ships ahead of the API (mirrors useRailInfrastructure).
// Real airport-registry facts (runway_count, design_capacity_passengers,
// elevation, international status) already come from
// useAviationMaritime().airports() - this composable only covers the
// condition/health fields the backend doesn't expose yet.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type RunwayStatus = 'operational' | 'restricted' | 'closed' | 'under_maintenance'
export type NavaidType = 'vor' | 'ils' | 'ndb' | 'dme' | 'asr' | 'aws'
export type NavaidStatus = 'operational' | 'degraded' | 'out_of_service'
export type AviationFacilityType = 'terminal' | 'atc_tower' | 'fuel_farm' | 'ground_handling' | 'fire_rescue'
export type AviationFacilityStatus = 'operational' | 'degraded' | 'out_of_service' | 'under_maintenance'

export interface Runway {
  id: string
  airport: string
  airport_iata: string
  runway_id: string
  length_m: number
  surface_type: string
  pcn_rating?: number | null
  status: RunwayStatus
  last_inspection?: string | null
  next_inspection?: string | null
  defect_notes?: string | null
}

export interface Navaid {
  id: string
  airport: string
  airport_iata: string
  navaid_type: NavaidType
  status: NavaidStatus
  last_calibration?: string | null
  next_calibration?: string | null
}

export interface AviationFacility {
  id: string
  airport: string
  airport_iata: string
  facility_type: AviationFacilityType
  name: string
  status: AviationFacilityStatus
  capacity_pax_hour?: number | null
  utilization_pct?: number | null
  maintenance_due?: string | null
}

export interface AviationCapitalWork {
  id: string
  project_name: string
  airport: string
  airport_iata: string
  contractor?: string | null
  scope: string
  physical_progress_pct?: number | null
  financial_progress_pct?: number | null
  value_kes?: number | null
  expected_capacity_impact?: string | null
}

export interface AviationInfraSummary {
  kpis: {
    runway_availability_pct: number
    navaid_operational_pct: number
    terminals_over_capacity: number
    atc_infra_health_pct: number
    fuel_farms_degraded: number
    open_work_orders: number
    capital_works_value_kes: number
    icao_annex14_compliance_pct: number
  }
  generated_at: string
}

export interface AviationInfraQuery {
  page?: number
  page_size?: number
  airport?: string
  status?: string
  facility_type?: AviationFacilityType
}

export function useAviationInfrastructure() {
  const api = useApi()
  const A = '/api/v1/aviation-maritime/aviation/infrastructure'

  return {
    summary: () => api<AviationInfraSummary>(`${A}/summary/`),
    runways: (q?: AviationInfraQuery) =>
      api<Paged<Runway>>(`${A}/runways/`, { query: cleanQuery(q as Record<string, unknown>) }),
    navaids: (q?: AviationInfraQuery) =>
      api<Paged<Navaid>>(`${A}/navaids/`, { query: cleanQuery(q as Record<string, unknown>) }),
    facilities: (q?: AviationInfraQuery) =>
      api<Paged<AviationFacility>>(`${A}/facilities/`, { query: cleanQuery(q as Record<string, unknown>) }),
    capitalWorks: (q?: AviationInfraQuery) =>
      api<Paged<AviationCapitalWork>>(`${A}/capital-works/`, { query: cleanQuery(q as Record<string, unknown>) }),
  }
}
