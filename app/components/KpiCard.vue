<template>
  <!--
    KpiCard - the UAPTS command-centre KPI tile.

    Answers, in reading order:
      1. What is the value?            label + period badge, then the big figure
      2. Good / warning / critical /   semantic status marker + explicit label
         neutral / unavailable?
      3. What is the target?           actual-vs-target bullet bar (only when a
                                       real target exists)
      4. Improving or worsening?       bottom comparison line - arrow + delta +
                                       comparison period, coloured by whether the
                                       move is *favorable* (never "up = good")
      5. What period does it cover?    period badge, always shown

    Honest-data contract: `unavailable` renders a "-" placeholder + "NO DATA"
    + the reason. A failed feed or a null field must never read as "0", and no
    trend / bullet bar / comparison is drawn for it.

    Drill-down: `to="#section-id"` scrolls to that section on the same page
    (with `filter`, applies a filter via the URL query + `activate` event);
    `to="/route"` navigates. Informational cards (no `to`) get no pointer and
    no hover motion.
  -->
  <component
    :is="rootComp"
    :to="isRouteLink ? to : undefined"
    :href="isAnchor ? to : undefined"
    :role="isAnchor ? 'link' : undefined"
    :aria-label="ariaLabelResolved"
    :tabindex="isLink && loading ? -1 : undefined"
    :aria-disabled="isLink && loading ? 'true' : undefined"
    class="kpi-card"
    :class="[
      statusRootClass,
      {
        'kpi-card--link': isLink,
        'kpi-card--loading': loading,
        'kpi-card--unavailable': isUnavailable,
        'kpi-card--prominent': prominent,
      },
    ]"
    @click="onRootClick"
  >
    <div class="kpi-card__head">
      <span class="kpi-card__label" :class="{ 'kpi-card__label--with-icon': icon }">
        <component :is="icon" v-if="icon" :size="13" class="kpi-card__icon" aria-hidden="true" />
        <slot name="label">{{ label }}</slot>
        <abbr v-if="abbr" class="kpi-card__abbr" :title="abbrTitle || undefined">{{ abbr }}</abbr>
      </span>
      <span
        v-if="period"
        class="kpi-card__period"
        :class="{ 'kpi-card__period--subtle': subtlePeriod, 'kpi-card__period--live': subtlePeriod && isLivePeriod }"
      >
        <span v-if="subtlePeriod && isLivePeriod" class="kpi-card__live-dot" aria-hidden="true" />
        {{ period }}
      </span>
    </div>

    <div class="kpi-card__value">
      <slot>
        <template v-if="isUnavailable">-</template>
        <template v-else>{{ value }}<span
          v-if="unit"
          class="kpi-card__unit"
        ><abbr v-if="unitTitle" :title="unitTitle">{{ unit }}</abbr><template v-else>{{ unit }}</template></span></template>
      </slot>
    </div>

    <p v-if="isUnavailable" class="kpi-card__reason">
      <span class="kpi-card__reason-tag">No data</span>
      <span v-if="reasonText" class="kpi-card__reason-why">· {{ reasonText }}</span>
    </p>
    <p v-else-if="descriptionText" class="kpi-card__description">{{ descriptionText }}</p>

    <Sparkline
      v-if="!isUnavailable && series && series.length > 1"
      :points="series"
      :tone="sparkTone"
      class="kpi-card__spark"
    />

    <div v-if="bullet" class="kpi-card__bullet">
      <div class="kpi-card__bullet-track" role="img" :aria-label="bulletAriaLabel">
        <div class="kpi-card__bullet-fill" :style="{ transform: `scaleX(${bullet.fill})` }" />
        <span class="kpi-card__bullet-marker" :style="{ left: `${bullet.target}%` }" />
      </div>
      <div class="kpi-card__bullet-meta">
        <span>{{ targetLabel || 'Target' }}</span>
        <span class="kpi-card__bullet-val">{{ target }}</span>
      </div>
    </div>
    <p v-else-if="target != null && target !== '' && !isUnavailable" class="kpi-card__target">
      {{ targetLabel || 'Target' }} <span class="kpi-card__target-val">{{ target }}</span>
    </p>

    <div class="kpi-card__foot">
      <div v-if="resolvedStatus" class="kpi-card__status">
        <span class="kpi-card__status-dot" aria-hidden="true" />
        <span>{{ statusLabelResolved }}</span>
      </div>

      <div
        v-if="comparison && !isUnavailable"
        class="kpi-card__comparison"
        :class="`is-${comparisonIntent}`"
      >
        <span class="kpi-card__comparison-arrow" aria-hidden="true">{{ comparisonArrow }}</span>
        <span>{{ comparison.value }}</span>
        <span v-if="comparison.period" class="kpi-card__comparison-period">{{ comparison.period }}</span>
      </div>
    </div>

    <span v-if="isLink" class="kpi-card__chevron" aria-hidden="true">&rarr;</span>
  </component>
