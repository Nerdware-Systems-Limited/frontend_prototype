// app/composables/api/useIntegrations.ts
// ─────────────────────────────────────────────────────────────────────
// M12 - Data Integration Hub.
//
// Backend surface: /api/v1/integrations/
//   GET  /                          → paginated DataSource list
//   GET  /{source_id}/              → single DataSource
//   POST /{source_id}/trigger/      → queue a manual sync
//   POST /{source_id}/pause/        → pause ingestion
//   POST /{source_id}/resume/       → resume ingestion
//   POST /{source_id}/ingest/       → remote-pusher entry point (X-API-Key auth)
//   GET  /records/                  → paginated IngestedRecord list
//   GET  /records/{id}/             → single IngestedRecord
//
//   GET  /{source_id}/uploads/           → paginated DataUpload history
//   POST /{source_id}/uploads/           → upload a file (xlsx/csv), 202,
//                                           enqueues async validation
//   GET  /uploads/{id}/                  → poll one upload's status/counts
//   POST /uploads/{id}/commit/           → 202, enqueues async commit
//
// Upload/commit both run as backend Celery tasks now (files can be
// multi-GB) rather than synchronously in the request — the POST calls
// below return immediately with status="pending"/"committing"; callers
// must poll uploads.detail() until status reaches a terminal value.
// ─────────────────────────────────────────────────────────────────────

import { useAuthStore } from '~/stores/auth'
import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

// ── DataSource - mirrors the read-only registry serializer ────────────

export interface DataSource {
  source_id: string       // path-param identifier (not a UUID - slug-style)
  name: string            // human label e.g. "iTIMS Vehicle Registry"
  source_system: string   // upstream system name e.g. "iTIMS"
  agency_code: string     // NTSA, KPA, KeNHA, …
  agency_name: string     // full agency name
  mode: string            // push | pull | webhook | sftp | kafka | manual
  status: string          // connected | degraded | disconnected | paused | pending
  last_sync_at: string    // ISO datetime
  last_error: string | null
  records_today: number
  endpoint_url: string | null
  /** Current template version for manual sources (null for api/csv feeds).
   *  CSV uploads have no embedded _meta sheet, so this is sent back as
   *  declared_schema_version on upload. */
  schema_version: string | null
  /** Register-an-API console fields (views.RegisterDataSourceView) — blank
   *  for legacy/seeded feeds never registered through the console. */
  protocol: RegisterProtocol | ''
  auth_method: RegisterAuthMethod | ''
  endpoint_value: string
  reconcile_cron: string
  last_test_at: string | null
  last_test_ok: boolean | null
}

// ── Register an API (views.RegisterDataSourceView / TestConnectionView) ─

export type RegisterProtocol = 'rest_push' | 'webhook' | 'streaming' | 'rest_pull' | 'sftp' | 'database'
export type RegisterAuthMethod = 'api_key' | 'hmac' | 'bearer' | 'basic' | 'oauth2' | 'mtls'

export interface RegisterFeedPayload {
  source_id: string
  agency_code: string
  protocol: RegisterProtocol
  auth_method: RegisterAuthMethod
  /** Feed key (push) or target URL/host/connection string (pull). */
  endpoint_value: string
  reconcile_cron?: string
  system_source?: string
  /** Pull-style only — the third party's credential; encrypted at rest,
   *  ignored (server generates its own) for push-style protocols. */
  credentials?: Record<string, string>
}

/** issued_secret is present ONLY in the direct response to a successful
 *  push-style registration — copy it now, it's never returned again. */
export interface RegisterFeedResult extends DataSource {
  issued_secret?: string
}

export interface TestConnectionPayload {
  /** Re-test an already-registered feed — protocol/endpoint_value below
   *  are ignored server-side in favour of what's actually stored on that
   *  DataSource, and the result is persisted to last_test_at/last_test_ok.
   *  Omit for pre-save form testing (register-console step 4). */
  source_id?: string
  protocol?: RegisterProtocol
  endpoint_value?: string
}

export interface TestConnectionResult {
  ok: boolean
  detail: string
  latency_ms: number | null
  /** Present only when source_id was given — the persisted timestamp. */
  last_test_at?: string
}

// ── DataUpload - manual-upload lifecycle (M12 Integration Hub) ────────

