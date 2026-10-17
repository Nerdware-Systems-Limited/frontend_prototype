// app/composables/api/useCorridor.ts
// ─────────────────────────────────────────────────────────────────────
// M15 - Corridor & Trade (NCTTCA · KenTrade · LAPSSET)
//
// Backend mounted at /api/v1/corridor/ (apps/corridor). Read-only: the data
// arrives through the Integration Hub upload templates CT-01 (transit
// shipments), CT-02 (border crossing performance) and CT-03 (corridor KPIs).
//
//   summary/                       one-shot overview payload
//   corridors/  corridors/compare/ the register, latest indicator per corridor
//   kpis/       kpis/series/       CT-03 values / charted series with benchmark gap
//   border-crossings/              CT-02 daily rows + performance/ daily-trend/ delay-causes/
//   shipments/                     CT-01 rows + transit-summary/
//
// Usage:
//   const corridor = useCorridor()
//   const summary = await corridor.summary(30)
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type CorridorCode = 'NORTHERN' | 'LAPSSET' | 'CENTRAL' | string
export type CustomsStatus = 'lodged' | 'in_transit' | 'at_border' | 'exited' | 'cleared' | 'held' | 'cancelled'
export type DelayCause = 'customs' | 'immigration' | 'inspection' | 'it_system' | 'staffing' | 'other'

export interface Corridor {
  id: string
  code: CorridorCode
  name: string
  corridor_type: string
  coordinating_agency: string | null
  coordinating_agency_code: string | null
  member_countries: string[]
  origin_label: string
  length_km: number | null
  description: string
  is_active: boolean
}

export interface KpiPoint { period_start: string; period_end: string; value: number }

export interface KpiSeries {
  corridor: CorridorCode
  indicator_code: string
  indicator_name: string
  segment: string
  unit: string
  benchmark_value: number | null
  benchmark_source: string
  latest: number
  latest_period_end: string
  previous: number | null
  change: number | null
  vs_benchmark_pct: number | null
  points: KpiPoint[]
}

export interface BorderPostStatus {
  site_id: string
  name: string
  latitude: number | null
  longitude: number | null
  avg_waiting_hours: number | null
  avg_clearance_hours: number | null
  peak_queue_length: number | null
  avg_osbp_utilisation_pct: number | null
  trucks: number
  top_delay_cause: DelayCause | null
  days_reported?: number
}

export interface TransitShipment {
  id: string
  transit_declaration_ref: string
  corridor: string
  corridor_code: CorridorCode
  container_number: string
  seal_id: string
  cargo_description: string
  cargo_weight_t: number | null
  transit_bond_kes: number | null
  origin: string
  destination_country: string
  destination_customs_station: string
  truck_registration: string
  transporter: string
  border_post: string | null
  border_post_site_id: string | null
  released_at: string | null
  expected_exit_at: string | null
  border_arrival_at: string | null
  border_departure_at: string | null
  arrival_at: string | null
  border_crossing_time_hours: number | null
  total_transit_time_hours: number | null
  customs_status: CustomsStatus
  tamper_alert: boolean
  deviation_alert: boolean
  /** Past the declared exit date and still in Kenya - the case a bond gets called on. */
  exit_overdue: boolean
}

export interface BorderCrossingDay {
  id: string
  border_post_site_id: string
  border_post_name: string
  corridor_code: CorridorCode | null
  date: string
  direction: 'inbound' | 'outbound'
  loaded_trucks: number
  empty_trucks: number
  tankers: number
  container_trucks: number
  passenger_vehicles: number
  total_trucks: number
  avg_waiting_time_hours: number | null
  avg_clearance_time_hours: number | null
  peak_queue_length: number | null
  osbp_utilisation_pct: number | null
  hours_of_operation: number | null
  lanes_operational: number | null
  top_delay_cause: DelayCause | ''
}

export interface CorridorSummary {
  window_days: number
  kpis: {
    shipments: number
    tonnage: number | null
    avg_transit_hours: number | null
    avg_border_crossing_hours: number | null
    tamper_alerts: number
    deviation_alerts: number
    in_transit: number
    bond_open_kes: number | null
    overdue_exits: number
    trucks_crossed: number
    avg_border_wait_hours: number | null
    avg_osbp_utilisation_pct: number | null
    border_posts_reporting: number
  }
  corridors: { code: CorridorCode; name: string; coordinating_agency: string | null; shipments: number; avg_transit_hours: number | null; tonnage: number | null }[]
  border_posts: BorderPostStatus[]
  status_mix: { status: CustomsStatus; label: string; count: number }[]
  alerts: TransitShipment[]
}

