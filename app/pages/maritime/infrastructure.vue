<template>
  <PageHeader
    eyebrow="Maritime"
    title="Maritime Infrastructure"
    subtitle="KPA · KMA · KMFRI - Port &amp; berth registry, capacity utilisation, channel depth, navigational aids, dry docks, ICDs, and capital works"
  >
    <template #actions>
      <NuxtLink to="/maritime" class="btn">Vessel Movements →</NuxtLink>
      <NuxtLink to="/maritime/port-ops" class="btn">Port Operations →</NuxtLink>
      <NuxtLink to="/maritime/waterways" class="btn">Waterways →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">
    ⚠ {{ error }}
  </div>

  <!-- Real registry KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Registered Ports" :value="fmtNum(ports.length)" :sub="`${fmtNum(activePorts.length)} active`" source="live" source-title="KPA Registry" />
    <KpiCard label="Registered Berths" :value="fmtNum(berths.length)" :sub="`${fmtNum(activeBerths.length)} active`" source="live" source-title="KPA Registry" />
    <KpiCard label="Design Throughput" :value="`${fmtNum(totalDesignThroughput)} TEU/yr`" sub="Sum across registered ports" source="live" source-title="KPA Registry" />
    <KpiCard label="Avg Cranes / Berth" :value="avgCranes != null ? avgCranes.toFixed(1) : '-'" sub="Container-handling capacity proxy" source="live" source-title="KPA Registry" />
  </div>

  <!-- Infra KPIs (computed from the live channel/navaid/dry-dock/capital-works catalogues) -->
  <div class="kpi-grid">
    <KpiCard label="Channel Depth Compliance" :value="pct(channelDepthCompliancePct)" sub="Dredged vs target depth" :trend-direction="(channelDepthCompliancePct ?? 0) >= 90 ? 'up' : 'down'" source="live" source-title="KMA Hydrographic" />
    <KpiCard label="Navaid Availability" :value="pct(navaidOperationalPct)" sub="Buoys / lighthouses / radar / VHF" source="live" source-title="KMA" />
    <KpiCard label="Dry Docks Operational" :value="fmtNum(dryDocksOperational)" :sub="`of ${fmtNum(dryDocks.length)} registered`" source="live" source-title="KPA" />
    <KpiCard label="Registered ICDs" :value="fmtNum(icds.length)" sub="Inland container depots" source="live" source-title="KPA Registry" />
    <KpiCard label="Active Capital Works" :value="fmtNum(activeCapitalWorks.length)" :sub="`of ${fmtNum(capitalWorks.length)} projects`" source="live" source-title="KPA / National Treasury" />
    <KpiCard label="Active Capital Works Value" :value="activeCapitalWorksValue ? `KES ${fmtKES(activeCapitalWorksValue)}` : '-'" sub="In-progress projects" source="live" source-title="KPA / National Treasury" />
  </div>

  <!-- Capacity utilisation -->
  <SectionTitle pill="Computed · Live Registry × Container Throughput">Port Capacity Utilisation</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Port</th><th>UNLOCODE</th><th>Design Throughput/yr (TEU)</th><th>Annualised Actual (est.)</th><th>Utilisation</th><th>Berth Availability</th></tr></thead>
          <tbody v-if="capacityUtilisation.length">
            <tr v-for="c in capacityUtilisation" :key="c.unlocode">
              <td style="font-weight:600">{{ c.name }}</td>
              <td style="font-family:monospace">{{ c.unlocode }}</td>
              <td>{{ fmtNum(c.designThroughput) }}</td>
              <td>{{ c.annualisedActual != null ? fmtNum(c.annualisedActual) : '-' }}</td>
              <td>
                <div v-if="c.utilizationPct != null" class="util-bar-wrap">
                  <div class="util-bar" :style="{ width: `${Math.min(100, c.utilizationPct)}%`, background: c.utilizationPct > 100 ? '#ef4444' : c.utilizationPct >= 70 ? '#f59e0b' : '#22c55e' }" />
                </div>
                <span style="font-size:11px">{{ c.utilizationPct != null ? `${c.utilizationPct.toFixed(0)}%` : '-' }}</span>
              </td>
              <td style="font-size:12px">{{ berthAvailabilityByPort[c.unlocode] != null ? `${berthAvailabilityByPort[c.unlocode]!.toFixed(0)}%` : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No container-throughput data available to estimate utilisation.' }}</td></tr></tbody>
        </table>
      </div>
      <div class="source-note">Annualised actual is estimated by scaling the {{ throughputDays }}-day container throughput to a full year - directional only, not a reported annual figure. Berth availability is from <code>infrastructure/summary/</code>.</div>
    </div>
  </div>

  <!-- Port map -->
  <SectionTitle pill="Live Registry">Port Map</SectionTitle>
  <div class="card map-card">
    <div class="card-header">Registered Ports</div>
    <ClientOnly>
      <UaptsMap
        :markers="portMarkers"
        :center="[-3.0, 39.9]"
        :zoom="6"
        height="380px"
      />
    </ClientOnly>
  </div>

  <!-- Port registry -->
  <SectionTitle pill="Live Registry">Port Registry</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Port</th><th>UNLOCODE</th><th>Type</th><th>Operator</th><th>Design Throughput (TEU/yr)</th><th>Agency</th><th>Status</th></tr></thead>
          <tbody v-if="ports.length">
            <tr v-for="p in ports" :key="p.id">
              <td style="font-weight:600">{{ p.name }}</td>
              <td style="font-family:monospace">{{ p.unlocode }}</td>
              <td><BadgePill variant="info">{{ p.port_type.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-size:12px">{{ p.operator }}</td>
              <td>{{ fmtNum(p.design_throughput_teu) }}</td>
              <td style="font-size:12px">{{ p.agency_code ?? '-' }}</td>
              <td><BadgePill :variant="p.active ? 'success' : 'neutral'">{{ p.active ? 'Active' : 'Inactive' }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading ports…' : 'No ports available.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Berth registry -->
  <SectionTitle pill="Live Registry">Berth Registry</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="portFilter" class="select-sm">
          <option value="">All ports</option>
          <option v-for="p in ports" :key="p.unlocode" :value="p.unlocode">{{ p.name }} ({{ p.unlocode }})</option>
        </select>
        <select v-model="berthTypeFilter" class="select-sm">
          <option value="">All berth types</option>
          <option value="container">Container</option>
          <option value="general_cargo">General Cargo</option>
          <option value="bulk">Bulk</option>
          <option value="tanker">Tanker</option>
          <option value="fishing">Fishing</option>
          <option value="ro_ro">Ro-Ro</option>
          <option value="cruise">Cruise</option>
        </select>
        <button class="btn" @click="portFilter=''; berthTypeFilter=''">Clear</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Berth</th><th>Name</th><th>Port</th><th>Type</th><th>Length (m)</th><th>Max Draft (m)</th><th>Max Vessel LOA</th><th>Cranes</th><th>Status</th></tr></thead>
          <tbody v-if="filteredBerths.length">
            <tr v-for="b in filteredBerths" :key="b.id">
              <td style="font-family:monospace;font-weight:700">{{ b.berth_code }}</td>
              <td style="font-size:12px">{{ b.name }}</td>
              <td style="font-family:monospace;font-size:12px">{{ b.port_unlocode }}</td>
              <td><BadgePill variant="info">{{ b.berth_type.replace(/_/g,' ') }}</BadgePill></td>
              <td>{{ b.length_m }}</td>
              <td>{{ b.max_draft_m }}</td>
              <td>{{ b.max_vessel_loa }}</td>
              <td>{{ b.crane_count }}</td>
              <td><BadgePill :variant="b.active ? 'success' : 'danger'">{{ b.active ? 'Active' : 'Inactive' }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading berths…' : 'No berths match the current filters.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Channel depth & dredging -->
  <SectionTitle pill="KMA Hydrographic · Live">Channel Depth &amp; Dredging</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Port</th><th>Channel</th><th>Waterway</th><th>Dredged Depth (m)</th><th>Target Depth (m)</th><th>vs Target</th><th>Last Dredged</th></tr></thead>
          <tbody v-if="channels.length">
            <tr v-for="c in channels" :key="c.id">
              <td style="font-family:monospace;font-weight:600">{{ c.port_unlocode ?? '-' }}</td>
              <td style="font-size:12px">{{ c.name }}</td>
              <td style="font-size:12px">{{ c.waterway_name ?? '-' }}</td>
              <td>{{ c.dredged_depth_m }}</td>
              <td>{{ c.target_depth_m ?? '-' }}</td>
              <td>
                <BadgePill v-if="c.target_depth_m != null" :variant="c.dredged_depth_m >= c.target_depth_m ? 'success' : 'danger'">
                  {{ c.dredged_depth_m >= c.target_depth_m ? 'meets target' : 'below target' }}
                </BadgePill>
                <span v-else>-</span>
              </td>
              <td style="font-size:11px">{{ fmtDate(c.last_dredged_date) }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No channels registered.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Navaids -->
  <SectionTitle pill="KMA · Live">Navigational Aids</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Port</th><th>Name</th><th>Type</th><th>Waterway</th><th>Status</th><th>Uptime</th></tr></thead>
          <tbody v-if="navaids.length">
            <tr v-for="n in navaids" :key="n.id">
              <td style="font-family:monospace;font-weight:600">{{ n.port_unlocode ?? '-' }}</td>
              <td style="font-size:12px">{{ n.name }}</td>
              <td><BadgePill variant="info">{{ n.aid_type.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-size:12px">{{ n.waterway_name ?? '-' }}</td>
              <td><BadgePill :variant="facilityStatusBadge(n.operational_status)">{{ n.operational_status.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-size:12px">{{ n.uptime_pct != null ? `${n.uptime_pct.toFixed(1)}%` : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No navigation aids registered.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Dry docks + ICDs -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">Dry Docks &amp; Ship Repair</div>
      <div class="card-body">
        <table>
          <thead><tr><th>Facility</th><th>Port</th><th>Type</th><th>Capacity (DWT)</th><th>Operator</th><th>Status</th></tr></thead>
          <tbody v-if="dryDocks.length">
            <tr v-for="d in dryDocks" :key="d.id">
              <td style="font-weight:600;font-size:12px">{{ d.name }}</td>
              <td style="font-family:monospace;font-size:12px">{{ d.port_unlocode }}</td>
              <td style="font-size:12px">{{ d.dock_type.replace(/_/g,' ') }}</td>
              <td>{{ fmtNum(d.capacity_dwt) }}</td>
              <td style="font-size:12px">{{ d.operator || '-' }}</td>
              <td><BadgePill :variant="dryDockBadge(d.operational_status)">{{ d.operational_status.replace(/_/g,' ') }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:14px">{{ loading ? 'Loading…' : 'No dry docks registered.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-header">Inland Container Depots</div>
      <div class="card-body">
        <table>
          <thead><tr><th>ICD</th><th>UNLOCODE</th><th>Operator</th><th>Design Throughput (TEU/yr)</th><th>Status</th></tr></thead>
          <tbody v-if="icds.length">
            <tr v-for="i in icds" :key="i.id">
              <td style="font-weight:600;font-size:12px">{{ i.name }}</td>
              <td style="font-family:monospace;font-size:12px">{{ i.unlocode }}</td>
              <td style="font-size:12px">{{ i.operator || '-' }}</td>
              <td>{{ fmtNum(i.design_throughput_teu) }}</td>
              <td><BadgePill :variant="i.active ? 'success' : 'neutral'">{{ i.active ? 'Active' : 'Inactive' }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px">{{ loading ? 'Loading…' : 'No ports currently classified as ICDs (port_type=inland_dry).' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Port State Control inspections (real) -->
  <SectionTitle pill="KMA PSC · Live">Recent Port State Control Inspections</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead><tr><th>Vessel</th><th>Port</th><th>Result</th><th>Deficiencies</th><th>Date</th></tr></thead>
        <tbody v-if="inspections.length">
          <tr v-for="ins in inspections" :key="ins.id">
            <td style="font-weight:600;font-size:12px">{{ ins.vessel_name ?? ins.vessel ?? '-' }}</td>
            <td style="font-family:monospace;font-size:12px">{{ ins.port_unlocode ?? ins.port ?? '-' }}</td>
            <td><BadgePill :variant="inspectionBadge(ins.result)">{{ ins.result ?? '-' }}</BadgePill></td>
            <td>{{ ins.deficiencies_count ?? '-' }}</td>
            <td style="font-size:11px">{{ fmtDate(ins.inspected_at) }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No port-state-control inspections in the current view.' }}</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Capital works -->
  <SectionTitle pill="KPA / National Treasury · Live">Capital Works Pipeline</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
      <table>
        <thead><tr><th>Ref</th><th>Project</th><th>Port</th><th>Type</th><th>Contractor</th><th>Funding</th><th>Budget (KES)</th><th>Financial Progress</th><th>Status</th></tr></thead>
        <tbody v-if="capitalWorks.length">
          <tr v-for="c in capitalWorks" :key="c.id">
            <td style="font-family:monospace;font-size:11px">{{ c.project_ref }}</td>
            <td style="font-weight:600;font-size:12px">{{ c.project_name }}</td>
            <td style="font-family:monospace">{{ c.port_unlocode ?? '-' }}</td>
            <td style="font-size:12px">{{ c.project_type.replace(/_/g,' ') }}</td>
            <td style="font-size:12px">{{ c.contractor || '-' }}</td>
            <td style="font-size:12px">{{ c.funding_source || '-' }}</td>
            <td style="font-size:12px">{{ fmtKES(parseFloat(c.budget_kes)) }}</td>
            <td style="font-size:12px">{{ financialProgressPct(c) != null ? `${financialProgressPct(c)!.toFixed(0)}%` : '-' }}</td>
            <td><BadgePill :variant="capitalWorkBadge(c.status)">{{ c.status.replace(/_/g,' ') }}</BadgePill></td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No capital works projects registered.' }}</td></tr></tbody>
      </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Maritime Infrastructure')

import { useAviationMaritime, useMaritimeInfrastructure } from '~/composables/api'
import type { Port, Berth, ContainerByPort, MaritimeChannel, MaritimeNavaid, DryDock, InlandContainerDepot, MaritimeCapitalWork, MaritimeInfraSummary, CapitalWorkStatus } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }
// Kenya's two KPA-operated ports - same fixed lookup used across the maritime module's maps.
const PORT_COORDS: Record<string, [number, number]> = { KEMBA: [-4.05, 39.68], KELAU: [-2.27, 40.92] }

const ports        = ref<Port[]>([])
const berths        = ref<Berth[]>([])
const containers    = ref<ContainerByPort[]>([])
const channels      = ref<MaritimeChannel[]>([])
const navaids       = ref<MaritimeNavaid[]>([])
const dryDocks      = ref<DryDock[]>([])
const icds          = ref<InlandContainerDepot[]>([])
const capitalWorks  = ref<MaritimeCapitalWork[]>([])
const inspections   = ref<any[]>([])
const infra         = ref<MaritimeInfraSummary | null>(null)
const loading       = ref(true)
const error         = ref<string | null>(null)
const throughputDays = ref(30)

const portFilter      = ref('')
const berthTypeFilter = ref('')

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()
  const mi  = useMaritimeInfrastructure()

  const [poRes, beRes, ctRes, chRes, ndRes, ddRes, icRes, cwRes, insRes, sumRes] = await Promise.allSettled([
    avm.ports(),
    avm.berths({ page_size: 200 }),
    avm.containerByPort({ days: throughputDays.value }),
    mi.channels({ page_size: 100 }),
    mi.navaids({ page_size: 200 }),
    mi.dryDocks({ page_size: 50 }),
    mi.icds({ page_size: 50 }),
    mi.capitalWorks({ page_size: 100 }),
    avm.maritimeInspections({ days: 30 }),
    mi.summary(),
  ])

  if (poRes.status  === 'fulfilled') ports.value       = (poRes.value as any).results ?? []
  if (beRes.status  === 'fulfilled') berths.value      = (beRes.value as any).results ?? []
  if (ctRes.status  === 'fulfilled') containers.value  = (ctRes.value as any).results ?? []
  if (chRes.status  === 'fulfilled') channels.value    = (chRes.value as any).results ?? []
  if (ndRes.status  === 'fulfilled') navaids.value     = (ndRes.value as any).results ?? []
  if (ddRes.status  === 'fulfilled') dryDocks.value    = (ddRes.value as any).results ?? []
  if (icRes.status  === 'fulfilled') icds.value        = (icRes.value as any).results ?? []
  if (cwRes.status  === 'fulfilled') capitalWorks.value = (cwRes.value as any).results ?? []
  if (insRes.status === 'fulfilled') inspections.value = (insRes.value as any).results ?? []
  if (sumRes.status === 'fulfilled') infra.value       = sumRes.value

  if (poRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Maritime API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Real registry KPIs ───────────────────────────────────────────────────
const activePorts  = computed(() => ports.value.filter(p => p.active))
const activeBerths = computed(() => berths.value.filter(b => b.active))
const totalDesignThroughput = computed(() => ports.value.reduce((s, p) => s + (p.design_throughput_teu ?? 0), 0))
const avgCranes = computed(() => berths.value.length ? berths.value.reduce((s, b) => s + (b.crane_count ?? 0), 0) / berths.value.length : null)

// ── Infra KPIs (computed from the live channel/navaid/dry-dock/capital-works catalogues) ─
const channelDepthCompliancePct = computed(() => {
  const withTarget = channels.value.filter(c => c.target_depth_m != null)
  if (!withTarget.length) return null
  const compliant = withTarget.filter(c => c.dredged_depth_m >= (c.target_depth_m as number)).length
  return (compliant / withTarget.length) * 100
})
const navaidOperationalPct = computed(() => {
  if (!navaids.value.length) return null
  const operational = navaids.value.filter(n => n.operational_status === 'operational').length
  return (operational / navaids.value.length) * 100
})
const dryDocksOperational = computed(() => dryDocks.value.filter(d => d.operational_status === 'operational').length)
const activeCapitalWorks  = computed(() => capitalWorks.value.filter(c => c.status === 'in_progress'))
const activeCapitalWorksValue = computed(() =>
  activeCapitalWorks.value.reduce((s, c) => s + parseFloat(c.budget_kes || '0'), 0) || null,
)
function financialProgressPct(c: MaritimeCapitalWork): number | null {
  const budget = parseFloat(c.budget_kes || '0')
  if (!budget) return null
  return (parseFloat(c.spent_kes || '0') / budget) * 100
}

const berthAvailabilityByPort = computed<Record<string, number | null>>(() => {
  const out: Record<string, number | null> = {}
  for (const p of infra.value?.ports ?? []) out[p.port_unlocode] = p.berth_availability_pct
  return out
})

// ── Capacity utilisation (real cross-reference) ─────────────────────────
const capacityUtilisation = computed(() => containers.value.map(c => {
  const port = ports.value.find(p => p.unlocode === c.port__unlocode)
  const designThroughput = port?.design_throughput_teu ?? null
  const annualisedActual = c.teus != null ? Math.round((c.teus / throughputDays.value) * 365) : null
  const utilizationPct = designThroughput && annualisedActual != null && designThroughput > 0
    ? (annualisedActual / designThroughput) * 100
    : null
  return { unlocode: c.port__unlocode, name: c.port__name, designThroughput, annualisedActual, utilizationPct }
}).sort((a, b) => (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0)))

const portMarkers = computed((): MarkerSpec[] =>
  ports.value.map((p, i) => {
    const coords = PORT_COORDS[p.unlocode] ?? [-4.0 + i * 0.5, 39.7 + i * 0.3]
    const portBerths = berths.value.filter(b => b.port_unlocode === p.unlocode)
    return {
      id: `port-${p.unlocode}`,
      lat: coords[0], lon: coords[1],
      title: p.name,
      subtitle: `${p.port_type.replace(/_/g, ' ')} · ${portBerths.length} berths · ${p.active ? 'active' : 'inactive'}`,
      color: p.active ? 'blue' : 'gray',
      size: 'lg',
    }
  }),
)

// ── Filters ──────────────────────────────────────────────────────────────
const filteredBerths = computed(() => berths.value.filter(b => {
  if (portFilter.value && b.port_unlocode !== portFilter.value) return false
  if (berthTypeFilter.value && b.berth_type !== berthTypeFilter.value) return false
  return true
}))

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(n: number | null | undefined) {
  if (n == null) return '-'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}k`
  return Math.round(n).toLocaleString()
}
function pct(v: number | null | undefined) { return v == null ? '-' : `${v.toFixed(1)}%` }
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function facilityStatusBadge(s: string) {
  const m: Record<string,string> = { operational:'success', maintenance:'warning', non_operational:'danger' }
  return m[s] ?? 'neutral'
}
function dryDockBadge(s: string) {
  const m: Record<string,string> = { operational:'success', under_maintenance:'warning', decommissioned:'danger' }
  return m[s] ?? 'neutral'
}
function capitalWorkBadge(s: CapitalWorkStatus) {
  const m: Record<CapitalWorkStatus,string> = { planned:'neutral', in_progress:'info', completed:'success', suspended:'danger' }
  return m[s] ?? 'neutral'
}
function inspectionBadge(s: string | undefined) {
  const m: Record<string,string> = { pass:'success', passed:'success', fail:'danger', failed:'danger', detained:'danger', deficiencies:'warning' }
  return s ? (m[s.toLowerCase()] ?? 'neutral') : 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.map-card { overflow:hidden; margin-bottom:16px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
.util-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.util-bar { height:100%; border-radius:4px; transition:width .4s; }
.source-note { margin-top:10px; font-size:11px; color:#94a3b8; border-top:1px solid #f1f5f9; padding-top:10px; }
</style>
