<template>
  <!--
    One agency's snapshot, driven by config.agency. Agencies with a live
    feed get real rows (same fields as the Command Centre drill-down cards);
    agencies without one say so rather than showing hard-coded figures.
  -->
  <div class="agency" role="group" :aria-label="spec.title">
    <div class="agency-head">
      <button type="button" class="agency-title" :class="{ active: selected }" :aria-pressed="selected" @click="pick">
        {{ spec.title }}
      </button>
      <span class="agency-tag">{{ spec.tag }}</span>
    </div>

    <template v-if="spec.domains.length">
      <WidgetState v-if="!hasData" :state="state" :source="agency" @retry="reload" />
      <template v-else>
        <div v-for="r in rows" :key="r.label" class="agency-row">
          <span class="agency-row-label">{{ r.label }}</span>
          <span class="badge agency-val" :class="STATUS_CLASS[r.status]">{{ r.value }}</span>
        </div>
        <p v-if="missing.length" class="agency-muted">Not shown: {{ missing.join(', ') }} feed unavailable.</p>
      </template>
    </template>
    <p v-else class="agency-muted">No live feed connected for {{ agency }} yet. Figures appear here once its Integration Hub feed is onboarded.</p>

    <NuxtLink :to="spec.to" class="agency-link">Open {{ agency }} workspace →</NuxtLink>
  </div>
</template>

<script setup lang="ts">
import type { WidgetInstance } from '~/types/dashboard'
import { useWidgetFilters } from '~/composables/useDashboardFilters'
import { useWidgetSources } from '~/composables/useWidgetData'
import { DOMAIN_SOURCE } from '~/utils/dataSources'
import { DOMAIN_LABELS, type Domain, type DomainPayloads } from '~/utils/metricRegistry'
import { THRESHOLDS, statusOf, type Status, type ThresholdKey } from '~/utils/thresholds'
import { formatValue } from '~/utils/units'
import WidgetState from '~/components/dashboard/WidgetState.vue'

/**
 * A row's status comes from its own value crossing a shared threshold
 * (utils/thresholds) - the same one the KPI cards and alerts use, so the
 * three can't disagree. Rows with no threshold (counts, throughput) are
 * neutral, never coloured by position.
 */
interface Row { label: string; value: string; status: Status }
const STATUS_CLASS: Record<Status, string> = { healthy: 'success', warning: 'warning', critical: 'danger', neutral: '' }
const plain = (label: string, value: string): Row => ({ label, value, status: 'neutral' })
const judged = (label: string, v: number | null | undefined, key: ThresholdKey, value = formatValue(v, THRESHOLDS[key].unit)): Row =>
  ({ label, value, status: statusOf(v, key) })
interface Spec { title: string; tag: string; to: string; domains: Domain[]; rows: (d: Partial<DomainPayloads>) => Row[] }

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const agency = computed(() => String(props.config.agency ?? 'NTSA'))
const { context, emit } = useWidgetFilters(() => props.instance.id)

