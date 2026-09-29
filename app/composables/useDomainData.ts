/**
 * Domain data layer for widgets.
 *
 * Every KPI / chart widget asks for a domain summary ("safety", "fleet"…)
 * with its own filter context. Requests with the same domain + same filter
 * params are de-duplicated and cached for `TTL_MS`, so a dashboard with ten
 * safety widgets and one county filter makes ONE /safety/summary call.
 *
 * Filters become query params (county, road, severity, agency,
 * vehicle_class, date_from, date_to), but each domain request carries only
 * the ones its endpoint honours (DOMAIN_FILTERS in metricRegistry). The
 * widget frame shows "Not filtered by ..." for the rest, so nobody reads
 * unfiltered numbers as filtered ones.
 */
import {
  useSafety, useFleet, useRailway, useAviationMaritime, useInfrastructure, useAgencies,
} from '~/composables/api'
import type { SummaryFilterParams } from '~/composables/api/_client'
import { DOMAIN_FILTERS, type Domain, type DomainPayloads } from '~/utils/metricRegistry'
import type { FilterField, FilterValue, WidgetFilterContext } from '~/types/dashboard'

const TTL_MS = 60_000
const cache = new Map<string, { at: number; promise: Promise<unknown> }>()

export function filterParams(ctx: WidgetFilterContext): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [field, raw] of Object.entries(ctx) as [string, FilterValue][]) {
    if (raw == null || raw === '' || (Array.isArray(raw) && !raw.length)) continue
    if (field === 'date_range' && typeof raw === 'object' && !Array.isArray(raw)) {
      out.date_from = raw.from
      out.date_to = raw.to
    } else {
      out[field] = Array.isArray(raw) ? raw.join(',') : String(raw)
    }
  }
  return out
}

/** Query param names each FilterField becomes. */
const PARAM_NAMES: Record<FilterField, (keyof SummaryFilterParams)[]> = {
  date_range: ['date_from', 'date_to'], agency: ['agency'], county: ['county'], road: ['road'],
  severity: ['severity'], vehicle_class: ['vehicle_class'], mode: [],
}

/** Only the params this domain's endpoint honours (DOMAIN_FILTERS) are sent. */
export function domainParams(domain: Domain, params: Record<string, string>): SummaryFilterParams {
  const out: SummaryFilterParams = {}
  for (const field of DOMAIN_FILTERS[domain]) {
    for (const name of PARAM_NAMES[field]) if (params[name]) out[name] = params[name]
  }
  return out
}

// /infrastructure/summary/ filters by Agency UUID; dashboards filter by agency code.
let agencyIds: Promise<Map<string, string>> | null = null
async function agencyIdFor(code: string): Promise<string> {
  if (code.includes(',')) throw new Error('Infrastructure figures can be filtered by one agency at a time.')
  agencyIds ??= useAgencies().list({ page_size: 200 })
    .then(res => new Map(res.results.map(a => [a.agency_code.toUpperCase(), a.id])))
    .catch((err) => { agencyIds = null; throw err })
  const id = (await agencyIds).get(code.toUpperCase())
  if (!id) throw new Error(`Unknown agency '${code}'.`)
  return id
}

function fetcher(domain: Domain): (params: SummaryFilterParams) => Promise<unknown> {
  switch (domain) {
    case 'safety': return p => useSafety().summary(p)
    case 'fleet': return p => useFleet().summary(p)
    case 'rail': return p => useRailway().summary(p)
    case 'aviation': return p => useAviationMaritime().aviationSummary(7, p)
    case 'maritime': return p => useAviationMaritime().maritimeOperations(30, p)
    case 'infra': return async p => useInfrastructure().summary(p.agency ? { ...p, agency: await agencyIdFor(p.agency) } : p)
  }
}

export function loadDomain<D extends Domain>(domain: D, ctx: WidgetFilterContext, force = false): Promise<DomainPayloads[D]> {
  const params = domainParams(domain, filterParams(ctx))
  const key = `${domain}?${new URLSearchParams(Object.entries(params).sort()).toString()}`
  const hit = cache.get(key)
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.promise as Promise<DomainPayloads[D]>
  const promise = fetcher(domain)(params)
  cache.set(key, { at: Date.now(), promise })
  promise.catch(() => cache.delete(key)) // never cache a failure
  return promise as Promise<DomainPayloads[D]>
}

export function invalidateDomainCache() { cache.clear() }

/**
 * Reactive wrapper: re-fetches when the filter context changes or the
 * dashboard's refresh tick fires. Returns data / error / loading refs.
 */
export function useDomainData<D extends Domain>(domain: () => D | null, ctx: () => WidgetFilterContext) {
  const data = shallowRef<DomainPayloads[D] | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)
  const tick = inject<Ref<number>>('dashboard:refreshTick', ref(0))
  let seq = 0

  async function run(force = false) {
    const d = domain()
    if (!d) { data.value = null; return }
    const mine = ++seq
    loading.value = true
    error.value = null
    try {
      const res = await loadDomain(d, ctx(), force)
      if (mine === seq) data.value = res as DomainPayloads[D]
    } catch (e) {
      const err = e as { data?: { detail?: string; message?: string }; message?: string } | null
      if (mine === seq) { data.value = null; error.value = err?.data?.detail || err?.data?.message || err?.message || 'Request failed' }
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  watch([domain, () => JSON.stringify(ctx())], () => run(), { immediate: true })
  // The renderer clears the cache before bumping the tick, so a plain run()
  // still de-duplicates: ten widgets on one refresh -> one request per domain.
  watch(tick, () => run())

  return { data, error, loading, reload: () => run(true) }
}
