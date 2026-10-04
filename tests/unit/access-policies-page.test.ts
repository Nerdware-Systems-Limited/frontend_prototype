// tests/unit/access-policies-page.test.ts
// ─────────────────────────────────────────────────────────────────────
// /access-policies: super_admin edits every agency's ceiling; an agency
// admin sees only its own agency, ceiling read-only, enabled capped.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia, type Pinia } from 'pinia'

;(globalThis as any).$fetch = vi.fn()
const userRef = ref<any>(null)
;(globalThis as any).useAuth = () => ({ user: userRef })
;(globalThis as any).onBeforeRouteLeave = () => {}

import { useAccessControl } from '~/composables/useAccessControl'
;(globalThis as any).useAccessControl = useAccessControl

import { useAuthStore } from '~/stores/auth'
import { useAccessPolicyStore } from '~/stores/accessPolicy'
import { BASE_SETTINGS } from '~/utils/resolveAccess'
import Page from '~/pages/access-policies.vue'
import TabStrip from '~/components/TabStrip.vue'
import AccessScopeToggle from '~/components/AccessScopeToggle.vue'
import AccessAgencyTab from '~/components/AccessAgencyTab.vue'
import AccessRolesTab from '~/components/AccessRolesTab.vue'
import AccessCategoriesTab from '~/components/AccessCategoriesTab.vue'
import AccessPreviewPanel from '~/components/AccessPreviewPanel.vue'
import AccessScopeLegend from '~/components/AccessScopeLegend.vue'
import AccessModuleCell from '~/components/AccessModuleCell.vue'
import AccessModuleFilters from '~/components/AccessModuleFilters.vue'
import OverflowMenu from '~/components/OverflowMenu.vue'
import SideDrawer from '~/components/SideDrawer.vue'
import AccessHistoryList from '~/components/AccessHistoryList.vue'
import AccessExportDialog from '~/components/AccessExportDialog.vue'
import SectionTitle from '~/components/SectionTitle.vue'

let pinia: Pinia
function signIn(agency_code: string | null, role_type: string) {
  const u = { id: 'u1', email: 'me@example.com', agency_code, role_type }
  userRef.value = u
  useAuthStore().user = u as any
}

// Each test mounts its own Page instance against a fresh Pinia, but never
// unmounts it. Pinia's useStore()/action wrapper resets the process-wide
// "active pinia" as a side effect (see pinia's wrappedAction), and every
// still-mounted wrapper here shares the same stubbed `useAuth` ref - so a
// later test's signIn() reactively re-evaluates an earlier wrapper's
// canEditEnabled computed (it calls the wrapped action
// store.canEditAgency()) and quietly steals back "active pinia" mid-test.
// Unmounting after each test removes that dangling reactivity so
// useAccessPolicyStore() calls made outside a component (as in this file's
// own assertions) keep resolving to the current test's store.
let wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  wrappers = []
})
afterEach(() => {
  wrappers.forEach(w => w.unmount())
})

