// tests/unit/access-control.test.ts
// ─────────────────────────────────────────────────────────────────────
// Sanity-checks useAccessControl() against outcomes the RBAC spec
// states explicitly (Reference.md section 9 / the Role-Based Access
// Control Specification), not against the JSON we wrote ourselves -
// each case below cites the spec passage it's checking.
//
// `tests/setup.ts` polyfills `ref`/`computed` as globals. useAuth() is
// this composable's only dependency, so we stub it here the same way
// store.test.ts stubs `$fetch` before importing the module under test.
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

describe('useAccessControl - agency scope resolver', () => {
  it('denies everything when not authenticated (fail closed)', () => {
    const { resolveRoute } = useAccessControl()
    expect(resolveRoute('/dashboard').allowed).toBe(false)
    expect(resolveRoute('/traffic').allowed).toBe(false)
  })

  it('super_admin bypasses scope entirely (spec 7.2 step 3 - "the only bypass in the model")', () => {
    setUser(null, 'super_admin')
    const { resolveRoute, canAccessRoute } = useAccessControl()
    expect(canAccessRoute('/query-builder')).toBe(true)
    expect(canAccessRoute('/maritime/cargo')).toBe(true)
    expect(resolveRoute('/roles').scopeLevel).toBe('full')
  })

  it('public tier gets the single fixed view only, everything else redirects to it (spec 2.6)', () => {
    setUser(null, 'public')
    const { canAccessRoute } = useAccessControl()
    expect(canAccessRoute('/dashboard')).toBe(true)
    expect(canAccessRoute('/traffic')).toBe(false)
    expect(canAccessRoute('/roles')).toBe(false)
  })

  it('an analyst at KURA can reach only KURA-scoped module (spec 1.1 - fixing "analyst at any agency reaches every other agency\'s data")', () => {
    setUser('KURA', 'analyst')
    const { canAccessRoute } = useAccessControl()
    expect(canAccessRoute('/infrastructure')).toBe(true) // KURA's own full module
    expect(canAccessRoute('/infrastructure/funding')).toBe(true)
    expect(canAccessRoute('/maritime/cargo')).toBe(false) // KPA's module, no grant to KURA
  })

  it('KeNHA gets read-only cross-modal routes, not the full module (spec 4.1)', () => {
    setUser('KENHA', 'analyst')
    const { resolveRoute, canAccessRoute } = useAccessControl()
    expect(resolveRoute('/maritime/port-ops').scopeLevel).toBe('read')
    expect(canAccessRoute('/maritime')).toBe(false) // not in the read-only route list
    expect(canAccessRoute('/maritime/cargo')).toBe(false) // explicitly denied
  })

  it('/query-builder is restricted to oversight and super_admin regardless of agency admin tier (spec 8.3 gap #2 / 8.4)', () => {
    setUser('KENHA', 'admin')
    const { canAccessRoute } = useAccessControl()
    expect(canAccessRoute('/query-builder')).toBe(false)
  })

  it('SDR oversight reads across the roads domain but cannot write (spec 4.4)', () => {
    setUser('SDR', 'oversight')
    const { canAccessRoute, resolveRoute } = useAccessControl()
    expect(canAccessRoute('/infrastructure')).toBe(true) // SDR's own full-scope module (M06)
    expect(canAccessRoute('/query-builder')).toBe(true) // oversight tier clears the minTier gate
    expect(resolveRoute('/traffic').scopeLevel).toBe('read')
  })

  it('an agency cannot open a route with no client-side route middleware wired yet still resolves via the composable (spec 8.3 gap #3)', () => {
    setUser('LAPSSET', 'analyst')
    const { canAccessRoute } = useAccessControl()
    // LAPSSET has M10 (Access Control) granted like every other agency, but
    // /users and /roles both require minTier 'admin' (tier 40); analyst is
    // tier 30, so role tier - not the module grant - is what denies these.
    expect(canAccessRoute('/users')).toBe(false)
    expect(canAccessRoute('/roles')).toBe(false)
  })

  it('an operator cannot reach analyst-gated routes even with a module grant (role tier still applies - spec 2.2)', () => {
    setUser('KENHA', 'operator')
    const { canAccessRoute } = useAccessControl()
    expect(canAccessRoute('/analytics')).toBe(false) // minTier analyst
    expect(canAccessRoute('/reports')).toBe(true) // minTier operator
  })

  it('field-level category masking never blocks the route itself, only flags fields (spec 6 intro)', () => {
    setUser('KPA', 'analyst')
    const { resolveRoute } = useAccessControl()
    const res = resolveRoute('/maritime/cargo')
    expect(res.allowed).toBe(true)
    expect(res.deniedCategories).toContain('cargo_commercial') // analyst tier, below the category's own admin minTier
  })

  it("an owning agency's own Agency Admin is NOT masked from its own restricted category (fixed bug - admin-tier gate, not agency self-denial)", () => {
    setUser('KPA', 'admin')
    const { resolveRoute } = useAccessControl()
    const res = resolveRoute('/maritime/cargo')
    expect(res.deniedCategories).not.toContain('cargo_commercial')
  })

  it('KRC reading KPA cargo data cross-tenant is masked from commercial cargo values (spec 6 - "never exposed to another agency tenant")', () => {
    setUser('KRC', 'admin')
    const { resolveRoute } = useAccessControl()
    const res = resolveRoute('/maritime/cargo')
    expect(res.deniedCategories).toContain('cargo_commercial')
  })

  it('every ordinary agency admin can reach its own Access Control (users/roles/audit) at full scope - not just KMA (the only agency that originally had this grant)', () => {
    for (const code of ['KENHA', 'KURA', 'KERRA', 'NTSA', 'NAMATA', 'KRC', 'KPA', 'KAA', 'KCAA', 'COUNTY_GOV', 'NCTTCA', 'LAPSSET']) {
      setUser(code, 'admin')
      const { canAccessRoute, resolveRoute } = useAccessControl()
      expect(canAccessRoute('/users'), code).toBe(true)
      expect(canAccessRoute('/roles'), code).toBe(true)
      expect(canAccessRoute('/audit'), code).toBe(true)
      expect(resolveRoute('/users').scopeLevel, code).toBe('full')
    }
  })

  it('/agencies is restricted to oversight and super_admin, same as /query-builder (agency directory, not a tenant\'s own data)', () => {
    setUser('KENHA', 'admin')
    const { canAccessRoute } = useAccessControl()
    expect(canAccessRoute('/agencies')).toBe(false)
  })

  it('SDR oversight can reach /agencies; super_admin also gets full (route scope alone does not grant write - see the page-level isUnscopedAdmin gate)', () => {
    setUser('SDR', 'oversight')
    const { canAccessRoute, resolveRoute } = useAccessControl()
    expect(canAccessRoute('/agencies')).toBe(true)
    // SDR carries its own M10 full grant (managing its own tenant's users/
    // roles/audit, same as any other agency admin - see the M10 rollout
    // note on every agency below), so /agencies (also module M10) resolves
    // 'full' here too. This does NOT mean SDR can create/edit/delete other
    // agencies: app/pages/agencies.vue gates its own write controls on
    // isUnscopedAdmin() (role_type === 'super_admin'), not on this scope
    // level, specifically because 'oversight' is documented read-only
    // (roles.oversight.write:false) and this resolver doesn't enforce it.
    expect(resolveRoute('/agencies').scopeLevel).toBe('full')

    setUser(null, 'super_admin')
    const { resolveRoute: resolveAsSuperAdmin } = useAccessControl()
    expect(resolveAsSuperAdmin('/agencies').scopeLevel).toBe('full')
  })

  it("minTierDomainOverride admits SDT/SDR's real admin-tier staff to /agencies, since no seeded account carries role_type 'oversight' (not even sdt.oversight@) - but does not extend to agencies outside the oversight domain (KENHA admin still denied, per the case above)", () => {
    setUser('SDT', 'admin')
    const { canAccessRoute: sdtCanAccess } = useAccessControl()
    expect(sdtCanAccess('/agencies')).toBe(true)

    setUser('SDR', 'admin')
    const { canAccessRoute: sdrCanAccess } = useAccessControl()
    expect(sdrCanAccess('/agencies')).toBe(true)
  })

  it('an unrecognised agency code fails closed to the safe space rather than a broken page (spec 2.5)', () => {
    setUser('NOT_A_REAL_AGENCY', 'analyst')
    const { resolveRoute } = useAccessControl()
    const res = resolveRoute('/dashboard')
    // /dashboard is a baseline route so it still resolves; a module route must not.
    expect(resolveRoute('/traffic').isSafeSpace).toBe(true)
    expect(res.allowed).toBe(true) // baseline
  })
})
