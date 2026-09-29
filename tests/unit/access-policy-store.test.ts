// tests/unit/access-policy-store.test.ts
// ─────────────────────────────────────────────────────────────────────
// Module Access policy store: draft/save/discard, who may edit which
// layer, the agency-admin self-lockout guard, and the storage adapter.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

;(globalThis as any).$fetch = vi.fn()

import { useAuthStore } from '~/stores/auth'
import { useAccessPolicyStore, setAccessPolicyStorage, AccessPolicyError } from '~/stores/accessPolicy'
import { ACCESS_POLICY_STORAGE_KEY, localAccessPolicyStorage, parseStoredPolicy } from '~/utils/accessPolicyStorage'
import { editWarning } from '~/utils/accessEdits'
import { EMPTY_OVERRIDES, type PolicyOverrides } from '~/utils/resolveAccess'

function memoryStorage(initial: PolicyOverrides | null = null) {
  let saved = initial
  return {
    saved: () => saved,
    load: vi.fn(async () => saved),
    save: vi.fn(async (o: PolicyOverrides) => { saved = JSON.parse(JSON.stringify(o)) }),
  }
}

function signIn(agency_code: string | null, role_type: string) {
  useAuthStore().user = { id: 'u1', email: 'me@example.com', agency_code, role_type } as any
}

let storage: ReturnType<typeof memoryStorage>
beforeEach(() => {
  setActivePinia(createPinia())
  storage = memoryStorage()
  setAccessPolicyStorage(storage)
})

describe('draft, save, discard', () => {
  it('starts from saved overrides and is clean', async () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    expect(store.loaded).toBe(true)
    expect(store.draft).toEqual(EMPTY_OVERRIDES)
    expect(store.isDirty).toBe(false)
  })

  it('an edit dirties the draft without touching saved overrides; save persists and stamps it', async () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'read' })
    expect(store.isDirty).toBe(true)
    expect(store.dirtyAgencies).toEqual(['KENHA'])
    expect(store.overrides.agencies.KENHA).toBeUndefined()

    await store.save()
    expect(store.isDirty).toBe(false)
    expect(storage.saved()?.agencies.KENHA.ceiling?.modules?.M02).toBe('read')
    expect(storage.saved()?.agencies.KENHA.updatedBy).toBe('me@example.com')
    expect(store.overrides.agencies.KENHA.updatedAt).toBeTruthy()
  })

  it('setting a value back to inherit leaves the draft clean', async () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: '/traffic', value: 'none' })
    store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: '/traffic', value: null })
    expect(store.isDirty).toBe(false)
  })

  it('discard restores the saved state', async () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'none' })
    store.discard()
    expect(store.isDirty).toBe(false)
  })

  it('a failed save keeps the draft and reports it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    signIn(null, 'super_admin')
    storage.save.mockRejectedValueOnce(new Error('QuotaExceededError'))
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'none' })
    await store.save()
    expect(store.saveError).toMatch(/Couldn't save/)
    expect(store.isDirty).toBe(true)
    warn.mockRestore()
  })
})

describe('who may edit what', () => {
  it('an agency admin cannot edit the ceiling', async () => {
    signIn('KENHA', 'admin')
    const store = useAccessPolicyStore()
    expect(() => store.edit('KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'none' })).toThrow(AccessPolicyError)
  })

  it('an agency admin cannot edit another agency', () => {
    signIn('KENHA', 'admin')
    const store = useAccessPolicyStore()
    expect(store.canEditAgency('KURA')).toBe(false)
    expect(() => store.edit('KURA', { kind: 'scope', layer: 'enabled', key: 'M02', value: 'none' })).toThrow(AccessPolicyError)
  })

  it('an agency admin can edit its own enabled layer and roles', () => {
    signIn('kenha', 'admin') // agency_code case must not matter
    const store = useAccessPolicyStore()
    store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: 'M02', value: 'read' })
    store.edit('KENHA', { kind: 'roleScope', tier: 'operator', key: 'M05', value: 'none' })
    expect(store.draft.agencies.KENHA.enabled?.modules?.M02).toBe('read')
    expect(store.draft.agencies.KENHA.roles?.operator?.modules?.M05).toBe('none')
  })

  it('analysts cannot edit anything', () => {
    signIn('KENHA', 'analyst')
    const store = useAccessPolicyStore()
    expect(() => store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: 'M02', value: 'read' })).toThrow(AccessPolicyError)
  })

  it('platform-blocked categories cannot be changed, even by super_admin', () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    expect(() => store.edit('KENHA', { kind: 'category', layer: 'ceiling', category: 'anpr_plate', value: 'allow' })).toThrow(AccessPolicyError)
  })

  it("an agency admin whose SAVED overrides read-cap their own role's /access-policies cannot edit, even though the store's own instance-level check would otherwise allow it", () => {
    signIn('KENHA', 'admin')
    const store = useAccessPolicyStore()
    // Simulate a saved override (not the draft) that caps the admin role's
    // own /access-policies scope at 'read' - the store gate (not just the
    // page's disabled controls) must refuse every edit for this agency now.
    store.overrides = { version: 1, agencies: { KENHA: { roles: { admin: { routes: { '/access-policies': 'read' } } } } } }
    store.draft = { version: 1, agencies: { KENHA: { roles: { admin: { routes: { '/access-policies': 'read' } } } } } }
    expect(store.canEditAgency('KENHA')).toBe(false)
    expect(() => store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: 'M02', value: 'read' })).toThrow(AccessPolicyError)
  })
})

