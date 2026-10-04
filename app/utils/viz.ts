/**
 * Chart math for the visual primitives - d3 for scales, ticks and paths,
 * Vue templates for the marks (so every mark stays on tokens and in the
 * DOM for assistive tech). Pure functions, no Vue.
 */
import { scaleLinear, scalePoint, scaleBand, type ScaleLinear } from 'd3-scale'
import { area, line, curveMonotoneX } from 'd3-shape'
import { extent, max } from 'd3-array'
import type { FrameField } from '~/types/frame'
import { formatValue } from '~/utils/units'

/** Categorical series colour by slot - fixed order, never cycled (DESIGN: --viz-1..6). */
export const SERIES_SLOTS = 6
export function seriesColor(i: number): string {
  return `var(--viz-${Math.min(i, SERIES_SLOTS - 1) + 1})`
}

export type SizeClass = 'xs' | 's' | 'm' | 'l'

/** Size class from a widget body's width (px). */
export function sizeClassFor(width: number): SizeClass {
  if (width < 240) return 'xs'
  if (width < 400) return 's'
  if (width < 640) return 'm'
  return 'l'
}

/**
 * A y scale from 0 (bars and areas must start at zero) to a nice max,
 * with ~`count` clean ticks. Negative values extend the domain down.
 */
export function valueScale(values: (number | null)[], range: [number, number], count = 4): ScaleLinear<number, number> {
  const nums = values.filter((v): v is number => v != null)
  const [lo, hi] = extent(nums) as [number | undefined, number | undefined]
  const top = Math.max(hi ?? 0, 0) || 1
  const bottom = Math.min(lo ?? 0, 0)
  return scaleLinear().domain([bottom, top]).range(range).nice(count)
}

export function pointScale(keys: string[], range: [number, number]) {
  return scalePoint<string>().domain(keys).range(range).padding(0)
}

export function bandScale(keys: string[], range: [number, number], padding = 0.25) {
  return scaleBand<string>().domain(keys).range(range).paddingInner(padding).paddingOuter(0)
}

/** SVG path for one series; null values break the line (a gap, not a zero). */
export function linePath(points: { x: number; y: number | null }[]): string {
  return line<{ x: number; y: number | null }>()
    .defined(p => p.y != null)
    .x(p => p.x).y(p => p.y as number)
    .curve(curveMonotoneX)(points) ?? ''
}

export function areaPath(points: { x: number; y: number | null }[], baseline: number): string {
  return area<{ x: number; y: number | null }>()
    .defined(p => p.y != null)
    .x(p => p.x).y0(baseline).y1(p => p.y as number)
    .curve(curveMonotoneX)(points) ?? ''
}

/**
 * A bar path: 4px rounded data-end, square at the baseline (dataviz mark
 * spec). Vertical bars grow up from `base`; horizontal bars grow right.
 */
export function barPath(x: number, y: number, w: number, h: number, orient: 'v' | 'h' = 'v', r = 4): string {
  if (w <= 0 || h <= 0) return ''
  if (orient === 'v') {
    const rr = Math.min(r, w / 2, h)
    return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
  }
  const rr = Math.min(r, h / 2, w)
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`
}

export function maxOf(values: (number | null)[]): number {
  return max(values.filter((v): v is number => v != null)) ?? 0
}

/**
 * Short x-axis label for a time key. ISO dates -> "30 Sep"; ISO date-times
 * -> "14:00"; anything else is shown as given.
 */
const dayFmt = new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' })
const hourFmt = new Intl.DateTimeFormat('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' })
export function timeLabel(key: unknown, long = false): string {
  const s = String(key ?? '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00Z`)
    return Number.isNaN(d.getTime()) ? s : dayFmt.format(d)
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return s
    return long ? `${dayFmt.format(d)}, ${hourFmt.format(d)}` : hourFmt.format(d)
  }
  return s
}

/** Pick about `n` evenly spaced items to label (always first and last). */
export function sparseTicks<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items
  const step = (items.length - 1) / (n - 1)
  return Array.from({ length: n }, (_, i) => items[Math.round(i * step)]!)
}

/** Display text for one Frame cell, by the field's kind and unit. */
export function formatCell(value: unknown, field: Pick<FrameField, 'kind' | 'unit'>, longTime = false): string {
  if (field.kind === 'measure') return formatValue(value as number | null, field.unit ?? 'count')
  if (field.kind === 'time') return timeLabel(value, longTime)
  return value == null || value === '' ? '-' : String(value)
}