const SPECS: Record<string, Spec> = {
  NTSA: {
    title: 'NTSA - Safety & enforcement', tag: 'Live · iTIMS · IRSMS', to: '/fleet', domains: ['safety', 'fleet'],
    rows: ({ safety, fleet }) => [
      fleet && plain('Vehicle registry (iTIMS)', `${formatValue(fleet.kpis.total_vehicles, 'count')} records`),
      safety && judged('Active road incidents', safety.kpis.active, 'safety.active_incidents'),
      safety && judged('Fatalities (30d)', safety.kpis.fatal_30d, 'safety.fatalities_30d'),
      safety && judged('Critical black spots', safety.black_spots_by_tier['critical'] ?? 0, 'safety.critical_blackspots'),
      fleet && judged('Governor tamper rate', fleet.governor_compliance.tamper_rate_pct, 'fleet.governor_tamper_pct'),
    ].filter((r): r is Row => !!r),
  },
  KeNHA: {
    title: 'KeNHA - Road asset manager', tag: 'REST API · ArcGIS', to: '/traffic', domains: ['infra'],
    rows: ({ infra }) => {
      if (!infra) return []
      const dist = infra.network?.condition_distribution ?? []
      const total = dist.reduce((s, c) => s + (c.length || 0), 0)
      const good = total ? dist.filter(c => c.condition_class === 'good').reduce((s, c) => s + (c.length || 0), 0) / total * 100 : null
      return [
        judged('Network in good condition', good, 'infra.good_condition_pct'),
        plain('Avg IRI score', formatValue(infra.network.iri_average, 'score')),
        judged('Bridges critical', infra.bridges.critical_count, 'infra.critical_bridges',
          `${formatValue(infra.bridges.critical_count, 'count')} / ${formatValue(infra.bridges.total, 'count')}`),
        plain('Maintenance backlog', formatValue(infra.maintenance.open_value_kes, 'kes')),
        plain('At-risk segments (12mo)', formatValue(infra.predictive.at_risk_segments_12mo, 'count')),
      ]
    },
  },
  SDR: {
    title: 'SDR - National roads oversight', tag: 'IFMIS · e-ProMIS', to: '/infrastructure', domains: ['infra'],
    rows: ({ infra }) => infra ? [
      judged('Budget absorption (FY)', infra.budget.utilization_pct, 'infra.budget_absorption_pct'),
      plain('Maintenance backlog (all agencies)', formatValue(infra.maintenance.open_value_kes, 'kes')),
    ] : [],
  },
  KPA: {
    title: 'KPA - Port of Mombasa', tag: 'PMIS · VTMIS', to: '/maritime', domains: ['maritime'],
    rows: ({ maritime }) => {
      if (!maritime) return []
      const ports = maritime.ports ?? []
      const dwell = ports.length ? ports.reduce((s, p) => s + (p.avg_yard_dwell_days || 0), 0) / ports.length : null
      return [
        ...ports.slice(0, 2).map(p => plain(`${p.port_name} TEUs (30d)`, formatValue(p.teu_throughput_30d, 'count'))),
        plain('Live vessels in port', formatValue(maritime.kpis.live_vessels, 'count')),
        judged('Avg yard dwell', dwell, 'maritime.yard_dwell_days'),
      ]
    },
  },
  KMA: {
    title: 'KMA - Kenya Maritime Authority', tag: 'NAV 2018 · Hybrid', to: '/maritime', domains: ['maritime'],
    rows: ({ maritime }) => maritime ? [
      judged('Maritime incidents (30d)', maritime.kpis.incidents_30d, 'maritime.incidents_30d'),
    ] : [],
  },
  KAA: {
    title: 'KAA - Airports authority', tag: 'Live · KAA / KCAA', to: '/aviation', domains: ['aviation'],
    rows: ({ aviation }) => aviation ? [
      plain('Flight movements (7d)', formatValue(aviation.kpis.flights_total, 'count')),
      plain('Passenger throughput (7d)', formatValue(aviation.kpis.pax_total, 'count')),
      judged('On-time performance', aviation.kpis.otp_pct, 'aviation.otp_pct'),
      judged('Avg delay', aviation.kpis.avg_delay_min, 'aviation.avg_delay_min'),
    ] : [],
  },
  KRC: {
    title: 'KRC - Railways corporation', tag: 'SAP S4/HANA · CTC', to: '/railway', domains: ['rail'],
    rows: ({ rail }) => rail ? [
      judged('SGR on-time performance (30d)', rail.on_time_30d.on_time_pct, 'rail.otp_pct'),
      plain('Ridership (30d)', formatValue(rail.ridership_30d.passengers, 'count')),
      plain('Freight tonnage (30d)', formatValue(rail.freight_30d.total_tons, 'tonnes')),
      judged('Avg delay', rail.on_time_30d.avg_delay_min, 'rail.avg_delay_min', formatValue(rail.on_time_30d.avg_delay_min, 'min', 1)),
    ] : [],
  },
}
const fallback = (code: string): Spec => ({
  title: code, tag: 'Awaiting feed', to: '/integrations/analytics', domains: [], rows: () => [],
})
const spec = computed(() => SPECS[agency.value] ?? fallback(agency.value))

const sources = useWidgetSources(() => spec.value.domains.map(d => DOMAIN_SOURCE[d]), () => context.value)
const { state, reload } = sources
const hasData = computed(() => ['ready', 'refreshing', 'partial'].includes(state.value))
const data = computed<Partial<DomainPayloads>>(() =>
  Object.fromEntries(spec.value.domains.map(d => [d, sources.data.value[DOMAIN_SOURCE[d]]]).filter(([, v]) => v != null)) as Partial<DomainPayloads>)
const rows = computed(() => spec.value.rows(data.value))
const missing = computed(() => spec.value.domains.filter(d => sources.failures.value[DOMAIN_SOURCE[d]]).map(d => DOMAIN_LABELS[d]))

const selected = ref(false)
function pick() {
  selected.value = !selected.value
  emit('agency', selected.value ? agency.value : null)
}
</script>

<style scoped>
.agency { display: flex; flex-direction: column; gap: 2px; height: 100%; }
.agency-head { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; margin-bottom: 6px; }
.agency-title { font-size: 12px; font-weight: 700; color: var(--fg-1); background: none; border: 0; padding: 0; cursor: pointer; text-align: left; }
.agency-title.active { color: var(--primary); }
@media (hover: hover) and (pointer: fine) {
  .agency-title:hover { color: var(--primary); }
}
.agency-title:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.agency-tag {
  font-family: var(--font-mono); font-size: 8.5px; padding: 2px 6px; border-radius: var(--r-xs); background: var(--surface-1);
  color: var(--fg-3); border: 1px solid var(--border-subtle); letter-spacing: .04em; white-space: nowrap; text-transform: uppercase;
}
.agency-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 5px 0; border-bottom: 1px solid var(--border-subtle); }
.agency-row:last-of-type { border-bottom: none; }
.agency-row-label { font-size: 10.5px; color: var(--fg-2); }
.agency-muted { font-size: 11px; color: var(--fg-3); padding: 4px 0; line-height: 1.5; }
.agency-link {
  margin-top: auto; padding-top: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
  color: var(--primary); text-decoration: none;
}
.agency-link:hover { text-decoration: underline; text-underline-offset: 3px; }
/* Colours come from the global .badge.success/.warning/.danger; values are figures, so mono. */
.agency-val { font-family: var(--font-mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
