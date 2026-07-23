// app/composables/api/useIntegrations.ts
// ─────────────────────────────────────────────────────────────────────
// M12 - Data Integration Hub.
//
// Backend surface: /api/v1/integrations/
//   GET  /                          → paginated DataSource list
//   GET  /{source_id}/              → single DataSource
//   POST /{source_id}/trigger/      → queue a manual sync
//   POST /{source_id}/pause/        → pause ingestion
//   POST /{source_id}/resume/       → resume ingestion
//   POST /{source_id}/ingest/       → remote-pusher entry point (X-API-Key auth)
//   GET  /records/                  → paginated IngestedRecord list
//   GET  /records/{id}/             → single IngestedRecord
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

// ── DataSource - mirrors the read-only registry serializer ────────────

export interface DataSource {
  source_id: string       // path-param identifier (not a UUID - slug-style)
  name: string            // human label e.g. "iTIMS Vehicle Registry"
  source_system: string   // upstream system name e.g. "iTIMS"
  agency_code: string     // NTSA, KPA, KeNHA, …
  agency_name: string     // full agency name
  mode: string            // push | pull | webhook | sftp | kafka | manual
  status: string          // connected | degraded | disconnected | paused | pending
  last_sync_at: string    // ISO datetime
  last_error: string | null
  records_today: number
  endpoint_url: string | null
}

// ── IngestedRecord - raw audit trail row ─────────────────────────────

export interface IngestedRecord {
  id: string
  source_id: string
  record_type: string
  payload: unknown        // verbatim JSON from the remote pusher
  event_at: string        // ISO datetime of the original event
  handler: string         // e.g. 'handlers.ntsa_itims'
  handler_error: string   // empty string when no error
  agency_name: string | null
}

// ── Query helpers ─────────────────────────────────────────────────────

export interface IntegrationQuery {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
}

export interface RecordsQuery {
  source_id?: string      // filter by source_id (backend query param is `source_id`, not `source`)
  page?: number
  page_size?: number
  search?: string
  ordering?: string
}

// ── Composable ────────────────────────────────────────────────────────

export function useIntegrations() {
  const api = useApi()

  return {
    list: (q?: IntegrationQuery) =>
      api<Paged<DataSource>>('/api/v1/integrations/', { query: cleanQuery(q as Record<string, unknown>) }),

    get: (sourceId: string) =>
      api<DataSource>(`/api/v1/integrations/${sourceId}/`),

    trigger: (sourceId: string) =>
      api<DataSource>(`/api/v1/integrations/${sourceId}/trigger/`, { method: 'POST' }),

    pause: (sourceId: string) =>
      api<DataSource>(`/api/v1/integrations/${sourceId}/pause/`, { method: 'POST' }),

    resume: (sourceId: string) =>
      api<DataSource>(`/api/v1/integrations/${sourceId}/resume/`, { method: 'POST' }),

    records: (q?: RecordsQuery) =>
      api<Paged<IngestedRecord>>('/api/v1/integrations/records/', { query: cleanQuery(q as Record<string, unknown>) }),

    record: (id: string) =>
      api<IngestedRecord>(`/api/v1/integrations/records/${id}/`),
  }
}

// Keep the old type alias so any other code importing `Integration` still compiles.
export type Integration = DataSource
