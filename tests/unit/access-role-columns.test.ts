// tests/unit/access-role-columns.test.ts
// ─────────────────────────────────────────────────────────────────────
// The Module Access "Role permissions" columns follow the backend's role
// catalog, not only the policy file's per-agency `roleTiers`.
//
// Why: a role real accounts hold (operator at SDR / NCTTCA / LAPSSET) had no
// column when the policy omitted it, so nobody could see or limit it. And
// the catalog also holds roles the resolver ranks as `public` (auditor,
// ministry_*), which Module Access cannot govern - those get a note instead.
//
// The catalog below is what GET /api/v1/accounts/roles/ returned.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

;(globalThis as any).$fetch = vi.fn()

import { useAuthStore } from '~/stores/auth'
import { useAccessPolicyStore, setAccessPolicyStorage } from '~/stores/accessPolicy'
import { agencyRoleColumns, agencyRoleTiers, resolveFor, ungovernedBuiltInRoles, type PolicyOverrides } from '~/utils/resolveAccess'
import { buildPermissionExport } from '~/utils/accessExport'
import { EMPTY_OVERRIDES } from '~/utils/resolveAccess'

const CATALOG_BUILTINS = ['admin', 'analyst', 'auditor', 'ministry_admin', 'ministry_analyst', 'operator', 'public', 'super_admin']

describe('agencyRoleColumns', () => {
  it('gives an agency whose policy omits operator an Operator column (SDR, NCTTCA, LAPSSET hold operators)', () => {
    expect(agencyRoleTiers('NCTTCA')).not.toContain('operator')
    expect(agencyRoleColumns('NCTTCA', CATALOG_BUILTINS)).toEqual(['admin', 'analyst', 'auditor', 'operator'])
    expect(agencyRoleColumns('LAPSSET', CATALOG_BUILTINS)).toContain('operator')
  })

  it('does not show a role that does not exist: oversight is in the policy but is not a role', () => {
    expect(agencyRoleTiers('SDR')).toContain('oversight')
    expect(agencyRoleTiers('SDT')).toContain('oversight')
    expect(agencyRoleColumns('SDR', CATALOG_BUILTINS)).toEqual(['admin', 'analyst', 'auditor', 'operator'])
    expect(agencyRoleColumns('SDT', CATALOG_BUILTINS)).toEqual(['admin', 'analyst', 'auditor', 'operator'])
  })

  it('follows the catalog: a policy tier with no matching role disappears, one that exists appears', () => {
    expect(agencyRoleColumns('KENHA', ['admin', 'analyst'])).toEqual(['admin', 'analyst'])
    expect(agencyRoleColumns('KAA', ['admin', 'operator'])).toEqual(['admin', 'operator'])
  })

  it('never offers super_admin or public, nor a role the resolver ranks as public (the ministry roles)', () => {
    const cols = agencyRoleColumns('KENHA', CATALOG_BUILTINS)
    for (const r of ['super_admin', 'public', 'ministry_admin', 'ministry_analyst']) expect(cols).not.toContain(r)
  })

  it('treats the auditor like any other role: it has a column, ranked between analyst and operator', () => {
    const cols = agencyRoleColumns('KENHA', CATALOG_BUILTINS)
    expect(cols).toContain('auditor')
    expect(cols.indexOf('auditor')).toBeGreaterThan(cols.indexOf('analyst'))
    expect(cols.indexOf('auditor')).toBeLessThan(cols.indexOf('operator'))
  })

  it('falls back to the policy\'s own list only when the catalog is empty or could not be loaded', () => {
    expect(agencyRoleColumns('SDR')).toEqual(agencyRoleTiers('SDR'))
    expect(agencyRoleColumns('KAA', [])).toEqual(agencyRoleTiers('KAA'))
  })

  it('lists each role once, most privileged first, whatever order the catalog arrives in', () => {
    expect(agencyRoleColumns('KAA', ['operator', 'analyst', 'admin', 'operator'])).toEqual(['admin', 'analyst', 'operator'])
  })

  it('ignores a catalog role the policy has never heard of', () => {
    expect(agencyRoleColumns('KAA', [...CATALOG_BUILTINS, 'inspector'])).not.toContain('inspector')
  })
})

describe('ungovernedBuiltInRoles', () => {
  it('names the catalog roles Module Access cannot govern (the auditor is no longer one of them)', () => {
    expect(ungovernedBuiltInRoles(CATALOG_BUILTINS)).toEqual(['ministry_admin', 'ministry_analyst'])
  })

  it('is empty when every catalog role is governed, or the catalog is empty', () => {
    expect(ungovernedBuiltInRoles(['admin', 'analyst', 'operator', 'public', 'super_admin'])).toEqual([])
    expect(ungovernedBuiltInRoles([])).toEqual([])
  })

  it('does not repeat a role', () => {
    expect(ungovernedBuiltInRoles(['ministry_admin', 'ministry_admin'])).toEqual(['ministry_admin'])
  })
})

describe('permission export', () => {
  it('has a column per role the screen shows', () => {
    const data = buildPermissionExport(EMPTY_OVERRIDES, 'NCTTCA', false, CATALOG_BUILTINS)
    expect(data.roles).toEqual(['admin', 'analyst', 'auditor', 'operator'])
    expect(Object.keys(data.pages[0]!)).toContain('auditor')
  })

  it('is unchanged when no catalog is given', () => {
    expect(buildPermissionExport(EMPTY_OVERRIDES, 'NCTTCA', false).roles).toEqual(agencyRoleTiers('NCTTCA'))
  })
})

