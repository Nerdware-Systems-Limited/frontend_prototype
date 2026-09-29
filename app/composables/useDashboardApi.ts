/**
 * Dashboard Manager API client (backend: apps/dashboards). The deployed
 * backend mounts it at /api/v1/dashboards/ (the package README says
 * /api/dashboards/; the live OpenAPI schema and routing say /api/v1/). Goes through the shared $api client (~/composables/api),
 * so it gets the same base URL / dev proxy, Bearer token, silent refresh and
 * forced logout as every other request. Errors are normalised into
 * DashboardApiError with a readable message (see describeApiError).
 */
import type {
  DashboardAssignment, DashboardDefinition, DashboardRecord, DashboardSummary,
  ResolvedDashboard, WidgetInstance,
} from '~/types/dashboard'
import { useApi, type ApiOptions } from '~/composables/api/_client'

export interface DashboardVersionInfo {
  version: number
  createdAt: string
  createdBy: string
  note: string
  published: boolean
}

export interface DirectoryAgency { code: string; name: string; departments?: { code: string; name: string }[] }
export interface DirectoryRole { code: string; name: string; agency: string | null }
export interface DirectoryUser { id: string; name: string; email: string; agency: string | null; department: string | null; roles: string[] }

/** Body of PUT /assignments/ - the server assigns id and dashboardId. */
export type AssignmentInput = Omit<DashboardAssignment, 'id' | 'dashboardId'>

const BASE = '/api/v1/dashboards'

/** A failed Dashboard Manager request, with the HTTP status and a message fit for the UI. */
export class DashboardApiError extends Error {
  constructor(message: string, public status: number | null, public data: unknown = null) {
    super(message)
    this.name = 'DashboardApiError'
  }
}

/**
 * DRF error bodies come in three shapes: {detail: "..."}, {field: ["..."] | "..."}
 * and, for list payloads (PUT /assignments/), [{field: [...]}, {}]. Flatten
 * whichever arrives into one sentence.
 */
export function describeApiError(data: unknown, status: number | null): string {
  const parts: string[] = []
  const walk = (v: unknown, label = '') => {
    if (v == null) return
    if (typeof v === 'string') {
      const text = v.trim()
      // Blank bodies (proxy 502s) and HTML error pages (Django debug 500s) aren't messages.
      if (!text || text.startsWith('<')) return
      parts.push(label && label !== 'detail' && label !== 'non_field_errors' ? `${label}: ${text}` : text)
      return
    }
    if (Array.isArray(v)) { v.forEach(x => walk(x, label)); return }
    if (typeof v === 'object') for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, k)
  }
  walk(data)
  if (parts.length) return [...new Set(parts)].join(' ')
  if (status === 403) return "You don't have permission to do that."
  if (status === 404) return 'Not found.'
  if (status && status >= 500) return `The server couldn't complete the request (HTTP ${status}).`
  if (status === null) return "Couldn't reach the server. Check your connection and try again."
  return `Request failed (HTTP ${status}).`
}

export function toDashboardApiError(err: unknown): DashboardApiError {
  if (err instanceof DashboardApiError) return err
  const e = err as { status?: number; statusCode?: number; data?: unknown; response?: { status?: number } } | null
  const status = e?.status ?? e?.statusCode ?? e?.response?.status ?? null
  return new DashboardApiError(describeApiError(e?.data, status), status, e?.data ?? null)
}

export function useDashboardApi() {
  const api = useApi()

  async function request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
    try {
      return await api<T>(`${BASE}${path}`, opts)
    } catch (err) {
      throw toDashboardApiError(err)
    }
  }

  return {
    /**
     * The dashboard the current user should see right now (server-resolved,
     * RBAC-stripped), or null when nothing is assigned (HTTP 204). With
     * `dashboardId` the server still checks the viewer is in its audience
     * (or can edit it); otherwise it answers 404.
     */
    async resolve(opts: { dashboardId?: string } = {}): Promise<ResolvedDashboard | null> {
      const res = await request<ResolvedDashboard | '' | undefined>('/resolve/', { query: opts.dashboardId ? { id: opts.dashboardId } : undefined })
      return res && typeof res === 'object' && res.dashboard ? res : null
    },

    /** Editors only. Filters honoured by the server: status, search. */
    list: (query: { status?: string; search?: string } = {}) =>
      request<DashboardSummary[]>('/', { query }),
    get: (id: string) => request<DashboardRecord>(`/${id}/`),
    create: (body: { name: string; description?: string; ownerAgency?: string | null; definition: DashboardDefinition }) =>
      request<DashboardRecord>('/', { method: 'POST', body }),
    /** Saves the draft (the unpublished version is updated in place). Viewers keep seeing the published one. */
    saveDraft: (id: string, definition: DashboardDefinition, meta: { name?: string; description?: string } = {}) =>
      request<DashboardRecord>(`/${id}/`, { method: 'PATCH', body: { ...meta, definition } }),
    publish: (id: string, note = '') =>
      request<DashboardRecord>(`/${id}/publish/`, { method: 'POST', body: { note } }),
    archive: (id: string) => request<DashboardRecord>(`/${id}/archive/`, { method: 'POST' }),
    duplicate: (id: string, name: string) =>
      request<DashboardRecord>(`/${id}/duplicate/`, { method: 'POST', body: { name } }),
    remove: (id: string) => request<void>(`/${id}/`, { method: 'DELETE' }),

    versions: (id: string) => request<DashboardVersionInfo[]>(`/${id}/versions/`),
    restore: (id: string, version: number) =>
      request<DashboardRecord>(`/${id}/versions/${version}/restore/`, { method: 'POST' }),

    /** Replaces the whole audience. Returns the saved assignments. */
    saveAssignments: (id: string, assignments: AssignmentInput[]) =>
      request<DashboardAssignment[]>(`/${id}/assignments/`, { method: 'PUT', body: assignments }),

    /** Personal layout: the server keeps only id/x/y/w/h/hidden of widgets already on the published layout. */
    savePersonalLayout: (id: string, widgets: Pick<WidgetInstance, 'id' | 'x' | 'y' | 'w' | 'h' | 'hidden'>[]) =>
      request<void>(`/${id}/personal/`, { method: 'PUT', body: { widgets } }),
    resetPersonalLayout: (id: string) => request<void>(`/${id}/personal/`, { method: 'DELETE' }),

    /** Directory for the assignment picker (editors only). */
    directory: () => request<{ agencies: DirectoryAgency[]; roles: DirectoryRole[] }>('/directory/'),
    /** Needs at least 2 characters; the server returns [] otherwise. */
    searchUsers: (q: string) => request<DirectoryUser[]>('/directory/users/', { query: { q } }),
  }
}
