// app/utils/gisFile.ts
// ─────────────────────────────────────────────────────────────────────
// Client-side helpers for the Integration Hub's GIS upload dialog.
//
// The backend (apps/gis/layer_loader.py) enforces each expected layer's
// `required_fields` on every feature and accepts a `field_map`
// {expected attribute: file column}. Agencies' files rarely carry the
// literal attribute names (roads_joined.geojson has RID_8 / key /
// OBJECTID, not road_id), so the upload dialog suggests a column for
// each required field and lets the user pick another - the upload never
// hard-depends on a column called `road_id`.
//
// Files can be ~1GB, so only a head slice is ever read here.
// ─────────────────────────────────────────────────────────────────────

/** How many bytes of a GeoJSON file to read when looking for attribute names. */
export const SNIFF_BYTES = 2 * 1024 * 1024

export interface FileSniff {
  /** Attribute names found, in file order. Empty = unknown (zip/gpkg, or none found in the head slice). */
  columns: string[]
  /** Distinct sample values for a few columns, from the first features only - a hint, not a census. */
  samples: Record<string, string[]>
}

const EMPTY: FileSniff = { columns: [], samples: {} }

/** Parse the "properties" objects out of the head of a GeoJSON text. Tolerates a truncated tail. */
export function sniffGeojsonText(text: string, maxFeatures = 50): FileSniff {
  const columns: string[] = []
  const seen = new Set<string>()
  const samples: Record<string, Set<string>> = {}
  // Skip the FeatureCollection header: its "crs" member also has a "properties" object.
  const start = text.indexOf('"features"')
  if (start >= 0) text = text.slice(start)
  // Flat property objects only (no nested braces) - true of shapefile-derived GeoJSON.
  const re = /"properties"\s*:\s*(\{[^{}]*\})/g
  let m: RegExpExecArray | null
  let n = 0
  while ((m = re.exec(text)) && n < maxFeatures) {
    let props: Record<string, unknown>
    try { props = JSON.parse(m[1]) } catch { continue }
    n++
    for (const [k, v] of Object.entries(props)) {
      if (!seen.has(k)) { seen.add(k); columns.push(k) }
      if (v !== null && v !== '' && typeof v !== 'object') (samples[k] ??= new Set()).add(String(v))
    }
  }
  return {
    columns,
    samples: Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, [...v].slice(0, 12)])),
  }
}

export async function sniffGisFile(file: File): Promise<FileSniff> {
  const name = file.name.toLowerCase()
  if (!(name.endsWith('.geojson') || name.endsWith('.json'))) return EMPTY
  try {
    return sniffGeojsonText(await file.slice(0, SNIFF_BYTES).text())
  } catch {
    return EMPTY
  }
}

/** The backend names the file's real columns when field_map points at one that isn't there. */
export function parseAvailableColumns(message: string): string[] {
  const m = /Available:\s*(.+?)\.?\s*$/s.exec(message)
  return m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : []
}

// Columns that can stand in for a required attribute, best first. Only the
// first group is "the same thing"; the rest are identifiers that satisfy the
// backend's non-empty check and are flagged to the user as approximate.
const ALIASES: Record<string, string[]> = {
  road_id: ['road_id', 'roadid', 'rid_8', 'rid', 'road_no', 'road_number', 'road_code', 'key', 'objectid', 'fid', 'id'],
  route_id: ['route_id', 'routeid', 'route', 'id'],
  stop_id: ['stop_id', 'stopid', 'stop', 'id'],
  site_id: ['site_id', 'siteid', 'id', 'objectid'],
  asset_type: ['asset_type', 'type', 'asset', 'category'],
  survey_id: ['survey_id', 'surveyid', 'id'],
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export interface Suggestion { column: string; exact: boolean }

/** Pick a file column for `field`, or null if nothing plausible. */
export function suggestColumn(field: string, columns: string[]): Suggestion | null {
  const byNorm = new Map(columns.map(c => [norm(c), c]))
  const own = byNorm.get(norm(field))
  if (own) return { column: own, exact: true }
  for (const alias of ALIASES[field] ?? ['id', 'objectid', 'fid']) {
    const hit = byNorm.get(norm(alias))
    if (hit) return { column: hit, exact: false }
  }
  return null
}

/** {required field: column} for every field we can resolve; identity pairs are left out. */
export function buildFieldMap(required: string[], columns: string[], chosen: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of required) {
    const col = (chosen[f] ?? suggestColumn(f, columns)?.column ?? '').trim()
    if (col && col !== f) out[f] = col
  }
  return out
}

