// tests/unit/certificate-expiry.test.ts
// Classification, ordering and filtering of certificates by days remaining.
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CERT_POLICY, classify, countByStatus, dedupe, filterCertificates, remainingText, sortByUrgency, toView,
  type CertificateRecord,
} from '~/utils/certificateExpiry'

const NOW = new Date('2026-10-12T10:00:00Z')
const rec = (name: string, expiry: string, extra: Partial<CertificateRecord> = {}): CertificateRecord => ({
  key: `s:${name}`, source: 's', category: 'Licence', name, owner: null, expiry, route: '/x', ...extra,
})
const views = (rs: CertificateRecord[]) => rs.map(r => toView(r, DEFAULT_CERT_POLICY, NOW))

describe('classify', () => {
  it.each([
    [-1, 'expired'], [0, 'critical'], [14, 'critical'], [15, 'soon'], [30, 'soon'], [31, 'upcoming'], [90, 'upcoming'], [91, 'valid'],
  ])('%i days left is %s', (d, status) => expect(classify(d as number)).toBe(status))

  it('the source saying expired wins over the date', () => {
    expect(classify(200, DEFAULT_CERT_POLICY, true)).toBe('expired')
  })
  it('thresholds are a policy, not a constant', () => {
    expect(classify(40, { criticalDays: 7, soonDays: 60, upcomingDays: 120 })).toBe('soon')
  })
})

describe('ordering and filters', () => {
  const list = views([
    rec('later', '2026-12-01'),          // 50d  upcoming
    rec('old', '2026-09-01'),            // -41d expired
    rec('imminent', '2026-10-15'),       // 3d   critical
    rec('recent', '2026-10-10'),         // -2d  expired
    rec('month', '2026-11-05'),          // 24d  soon
    rec('fine', '2027-06-01'),           // valid
  ])

  it('puts expired first (longest overdue first), then the soonest to expire', () => {
    expect(sortByUrgency(list).map(c => c.name)).toEqual(['old', 'recent', 'imminent', 'month', 'later', 'fine'])
  })
  it('default view hides valid certificates', () => {
    expect(filterCertificates(list, 'all').map(c => c.name).sort()).toEqual(['imminent', 'later', 'month', 'old', 'recent'])
  })
  it('expired is separate from the short and medium windows', () => {
    expect(filterCertificates(list, 'expired').map(c => c.name).sort()).toEqual(['old', 'recent'])
    expect(filterCertificates(list, 'short').map(c => c.name).sort()).toEqual(['imminent', 'month'])
    expect(filterCertificates(list, 'medium').map(c => c.name)).toEqual(['later'])
  })
  it('counts every status', () => {
    expect(countByStatus(list)).toEqual({ expired: 2, critical: 1, soon: 1, upcoming: 1, valid: 1, total: 6 })
  })
  it('an empty filter result is just an empty list', () => {
    expect(filterCertificates(views([rec('fine', '2030-01-01')]), 'short')).toEqual([])
  })
})

describe('text and dedupe', () => {
  it('words the remaining time', () => {
    expect(remainingText(-1)).toBe('Expired 1 day ago')
    expect(remainingText(-5)).toBe('Expired 5 days ago')
    expect(remainingText(0)).toBe('Expires today')
    expect(remainingText(1)).toBe('1 day left')
    expect(remainingText(12)).toBe('12 days left')
  })
  it('keeps one record per certificate key', () => {
    expect(dedupe([rec('a', '2026-11-01'), rec('a', '2026-11-01'), rec('b', '2026-11-02')])).toHaveLength(2)
  })
})
