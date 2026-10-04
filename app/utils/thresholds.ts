/**
 * Status thresholds - the single source of truth for "is this figure OK?".
 *
 * KPI cards, the alerts rail and agency snapshot rows all call statusOf()
 * against these, so a figure that turns a KPI card critical raises a
 * critical alert and reds the agency row - they can't drift apart.
 *
 * Rules:
 *   - Status comes from the figure crossing a threshold, never from where
 *     the figure sits on the page (DESIGN.md).
 *   - A missing figure is 'neutral', not green.
 *   - `whenOk` says what staying inside the threshold means: 'healthy' for
 *     figures where low/high is good news (tamper rate, budget absorption),
 *     'neutral' for activity levels that are simply normal (incident counts).
 *
 * These live in frontend code for now; docs/Widgets.md §5.5 plans to serve them
 * from the backend so admins can edit them without a deploy.
 */
import type { UnitKey } from '~/utils/units'

export type Status = 'healthy' | 'warning' | 'critical' | 'neutral'

export interface Threshold {
  label: string
  unit: UnitKey
  /** Which direction is better. */
  better: 'lower' | 'higher'
  /** Warning limit; null = this figure only ever goes critical. */
  warn: number | null
  /** Critical limit; null = this figure only ever warns. */
  crit: number | null
  /**
   * 'beyond' (default): breached once the figure is strictly past the limit.
   * 'at': the limit itself already counts as breached.
   */
  breachAt?: 'beyond' | 'at'
  whenOk: 'healthy' | 'neutral'
}

export const THRESHOLDS = {
  // ── Road safety (NTSA IRSMS) ──────────────────────────────────────────
  'safety.active_incidents': { label: 'Active serious incidents', unit: 'count', better: 'lower', warn: 5, crit: 10, whenOk: 'neutral' },
  'safety.fatalities_30d': { label: 'Road fatalities (30 days)', unit: 'count', better: 'lower', warn: 10, crit: 20, whenOk: 'neutral' },
  'safety.critical_blackspots': { label: 'Critical black spots', unit: 'count', better: 'lower', warn: 0, crit: 5, whenOk: 'healthy' },
  'safety.intervention_effectiveness': { label: 'Intervention effectiveness', unit: 'pct', better: 'higher', warn: 60, crit: 45, whenOk: 'healthy' },
  // ── Fleet (NTSA iTIMS) ────────────────────────────────────────────────
  'fleet.governor_tamper_pct': { label: 'Speed governor tamper rate', unit: 'pct', better: 'lower', warn: 5, crit: 10, whenOk: 'healthy' },
  'fleet.tracked_pct': { label: 'Registered fleet live on GPS', unit: 'pct', better: 'higher', warn: 40, crit: 20, whenOk: 'healthy' },
  // ── Rail (KRC) ────────────────────────────────────────────────────────
  'rail.otp_pct': { label: 'Rail on-time performance (30 days)', unit: 'pct', better: 'higher', warn: 80, crit: 70, whenOk: 'healthy' },
  'rail.avg_delay_min': { label: 'Rail average delay', unit: 'min', better: 'lower', warn: 10, crit: null, breachAt: 'at', whenOk: 'healthy' },
  'rail.fatal_incidents_90d': { label: 'Fatal rail incidents (90 days)', unit: 'count', better: 'lower', warn: null, crit: 0, whenOk: 'healthy' },
  // ── Aviation (KAA / KCAA) ─────────────────────────────────────────────
  'aviation.otp_pct': { label: 'Aviation on-time performance (7 days)', unit: 'pct', better: 'higher', warn: 85, crit: 80, whenOk: 'healthy' },
  'aviation.avg_delay_min': { label: 'Flight average delay', unit: 'min', better: 'lower', warn: 15, crit: null, breachAt: 'at', whenOk: 'healthy' },
  // ── Maritime (KPA / KMA) ──────────────────────────────────────────────
  'maritime.yard_dwell_days': { label: 'Average yard dwell', unit: 'days', better: 'lower', warn: 5, crit: null, breachAt: 'at', whenOk: 'healthy' },
  'maritime.incidents_30d': { label: 'Maritime incidents (30 days)', unit: 'count', better: 'lower', warn: 5, crit: null, whenOk: 'healthy' },
  // ── Infrastructure (KeNHA / KURA / KeRRA, BMS, IFMIS) ────────────────
  'infra.good_condition_pct': { label: 'Network in good condition', unit: 'pct', better: 'higher', warn: 60, crit: null, whenOk: 'healthy' },
  'infra.critical_bridges': { label: 'Bridges in critical condition', unit: 'count', better: 'lower', warn: 0, crit: 10, whenOk: 'healthy' },
  'infra.budget_absorption_pct': { label: 'Development budget absorption', unit: 'pct', better: 'higher', warn: 60, crit: 40, whenOk: 'healthy' },
} as const satisfies Record<string, Threshold>

export type ThresholdKey = keyof typeof THRESHOLDS

function breached(v: number, limit: number | null, t: Threshold): boolean {
  if (limit == null) return false
  const at = t.breachAt === 'at'
  return t.better === 'lower' ? (at ? v >= limit : v > limit) : (at ? v <= limit : v < limit)
}

/** The status of one figure against its threshold. Missing figures are neutral. */
export function statusOf(value: number | null | undefined, key: ThresholdKey): Status {
  if (value == null || !Number.isFinite(value)) return 'neutral'
  const t: Threshold = THRESHOLDS[key]
  if (breached(value, t.crit, t)) return 'critical'
  if (breached(value, t.warn, t)) return 'warning'
  return t.whenOk
}

const RANK: Record<Status, number> = { neutral: 0, healthy: 1, warning: 2, critical: 3 }

/**
 * The most severe of several statuses - for a figure judged on more than one
 * threshold (a KPI that is critical if EITHER incidents OR fatalities are).
 * Any OK status loses to a breach; 'healthy' outranks 'neutral' only when
 * nothing is breached.
 */
export function worstStatus(...statuses: Status[]): Status {
  return statuses.reduce<Status>((w, s) => (RANK[s] > RANK[w] ? s : w), 'neutral')
}

/** Alert severity for a status, or null when the figure is within limits. */
export function alertSeverity(status: Status): 'critical' | 'warning' | null {
  return status === 'critical' ? 'critical' : status === 'warning' ? 'warning' : null
}
