// app/composables/api/useVehicleInspections.ts
// ─────────────────────────────────────────────────────────────────────
// NTSA roadworthiness vehicle inspection records (incl. re-inspections).
// Backed by the real, documented endpoint under the Fleet module (M03):
//
//   GET    /api/v1/fleet/vehicle-inspections/
//   GET    /api/v1/fleet/vehicle-inspections/summary/
//   GET    /api/v1/fleet/vehicle-inspections/{id}/reinspections/
//   POST/PUT/PATCH/DELETE .../{id}/
//
// Field set mirrors the VehicleInspection schema in the UAPTS OpenAPI
// spec exactly - do not add invented fields (inspection type/vehicle
// class/defect category/etc. are not part of the real model).
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type InspectionResult = 'pass' | 'fail' | 'conditional_pass'

export interface VehicleInspection {
  id: string
  vehicle: string
  plate_number: string
  inspection_centre: string
  inspector_name?: string
  inspected_at: string
  result: InspectionResult
  sticker_no?: string
  report_url?: string
  next_inspection_due?: string | null
  reinspection_of?: string | null
  is_reinspection: boolean
  created_at?: string
  updated_at?: string
}

export interface InspectionQuery {
  page?: number
  page_size?: number
  ordering?: string
  search?: string
}

export function useVehicleInspections() {
  const api = useApi()
  const V = '/api/v1/fleet/vehicle-inspections'

  return {
    list: (q?: InspectionQuery) =>
      api<Paged<VehicleInspection>>(`${V}/`, { query: cleanQuery(q as Record<string, unknown>) }),

    get: (id: string) => api<VehicleInspection>(`${V}/${id}/`),

    // Pass/fail breakdown over a window - shape is server-defined, not
    // part of the documented schema, so callers should treat this loosely.
    summary: () => api<any>(`${V}/summary/`),

    reinspections: (id: string) =>
      api<Paged<VehicleInspection> | VehicleInspection[]>(`${V}/${id}/reinspections/`),

    // No documented vehicle/plate filter param exists on this endpoint -
    // approximate a per-vehicle lookup via the general search field.
    forVehicle: (plateNumber: string) =>
      api<Paged<VehicleInspection>>(`${V}/`, { query: { search: plateNumber, page_size: 20 } }),
  }
}
