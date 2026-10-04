/**
 * Metric registry - every KPI a dashboard can show, as data.
 *
 * These resolvers are lifted from NationalCommandCentre.vue's `*View`
 * computeds so the configurable dashboards and the hard-coded Command Centre
 * produce identical numbers and statuses. Same honest-data rules:
 *   - a failed fetch or null field renders "-" + a reason, never "0";
 *   - a real 0 meaning "nothing recorded" is unavailable, not green;
 *   - comparisons only from arithmetic on values the API actually returned.
 *
 * A metric names the DOMAIN it reads. The data layer (useDomainData) fetches
 * each domain once per filter context, so six safety KPIs on one dashboard
 * cost one /safety/summary call, not six.
 */
import type { FilterField } from '~/types/dashboard'
import type {
  SafetySummary, FleetSummary, RailwaySummary, AviationSummary,
  MaritimeOps, InfrastructureSummary,
} from '~/composables/api'
import { DOMAIN_SOURCE, SOURCES_BY_ID } from '~/utils/dataSources'
import { statusOf, worstStatus } from '~/utils/thresholds'
import { formatKesAmount, formatNumber, formatParts, formatValue } from '~/utils/units'

export type Domain = 'safety' | 'fleet' | 'rail' | 'aviation' | 'maritime' | 'infra'

export interface DomainPayloads {
  safety: SafetySummary
  fleet: FleetSummary
  rail: RailwaySummary
  aviation: AviationSummary
  maritime: MaritimeOps
  infra: InfrastructureSummary
}

/** Props for <KpiCard>. Mirrors the KpiView interface in NationalCommandCentre. */
export interface KpiView {
  value: string
  unit?: string
  unitTitle?: string
  abbr?: string
  abbrTitle?: string
  description?: string
  status?: 'healthy' | 'warning' | 'critical' | 'neutral'
  statusLabel?: string
  period?: string
  unavailable?: boolean
  unavailableReason?: string
  comparisonValue?: string
  comparisonPeriod?: string
  trendDirection?: 'up' | 'down' | 'flat'
  trendFavorable?: boolean
  series?: number[]
}

export interface MetricDefinition<D extends Domain = Domain> {
  key: string
  label: string
  domain: D
  /** Source attribution shown in the widget frame. */
  source: string
  sourceMode: 'live' | 'batch'
  /** Default drill-down route. */
  to?: string
  /** Filters the domain endpoint accepts. Others are ignored for this metric. */
  filterFields: FilterField[]
  /** Period shown when the data is missing (so the badge doesn't jump on load). */
  period: string
  description: string
  resolve: (data: DomainPayloads[D]) => KpiView
}

// ── Formatters - thin names over utils/units (en-KE, honest "-") ─────────
/** Whole-number count, en-KE grouped. Prefer formatValue(v, unit) in new code. */
export function fmtNum(v: number | null | undefined, d = 0): string {
  return formatNumber(v, d)
}
/** Percentage with one decimal, e.g. "72.4%". */
export function fmtPct(v: number | null | undefined): string {
  return formatValue(v, 'pct')
}
/** KES amount compacted to B / M / K, without the currency prefix. */
export function fmtKsh(v: string | number | null | undefined): string {
  return formatKesAmount(v)
}

/** KpiCard value + unit for a percentage, e.g. { value: '72.4', unit: '%' }. */
function pctParts(v: number | null | undefined): Pick<KpiView, 'value' | 'unit'> {
  const p = formatParts(v, 'pct')
  return { value: p.value, unit: p.unit || undefined }
}

function paceComparison(actual: number, expected: number, window: string): Partial<KpiView> {
  if (!Number.isFinite(expected) || expected <= 0) return {}
  const diff = actual - expected
  if (Math.abs(diff) < 0.5) return { comparisonValue: `On ${window} pace`, trendDirection: 'flat' }
  return {
    comparisonValue: `${fmtNum(Math.abs(diff))} ${diff > 0 ? 'above' : 'below'} ${window} pace`,
    trendDirection: diff > 0 ? 'up' : 'down',
    trendFavorable: diff < 0, // fewer incidents is the good direction
  }
}

const noData = (period: string, description: string, reason: string): KpiView =>
  ({ value: '-', period, description, unavailable: true, unavailableReason: reason })

function infraGoodPct(i: InfrastructureSummary): { pct: number; total: number } {
  const dist = i.network?.condition_distribution ?? []
  const total = dist.reduce((s, c) => s + (c.length || 0), 0)
  const good = dist.filter(c => c.condition_class === 'good').reduce((s, c) => s + (c.length || 0), 0)
  return { pct: total > 0 ? (good / total) * 100 : 0, total }
}

