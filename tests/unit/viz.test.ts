// tests/unit/viz.test.ts
// ─────────────────────────────────────────────────────────────────────
// Chart math: size classes, zero-based value scales, mark geometry, labels.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { barPath, formatCell, seriesColor, sizeClassFor, sparseTicks, timeLabel, valueScale, linePath } from '~/utils/viz'

describe('viz helpers', () => {
  it('maps widths to size classes', () => {
    expect([200, 239, 240, 399, 400, 639, 640, 1200].map(sizeClassFor)).toEqual(['xs', 'xs', 's', 's', 'm', 'm', 'l', 'l'])
  })

  it('value scales start at zero and end on a nice number', () => {
    const y = valueScale([3, 47, null], [100, 0])
    expect(y.domain()[0]).toBe(0)
    expect(y.domain()[1]).toBe(50)
    expect(valueScale([-5, 10], [100, 0]).domain()[0]).toBeLessThan(0)
    expect(valueScale([null], [100, 0]).domain()).toEqual([0, 1])
  })

  it('series colours follow fixed slots and never cycle past the last', () => {
    expect(seriesColor(0)).toBe('var(--viz-1)')
    expect(seriesColor(5)).toBe('var(--viz-6)')
    expect(seriesColor(9)).toBe('var(--viz-6)')
  })

  it('bars have a rounded data-end and draw nothing at zero height', () => {
    expect(barPath(0, 0, 10, 20)).toMatch(/^M0,20V4Q0,0 4,0H6Q10,0 10,4V20Z$/)
    expect(barPath(0, 0, 10, 0)).toBe('')
  })

  it('lines break at null values instead of dropping to zero', () => {
    const d = linePath([{ x: 0, y: 10 }, { x: 10, y: null }, { x: 20, y: 5 }, { x: 30, y: 6 }])
    expect(d.match(/M/g)).toHaveLength(2)
  })

  it('labels ISO dates and date-times in en-KE / EAT', () => {
    expect(timeLabel('2026-09-30')).toMatch(/^30 Sep/) // 'Sep' or 'Sept' depending on ICU data
    expect(timeLabel('2026-09-30T11:00:00Z')).toBe('14:00')
    expect(timeLabel('2026-09-30T11:00:00Z', true)).toMatch(/^30 Sept?, 14:00$/)
    expect(timeLabel('Q3')).toBe('Q3')
  })

  it('picks sparse ticks including both ends', () => {
    expect(sparseTicks([1, 2, 3, 4, 5, 6, 7, 8, 9], 3)).toEqual([1, 5, 9])
    expect(sparseTicks([1, 2], 4)).toEqual([1, 2])
  })

  it('formats cells by field kind', () => {
    expect(formatCell(2.5e9, { kind: 'measure', unit: 'kes' })).toBe('KES 2.5B')
    expect(formatCell(null, { kind: 'measure', unit: 'pct' })).toBe('-')
    expect(formatCell('', { kind: 'text' })).toBe('-')
  })
})
