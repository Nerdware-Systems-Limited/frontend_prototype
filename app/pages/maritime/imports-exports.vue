<template>
  <PageHeader
    eyebrow="Maritime - Imports/Exports"
    title="Imports/Exports"
    subtitle="KPA - Container throughput by loaded (export) &amp; unloaded (import) direction, yard dwell time, and the KRC/KPA port-rail container reconciliation"
  >
    <template #actions>
      <NuxtLink to="/maritime/cargo" class="btn">Cargo Tracking →</NuxtLink>
      <NuxtLink to="/railway/freight" class="btn">Full Rail Reconciliation Log →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Throughput" :value="totalTeu != null ? `${fmtNum(totalTeu)} TEU` : '-'"
      :unavailable="loading || tpError" :unavailable-note="loading ? 'Loading…' : 'KPA feed unavailable'"
      period="LIVE" description="Sampled window, both ports" :series="totalThroughputSeries" to="#by-port-direction"
    />
    <KpiCard
      label="Unloaded (Imports)" :value="importTeu != null ? `${fmtNum(importTeu)} TEU` : '-'"
      :unavailable="loading || tpError" :unavailable-note="loading ? 'Loading…' : 'KPA feed unavailable'"
      period="LIVE" :description="importSharePct != null ? `${importSharePct.toFixed(0)}% of throughput` : 'Discharged from vessel'"
      to="#by-port-direction"
    />
    <KpiCard
      label="Loaded (Exports)" :value="exportTeu != null ? `${fmtNum(exportTeu)} TEU` : '-'"
      :unavailable="loading || tpError" :unavailable-note="loading ? 'Loading…' : 'KPA feed unavailable'"
      period="LIVE" :description="exportSharePct != null ? `${exportSharePct.toFixed(0)}% of throughput` : 'Loaded onto vessel'"
      to="#by-port-direction"
    />
    <KpiCard
      label="Transhipment" :value="transitTeu != null ? `${fmtNum(transitTeu)} TEU` : '-'"
      :unavailable="loading || tpError" :unavailable-note="loading ? 'Loading…' : 'KPA feed unavailable'"
      period="LIVE" description="In transit, no port exit" to="#by-port-direction"
    />
    <KpiCard
      label="Avg Yard Dwell - Import" :value="avgImportDwell != null ? `${avgImportDwell.toFixed(1)}d` : '-'"
      :unavailable="loading || dwellError" :unavailable-note="loading ? 'Loading…' : 'KPA Yard System feed unavailable'"
      period="LIVE" description="Unloaded containers awaiting gate-out" to="#yard-dwell-table"
    />
    <KpiCard
      label="Avg Yard Dwell - Export" :value="avgExportDwell != null ? `${avgExportDwell.toFixed(1)}d` : '-'"
      :unavailable="loading || dwellError" :unavailable-note="loading ? 'Loading…' : 'KPA Yard System feed unavailable'"
      period="LIVE" description="Loaded containers awaiting vessel" to="#yard-dwell-table"
    />
  </div>

  <!-- Loaded vs Unloaded by port -->
  <SectionTitle pill="KPA · Live">Loaded &amp; Unloaded Containers by Port</SectionTitle>
  <div id="by-port-direction" class="card drill-target">
    <div class="card-body">
      <div v-if="portDirectionRows.length" class="cong-list">
        <div v-for="r in portDirectionRows" :key="`${r.port}-${r.direction}`" class="cong-row">
          <span class="cong-label">{{ r.portName }} <BadgePill :variant="directionBadge(r.direction)" size="sm">{{ directionLabel(r.direction) }}</BadgePill></span>
          <div class="cong-bar-wrap">
            <div class="cong-bar" :style="{ transform: `scaleX(${maxPortDirTeu > 0 ? r.teu / maxPortDirTeu : 0})`, background: directionColor(r.direction) }" />
          </div>
          <span class="cong-val">{{ fmtNum(r.teu) }} TEU · {{ fmtNum(r.boxes) }} boxes · {{ fmtNum(r.tons) }}t</span>
        </div>
      </div>
      <EmptyState v-else :loading="loading" message="No container throughput records in the sampled window." compact />
    </div>
  </div>

  <!-- Throughput trend -->
  <SectionTitle pill="KPA · Live">Container Throughput Trend (60d)</SectionTitle>
  <div class="card" style="margin-bottom:16px">
    <div class="card-body">
      <MultiLineChart :series="trendSeries" :height="200" :format-value="v => `${fmtNum(v)} TEU`" empty-text="No trend data available" />
    </div>
  </div>

  <!-- Yard dwell -->
  <SectionTitle pill="KPA Yard System · Live">Yard Dwell Time by Port &amp; Direction</SectionTitle>
  <div id="yard-dwell-table" class="card drill-target">
    <div class="card-body">
      <table>
        <thead>
          <tr><th>Port</th><th>Direction</th><th>Containers</th><th>Avg Dwell</th><th>P50</th><th>P95</th><th>Max</th><th>As of</th></tr>
        </thead>
        <tbody v-if="dwellRows.length">
          <tr v-for="d in dwellRowsPageRows" :key="`${d.port_unlocode}-${d.direction}`">
            <td style="font-family:monospace;font-size:12px">{{ d.port_unlocode }}</td>
            <td><BadgePill :variant="directionBadge(d.direction)" size="sm">{{ directionLabel(d.direction) }}</BadgePill></td>
            <td>{{ fmtNum(d.container_count) }}</td>
            <td style="font-weight:600" :style="{ color: d.avg_dwell_days > 5 ? 'var(--danger-fg)' : 'var(--fg-1)' }">{{ d.avg_dwell_days.toFixed(1) }}d</td>
            <td style="font-size:12px">{{ d.p50_dwell_days.toFixed(1) }}d</td>
            <td style="font-size:12px">{{ d.p95_dwell_days.toFixed(1) }}d</td>
            <td style="font-size:12px">{{ d.max_dwell_days.toFixed(1) }}d</td>
            <td style="font-size:11px;color:var(--fg-2);white-space:nowrap">{{ fmtDate(d.report_date) }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="8" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No yard dwell records in the sampled window.' }}</td></tr></tbody>
      </table>
      <TablePagination
        :page="dwellRowsPage" :total-pages="dwellRowsTotalPages" :total="dwellRowsTotal"
        @prev="dwellRowsPrev" @next="dwellRowsNext"
      />
    </div>
  </div>

  <!-- Port-Rail Container Reconciliation -->
  <SectionTitle pill="KRC / KPA · Rail-Nominated Containers">Port-Rail Container Reconciliation</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="recon-note">
        Rail-nominated containers are KRC freight manifests with a KPA customs clearance reference or declared port origin - i.e. containers unloaded here and moved onward by rail.
        Showing a sample of the most recent {{ railManifests.length }} manifests; see the full log on the Railway Freight page.
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Manifest Ref</th><th>Customs Ref (KPA)</th><th>Port of Origin</th><th>Cargo Type</th><th>Tonnage</th><th>Route</th><th>Dispatched</th><th>Arrived</th></tr>
          </thead>
          <tbody v-if="portRailManifests.length">
            <tr v-for="m in portRailManifestsPageRows" :key="m.id">
              <td style="font-family:monospace;font-weight:700;font-size:12px">{{ m.manifest_ref }}</td>
              <td style="font-family:monospace;font-size:12px;color:var(--link)">{{ m.customs_clearance_ref ?? '-' }}</td>
              <td style="font-family:monospace;font-size:12px">{{ m.port_origin ?? '-' }}</td>
              <td><BadgePill variant="info" size="sm">{{ m.cargo_type.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-weight:600">{{ fmtNum(m.tonnage) }}t</td>
              <td style="font-size:12px">{{ m.origin_station_code }} → {{ m.destination_station_code }}</td>
              <td style="font-size:11px;white-space:nowrap">{{ fmtDate(m.dispatched_at) }}</td>
              <td style="font-size:11px;white-space:nowrap">
                <span v-if="m.arrived_at">{{ fmtDate(m.arrived_at) }}</span>
                <span v-else style="color:var(--warning-fg)">Pending</span>
              </td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="8" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading reconciliation data…' : 'No port-rail manifests found in the sampled window.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="portRailManifestsPage" :total-pages="portRailManifestsTotalPages" :total="portRailManifestsTotal"
          @prev="portRailManifestsPrev" @next="portRailManifestsNext"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useAviationMaritime, useRailway } from '~/composables/api'
import type { ContainerThroughputRecord, ContainerByPort, ContainerTrendPoint, YardDwellRecord, ContainerDirection, FreightManifest } from '~/composables/api'

const rawThroughput = ref<ContainerThroughputRecord[]>([])
const byPort         = ref<ContainerByPort[]>([])
const trend          = ref<ContainerTrendPoint[]>([])
const dwell          = ref<YardDwellRecord[]>([])
const railManifests  = ref<FreightManifest[]>([])
const loading        = ref(true)
const error          = ref<string | null>(null)
const tpError        = ref(false)
const dwellError     = ref(false)

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()
  const rail = useRailway()

  const [tpRes, bpRes, trRes, dwRes, rmRes] = await Promise.allSettled([
    avm.containerThroughput({ page_size: 100 }),
    avm.containerByPort(),
    avm.containerTrend(60),
    avm.yardDwell({ page_size: 100 }),
    rail.freight({ page_size: 100 }),
  ])

  if (tpRes.status === 'fulfilled') rawThroughput.value = tpRes.value.results ?? []
  if (bpRes.status === 'fulfilled') byPort.value = bpRes.value.results ?? []
  if (trRes.status === 'fulfilled') trend.value = trRes.value.results ?? []
  if (dwRes.status === 'fulfilled') dwell.value = dwRes.value.results ?? []
  if (rmRes.status === 'fulfilled') {
    railManifests.value = ((rmRes.value as any).results ?? [])
      .sort((a: FreightManifest, b: FreightManifest) => b.dispatched_at.localeCompare(a.dispatched_at))
  }

  tpError.value    = tpRes.status === 'rejected'
  dwellError.value = dwRes.status === 'rejected'

  if ([tpRes, bpRes, trRes, dwRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime API.'

  loading.value = false
}

onMounted(load)

// ── Port name lookup (by-port aggregate has names; raw records only have unlocode) ─
const portNames = computed(() => {
  const m = new Map<string, string>()
  byPort.value.forEach(p => m.set(p.port__unlocode, p.port__name))
  return m
})
function portName(unlocode: string) { return portNames.value.get(unlocode) ?? unlocode }

// ── KPI totals, from the sampled raw records ───────────────────────────
const totalTeu = computed(() => rawThroughput.value.length ? rawThroughput.value.reduce((s, r) => s + r.teu_count, 0) : null)
const importTeu = computed(() => rawThroughput.value.length ? rawThroughput.value.filter(r => r.direction === 'import').reduce((s, r) => s + r.teu_count, 0) : null)
const exportTeu = computed(() => rawThroughput.value.length ? rawThroughput.value.filter(r => r.direction === 'export').reduce((s, r) => s + r.teu_count, 0) : null)
const transitTeu = computed(() => rawThroughput.value.length ? rawThroughput.value.filter(r => r.direction === 'transit').reduce((s, r) => s + r.teu_count, 0) : null)
const importSharePct = computed(() => totalTeu.value && importTeu.value != null ? (importTeu.value / totalTeu.value) * 100 : null)
const exportSharePct = computed(() => totalTeu.value && exportTeu.value != null ? (exportTeu.value / totalTeu.value) * 100 : null)

// ── Loaded/Unloaded breakdown by port ───────────────────────────────────
const portDirectionRows = computed(() => {
  const m = new Map<string, { port: string; portName: string; direction: ContainerDirection; teu: number; boxes: number; tons: number }>()
  for (const r of rawThroughput.value) {
    const key = `${r.port_unlocode}-${r.direction}`
    const ex = m.get(key)
    if (ex) { ex.teu += r.teu_count; ex.boxes += r.boxes_count; ex.tons += r.weight_tons }
    else m.set(key, { port: r.port_unlocode, portName: portName(r.port_unlocode), direction: r.direction, teu: r.teu_count, boxes: r.boxes_count, tons: r.weight_tons })
  }
  return [...m.values()].sort((a, b) => b.teu - a.teu)
})
const maxPortDirTeu = computed(() => Math.max(1, ...portDirectionRows.value.map(r => r.teu)))

const totalThroughputSeries = computed(() => {
  const dates = [...new Set(trend.value.map(t => t.report_date))].sort()
  if (dates.length < 2) return undefined
  return dates.map(d => trend.value.filter(t => t.report_date === d).reduce((s, t) => s + t.teus, 0))
})

// ── Trend series, one line per direction ───────────────────────────────
// import/export/transit are validated as a categorical trio (dataviz skill's
// validate_palette.js: CVD ΔE >= 8 adjacent, normal-vision >= 15, both light
// and dark against this app's surfaces) - the previous amber/green pair sat
// at CVD ΔE 5.7, a real fail under protanopia. "empty" is a null/residual
// state rather than a true trade-flow category, so it stays a de-emphasized
// neutral instead of taking a fourth competing hue.
const theme = useTheme()
const DIRECTION_COLORS: Record<ContainerDirection, { light: string; dark: string }> = {
  import:  { light: '#2a78d6', dark: '#3987e5' },
  export:  { light: '#1baf7a', dark: '#199e70' },
  transit: { light: '#eda100', dark: '#c98500' },
  empty:   { light: '#5B6773', dark: '#8B9AAD' },
}
function directionColor(dir: ContainerDirection) {
  const pair = DIRECTION_COLORS[dir]
  return theme.resolved.value === 'dark' ? pair.dark : pair.light
}
const trendSeries = computed(() => {
  const dates = [...new Set(trend.value.map(t => t.report_date))].sort()
  const directions: ContainerDirection[] = ['import', 'export', 'transit', 'empty']
  return directions
    .map(dir => ({
      name: directionLabel(dir),
      color: directionColor(dir),
      points: dates.map(d => ({
        label: fmtDateShort(d),
        value: trend.value.find(t => t.report_date === d && t.direction === dir)?.teus ?? 0,
      })),
    }))
    .filter(s => s.points.some(p => p.value > 0))
})

// ── Yard dwell, latest snapshot per port + direction ────────────────────
const dwellRows = computed(() => {
  const m = new Map<string, YardDwellRecord>()
  for (const d of dwell.value) {
    const key = `${d.port_unlocode}-${d.direction}`
    const ex = m.get(key)
    if (!ex || d.report_date > ex.report_date) m.set(key, d)
  }
  return [...m.values()].sort((a, b) => a.port_unlocode.localeCompare(b.port_unlocode) || a.direction.localeCompare(b.direction))
})

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: dwellRowsPageRows, page: dwellRowsPage, totalPages: dwellRowsTotalPages,
  total: dwellRowsTotal, next: dwellRowsNext, prev: dwellRowsPrev,
} = usePagination(dwellRows, 15)

const avgImportDwell = computed(() => weightedAvgDwell('import'))
const avgExportDwell = computed(() => weightedAvgDwell('export'))
function weightedAvgDwell(direction: 'import' | 'export'): number | null {
  const rows = dwellRows.value.filter(d => d.direction === direction)
  const totalContainers = rows.reduce((s, r) => s + r.container_count, 0)
  if (!totalContainers) return null
  return rows.reduce((s, r) => s + r.avg_dwell_days * r.container_count, 0) / totalContainers
}

// ── Port-Rail reconciliation, same rail-nominated logic as railway/freight.vue ─
const portRailManifests = computed(() => railManifests.value.filter(m => m.customs_clearance_ref || m.port_origin))
const {
  pageRows: portRailManifestsPageRows, page: portRailManifestsPage, totalPages: portRailManifestsTotalPages,
  total: portRailManifestsTotal, next: portRailManifestsNext, prev: portRailManifestsPrev,
} = usePagination(portRailManifests, 15)

// ── Helpers ─────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}
function fmtDateShort(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }) }
  catch { return s }
}
function directionLabel(d: ContainerDirection): string {
  const m: Record<ContainerDirection, string> = { import: 'Unloaded (Import)', export: 'Loaded (Export)', transit: 'Transhipment', empty: 'Empty' }
  return m[d] ?? d
}
function directionBadge(d: ContainerDirection) {
  const m: Record<ContainerDirection, string> = { import: 'info', export: 'success', transit: 'warning', empty: 'neutral' }
  return m[d] ?? 'neutral'
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.table-scroll { overflow-x:auto; }
.cong-list { display:flex; flex-direction:column; gap:9px; }
.cong-row { display:grid; grid-template-columns:220px 1fr 190px; align-items:center; gap:8px; }
.cong-label { font-size:12px; display:flex; align-items:center; gap:6px; }
.cong-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.cong-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
.cong-val { font-size:11px; text-align:right; color:var(--fg-2); }
.recon-note { font-size:12px; color:var(--info-fg); background:var(--info-bg); border:1px solid var(--info-fg); border-radius:7px; padding:9px 13px; margin-bottom:12px; line-height:1.5; }
</style>