describe('policy store keeps the catalog built-ins', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setAccessPolicyStorage({ load: vi.fn(async () => null), save: vi.fn(async () => {}) })
    ;(globalThis as any).$api = async () => ({
      count: 10, results: [
        ...CATALOG_BUILTINS.map(role_name => ({ id: role_name, role_name, agency: null, agency_code: null, base_tier: null })),
        { id: 'c1', role_name: 'Bridge Inspector', agency: 'kenha-uuid', agency_code: 'KENHA', base_tier: 'operator' },
      ],
    })
    useAuthStore().user = { id: 'u1', email: 'me@example.com', agency_code: null, role_type: 'super_admin' } as any
  })

  it('load() records built-in roles only (custom roles stay in their own list)', async () => {
    const store = useAccessPolicyStore()
    await store.load()
    expect([...store.builtInRoles].sort()).toEqual([...CATALOG_BUILTINS].sort())
    expect(store.builtInRoles).not.toContain('Bridge Inspector')
  })

  it('reset() forgets them so one account\'s catalog never lingers for the next', async () => {
    const store = useAccessPolicyStore()
    await store.load()
    store.reset()
    expect(store.builtInRoles).toEqual([])
  })
})

describe('Role permissions tab', () => {
  async function mountTab(code: string, builtInRoles: string[] | undefined) {
    const { mount, flushPromises } = await import('@vue/test-utils')
    const AccessRolesTab = (await import('~/components/AccessRolesTab.vue')).default
    const stubs = { AccessScopeLegend: true, AccessScopeToggle: true, AccessModuleCell: true }
    const w = mount(AccessRolesTab, {
      props: { code, overrides: EMPTY_OVERRIDES, canEditCeiling: false, canEditEnabled: true, ...(builtInRoles ? { builtInRoles } : {}) },
      global: { stubs },
    })
    await flushPromises()
    return w
  }
  const headings = (w: Awaited<ReturnType<typeof mountTab>>) =>
    w.findAll('table.role-grid thead th').map(th => th.text().trim()).filter(Boolean)

  beforeEach(() => { ;(globalThis as any).$api = async () => ({ count: 0, results: [] }) })

  it('shows an Operator column at an agency whose policy omits it, and says what it does not govern', async () => {
    const w = await mountTab('NCTTCA', CATALOG_BUILTINS)
    expect(headings(w)).toEqual(expect.arrayContaining(['admin', 'analyst', 'operator', 'auditor']))
    expect(w.text()).toContain('ministry admin, ministry analyst are not governed here')
    expect(w.text()).not.toContain('auditor, ministry')
  })

  it('shows only the policy columns, and no note, when the catalog is not available', async () => {
    const w = await mountTab('NCTTCA', undefined)
    expect(headings(w)).toEqual(expect.arrayContaining(['admin', 'analyst']))
    expect(headings(w)).not.toContain('operator')
    expect(w.text()).not.toContain('not governed here')
  })
})

describe('the auditor as a governed role', () => {
  const as = (agency_code: string, role_type: string) => ({ agency_code, role_type }) as any
  const open = (agency: string, role: string, path: string, ov: PolicyOverrides = EMPTY_OVERRIDES) =>
    resolveFor(ov, as(agency, role), path).allowed

  it('lets an auditor open the Audit page, which it could not before (the page needs the admin tier)', () => {
    for (const agency of ['KENHA', 'KAA', 'SDT']) expect(open(agency, 'auditor', '/audit')).toBe(true)
  })

  it('reaches operator-level pages like any role of that rank (it used to reach none)', () => {
    for (const path of ['/traffic', '/fleet', '/safety', '/reports']) expect(open('KENHA', 'auditor', path), path).toBe(true)
  })

  it('is held to its tier for the pages above it: analyst-only, oversight-only and admin pages', () => {
    for (const path of ['/analytics', '/query-builder', '/users', '/roles', '/access-policies', '/admin/dashboards']) {
      expect(open('KENHA', 'auditor', path), path).toBe(false)
    }
  })

  it('does not widen /audit to other roles of similar rank', () => {
    expect(open('KENHA', 'operator', '/audit')).toBe(false)
    expect(open('KENHA', 'analyst', '/audit')).toBe(false)
    expect(open('KENHA', 'admin', '/audit')).toBe(true)
  })

  it('leaves the baseline pages open to the auditor', () => {
    expect(open('KENHA', 'auditor', '/dashboard')).toBe(true)
    expect(open('KENHA', 'auditor', '/profile')).toBe(true)
  })

  it('lets Module Access limit the auditor like any role - that role, that agency only', () => {
    const limit: PolicyOverrides = { version: 1, agencies: { KENHA: { roles: { auditor: { modules: { M02: 'none' }, routes: { '/audit': 'none' } } } } } } as any
    expect(open('KENHA', 'auditor', '/audit', limit)).toBe(false)
    expect(open('KENHA', 'auditor', '/traffic', limit)).toBe(false)
    expect(open('KENHA', 'admin', '/audit', limit)).toBe(true)
    expect(open('KENHA', 'analyst', '/traffic', limit)).toBe(true)
    expect(open('KAA', 'auditor', '/audit', limit)).toBe(true)
  })

  it('respects an agency ceiling that removes the Access Control module', () => {
    const cap: PolicyOverrides = { version: 1, agencies: { KENHA: { ceiling: { modules: { M10: 'none', M02: 'none' } } } } } as any
    expect(open('KENHA', 'auditor', '/audit', cap)).toBe(false)
    expect(open('KENHA', 'auditor', '/traffic', cap)).toBe(false)
  })
})
