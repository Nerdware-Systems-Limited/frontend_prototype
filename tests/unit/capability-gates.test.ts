// tests/unit/capability-gates.test.ts
// ─────────────────────────────────────────────────────────────────────
// usePermissions() combines the role-tier gate with the Module Access
// capability: export, query builder and user management need BOTH.
// With no overrides saved the baseline capabilities must reproduce exactly
// what the tier-only gates allowed before capabilities were wired in.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

;(globalThis as any).$fetch = vi.fn()
const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

import { useAccessControl } from '~/composables/useAccessControl'
;(globalThis as any).useAccessControl = useAccessControl

import { usePermissions } from '~/composables/usePermissions'
import { useAccessPolicyStore } from '~/stores/accessPolicy'
import type { AgencyOverride } from '~/utils/resolveAccess'

function as(agency_code: string | null, role_type: string) {
  userRef.value = { id: 'u', email: 'u@example.com', agency_code, role_type }
}
function save(agencies: Record<string, AgencyOverride>) {
  useAccessPolicyStore().overrides = { version: 1, agencies }
}

beforeEach(() => {
  setActivePinia(createPinia())
  userRef.value = null
})

describe('with no overrides saved, the gates match the tier-only behaviour they replace', () => {
  it('export: analyst and above, nobody below', () => {
    for (const [agency, role, expected] of [
      [null, 'super_admin', true], ['KENHA', 'admin', true], ['KENHA', 'analyst', true],
      ['KENHA', 'operator', false], ['KENHA', 'public', false],
    ] as const) {
      as(agency, role)
      const p = usePermissions()
      expect(p.canExport.value, role).toBe(expected)
      expect(p.canExport.value, `${role} matches the old tier rule`).toBe(p.hasMinRole('analyst'))
    }
  })

  it('user management: admin and super_admin only', () => {
    for (const [agency, role, expected] of [
      [null, 'super_admin', true], ['KENHA', 'admin', true], ['KENHA', 'analyst', false], ['KENHA', 'operator', false],
    ] as const) {
      as(agency, role)
      expect(usePermissions().canManageUsers.value, role).toBe(expected)
    }
  })

  it('query builder: the roles that hold the capability today', () => {
    for (const [agency, role, expected] of [
      [null, 'super_admin', true], ['SDR', 'oversight', true], ['KENHA', 'admin', true],
      ['KENHA', 'analyst', true], ['KENHA', 'operator', false],
    ] as const) {
      as(agency, role)
      expect(usePermissions().canUseQueryBuilder.value, role).toBe(expected)
    }
  })

  it('an account the baseline does not know holds no capabilities (it reaches no module route either)', () => {
    as(null, 'admin')
    const p = usePermissions()
    expect(p.canExport.value).toBe(false)
    expect(p.canManageUsers.value).toBe(false)
  })
})

describe('with Module Access overrides saved', () => {
  it("switching export off for a role removes it from that role only", () => {
    save({ KENHA: { roles: { analyst: { capabilities: ['run_reports'] } } } })
    as('KENHA', 'analyst')
    expect(usePermissions().canExport.value).toBe(false)
    as('KENHA', 'admin')
    expect(usePermissions().canExport.value).toBe(true)
  })

  it('switching export off for the whole agency removes it from every role', () => {
    save({ KENHA: { enabled: { capabilities: ['manage_users', 'query_builder', 'run_reports'] } } })
    for (const role of ['admin', 'analyst']) {
      as('KENHA', role)
      expect(usePermissions().canExport.value, role).toBe(false)
    }
  })

  it('the tier gate still applies: granting a capability does not lift a role over its tier', () => {
    save({ KENHA: { roles: { operator: { capabilities: ['export', 'acknowledge_alerts'] } } } })
    as('KENHA', 'operator')
    const p = usePermissions()
    expect(p.hasCapability('export')).toBe(true)
    expect(p.canExport.value).toBe(false) // operator is below analyst
  })

  it('manage_users and query_builder follow the saved role capabilities', () => {
    save({ KENHA: { roles: { admin: { capabilities: ['export', 'run_reports'] } } } })
    as('KENHA', 'admin')
    const p = usePermissions()
    expect(p.canManageUsers.value).toBe(false)
    expect(p.canUseQueryBuilder.value).toBe(false)
    expect(p.canExport.value).toBe(true)
  })

  it('super_admin holds every capability whatever is saved', () => {
    save({ KENHA: { enabled: { capabilities: [] } } })
    as(null, 'super_admin')
    const p = usePermissions()
    expect(p.canExport.value).toBe(true)
    expect(p.canManageUsers.value).toBe(true)
    expect(p.canUseQueryBuilder.value).toBe(true)
  })

  it('is reactive: a policy that loads after the page mounts changes the gate', () => {
    as('KENHA', 'analyst')
    const p = usePermissions()
    expect(p.canExport.value).toBe(true)
    save({ KENHA: { roles: { analyst: { capabilities: [] } } } })
    expect(p.canExport.value).toBe(false)
  })
})
