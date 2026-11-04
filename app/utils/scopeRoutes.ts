/**
 * scopeRoutes - which API areas take the shared `?county=` filter implicitly.
 *
 * The Aviation/Maritime, Railway, Public Transport and Fleet modules have dozens of pages and hundreds of
 * call sites. Rather than threading a county argument through every one, the API client (plugins/api.ts)
 * adds the county in force for the module to any GET under these prefixes. The backend applies it with
 * core.scope.CountyScopedMixin; an endpoint with no place to filter on simply ignores it.
 *
 * `key` is the module key its pages pass to useCountyScope(key), so a page's county picker and the requests
 * it triggers always agree. Traffic, Safety and Infrastructure are NOT listed: their calls pass the county
 * explicitly.
 */
export interface CountyRoute { prefix: string; key: string }

export const COUNTY_ROUTES: CountyRoute[] = [
  { prefix: '/api/v1/aviation-maritime/aviation/', key: 'aviation' },
  { prefix: '/api/v1/aviation-maritime/maritime/', key: 'maritime' },
  { prefix: '/api/v1/railway/', key: 'railway' },
  { prefix: '/api/v1/public-transport/', key: 'public-transport' },
  { prefix: '/api/v1/fleet/', key: 'fleet' },
]

/** The module key whose county applies to this request path, or null. */
export function countyKeyFor(path: string): string | null {
  const p = String(path).split('?')[0] ?? ''
  return COUNTY_ROUTES.find(r => p.startsWith(r.prefix))?.key ?? null
}

/**
 * The request options with `county` added - only for a GET, only when a county is in force, and never over
 * one the caller already set (in the query option or in the URL itself).
 */
export function withModuleCounty<O extends { method?: unknown; query?: unknown }>(path: string, options: O, county: string | null): O {
  if (!county) return options
  if (String(options.method ?? 'GET').toUpperCase() !== 'GET') return options
  if (/[?&]county=/.test(String(path))) return options
  const q = (options.query ?? {}) as Record<string, unknown>
  if (q.county !== undefined && q.county !== null && q.county !== '') return options
  return { ...options, query: { ...q, county } }
}
