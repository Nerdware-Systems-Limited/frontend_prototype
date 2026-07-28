// app/composables/api/useAviationLicensing.ts
// ─────────────────────────────────────────────────────────────────────
// Aircraft & operator licensing/certification - KCAA-issued certificates
// tracked against a specific holder (an aircraft, an airline, or a pilot):
// Certificate of Registration, Certificate of Airworthiness, Noise
// Certificate, Insurance, Radio Licence, Air Operator Certificate (AOC),
// and Pilot Licence - plus renewal/expiry tracking across all of them.
//
// Backend surface not yet implemented - written against the expected
// shape so the UI ships ahead of the API (mirrors useAviationInfrastructure
// / useMaritimeServices). Real aircraft/airline registry facts (type,
// manufacturer, in_service, aoc_status) already come from
// useAviationMaritime().aircraft()/airlines() - this composable only
// covers the certificate lifecycle (numbers, dates, renewal status) the
// backend doesn't expose yet.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type AviationLicenceCategory =
  | 'certificate_of_registration'
  | 'certificate_of_airworthiness'
  | 'noise_certificate'
  | 'insurance'
  | 'radio_licence'
  | 'air_operator_certificate'
  | 'pilot_licence'
  | 'crew_licence'

export type AviationLicenceHolderType = 'aircraft' | 'airline' | 'pilot'
export type AviationLicenceStatus = 'valid' | 'expiring_soon' | 'expired' | 'suspended' | 'revoked'

export interface AviationLicence {
  id: string
  category: AviationLicenceCategory
  holder_type: AviationLicenceHolderType
  aircraft?: string | null
  aircraft_registration?: string | null
  airline?: string | null
  airline_iata?: string | null
  airline_name?: string | null
  pilot_name?: string | null
  pilot_licence_no?: string | null
  certificate_number: string
  issuing_authority: string
  issued_date?: string | null
  expiry_date: string
  status: AviationLicenceStatus
  ops_specifications?: string | null
  notes?: string | null
}

export interface AviationLicensingSummary {
  kpis: {
    total_licences: number
    valid_pct: number
    expiring_30d: number
    expired: number
    aircraft_without_valid_cofa: number
  }
  generated_at: string
}

export interface AviationLicensingQuery {
  page?: number
  page_size?: number
  category?: AviationLicenceCategory
  holder_type?: AviationLicenceHolderType
  status?: AviationLicenceStatus
  aircraft?: string
  airline?: string
}

export function useAviationLicensing() {
  const api = useApi()
  const L = '/api/v1/aviation-maritime/aviation/licensing'

  return {
    summary: () => api<AviationLicensingSummary>(`${L}/summary/`),
    list: (q?: AviationLicensingQuery) =>
      api<Paged<AviationLicence>>(`${L}/certificates/`, { query: cleanQuery(q as Record<string, unknown>) }),
    expiring: (days = 90) =>
      api<Paged<AviationLicence> | AviationLicence[]>(`${L}/certificates/expiring/?days=${days}`),
  }
}
