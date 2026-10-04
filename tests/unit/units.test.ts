// tests/unit/units.test.ts
// ─────────────────────────────────────────────────────────────────────
// formatValue(v, unit): one en-KE formatter for every dashboard figure.
// A missing figure is always "-", never a made-up 0.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { formatKesAmount, formatNumber, formatParts, formatValue } from '~/utils/units'
import { fmtKsh, fmtNum, fmtPct } from '~/utils/metricRegistry'

describe('formatValue', () => {
  it('formats each unit with its own decimals and suffix', () => {
    expect(formatValue(1234567, 'count')).toBe('1,234,567')
    expect(formatValue(72.44, 'pct')).toBe('72.4%')
    expect(formatValue(80, 'pct')).toBe('80.0%')
    expect(formatValue(48210, 'teu')).toBe('48,210 TEU')
    expect(formatValue(4.234, 'days')).toBe('4.2 days')
    expect(formatValue(12.6, 'min')).toBe('13 min')
    expect(formatValue(12.64, 'min', 1)).toBe('12.6 min')
    expect(formatValue(3400, 'tonnes')).toBe('3,400 t')
    expect(formatValue(3.4219, 'score')).toBe('3.42')
    expect(formatValue(54, 'kmh')).toBe('54 km/h')
  })

  it('compacts KES and puts the currency first', () => {
    expect(formatValue(2_500_000_000, 'kes')).toBe('KES 2.5B')
    expect(formatValue('340000000', 'kes')).toBe('KES 340.0M')
    expect(formatValue(12_400, 'kes')).toBe('KES 12K')
    expect(formatValue(950, 'kes')).toBe('KES 950')
    expect(formatKesAmount(-2_000_000)).toBe('-2.0M')
  })

  it('renders missing figures as a plain dash with no unit', () => {
    for (const v of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, 'not a number']) {
      expect(formatValue(v as number, 'pct')).toBe('-')
      expect(formatValue(v as number, 'kes')).toBe('-')
    }
    expect(formatParts(null, 'teu')).toEqual({ value: '-', unit: '', unitTitle: 'TEU - twenty-foot equivalent container units', prefix: false })
  })

  it('splits figure and unit for KpiCard', () => {
    expect(formatParts(72.44, 'pct')).toMatchObject({ value: '72.4', unit: '%' })
    expect(formatParts(5e9, 'kes')).toMatchObject({ value: '5.0B', unit: 'KES', prefix: true })
  })

  it('keeps the old fmt* helpers working on top of it', () => {
    expect(fmtNum(1234.6)).toBe('1,235')
    expect(fmtNum(1234.56, 1)).toBe('1,234.6')
    expect(fmtNum(null)).toBe('-')
    expect(fmtPct(12.345)).toBe('12.3%')
    expect(fmtPct(null)).toBe('-')
    expect(fmtKsh(2.5e9)).toBe('2.5B')
    expect(formatNumber('12.5', 1)).toBe('12.5')
  })
})
