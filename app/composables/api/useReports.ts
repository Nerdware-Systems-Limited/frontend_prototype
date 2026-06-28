// app/composables/api/useReports.ts
// ─────────────────────────────────────────────────────────────────────
// M09 / M15 - Reporting & BI (wireframe: report-center.html).
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
  template_name?: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  format: string
  requested_by?: string
  requested_by_email?: string
  requested_at: string
  generated_at?: string
  completed_at?: string
  download_url?: string
  file_size_bytes?: number
  error?: string
}

export interface ReportsQuery {
  page?: number
  page_size?: number
  module?: string
  status?: ReportRun['status']
}

export interface GeneratePayload {
  template_id: string
  format: ReportTemplate['formats'][number]
  params?: Record<string, unknown>
}

export function useReports() {
  const api = useApi()

  return {
    /** GET /api/v1/reports/catalog/ — full template catalog */
    catalog: () => api<ReportTemplate[]>('/api/v1/reports/catalog/'),

    /** GET /api/v1/reports/catalog/<id>/ — single template */
    template: (id: string) => api<ReportTemplate>(`/api/v1/reports/catalog/${id}/`),

    /** GET /api/v1/reports/runs/ — paginated run history */
    runs: (q?: ReportsQuery) =>
      api<{ count: number; results: ReportRun[] }>(
        '/api/v1/reports/runs/',
        { query: cleanQuery(q as Record<string, unknown>) },
      ),

    /** POST /api/v1/reports/generate/ — enqueues a run, returns queued ReportRun */
    generate: (body: GeneratePayload) =>
      api<ReportRun>('/api/v1/reports/generate/', { method: 'POST', body }),

    /** GET /api/v1/reports/<id>/ — fetch current status of a single run */
    run: (id: string) => api<ReportRun>(`/api/v1/reports/${id}/`),

    /**
     * Returns the direct download URL for a completed run.
     * Used as <a :href="downloadUrl(run.id)"> — browser handles the file save.
     */
    download: async (runId: string) => {
      const blob = await api<Blob>(`/api/v1/reports/${runId}/download/`, { responseType: 'blob' } as any)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = ''  // browser uses the Content-Disposition filename from Django
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }
  }
}