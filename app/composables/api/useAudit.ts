// app/composables/api/useAudit.ts
// ─────────────────────────────────────────────────────────────────────
// /api/v1/audit/* - audit-trail endpoint, backed by MongoDB.
//
// Pagination: limit/offset style - the API accepts a `limit` query param
// (verified against the live schema) and returns `count`, `next`,
// `previous`, `results`. The `next`/`previous` URLs already carry the
// limit forward, so only the *first* request needs to set it - navigate
// subsequent pages by following those URLs (see listFromUrl).
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuditEntry {
  // identifiers
  _id: string
  id: string                          // normalised to string (API sends int)

  // actor
  user_id: string | null              // "None" string or null → treat as absent
  username: string | null

  // what happened
  action: 'create' | 'update' | 'delete' | 'export' | 'login' | 'logout' | 'view' | string
  resource_type: string               // may be empty string
  resource_id: string                 // may be empty string
  description: string

  // change data
  old_values: Record<string, unknown>
  new_values: Record<string, unknown>
  metadata: Record<string, unknown>

  // request context
  ip_address: string
  user_agent: string
  request_path: string
  request_method: string
  status_code: number
  response_time: number | null

  // timing
  created_at: string                  // ISO 8601 with tz offset

  // legacy / compat - kept so old template refs don't hard-error
  /** @deprecated use created_at */       timestamp?: string
  /** @deprecated use username/user_id */ user_email?: string
  /** @deprecated use resource_type */    resource?: string
  /** @deprecated use ip_address */       ip?: string
}

export interface AuditQuery {
  page?: number
  /** Results per page (limit/offset pagination) - server defaults to a small value if omitted. */
  limit?: number
  user?: string
  action?: string
  resource?: string
  date_from?: string
  date_to?: string
  search?: string
}

// The API page envelope - next/previous are absolute URLs or null.
export interface AuditPage {
  count: number
  next: string | null
  previous: string | null
  results: AuditEntry[]
}

// ── Composable ─────────────────────────────────────────────────────────────

export function useAudit() {
  const api = useApi()

  return {
    /**
     * GET /api/v1/audit/logs/?limit=N&page=N&...
     * Returns the full page envelope so the caller can read next/previous.
     * Pass `limit` explicitly - the server default is small (10-20 rows).
     */
    list: (q?: AuditQuery): Promise<AuditPage> =>
      api<AuditPage>('/api/v1/audit/logs/', { query: cleanQuery(q as Record<string, unknown>) }),

    /**
     * Navigate to an absolute next/previous URL returned by the API.
     * Strips the origin so the request goes through the configured $api base.
     */
    listFromUrl: (absoluteUrl: string): Promise<AuditPage> => {
      const path = new URL(absoluteUrl).pathname + new URL(absoluteUrl).search
      return api<AuditPage>(path)
    },

    /** GET /api/v1/audit/logs/{id}/ - single entry. */
    get: (id: string) => api<AuditEntry>(`/api/v1/audit/logs/${id}/`),

    /** GET /api/v1/audit/my-logs/ - actions performed by the current user. */
    myLogs: (q?: AuditQuery): Promise<AuditPage> =>
      api<AuditPage>('/api/v1/audit/my-logs/', { query: cleanQuery(q as Record<string, unknown>) }),

    /** GET /api/v1/audit/actions/ - distinct action types available to filter by. */
    actions: () => api<string[] | { results: string[] }>('/api/v1/audit/actions/'),
  }
}