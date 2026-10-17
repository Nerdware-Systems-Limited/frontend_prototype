<template>
  <PageHeader
    eyebrow="Corridor & Trade - KenTrade"
    title="Transit Declarations"
    subtitle="Cargo moving through Kenya under a transit declaration - customs status, destination, time in transit and security alerts"
  >
    <template #actions>
      <DayRangeToggle v-model="days" :options="[7, 30, 90]" @update:model-value="load" />
      <NuxtLink v-if="canSee('/corridor/border-crossings')" to="/corridor/border-crossings" class="btn">Border Crossings<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <div class="kpi-grid">
    <KpiCard label="Declarations" :value="fmt(total)" :unavailable="!summary" :period="`${days}D`" description="Released in window" />
    <KpiCard label="Cargo" :value="fmt(tonnage)" unit="t" :unavailable="!summary" :period="`${days}D`" description="Declared weight" />
    <KpiCard label="Avg transit time" :value="avgTransit != null ? hours(avgTransit) : '-'" :unavailable="avgTransit == null" :period="`${days}D`" description="Release to arrival, completed trips" />
    <KpiCard label="Avg border crossing" :value="avgBorder != null ? avgBorder.toFixed(1) : '-'" unit="h" :unavailable="avgBorder == null" :period="`${days}D`" description="Arrival to departure at the post" />
    <KpiCard label="Cleared" :value="clearedPct != null ? clearedPct.toFixed(0) : '-'" unit="%" :unavailable="clearedPct == null" :period="`${days}D`" description="Reached destination customs" />
    <KpiCard label="Held" :value="fmt(count('held'))" :unavailable="!summary" :period="`${days}D`" description="Detained or under examination"
      :status="!summary ? undefined : count('held') === 0 ? 'healthy' : 'warning'" />
    <KpiCard label="Transit bond in force" :value="summary?.bond_open_kes != null ? `KES ${fmtKes(summary.bond_open_kes)}` : '-'" :unavailable="!summary || summary.bond_open_kes == null"
      :period="`${days}D`" :description="summary?.bond_total_kes != null ? `of KES ${fmtKes(summary.bond_total_kes)} declared in window` : 'Cover for cargo still in Kenya'" />
    <KpiCard label="Overdue exits" :value="fmt(summary?.overdue_exits)" :unavailable="!summary" :period="`${days}D`" description="Past declared exit date, bond open"
      :status="!summary ? undefined : summary.overdue_exits === 0 ? 'healthy' : 'critical'" />
    <KpiCard label="Alerts" :value="fmt(alertCount)" :unavailable="!summary" :period="`${days}D`" description="Tamper or route deviation"
      :status="!summary ? undefined : alertCount === 0 ? 'healthy' : 'critical'" />
  </div>

  <div class="two-col">
    <div class="card">
      <div class="card-header">Declarations per day</div>
      <div class="card-body">
        <TrendLineChart :points="dailyPoints" :height="210" :empty-text="loading ? 'Loading…' : 'No declarations in this window'" />
      </div>
    </div>
    <div class="card">
      <div class="card-header">Customs status</div>
      <div class="card-body">
        <template v-if="summary?.status_counts.length">
          <div v-for="s in summary.status_counts" :key="s.status" class="srow" :class="{ on: statusFilter === s.status }" tabindex="0"
            @click="toggleStatus(s.status)" @keydown.enter="toggleStatus(s.status)">
            <BadgePill :variant="STATUS_VARIANT[s.status]" size="sm">{{ s.label }}</BadgePill>
            <div class="strack"><div class="sfill" :style="{ width: `${(s.count / maxStatus) * 100}%` }" /></div>
            <span class="sn mono">{{ s.count }}</span>
          </div>
          <p class="note">Select a status to filter the register below.</p>
        </template>
        <EmptyState v-else :loading="loading" message="No declarations in this window." compact />
      </div>
    </div>
  </div>

  <!-- By destination -->
  <SectionTitle pill="By corridor and destination">Where cargo is going</SectionTitle>
  <div class="card">
    <div class="card-body flush">
      <table v-if="summary?.groups.length">
        <thead><tr><th>Corridor</th><th>Destination</th><th class="r">Declarations</th><th class="r">Cargo (t)</th><th class="r">Bond (KES)</th><th class="r">Avg transit</th><th class="r">Avg border</th><th class="r">Alerts</th></tr></thead>
        <tbody>
          <tr v-for="g in summary.groups" :key="g.corridor + g.destination_country" class="clickable" tabindex="0"
            @click="filterDestination(g.destination_country)" @keydown.enter="filterDestination(g.destination_country)">
            <td><BadgePill variant="blue" size="sm">{{ g.corridor }}</BadgePill></td>
            <td><b>{{ g.destination_country }}</b></td>
            <td class="r mono">{{ fmt(g.shipments) }}</td>
            <td class="r mono">{{ fmt(g.tonnage) }}</td>
            <td class="r mono">{{ fmtKes(g.bond_kes) }}</td>
            <td class="r mono">{{ g.avg_transit_hours != null ? hours(g.avg_transit_hours) : '-' }}</td>
            <td class="r mono">{{ g.avg_border_crossing_hours != null ? `${g.avg_border_crossing_hours.toFixed(1)} h` : '-' }}</td>
            <td class="r mono" :class="g.tamper_alerts + g.deviation_alerts > 0 ? 't-danger' : ''">{{ g.tamper_alerts + g.deviation_alerts }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else :loading="loading" message="No destination data." compact />
    </div>
  </div>

  <!-- Register -->
  <SectionTitle pill="CT-01 · register">Declaration register</SectionTitle>
  <div class="card">
    <div class="filter-strip">
      <label class="f"><span class="filter-label">Corridor</span>
        <select v-model="q.corridor" class="select" @change="resetPage"><option value="">All</option><option v-for="c in corridorOptions" :key="c" :value="c">{{ c }}</option></select></label>
      <label class="f"><span class="filter-label">Status</span>
        <select v-model="statusFilter" class="select" @change="resetPage"><option value="">All</option><option v-for="(l, s) in STATUS_LABEL" :key="s" :value="s">{{ l }}</option></select></label>
      <label class="f"><span class="filter-label">Destination</span>
        <select v-model="q.destination_country" class="select" @change="resetPage"><option value="">All</option><option v-for="d in destinations" :key="d" :value="d">{{ d }}</option></select></label>
      <label class="f grow"><span class="filter-label">Container number</span>
        <input v-model.trim="q.container_number" class="input" placeholder="e.g. CSQU3054383" @keydown.enter="resetPage" @blur="resetPage"></label>
      <label class="f chk"><input v-model="alertsOnly" type="checkbox" @change="resetPage"> Alerts only</label>
    </div>
    <div class="card-body flush">
      <table v-if="rows.length">
        <thead><tr><th>Declaration</th><th>Corridor</th><th>Destination</th><th>Container</th><th>Truck</th><th class="r">Cargo (t)</th><th class="r">Bond (KES)</th><th class="r">Transit</th><th>Status</th><th>Alerts</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" class="clickable" tabindex="0" @click="open(r)" @keydown.enter="open(r)">
            <td class="mono"><b>{{ r.transit_declaration_ref }}</b></td>
            <td>{{ r.corridor_code }}</td>
            <td>{{ r.destination_country }}</td>
            <td class="mono">{{ r.container_number || '-' }}</td>
            <td class="mono">{{ r.truck_registration || '-' }}</td>
            <td class="r mono">{{ fmt(r.cargo_weight_t, 1) }}</td>
            <td class="r mono">{{ fmtKes(r.transit_bond_kes) }}</td>
            <td class="r mono">{{ r.total_transit_time_hours != null ? hours(r.total_transit_time_hours) : '…' }}</td>
            <td><BadgePill :variant="STATUS_VARIANT[r.customs_status]" size="sm">{{ STATUS_LABEL[r.customs_status] }}</BadgePill></td>
            <td>
              <BadgePill v-if="r.tamper_alert" variant="danger" size="sm">Tamper</BadgePill>
              <BadgePill v-if="r.deviation_alert" variant="warning" size="sm">Deviation</BadgePill>
              <BadgePill v-if="r.exit_overdue" variant="danger" size="sm">Exit overdue</BadgePill>
              <span v-if="!r.tamper_alert && !r.deviation_alert && !r.exit_overdue" class="muted">-</span>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else :loading="rowsLoading" message="No declarations match these filters." compact />
      <TablePagination :page="page" :total-pages="pages" :total="count_" @prev="page--; loadRows()" @next="page++; loadRows()" />
    </div>
  </div>

  <SideDrawer :open="!!detail" :title="detail?.transit_declaration_ref ?? ''" :subtitle="detail ? `${detail.corridor_code} → ${detail.destination_country}` : ''" @close="detail = null">
    <template v-if="detail">
      <div class="d-badges">
        <BadgePill :variant="STATUS_VARIANT[detail.customs_status]">{{ STATUS_LABEL[detail.customs_status] }}</BadgePill>
        <BadgePill v-if="detail.tamper_alert" variant="danger">Tamper alert</BadgePill>
        <BadgePill v-if="detail.deviation_alert" variant="warning">Route deviation</BadgePill>
        <BadgePill v-if="detail.exit_overdue" variant="danger">Exit overdue - bond open</BadgePill>
      </div>

      <h3 class="d-h">Journey</h3>
      <ol class="tl">
        <li v-for="e in timeline" :key="e.label" :class="{ done: e.at, todo: !e.at }">
          <span class="tl-dot" /><span class="tl-l">{{ e.label }}</span>
          <span class="tl-t mono">{{ e.at ? when(e.at) : 'pending' }}</span>
        </li>
      </ol>
      <dl class="d-grid">
        <div><dt>Total transit</dt><dd class="mono">{{ detail.total_transit_time_hours != null ? hours(detail.total_transit_time_hours) : '-' }}</dd></div>
        <div><dt>Border crossing</dt><dd class="mono">{{ detail.border_crossing_time_hours != null ? `${detail.border_crossing_time_hours.toFixed(1)} h` : '-' }}</dd></div>
        <div><dt>Transit bond</dt><dd class="mono">{{ detail.transit_bond_kes != null ? `KES ${fmtKes(detail.transit_bond_kes)}` : '-' }}</dd></div>
        <div><dt>Must exit Kenya by</dt><dd class="mono">{{ detail.expected_exit_at ? when(detail.expected_exit_at) : '-' }}</dd></div>
        <div><dt>Border post</dt><dd>{{ detail.border_post_site_id ?? '-' }}</dd></div>
        <div><dt>Destination station</dt><dd>{{ detail.destination_customs_station || '-' }}</dd></div>
      </dl>

      <h3 class="d-h">Cargo and vehicle</h3>
      <dl class="d-grid">
        <div><dt>Cargo</dt><dd>{{ detail.cargo_description || '-' }}</dd></div>
        <div><dt>Weight</dt><dd class="mono">{{ fmt(detail.cargo_weight_t, 1) }} t</dd></div>
        <div><dt>Container</dt><dd class="mono">{{ detail.container_number || '-' }}</dd></div>
        <div><dt>Seal</dt><dd class="mono">{{ detail.seal_id || '-' }}</dd></div>
        <div><dt>Truck</dt><dd class="mono">{{ detail.truck_registration || '-' }}</dd></div>
        <div><dt>Transporter</dt><dd>{{ detail.transporter || '-' }}</dd></div>
      </dl>
      <p class="note">Trader identity (consignor, consignee, clearing agent, driver) is never ingested into UAPTS.</p>
    </template>
  </SideDrawer>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import {
  useCorridor, fmtHours, fmtKes, fmtCorridorNum as fmt,
  CORRIDOR_STATUS_VARIANT as STATUS_VARIANT, CORRIDOR_STATUS_LABEL as STATUS_LABEL,
  type TransitSummary, type TransitShipment, type CustomsStatus,
} from '~/composables/api'

const access = useAccessControl()
const canSee = access.canAccessRoute
const hours = fmtHours

const days = ref(30)
const summary = ref<TransitSummary | null>(null)
const rows = ref<TransitShipment[]>([])
const detail = ref<TransitShipment | null>(null)
const q = reactive({ corridor: '', destination_country: '', container_number: '' })
const statusFilter = ref<CustomsStatus | ''>('')
const alertsOnly = ref(false)
const page = ref(1), pages = ref(1), count_ = ref(0)
const loading = ref(true), rowsLoading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const r = await useCorridor().transitSummary(days.value).catch(() => null)
  if (r) summary.value = r; else error.value = 'Unable to reach the UAPTS Corridor API.'
  loading.value = false
  loadRows()
}
async function loadRows() {
  rowsLoading.value = true
  const r = await useCorridor().shipments({
    corridor: q.corridor, customs_status: statusFilter.value, destination_country: q.destination_country,
    container_number: q.container_number, alerts: alertsOnly.value ? '1' : '', page: page.value, page_size: 12,
  }).catch(() => null)
  if (r) { rows.value = r.results; count_.value = r.count; pages.value = r.total_pages ?? 1 }
  rowsLoading.value = false
}
function resetPage() { page.value = 1; loadRows() }
function toggleStatus(s: CustomsStatus) { statusFilter.value = statusFilter.value === s ? '' : s; resetPage() }
function filterDestination(d: string) { q.destination_country = q.destination_country === d ? '' : d; resetPage() }
onMounted(load)

