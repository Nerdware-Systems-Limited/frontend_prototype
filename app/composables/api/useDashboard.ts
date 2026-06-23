// app/composables/api/useDashboard.ts
// ─────────────────────────────────────────────────────────────────────
// /api/v1/dashboard/* — KPIs across all modules.
//
// Two surfaces:
//
//   1. Legacy client-side aggregator (backward compatible):
//        useDashboard().summary()  → composes KPIs from /api/v1/health/
//                                              + /api/v1/accounts/*
//        This is what the original analytics + dashboard pages use.
//
//   2. Canonical M01 endpoint (preferred for new code):
//        GET /api/v1/dashboard/summary/
//        useDashboardSummary()     → SSR-friendly useAsyncData wrapper
//        useDashboard().canonicalSummary()  → direct fetch
// ─────────────────────────────────────────────────────────────────────

import { useApi } from './_client'
import { useSystemApi } from './useSystem'
import { useAgencies, useUsers } from './useAccounts'
import type { HealthResponse, Paged } from '~/types/uapts'
import type { Agency, User } from '~/types/uapts'

export interface DashboardKpi {
  id: string
  label: string
  value: string | number
  delta?: number
  icon?: string
  color?: 'primary' | 'green' | 'amber' | 'red' | 'cyan' | 'purple'
  module?: string
  sub?: string
}

export interface DashboardModule {
  id: string
  name: string
  status: 'online' | 'degraded' | 'offline'
  uptime?: string
}

export interface DashboardRecentActivity {
  kind: string
  id: string
  label: string
  severity?: string
  status?: string
  at?: string
}

export interface DashboardSummary {
  kpis: DashboardKpi[]
  modules: DashboardModule[]
  recent_activity: DashboardRecentActivity[]
  generated_at: string
  counts: Record<string, number>
}

export function useDashboard() {
  const api = useApi()
  const sys = useSystemApi()
  const agencies = useAgencies()
  const users = useUsers()

  /**
   * Backward-compatible client-side aggregator. Builds a dashboard
   * summary from the entities that have been wired the longest
   * (accounts + health). Pages that haven't migrated to the canonical
   * endpoint still work.
   */
  async function summary(): Promise<DashboardSummary> {
    const [agenciesPage, usersPage, healthRes] = await Promise.allSettled([
      agencies.list({ page_size: 1 }),
      users.list({ page_size: 1 }),
      sys.health(),
    ])

    const agencyCount = agenciesPage.status === 'fulfilled' ? agenciesPage.value.count : 0
    const userCount   = usersPage.status   === 'fulfilled' ? usersPage.value.count   : 0
    const health      = healthRes.status   === 'fulfilled' ? healthRes.value        : null

    const kpis: DashboardKpi[] = [
      { id: 'agencies', label: 'Registered Agencies', value: agencyCount, color: 'primary', module: 'M01' },
      { id: 'users',    label: 'Active Users',        value: userCount,   color: 'cyan',    module: 'M01' },
      {
        id: 'health', label: 'System Status',
        value: health?.status === 'healthy' ? 'Healthy'
             : health?.status === 'degraded' ? 'Degraded'
             : health?.status === 'unhealthy' ? 'Unhealthy' : 'Unknown',
        color: health?.status === 'healthy' ? 'green' : health?.status === 'degraded' ? 'amber' : 'red',
        module: 'M01',
      },
      { id: 'uptime', label: 'Uptime',
        value: health ? formatUptime(health.uptime_seconds) : '—',
        color: 'primary', module: 'M01' },
    ]

    const modules: DashboardModule[] = health
      ? Object.entries(health.components).map(([id, c]) => ({
          id,
          name: humanize(id),
          status: c.status === 'ok' ? 'online' as const
                : c.status === 'warn' ? 'degraded' as const
                : 'offline' as const,
        }))
      : []

    return {
      kpis,
      modules,
      recent_activity: [],
      generated_at: new Date().toISOString(),
      counts: {
        agencies: agencyCount,
        users: userCount,
      },
    }
  }

  /**
   * Direct fetch of the canonical M01 summary endpoint.
   */
  function canonicalSummary(): Promise<DashboardSummary> {
    return api<DashboardSummary>('/api/v1/dashboard/summary/')
  }

  return {
    summary,
    canonicalSummary,
    agencies,
    users,
    system: sys,
    api,
  }
}

/**
 * SSR-friendly wrapper. Returns the same shape as
 * `useAsyncData('dashboard-summary', () => api(...))`.
 *
 *   const { data, refresh, pending, error } = await useDashboardSummary()
 */
export function useDashboardSummary() {
  const api = useApi()
  return useAsyncData<DashboardSummary>(
    'dashboard-summary',
    () => api<DashboardSummary>('/api/v1/dashboard/summary/'),
    { lazy: false, server: true },
  )
}

function humanize(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}
