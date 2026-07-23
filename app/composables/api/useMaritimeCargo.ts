// app/composables/api/useMaritimeCargo.ts
// ─────────────────────────────────────────────────────────────────────
// Maritime Cargo (Design Doc §3) - cargo type breakdown (FCL, LCL, bulk
// dry/liquid, RoRo, break bulk, reefer), the import/export shipment
// pipeline (booking -> Kenya waters arrival -> customs -> final
// delivery), cargo handling stage KPIs at port, and onward transport
// modes from port (road, rail, ICD transfer) with green-transport flags.
//
// Backend: apps/aviation_maritime/{models,serializers,views}.py.
// Live-verified against the real DRF responses - types below match the
// actual serializer output field-for-field, not the design doc's
// aspirational field list. Two structural differences worth flagging:
//   - `pipeline()` rows are shipment *milestones* (booked_at,
//     kenya_waters_arrival_at, customs_cleared_at, final_delivery_at),
//     not a `cargo_type` + `current_stage` enum - there's no cargo_type
//     on a pipeline record (that's what by-type() is for) and "stage" is
//     derived client-side (see cargo.vue) from which milestones are set.
//   - `handlingStageKpis()` returns a fixed object keyed by stage name,
//     not an array - the 7 stages are a fixed backend contract.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type MaritimeCargoType =
  | 'fcl' | 'lcl' | 'bulk_dry' | 'bulk_liquid'
  | 'roro' | 'roro_empty' | 'break_bulk' | 'reefer'
export type CargoDirection = 'import' | 'export' | 'transit'

// ── §3.1 cargo type breakdown ──────────────────────────────────────────
export interface CargoTypeStat {
  cargo_type: MaritimeCargoType
  tonnes: number
  /** 0 for non-containerised types (bulk/break-bulk). */
  teu: number
  count: number
}

// ── §3.2/§3.5 shipment pipeline (import + export, reverse of each other) ─
export type PipelineDirection = 'import' | 'export'
export type PipelineDestinationMode = 'truck' | 'ev_truck' | 'reefer_truck' | 'rail' | 'icd_cfs'
export interface PipelineShipment {
  id: string
  reference: string
  direction: PipelineDirection
  vessel: string | null
  vessel_name: string | null
  port: string
  port_unlocode: string
  hs_code: string
  booked_at: string | null
  /** Import stage 1 only - vessel departs origin port. Not set for exports. */
  origin_departure_at: string | null
  /** Stage 3 - vessel enters Kenyan territorial waters. */
  kenya_waters_arrival_at: string | null
  customs_cleared_at: string | null
  final_delivery_at: string | null
  /** Derived server-side (final_delivery_at - booked_at); null until delivered. */
  total_transit_hours: number | null
  final_destination_mode: PipelineDestinationMode | ''
  consignee: string
  agency: string | null
  created_at: string
  updated_at: string
}

// ── §3.3 cargo handling stage KPIs - fixed object, not an array ────────
export interface TrackedStat {
  value: number | null
  tracked: boolean
  source?: string
  reason?: string
}
export interface HandlingStageKpis {
  days: number
  stages: {
    vessel_arrival: { on_time_arrival_pct: number | null; tracked: boolean; source: string }
    first_lift: { avg_hours: number | null; tracked: boolean; source: string }
    discharge_bch: { value: number | null; target: number; tracked: boolean; source: string }
    stacking_accuracy: { value: null; tracked: false; reason: string }
    gate_processing_minutes: { value: number | null; target_minutes: number; tracked: boolean; source: string }
    cargo_handling_damage_rate_pct: { value: number | null; tracked: boolean; source: string }
    icd_transit_hours: { value: null; tracked: false; reason: string }
  }
  generated_at: string
}

// ── §3.4 onward transport modes from port ──────────────────────────────
export type OnwardTransportMode =
  | 'truck' | 'ev_truck' | 'reefer_truck'
  | 'rail_standard' | 'rail_reefer' | 'rail_ev' | 'icd_transfer'
export type GreenFlag = 'yes' | 'no' | 'partial'
export interface OnwardTransportStat {
  mode: OnwardTransportMode
  green_transport_flag: GreenFlag
  container_count: number
  tonnes: number
  avg_delivery_time_hours: number | null
}

// ── Summary (§3 dashboard rollup - per-port array) ─────────────────────
export interface CargoSummaryPort {
  port_unlocode: string
  port_name: string
  cargo_tonnes: number
  cargo_teu: number
  pipeline_shipments_in_transit: number
  gate_events: number
  onward_transport_tonnes: number
}
export interface MaritimeCargoSummary {
  days: number
  ports: CargoSummaryPort[]
  generated_at: string
}

export interface MaritimeCargoQuery {
  page?: number
  page_size?: number
  port?: string
  direction?: PipelineDirection
  vessel?: string
}

export function useMaritimeCargo() {
  const api = useApi()
  const M = '/api/v1/aviation-maritime/maritime/cargo'

  return {
    summary: (days = 30) => api<MaritimeCargoSummary>(`${M}/summary/`, { query: { days } }),
    byType: (q?: { days?: number }) =>
      api<{ days: number; cargo_types: CargoTypeStat[] }>(`${M}/by-type/`, { query: cleanQuery(q as Record<string, unknown>) }),
    pipeline: (q?: MaritimeCargoQuery) =>
      api<Paged<PipelineShipment>>(`${M}/pipeline/`, { query: cleanQuery(q as Record<string, unknown>) }),
    handlingStageKpis: (days = 30) =>
      api<HandlingStageKpis>(`${M}/handling-stage-kpis/`, { query: { days } }),
    onwardTransport: (days = 30) =>
      api<{ days: number; modes: OnwardTransportStat[] }>(`${M}/onward-transport/`, { query: { days } }),

    // ── Supporting catalogues (§3.1/§3.4 raw rows, not just the rollups above) ─
    cargoTypeRecords: (q?: MaritimeCargoQuery & { cargo_type?: MaritimeCargoType; direction?: CargoDirection }) =>
      api<Paged<any>>(`${M}/types/`, { query: cleanQuery(q as Record<string, unknown>) }),
    onwardTransportRecords: (q?: MaritimeCargoQuery & { mode?: OnwardTransportMode }) =>
      api<Paged<any>>(`${M}/onward-transport-records/`, { query: cleanQuery(q as Record<string, unknown>) }),
    gateEvents: (q?: MaritimeCargoQuery) =>
      api<Paged<any>>(`${M}/gate-events/`, { query: cleanQuery(q as Record<string, unknown>) }),
  }
}
