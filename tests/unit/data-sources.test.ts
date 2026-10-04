// tests/unit/data-sources.test.ts
// ─────────────────────────────────────────────────────────────────────
// The source registry reproduces what the widgets did before it existed:
// same honoured filters per domain, same permission strings (these must
// match backend catalog.py), and the agency-code -> UUID translation for
// the infrastructure summary.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { DOMAIN_PERMISSIONS, DOMAIN_SOURCE, SOURCES_BY_ID, filterParams, honouredParams } from '~/utils/dataSources'
import { DOMAIN_FILTERS, METRICS } from '~/utils/metricRegistry'

describe('data source registry', () => {
  it('keeps the permission strings the backend strips widgets by', () => {
    expect(DOMAIN_PERMISSIONS).toEqual({
      safety: 'safety.view', fleet: 'fleet.view', rail: 'railway.view', aviation: 'aviation.view',
      maritime: 'maritime.view', infra: 'infrastructure.view', integrations: 'integrations.view', gis: 'gis.view',
      traffic: 'traffic.view', public_transport: 'public_transport.view', training: 'training.view',
    })
  })

  it('maps every metric domain to a registered summary source with the same permission', () => {
    for (const [domain, id] of Object.entries(DOMAIN_SOURCE)) {
      const s = SOURCES_BY_ID[id]
      expect(s, id).toBeDefined()
      expect(s!.permission).toBe(DOMAIN_PERMISSIONS[domain as keyof typeof DOMAIN_PERMISSIONS])
    }
    for (const m of METRICS) expect(SOURCES_BY_ID[DOMAIN_SOURCE[m.domain as keyof typeof DOMAIN_SOURCE]]).toBeDefined()
  })

  it('honours the same filters the widgets claimed before (only infra reads agency)', () => {
    expect(DOMAIN_FILTERS).toEqual({ safety: [], fleet: [], rail: [], aviation: [], maritime: [], infra: ['agency'] })
    expect(SOURCES_BY_ID['integrations.feeds']!.honours).toEqual(['agency'])
  })

  it('flattens a filter context and keeps only honoured params', () => {
    const all = filterParams({ county: 'Kiambu', agency: ['KeNHA', 'KURA'], date_range: { from: '2026-09-01', to: '2026-09-10' }, road: null })
    expect(all).toEqual({ county: 'Kiambu', agency: 'KeNHA,KURA', date_from: '2026-09-01', date_to: '2026-09-10' })
    expect(honouredParams(['agency'], all)).toEqual({ agency: 'KeNHA,KURA' })
    expect(honouredParams(['date_range'], all)).toEqual({ date_from: '2026-09-01', date_to: '2026-09-10' })
    expect(honouredParams([], all)).toEqual({})
  })

  it('refuses a multi-agency infrastructure filter instead of silently ignoring it', async () => {
    await expect(SOURCES_BY_ID['infra.summary']!.fetch({ agency: 'KeNHA,KURA' }, {}))
      .rejects.toThrow(/one agency at a time/)
  })
})
