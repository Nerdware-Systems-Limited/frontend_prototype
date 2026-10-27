<template>
  <PageHeader
    eyebrow="Maritime - Waterways"
    title="Waterways"
    subtitle="KMA - Chartered (surveyed &amp; gazetted) and unchartered navigable waterway classification, plus navigation buoys, lighthouses, dredged channel depth, and VHF coverage"
  >
    <template #actions>
      <NuxtLink to="/maritime/infrastructure" class="btn">Port Infrastructure<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/maritime/accidents" class="btn">Accidents<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">
    ⚠ {{ error }}
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Chartered Waterways" :value="fmtNum(charteredCount)"
      :unavailable="loading || listError" :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="LIVE" description="Surveyed &amp; gazetted" to="#waterway-registry"
    />
    <KpiCard
      label="Unchartered Waterways" :value="fmtNum(unchateredCount)"
      :unavailable="loading || listError" :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="LIVE" description="Unsurveyed / artisanal use" to="#waterway-registry"
    />
    <KpiCard
      label="Navaid Availability" :value="pct(navaidOperationalPct)"
      :unavailable="loading || infraError" :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="LIVE" description="Buoys/lighthouses/radar/VHF (target 100%)"
      :status="navaidOperationalPct == null ? undefined : navaidOperationalPct >= 95 ? 'healthy' : 'warning'"
      to="#navigation-aids"
    />
    <KpiCard
      label="Lighthouse Uptime" :value="pct(lighthouseUptimePct)"
      :unavailable="loading || infraError" :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="LIVE" description="Target 99.9%"
      :status="lighthouseUptimePct == null ? undefined : lighthouseUptimePct >= 99.9 ? 'healthy' : 'warning'"
      to="#navigation-aids"
    />
    <KpiCard
      label="VHF Station Uptime" :value="pct(vhfUptimePct)"
      :unavailable="loading || infraError" :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="LIVE" description="Registered VHF stations" to="#navigation-aids"
    />
    <KpiCard
      label="Incidents on Waterways" :value="fmtNum(waterwayIncidents)"
      :unavailable="loading || !summary" :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="LIVE" description="Incidents linked to a registered waterway" to="/maritime/accidents"
    />
  </div>

  <!-- Map -->
  <SectionTitle pill="KMA · OSM hydrology">Waterways Map</SectionTitle>
  <div class="card">
    <div class="card-body">
      <ClientOnly>
        <WaterwaysMap :navaids="mapNavaids" :highlight="pickedShape" />
      </ClientOnly>
      <div v-if="pickedNote" class="source-note">{{ pickedNote }}</div>
      <div v-else class="source-note">Click a waterway in the table below to highlight it. Rivers, streams and lakes are OpenStreetMap context, not the register of navigable waterways.</div>
    </div>
  </div>

  <!-- Waterway registry -->
  <SectionTitle pill="KMA · Live">Waterway Classification</SectionTitle>
  <div id="waterway-registry" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="categoryFilter" class="select-sm">
          <option value="">All categories</option>
          <option value="chartered">Chartered</option>
          <option value="unchartered">Unchartered</option>
        </select>
        <button class="btn" @click="categoryFilter=''">Clear</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Waterway</th><th>Category</th><th>Region</th><th>Channel Depth</th><th>Last Survey</th><th>Access Restrictions</th></tr>
          </thead>
          <tbody v-if="filteredWaterways.length">
            <tr v-for="w in waterwaysPageRows" :key="w.id" class="pick" :class="{ picked: pickedId === w.id }" @click="pick(w)">
              <td style="font-weight:600;font-size:12px">{{ w.name }}</td>
              <td><BadgePill :variant="w.category === 'chartered' ? 'success' : 'warning'">{{ w.category }}</BadgePill></td>
              <td style="font-size:12px">{{ w.region || '-' }}</td>
              <td style="font-size:12px">{{ channelDepthLabel(w.name) }}</td>
              <td style="font-size:11px">{{ w.last_survey_date ? fmtDay(w.last_survey_date) : '-' }}</td>
              <td style="font-size:12px">{{ w.access_restrictions || '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="6" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No waterways registered.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="waterwaysPage" :total-pages="waterwaysTotalPages" :total="waterwaysTotal"
          @prev="waterwaysPrev" @next="waterwaysNext"
        />
      </div>
      <div class="source-note">Vessel traffic counts per waterway aren't tracked yet - vessel movements carry a port, not a waterway. Incident counts use incidents linked to a waterway (run <code>manage.py link_waterways</code> after loading incidents or navigation aids).</div>
    </div>
  </div>

  <!-- Waterway infrastructure -->
  <SectionTitle pill="KMA · Live">Navigation Aids (on chartered waterways)</SectionTitle>
  <div id="navigation-aids" class="card drill-target">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Waterway</th><th>Name</th><th>Type</th><th>Status</th><th>Uptime</th></tr>
          </thead>
          <tbody v-if="navaids.length">
            <tr v-for="n in navaidsPageRows" :key="n.id">
              <td style="font-weight:600;font-size:12px">{{ n.waterway_name ?? '-' }}</td>
              <td style="font-size:12px">{{ n.name }}</td>
              <td><BadgePill variant="info">{{ n.aid_type.replace(/_/g,' ') }}</BadgePill></td>
              <td><BadgePill :variant="statusBadge(n.operational_status)">{{ n.operational_status.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-size:12px">{{ n.uptime_pct != null ? `${n.uptime_pct.toFixed(1)}%` : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No navigation aids linked to a waterway yet.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="navaidsPage" :total-pages="navaidsTotalPages" :total="navaidsTotal"
          @prev="navaidsPrev" @next="navaidsNext"
        />
      </div>
    </div>
  </div>

  <SectionTitle pill="KMA Hydrographic · Live">Channel Depth (on chartered waterways)</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Waterway</th><th>Channel</th><th>Dredged Depth (m)</th><th>Target Depth (m)</th><th>vs Target</th><th>Last Dredged</th></tr>
          </thead>
          <tbody v-if="channels.length">
            <tr v-for="c in channelsPageRows" :key="c.id">
              <td style="font-weight:600;font-size:12px">{{ c.waterway_name ?? '-' }}</td>
              <td style="font-size:12px">{{ c.name }}</td>
              <td>{{ c.dredged_depth_m }}</td>
              <td>{{ c.target_depth_m ?? '-' }}</td>
              <td>
                <BadgePill v-if="c.target_depth_m != null" :variant="c.dredged_depth_m >= c.target_depth_m ? 'success' : 'danger'">
                  {{ c.dredged_depth_m >= c.target_depth_m ? 'meets target' : 'below target' }}
                </BadgePill>
                <span v-else>-</span>
              </td>
              <td style="font-size:11px">{{ c.last_dredged_date ? fmtDay(c.last_dredged_date) : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="6" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No channels linked to a waterway yet.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="channelsPage" :total-pages="channelsTotalPages" :total="channelsTotal"
          @prev="channelsPrev" @next="channelsNext"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import { useMaritimeWaterways } from '~/composables/api'
import type { MaritimeWaterwaysSummary, Waterway, MaritimeNavaid, MaritimeChannel, WaterwayCategory } from '~/composables/api'

const summary = ref<MaritimeWaterwaysSummary | null>(null)
const waterways = ref<Waterway[]>([])
const navaids = ref<MaritimeNavaid[]>([])
const channels = ref<MaritimeChannel[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const listError = ref(false)
const infraError = ref(false)

const categoryFilter = ref<'' | WaterwayCategory>('')

async function load() {
  loading.value = true
  error.value = null
  const ww = useMaritimeWaterways()

  const [sumRes, listRes, infraRes] = await Promise.allSettled([
    ww.summary(),
    ww.list({ page_size: 100 }),
    ww.infrastructure(),
  ])

  if (sumRes.status   === 'fulfilled') summary.value = sumRes.value
  if (listRes.status  === 'fulfilled') waterways.value = listRes.value.results ?? []
  if (infraRes.status === 'fulfilled') {
    navaids.value = infraRes.value.navigation_aids ?? []
    channels.value = infraRes.value.channels ?? []
  }

  listError.value  = listRes.status  === 'rejected'
  infraError.value = infraRes.status === 'rejected'

  if ([sumRes, listRes, infraRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime Waterways API.'

  loading.value = false
}

onMounted(load)

const filteredWaterways = computed(() => waterways.value.filter(w => !categoryFilter.value || w.category === categoryFilter.value))

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: waterwaysPageRows, page: waterwaysPage, totalPages: waterwaysTotalPages,
  total: waterwaysTotal, next: waterwaysNext, prev: waterwaysPrev,
} = usePagination(filteredWaterways, 15)

const {
  pageRows: navaidsPageRows, page: navaidsPage, totalPages: navaidsTotalPages,
  total: navaidsTotal, next: navaidsNext, prev: navaidsPrev,
} = usePagination(navaids, 15)

const {
  pageRows: channelsPageRows, page: channelsPage, totalPages: channelsTotalPages,
  total: channelsTotal, next: channelsNext, prev: channelsPrev,
} = usePagination(channels, 15)

// ── KPIs, computed from the live catalogues (this backend has no flat kpis summary) ─
const charteredCount   = computed(() => waterways.value.filter(w => w.category === 'chartered').length)
const unchateredCount  = computed(() => waterways.value.filter(w => w.category === 'unchartered').length)
const navaidOperationalPct = computed(() => {
  if (!navaids.value.length) return null
  const operational = navaids.value.filter(n => n.operational_status === 'operational').length
  return (operational / navaids.value.length) * 100
})
function avgUptime(aidType: string): number | null {
  const withUptime = navaids.value.filter(n => n.aid_type === aidType && n.uptime_pct != null)
  if (!withUptime.length) return null
  return withUptime.reduce((s, n) => s + (n.uptime_pct as number), 0) / withUptime.length
}
const lighthouseUptimePct = computed(() => avgUptime('lighthouse'))
const vhfUptimePct = computed(() => avgUptime('vhf_station'))

// ── Map ────────────────────────────────────────────────────────────────
const mapNavaids = computed(() => navaids.value.filter(n => n.latitude != null && n.longitude != null))
const pickedId = ref<string | null>(null)
const pickedShape = ref<any | null>(null)
const pickedNote = ref('')
async function pick(w: Waterway) {
  pickedId.value = w.id
  pickedShape.value = null
  pickedNote.value = ''
  try {
    const g = await useMaritimeWaterways().geometry(w.id)
    pickedShape.value = g
    if (!g.features.length) pickedNote.value = `"${w.name}" has no matching name in the OSM hydrology layers, so there is no shape to draw.`
  } catch {
    pickedNote.value = 'Could not load this waterway\'s shape.'
  }
}
const waterwayIncidents = computed(() => (summary.value?.waterways ?? []).reduce((n, w) => n + (w.incidents?.value ?? 0), 0))

function channelDepthLabel(waterwayName: string): string {
  const row = summary.value?.waterways.find(w => w.waterway === waterwayName)
  if (!row?.channels.length) return '-'
  return row.channels.map(c => `${c.name}: ${c.dredged_depth_m}m${c.target_depth_m != null ? ` / ${c.target_depth_m}m target` : ''}`).join('; ')
}

function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDay(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function pct(v: number | null | undefined) { return v == null ? '-' : `${v.toFixed(1)}%` }
function statusBadge(s: string) {
  const m: Record<string,string> = { operational:'success', maintenance:'warning', non_operational:'danger' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.table-scroll { overflow-x:auto; }
.pick { cursor:pointer; }
.pick:hover, .picked { background: var(--bg-2, rgba(59,130,246,.08)); }
</style>
