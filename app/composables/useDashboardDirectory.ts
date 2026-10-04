/**
 * Agencies, departments and roles for the Dashboard Manager's audience
 * picker and who-sees-what matrix.
 *
 * Primary source is the backend's GET /dashboards/directory/. That endpoint
 * reads settings.DASHBOARDS_AGENCIES and Django Groups by default, which are
 * empty on a UAPTS backend unless someone configured them, so when it returns
 * no agencies we build the same shape from UAPTS's own accounts API
 * (agencies, departments, role names). Scope values keep the backend's
 * format: agency code, "AGENCY:DEPT" with the department_code, role names.
 *
 * Load errors are exposed, never turned into a silently empty picker.
 */
import { useAgencies, useDepartments, useRoles } from '~/composables/api'
import { useDashboardApi, toDashboardApiError, type DirectoryAgency, type DirectoryRole } from '~/composables/useDashboardApi'

export interface DashboardDirectory {
  agencies: DirectoryAgency[]
  roles: DirectoryRole[]
  /** Where it came from - 'accounts' means the backend directory was empty. */
  source: 'server' | 'accounts'
}

export function useDashboardDirectory() {
  const api = useDashboardApi()
  const { realViewer, canManageDashboards } = useViewerContext()
  const directory = ref<DashboardDirectory | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  async function fromAccounts(): Promise<DashboardDirectory> {
    const [agencies, departments, roles] = await Promise.all([
      useAgencies().list({ page_size: 200 }),
      useDepartments().list({ page_size: 500 }),
      useRoles().list({ page_size: 200 }),
    ])
    const deptsByAgency = new Map<string, { code: string; name: string }[]>()
    for (const d of departments.results) {
      const list = deptsByAgency.get(d.agency) ?? []
      list.push({ code: d.department_code, name: d.department_name })
      deptsByAgency.set(d.agency, list)
    }
    let list: DirectoryAgency[] = agencies.results.map(a => ({
      code: a.agency_code, name: a.agency_name, departments: deptsByAgency.get(a.id) ?? [],
    }))
    // Same narrowing the server applies: agency admins only see their own agency.
    if (!canManageDashboards.value) {
      const own = (realViewer.value?.agencyCode ?? '').toLowerCase()
      list = list.filter(a => a.code.toLowerCase() === own)
    }
    return {
      agencies: list,
      // agency: null means every agency (the 5 built-ins) - a custom role
      // is scoped to its own agency_code, same as the departments above.
      roles: roles.results.map(r => ({ code: r.role_name, name: r.role_name.replace(/_/g, ' '), agency: r.agency_code })),
      source: 'accounts',
    }
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const server = await api.directory()
      directory.value = server.agencies.length ? { ...server, source: 'server' } : await fromAccounts()
    } catch (err) {
      error.value = `Couldn't load agencies and roles: ${toDashboardApiError(err).message}`
      directory.value = null
    } finally {
      loading.value = false
    }
  }

  return { directory, error, loading, load }
}
