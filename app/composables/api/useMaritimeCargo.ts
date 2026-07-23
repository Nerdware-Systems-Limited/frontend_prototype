// app/composables/api/useMaritimeCargo.ts
// ─────────────────────────────────────────────────────────────────────
// Maritime Cargo (Design Doc Section 3) - cargo type breakdown (FCL,
// LCL, bulk dry/liquid, RoRo, break bulk, reefer), the import pipeline
// (port of origin -> international sea -> Kenya sea/water area -> final
// destination) and export pipeline (reverse flow), cargo handling
// stage KPIs at port, and onward transport modes from port (road, rail,
// ICD transfer) with green-transport flags.
//
// Backend surface not yet implemented - written against the expected
// shape so the UI ships ahead of the API (mirrors useMaritimeInfrastructure).
// Container/TEU throughput and yard dwell that already exist live come
// from useAviationMaritime() - this composable only covers cargo-type
// and pipeline-stage detail the backend doesn't expose yet.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type MaritimeCargoType =
  | 'fcl' | 'lcl' | 'bulk_dry' | 'bulk_liquid'
  | 'roro' | 'roro_empty' | 'break_bulk' | 'reefer'

export interface CargoTypeStat {
  cargo_type: MaritimeCargoType
  shipments: number
  tonnage: number
  teus?: number | null
}

export type PipelineDirection = 'import' | 'export'
export type ImportStage = 'port_of_origin' | 'international_sea' | 'kenya_sea_water_area' | 'final_destination'
export type ExportStage = 'inland_origin' | 'kenya_sea_water_area' | 'international_sea' | 'port_of_destination'

export interface PipelineShipment {
  id: string
  direction: PipelineDirection
  cargo_type: MaritimeCargoType
  reference: string
  hs_code?: string | null
  port_unlocode: string
  origin_or_destination: string
  current_stage: ImportStage | ExportStage
  stage_entered_at: string
  customs_status?: string | null
  weight_tonnes?: number | null
  consignee?: string | null
}

export interface CargoHandlingStageKpi {
  stage: string
  who: string
  kpi_label: string
  kpi_value: number | null
  kpi_unit: string
  target_value?: number | null
}

export type OnwardTransportMode = 'road_normal' | 'road_ev' | 'road_reefer' | 'rail_standard' | 'rail_reefer' | 'rail_ev' | 'icd_transfer'
export type GreenFlag = 'yes' | 'no' | 'partial'
export interface OnwardTransportStat {
  mode: OnwardTransportMode
  moves_30d: number
  avg_transit_hours?: number | null
  green_flag: GreenFlag
  co2_saved_tonnes?: number | null
}

export interface MaritimeCargoSummary {
  kpis: {
    shipments_30d: number
    import_shipments_30d: number
    export_shipments_30d: number
    fcl_share_pct: number
    reefer_shipments_30d: number
    avg_gate_processing_min: number
  }
  generated_at: string
}

export interface MaritimeCargoQuery {
  page?: number
  page_size?: number
  port?: string
  direction?: PipelineDirection
  cargo_type?: MaritimeCargoType
  days?: number
}

export function useMaritimeCargo() {
  const api = useApi()
  const M = '/api/v1/aviation-maritime/maritime/cargo'

  return {
    summary: () => api<MaritimeCargoSummary>(`${M}/summary/`),
    byType: (q?: { days?: number }) =>
      api<{ days: number; results: CargoTypeStat[] }>(`${M}/by-type/`, { query: cleanQuery(q as Record<string, unknown>) }),
    pipeline: (q?: MaritimeCargoQuery) =>
      api<Paged<PipelineShipment>>(`${M}/pipeline/`, { query: cleanQuery(q as Record<string, unknown>) }),
    handlingStageKpis: () =>
      api<{ results: CargoHandlingStageKpi[] }>(`${M}/handling-stage-kpis/`),
    onwardTransport: (q?: { days?: number }) =>
      api<{ days: number; results: OnwardTransportStat[] }>(`${M}/onward-transport/`, { query: cleanQuery(q as Record<string, unknown>) }),
  }
}
