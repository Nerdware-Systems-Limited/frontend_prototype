// tests/unit/field-mask.test.ts
// ─────────────────────────────────────────────────────────────────────
// useFieldMask() is the client-side half of RBAC spec section 6: it
// reads useAccessControl().resolveRoute(path).deniedCategories and lets
// a page mask one field's value without blocking the route. Regression
// coverage for the cargo-masking bug: KPA's own admin must see the real
// consignee value, everyone denied the category must not.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'

const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })

import { useFieldMask } from '~/composables/useFieldMask'

function setUser(agency_code: string | null, role_type: string) {
  userRef.value = { id: 'u1', email: 'u1@example.com', agency_code, role_type }
}

beforeEach(() => {
  userRef.value = null
})

describe('useFieldMask - field-level category masking (spec 6)', () => {
  it("KPA's own admin is not masked from cargo_commercial on its own cargo route", () => {
    setUser('KPA', 'admin')
    const { isMasked, mask } = useFieldMask('/maritime/cargo')
    expect(isMasked('cargo_commercial')).toBe(false)
    expect(mask('cargo_commercial', 'Acme Traders Ltd')).toBe('Acme Traders Ltd')
  })

  it("KRC reading KPA's cargo route cross-tenant IS masked from cargo_commercial", () => {
    setUser('KRC', 'admin')
    const { isMasked, mask } = useFieldMask('/maritime/cargo')
    expect(isMasked('cargo_commercial')).toBe(true)
    expect(mask('cargo_commercial', 'Acme Traders Ltd')).toBe('Restricted')
  })

  it('mask() passes through a custom placeholder', () => {
    setUser('KRC', 'admin')
    const { mask } = useFieldMask('/maritime/cargo')
    expect(mask('cargo_commercial', 'Acme Traders Ltd', 'Hidden')).toBe('Hidden')
  })

  it('a category not present on the route is never masked', () => {
    setUser('KRC', 'admin')
    const { isMasked } = useFieldMask('/maritime/cargo')
    expect(isMasked('member_state_data')).toBe(false)
  })

  it('exposes the human-readable label for a category', () => {
    setUser('KPA', 'admin')
    const { categoryLabel } = useFieldMask('/maritime/cargo')
    expect(categoryLabel('cargo_commercial')).toContain('Consignee')
  })
})
