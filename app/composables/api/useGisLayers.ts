// app/composables/api/useGisLayers.ts
// ─────────────────────────────────────────────────────────────────────
// Uploaded GIS layers (shapefile / GeoJSON / GeoPackage) and the
// "missing GIS data" tracker on the Integration Hub's GIS tab.
//
// Backend surface: /api/v1/gis/   (apps/gis/layer_views.py)
//   GET  layers/                         → layers visible to the caller
//   POST layers/upload/                  → 202, multipart; poll layers.detail()
//   GET  layers/{id}/                    → status + per-feature load errors
//   POST layers/{id}/reload/             → 202, re-run the stored file (optional new settings)
//   GET  layers/{id}/summary/            → totals, completeness, breakdowns, numeric ranges
//   GET  layers/{id}/features/           → GeoJSON (bbox/limit/offset/simplify/prop.<field>=)
//   GET  layer-requirements/             → expected layers + live status
//   GET  layer-requirements/coverage/    → counts by status, per agency
//   POST layer-requirements/{id}/request-upload/  → ask a user to upload
//   GET  layer-requests/?mine=1          → requests assigned to me
//
// All of these use the {success, data, message} envelope. The backend
// answers 503 when it has no PostGIS - surfaced as a normal error here.
// ─────────────────────────────────────────────────────────────────────

import { useAuthStore } from '~/stores/auth'
import { useApi, cleanQuery } from './_client'
import { apiBaseUrl } from '~/utils/apiBase'

export type GeomFamily = 'Point' | 'LineString' | 'Polygon'
export type LayerStatus = 'processing' | 'ready' | 'failed'
export type RequirementStatus = 'uploaded' | 'processing' | 'requested' | 'failed' | 'missing'
export type Classification = 'public' | 'internal' | 'restricted' | 'sensitive'

/** {include: {column: [values]}, exclude: {...}, bbox: [w, s, e, n]} - values match case-insensitively. */
export interface RowFilter {
  include?: Record<string, string[]>
  exclude?: Record<string, string[]>
  bbox?: [number, number, number, number]
}

export interface GeoLayer {
  id: string
  agency: string
  /** '' for platform reference layers (boundaries, roads, ...), which have no owning agency. */
  agency_code: string
  is_reference: boolean
  requirement: string | null
  slug: string
  name: string
  description: string
  geom_type: GeomFamily | ''
  classification: Classification
  source_crs: string
  /** {expected attribute: file column} used on the last load. */
  field_map: Record<string, string>
  /** Which rows of the file this layer keeps - see RowFilter. {} = all. */
  row_filter: RowFilter
  status: LayerStatus
  feature_count: number
  error_count: number
  /** Rows in the file the row filter left out (not errors). */
  filtered_count: number
  /** Only on detail() - first 100 per-feature errors. */
  errors?: { row: number; error: string }[]
  fatal_error: string
  /** [west, south, east, north], EPSG:4326 */
  bbox: [number, number, number, number] | null
  fields: string[]
  version: number
  original_filename: string
  uploaded_by_name: string
  created_at: string
  updated_at: string
}

export interface GeoLayerRequest {
  id: string
  requirement: string
  requirement_name: string
  agency_code: string
  assignee: string
  assignee_name: string
  assignee_email: string
  requested_by_name: string
  message: string
  due_date: string | null
  status: 'open' | 'fulfilled' | 'cancelled'
  fulfilled_by_layer: string | null
  fulfilled_at: string | null
  created_at: string
}

export interface GeoLayerRequirement {
  id: string
  agency: string
  agency_code: string
  agency_name: string
  key: string
  name: string
  description: string
  geom_type: GeomFamily
  required_fields: string[]
  is_active: boolean
  created_at: string
  status: RequirementStatus
  layer: GeoLayer | null
  open_requests: GeoLayerRequest[]
}

export interface GisCoverage {
  total: number
  uploaded: number
  processing: number
  requested: number
  failed: number
  missing: number
  complete_pct: number
  by_agency: ({ agency: string; agency_code: string; total: number } & Record<RequirementStatus, number>)[]
}

export interface LayerUploadPayload {
  file: File
  name?: string
  /** Same agency+slug = replace (version bump). Defaults server-side to the requirement key / name. */
  slug?: string
  description?: string
  requirement?: string
  /** Required for ministry-tier uploaders, ignored otherwise. */
  agency?: string
  /** Required when a shapefile has no .prj, e.g. EPSG:21037. */
  source_crs?: string
  classification?: Classification
  /** {expected attribute: file column} - lets a file satisfy `required_fields` under a different column name. */
  field_map?: Record<string, string>
  /** Keep only part of the file, so one national file can fill several layers. */
  row_filter?: RowFilter
}

/** Settings a reload may change; anything omitted keeps its current value. `row_filter: {}` clears it. */
export interface LayerReloadPayload {
  field_map?: Record<string, string>
  row_filter?: RowFilter
  source_crs?: string
  classification?: Classification
}

export interface FieldProfile {
  name: string
  kind: 'numeric' | 'categorical' | 'text' | 'empty'
  distinct: number
  filled: number
  filled_pct: number
}

export interface BreakdownValue { value: string | null; count: number; measure: number }

export interface LayerSummary {
  layer: {
    id: string; name: string; slug: string; geom_type: GeomFamily | ''; status: LayerStatus; version: number
    bbox: [number, number, number, number] | null; agency_code: string; updated_at: string
  }
  /** `measure` is km for lines, km2 for polygons, 0 for points (unit null). */
  totals: { features: number; measure: number; unit: 'km' | 'km2' | null }
  quality: { error_count: number; filtered_count: number; rows_in_file: number }
  fields: FieldProfile[]
  breakdowns: { field: string; values: BreakdownValue[]; other: { count: number; measure: number } | null }[]
  numeric: { field: string; min: number; max: number; avg: number }[]
}

