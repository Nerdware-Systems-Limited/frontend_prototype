<script setup lang="ts">
// pages/fleet.vue — M03 Fleet Tracking
// Backend: /api/v1/fleet/ — vehicles, GPS tracks, geofences, behaviour,
//          route adherence, speed governors, trips, utilisation, summary.
definePageMeta({ title: 'Fleet' })

import { useFleet } from '~/composables/api'
import type {
  FleetSummary, Vehicle, Geofence, DriverBehaviorEvent, SpeedGovernorStatus,
  VehicleType,
} from '~/composables/api'

const fleet = useFleet()

const summary = ref<FleetSummary | null>(null)
const vehicles = ref<Vehicle[]>([])
const geofences = ref<Geofence[]>([])
const behaviour = ref<DriverBehaviorEvent[]>([])
const governors = ref<SpeedGovernorStatus[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const typeFilter = ref<VehicleType | ''>('')
const statusFilter = ref<string>('')
const search = ref('')

async function load() {
  loading.value = true
  error.value = null
  try {
    const [sum, veh, gf, beh, gov] = await Promise.all([
      fleet.summary(),
      fleet.vehicles({ page_size: 30, vehicle_type: typeFilter.value || undefined, status: statusFilter.value || undefined, search: search.value || undefined }),
      fleet.geofences({ page_size: 12 }),
      fleet.behaviourEvents({ page_size: 15 }),
      fleet.speedGovernorStatus({ page_size: 15 }),
    ])
    summary.value = sum
    vehicles.value = (veh as any).results ?? []
    geofences.value = (gf as any).results ?? []
    behaviour.value = (beh as any).results ?? []
    governors.value = (gov as any).results ?? []
  } catch (err: any) {
    error.value = err?.status === 401
      ? 'Not authenticated — please log in.'
      : err?.message ?? 'Failed to load fleet data.'
  } finally {
    loading.value = false
  }
}

watch([typeFilter, statusFilter], () => { load() })

onMounted(load)

const livePct = computed(() => {
  if (!summary.value?.kpis.total_vehicles) return 0
  return Math.round((summary.value.kpis.live_vehicles * 100) / summary.value.kpis.total_vehicles)
})

function sevBadge(s: string) {
  return s === 'critical' || s === 'high' ? 'danger'
       : s === 'medium' ? 'warning'
       : 'neutral'
}
function govBadge(s: string) {
  return s === 'online' ? 'success' : s === 'tampered' ? 'danger' : s === 'fault' ? 'warning' : 'neutral'
}
function fmtKES(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(0)
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="fleet-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M03</div>
        <h1 class="text-display">Fleet Tracking</h1>
        <p class="text-sm text-fg-muted mt-1">
          Live positions, geofence breaches, driver behaviour, speed-governor compliance &amp; utilisation.
        </p>
      </div>
      <button class="btn btn-secondary" :disabled="loading" @click="load">↻ Refresh</button>
    </div>

    <!-- KPI strip -->
    <div v-if="summary" class="kpi-grid">
      <div class="card kpi">
        <div class="kpi-label">Total Vehicles</div>
        <div class="kpi-value">{{ summary.kpis.total_vehicles.toLocaleString() }}</div>
        <div class="kpi-sub">Across {{ summary.vehicles_by_type.length }} types</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Live (last 10 min)</div>
        <div class="kpi-value">{{ summary.kpis.live_vehicles.toLocaleString() }}</div>
        <div class="kpi-sub">{{ livePct }}% reporting</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Trips (7d)</div>
        <div class="kpi-value">{{ summary.kpis.trips_7d.toLocaleString() }}</div>
        <div class="kpi-sub">{{ summary.kpis.distance_7d_km.toLocaleString() }} km</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Governor Online</div>
        <div class="kpi-value">{{ summary.governor_compliance.online_pct }}%</div>
        <div class="kpi-sub">
          tamper {{ summary.governor_compliance.tamper_rate_pct }}%
          · fault {{ summary.governor_compliance.fault_rate_pct }}%
        </div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Critical Events (24h)</div>
        <div class="kpi-value">{{ summary.behaviour_critical_24h.toLocaleString() }}</div>
        <div class="kpi-sub">of {{ Object.values(summary.behaviour_events_24h).reduce((a, b) => a + b, 0) }} total</div>
      </div>
    </div>

    <!-- Vehicles by type / status -->
    <div v-if="summary" class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Vehicles by Type</div>
        </div>
        <div class="bar-list">
          <div v-for="row in summary.vehicles_by_type" :key="row.vehicle_type" class="bar-row">
            <span class="bar-label">{{ row.vehicle_type.replace('_', ' ') }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: ((row.total / summary.kpis.total_vehicles) * 100) + '%' }"></div>
            </div>
            <span class="bar-value">{{ row.total }}</span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Vehicles by Status</div>
        </div>
        <div class="status-grid">
          <div v-for="(count, status) in summary.vehicles_by_status" :key="status" class="status-chip">
            <span class="badge" :class="status === 'operational' ? 'badge-success' : status === 'maintenance' ? 'badge-warning' : 'badge-danger'">
              {{ status }}
            </span>
            <span class="status-count">{{ count.toLocaleString() }}</span>
          </div>
        </div>
        <div v-if="summary.top_breaches_24h.length" class="mt-4">
          <div class="text-label text-fg-dim mb-2">Top Geofence Breaches (24h)</div>
          <div v-for="b in summary.top_breaches_24h.slice(0, 5)" :key="b.geofence_id" class="breach-row">
            <span class="breach-name">{{ b.geofence__zone_name }}</span>
            <span class="badge badge-neutral">{{ b.geofence__zone_type }}</span>
            <span class="font-mono">{{ b.c }} breaches</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters + vehicle table -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Vehicle Registry</div>
        <div class="filter-row">
          <select v-model="typeFilter" class="select">
            <option value="">All types</option>
            <option value="psv_matatu">PSV Matatu</option>
            <option value="psv_bus">PSV Bus</option>
            <option value="brt">BRT</option>
            <option value="taxi">Taxi</option>
            <option value="truck">Truck</option>
            <option value="government">Government</option>
            <option value="private">Private</option>
            <option value="rail">Rail</option>
          </select>
          <select v-model="statusFilter" class="select">
            <option value="">All statuses</option>
            <option value="operational">Operational</option>
            <option value="maintenance">Maintenance</option>
            <option value="impounded">Impounded</option>
          </select>
          <input class="search-input" placeholder="Search plate…" v-model="search" @keyup.enter="load" />
        </div>
      </div>
      <div v-if="error" class="card-body text-fg-muted">{{ error }}</div>
      <div v-else-if="loading && !vehicles.length" class="card-body text-fg-muted">Loading…</div>
      <div v-else-if="!vehicles.length" class="card-body text-fg-muted">No vehicles match.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Plate</th><th>Type</th><th>Operator</th><th>Status</th>
            <th>Last Seen</th><th>Speed</th><th>Governor</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in vehicles" :key="v.id">
            <td class="font-mono">{{ v.plate_number }}</td>
            <td><span class="badge badge-neutral">{{ v.vehicle_type.replace('_', ' ') }}</span></td>
            <td class="text-sm">{{ v.operator_name || '—' }}</td>
            <td>
              <span class="badge" :class="v.status === 'operational' ? 'badge-success' : v.status === 'maintenance' ? 'badge-warning' : 'badge-danger'">
                {{ v.status }}
              </span>
            </td>
            <td class="font-mono text-xs">
              {{ fmtDate(v.last_seen_at) }}
              <span v-if="v.has_recent_track" class="live-dot" title="Live"></span>
            </td>
            <td class="font-mono text-xs">
              {{ v.last_speed_kmh != null ? v.last_speed_kmh.toFixed(0) + ' km/h' : '—' }}
            </td>
            <td>
              <span v-if="v.has_speed_governor" class="badge badge-info">fitted</span>
              <span v-else class="text-fg-dim text-xs">none</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Geofences + behaviour -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Active Geofences</div>
          <span class="badge badge-neutral">{{ geofences.length }} of {{ geofences.length }}+</span>
        </div>
        <div v-if="!geofences.length" class="card-body text-fg-muted">No active zones.</div>
        <div v-else class="geofence-list">
          <div v-for="g in geofences.slice(0, 10)" :key="g.id" class="geofence-row">
            <div>
              <div class="text-sm font-medium">{{ g.zone_name }}</div>
              <div class="text-xs text-fg-muted">
                {{ g.zone_type }} · {{ g.severity }}
                <span v-if="g.radius_m"> · {{ g.radius_m }}m</span>
              </div>
            </div>
            <span class="badge" :class="g.is_active ? 'badge-success' : 'badge-neutral'">
              {{ g.is_active ? 'active' : 'inactive' }}
            </span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="text-subhead">Recent Driver Behaviour</div>
        </div>
        <div v-if="!behaviour.length" class="card-body text-fg-muted">No recent events.</div>
        <div v-else class="behaviour-list">
          <div v-for="b in behaviour.slice(0, 12)" :key="b.id" class="behaviour-row">
            <span class="badge" :class="`badge-${sevBadge(b.severity)}`">{{ b.severity }}</span>
            <span class="font-mono text-sm">{{ b.plate_number }}</span>
            <span class="text-sm">{{ b.event_type.replace('_', ' ') }}</span>
            <span class="text-xs text-fg-muted">
              {{ b.speed_kmh ? b.speed_kmh.toFixed(0) + ' km/h' : '' }}
            </span>
            <span class="text-xs text-fg-dim ml-auto">{{ fmtDate(b.detected_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Speed governor status -->
    <div class="card">
      <div class="card-header">
        <div class="text-subhead">Speed Governor Telemetry</div>
        <span class="badge badge-neutral">{{ governors.length }} samples</span>
      </div>
      <table v-if="governors.length" class="data-table">
        <thead>
          <tr><th>Plate</th><th>Status</th><th>Cap</th><th>Observed max</th><th>Tamper</th><th>Reported</th></tr>
        </thead>
        <tbody>
          <tr v-for="g in governors.slice(0, 12)" :key="g.id">
            <td class="font-mono">{{ g.plate_number }}</td>
            <td><span class="badge" :class="`badge-${govBadge(g.status)}`">{{ g.status }}</span></td>
            <td class="font-mono text-xs">{{ g.cap_kmh ?? '—' }}</td>
            <td class="font-mono text-xs">{{ g.observed_max_kmh?.toFixed(0) ?? '—' }}</td>
            <td>
              <span v-if="g.tamper_detected" class="badge badge-danger">yes</span>
              <span v-else class="text-fg-dim text-xs">no</span>
            </td>
            <td class="font-mono text-xs">{{ fmtDate(g.reported_at) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="card-body text-fg-muted">No governor data.</div>
    </div>
  </div>
</template>

<style scoped>
.fleet-page { display: flex; flex-direction: column; gap: 20px; }
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.kpi { padding: 14px 18px; }
.kpi-label { font-size: 0.7rem; text-transform: uppercase; color: var(--fg-muted, #8fa3b8); letter-spacing: 0.05em; }
.kpi-value { font-size: 1.6rem; font-weight: 700; margin: 6px 0 4px; }
.kpi-sub { font-size: 0.75rem; color: var(--fg-muted, #8fa3b8); }
.grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.bar-list, .status-grid, .geofence-list, .behaviour-list { padding: 6px 0; }
.bar-row {
  display: grid;
  grid-template-columns: 120px 1fr 60px;
  align-items: center;
  gap: 12px;
  padding: 8px 18px;
  font-size: 0.8125rem;
}
.bar-label { text-transform: capitalize; }
.bar-track { background: rgba(255,255,255,0.04); border-radius: 4px; height: 8px; overflow: hidden; }
.bar-fill { background: linear-gradient(90deg, #3b82f6, #22d3ee); height: 100%; }
.bar-value { font-family: 'JetBrains Mono', monospace; text-align: right; color: var(--fg-muted); }
.status-grid { display: flex; flex-wrap: wrap; gap: 12px; padding: 14px 18px; }
.status-chip {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.03);
  padding: 8px 12px; border-radius: 6px;
}
.status-count { font-family: 'JetBrains Mono', monospace; font-weight: 600; }
.breach-row {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 18px; font-size: 0.8125rem;
}
.breach-name { flex: 1; }
.filter-row { display: flex; gap: 8px; align-items: center; }
.select, .search-input {
  background: var(--bg-2, #0f1623);
  border: 1px solid var(--border, #1e2d42);
  color: var(--fg, #e2eaf5);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.8125rem;
}
.geofence-row, .behaviour-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 18px; border-bottom: 1px solid var(--border, #1e2d42);
}
.geofence-row:last-child, .behaviour-row:last-child { border-bottom: 0; }
.live-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: #10b981; margin-left: 6px;
  box-shadow: 0 0 6px #10b981;
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.ml-auto { margin-left: auto; }
.card-body { padding: 18px; }
</style>