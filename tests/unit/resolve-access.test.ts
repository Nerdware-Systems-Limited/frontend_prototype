// ─────────────────────────────────────────────────────────────────────
// The Module Access override layers (spec: docs/superpowers/specs/
// 2026-09-28-module-access-control-design.md). ceiling -> agency enabled
// -> role, each only narrowing the one above. No-override parity with the
// original resolver is covered by access-parity.test.ts.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  EMPTY_OVERRIDES, adminCanManagePolicy, agencyRoleTiers, capabilitiesFor, categoryState,
  moduleSummary, pageScope, partitionStale, resolveFor, type AgencyOverride, type PolicyOverrides,
} from '~/utils/resolveAccess'

const ov = (agencies: Record<string, AgencyOverride>): PolicyOverrides => ({ version: 1, agencies })
const as = (agency_code: string | null, role_type: string) => ({ agency_code, role_type })

describe('resolveFor - ceiling layer (super_admin)', () => {
  it('narrows a module the JSON grants', () => {
    const o = ov({ KENHA: { ceiling: { modules: { M02: 'read' } } } })
    expect(resolveFor(o, as('KENHA', 'analyst'), '/traffic').scopeLevel).toBe('read')
    expect(resolveFor(o, as('KENHA', 'analyst'), '/traffic/alerts').scopeLevel).toBe('read')
  })

  it('can grant a module the JSON never gave, including one the JSON denies', () => {
    const o = ov({ KENHA: { ceiling: { modules: { M08: 'read', M04: 'full' } } } })
    expect(resolveFor(o, as('KENHA', 'analyst'), '/railway').scopeLevel).toBe('read')
    expect(resolveFor(o, as('KENHA', 'analyst'), '/public-transport').scopeLevel).toBe('full')
  })

  it('a page value beats the module value on the same layer', () => {
    const o = ov({ KENHA: { ceiling: { modules: { M02: 'full' }, routes: { '/traffic/alerts': 'none' } } } })
    expect(resolveFor(o, as('KENHA', 'analyst'), '/traffic').allowed).toBe(true)
    expect(resolveFor(o, as('KENHA', 'analyst'), '/traffic/alerts').allowed).toBe(false)
  })
})

describe('resolveFor - agency enabled and role layers', () => {
  it('enabled narrows but can never exceed the ceiling', () => {
    expect(resolveFor(ov({ KENHA: { enabled: { modules: { M02: 'read' } } } }), as('KENHA', 'analyst'), '/traffic').scopeLevel).toBe('read')
    expect(resolveFor(ov({ KENHA: { enabled: { modules: { M08: 'full' } } } }), as('KENHA', 'analyst'), '/railway').allowed).toBe(false)
  })

  it('lowering the ceiling caps a stored higher enabled value', () => {
    const o = ov({ KENHA: { ceiling: { modules: { M02: 'read' } }, enabled: { modules: { M02: 'full' } } } })
    expect(resolveFor(o, as('KENHA', 'analyst'), '/traffic').scopeLevel).toBe('read')
  })

  it('a role limit narrows only that role and can never exceed enabled', () => {
    const o = ov({ KENHA: { roles: { operator: { modules: { M02: 'none' } }, analyst: { modules: { M08: 'full' } } } } })
    expect(resolveFor(o, as('KENHA', 'operator'), '/traffic').allowed).toBe(false)
    expect(resolveFor(o, as('KENHA', 'analyst'), '/traffic').scopeLevel).toBe('full')
    expect(resolveFor(o, as('KENHA', 'analyst'), '/railway').allowed).toBe(false)
  })

  it('route minTier still applies after every layer', () => {
    const o = ov({ KENHA: { roles: { operator: { modules: { M09: 'full' } } } } })
    expect(resolveFor(o, as('KENHA', 'operator'), '/analytics').allowed).toBe(false)
  })

  it('/access-policies is open to agency admins and not to analysts', () => {
    expect(resolveFor(EMPTY_OVERRIDES, as('KENHA', 'admin'), '/access-policies').scopeLevel).toBe('full')
    expect(resolveFor(EMPTY_OVERRIDES, as('KENHA', 'analyst'), '/access-policies').allowed).toBe(false)
  })
})

describe('restricted categories', () => {
  it('platform-blocked categories keep their JSON state and ignore overrides', () => {
    expect(categoryState(EMPTY_OVERRIDES, 'KENHA', 'enabled', 'anpr_plate')).toBe('deny')
    const o = ov({ KENHA: { ceiling: { categories: { anpr_plate: 'allow' } } } })
    expect(categoryState(o, 'KENHA', 'enabled', 'anpr_plate')).toBe('deny')
    // Locked is not forced-deny: the owning tenant keeps today's behaviour.
    expect(categoryState(EMPTY_OVERRIDES, 'NTSA', 'enabled', 'crash_victim')).toBe('allow')
  })

  it('enabled can deny a category the ceiling allows', () => {
    const o = ov({ KPA: { enabled: { categories: { cargo_commercial: 'deny' } } } })
    expect(resolveFor(EMPTY_OVERRIDES, as('KPA', 'admin'), '/maritime/cargo').deniedCategories).not.toContain('cargo_commercial')
    expect(resolveFor(o, as('KPA', 'admin'), '/maritime/cargo').deniedCategories).toContain('cargo_commercial')
  })

  it('enabled cannot allow a category the ceiling denies', () => {
    const o = ov({ KRC: { enabled: { categories: { cargo_commercial: 'allow' } } } })
    expect(resolveFor(o, as('KRC', 'admin'), '/maritime/cargo').deniedCategories).toContain('cargo_commercial')
  })
})