export interface LayerFeatures {
  type: 'FeatureCollection'
  features: { id: number; properties: Record<string, unknown>; geometry: { type: string } }[]
  count: number
  returned: number
  offset: number
  next_offset: number | null
  truncated: boolean
}

interface Envelope<T> { success: boolean; data?: T; message?: string }

function unwrap<T>(res: Envelope<T>): T {
  if (!res.success || res.data === undefined) throw new Error(res.message || 'Request failed.')
  return res.data
}

function uploadLayer(
  payload: LayerUploadPayload, onProgress?: (pct: number) => void, signal?: AbortSignal,
): Promise<GeoLayer> {
  const auth = useAuthStore()
  const form = new FormData()
  form.append('file', payload.file)
  for (const k of ['name', 'slug', 'description', 'requirement', 'agency', 'source_crs', 'classification'] as const) {
    if (payload[k]) form.append(k, payload[k] as string)
  }
  if (payload.field_map && Object.keys(payload.field_map).length) {
    form.append('field_map', JSON.stringify(payload.field_map))
  }
  if (payload.row_filter && Object.keys(payload.row_filter).length) {
    form.append('row_filter', JSON.stringify(payload.row_filter))
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${apiBaseUrl()}/api/v1/gis/layers/upload/`)
    if (auth.accessToken) xhr.setRequestHeader('Authorization', `Bearer ${auth.accessToken}`)
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let body: Envelope<GeoLayer> | null = null
      try { body = JSON.parse(xhr.responseText) } catch { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300 && body?.success && body.data) resolve(body.data)
      else reject(new Error(body?.message || `Upload failed (HTTP ${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'))
    xhr.onabort = () => reject(new Error('Upload cancelled.'))
    signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(form)
  })
}

export function useGisLayers() {
  const api = useApi()
  const base = '/api/v1/gis'

  return {
    layers: {
      list: (q?: { agency?: string; status?: string; requirement?: string; q?: string }) =>
        api<Envelope<GeoLayer[]>>(`${base}/layers/`, { query: cleanQuery(q) }).then(unwrap),
      detail: (id: string) => api<Envelope<GeoLayer>>(`${base}/layers/${id}/`).then(unwrap),
      /** 202 - the layer comes back status="processing"; poll detail(). */
      upload: uploadLayer,
      /** 202 - re-runs the file stored at upload time (no re-upload); poll detail(). */
      reload: (id: string, body: LayerReloadPayload = {}) =>
        api<Envelope<GeoLayer>>(`${base}/layers/${id}/reload/`, { method: 'POST', body }).then(unwrap),
      summary: (id: string) => api<Envelope<LayerSummary>>(`${base}/layers/${id}/summary/`).then(unwrap),
      /** Raw GeoJSON (not enveloped). `prop` filters on exact attribute values. */
      features: (id: string, q?: { limit?: number; offset?: number; bbox?: string; simplify?: number; prop?: Record<string, string> }) =>
        api<LayerFeatures>(`${base}/layers/${id}/features/`, {
          query: { ...cleanQuery({ limit: q?.limit, offset: q?.offset, bbox: q?.bbox, simplify: q?.simplify }),
            ...Object.fromEntries(Object.entries(q?.prop ?? {}).filter(([, v]) => v !== '').map(([k, v]) => [`prop.${k}`, v])) },
        }),
      remove: (id: string) => api(`${base}/layers/${id}/`, { method: 'DELETE' }),
    },
    requirements: {
      list: (q?: { agency?: string; status?: string }) =>
        api<Envelope<GeoLayerRequirement[]>>(`${base}/layer-requirements/`, { query: cleanQuery(q) }).then(unwrap),
      coverage: (q?: { agency?: string }) =>
        api<Envelope<GisCoverage>>(`${base}/layer-requirements/coverage/`, { query: cleanQuery(q) }).then(unwrap),
      /** Admin only. `agency` is needed from ministry-tier accounts only. */
      create: (body: { name: string; geom_type: GeomFamily; description?: string; required_fields?: string[]; agency?: string }) =>
        api<Envelope<GeoLayerRequirement>>(`${base}/layer-requirements/`, { method: 'POST', body }).then(unwrap),
      /** Admin only. Sending `required_fields: []` stops the layer requiring any attribute. */
      update: (id: string, body: Partial<Pick<GeoLayerRequirement, 'name' | 'description' | 'required_fields' | 'is_active'>>) =>
        api<Envelope<GeoLayerRequirement>>(`${base}/layer-requirements/${id}/`, { method: 'PATCH', body }).then(unwrap),
      /** Admin only - notifies `assignee` and shows in their "my requests". */
      requestUpload: (id: string, body: { assignee: string; message?: string; due_date?: string }) =>
        api<Envelope<GeoLayerRequest>>(`${base}/layer-requirements/${id}/request-upload/`, { method: 'POST', body })
          .then(unwrap),
    },
    requests: {
      list: (q?: { mine?: boolean; status?: string }) =>
        api<Envelope<GeoLayerRequest[]>>(`${base}/layer-requests/`, {
          query: cleanQuery({ mine: q?.mine ? 1 : undefined, status: q?.status }),
        }).then(unwrap),
      cancel: (id: string) => api(`${base}/layer-requests/${id}/cancel/`, { method: 'POST' }),
    },
  }
}