/** Required fields with neither a mapped column nor a same-named column in the file (when columns are known). */
export function unresolvedFields(required: string[], columns: string[], chosen: Record<string, string>): string[] {
  return required.filter((f) => {
    if ((chosen[f] ?? '').trim()) return false
    return columns.length ? !columns.includes(f) : false
  })
}

// ── Related layers ───────────────────────────────────────────────────

export interface RelatedHint { key: string; reason: string }

/**
 * A national road inventory feeds several expected layers. Which ones a given
 * file plausibly covers depends on its attributes (agency, class) and extent;
 * from a head slice we can only say what the first rows suggest.
 * Keys are GeoLayerRequirement.key slugs (apps/gis/expected_layers.py).
 */
export function relatedLayerHints(sniff: FileSniff): RelatedHint[] {
  const cols = sniff.columns.map(norm)
  const has = (...names: string[]) => names.some(n => cols.includes(norm(n)))
  const vals = (...names: string[]) => names.flatMap((n) => {
    const col = sniff.columns.find(c => norm(c) === norm(n))
    return col ? (sniff.samples[col] ?? []) : []
  }).map(v => v.toLowerCase())

  const roadLike = has('road_class', 'road_name', 'rid_8', 'road_id', 'highway', 'route_description')
  if (!roadLike) return []

  const agencies = vals('road_agency', 'agency', 'authority')
  const classes = vals('road_class', 'class', 'highway')
  const hints: RelatedHint[] = [
    { key: 'national-roads-register', reason: 'a road inventory - the National Roads Register takes every alignment' },
  ]
  if (agencies.includes('kerra') || classes.includes('c')) {
    hints.push({ key: 'rural-road-network', reason: 'KeRRA / Class C rows' })
  } else if (has('road_class')) {
    hints.push({ key: 'rural-road-network', reason: 'has a road class column (Class C = rural)' })
  }
  if (agencies.includes('kura')) hints.push({ key: 'urban-road-network', reason: 'KURA rows' })
  else if (has('road_agency')) hints.push({ key: 'urban-road-network', reason: 'has a road agency column (KURA = urban)' })
  if (has('nmt', 'path_type', 'facility', 'footpath', 'cycle_track')) {
    hints.push({ key: 'nmt-paths', reason: 'has NMT / path columns' })
  }
  return hints
}

// ── Row filters ──────────────────────────────────────────────────────

import type { RowFilter } from '~/composables/api/useGisLayers'

/** One editable line of the row-filter editor. `values` is comma-separated text. */
export interface FilterRow { mode: 'include' | 'exclude'; column: string; values: string }

const splitValues = (v: string) => v.split(',').map(x => x.trim()).filter(Boolean)

/** Editor rows -> API filter. Rows without a column or values are ignored; same column twice merges. */
export function rowsToFilter(rows: FilterRow[], bbox?: RowFilter['bbox']): RowFilter {
  const out: RowFilter = {}
  for (const r of rows) {
    const col = r.column.trim()
    const vals = splitValues(r.values)
    if (!col || !vals.length) continue
    const part = (out[r.mode] ??= {})
    part[col] = [...new Set([...(part[col] ?? []), ...vals])]
  }
  if (bbox) out.bbox = bbox
  return out
}

export function filterToRows(f: RowFilter | null | undefined): FilterRow[] {
  const rows: FilterRow[] = []
  for (const mode of ['include', 'exclude'] as const) {
    for (const [column, vals] of Object.entries(f?.[mode] ?? {})) rows.push({ mode, column, values: vals.join(', ') })
  }
  return rows
}

export function describeFilter(f: RowFilter | null | undefined): string {
  const bits: string[] = []
  for (const [c, v] of Object.entries(f?.include ?? {})) bits.push(`${c} = ${v.join(' | ')}`)
  for (const [c, v] of Object.entries(f?.exclude ?? {})) bits.push(`${c} ≠ ${v.join(' | ')}`)
  if (f?.bbox) bits.push('within a bounding box')
  return bits.join(' · ')
}

/** Suggested filters for the related road layers, from what the file's columns offer. */
export function suggestedFilterRows(key: string, sniff: FileSniff): FilterRow[] {
  const col = (name: string) => sniff.columns.find(c => norm(c) === norm(name))
  const agency = col('road_agency') ?? col('agency')
  const cls = col('road_class')
  if (key === 'rural-road-network') {
    if (agency) return [{ mode: 'include', column: agency, values: 'KeRRA' }]
    if (cls) return [{ mode: 'include', column: cls, values: 'C' }]
  }
  if (key === 'urban-road-network' && agency) return [{ mode: 'include', column: agency, values: 'KURA' }]
  return []
}
