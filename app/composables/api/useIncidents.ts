// app/composables/api/useIncidents.ts
// ─────────────────────────────────────────────────────────────────────
// M05 - Safety & Incident Management (wireframes: m05-safety-command.html,
//        m05-safety-analytics.html). Cross-modal incident reporting.
// ─────────────────────────────────────────────────────────────────────

import { useApi } from './_client'
import { cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentMode    = 'road' | 'rail' | 'maritime' | 'aviation' | 'pipeline'

export interface Incident {
  id: string
  agency_id?: string
  agency_code?: string
  mode: IncidentMode
  severity: IncidentSeverity
  status: 'reported' | 'investigated' | 'closed'
  title: string
  description?: string
  location?: string
  lat?: number
  lon?: number
  reported_at: string
  reported_by?: string
}

export interface IncidentReportPayload {
  mode: IncidentMode
  severity: IncidentSeverity
  title: string
  description?: string
  location?: string
  lat?: number
  lon?: number
}

export interface IncidentQuery {
  page?: number
  page_size?: number
  mode?: IncidentMode
  severity?: IncidentSeverity
  status?: Incident['status']
  agency_code?: string
  search?: string
  date_from?: string
  date_to?: string
}

export function useIncidents() {
  const api = useApi()

  return {
    list:   (q?: IncidentQuery) =>
      api<Paged<Incident>>('/api/v1/incidents/', { query: cleanQuery(q as Record<string, unknown>) }),
    get:    (id: string) => api<Incident>(`/api/v1/incidents/${id}/`),
    report: (body: IncidentReportPayload) =>
      api<Incident>('/api/v1/incidents/', { method: 'POST', body }),
    /** M05 KPI roll-up per agency (e.g. /api/v1/safety/kpis/{agency_code}). */
    kpis:   (agencyCode: string) =>
      api<{ agency_code: string; total: number; by_severity: Record<IncidentSeverity, number>; fatality_rate: number }>(
        `/api/v1/safety/kpis/${agencyCode}/`,
      ),
    blackspots: () => api<Paged<{
      id: string
      segment_id: string
      road_code: string
      incident_count: number
      severity_score: number
    }>>('/api/v1/safety/blackspots/'),
  }
}