</template>

<script setup lang="ts">
import { resolveComponent, nextTick } from 'vue'
import type { Component } from 'vue'

/** Spec status vocabulary. */
type Status = 'critical' | 'warning' | 'healthy' | 'neutral' | 'unavailable'
/** Accepted-but-deprecated aliases from earlier iterations of this component. */
type StatusAlias =
  | 'ontarget' | 'below' | 'monitoring' | 'nodata'  // interim set
  | 'good' | 'warn' | 'crit' | 'info'               // original set
type TrendDirection = 'up' | 'down' | 'flat'

const props = withDefaults(defineProps<{
  /** Compact uppercase metric name. */
  label?: string
  /** Formatted display value, e.g. "44,506", "47.0", "KES 522.9M". */
  value?: string | number
  /** Optional unit rendered visually subordinate to the value, e.g. "%", "min", "TEU". */
  unit?: string
  /** Tooltip explaining an unfamiliar unit abbreviation (TEU, IRI…). */
  unitTitle?: string
  /** One short context line under the value. */
  description?: string
  /** Time window the value covers: "LIVE" | "24H" | "7D" | "30D" | … Always shown. */
  period?: string

  /** Semantic state. Aliases (good/warn/crit/info, ontarget/below/monitoring/nodata) still accepted. */
  status?: Status | StatusAlias
  /** Override the derived status word. */
  statusLabel?: string

  /** Display target value - shows a "Target X" line even without a bullet bar. */
  target?: string | number
  /** Label for the target, default "Target". */
  targetLabel?: string
  /** Actual-vs-target bullet bar. Provide only when the target is real. */
  progress?: { min: number; max: number; current: number; target: number }

  /** Comparison delta text, e.g. "+252", "4.2 pp". */
  comparisonValue?: string
  /** Comparison period text, e.g. "vs prior 30 days". */
  comparisonPeriod?: string
  /** Arrow direction for the comparison. */
  trendDirection?: TrendDirection
  /** Is that direction good news for THIS metric? (never assumed) */
  trendFavorable?: boolean

  /** Real series only, oldest first. */
  series?: number[]

  /** Feed unreadable / value genuinely absent - render "-" + NO DATA, never "0". */
  unavailable?: boolean
  /** Why the data is missing, shown after "NO DATA" when known. */
  unavailableReason?: string
  loading?: boolean

  /** `#section-id` scrolls in-page; `/route` navigates; empty = informational. */
  to?: string
  /** Filter to apply to an in-page drill target. */
  filter?: Record<string, string | number>
  /** Descriptive accessible name for a linked card (else auto-composed). */
  ariaLabel?: string
  /** Explained via tooltip after the label. */
  abbr?: string
  abbrTitle?: string
  /** Enlarge the figure - for the flagship six-KPI ribbon. */
  prominent?: boolean
  /** Small monochrome icon rendered before the label - opt-in, no default. */
  icon?: Component
  /** Replace the bordered period pill with understated text (a dot for LIVE). Opt-in. */
  subtlePeriod?: boolean

  // ── deprecated, still honoured ──────────────────────────────────────
  /** @deprecated use `description`. */
  sub?: string
  /** @deprecated use `unavailableReason`. */
  unavailableNote?: string
  /** @deprecated use comparison* props. */
  delta?: { value: string; direction?: TrendDirection; label?: string; intent?: 'good' | 'bad' | 'neutral' }
  /** @deprecated use `comparisonValue` + `trendDirection`. */
  trend?: string
  /** @deprecated feed attribution now lives in the section header. */
  source?: 'live' | 'batch' | 'manual'
  /** @deprecated */
  sourceTitle?: string
  /** @deprecated */
  sourceLabel?: string
}>(), {
  label: '',
  value: '',
  unit: '',
  unitTitle: '',
  description: '',
  period: '',
  status: undefined,
  statusLabel: '',
  target: undefined,
  targetLabel: '',
  progress: undefined,
  comparisonValue: '',
  comparisonPeriod: '',
  trendDirection: undefined,
  trendFavorable: undefined,
  series: undefined,
  unavailable: false,
  unavailableReason: '',
  loading: false,
  to: '',
  filter: undefined,
  ariaLabel: '',
  abbr: '',
  abbrTitle: '',
  prominent: false,
  icon: undefined,
  subtlePeriod: false,
  sub: '',
  unavailableNote: '',
  delta: undefined,
  trend: '',
  source: undefined,
  sourceTitle: '',
  sourceLabel: '',
})