export type DataUploadStatus =
  // "unrouted" = template-late intake: file stored, no template/feed
  // assigned yet (source_id is null). Cleared by POST /uploads/<id>/route/.
  | 'unrouted'
  | 'pending' | 'validating' | 'needs_mapping' | 'validated' | 'rejected'
  | 'committing' | 'committed' | 'partial' | 'failed' | 'superseded'

/** column is '' for a cross-field constraint not attributable to a single
 *  header (see xlsx_templates.TemplateSpec.row_validator's docstring) —
 *  SampleGrid falls back to a whole-row highlight for those. */
export interface FieldError {
  column: string
  message: string
}

export interface UploadRowError {
  row: number
  errors: FieldError[]
}

export interface DataUpload {
  id: string
  /** null while the upload is "unrouted" (template-late intake) — a feed
   *  is assigned via POST /uploads/<id>/route/. */
  source_id: string | null
  /** Submitting agency — a direct FK on DataUpload now (not source.agency),
   *  so it's set even for an un-routed upload with no source. NOT
   *  necessarily who the data is about: KRB submits funding data about
   *  KeNHA. See the inbox's agency_code (submitted-by) vs. covers_agency
   *  (subject) filters. */
  agency_code: string
  agency_name: string
  original_filename: string
  size_bytes: number
  /** Data sheets in the file (xlsx: non-_meta sheet count; csv: always 1).
   *  Null until validate_upload_task has actually opened the file. */
  sheet_count: number | null
  status: DataUploadStatus
  total_rows: number
  valid_rows: number
  error_rows: number
  duplicate_rows: number
  /** "template" = strict header match; "mapped" = Track B, a column_map
   *  was applied (human-supplied or auto-applied from a saved UploadMapping). */
  source_track: 'template' | 'mapped'
  /** The actual header row found — only populated once status has been
   *  "needs_mapping" (see xlsx_templates.HeaderMismatch). */
  detected_headers: string[]
  /** {expected_header: actual_header} once mapped — empty for a normal
   *  template upload. */
  column_map: Record<string, string>
  validation_report: UploadRowError[]
  summary: Record<string, unknown>
  validation_error: string
  commit_error: string
  domain_records_created: number
  content_hash: string
  duplicate_of: string | null
  supersedes: string | null
  period_start: string | null   // ISO date
  period_end: string | null     // ISO date
  period_label: string
  uploaded_by_email: string | null
  commit_started_at: string | null
  committed_at: string | null
  created_at: string
}

/** DataUploadDetailView's response — DataUpload plus a per-target_model
 *  breakdown ("written to: MaintenanceOrder 874, MaintenanceBudget 4"),
 *  computed only for the detail view (not the paginated inbox/history
 *  list, to avoid an aggregate query per row there). */
export interface DataUploadDetail extends DataUpload {
  written_to: { target_model: string; count: number }[]
  /** Who this upload's *data* is about (payload.road_agency_code),
   *  distinct from agency_code/agency_name above (who submitted it) —
   *  only meaningful for sources whose payload carries a subject agency;
   *  harmlessly empty otherwise. */
  covers_breakdown: { payload__road_agency_code: string; count: number }[]
  /** The upload that replaced this one, if any (reverse of `supersedes`). */
  superseded_by: string | null
}

/** One field the strict template expects — GET .../expected-columns/,
 *  used to build the column-mapping form without hardcoding template
 *  knowledge on the frontend. */
export interface ExpectedColumn {
  header: string
  required: boolean
  example: string
}

/** One candidate feed for an un-routed upload — GET /uploads/<id>/route/.
 *  Ranked server-side by header overlap; the frontend orders the list but
 *  never auto-picks (locked-template design — see DataUploadRouteView). */
export interface RouteCandidate {
  source_id: string
  system_source: string
  agency_code: string
  schema_version: string
  expected_columns: number
  matched_columns: number
}

export interface RouteInfo {
  upload_id: string
  status: DataUploadStatus
  detected_headers: string[]
  candidates: RouteCandidate[]
}

/** DataUploadInboxView's response — Paged<DataUpload> plus sums over the
 *  *filtered* (pre-pagination) queryset, for the Files list's KPI ribbon
 *  (Integration Hub redesign §4, Page 2) — "batches / rows parsed / rows
 *  written / needs attention" has to reflect the current filter set, not
 *  just the 20 rows on the loaded page. */
