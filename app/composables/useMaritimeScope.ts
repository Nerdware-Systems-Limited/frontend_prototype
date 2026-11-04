/**
 * useMaritimeScope - the period and county every maritime page reads, from the global filter in the top bar.
 *
 *   const { days, countyName, scope, key } = useMaritimeScope()
 *   mc.summary(days.value, countyName.value)          // positional (days, county) calls
 *   avm.berths({ ...scope.value, page_size: 50 })     // list calls take { days, county }
 *   watch(key, load)                                  // reload when either changes
 *
 * The maritime endpoints take a rolling day count (not date_from/date_to), so a global year / custom range falls back
 * to the module default (30 days). An endpoint with no county column ignores `county`.
 */
import { computed } from 'vue'
import { useTimeRange } from '~/composables/useTimeRange'
import { useCountyScope } from '~/composables/useCountyScope'

export function useMaritimeScope() {
  const timeRange = useTimeRange('maritime', { default: '30d' })
  const county = useCountyScope('maritime')
  const days = timeRange.days
  const countyName = computed(() => county.county.value ?? undefined)
  const scope = computed(() => ({ days: days.value, ...county.query.value }))
  const key = computed(() => JSON.stringify(scope.value))
  /** The badge for a KpiCard `period`: "30D". */
  const period = computed(() => `${days.value}D`)
  return { timeRange, county, days, countyName, scope, key, period }
}
