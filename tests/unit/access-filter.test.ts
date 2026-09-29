// tests/unit/access-filter.test.ts
// ─────────────────────────────────────────────────────────────────────
// Search + filter for the Module Access tables.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { EMPTY_FILTER, filterModules, isFilterActive, type ModuleFilter } from '~/utils/accessFilter'
import { EMPTY_OVERRIDES, editableModules, type PolicyOverrides } from '~/utils/resolveAccess'

const noCustom = () => false
const f = (patch: Partial<ModuleFilter>): ModuleFilter => ({ ...EMPTY_FILTER, ...patch })
const ids = (r: { moduleId: string }[]) => r.map(m => m.moduleId)

describe('filterModules', () => {
  it('returns every module and all its pages when nothing is filtered', () => {
    const r = filterModules(EMPTY_OVERRIDES, 'KENHA', EMPTY_FILTER, noCustom)
    expect(ids(r)).toEqual(editableModules())
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
  })

  it('"fleet" finds Fleet and Vehicle Tracking with all its child pages', () => {
    const r = filterModules(EMPTY_OVERRIDES, 'KENHA', f({ query: 'fleet' }), noCustom)
    expect(ids(r)).toEqual(['M03'])
    expect(r[0]!.routes).toEqual(expect.arrayContaining(['/fleet', '/fleet/live', '/fleet/geofences']))
  })

  it('matches module ids and case-insensitively', () => {
    expect(ids(filterModules(EMPTY_OVERRIDES, 'KENHA', f({ query: 'm07B' }), noCustom))).toEqual(['M07b'])
  })

  it('a page-path match shows only the matching pages of that module', () => {
    const r = filterModules(EMPTY_OVERRIDES, 'KENHA', f({ query: 'blackspots' }), noCustom)
    expect(ids(r)).toEqual(['M05'])
    expect(r[0]!.routes).toEqual(['/safety/blackspots'])
  })

  it('filters by the enabled access level, page by page', () => {
    // KENHA reads /fleet and /fleet/live only; the rest of M03 is restricted.
    const read = filterModules(EMPTY_OVERRIDES, 'KENHA', f({ access: 'read', query: 'fleet' }), noCustom)
    expect(read[0]!.routes.sort()).toEqual(['/fleet', '/fleet/live'])
    const full = filterModules(EMPTY_OVERRIDES, 'KENHA', f({ access: 'full' }), noCustom)
    expect(ids(full)).toContain('M02')
    expect(ids(full)).not.toContain('M04') // denied to KENHA
    expect(ids(filterModules(EMPTY_OVERRIDES, 'KENHA', f({ access: 'none' }), noCustom))).toContain('M04')
  })

  it('reflects draft overrides in the access level', () => {
    const ov: PolicyOverrides = { version: 1, agencies: { KENHA: { enabled: { modules: { M02: 'read' } } } } }
    expect(ids(filterModules(ov, 'KENHA', f({ access: 'full' }), noCustom))).not.toContain('M02')
    expect(ids(filterModules(ov, 'KENHA', f({ access: 'read' }), noCustom))).toContain('M02')
  })

  it('splits custom from inherited, counting a module-level change for all its pages', () => {
    const custom = (key: string) => key === 'M02' || key === '/safety/kpis'
    const onlyCustom = filterModules(EMPTY_OVERRIDES, 'KENHA', f({ source: 'custom' }), custom)
    expect(ids(onlyCustom)).toEqual(['M02', 'M05'])
    expect(onlyCustom[1]!.routes).toEqual(['/safety/kpis'])
    const onlyInherited = filterModules(EMPTY_OVERRIDES, 'KENHA', f({ source: 'inherited' }), custom)
    expect(ids(onlyInherited)).not.toContain('M02')
    expect(onlyInherited.find(m => m.moduleId === 'M05')!.routes).not.toContain('/safety/kpis')
  })

  it('returns nothing when no page matches', () => {
    expect(filterModules(EMPTY_OVERRIDES, 'KENHA', f({ query: 'zzz' }), noCustom)).toEqual([])
  })
})
