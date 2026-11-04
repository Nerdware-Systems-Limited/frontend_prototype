/**
 * useEndpointTable - the one-liner for "a table over a list endpoint".
 *
 *   const table = useEndpointTable({
 *     key: 'maritime-vessels',
 *     path: '/api/v1/aviation-maritime/maritime/vessels/',
 *     columns,
 *     countyKey: 'maritime',          // the module's county filter, if it has one
 *   })
 *   <DataTable :table="table" row-key="id" />
 *
 * It wires the API client, the module's county (passed explicitly, so a county change refetches and the page cache
 * is keyed by it) and any extra params into `useServerTable`. Everything else - paging, search, filters, sorting,
 * layout - comes from the engine and the endpoint's own `?q=` / `?f.<column>=` / `?ordering=` contract.
 */
import { toValue, type MaybeRefOrGetter } from 'vue'
import { useApi } from '~/composables/api/_client'
import { useCountyScope } from '~/composables/useCountyScope'
import { useServerTable, type UseServerTableOptions } from '~/composables/useServerTable'
import type { PagedResult, Row } from '~/types/dataTable'

export interface UseEndpointTableOptions<T extends Row = Row> extends Omit<UseServerTableOptions<T>, 'fetcher' | 'params'> {
  /** The list endpoint. */
  path: string
  /** Module key for the county filter (see useCountyScope). Omit for modules without one. */
  countyKey?: string
  /** Extra fixed or reactive params (a selector elsewhere on the page). */
  params?: MaybeRefOrGetter<Record<string, unknown> | undefined>
}

export function useEndpointTable<T extends Row = Row>(opts: UseEndpointTableOptions<T>) {
  const api = useApi()
  const county = opts.countyKey ? useCountyScope(opts.countyKey) : null
  const { path, countyKey: _k, params, ...rest } = opts
  return useServerTable<T>({
    ...rest,
    params: () => ({ ...(county?.query.value ?? {}), ...(toValue(params) ?? {}) }),
    fetcher: (query, { signal }) => api<PagedResult<T>>(path, { query, signal }),
  })
}
