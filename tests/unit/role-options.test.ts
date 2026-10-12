// tests/unit/role-options.test.ts
// ─────────────────────────────────────────────────────────────────────
// assignableBuiltInRoles(): the built-in roles offered in the create-user
// dropdown come from the backend's role catalog, not a list in code, and
// platform-wide roles are only offered to a super_admin.
//
// The catalog below is the exact shape GET /api/v1/accounts/roles/ returned
// for an agency admin: 8 built-ins (no agency, no base tier).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { assignableBuiltInRoles, customRoleBaseTiers, type CatalogRole } from '~/composables/useAgencyScope'

const builtin = (role_name: string): CatalogRole => ({ role_name, agency: null, base_tier: null })
const CATALOG: CatalogRole[] = [
  'admin', 'analyst', 'auditor', 'ministry_admin', 'ministry_analyst', 'operator', 'public', 'super_admin',
].map(builtin)
const custom: CatalogRole = { role_name: 'Bridge Inspector', agency: 'kenha-uuid', base_tier: 'operator' }

const superAdmin = { role_type: 'super_admin', agency: null, agency_code: null }
const kaaAdmin   = { role_type: 'admin', agency: 'kaa-uuid', agency_code: 'KAA' }

describe('assignableBuiltInRoles', () => {
  it('offers a super_admin every built-in in the catalog, most privileged first', () => {
    expect(assignableBuiltInRoles(superAdmin, CATALOG)).toEqual([
      'super_admin', 'ministry_admin', 'ministry_analyst', 'admin', 'analyst', 'operator', 'auditor', 'public',
    ])
  })

  it('never offers an agency admin a platform-wide role (the API would let them mint one)', () => {
    const offered = assignableBuiltInRoles(kaaAdmin, CATALOG)
    for (const r of ['super_admin', 'ministry_admin', 'ministry_analyst']) expect(offered).not.toContain(r)
    expect(offered).toEqual(['admin', 'analyst', 'operator', 'auditor', 'public'])
  })

  it('reads the options from the catalog: a role added on the server appears, one removed disappears', () => {
    expect(assignableBuiltInRoles(kaaAdmin, [...CATALOG, builtin('inspector')])).toContain('inspector')
    expect(assignableBuiltInRoles(kaaAdmin, CATALOG.filter(r => r.role_name !== 'auditor'))).not.toContain('auditor')
  })

  it('puts roles the code does not know about after the known ones, A-Z', () => {
    const offered = assignableBuiltInRoles(superAdmin, [builtin('zebra'), builtin('admin'), builtin('alpha')])
    expect(offered).toEqual(['admin', 'alpha', 'zebra'])
  })

  it('leaves custom (per-agency) roles to their own dropdown group', () => {
    expect(assignableBuiltInRoles(superAdmin, [...CATALOG, custom])).not.toContain('Bridge Inspector')
  })

  it('keeps an account\'s current role in the list so a locked row still shows it', () => {
    expect(assignableBuiltInRoles(kaaAdmin, CATALOG, 'ministry_admin')).toContain('ministry_admin')
  })

  it('returns nothing - and invents nothing - when the catalog is empty or the viewer is missing', () => {
    expect(assignableBuiltInRoles(kaaAdmin, [])).toEqual([])
    expect(assignableBuiltInRoles(null, CATALOG)).toEqual([])
  })

  it('does not mutate the catalog it is given', () => {
    const copy = structuredClone(CATALOG)
    assignableBuiltInRoles(superAdmin, CATALOG)
    expect(CATALOG).toEqual(copy)
  })
})

describe('customRoleBaseTiers', () => {
  it('offers the catalog built-ins the policy governs, minus super_admin and public, most privileged first', () => {
    const catalog = ['public', 'operator', 'super_admin', 'analyst', 'admin', 'auditor', 'ministry_admin'].map(builtin)
    expect(customRoleBaseTiers(catalog)).toEqual(['admin', 'analyst', 'auditor', 'operator'])
  })

  it('follows the catalog: a built-in that is not there is not offered', () => {
    expect(customRoleBaseTiers(['admin', 'analyst'].map(builtin))).toEqual(['admin', 'analyst'])
  })

  it('never offers a custom role as a base, and returns nothing for an empty catalog', () => {
    expect(customRoleBaseTiers([...CATALOG, custom])).not.toContain('Bridge Inspector')
    expect(customRoleBaseTiers([])).toEqual([])
  })
})
