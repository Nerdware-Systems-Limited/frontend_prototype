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
      <div v-if="loading && !rows.length" class="agency-muted">Loading {{ agency }} data…</div>
      <div v-else-if="failed" class="agency-muted">{{ agency }} feed unavailable - retry to refresh</div>
      <div v-for="r in rows" v-else :key="r.label" class="agency-row">
        <span class="agency-row-label">{{ r.label }}</span>
        <span class="badge" :class="r.tone">{{ r.value }}</span>
      </div>
    </template>
    <p v-else class="agency-muted">No live feed connected for {{ agency }} yet. Figures appear here once its Integration Hub feed is onboarded.</p>

    <NuxtLink :to="spec.to" class="agency-link">Open {{ agency }} workspace →</NuxtLink>
  </div>
</template>

<script setup lang="ts">
import type { WidgetInstance } from '~/types/dashboard'
import { loadDomain } from '~/composables/useDomainData'
import { useWidgetFilters } from '~/composables/useDashboardFilters'
import { fmtKsh, fmtNum, fmtPct, type Domain, type DomainPayloads } from '~/utils/metricRegistry'

type Tone = 'good' | 'warn' | 'crit' | 'info'
interface Row { label: string; value: string; tone: Tone }
interface Spec { title: string; tag: string; to: string; domains: Domain[]; rows: (d: Partial<DomainPayloads>) => Row[] }

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const agency = computed(() => String(props.config.agency ?? 'NTSA'))
const { context, emit } = useWidgetFilters(() => props.instance.id)
const tick = inject<Ref<number>>('dashboard:refreshTick', ref(0))

