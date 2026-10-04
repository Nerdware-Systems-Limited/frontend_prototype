// tests/unit/thresholds.test.ts
// ─────────────────────────────────────────────────────────────────────
// Shared status thresholds (docs/Widgets.md §5.5): one set of limits decides
// the KPI card colour, the alert severity and the agency-row badge, so
// the three can never disagree about the same figure.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { THRESHOLDS, alertSeverity, statusOf, worstStatus, type ThresholdKey } from '~/utils/thresholds'
import { METRICS_BY_KEY } from '~/utils/metricRegistry'

describe('statusOf', () => {
  it('lower-is-better: breached strictly beyond the limit by default', () => {
    expect(statusOf(5, 'safety.active_incidents')).toBe('neutral')
    expect(statusOf(6, 'safety.active_incidents')).toBe('warning')
    expect(statusOf(10, 'safety.active_incidents')).toBe('warning')
    expect(statusOf(11, 'safety.active_incidents')).toBe('critical')
    expect(statusOf(0, 'fleet.governor_tamper_pct')).toBe('healthy')
  })

  it('higher-is-better: breached below the limit', () => {
    expect(statusOf(80, 'rail.otp_pct')).toBe('healthy')
    expect(statusOf(79.9, 'rail.otp_pct')).toBe('warning')
    expect(statusOf(69.9, 'rail.otp_pct')).toBe('critical')
    expect(statusOf(40, 'infra.budget_absorption_pct')).toBe('warning')
    expect(statusOf(39, 'infra.budget_absorption_pct')).toBe('critical')
  })

  it("'at' thresholds count the limit itself as breached", () => {
    expect(statusOf(4.9, 'maritime.yard_dwell_days')).toBe('healthy')
    expect(statusOf(5, 'maritime.yard_dwell_days')).toBe('warning')
    expect(statusOf(15, 'aviation.avg_delay_min')).toBe('warning')
    expect(statusOf(14, 'aviation.avg_delay_min')).toBe('healthy')
  })

  it('a zero limit means any occurrence is a breach', () => {
    expect(statusOf(0, 'safety.critical_blackspots')).toBe('healthy')
    expect(statusOf(1, 'safety.critical_blackspots')).toBe('warning')
    expect(statusOf(0, 'rail.fatal_incidents_90d')).toBe('healthy')
    expect(statusOf(1, 'rail.fatal_incidents_90d')).toBe('critical')
  })

  it('missing figures are neutral, never green', () => {
    expect(statusOf(null, 'rail.otp_pct')).toBe('neutral')
    expect(statusOf(undefined, 'infra.critical_bridges')).toBe('neutral')
    expect(statusOf(Number.NaN, 'fleet.governor_tamper_pct')).toBe('neutral')
  })

  it('every threshold orders its limits the right way round', () => {
    for (const [key, t] of Object.entries(THRESHOLDS)) {
      if (t.warn == null || t.crit == null) continue
      if (t.better === 'lower') expect(t.crit, key).toBeGreaterThanOrEqual(t.warn)
      else expect(t.crit, key).toBeLessThanOrEqual(t.warn)
    }
  })
})

describe('worstStatus / alertSeverity', () => {
  it('picks the most severe, and only breaches raise alerts', () => {
    expect(worstStatus('neutral', 'warning', 'healthy')).toBe('warning')
    expect(worstStatus('healthy', 'critical')).toBe('critical')
    expect(worstStatus('neutral', 'healthy')).toBe('healthy')
    expect(worstStatus()).toBe('neutral')
    expect(alertSeverity('critical')).toBe('critical')
    expect(alertSeverity('warning')).toBe('warning')
    expect(alertSeverity('healthy')).toBeNull()
    expect(alertSeverity('neutral')).toBeNull()
  })
})

describe('KPI cards follow the shared thresholds', () => {
  const resolve = (key: string, payload: unknown) => METRICS_BY_KEY[key]!.resolve(payload as never)

  it.each<[ThresholdKey, number, string, (v: number) => unknown]>([
    ['rail.otp_pct', 75, 'rail.otp_30d', v => ({ on_time_30d: { total_operations: 10, on_time_pct: v, avg_delay_min: 4 } })],
    ['rail.otp_pct', 65, 'rail.otp_30d', v => ({ on_time_30d: { total_operations: 10, on_time_pct: v, avg_delay_min: 4 } })],
    ['aviation.otp_pct', 79, 'aviation.otp_7d', v => ({ kpis: { flights_total: 50, otp_pct: v } })],
    ['infra.critical_bridges', 11, 'infra.critical_bridges', v => ({ bridges: { critical_count: v, total: 400 } })],
    ['infra.budget_absorption_pct', 30, 'infra.budget_absorption', v => ({ budget: { utilization_pct: v } })],
    ['fleet.governor_tamper_pct', 12, 'fleet.governor_tamper', v => ({ governor_compliance: { tamper_rate_pct: v } })],
  ])('%s at %d', (tKey, value, metricKey, payload) => {
    expect(resolve(metricKey, payload(value)).status).toBe(statusOf(value, tKey))
  })

  it('the incidents card is the worse of incidents and fatalities', () => {
    const card = resolve('safety.active_incidents', { kpis: { active: 3, fatal_30d: 25 } })
    expect(card.status).toBe('critical')
  })

  it('percent KPIs split figure and unit, en-KE', () => {
    const card = resolve('infra.budget_absorption', { budget: { utilization_pct: 61.25 } })
    expect(card).toMatchObject({ value: '61.3', unit: '%', status: 'healthy' })
  })
})
