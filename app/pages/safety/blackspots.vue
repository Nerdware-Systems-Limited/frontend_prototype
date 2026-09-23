<template>
  <PageHeader
    eyebrow="Safety - Blackspot Analysis"
    title="Blackspot Analysis"
    subtitle="NTSA · KeNHA · KMD - KDE accident cluster analysis, KeNHA road geometry context, KMD weather correlation, and predictive hotspot overlays"
  >
    <!-- <template #actions>
      
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template> -->
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Critical Black Spots"
      :value="fmtNum(tierCount('critical'))"
      :unavailable="loading || spotsError"
      :unavailable-note="loading ? 'Loading…' : 'NTSA KDE Analysis feed unavailable'"
      period="ALL"
      description="Highest-ranked risk clusters"
      :status="loading || spotsError ? undefined : tierCount('critical') > 0 ? 'critical' : 'healthy'"
      to="#blackspot-inventory"
    />
    <KpiCard
      label="High-Risk Spots"
      :value="fmtNum(tierCount('high'))"
      :unavailable="loading || spotsError"
      :unavailable-note="loading ? 'Loading…' : 'NTSA KDE Analysis feed unavailable'"
      period="ALL"
      description="Tier 2 clusters"
      to="#blackspot-inventory"
    />
    <KpiCard
      label="Total Black Spots"
      :value="fmtNum(spots.length)"
      :unavailable="loading || spotsError"
      :unavailable-note="loading ? 'Loading…' : 'NTSA KDE Analysis feed unavailable'"
      period="ALL"
      description="All tiers"
      to="#blackspot-inventory"
    />
    <KpiCard
      label="Avg KDE Intensity"
      :value="avgKDE ? avgKDE.toFixed(3) : '-'"
      :unavailable="loading || spotsError"
      :unavailable-note="loading ? 'Loading…' : 'KDE Model feed unavailable'"
      period="ALL"
      description="Kernel density estimate"
    />
    <KpiCard
      label="Total Accidents (rolling)"
      :value="fmtNum(totalAccidents)"
      :unavailable="loading || spotsError"
      :unavailable-note="loading ? 'Loading…' : 'NTSA IRSMS feed unavailable'"
      period="ROLLING"
      description="Across all black spots"
      to="#blackspot-inventory"
    />
    <KpiCard
      label="Total Fatalities (rolling)"
      :value="fmtNum(totalFatalities)"
      :unavailable="loading || spotsError"
      :unavailable-note="loading ? 'Loading…' : 'NTSA IRSMS feed unavailable'"
      period="ROLLING"
      description="Rolling window count"
      to="#blackspot-inventory"
    />
  </div>

  <!-- Map -->
  <SectionTitle pill="NTSA KDE · Batch">Black Spot & Hotspot Map</SectionTitle>

  <div class="card map-card">
    <ClientOnly>
      <UaptsMap
        :markers="mapMarkers"
        :roads="roadsGeo"
        :center="[-1.286, 36.817]"
        :zoom="7"
        height="500px"
        show-legend
      />
    </ClientOnly>
    <div class="map-key">
      <span class="mk-item"><span class="mk-dot" style="background:#ef4444" /> Critical black spot</span>
      <span class="mk-item"><span class="mk-dot" style="background:#f97316" /> High black spot</span>
      <span class="mk-item"><span class="mk-dot" style="background:#f59e0b" /> Medium / Low</span>
      <span class="mk-item"><span class="mk-dot" style="background:#a855f7" /> Predictive hotspot</span>
    </div>
  </div>

  <!-- Black spot table -->
  <SectionTitle>Black Spot Inventory</SectionTitle>

  <div id="blackspot-inventory" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="spotSearch" class="select-sm" placeholder="Search road name / code…" style="min-width:180px" />
        <select v-model="tierFilter" class="select-sm">
          <option value="">All tiers</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button class="btn" @click="spotSearch=''; tierFilter=''">Clear</button>
        <ExportButton filename="uapts-blackspot-inventory.csv" :rows="filteredSpots" :columns="spotExportColumns" style="margin-left:auto" />
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Road Code / Name</th>
            <th>Tier</th>
            <th>Accidents (rolling)</th>
            <th>Fatalities (rolling)</th>
            <th>KDE Intensity</th>
            <th>Radius (m)</th>
            <th>Window (days)</th>
            <th>Last Computed</th>
          </tr>
        </thead>
        <tbody v-if="filteredSpots.length">
          <template v-for="bs in spotsPageRows" :key="bs.id">
            <tr class="expand-row" @click="expanded = expanded === bs.id ? null : bs.id">
              <td class="expand-cell">{{ expanded === bs.id ? '▾' : '▸' }}</td>
              <td>{{ bs.segment_road_name ?? bs.segment_road_code ?? '-' }}</td>
              <td><BadgePill :variant="tierBadge(bs.ranking_tier)">{{ bs.ranking_tier }}</BadgePill></td>
              <td>{{ fmtNum(bs.accident_count_rolling) }}</td>
              <td>{{ fmtNum(bs.fatality_count_rolling) }}</td>
              <td>{{ bs.kde_intensity != null ? bs.kde_intensity.toFixed(4) : '-' }}</td>
              <td>{{ bs.radius_m ?? '-' }}</td>
              <td>{{ bs.window_days }}</td>
              <td style="font-size:12px">{{ bs.last_computed_at ? fmtDate(bs.last_computed_at) : '-' }}</td>
            </tr>
            <tr v-if="expanded === bs.id" class="detail-row">
              <td :colspan="9">
                <div class="drilldown">
                  <div class="dd-item"><span class="dd-label">Coordinates</span><span style="font-family:monospace">{{ bs.centroid_latitude != null && bs.centroid_longitude != null ? `${bs.centroid_latitude.toFixed(4)}, ${bs.centroid_longitude.toFixed(4)}` : '-' }}</span></div>
                  <div class="dd-item"><span class="dd-label">Created</span><span>{{ fmtDate(bs.created_at) }}</span></div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="9" style="text-align:center;color:var(--fg-3);padding:16px">
              {{ loading ? 'Loading…' : 'No black spots found' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="spotsPage" :total-pages="spotsTotalPages" :total="spotsTotal"
        @prev="spotsPrev" @next="spotsNext"
      />
    </div>
  </div>

  <!-- Accidents by cause -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">Accidents by Cause</div>
      <div class="card-body">
        <div v-if="causeData.length" class="bar-list">
          <div v-for="c in causeData.slice(0, 10)" :key="c.cause_of_accident ?? c.label" class="bar-row">
            <div class="bar-label">{{ (c.cause_of_accident ?? c.label ?? 'Unknown').replace(/_/g,' ') }}</div>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{
                  width: `${maxCause > 0 ? ((c.total ?? 0) / maxCause) * 100 : 0}%`,
                }"
              />
            </div>
            <div class="bar-val">{{ fmtNum(c.total ?? 0) }}</div>
          </div>
        </div>
        <EmptyState v-else :loading="loading" message="No data" compact />
      </div>
    </div>

    <!-- Predictive hotspots -->
    <div class="card">
      <div class="card-header">Top Predictive Hotspots</div>
      <div class="card-body">
        <div v-if="hotspots.length" class="hs-list">
          <div v-for="(hs, i) in hotspots.slice(0, 10)" :key="hs.id" class="hs-row">
            <span class="hs-rank">#{{ i + 1 }}</span>
            <div class="hs-info">
              <div class="hs-seg">{{ hs.segment_road_code ?? `Grid ${hs.grid_cell_id}` }}</div>
              <div class="hs-factors">{{ toFactors(hs.contributing_factors).join(' · ') || '-' }}</div>
            </div>
            <BadgePill :variant="riskBadge(hs.risk_tier)">{{ hs.risk_tier }}</BadgePill>
            <span class="hs-score">{{ hs.predicted_risk_score.toFixed(2) }}</span>
          </div>
        </div>
        <EmptyState v-else :loading="loading" message="No hotspot data" compact />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useSafety, useGis } from '~/composables/api'
import type { BlackSpot, PredictiveHotspot } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'purple' | 'gray'; size?: 'sm' | 'md' | 'lg' }