/**
 * Filters each domain endpoint really honours on the UAPTS backend (checked
 * against the view code: /safety, /fleet and /railway summaries read no query
 * params; aviation/maritime summaries read only a fixed `days` window;
 * /infrastructure/summary/ reads `agency`, as an Agency UUID - useDomainData
 * translates the dashboard's agency code). Anything else shows as
 * "Not filtered by ..." on the widget.
 */
export const DOMAIN_FILTERS: Record<Domain, FilterField[]> = Object.fromEntries(
  (Object.keys(DOMAIN_SOURCE) as Domain[]).map(d => [d, SOURCES_BY_ID[DOMAIN_SOURCE[d]]!.honours]),
) as Record<Domain, FilterField[]>

// ── The registry ────────────────────────────────────────────────────────
export const METRICS: MetricDefinition<any>[] = [
  {
    key: 'safety.active_incidents', label: 'Road Safety', domain: 'safety',
    source: 'NTSA IRSMS', sourceMode: 'live', to: '/safety', filterFields: DOMAIN_FILTERS.safety,
    period: 'LIVE', description: 'Active serious incidents',
    resolve: (s: SafetySummary) => {
      const { active, fatal_30d: fatal } = s.kpis
      return {
        value: fmtNum(active), period: 'LIVE', description: 'Active serious incidents',
        status: worstStatus(statusOf(active, 'safety.active_incidents'), statusOf(fatal, 'safety.fatalities_30d')),
      }
    },
  },
  {
    key: 'safety.incidents_24h', label: 'Incidents today', domain: 'safety',
    source: 'NTSA IRSMS', sourceMode: 'live', to: '/safety/incidents', filterFields: DOMAIN_FILTERS.safety,
    period: '24H', description: 'All severities',
    resolve: (s: SafetySummary) => ({
      value: fmtNum(s.kpis.total_24h), period: '24H', description: 'All severities', status: 'neutral',
      ...paceComparison(s.kpis.total_24h, s.kpis.total_7d / 7, '7-day'),
    }),
  },
  {
    key: 'safety.incidents_7d', label: 'Incidents', domain: 'safety',
    source: 'NTSA IRSMS', sourceMode: 'live', to: '/safety/incidents', filterFields: DOMAIN_FILTERS.safety,
    period: '7D', description: 'Rolling 7-day total',
    resolve: (s: SafetySummary) => ({
      value: fmtNum(s.kpis.total_7d), period: '7D', description: 'Rolling 7-day total', status: 'neutral',
      ...paceComparison(s.kpis.total_7d, (s.kpis.total_30d / 30) * 7, '30-day'),
    }),
  },
  {
    key: 'safety.fatalities_30d', label: 'Fatalities', domain: 'safety',
    source: 'NTSA IRSMS + NPS', sourceMode: 'live', to: '/safety/kpis', filterFields: DOMAIN_FILTERS.safety,
    period: '30D', description: 'Fatal incidents',
    resolve: (s: SafetySummary) => {
      const fatal = s.kpis.fatal_30d
      const trend = s.fatality_trend_30d ?? []
      let cmp: Partial<KpiView> = {}
      if (trend.length >= 8) {
        const mid = Math.floor(trend.length / 2)
        const a = trend.slice(0, mid).reduce((t, d) => t + d.fatalities, 0)
        const b = trend.slice(mid).reduce((t, d) => t + d.fatalities, 0)
        const diff = b - a
        cmp = {
          comparisonValue: diff === 0 ? 'Level' : `${fmtNum(Math.abs(diff))} ${diff > 0 ? 'more' : 'fewer'}`,
          comparisonPeriod: 'vs prior 15 days',
          trendDirection: diff === 0 ? 'flat' : diff > 0 ? 'up' : 'down',
          trendFavorable: diff < 0,
        }
      }
      return {
        value: fmtNum(fatal), period: '30D', description: 'Fatal incidents',
        status: statusOf(fatal, 'safety.fatalities_30d'),
        series: trend.length > 1 ? trend.map(d => d.fatalities) : undefined,
        ...cmp,
      }
    },
  },
  {
    key: 'safety.critical_blackspots', label: 'Critical black spots', domain: 'safety',
    source: 'NTSA KDE analysis', sourceMode: 'batch', to: '/safety/blackspots', filterFields: DOMAIN_FILTERS.safety,
    period: 'CURRENT', description: 'Active accident clusters',
    resolve: (s: SafetySummary) => {
      const t = s.black_spots_by_tier
      const critical = t['critical'] ?? 0
      return {
        value: fmtNum(critical), period: 'CURRENT',
        description: critical === 0 ? 'No critical clusters active' : `High ${fmtNum(t['high'] ?? 0)} · Med ${fmtNum(t['medium'] ?? 0)}`,
        status: statusOf(critical, 'safety.critical_blackspots'),
      }
    },
  },
  {
    key: 'safety.dispatches', label: 'Emergency dispatches', domain: 'safety',
    source: 'NPS / NTSA', sourceMode: 'live', to: '/safety/incidents', filterFields: DOMAIN_FILTERS.safety,
    period: 'LIVE', description: 'Units currently deployed',
    resolve: (s: SafetySummary) => ({
      value: fmtNum(s.active_dispatches), period: 'LIVE', description: 'Units currently deployed', status: 'neutral',
    }),
  },
  {
    key: 'safety.intervention_effectiveness', label: 'Intervention effectiveness', domain: 'safety',
    source: 'KeNHA / NTSA', sourceMode: 'batch', to: '/safety/kpis', filterFields: DOMAIN_FILTERS.safety,
    period: 'TO DATE', description: 'Interventions evaluated',
    resolve: (s: SafetySummary) => {
      const ie = s.intervention_effectiveness
      if (!ie || ie.total_evaluated === 0) return noData('TO DATE', 'Interventions evaluated', 'No interventions evaluated yet')
      return {
        ...pctParts(ie.average_pct), period: 'TO DATE',
        description: `${fmtNum(ie.total_evaluated)} interventions evaluated`,
        status: statusOf(ie.average_pct, 'safety.intervention_effectiveness'),
      }
    },
  },
  {
    key: 'fleet.live_vehicles', label: 'Active Fleet', domain: 'fleet',
    source: 'NTSA iTIMS', sourceMode: 'live', to: '/fleet', filterFields: DOMAIN_FILTERS.fleet,
    period: 'LIVE', description: 'Live GPS-tracked PSV & govt fleet',
    resolve: (f: FleetSummary) => {
      const live = f.kpis.live_vehicles
      const total = f.kpis.total_vehicles
      if (live === 0 && total > 0) return noData('LIVE', 'Live GPS-tracked PSV & govt fleet', 'No live telemetry received')
      const tamper = f.governor_compliance.tamper_rate_pct
      const tracked = total > 0 ? (live / total) * 100 : 0
      const status = worstStatus(statusOf(tamper, 'fleet.governor_tamper_pct'), statusOf(tracked, 'fleet.tracked_pct'))
      return { value: fmtNum(live), period: 'LIVE', description: `Live now · ${fmtNum(total)} registered`, status }
    },
  },
  {
    key: 'fleet.governor_tamper', label: 'Governor tamper rate', domain: 'fleet',
    source: 'NTSA iTIMS', sourceMode: 'live', to: '/fleet/behaviour', filterFields: DOMAIN_FILTERS.fleet,
    period: 'LIVE', description: 'Speed governors reporting tamper',
    resolve: (f: FleetSummary) => {
      const r = f.governor_compliance.tamper_rate_pct
      return {
        ...pctParts(r), period: 'LIVE', description: 'Speed governors reporting tamper',
        status: statusOf(r, 'fleet.governor_tamper_pct'),
      }
    },
  },
  {
    key: 'rail.otp_30d', label: 'Rail Network', domain: 'rail',
    source: 'KRC Operations', sourceMode: 'live', to: '/railway', filterFields: DOMAIN_FILTERS.rail,
    period: '30D', description: 'On-time arrivals',
    resolve: (r: RailwaySummary) => {
      const ot = r.on_time_30d
      if (!ot || ot.total_operations === 0) return noData('30D', 'On-time arrivals', 'No operations recorded (30d)')
      return {
        ...pctParts(ot.on_time_pct), period: '30D',
        description: `On-time arrivals · ${formatValue(ot.avg_delay_min, 'min')} avg delay`,
        status: statusOf(ot.on_time_pct, 'rail.otp_pct'),
      }
    },
  },
  {
    key: 'rail.ridership_30d', label: 'Rail ridership', domain: 'rail',
    source: 'KRC Operations', sourceMode: 'live', to: '/railway', filterFields: DOMAIN_FILTERS.rail,
    period: '30D', description: 'Passengers carried',
    resolve: (r: RailwaySummary) => ({
      value: fmtNum(r.ridership_30d.passengers), period: '30D', description: 'Passengers carried', status: 'neutral',
    }),
  },
  {
    key: 'aviation.otp_7d', label: 'Aviation', domain: 'aviation',
    source: 'KAA / KCAA', sourceMode: 'live', to: '/aviation?window=7', filterFields: DOMAIN_FILTERS.aviation,
    period: '7D', description: 'On-time arrivals',
    resolve: (a: AviationSummary) => {
      const k = a.kpis
      if (k.flights_total === 0) return noData('7D', 'On-time arrivals', 'No flights recorded (7d)')
      return {
        ...pctParts(k.otp_pct), period: '7D',
        description: `On-time arrivals · ${fmtNum(k.flights_total)} flights`,
        status: statusOf(k.otp_pct, 'aviation.otp_pct'),
      }
    },
  },
  {
    key: 'aviation.pax_7d', label: 'Air passengers', domain: 'aviation',
    source: 'KAA / KCAA', sourceMode: 'live', to: '/aviation', filterFields: DOMAIN_FILTERS.aviation,
    period: '7D', description: 'Passenger throughput',
    resolve: (a: AviationSummary) => ({
      value: fmtNum(a.kpis.pax_total), period: '7D', description: 'Passenger throughput', status: 'neutral',
    }),
  },
  {
    key: 'maritime.teu_30d', label: 'Ports & Logistics', domain: 'maritime',
    source: 'KPA Mombasa', sourceMode: 'batch', to: '/maritime?window=30', filterFields: DOMAIN_FILTERS.maritime,
    period: '30D', description: 'Containers processed',
    resolve: (m: MaritimeOps) => {
      const ports = m.ports ?? []
      if (!ports.length) return noData('30D', 'Containers processed', 'No port feed connected')
      const teus = ports.reduce((s, p) => s + (p.teu_throughput_30d || 0), 0)
      const dwell = ports.reduce((s, p) => s + (p.avg_yard_dwell_days || 0), 0) / ports.length
      if (teus === 0 && dwell === 0) return noData('30D', 'Containers processed', 'No port throughput reported (30d)')
      const status = statusOf(dwell, 'maritime.yard_dwell_days')
      const ok = status === 'healthy'
      const teu = formatParts(teus, 'teu')
      return {
        value: teu.value, unit: teu.unit, unitTitle: teu.unitTitle, period: '30D',
        description: `Processed · ${formatValue(dwell, 'days')} avg yard dwell`,
        status, statusLabel: ok ? 'On target' : 'Dwell elevated',
      }
    },
  },
  {
    key: 'infra.good_condition', label: 'Road Infrastructure', domain: 'infra',
    source: 'KeNHA / KURA / KeRRA', sourceMode: 'batch', to: '/infrastructure', filterFields: DOMAIN_FILTERS.infra,
    period: 'LATEST', description: 'Network rated good condition',
    resolve: (i: InfrastructureSummary) => {
      const { pct, total } = infraGoodPct(i)
      if (!total) return noData('LATEST', 'Network rated good condition', 'No condition survey data')
      return {
        ...pctParts(pct), abbr: 'IRI',
        abbrTitle: 'International Roughness Index - lower means a smoother road',
        description: `Rated good · IRI avg ${formatValue(i.network.iri_average, 'score')}`,
        period: 'LATEST', status: statusOf(pct, 'infra.good_condition_pct'),
      }
    },
  },
  {
    key: 'infra.critical_bridges', label: 'Critical bridges', domain: 'infra',
    source: 'BMS survey', sourceMode: 'batch', to: '/infrastructure/bridges', filterFields: DOMAIN_FILTERS.infra,
    period: 'LATEST', description: 'Bridges in critical condition',
    resolve: (i: InfrastructureSummary) => {
      const c = i.bridges.critical_count
      return {
        value: fmtNum(c), period: 'LATEST', description: `of ${fmtNum(i.bridges.total)} bridges surveyed`,
        status: statusOf(c, 'infra.critical_bridges'),
      }
    },
  },
  {
    key: 'infra.maintenance_backlog', label: 'Maintenance backlog', domain: 'infra',
    source: 'KeNHA / KURA / KeRRA', sourceMode: 'batch', to: '/infrastructure/maintenance', filterFields: DOMAIN_FILTERS.infra,
    period: 'OPEN', description: 'Value of open work orders',
    resolve: (i: InfrastructureSummary) => ({
      value: formatValue(i.maintenance.open_value_kes, 'kes'), period: 'OPEN',
      description: 'Value of open work orders', status: 'neutral',
    }),
  },
  {
    key: 'infra.budget_absorption', label: 'Budget absorption', domain: 'infra',
    source: 'IFMIS', sourceMode: 'batch', to: '/infrastructure', filterFields: DOMAIN_FILTERS.infra,
    period: 'FY', description: 'Development budget utilised',
    resolve: (i: InfrastructureSummary) => {
      const u = i.budget.utilization_pct
      return {
        ...pctParts(u), period: 'FY', description: 'Development budget utilised',
        status: statusOf(u, 'infra.budget_absorption_pct'),
      }
    },
  },
]

export const METRICS_BY_KEY: Record<string, MetricDefinition<any>> =
  Object.fromEntries(METRICS.map(m => [m.key, m]))

export const DOMAIN_LABELS: Record<Domain, string> = {
  safety: 'Road Safety', fleet: 'Fleet', rail: 'Rail', aviation: 'Aviation',
  maritime: 'Maritime', infra: 'Infrastructure',
}
