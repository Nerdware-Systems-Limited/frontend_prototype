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

// ── Formatters (same behaviour as the Command Centre) ────────────────────
export function fmtNum(v: number | null | undefined, d = 0): string {
  if (v == null || Number.isNaN(v)) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
export function fmtPct(v: number | null | undefined): string {
  return v == null ? '-' : `${v.toFixed(1)}%`
}
export function fmtKsh(v: string | number | null | undefined): string {
  if (v == null) return '-'
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (Number.isNaN(n)) return '-'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString()
}

function paceComparison(actual: number, expected: number, window: string): Partial<KpiView> {
  if (!Number.isFinite(expected) || expected <= 0) return {}
  const diff = actual - expected
  if (Math.abs(diff) < 0.5) return { comparisonValue: `On ${window} pace`, trendDirection: 'flat' }
  return {
    comparisonValue: `${Math.abs(diff).toFixed(0)} ${diff > 0 ? 'above' : 'below'} ${window} pace`,
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
export const DOMAIN_FILTERS: Record<Domain, FilterField[]> = {
  safety: [], fleet: [], rail: [], aviation: [], maritime: [], infra: ['agency'],
}

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
        status: (active > 10 || fatal > 20) ? 'critical' : (active > 5 || fatal > 10) ? 'warning' : 'neutral',
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
        status: fatal > 20 ? 'critical' : fatal > 10 ? 'warning' : 'neutral',
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
        status: critical === 0 ? 'healthy' : critical > 5 ? 'critical' : 'warning',
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
        value: ie.average_pct.toFixed(1), unit: '%', period: 'TO DATE',
        description: `${fmtNum(ie.total_evaluated)} interventions evaluated`,
        status: ie.average_pct >= 60 ? 'healthy' : ie.average_pct >= 45 ? 'warning' : 'critical',
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
      const status = (tamper > 10 || tracked < 20) ? 'critical' : (tamper > 5 || tracked < 40) ? 'warning' : 'healthy'
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
        value: r.toFixed(1), unit: '%', period: 'LIVE', description: 'Speed governors reporting tamper',
        status: r > 10 ? 'critical' : r > 5 ? 'warning' : 'healthy',
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
        value: ot.on_time_pct.toFixed(1), unit: '%', period: '30D',
        description: `On-time arrivals · ${ot.avg_delay_min?.toFixed(0) ?? '-'} min avg delay`,
        status: ot.on_time_pct >= 80 ? 'healthy' : 'warning',
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
        value: k.otp_pct.toFixed(1), unit: '%', period: '7D',
        description: `On-time arrivals · ${fmtNum(k.flights_total)} flights`,
        status: k.otp_pct >= 85 ? 'healthy' : 'warning',
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
      const ok = dwell < 5
      return {
        value: fmtNum(teus), unit: 'TEU', unitTitle: 'TEU - twenty-foot equivalent container units', period: '30D',
        description: `Processed · ${dwell.toFixed(1)} d avg yard dwell`,
        status: ok ? 'healthy' : 'warning', statusLabel: ok ? 'On target' : 'Dwell elevated',
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
        value: pct.toFixed(1), unit: '%', abbr: 'IRI',
        abbrTitle: 'International Roughness Index - lower means a smoother road',
        description: `Rated good · IRI avg ${i.network.iri_average?.toFixed(2) ?? '-'}`,
        period: 'LATEST', status: pct >= 60 ? 'healthy' : 'warning',
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
        status: c === 0 ? 'healthy' : c > 10 ? 'critical' : 'warning',
      }
    },
  },
  {
    key: 'infra.maintenance_backlog', label: 'Maintenance backlog', domain: 'infra',
    source: 'KeNHA / KURA / KeRRA', sourceMode: 'batch', to: '/infrastructure/maintenance', filterFields: DOMAIN_FILTERS.infra,
    period: 'OPEN', description: 'Value of open work orders',
    resolve: (i: InfrastructureSummary) => ({
      value: `KES ${fmtKsh(i.maintenance.open_value_kes)}`, period: 'OPEN',
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
        value: u.toFixed(1), unit: '%', period: 'FY', description: 'Development budget utilised',
        status: u >= 60 ? 'healthy' : u >= 40 ? 'warning' : 'critical',
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
