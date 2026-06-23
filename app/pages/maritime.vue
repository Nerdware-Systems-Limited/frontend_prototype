<script setup lang="ts">
// pages/maritime.vue — M07 Maritime (KPA + KMA + LAPSSET)
// Backend: /api/v1/aviation-maritime/maritime/ — ports, berths, vessels,
//          vessel movements (incl. live), container throughput, yard dwell,
//          inspections, incidents, operations summary.
definePageMeta({ title: 'Maritime' })

import { useAviationMaritime } from '~/composables/api'
import type {
  MaritimeOps, PortOps, Port, Berth, Vessel, VesselMovement,
  ContainerByPort, PortType,
} from '~/composables/api'

const avm = useAviationMaritime()

const ops = ref<MaritimeOps | null>(null)
const ports = ref<Port[]>([])
const berths = ref<Berth[]>([])
const vessels = ref<Vessel[]>([])
const liveMovements = ref<VesselMovement[]>([])
const containers = ref<ContainerByPort[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const portFilter = ref('')
const days = ref(30)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [op, po, be, vs, lm, ct] = await Promise.all([
      avm.maritimeOperations(days.value),
      avm.ports(),
      avm.berths({ port: portFilter.value || undefined, page_size: 20 }),
      avm.vessels({ page_size: 30 }),
      avm.vesselMovementsLive(),
      avm.containerByPort({ days: days.value }),
    ])
    ops.value = op
    ports.value = (po as any).results ?? []
    berths.value = (be as any).results ?? []
    vessels.value = (vs as any).results ?? []
    liveMovements.value = (lm as any) ?? []
    containers.value = (ct as any).results ?? []
  } catch (err: any) {
    error.value = err?.status === 401
      ? 'Not authenticated — please log in.'
      : err?.message ?? 'Failed to load maritime data.'
  } finally {
    loading.value = false
  }
}

watch([days, portFilter], () => { load() })
onMounted(load)

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })
}
function portTypeBadge(t: PortType | string) {
  return t === 'sea' ? 'badge-info'
       : t === 'oil' ? 'badge-warning'
       : t === 'fishing' ? 'badge-success'
       : 'badge-neutral'
}
function moveBadge(s: string) {
  return s === 'in_port' || s === 'departed' ? 'badge-success'
       : s === 'delayed' || s === 'cancelled' ? 'badge-warning'
       : 'badge-info'
}
function certBadge(s: string) {
  return s === 'valid' ? 'badge-success' : s === 'expired' ? 'badge-danger' : 'badge-warning'
}
function fmtTEU(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(0)
}
</script>

