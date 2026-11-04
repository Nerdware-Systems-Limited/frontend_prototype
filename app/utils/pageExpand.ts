/**
 * pageExpand - make `page_size` mean what the caller asked for.
 *
 * The backend caps a page at 100 rows (core.pagination), so a call such as `page_size: 200` used to come back with
 * 100 rows and nothing said so - tables showed a quietly truncated dataset. The API client (plugins/api.ts) now
 * expands such a request into as many 100-row pages as needed, fetches the extra pages in parallel, and returns
 * them as the one response the caller expected.
 *
 * This is a safety net for existing code, not a way to load big datasets: it stops at EXPAND_ROW_CAP rows. Anything
 * that can hold more than that belongs on the server-side table (composables/useServerTable), which pages instead.
 */
export const SERVER_PAGE_MAX = 100
export const EXPAND_ROW_CAP = 500

type Query = Record<string, unknown>

/** Rows the caller wants when that is more than one server page, else null (nothing to expand). */
export function wantedRows(path: string, query?: Query): number | null {
  const fromUrl = /[?&]page_size=(\d+)/.exec(String(path))?.[1]
  const raw = query?.page_size ?? fromUrl
  const size = Number(raw)
  if (!Number.isFinite(size) || size <= SERVER_PAGE_MAX) return null
  // A caller that also asked for a specific later page is doing its own paging: leave it alone.
  const page = Number(query?.page ?? /[?&]page=(\d+)/.exec(String(path))?.[1] ?? 1)
  if (page > 1) return null
  return Math.min(Math.trunc(size), EXPAND_ROW_CAP)
}

/** The same request, for one server page. `page_size` and `page` in the URL string are moved into the query. */
export function pageRequest<O extends { query?: unknown }>(path: string, options: O, page: number, size: number): { path: string; options: O } {
  // Strip page / page_size out of the URL's own query string (everything else is kept as written).
  const [base = '', qs = ''] = String(path).split('?')
  const kept = qs.split('&').filter(pair => pair && !/^(page|page_size)=/.test(pair))
  const cleaned = kept.length ? `${base}?${kept.join('&')}` : base
  return { path: cleaned, options: { ...options, query: { ...((options.query ?? {}) as Query), page, page_size: size } } }
}

interface PagedShape { count?: number; results?: unknown[]; [k: string]: unknown }

/** Fetch `want` rows as 100-row pages. Responses that are not paged lists pass through untouched. */
export async function expandPaged<T>(
  path: string, options: { query?: unknown }, want: number,
  fetchOne: (path: string, options: any) => Promise<T>,
): Promise<T> {
  const first = pageRequest(path, options, 1, SERVER_PAGE_MAX)
  const head = (await fetchOne(first.path, first.options)) as PagedShape
  if (!head || !Array.isArray(head.results) || typeof head.count !== 'number') return head as T
  const needed = Math.min(want, head.count)
  if (needed <= head.results.length) return { ...head, results: head.results.slice(0, needed) } as T

  const pages = Math.ceil(needed / SERVER_PAGE_MAX)
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => {
      const r = pageRequest(path, options, i + 2, SERVER_PAGE_MAX)
      return fetchOne(r.path, r.options) as Promise<PagedShape>
    }),
  )
  const results = [head, ...rest].flatMap(p => (Array.isArray(p?.results) ? p.results : [])).slice(0, needed)
  // Report it as the single page the caller asked for.
  return { ...head, results, page: 1, page_size: want, total_pages: Math.ceil(head.count / want), next: results.length < head.count ? head.next : null } as T
}
