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

// NOTE: the real ViewSet (apps/fleet/views.py::VehicleInspectionViewSet) has
// no `search_fields`, so DRF's SearchFilter is a silent no-op for this
// endpoint - a `search=` param is accepted but never filters anything.
// The only server-side filters are the ones below (see its get_queryset()).
// `ordering` still works (DRF's OrderingFilter falls back to allowing any
// serializer field when `ordering_fields` isn't set on the view).
export interface InspectionQuery {
  page?: number
  page_size?: number
  ordering?: string
  vehicle?: string
  result?: InspectionResult
  centre?: string
  from?: string
}

/** Confirmed live shape of GET /fleet/vehicle-inspections/summary/ - see MissingApis.md §2.3. */
export interface VehicleInspectionSummary {
  total: number
  by_result: Record<InspectionResult, number>
  pass_rate_pct: number
  days: number
}

export function useVehicleInspections() {
  const api = useApi()
  const V = '/api/v1/fleet/vehicle-inspections'

  return {
    list: (q?: InspectionQuery) =>
      api<Paged<VehicleInspection>>(`${V}/`, { query: cleanQuery(q as Record<string, unknown>) }),

    get: (id: string) => api<VehicleInspection>(`${V}/${id}/`),

    // Pass/fail breakdown over a window.
    summary: () => api<VehicleInspectionSummary>(`${V}/summary/`),

    reinspections: (id: string) =>
      api<Paged<VehicleInspection> | VehicleInspection[]>(`${V}/${id}/reinspections/`),

    // Per-vehicle lookup - the real endpoint filters by exact vehicle id via
    // `?vehicle=`, not a text search (there is no plate-number filter param;
    // `search=` is a no-op - see the InspectionQuery comment above).
    forVehicle: (vehicleId: string) =>
      api<Paged<VehicleInspection>>(`${V}/`, { query: { vehicle: vehicleId, page_size: 20 } }),
  }
}
