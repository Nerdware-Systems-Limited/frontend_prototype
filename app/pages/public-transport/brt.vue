<template>
  <PageHeader
    eyebrow="Public Transport - BRT"
    title="BRT Stops & Headway"
    subtitle="NaMATA · NTSA - BRT stop facilities, boarding counts, NTSA vehicle compliance, headway compliance, and schedule adherence"
  >
    <template #actions>
      <NuxtLink to="/public-transport/operators" class="btn">Public Operators →</NuxtLink>
      <NuxtLink to="/public-transport/compliance" class="btn">PSV Compliance →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="BRT Stops"
      :value="fmtNum(stops.length)"
      :unavailable="loading || stopsError"
      :unavailable-note="loading ? 'Loading…' : 'NaMATA GIS feed unavailable'"
      period="LIVE"
      description="NaMATA network stations"
      to="#stop-inventory"
    />
    <KpiCard
      label="Active Stops"
      :value="fmtNum(stops.filter(s => s.is_active).length)"
      :unavailable="loading || stopsError"
      :unavailable-note="loading ? 'Loading…' : 'NaMATA GTFS-RT feed unavailable'"
      period="LIVE"
      description="Currently operational"
      to="#stop-inventory"
    />
    <KpiCard
      label="Avg Dwell Time"
      :value="avgDwell ? `${avgDwell.toFixed(0)}s` : '-'"
      :unavailable="loading || stopsError"
      :unavailable-note="loading ? 'Loading…' : 'NaMATA feed unavailable'"
      period="LIVE"
      description="Average boarding dwell"
    />
    <KpiCard
      label="Avg Boardings/Stop"
      :value="avgBoardings ? fmtNum(avgBoardings, 0) : '-'"
      :unavailable="loading || stopsError"
      :unavailable-note="loading ? 'Loading…' : 'NaMATA GTFS-RT feed unavailable'"
      period="LIVE"
      description="Daily average per stop"
    />
    <KpiCard
      label="BRT Routes (Headway)"
      :value="fmtNum(headwayData.length)"
      :unavailable="loading || headwayError"
      :unavailable-note="loading ? 'Loading…' : 'NaMATA feed unavailable'"
      period="LIVE"
      description="Routes with headway data"
      to="#headway-compliance"
    />
    <KpiCard
      label="Shelter Coverage"
      :value="shelterPct ? `${shelterPct.toFixed(0)}%` : '-'"
      :unavailable="loading || stopsError"
      :unavailable-note="loading ? 'Loading…' : 'NaMATA GIS feed unavailable'"
      period="LIVE"
      description="Stops with passenger shelter"
    />
  </div>

  <!-- Map + headway side by side -->
  <div class="two-col-map">
    <div class="card map-card">
      <div class="card-header">BRT Stop Network</div>
      <ClientOnly>
        <UaptsMap
          :markers="stopMarkers"
          :roads="roadsGeo"
          :center="[-1.286, 36.817]"
          :zoom="11"
          height="460px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#22c55e" /> Accessibility ≥ 80%</span>
        <span class="mk"><span class="dot" style="background:#f59e0b" /> Accessibility 50–79%</span>
        <span class="mk"><span class="dot" style="background:#ef4444" /> Accessibility &lt; 50%</span>
        <span class="mk"><span class="dot" style="background:#94a3b8" /> Inactive</span>
      </div>
    </div>

    <div id="headway-compliance" class="card drill-target">
      <div class="card-header">Headway Compliance by Route</div>
      <div class="card-body">
        <div v-if="headwayData.length" class="hw-list">
          <div v-for="h in headwayPageRows" :key="h.route_id ?? h.route__route_name" class="hw-row">
            <div class="hw-name">{{ h.route__route_name ?? h.route_id }}</div>
            <div class="hw-meta">
              <span>{{ h.buses_per_day }} buses/day</span>
              <span>{{ h.avg_frequency }} min avg freq</span>
            </div>
            <div class="hw-bar-wrap">
              <!-- Bar length = compliance toward the 10-min target (same threshold the
                   color uses) so a longer/fuller green bar always reads as "better",
                   matching the fuller-is-better convention used elsewhere in the app -
                   previously the bar grew LONGER for worse (higher-minute) headways
                   while still being colored red, which read backwards. -->
              <div
                class="hw-bar"
                :style="{
                  transform: `scaleX(${Math.max(4, Math.min(100, (10 / Math.max(h.avg_frequency, 0.1)) * 100)) / 100})`,
                  background: h.avg_frequency <= 10 ? 'var(--success)' : h.avg_frequency <= 20 ? 'var(--warning)' : 'var(--destructive)',
                }"
              />
            </div>
          </div>
        </div>
        <EmptyState v-else :loading="loading" message="No headway data" compact />
        <TablePagination
          v-if="headwayData.length"
          :page="headwayPage" :total-pages="headwayTotalPages" :total="headwayTotal"
          @prev="headwayPrev" @next="headwayNext"
        />
      </div>
    </div>
  </div>

  <!-- BRT stops table with filters -->
  <SectionTitle>Stop Inventory</SectionTitle>

  <div id="stop-inventory" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="platformFilter" class="select-sm">
          <option value="">All platform types</option>
          <option value="center">Center</option>
          <option value="side">Side</option>
          <option value="island">Island</option>
        </select>
        <label class="checkbox-label">
          <input v-model="shelterOnly" type="checkbox" />
          Shelter only
        </label>
        <label class="checkbox-label">
          <input v-model="ticketOnly" type="checkbox" />
          Ticket machine only
        </label>
        <input v-model="stopSearch" class="select-sm" placeholder="Search stop name…" style="min-width:160px" />
      </div>
      <table>
        <thead>
          <tr>
            <th>Stop ID</th>
            <th>Stop Name</th>
            <th>Route</th>
            <th>Platform</th>
            <th>Shelter</th>
            <th>Ticket Machine</th>
            <th>Accessibility</th>
            <th>Avg Boardings</th>
            <th>Avg Dwell (s)</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody v-if="filteredStops.length">
          <tr v-for="s in stopsPageRows" :key="s.id">
            <td style="font-family:monospace;font-size:12px">{{ s.stop_id }}</td>
            <td style="font-weight:600">{{ s.stop_name }}</td>
            <td style="font-size:12px">{{ s.route_name ?? '-' }}</td>
            <td><BadgePill variant="info">{{ s.platform_type }}</BadgePill></td>
            <td style="text-align:center">{{ s.has_shelter ? '✓' : '-' }}</td>
            <td style="text-align:center">{{ s.has_ticket_machine ? '✓' : '-' }}</td>
            <td>
              <div class="acc-bar-wrap">
                <div
                  class="acc-bar"
                  :style="{
                    transform: `scaleX(${s.accessibility_score})`,
                    background: s.accessibility_score >= 0.8 ? 'var(--success)' : s.accessibility_score >= 0.5 ? 'var(--warning)' : 'var(--destructive)',
                  }"
                />
              </div>
              <span style="font-size:11px">{{ (s.accessibility_score * 100).toFixed(0) }}%</span>
            </td>
            <td>{{ fmtNum(s.avg_boarding_count) }}</td>
            <td>{{ s.avg_dwell_seconds }}</td>
            <td>
              <span :style="{ color: s.is_active ? 'var(--success-fg)' : 'var(--fg-3)' }">
                {{ s.is_active ? '● Active' : '○ Inactive' }}
              </span>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="10" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading stops…' : 'No stops match the current filters.' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="stopsPage" :total-pages="stopsTotalPages" :total="stopsTotal"
        @prev="stopsPrev" @next="stopsNext"
      />
    </div>
  </div>

  <!-- Schedule adherence -->
  <SectionTitle pill="NaMATA GTFS-RT · Live">Recent Schedule Adherence</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Route</th>
            <th>Stop</th>
            <th>Scheduled</th>
            <th>Actual</th>
            <th>Deviation</th>
            <th>On-Time</th>
          </tr>
        </thead>
        <tbody v-if="adherence.length">
          <tr v-for="a in adherencePageRows" :key="a.id">
            <td style="font-weight:600">{{ a.route_name ?? a.route }}</td>
            <td style="font-size:12px">{{ a.stop_name ?? a.stop ?? '-' }}</td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtTime(a.scheduled_at) }}</td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtTime(a.actual_at) }}</td>
            <td>
              <span :style="{ color: Math.abs(a.deviation_seconds) <= 180 ? 'var(--success-fg)' : 'var(--danger-fg)' }">
                {{ a.deviation_seconds > 0 ? '+' : '' }}{{ (a.deviation_seconds / 60).toFixed(1) }}min
              </span>
            </td>
            <td>
              <BadgePill :variant="a.on_time ? 'success' : 'danger'">
                {{ a.on_time ? 'On time' : 'Late' }}
              </BadgePill>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="6" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading adherence data…' : 'No adherence records available.' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="adherencePage" :total-pages="adherenceTotalPages" :total="adherenceTotal"
        @prev="adherencePrev" @next="adherenceNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { usePublicTransport, useGis } from '~/composables/api'
