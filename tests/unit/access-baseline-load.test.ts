// The baseline policy and the viewer's dashboard permissions come from the server.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import baseline from '../fixtures/access-control.json'
import { createApiAccessPolicyStorage, type PolicyApiFetch } from '~/utils/accessPolicyStorage'
import { BASE_SETTINGS, setBaseSettings, matchRouteKey, CAPABILITIES, type AccessSettings } from '~/utils/resolveAccess'
import { useAccessPolicyStore, setAccessPolicyStorage } from '~/stores/accessPolicy'
import { localAccessPolicyStorage } from '~/utils/accessPolicyStorage'

const FIXTURE = baseline as unknown as AccessSettings
const api = (routes: Record<string, unknown>): PolicyApiFetch =>
  (async (path: string) => {
    if (!(path in routes)) throw new Error(`unexpected ${path}`)
    return routes[path]
  }) as PolicyApiFetch

afterEach(() => {
  setBaseSettings(FIXTURE)
  setAccessPolicyStorage(localAccessPolicyStorage)
})

describe('api storage', () => {
  it('reads the baseline and the permission codes', async () => {
    const s = createApiAccessPolicyStorage(() => api({
      '/api/v1/access-control/baseline/': FIXTURE,
      '/api/v1/access-control/viewer/': { permissions: ['safety.view', 7, 'training.view'] },
    }))
    expect((await s.loadBaseline!())?.modules).toBeTruthy()
    expect(await s.loadPermissions!()).toEqual(['safety.view', 'training.view'])
  })

  it('refuses a baseline of the wrong shape', async () => {
    const s = createApiAccessPolicyStorage(() => api({ '/api/v1/access-control/baseline/': { nope: true } }))
    expect(await s.loadBaseline!()).toBeNull()
  })
})

describe('resolveAccess baseline holder', () => {
  it('fails closed with no baseline and rebuilds its tables when one is set', () => {
    setBaseSettings(null)
    expect(Object.keys(BASE_SETTINGS.agencies)).toEqual([])
    expect(matchRouteKey('/integrations/files/abc')).toBeUndefined()
    expect(CAPABILITIES).toEqual([])
    setBaseSettings(FIXTURE)
    expect(matchRouteKey('/integrations/files/abc')).toBe('/integrations/files/[id]')
    expect(matchRouteKey('/admin/dashboards/some-id')).toBe('/admin/dashboards/[id]')
    expect(CAPABILITIES.length).toBeGreaterThan(0)
  })
})

describe('policy store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('loads the baseline and permissions before the overrides, and refreshes permissions after a save', async () => {
    setBaseSettings(null)
    let perms = ['safety.view']
    setAccessPolicyStorage({
      ...localAccessPolicyStorage,
      loadBaseline: async () => FIXTURE,
      loadPermissions: async () => perms,
      save: async o => o,
    })
    const store = useAccessPolicyStore()
    await store.load()
    expect(Object.keys(BASE_SETTINGS.agencies).length).toBeGreaterThan(0)
    expect(store.permissions).toEqual(['safety.view'])
    perms = ['safety.view', 'traffic.view']
    await store.refreshPermissions()
    expect(store.permissions).toEqual(['safety.view', 'traffic.view'])
  })

  it('stays closed when the baseline cannot be fetched', async () => {
    setBaseSettings(null)
    setAccessPolicyStorage({ ...localAccessPolicyStorage, loadBaseline: async () => { throw new Error('down') } })
    await useAccessPolicyStore().load()
    expect(Object.keys(BASE_SETTINGS.agencies)).toEqual([])
  })
})
