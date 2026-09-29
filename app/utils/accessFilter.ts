/**
 * Search + filter for the Module Access tables (Agency access, Role permissions).
 *
 * Pure: the tables pass in how to tell whether a module/page was changed on
 * their own layer(s) (`isCustom`), everything else comes from the resolver.
 * Access is judged at the agency's Enabled level - what the agency actually
 * has - on each page, so a module whose pages differ ("Mixed") still matches
 * any level one of its pages has.
 */

import { BASE_SETTINGS, editableModules, editableRoutes, pageScope, type PolicyOverrides, type ScopeLevel } from '~/utils/resolveAccess'

export type AccessFilterLevel = 'any' | ScopeLevel
export type SourceFilter = 'all' | 'inherited' | 'custom'

export interface ModuleFilter {
  query: string
  access: AccessFilterLevel
  source: SourceFilter
}

export interface FilteredModule {
  moduleId: string
  /** Pages that pass the filter. When the filter is active these are the only pages shown. */
  routes: string[]
}

export const EMPTY_FILTER: ModuleFilter = { query: '', access: 'any', source: 'all' }

export function isFilterActive(f: ModuleFilter): boolean {
  return f.query.trim() !== '' || f.access !== 'any' || f.source !== 'all'
}

export function filterModules(
  ov: PolicyOverrides,
  code: string,
  filter: ModuleFilter,
  isCustom: (key: string) => boolean,
): FilteredModule[] {
  const q = filter.query.trim().toLowerCase()
  const result: FilteredModule[] = []
  for (const moduleId of editableModules()) {
    const label = BASE_SETTINGS.modules[moduleId]?.label ?? moduleId
    const moduleMatchesQuery = !q || `${label} ${moduleId}`.toLowerCase().includes(q)
    const moduleCustom = isCustom(moduleId)
    const routes = editableRoutes(moduleId).filter((route) => {
      if (!moduleMatchesQuery && !route.toLowerCase().includes(q)) return false
      if (filter.access !== 'any' && pageScope(ov, code, 'enabled', null, route) !== filter.access) return false
      if (filter.source !== 'all') {
        const custom = moduleCustom || isCustom(route)
        if ((filter.source === 'custom') !== custom) return false
      }
      return true
    })
    if (routes.length) result.push({ moduleId, routes })
  }
  return result
}
