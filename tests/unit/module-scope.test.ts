// tests/unit/module-scope.test.ts
// ─────────────────────────────────────────────────────────────────────
// moduleScope() - the best scope (full > read > none) across every
// static route in a module, for AgencyCommandCentre tile styling.
// KENHA/M08 Railway is a case of route-override-only access: the agency
// reaches the module entirely through individual grants.routes overrides
// with no module-level grant, so canAccessModule()'s boolean isn't enough.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'

const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

import { useAccessControl } from '~/composables/useAccessControl'

function setUser(agency_code: string | null, role_type: string) {
  userRef.value = { id: 'u1', email: 'u1@example.com', agency_code, role_type }
}

beforeEach(() => {
  userRef.value = null
})

describe('useAccessControl - moduleScope()', () => {
  it('KENHA has full scope on M06 (module-level grant)', () => {
    setUser('KENHA', 'admin')
    const { moduleScope } = useAccessControl()
    expect(moduleScope('M06')).toBe('full')
  })

  it('KMA has full scope on M07b Maritime via the non-readOnly maritime domain bundle', () => {
    setUser('KMA', 'admin')
    const { moduleScope } = useAccessControl()
    // KMA's "maritime" domain has no readOnly flag, so domainScopeFor() grants
    // module-wide 'full' scope on M07b. Route overrides fine-tune individual routes
    // (downgrading /maritime to 'read', etc.) but don't drive the module result.
    expect(moduleScope('M07b')).toBe('full')
  })

  it('KENHA has only read scope on M08 Railway (single read route override, no module grant)', () => {
    setUser('KENHA', 'admin')
    const { moduleScope } = useAccessControl()
    expect(moduleScope('M08')).toBe('read')
  })

  it('a module with zero accessible routes resolves to none', () => {
    setUser('KENHA', 'admin')
    const { moduleScope } = useAccessControl()
    expect(moduleScope('M14')).toBe('none') // KENHA denies M14 outright
  })

  it('super_admin gets full scope on every module', () => {
    setUser(null, 'super_admin')
    const { moduleScope } = useAccessControl()
    expect(moduleScope('M10')).toBe('full')
    expect(moduleScope('M14')).toBe('full')
  })
})
