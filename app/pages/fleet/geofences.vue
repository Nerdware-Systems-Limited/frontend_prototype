<template>
  <PageHeader
    eyebrow="Fleet - Geofences"
    title="Geofence Zones"
    subtitle="Configure zones (depots, ports, restricted areas) and monitor entry/exit breach events"
  >
    <!-- <template #actions>
      
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template> -->
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Zones"
      :value="fmtNum(geofences.length)"
      :unavailable="loading || geofencesError" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE" description="Configured geofence zones"
      to="#zone-inventory"
    />
    <KpiCard
      label="Active Zones"
      :value="fmtNum(activeCount)"
      :unavailable="loading || geofencesError" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE" description="Currently monitoring"
      to="#zone-inventory"
    />
    <KpiCard
      label="Breaches (24h)"
      :value="fmtNum(breaches.length)"
      :unavailable="loading || breachesError" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="24H" description="All entry / exit / dwell events"
      to="#breach-events"
    />
    <KpiCard
      label="Critical Zones"
      :value="fmtNum(criticalCount)"
      :unavailable="loading || geofencesError" :unavailable-note="loading ? 'Loading…' : 'NTSA iTIMS feed unavailable'"
      period="LIVE" description="Highest-severity geofences"
      :status="loading || geofencesError ? undefined : criticalCount > 0 ? 'warning' : 'healthy'"
      to="#zone-inventory"
    />
  </div>

  <!-- Map + breach log -->
  <div class="two-col">
    <div class="card map-card">
      <div class="card-header">Zone Map</div>
      <ClientOnly>
        <UaptsMap
          :markers="zoneMarkers"
          :roads="roadsGeo"
          :center="[-1.286, 36.817]"
          :zoom="10"
          height="460px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:var(--destructive)" /> Critical</span>
        <span class="mk"><span class="dot" style="background:var(--warning)" /> High</span>
        <span class="mk"><span class="dot" style="background:var(--info)" /> Medium / Low</span>
        <span class="mk"><span class="dot" style="background:var(--border-strong)" /> Inactive</span>
      </div>
    </div>

    <div id="breach-events" class="card drill-target">
      <div class="card-header">
        Recent Breach Events
        <span class="count-badge">{{ breaches.length }}</span>
      </div>
      <div class="scroll-body">
        <div v-for="b in breaches" :key="b.id" class="breach-item">
          <div class="bi-header">
            <BadgePill :variant="eventBadge(b.event_type)">{{ b.event_type }}</BadgePill>
            <span class="bi-time">{{ fmtTime(b.detected_at) }}</span>
          </div>
          <div class="bi-zone">{{ b.zone_name }}</div>
          <div class="bi-plate">{{ b.plate_number }}</div>
          <div v-if="b.speed_kmh" class="bi-meta">{{ b.speed_kmh.toFixed(0) }} km/h</div>
        </div>
        <EmptyState v-if="breaches.length === 0" :loading="loading" message="No breach events recorded." compact />
      </div>
    </div>
  </div>

  <!-- Geofence zones table -->
  <SectionTitle>Geofence Zone Inventory</SectionTitle>

  <div id="zone-inventory" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="zoneSearch" class="select-sm" placeholder="Search zone name…" style="min-width:180px" />
        <select v-model="typeFilter" class="select-sm">
          <option value="">All zone types</option>
          <option value="depot">Depot</option>
          <option value="port">Port</option>
          <option value="restricted">Restricted</option>
          <option value="school">School zone</option>
          <option value="hospital">Hospital</option>
          <option value="weighbridge">Weighbridge</option>
        </select>
        <select v-model="severityFilter" class="select-sm">
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button class="btn" @click="zoneSearch=''; typeFilter=''; severityFilter=''">Clear</button>
        <ExportButton filename="uapts-geofence-zones.csv" :rows="filteredZones" :columns="zoneExportColumns" style="margin-left:auto" />
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Zone Name</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Radius (m)</th>
            <th>Active</th>
            <th>Agency</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody v-if="filteredZones.length">
          <template v-for="z in zonesPageRows" :key="z.id">
            <tr class="expand-row" @click="expanded = expanded === z.id ? null : z.id">
              <td class="expand-cell">{{ expanded === z.id ? '▾' : '▸' }}</td>
              <td style="font-weight:600">{{ z.zone_name }}</td>
              <td><BadgePill variant="info">{{ z.zone_type }}</BadgePill></td>
              <td><BadgePill :variant="sevBadge(z.severity)">{{ z.severity }}</BadgePill></td>
              <td>{{ z.radius_m ?? '-' }}</td>
              <td>
                <span :style="{ color: z.is_active ? 'var(--success-fg)' : 'var(--fg-3)' }">
                  {{ z.is_active ? '● Active' : '○ Inactive' }}
                </span>
              </td>
              <td style="font-size:12px">{{ z.agency_code ?? '-' }}</td>
              <td style="font-size:12px">{{ fmtDate(z.created_at) }}</td>
            </tr>
            <tr v-if="expanded === z.id" class="detail-row">
              <td :colspan="8">
                <div class="drilldown">
                  <div class="dd-item"><span class="dd-label">Coordinates</span><span style="font-family:monospace">{{ z.latitude != null && z.longitude != null ? `${z.latitude.toFixed(4)}, ${z.longitude.toFixed(4)}` : '-' }}</span></div>
                  <div class="dd-item"><span class="dd-label">Last Updated</span><span>{{ fmtDate(z.updated_at) }}</span></div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="8" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading…' : 'No zones found' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="zonesPage" :total-pages="zonesTotalPages" :total="zonesTotal"
        @prev="zonesPrev" @next="zonesNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useFleet, useGis } from '~/composables/api'
