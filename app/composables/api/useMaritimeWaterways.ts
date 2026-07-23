// app/composables/api/useMaritimeWaterways.ts
// ─────────────────────────────────────────────────────────────────────
// Maritime Waterways (Design Doc §4) - chartered (surveyed, gazetted,
// regular commercial traffic) vs unchartered (unsurveyed, artisanal/
// small-vessel) waterway classification, plus waterway infrastructure:
// navigation buoys, lighthouses/lightvessels, radar/VHF stations, and
// dredged channel depth.
//
// Backend: apps/aviation_maritime/{models,serializers,views}.py.
// Live-verified against the real DRF responses. Physical navigation
// infrastructure isn't a separate waterway-only concept on this backend
// - `infrastructure()` returns the *same* NavigationAid/Channel rows
// used by useMaritimeInfrastructure() (§6), just filtered to ones that
// carry a `waterway` link - re-uses those types rather than redefining
// a parallel shape. "Vessel traffic count" and "incidents" per waterway
// are explicitly untracked on this backend (neither VesselMovement nor
// MaritimeIncident carries a waterway FK) - `summary()` reports them as
// `{tracked: false}` rather than a fabricated number.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'
import type { MaritimeNavaid, Channel as MaritimeChannelInfra } from './useMaritimeInfrastructure'

export type WaterwayCategory = 'chartered' | 'unchartered'
export interface Waterway {
  id: string
  name: string
  category: WaterwayCategory
  description: string
  region: string
  last_survey_date: string | null
  /** Unchartered waterways only. */
  access_restrictions: string
  agency: string | null
  created_at: string
  updated_at: string
}

export interface WaterwayInfrastructure {
  navigation_aids: MaritimeNavaid[]
  channels: MaritimeChannelInfra[]
  generated_at: string
}

// ── Summary (§4 dashboard rollup - per-waterway array) ─────────────────
export interface TrackedCount {
  value: number | null
  tracked: boolean
  reason?: string
}
export interface WaterwaySummaryChannel {
  name: string
  dredged_depth_m: number
  target_depth_m: number | null
}
export interface WaterwaySummaryRow {
  waterway: string
  category: WaterwayCategory
  navaids_operational_pct: number | null
  channels: WaterwaySummaryChannel[]
  vessel_traffic_count: TrackedCount
  incidents: TrackedCount
}
export interface MaritimeWaterwaysSummary {
  waterways: WaterwaySummaryRow[]
  generated_at: string
}

export interface MaritimeWaterwaysQuery {
  page?: number
  page_size?: number
  category?: WaterwayCategory
}

export function useMaritimeWaterways() {
  const api = useApi()
  const M = '/api/v1/aviation-maritime/maritime/waterways'

  return {
    summary: () => api<MaritimeWaterwaysSummary>(`${M}/summary/`),
    list: (q?: MaritimeWaterwaysQuery) =>
      api<Paged<Waterway>>(`${M}/`, { query: cleanQuery(q as Record<string, unknown>) }),
    infrastructure: (q?: { waterway?: string }) =>
      api<WaterwayInfrastructure>(`${M}/infrastructure/`, { query: cleanQuery(q as Record<string, unknown>) }),
  }
}
