// app/composables/api/useDriverLicensing.ts
// ─────────────────────────────────────────────────────────────────────
// NTSA driver identity + driving-licence registry. Backed by the real,
// documented endpoints under the Fleet module (M03):
//
//   GET  /api/v1/fleet/drivers/
//   GET  /api/v1/fleet/drivers/{id}/
//   GET  /api/v1/fleet/drivers/{id}/licenses/        - licence history
//   GET  /api/v1/fleet/drivers/{id}/reveal-id/        - admin-only, audited
//   GET  /api/v1/fleet/driver-licenses/
//   GET  /api/v1/fleet/driver-licenses/expiring/?days=
//   GET  /api/v1/fleet/driver-licenses/{id}/
//
// Field set mirrors the Driver / DriverLicense schemas in the UAPTS
// OpenAPI spec exactly - national_id is masked server-side by default
// (unmasked only via reveal-id, which is audit-logged). There is no
// dashboard summary endpoint for this module; KPIs must be computed
// client-side from the loaded registry.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type LicenceClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export type LicenceStatus = 'active' | 'suspended' | 'revoked' | 'expired'

export interface Driver {
  id: string
  national_id?: string | null
  full_name: string
  phone?: string
  date_of_birth?: string | null
  agency?: string | null
  agency_code?: string | null
  operator?: string | null
  operator_name?: string | null
  created_at?: string
  updated_at?: string
}

export interface DriverLicence {
  id: string
  driver: string
  driver_name: string
  license_number: string
  license_class: LicenceClass[] | LicenceClass
  endorsements?: string[]
  demerit_points: number
  psv_badge_no?: string
  psv_badge_expiry?: string | null
  is_psv: boolean
  issue_date: string
  expiry_date: string
  is_expired: boolean
  status: LicenceStatus
  created_at?: string
  updated_at?: string
}

// NOTE: neither DriverViewSet nor DriverLicenseViewSet declares
// `search_fields` (apps/fleet/views.py), so DRF's SearchFilter is a silent
// no-op on both endpoints - a `search=` param is accepted but never filters
// anything. The real server-side filters are the ones below (see each
// ViewSet's get_queryset()). `ordering` still works (OrderingFilter falls
// back to allowing any serializer field when `ordering_fields` isn't set).
export interface DriverQuery {
  page?: number
  page_size?: number
  ordering?: string
  agency?: string
  operator?: string
  /** Case-insensitive substring match on full_name. */
  name?: string
}

export interface DriverLicenceQuery {
  page?: number
  page_size?: number
  ordering?: string
  driver?: string
  status?: LicenceStatus
  /** Licence class, e.g. "D". Maps to the backend's `class` query param. */
  licenceClass?: LicenceClass
  /** true = only licences with a PSV badge number set. */
  psv?: boolean
}

/** Real shape of GET /fleet/drivers/{id}/reveal-id/ - a purpose-built
 *  unmasked-identity payload, not the full Driver record. Admin-only,
 *  audit-logged server-side. */
export interface RevealedDriverIdentity {
  full_name: string
  national_id: string
  phone: string
}

export function useDriverLicensing() {
  const api = useApi()
  const D = '/api/v1/fleet/drivers'
  const L = '/api/v1/fleet/driver-licenses'

  return {
    drivers: (q?: DriverQuery) =>
      api<Paged<Driver>>(`${D}/`, { query: cleanQuery(q as Record<string, unknown>) }),
    getDriver: (id: string) => api<Driver>(`${D}/${id}/`),
    driverLicenceHistory: (id: string) => api<Paged<DriverLicence> | DriverLicence[]>(`${D}/${id}/licenses/`),
    revealDriverId: (id: string) => api<RevealedDriverIdentity>(`${D}/${id}/reveal-id/`),

    licences: (q?: DriverLicenceQuery) => {
      // `licenceClass` -> backend's `class` param (avoided as a TS field
      // name since `class` reads awkwardly as an object key).
      const { licenceClass, ...rest } = q ?? {}
      return api<Paged<DriverLicence>>(`${L}/`, {
        query: cleanQuery({ ...rest, class: licenceClass } as Record<string, unknown>),
      })
    },
    getLicence: (id: string) => api<DriverLicence>(`${L}/${id}/`),
    expiring: (days = 30) => api<DriverLicence[] | Paged<DriverLicence>>(`${L}/expiring/?days=${days}`),
  }
}