const count = (s: CustomsStatus) => summary.value?.status_counts.find(x => x.status === s)?.count ?? 0
const total = computed(() => summary.value?.status_counts.reduce((a, s) => a + s.count, 0) ?? null)
const maxStatus = computed(() => Math.max(1, ...(summary.value?.status_counts ?? []).map(s => s.count)))
const alertCount = computed(() => summary.value?.groups.reduce((a, g) => a + g.tamper_alerts + g.deviation_alerts, 0) ?? 0)
const tonnage = computed(() => summary.value ? summary.value.groups.reduce((a, g) => a + (g.tonnage ?? 0), 0) : null)
// Group means weighted by shipment count, so a one-truck destination can't swing the headline.
const weightedMean = (key: 'avg_transit_hours' | 'avg_border_crossing_hours') => {
  const g = (summary.value?.groups ?? []).filter(x => x[key] != null)
  const n = g.reduce((a, x) => a + x.shipments, 0)
  return n ? g.reduce((a, x) => a + (x[key] as number) * x.shipments, 0) / n : null
}
const avgTransit = computed(() => weightedMean('avg_transit_hours'))
const avgBorder = computed(() => weightedMean('avg_border_crossing_hours'))
const clearedPct = computed(() => total.value ? (count('cleared') / total.value) * 100 : null)
const corridorOptions = computed(() => [...new Set((summary.value?.groups ?? []).map(g => g.corridor))])
const destinations = computed(() => [...new Set((summary.value?.groups ?? []).map(g => g.destination_country))].sort())
const dailyPoints = computed(() => (summary.value?.daily ?? []).map(d => ({ label: d.date.slice(5), value: d.declarations })))

