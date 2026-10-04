// tests/unit/agency-catalog.test.ts
// ─────────────────────────────────────────────────────────────────────
// An agency's dashboard offers data from exactly the pages that agency can
// open - its own modules plus any cross-agency page it has been granted -
// and every preset binds to a registered source with a known page.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  catalogScopeFor, catalogItemInScope, scopedDefaults, scopedMetricKeys, agencyCardsInScope,
} from '~/utils/agencyCatalog'
import { PRESETS } from '~/utils/widgetPresets'
import { SOURCES, SOURCES_BY_ID } from '~/utils/dataSources'
import { BASE_SETTINGS } from '~/utils/resolveAccess'

const KRC = catalogScopeFor('KRC')!
const p = (id: string) => `preset:${id}`

describe('agency widget catalog', () => {
  it('national dashboards and unknown agencies get the full catalog', () => {
    expect(catalogScopeFor(null)).toBeNull()
    expect(catalogScopeFor('NOPE')).toBeNull()
    expect(catalogItemInScope(p('traffic.volume_24h'), null)).toBe(true)
  })

  it('matches agency codes case-insensitively', () => {
    expect(catalogScopeFor('KeNHA')!.routes.has('/traffic')).toBe(true)
  })

  it('KRC sees its own rail and training data', () => {
    expect(catalogItemInScope(p('rail.live_operations'), KRC)).toBe(true)
    expect(catalogItemInScope(p('training.enrollments'), KRC)).toBe(true)
    expect(catalogItemInScope(p('training.cohorts'), KRC)).toBe(true)
  })

  it('KRC also sees pages it was granted read access to (fleet, port ops, cargo)', () => {
    expect(catalogItemInScope(p('fleet.trips_7d'), KRC)).toBe(true)
    expect(catalogItemInScope(p('maritime.ports'), KRC)).toBe(true)
    expect(catalogItemInScope(p('maritime.cargo_by_port'), KRC)).toBe(true)
  })

  it('KRC does not see data from pages it cannot open', () => {
    for (const id of ['traffic.volume_24h', 'safety.by_severity', 'pt.leaderboard', 'infra.condition', 'aviation.flights_7d']) {
      expect(catalogItemInScope(p(id), KRC), id).toBe(false)
    }
    expect(catalogItemInScope('fatality-bars', KRC)).toBe(false)
    expect(catalogItemInScope('risk-map', KRC)).toBe(false)
    expect(catalogItemInScope('national-command-centre', KRC)).toBe(false)
  })

  it('keeps general widgets and narrows KPI defaults to visible metrics', () => {
    expect(catalogItemInScope('text', KRC)).toBe(true)
    expect(catalogItemInScope('alerts', KRC)).toBe(true)
    const keys = scopedMetricKeys(KRC)
    expect(keys).toContain('rail.otp_30d')
    expect(keys).not.toContain('safety.active_incidents')
    expect(scopedDefaults('kpi', { metricKey: 'safety.active_incidents' }, KRC).metricKey).toBe(keys[0])
    const row = scopedDefaults('kpi-row', { metricKeys: ['safety.active_incidents', 'rail.otp_30d'] }, KRC)
    expect(row.metricKeys).toEqual(['rail.otp_30d'])
  })

  it('agency snapshot defaults to the owner agency', () => {
    expect(agencyCardsInScope(KRC)).toContain('KRC')
    expect(scopedDefaults('agency-card', { agency: 'NTSA' }, KRC).agency).toBe('KRC')
  })

  it('oversight agencies may embed the national Command Centre', () => {
    expect(catalogItemInScope('national-command-centre', catalogScopeFor('SDT'))).toBe(true)
  })
})

describe('preset sources', () => {
  it('every preset binds to a registered source', () => {
    for (const pr of PRESETS) expect(SOURCES_BY_ID[pr.binding.source], pr.id).toBeDefined()
  })

  it('every source names a real page in its own module', () => {
    for (const s of SOURCES) {
      if (s.module === 'M16') continue // predictive model, no module page of its own
      expect(BASE_SETTINGS.modules[s.module]?.routes, s.id).toContain(s.route)
    }
  })

  it('there are widgets for railway and training institutes', () => {
    const modules = new Set(PRESETS.map(pr => SOURCES_BY_ID[pr.binding.source]!.module))
    for (const m of ['M02', 'M03', 'M04', 'M05', 'M06', 'M07a', 'M07b', 'M08', 'M14']) expect(modules.has(m), m).toBe(true)
  })
})

describe('hand-built widgets', () => {
  it('an agency with no data pages gets none of the data widgets', async () => {
    const { WIDGETS } = await import('~/utils/widgetRegistry')
    // KMD reaches only Reporting and Access Control - a data widget offered to it
    // means its sources aren't declared in agencyCatalog.ts.
    const KMD = catalogScopeFor('KMD')!
    for (const w of WIDGETS.filter(w => w.palette !== false && w.requiredPermissions?.length)) {
      expect(catalogItemInScope(w.type, KMD), w.type).toBe(false)
    }
    for (const pr of PRESETS) expect(catalogItemInScope(p(pr.id), KMD), pr.id).toBe(false)
  })
})
