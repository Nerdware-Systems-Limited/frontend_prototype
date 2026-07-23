// app/types/uapts.ts
// ─────────────────────────────────────────────────────────────────────
// Shared TypeScript types for the UAPTS API surface.
//
// These mirror the OpenAPI schemas in `uapts_backend/core/openapi.py`
// and the serializers in `apps/accounts/serializers/`. Keep them in
// sync with the backend - the tests under `tests/api.test.ts` will
// fail loudly if a field the backend emits is missing here.
// ─────────────────────────────────────────────────────────────────────

/** A registered government transport agency (NTSA, KPA, KAA, …). */
export interface Agency {
  id: string
  agency_name: string
  agency_code: string
  contact_email?: string
}

/** An organisational unit within an agency (self-referencing for sub-departments). */
export interface Department {
  id: string
  agency: string
  agency_code?: string
  parent_department?: string | null
  department_name: string
  department_code: string
}

/** An RBAC role. */
export interface Role {
  id: string
  role_name: string
}

/** A platform user / account. */
export interface User {
  id: string
  email: string
  role_type: 'admin' | 'analyst' | 'operator' | 'public' | string
  role?: string | null
  role_name?: string | null
  agency?: string | null
  agency_code?: string | null
  department?: string | null
  mfa_active?: boolean
  is_active?: boolean
  is_staff?: boolean
  created_at?: string
}

/** Profile returned from /api/v1/auth/user/ (also embedded in login response). */
export interface AuthUser extends User {
  // Backend doesn't currently emit first_name / last_name, but a future
  // name split is likely - declare them as optional so the UI can light up
  // without further changes when the backend grows them.
  first_name?: string
  last_name?: string
  full_name?: string
  employee_id?: string
  avatar?: string | null
}

/** Login response - `{access, refresh, user}`. */
export interface LoginResponse {
  access: string
  refresh: string
  user: AuthUser
}

/** Token refresh response. */
export interface TokenRefreshResponse {
  access: string
  refresh?: string
}

/** Paginated list envelope used by every list endpoint. */
export interface Paged<T> {
  count: number
  page?: number
  page_size?: number
  total_pages?: number
  next: string | null
  previous: string | null
  results: T[]
}

/** Health-check response from /api/v1/health/. */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  service: string
  version: string
  timestamp: string
  uptime_seconds: number
  environment: string
  components: Record<string, ComponentStatus>
}

export interface ComponentStatus {
  status: 'ok' | 'warn' | 'error'
  response_ms?: number
  detail?: string
  active_workers?: number
}

/** Service banner returned by GET /api/. */
export interface RootBanner {
  name: string
  version: string
  environment: string
  description: string
  documentation_url: string
  policy_docs_url?: string
  timestamp: string
  endpoints: Record<string, string>
}

/** Standard UAPTS error envelope (`{detail, code, errors?, request_id?}`). */
export interface ApiError {
  status: number
  detail: string
  code?: string
  errors?: Array<{ field: string; message: string; code?: string }>
  request_id?: string
}