<template>
  <div class="maritime-page">
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M07 · Maritime</div>
        <h1 class="text-display">Maritime Operations</h1>
        <p class="text-sm text-fg-muted mt-1">
          KPA ports, vessel tracking (AIS-derived), berth operations, container throughput, yard dwell.
        </p>
      </div>
      <div class="flex gap-2">
        <select v-model="days" class="select">
          <option :value="7">Last 7d</option>
          <option :value="30">Last 30d</option>
          <option :value="60">Last 60d</option>
          <option :value="90">Last 90d</option>
        </select>
        <button class="btn btn-secondary" :disabled="loading" @click="load">↻ Refresh</button>
      </div>
    </div>

    <!-- KPIs -->
    <div v-if="ops" class="kpi-grid">
      <div class="card kpi">
        <div class="kpi-label">Active Ports</div>
        <div class="kpi-value">{{ ops.kpis.active_ports }}</div>
        <div class="kpi-sub">KPA + LAPSSET corridor</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Live Vessels</div>
        <div class="kpi-value">{{ ops.kpis.live_vessels }}</div>
        <div class="kpi-sub">In port or transit</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Incidents (30d)</div>
        <div class="kpi-value">{{ ops.kpis.incidents_30d }}</div>
        <div class="kpi-sub">All severities</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Inspections (30d)</div>
        <div class="kpi-value">{{ ops.kpis.inspections_30d }}</div>
        <div class="kpi-sub">{{ ops.kpis.detentions_30d }} detentions</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Live Movements</div>
        <div class="kpi-value">{{ liveMovements.length }}</div>
        <div class="kpi-sub">Currently tracked</div>
      </div>
    </div>

    <!-- Per-port operations -->
    <div v-if="ops" class="card">
      <div class="card-header">
        <div class="text-subhead">Per-Port Operations ({{ days }}d)</div>
        <span class="badge badge-neutral">{{ ops.ports.length }} ports</span>
      </div>
      <div v-if="!ops.ports.length" class="card-body text-fg-muted">No port data.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Port</th><th>Type</th><th>Arrivals</th><th>Departures</th>
            <th>In Port</th><th>TEU</th><th>Yard Dwell</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in ops.ports" :key="p.port_unlocode">
            <td>
              <div class="text-sm font-medium">{{ p.port_name }}</div>
              <div class="text-xs text-fg-muted font-mono">{{ p.port_unlocode }}</div>
            </td>
            <td><span class="badge" :class="`badge-${portTypeBadge(p.port_type)}`">{{ p.port_type.replace('_', ' ') }}</span></td>
            <td class="font-mono text-xs">{{ p.arrivals_30d }}</td>
            <td class="font-mono text-xs">{{ p.departures_30d }}</td>
            <td class="font-mono text-xs">
              <span v-if="p.currently_in_port > 0" class="badge badge-info">{{ p.currently_in_port }}</span>
              <span v-else class="text-fg-dim">0</span>
            </td>
            <td class="font-mono text-xs">{{ fmtTEU(p.teu_throughput_30d) }}</td>
            <td class="font-mono text-xs">{{ p.avg_yard_dwell_days.toFixed(1) }}d</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Ports + Containers -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Ports</div>
        </div>
        <div v-if="!ports.length" class="card-body text-fg-muted">No ports.</div>
        <table v-else class="data-table">
          <thead><tr><th>UN/LOCODE</th><th>Name</th><th>Type</th><th>Operator</th><th>Design TEU</th></tr></thead>
          <tbody>
            <tr v-for="p in ports" :key="p.id">
              <td class="font-mono font-bold">{{ p.unlocode }}</td>
              <td>
                <div class="text-sm font-medium">{{ p.name }}</div>
                <div class="text-xs text-fg-muted">{{ p.country }}</div>
              </td>
              <td><span class="badge" :class="`badge-${portTypeBadge(p.port_type)}`">{{ p.port_type.replace('_', ' ') }}</span></td>
              <td class="text-xs">{{ p.operator }}</td>
              <td class="font-mono text-xs">{{ p.design_throughput_teu.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Container Throughput by Port ({{ days }}d)</div>
        </div>
        <div v-if="!containers.length" class="card-body text-fg-muted">No throughput data.</div>
        <div v-else class="bar-list">
          <div v-for="c in containers" :key="c.port__unlocode" class="bar-row">
            <span class="bar-label font-mono">{{ c.port__unlocode }}</span>
            <div class="bar-track">
              <div class="bar-fill"
                   :style="{ width: ((c.teus / Math.max(...containers.map(x => x.teus))) * 100) + '%' }"></div>
            </div>
            <span class="bar-value">
              {{ fmtTEU(c.teus) }} TEU
              <span class="text-fg-dim">({{ c.boxes.toLocaleString() }} boxes · {{ fmtTEU(c.tons) }}t)</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Live vessel movements -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Live Vessel Movements</div>
        <span class="badge badge-success">
          <span class="live-dot"></span>
          {{ liveMovements.length }} active
        </span>
      </div>
      <div v-if="error" class="card-body text-fg-muted">{{ error }}</div>
      <div v-else-if="loading && !liveMovements.length" class="card-body text-fg-muted">Loading…</div>
      <div v-else-if="!liveMovements.length" class="card-body text-fg-muted">No live movements.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Vessel</th><th>IMO</th><th>Type</th><th>Port</th><th>Berth</th>
            <th>Movement</th><th>Status</th><th>ETA/ETD</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in liveMovements.slice(0, 25)" :key="m.id">
            <td class="text-sm font-medium">{{ m.vessel_name }}</td>
            <td class="font-mono text-xs">{{ m.vessel_imo }}</td>
            <td class="text-xs">{{ m.cargo_type || '—' }}</td>
            <td class="font-mono">{{ m.port_unlocode }}</td>
            <td class="font-mono text-xs">{{ m.berth_code || '—' }}</td>
            <td class="text-xs">{{ m.movement_type.replace('_', ' ') }}</td>
            <td><span class="badge" :class="`badge-${moveBadge(m.status)}`">{{ m.status.replace('_', ' ') }}</span></td>
            <td class="font-mono text-xs">
              <div v-if="m.eta">{{ fmtDate(m.eta) }}</div>
              <div v-if="m.etd" class="text-fg-dim">→ {{ fmtDate(m.etd) }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Vessels -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Vessel Registry</div>
        <span class="badge badge-neutral">{{ vessels.length }} shown</span>
      </div>
      <div v-if="!vessels.length" class="card-body text-fg-muted">No vessels.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Name</th><th>IMO</th><th>Type</th><th>Flag</th>
            <th>GT</th><th>DWT</th><th>LOA</th><th>Cert</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in vessels.slice(0, 20)" :key="v.id">
            <td class="text-sm font-medium">{{ v.vessel_name }}</td>
            <td class="font-mono text-xs">{{ v.imo_number }}</td>
            <td class="text-xs">{{ v.vessel_type.replace('_', ' ') }}</td>
            <td class="text-xs">{{ v.flag_state }}</td>
            <td class="font-mono text-xs">{{ v.gross_tonnage.toLocaleString() }}</td>
            <td class="font-mono text-xs">{{ v.deadweight_tonnage.toLocaleString() }}</td>
            <td class="font-mono text-xs">{{ v.length_overall_m.toFixed(0) }}m</td>
            <td><span class="badge" :class="`badge-${certBadge(v.safety_cert_status)}`">{{ v.safety_cert_status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Berths -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Berths</div>
        <select v-model="portFilter" class="select">
          <option value="">All ports</option>
          <option v-for="p in ports" :key="p.unlocode" :value="p.unlocode">{{ p.unlocode }} · {{ p.name }}</option>
        </select>
      </div>
      <div v-if="!berths.length" class="card-body text-fg-muted">No berths.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Berth</th><th>Port</th><th>Type</th><th>Length</th>
            <th>Max Draft</th><th>Max LOA</th><th>Cranes</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in berths" :key="b.id">
            <td>
              <div class="text-sm font-medium">{{ b.name }}</div>
              <div class="text-xs text-fg-muted font-mono">{{ b.berth_code }}</div>
            </td>
            <td class="font-mono text-xs">{{ b.port_unlocode }}</td>
            <td class="text-xs">{{ b.berth_type.replace('_', ' ') }}</td>
            <td class="font-mono text-xs">{{ b.length_m.toFixed(0) }}m</td>
            <td class="font-mono text-xs">{{ b.max_draft_m.toFixed(1) }}m</td>
            <td class="font-mono text-xs">{{ b.max_vessel_loa.toFixed(0) }}m</td>
            <td class="font-mono text-xs">{{ b.crane_count }}</td>
            <td>
              <span v-if="b.active" class="badge badge-success">active</span>
              <span v-else class="badge badge-neutral">inactive</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.maritime-page { display: flex; flex-direction: column; gap: 20px; }
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.kpi { padding: 14px 18px; }
.kpi-label { font-size: 0.7rem; text-transform: uppercase; color: var(--fg-muted, #8fa3b8); letter-spacing: 0.05em; }
.kpi-value { font-size: 1.6rem; font-weight: 700; margin: 6px 0 4px; }
.kpi-sub { font-size: 0.72rem; color: var(--fg-muted, #8fa3b8); }
.grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.bar-list { padding: 6px 0; }
.bar-row {
  display: grid;
  grid-template-columns: 110px 1fr 200px;
  align-items: center;
  gap: 12px;
  padding: 8px 18px;
  font-size: 0.8125rem;
}
.bar-track { background: rgba(255,255,255,0.04); border-radius: 4px; height: 10px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, #0ea5e9, #22d3ee); }
.bar-value { font-family: 'JetBrains Mono', monospace; text-align: right; color: var(--fg-muted); font-size: 0.75rem; }
.live-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: #10b981; margin-right: 6px;
  box-shadow: 0 0 6px #10b981;
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.select {
  background: var(--bg-2, #0f1623);
  border: 1px solid var(--border, #1e2d42);
  color: var(--fg, #e2eaf5);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.8125rem;
}
.flex { display: flex; }
.gap-2 { gap: 8px; }
.card-body { padding: 18px; }
</style>