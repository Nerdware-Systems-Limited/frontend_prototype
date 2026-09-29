/**
 * accessEdits - the single description of a Module Access change, applied
 * purely to an override set. The policy store applies edits after checking
 * the viewer's rights; the page uses the same function to warn about an
 * edit's consequences before it is made.
 */

import {
  adminCanManagePolicy, editableModules, moduleSummary,
  type AgencyOverride, type CategoryState, type PolicyLayer, type PolicyOverrides, type ScopeLevel,
} from '~/utils/resolveAccess'

export type EditableLayer = 'ceiling' | 'enabled'

/** `key` starting with "/" is a page, otherwise a module id. `null` value/caps = inherit. */
export type AccessEdit =
  | { kind: 'scope'; layer: EditableLayer; key: string; value: ScopeLevel | null }
  | { kind: 'roleScope'; tier: string; key: string; value: ScopeLevel | null }
  | { kind: 'category'; layer: EditableLayer; category: string; value: CategoryState | null }
  | { kind: 'capabilities'; layer: EditableLayer; caps: string[] | null }
  | { kind: 'roleCapabilities'; tier: string; caps: string[] | null }
  | { kind: 'reset'; keepCeiling: boolean }

export function editLayer(e: AccessEdit): PolicyLayer {
  switch (e.kind) {
    case 'scope':
    case 'category':
    case 'capabilities':
      return e.layer
    case 'roleScope':
    case 'roleCapabilities':
      return 'role'
    case 'reset':
      return e.keepCeiling ? 'enabled' : 'ceiling'
  }
}

export function cloneOverrides(ov: PolicyOverrides): PolicyOverrides {
  return JSON.parse(JSON.stringify(ov))
}

/** JSON with sorted keys, so re-adding a removed key doesn't read as a change. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function setKey(target: Record<string, any>, field: string, key: string, value: unknown) {
  if (value === null) {
    if (target[field]) delete target[field][key]
  } else {
    (target[field] ??= {})[key] = value
  }
}

function setCaps(target: { capabilities?: string[] }, caps: string[] | null) {
  if (caps === null) delete target.capabilities
  else target.capabilities = [...new Set(caps)].sort()
}

const isEmpty = (o: object | undefined) => !o || Object.keys(o).length === 0

function pruneLayer<T extends Record<string, any>>(layer: T | undefined): T | undefined {
  if (!layer) return undefined
  for (const field of ['modules', 'routes', 'categories']) {
    if (layer[field] && isEmpty(layer[field])) delete layer[field]
  }
  return isEmpty(layer) ? undefined : layer
}

/** Removes empty maps, layers and agencies in place (an explicit `capabilities: []` is kept - it means "none"). */
export function pruneOverrides(ov: PolicyOverrides): PolicyOverrides {
  for (const [code, a] of Object.entries(ov.agencies)) {
    for (const layer of ['ceiling', 'enabled'] as const) {
      const pruned = pruneLayer(a[layer])
      if (pruned) a[layer] = pruned
      else delete a[layer]
    }
    if (a.roles) {
      for (const tier of Object.keys(a.roles)) {
        const pruned = pruneLayer(a.roles[tier])
        if (pruned) a.roles[tier] = pruned
        else delete a.roles[tier]
      }
      if (isEmpty(a.roles)) delete a.roles
    }
    if (isEmpty(a)) delete ov.agencies[code]
  }
  return ov
}

/** Returns a new override set with `e` applied to agency `code`. No permission checks - see the policy store. */
export function applyEdit(ov: PolicyOverrides, code: string, e: AccessEdit): PolicyOverrides {
  const next = cloneOverrides(ov)
  const a: AgencyOverride = (next.agencies[code] ??= {})
  const field = (key: string) => (key.startsWith('/') ? 'routes' : 'modules')
  switch (e.kind) {
    case 'scope':
      setKey((a[e.layer] ??= {}), field(e.key), e.key, e.value)
      break
    case 'roleScope':
      setKey(((a.roles ??= {})[e.tier] ??= {}), field(e.key), e.key, e.value)
      break
    case 'category':
      setKey((a[e.layer] ??= {}), 'categories', e.category, e.value)
      break
    case 'capabilities':
      setCaps((a[e.layer] ??= {}), e.caps)
      break
    case 'roleCapabilities':
      setCaps(((a.roles ??= {})[e.tier] ??= {}), e.caps)
      break
    case 'reset':
      if (!e.keepCeiling) delete a.ceiling
      delete a.enabled
      delete a.roles
      break
  }
  return pruneOverrides(next)
}

function anyModuleEnabled(ov: PolicyOverrides, code: string): boolean {
  return editableModules().some(m => moduleSummary(ov, code, 'enabled', null, m).scope !== 'none')
}

/** A plain-language consequence worth confirming before applying `e`, or null when there is none. */
export function editWarning(ov: PolicyOverrides, code: string, e: AccessEdit): string | null {
  const next = applyEdit(ov, code, e)
  const hadM10 = moduleSummary(ov, code, 'enabled', null, 'M10').scope !== 'none'
  if (hadM10 && moduleSummary(next, code, 'enabled', null, 'M10').scope === 'none') {
    return `${code}'s admins will lose Access Control - Users, Roles, Audit Trail and Module Access.`
  }
  if (anyModuleEnabled(ov, code) && !anyModuleEnabled(next, code)) {
    return `${code} will have no modules enabled - its users will only see the restricted dashboard.`
  }
  if (adminCanManagePolicy(ov, code) && !adminCanManagePolicy(next, code)) {
    return `${code}'s admins will no longer be able to manage their own agency's access.`
  }
  return null
}
