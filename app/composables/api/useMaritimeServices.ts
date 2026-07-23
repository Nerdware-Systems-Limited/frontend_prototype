// app/composables/api/useMaritimeServices.ts
// ─────────────────────────────────────────────────────────────────────
// Maritime Services (Design Doc §1) - cargo handling operations
// (offloading, loading, stevedoring), pilotage (boarding-to-berthing
// records), and licensing (vessel / pilot / crane-equipment licences).
//
// Backend: apps/aviation_maritime/{models,serializers,views}.py.
// Live-verified against the real DRF responses - types below match the
// actual serializer output field-for-field, not the design doc's
// aspirational field list.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

// ── Cargo handling (§1.1.1) ────────────────────────────────────────────
export type CargoHandlingOp = 'offload' | 'load' | 'stevedoring'
export interface CargoHandlingRecord {
  id: string
  port: string
  port_unlocode: string
  vessel: string | null
  vessel_name: string | null
  berth: string | null
  berth_code: string | null
  operation_type: CargoHandlingOp
  crane_id: string
  tonnes_moved: number
  start_time: string | null
  end_time: string | null
  /** Derived server-side from start_time/end_time; null if either is missing. */
  duration_hours: number | null
  equipment_used: string
  /** Stevedoring only. */
  gang_size: number | null
  idle_time_minutes: number
  damage_reported: boolean
  damage_notes: string
  /** Loading only. */
  booking_reference: string
  /** Loading only. */
  shipper_details: string
  agency: string | null
  created_at: string
  updated_at: string
}

// ── Pilotage (§1.1.2) ──────────────────────────────────────────────────
// `incident_flag` is a plain boolean on this backend, not a graded enum -
// severity/type of a flagged incident lives on the linked MaritimeIncident
// (`related_incident`), not on this record.
export interface PilotageRecord {
  id: string
  vessel: string
  vessel_name: string
  port: string
  port_unlocode: string
  pilot_id: string
  boarding_time: string
  berthing_time: string | null
  /** Derived server-side; null until berthing_time is recorded. Target: <2h for Mombasa. */
  duration_hours: number | null
  tug_assist_ids: string[]
  incident_flag: boolean
  related_incident: string | null
  agency: string | null
  created_at: string
  updated_at: string
}

// ── Licensing (§1.1.3) ─────────────────────────────────────────────────
export type LicenceCategory = 'vessel' | 'pilot' | 'equipment'
export type LicenceStatus = 'active' | 'expired' | 'suspended'
export interface MaritimeLicence {
  id: string
  licence_type: LicenceCategory
  licence_number: string
  /** Set when licence_type=vessel. */
  vessel: string | null
  vessel_name: string | null
  /** Pilot ID or equipment ID; set when licence_type is pilot/equipment. */
  holder_id: string
  issuing_authority: string
  issue_date: string | null
  expiry_date: string
  status: LicenceStatus
  /** Computed server-side from expiry_date vs. today - always trust this over a client-side guess. */
  is_expired: boolean
  endorsements: string[]
  details: Record<string, unknown>
  agency: string | null
  created_at: string
  updated_at: string
}

// ── Summary (§1 dashboard rollup) ──────────────────────────────────────
// Cargo-handling and pilotage are port-scoped, so those roll up per port.
// Licences aren't port-scoped on this backend (a vessel licence isn't
// issued "at" a port, and pilot/equipment licences have no port link at
// all) - licence expiry is reported once, globally, by licence_type.
export interface ServicesSummaryPort {
  port_unlocode: string
  port_name: string
  cargo_operations_count: number
  tonnes_moved: number
  pilotage_count: number
  avg_pilotage_duration_hours: number | null
  pilotage_target_hours: number
}
export interface LicenceExpiryCount {
  licence_type: LicenceCategory
  count: number
}
export interface MaritimeServicesSummary {
  days: number
  ports: ServicesSummaryPort[]
  /** Licences expiring within 30 days, grouped by type - not port-scoped. */
  licences_expiring_30d: LicenceExpiryCount[]
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
    summary: (days = 30) => api<MaritimeServicesSummary>(`${M}/summary/`, { query: { days } }),
    cargoHandling: (q?: MaritimeServicesQuery & { operation_type?: CargoHandlingOp }) =>
      api<Paged<CargoHandlingRecord>>(`${M}/cargo-handling/`, { query: cleanQuery(q as Record<string, unknown>) }),
    pilotage: (q?: MaritimeServicesQuery) =>
      api<Paged<PilotageRecord>>(`${M}/pilotage/`, { query: cleanQuery(q as Record<string, unknown>) }),
    licences: (q?: { page?: number; page_size?: number; licence_type?: LicenceCategory; status?: LicenceStatus; vessel?: string }) =>
      api<Paged<MaritimeLicence>>(`${M}/licences/`, { query: cleanQuery(q as Record<string, unknown>) }),
    /** Licences expiring within `days` (default 30), active only - the renewal-alert feed. */
    licencesExpiring: (days = 30) =>
      api<Paged<MaritimeLicence>>(`${M}/licences/expiring/`, { query: { days } }),
  }
}
