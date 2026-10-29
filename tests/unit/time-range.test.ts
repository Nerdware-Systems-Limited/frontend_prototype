// tests/unit/time-range.test.ts
// The unified range: preset windows, calendar years, and East Africa Time day
// maths, plus the per-module shared selection (useTimeRange).
import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import {
  EARLIEST_YEAR, clampYear, currentYear, dayDiff, daysUntilEat, eatDate, isIsoDay, periodBadge, presetFromDays, rangeBounds,
  rangeQuery,
} from '~/utils/timeRange'
import { useTimeRange } from '~/composables/useTimeRange'

const NOW = new Date('2026-10-12T10:00:00Z') // 13:00 EAT, 12 Oct 2026

describe('EAT calendar days', () => {
  it('reads the date in East Africa Time, not UTC', () => {
    // 22:30 UTC on the 11th is already 01:30 on the 12th in Nairobi.
    expect(eatDate(new Date('2026-10-11T22:30:00Z'))).toBe('2026-10-12')
    expect(eatDate(new Date('2026-10-11T20:59:00Z'))).toBe('2026-10-11')
  })
  it('counts whole days between dates', () => {
    expect(dayDiff('2026-10-01', '2026-10-12')).toBe(11)
    expect(dayDiff('2026-10-12', '2026-10-01')).toBe(-11)
    expect(dayDiff('2026-02-28', '2026-03-01')).toBe(1)
  })
  it('days until an expiry: 0 today, negative once passed, independent of time of day', () => {
    expect(daysUntilEat('2026-10-12', NOW)).toBe(0)
    expect(daysUntilEat('2026-10-13', NOW)).toBe(1)
    expect(daysUntilEat('2026-10-09T00:00:00Z', NOW)).toBe(-3)
    // just before midnight EAT on the 12th is still the 12th
    expect(daysUntilEat('2026-10-12', new Date('2026-10-12T20:59:00Z'))).toBe(0)
    expect(daysUntilEat('2026-10-12', new Date('2026-10-12T21:01:00Z'))).toBe(-1)
  })
})

describe('rangeBounds', () => {
  it('presets end today and report the length endpoints take', () => {
    expect(rangeBounds({ mode: '24h', year: 2026 }, NOW)).toMatchObject({ days: 1, to: '2026-10-12', from: '2026-10-11', endsToday: true })
    expect(rangeBounds({ mode: '7d', year: 2026 }, NOW)).toMatchObject({ days: 7, from: '2026-10-05' })
    expect(rangeBounds({ mode: '30d', year: 2026 }, NOW)).toMatchObject({ days: 30, from: '2026-09-12' })
  })
  it('a past year is Jan 1 to Dec 31 and does not end today', () => {
    const b = rangeBounds({ mode: 'year', year: 2024 }, NOW)
    expect(b).toMatchObject({ from: '2024-01-01', to: '2024-12-31', days: 366, endsToday: false, label: '2024' })
  })
  it('the current year runs to today, never into the future', () => {
    const b = rangeBounds({ mode: 'year', year: 2026 }, NOW)
    expect(b).toMatchObject({ from: '2026-01-01', to: '2026-10-12', endsToday: true })
    expect(b.days).toBe(285)
  })
  it('clamps the year to the supported span', () => {
    expect(clampYear(1999, NOW)).toBe(EARLIEST_YEAR)
    expect(clampYear(2099, NOW)).toBe(2026)
    expect(currentYear(NOW)).toBe(2026)
  })
  it('badges and window numbers map to presets', () => {
    expect(periodBadge({ mode: '7d', year: 2026 })).toBe('7D')
    expect(periodBadge({ mode: 'year', year: 2025 })).toBe('2025')
    expect(presetFromDays(1)).toBe('24h')
    expect(presetFromDays(7)).toBe('7d')
    expect(presetFromDays(30)).toBe('30d')
    expect(presetFromDays(14)).toBeNull()
  })
})

describe('useTimeRange', () => {
  const store = new Map<string, any>()
  beforeEach(() => {
    store.clear()
    ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
  })

  it('starts at the module default and follows the chosen preset', () => {
    const r = useTimeRange('t1', { default: '30d' })
    expect(r.mode.value).toBe('30d')
    expect(r.days.value).toBe(30)
    r.setMode('24h')
    expect(r.days.value).toBe(1)
    expect(r.period.value).toBe('24H')
  })
  it('shares the selection between pages of one module, not between modules', () => {
    useTimeRange('aviation', { default: '7d' }).setMode('30d')
    expect(useTimeRange('aviation', { default: '7d' }).days.value).toBe(30)
    expect(useTimeRange('railway', { default: '7d' }).days.value).toBe(7)
  })
  it('year view only where the data supports it', () => {
    const noYears = useTimeRange('t2', { default: '7d' })
    noYears.setMode('year')
    expect(noYears.mode.value).toBe('7d')
    const withYears = useTimeRange('t3', { default: '7d', years: true })
    withYears.setYear(2023)
    expect(withYears.isYear.value).toBe(true)
    expect(withYears.from.value).toBe('2023-01-01')
    expect(withYears.to.value).toBe('2023-12-31')
    withYears.stepYear(-1)
    expect(withYears.year.value).toBe(2022)
  })
  it('a page without year support falls back to a preset when the module is in year view', () => {
    useTimeRange('t4', { default: '7d', years: true }).setYear(2022)
    const other = useTimeRange('t4', { default: '30d' })
    expect(other.isYear.value).toBe(false)
    expect(other.days.value).toBe(30)
  })
  it('never steps outside the supported years', () => {
    const r = useTimeRange('t5', { years: true })
    r.setYear(2000)
    expect(r.year.value).toBe(EARLIEST_YEAR)
    r.setYear(3000)
    expect(r.year.value).toBe(currentYear())
  })
})

