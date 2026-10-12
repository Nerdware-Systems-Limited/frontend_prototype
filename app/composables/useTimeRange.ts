/**
 * useTimeRange - the selected reporting window for one module.
 *
 *   const range = useTimeRange('aviation', { default: '7d' })
 *   range.days.value      // 1 | 7 | 30, or the length of the chosen year
 *   range.from.value      // 'YYYY-MM-DD' (EAT)
 *   <TimeRangeSelector :range="range" @change="load" />
 *
 * The state is keyed by module, so choosing "30 Days" on one Aviation page is
 * still chosen on the next Aviation page, and it survives navigating away and
 * back within the session. A reload starts from the module's default again.
 * Different modules keep independent selections.
 */
import { computed } from 'vue'
import {
  clampYear, currentYear, isRangeMode, periodBadge, rangeBounds,
  type RangeMode, type RangePreset, type RangeSelection,
} from '~/utils/timeRange'

export interface UseTimeRangeOptions {
  default?: RangePreset
  /** Offer the year view (only for data whose endpoint takes `date_from` / `date_to`). */
  years?: boolean
}

export function useTimeRange(key: string, opts: UseTimeRangeOptions = {}) {
  const state = useState<RangeSelection>(`timerange:${key}`, () => ({ mode: opts.default ?? '7d', year: currentYear() }))

  // The selection is shared across a module's pages. A page whose data cannot answer a
  // past year falls back to a preset instead of sending a year-long window to an endpoint that
  // only understands "the last N days".
  const effective = computed<RangeSelection>(() =>
    state.value.mode === 'year' && !opts.years ? { mode: opts.default ?? '30d', year: state.value.year } : state.value)
  const mode = computed(() => effective.value.mode)
  const year = computed(() => effective.value.year)
  const bounds = computed(() => rangeBounds(effective.value))

  function setMode(next: RangeMode) {
    if (!isRangeMode(next) || (next === 'year' && !opts.years)) return
    state.value = { ...state.value, mode: next }
  }
  function setYear(y: number) {
    state.value = { mode: 'year', year: clampYear(y) }
  }
  function stepYear(delta: number) { setYear(state.value.year + delta) }

  return {
    key,
    /** Whether the year view is offered for this data. */
    years: !!opts.years,
    mode, year,
    days: computed(() => bounds.value.days),
    from: computed(() => bounds.value.from),
    to: computed(() => bounds.value.to),
    label: computed(() => bounds.value.label),
    endsToday: computed(() => bounds.value.endsToday),
    /** Badge text for KpiCard `period`. */
    period: computed(() => periodBadge(effective.value)),
    isYear: computed(() => effective.value.mode === 'year'),
    setMode, setYear, stepYear,
  }
}

export type TimeRange = ReturnType<typeof useTimeRange>
