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
  actor_type?: 'user' | 'anonymous' | 'system' | string
  attempted_username?: string         // identity supplied on a FAILED auth attempt
  impersonator_id?: string
  impersonator_username?: string
  token_jti?: string
  session_key?: string
  request_id?: string                 // correlates every row of one request

  // what happened
  action: 'create' | 'update' | 'delete' | 'export' | 'login' | 'logout' | 'view' | string
  outcome: 'success' | 'failure' | 'denied' | 'error' | 'unknown' | string
  severity: 'debug' | 'info' | 'notice' | 'warning' | 'critical' | string
  resource_type: string               // may be empty string
  resource_id: string                 // may be empty string
  resource_repr?: string              // str() of the object at write time - survives deletion
  description: string
  changed_fields?: string[]

  // change data
  old_values: Record<string, unknown>
  new_values: Record<string, unknown>
  metadata: Record<string, unknown>

  // request context
  ip_address: string | null       // GenericIPAddressField(null=True) - can be null
  ip_is_private?: boolean
  user_agent: string
  device_type?: string
  browser?: string
  os?: string
  geo_country?: string
  geo_city?: string
  asn?: string
  origin?: string                     // http | ws | celery | cli | signal
  request_query?: string
  view_name?: string
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
  /** Exact match on AuditLog.Outcome (success | failure | denied | error | unknown). */
  outcome?: string
  /** Exact match on AuditLog.Severity (debug | info | notice | warning | critical). */
  severity?: string
  /** Exact match on AuditLog.resource_type, e.g. "accounts.User". */
  resource_type?: string
  resource_id?: string
  /** Forensic pivots - exact match, still bounded by the viewer's scope server-side. */
  request_id?: string
  token_jti?: string
  actor_type?: string
  origin?: string
  ip_address?: string
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

type Choice = { value: string; label: string }
export interface AuditChainStatus { ok: boolean; checked: number; broken_at: number | null; reason: string }
export interface AuditMeta {
  actions: Choice[]
  severities: Choice[]
  outcomes: Choice[]
  actor_types: Choice[]
  /** What this viewer's list shows: whole platform, own agency, or only themselves. */
  scope: 'platform' | 'agency' | 'self'
  hash_chain_enabled: boolean
  /** Only present when requested with verify (super_admin). */
  chain?: AuditChainStatus
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

    /** GET /api/v1/audit/users/{userId}/logs/ - one user's history (scoped server-side; out-of-scope users return an empty page). */
    userLogs: async (userId: string, q?: AuditQuery): Promise<AuditPage> => {
      const page = await api<AuditPage>(`/api/v1/audit/users/${encodeURIComponent(userId)}/logs/`, { query: cleanQuery(q as Record<string, unknown>) })
      return normalisePage(page)
    },

    /**
     * GET /api/v1/audit/meta/ - filter choices straight from the model, the
     * viewer's visibility scope and hash-chain status. Pass `verify` (super_admin
     * only) to also walk the tamper-evidence chain.
     */
    meta: (opts?: { verify?: boolean; limit?: number }) =>
      api<AuditMeta>('/api/v1/audit/meta/', { query: cleanQuery({ verify: opts?.verify ? 1 : undefined, limit: opts?.limit }) }),
  }
}
