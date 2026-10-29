/**
 * useTimeRange - the selected reporting window for one module.
 *
 *   const range = useTimeRange('aviation', { default: '7d' })
 *   range.days.value      // 1 | 7 | 30, or the length of the chosen year
 *   range.from.value      // 'YYYY-MM-DD' (EAT)
 *   range.query.value     // { days } for a preset, { date_from, date_to } for a year / custom period
 *   <TimeRangeSelector :range="range" @change="load" />
 *
 * The state is keyed by module, so choosing "30 Days" on one Aviation page is
 * still chosen on the next Aviation page, and it survives navigating away and
 * back within the session. A reload starts from the module's default again.
 * Different modules keep independent selections.
 */
import { computed } from 'vue'
import {
  clampYear, currentYear, eatDate, isRangeMode, periodBadge, rangeBounds, rangeQuery,
  type RangeMode, type RangePreset, type RangeSelection,
} from '~/utils/timeRange'

export interface UseTimeRangeOptions {
  default?: RangePreset
  /** Offer the year view (only for data whose endpoint takes `date_from` / `date_to`). */
  years?: boolean
  /** Offer a free from/to period (for data an agency may hold years of). */
  custom?: boolean
}

export function useTimeRange(key: string, opts: UseTimeRangeOptions = {}) {
  const state = useState<RangeSelection>(`timerange:${key}`, () => ({ mode: opts.default ?? '7d', year: currentYear() }))

  // The selection is shared across a module's pages. A page whose data cannot answer a
  // past year falls back to a preset instead of sending a year-long window to an endpoint that
  // only understands "the last N days".
  const unsupported = (m: RangeSelection['mode']) => (m === 'year' && !opts.years) || (m === 'custom' && !opts.custom)
  const effective = computed<RangeSelection>(() =>
    unsupported(state.value.mode) ? { mode: opts.default ?? '30d', year: state.value.year } : state.value)
  const mode = computed(() => effective.value.mode)
  const year = computed(() => effective.value.year)
  const bounds = computed(() => rangeBounds(effective.value))

  function setMode(next: RangeMode) {
    if (!isRangeMode(next) || unsupported(next)) return
    // Entering custom from a preset starts from what the user was already looking at.
    if (next === 'custom' && !state.value.from) {
      const b = rangeBounds(effective.value)
      // A preset's `from` is N days back (N + 1 calendar days inclusive); trim it to N so the
      // custom pickers show the same number of days the preset did.
      const from = effective.value.mode === 'year' ? b.from : eatDate(new Date(Date.parse(`${b.to}T00:00:00Z`) - (b.days - 1) * 86_400_000))
      state.value = { ...state.value, mode: 'custom', from, to: b.to }
      return
    }
    state.value = { ...state.value, mode: next }
  }
  function setCustom(from: string, to: string) {
    if (!opts.custom) return
    state.value = { ...state.value, mode: 'custom', from, to }
  }
  function setYear(y: number) {
    state.value = { mode: 'year', year: clampYear(y) }
  }
  function stepYear(delta: number) { setYear(state.value.year + delta) }

  return {
    key,
    /** Whether the year view is offered for this data. */
    years: !!opts.years,
    /** Whether a custom from/to period is offered for this data. */
    custom: !!opts.custom,
    /** The latest day a custom period may end on (today, EAT). */
    today: computed(() => eatDate(new Date())),
    mode, year,
    days: computed(() => bounds.value.days),
    from: computed(() => bounds.value.from),
    to: computed(() => bounds.value.to),
    label: computed(() => bounds.value.label),
    endsToday: computed(() => bounds.value.endsToday),
    /** Badge text for KpiCard `period`. */
    period: computed(() => periodBadge(effective.value)),
    isYear: computed(() => effective.value.mode === 'year'),
    isCustom: computed(() => effective.value.mode === 'custom'),
    /** Period parameters for endpoints on the shared period contract (see `rangeQuery`). */
    query: computed(() => rangeQuery(effective.value)),
    setMode, setYear, stepYear, setCustom,
  }
}

export type TimeRange = ReturnType<typeof useTimeRange>
