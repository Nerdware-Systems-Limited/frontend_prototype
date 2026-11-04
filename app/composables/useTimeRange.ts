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
 *
 * Global scope: a module the user has NOT touched follows the system-wide range set
 * from the top nav (useGlobalScope). The first time they pick a range here it becomes
 * this module's own (`isOverridden`), and `reset()` hands it back to the global one.
 */
import { computed } from 'vue'
import { useGlobalScope } from '~/composables/useGlobalScope'
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
  type ModuleState = RangeSelection & { overridden?: boolean }
  const state = useState<ModuleState>(`timerange:${key}`, () => ({ mode: opts.default ?? '7d', year: currentYear() }))
  const global = useGlobalScope()
  // Which selection is in force: this module's own once chosen, else the global one if set.
  const source = computed<RangeSelection>(() =>
    !state.value.overridden && global.range.value ? global.range.value : state.value)

  // The selection is shared across a module's pages. A page whose data cannot answer a
  // past year falls back to a preset instead of sending a year-long window to an endpoint that
  // only understands "the last N days".
  const unsupported = (m: RangeSelection['mode']) => (m === 'year' && !opts.years) || (m === 'custom' && !opts.custom)
  const effective = computed<RangeSelection>(() =>
    unsupported(source.value.mode) ? { mode: opts.default ?? '30d', year: source.value.year } : source.value)
  const mode = computed(() => effective.value.mode)
  const year = computed(() => effective.value.year)
  const bounds = computed(() => rangeBounds(effective.value))

  // The first edit on a module starts from what it was showing (possibly the global range) and
  // pins it as this module's own.
  function adopt() {
    if (state.value.overridden) return
    state.value = { ...(global.range.value ?? state.value), overridden: true }
  }

  function setMode(next: RangeMode) {
    if (!isRangeMode(next) || unsupported(next)) return
    adopt()
    // Entering custom from a preset starts from what the user was already looking at.
    if (next === 'custom' && !state.value.from) {
      const b = rangeBounds(effective.value)
      // A preset's `from` is N days back (N + 1 calendar days inclusive); trim it to N so the
      // custom pickers show the same number of days the preset did.
      const from = effective.value.mode === 'year' ? b.from : eatDate(new Date(Date.parse(`${b.to}T00:00:00Z`) - (b.days - 1) * 86_400_000))
      state.value = { ...state.value, mode: 'custom', from, to: b.to, overridden: true }
      return
    }
    state.value = { ...state.value, mode: next }
  }
  function setCustom(from: string, to: string) {
    if (!opts.custom) return
    adopt()
    state.value = { ...state.value, mode: 'custom', from, to, overridden: true }
  }
  function setYear(y: number) {
    state.value = { mode: 'year', year: clampYear(y), overridden: true }
  }
  function stepYear(delta: number) { setYear(effective.value.year + delta) }
  /** Drop this module's own choice and follow the global range (or the module default) again. */
  function reset() { state.value = { mode: opts.default ?? '7d', year: currentYear() } }

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
    /** The range in force, in the shared RangeSelection shape (what the global scope stores). */
    selection: computed<RangeSelection>(() => ({ ...effective.value })),
    /** True when this module follows the global range rather than its own choice. */
    isGlobal: computed(() => !state.value.overridden && !!global.range.value),
    /** True when this module's own choice is in force. */
    isOverridden: computed(() => !!state.value.overridden),
    setMode, setYear, stepYear, setCustom, reset,
  }
}

export type TimeRange = ReturnType<typeof useTimeRange>
