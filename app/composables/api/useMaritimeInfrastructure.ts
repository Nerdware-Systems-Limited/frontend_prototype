// app/composables/api/useMaritimeInfrastructure.ts
// ─────────────────────────────────────────────────────────────────────
// Maritime infrastructure (Design Doc §6 Maritime Infrastructure + §4.2
// Waterway Infrastructure) - channel depth/dredging, navigational aids
// (buoys, lighthouses, radar/VHF stations), dry-dock/ship repair
// facilities, inland container depots (ICDs, aliased onto the port
// registry - see `icds()` below), and KPA capital works.
//
// Backend: apps/aviation_maritime/{models,serializers,views}.py.
// Live-verified against the real DRF responses - types below match the
// actual serializer output field-for-field, not the design doc's
// aspirational field list.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'
import type { Port } from './useAviationMaritime'

// ── Channels (§4.2 dredged navigation channel depth) ──────────────────
// No `status` field on the backend - there's no compliant/restricted
// enum, just raw depth numbers. Compute a "meets target" indicator
// client-side from `dredged_depth_m` vs `target_depth_m` if needed.
export interface Channel {
  id: string
  name: string
  port: string | null
  port_unlocode: string | null
  waterway: string | null
  waterway_name: string | null
  dredged_depth_m: number
  target_depth_m: number | null
  last_dredged_date: string | null
  agency: string | null
  created_at: string
  updated_at: string
}

// ── Navigation aids (§6/§4.2 - buoys, lighthouses, radar/VHF stations) ─
export type MaritimeNavaidType = 'buoy' | 'lighthouse' | 'lightvessel' | 'radar_station' | 'vhf_station'
export type MaritimeNavaidStatus = 'operational' | 'non_operational' | 'maintenance'
export interface MaritimeNavaid {
  id: string
  aid_type: MaritimeNavaidType
  name: string
  port: string | null
  port_unlocode: string | null
  waterway: string | null
  waterway_name: string | null
  latitude: number | null
  longitude: number | null
  operational_status: MaritimeNavaidStatus
  /** § 4.2 lighthouse target: 99.9%. Only populated for lighthouse/vhf_station aid types. */
  uptime_pct: number | null
  agency: string | null
  created_at: string
  updated_at: string
}

// ── Dry docks (§6 vessel repair/maintenance facilities) ───────────────
export type DryDockType = 'graving_dock' | 'floating_dock' | 'slipway'
export type DryDockOperationalStatus = 'operational' | 'under_maintenance' | 'decommissioned'
export interface DryDock {
  id: string
  port: string
  port_unlocode: string
  name: string
  dock_type: DryDockType
  max_vessel_loa_m: number
  capacity_dwt: number
  operational_status: DryDockOperationalStatus
  operator: string
  agency: string | null
  created_at: string
  updated_at: string
}

// ── ICDs (§1.2/1.4) ─────────────────────────────────────────────────
// Not a distinct backend entity - the `icds/` endpoint is the same Port
// registry filtered to `port_type=inland_dry` (ICDViewSet re-uses
// PortSerializer). There is no capacity_teu/utilisation/linked_port on
// this backend - an ICD *is* a Port row, not a facility linked to one.
export type InlandContainerDepot = Port

// ── Capital works (§6 major infrastructure investment projects) ──────
export type CapitalWorkType =
  | 'berth_construction' | 'channel_dredging' | 'yard_expansion'
  | 'gate_system_upgrade' | 'navigation_aid_installation' | 'other'
export type CapitalWorkStatus = 'planned' | 'in_progress' | 'completed' | 'suspended'
export interface MaritimeCapitalWork {
  id: string
  project_ref: string
  project_name: string
  project_type: CapitalWorkType
  port: string | null
  port_unlocode: string | null
  status: CapitalWorkStatus
  /** DecimalField - serialized as a string by DRF, parse before arithmetic. */
  budget_kes: string
  spent_kes: string
  funding_source: string
  contractor: string
  start_date: string | null
  expected_completion: string | null
  actual_completion: string | null
  created_at: string
  updated_at: string
}

// ── Summary (§6 dashboard rollup - per-port array, not a flat `kpis` object) ─
export interface InfraSummaryChannel {
  name: string
  dredged_depth_m: number
  target_depth_m: number | null
}
export interface InfraSummaryPort {
  port_unlocode: string
  port_name: string
  berth_availability_pct: number | null
  navaids_operational_pct: number | null
  channels: InfraSummaryChannel[]
  dry_docks_operational: number
  capital_works_active_count: number
  capital_works_active_budget_kes: number
}
export interface MaritimeInfraSummary {
  days: number
  ports: InfraSummaryPort[]
  generated_at: string
}

export interface MaritimeInfraQuery {
  page?: number
  page_size?: number
  port?: string
  waterway?: string
}

export function useMaritimeInfrastructure() {
  const api = useApi()
  const M = '/api/v1/aviation-maritime/maritime/infrastructure'

  return {
    summary: (days = 30) => api<MaritimeInfraSummary>(`${M}/summary/`, { query: { days } }),
    channels: (q?: MaritimeInfraQuery) =>
      api<Paged<Channel>>(`${M}/channels/`, { query: cleanQuery(q as Record<string, unknown>) }),
    navaids: (q?: MaritimeInfraQuery & { aid_type?: MaritimeNavaidType; status?: MaritimeNavaidStatus }) =>
      api<Paged<MaritimeNavaid>>(`${M}/navaids/`, { query: cleanQuery(q as Record<string, unknown>) }),
    dryDocks: (q?: MaritimeInfraQuery & { status?: DryDockOperationalStatus }) =>
      api<Paged<DryDock>>(`${M}/dry-docks/`, { query: cleanQuery(q as Record<string, unknown>) }),
    icds: (q?: { page?: number; page_size?: number }) =>
      api<Paged<InlandContainerDepot>>(`${M}/icds/`, { query: cleanQuery(q as Record<string, unknown>) }),
    capitalWorks: (q?: MaritimeInfraQuery & { status?: CapitalWorkStatus; project_type?: CapitalWorkType }) =>
      api<Paged<MaritimeCapitalWork>>(`${M}/capital-works/`, { query: cleanQuery(q as Record<string, unknown>) }),
  }
}
