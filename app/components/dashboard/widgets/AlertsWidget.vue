<template>
  <div class="alerts">
    <NuxtLink v-for="a in alerts" :key="a.to + a.title" :to="a.to" class="alert" :class="a.severity">
      <span class="alert-main">
        <span class="alert-title">{{ a.title }}</span>
        <span class="alert-meta">{{ a.meta }}</span>
      </span>
      <span class="alert-chevron" aria-hidden="true">→</span>
    </NuxtLink>
    <div v-if="state !== 'loading' && !alerts.length && !failed.length && checked.length" class="alert success">
      <span class="alert-main">
        <span class="alert-title">No active escalations</span>
        <span class="alert-meta">Across {{ checked.join(', ') || 'no domains' }}</span>
      </span>
    </div>
    <p v-if="failed.length" class="alerts-note">Could not check: {{ failed.join(', ') }}.</p>
    <p v-if="state === 'loading'" class="alerts-note">Loading alerts…</p>
  </div>
</template>

<script setup lang="ts">
import type { WidgetInstance } from '~/types/dashboard'
import { useWidgetFilters } from '~/composables/useDashboardFilters'
import { useWidgetSources } from '~/composables/useWidgetData'
import { DOMAIN_PERMISSIONS, DOMAIN_SOURCE, SOURCES_BY_ID } from '~/utils/dataSources'
import { DOMAIN_LABELS, type Domain, type DomainPayloads } from '~/utils/metricRegistry'
import { THRESHOLDS, alertSeverity, statusOf, type ThresholdKey } from '~/utils/thresholds'
import { formatValue } from '~/utils/units'

type Severity = 'critical' | 'warning'
interface Alert { severity: Severity; title: string; meta: string; to: string }

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { context } = useWidgetFilters(() => props.instance.id)
const { can } = useViewerContext()
// Only domains the viewer may see - an alert is a leak too.
const domains = computed(() =>
  (['safety', 'fleet', 'rail', 'aviation', 'infra'] as Domain[]).filter(x => can([DOMAIN_PERMISSIONS[x]])))
const withFeeds = computed(() => can([DOMAIN_PERMISSIONS.integrations]))

const sources = useWidgetSources(
  () => [...domains.value.map(x => DOMAIN_SOURCE[x]), ...(withFeeds.value ? ['integrations.feeds'] : [])],
  () => context.value,
)
const { state } = sources

const d = computed<Partial<DomainPayloads>>(() => Object.fromEntries(
  domains.value.map(x => [x, sources.data.value[DOMAIN_SOURCE[x]]]).filter(([, v]) => v != null),
) as Partial<DomainPayloads>)
const feeds = computed(() => (sources.data.value['integrations.feeds'] as { status: string; agency_code: string }[] | undefined) ?? [])
const failed = computed(() => Object.keys(sources.failures.value).map((id) => {
  const dom = domains.value.find(x => DOMAIN_SOURCE[x] === id)
  return dom ? DOMAIN_LABELS[dom] : SOURCES_BY_ID[id]?.source ?? id
}))
const checked = computed(() => domains.value.filter(x => d.value[x] != null).map(x => DOMAIN_LABELS[x]))

// Every alert is a threshold breach from utils/thresholds - the same limits
// that colour the KPI cards and agency rows, so a red card always has a
// matching alert and vice versa.
interface Breach { key: ThresholdKey; value: number | null | undefined; title: (v: string, s: 'critical' | 'warning') => string; meta: string; to: string }

