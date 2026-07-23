// app/composables/api/useMaritimePerformance.ts
// ─────────────────────────────────────────────────────────────────────
// Maritime Port Performance KPIs & Ranking (Design Doc Section 9) -
// international-standard port KPIs (UNCTAD / IAPH / World Bank Logistics
// Performance Index) and the composite port ranking framework
// (Vessel Efficiency 30% / Cargo Handling Speed 25% / Turnaround & Dwell
// 25% / Revenue & Throughput 10% / Safety & Environmental 10%).
//
// Backend surface not yet implemented - written against the expected
// shape so the UI ships ahead of the API (mirrors useMaritimeInfrastructure).
// Vessel turnaround, TEU throughput, and yard dwell that already exist
// live come from useAviationMaritime() and are blended client-side with
// the benchmark fields below (BCH, berth occupancy, ship waiting time,
// truck turnaround, reefer plug utilisation, train frequency, revenue/TEU)
// that the backend doesn't expose yet.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'

export interface PortPerformanceKpi {
  port_unlocode: string
  port_name: string
  berth_occupancy_rate_pct?: number | null
  bch_moves_per_crane_hour?: number | null
  ship_waiting_time_hrs?: number | null
  truck_turnaround_min?: number | null
  reefer_plug_utilisation_pct?: number | null
  train_departures_per_day?: number | null
  revenue_per_teu_kes?: number | null
}

export interface PortRankingScore {
  port_unlocode: string
  port_name: string
  vessel_efficiency_score: number
  cargo_handling_score: number
  turnaround_dwell_score: number
  revenue_throughput_score: number
  safety_environmental_score: number
  composite_score: number
  regional_rank?: number | null
  national_rank?: number | null
}

export interface MaritimePerformanceSummary {
  kpis: {
    avg_bch: number
    avg_berth_occupancy_pct: number
    avg_ship_waiting_hrs: number
    avg_truck_turnaround_min: number
    avg_train_departures_per_day: number
  }
  generated_at: string
}

export const RANK_WEIGHTS = {
  vessel_efficiency: 0.30,
  cargo_handling: 0.25,
  turnaround_dwell: 0.25,
  revenue_throughput: 0.10,
  safety_environmental: 0.10,
} as const

export function useMaritimePerformance() {
  const api = useApi()
  const M = '/api/v1/aviation-maritime/maritime/performance'

  return {
    summary: () => api<MaritimePerformanceSummary>(`${M}/summary/`),
    kpis: (q?: { port?: string }) =>
      api<{ results: PortPerformanceKpi[] }>(`${M}/kpis/`, { query: cleanQuery(q as Record<string, unknown>) }),
    ranking: () =>
      api<{ results: PortRankingScore[] }>(`${M}/ranking/`),
  }
}
