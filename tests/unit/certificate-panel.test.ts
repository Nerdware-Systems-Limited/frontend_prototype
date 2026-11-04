// tests/unit/certificate-panel.test.ts
// The certificate panel: only sources the viewer may open are fetched, one failing source does not
// blank the rest, the list is urgency-ordered, and the filters/counters reflect the policy.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import type { CertificateRecord } from '~/utils/certificateExpiry'

const today = new Date()
const iso = (offsetDays: number) => new Date(today.getTime() + offsetDays * 86_400_000).toISOString().slice(0, 10)
const rec = (source: string, name: string, offset: number, route = `/${source}`): CertificateRecord => ({
  key: `${source}:${name}`, source, category: 'Licence', name, owner: 'Owner', expiry: iso(offset), route,
})

const fetches: Record<string, ReturnType<typeof vi.fn>> = {
  psv: vi.fn(), aviation: vi.fn(), maritime: vi.fn(), driver: vi.fn(),
}
vi.mock('~/config/certificateSources', () => ({
  CERTIFICATE_SOURCES: ['psv', 'aviation', 'maritime', 'driver'].map(id => ({
    id, label: `${id} certs`, route: `/${id}`, fetch: (days: number) => fetches[id]!(days),
  })),
}))

let allowed = new Set<string>()
;(globalThis as any).useAccessControl = () => ({ canAccessRoute: (r: string) => allowed.has(r) })
;(globalThis as any).useState = (_k: string, init: () => any) => ref(init())

import CertificateExpiryPanel from '~/components/CertificateExpiryPanel.vue'
import CollapsibleSection from '~/components/CollapsibleSection.vue'
import EmptyState from '~/components/EmptyState.vue'
import TablePagination from '~/components/TablePagination.vue'
;(globalThis as any).usePagination = (await import('~/composables/usePagination')).usePagination
;(globalThis as any).useCertificateExpiry = (await import('~/composables/useCertificateExpiry')).useCertificateExpiry

const mountPanel = async (props: Record<string, unknown> = {}) => {
  const w = mount(CertificateExpiryPanel, {
    props,
    global: { components: { CollapsibleSection, EmptyState, TablePagination }, stubs: { NuxtLink: { template: '<a><slot /></a>' }, ArrowRight: true, ChevronDown: true } },
  })
  await flushPromises()
  return w
}
const names = (w: any) => w.findAll('.cert-name').map((n: any) => n.text())

beforeEach(() => {
  Object.values(fetches).forEach(f => f.mockReset().mockResolvedValue([]))
  allowed = new Set(['/psv', '/aviation', '/maritime', '/driver'])
})

describe('CertificateExpiryPanel', () => {
  it('lists expired first, then soonest to expire, never valid ones by default', async () => {
    fetches.psv!.mockResolvedValue([rec('psv', 'P-later', 60), rec('psv', 'P-expired', -5), rec('psv', 'P-soon', 3), rec('psv', 'P-valid', 400)])
    const w = await mountPanel()
    expect(names(w)).toEqual(['P-expired', 'P-soon', 'P-later'])
  })

  it('shows days left prominently and labels the status', async () => {
    fetches.psv!.mockResolvedValue([rec('psv', 'P-1', 3), rec('psv', 'P-2', -2)])
    const w = await mountPanel()
    const text = w.text()
    expect(text).toContain('3 days left')
    expect(text).toContain('Expired 2 days ago')
    expect(text).toContain('Critical')
    expect(text).toContain('Expired')
  })

  it('does not even request sources whose page the viewer cannot open', async () => {
    allowed = new Set(['/psv'])
    await mountPanel()
    expect(fetches.psv).toHaveBeenCalledTimes(1)
    expect(fetches.aviation).not.toHaveBeenCalled()
    expect(fetches.maritime).not.toHaveBeenCalled()
  })

  it('a module overview can restrict the panel to its own sources', async () => {
    await mountPanel({ sources: ['aviation'] })
    expect(fetches.aviation).toHaveBeenCalledTimes(1)
    expect(fetches.psv).not.toHaveBeenCalled()
  })

  it('asks every source for the whole medium-term window', async () => {
    await mountPanel()
    expect(fetches.psv).toHaveBeenCalledWith(90)
  })

  it('one failing source is named and the others still show', async () => {
    fetches.psv!.mockRejectedValue(new Error('down'))
    fetches.aviation!.mockResolvedValue([rec('aviation', 'A-1', 10)])
    const w = await mountPanel()
    expect(w.find('.cert-note').text()).toContain('psv certs')
    expect(names(w)).toEqual(['A-1'])
  })

  it('filters: expired, short-term, medium-term', async () => {
    fetches.psv!.mockResolvedValue([rec('psv', 'E', -1), rec('psv', 'S', 20), rec('psv', 'M', 60)])
    const w = await mountPanel()
    const click = async (label: string) => { await w.findAll('.segmented button').find(b => b.text() === label)!.trigger('click') }
    await click('Expired'); expect(names(w)).toEqual(['E'])
    await click('Short-term'); expect(names(w)).toEqual(['S'])
    await click('Medium-term'); expect(names(w)).toEqual(['M'])
    await click('Needs attention'); expect(names(w)).toEqual(['E', 'S', 'M'])
  })

  it('counters count by status and filter when clicked', async () => {
    fetches.psv!.mockResolvedValue([rec('psv', 'E1', -1), rec('psv', 'E2', -9), rec('psv', 'C', 5), rec('psv', 'S', 20), rec('psv', 'U', 60)])
    const w = await mountPanel()
    const counts = Object.fromEntries(w.findAll('.cert-counter').map(c => [c.find('.cert-counter-l').text(), c.find('.cert-counter-n').text()]))
    expect(counts).toEqual({ Expired: '2', Critical: '1', 'Expiring soon': '1', Upcoming: '1' })
    await w.find('.cert-counter--expired').trigger('click')
    expect(names(w)).toEqual(['E2', 'E1'])
  })

  it('says why it is empty, per filter', async () => {
    const w = await mountPanel()
    expect(w.text()).toMatch(/nothing is expired or expiring within 90 days/i)
    await w.findAll('.segmented button').find(b => b.text() === 'Expired')!.trigger('click')
    expect(w.text()).toMatch(/no expired certificates/i)
  })

  it('says so when the viewer has no certificate sources at all', async () => {
    allowed = new Set()
    const w = await mountPanel()
    expect(w.text()).toMatch(/no certificate sources are available to your role/i)
  })

  it('states the policy windows it is using, and honours a custom policy', async () => {
    fetches.psv!.mockResolvedValue([rec('psv', 'X', 40)])
    const w = await mountPanel({ policy: { criticalDays: 7, soonDays: 60, upcomingDays: 120 } })
    expect(w.find('.cert-policy').text()).toContain('within 7 days')
    expect(w.find('.cert-policy').text()).toContain('within 120')
    expect(w.find('.cert-days').classes()).toContain('cert-days--soon') // 40d is "soon" under this policy
  })
})
