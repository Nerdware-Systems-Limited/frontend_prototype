// app/composables/api/useReports.ts
// ─────────────────────────────────────────────────────────────────────
// M15 — Reporting & BI (wireframe: report-center.html).
// ─────────────────────────────────────────────────────────────────────

import { useApi } from './_client'
import { cleanQuery } from './_client'

export interface ReportTemplate {
  id: string
  name: string
  description?: string
  module: string                       // M01..M15
  formats: Array<'pdf' | 'xlsx' | 'csv'>
  schedule?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'ad_hoc'
  params?: Record<string, { type: 'string' | 'date' | 'number' | 'select'; label: string; options?: string[] }>
}

export interface ReportRun {
  id: string
  template_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  requested_by?: string
  requested_at: string
  completed_at?: string
  download_url?: string
  error?: string
}

export interface ReportsQuery {
  page?: number
  page_size?: number
  module?: string
  status?: ReportRun['status']
}

export function useReports() {
  const api = useApi()

  return {
    catalog: () => api<ReportTemplate[]>('/api/v1/reports/catalog/'),
    template: (id: string) => api<ReportTemplate>(`/api/v1/reports/catalog/${id}/`),
    runs:     (q?: ReportsQuery) =>
      api<{ count: number; results: ReportRun[] }>('/api/v1/reports/runs/', { query: cleanQuery(q as Record<string, unknown>) }),
    generate: (body: { template_id: string; format: ReportTemplate['formats'][number]; params?: Record<string, unknown> }) =>
      api<ReportRun>('/api/v1/reports/generate/', { method: 'POST', body }),
    downloadUrl: (runId: string) => `/api/v1/reports/${runId}/download/`,
  }
}