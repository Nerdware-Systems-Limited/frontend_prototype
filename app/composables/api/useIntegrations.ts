// app/composables/api/useIntegrations.ts
// ─────────────────────────────────────────────────────────────────────
// Integration Hub - the SDD §4.2 Data Sources Registry.
//
// Wireframe: integration-hub.html - a list of upstream source systems
// (iTIMS, IRSMS, PCS, Discoverer, BMS, RMS, e-ProMIS, etc.) with
// health/last-sync/run-state per integration.
// ─────────────────────────────────────────────────────────────────────

import { useApi } from './_client'
import { cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type IntegrationMode = 'api' | 'csv' | 'kafka' | 'mqtt' | 'sftp' | 'manual'

export interface Integration {
  id: string
  name: string
  source_system: string                  // e.g. "iTIMS", "PCS", "Discoverer"
  agency_code: string                    // NTSA, KPA, KeNHA, …
  mode: IntegrationMode
  status: 'connected' | 'degraded' | 'disconnected' | 'pending'
  last_sync_at?: string
  last_error?: string
  records_today?: number
  endpoint_url?: string
}

export interface IntegrationQuery {
  page?: number
  page_size?: number
  agency_code?: string
  status?: Integration['status']
  mode?: IntegrationMode
}

export function useIntegrations() {
  const api = useApi()

  return {
    list:   (q?: IntegrationQuery) =>
      api<Paged<Integration>>('/api/v1/integrations/', { query: cleanQuery(q as Record<string, unknown>) }),
    get:    (id: string) => api<Integration>(`/api/v1/integrations/${id}/`),
    trigger:(id: string) => api<{ id: string; status: 'queued' }>(`/api/v1/integrations/${id}/trigger/`, { method: 'POST' }),
    pause:  (id: string) => api<Integration>(`/api/v1/integrations/${id}/pause/`,   { method: 'POST' }),
    resume: (id: string) => api<Integration>(`/api/v1/integrations/${id}/resume/`,  { method: 'POST' }),
  }
}