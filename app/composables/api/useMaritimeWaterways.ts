// app/composables/api/useMaritimeWaterways.ts
// ─────────────────────────────────────────────────────────────────────
// Maritime Waterways (Design Doc Section 4) - chartered (surveyed,
// gazetted, regular commercial traffic) vs unchartered (unsurveyed,
// artisanal/small-vessel) waterway classification, plus waterway
// infrastructure: navigation buoys, lighthouses/lightvessels, dredged
// channel depth, pilotage boarding grounds, and VHF radio coverage.
//
// Backend surface not yet implemented - written against the expected
// shape so the UI ships ahead of the API (mirrors useMaritimeInfrastructure).
// Per-berth channel depth already tracked live under useMaritimeInfrastructure()
// covers individual port approach channels - this composable covers the
// broader waterway network (including unchartered/unregistered water bodies).
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type WaterwayCategory = 'chartered' | 'unchartered'
export interface Waterway {
  id: string
  name: string
  category: WaterwayCategory
  region: string
  vessel_traffic_count_30d?: number | null
  dredging_depth_m?: number | null
  last_maintenance?: string | null
  incidents_30d?: number | null
  unregistered_vessel_activity?: boolean | null
  pollution_incidents_30d?: number | null
  access_restrictions?: string | null
}

export type WaterwayInfraItem = 'navigation_buoy' | 'lighthouse' | 'channel_depth' | 'pilotage_boarding_ground' | 'vhf_coverage'
export interface WaterwayInfrastructureRecord {
  id: string
  waterway_id: string
  waterway_name: string
  item: WaterwayInfraItem
  operational_pct?: number | null
  uptime_pct?: number | null
  depth_below_chart_datum_m?: number | null
  all_weather_accessible?: boolean | null
  vhf_coverage_pct?: number | null
  status: 'operational' | 'degraded' | 'out_of_service'
}

export interface MaritimeWaterwaysSummary {
  kpis: {
    chartered_waterways: number
    unchartered_waterways: number
    navaid_operational_pct: number
    lighthouse_uptime_pct: number
    vhf_coverage_pct: number
    incidents_30d: number
  }
  generated_at: string
}

export interface MaritimeWaterwaysQuery {
  page?: number
  page_size?: number
  category?: WaterwayCategory
  region?: string
}

export function useMaritimeWaterways() {
  const api = useApi()
  const M = '/api/v1/aviation-maritime/maritime/waterways'

  return {
    summary: () => api<MaritimeWaterwaysSummary>(`${M}/summary/`),
    list: (q?: MaritimeWaterwaysQuery) =>
      api<Paged<Waterway>>(`${M}/`, { query: cleanQuery(q as Record<string, unknown>) }),
    infrastructure: (q?: { waterway?: string; item?: WaterwayInfraItem }) =>
      api<Paged<WaterwayInfrastructureRecord>>(`${M}/infrastructure/`, { query: cleanQuery(q as Record<string, unknown>) }),
  }
}
