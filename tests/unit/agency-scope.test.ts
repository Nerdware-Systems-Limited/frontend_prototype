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
  visibleAgencyOptions, canManageUser, canChangeRole, assignableRoleTypes, canViewRole,
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

  // ── super_admin role assignment ──────────────────────────────────────

  it('canChangeRole: a non-super_admin cannot grant super_admin to someone else', () => {
    expect(canChangeRole(kenhaAdmin, 'analyst', 'super_admin')).toBe(false)
    expect(canChangeRole(kenhaAdmin, 'admin', 'super_admin')).toBe(false)
  })

  it('canChangeRole: a non-super_admin cannot grant super_admin to themselves', () => {
    expect(canChangeRole(kenhaAdmin, kenhaAdmin.role_type, 'super_admin')).toBe(false)
  })

  it('canChangeRole: a non-super_admin cannot create a super_admin (from = null)', () => {
    expect(canChangeRole(kenhaAdmin, null, 'super_admin')).toBe(false)
    expect(canChangeRole(kenhaAdmin, null, 'analyst')).toBe(true)
  })

  it('canChangeRole: a non-super_admin cannot demote an existing super_admin', () => {
    expect(canChangeRole(kenhaAdmin, 'super_admin', 'admin')).toBe(false)
  })

  it('canChangeRole: a no-op change always passes, so editing other fields on a super_admin row is not blocked by this rule', () => {
    expect(canChangeRole(kenhaAdmin, 'super_admin', 'super_admin')).toBe(true)
  })

  it('canChangeRole: ordinary role changes between non-super_admin roles still work', () => {
    expect(canChangeRole(kenhaAdmin, 'public', 'operator')).toBe(true)
    expect(canChangeRole(kenhaAdmin, 'operator', 'admin')).toBe(true)
  })

  it('canChangeRole: super_admin may grant, create and revoke super_admin', () => {
    expect(canChangeRole(superAdmin, 'admin', 'super_admin')).toBe(true)
    expect(canChangeRole(superAdmin, null, 'super_admin')).toBe(true)
    expect(canChangeRole(superAdmin, 'super_admin', 'admin')).toBe(true)
  })

  it('canChangeRole: no viewer means no permission', () => {
    expect(canChangeRole(null, 'analyst', 'operator')).toBe(false)
    expect(canChangeRole(null, null, 'super_admin')).toBe(false)
  })

  it('assignableRoleTypes: super_admin is offered only to a super_admin', () => {
    expect(assignableRoleTypes(kenhaAdmin)).not.toContain('super_admin')
    expect(assignableRoleTypes(kenhaAdmin, 'analyst')).toEqual(['admin', 'analyst', 'operator', 'public'])
    expect(assignableRoleTypes(superAdmin, 'analyst')).toContain('super_admin')
    expect(assignableRoleTypes(superAdmin)).toHaveLength(5)
  })

  it('assignableRoleTypes: a super_admin row is locked to its own role for a non-super_admin viewer', () => {
    expect(assignableRoleTypes(kenhaAdmin, 'super_admin')).toEqual(['super_admin'])
  })

  it('canViewRole: super_admin is listed only for a super_admin, every other role for everyone', () => {
    expect(canViewRole(kenhaAdmin, 'super_admin')).toBe(false)
    expect(canViewRole(null, 'super_admin')).toBe(false)
    expect(canViewRole(superAdmin, 'super_admin')).toBe(true)
    for (const role of ['admin', 'analyst', 'operator', 'public', 'custom-role']) {
      expect(canViewRole(kenhaAdmin, role)).toBe(true)
    }
  })
})
