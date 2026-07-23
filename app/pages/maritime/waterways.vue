<template>
  <PageHeader
    eyebrow="Maritime - Waterways"
    title="Waterways"
    subtitle="KMA - Chartered (surveyed &amp; gazetted) and unchartered navigable waterway classification, plus navigation buoys, lighthouses, dredged channel depth, and VHF coverage"
  >
    <template #actions>
      <NuxtLink to="/maritime/infrastructure" class="btn">Port Infrastructure →</NuxtLink>
      <NuxtLink to="/maritime/accidents" class="btn">Accidents →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">
    ⚠ {{ error }}
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Chartered Waterways" :value="fmtNum(charteredCount)" sub="Surveyed &amp; gazetted" source="live" source-title="KMA" />
    <KpiCard label="Unchartered Waterways" :value="fmtNum(unchateredCount)" sub="Unsurveyed / artisanal use" source="live" source-title="KMA" />
    <KpiCard label="Navaid Availability" :value="pct(navaidOperationalPct)" sub="Buoys/lighthouses/radar/VHF (target 100%)" :trend-direction="(navaidOperationalPct ?? 0) >= 95 ? 'up' : 'down'" source="live" source-title="KMA" />
    <KpiCard label="Lighthouse Uptime" :value="pct(lighthouseUptimePct)" sub="Target 99.9%" :trend-direction="(lighthouseUptimePct ?? 0) >= 99.9 ? 'up' : 'down'" source="live" source-title="KMA" />
    <KpiCard label="VHF Station Uptime" :value="pct(vhfUptimePct)" sub="Registered VHF stations" source="live" source-title="KMA" />
    <KpiCard label="Vessel Traffic / Incidents" value="Not tracked" sub="No waterway link on vessel_movements/maritime_incidents" source="live" source-title="KMA" />
  </div>

  <!-- Waterway registry -->
  <SectionTitle pill="KMA · Live">Waterway Classification</SectionTitle>
  <div class="card">
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
            <tr v-for="w in filteredWaterways" :key="w.id">
              <td style="font-weight:600;font-size:12px">{{ w.name }}</td>
              <td><BadgePill :variant="w.category === 'chartered' ? 'success' : 'warning'">{{ w.category }}</BadgePill></td>
              <td style="font-size:12px">{{ w.region || '-' }}</td>
              <td style="font-size:12px">{{ channelDepthLabel(w.name) }}</td>
              <td style="font-size:11px">{{ w.last_survey_date ? fmtDay(w.last_survey_date) : '-' }}</td>
              <td style="font-size:12px">{{ w.access_restrictions || '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No waterways registered.' }}</td></tr></tbody>
        </table>
      </div>
      <div class="source-note">Vessel traffic counts and incident counts per waterway aren't tracked on this backend yet - neither vessel movements nor maritime incidents carry a waterway link (only a port link).</div>
    </div>
  </div>

  <!-- Waterway infrastructure -->
  <SectionTitle pill="KMA · Live">Navigation Aids (on chartered waterways)</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Waterway</th><th>Name</th><th>Type</th><th>Status</th><th>Uptime</th></tr>
          </thead>
          <tbody v-if="navaids.length">
            <tr v-for="n in navaids" :key="n.id">
              <td style="font-weight:600;font-size:12px">{{ n.waterway_name ?? '-' }}</td>
              <td style="font-size:12px">{{ n.name }}</td>
              <td><BadgePill variant="info">{{ n.aid_type.replace(/_/g,' ') }}</BadgePill></td>
              <td><BadgePill :variant="statusBadge(n.operational_status)">{{ n.operational_status.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-size:12px">{{ n.uptime_pct != null ? `${n.uptime_pct.toFixed(1)}%` : '-' }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No navigation aids linked to a waterway yet.' }}</td></tr></tbody>
        </table>
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
            <tr v-for="c in channels" :key="c.id">
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
          <tbody v-else><tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No channels linked to a waterway yet.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Waterways')

import { useMaritimeWaterways } from '~/composables/api'
import type { MaritimeWaterwaysSummary, Waterway, MaritimeNavaid, MaritimeChannel, WaterwayCategory } from '~/composables/api'

const summary = ref<MaritimeWaterwaysSummary | null>(null)
const waterways = ref<Waterway[]>([])
const navaids = ref<MaritimeNavaid[]>([])
const channels = ref<MaritimeChannel[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

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

  if ([sumRes, listRes, infraRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime Waterways API.'

  loading.value = false
}

onMounted(load)

const filteredWaterways = computed(() => waterways.value.filter(w => !categoryFilter.value || w.category === categoryFilter.value))

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
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
</style>
