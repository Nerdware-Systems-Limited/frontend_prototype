// app/composables/api/useQuery.ts
// ─────────────────────────────────────────────────────────────────────
// M15 — Ad-hoc Query Builder.
//
// Backend: /api/v1/query/datasets/ and /api/v1/query/execute/
//
// The query endpoint lets the user pick a dataset, add a few
// filters, and get a row set back. It's a thin, restricted view
// over the operational tables — full ClickHouse integration is a
// separate workstream.
// ─────────────────────────────────────────────────────────────────────

import { useApi } from './_client'

export type FieldType = 'string' | 'number' | 'datetime' | 'enum' | 'uuid'

export interface DatasetField {
  name: string
  type: FieldType
  values?: string[]
}

export interface Dataset {
  label: string
  module: string
  fields: DatasetField[]
  examples: string[]
}

export type QueryDatasetKey =
  | 'incidents'
  | 'vehicles'
  | 'congestion'
  | 'blackspots'
  | 'traffic_counts'
  | 'gps_tracks'

export type FilterOp =
  | 'eq' | 'neq'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'in'

export interface QueryFilter {
  field: string
  op: FilterOp
  value: string | number | boolean | (string | number)[]
}

export interface QueryExecutePayload {
  dataset: QueryDatasetKey
  filters?: QueryFilter[]
  limit?: number
  offset?: number
}

export interface QueryExecuteResult {
  dataset: QueryDatasetKey
  label: string
  executed_at: string
  total: number
  count: number
  rows: Record<string, unknown>[]
  limit: number
  offset: number
}

export function useQuery() {
  const api = useApi()
  return {
    datasets:  (): Promise<Record<QueryDatasetKey, Dataset>> =>
      api<Record<QueryDatasetKey, Dataset>>('/api/v1/query/datasets/'),
    execute:   (payload: QueryExecutePayload): Promise<QueryExecuteResult> =>
      api<QueryExecuteResult>('/api/v1/query/execute/', {
        method: 'POST',
        body: payload,
      }),
  }
}

/**
 * SSR-friendly wrapper that executes a query once at server-render
 * time. Use in a page's `<script setup>`:
 *
 *   const { data } = await useQueryExecute({
 *     dataset: 'incidents',
 *     filters: [{ field: 'severity', op: 'eq', value: 'fatal' }],
 *   })
 */
export function useQueryExecute(payload: QueryExecutePayload) {
  const api = useApi()
  return useAsyncData<QueryExecuteResult>(
    `query-${payload.dataset}-${JSON.stringify(payload.filters ?? [])}`,
    () => api<QueryExecuteResult>('/api/v1/query/execute/', {
      method: 'POST',
      body: payload,
    }),
    { lazy: false, server: true },
  )
}