describe('self-lockout guard', () => {
  it('blocks an agency admin from disabling Access Control for their own agency', () => {
    signIn('KENHA', 'admin')
    const store = useAccessPolicyStore()
    expect(() => store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: 'M10', value: 'none' })).toThrow(/your own ability/)
    expect(() => store.edit('KENHA', { kind: 'roleScope', tier: 'admin', key: '/access-policies', value: 'read' })).toThrow(/your own ability/)
    expect(() => store.edit('KENHA', { kind: 'roleCapabilities', tier: 'admin', caps: ['export'] })).toThrow(/your own ability/)
    expect(store.isDirty).toBe(false)
  })

  it('lets super_admin make the same change (the page asks for confirmation first)', () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    store.edit('KENHA', { kind: 'scope', layer: 'enabled', key: 'M10', value: 'none' })
    expect(store.draft.agencies.KENHA.enabled?.modules?.M10).toBe('none')
  })

  it('editWarning explains the consequence for super_admin', () => {
    expect(editWarning(EMPTY_OVERRIDES, 'KENHA', { kind: 'scope', layer: 'ceiling', key: 'M10', value: 'none' })).toMatch(/lose Access Control/)
    expect(editWarning(EMPTY_OVERRIDES, 'KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'read' })).toBeNull()
  })
})

describe('reset and stale overrides', () => {
  const saved: PolicyOverrides = {
    version: 1,
    agencies: {
      KENHA: { ceiling: { modules: { M02: 'read' } }, enabled: { modules: { M05: 'read' } }, roles: { operator: { modules: { M06: 'none' } } } },
      GONE: { ceiling: { modules: { M02: 'none' } } },
    },
  }

  it('an agency admin reset keeps the ceiling; a super_admin reset clears everything', async () => {
    setAccessPolicyStorage(memoryStorage(saved))
    signIn('KENHA', 'admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.resetAgency('KENHA')
    expect(store.draft.agencies.KENHA).toEqual({ ceiling: { modules: { M02: 'read' } } })

    signIn(null, 'super_admin')
    store.resetAgency('KENHA')
    expect(store.draft.agencies.KENHA).toBeUndefined()
  })

  it('lists stale keys and lets super_admin clear them', async () => {
    setAccessPolicyStorage(memoryStorage(saved))
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    expect(store.staleKeys).toContain('GONE')
    store.clearStale()
    expect(store.draft.agencies.GONE).toBeUndefined()
    expect(store.draft.agencies.KENHA.ceiling?.modules?.M02).toBe('read')
  })
})

describe('localStorage adapter', () => {
  it('round-trips a policy', async () => {
    const policy: PolicyOverrides = { version: 1, agencies: { KPA: { enabled: { modules: { M13: 'none' } } } } }
    await localAccessPolicyStorage.save(policy)
    expect(await localAccessPolicyStorage.load()).toEqual(policy)
  })

  it('ignores unknown versions and unreadable payloads', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseStoredPolicy(JSON.stringify({ version: 2, agencies: {} }))).toBeNull()
    expect(parseStoredPolicy('{not json')).toBeNull()
    expect(parseStoredPolicy(null)).toBeNull()
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it("rejects an `agencies` array with its own warning, not the version one", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseStoredPolicy(JSON.stringify({ version: 1, agencies: [] }))).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/malformed shape/)
    expect(warn.mock.calls[0]?.[0]).not.toMatch(/unknown version/)
    warn.mockRestore()
  })

  it('drops agency entries that are not plain objects instead of rejecting the whole payload', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const parsed = parseStoredPolicy(JSON.stringify({
      version: 1,
      agencies: { KENHA: { ceiling: { modules: { M02: 'read' } } }, BAD: 'not-an-object', ALSO_BAD: ['nope'] },
    }))
    expect(parsed?.agencies.KENHA).toEqual({ ceiling: { modules: { M02: 'read' } } })
    expect(parsed?.agencies.BAD).toBeUndefined()
    expect(parsed?.agencies.ALSO_BAD).toBeUndefined()
    warn.mockRestore()
  })

  it('uses the documented key', () => {
    expect(ACCESS_POLICY_STORAGE_KEY).toBe('uapts:access-policy:v1')
  })
})

describe('change history', () => {
  function historyStorage() {
    const base = memoryStorage()
    let log: any[] = []
    return { ...base, loadHistory: vi.fn(async () => log), saveHistory: vi.fn(async (e: any[]) => { log = JSON.parse(JSON.stringify(e)) }), log: () => log }
  }

  it('records one entry per changed agency on save, newest first, and persists it', async () => {
    const s = historyStorage()
    setAccessPolicyStorage(s)
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KRC', { kind: 'scope', layer: 'enabled', key: '/fleet', value: 'none' })
    await store.save()
    store.edit('KRC', { kind: 'scope', layer: 'ceiling', key: 'M08', value: 'read' })
    store.edit('KPA', { kind: 'scope', layer: 'enabled', key: 'M13', value: 'none' })
    await store.save()

    const krc = store.historyFor('KRC')
    expect(krc).toHaveLength(2)
    expect(krc[0]!.changes).toEqual([{ subject: 'Railway', field: 'Agency limit', from: 'Full', to: 'Read' }])
    expect(krc[1]!.changes).toEqual([{ subject: '/fleet', field: 'Agency access', from: 'Read', to: 'None' }])
    expect(krc[0]!.by).toBe('me@example.com')
    expect(store.historyFor('KPA')).toHaveLength(1)
    expect(s.log()).toHaveLength(3)
  })

  it('keeps no history (and never fails) with an adapter that has no history support', async () => {
    signIn(null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KRC', { kind: 'scope', layer: 'enabled', key: '/fleet', value: 'none' })
    await store.save()
    expect(store.saveError).toBeNull()
    expect(store.historyFor('KRC')).toHaveLength(1) // in memory for this session
  })
})
