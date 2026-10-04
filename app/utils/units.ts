/**
 * Unit-aware figure formatting for dashboard widgets.
 *
 * Every figure a widget shows goes through formatValue(v, unit) so numbers
 * read the same everywhere: en-KE grouping whatever the browser locale,
 * fixed decimals per unit, KES compacted to B / M / K, and a plain "-" for a
 * value the API didn't return (never a made-up 0).
 */
export const LOCALE = 'en-KE'

export type UnitKey =
  | 'count'   // 1,234
  | 'pct'     // 72.4%
  | 'kes'     // KES 2.5B
  | 'km'      // 1,204 km
  | 'tonnes'  // 3,400 t
  | 'kg'      // 1,200 kg
  | 'teu'     // 48,210 TEU
  | 'min'     // 12 min
  | 'days'    // 4.2 days
  | 'kmh'     // 54 km/h
  | 'score'   // 3.42 (indices such as IRI)

interface UnitSpec { decimals: number; suffix: string; title?: string }

const UNITS: Record<Exclude<UnitKey, 'kes'>, UnitSpec> = {
  count: { decimals: 0, suffix: '' },
  pct: { decimals: 1, suffix: '%' },
  km: { decimals: 0, suffix: 'km' },
  tonnes: { decimals: 0, suffix: 't', title: 'tonnes' },
  kg: { decimals: 0, suffix: 'kg' },
  teu: { decimals: 0, suffix: 'TEU', title: 'TEU - twenty-foot equivalent container units' },
  min: { decimals: 0, suffix: 'min', title: 'minutes' },
  days: { decimals: 1, suffix: 'days' },
  kmh: { decimals: 0, suffix: 'km/h' },
  score: { decimals: 2, suffix: '' },
}

const formatters = new Map<string, Intl.NumberFormat>()
function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: min, maximumFractionDigits: max })
    formatters.set(key, f)
  }
  return f
}

const isMissing = (v: unknown): v is null | undefined => v == null || (typeof v === 'number' && !Number.isFinite(v))

function toNumber(v: number | string | null | undefined): number | null {
  if (isMissing(v)) return null
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(n) ? n : null
}

/** A plain number, en-KE grouped. `decimals` fixes the fraction digits. */
export function formatNumber(v: number | string | null | undefined, decimals = 0): string {
  const n = toNumber(v)
  return n == null ? '-' : nf(decimals, decimals).format(n)
}

/** KES compacted: 2.5B, 340.0M, 12K, 950. */
export function formatKesAmount(v: number | string | null | undefined): string {
  const n = toNumber(v)
  if (n == null) return '-'
  const a = Math.abs(n)
  if (a >= 1e9) return `${nf(1, 1).format(n / 1e9)}B`
  if (a >= 1e6) return `${nf(1, 1).format(n / 1e6)}M`
  if (a >= 1e3) return `${nf(0, 0).format(n / 1e3)}K`
  return nf(0, 0).format(n)
}

export interface FormattedParts {
  /** The figure alone, e.g. "72.4" or "2.5B". "-" when missing. */
  value: string
  /** Unit to show beside it ("%", "TEU", "KES"…), empty when none or missing. */
  unit: string
  /** Long form of the unit for a tooltip / abbr title. */
  unitTitle?: string
  /** Unit goes before the figure (currency). */
  prefix: boolean
}

/** Figure and unit separately - for KpiCard's value / unit props. */
export function formatParts(v: number | string | null | undefined, unit: UnitKey = 'count', decimals?: number): FormattedParts {
  if (unit === 'kes') {
    const value = formatKesAmount(v)
    return { value, unit: value === '-' ? '' : 'KES', unitTitle: 'Kenya shillings', prefix: true }
  }
  const spec = UNITS[unit]
  const value = formatNumber(v, decimals ?? spec.decimals)
  return { value, unit: value === '-' ? '' : spec.suffix, unitTitle: spec.title, prefix: false }
}

/** One string, e.g. "72.4%", "KES 2.5B", "4.2 days", "-". */
export function formatValue(v: number | string | null | undefined, unit: UnitKey = 'count', decimals?: number): string {
  const p = formatParts(v, unit, decimals)
  if (!p.unit) return p.value
  if (p.prefix) return `${p.unit} ${p.value}`
  return unit === 'pct' ? `${p.value}%` : `${p.value} ${p.unit}`
}