export interface UploadInboxAggregates {
  total_rows: number
  valid_rows: number
  domain_records_created: number
  /** Count of rows in the filtered set with status
   *  unrouted/needs_mapping/validated/partial. */
  needs_attention: number
}

export interface UploadInboxResult extends Paged<DataUpload> {
  aggregates: UploadInboxAggregates
}

export interface AgencyContribution {
  agency_code: string
  agency_name: string
  records: number
}

// ── IngestedRecord - raw audit trail row ─────────────────────────────
// upload/source_row/row_status/row_errors/target_model/target_pk are
// file-upload-only (blank for live-push rows) — see the model docstring.
// This same shape drives both the API feed page's raw-payload viewer and
// a file upload's Rows tab (?upload_id=&row_status=).

export type IngestedRowStatus = '' | 'valid' | 'error' | 'duplicate_in_file' | 'duplicate_in_db'

export interface IngestedRecord {
  id: string
  source_id: string
  record_type: string
  payload: unknown        // verbatim JSON from the remote pusher
  event_at: string        // ISO datetime of the original event
  handler: string         // e.g. 'handlers.ntsa_itims'
  handler_error: string   // empty string when no error
  agency_name: string | null
  upload: string | null
  source_row: number | null
  row_status: IngestedRowStatus
  row_errors: FieldError[]
  target_model: string    // e.g. "infrastructure.MaintenanceOrder" — blank if nothing was written
  target_pk: string
}

// ── Query helpers ─────────────────────────────────────────────────────

export interface IntegrationQuery {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
}

export interface RecordsQuery {
  source_id?: string      // filter by source_id (backend query param is `source_id`, not `source`)
  upload_id?: string
  row_status?: IngestedRowStatus
  /** File detail page's DB matches tab — e.g. "infrastructure.MaintenanceOrder". */
  target_model?: string
  page?: number
  page_size?: number
  search?: string
  ordering?: string
}

export interface UploadHistoryQuery {
  page?: number
  page_size?: number
}

/** Cross-agency uploads inbox filters — see DataUploadInboxView. */
export interface UploadInboxQuery {
  agency_code?: string      // submitted-by agency (source.agency)
  covers_agency?: string    // agency a row's data is *about* — a different facet, see DataUpload docs
  source_id?: string
  status?: DataUploadStatus
  date_field?: 'uploaded' | 'committed' | 'period'
  date_from?: string        // ISO date
  date_to?: string          // ISO date
  q?: string                 // filename search
  page?: number
  page_size?: number
}

export interface PreviewQuery {
  sheet?: string
  offset?: number
  limit?: number
}

export interface PreviewSheet {
  name: string
  recognised: boolean
}

export interface PreviewResult {
  sheets: PreviewSheet[]
  active: { name: string; columns: string[]; rows: unknown[][] } | null
}

export interface HandlerErrorGroup {
  message: string
  count: number
}

/** API feed page, Phase 1 reconciliation — see DataSourceStatsView. */
export interface DataSourceStats {
  received_24h: number
  received_7d: number
  /** One entry per day, oldest first, zero-filled — 7 entries. */
  daily_received: { date: string; count: number }[]
  /** A handler ran for this record, whether it wrote something or failed. */
  attempted: number
  /** Handler succeeded — target_model set. The number that actually
   *  matters: a feed can be green and "attempted"=100% while writing 0
   *  domain rows if every record's handler is silently failing. */
  domain_rows_created: number
  unrecognised_record_types: string[]
  top_handler_errors: HandlerErrorGroup[]
  recent: IngestedRecord[]
}

export interface SilentFailure {
  source_id: string
  agency_code: string | null
  agency_name: string | null
  received: number
  written: number
}

/** Ingestion Analytics page (Integration Hub redesign §4) — one call
 *  replacing a feedStats() per source. See PlatformIntegrationStatsView. */
export interface PlatformStats {
  window: '24h' | '7d' | '30d' | 'all'
  /** Non-null (= the cap) when total_sources_considered exceeds it — the
   *  funnel/silent_failures below only cover the busiest N sources. */
  scoped_to_top_n: number | null
  total_sources_considered: number
  funnel: { received: number; attempted: number; written: number }
  /** Sources where received > 0 but written === 0 — green and syncing,
   *  writing nothing. Sorted by records lost (= received) descending. */
  silent_failures: SilentFailure[]
  top_handler_errors: HandlerErrorGroup[]
  unrecognised_record_types: string[]
}

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  message?: string
}

