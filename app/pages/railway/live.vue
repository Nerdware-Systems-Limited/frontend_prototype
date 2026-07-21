<template>
  <PageHeader
    eyebrow="Railway - Train Operations"
    title="Train Operations"
    subtitle="KRC · NCTTCA - Real-time SGR &amp; MGR train positions, delays, rolling stock status, and NCTTCA corridor transit performance - refreshes every 30 seconds"
  >
    <template #actions>
      <BadgePill variant="danger">{{ delayedOps.length }} delayed</BadgePill>
      <BadgePill variant="success">{{ onTimeOps.length }} on-time</BadgePill>
      <select v-model="networkFilter" class="select-sm">
        <option value="">All networks</option>
        <option value="sgr">SGR</option>
        <option value="mgr">MGR</option>
      </select>
      <NuxtLink to="/railway/network-inventory" class="btn">Rolling Stock Registry →</NuxtLink>
      <NuxtLink to="/railway/safety" class="btn">Incidents & Safety →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Live Operations"
      :value="fmtNum(allOps.length)"
      sub="Active right now"
      source="live" source-title="KRC OCC"
    />
    <KpiCard
      label="In Transit"
      :value="fmtNum(countByStatus('in_transit'))"
      sub="Running between stations"
      source="live" source-title="KRC OCC"
    />
    <KpiCard
      label="On-Time"
      :value="fmtNum(onTimeOps.length)"
      sub="0 delay or ahead of schedule"
      trend-direction="up"
      source="live" source-title="KRC OCC"
    />
    <KpiCard
      label="Delayed"
      :value="fmtNum(delayedOps.length)"
      :sub="maxDelay > 0 ? `Max delay ${maxDelay} min` : 'No delays'"
      :trend-direction="delayedOps.length === 0 ? 'up' : 'down'"
      source="live" source-title="KRC OCC"
    />
    <KpiCard
      label="Cancelled Today"
      :value="fmtNum(countByStatus('cancelled'))"
      sub="Service cancelled"
      :trend-direction="countByStatus('cancelled') === 0 ? 'up' : 'down'"
      source="live" source-title="KRC OCC"
    />
    <KpiCard
      label="Rolling Stock - Service"
      :value="fmtNum(trains.filter(t => t.status === 'in_service').length)"
      :sub="`of ${fmtNum(trains.length)} registered`"
      source="batch" source-title="KRC"
    />
  </div>

  <!-- Live map + delayed alerts -->
  <div class="two-col-map">
    <div class="card map-card">
      <div class="card-header">Live Train Positions (OCC)</div>
      <ClientOnly>
        <UaptsMap
          :markers="trainMarkers"
          :lines="railLines"
          :center="[-1.0, 37.5]"
          :zoom="6"
          height="500px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#22c55e" /> On Time</span>
        <span class="mk"><span class="dot" style="background:#ef4444" /> Delayed</span>
        <span class="mk"><span class="dot" style="background:#94a3b8" /> Cancelled</span>
        <span class="mk"><span class="dot" style="background:#3b82f6" /> Boarding</span>
        <span class="mk"><span class="line-seg" style="background:#3b82f6" /> SGR</span>
        <span class="mk"><span class="line-seg" style="background:#10b981" /> MGR</span>
      </div>
    </div>

    <div class="right-col">
      <!-- Delayed alerts -->
      <div class="card">
        <div class="card-header">
          Delay Alerts
          <BadgePill v-if="delayedOps.length" variant="danger">{{ delayedOps.length }}</BadgePill>
        </div>
        <div class="card-body">
          <div v-if="delayedOps.length">
            <AlertItem
              v-for="op in delayedOps.slice(0, 8)"
              :key="op.id"
              severity="warning"
              :title="`Train ${op.schedule_train_number}: ${op.origin_code} → ${op.destination_code}`"
              :meta="`+${op.delay_arrival_min} min · ${(op.delay_reason ?? 'other').replace(/_/g,' ')} · ${op.current_station_code ?? 'En route'}`"
            />
          </div>
          <div v-else style="color:#94a3b8;font-size:13px;padding:8px 0">No active delays.</div>
        </div>
      </div>

      <!-- Rolling stock status -->
      <div class="card" style="margin-top:12px">
        <div class="card-header">Rolling Stock Status</div>
        <div class="card-body">
          <div class="rs-grid">
            <div v-for="st in trainStatuses" :key="st.status" class="rs-row">
              <BadgePill :variant="trainStatusBadge(st.status)">{{ st.status.replace(/_/g,' ') }}</BadgePill>
              <div class="rs-bar-wrap">
                <div class="rs-bar" :style="{ width: `${trains.length > 0 ? (st.count / trains.length) * 100 : 0}%`, background: trainStatusColor(st.status) }" />
              </div>
              <span class="rs-val">{{ st.count }}</span>
            </div>
          </div>
          <div v-if="maintenanceDue.length" class="maint-alert">
            <div class="maint-alert-head">⚠ {{ maintenanceDue.length }} unit{{ maintenanceDue.length > 1 ? 's' : '' }} - maintenance due</div>
            <div v-for="t in maintenanceDue.slice(0,4)" :key="t.id" class="maint-unit">
              {{ t.unit_id }} · {{ t.train_type.replace(/_/g,' ') }} · Due {{ fmtDate(t.next_maintenance) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Full live operations table -->
  <SectionTitle pill="KRC OCC · Live">All Active Operations</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="statusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="in_transit">In Transit</option>
          <option value="boarding">Boarding</option>
          <option value="delayed">Delayed</option>
          <option value="departed">Departed</option>
          <option value="arrived">Arrived</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input v-model="trainSearch" class="select-sm" placeholder="Search train number…" style="min-width:160px" />
        <button class="btn" @click="statusFilter=''; trainSearch=''">Clear</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Train</th>
            <th>Route</th>
            <th>Date</th>
            <th>Status</th>
            <th>Current Station</th>
            <th>Act. Departure</th>
            <th>Act. Arrival</th>
            <th>Dep Delay</th>
            <th>Arr Delay</th>
            <th>Passengers</th>
            <th>Occupancy</th>
          </tr>
        </thead>
        <tbody v-if="filteredOps.length">
          <tr v-for="op in filteredOps.slice(0, 50)" :key="op.id">
            <td style="font-family:monospace;font-weight:700">{{ op.schedule_train_number }}</td>
            <td style="font-size:12px">{{ op.origin_code }} → {{ op.destination_code }}</td>
            <td style="font-size:12px;white-space:nowrap">{{ op.service_date }}</td>
            <td><BadgePill :variant="opBadge(op.status)">{{ op.status.replace(/_/g,' ') }}</BadgePill></td>
            <td style="font-family:monospace;font-size:12px">{{ op.current_station_code ?? '-' }}</td>
            <td style="font-size:11px;white-space:nowrap">{{ op.actual_departure ? fmtTime(op.actual_departure) : '-' }}</td>
            <td style="font-size:11px;white-space:nowrap">{{ op.actual_arrival ? fmtTime(op.actual_arrival) : '-' }}</td>
            <td :style="{ color: op.delay_departure_min > 30 ? '#ef4444' : op.delay_departure_min > 0 ? '#f59e0b' : '#22c55e', fontWeight:'600', fontSize:'12px' }">
              {{ op.delay_departure_min > 0 ? `+${op.delay_departure_min}` : '✓' }}
            </td>
            <td :style="{ color: op.delay_arrival_min > 30 ? '#ef4444' : op.delay_arrival_min > 0 ? '#f59e0b' : '#22c55e', fontWeight:'600', fontSize:'12px' }">
              {{ op.delay_arrival_min > 0 ? `+${op.delay_arrival_min}` : '✓' }}
            </td>
            <td style="font-size:12px">{{ op.passengers_actual != null ? fmtNum(op.passengers_actual) : '-' }}</td>
            <td>
              <div v-if="op.occupancy_pct != null" class="occ-wrap">
                <div class="occ-bar" :style="{ width: `${op.occupancy_pct}%`, background: op.occupancy_pct >= 90 ? '#ef4444' : op.occupancy_pct >= 70 ? '#f59e0b' : '#22c55e' }" />
              </div>
              <span style="font-size:11px">{{ op.occupancy_pct != null ? `${op.occupancy_pct.toFixed(0)}%` : '-' }}</span>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="11" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No operations match filters.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Train Operations')

import { useRailway } from '~/composables/api'
import type { TrainOperation, Train } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

const allOps       = ref<TrainOperation[]>([])
const trains       = ref<Train[]>([])
const railLines    = ref<any[]>([])
const loading      = ref(true)
const error        = ref<string | null>(null)
const lastRefreshed = ref('-')
const networkFilter = ref('')
const statusFilter  = ref('')
const trainSearch   = ref('')

async function load() {
  loading.value = true
  error.value = null
  const rail = useRailway()

  const [liveRes, trainRes, mapRes] = await Promise.allSettled([
    rail.liveOperations(),
    rail.trains({ page_size: 100 }),
    rail.mapData(),
  ])

  if (liveRes.status  === 'fulfilled') allOps.value   = Array.isArray(liveRes.value) ? liveRes.value : (liveRes.value as any).results ?? []
  if (trainRes.status === 'fulfilled') trains.value   = (trainRes.value as any).results ?? []
  if (mapRes.status   === 'fulfilled') railLines.value = mapRes.value.lines ?? []

  if ([liveRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Railway API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 30_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const filteredOps = computed(() =>
  allOps.value.filter(op => {
    if (statusFilter.value && op.status !== statusFilter.value) return false
    if (trainSearch.value  && !op.schedule_train_number.toLowerCase().includes(trainSearch.value.toLowerCase())) return false
    return true
  }),
)

const delayedOps = computed(() => allOps.value.filter(op => op.delay_arrival_min > 0 && op.status !== 'cancelled'))
const onTimeOps  = computed(() => allOps.value.filter(op => op.delay_arrival_min === 0 && op.status !== 'cancelled'))
const maxDelay   = computed(() => Math.max(0, ...allOps.value.map(op => op.delay_arrival_min)))

const trainMarkers = computed((): MarkerSpec[] =>
  allOps.value
    .filter(op => op.current_lat != null && op.current_lon != null)
    .map(op => ({
      id: `op-${op.id}`,
      lat: op.current_lat!,
      lon: op.current_lon!,
      title: `Train ${op.schedule_train_number}`,
      subtitle: `${op.origin_code} → ${op.destination_code} · ${op.status.replace(/_/g,' ')} · ${op.delay_arrival_min > 0 ? `+${op.delay_arrival_min} min` : 'On time'}`,
      color: op.status === 'cancelled' ? 'gray'
           : op.delay_arrival_min > 0  ? 'red'
           : op.status === 'boarding'  ? 'blue'
           : 'green',
      size: op.delay_arrival_min > 30 ? 'lg' : 'md',
    })),
)

const trainStatuses = computed(() => {
  const counts = new Map<string, number>()
  trains.value.forEach(t => counts.set(t.status, (counts.get(t.status) ?? 0) + 1))
  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }))
})

const maintenanceDue = computed(() =>
  trains.value.filter(t => t.next_maintenance && new Date(t.next_maintenance).getTime() <= Date.now()),
)

function countByStatus(s: string) { return allOps.value.filter(op => op.status === s).length }

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-KE', { hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function opBadge(s: string) {
  const m: Record<string,string> = { in_transit:'info', boarding:'fair', arrived:'success', delayed:'danger', cancelled:'danger', scheduled:'neutral', departed:'info', diverted:'warning' }
  return m[s] ?? 'neutral'
}
function trainStatusBadge(s: string) {
  const m: Record<string,string> = { in_service:'success', standby:'fair', maintenance:'warning', retired:'neutral', inspection:'info' }
  return m[s] ?? 'neutral'
}
function trainStatusColor(s: string) {
  const m: Record<string,string> = { in_service:'#22c55e', standby:'#f59e0b', maintenance:'#f97316', retired:'#94a3b8', inspection:'#3b82f6' }
  return m[s] ?? '#64748b'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; margin-bottom:16px; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; color:#374151; }
.select-sm:focus { outline:none; border-color:#3b82f6; }

/* ── Map layout ── */
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; align-items:start; }
@media(max-width:1100px) { .two-col-map { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid #f1f5f9; color:#475569; }
.mk { display:flex; align-items:center; gap:5px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; flex-shrink:0; }
.line-seg { width:20px; height:4px; border-radius:2px; display:inline-block; flex-shrink:0; }

/* ── Right column ── */
.right-col { display:flex; flex-direction:column; gap:12px; }

/* ── Rolling stock ── */
.rs-grid { display:flex; flex-direction:column; gap:8px; }
.rs-row { display:grid; grid-template-columns:120px 1fr 36px; align-items:center; gap:8px; }
.rs-bar-wrap { background:#f1f5f9; border-radius:4px; height:8px; overflow:hidden; }
.rs-bar { height:100%; border-radius:4px; transition:width .4s ease; }
.rs-val { font-size:12px; font-weight:700; text-align:right; color:#374151; }

/* ── Maintenance warning ── */
.maint-alert { margin-top:10px; padding:8px 10px; background:#fefce8; border:1px solid #fef08a; border-radius:7px; }
.maint-alert-head { font-size:11px; font-weight:700; color:#d97706; margin-bottom:5px; }
.maint-unit { font-size:11px; color:#64748b; padding:2px 0; }

/* ── Operations table ── */
.occ-wrap { background:#f1f5f9; border-radius:3px; height:5px; overflow:hidden; margin-bottom:2px; }
.occ-bar { height:100%; border-radius:3px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
</style>
