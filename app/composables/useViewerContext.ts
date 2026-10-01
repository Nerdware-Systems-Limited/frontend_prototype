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
 *   permissions     VIEWER_PERMISSION_RULES below              user.get_all_permissions()
 *   isSuperAdmin    role_type === 'super_admin'                user.is_superuser
 *
 * UAPTS users carry no permission strings - access is module grants in
 * access-control.json plus the role tier - so the dashboard permission codes
 * (identical to catalog.py / DOMAIN_PERMISSIONS) are derived from module access.
 * The backend must derive them the same way (DASHBOARDS_VIEWER_ADAPTER);
 * see docs/dashboard-manager-integration.md.
 */
import type { ViewerContext } from '~/types/dashboard'
import { useDepartments } from '~/composables/api'
import { DOMAIN_PERMISSIONS } from '~/utils/widgetRegistry'

type AccessControl = ReturnType<typeof useAccessControl>

/** Dashboard permission code -> how a UAPTS viewer earns it. */
export const VIEWER_PERMISSION_RULES: Record<string, (ac: AccessControl) => boolean> = {
  [DOMAIN_PERMISSIONS.safety]: ac => ac.canAccessModule('M05'),
  [DOMAIN_PERMISSIONS.fleet]: ac => ac.canAccessModule('M03'),
  [DOMAIN_PERMISSIONS.rail]: ac => ac.canAccessModule('M08'),
  [DOMAIN_PERMISSIONS.aviation]: ac => ac.canAccessModule('M07a'),
  [DOMAIN_PERMISSIONS.maritime]: ac => ac.canAccessModule('M07b'),
  [DOMAIN_PERMISSIONS.infra]: ac => ac.canAccessModule('M06'),
  [DOMAIN_PERMISSIONS.integrations]: ac => ac.canAccessModule('M12'),
  [DOMAIN_PERMISSIONS.gis]: ac => ac.canAccessModule('M13'),
  // The National Command Centre embed: ministry oversight agencies (SDT, SDR) and super admins.
  'dashboard.national.view': ac => ac.isSuperAdmin.value || !!ac.agency.value?.domains.includes('oversight'),
  // National dashboard administrators.
  'dashboards.manage': ac => ac.isSuperAdmin.value,
  // Agency admins manage their own agency's dashboards (same people who manage its users).
  'dashboards.manage_agency': ac => ac.roleTier.value === 'admin' && !!ac.agencyCode.value && ac.canAccessRoute('/users'),
}

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
      permissions: Object.entries(VIEWER_PERMISSION_RULES).filter(([, earns]) => earns(ac)).map(([code]) => code),
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
