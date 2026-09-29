/**
 * accessPolicyStorage - where saved Module Access overrides live.
 *
 * Two adapters share one interface:
 *  - the accounts API (createApiAccessPolicyStorage), which plugins/
 *    access-policy.client.ts registers. The server is the source of truth and
 *    the real gate: it validates every save against the caller's rights,
 *    stamps updatedBy/updatedAt, and records the change history itself.
 *  - this browser's localStorage (localAccessPolicyStorage), the store's
 *    default. Used by the unit tests and when no adapter has been registered.
 *
 * Swap adapters with setAccessPolicyStorage(); nothing else changes.
 */

import { POLICY_VERSION, type AgencyOverride, type PolicyOverrides } from '~/utils/resolveAccess'
import { normalizeHistory, parseStoredHistory, type HistoryEntry } from '~/utils/accessHistory'

export interface AccessPolicyStorage {
  load(): Promise<PolicyOverrides | null>
  /**
   * Persist the overrides. An adapter whose backend normalises what it stores
   * (the API prunes, sorts and stamps it) returns the document as stored; the
   * store adopts it instead of its own draft.
   */
  save(overrides: PolicyOverrides): Promise<PolicyOverrides | void>
  /** Change log, newest first. Optional: an adapter without it simply keeps no history. */
  loadHistory?(): Promise<HistoryEntry[]>
  saveHistory?(entries: HistoryEntry[]): Promise<void>
  /**
   * True when the backend records history itself (and would refuse a client-
   * supplied entry): after a save the store re-reads the log instead of
   * writing entries of its own.
   */
  readonly recordsHistory?: boolean
}

/** A storage failure with a message fit to show the person who tried to save. */
export class AccessPolicyStorageError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'AccessPolicyStorageError'
  }
}

export const ACCESS_POLICY_STORAGE_KEY = 'uapts:access-policy:v1'
export const ACCESS_POLICY_HISTORY_KEY = 'uapts:access-policy-history:v1'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** A policy from any source, or null (with a warning) when it's from another version or the wrong shape. */
export function normalizePolicy(candidate: unknown): PolicyOverrides | null {
  const c = candidate as { version?: unknown; agencies?: unknown } | null
  if (!isPlainObject(c) || c.version !== POLICY_VERSION) {
    console.warn('[access-policy] ignoring saved access settings with an unknown version')
    return null
  }
  if (!isPlainObject(c.agencies)) {
    console.warn('[access-policy] ignoring saved access settings with a malformed shape')
    return null
  }
  // Drop any agency entry that isn't itself a plain object (corrupted storage) rather than reject the whole payload.
  const agencies: Record<string, AgencyOverride> = {}
  for (const [code, value] of Object.entries(c.agencies)) {
    if (isPlainObject(value)) agencies[code] = value as AgencyOverride
  }
  return { version: POLICY_VERSION, agencies }
}

/** Returns the stored policy, or null (with a warning) when it's missing, unreadable, from another version, or the wrong shape. */
export function parseStoredPolicy(raw: string | null): PolicyOverrides | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn('[access-policy] ignoring unreadable saved access settings')
    return null
  }
  return normalizePolicy(parsed)
}

export const localAccessPolicyStorage: AccessPolicyStorage = {
  async load() {
    if (typeof localStorage === 'undefined') return null
    return parseStoredPolicy(localStorage.getItem(ACCESS_POLICY_STORAGE_KEY))
  },
  async save(overrides) {
    localStorage.setItem(ACCESS_POLICY_STORAGE_KEY, JSON.stringify(overrides))
  },
  async loadHistory() {
    if (typeof localStorage === 'undefined') return []
    return parseStoredHistory(localStorage.getItem(ACCESS_POLICY_HISTORY_KEY))
  },
  async saveHistory(entries) {
    localStorage.setItem(ACCESS_POLICY_HISTORY_KEY, JSON.stringify(entries))
  },
}

// ── Accounts API adapter ───────────────────────────────────────────────────

export const ACCESS_POLICY_API_PATH = '/api/v1/access-control/'
export const ACCESS_POLICY_HISTORY_API_PATH = '/api/v1/access-control/history/'

/** The `$api` fetcher (bearer token, silent refresh) - injected so this file stays free of Nuxt. */
export type PolicyApiFetch = <T = unknown>(
  path: string,
  opts?: { method?: 'GET' | 'PUT'; body?: unknown; query?: Record<string, string | number | undefined> },
) => Promise<T>

interface ApiErrorLike {
  status?: number
  statusCode?: number
  data?: { detail?: unknown; errors?: { field?: unknown; message?: unknown }[] }
}

const SAVE_FALLBACK = "Couldn't save access settings. Your changes are still here - try again."

/**
 * The server's own refusal ("Only super admin can change what an agency is
 * allowed.", "That change would remove your own ability...") is the message
 * worth showing; the field paths of a validation failure are appended so it
 * can be acted on. Anything else (network, 5xx) gets the generic line.
 */
function saveErrorFrom(err: unknown): AccessPolicyStorageError {
  const e = err as ApiErrorLike
  const status = e?.status ?? e?.statusCode
  const detail = typeof e?.data?.detail === 'string' ? e.data.detail : ''
  if (!detail || !status || status >= 500) return new AccessPolicyStorageError(SAVE_FALLBACK, status)
  const fields = (e.data?.errors ?? []).map(x => x?.field).filter((f): f is string => typeof f === 'string' && !!f)
  const suffix = fields.length ? ` (${fields.slice(0, 3).join(', ')}${fields.length > 3 ? ', ...' : ''})` : ''
  return new AccessPolicyStorageError(`${detail}${suffix}`, status)
}

/**
 * Module Access overrides over GET/PUT /api/v1/access-control/.
 *
 * `canViewHistory` is a courtesy so viewers who can't see the log (only a super
 * admin or an agency admin can - the server answers everyone else 403) don't
 * fire a request that is certain to be refused; the server stays the gate.
 */
export function createApiAccessPolicyStorage(
  getApi: () => PolicyApiFetch,
  canViewHistory: () => boolean = () => true,
): AccessPolicyStorage {
  return {
    recordsHistory: true,

    async load() {
      return normalizePolicy(await getApi()(ACCESS_POLICY_API_PATH))
    },

    async save(overrides) {
      try {
        const stored = await getApi()(ACCESS_POLICY_API_PATH, { method: 'PUT', body: overrides })
        return normalizePolicy(stored) ?? undefined
      } catch (err) {
        throw saveErrorFrom(err)
      }
    },

    async loadHistory() {
      if (!canViewHistory()) return []
      try {
        return normalizeHistory(await getApi()(ACCESS_POLICY_HISTORY_API_PATH))
      } catch (err) {
        const status = (err as ApiErrorLike)?.status ?? (err as ApiErrorLike)?.statusCode
        if (status === 403) return []
        throw err
      }
    },
  }
}
