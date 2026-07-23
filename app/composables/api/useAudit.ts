// app/composables/api/useAudit.ts
// ─────────────────────────────────────────────────────────────────────
// /api/v1/audit/* - audit-trail endpoint. Plain PostgreSQL underneath
// (apps/audit/models.py) - the `.log()`/`.find()` API on the Django
// model is only *shaped* to look like the old MongoDB interface; there
// is no Mongo involved here (that's apps/notifications, not audit).
//
// Pagination: page-number style - the API accepts `limit` (page size) and
// `page` query params and returns `count`, `next`, `previous`, `results`,
// where `next`/`previous` are absolute `...?limit=N&page=M` URLs (confirmed
// live - NOT limit/offset style despite the param being named `limit`).
// `listFromUrl` just follows those URLs verbatim, so it works either way.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuditEntry {
  // identifiers
  _id: string
  id: string                          // normalised to string below - the API sends int

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
  ip_address: string | null       // GenericIPAddressField(null=True) - can be null
  user_agent: string
  request_path: string
  request_method: string
  status_code: number | null      // PositiveSmallIntegerField(null=True) - can be null
  response_time: number | null

  // timing
  created_at: string                  // ISO 8601 with tz offset

  // legacy / compat - kept so old template refs don't hard-error
  /** @deprecated use created_at */       timestamp?: string
  /** @deprecated use username/user_id */ user_email?: string
  /** @deprecated use resource_type */    resource?: string
  /** @deprecated use ip_address */       ip?: string
}

// Query params actually accepted by _build_queryset() in apps/audit/views.py
// (confirmed live). There is no `user`/`resource`/`date_from`/`date_to`/
// `search` param on this backend - those were guessed names that the API
// silently ignores (the filter is a no-op, not an error), so callers using
// them would appear to work while actually returning the unfiltered set.
export interface AuditQuery {
  page?: number
  /** Results per page (limit/offset pagination) - server defaults to a small value if omitted. */
  limit?: number
  /** Exact match on AuditLog.user_id (a user UUID, not an email). */
  user_id?: string
  action?: string
  /** Exact match on AuditLog.resource_type, e.g. "accounts.User". */
  resource_type?: string
  resource_id?: string
  /** ISO-8601 (or plain YYYY-MM-DD) lower bound, inclusive - created_at__gte. */
  since?: string
  /** ISO-8601 (or plain YYYY-MM-DD) upper bound, inclusive - created_at__lte. */
  until?: string
}

// The API page envelope - next/previous are absolute URLs or null.
export interface AuditPage {
  count: number
  next: string | null
  previous: string | null
  results: AuditEntry[]
}

// ── Composable ─────────────────────────────────────────────────────────────

function normalisePage(p: AuditPage): AuditPage {
  return { ...p, results: p.results.map(e => ({ ...e, id: String(e.id) })) }
}

export function useAudit() {
  const api = useApi()

  return {
    /**
     * GET /api/v1/audit/logs/?limit=N&page=N&...
     * Returns the full page envelope so the caller can read next/previous.
     * Pass `limit` explicitly - the server default is small (10-20 rows).
     */
    list: async (q?: AuditQuery): Promise<AuditPage> => {
      const page = await api<AuditPage>('/api/v1/audit/logs/', { query: cleanQuery(q as Record<string, unknown>) })
      return normalisePage(page)
    },

    /**
     * Navigate to an absolute next/previous URL returned by the API.
     * Strips the origin so the request goes through the configured $api base.
     */
    listFromUrl: async (absoluteUrl: string): Promise<AuditPage> => {
      const path = new URL(absoluteUrl).pathname + new URL(absoluteUrl).search
      return normalisePage(await api<AuditPage>(path))
    },

    /** GET /api/v1/audit/logs/{id}/ - single entry. */
    get: async (id: string) => {
      const entry = await api<AuditEntry>(`/api/v1/audit/logs/${id}/`)
      return { ...entry, id: String(entry.id) }
    },

    /** GET /api/v1/audit/my-logs/ - actions performed by the current user. */
    myLogs: async (q?: AuditQuery): Promise<AuditPage> => {
      const page = await api<AuditPage>('/api/v1/audit/my-logs/', { query: cleanQuery(q as Record<string, unknown>) })
      return normalisePage(page)
    },

    /** GET /api/v1/audit/actions/ - distinct action types available to filter by. */
    actions: () => api<Array<{ value: string; label: string }>>('/api/v1/audit/actions/'),
  }
}