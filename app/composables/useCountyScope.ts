/**
 * useCountyScope - the county filter for one module, with the same
 * "module's own choice, else the global one" rule as useTimeRange.
 *
 *   const county = useCountyScope('safety')
 *   county.query.value        // { county: 'Nairobi' } or {} - spread into request params
 *   <CountySelect :scope="county" @change="load" />
 *
 * `null` means every county. Picking "All counties" on a module whose global
 * scope is a single county is still an explicit choice (it overrides).
 */
import { computed } from 'vue'
import { useGlobalScope } from '~/composables/useGlobalScope'

interface CountyState { county: string | null; overridden: boolean }

export function useCountyScope(key: string) {
  const state = useState<CountyState>(`county:${key}`, () => ({ county: null, overridden: false }))
  const global = useGlobalScope()

  const county = computed<string | null>(() => (state.value.overridden ? state.value.county : global.county.value))

  function set(next: string | null) {
    state.value = { county: next || null, overridden: true }
  }
  function reset() { state.value = { county: null, overridden: false } }

  return {
    key,
    county,
    /** Spread into request params. */
    query: computed<{ county?: string }>(() => (county.value ? { county: county.value } : {})),
    label: computed(() => county.value ?? 'All counties'),
    isGlobal: computed(() => !state.value.overridden && !!global.county.value),
    isOverridden: computed(() => state.value.overridden),
    set, reset,
  }
}

export type CountyScope = ReturnType<typeof useCountyScope>