describe('custom period', () => {
  const sel = (from?: string, to?: string) => ({ mode: 'custom' as const, year: 2026, from, to })

  it('is exactly the days asked for, ends inclusive, and labels itself', () => {
    const b = rangeBounds(sel('2012-03-01', '2012-03-31'), NOW)
    expect(b).toMatchObject({ from: '2012-03-01', to: '2012-03-31', days: 31, endsToday: false })
    expect(b.label).toBe('1 Mar 2012 – 31 Mar 2012')
    expect(rangeBounds(sel('2020-02-29', '2020-02-29'), NOW)).toMatchObject({ days: 1, label: '29 Feb 2020' })
  })
  it('handles decades of history', () => {
    expect(rangeBounds(sel('2006-01-01', '2025-12-31'), NOW).days).toBe(7305)
  })
  it('repairs a reversed, half-filled or future pair instead of sending it on', () => {
    expect(rangeBounds(sel('2012-03-31', '2012-03-01'), NOW)).toMatchObject({ from: '2012-03-01', to: '2012-03-31' })
    expect(rangeBounds(sel('2026-01-01'), NOW)).toMatchObject({ from: '2026-01-01', to: '2026-10-12', endsToday: true })
    expect(rangeBounds(sel('2026-10-01', '2030-01-01'), NOW).to).toBe('2026-10-12')
    expect(rangeBounds(sel('2031-01-01', '2032-01-01'), NOW)).toMatchObject({ from: '2026-10-12', to: '2026-10-12' })
    expect(rangeBounds(sel('not-a-date', '2026-10-05'), NOW).to).toBe('2026-10-05')
  })
  it('rejects impossible calendar days', () => {
    expect(isIsoDay('2012-02-30')).toBe(false)
    expect(isIsoDay('2012-02-29')).toBe(true)
    expect(isIsoDay('12/03/2012')).toBe(false)
  })
  it('badge reads RANGE', () => {
    expect(periodBadge(sel('2012-03-01', '2012-03-31'))).toBe('RANGE')
  })
})

describe('rangeQuery', () => {
  it('presets are a rolling `days`, so 24 Hours really is 24 hours', () => {
    expect(rangeQuery({ mode: '24h', year: 2026 }, NOW)).toEqual({ days: 1 })
    expect(rangeQuery({ mode: '30d', year: 2026 }, NOW)).toEqual({ days: 30 })
  })
  it('a year or custom period is a calendar date_from / date_to', () => {
    expect(rangeQuery({ mode: 'year', year: 2024 }, NOW)).toEqual({ date_from: '2024-01-01', date_to: '2024-12-31' })
    expect(rangeQuery({ mode: 'custom', year: 2026, from: '2012-03-01', to: '2012-03-31' }, NOW))
      .toEqual({ date_from: '2012-03-01', date_to: '2012-03-31' })
  })
})

describe('useTimeRange custom', () => {
  const store = new Map<string, any>()
  beforeEach(() => {
    store.clear()
    ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
  })

  it('only where the data supports it', () => {
    const r = useTimeRange('c1', { default: '7d' })
    r.setCustom('2012-03-01', '2012-03-31')
    r.setMode('custom')
    expect(r.isCustom.value).toBe(false)
    expect(r.days.value).toBe(7)
  })
  it('switching to Custom starts from the period already on screen, then follows the dates', () => {
    const r = useTimeRange('c2', { default: '30d', years: true, custom: true })
    r.setMode('custom')
    expect(r.isCustom.value).toBe(true)
    expect(r.days.value).toBe(30)
    r.setCustom('2012-03-01', '2012-03-31')
    expect(r.query.value).toEqual({ date_from: '2012-03-01', date_to: '2012-03-31' })
    expect(r.period.value).toBe('RANGE')
    r.setMode('7d')
    expect(r.query.value).toEqual({ days: 7 })
  })
  it('a page without custom support falls back to its default when the module is on a custom period', () => {
    useTimeRange('c3', { default: '7d', custom: true }).setCustom('2012-03-01', '2012-03-31')
    const other = useTimeRange('c3', { default: '30d' })
    expect(other.isCustom.value).toBe(false)
    expect(other.query.value).toEqual({ days: 30 })
  })
})
