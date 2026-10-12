/**
 * hqPerformance - the time-dependent figures on the HQ summary, as data.
 *
 * Each one asks an endpoint that really accepts "the last N days", so they
 * follow the unified time-range selector. They are history (what happened
 * over the chosen range), unlike the module tiles above them, which are
 * live status. A metric is shown only when the viewer can open its page, and
 * a failure of one never touches the others.
 *
 * Status comes from the shared thresholds (utils/thresholds.ts), so a figure
 * is "warning" here exactly when it is "warning" on its own module page.
 */
import { useAviationMaritime } from '~/composables/api/useAviationMaritime'
import { usePublicTransport } from '~/composables/api/usePublicTransport'
import { useRailway } from '~/composables/api/useRailway'
import { useTraffic } from '~/composables/api/useTraffic'
import { statusOf, type Status, type ThresholdKey } from '~/utils/thresholds'

export interface HqMetric {
  id: string
  label: string
  /** The page this comes from: gates visibility and is the drill-down. */
  route: string
  fetch: (days: number) => Promise<{ value: number | null; unit: 'pct' | 'kes' | 'count'; description: string; threshold?: ThresholdKey }>
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export const HQ_METRICS: HqMetric[] = [
  {
    id: 'rail-otp', label: 'Rail on-time performance', route: '/railway',
    async fetch(days) {
      const r = await useRailway().onTimeStats(days)
      return {
        value: r.total_operations > 0 ? r.on_time_pct : null, unit: 'pct', threshold: 'rail.otp_pct',
        description: `${r.total_operations.toLocaleString('en-KE')} operations · avg delay ${Math.round(r.avg_delay_min)} min`,
      }
    },
  },
  {
    id: 'aviation-otp', label: 'Flight on-time performance', route: '/aviation',
    async fetch(days) {
      const r = await useAviationMaritime().flightsOTP(days)
      return {
        value: r.total_flights > 0 ? r.on_time_pct : null, unit: 'pct', threshold: 'aviation.otp_pct',
        description: `${r.total_flights.toLocaleString('en-KE')} flights · avg delay ${Math.round(r.avg_delay_min)} min`,
      }
    },
  },
  {
    id: 'pt-revenue', label: 'Public transport fare revenue', route: '/public-transport',
    async fetch(days) {
      const r = await usePublicTransport().revenueByChannel(days)
      const rows = r.results ?? []
      return {
        value: rows.length ? sum(rows.map(c => c.total_kes ?? 0)) : null, unit: 'kes',
        description: `${sum(rows.map(c => c.transactions ?? 0)).toLocaleString('en-KE')} transactions`,
      }
    },
  },
  {
    id: 'traffic-volume', label: 'Vehicles classified', route: '/traffic',
    async fetch(days) {
      const r = await useTraffic().classShare(days)
      const rows = r.results ?? []
      return { value: rows.length ? sum(rows.map(c => c.total ?? 0)) : null, unit: 'count', description: `${rows.length} vehicle classes` }
    },
  },
]

export function metricStatus(value: number | null, threshold?: ThresholdKey): Status | undefined {
  return value == null || !threshold ? undefined : statusOf(value, threshold)
}
