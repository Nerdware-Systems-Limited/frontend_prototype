// app/composables/api/useMaritimeInfrastructure.ts
// ─────────────────────────────────────────────────────────────────────
// Maritime infrastructure asset management - channel depth/dredging,
// navigational aids (buoys, lighthouses, VTS radar), dry-dock/ship
// repair facilities, inland container depots (ICDs), and KPA capital
// works.
//
// Backend surface not yet implemented - written against the expected
// shape so the UI ships ahead of the API (mirrors useRailInfrastructure
// / useAviationInfrastructure). Real port/berth registry facts already
// come from useAviationMaritime().ports()/berths() - this composable
// only covers the condition/health fields the backend doesn't expose yet.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type ChannelStatus = 'compliant' | 'restricted' | 'non_compliant'
export type MaritimeNavaidType = 'buoy' | 'lighthouse' | 'vts_radar' | 'beacon' | 'racon'
export type MaritimeNavaidStatus = 'operational' | 'degraded' | 'out_of_service'
export type DryDockStatus = 'available' | 'occupied' | 'under_repair' | 'out_of_service'
export type ICDStatus = 'operational' | 'degraded' | 'at_capacity' | 'out_of_service'

export interface Channel {
  id: string
  port: string
  port_unlocode: string
  channel_name: string
  current_depth_m: number
  design_depth_m: number
  status: ChannelStatus
  last_dredged?: string | null
  next_dredging_due?: string | null
}

export interface MaritimeNavaid {
  id: string
  port: string
  port_unlocode: string
  navaid_type: MaritimeNavaidType
  location: string
  status: MaritimeNavaidStatus
  last_inspection?: string | null
  next_inspection?: string | null
}

export interface DryDock {
  id: string
  port: string
  port_unlocode: string
  name: string
  capacity_dwt: number
  status: DryDockStatus
  current_vessel?: string | null
}

export interface InlandContainerDepot {
  id: string
  name: string
  location: string
  capacity_teu: number
  current_utilization_pct?: number | null
  status: ICDStatus
  linked_port?: string | null
  linked_port_unlocode?: string | null
}

export interface MaritimeCapitalWork {
  id: string
  project_name: string
  port: string
  port_unlocode: string
  contractor?: string | null
  scope: string
  physical_progress_pct?: number | null
  financial_progress_pct?: number | null
  value_kes?: number | null
  expected_capacity_impact?: string | null
}

export interface MaritimeInfraSummary {
  kpis: {
    channel_depth_compliance_pct: number
    navaid_operational_pct: number
    dry_docks_available: number
    icd_avg_utilization_pct: number
    open_work_orders: number
    capital_works_value_kes: number
  }
  generated_at: string
}

export interface MaritimeInfraQuery {
  page?: number
  page_size?: number
  port?: string
  status?: string
}

export function useMaritimeInfrastructure() {
  const api = useApi()
  const M = '/api/v1/aviation-maritime/maritime/infrastructure'

  return {
    summary: () => api<MaritimeInfraSummary>(`${M}/summary/`),
    channels: (q?: MaritimeInfraQuery) =>
      api<Paged<Channel>>(`${M}/channels/`, { query: cleanQuery(q as Record<string, unknown>) }),
    navaids: (q?: MaritimeInfraQuery) =>
      api<Paged<MaritimeNavaid>>(`${M}/navaids/`, { query: cleanQuery(q as Record<string, unknown>) }),
    dryDocks: (q?: MaritimeInfraQuery) =>
      api<Paged<DryDock>>(`${M}/dry-docks/`, { query: cleanQuery(q as Record<string, unknown>) }),
    icds: (q?: MaritimeInfraQuery) =>
      api<Paged<InlandContainerDepot>>(`${M}/icds/`, { query: cleanQuery(q as Record<string, unknown>) }),
    capitalWorks: (q?: MaritimeInfraQuery) =>
      api<Paged<MaritimeCapitalWork>>(`${M}/capital-works/`, { query: cleanQuery(q as Record<string, unknown>) }),
  }
}