import type { BRTStop, ScheduleAdherence } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

const stops       = ref<BRTStop[]>([])
const headwayData = ref<any[]>([])
const adherence   = ref<ScheduleAdherence[]>([])
const roadsGeo    = ref<GeoJSONFeatureCollection | null>(null)
const loading     = ref(true)
const error       = ref<string | null>(null)
const stopsError    = ref(false)
const headwayError  = ref(false)
const lastRefreshed  = ref('-')
const platformFilter = ref('')
const shelterOnly    = ref(false)
const ticketOnly     = ref(false)
const stopSearch     = ref('')

async function load() {
  loading.value = true
  error.value = null
  const pt  = usePublicTransport()
  const gis = useGis()

  const [stopsRes, hwRes, adhRes, roadsRes] = await Promise.allSettled([
    pt.brtStops({ page_size: 100 }),
    pt.brtHeadway(),
    pt.scheduleAdherence({ page_size: 30 }),
    gis.roads({ limit: 300, simplify: 0.02 }),
  ])

  if (stopsRes.status === 'fulfilled') stops.value       = (stopsRes.value as any).results ?? []
  if (hwRes.status    === 'fulfilled') headwayData.value = (hwRes.value as any).results ?? []
  if (adhRes.status   === 'fulfilled') adherence.value   = (adhRes.value as any).results ?? []
  if (roadsRes.status === 'fulfilled') roadsGeo.value    = roadsRes.value

  stopsError.value   = stopsRes.status === 'rejected'
  headwayError.value = hwRes.status    === 'rejected'

  if ([stopsRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Public Transport API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const filteredStops = computed(() =>
  stops.value.filter(s => {
    if (platformFilter.value && s.platform_type !== platformFilter.value) return false
    if (shelterOnly.value    && !s.has_shelter)                           return false
    if (ticketOnly.value     && !s.has_ticket_machine)                    return false
    if (stopSearch.value     && !s.stop_name.toLowerCase().includes(stopSearch.value.toLowerCase())) return false
    return true
  }),
)

const stopMarkers = computed((): MarkerSpec[] =>
  stops.value.map(s => ({
    id: `stop-${s.id}`,
    lat: s.latitude,
    lon: s.longitude,
    title: s.stop_name,
    subtitle: `${s.platform_type} platform · ${s.avg_boarding_count} boardings · ${s.avg_dwell_seconds}s dwell`,
    color: !s.is_active ? 'gray'
         : s.accessibility_score >= 0.8 ? 'green'
         : s.accessibility_score >= 0.5 ? 'yellow'
         : 'red',
    size: 'sm',
  })),
)

const avgDwell     = computed(() => {
  if (!stops.value.length) return null
  return stops.value.reduce((s, st) => s + st.avg_dwell_seconds, 0) / stops.value.length
})
const avgBoardings = computed(() => {
  if (!stops.value.length) return null
  return stops.value.reduce((s, st) => s + st.avg_boarding_count, 0) / stops.value.length
})
const shelterPct = computed(() => {
  if (!stops.value.length) return null
  return (stops.value.filter(s => s.has_shelter).length / stops.value.length) * 100
})

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: stopsPageRows, page: stopsPage, totalPages: stopsTotalPages,
  total: stopsTotal, next: stopsNext, prev: stopsPrev,
} = usePagination(filteredStops, 15)

const {
  pageRows: headwayPageRows, page: headwayPage, totalPages: headwayTotalPages,
  total: headwayTotal, next: headwayNext, prev: headwayPrev,
} = usePagination(headwayData, 8)

const {
  pageRows: adherencePageRows, page: adherencePage, totalPages: adherenceTotalPages,
  total: adherenceTotal, next: adherenceNext, prev: adherencePrev,
} = usePagination(adherence, 15)

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(165px,1fr)); gap:12px; margin-bottom:16px; }
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col-map { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid var(--border-subtle); }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.hw-list { display:flex; flex-direction:column; gap:12px; }
.hw-row { display:flex; flex-direction:column; gap:4px; }
.hw-name { font-size:13px; font-weight:600; }
.hw-meta { display:flex; gap:12px; font-size:11px; color:var(--fg-2); }
.hw-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:8px; overflow:hidden; }
.hw-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.checkbox-label { display:flex; align-items:center; gap:4px; font-size:13px; cursor:pointer; }
.acc-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.acc-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
</style>
