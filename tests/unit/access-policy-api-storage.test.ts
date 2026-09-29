// tests/unit/access-policy-api-storage.test.ts
// ─────────────────────────────────────────────────────────────────────
// The accounts-API adapter for Module Access overrides
// (GET/PUT /api/v1/access-control/, GET .../history/), and the store's
// behaviour when the backend is the source of truth.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

;(globalThis as any).$fetch = vi.fn()

import { useAuthStore } from '~/stores/auth'
import { useAccessPolicyStore, setAccessPolicyStorage } from '~/stores/accessPolicy'
import {
  AccessPolicyStorageError, createApiAccessPolicyStorage, localAccessPolicyStorage,
  ACCESS_POLICY_API_PATH, ACCESS_POLICY_HISTORY_API_PATH, type AccessPolicyStorage,
} from '~/utils/accessPolicyStorage'
import type { HistoryEntry } from '~/utils/accessHistory'
import type { PolicyOverrides } from '~/utils/resolveAccess'

const doc = (agencies: PolicyOverrides['agencies'] = {}): PolicyOverrides => ({ version: 1, agencies })
const httpError = (status: number, data?: unknown) => Object.assign(new Error(`HTTP ${status}`), { status, data })
const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'e1', at: '2026-09-28T10:00:00Z', by: 'root@uapts.test', agency: 'KENHA',
  changes: [{ subject: 'Road Traffic', field: 'Agency limit', from: 'Full', to: 'Read' }], ...over,
})