function open(r: TransitShipment) { detail.value = r }
const when = (iso: string) => new Date(iso).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const timeline = computed(() => detail.value ? [
  { label: 'Released at origin', at: detail.value.released_at },
  { label: 'Arrived at border', at: detail.value.border_arrival_at },
  { label: 'Left border', at: detail.value.border_departure_at },
  { label: 'Arrived at destination', at: detail.value.arrival_at },
] : [])
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 16px; }
.two-col { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; margin-bottom: 16px; align-items: start; }
@media (max-width: 1100px) { .two-col { grid-template-columns: 1fr; } }
.card-body.flush { padding: 0; }
.r { text-align: right !important; }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.muted { color: var(--fg-3); }
.t-danger { color: var(--danger-fg); font-weight: 600; }
.note { margin: 10px 0 0; font-size: 11.5px; color: var(--fg-3); }
.srow { display: grid; grid-template-columns: 96px 1fr 34px; gap: 10px; align-items: center; padding: 7px 6px; cursor: pointer; border-bottom: 1px solid var(--border-subtle); }
.srow:hover, .srow.on { background: var(--primary-wash); }
.srow:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.strack { height: 8px; background: var(--surface-sunken); border-radius: 2px; overflow: hidden; }
.sfill { height: 100%; background: var(--primary-fill); }
.sn { text-align: right; font-weight: 600; color: var(--fg-1); }
tr.clickable { cursor: pointer; }
tr.clickable:hover td { background: var(--primary-wash); }
tr.clickable:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.filter-strip { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); background: var(--surface-1); }
.f { display: flex; flex-direction: column; gap: 4px; }
.f.grow { flex: 1; min-width: 180px; }
.f.chk { flex-direction: row; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-2); padding-bottom: 7px; }
.d-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.d-h { font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--fg-3); margin: 18px 0 8px; }
.tl { list-style: none; margin: 0 0 14px; padding: 0; }
.tl li { display: grid; grid-template-columns: 14px 1fr auto; gap: 10px; align-items: center; padding: 7px 0; font-size: 12.5px; border-bottom: 1px solid var(--border-subtle); }
.tl-dot { width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--border-interactive); background: var(--surface-2); }
.tl li.done .tl-dot { background: var(--success); border-color: var(--success); }
.tl li.todo { color: var(--fg-3); }
.tl-t { font-size: 11.5px; }
.d-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; margin: 0; }
.d-grid dt { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-3); margin-bottom: 2px; }
.d-grid dd { margin: 0; font-size: 13px; color: var(--fg-1); }
</style>
