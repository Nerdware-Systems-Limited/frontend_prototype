/**
 * Time range - the one definition of "24 hours / 7 days / 30 days / a year"
 * shared by every module's overview and trend views. Pure, no Vue.
 *
 * Calendar days are counted in East Africa Time (UTC+3, no daylight saving),
 * the same convention the dashboard bucketing uses, so "today" and the start of
 * a year mean the same thing on every page no matter where the browser is.
 */

export type RangePreset = '24h' | '7d' | '30d'
/** A preset, one whole calendar year (`year` in RangeSelection), or any from/to period ('custom'). */
export type RangeMode = RangePreset | 'year' | 'custom'

export interface RangeSelection {
  mode: RangeMode
  year: number
  /** 'custom' only: first and last day included, `YYYY-MM-DD` (EAT). */
  from?: string
  to?: string
}

export const PRESET_DAYS: Record<RangePreset, number> = { '24h': 1, '7d': 7, '30d': 30 }
export const PRESET_LABEL: Record<RangePreset, string> = { '24h': '24 Hours', '7d': '7 Days', '30d': '30 Days' }
/** Earliest year the year navigator offers. Nothing before the platform's first data is selectable. */
export const EARLIEST_YEAR = 2015

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 86_400_000

/** `YYYY-MM-DD` for an instant, read in East Africa Time. */
export function eatDate(d: Date): string {
  return new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10)
}

/** The calendar year it currently is in East Africa Time. */
export function currentYear(now: Date = new Date()): number {
  return Number(eatDate(now).slice(0, 4))
}

/** Whole calendar days from `a` to `b` (`YYYY-MM-DD` both), negative when `b` is earlier. */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

/** Whole calendar days from today (EAT) until a `YYYY-MM-DD` or ISO date; negative once it has passed. */
export function daysUntilEat(date: string, now: Date = new Date()): number {
  return dayDiff(eatDate(now), date.slice(0, 10))
}

export interface RangeBounds {
  /** First day included, `YYYY-MM-DD`. */
  from: string
  /** Last day included, `YYYY-MM-DD` (today for a rolling range or the current year). */
  to: string
  /** Length to send to endpoints that only understand "the last N days". */
  days: number
  /** True when the window ends today, i.e. an endpoint taking only `days` can answer it. */
  endsToday: boolean
  label: string
}

export function clampYear(year: number, now: Date = new Date()): number {
  return Math.min(currentYear(now), Math.max(EARLIEST_YEAR, Math.trunc(year) || currentYear(now)))
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
/** Earliest day a custom range may start on. */
export const EARLIEST_DAY = `${EARLIEST_YEAR - 25}-01-01`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2012-03-04` -> `4 Mar 2012`. */
export function formatDay(d: string): string {
  return `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`
}

/** A real calendar day in `YYYY-MM-DD` form (rejects 2012-02-31). */
export function isIsoDay(v: unknown): v is string {
  return typeof v === 'string' && ISO_DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
    && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
}

export function rangeBounds(sel: RangeSelection, now: Date = new Date()): RangeBounds {
  const today = eatDate(now)
  if (sel.mode === 'custom') {
    // A half-filled or reversed pair is repaired rather than sent to the API as-is: a missing
    // end means "up to today", a reversed pair is swapped, and nothing reaches into the future.
    let from = isIsoDay(sel.from) ? sel.from : EARLIEST_DAY
    let to = isIsoDay(sel.to) ? sel.to : today
    if (from > to) [from, to] = [to, from]
    if (from < EARLIEST_DAY) from = EARLIEST_DAY
    if (to > today) to = today
    if (from > to) from = to
    return {
      from, to, days: dayDiff(from, to) + 1, endsToday: to === today,
      label: from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`,
    }
  }
  if (sel.mode === 'year') {
    const y = clampYear(sel.year, now)
    const from = `${y}-01-01`
    const end = `${y}-12-31`
    const to = end > today ? today : end
    return { from, to, days: dayDiff(from, to) + 1, endsToday: to === today, label: `${y}` }
  }
  const days = PRESET_DAYS[sel.mode]
  // Endpoints filter on whole days, so "the last 24 hours" is yesterday and today, "7 days" starts
  // seven days back. This is the window the pages' own `date_from = today - N` already used.
  const from = eatDate(new Date(now.getTime() - days * DAY_MS))
  return { from, to: today, days, endsToday: true, label: `Last ${PRESET_LABEL[sel.mode].toLowerCase()}` }
}

/** The short period badge KPI cards show: "24H", "7D", "30D" or the year. */
export function periodBadge(sel: RangeSelection): string {
  return sel.mode === 'year' ? String(sel.year) : sel.mode === 'custom' ? 'RANGE' : sel.mode.toUpperCase()
}

/**
 * Query parameters for endpoints that take the shared period contract: a rolling `days` for a
 * preset (so "24 Hours" is the last 24 hours, not yesterday plus today), `date_from` / `date_to`
 * for a year or a custom range.
 */
export function rangeQuery(sel: RangeSelection, now: Date = new Date()): { days: number } | { date_from: string; date_to: string } {
  if (sel.mode === 'year' || sel.mode === 'custom') {
    const b = rangeBounds(sel, now)
    return { date_from: b.from, date_to: b.to }
  }
  return { days: PRESET_DAYS[sel.mode] }
}

export function isRangeMode(v: unknown): v is RangeMode {
  return v === '24h' || v === '7d' || v === '30d' || v === 'year' || v === 'custom'
}

/** `?window=7` style numbers (days) to the nearest preset, or null. */
export function presetFromDays(n: number): RangePreset | null {
  return n === 1 ? '24h' : n === 7 ? '7d' : n === 30 ? '30d' : null
}
