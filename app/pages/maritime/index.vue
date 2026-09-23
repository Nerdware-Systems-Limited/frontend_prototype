<template>
  <PageHeader
    eyebrow="Maritime & Port Operations"
    title="Maritime Overview"
    subtitle="KPA · KMA · KenTrade · NCTTCA - Real-time AIS vessel traffic, port performance, KenTrade cargo single-window, and NCTTCA corridor transit KPIs"
  >
    <template #actions>
      <DayRangeToggle v-model="days" :options="[7, 30, 90]" @update:model-value="load" />
      <NuxtLink to="/maritime/services" class="btn">Port Services →</NuxtLink>
      <NuxtLink to="/maritime/performance" class="btn">Performance →</NuxtLink>
      <NuxtLink to="/maritime/port-ops" class="btn-primary">Port Ops →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid kpi-grid-primary">
    <KpiCard
      label="Active Ports" prominent subtle-period
      :value="ops ? fmtNum(ops.kpis.active_ports) : '-'"
      :unavailable="!ops" :unavailable-note="loading ? 'Loading…' : 'KPA VTMS feed unavailable'"
      period="LIVE" description="KPA/KMA managed" to="#port-cards"
    />
    <KpiCard
      label="Vessels in Port" prominent subtle-period
      :value="ops ? fmtNum(ops.kpis.live_vessels) : '-'"
      :unavailable="!ops" :unavailable-note="loading ? 'Loading…' : 'KMA AIS feed unavailable'"
      period="LIVE" description="Currently in Kenyan waters" to="#vessel-movements-live"
    />
    <KpiCard
      label="Incidents" prominent subtle-period
      :value="incidentStats ? fmtNum(incidentStats.total_incidents) : '-'"
      :unavailable="!incidentStats" :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="30D" :description="incidentStats ? `${fmtNum(incidentStats.fatal_incidents)} fatal · ${fmtNum(incidentStats.casualties)} casualties` : ''"
      :status="!incidentStats ? undefined : incidentStats.fatal_incidents === 0 ? 'healthy' : 'critical'"
      to="/maritime/accidents"
    />
    <KpiCard
      label="Inspections" prominent subtle-period
      :value="ops ? fmtNum(ops.kpis.inspections_30d) : '-'"
      :unavailable="!ops" :unavailable-note="loading ? 'Loading…' : 'KMA PSC feed unavailable'"
      period="30D" description="Port State Control"
    />
    <KpiCard
      label="Detentions" prominent subtle-period
      :value="ops ? fmtNum(ops.kpis.detentions_30d) : '-'"
      :unavailable="!ops" :unavailable-note="loading ? 'Loading…' : 'KMA PSC feed unavailable'"
      period="30D" description="Vessels detained"
      :status="!ops ? undefined : ops.kpis.detentions_30d === 0 ? 'healthy' : 'warning'"
    />
    <KpiCard
      label="Pollution Incidents" prominent subtle-period
      :value="incidentStats ? fmtNum(incidentStats.pollution_tons) : '-'"
      :unavailable="!incidentStats" :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="90D" description="Tonnes spilled"
      to="/maritime/accidents"
    />
  </div>

  <!-- Live vessel map + container by port -->
  <div class="two-col-map">
    <div class="card map-card">
      <div class="card-header">Live Vessel Positions (AIS)</div>
      <ClientOnly>
        <UaptsMap
          :markers="vesselMarkers"
          :center="[-3.2, 40.1]"
          :zoom="6"
          height="480px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#3b82f6" /> Container</span>
        <span class="mk"><span class="dot" style="background:#f59e0b" /> Tanker</span>
        <span class="mk"><span class="dot" style="background:#8b5cf6" /> Bulk Carrier</span>
        <span class="mk"><span class="dot" style="background:#22c55e" /> General Cargo</span>
        <span class="mk"><span class="dot" style="background:#ef4444" /> Delayed / Alert</span>
      </div>
    </div>

    <div class="right-col">
      <!-- Port performance cards -->
      <div v-if="ops?.ports.length" id="port-cards" class="drill-target">
        <div
          v-for="p in ops.ports"
          :key="p.port_unlocode"
          class="port-card"
        >
          <div class="port-header">
            <span style="font-weight:700">{{ p.port_name }}</span>
            <BadgePill variant="info">{{ p.port_unlocode }}</BadgePill>
            <span class="port-count">{{ p.currently_in_port }} vessels</span>
          </div>
          <div class="port-stats">
            <div><span class="ps-label">Arrivals (30d)</span><span>{{ fmtNum(p.arrivals_30d) }}</span></div>
            <div><span class="ps-label">Departures (30d)</span><span>{{ fmtNum(p.departures_30d) }}</span></div>
            <div><span class="ps-label">TEU Throughput</span><span>{{ fmtNum(p.teu_throughput_30d) }}</span></div>
            <div><span class="ps-label">Avg Dwell (days)</span><span :style="{ color: p.avg_yard_dwell_days > 7 ? 'var(--danger-fg)' : 'var(--success-fg)', fontWeight:'600' }">{{ p.avg_yard_dwell_days.toFixed(1) }}</span></div>
          </div>
        </div>
      </div>
      <div v-else id="port-cards" class="card drill-target">
        <EmptyState :loading="loading" message="No port operations data." compact />
      </div>

      <!-- Container by port -->
      <div class="card" style="margin-top:12px">
        <div class="card-header">Container Throughput by Port ({{ days }}d)</div>
        <div class="card-body">
          <div v-if="containers.length" class="cong-list">
            <div v-for="c in containers" :key="c.port__unlocode" class="cong-row">
              <span class="cong-label">{{ c.port__name.split(' ')[0] }}</span>
              <div class="cong-bar-wrap">
                <div class="cong-bar" :style="{ transform: `scaleX(${maxTEU > 0 ? c.teus / maxTEU : 0})`, background: 'var(--primary-fill)' }" />
              </div>
              <span class="cong-val">{{ fmtNum(c.teus) }} TEU</span>
            </div>
          </div>
          <EmptyState v-else :loading="loading" message="No container data" compact />
        </div>
      </div>
    </div>
  </div>

  <!-- Live vessel movements preview -->
  <SectionTitle pill="KMA AIS · Live">Vessel Movements - In Port</SectionTitle>

  <div id="vessel-movements-live" class="card drill-target">
    <div class="card-header">
      Recent Movements
      <NuxtLink to="/maritime/vessels" class="link-sm">Full movement log →</NuxtLink>
    </div>
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Vessel</th>
            <th>Port</th>
            <th>Movement</th>
            <th>Status</th>
            <th>ETA / ETD</th>
          </tr>
        </thead>
        <tbody v-if="filteredMovements.length">
          <tr v-for="m in movementsPageRows" :key="m.id">
            <td style="font-weight:600">{{ m.vessel_name }}</td>
            <td style="font-family:monospace;font-size:12px">{{ m.port_unlocode }}</td>
            <td><BadgePill variant="neutral">{{ m.movement_type.replace(/_/g,' ') }}</BadgePill></td>
            <td><BadgePill :variant="mvmtBadge(m.status)">{{ m.status.replace(/_/g,' ') }}</BadgePill></td>
            <td style="font-size:11px;white-space:nowrap">
              <div v-if="m.eta">ETA: {{ fmtDate(m.eta) }}</div>
              <div v-if="m.etd">ETD: {{ fmtDate(m.etd) }}</div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="5" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading movements…' : 'No vessel movements.' }}</td></tr>
        </tbody>
      </table>
      <TablePagination
        :page="movementsPage" :total-pages="movementsTotalPages" :total="movementsTotal"
        @prev="movementsPrev" @next="movementsNext"
      />
    </div>
  </div>

  <!-- Vessel registry preview + berth availability -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">
        Vessel Registry (KMA)
        <NuxtLink to="/maritime/vessels" class="link-sm">Full registry →</NuxtLink>
      </div>
      <div class="card-body">
        <table>
          <thead>
            <tr>
              <th>Vessel</th>
              <th>IMO</th>
              <th>Type</th>
              <th>Flag</th>
              <th>GRT</th>
              <th>Safety Cert</th>
            </tr>
          </thead>
          <tbody v-if="vessels.length">
            <tr v-for="v in vesselsPageRows" :key="v.id">
              <td style="font-weight:600;font-size:13px">{{ v.vessel_name }}</td>
              <td style="font-family:monospace;font-size:12px">{{ v.imo_number }}</td>
              <td><BadgePill variant="info">{{ v.vessel_type.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-size:12px">{{ v.flag_state }}</td>
              <td style="font-size:12px">{{ fmtNum(v.gross_tonnage) }}</td>
              <td><BadgePill :variant="certBadge(v.safety_cert_status)">{{ v.safety_cert_status }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr><td colspan="6" style="text-align:center;color:var(--fg-3);padding:12px">{{ loading ? 'Loading…' : 'No vessels.' }}</td></tr>
          </tbody>
        </table>
        <TablePagination
          :page="vesselsPage" :total-pages="vesselsTotalPages" :total="vesselsTotal"
          @prev="vesselsPrev" @next="vesselsNext"
        />
      </div>
    </div>

    <div class="card">
      <div class="card-header">Berth Directory</div>
      <div class="card-body">
        <table>
          <thead>
            <tr>
              <th>Berth</th>
              <th>Type</th>
              <th>Port</th>
              <th>Length (m)</th>
              <th>Max Draft (m)</th>
              <th>Cranes</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody v-if="berths.length">
            <tr v-for="b in berthsPageRows" :key="b.id">
              <td style="font-family:monospace;font-weight:600">{{ b.berth_code }}</td>
              <td><BadgePill variant="neutral">{{ b.berth_type.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-family:monospace;font-size:12px">{{ b.port_unlocode }}</td>
              <td>{{ b.length_m }}</td>
              <td>{{ b.max_draft_m }}</td>
              <td>{{ b.crane_count }}</td>
              <td><BadgePill :variant="b.active ? 'success' : 'danger'">{{ b.active ? 'Active' : 'Inactive' }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr><td colspan="7" style="text-align:center;color:var(--fg-3);padding:12px">{{ loading ? 'Loading…' : 'No berths.' }}</td></tr>
          </tbody>
        </table>
        <TablePagination
          :page="berthsPage" :total-pages="berthsTotalPages" :total="berthsTotal"
          @prev="berthsPrev" @next="berthsNext"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useAviationMaritime } from '~/composables/api'
import type { MaritimeOps, Port, Berth, Vessel, VesselMovement, ContainerByPort } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

const ops            = ref<MaritimeOps | null>(null)
const ports          = ref<Port[]>([])
const berths         = ref<Berth[]>([])
const vessels        = ref<Vessel[]>([])
const liveMovements  = ref<VesselMovement[]>([])
const containers     = ref<ContainerByPort[]>([])
const incidentStats  = ref<{ total_incidents: number; fatal_incidents: number; casualties: number; pollution_tons: number } | null>(null)
const loading        = ref(true)
const error          = ref<string | null>(null)
const lastRefreshed  = ref('-')

const route = useRoute()
const queryWindow = Number.parseInt(String(route.query.window ?? ''), 10)
const days = ref([7, 30, 90].includes(queryWindow) ? queryWindow : 30)

const portFilter     = ref('')
const vesselTypeFilter = ref('')

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()

  const [opRes, poRes, beRes, vsRes, lmRes, ctRes, incRes] = await Promise.allSettled([
    avm.maritimeOperations(days.value),
    avm.ports(),
    avm.berths({ port: portFilter.value || undefined, page_size: 30 }),
    avm.vessels({ page_size: 30 }),
    avm.vesselMovementsLive(),
    avm.containerByPort({ days: days.value }),
    avm.maritimeIncidentStats(90),
  ])

  if (opRes.status  === 'fulfilled') ops.value           = opRes.value
  if (poRes.status  === 'fulfilled') ports.value         = (poRes.value as any).results ?? []
  if (beRes.status  === 'fulfilled') berths.value        = (beRes.value as any).results ?? []
  if (vsRes.status  === 'fulfilled') vessels.value       = (vsRes.value as any).results ?? []
  if (lmRes.status  === 'fulfilled') liveMovements.value = Array.isArray(lmRes.value) ? lmRes.value : (lmRes.value as any).results ?? []
  if (ctRes.status  === 'fulfilled') containers.value    = (ctRes.value as any).results ?? []
  if (incRes.status === 'fulfilled') incidentStats.value = incRes.value

  if ([opRes, lmRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const filteredMovements = computed(() =>
  liveMovements.value.filter(m => {
    if (portFilter.value      && m.port_unlocode !== portFilter.value)  return false
    if (vesselTypeFilter.value && m.cargo_type   !== vesselTypeFilter.value) return false
    return true
  }),
)

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: movementsPageRows, page: movementsPage, totalPages: movementsTotalPages,
  total: movementsTotal, next: movementsNext, prev: movementsPrev,
} = usePagination(filteredMovements, 15)

const {
  pageRows: vesselsPageRows, page: vesselsPage, totalPages: vesselsTotalPages,
  total: vesselsTotal, next: vesselsNext, prev: vesselsPrev,
} = usePagination(vessels, 15)

const {
  pageRows: berthsPageRows, page: berthsPage, totalPages: berthsTotalPages,
  total: berthsTotal, next: berthsNext, prev: berthsPrev,
} = usePagination(berths, 15)

const vesselMarkers = computed((): MarkerSpec[] => {
  const portCoords: Record<string, [number, number]> = {
    KEMBA: [-4.05, 39.68], KELAU: [-2.27, 40.92],
  }
  return ops.value?.ports
    ? ops.value.ports.map((p, i) => {
        const coords = portCoords[p.port_unlocode] ?? [-4.0 + i * 0.5, 39.7 + i * 0.3]
        return {
          id: `port-${p.port_unlocode}`,
          lat: coords[0], lon: coords[1],
          title: p.port_name,
          subtitle: `${p.currently_in_port} vessels · ${fmtNum(p.teu_throughput_30d)} TEU/30d`,
          color: 'blue',
          size: 'lg',
        }
      })
    : []
})

const maxTEU = computed(() => Math.max(1, ...containers.value.map(c => c.teus)))

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string | null) {
  if (!s) return '-'
  try { return new Date(s).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return s }
}
function mvmtBadge(s: string) {
  const m: Record<string,string> = { in_port:'success', in_transit:'info', scheduled:'neutral', departed:'fair', delayed:'warning', cancelled:'danger' }
  return m[s] ?? 'neutral'
}
function certBadge(s: string) {
  const m: Record<string,string> = { valid:'success', pending:'warning', expired:'danger' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.link-sm { font-size:12px; color:var(--link); text-decoration:none; font-weight:600; }
.link-sm:hover { text-decoration:underline; }
.kpi-grid { margin-bottom:16px; }
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1100px) { .two-col-map, .two-col { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid var(--border-subtle); }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.right-col { display:flex; flex-direction:column; overflow-y:auto; max-height:520px; gap:12px; }
.port-card { background:var(--surface-1); border:1px solid var(--border-subtle); border-radius:8px; padding:10px 14px; }
.port-header { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.port-count { margin-left:auto; font-size:12px; color:var(--fg-2); font-weight:600; }
.port-stats { display:grid; grid-template-columns:1fr 1fr; gap:4px 16px; }
.ps-label { display:block; font-size:10px; color:var(--fg-3); }
.cong-list { display:flex; flex-direction:column; gap:7px; }
.cong-row { display:grid; grid-template-columns:80px 1fr 70px; align-items:center; gap:8px; }
.cong-label { font-size:12px; }
.cong-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.cong-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
.cong-val { font-size:11px; text-align:right; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
</style>
