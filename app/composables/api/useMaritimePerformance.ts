// app/composables/api/useMaritimePerformance.ts
// ─────────────────────────────────────────────────────────────────────
// Maritime Port Performance KPIs & Ranking (Design Doc §9) -
// international-standard port KPIs (UNCTAD / IAPH / World Bank Logistics
// Performance Index) and the composite port ranking framework
// (Vessel Efficiency 30% / Cargo Handling Speed 25% / Turnaround & Dwell
// 25% / Revenue & Throughput 10% / Safety & Environmental 10%).
//
// Backend: apps/aviation_maritime/views.py (PerformanceSummaryView,
// PerformanceKPIView, PerformanceRankingView). Live-verified against the
// real DRF responses. Every field in `kpis()` is a `{value, tracked,
// source|reason, target*}` tuple, not a bare number - two fields
// (`reefer_plug_utilization_pct`, `train_departures_per_day`) are
// permanently `tracked: false` (no data source modeled anywhere in this
// app), surfaced honestly rather than fabricated. `ranking()` scores are
// min-max normalized 0-100 per category across compared ports; a port
// missing a category has it dropped from `category_scores` and listed in
// `missing_categories`, with the composite renormalized over what's left.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'

// ── Summary (§9 dashboard rollup - per-port array) ──────────────────────
export interface PerformanceSummaryPort {
  port_unlocode: string
  port_name: string
  avg_turnaround_hours: number | null
  berth_occupancy_pct: number | null
  avg_cargo_dwell_days: number | null
  bch: number | null
  teu_throughput: number
}
export interface MaritimePerformanceSummary {
  days: number
  ports: PerformanceSummaryPort[]
  generated_at: string
}

// ── §9.1 core KPIs per port - every field is a tracked-value tuple ─────
export interface TrackedKpiField {
  value: number | null
  tracked: boolean
  source?: string
  reason?: string
}
export interface PortPerformanceKpi {
  port: string
  port_name: string
  vessel_turnaround_hours: TrackedKpiField & { target_hours: number }
  berth_occupancy_pct: TrackedKpiField & { target_pct: [number, number] }
  bch: TrackedKpiField & { target: number }
  cargo_dwell_days: TrackedKpiField & { target_days: number }
  waiting_time_hours: TrackedKpiField & { target_hours: number }
  teu_throughput: TrackedKpiField & { target: null }
  revenue_per_teu_kes: TrackedKpiField & { target: null }
  truck_turnaround_minutes: TrackedKpiField & { target_minutes: number }
  /** Permanently untracked - no reefer plug telemetry modeled anywhere. */
  reefer_plug_utilization_pct: TrackedKpiField & { target: null }
  /** Permanently untracked - no rail-port interface data modeled. */
  train_departures_per_day: TrackedKpiField & { target: number }
}

// ── §9.2 composite port ranking ─────────────────────────────────────────
export type RankingCategory =
  | 'vessel_efficiency' | 'cargo_handling_speed' | 'turnaround_dwell'
  | 'revenue_throughput' | 'safety_environmental'
export interface PortRankingScore {
  port: string
  port_name: string
  composite_score: number
  category_scores: Partial<Record<RankingCategory, number>>
  missing_categories: RankingCategory[]
  rank: number
}
export interface MaritimeRanking {
  days: number
  methodology: string
  weights: Record<RankingCategory, number>
  rankings: PortRankingScore[]
  generated_at: string
}

/** Matches `_RANKING_CATEGORY_WEIGHTS` in apps/aviation_maritime/views.py. */
export const RANK_WEIGHTS: Record<RankingCategory, number> = {
  vessel_efficiency: 0.30,
  cargo_handling_speed: 0.25,
  turnaround_dwell: 0.25,
  revenue_throughput: 0.10,
  safety_environmental: 0.10,
}

export function useMaritimePerformance() {
  const api = useApi()
  const M = '/api/v1/aviation-maritime/maritime/performance'

  return {
    summary: (days = 30) => api<MaritimePerformanceSummary>(`${M}/summary/`, { query: { days } }),
    kpis: (q?: { port?: string; days?: number }) =>
      api<{ days: number; ports: PortPerformanceKpi[]; generated_at: string }>(`${M}/kpis/`, { query: cleanQuery(q as Record<string, unknown>) }),
    ranking: (days = 30) =>
      api<MaritimeRanking>(`${M}/ranking/`, { query: { days } }),
  }
}
