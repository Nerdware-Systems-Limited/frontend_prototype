/**
 * Domain data for metric widgets - a thin layer over useWidgetData.
 *
 * A metric names its DOMAIN ("safety", "fleet"…); each domain is one summary
 * source in utils/dataSources.ts (DOMAIN_SOURCE). Caching, de-duplication,
 * the refresh tick and honest error states all live in useWidgetData, so a
 * dashboard with ten safety widgets still makes ONE /safety/summary call.
 */
import type { SummaryFilterParams } from '~/composables/api/_client'
import { DOMAIN_SOURCE, SOURCES_BY_ID, honouredParams } from '~/utils/dataSources'
import type { Domain, DomainPayloads } from '~/utils/metricRegistry'
import type { WidgetFilterContext } from '~/types/dashboard'
import { invalidateWidgetData, loadSource, useWidgetData } from '~/composables/useWidgetData'

/** Only the params this domain's endpoint honours are sent. */
export function domainParams(domain: Domain, params: Record<string, string>): SummaryFilterParams {
  return honouredParams(SOURCES_BY_ID[DOMAIN_SOURCE[domain]]!.honours, params)
}

export function loadDomain<D extends Domain>(domain: D, ctx: WidgetFilterContext, force = false): Promise<DomainPayloads[D]> {
  return loadSource<DomainPayloads[D]>(DOMAIN_SOURCE[domain], ctx, {}, force)
}

/** @deprecated use invalidateWidgetData() */
export function invalidateDomainCache() { invalidateWidgetData() }

/**
 * Reactive domain payload. Re-fetches when the filter context changes or the
 * dashboard's refresh tick fires.
 */
export function useDomainData<D extends Domain>(domain: () => D | null, ctx: () => WidgetFilterContext) {
  return useWidgetData<DomainPayloads[D]>(() => {
    const d = domain()
    return d ? DOMAIN_SOURCE[d] : null
  }, ctx)
}