const emit = defineEmits<{
  /** Fired on click of an in-page (`#…`) drill-down, with the filter payload. */
  (e: 'activate', filter: Record<string, string | number> | undefined): void
}>()

const router = useRouter()
const route = useRoute()
// `<component :is="'NuxtLink'">` with a bare string does not reliably resolve,
// which silently breaks navigation - resolve to the real component here.
const NuxtLinkComp = resolveComponent('NuxtLink')

const isAnchor = computed(() => props.to.startsWith('#'))
const isLink = computed(() => !!props.to)
const isRouteLink = computed(() => isLink.value && !isAnchor.value)
const rootComp = computed(() => {
  if (!props.to) return 'div'
  return isAnchor.value ? 'a' : NuxtLinkComp
})

function drillToAnchor() {
  if (props.loading) return
  const id = props.to.slice(1)
  if (props.filter && Object.keys(props.filter).length) {
    router.replace({ query: { ...route.query, ...props.filter } })
  }
  emit('activate', props.filter)
  nextTick(() => {
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    el.classList.add('kpi-drill-flash')
    window.setTimeout(() => el.classList.remove('kpi-drill-flash'), 1100)
  })
}

function onRootClick(e: MouseEvent) {
  if (isAnchor.value) {
    e.preventDefault()
    drillToAnchor()
    return
  }
  if (isRouteLink.value && typeof rootComp.value === 'string' && !e.defaultPrevented) {
    e.preventDefault()
    router.push(props.to)
  }
}

// ── Status ───────────────────────────────────────────────────────────
const STATUS_ALIASES: Record<Status | StatusAlias, Status> = {
  critical: 'critical', warning: 'warning', healthy: 'healthy', neutral: 'neutral', unavailable: 'unavailable',
  ontarget: 'healthy', below: 'warning', monitoring: 'neutral', nodata: 'unavailable',
  good: 'healthy', warn: 'warning', crit: 'critical', info: 'neutral',
}

const isUnavailable = computed(() =>
  props.unavailable || props.status === 'unavailable' || props.status === 'nodata',
)

const resolvedStatus = computed<Status | null>(() => {
  if (isUnavailable.value) return 'unavailable'
  if (!props.status) return null
  return STATUS_ALIASES[props.status] ?? null
})
const statusRootClass = computed(() => (resolvedStatus.value ? `is-${resolvedStatus.value}` : ''))

const STATUS_WORDS: Record<Status, string> = {
  critical: 'Critical',
  warning: 'Warning',
  healthy: 'On target',
  neutral: 'Monitoring',
  unavailable: 'No data',
}
const statusLabelResolved = computed(() =>
  props.statusLabel || (resolvedStatus.value ? STATUS_WORDS[resolvedStatus.value] : ''),
)

// ── Period ───────────────────────────────────────────────────────────
const isLivePeriod = computed(() => props.period.trim().toUpperCase() === 'LIVE')

// ── Text fields (with legacy aliases) ────────────────────────────────
const descriptionText = computed(() => props.description || props.sub || '')
const reasonText = computed(() => props.unavailableReason || props.unavailableNote || '')

// ── Comparison ───────────────────────────────────────────────────────
interface Comparison { value: string; period: string; direction: TrendDirection; favorable: boolean | undefined }
const comparison = computed<Comparison | null>(() => {
  if (props.comparisonValue) {
    return {
      value: props.comparisonValue,
      period: props.comparisonPeriod,
      direction: props.trendDirection ?? 'flat',
      favorable: props.trendFavorable,
    }
  }
  if (props.delta) {
    return {
      value: props.delta.value,
      period: props.delta.label ?? '',
      direction: props.delta.direction ?? 'flat',
      favorable: props.delta.intent === 'good' ? true : props.delta.intent === 'bad' ? false : undefined,
    }
  }
  if (props.trend) {
    return { value: props.trend, period: '', direction: 'flat', favorable: undefined }
  }
  return null
})
const comparisonIntent = computed<'good' | 'bad' | 'neutral'>(() => {
  const c = comparison.value
  if (!c || c.direction === 'flat') return 'neutral'
  if (c.favorable === true) return 'good'
  if (c.favorable === false) return 'bad'
  return 'neutral'
})
const comparisonArrow = computed(() => {
  const d = comparison.value?.direction
  return d === 'down' ? '▼' : d === 'up' ? '▲' : '▬'
})

