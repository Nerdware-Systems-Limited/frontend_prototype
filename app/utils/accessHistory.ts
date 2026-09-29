/**
 * accessHistory - the Module Access change log.
 *
 * describeChanges() turns the difference between the saved overrides and
 * what is about to be saved into plain-language lines ("Fleet and Vehicle
 * Tracking - Agency access: None → Read"). The policy store records one
 * HistoryEntry per agency per Save. Pure; no Vue, no storage.
 */

import {
  BASE_SETTINGS, capabilitySet, categoryState, moduleSummary, pageScope,
  type AgencyOverride, type PolicyLayer, type PolicyOverrides, type ScopeLevel, type ScopeMaps,
} from '~/utils/resolveAccess'
import { capabilityLabel } from '~/utils/accessLabels'

export interface ChangeLine {
  /** What changed: a module label, a page path, a data category or a capability. */
  subject: string
  /** Which setting: "Agency limit", "Agency access", "Analyst role", ... */
  field: string
  from: string
  to: string
}

export interface HistoryEntry {
  id: string
  /** ISO timestamp of the Save. */
  at: string
  by: string
  agency: string
  changes: ChangeLine[]
}

/** How many entries the log keeps (newest first). */
export const HISTORY_LIMIT = 200

const LEVEL: Record<ScopeLevel, string> = { none: 'None', read: 'Read', full: 'Full' }

function fieldName(layer: PolicyLayer, tier: string | null): string {
  if (layer === 'ceiling') return 'Agency limit'
  if (layer === 'enabled') return 'Agency access'
  return `${(tier ?? '').charAt(0).toUpperCase()}${(tier ?? '').slice(1)} role`
}

function keysOf(...maps: (Record<string, unknown> | undefined)[]): string[] {
  return [...new Set(maps.flatMap(m => Object.keys(m ?? {})))]
}

function effectiveScope(ov: PolicyOverrides, code: string, layer: PolicyLayer, tier: string | null, key: string): string {
  if (key.startsWith('/')) return LEVEL[pageScope(ov, code, layer, tier, key)]
  const s = moduleSummary(ov, code, layer, tier, key)
  return s.mixed ? 'Mixed' : LEVEL[s.scope]
}

/** Before/after text: the effective level, or - when only the source changed - which one was the default. */
function transition(fromEff: string, toEff: string, fromSet: boolean, toSet: boolean): Pick<ChangeLine, 'from' | 'to'> {
  if (fromEff !== toEff) return { from: fromEff, to: toEff }
  return { from: `${fromEff}${fromSet ? '' : ' (default)'}`, to: `${toEff}${toSet ? '' : ' (default)'}` }
}

export function describeChanges(before: PolicyOverrides, after: PolicyOverrides, code: string): ChangeLine[] {
  const a: AgencyOverride = before.agencies[code] ?? {}
  const b: AgencyOverride = after.agencies[code] ?? {}
  const lines: ChangeLine[] = []

  const layers: { layer: PolicyLayer; tier: string | null; pick: (o: AgencyOverride) => ScopeMaps | undefined }[] = [
    { layer: 'ceiling', tier: null, pick: o => o.ceiling },
    { layer: 'enabled', tier: null, pick: o => o.enabled },
    ...keysOf(a.roles, b.roles).map(tier => ({ layer: 'role' as const, tier, pick: (o: AgencyOverride) => o.roles?.[tier] })),
  ]

  for (const { layer, tier, pick } of layers) {
    const la = pick(a)
    const lb = pick(b)
    // Scopes: every module or page whose own value on this layer changed.
    for (const field of ['modules', 'routes'] as const) {
      for (const key of keysOf(la?.[field], lb?.[field])) {
        const rawA = la?.[field]?.[key]
        const rawB = lb?.[field]?.[key]
        if (rawA === rawB) continue
        lines.push({
          subject: key.startsWith('/') ? key : BASE_SETTINGS.modules[key]?.label ?? key,
          field: fieldName(layer, tier),
          ...transition(effectiveScope(before, code, layer, tier, key), effectiveScope(after, code, layer, tier, key), !!rawA, !!rawB),
        })
      }
    }
    // Capabilities: one line per capability switched on or off on this layer.
    const capsA = (la as { capabilities?: string[] } | undefined)?.capabilities
    const capsB = (lb as { capabilities?: string[] } | undefined)?.capabilities
    if (JSON.stringify(capsA ?? null) !== JSON.stringify(capsB ?? null)) {
      const setA = capabilitySet(before, code, layer, tier)
      const setB = capabilitySet(after, code, layer, tier)
      for (const cap of new Set([...setA, ...setB])) {
        if (setA.has(cap) === setB.has(cap)) continue
        lines.push({ subject: capabilityLabel(cap), field: `${fieldName(layer, tier)} capability`, from: setA.has(cap) ? 'On' : 'Off', to: setB.has(cap) ? 'On' : 'Off' })
      }
    }
    // Data categories only exist on the ceiling and enabled layers.
    if (layer !== 'role') {
      const catsA = (la as { categories?: Record<string, string> } | undefined)?.categories
      const catsB = (lb as { categories?: Record<string, string> } | undefined)?.categories
      for (const category of keysOf(catsA, catsB)) {
        if (catsA?.[category] === catsB?.[category]) continue
        const stateLabel = (ov: PolicyOverrides) => (categoryState(ov, code, layer, category) === 'allow' ? 'Visible' : 'Masked')
        lines.push({
          subject: BASE_SETTINGS.restrictedCategories[category]?.label ?? category,
          field: `${fieldName(layer, tier)} data`,
          ...transition(stateLabel(before), stateLabel(after), !!catsA?.[category], !!catsB?.[category]),
        })
      }
    }
  }
  return lines
}

function isEntry(value: unknown): value is HistoryEntry {
  const v = value as Partial<HistoryEntry> | null
  return !!v && typeof v.at === 'string' && typeof v.by === 'string' && typeof v.agency === 'string' && Array.isArray(v.changes)
}

/** A log from any source (storage or the server). Throws when it isn't a list; malformed entries are dropped individually. */
export function normalizeHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) throw new Error('not a list')
  return value.filter(isEntry).slice(0, HISTORY_LIMIT)
}

/** Stored log, or [] (with a warning) when unreadable. Malformed entries are dropped individually. */
export function parseStoredHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return []
  try {
    return normalizeHistory(JSON.parse(raw))
  } catch {
    console.warn('[access-policy] ignoring unreadable change history')
    return []
  }
}
