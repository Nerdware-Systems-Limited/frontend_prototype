<script setup lang="ts">
// pages/rail.vue - M08 Railway Management
// FR-M08-001..015: real-time train ops, live tracking, schedule adherence,
// freight manifests, rolling stock, safety incidents, ridership & revenue,
// ticketing integration, intermodal (port ↔ rail) coordination.
//
// Backend: /api/v1/railway/ - lines, stations, trains, schedules,
// operations, freight, incidents, tickets. Plus /summary/ for the
// one-shot dashboard, /operations/live/, /freight/by-corridor/, etc.
//
// Map data: /api/v1/geojson/rail-lines/ + /api/v1/geojson/rail-stations/
// fed by real PostGIS geometries from the OSM railways export.
//
// Data sources: hotosm_ken_railways_osm_shp (1,724 rail lines + 150
// stations, classified SGR / MGR / Uganda Railway by name), and
// calibrated random data for schedules / freight / tickets / incidents
// (matched to KRC + ASRO published ridership & freight tonnages).

definePageMeta({ title: 'Rail' })

import { useRailway } from '~/composables/api'
import type {
  RailwaySummary, TrainOperation, FreightManifest, RailIncident,
  RailSchedule, RailLine, RailStation, RailQuery, CargoType, IncidentType,
} from '~/composables/api'

const rail = useRailway()

const summary = ref<RailwaySummary | null>(null)
const liveOps = ref<TrainOperation[]>([])
const freight = ref<FreightManifest[]>([])
const incidents = ref<RailIncident[]>([])
const lines = ref<RailLine[]>([])
const stations = ref<RailStation[]>([])
const mapLines = ref<import('~/components/UaptsMap.vue').LineSpec[]>([])
const mapMarkers = ref<import('~/components/UaptsMap.vue').MarkerSpec[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const networkFilter = ref<string>('')
const days = ref(30)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [sum, live, fr, inc, ln, st, md] = await Promise.all([
      rail.summary(),
      rail.liveOperations(),
      rail.freight({ days: days.value, page_size: 12 }),
      rail.incidents({ days: days.value * 3, page_size: 10 }),
      rail.lines({ page_size: 50, network: networkFilter.value || undefined }),
      rail.stations({ page_size: 30 }),
      rail.mapData(),
    ])
    summary.value = sum
    liveOps.value = (live as any) ?? []
    freight.value = (fr as any).results ?? []
    incidents.value = (inc as any).results ?? []
    lines.value = (ln as any).results ?? []
    stations.value = (st as any).results ?? []
    mapLines.value = md.lines
    mapMarkers.value = md.markers
  } catch (err: any) {
    error.value = err?.status === 401
      ? 'Sign in to view railway data.'
      : err?.status === 404
        ? 'Railway endpoints not yet mounted - restart the backend.'
        : err?.message ?? 'Failed to load railway data.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch([networkFilter, days], () => load())

// ── Helpers ──────────────────────────────────────────────────────────
function fmtKsh(v: string | number | null | undefined): string {
  if (v == null) return '-'
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (Number.isNaN(n)) return '-'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toLocaleString()
}
function fmtNum(v: number | null | undefined, d = 0): string {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return '-'
  return `${v.toFixed(1)}%`
}
function fmtTime(iso?: string | null): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('en-KE', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short',
    })
  } catch { return iso }
}
function fmtDate(iso?: string | null): string {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }) }
  catch { return iso }
}
function cargoLabel(c: CargoType | string): string {
  return ({
    container: 'Container', bulk_fuel: 'Bulk fuel', bulk_cement: 'Bulk cement',
    grain: 'Grain', general: 'General goods', vehicle: 'Vehicles',
    steel: 'Steel / metals', other: 'Other',
  } as Record<string, string>)[c] ?? c
}
function cargoColor(c: CargoType | string): string {
  return ({
    container: '#3b82f6', bulk_fuel: '#ef4444', bulk_cement: '#94a3b8',
    grain: '#f59e0b', general: '#a855f7', vehicle: '#10b981',
    steel: '#06b6d4', other: '#64748b',
  } as Record<string, string>)[c] ?? '#64748b'
}
function sevColor(s: string): string {
  return s === 'fatal' ? '#ef4444'
    : s === 'serious' ? '#f97316'
    : s === 'minor' ? '#eab308'
    : '#64748b'
}
function incidentIcon(t: IncidentType | string): string {
  return ({
    collision: '💥', derailment: '🚂', level_crossing: '🚧',
    fire: '🔥', passenger: '👤', trespasser: '⚠',
    signal_failure: '🚦', derailment_minor: '⚙',
  } as Record<string, string>)[t] ?? '⚠'
}
function statusBadge(s: string): string {
  return s === 'in_transit' ? 'info'
    : s === 'boarding' ? 'warning'
    : s === 'arrived' ? 'success'
    : s === 'delayed' ? 'danger'
    : s === 'cancelled' ? 'danger'
    : s === 'departed' ? 'info'
    : 'neutral'
}
</script>