function mountPage() {
  const wrapper = mount(Page, {
    global: {
      plugins: [pinia],
      components: {
        TabStrip, AccessScopeToggle, AccessScopeLegend, AccessModuleCell, AccessModuleFilters,
        OverflowMenu, SideDrawer, AccessHistoryList, AccessExportDialog,
        AccessAgencyTab, AccessRolesTab, AccessCategoriesTab, AccessPreviewPanel, SectionTitle,
      },
      // teleport: render drawers inline so their content is inside the wrapper.
      stubs: { PageHeader: true, ConfirmDialog: true, NuxtLink: true, teleport: true },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
const btn = (w: any, testid: string, scope: string) => w.find(`[data-testid="${testid}"] [data-scope="${scope}"]`)

describe('access-policies page - agency access', () => {
  it('super_admin gets the agency picker and editable Allowed controls', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    expect(w.find('#agency-select').exists()).toBe(true)
    expect(w.findAll('#agency-select option')).toHaveLength(Object.keys(BASE_SETTINGS.agencies).length)
    expect(btn(w, 'ceiling-M02', 'full').attributes('disabled')).toBeUndefined()
    // Saved changes now go to the server: no "local preview" disclaimer, and no notice at all for an editor.
    expect(w.text()).not.toContain('Local preview')
    expect(w.text()).not.toContain('in this browser')
    expect(w.find('.notice').exists()).toBe(false)
  })

  it('still tells a viewer who cannot edit that the agency is read-only for them', async () => {
    signIn('KRC', 'admin')
    useAccessPolicyStore().overrides = { version: 1, agencies: { KRC: { roles: { admin: { routes: { '/access-policies': 'read' } } } } } }
    const w = mountPage()
    await flushPromises()
    expect(w.find('.notice').text()).toContain("view this agency's access but not change it")
    expect(w.text()).not.toContain('Local preview')
  })

  it('an agency admin sees only its own agency, Allowed read-only, Enabled capped at Allowed', async () => {
    signIn('KPA', 'admin')
    const w = mountPage()
    await flushPromises()
    expect(w.find('#agency-select').exists()).toBe(false)
    expect(w.find('.agency-name').text()).toContain('Kenya Ports Authority')
    expect(btn(w, 'ceiling-M12', 'none').attributes('disabled')).toBeDefined()
    // KPA's JSON denies M02 entirely (ceiling 'none') - nothing an agency
    // admin could do with it, so unlike M12 it isn't listed for them at all.
    expect(w.find('[data-testid="ceiling-M02"]').exists()).toBe(false)
    expect(btn(w, 'enabled-M12', 'read').attributes('disabled')).toBeUndefined()
  })

  it('an agency admin edit lands in the draft', async () => {
    signIn('KPA', 'admin')
    const w = mountPage()
    await flushPromises()
    await btn(w, 'enabled-M13', 'none').trigger('click')
    const store = useAccessPolicyStore()
    expect(store.draft.agencies.KPA.enabled?.modules?.M13).toBe('none')
    expect(store.isDirty).toBe(true)
  })

  it('super_admin removing Access Control asks for confirmation instead of applying', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    await btn(w, 'ceiling-M10', 'none').trigger('click')
    expect(w.find('confirm-dialog-stub').attributes('open')).toBe('true')
    expect(useAccessPolicyStore().isDirty).toBe(false)
  })

  it('expanding a module shows its pages', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    expect(w.find('[data-testid="ceiling-/traffic/alerts"]').exists()).toBe(false)
    const m02Row = w.findAll('.module-row').find((r: any) => r.find('[data-testid="ceiling-M02"]').exists())!
    await m02Row.find('.module-toggle').trigger('click')
    expect(w.find('[data-testid="ceiling-/traffic/alerts"]').exists()).toBe(true)
  })
})

async function openTab(w: any, label: string) {
  const tabBtn = w.findAll('.tab-strip-tab').find((b: any) => b.text().includes(label))
  await tabBtn.trigger('click')
}

describe('access-policies page - role permissions', () => {
  it('shows a column per role and caps role cells at the agency\'s enabled level', async () => {
    signIn('KENHA', 'admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Role permissions')
    const headers = w.findAll('.role-grid th').map((th: any) => th.text())
    expect(headers).toEqual(expect.arrayContaining(['admin', 'analyst', 'operator']))
    expect(btn(w, 'role-operator-M02', 'full').attributes('disabled')).toBeUndefined()
    // KENHA's JSON denies M04 entirely (ceiling 'none') - an agency admin
    // can't do anything with a module like that, so it isn't even listed.
    expect(w.find('[data-testid="role-operator-M04"]').exists()).toBe(false)
  })

  it('still lists a fully-denied module for super_admin, who can change the ceiling', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Role permissions')
    // super_admin owns the ceiling layer, so M04 being capped at 'none'
    // for KENHA is exactly what they're there to see and change.
    expect(w.find('[data-testid="role-operator-M04"]').exists()).toBe(true)
  })

  it('applies a role limit to the draft', async () => {
    signIn('KENHA', 'admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Role permissions')
    await btn(w, 'role-operator-M02', 'none').trigger('click')
    expect(useAccessPolicyStore().draft.agencies.KENHA.roles?.operator?.modules?.M02).toBe('none')
  })

  it('refuses to let an agency admin remove its own manage_users, and says why', async () => {
    signIn('KENHA', 'admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Role permissions')
    const box = w.find('[data-testid="cap-admin-manage_users"]')
    await box.setValue(false)
    expect(w.find('.error-banner').text()).toContain('your own ability')
    expect((box.element as HTMLInputElement).checked).toBe(true)
    expect(useAccessPolicyStore().isDirty).toBe(false)
  })
})

describe('access-policies page - data categories', () => {
  it('locks platform-blocked categories even for super_admin', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Data categories')
    expect(w.find('[data-testid="cat-ceiling-crash_victim"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="cat-ceiling-cargo_commercial"]').attributes('disabled')).toBeUndefined()
  })

  it('an agency admin cannot enable a category its ceiling denies', async () => {
    signIn('KRC', 'admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Data categories')
    expect(w.find('[data-testid="cat-enabled-cargo_commercial"]').attributes('disabled')).toBeDefined()
  })

  it('an agency admin can mask one of its own categories', async () => {
    signIn('KPA', 'admin')
    const w = mountPage()
    await flushPromises()
    await openTab(w, 'Data categories')
    await w.find('[data-testid="cat-enabled-cargo_commercial"]').setValue(false)
    expect(useAccessPolicyStore().draft.agencies.KPA.enabled?.categories?.cargo_commercial).toBe('deny')
  })
})