const spots    = ref<BlackSpot[]>([])
const hotspots = ref<PredictiveHotspot[]>([])
const causeData = ref<any[]>([])
const roadsGeo  = ref<GeoJSONFeatureCollection | null>(null)
const loading   = ref(true)
const error     = ref<string | null>(null)
const spotsError = ref(false)
const lastRefreshed = ref('-')
const tierFilter = ref('')
const spotSearch = ref('')
const expanded   = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const safety = useSafety()
  const gis    = useGis()

  const [bsRes, topRes, hsRes, causeRes, roadsRes] = await Promise.allSettled([
    safety.blackspots({ page_size: 100 }),
    safety.topBlackspots(),
    safety.hotspots({ page_size: 20 }),
    safety.accidentsByCause(),
    gis.roads({ limit: 300, simplify: 0.01 }),
  ])

  // Merge top + full list (top may have extra detail)
  const fullList  = bsRes.status  === 'fulfilled' ? ((bsRes.value as any).results ?? []) : []
  const topList   = topRes.status === 'fulfilled' ? ((topRes.value as any).results ?? []) : []
  // Deduplicate by id
  const idSet = new Set(fullList.map((b: any) => b.id))
  spots.value = [...fullList, ...topList.filter((b: any) => !idSet.has(b.id))]

  if (hsRes.status    === 'fulfilled') hotspots.value  = (hsRes.value as any).results ?? []
  if (causeRes.status === 'fulfilled') {
    const raw = (causeRes.value as any)
    causeData.value = Array.isArray(raw) ? raw : (raw.results ?? [])
  }
  if (roadsRes.status === 'fulfilled') roadsGeo.value = roadsRes.value

  spotsError.value = bsRes.status === 'rejected'

  if (bsRes.status === 'rejected' && hsRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Safety API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ────────────────────────────────────────────────────────────
const filteredSpots = computed(() =>
  spots.value.filter(s => {
    if (tierFilter.value && s.ranking_tier !== tierFilter.value) return false
    if (spotSearch.value) {
      const q = spotSearch.value.toLowerCase()
      if (!(s.segment_road_name ?? '').toLowerCase().includes(q) && !(s.segment_road_code ?? '').toLowerCase().includes(q)) return false
    }
    return true
  }),
)
// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: spotsPageRows, page: spotsPage, totalPages: spotsTotalPages,
  total: spotsTotal, next: spotsNext, prev: spotsPrev,
} = usePagination(filteredSpots, 15)