import type { Geofence, GeofenceEvent } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'purple' | 'gray'; size?: 'sm' | 'md' | 'lg' }

const geofences = ref<Geofence[]>([])
const breaches  = ref<GeofenceEvent[]>([])
const roadsGeo  = ref<GeoJSONFeatureCollection | null>(null)
const loading   = ref(true)
const error     = ref<string | null>(null)
const geofencesError = ref(false)
const breachesError  = ref(false)
const lastRefreshed = ref('-')
const typeFilter     = ref('')
const severityFilter = ref('')
const zoneSearch     = ref('')
const expanded       = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const fleet = useFleet()
  const gis   = useGis()

  const [gfRes, breachRes, roadsRes] = await Promise.allSettled([
    fleet.geofences({ page_size: 100 }),
    fleet.recentBreaches(),
    gis.roads({ limit: 300, simplify: 0.02 }),
  ])

  if (gfRes.status    === 'fulfilled') geofences.value = (gfRes.value as any).results ?? []
  if (breachRes.status === 'fulfilled') breaches.value  = Array.isArray(breachRes.value) ? breachRes.value : ((breachRes.value as any).results ?? [])
  if (roadsRes.status  === 'fulfilled') roadsGeo.value  = roadsRes.value

  geofencesError.value = gfRes.status     === 'rejected'
  breachesError.value  = breachRes.status === 'rejected'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 60_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ─────────────────────────────────────────────────────────────
const activeCount   = computed(() => geofences.value.filter(z => z.is_active).length)
const criticalCount = computed(() => geofences.value.filter(z => z.severity === 'critical').length)

const filteredZones = computed(() =>
  geofences.value.filter(z => {
    if (zoneSearch.value && !z.zone_name.toLowerCase().includes(zoneSearch.value.toLowerCase())) return false
    if (typeFilter.value     && z.zone_type !== typeFilter.value)     return false
    if (severityFilter.value && z.severity  !== severityFilter.value) return false
    return true
  }),
)
const {
  pageRows: zonesPageRows, page: zonesPage, totalPages: zonesTotalPages,
  total: zonesTotal, next: zonesNext, prev: zonesPrev,
} = usePagination(filteredZones, 15)

const zoneExportColumns = [
  { key: 'zone_name', label: 'Zone Name' },
  { key: 'zone_type', label: 'Type' },
  { key: 'severity', label: 'Severity' },
  { key: 'radius_m', label: 'Radius (m)' },
  { key: 'is_active', label: 'Active' },
  { key: 'agency_code', label: 'Agency' },
  { key: 'created_at', label: 'Created' },
]

const zoneMarkers = computed((): MarkerSpec[] =>
  geofences.value
    .filter(z => z.latitude && z.longitude)
    .map(z => ({
      id: `z-${z.id}`,
      lat: z.latitude!,
      lon: z.longitude!,
      title: z.zone_name,
      subtitle: `${z.zone_type} · ${z.severity}`,
      color: !z.is_active ? 'gray'
           : z.severity === 'critical' ? 'red'
           : z.severity === 'high' ? 'orange'
           : 'blue',
      size: z.severity === 'critical' ? 'lg' : 'md',
    })),
)

// ── Helpers ──────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function fmtDate(iso: string | undefined) {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return iso }
}
const { riskBadge: sevBadge, geofenceEventBadge: eventBadge } = useSeverityBadge()
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:900px) { .two-col { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid var(--border-subtle); }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.count-badge { font-size:11px; background:var(--surface-sunken); border-radius:10px; padding:1px 7px; margin-left:6px; }
.scroll-body { max-height:420px; overflow-y:auto; }
.breach-item { padding:10px 14px; border-bottom:1px solid var(--border-subtle); }
.bi-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; }
.bi-time { font-size:11px; color:var(--fg-3); }
.bi-zone { font-size:13px; font-weight:600; }
.bi-plate { font-size:12px; color:var(--fg-2); }
.bi-meta { font-size:11px; color:var(--fg-3); }
.filter-row { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; align-items:center; }
.expand-row { cursor:pointer; }
.expand-cell { width:18px; color:var(--fg-3); font-size:11px; }
.detail-row td { background:var(--surface-1); padding:14px 18px; border-bottom:1px solid var(--border-subtle); }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--fg-3); }
</style>
