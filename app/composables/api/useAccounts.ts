// app/composables/api/useAccounts.ts
// ─────────────────────────────────────────────────────────────────────
// /api/v1/accounts/* — agencies, departments, roles, users.
//
// The wireframes include a "User Management" page (uapts-wireframes/pages/
// user-management.html) and an "SDR" / agency-detail page (kenha.html,
// ntsa.html, sdr.html). These composables back them.
// ─────────────────────────────────────────────────────────────────────

import type { Agency, Department, Paged, Role, User } from '~/types/uapts'
import { cleanQuery, useApi } from './_client'

/** Query options accepted by every list endpoint below. */
export interface ListOpts {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
  [k: string]: unknown
}

function list<T>(path: string, opts?: ListOpts): Promise<Paged<T>> {
  return useApi()<Paged<T>>(path, { query: cleanQuery(opts as Record<string, unknown>) })
}

function get<T>(path: string): Promise<T> {
  return useApi()<T>(path)
}

function create<T>(path: string, body: unknown): Promise<T> {
  return useApi()<T>(path, { method: 'POST', body })
}

function update<T>(path: string, body: unknown, method: 'PATCH' | 'PUT' = 'PATCH'): Promise<T> {
  return useApi()<T>(path, { method, body })
}

function remove(path: string): Promise<void> {
  return useApi()<void>(path, { method: 'DELETE' })
}

// ── Agencies ────────────────────────────────────────────────────────────────

export function useAgencies() {
  return {
    list:  (opts?: ListOpts & { agency_code?: string })         => list<Agency>('/api/v1/accounts/agencies/', opts),
    get:   (id: string)                                          => get<Agency>(`/api/v1/accounts/agencies/${id}/`),
    create:(body: Pick<Agency, 'agency_code' | 'agency_name'> & Partial<Agency>) => create<Agency>('/api/v1/accounts/agencies/', body),
    update:(id: string, body: Partial<Agency>)                   => update<Agency>(`/api/v1/accounts/agencies/${id}/`, body),
    remove:(id: string)                                          => remove(`/api/v1/accounts/agencies/${id}/`),
  }
}

// ── Departments ─────────────────────────────────────────────────────────────

export function useDepartments() {
  return {
    list:  (opts?: ListOpts & { agency?: string; parent_department?: string }) => list<Department>('/api/v1/accounts/departments/', opts),
    get:   (id: string)                                                          => get<Department>(`/api/v1/accounts/departments/${id}/`),
    create:(body: Pick<Department, 'agency' | 'department_name' | 'department_code'> & Partial<Department>) =>
      create<Department>('/api/v1/accounts/departments/', body),
    update:(id: string, body: Partial<Department>)                               => update<Department>(`/api/v1/accounts/departments/${id}/`, body),
    remove:(id: string)                                                          => remove(`/api/v1/accounts/departments/${id}/`),
  }
}

// ── Roles ───────────────────────────────────────────────────────────────────

export function useRoles() {
  return {
    list:  (opts?: ListOpts)        => list<Role>('/api/v1/accounts/roles/', opts),
    get:   (id: string)             => get<Role>(`/api/v1/accounts/roles/${id}/`),
    create:(body: Pick<Role, 'role_name'>) => create<Role>('/api/v1/accounts/roles/', body),
    remove:(id: string)             => remove(`/api/v1/accounts/roles/${id}/`),
  }
}

// ── Users ───────────────────────────────────────────────────────────────────

export function useUsers() {
  return {
    list:  (opts?: ListOpts & { agency?: string; role_type?: string; is_active?: boolean }) => list<User>('/api/v1/accounts/users/', opts),
    get:   (id: string)                                                                      => get<User>(`/api/v1/accounts/users/${id}/`),
    create:(body: Partial<User> & { email: string; role_type: string })                      => create<User>('/api/v1/accounts/users/', body),
    update:(id: string, body: Partial<User>)                                                 => update<User>(`/api/v1/accounts/users/${id}/`, body),
    remove:(id: string)                                                                      => remove(`/api/v1/accounts/users/${id}/`),
    /** The wireframes "user-management" page also wants current-user lookup. */
    me:    ()                                                                                => get<User>('/api/v1/auth/user/'),
  }
}