export interface CorridorAlignment { id: string; code: CorridorCode; name: string; mode: string; path: [number, number][] }

export interface BorderTrendPoint { date: string; trucks: number; avg_waiting_hours: number | null; avg_clearance_hours: number | null; peak_queue: number | null }
export interface DelayCauseRow { cause: DelayCause; label: string; days: number }

export interface TransitSummary {
  days: number
  status_counts: { status: CustomsStatus; label: string; count: number }[]
  daily: { date: string; declarations: number }[]
  /** Bond cover across every declaration in the window / only those still open (not yet out of Kenya). */
  bond_total_kes: number | null
  bond_open_kes: number | null
  /** Open declarations past their declared exit date. */
  overdue_exits: number
  groups: { corridor: CorridorCode; destination_country: string; shipments: number; avg_transit_hours: number | null; avg_border_crossing_hours: number | null; tamper_alerts: number; deviation_alerts: number; tonnage: number | null; bond_kes: number | null }[]
}

export interface CorridorCompareRow {
  indicator_code: string
  indicator_name: string
  unit: string
  corridors: Record<string, { value: number; unit: string; period_end: string; vs_benchmark_pct: number | null }>
}

export interface ShipmentQuery {
  corridor?: string
  customs_status?: CustomsStatus | ''
  destination_country?: string
  container_number?: string
  alerts?: '1' | ''
  page?: number
  page_size?: number
}

export interface BorderCrossingQuery { border_post?: string; corridor?: string; direction?: string; from?: string; to?: string; page?: number; page_size?: number }

export function useCorridor() {
  const api = useApi()
  const base = '/api/v1/corridor'
  return {
    summary: (days = 30) => api<CorridorSummary>(`${base}/summary/`, { query: { days } }),
    corridors: () => api<Paged<Corridor>>(`${base}/corridors/`),
    /** Corridor route lines from the GIS layers agencies uploaded; empty until one is uploaded and promoted. */
    alignments: () => api<CorridorAlignment[]>(`${base}/alignments/`),
    compare: () => api<CorridorCompareRow[]>(`${base}/corridors/compare/`),
    kpiSeries: (opts: { corridor?: string; months?: number } = {}) =>
      api<KpiSeries[]>(`${base}/kpis/series/`, { query: cleanQuery(opts) }),
    borderPerformance: (days = 30) =>
      api<{ days: number; posts: BorderPostStatus[] }>(`${base}/border-crossings/performance/`, { query: { days } }),
    borderTrend: (days = 30, borderPost?: string) =>
      api<{ days: number; points: BorderTrendPoint[] }>(`${base}/border-crossings/daily-trend/`, { query: cleanQuery({ days, border_post: borderPost }) }),
    delayCauses: (days = 30) =>
      api<{ days: number; causes: DelayCauseRow[] }>(`${base}/border-crossings/delay-causes/`, { query: { days } }),
    borderCrossings: (q: BorderCrossingQuery = {}) =>
      api<Paged<BorderCrossingDay>>(`${base}/border-crossings/`, { query: cleanQuery(q as Record<string, unknown>) }),
    shipments: (q: ShipmentQuery = {}) =>
      api<Paged<TransitShipment>>(`${base}/shipments/`, { query: cleanQuery(q as Record<string, unknown>) }),
    transitSummary: (days = 30) => api<TransitSummary>(`${base}/shipments/transit-summary/`, { query: { days } }),
  }
}

// ── Presentation helpers (shared by the five corridor pages) ──────────────

/** Indicators where a SMALLER number is the good direction (times, cost, stops). */
const LOWER_IS_BETTER = new Set([
  'BORDER_CROSSING_TIME', 'PORT_DWELL_TIME', 'WEIGHBRIDGE_CROSSING_TIME', 'TRANSPORT_COST_TKM',
  'AVG_TRUCK_STOPS', 'VESSEL_TURNAROUND_TIME',
])
/** Indicators whose benchmark is a completion target (100%), not a pass mark. */
const PROGRESS = new Set(['ROAD_PROGRESS_PCT', 'RAIL_EARTHWORKS_PROGRESS_PCT', 'INVESTMENT_DISBURSED_PCT'])

export type KpiKind = 'lower' | 'higher' | 'progress'
export function kpiKind(code: string): KpiKind {
  if (PROGRESS.has(code)) return 'progress'
  return LOWER_IS_BETTER.has(code) || code.startsWith('TRANSIT_TIME') ? 'lower' : 'higher'
}

export type Tone = 'success' | 'warning' | 'danger' | 'neutral'