const SPECS: Record<string, Spec> = {
  NTSA: {
    title: 'NTSA - Safety & enforcement', tag: 'Live · iTIMS · IRSMS', to: '/fleet', domains: ['safety', 'fleet'],
    rows: ({ safety, fleet }) => [
      fleet && { label: 'Vehicle registry (iTIMS)', value: `${fmtNum(fleet.kpis.total_vehicles)} records`, tone: 'info' as Tone },
      safety && { label: 'Active road incidents', value: fmtNum(safety.kpis.active), tone: (safety.kpis.active > 10 ? 'crit' : safety.kpis.active > 5 ? 'warn' : 'good') as Tone },
      safety && { label: 'Fatalities (30d)', value: fmtNum(safety.kpis.fatal_30d), tone: 'crit' as Tone },
      safety && { label: 'Critical black spots', value: fmtNum(safety.black_spots_by_tier['critical'] ?? 0), tone: 'warn' as Tone },
      fleet && { label: 'Governor tamper rate', value: fmtPct(fleet.governor_compliance.tamper_rate_pct), tone: (fleet.governor_compliance.tamper_rate_pct < 5 ? 'good' : 'warn') as Tone },
    ].filter(Boolean) as Row[],
  },
  KeNHA: {
    title: 'KeNHA - Road asset manager', tag: 'REST API · ArcGIS', to: '/traffic', domains: ['infra'],
    rows: ({ infra }) => {
      if (!infra) return []
      const dist = infra.network?.condition_distribution ?? []
      const total = dist.reduce((s, c) => s + (c.length || 0), 0)
      const good = total ? dist.filter(c => c.condition_class === 'good').reduce((s, c) => s + (c.length || 0), 0) / total * 100 : null
      return [
        { label: 'Network in good condition', value: fmtPct(good), tone: good != null && good >= 60 ? 'good' : 'warn' },
        { label: 'Avg IRI score', value: infra.network.iri_average?.toFixed(2) ?? '-', tone: 'info' },
        { label: 'Bridges critical', value: `${fmtNum(infra.bridges.critical_count)} / ${fmtNum(infra.bridges.total)}`, tone: infra.bridges.critical_count > 0 ? 'warn' : 'good' },
        { label: 'Maintenance backlog', value: `KES ${fmtKsh(infra.maintenance.open_value_kes)}`, tone: 'crit' },
        { label: 'At-risk segments (12mo)', value: fmtNum(infra.predictive.at_risk_segments_12mo), tone: 'warn' },
      ]
    },
  },
  SDR: {
    title: 'SDR - National roads oversight', tag: 'IFMIS · e-ProMIS', to: '/infrastructure', domains: ['infra'],
    rows: ({ infra }) => infra ? [
      { label: 'Budget absorption (FY)', value: fmtPct(infra.budget.utilization_pct), tone: infra.budget.utilization_pct >= 60 ? 'good' : 'warn' },
      { label: 'Maintenance backlog (all agencies)', value: `KES ${fmtKsh(infra.maintenance.open_value_kes)}`, tone: 'crit' },
    ] : [],
  },
  KPA: {
    title: 'KPA - Port of Mombasa', tag: 'PMIS · VTMIS', to: '/maritime', domains: ['maritime'],
    rows: ({ maritime }) => {
      if (!maritime) return []
      const ports = maritime.ports ?? []
      const dwell = ports.length ? ports.reduce((s, p) => s + (p.avg_yard_dwell_days || 0), 0) / ports.length : null
      return [
        ...ports.slice(0, 2).map(p => ({ label: `${p.port_name} TEUs (30d)`, value: fmtNum(p.teu_throughput_30d), tone: 'good' as Tone })),
        { label: 'Live vessels in port', value: fmtNum(maritime.kpis.live_vessels ?? 0), tone: 'good' },
        { label: 'Avg yard dwell', value: dwell != null ? `${dwell.toFixed(1)} days` : '-', tone: dwell != null && dwell < 5 ? 'good' : 'warn' },
      ]
    },
  },
  KMA: {
    title: 'KMA - Kenya Maritime Authority', tag: 'NAV 2018 · Hybrid', to: '/maritime', domains: ['maritime'],
    rows: ({ maritime }) => maritime ? [
      { label: 'Maritime incidents (30d)', value: fmtNum(maritime.kpis.incidents_30d), tone: maritime.kpis.incidents_30d > 5 ? 'warn' : 'good' },
    ] : [],
  },
  KAA: {
    title: 'KAA - Airports authority', tag: 'Live · KAA / KCAA', to: '/aviation', domains: ['aviation'],
    rows: ({ aviation }) => aviation ? [
      { label: 'Flight movements (7d)', value: fmtNum(aviation.kpis.flights_total), tone: 'good' },
      { label: 'Passenger throughput (7d)', value: fmtNum(aviation.kpis.pax_total), tone: 'good' },
      { label: 'On-time performance', value: fmtPct(aviation.kpis.otp_pct), tone: aviation.kpis.otp_pct >= 85 ? 'good' : 'warn' },
      { label: 'Avg delay', value: `${aviation.kpis.avg_delay_min?.toFixed(0) ?? '-'} min`, tone: (aviation.kpis.avg_delay_min ?? 0) < 15 ? 'good' : 'warn' },
    ] : [],
  },
  KRC: {
    title: 'KRC - Railways corporation', tag: 'SAP S4/HANA · CTC', to: '/railway', domains: ['rail'],
    rows: ({ rail }) => rail ? [
      { label: 'SGR on-time performance (30d)', value: fmtPct(rail.on_time_30d.on_time_pct), tone: rail.on_time_30d.on_time_pct >= 80 ? 'good' : 'warn' },
      { label: 'Ridership (30d)', value: fmtNum(rail.ridership_30d.passengers), tone: 'good' },
      { label: 'Freight tonnage (30d)', value: `${fmtNum(rail.freight_30d.total_tons)} t`, tone: 'good' },
      { label: 'Avg delay', value: `${rail.on_time_30d.avg_delay_min?.toFixed(1) ?? '-'} min`, tone: rail.on_time_30d.avg_delay_min < 10 ? 'good' : 'warn' },
    ] : [],
  },
}
const fallback = (code: string): Spec => ({
  title: code, tag: 'Awaiting feed', to: '/integrations/analytics', domains: [], rows: () => [],
})
const spec = computed(() => SPECS[agency.value] ?? fallback(agency.value))

const data = shallowRef<Partial<DomainPayloads>>({})
const loading = ref(true)
const failed = ref(false)
const rows = computed(() => spec.value.rows(data.value))

async function load() {
  if (!spec.value.domains.length) { loading.value = false; return }
  loading.value = true
  const res = await Promise.allSettled(spec.value.domains.map(x => loadDomain(x, context.value)))
  const next: Partial<DomainPayloads> = {}
  res.forEach((r, i) => { if (r.status === 'fulfilled') Object.assign(next, { [spec.value.domains[i]!]: r.value }) })
  data.value = next
  failed.value = res.every(r => r.status === 'rejected')
  loading.value = false
}
watch([agency, () => JSON.stringify(context.value)], load, { immediate: true })
watch(tick, load)

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
.agency-title:hover, .agency-title.active { color: var(--primary); }
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
.badge {
  display: inline-flex; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: var(--r-xs);
  letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; border: 1px solid transparent;
}
.badge.good { background: var(--success-bg); color: var(--success-fg); }
.badge.warn { background: var(--warning-bg); color: var(--warning-fg); }
.badge.crit { background: var(--danger-bg); color: var(--danger-fg); }
.badge.info { background: var(--info-bg); color: var(--info-fg); }
</style>