describe('api adapter', () => {
  let api: ReturnType<typeof vi.fn>
  beforeEach(() => { api = vi.fn() })
  const adapter = (canViewHistory = () => true) => createApiAccessPolicyStorage(() => api as any, canViewHistory)

  it('says the backend records history, and offers no client-side history writer', () => {
    const a = adapter()
    expect(a.recordsHistory).toBe(true)
    expect(a.saveHistory).toBeUndefined()
  })

  it('loads the policy with a GET and normalises it', async () => {
    api.mockResolvedValue(doc({ KENHA: { ceiling: { modules: { M02: 'read' } }, updatedBy: 'root@uapts.test' } }))
    const loaded = await adapter().load()
    expect(api).toHaveBeenCalledWith(ACCESS_POLICY_API_PATH)
    expect(loaded?.agencies.KENHA?.ceiling?.modules?.M02).toBe('read')
  })

  it('ignores a response of the wrong version or shape, with a warning, rather than trusting it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    api.mockResolvedValueOnce({ version: 2, agencies: {} })
    expect(await adapter().load()).toBeNull()
    api.mockResolvedValueOnce({ version: 1, agencies: [] })
    expect(await adapter().load()).toBeNull()
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('lets a failed load reject (the store falls back to the baseline)', async () => {
    api.mockRejectedValue(httpError(500))
    await expect(adapter().load()).rejects.toThrow('HTTP 500')
  })

  it('saves with a PUT and returns the document the server stored', async () => {
    const stored = doc({ KENHA: { ceiling: { modules: { M02: 'read' } }, updatedBy: 'root@uapts.test', updatedAt: '2026-09-28T10:00:00Z' } })
    api.mockResolvedValue(stored)
    const sent = doc({ KENHA: { ceiling: { modules: { M02: 'read' } } } })
    const result = await adapter().save(sent)
    expect(api).toHaveBeenCalledWith(ACCESS_POLICY_API_PATH, { method: 'PUT', body: sent })
    expect(result).toEqual(stored)
  })

  it("surfaces the server's own refusal, with the offending fields", async () => {
    api.mockRejectedValue(httpError(403, { detail: 'Only super admin can change what an agency is allowed.', code: 'ceiling_super_admin_only', errors: [] }))
    await expect(adapter().save(doc())).rejects.toMatchObject({
      name: 'AccessPolicyStorageError', status: 403, message: 'Only super admin can change what an agency is allowed.',
    })

    api.mockRejectedValue(httpError(400, {
      detail: 'The submitted policy refers to things that do not exist.', code: 'unknown_keys',
      errors: [{ field: 'KENHA.ceiling.modules.M99' }, { field: 'NOPE' }],
    }))
    await expect(adapter().save(doc())).rejects.toThrow('The submitted policy refers to things that do not exist. (KENHA.ceiling.modules.M99, NOPE)')
  })

  it('gives network failures and server errors a generic, non-technical message', async () => {
    for (const err of [new Error('Failed to fetch'), httpError(500, { detail: 'Traceback ...' }), httpError(502)]) {
      api.mockRejectedValueOnce(err)
      const thrown = await adapter().save(doc()).catch(e => e)
      expect(thrown).toBeInstanceOf(AccessPolicyStorageError)
      expect(thrown.message).toMatch(/^Couldn't save access settings/)
      expect(thrown.message).not.toContain('Traceback')
    }
  })

  it('loads history newest-first entries, dropping malformed ones', async () => {
    api.mockResolvedValue([entry(), { nope: true }])
    expect(await adapter().loadHistory!()).toEqual([entry()])
    expect(api).toHaveBeenCalledWith(ACCESS_POLICY_HISTORY_API_PATH)
  })

  it('does not even ask for history when the viewer cannot read it, and treats a 403 as empty', async () => {
    expect(await adapter(() => false).loadHistory!()).toEqual([])
    expect(api).not.toHaveBeenCalled()
    api.mockRejectedValue(httpError(403, { detail: "You can't view access policy history." }))
    expect(await adapter().loadHistory!()).toEqual([])
    api.mockRejectedValue(httpError(500))
    await expect(adapter().loadHistory!()).rejects.toThrow('HTTP 500')
  })
})

describe('store with a backend that stamps the document and records history', () => {
  function signIn(id: string, agency_code: string | null, role_type: string) {
    useAuthStore().user = { id, email: `${id}@example.com`, agency_code, role_type } as any
  }

  /** A fake server: PUT stamps and returns; history is whatever the server has logged. */
  function fakeServer(initial: PolicyOverrides = doc()) {
    let stored = initial
    let log: HistoryEntry[] = []
    const storage: AccessPolicyStorage & Record<string, any> = {
      recordsHistory: true,
      load: vi.fn(async () => JSON.parse(JSON.stringify(stored))),
      save: vi.fn(async (o: PolicyOverrides) => {
        const next = JSON.parse(JSON.stringify(o)) as PolicyOverrides
        for (const a of Object.values(next.agencies)) { a.updatedBy = 'server-stamp@uapts.test'; a.updatedAt = '2026-09-28T12:00:00Z' }
        stored = next
        log = [entry({ by: 'server-stamp@uapts.test' }), ...log]
        return JSON.parse(JSON.stringify(next))
      }),
      loadHistory: vi.fn(async () => log),
      saveHistory: vi.fn(async () => {}),
    }
    return { storage, log: () => log }
  }

  beforeEach(() => { setActivePinia(createPinia()) })

  it("adopts the server's stored document (its stamps, not the client's)", async () => {
    const { storage } = fakeServer()
    setAccessPolicyStorage(storage)
    signIn('root', null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'read' })
    await store.save()
    expect(store.overrides.agencies.KENHA?.updatedBy).toBe('server-stamp@uapts.test')
    expect(store.draft.agencies.KENHA?.updatedBy).toBe('server-stamp@uapts.test')
    expect(store.isDirty).toBe(false)
  })

  it('reads history back from the server after a save instead of writing its own', async () => {
    const { storage } = fakeServer()
    setAccessPolicyStorage(storage)
    signIn('root', null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'read' })
    await store.save()
    expect(storage.saveHistory).not.toHaveBeenCalled()
    expect(storage.loadHistory).toHaveBeenCalledTimes(2) // once on load, once after the save
    expect(store.historyFor('KENHA')).toHaveLength(1)
    expect(store.historyFor('KENHA')[0]!.by).toBe('server-stamp@uapts.test')
  })

  it("shows the server's message when a save is refused, and keeps the draft", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { storage } = fakeServer()
    storage.save = vi.fn(async () => { throw new AccessPolicyStorageError("That change would remove your own ability to manage your agency's access.", 403) })
    setAccessPolicyStorage(storage)
    signIn('root', null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'read' })
    await store.save()
    expect(store.saveError).toBe("That change would remove your own ability to manage your agency's access.")
    expect(store.saveError).not.toContain('browser')
    expect(store.isDirty).toBe(true)
    warn.mockRestore()
  })

  it('a non-storage error still gets the local-storage message (unchanged behaviour)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { storage } = fakeServer()
    storage.save = vi.fn(async () => { throw new Error('QuotaExceededError') })
    setAccessPolicyStorage(storage)
    signIn('root', null, 'super_admin')
    const store = useAccessPolicyStore()
    await store.load()
    store.edit('KENHA', { kind: 'scope', layer: 'ceiling', key: 'M02', value: 'none' })
    await store.save()
    expect(store.saveError).toMatch(/Couldn't save in this browser/)
    warn.mockRestore()
  })
})