<template>
  <div class="rail-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M08 · Railway</div>
        <h1 class="text-display">Railway Operations</h1>
        <p class="text-sm text-fg-muted mt-1">
          SGR &amp; MGR train operations · Live train tracking · Schedule adherence ·
          Freight &amp; passenger revenue · Safety incidents · Rolling stock
        </p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="networkFilter" class="select select-sm">
          <option value="">All networks</option>
          <option value="sgr">SGR</option>
          <option value="mgr">MGR</option>
          <option value="uganda">Uganda Railway</option>
          <option value="industrial">Industrial</option>
        </select>
        <select v-model.number="days" class="select select-sm">
          <option :value="7">Last 7d</option>
          <option :value="30">Last 30d</option>
          <option :value="90">Last 90d</option>
        </select>
        <button class="btn btn-secondary" @click="load" :disabled="loading">
          <span v-if="loading">Refreshing…</span><span v-else>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Loading / error states -->
    <div v-if="loading && !summary" class="card">
      <div class="card-body text-fg-muted">Loading railway data from /api/v1/railway/…</div>
    </div>
    <div v-else-if="error" class="card">
      <div class="card-body text-fg-dim">{{ error }}</div>
    </div>

    <!-- KPI strip -->
    <div v-if="summary" class="kpi-grid">
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Rail Network</div>
        <div class="kpi-value">{{ summary.kpis.total_lines }}</div>
        <div class="text-xs text-fg-muted mt-1">
          <span style="color:#3b82f6">{{ summary.kpis.sgr_lines }} SGR</span> ·
          <span style="color:#10b981">{{ summary.kpis.mgr_lines }} MGR</span> ·
          {{ summary.kpis.total_stations }} stations
        </div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Trains in Service</div>
        <div class="kpi-value">{{ summary.kpis.trains_in_service }}<span class="text-fg-dim text-sm"> / {{ summary.kpis.total_trains }}</span></div>
        <div class="text-xs text-fg-muted mt-1">{{ summary.kpis.active_schedules }} active timetables</div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">On-Time (30d)</div>
        <div class="kpi-value">
          <span :style="{ color: summary.on_time_30d.on_time_pct >= 80 ? '#10b981' : summary.on_time_30d.on_time_pct >= 60 ? '#f59e0b' : '#ef4444' }">
            {{ summary.on_time_30d.on_time_pct }}%
          </span>
        </div>
        <div class="text-xs text-fg-muted mt-1">
          Avg {{ summary.on_time_30d.avg_delay_min.toFixed(1) }} min delay ·
          {{ summary.on_time_30d.cancelled }} cancelled
        </div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Freight (30d)</div>
        <div class="kpi-value">{{ fmtKsh(summary.freight_30d.total_tons) }}<span class="text-fg-dim text-sm"> t</span></div>
        <div class="text-xs text-fg-muted mt-1">
          KES {{ fmtKsh(summary.freight_30d.total_revenue_kes) }} ·
          {{ summary.freight_30d.shipments }} shipments
        </div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Passengers (30d)</div>
        <div class="kpi-value">{{ fmtNum(summary.ridership_30d.bookings) }}</div>
        <div class="text-xs text-fg-muted mt-1">
          KES {{ fmtKsh(summary.ridership_30d.revenue_kes) }} ·
          {{ summary.ridership_30d.no_show_rate_pct }}% no-show
        </div>
      </div>
      <div class="kpi-card card card-hover">
        <div class="text-label text-fg-dim">Open Incidents</div>
        <div class="kpi-value">
          <span :style="{ color: summary.kpis.open_incidents > 0 ? '#ef4444' : '#10b981' }">
            {{ summary.kpis.open_incidents }}
          </span>
        </div>
        <div class="text-xs text-fg-muted mt-1">
          90d: {{ summary.incidents_90d.total }} total · {{ summary.incidents_90d.fatal }} fatal
        </div>
      </div>
    </div>

    <!-- Map view: rail lines + stations (PostGIS geometries) -->
    <ClientOnly>
      <div class="card" style="padding: 0; overflow: hidden">
        <div class="card-header" style="padding: 12px 18px">
          <div>
            <div class="text-subhead">Rail Network · Live Map</div>
            <div class="text-xs text-fg-muted">
              SGR (blue) · MGR (green) · Uganda Railway (amber) · Industrial (purple) ·
              {{ mapLines.length }} line segments · {{ mapMarkers.length }} stations
            </div>
          </div>
        </div>
        <UaptsMap
          :lines="mapLines"
          :markers="mapMarkers"
          :initial-bbox="[-5, 33.5, 2, 42]"
          :center="[-0.5, 37.5]"
          :zoom="6"
          height="520px"
          show-legend
        />
      </div>
      <template #fallback>
        <div class="card" style="height: 560px"><div class="card-body text-fg-muted">Loading map…</div></div>
      </template>
    </ClientOnly>

    <div class="two-col">
      <!-- Live Operations -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="text-subhead">Live Operations</div>
            <div class="text-xs text-fg-muted">
              Currently in transit / boarding · FR-M08-001 · {{ liveOps.length }} active
            </div>
          </div>
        </div>
        <div v-if="liveOps.length === 0" class="card-body text-fg-muted">
          No trains currently in transit. (Service runs only on active timetables.)
        </div>
        <div v-else class="live-list">
          <div v-for="op in liveOps.slice(0, 12)" :key="op.id" class="live-row">
            <div class="live-train">
              <span class="train-no">{{ op.schedule_train_number }}</span>
              <span class="badge" :class="`badge-${statusBadge(op.status)}`">{{ op.status }}</span>
            </div>
            <div class="live-route">
              <span class="text-fg-dim">{{ op.origin_code }}</span>
              <span class="text-fg-dim mx-1">→</span>
              <span class="text-fg-dim">{{ op.destination_code }}</span>
            </div>
            <div class="live-meta">
              <span v-if="op.current_station_code" class="text-xs">@ {{ op.current_station_code }}</span>
              <span v-if="op.delay_arrival_min > 3" class="badge badge-danger">
                +{{ op.delay_arrival_min }} min
              </span>
              <span v-else-if="op.delay_arrival_min > 0" class="badge badge-warning">
                +{{ op.delay_arrival_min }} min
              </span>
              <span v-if="op.occupancy_pct != null" class="text-xs text-fg-muted">
                {{ Math.round(op.occupancy_pct) }}% full
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Schedule Adherence -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="text-subhead">Schedule Adherence</div>
            <div class="text-xs text-fg-muted">
              On-time performance · FR-M08-003 · last {{ days }} days
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="adherence-grid">
            <div class="adherence-item">
              <div class="text-label text-fg-dim">Total Operations</div>
              <div class="adherence-value">{{ fmtNum(summary?.on_time_30d.total_operations) }}</div>
            </div>
            <div class="adherence-item">
              <div class="text-label text-fg-dim">On-Time %</div>
              <div class="adherence-value" :style="{ color: (summary?.on_time_30d.on_time_pct ?? 0) >= 80 ? '#10b981' : (summary?.on_time_30d.on_time_pct ?? 0) >= 60 ? '#f59e0b' : '#ef4444' }">
                {{ summary?.on_time_30d.on_time_pct ?? 0 }}%
              </div>
            </div>
            <div class="adherence-item">
              <div class="text-label text-fg-dim">Avg Delay</div>
              <div class="adherence-value">{{ summary?.on_time_30d.avg_delay_min.toFixed(1) ?? '-' }}<span class="text-fg-dim text-sm"> min</span></div>
            </div>
            <div class="adherence-item">
              <div class="text-label text-fg-dim">Cancellations</div>
              <div class="adherence-value">{{ summary?.on_time_30d.cancelled ?? 0 }}</div>
            </div>
          </div>
          <!-- OTP bar -->
          <div class="otp-bar mt-3">
            <div
              class="otp-fill"
              :style="{
                width: (summary?.on_time_30d.on_time_pct ?? 0) + '%',
                background: (summary?.on_time_30d.on_time_pct ?? 0) >= 80 ? '#10b981' : (summary?.on_time_30d.on_time_pct ?? 0) >= 60 ? '#f59e0b' : '#ef4444'
              }"
            />
          </div>
          <div class="text-xs text-fg-muted mt-1">
            Target: 85% on-time. {{ (summary?.on_time_30d.on_time_pct ?? 0) >= 85 ? '✓ Above target.' : '✗ Below target - review KRC timetables.' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Top Routes & Top Corridors -->
    <div class="two-col">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="text-subhead">Top Routes by Bookings (30d)</div>
            <div class="text-xs text-fg-muted">FR-M08-007 · Passenger revenue</div>
          </div>
        </div>
        <div class="leaderboard-list">
          <div v-if="(summary?.top_routes ?? []).length === 0" class="card-body text-fg-muted">
            No bookings in the last 30 days.
          </div>
          <div v-for="(r, i) in summary?.top_routes ?? []" :key="i" class="lb-row">
            <div class="lb-rank">#{{ i + 1 }}</div>
            <div class="lb-info">
              <div class="lb-name">{{ r.origin__code }} → {{ r.destination__code }}</div>
              <div class="lb-sub">{{ r.origin__name }} → {{ r.destination__name }}</div>
            </div>
            <div class="lb-stats">
              <div class="lb-revenue">KES {{ fmtKsh(r.revenue) }}</div>
              <div class="text-xs text-fg-muted">{{ r.bookings }} bookings</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="text-subhead">Top Freight Corridors (30d)</div>
            <div class="text-xs text-fg-muted">FR-M08-005 · Tonnage by origin → destination</div>
          </div>
        </div>
        <div class="leaderboard-list">
          <div v-if="(summary?.freight_30d?.top_corridors ?? []).length === 0" class="card-body text-fg-muted">
            No freight movements in the last 30 days.
          </div>
          <div v-for="(c, i) in summary?.freight_30d?.top_corridors ?? []" :key="i" class="lb-row">
            <div class="lb-rank">#{{ i + 1 }}</div>
            <div class="lb-info">
              <div class="lb-name">{{ c.origin_station__code }} → {{ c.destination_station__code }}</div>
              <div class="lb-sub">
                <span class="cargo-dot" :style="{ background: cargoColor(c.cargo_type) }"></span>
                {{ cargoLabel(c.cargo_type) }} · {{ c.shipments }} shipments
              </div>
            </div>
            <div class="lb-stats">
              <div class="lb-revenue">{{ fmtNum(c.tons, 0) }} t</div>
              <div class="text-xs text-fg-muted">tonnage</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Freight & Incidents tables -->
    <div class="two-col">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="text-subhead">Recent Freight Manifests</div>
            <div class="text-xs text-fg-muted">KRC + KPA intermodal (port → rail) · Last {{ days }} days</div>
          </div>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="data-table">
            <thead>
              <tr>
                <th>Manifest</th><th>Cargo</th><th>Route</th><th>Tons</th><th>KES</th><th>Dispatched</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in freight.slice(0, 10)" :key="f.id">
                <td><code class="text-xs">{{ f.manifest_ref }}</code></td>
                <td>
                  <span class="cargo-dot" :style="{ background: cargoColor(f.cargo_type) }"></span>
                  {{ cargoLabel(f.cargo_type) }}
                </td>
                <td class="text-xs">{{ f.origin_station_code }} → {{ f.destination_station_code }}</td>
                <td>{{ fmtNum(f.tonnage, 1) }}</td>
                <td>{{ fmtKsh(f.revenue_kes) }}</td>
                <td class="text-xs text-fg-muted">{{ fmtTime(f.dispatched_at) }}</td>
              </tr>
              <tr v-if="freight.length === 0">
                <td colspan="6" class="text-center text-fg-muted" style="padding: 16px">No freight in the selected period.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="text-subhead">Railway Safety Incidents</div>
            <div class="text-xs text-fg-muted">FR-M08-011 · Last {{ days * 3 }} days · Linked to M05 Safety service</div>
          </div>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="data-table">
            <thead>
              <tr>
                <th></th><th>Ref</th><th>Type</th><th>Severity</th><th>Station</th><th>When</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inc in incidents.slice(0, 10)" :key="inc.id">
                <td class="text-lg">{{ incidentIcon(inc.incident_type) }}</td>
                <td><code class="text-xs">{{ inc.incident_ref }}</code></td>
                <td class="text-xs">{{ inc.incident_type.replace(/_/g, ' ') }}</td>
                <td>
                  <span class="sev-dot" :style="{ background: sevColor(inc.severity) }"></span>
                  {{ inc.severity }}
                </td>
                <td class="text-xs">{{ inc.station_code || '-' }}</td>
                <td class="text-xs text-fg-muted">{{ fmtTime(inc.occurred_at) }}</td>
              </tr>
              <tr v-if="incidents.length === 0">
                <td colspan="6" class="text-center text-fg-muted" style="padding: 16px">No incidents reported in this period.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Network snapshot -->
    <div class="two-col">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="text-subhead">Rail Network Snapshot</div>
            <div class="text-xs text-fg-muted">Sample of {{ lines.length }} lines (from {{ summary?.kpis.total_lines }} total OSM segments)</div>
          </div>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="data-table">
            <thead>
              <tr><th>Line</th><th>Network</th><th>Gauge</th><th>Status</th><th>Length</th></tr>
            </thead>
            <tbody>
              <tr v-for="ln in lines.slice(0, 12)" :key="ln.id">
                <td class="text-xs">{{ ln.name || `Way ${ln.osm_id}` }}</td>
                <td>
                  <span class="badge" :class="ln.network === 'sgr' ? 'badge-info' : ln.network === 'mgr' ? 'badge-success' : 'badge-neutral'">
                    {{ ln.network }}
                  </span>
                </td>
                <td class="text-xs">{{ ln.gauge }}</td>
                <td class="text-xs">{{ ln.status }}</td>
                <td class="text-xs">{{ ln.length_km ? `${ln.length_km.toFixed(1)} km` : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="text-subhead">Major Stations</div>
            <div class="text-xs text-fg-muted">From {{ stations.length }} operational stations in network</div>
          </div>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="data-table">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Type</th><th>Service</th><th>Platforms</th></tr>
            </thead>
            <tbody>
              <tr v-for="st in stations.slice(0, 12)" :key="st.id">
                <td><code class="text-xs">{{ st.code }}</code></td>
                <td class="text-xs">{{ st.name }}</td>
                <td class="text-xs">{{ st.station_type }}</td>
                <td class="text-xs">{{ st.service }}</td>
                <td class="text-xs">{{ st.platforms }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 90d Safety summary -->
    <div v-if="summary" class="card">
      <div class="card-header">
        <div>
          <div class="text-subhead">Safety Summary · 90 days</div>
          <div class="text-xs text-fg-muted">FR-M08-011 · Aggregate incident statistics</div>
        </div>
      </div>
      <div class="card-body">
        <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))">
          <div class="kpi-mini">
            <div class="text-label text-fg-dim">Total Incidents</div>
            <div class="text-display text-lg">{{ summary.incidents_90d.total }}</div>
          </div>
          <div class="kpi-mini">
            <div class="text-label text-fg-dim">Casualties</div>
            <div class="text-display text-lg" style="color: #ef4444">{{ summary.incidents_90d.casualties }}</div>
          </div>
          <div class="kpi-mini">
            <div class="text-label text-fg-dim">Fatal</div>
            <div class="text-display text-lg" style="color: #ef4444">{{ summary.incidents_90d.fatal }}</div>
          </div>
          <div class="kpi-mini">
            <div class="text-label text-fg-dim">Level Crossing</div>
            <div class="text-display text-lg">{{ summary.incidents_90d.level_crossing }}</div>
          </div>
          <div class="kpi-mini">
            <div class="text-label text-fg-dim">Estimated Loss</div>
            <div class="text-display text-lg">KES {{ fmtKsh(summary.incidents_90d.loss_kes) }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="text-xs text-fg-dim" style="text-align: right">
      Last refreshed: {{ summary?.generated_at ? new Date(summary.generated_at).toLocaleString('en-KE') : '-' }}
    </div>
  </div>
</template>

<style scoped>
.rail-page { display: flex; flex-direction: column; gap: 20px; }
.kpi-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.kpi-card { padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.kpi-value { font-size: 26px; font-weight: 600; line-height: 1.1; }
.kpi-mini { padding: 12px; background: rgba(255,255,255,0.03); border-radius: 6px; }
.two-col {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
}
@media (max-width: 1100px) { .two-col { grid-template-columns: 1fr; } }
.card-body { padding: 14px 18px; }

.live-list { padding: 4px 0; }
.live-row {
  display: grid; grid-template-columns: 130px 1fr auto;
  align-items: center; gap: 12px;
  padding: 10px 18px; border-bottom: 1px solid rgba(255,255,255,0.04);
  font-size: 12px;
}
.live-row:last-child { border-bottom: none; }
.live-train { display: flex; gap: 6px; align-items: center; }
.train-no { font-weight: 600; font-family: monospace; }
.live-meta { display: flex; gap: 6px; align-items: center; }

.adherence-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.adherence-item {
  background: rgba(255,255,255,0.03);
  border-radius: 6px; padding: 10px 12px;
}
.adherence-value { font-size: 20px; font-weight: 600; line-height: 1.2; }

.otp-bar {
  height: 8px; background: rgba(255,255,255,0.06);
  border-radius: 4px; overflow: hidden;
}
.otp-fill { height: 100%; transition: width 0.3s; }

.leaderboard-list { padding: 4px 0; }
.lb-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 18px; border-bottom: 1px solid rgba(255,255,255,0.03);
}
.lb-row:last-child { border-bottom: none; }
.lb-rank { font-weight: 600; color: var(--fg-muted); width: 32px; font-variant-numeric: tabular-nums; }
.lb-info { flex: 1; min-width: 0; }
.lb-name { font-size: 13px; font-weight: 500; }
.lb-sub { font-size: 11px; color: var(--fg-muted); margin-top: 2px; display: flex; gap: 6px; align-items: center; }
.lb-stats { text-align: right; }
.lb-revenue { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }

.cargo-dot {
  display: inline-block; width: 8px; height: 8px;
  border-radius: 50%; margin-right: 4px;
  vertical-align: middle;
}
.sev-dot {
  display: inline-block; width: 8px; height: 8px;
  border-radius: 50%; margin-right: 4px;
  vertical-align: middle;
}

.data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.data-table th {
  text-align: left; padding: 8px 10px; color: var(--fg-muted);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-weight: 500; font-size: 11px; text-transform: uppercase;
}
.data-table td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); }

.badge {
  display: inline-block; padding: 2px 8px;
  border-radius: 4px; font-size: 10px; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.3px;
}
.badge-success { background: rgba(16,185,129,0.18); color: #10b981; }
.badge-info    { background: rgba(59,130,246,0.18); color: #3b82f6; }
.badge-warning { background: rgba(245,158,11,0.18); color: #f59e0b; }
.badge-danger  { background: rgba(239,68,68,0.18); color: #ef4444; }
.badge-neutral { background: rgba(148,163,184,0.18); color: #94a3b8; }

.select-sm {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  padding: 4px 8px; font-size: 12px; color: inherit;
}
</style>
