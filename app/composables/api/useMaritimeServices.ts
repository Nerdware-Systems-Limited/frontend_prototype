// app/composables/api/useMaritimeServices.ts
// ─────────────────────────────────────────────────────────────────────
// Maritime Services (Design Doc Section 1) - cargo handling operations
// (offloading, loading, stevedoring), pilotage (boarding-to-berthing
// records and KPIs), and licensing (vessel / pilot / crane-equipment
// licences).
//
// Backend surface not yet implemented - written against the expected
// shape so the UI ships ahead of the API (mirrors useMaritimeInfrastructure
// / useRailInfrastructure). Vessel and port-call facts that already exist
// live come from useAviationMaritime() - this composable only covers the
// operational/administrative fields the backend doesn't expose yet.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type CargoHandlingOp = 'offload' | 'load' | 'stevedoring'
export interface CargoHandlingRecord {
  id: string
  port_unlocode: string
  vessel_imo: string
  vessel_name: string
  operation: CargoHandlingOp
  crane_id?: string | null
  gang_size?: number | null
  tonnes_moved: number
  tonnes_per_hour?: number | null
  shift_start?: string | null
  shift_end?: string | null
  idle_time_min?: number | null
  damage_reported: boolean
  equipment_used?: string | null
}

export type PilotageIncidentFlag = 'none' | 'near_miss' | 'grounding' | 'collision'
export interface PilotageRecord {
  id: string
  pilot_id: string
  pilot_name?: string | null
  vessel_imo: string
  vessel_name: string
  port_unlocode: string
  boarding_time: string
  berthing_time?: string | null
  duration_min?: number | null
  tug_count: number
  tug_ids?: string[]
  incident_flag: PilotageIncidentFlag
}

export type LicenceCategory = 'vessel' | 'pilot' | 'crane_equipment'
export type LicenceStatus = 'valid' | 'expiring_soon' | 'expired' | 'suspended'
export interface MaritimeLicence {
  id: string
  category: LicenceCategory
  holder_id: string
  holder_name: string
  licensing_authority: string
  issued_date?: string | null
  expiry_date: string
  status: LicenceStatus
  endorsements?: string | null
}

export interface MaritimeServicesSummary {
  kpis: {
    cargo_ops_30d: number
    avg_tonnes_per_gang_hour: number
    pilotage_calls_30d: number
    avg_pilotage_duration_min: number
    pilotage_incidents_30d: number
    licences_expiring_60d: number
  }
  generated_at: string
}

export interface MaritimeServicesQuery {
  page?: number
  page_size?: number
  port?: string
  vessel?: string
  days?: number
}

export function useMaritimeServices() {
  const api = useApi()
  const M = '/api/v1/aviation-maritime/maritime/services'

  return {
    summary: () => api<MaritimeServicesSummary>(`${M}/summary/`),
    cargoHandling: (q?: MaritimeServicesQuery & { operation?: CargoHandlingOp }) =>
      api<Paged<CargoHandlingRecord>>(`${M}/cargo-handling/`, { query: cleanQuery(q as Record<string, unknown>) }),
    pilotage: (q?: MaritimeServicesQuery & { incident_flag?: PilotageIncidentFlag }) =>
      api<Paged<PilotageRecord>>(`${M}/pilotage/`, { query: cleanQuery(q as Record<string, unknown>) }),
    licences: (q?: MaritimeServicesQuery & { category?: LicenceCategory; status?: LicenceStatus }) =>
      api<Paged<MaritimeLicence>>(`${M}/licences/`, { query: cleanQuery(q as Record<string, unknown>) }),
  }
}
