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
      sub="Configured geofence zones"
      source="live" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="Active Zones"
      :value="fmtNum(activeCount)"
      sub="Currently monitoring"
      trend-direction="up"
      source="live" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="Breaches (24h)"
      :value="fmtNum(breaches.length)"
      sub="All entry / exit / dwell events"
      trend-direction="down"
      source="live" source-title="NTSA iTIMS"
    />
    <KpiCard
      label="Critical Zones"
      :value="fmtNum(criticalCount)"
      sub="Severity = critical"
      source="live" source-title="NTSA iTIMS"
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
        <span class="mk"><span class="dot" style="background:#ef4444" /> Critical</span>
        <span class="mk"><span class="dot" style="background:#f59e0b" /> High</span>
        <span class="mk"><span class="dot" style="background:#3b82f6" /> Medium / Low</span>
        <span class="mk"><span class="dot" style="background:#94a3b8" /> Inactive</span>
      </div>
    </div>

    <div class="card">
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
        <div v-if="!loading && breaches.length === 0" style="color:#94a3b8;font-size:13px;padding:12px">
          No breach events recorded.
        </div>
      </div>
    </div>
  </div>

  <!-- Geofence zones table -->
  <SectionTitle>Geofence Zone Inventory</SectionTitle>

  <div class="card">
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
          <template v-for="z in filteredZones" :key="z.id">
            <tr class="expand-row" @click="expanded = expanded === z.id ? null : z.id">
              <td class="expand-cell">{{ expanded === z.id ? '▾' : '▸' }}</td>
              <td style="font-weight:600">{{ z.zone_name }}</td>
              <td><BadgePill variant="info">{{ z.zone_type }}</BadgePill></td>
              <td><BadgePill :variant="sevBadge(z.severity)">{{ z.severity }}</BadgePill></td>
              <td>{{ z.radius_m ?? '-' }}</td>
              <td>
                <span :style="{ color: z.is_active ? '#22c55e' : '#94a3b8' }">
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
            <td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading…' : 'No zones found' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Geofences')

import { useFleet, useGis } from '~/composables/api'
import type { Geofence, GeofenceEvent } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'purple' | 'gray'; size?: 'sm' | 'md' | 'lg' }

const geofences = ref<Geofence[]>([])
const breaches  = ref<GeofenceEvent[]>([])
const roadsGeo  = ref<GeoJSONFeatureCollection | null>(null)
const loading   = ref(true)
const error     = ref<string | null>(null)
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
function sevBadge(s: string) {
  const m: Record<string,string> = { critical:'danger', high:'warning', medium:'fair', low:'success' }
  return m[s] ?? 'neutral'
}
function eventBadge(e: string) {
  return e === 'entry' ? 'info' : e === 'exit' ? 'warning' : 'neutral'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:900px) { .two-col { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid #f1f5f9; }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.count-badge { font-size:11px; background:#f1f5f9; border-radius:10px; padding:1px 7px; margin-left:6px; }
.scroll-body { max-height:420px; overflow-y:auto; }
.breach-item { padding:10px 14px; border-bottom:1px solid #f8fafc; }
.bi-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; }
.bi-time { font-size:11px; color:#94a3b8; }
.bi-zone { font-size:13px; font-weight:600; }
.bi-plate { font-size:12px; color:#64748b; }
.bi-meta { font-size:11px; color:#94a3b8; }
.filter-row { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; align-items:center; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.expand-row { cursor:pointer; }
.expand-cell { width:18px; color:#94a3b8; font-size:11px; }
.detail-row td { background:#fafbfc; padding:14px 18px; border-bottom:1px solid #f1f5f9; }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; }
</style>
