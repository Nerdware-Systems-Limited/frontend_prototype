// app/utils/ingestStatus.ts
// ─────────────────────────────────────────────────────────────────────
// Single source of truth for DataUpload.status → label/phase/variant.
// Every status pill, filter chip, and progress bar across the
// Integration Hub (pages 1–3) reads from this map - see the redesign
// brief §3. Auto-imported (Nuxt `app/utils/` convention), no explicit
// import needed at call sites.
// ─────────────────────────────────────────────────────────────────────

import type { DataUpload, DataUploadStatus } from '~/composables/api'

export type IngestPhase = 'staged' | 'queued' | 'reading' | 'blocked' | 'ready' | 'writing' | 'done' | 'error'
export type IngestVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface StatusMeta {
  /** What the user reads. */
  label: string
  phase: IngestPhase
  variant: IngestVariant
  /** Poll while true. */
  inFlight: boolean
  /** Needs a human before the pipeline moves again - surfaces in the
   *  "needs attention" filter/KPI. */
  actionRequired: boolean
}

const STATUS_MAP: Record<DataUploadStatus, StatusMeta> = {
  // Template-late intake - file stored, no template chosen yet. Needs a
  // human to route it (POST /uploads/<id>/route/) before anything else
  // can happen, so it counts as "needs attention" but is never in-flight.
  unrouted: { label: 'Unrouted', phase: 'staged', variant: 'warning', inFlight: false, actionRequired: true },
  pending: { label: 'Queued', phase: 'queued', variant: 'neutral', inFlight: true, actionRequired: false },
  validating: { label: 'Reading', phase: 'reading', variant: 'info', inFlight: true, actionRequired: false },
  needs_mapping: { label: 'Needs mapping', phase: 'blocked', variant: 'warning', inFlight: false, actionRequired: true },
  validated: { label: 'Ready to write', phase: 'ready', variant: 'info', inFlight: false, actionRequired: true },
  rejected: { label: 'Rejected', phase: 'error', variant: 'danger', inFlight: false, actionRequired: false },
  committing: { label: 'Writing', phase: 'writing', variant: 'info', inFlight: true, actionRequired: false },
  committed: { label: 'Completed', phase: 'done', variant: 'success', inFlight: false, actionRequired: false },
  partial: { label: 'Partly written', phase: 'done', variant: 'warning', inFlight: false, actionRequired: true },
  failed: { label: 'Failed', phase: 'error', variant: 'danger', inFlight: false, actionRequired: false },
  superseded: { label: 'Superseded', phase: 'done', variant: 'neutral', inFlight: false, actionRequired: false },
}

export function statusMeta(status: DataUploadStatus): StatusMeta {
  return STATUS_MAP[status]
}

export function isInFlight(status: DataUploadStatus): boolean {
  return STATUS_MAP[status].inFlight
}

export function needsAttention(status: DataUploadStatus): boolean {
  return STATUS_MAP[status].actionRequired
}

/** null = indeterminate (render an animated bar, no number) - there is no
 *  parse-progress field on the backend, so anything still in the reading
 *  phase can't report a real percentage. Once parsing has produced a
 *  result (validated/needs_mapping/rejected/committing onward) reading
 *  is done, full stop. */
export function readPct(u: Pick<DataUpload, 'status'>): number | null {
  // An un-routed file was never read against a template - there's no
  // "read" to show a bar for. Callers render a dash instead.
  if (u.status === 'unrouted') return 0
  if (u.status === 'pending' || u.status === 'validating') return null
  return 100
}

/** Real number: dispatch()'s created-record count over valid_rows. */
export function writePct(u: Pick<DataUpload, 'valid_rows' | 'domain_records_created'>): number {
  if (!u.valid_rows) return 0
  return Math.min(100, Math.round((u.domain_records_created / u.valid_rows) * 100))
}
