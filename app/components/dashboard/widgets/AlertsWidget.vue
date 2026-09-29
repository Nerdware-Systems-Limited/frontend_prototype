<template>
  <div class="alerts">
    <NuxtLink v-for="a in alerts" :key="a.to + a.title" :to="a.to" class="alert" :class="a.severity">
      <span class="alert-main">
        <span class="alert-title">{{ a.title }}</span>
        <span class="alert-meta">{{ a.meta }}</span>
      </span>
      <span class="alert-chevron" aria-hidden="true">→</span>
    </NuxtLink>
    <div v-if="!loading && !alerts.length && !failed.length" class="alert success">
      <span class="alert-main">
        <span class="alert-title">No active escalations</span>
        <span class="alert-meta">Across {{ checked.join(', ') || 'no domains' }}</span>
      </span>
    </div>
    <p v-if="failed.length" class="alerts-note">Could not check: {{ failed.join(', ') }}.</p>
    <p v-if="loading && !alerts.length" class="alerts-note">Loading alerts…</p>
  </div>
</template>

<script setup lang="ts">
import { useIntegrations } from '~/composables/api'
import type { WidgetInstance } from '~/types/dashboard'
import { loadDomain } from '~/composables/useDomainData'
import { useWidgetFilters } from '~/composables/useDashboardFilters'
import { DOMAIN_PERMISSIONS } from '~/utils/widgetRegistry'
import { DOMAIN_LABELS, fmtNum, fmtPct, type Domain, type DomainPayloads } from '~/utils/metricRegistry'

type Severity = 'critical' | 'warning'
interface Alert { severity: Severity; title: string; meta: string; to: string }

const props = defineProps<{ instance: WidgetInstance; config: Record<string, unknown> }>()
const { context } = useWidgetFilters(() => props.instance.id)
const { can } = useViewerContext()
const tick = inject<Ref<number>>('dashboard:refreshTick', ref(0))

const d = shallowRef<Partial<DomainPayloads>>({})
const feeds = ref<{ status: string; agency_code: string }[]>([])
const loading = ref(true)
const failed = ref<string[]>([])
const checked = ref<string[]>([])

// Only domains the viewer may see - an alert is a leak too.
const domains = computed(() =>
  (['safety', 'fleet', 'rail', 'aviation', 'infra'] as Domain[]).filter(x => can([DOMAIN_PERMISSIONS[x]])))

async function load() {
  loading.value = true
  const res = await Promise.allSettled(domains.value.map(x => loadDomain(x, context.value)))
  const next: Partial<DomainPayloads> = {}
  const bad: string[] = []
  res.forEach((r, i) => {
    const key = domains.value[i]!
    if (r.status === 'fulfilled') Object.assign(next, { [key]: r.value })
    else bad.push(DOMAIN_LABELS[key])
  })
  if (can([DOMAIN_PERMISSIONS.integrations])) {
    try { feeds.value = (await useIntegrations().list({ page_size: 100 })).results ?? [] }
    catch { bad.push('Integration Hub') }
  }
  d.value = next
  failed.value = bad
  checked.value = domains.value.filter(x => next[x] != null).map(x => DOMAIN_LABELS[x])
  loading.value = false
}
watch([() => JSON.stringify(context.value), domains], load, { immediate: true })
watch(tick, load)

// Thresholds are identical to NationalCommandCentre's activeAlerts.
const alerts = computed<Alert[]>(() => {
  const list: Alert[] = []
  const { safety, fleet, infra, rail, aviation } = d.value
  if (safety) {
    const k = safety.kpis
    if (k.active > 10) list.push({ severity: 'critical', title: `${fmtNum(k.active)} active incidents - above threshold`, meta: 'NTSA IRSMS · Live', to: '/safety/incidents' })
    else if (k.active > 5) list.push({ severity: 'warning', title: `${fmtNum(k.active)} active road incidents`, meta: 'NTSA IRSMS · Live', to: '/safety/incidents' })
    if (k.fatal_30d > 20) list.push({ severity: 'critical', title: `${fmtNum(k.fatal_30d)} road fatalities in 30 days - exceeds threshold`, meta: 'NTSA IRSMS · 30d rolling', to: '/safety/kpis' })
    else if (k.fatal_30d > 10) list.push({ severity: 'warning', title: `${fmtNum(k.fatal_30d)} road fatalities (30d) above normal`, meta: 'NTSA IRSMS · 30d rolling', to: '/safety/kpis' })
    const crit = safety.black_spots_by_tier['critical'] ?? 0
    if (crit > 0) list.push({ severity: 'warning', title: `${fmtNum(crit)} critical black spots active`, meta: 'NTSA KDE Analysis · Batch', to: '/safety/blackspots' })
  }
  if (fleet && fleet.governor_compliance.tamper_rate_pct > 5)
    list.push({ severity: 'warning', title: `Speed governor tamper rate: ${fmtPct(fleet.governor_compliance.tamper_rate_pct)}`, meta: 'NTSA iTIMS · Live', to: '/fleet/behaviour' })
  if (infra && infra.bridges.critical_count > 0)
    list.push({ severity: 'warning', title: `${fmtNum(infra.bridges.critical_count)} bridges at critical condition`, meta: 'BMS · Batch survey', to: '/infrastructure/bridges' })
  if (rail && rail.incidents_90d.fatal > 0)
    list.push({ severity: 'critical', title: `${fmtNum(rail.incidents_90d.fatal)} fatal rail incidents (90d)`, meta: 'KRC Safety · Batch', to: '/railway/safety' })
  if (rail && rail.on_time_30d.on_time_pct < 70)
    list.push({ severity: 'warning', title: `Rail OTP below benchmark: ${fmtPct(rail.on_time_30d.on_time_pct)}`, meta: 'KRC Ops · Live', to: '/railway/schedules' })
  if (aviation && aviation.kpis.otp_pct < 80)
    list.push({ severity: 'warning', title: `Aviation OTP below benchmark: ${fmtPct(aviation.kpis.otp_pct)}`, meta: 'KAA · Live', to: '/aviation/flights' })
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
a.alert:hover { border-color: var(--border-interactive); }
a.alert:hover .alert-chevron { color: var(--primary); transform: translateX(3px); }
.alert-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.alert-title { font-size: 11.5px; font-weight: 600; color: var(--fg-1); line-height: 1.4; }
.alert-meta { font-size: 10px; color: var(--fg-3); margin-top: 2px; font-family: var(--font-mono); }
.alert-chevron { font-size: 12px; color: var(--fg-3); transition: transform var(--dur-base) var(--ease-out); }
.alerts-note { font-size: 11px; color: var(--fg-3); margin: 2px 0 0; }
</style>
