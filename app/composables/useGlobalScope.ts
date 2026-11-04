/**
 * useGlobalScope - the system-wide period + county, set once from the top nav.
 *
 * It is a DEFAULT, not a lock: a module whose user has picked its own range or
 * county keeps that choice (see useTimeRange / useCountyScope); every module
 * they have not touched follows this. "Reset to global" on a module clears its
 * override.
 *
 * Kept for the browser session (sessionStorage) so a reload does not silently
 * widen a filter someone set on purpose, but a new session starts unfiltered.
 */
import { computed } from 'vue'
import { clampYear, isIsoDay, isRangeMode, type RangeSelection } from '~/utils/timeRange'

export interface GlobalScopeState {
  range: RangeSelection | null
  county: string | null
}

const STORAGE_KEY = 'uapts_global_scope'

function read(): GlobalScopeState {
  const empty: GlobalScopeState = { range: null, county: null }
  if (typeof window === 'undefined') return empty
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return empty
    const r = raw.range
    const range: RangeSelection | null =
      r && isRangeMode(r.mode) && Number.isInteger(r.year)
        ? {
            mode: r.mode,
            year: clampYear(r.year),
            ...(r.mode === 'custom' && isIsoDay(r.from) && isIsoDay(r.to) ? { from: r.from, to: r.to } : {}),
          }
        : null
    // A custom range without valid bounds is not usable.
    const usable = range && (range.mode !== 'custom' || (range.from && range.to)) ? range : null
    return { range: usable, county: typeof raw.county === 'string' && raw.county ? raw.county : null }
  } catch {
    return empty
  }
}

export function useGlobalScope() {
  const state = useState<GlobalScopeState>('global-scope', read)

  function persist() {
    if (typeof window === 'undefined') return
    try {
      if (state.value.range || state.value.county) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.value))
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch { /* private mode: the in-memory value still works */ }
  }

  function setRange(range: RangeSelection | null) {
    state.value = { ...state.value, range }
    persist()
  }
  function setCounty(county: string | null) {
    state.value = { ...state.value, county: county || null }
    persist()
  }
  function clear() {
    state.value = { range: null, county: null }
    persist()
  }

  return {
    range: computed(() => state.value.range),
    county: computed(() => state.value.county),
    /** True when either part is set. */
    isActive: computed(() => !!(state.value.range || state.value.county)),
    setRange, setCounty, clear,
  }
}
