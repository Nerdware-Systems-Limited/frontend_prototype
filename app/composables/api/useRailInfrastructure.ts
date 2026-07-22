// app/composables/api/useRailInfrastructure.ts
// ─────────────────────────────────────────────────────────────────────
// Rail infrastructure asset registry - track sections, level crossings,
// culverts, signals, and capital works. Verified directly against the
// live backend OpenAPI schema (/api/schema/) - every field below matches
// a real response, not an assumed shape.
//
// There is no dedicated "facilities" (station/depot/terminal asset
// health) or infrastructure-level summary endpoint on the backend -
// those genuinely don't exist yet. Station/terminal presence comes from
// useRailway().stations() instead.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type RailType = 'welded' | 'jointed'
export type SleeperType = 'concrete' | 'wooden' | 'steel'
export type TrackCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
export type CrossingProtectionType = 'gated_manual' | 'gated_automatic' | 'lights_only' | 'unguarded'
export type CrossingRiskRating = 'critical' | 'high' | 'medium' | 'low'
export type CapitalWorkProjectType = 'new_line' | 'electrification' | 'rehabilitation' | 'station_upgrade' | 'signalling_upgrade' | 'rolling_stock'
export type CapitalWorkStatus = 'planned' | 'in_progress' | 'completed' | 'suspended'
export type CulvertType = 'box' | 'pipe' | 'arch' | 'slab'
export type CulvertCondition = 'good' | 'fair' | 'poor' | 'critical'
export type SignalType = 'color_light' | 'semaphore' | 'interlocking' | 'automatic_block'
export type RailSignalStatus = 'operational' | 'faulty' | 'maintenance' | 'decommissioned'

export interface TrackSection {
  id: string
  line: string
  line_name?: string | null
  section_ref: string
  chainage_start_km: number
  chainage_end_km: number
  rail_type: RailType
  sleeper_type: SleeperType
  track_condition: TrackCondition
  posted_speed_kmh: number | null
  last_inspected_at: string | null
  next_inspection_due: string | null
  created_at?: string
  updated_at?: string
}

export interface LevelCrossing {
  id: string
  line: string
  line_name?: string | null
  crossing_ref: string
  road_name: string
  latitude: number
  longitude: number
  protection_type: CrossingProtectionType
  risk_rating: CrossingRiskRating
  near_miss_count: number
  daily_road_traffic: number | null
  daily_train_movements: number | null
  last_incident_at: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface RailCapitalWork {
  id: string
  project_ref: string
  project_name: string
  project_type: CapitalWorkProjectType
  line: string | null
  line_name?: string | null
  status: CapitalWorkStatus
  budget_kes: string
  spent_kes: string
  progress_pct: number
  funding_source: string
  contractor: string
  start_date: string | null
  expected_completion: string | null
  actual_completion: string | null
  created_at?: string
  updated_at?: string
}

export interface RailCulvert {
  id: string
  line: string
  line_name?: string | null
  culvert_ref: string
  chainage_km: number
  culvert_type: CulvertType
  span_m: number | null
  condition: CulvertCondition
  last_inspected_at: string | null
  next_inspection_due: string | null
  created_at?: string
  updated_at?: string
}

export interface RailSignal {
  id: string
  line: string
  line_name?: string | null
  station: string | null
  station_code?: string | null
  signal_ref: string
  signal_type: SignalType
  chainage_km: number | null
  status: RailSignalStatus
  is_automatic: boolean
  last_maintenance: string | null
  created_at?: string
  updated_at?: string
}

export interface RailInfraQuery {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
}

export function useRailInfrastructure() {
  const api = useApi()
  const R = '/api/v1/railway'

  return {
    trackSections: (q?: RailInfraQuery) =>
      api<Paged<TrackSection>>(`${R}/track-sections/`, { query: cleanQuery(q as Record<string, unknown>) }),
    trackSectionConditionSummary: () =>
      api<unknown>(`${R}/track-sections/condition-summary/`),

    levelCrossings: (q?: RailInfraQuery) =>
      api<Paged<LevelCrossing>>(`${R}/level-crossings/`, { query: cleanQuery(q as Record<string, unknown>) }),
    highRiskLevelCrossings: () =>
      api<Paged<LevelCrossing> | LevelCrossing[]>(`${R}/level-crossings/high-risk/`),

    capitalWorks: (q?: RailInfraQuery) =>
      api<Paged<RailCapitalWork>>(`${R}/capital-works/`, { query: cleanQuery(q as Record<string, unknown>) }),
    capitalWorksByStatus: () =>
      api<unknown>(`${R}/capital-works/by-status/`),

    culverts: (q?: RailInfraQuery) =>
      api<Paged<RailCulvert>>(`${R}/culverts/`, { query: cleanQuery(q as Record<string, unknown>) }),

    signals: (q?: RailInfraQuery) =>
      api<Paged<RailSignal>>(`${R}/signals/`, { query: cleanQuery(q as Record<string, unknown>) }),
    signalFaults: () =>
      api<Paged<RailSignal> | RailSignal[]>(`${R}/signals/faults/`),
  }
}
