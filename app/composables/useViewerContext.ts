/**
 * The viewer the dashboard resolver and widget gates reason about, built from
 * the signed-in user (useAuth) and UAPTS's agency-scope resolver
 * (useAccessControl). The server builds the same thing in
 * apps/dashboards/viewer.py and is the authority: it resolves and strips
 * dashboards itself. This client copy only drives the editor's previews and
 * which controls are shown.
 *
 *   field           this app                                   server (viewer.py)
 *   userId          user.id (UUID)                             str(user.pk)
 *   agencyCode      user.agency_code                           user.agency(_code)
 *   departmentCode  department_code of user.department (UUID)  user.department(_code)
 *   roles           role_name, role_type                       Groups + user.role
 *   permissions     GET /access-control/viewer/ (server)       the same adapter
 *   isSuperAdmin    role_type === 'super_admin'                user.is_superuser
 *
 * UAPTS users carry no permission strings - access is module grants in the
 * baseline policy plus the role tier - so the server derives the dashboard
 * permission codes (catalog.py DOMAIN_PERMISSIONS) from module access
 * (DASHBOARDS_VIEWER_ADAPTER) and serves them from /access-control/viewer/.
 * The access policy store holds them; this client never recomputes them.
 */
import type { ViewerContext } from '~/types/dashboard'
import { useDepartments } from '~/composables/api'
import { useAccessPolicyStore } from '~/stores/accessPolicy'

/** department UUID -> department_code, shared across components for the session. */
function useDepartmentCode(departmentId: () => string | null | undefined) {
  const codes = useState<Record<string, string | null>>('viewer:department-codes', () => ({}))
  watch(departmentId, async (id) => {
    if (!id || id in codes.value) return
    codes.value = { ...codes.value, [id]: null }
    try {
      const dept = await useDepartments().get(id)
      codes.value = { ...codes.value, [id]: dept.department_code ?? null }
    } catch (err) {
      console.warn('[dashboards] could not load department code', err)
    }
  }, { immediate: true })
  return computed(() => {
    const id = departmentId()
    return id ? codes.value[id] ?? null : null
  })
}

export function useViewerContext() {
  const { user } = useAuth()
  const ac = useAccessControl()
  const policy = useAccessPolicyStore()
  // The editor's "Preview as…" provides a simulated viewer; widgets inside
  // that preview gate on it instead of the signed-in admin.
  const override = getCurrentInstance()
    ? inject<Ref<ViewerContext | null> | null>('dashboard:viewerOverride', null)
    : null

  const departmentCode = useDepartmentCode(() => user.value?.department)

  const realViewer = computed<ViewerContext | null>(() => {
    const u = user.value
    if (!u) return null
    const roles = [u.role_name, u.role_type].filter((r): r is string => !!r)
    return {
      userId: String(u.id),
      agencyCode: ac.agencyCode.value,
      departmentCode: departmentCode.value,
      roles: [...new Set(roles)],
      permissions: policy.permissions,
      isSuperAdmin: ac.isSuperAdmin.value,
    }
  })
  const viewer = computed<ViewerContext | null>(() => override?.value ?? realViewer.value)

  /** Frontend gate only - the backend strips anything the viewer can't see. */
  function can(required: string[] | undefined): boolean {
    const v = viewer.value
    if (!v) return false
    if (v.isSuperAdmin || !required?.length) return true
    return required.some(p => v.permissions.includes(p))
  }

  // Management rights always come from the REAL signed-in user, never the preview.
  const canManageDashboards = computed(() =>
    !!realViewer.value && (realViewer.value.isSuperAdmin || realViewer.value.permissions.includes('dashboards.manage')),
  )
  /** Agency admins manage dashboards owned by their own agency only. */
  const canManageAgencyDashboards = computed(() =>
    !!realViewer.value && realViewer.value.permissions.includes('dashboards.manage_agency'),
  )

  return { viewer, realViewer, can, canManageDashboards, canManageAgencyDashboards }
}
