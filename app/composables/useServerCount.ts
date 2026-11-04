/**
 * useServerCount - "how many rows match, and what do they add up to?" answered by the server, not by counting a loaded
 * list. KPI cards used to count what the page had fetched (`vessels.length`, `rows.filter(...).length`,
 * `rows.reduce(...)`), which is wrong as soon as the dataset is bigger than the fetch.
 *
 * One request (`page_size=1`) returns the real `count` and, when asked, aggregates and grouped counts computed over the
 * same filtered rows the table shows (core/aggregates.py). It honours the same `?q=` / `?f.<column>=` / `?county=`:
 *
 *   const stops = useServerCount('/api/v1/.../brt-stops/', scope, {
 *     aggregate: ['avg:avg_dwell_seconds', 'avg:avg_boarding_count', 'distinct:route_name'],
 *     groupBy: ['has_shelter', 'platform_type'],
 *   })
 *   stops.count.value                          // 42       (null until loaded / if the request failed)
 *   stops.avg('avg_dwell_seconds')             // 38.5     (null when there are no rows)
 *   stops.groupCount('has_shelter', true)      // 31
 *   stops.groupPct('has_shelter', true)        // 73.8
 *
 * A failed request leaves everything `null` ("unavailable"), never 0.
 */
import { onMounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useApi } from '~/composables/api/_client'

export interface ServerCountOptions {
  /** `func:column` list - count, distinct, sum, avg, min, max (`count:*` for rows). */
  aggregate?: string[]
  /** Columns to count by. */
  groupBy?: string[]
  /** `func:column` figures carried by every group (e.g. `sum:tonnage` -> tonnage per cargo type), read with `groupValue`. */
  groupAggregate?: string[]
}

export type AggregateValue = number | string | null
export interface Group { value: unknown; count: number; [figure: string]: unknown }

export function useServerCount(path: string, params?: MaybeRefOrGetter<Record<string, unknown> | undefined>, opts: ServerCountOptions = {}) {
  const api = useApi()
  const count = ref<number | null>(null)
  const aggregates = ref<Record<string, AggregateValue>>({})
  const groups = ref<Record<string, Group[]>>({})
  const loading = ref(false)
  const failed = ref(false)
  let seq = 0

  async function refresh() {
    const mine = ++seq
    loading.value = true
    try {
      const query: Record<string, unknown> = { ...(toValue(params) ?? {}), page_size: 1 }
      if (opts.aggregate?.length) query.aggregate = opts.aggregate.join(',')
      if (opts.groupBy?.length) query.group_by = opts.groupBy.join(',')
      if (opts.groupBy?.length && opts.groupAggregate?.length) query.group_aggregate = opts.groupAggregate.join(',')
      const res = await api<{ count?: number; aggregates?: Record<string, AggregateValue>; groups?: Record<string, Group[]> }>(path, { query: query as Record<string, any> })
      if (mine !== seq) return
      count.value = typeof res?.count === 'number' ? res.count : null
      aggregates.value = res?.aggregates ?? {}
      groups.value = res?.groups ?? {}
      failed.value = count.value === null
    } catch {
      if (mine === seq) { count.value = null; aggregates.value = {}; groups.value = {}; failed.value = true }
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  const num = (v: AggregateValue | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  /** A numeric aggregate (`avg('avg_dwell_seconds')` reads `avg:avg_dwell_seconds`); null if absent / no rows / not loaded. */
  const agg = (func: string, column: string) => num(aggregates.value[`${func}:${column}`])
  /** Shorthands for the common ones. */
  const avg = (column: string) => agg('avg', column)
  const sum = (column: string) => agg('sum', column)
  const distinct = (column: string) => agg('distinct', column)
  /** Rows in one group of a `groupBy` column (booleans compare as booleans); 0 if that value has none. null if not loaded. */
  const groupCount = (column: string, value: unknown): number | null => {
    const rows = groups.value[column]
    if (!rows || count.value === null) return null
    return rows.find(g => g.value === value)?.count ?? 0
  }
  /** A figure carried by one group (`groupValue('cargo_type', 'grain', 'sum:tonnage')`); null if absent / not loaded. */
  const groupValue = (column: string, value: unknown, spec: string): number | null => {
    const v = groups.value[column]?.find(g => g.value === value)?.[spec]
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }
  /** One group's share of all rows, in percent; null when there are no rows or nothing loaded. */
  const groupPct = (column: string, value: unknown): number | null => {
    const n = groupCount(column, value)
    return n === null || !count.value ? null : (n / count.value) * 100
  }

  onMounted(refresh)
  watch(() => JSON.stringify(toValue(params) ?? {}), refresh)
  return { count, aggregates, groups, loading, failed, refresh, agg, avg, sum, distinct, groupCount, groupValue, groupPct }
}