describe('capabilities', () => {
  it('defaults to the global role capabilities', () => {
    expect([...capabilitiesFor(EMPTY_OVERRIDES, as('KENHA', 'analyst'))].sort()).toEqual(['export', 'query_builder', 'run_reports'])
  })

  it('enabled removes a capability from every role', () => {
    const o = ov({ KENHA: { enabled: { capabilities: ['query_builder', 'run_reports', 'manage_users'] } } })
    expect(capabilitiesFor(o, as('KENHA', 'analyst')).has('export')).toBe(false)
  })

  it('a role may gain a capability only if the agency has it enabled', () => {
    const kenha = ov({ KENHA: { roles: { analyst: { capabilities: ['approve_uploads'] } } } })
    expect(capabilitiesFor(kenha, as('KENHA', 'analyst')).has('approve_uploads')).toBe(true)
    // KAA's roleTiers are admin + analyst, so operator-only capabilities are outside its ceiling.
    const kaa = ov({ KAA: { roles: { analyst: { capabilities: ['acknowledge_alerts'] } } } })
    expect(capabilitiesFor(kaa, as('KAA', 'analyst')).has('acknowledge_alerts')).toBe(false)
  })

  it('super_admin holds every capability; no agency holds none', () => {
    expect(capabilitiesFor(EMPTY_OVERRIDES, as(null, 'super_admin')).has('manage_users')).toBe(true)
    expect(capabilitiesFor(EMPTY_OVERRIDES, as(null, 'analyst')).size).toBe(0)
  })
})

describe('fail-closed on bad stored values', () => {
  it('an unrecognised scope string in overrides does not grant access (corrupted storage fails closed, not open)', () => {
    const o = ov({ KENHA: { ceiling: { modules: { M02: 'super_full' as any } } } })
    const res = resolveFor(o, as('KENHA', 'analyst'), '/traffic')
    expect(res.allowed).toBe(false)
    expect(res.scopeLevel).toBe('none')
  })
})

describe('helpers', () => {
  it('agencyRoleTiers always includes admin, most-privileged first', () => {
    expect(agencyRoleTiers('SDR')).toEqual(['oversight', 'admin', 'analyst'])
    expect(agencyRoleTiers('KENHA')).toEqual(['admin', 'analyst', 'operator'])
  })

  it('moduleSummary reports the best page scope and whether pages differ', () => {
    expect(moduleSummary(EMPTY_OVERRIDES, 'KPA', 'ceiling', null, 'M07b')).toEqual({ scope: 'full', mixed: true })
    expect(moduleSummary(EMPTY_OVERRIDES, 'KPA', 'ceiling', null, 'M02')).toEqual({ scope: 'none', mixed: false })
  })

  it('pageScope can ignore a layer\'s own page value (what "Inherit" shows)', () => {
    const o = ov({ KENHA: { ceiling: { routes: { '/traffic/alerts': 'none' } } } })
    expect(pageScope(o, 'KENHA', 'ceiling', null, '/traffic/alerts')).toBe('none')
    expect(pageScope(o, 'KENHA', 'ceiling', null, '/traffic/alerts', { layer: 'ceiling', key: 'route' })).toBe('full')
  })

  it('adminCanManagePolicy detects self-lockout', () => {
    expect(adminCanManagePolicy(EMPTY_OVERRIDES, 'KENHA')).toBe(true)
    expect(adminCanManagePolicy(ov({ KENHA: { enabled: { modules: { M10: 'none' } } } }), 'KENHA')).toBe(false)
    expect(adminCanManagePolicy(ov({ KENHA: { roles: { admin: { capabilities: ['export'] } } } }), 'KENHA')).toBe(false)
  })

  it('partitionStale separates keys that no longer exist in the JSON', () => {
    const o = ov({ NOPE: {}, KENHA: { ceiling: { modules: { M99: 'full', M02: 'read' } } } })
    const { stale, cleaned } = partitionStale(o)
    expect(stale).toEqual(expect.arrayContaining(['NOPE', 'KENHA.ceiling.modules.M99']))
    expect(cleaned.agencies.NOPE).toBeUndefined()
    expect(cleaned.agencies.KENHA.ceiling?.modules).toEqual({ M02: 'read' })
  })
})