// ── Bullet bar ───────────────────────────────────────────────────────
const bullet = computed(() => {
  if (isUnavailable.value || !props.progress) return null
  const { min, max, current, target } = props.progress
  const range = max - min || 1
  const pct = (n: number) => Math.max(0, Math.min(100, ((n - min) / range) * 100))
  return { fill: (pct(current) / 100).toFixed(4), target: pct(target).toFixed(2) }
})
const bulletAriaLabel = computed(() => {
  if (!props.progress) return undefined
  return `Current ${props.progress.current}, target ${props.progress.target}, range ${props.progress.min} to ${props.progress.max}`
})

// ── Sparkline tone (component still uses its own token names) ─────────
const sparkTone = computed<'neutral' | 'critical' | 'below' | 'ontarget' | 'monitoring'>(() => {
  switch (resolvedStatus.value) {
    case 'critical': return 'critical'
    case 'warning': return 'below'
    case 'healthy': return 'ontarget'
    case 'neutral': return 'monitoring'
    default: return 'neutral'
  }
})

// ── Accessible name for linked cards ─────────────────────────────────
const ariaLabelResolved = computed(() => {
  if (props.ariaLabel) return props.ariaLabel
  if (!isLink.value) return undefined
  const val = isUnavailable.value
    ? 'no data available'
    : `${props.value}${props.unit ? ' ' + props.unit : ''}`
  const bits = [`${props.label}: ${val}`]
  if (resolvedStatus.value) bits.push(statusLabelResolved.value.toLowerCase())
  const c = comparison.value
  if (c && !isUnavailable.value) bits.push(`${c.value} ${c.period}`.trim())
  const verb = isAnchor.value ? 'Scroll to the related section.' : 'Opens the workspace.'
  return `${bits.join(', ')}. ${verb}`
})
</script>

<style scoped>
.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 13px 14px;
  min-height: 128px;
  position: relative;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  transition: border-color var(--dur-base) var(--ease-out),
              background-color var(--dur-base) var(--ease-out);
}
.kpi-card--prominent { min-height: 150px; }

/* Semantic state is a 1px top rule + a marked, labelled status line -
   never a full-card colour flood. */
.kpi-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: var(--border-strong);
}
.kpi-card.is-healthy::before     { background: var(--success); }
.kpi-card.is-warning::before     { background: var(--warning); }
.kpi-card.is-critical::before    { background: var(--destructive); }
.kpi-card.is-neutral::before     { background: var(--info); }
.kpi-card.is-unavailable::before { background: var(--border-strong); }

/* Hover feedback only on cards that actually go somewhere. */
.kpi-card--link { cursor: pointer; }
.kpi-card--link:hover {
  background: var(--surface-1);
  border-color: var(--border-interactive);
}
.kpi-card--link:hover::before { height: 2px; }
.kpi-card--link:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.kpi-card--loading { opacity: 0.65; pointer-events: none; }

.kpi-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.kpi-card__label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-3);
  line-height: 1.4;
}
.kpi-card__label--with-icon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.kpi-card__icon {
  flex-shrink: 0;
  color: var(--fg-3);
}
.kpi-card__abbr {
  margin-left: 5px;
  font-size: 9px;
  font-weight: 600;
  color: var(--fg-3);
  text-decoration: underline dotted;
  text-underline-offset: 2px;
  cursor: help;
}
.kpi-card__period {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--fg-3);
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-xs);
  padding: 1px 5px;
  white-space: nowrap;
}
/* Understated alternative to the bordered pill above - opt-in via
   `subtlePeriod`, for card rows where six boxed badges read as clutter. */
.kpi-card__period--subtle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
}
.kpi-card__period--live { color: var(--success-fg); }
.kpi-card__live-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--r-pill);
  background: var(--success);
  flex-shrink: 0;
  animation: kpiLiveDot 2.2s ease-in-out infinite;
}

