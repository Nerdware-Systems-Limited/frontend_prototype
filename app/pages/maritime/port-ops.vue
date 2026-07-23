<template>
  <PageHeader
    eyebrow="Maritime - Port Operations"
    title="Port Operations"
    subtitle="KPA · KMA · KenTrade · NCTTCA - Berth occupancy, container throughput, KenTrade clearance data, NCTTCA corridor dwell analysis, and 60-day trends"
  >
    <template #actions>
      
      <select v-model="portFilter" class="select-sm" @change="load">
        <option value="">All ports</option>
        <option v-for="p in opsData?.ports ?? []" :key="p.port_unlocode" :value="p.port_unlocode">
          {{ p.port_name }}
        </option>
      </select>
      <NuxtLink to="/maritime/cargo" class="btn">Cargo →</NuxtLink>
      <NuxtLink to="/maritime/performance" class="btn">Performance & Ranking →</NuxtLink>
      <!-- <button class="btn" :disabled="loading" @click="load">↻ Refresh</button> -->
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Active Ports"
      :value="opsData ? fmtNum(opsData.kpis.active_ports) : '-'"
      sub="KPA operational"
      source="live" source-title="KPA"
    />
    <KpiCard
      label="Live Vessels"
      :value="opsData ? fmtNum(opsData.kpis.live_vessels) : '-'"
      sub="Currently in port"
      source="live" source-title="KMA AIS"
    />
    <KpiCard
      label="Avg Yard Dwell"
      :value="avgDwell ? `${avgDwell.toFixed(1)} days` : '-'"
      sub="Network-wide average"
      :trend-direction="avgDwell && avgDwell <= 5 ? 'up' : 'down'"
      source="batch" source-title="KPA"
    />
    <KpiCard
      label="Total TEU (30d)"
      :value="fmtNum(totalTEU)"
      sub="All ports"
      trend-direction="up"
      source="batch" source-title="KPA"
    />
    <KpiCard
      label="Berths (Total)"
      :value="fmtNum(berths.length)"
      sub="Across all ports"
      source="batch" source-title="KPA"
    />
    <KpiCard
      label="Active Berths"
      :value="fmtNum(berths.filter(b => b.active).length)"
      :sub="`${berths.length > 0 ? ((berths.filter(b => b.active).length / berths.length) * 100).toFixed(0) : 0}% operational`"
      source="batch" source-title="KPA"
    />
  </div>

  <!-- Per-port performance cards -->
  <SectionTitle pill="KPA · 30d">Port Performance Dashboard</SectionTitle>

  <div class="port-grid">
    <div v-for="p in (opsData?.ports ?? [])" :key="p.port_unlocode" class="port-perf-card">
      <div class="ppc-header">
        <div>
          <div style="font-size:15px;font-weight:800">{{ p.port_name }}</div>
          <div style="font-size:12px;color:#64748b">{{ p.port_unlocode }} · {{ p.port_type }}</div>
        </div>
        <div class="ppc-vessels">{{ p.currently_in_port }}<span style="font-size:11px;color:#94a3b8"> vessels</span></div>
      </div>
      <div class="ppc-kpis">
        <div class="ppc-kpi">
          <div class="ppc-val">{{ fmtNum(p.arrivals_30d) }}</div>
          <div class="ppc-label">Arrivals (30d)</div>
        </div>
        <div class="ppc-kpi">
          <div class="ppc-val">{{ fmtNum(p.departures_30d) }}</div>
          <div class="ppc-label">Departures (30d)</div>
        </div>
        <div class="ppc-kpi">
          <div class="ppc-val" style="color:#3b82f6">{{ fmtNum(p.teu_throughput_30d) }}</div>
          <div class="ppc-label">TEU (30d)</div>
        </div>
        <div class="ppc-kpi">
          <div class="ppc-val" :style="{ color: p.avg_yard_dwell_days > 7 ? '#ef4444' : p.avg_yard_dwell_days > 4 ? '#f59e0b' : '#22c55e' }">
            {{ p.avg_yard_dwell_days.toFixed(1) }}d
          </div>
          <div class="ppc-label">Avg Dwell</div>
        </div>
      </div>
      <div class="dwell-indicator">
        <span style="font-size:11px;color:#64748b">Dwell vs 5-day target</span>
        <div class="di-bar-wrap">
          <div class="di-bar"
            :style="{
              width: `${Math.min(100, (p.avg_yard_dwell_days / 5) * 100)}%`,
              background: p.avg_yard_dwell_days > 7 ? '#ef4444' : p.avg_yard_dwell_days > 4 ? '#f59e0b' : '#22c55e'
            }"
          />
        </div>
      </div>
    </div>
    <div v-if="!opsData?.ports.length" class="card" style="padding:16px;color:#94a3b8">
      {{ loading ? 'Loading port data…' : 'No port performance data.' }}
    </div>
  </div>

  <!-- Container 60-day trend -->
  <SectionTitle pill="KPA · 60d trend">Container Throughput Trend</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="containerTrend.length" class="trend-chart">
        <div v-for="(t, i) in containerTrend" :key="i" class="tc-col">
          <div class="tc-tip" v-if="i % 5 === 0">{{ fmtNum(t.teus ?? t.count ?? 0) }}</div>
          <div v-else class="tc-tip" />
          <div
            class="tc-bar"
            :style="{
              height: `${maxTrendTEU > 0 ? ((t.teus ?? t.count ?? 0) / maxTrendTEU) * 100 : 0}%`,
              background: '#3b82f6',
            }"
            :title="`${t.date ?? t.period}: ${fmtNum(t.teus ?? t.count ?? 0)} TEU`"
          />
          <div class="tc-label" v-if="i % 10 === 0">{{ fmtDay(t.date ?? t.period) }}</div>
          <div class="tc-label" v-else />
        </div>
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading trend…' : 'No container trend data.' }}</div>
    </div>
  </div>

  <!-- Berth occupancy table -->
  <SectionTitle pill="KPA · Berth Registry">Port &amp; Berth Map</SectionTitle>
  <div class="card map-card">
    <div class="card-header">Ports with Berth Counts</div>
    <ClientOnly>
      <UaptsMap
        :markers="portMarkers"
        :center="[-3.0, 39.9]"
        :zoom="6"
        height="380px"
      />
    </ClientOnly>
  </div>

  <SectionTitle pill="KPA · Berth Registry">Berth Directory & Status</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="berthTypeFilter" class="select-sm">
          <option value="">All berth types</option>
          <option value="container">Container</option>
          <option value="bulk">Bulk</option>
          <option value="tanker">Tanker</option>
          <option value="general_cargo">General Cargo</option>
          <option value="ro_ro">Ro-Ro</option>
          <option value="cruise">Cruise</option>
        </select>
        <button class="btn" @click="berthTypeFilter=''">Clear</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Berth Code</th>
            <th>Name</th>
            <th>Type</th>
            <th>Port</th>
            <th>Length (m)</th>
            <th>Max Draft (m)</th>
            <th>Max LOA (m)</th>
            <th>Cranes</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody v-if="filteredBerths.length">
          <tr v-for="b in filteredBerths" :key="b.id">
            <td style="font-family:monospace;font-weight:700">{{ b.berth_code }}</td>
            <td style="font-size:13px">{{ b.name }}</td>
            <td><BadgePill variant="info">{{ b.berth_type.replace(/_/g,' ') }}</BadgePill></td>
            <td style="font-family:monospace;font-size:12px">{{ b.port_unlocode }}</td>
            <td>{{ b.length_m }}</td>
            <td>{{ b.max_draft_m }}</td>
            <td>{{ b.max_vessel_loa }}</td>
            <td style="font-weight:600">{{ b.crane_count }}</td>
            <td><BadgePill :variant="b.active ? 'success' : 'danger'">{{ b.active ? 'Operational' : 'Inactive' }}</BadgePill></td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading berths…' : 'No berths match filters.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Yard dwell breakdown -->
  <SectionTitle pill="KPA · Dwell Analysis">Yard Dwell by Direction</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Port</th>
            <th>Direction</th>
            <th>Container Count</th>
            <th>Avg Dwell (days)</th>
            <th>Max Dwell (days)</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody v-if="yardDwell.length">
          <tr v-for="d in yardDwell.slice(0, 30)" :key="d.id ?? `${d.port}${d.direction}`">
            <td style="font-size:12px;font-weight:600">{{ d.port_name ?? d.port }}</td>
            <td><BadgePill :variant="dirBadge(d.direction)">{{ d.direction }}</BadgePill></td>
            <td>{{ fmtNum(d.container_count) }}</td>
            <td :style="{ color: d.avg_dwell_days > 7 ? '#ef4444' : d.avg_dwell_days > 4 ? '#f59e0b' : '#22c55e', fontWeight:'600' }">
              {{ d.avg_dwell_days?.toFixed(1) }}
            </td>
            <td>{{ d.max_dwell_days?.toFixed(1) ?? '-' }}</td>
            <td style="font-size:12px">{{ d.date ? fmtDate(d.date) : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No dwell data.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Port Operations')

import { useAviationMaritime } from '~/composables/api'
import type { MaritimeOps, Berth } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }
// Kenya's two KPA-operated ports - same fixed lookup used on the maritime overview map.
const PORT_COORDS: Record<string, [number, number]> = { KEMBA: [-4.05, 39.68], KELAU: [-2.27, 40.92] }

const opsData        = ref<MaritimeOps | null>(null)
const berths         = ref<Berth[]>([])
const containerTrend = ref<any[]>([])
const yardDwell      = ref<any[]>([])
const loading        = ref(true)
const error          = ref<string | null>(null)
const lastRefreshed  = ref('-')
const portFilter     = ref('')
const berthTypeFilter = ref('')

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()

  const [opRes, beRes, trendRes, dwellRes] = await Promise.allSettled([
    avm.maritimeOperations(30),
    avm.berths({ port: portFilter.value || undefined, page_size: 50 }),
    avm.containerTrend(60),
    avm.yardDwell({ port: portFilter.value || undefined, page_size: 60 }),
  ])

  if (opRes.status    === 'fulfilled') opsData.value        = opRes.value
  if (beRes.status    === 'fulfilled') berths.value         = (beRes.value as any).results ?? []
  if (trendRes.status === 'fulfilled') containerTrend.value = (trendRes.value as any).results ?? []
  if (dwellRes.status === 'fulfilled') yardDwell.value      = (dwellRes.value as any).results ?? []

  if ([opRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const totalTEU = computed(() => (opsData.value?.ports ?? []).reduce((s, p) => s + p.teu_throughput_30d, 0))
const avgDwell = computed(() => {
  const ports = opsData.value?.ports ?? []
  if (!ports.length) return null
  return ports.reduce((s, p) => s + p.avg_yard_dwell_days, 0) / ports.length
})
const maxTrendTEU    = computed(() => Math.max(1, ...containerTrend.value.map(t => t.teus ?? t.count ?? 0)))
const filteredBerths = computed(() =>
  berths.value.filter(b => !berthTypeFilter.value || b.berth_type === berthTypeFilter.value),
)

const portMarkers = computed((): MarkerSpec[] =>
  (opsData.value?.ports ?? []).map((p, i) => {
    const coords = PORT_COORDS[p.port_unlocode] ?? [-4.0 + i * 0.5, 39.7 + i * 0.3]
    const portBerths = berths.value.filter(b => b.port_unlocode === p.port_unlocode)
    return {
      id: `port-${p.port_unlocode}`,
      lat: coords[0], lon: coords[1],
      title: p.port_name,
      subtitle: `${portBerths.filter(b => b.active).length}/${portBerths.length} berths active · ${p.currently_in_port} vessels in port`,
      color: 'blue',
      size: 'lg',
    }
  }),
)

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short' }) }
  catch { return s }
}
function fmtDay(s: string | undefined) {
  if (!s) return ''
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short' }) }
  catch { return s.slice(5) }
}
function dirBadge(d: string) {
  const m: Record<string,string> = { import:'info', export:'success', transit:'fair', empty:'neutral' }
  return m[d] ?? 'neutral'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.map-card { overflow:hidden; margin-bottom:16px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; margin-bottom:16px; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.port-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; margin-bottom:16px; }
.port-perf-card { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.ppc-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
.ppc-vessels { font-size:22px; font-weight:800; color:#1e293b; text-align:right; }
.ppc-kpis { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px; margin-bottom:10px; }
.ppc-kpi { text-align:center; }
.ppc-val { font-size:14px; font-weight:700; }
.ppc-label { font-size:10px; color:#94a3b8; margin-top:1px; }
.dwell-indicator { }
.di-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-top:3px; }
.di-bar { height:100%; border-radius:4px; transition:width .5s; }
.trend-chart { display:flex; align-items:flex-end; gap:2px; height:120px; overflow-x:auto; }
.tc-col { display:flex; flex-direction:column; align-items:center; min-width:10px; flex:1; }
.tc-tip { font-size:7px; color:#64748b; height:12px; }
.tc-bar { width:80%; border-radius:2px 2px 0 0; min-height:2px; }
.tc-label { font-size:7px; color:#94a3b8; margin-top:2px; white-space:nowrap; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
</style>
