/**
 * Agency-scoped widget catalog - which palette entries, metrics and agency
 * snapshots may go on a dashboard owned by a given agency.
 *
 * Rule: an agency may put a page's data on its dashboards as long as it can
 * open that page. Every data source names its page (WidgetSource.route), and
 * the page check is the same agency-level resolution Module Access uses
 * (domain bundles, grants, route grants, denials, saved overrides) - so KRC,
 * with read access to /fleet and /maritime/port-ops, gets fleet and port
 * data alongside its own rail and training data, and nothing else.
 *
 * The server enforces this rule on save and publish (backend
 * apps/dashboards/scope.py, with the source -> page map in catalog.py). This
 * module only decides what the editor OFFERS, so authors don't hit a 400.
 * Keep `route` on each source in step with catalog.SOURCES.
 *
 * A national dashboard (no owner agency) or an agency the access config
 * doesn't know gets `null` = the full catalog.
 */
import {
  BASE_SETTINGS, EMPTY_OVERRIDES, pageScope, type PolicyOverrides,
} from '~/utils/resolveAccess'
import { DOMAIN_SOURCE, SOURCES_BY_ID } from '~/utils/dataSources'
import { METRICS, METRICS_BY_KEY, type Domain } from '~/utils/metricRegistry'
import { PRESETS_BY_ID } from '~/utils/widgetPresets'
import { AGENCY_CARD_DOMAINS, WIDGETS_BY_TYPE } from '~/utils/widgetRegistry'

export interface CatalogScope {
  /** Owner agency code as stored on the dashboard (e.g. "KeNHA"). */
  agency: string
  /** Pages the agency can open (any scope above none). */
  routes: Set<string>
  /** Ministry oversight agencies (SDT, SDR) may embed the national Command Centre. */
  oversight: boolean
}

/** The catalog scope for a dashboard owned by `agency`, or null for the full catalog. */
export function catalogScopeFor(agency: string | null | undefined, ov: PolicyOverrides = EMPTY_OVERRIDES): CatalogScope | null {
  if (!agency) return null
  const code = agency.toUpperCase()
  const a = BASE_SETTINGS.agencies[code]
  if (!a) return null
  const routes = new Set<string>()
  for (const mod of Object.values(BASE_SETTINGS.modules)) {
    for (const r of mod.routes) {
      if (!r.includes('[') && pageScope(ov, code, 'enabled', null, r) !== 'none') routes.add(r)
    }
  }
  return { agency, routes, oversight: a.domains.some(d => BASE_SETTINGS.domains[d]?.readOnly) }
}

const sourceInScope = (sourceId: string | undefined, scope: CatalogScope): boolean => {
  const route = sourceId ? SOURCES_BY_ID[sourceId]?.route : undefined
  return !!route && scope.routes.has(route)
}
const domainInScope = (d: Domain, scope: CatalogScope) => sourceInScope(DOMAIN_SOURCE[d], scope)

/**
 * The sources each hand-built widget reads. All must be in scope - the risk
 * map is viewable with GIS access alone, but its hotspots are safety data.
 */
const WIDGET_SOURCES: Record<string, string[]> = {
  'fatality-bars': ['safety.summary'],
  'incident-trend': ['safety.summary'],
  'risk-map': ['safety.hotspots', 'safety.top-blackspots', 'gis.roads'],
  'feed-health': ['integrations.feeds'],
}

/** A metric is in scope when the agency can open the page its domain's data comes from. */
export const metricInScope = (key: string, scope: CatalogScope | null): boolean => {
  if (!scope) return true
  const m = METRICS_BY_KEY[key]
  return !!m && domainInScope(m.domain as Domain, scope)
}

export const scopedMetricKeys = (scope: CatalogScope | null): string[] =>
  METRICS.filter(m => metricInScope(m.key, scope)).map(m => m.key)

/** Agency snapshots whose every domain the scope can see. */
export function agencyCardsInScope(scope: CatalogScope | null): string[] {
  return Object.entries(AGENCY_CARD_DOMAINS)
    .filter(([, domains]) => !scope || domains.every(d => domainInScope(d, scope)))
    .map(([code]) => code)
}

/** Whether a palette entry (widget type or "preset:<id>") may go on this agency's dashboard. */
export function catalogItemInScope(item: string, scope: CatalogScope | null): boolean {
  if (!scope) return true
  if (item.startsWith('preset:')) return sourceInScope(PRESETS_BY_ID[item.slice('preset:'.length)]?.binding.source, scope)
  if (item === 'kpi' || item === 'kpi-row') return scopedMetricKeys(scope).length > 0
  if (item === 'agency-card') return agencyCardsInScope(scope).length > 0
  if (WIDGETS_BY_TYPE[item]?.requiredPermissions?.includes('dashboard.national.view')) return scope.oversight
  const sources = WIDGET_SOURCES[item]
  return !sources || sources.every(id => sourceInScope(id, scope))
}

/** Default config for a freshly placed widget, narrowed to data the agency can open. */
export function scopedDefaults(type: string, config: Record<string, unknown>, scope: CatalogScope | null): Record<string, unknown> {
  if (!scope) return config
  const keys = scopedMetricKeys(scope)
  if (type === 'kpi' && !metricInScope(String(config.metricKey ?? ''), scope)) return { ...config, metricKey: keys[0] }
  if (type === 'kpi-row') {
    const mine = ((config.metricKeys as string[] | undefined) ?? []).filter(k => metricInScope(k, scope))
    return { ...config, metricKeys: mine.length ? mine : keys.slice(0, 6) }
  }
  if (type === 'agency-card') {
    const cards = agencyCardsInScope(scope)
    const own = cards.find(c => c.toUpperCase() === scope.agency.toUpperCase())
    return cards.includes(String(config.agency)) ? config : { ...config, agency: own ?? cards[0] }
  }
  return config
}
