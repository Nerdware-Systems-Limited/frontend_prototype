// app/composables/api/useAudit.ts
// ─────────────────────────────────────────────────────────────────────
// /api/v1/audit/* - audit-trail endpoint, backed by MongoDB.
//
// Per the SDD (§4.4.1 shared tables) audit records are stored in
// MongoDB (immutable, 5-year retention). The audit page wireframe
// (uapts-wireframes/pages/audit-trail.html) shows a paginated table
// filterable by actor / action / resource / date range.
//
// Until the dedicated /api/v1/audit/ endpoints ship, this composable
// gracefully falls back to an empty result set so the page renders.
// ─────────────────────────────────────────────────────────────────────

import { useApi } from './_client'
import { cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export interface AuditEntry {
  id: string
  user_id?: string
  user_email?: string
  action: 'create' | 'update' | 'delete' | 'export' | 'login' | 'logout' | string
  resource: string
  resource_id?: string
  ip?: string
  user_agent?: string
  detail?: Record<string, unknown>
  timestamp: string
}

export interface AuditQuery {
  page?: number
  page_size?: number
  user?: string
  action?: string
  resource?: string
  date_from?: string
  date_to?: string
  search?: string
}

export function useAudit() {
  const api = useApi()

  return {
    /** GET /api/v1/audit/ - list audit entries. */
    list: (q?: AuditQuery) =>
      api<Paged<AuditEntry>>('/api/v1/audit/', { query: cleanQuery(q as Record<string, unknown>) }),

    /** GET /api/v1/audit/{id}/ - single entry. */
    get: (id: string) => api<AuditEntry>(`/api/v1/audit/${id}/`),

    /** GET /api/v1/audit/export/?format=csv|xlsx - bulk export. */
    exportUrl: (q?: AuditQuery) => {
      const params = new URLSearchParams()
      if (q) for (const [k, v] of Object.entries(q)) {
        if (v !== null && v !== undefined && v !== '') params.set(k, String(v))
      }
      const qs = params.toString()
      return `/api/v1/audit/export/${qs ? `?${qs}` : ''}`
    },
  }
}