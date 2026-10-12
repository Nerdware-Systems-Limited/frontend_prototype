/**
 * certificateSources - every certificate or licence the platform tracks an
 * expiry for, as data. Each entry names the page it belongs to (so it is shown
 * only to viewers who can open that page, and links there) and how to fetch
 * the ones that are expired or expiring within a window, from endpoints that
 * already exist. Adding a certificate type = one entry here.
 *
 * Not yet tracked, because the backend has no list to read: vehicle
 * insurance and inspection expiry (only per-vehicle fields), and training
 * certificates (`certificate_expiry` on completions, no expiring endpoint).
 */
import { useAviationLicensing } from '~/composables/api/useAviationLicensing'
import { useDriverLicensing } from '~/composables/api/useDriverLicensing'
import { useMaritimeServices } from '~/composables/api/useMaritimeServices'
import { usePublicTransport } from '~/composables/api/usePublicTransport'
import type { CertificateRecord } from '~/utils/certificateExpiry'

export interface CertificateSource {
  id: string
  label: string
  /** The page these certificates live on: gates visibility and is the "view / renew" target. */
  route: string
  /** Expired plus expiring within `windowDays`. */
  fetch: (windowDays: number) => Promise<CertificateRecord[]>
}

const rows = <T>(r: T[] | { results?: T[] } | null | undefined): T[] => (Array.isArray(r) ? r : r?.results ?? [])
const day = (s: string | null | undefined) => (s ?? '').slice(0, 10)
const humanize = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

export const CERTIFICATE_SOURCES: CertificateSource[] = [
  {
    id: 'psv', label: 'PSV licences', route: '/public-transport/compliance',
    async fetch(windowDays) {
      const pt = usePublicTransport()
      const [soon, expired] = await Promise.all([
        pt.expiringLicenses(windowDays),
        pt.psvLicenses({ status: 'expired', page_size: 100 }),
      ])
      return [...rows(soon as any), ...rows(expired)].map((l: any): CertificateRecord => ({
        key: `psv:${l.id ?? l.license_number}`, source: 'psv', category: 'PSV licence',
        name: l.license_number, owner: l.sacco_name ?? l.sacco__sacco_name ?? l.route_name ?? null,
        expiry: day(l.expiry_date), route: '/public-transport/compliance', sourceExpired: l.status === 'expired',
      }))
    },
  },
  {
    id: 'aviation', label: 'Aviation certificates', route: '/aviation/licensing',
    async fetch(windowDays) {
      const av = useAviationLicensing()
      const [soon, expired] = await Promise.all([av.expiring(windowDays), av.list({ status: 'expired', page_size: 100 })])
      return [...rows(soon), ...rows(expired)].map((l): CertificateRecord => ({
        key: `aviation:${l.id}`, source: 'aviation', category: humanize(l.category),
        name: l.certificate_number,
        owner: l.aircraft_registration ?? l.airline_name ?? l.pilot_name ?? null,
        expiry: day(l.expiry_date), route: '/aviation/licensing', sourceExpired: l.status === 'expired',
      }))
    },
  },
  {
    id: 'maritime', label: 'Maritime licences', route: '/maritime/services',
    async fetch(windowDays) {
      const ms = useMaritimeServices()
      const [soon, expired] = await Promise.all([ms.licencesExpiring(windowDays), ms.licences({ status: 'expired', page_size: 100 })])
      return [...rows(soon), ...rows(expired)].map((l): CertificateRecord => ({
        key: `maritime:${l.id}`, source: 'maritime', category: `${humanize(l.licence_type)} licence`,
        name: l.licence_number, owner: l.vessel_name ?? (l.holder_id || null),
        expiry: day(l.expiry_date), route: '/maritime/services', sourceExpired: l.is_expired || l.status === 'expired',
      }))
    },
  },
  {
    id: 'driver', label: 'Driving licences', route: '/public-transport/driver-licensing',
    async fetch(windowDays) {
      const dl = useDriverLicensing()
      const [soon, expired] = await Promise.all([dl.expiring(windowDays), dl.licences({ status: 'expired', page_size: 100 })])
      return [...rows(soon), ...rows(expired)].map((l): CertificateRecord => ({
        key: `driver:${l.id}`, source: 'driver', category: l.is_psv ? 'PSV driving licence' : 'Driving licence',
        name: l.license_number, owner: l.driver_name ?? null,
        expiry: day(l.expiry_date), route: '/public-transport/driver-licensing', sourceExpired: l.is_expired || l.status === 'expired',
      }))
    },
  },
]

export const CERTIFICATE_SOURCES_BY_ID = Object.fromEntries(CERTIFICATE_SOURCES.map(s => [s.id, s])) as Record<string, CertificateSource>