describe('ensureLoaded - once per signed-in account', () => {
  function signIn(id: string, agency_code: string | null, role_type: string) {
    useAuthStore().user = { id, email: `${id}@example.com`, agency_code, role_type } as any
  }
  const serverFor = (byUser: Record<string, PolicyOverrides>) => ({
    load: vi.fn(async () => JSON.parse(JSON.stringify(byUser[useAuthStore().user!.id] ?? doc()))),
    save: vi.fn(async () => {}),
  })
  beforeEach(() => { setActivePinia(createPinia()) })

  it('loads on the first call and not again for the same account', async () => {
    const s = serverFor({ a: doc({ KENHA: { enabled: { modules: { M02: 'none' } } } }) })
    setAccessPolicyStorage(s)
    signIn('a', 'KENHA', 'analyst')
    const store = useAccessPolicyStore()
    await store.ensureLoaded()
    await store.ensureLoaded()
    expect(s.load).toHaveBeenCalledTimes(1)
    expect(store.overrides.agencies.KENHA?.enabled?.modules?.M02).toBe('none')
  })

  it("never lets one account's policy linger for the next", async () => {
    const s = serverFor({ a: doc({ KENHA: { enabled: { modules: { M02: 'none' } } } }), b: doc() })
    setAccessPolicyStorage(s)
    signIn('a', 'KENHA', 'analyst')
    const store = useAccessPolicyStore()
    await store.ensureLoaded()
    signIn('b', 'KURA', 'analyst')
    await store.ensureLoaded()
    expect(s.load).toHaveBeenCalledTimes(2)
    expect(store.overrides.agencies.KENHA).toBeUndefined()
  })

  it('reset() forgets everything, so signing back in reloads', async () => {
    const s = serverFor({ a: doc({ KENHA: { enabled: { modules: { M02: 'none' } } } }) })
    setAccessPolicyStorage(s)
    signIn('a', 'KENHA', 'analyst')
    const store = useAccessPolicyStore()
    await store.ensureLoaded()
    store.reset()
    expect(store.loaded).toBe(false)
    expect(store.overrides.agencies).toEqual({})
    await store.ensureLoaded()
    expect(s.load).toHaveBeenCalledTimes(2)
  })

  it('a failing load does not throw and is not retried on every navigation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = { load: vi.fn(async () => { throw new Error('offline') }), save: vi.fn(async () => {}) }
    setAccessPolicyStorage(s)
    signIn('a', 'KENHA', 'analyst')
    const store = useAccessPolicyStore()
    await expect(store.ensureLoaded()).resolves.toBeUndefined()
    await store.ensureLoaded()
    expect(s.load).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

// The store is a module singleton; leave the default adapter as later files expect it.
import { afterAll } from 'vitest'
afterAll(() => setAccessPolicyStorage(localAccessPolicyStorage))