const spotExportColumns = [
  { key: 'segment_road_name', label: 'Road' },
  { key: 'ranking_tier', label: 'Tier' },
  { key: 'accident_count_rolling', label: 'Accidents' },
  { key: 'fatality_count_rolling', label: 'Fatalities' },
  { key: 'kde_intensity', label: 'KDE Intensity' },
  { key: 'radius_m', label: 'Radius (m)' },
  { key: 'window_days', label: 'Window (days)' },
  { key: 'last_computed_at', label: 'Last Computed' },
]

function tierCount(tier: string) {
  return spots.value.filter(s => s.ranking_tier === tier).length
}

function toFactors(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string' && v) return v.split(',').map(s => s.trim())
  return []
}

const totalAccidents = computed(() =>
  spots.value.reduce((s, b) => s + (b.accident_count_rolling ?? 0), 0),
)
const totalFatalities = computed(() =>
  spots.value.reduce((s, b) => s + (b.fatality_count_rolling ?? 0), 0),
)
const avgKDE = computed(() => {
  const withKDE = spots.value.filter(s => s.kde_intensity != null)
  if (!withKDE.length) return null
  return withKDE.reduce((s, b) => s + b.kde_intensity!, 0) / withKDE.length
})
const maxCause = computed(() =>
  Math.max(1, ...causeData.value.map(c => c.total ?? 0)),
)

const mapMarkers = computed((): MarkerSpec[] => {
  const markers: MarkerSpec[] = []
  spots.value.forEach(bs => {
    if (bs.centroid_latitude && bs.centroid_longitude) {
      markers.push({
        id: `bs-${bs.id}`,
        lat: bs.centroid_latitude,
        lon: bs.centroid_longitude,
        title: bs.segment_road_name ?? bs.segment_road_code ?? 'Black Spot',
        subtitle: `${bs.ranking_tier} · ${bs.accident_count_rolling} accidents`,
        color: bs.ranking_tier === 'critical' ? 'red' : bs.ranking_tier === 'high' ? 'orange' : 'yellow',
        size: bs.ranking_tier === 'critical' ? 'lg' : bs.ranking_tier === 'high' ? 'md' : 'sm',
      })
    }
  })
  hotspots.value.forEach(hs => {
    markers.push({
      id: `hs-${hs.id}`,
      lat: hs.latitude,
      lon: hs.longitude,
      title: `Predicted risk: ${hs.predicted_risk_score.toFixed(2)}`,
      subtitle: hs.risk_tier,
      color: 'purple',
      size: 'sm',
    })
  })
  return markers
})

// ── Helpers ─────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return iso }
}
function tierBadge(t: string | null) {
  const m: Record<string,string> = { critical:'danger', very_high:'danger', high:'warning', medium:'fair', low:'success' }
  return (t && m[t]) || 'neutral'
}
function riskBadge(t: string | null) {
  return tierBadge(t)
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.map-card { overflow:hidden; margin-bottom:16px; }
.map-key { display:flex; gap:16px; flex-wrap:wrap; font-size:11px; padding:8px 16px; border-top:1px solid var(--border-subtle); }
.mk-item { display:flex; align-items:center; gap:4px; }
.mk-dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
.filter-row { display:flex; gap:8px; margin-bottom:12px; align-items:center; flex-wrap:wrap; }
.expand-row { cursor:pointer; }
.expand-cell { width:18px; color:var(--fg-3); font-size:11px; }
.detail-row td { background:var(--surface-1); padding:14px 18px; border-bottom:1px solid var(--border-subtle); }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--fg-3); }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media(max-width:900px) { .two-col { grid-template-columns:1fr; } }
.bar-list { display:flex; flex-direction:column; gap:8px; }
.bar-row { display:grid; grid-template-columns:140px 1fr 50px; align-items:center; gap:8px; }
.bar-label { font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-track { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.bar-fill { height:100%; background:var(--destructive); border-radius:4px; }
.bar-val { font-size:12px; text-align:right; font-weight:600; }
.hs-list { display:flex; flex-direction:column; gap:6px; }
.hs-row { display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--border-subtle); }
.hs-rank { width:24px; font-size:11px; font-weight:700; color:var(--fg-3); }
.hs-info { flex:1; min-width:0; }
.hs-seg { font-size:12px; font-weight:600; }
.hs-factors { font-size:11px; color:var(--fg-3); }
.hs-score { font-size:13px; font-weight:700; color:var(--danger-fg); }
</style>