async function chooseMenu(w: any, key: string) {
  await w.find('.menu-trigger').trigger('click')
  await w.find(`.menu-item[data-key="${key}"]`).trigger('click')
}

describe('access-policies page - preview', () => {
  it('lists what the chosen role would reach under the draft', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    expect(w.find('.preview-panel').exists()).toBe(false) // not always on screen any more
    await chooseMenu(w, 'preview')
    await w.find('.preview-panel select').setValue('operator')
    const routes = () => w.findAll('.preview-item code').map((c: any) => c.text())
    expect(routes()).toContain('/traffic')
    expect(routes()).not.toContain('/analytics') // minTier analyst

    await btn(w, 'enabled-M02', 'none').trigger('click')
    expect(routes()).not.toContain('/traffic')
  })
})

describe('access-policies page - search and filter', () => {
  const moduleIds = (w: any) => w.findAll('.module-row [data-testid^="ceiling-M"]').map((c: any) => c.attributes('data-testid').replace('ceiling-', ''))

  it('searching "fleet" shows Fleet and Vehicle Tracking with its pages already open', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    await w.find('input[type="search"]').setValue('fleet')
    expect(moduleIds(w)).toEqual(['M03'])
    expect(w.find('[data-testid="ceiling-/fleet/live"]').exists()).toBe(true)
  })

  it('the Access filter keeps only modules with pages at that level, and Clear restores everything', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    const total = moduleIds(w).length
    await w.findAll('.module-filters select')[0]!.setValue('none')
    expect(moduleIds(w)).toContain('M04') // denied to KENHA
    expect(moduleIds(w)).not.toContain('M02')
    await w.find('.module-filters .clear-btn').trigger('click')
    expect(moduleIds(w)).toHaveLength(total)
  })

  it('shows a plain message when nothing matches, and keeps the filter on the Role permissions tab', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    await w.find('input[type="search"]').setValue('no-such-module')
    expect(w.text()).toContain('No modules or pages match these filters.')
    await openTab(w, 'Role permissions')
    expect((w.find('input[type="search"]').element as HTMLInputElement).value).toBe('no-such-module')
    expect(w.find('.role-grid').text()).toContain('No modules or pages match these filters.')
  })
})

describe('access-policies page - overflow menu', () => {
  it('reset asks for confirmation with the agency named, and only resets on confirm', async () => {
    signIn('KRC', 'admin')
    const w = mountPage()
    await flushPromises()
    await btn(w, 'enabled-M13', 'none').trigger('click')
    const store = useAccessPolicyStore()
    expect(store.isDirty).toBe(true)

    await chooseMenu(w, 'reset')
    const dialog = w.find('confirm-dialog-stub')
    expect(dialog.attributes('open')).toBe('true')
    expect(dialog.attributes('title')).toBe('Reset agency permissions?')
    expect(dialog.attributes('message')).toContain("Kenya Railways Corporation's module access")
    expect(dialog.attributes('confirm-label')).toBe('Reset to defaults')
    expect(store.isDirty).toBe(true) // nothing reset yet

    await w.findComponent({ name: 'ConfirmDialog' }).vm.$emit('confirm')
    expect(store.isDirty).toBe(false)
  })

  it('hides reset from viewers who cannot edit', async () => {
    signIn('KRC', 'admin')
    useAccessPolicyStore().overrides = { version: 1, agencies: { KRC: { roles: { admin: { routes: { '/access-policies': 'read' } } } } } }
    const w = mountPage()
    await flushPromises()
    await w.find('.menu-trigger').trigger('click')
    expect(w.find('.menu-item[data-key="reset"]').exists()).toBe(false)
    expect(w.find('.menu-item[data-key="history"]').exists()).toBe(true)
  })

  it('change history opens in a drawer and lists saved changes', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    await chooseMenu(w, 'history')
    expect(w.text()).toContain('No saved changes for this agency yet.')

    await btn(w, 'enabled-M02', 'read').trigger('click')
    await useAccessPolicyStore().save()
    await flushPromises()
    expect(w.find('.history-entry').text()).toContain('Changed Road Traffic')
    expect(w.find('.history-entry').text()).toContain('Agency access')
  })

  it('export opens a format dialog', async () => {
    signIn(null, 'super_admin')
    const w = mountPage()
    await flushPromises()
    await chooseMenu(w, 'export')
    const radios = w.findAll('input[name="export-format"]')
    expect(radios.map((r: any) => (r.element as HTMLInputElement).value)).toEqual(['csv', 'json', 'pdf'])
  })
})
