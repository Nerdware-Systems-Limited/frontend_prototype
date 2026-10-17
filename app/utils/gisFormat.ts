// Formatting + badge helpers shared by the GIS & Spatial Analysis pages.
import type { LayerStatus, RequirementStatus } from '~/composables/api/useGisLayers'

export const fmtInt = (n: number | null | undefined) => (n == null ? '-' : n.toLocaleString('en-KE'))

export function fmtMeasure(n: number | null | undefined, unit: 'km' | 'km2' | null | undefined): string {
  if (n == null || !unit) return '-'
  const v = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10
  return `${v.toLocaleString('en-KE')} ${unit === 'km2' ? 'km²' : 'km'}`
}

export const fmtGisPct = (n: number | null | undefined) => (n == null ? '-' : `${Math.round(n * 10) / 10}%`)

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

export const REQ_BADGE: Record<RequirementStatus, string> = {
  uploaded: 'success', processing: 'info', requested: 'warning', failed: 'danger', missing: 'danger',
}
export const LAYER_BADGE: Record<LayerStatus, string> = { ready: 'success', processing: 'info', failed: 'danger' }

export const GEOM_LABEL: Record<string, string> = { Point: 'Points', LineString: 'Lines', Polygon: 'Polygons' }

/** Share of `part` in `whole` as 0-100, safe for zero. */
export const share = (part: number, whole: number) => (whole > 0 ? Math.min(100, (100 * part) / whole) : 0)

export function fmtBbox(b: number[] | null | undefined): string {
  return b && b.length === 4 ? `${b[0].toFixed(2)}, ${b[1].toFixed(2)} → ${b[2].toFixed(2)}, ${b[3].toFixed(2)}` : '-'
}