/**
 * DataUploadDetailView/DataUploadCommitView/the create-upload response all
 * use the platform's {success, data, message} envelope (views.ok_response)
 * — unlike the ViewSet-based endpoints elsewhere in this composable
 * (DataSourceViewSet, IngestedRecordViewSet), which return raw serializer
 * data straight through $api with no wrapping. Unwrap explicitly here
 * rather than assuming one convention app-wide.
 */
function unwrapEnvelope<T>(res: ApiEnvelope<T>): T {
  if (!res.success || res.data === undefined) throw new Error(res.message || 'Request failed.')
  return res.data
}

/**
 * Raw multipart POST for a file upload, via XMLHttpRequest rather than
 * $fetch/ofetch — this is the one call in the Integration Hub that needs
 * upload.onprogress (ofetch's fetch-based body has no equivalent) and so
 * can't go through the $api plugin. Auth header is attached manually here
 * to match what plugins/api.ts does for every other call — the previous
 * version of this code skipped that entirely (bypassed $fetch directly),
 * which meant an access token expiring mid-upload just failed silently
 * with no refresh attempt. There's no 401-refresh-and-retry here (that
 * needs to resend the whole file, which for a multi-GB upload isn't
 * something to do silently) — a 401 just rejects; the caller shows the
 * error and the user re-selects the file after logging in again.
 */
/** `path` is relative to apiBase, e.g. `/api/v1/integrations/{sourceId}/uploads/`
 *  or `/api/v1/integrations/uploads/{id}/replace/` — same XHR mechanics
 *  serve both the initial upload and a replace-with-new-file. */
function uploadFileWithProgress(
  path: string,
  form: FormData,
  onProgress?: (pct: number) => void,
): Promise<DataUpload> {
  const auth = useAuthStore()
  const config = useRuntimeConfig()
  const base = (config.public.apiBase as string).replace(/\/$/, '')

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${base}${path}`)
    if (auth.accessToken) xhr.setRequestHeader('Authorization', `Bearer ${auth.accessToken}`)

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      let body: ApiEnvelope<DataUpload> | null = null
      try { body = JSON.parse(xhr.responseText) } catch { /* fall through to status check below */ }

      if (xhr.status >= 200 && xhr.status < 300 && body?.success && body.data) {
        resolve(body.data)
      } else {
        reject(new Error(body?.message || `Upload failed (HTTP ${xhr.status}).`))
      }
    }
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'))
    xhr.onabort = () => reject(new Error('Upload cancelled.'))

    xhr.send(form)
  })
}

/** GET a binary response with the auth header attached — see the
 *  download() method below for why this can't go through useApi(). */
async function downloadBlobWithAuth(path: string): Promise<Blob> {
  const auth = useAuthStore()
  const config = useRuntimeConfig()
  const base = (config.public.apiBase as string).replace(/\/$/, '')

  const res = await fetch(`${base}${path}`, {
    headers: auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {},
  })
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status}).`)
  return res.blob()
}

// ── Composable ────────────────────────────────────────────────────────