const alerts = computed<Alert[]>(() => {
  const { safety, fleet, infra, rail, aviation } = d.value
  const breaches: Breach[] = []
  if (safety) {
    breaches.push(
      { key: 'safety.active_incidents', value: safety.kpis.active, meta: 'NTSA IRSMS · Live', to: '/safety/incidents',
        title: (v, s) => s === 'critical' ? `${v} active incidents - above threshold` : `${v} active road incidents` },
      { key: 'safety.fatalities_30d', value: safety.kpis.fatal_30d, meta: 'NTSA IRSMS · 30d rolling', to: '/safety/kpis',
        title: (v, s) => s === 'critical' ? `${v} road fatalities in 30 days - exceeds threshold` : `${v} road fatalities (30d) above normal` },
      { key: 'safety.critical_blackspots', value: safety.black_spots_by_tier['critical'] ?? 0, meta: 'NTSA KDE Analysis · Batch', to: '/safety/blackspots',
        title: v => `${v} critical black spots active` },
    )
  }
  if (fleet) {
    breaches.push({ key: 'fleet.governor_tamper_pct', value: fleet.governor_compliance.tamper_rate_pct, meta: 'NTSA iTIMS · Live', to: '/fleet/behaviour',
      title: v => `Speed governor tamper rate: ${v}` })
  }
  if (infra) {
    breaches.push({ key: 'infra.critical_bridges', value: infra.bridges.critical_count, meta: 'BMS · Batch survey', to: '/infrastructure/bridges',
      title: v => `${v} bridges at critical condition` })
  }
  if (rail) {
    breaches.push(
      { key: 'rail.fatal_incidents_90d', value: rail.incidents_90d.fatal, meta: 'KRC Safety · Batch', to: '/railway/safety',
        title: v => `${v} fatal rail incidents (90d)` },
      { key: 'rail.otp_pct', value: rail.on_time_30d.on_time_pct, meta: 'KRC Ops · Live', to: '/railway/schedules',
        title: v => `Rail OTP below benchmark: ${v}` },
    )
  }
  if (aviation) {
    breaches.push({ key: 'aviation.otp_pct', value: aviation.kpis.otp_pct, meta: 'KAA · Live', to: '/aviation/flights',
      title: v => `Aviation OTP below benchmark: ${v}` })
  }

  const list: Alert[] = []
  for (const b of breaches) {
    const severity = alertSeverity(statusOf(b.value, b.key))
    if (severity) list.push({ severity, title: b.title(formatValue(b.value, THRESHOLDS[b.key].unit), severity), meta: b.meta, to: b.to })
  }

  const agencyFilter = context.value.agency
  const off = feeds.value.filter(f => (f.status === 'disconnected' || f.status === 'degraded')
    && (!agencyFilter || (Array.isArray(agencyFilter) ? agencyFilter.includes(f.agency_code) : agencyFilter === f.agency_code)))
  if (off.length) list.push({
    severity: off.some(f => f.status === 'disconnected') ? 'critical' : 'warning',
    title: `${off.length} agency feed(s) offline / degraded`, meta: off.map(f => f.agency_code).join(', '), to: '/integrations/analytics',
  })
  const rank: Record<Severity, number> = { critical: 0, warning: 1 }
  return list.sort((a, b) => rank[a.severity] - rank[b.severity])
})
</script>

<style scoped>
.alerts { display: flex; flex-direction: column; gap: 6px; height: 100%; overflow-y: auto; }
.alert {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: var(--r-sm);
  border: 1px solid var(--border-subtle); background: var(--surface-2); color: inherit; text-decoration: none;
}
.alert::before { content: ''; width: 7px; height: 7px; border-radius: var(--r-pill); flex-shrink: 0; background: var(--fg-3); }
.alert.critical { background: var(--danger-bg); border-color: color-mix(in srgb, var(--danger-fg) 26%, transparent); }
.alert.critical::before { background: var(--destructive); }
.alert.warning { background: var(--warning-bg); border-color: color-mix(in srgb, var(--warning-fg) 26%, transparent); }
.alert.warning::before { background: var(--warning); }
.alert.success { background: var(--success-bg); border-color: color-mix(in srgb, var(--success-fg) 26%, transparent); }
.alert.success::before { background: var(--success); }
/* Touch devices fire hover on tap - only real pointers get the hover state. */
@media (hover: hover) and (pointer: fine) {
  a.alert:hover { border-color: var(--border-interactive); }
  a.alert:hover .alert-chevron { color: var(--primary); transform: translateX(3px); }
}
a.alert:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.alert-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.alert-title { font-size: 11.5px; font-weight: 600; color: var(--fg-1); line-height: 1.4; }
.alert-meta { font-size: 10px; color: var(--fg-3); margin-top: 2px; font-family: var(--font-mono); }
.alert-chevron { font-size: 12px; color: var(--fg-3); transition: transform var(--dur-base) var(--ease-out); }
.alerts-note { font-size: 11px; color: var(--fg-3); margin: 2px 0 0; }
</style>
