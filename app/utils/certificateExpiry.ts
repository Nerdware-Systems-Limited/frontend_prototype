/**
 * Certificate expiry - turns "expires on <date>" into "how urgent is this".
 * Pure, no Vue. The day maths is in East Africa Time calendar days
 * (`daysUntilEat`), so a certificate expiring on the 14th reads the same
 * to every viewer and never flips a day around midnight UTC.
 *
 * The alert windows are a POLICY, not a constant: nothing in the platform or
 * the agencies' returns defines one, so `DEFAULT_CERT_POLICY` is the
 * starting point and every consumer takes a `policy` it can override.
 *
 *   expired    the date has passed (or the source itself says it is expired)
 *   critical   expires within `criticalDays`
 *   soon       expires within `soonDays`            (the "short-term" filter)
 *   upcoming   expires within `upcomingDays`        (the "medium-term" filter)
 *   valid      further out than that
 */
import { daysUntilEat } from '~/utils/timeRange'

export type CertStatus = 'expired' | 'critical' | 'soon' | 'upcoming' | 'valid'

export interface CertificatePolicy {
  criticalDays: number
  soonDays: number
  upcomingDays: number
}

export const DEFAULT_CERT_POLICY: CertificatePolicy = { criticalDays: 14, soonDays: 30, upcomingDays: 90 }

/** Most urgent first. */
export const STATUS_RANK: Record<CertStatus, number> = { expired: 0, critical: 1, soon: 2, upcoming: 3, valid: 4 }
export const STATUS_LABEL: Record<CertStatus, string> = {
  expired: 'Expired', critical: 'Critical', soon: 'Expiring soon', upcoming: 'Upcoming', valid: 'Valid',
}
/** `.badge` tone for each status. */
export const STATUS_TONE: Record<CertStatus, 'danger' | 'warning' | 'info' | 'success'> = {
  expired: 'danger', critical: 'danger', soon: 'warning', upcoming: 'info', valid: 'success',
}

export interface CertificateRecord {
  /** Unique across sources: `${source}:${id}`. */
  key: string
  source: string
  /** What kind of certificate: "PSV licence", "Certificate of Airworthiness", ... */
  category: string
  /** The certificate's own number or name. */
  name: string
  /** Who or what holds it: a SACCO, an aircraft, a vessel, a driver. */
  owner: string | null
  /** `YYYY-MM-DD`. */
  expiry: string
  /** Where to see it or start a renewal; null when the viewer cannot open that page. */
  route: string | null
  /** The source's own verdict, which wins for "expired" (it may know about a suspension or a late renewal). */
  sourceExpired?: boolean
}

export interface CertificateView extends CertificateRecord {
  /** Whole EAT calendar days until expiry; negative once expired. */
  daysRemaining: number
  status: CertStatus
}

export function classify(daysRemaining: number, policy: CertificatePolicy = DEFAULT_CERT_POLICY, sourceExpired = false): CertStatus {
  if (sourceExpired || daysRemaining < 0) return 'expired'
  if (daysRemaining <= policy.criticalDays) return 'critical'
  if (daysRemaining <= policy.soonDays) return 'soon'
  if (daysRemaining <= policy.upcomingDays) return 'upcoming'
  return 'valid'
}

export function toView(r: CertificateRecord, policy: CertificatePolicy = DEFAULT_CERT_POLICY, now: Date = new Date()): CertificateView {
  const daysRemaining = daysUntilEat(r.expiry, now)
  return { ...r, daysRemaining, status: classify(daysRemaining, policy, r.sourceExpired) }
}

/** Expired first (longest overdue first), then by days remaining ascending; ties by name. */
export function sortByUrgency<T extends CertificateView>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    STATUS_RANK[a.status] - STATUS_RANK[b.status]
    || a.daysRemaining - b.daysRemaining
    || a.name.localeCompare(b.name))
}

export type CertFilter = 'all' | 'expired' | 'short' | 'medium'

/**
 * all      everything that needs attention (expired and any alert window)
 * expired  only the expired
 * short    still valid, expiring within the "soon" window (incl. critical)
 * medium   beyond the short window, within the "upcoming" window
 */
export function filterCertificates(list: CertificateView[], filter: CertFilter, policy: CertificatePolicy = DEFAULT_CERT_POLICY): CertificateView[] {
  switch (filter) {
    case 'expired': return list.filter(c => c.status === 'expired')
    case 'short': return list.filter(c => c.status !== 'expired' && c.daysRemaining <= policy.soonDays)
    case 'medium': return list.filter(c => c.status !== 'expired' && c.daysRemaining > policy.soonDays && c.daysRemaining <= policy.upcomingDays)
    default: return list.filter(c => c.status !== 'valid')
  }
}

export interface CertificateCounts { expired: number; critical: number; soon: number; upcoming: number; valid: number; total: number }

export function countByStatus(list: CertificateView[]): CertificateCounts {
  const c: CertificateCounts = { expired: 0, critical: 0, soon: 0, upcoming: 0, valid: 0, total: list.length }
  for (const r of list) c[r.status]++
  return c
}

/** "Expired 3 days ago", "Expires today", "12 days left". */
export function remainingText(daysRemaining: number): string {
  if (daysRemaining < 0) { const n = -daysRemaining; return `Expired ${n} day${n === 1 ? '' : 's'} ago` }
  if (daysRemaining === 0) return 'Expires today'
  return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
}

/** Keep one record per certificate when two sources report the same one. */
export function dedupe(list: CertificateRecord[]): CertificateRecord[] {
  const seen = new Map<string, CertificateRecord>()
  for (const r of list) if (!seen.has(r.key)) seen.set(r.key, r)
  return [...seen.values()]
}