/** How a value reads against its benchmark: success = meets it, warning = within 15%, danger = worse. */
export function benchmarkTone(s: Pick<KpiSeries, 'indicator_code' | 'latest' | 'benchmark_value'>): Tone {
  const kind = kpiKind(s.indicator_code)
  if (s.benchmark_value == null || kind === 'progress') return 'neutral'
  const ratio = kind === 'lower' ? s.latest / s.benchmark_value : s.benchmark_value / s.latest
  return ratio <= 1 ? 'success' : ratio <= 1.15 ? 'warning' : 'danger'
}

/** Is the latest movement good news? null when flat/unknown - never assumed. */
export function changeFavourable(s: Pick<KpiSeries, 'indicator_code' | 'change'>): boolean | null {
  if (s.change == null || s.change === 0) return null
  return kpiKind(s.indicator_code) === 'lower' ? s.change < 0 : s.change > 0
}

export function fmtNum(v: number | null | undefined, d = 0): string {
  return v == null || Number.isNaN(v) ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d })
}

/** Readable value for an indicator: 3 significant-ish digits, large numbers grouped. */
export function fmtKpi(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '-'
  const a = Math.abs(v)
  return fmtNum(v, a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 1 : a >= 1 ? 2 : 3)
}

/** KES in the short form the platform uses elsewhere: 2.5M, 1.3B. */
export function fmtKes(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '-'
  const a = Math.abs(n)
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${(n / 1e3).toFixed(0)}k`
  return Math.round(n).toLocaleString()
}

export const CORRIDOR_LINE_COLOR: Record<string, string> = { NORTHERN: '#0D4C8B', LAPSSET: '#D99A0F', CENTRAL: '#5B6773' }

/** Alignment -> UaptsMap LineSpec. */
export function alignmentLines(items: CorridorAlignment[]) {
  return items.map(a => ({
    id: a.id, points: a.path, label: `${a.code} · ${a.name}`, weight: 4, opacity: 0.85,
    color: CORRIDOR_LINE_COLOR[a.code] ?? '#5B6773',
  }))
}

export function fmtHours(h: number | null | undefined): string {
  if (h == null) return '-'
  return h >= 48 ? `${(h / 24).toFixed(1)} d` : `${h.toFixed(1)} h`
}

/** "2026-09-30" -> "Sep 26" for a monthly chart axis. */
export function monthLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' })
}

export const STATUS_VARIANT: Record<CustomsStatus, string> = {
  lodged: 'neutral', in_transit: 'info', at_border: 'warning', exited: 'info', cleared: 'success', held: 'danger', cancelled: 'neutral',
}
export const STATUS_LABEL: Record<CustomsStatus, string> = {
  lodged: 'Lodged', in_transit: 'In transit', at_border: 'At border', exited: 'Exited Kenya', cleared: 'Cleared', held: 'Held', cancelled: 'Cancelled',
}
export const CAUSE_LABEL: Record<string, string> = {
  customs: 'Customs', immigration: 'Immigration', inspection: 'Inspection', it_system: 'IT system', staffing: 'Staffing', other: 'Other',
}

/** Border waiting-time band: <5h fine, <8h watch, otherwise breach. */
export function waitTone(h: number | null | undefined): Tone {
  if (h == null) return 'neutral'
  return h < 5 ? 'success' : h < 8 ? 'warning' : 'danger'
}
export const TONE_COLOR: Record<Tone, string> = {
  success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--destructive)', neutral: 'var(--border-interactive)',
}

const KPI_STATUS: Record<Tone, 'healthy' | 'warning' | 'critical' | undefined> = {
  success: 'healthy', warning: 'warning', danger: 'critical', neutral: undefined,
}

/** KpiCard props for one indicator series - value, unit, target, trend, status, sparkline. */
export function kpiCardBind(s: KpiSeries) {
  const kind = kpiKind(s.indicator_code)
  const fav = changeFavourable(s)
  return {
    label: s.indicator_name + (s.segment ? ` · ${s.segment}` : ''),
    value: fmtKpi(s.latest),
    unit: s.unit,
    period: 'MONTHLY',
    status: KPI_STATUS[benchmarkTone(s)],
    target: s.benchmark_value != null && kind !== 'progress' ? `${fmtKpi(s.benchmark_value)} ${s.unit}` : undefined,
    targetLabel: s.benchmark_source || 'Target',
    comparisonValue: s.change != null ? `${s.change > 0 ? '+' : ''}${fmtKpi(s.change)}` : undefined,
    comparisonPeriod: 'vs prior month',
    trendDirection: s.change == null ? undefined : s.change > 0 ? 'up' as const : s.change < 0 ? 'down' as const : 'flat' as const,
    trendFavorable: fav === null ? undefined : fav,
    series: s.points.map(p => p.value),
  }
}
