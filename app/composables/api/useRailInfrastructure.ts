// app/composables/api/useRailInfrastructure.ts
// ─────────────────────────────────────────────────────────────────────
// Rail infrastructure asset management - track condition, facilities
// (stations/depots/terminals/level crossings/signalling/telecom/
// bridges/culverts), and capital works.
//
// Backend surface not yet implemented - written against the expected
// shape so the UI ships ahead of the API (mirrors useVehicleInspections
// / useDriverLicensing). Pages using this composable degrade gracefully
// (Promise.allSettled + error banner); real KPIs that ARE derivable
// today come from useRailway() (RailLine/RailStation), not from here.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'
import type { RailNetwork } from './useRailway'

export type TrackConditionClass = 'good' | 'fair' | 'poor' | 'critical'
export type FacilityType = 'station' | 'depot' | 'freight_terminal' | 'level_crossing' | 'signal' | 'telecom' | 'bridge' | 'culvert'
export type FacilityStatus = 'operational' | 'degraded' | 'out_of_service' | 'under_maintenance'
export type CrossingProtectionType = 'barrier' | 'automatic_signal' | 'attendant' | 'unprotected'
export type CrossingRiskRating = 'low' | 'medium' | 'high' | 'critical'
export type CapitalWorkStatus = 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'

export interface TrackSection {
  id: string
  network: RailNetwork
  line: string
  line_name?: string | null
  section_name: string
  km_start: number
  km_end: number
  gauge: string
  status: TrackConditionClass
  speed_restriction_kmh?: number | null
  condition_score?: number | null
  last_inspection?: string | null
  next_inspection?: string | null
  defect_type?: string | null
  responsible_unit?: string | null
}

export interface RailFacility {
  id: string
  facility_type: FacilityType
  name: string
  network: RailNetwork
  status: FacilityStatus
  health_score?: number | null
  maintenance_due?: string | null
  location?: string | null
}

export interface LevelCrossing {
  id: string
  crossing_ref: string
  location: string
  network: RailNetwork
  risk_rating: CrossingRiskRating
  protection_type: CrossingProtectionType
  incident_count: number
  near_miss_count: number
  last_inspection?: string | null
  next_inspection?: string | null
  recommended_intervention?: string | null
}

export interface CapitalWork {
  id: string
  project_name: string
  network: RailNetwork
  contractor?: string | null
  scope: string
  start_date?: string | null
  end_date?: string | null
  physical_progress_pct?: number | null
  financial_progress_pct?: number | null
  dependency?: string | null
  risk?: string | null
  expected_capacity_impact?: string | null
  value_kes?: number | null
}

export interface RailInfraSummary {
  kpis: {
    operational_track_km: number
    track_km_under_maintenance: number
    poor_critical_sections: number
    signal_availability_pct: number
    level_crossings_needing_action: number
    station_facility_uptime_pct: number
    bridges_culverts_poor: number
    open_work_orders: number
    capital_works_value_kes: number
  }
  generated_at: string
}

export interface RailInfraQuery {
  page?: number
  page_size?: number
  network?: RailNetwork
  status?: string
  facility_type?: FacilityType
  risk_rating?: CrossingRiskRating
}

export function useRailInfrastructure() {
  const api = useApi()
  const R = '/api/v1/railway/infrastructure'

  return {
    summary: () => api<RailInfraSummary>(`${R}/summary/`),

    trackSections: (q?: RailInfraQuery) =>
      api<Paged<TrackSection>>(`${R}/track-sections/`, { query: cleanQuery(q as Record<string, unknown>) }),

    facilities: (q?: RailInfraQuery) =>
      api<Paged<RailFacility>>(`${R}/facilities/`, { query: cleanQuery(q as Record<string, unknown>) }),

    levelCrossings: (q?: RailInfraQuery) =>
      api<Paged<LevelCrossing>>(`${R}/level-crossings/`, { query: cleanQuery(q as Record<string, unknown>) }),

    capitalWorks: (q?: RailInfraQuery) =>
      api<Paged<CapitalWork>>(`${R}/capital-works/`, { query: cleanQuery(q as Record<string, unknown>) }),
  }
}
