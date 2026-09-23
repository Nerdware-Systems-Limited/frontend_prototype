// tests/unit/agency-scope.test.ts
// ─────────────────────────────────────────────────────────────────────
// useAgencyScope() - the account-management scoping rule the user asked
// for: an agency admin manages only their own agency's users;
// super_admin is the only account that sees/manages every tenant.
// access-control.json already documents this intent for M10 (KMA's
// note: "the resolver's agency scope on M10 already confines it") -
// this closes the gap where /users itself never actually enforced it.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  isUnscopedAdmin, scopedAgencyCode, agencyListQueryFor,
  visibleAgencyOptions, canManageUser,
} from '~/composables/useAgencyScope'

const kenhaAdmin  = { role_type: 'admin', agency: 'agency-uuid-kenha', agency_code: 'KENHA' }
const kpaAdmin    = { role_type: 'admin', agency: 'agency-uuid-kpa',   agency_code: 'KPA' }
const superAdmin  = { role_type: 'super_admin', agency: null, agency_code: null }

const agencies = [
  { id: 'a1', agency_code: 'KENHA', agency_name: 'Kenya National Highways Authority' },
  { id: 'a2', agency_code: 'KPA',   agency_name: 'Kenya Ports Authority' },
  { id: 'a3', agency_code: 'NTSA',  agency_name: 'National Transport and Safety Authority' },
]

describe('useAgencyScope', () => {
  it('super_admin is the only unscoped account', () => {
    expect(isUnscopedAdmin(superAdmin)).toBe(true)
    expect(isUnscopedAdmin(kenhaAdmin)).toBe(false)
    expect(isUnscopedAdmin(null)).toBe(false)
  })

  it('scopedAgencyCode returns the viewer\'s own code, null for super_admin or no viewer', () => {
    expect(scopedAgencyCode(kenhaAdmin)).toBe('KENHA')
    expect(scopedAgencyCode(superAdmin)).toBe(null)
    expect(scopedAgencyCode(null)).toBe(null)
  })

  it('agencyListQueryFor adds the agency UUID filter for a scoped admin, nothing for super_admin', () => {
    expect(agencyListQueryFor(kenhaAdmin)).toEqual({ agency: 'agency-uuid-kenha' })
    expect(agencyListQueryFor(superAdmin)).toEqual({})
    expect(agencyListQueryFor(null)).toEqual({})
  })

  it('visibleAgencyOptions narrows the agency list to just the viewer\'s own tenant', () => {
    expect(visibleAgencyOptions(agencies, kpaAdmin)).toEqual([agencies[1]])
    expect(visibleAgencyOptions(agencies, superAdmin)).toEqual(agencies)
  })

  it('canManageUser: a scoped admin may only act on users in their own agency', () => {
    expect(canManageUser(kenhaAdmin, { agency_code: 'KENHA' })).toBe(true)
    expect(canManageUser(kenhaAdmin, { agency_code: 'KPA' })).toBe(false)
    expect(canManageUser(kenhaAdmin, { agency_code: null })).toBe(false)
  })

  it('canManageUser: super_admin may act on any user, including agency-less ones', () => {
    expect(canManageUser(superAdmin, { agency_code: 'KPA' })).toBe(true)
    expect(canManageUser(superAdmin, { agency_code: null })).toBe(true)
  })

  it('canManageUser: no viewer means no permission', () => {
    expect(canManageUser(null, { agency_code: 'KENHA' })).toBe(false)
  })
})