export function useIntegrations() {
  const api = useApi()

  return {
    list: (q?: IntegrationQuery) =>
      api<Paged<DataSource>>('/api/v1/integrations/', { query: cleanQuery(q as Record<string, unknown>) }),

    get: (sourceId: string) =>
      api<DataSource>(`/api/v1/integrations/${sourceId}/`),

    trigger: (sourceId: string) =>
      api<DataSource>(`/api/v1/integrations/${sourceId}/trigger/`, { method: 'POST' }),

    pause: (sourceId: string) =>
      api<DataSource>(`/api/v1/integrations/${sourceId}/pause/`, { method: 'POST' }),

    resume: (sourceId: string) =>
      api<DataSource>(`/api/v1/integrations/${sourceId}/resume/`, { method: 'POST' }),

    records: (q?: RecordsQuery) =>
      api<Paged<IngestedRecord>>('/api/v1/integrations/records/', { query: cleanQuery(q as Record<string, unknown>) }),

    record: (id: string) =>
      api<IngestedRecord>(`/api/v1/integrations/records/${id}/`),

    uploads: {
      /** List upload history for a source, most recent first. */
      list: (sourceId: string, q?: UploadHistoryQuery) =>
        api<Paged<DataUpload>>(`/api/v1/integrations/${sourceId}/uploads/`, {
          query: cleanQuery(q as Record<string, unknown>),
        }),

      /**
       * Upload a file. Returns immediately (202) with status="pending" —
       * caller must poll detail() until status is a terminal value
       * (validated/rejected/failed). declaredSchemaVersion is required
       * for .csv uploads (source.schema_version) and ignored for .xlsx
       * (which carries its own version in a hidden _meta sheet).
       */
      create: (sourceId: string, file: File, declaredSchemaVersion?: string | null, onProgress?: (pct: number) => void) => {
        const form = new FormData()
        form.append('file', file)
        if (declaredSchemaVersion) form.append('schema_version', declaredSchemaVersion)
        return uploadFileWithProgress(`/api/v1/integrations/${sourceId}/uploads/`, form, onProgress)
      },

      /**
       * Template-late intake — POST /api/v1/integrations/uploads/.
       * With `sourceId` this is identical to create(); without one the
       * file is accepted with no feed assigned (status="unrouted") and
       * waits in the routing queue. The agency is resolved server-side
       * from the authenticated user, so `agencyCode` is only needed when
       * the user's account isn't attached to an agency.
       */
      intake: (
        file: File,
        opts: { sourceId?: string; declaredSchemaVersion?: string | null; agencyCode?: string } = {},
        onProgress?: (pct: number) => void,
      ) => {
        const form = new FormData()
        form.append('file', file)
        if (opts.sourceId) form.append('source_id', opts.sourceId)
        if (opts.declaredSchemaVersion) form.append('schema_version', opts.declaredSchemaVersion)
        if (opts.agencyCode) form.append('agency_code', opts.agencyCode)
        return uploadFileWithProgress('/api/v1/integrations/uploads/', form, onProgress)
      },

      /** Cross-agency inbox — every upload, every manual source, un-routed included. */
      inbox: (q?: UploadInboxQuery) =>
        api<UploadInboxResult>('/api/v1/integrations/uploads/', { query: cleanQuery(q as Record<string, unknown>) }),

      /** Ranked candidate feeds for an un-routed upload (suggestion only). */
      routeInfo: (uploadId: string) =>
        api<ApiEnvelope<RouteInfo>>(`/api/v1/integrations/uploads/${uploadId}/route/`).then(unwrapEnvelope),

      /** Assign a feed to an un-routed upload — 202, then poll detail(). */
      route: (uploadId: string, sourceId: string) =>
        api<ApiEnvelope<DataUpload>>(`/api/v1/integrations/uploads/${uploadId}/route/`, {
          method: 'POST',
          body: { source_id: sourceId },
        }).then(unwrapEnvelope),

      /** Poll target while an upload is validating or committing. */
      detail: (uploadId: string) =>
        api<ApiEnvelope<DataUploadDetail>>(`/api/v1/integrations/uploads/${uploadId}/`).then(unwrapEnvelope),

      /** Sheets tab — re-parses the stored file fresh on every call. */
      preview: (uploadId: string, q?: PreviewQuery) =>
        api<ApiEnvelope<PreviewResult>>(`/api/v1/integrations/uploads/${uploadId}/preview/`, {
          query: cleanQuery(q as Record<string, unknown>),
        }).then(unwrapEnvelope),

      /** Original file as a Blob — caller wires it to an <a download> click.
       *  Not through useApi() (its ApiOptions type pins responseType to
       *  'json'); attaches the auth header manually like the XHR upload
       *  helper above, since DataUploadDownloadView requires auth. */
      download: (uploadId: string) => downloadBlobWithAuth(`/api/v1/integrations/uploads/${uploadId}/download/`),

      /** Enqueue commit of a validated upload. Returns 202 — poll detail(). */
      commit: (uploadId: string) =>
        api<ApiEnvelope<DataUpload>>(`/api/v1/integrations/uploads/${uploadId}/commit/`, { method: 'POST' })
          .then(unwrapEnvelope),

      /**
       * "Upload a correction" — not-yet-committed uploads are cleanly
       * superseded (old row -> status="superseded", nothing to undo yet);
       * already-committed uploads keep their domain writes untouched (no
       * revert option exists here on purpose — see DataUploadReplaceView).
       */
      replace: (uploadId: string, file: File, declaredSchemaVersion?: string | null, onProgress?: (pct: number) => void) => {
        const form = new FormData()
        form.append('file', file)
        if (declaredSchemaVersion) form.append('schema_version', declaredSchemaVersion)
        return uploadFileWithProgress(`/api/v1/integrations/uploads/${uploadId}/replace/`, form, onProgress)
      },

      /** One file-level toggle ("Include N duplicate row(s)") rather than
       *  per-row selection — only while status="validated". */
      includeDuplicates: (uploadId: string) =>
        api<ApiEnvelope<DataUpload>>(`/api/v1/integrations/uploads/${uploadId}/include-duplicates/`, {
          method: 'POST',
        }).then(unwrapEnvelope),

      /** The template's expected fields — Track B mapping form's "our
       *  field" list (see uploads.applyMapping). */
      expectedColumns: (sourceId: string) =>
        api<ApiEnvelope<ExpectedColumn[]>>(`/api/v1/integrations/${sourceId}/expected-columns/`)
          .then(unwrapEnvelope),

      /**
       * Track B — apply a column mapping to an upload stuck on
       * status="needs_mapping" and re-enqueue validation. saveForAgency
       * upserts a reusable UploadMapping so the next mismatched upload
       * from this agency auto-applies it instead of stopping again.
       */
      applyMapping: (uploadId: string, columnMap: Record<string, string>, saveForAgency: boolean) =>
        api<ApiEnvelope<DataUpload>>(`/api/v1/integrations/uploads/${uploadId}/apply-mapping/`, {
          method: 'POST',
          body: { column_map: columnMap, save_for_agency: saveForAgency },
        }).then(unwrapEnvelope),

      /** The current locked .xlsx template for a manual source — routed
       *  through the auth-attached blob helper (see downloadBlobWithAuth)
       *  rather than a bare $fetch, which silently sent no apiBase/auth
       *  header and broke against any backend other than the dev proxy. */
      templateDownload: (sourceId: string) =>
        downloadBlobWithAuth(`/api/v1/integrations/${sourceId}/upload-template/`),
    },

    /** API feed page, Phase 1 reconciliation. */
    feedStats: (sourceId: string) =>
      api<ApiEnvelope<DataSourceStats>>(`/api/v1/integrations/${sourceId}/stats/`).then(unwrapEnvelope),

    /** Per-agency IngestedRecord counts — the analytics dashboard's
     *  "records they contribute" panel. */
    agencyContributions: (window: '24h' | '7d' | '30d' | 'all' = '30d') =>
      api<ApiEnvelope<AgencyContribution[]>>('/api/v1/integrations/agency-contributions/', {
        query: { window },
      }).then(unwrapEnvelope),

    /** Ingestion Analytics page (Page 4) — one aggregate call across every
     *  source rather than one feedStats() per source. */
    platformStats: (window: '24h' | '7d' | '30d' | 'all' = '7d') =>
      api<ApiEnvelope<PlatformStats>>('/api/v1/integrations/stats/', {
        query: { window },
      }).then(unwrapEnvelope),

    /** Register-an-API console (Page 1) — admin-only server-side (403 for
     *  anyone else; see core.permissions.IsAdminRole). Push-style protocols
     *  return `issued_secret` once; pull-style protocols encrypt and store
     *  `credentials` for a not-yet-built scheduled puller. */
    registerFeed: (payload: RegisterFeedPayload) =>
      api<ApiEnvelope<RegisterFeedResult>>('/api/v1/integrations/register/', {
        method: 'POST', body: payload,
      }).then(unwrapEnvelope),

    /** Two modes (see TestConnectionPayload.source_id): tests the form's
     *  current unsaved values, or re-tests an already-registered feed and
     *  persists the result to its last_test_at/last_test_ok. Push
     *  protocols only validate shape (nothing to reach yet); pull
     *  protocols make a real, SSRF-guarded outbound reachability probe. */
    testConnection: (payload: TestConnectionPayload) =>
      api<ApiEnvelope<TestConnectionResult>>('/api/v1/integrations/test-connection/', {
        method: 'POST', body: payload,
      }).then(unwrapEnvelope),
  }
}

// Keep the old type alias so any other code importing `Integration` still compiles.
export type Integration = DataSource
