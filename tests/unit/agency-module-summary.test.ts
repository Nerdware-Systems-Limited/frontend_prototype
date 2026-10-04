// tests/unit/agency-module-summary.test.ts
// ─────────────────────────────────────────────────────────────────────
// agencyModuleSummary registry completeness: every operational module
// (has a natural single-number KPI) must have an entry, so a new
// module added to access-control.json can't silently fall through
// AgencyCommandCentre with no tile and no decision made about it.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { OPERATIONAL_MODULES, NON_OPERATIONAL_MODULES, agencyModuleSummary } from '~/config/agencyModuleSummary'
import accessControlData from '../fixtures/access-control.json'

describe('agencyModuleSummary registry', () => {
  it('every operational module id has a registry entry', () => {
    for (const id of OPERATIONAL_MODULES) {
      expect(agencyModuleSummary[id], `missing registry entry for ${id}`).toBeDefined()
    }
  })

  it('every registry entry has a label, a fetch function, and 2-3 kpi field getters', () => {
    for (const [id, entry] of Object.entries(agencyModuleSummary)) {
      expect(typeof entry.label, id).toBe('string')
      expect(typeof entry.fetch, id).toBe('function')
      expect(entry.kpis.length, id).toBeGreaterThanOrEqual(2)
      expect(entry.kpis.length, id).toBeLessThanOrEqual(3)
      for (const kpi of entry.kpis) {
        expect(typeof kpi.label, id).toBe('string')
        expect(typeof kpi.get, id).toBe('function')
      }
    }
  })

  it('every operational module id in the registry is a real module in access-control.json', () => {
    const realModuleIds = Object.keys((accessControlData as any).modules)
    for (const id of OPERATIONAL_MODULES) {
      expect(realModuleIds, id).toContain(id)
    }
  })

  it('every module in access-control.json is either operational (has a tile) or explicitly listed as non-operational (quick-links only) - so a new module can never silently fall through with no decision made', () => {
    const realModuleIds = Object.keys((accessControlData as any).modules)
    const accounted = new Set<string>([...OPERATIONAL_MODULES, ...NON_OPERATIONAL_MODULES])
    for (const id of realModuleIds) {
      expect(accounted.has(id), `module ${id} in access-control.json is not classified as operational or non-operational`).toBe(true)
    }
  })
})
