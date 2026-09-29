import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

;(globalThis as any).$fetch = vi.fn()
const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

import { useAccessControl } from '~/composables/useAccessControl'
import { useAccessPolicyStore } from '~/stores/accessPolicy'

beforeEach(() => {
  setActivePinia(createPinia())
  userRef.value = { id: 'u', email: 'u@example.com', agency_code: 'KENHA', role_type: 'analyst' }
})

describe('useAccessControl + saved Module Access overrides', () => {
  it('a saved override changes what the resolver allows', () => {
    const store = useAccessPolicyStore()
    const access = useAccessControl()
    expect(access.canAccessRoute('/traffic')).toBe(true)
    store.overrides = { version: 1, agencies: { KENHA: { enabled: { modules: { M02: 'none' } } } } }
    expect(access.canAccessRoute('/traffic')).toBe(false)
  })

  it('an unsaved draft does not', () => {
    const store = useAccessPolicyStore()
    const access = useAccessControl()
    store.draft = { version: 1, agencies: { KENHA: { enabled: { modules: { M02: 'none' } } } } }
    expect(access.canAccessRoute('/traffic')).toBe(true)
  })

  it('hasCapability follows saved role overrides', () => {
    const store = useAccessPolicyStore()
    const access = useAccessControl()
    expect(access.hasCapability('export')).toBe(true)
    store.overrides = { version: 1, agencies: { KENHA: { roles: { analyst: { capabilities: ['run_reports'] } } } } }
    expect(access.hasCapability('export')).toBe(false)
  })
})
