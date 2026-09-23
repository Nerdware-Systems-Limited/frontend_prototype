// app/composables/api/useQuery.ts
// ─────────────────────────────────────────────────────────────────────
// M15 - Ad-hoc Query Builder.
//
// Backend: /api/v1/query/datasets/ and /api/v1/query/execute/
//
// The query endpoint lets the user pick a dataset, add a few
// filters, and get a row set back. It's a thin, restricted view
// over the operational tables - full ClickHouse integration is a
// separate workstream.
// ─────────────────────────────────────────────────────────────────────

import { useApi } from './_client'

export type FieldType = 'string' | 'number' | 'datetime' | 'enum' | 'uuid'

export interface DatasetField {
  name: string
  type: FieldType
  values?: string[]
}

export interface QuerySort {
  field: string
  direction: 'asc' | 'desc'
}

export interface Dataset {
  label: string
  module: string
  fields: DatasetField[]
  default_sort: QuerySort
  examples: string[]
  /**
   * Cross-module join group - two datasets can be joined via
   * /query/execute-join/ only if they share this value (e.g. both
   * "road_segment", via a common RoadSegment FK, or both "vehicle", via
   * the Vehicle↔GPSTrack FK). Absent when the dataset isn't joinable.
   */
  joinable_on?: string
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
  // Validated server-side against the dataset's field allowlist - falls
  // back to the dataset's default_sort when omitted.
  sort?: QuerySort
  // Validated server-side against the dataset's field allowlist - when
  // given, the backend trims each row to just these keys (smaller
  // payload, not just a client-side column hide).
  fields?: string[]
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
  sort: QuerySort
}

// ── Cross-module join ───────────────────────────────────────────────
// Joins two datasets on their real underlying relationship (a shared
// RoadSegment FK, or the Vehicle↔GPSTrack FK) - see Dataset.joinable_on.
// Not a generic SQL join: only pairs sharing the same joinable_on group
// can be joined, and the backend fans out matches Python-side, bounded
// to 300 left-side rows (`truncated` flags when that cap was hit).

export interface QueryJoinSide {
  dataset: QueryDatasetKey
  filters?: QueryFilter[]
  fields?: string[]
  sort?: QuerySort
}

export interface QueryJoinPayload {
  left: QueryJoinSide
  right: QueryJoinSide
  join_type: 'inner' | 'left'
  limit?: number
  offset?: number
}

export interface QueryJoinResult {
  executed_at: string
  left_dataset: QueryDatasetKey
  right_dataset: QueryDatasetKey
  left_label: string
  right_label: string
  join_type: 'inner' | 'left'
  join_key: string
  total: number
  count: number
  // Flattened rows keyed "<dataset>.<field>", e.g. "vehicles.plate_number".
  rows: Record<string, unknown>[]
  limit: number
  offset: number
  truncated: boolean
}

// ── Saved query templates (M15 "scheduled distribution") ───────────
// schedule_frequency/recipients/export_format are the distribution
// config; there's no cron worker in this prototype backend, so
// distribution happens when `run` is called (by a user here, or by the
// Report Centre) rather than on an actual timer.

export type SavedQueryType = 'single' | 'join'
export type ScheduleFrequency = 'manual' | 'daily' | 'weekly' | 'monthly'
export type SavedQueryFormat = 'csv' | 'json'

export interface SavedQueryDefinition {
  // query_type = 'single'
  dataset?: QueryDatasetKey
  filters?: QueryFilter[]
  fields?: string[]
  sort?: QuerySort
  // query_type = 'join'
  left?: QueryJoinSide
  right?: QueryJoinSide
  join_type?: 'inner' | 'left'
  limit?: number
  offset?: number
}

export interface SavedQuery {
  id: string
  name: string
  description: string
  query_type: SavedQueryType
  definition: SavedQueryDefinition
  schedule_frequency: ScheduleFrequency
  export_format: SavedQueryFormat
  recipients: string[]
  is_active: boolean
  last_run_at: string | null
  created_by_email: string
  created_at: string
  updated_at: string
}

export interface SavedQueryPayload {
  name: string
  description?: string
  query_type: SavedQueryType
  definition: SavedQueryDefinition
  schedule_frequency: ScheduleFrequency
  export_format: SavedQueryFormat
  recipients: string[]
}

export interface SavedQueryRunResult {
  executed_at: string
  saved_query_id: string
  total: number
  count: number
  rows: Record<string, unknown>[]
  limit?: number
  offset?: number
  [key: string]: unknown
}

// ── Database console (M15) ────────────────────────────────────────────
// Admin-only, gated server-side by settings.QUERY_CONSOLE_ENABLED.
//   GET  /api/v1/query/schema/  - full application schema
//   POST /api/v1/query/raw/     - execute an arbitrary SQL script
// The raw endpoint has NO statement-type restriction (DDL included); each
// statement runs under a Postgres statement_timeout and the whole script
// runs in one transaction. `read_only` forces a rollback even on success.

export interface DbColumn {
  name: string
  data_type: string
  udt_name: string
  nullable: boolean
  default: string | null
  is_pk: boolean
  ordinal: number
}

export type DbRelationKind = 'table' | 'view' | 'materialized_view' | 'partitioned_table' | 'foreign_table'

export interface DbTable {
  schema: string
  name: string
  kind: DbRelationKind
  estimated_rows: number
  size_bytes: number
  size_pretty: string
  columns: DbColumn[]
}

export interface DbSchemaResponse {
  enabled: boolean
  detail?: string
  database?: string
  /** Schema names the console is scoped to (settings.QUERY_CONSOLE_SCHEMAS). */
  schemas?: string[]
  generated_at?: string
  tables?: DbTable[]
}

export interface RawSqlStatement {
  sql: string
  command: string
  rowcount: number
}

export interface RawSqlPayload {
  sql: string
  /** Rows to return from a result-producing statement (server-clamped). */
  max_rows?: number
  /** When true, the script's transaction is rolled back after execution. */
  read_only?: boolean
}

export interface RawSqlResult {
  executed_at: string
  read_only: boolean
  statements: RawSqlStatement[]
  columns: string[]
  rows: Record<string, unknown>[]
  rowcount: number
  row_type: 'result' | 'affected'
  truncated: boolean
  duration_ms: number
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
    executeJoin: (payload: QueryJoinPayload): Promise<QueryJoinResult> =>
      api<QueryJoinResult>('/api/v1/query/execute-join/', {
        method: 'POST',
        body: payload,
      }),
    savedList:   (): Promise<{ results: SavedQuery[] }> =>
      api<{ results: SavedQuery[] }>('/api/v1/query/saved/'),
    savedCreate: (payload: SavedQueryPayload): Promise<SavedQuery> =>
      api<SavedQuery>('/api/v1/query/saved/', { method: 'POST', body: payload }),
    savedDelete: (id: string): Promise<void> =>
      api<void>(`/api/v1/query/saved/${id}/`, { method: 'DELETE' }),
    savedRun:    (id: string): Promise<SavedQueryRunResult> =>
      api<SavedQueryRunResult>(`/api/v1/query/saved/${id}/run/`, { method: 'POST' }),

    // ── Database console (admin only) ──────────────────────────────
    schema: (): Promise<DbSchemaResponse> =>
      api<DbSchemaResponse>('/api/v1/query/schema/'),
    raw: (payload: RawSqlPayload): Promise<RawSqlResult> =>
      api<RawSqlResult>('/api/v1/query/raw/', { method: 'POST', body: payload }),
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