.kpi-card__value {
  font-family: var(--font-mono);
  font-size: clamp(1.3rem, 1.05rem + 0.7vw, 1.6rem);
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--fg-1);
  font-variant-numeric: tabular-nums;
  margin-top: 4px;
  word-break: break-word;
}
.kpi-card--prominent .kpi-card__value {
  font-size: clamp(1.6rem, 1.15rem + 1.3vw, 2.1rem);
  margin-top: 6px;
}
.kpi-card--unavailable .kpi-card__value {
  color: var(--fg-3);
  font-size: 1.4rem;
  line-height: 1;
  margin-top: 2px;
}
.kpi-card__unit {
  font-size: 0.5em;
  font-weight: 600;
  color: var(--fg-3);
  letter-spacing: 0;
  margin-left: 3px;
}
.kpi-card__unit abbr { text-decoration: underline dotted; text-underline-offset: 2px; cursor: help; }

.kpi-card__description {
  font-size: 11.5px;
  color: var(--fg-3);
  line-height: 1.4;
  margin: 0;
  max-width: 42ch;
}

.kpi-card__reason {
  font-size: 10px;
  color: var(--danger-fg);
  margin: 3px 0 0;
  line-height: 1.4;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.kpi-card__reason-tag { font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.kpi-card__reason-why { color: var(--fg-3); }

.kpi-card__spark { margin-top: 8px; }

/* ── Actual-vs-target bullet bar ── */
.kpi-card__bullet { margin-top: 9px; }
.kpi-card__bullet-track {
  position: relative;
  height: 5px;
  border-radius: var(--r-pill);
  background: var(--surface-sunken);
}
.kpi-card__bullet-fill {
  position: absolute;
  inset: 0 0 0 0;
  transform-origin: left center;
  transform: scaleX(0);
  border-radius: var(--r-pill);
  background: var(--border-strong);
  transition: transform var(--dur-slow) var(--ease-out);
}
.kpi-card.is-healthy  .kpi-card__bullet-fill { background: var(--success); }
.kpi-card.is-warning  .kpi-card__bullet-fill { background: var(--warning); }
.kpi-card.is-critical .kpi-card__bullet-fill { background: var(--destructive); }
.kpi-card.is-neutral  .kpi-card__bullet-fill { background: var(--info); }
.kpi-card__bullet-marker {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 2px;
  margin-left: -1px;
  background: var(--fg-1);
  border-radius: 1px;
}
.kpi-card__bullet-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-3);
}
.kpi-card__bullet-val { color: var(--fg-2); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.kpi-card__target {
  font-size: 10px;
  color: var(--fg-3);
  margin: 5px 0 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}
.kpi-card__target-val { color: var(--fg-2); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

/* ── Footer: status label + comparison, pinned to the bottom ── */
.kpi-card__foot {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 8px;
}
.kpi-card__status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--fg-2);
}
.kpi-card__status-dot {
  width: 5px;
  height: 5px;
  border-radius: var(--r-pill);
  background: currentColor;
  flex-shrink: 0;
}
.kpi-card.is-healthy   .kpi-card__status { color: var(--success-fg); }
.kpi-card.is-warning   .kpi-card__status { color: var(--warning-fg); }
.kpi-card.is-critical  .kpi-card__status { color: var(--danger-fg); }
.kpi-card.is-critical  .kpi-card__status-dot { animation: kpiPulse 1.6s ease-in-out infinite; }
.kpi-card.is-neutral   .kpi-card__status { color: var(--info-fg); }
.kpi-card.is-unavailable .kpi-card__status { color: var(--fg-3); }

.kpi-card__comparison {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
.kpi-card__comparison.is-good    { color: var(--success-fg); }
.kpi-card__comparison.is-bad     { color: var(--danger-fg); }
.kpi-card__comparison.is-neutral { color: var(--fg-2); }
.kpi-card__comparison-arrow { font-size: 8px; }
.kpi-card__comparison-period { color: var(--fg-3); font-weight: 500; }

.kpi-card__chevron {
  position: absolute;
  right: 11px;
  bottom: 10px;
  font-size: 13px;
  color: var(--fg-3);
  opacity: 0;
  transform: translateX(-2px);
  transition: transform var(--dur-base) var(--ease-out), opacity var(--dur-fast) var(--ease-standard), color var(--dur-base) var(--ease-out);
}
.kpi-card--link:hover .kpi-card__chevron,
.kpi-card--link:focus-visible .kpi-card__chevron {
  opacity: 1;
  transform: translateX(0);
  color: var(--primary);
}

@keyframes kpiPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes kpiLiveDot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@media (prefers-reduced-motion: reduce) {
  .kpi-card.is-critical .kpi-card__status-dot { animation: none; }
  .kpi-card__live-dot { animation: none; }
  .kpi-card__bullet-fill { transition: none; }
}
</style>
