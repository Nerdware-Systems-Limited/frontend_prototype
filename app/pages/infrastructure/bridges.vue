<template>
  <PageHeader
    eyebrow="Infrastructure - Bridges"
    title="Bridge Asset Registry"
    subtitle="KeNHA · KRB · LAPSSET - Bridge inventory, condition scores, KRB-funded inspection schedules, critical structure alerts, and spatial mapping"
  >
    <!-- <template #actions>
      
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template> -->
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Bridges"
      :value="fmtNum(bridges.length)"
      sub="In national registry"
      source="batch" source-title="KeNHA BMS"
    />
    <KpiCard
      label="Good Condition"
      :value="fmtNum(countByClass('good'))"
      sub="Condition score ≥ 80"
      trend-direction="up"
      source="batch" source-title="KeNHA BMS"
    />
    <KpiCard
      label="Fair Condition"
      :value="fmtNum(countByClass('fair'))"
      sub="Score 60–79, monitor closely"
      source="batch" source-title="KeNHA BMS"
    />
    <KpiCard
      label="Poor / Critical"
      :value="fmtNum(countByClass('poor') + countByClass('critical'))"
      sub="Urgent inspection required"
      trend-direction="down"
      source="batch" source-title="KeNHA BMS"
    />
    <KpiCard
      label="Avg Condition Score"
      :value="avgScore ? avgScore.toFixed(1) : '-'"
      sub="Out of 100"
      :trend-direction="avgScore && avgScore >= 70 ? 'up' : 'down'"
      source="batch" source-title="KeNHA BMS"
    />
    <KpiCard
      label="Overdue Inspections"
      :value="fmtNum(overdueCount)"
      sub="Next inspection date passed"
      trend-direction="down"
      source="batch" source-title="KeNHA BMS"
    />
  </div>

  <!-- Critical alerts -->
  <SectionTitle pill="KeNHA BMS · Priority">Critical Bridges - Immediate Action Required</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div v-if="critical.length">
        <AlertItem
          v-for="b in critical"
          :key="b.id"
          :severity="b.condition_class === 'critical' ? 'critical' : 'warning'"
          :title="`${b.bridge_name} (${b.bridge_code})`"
          :meta="`${b.bridge_type} · Span: ${b.span_length_m != null ? `${b.span_length_m}m` : '-'} · Load: ${b.load_capacity_tonnes != null ? `${b.load_capacity_tonnes}t` : '-'} · Score: ${b.condition_score != null ? b.condition_score.toFixed(1) : '-'} · Last inspection: ${fmtDate(b.last_inspection_at)}`"
        />
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">
        {{ loading ? 'Loading critical bridges…' : 'No bridges in critical condition.' }}
      </div>
    </div>
  </div>

  <!-- Map + condition distribution -->
  <div class="two-col-map">
    <div class="card map-card">
      <div class="card-header">Bridge Locations</div>
      <ClientOnly>
        <UaptsMap
          :markers="bridgeMarkers"
          :roads="roadsGeo"
          :center="[-1.0, 37.5]"
          :zoom="6"
          height="460px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#22c55e" /> Good</span>
        <span class="mk"><span class="dot" style="background:#84cc16" /> Fair</span>
        <span class="mk"><span class="dot" style="background:#f59e0b" /> Poor</span>
        <span class="mk"><span class="dot" style="background:#ef4444" /> Critical</span>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Condition by Bridge Type</div>
      <div class="card-body">
        <div v-if="byType.length" class="type-list">
          <div v-for="t in byType" :key="t.type" class="type-item">
            <div class="ti-header">
              <span class="ti-label">{{ t.type.replace(/_/g,' ') }}</span>
              <span class="ti-count">{{ t.count }}</span>
            </div>
            <div class="ti-bar-wrap">
              <div class="ti-bar" :style="{ width: `${maxTypeCount > 0 ? (t.count / maxTypeCount) * 100 : 0}%` }" />
            </div>
            <div class="ti-avg">Avg score: {{ t.avg_score != null ? t.avg_score.toFixed(1) : '-' }}</div>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No type data' }}</div>
      </div>
    </div>
  </div>

  <!-- Bridge table with filters -->
  <SectionTitle>Bridge Inventory</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="condFilter" class="select-sm">
          <option value="">All conditions</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
          <option value="critical">Critical</option>
          <option value="failed">Failed</option>
        </select>
        <select v-model="typeFilter" class="select-sm">
          <option value="">All types</option>
          <option value="beam">Beam</option>
          <option value="arch">Arch</option>
          <option value="suspension">Suspension</option>
          <option value="cable_stayed">Cable Stayed</option>
          <option value="truss">Truss</option>
          <option value="culvert">Culvert</option>
        </select>
        <input v-model="nameSearch" class="select-sm" placeholder="Search bridge name…" style="min-width:180px" />
        <button class="btn" @click="condFilter=''; typeFilter=''; nameSearch=''">Clear</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Bridge Name</th>
            <th>Code</th>
            <th>Type</th>
            <th>Span (m)</th>
            <th>Load Limit (t)</th>
            <th>Condition Score</th>
            <th>Condition</th>
            <th>Year Built</th>
            <th>Last Inspection</th>
            <th>Next Inspection</th>
          </tr>
        </thead>
        <tbody v-if="filteredBridges.length">
          <tr v-for="b in filteredBridges" :key="b.id">
            <td style="font-weight:600">{{ b.bridge_name }}</td>
            <td style="font-family:monospace;font-size:12px">{{ b.bridge_code }}</td>
            <td><BadgePill variant="info">{{ b.bridge_type.replace(/_/g,' ') }}</BadgePill></td>
            <td>{{ b.span_length_m != null ? `${b.span_length_m}m` : '-' }}</td>
            <td>{{ b.load_capacity_tonnes != null ? `${b.load_capacity_tonnes}t` : '-' }}</td>
            <td>
              <div class="score-bar-wrap">
                <div
                  class="score-bar"
                  :style="{ width: `${b.condition_score ?? 0}%`, background: scoreColor(b.condition_score) }"
                />
              </div>
              <span style="font-size:11px">{{ b.condition_score != null ? b.condition_score.toFixed(1) : '-' }}</span>
            </td>
            <td><BadgePill :variant="condBadge(b.condition_class)">{{ b.condition_class }}</BadgePill></td>
            <td style="font-size:12px">{{ b.year_built ?? '-' }}</td>
            <td style="font-size:12px;white-space:nowrap">{{ fmtDate(b.last_inspection_at) }}</td>
            <td style="font-size:12px;white-space:nowrap">
              <span :style="{ color: isOverdue(b.next_inspection_at) ? '#ef4444' : 'inherit' }">
                {{ fmtDate(b.next_inspection_at) }}
              </span>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="10" style="text-align:center;color:#94a3b8;padding:16px">
              {{ loading ? 'Loading bridges…' : 'No bridges match current filters.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Bridges')

import { useInfrastructure, useGis } from '~/composables/api'
import type { Bridge } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

const bridges  = ref<Bridge[]>([])
const critical = ref<Bridge[]>([])
const roadsGeo = ref<GeoJSONFeatureCollection | null>(null)
const loading  = ref(true)
const error    = ref<string | null>(null)
const lastRefreshed = ref('-')
const condFilter = ref('')
const typeFilter = ref('')
const nameSearch = ref('')

async function load() {
  loading.value = true
  error.value = null
  const infra = useInfrastructure()
  const gis   = useGis()

  const [allRes, critRes, roadsRes] = await Promise.allSettled([
    infra.bridges({ page_size: 200 }),
    infra.criticalBridges(),
    gis.roads({ limit: 300, simplify: 0.03 }),
  ])

  if (allRes.status  === 'fulfilled') bridges.value  = (allRes.value as any).results ?? []
  if (critRes.status === 'fulfilled') critical.value = (critRes.value as any).results ?? []
  if (roadsRes.status === 'fulfilled') roadsGeo.value = roadsRes.value

  if ([allRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Infrastructure API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const filteredBridges = computed(() =>
  bridges.value.filter(b => {
    if (condFilter.value && b.condition_class !== condFilter.value)               return false
    if (typeFilter.value && b.bridge_type     !== typeFilter.value)               return false
    if (nameSearch.value && !b.bridge_name.toLowerCase().includes(nameSearch.value.toLowerCase())) return false
    return true
  }),
)

function countByClass(cls: string) { return bridges.value.filter(b => b.condition_class === cls).length }

const avgScore = computed(() => {
  const scored = bridges.value.filter(b => b.condition_score != null)
  if (!scored.length) return null
  return scored.reduce((s, b) => s + b.condition_score!, 0) / scored.length
})

const overdueCount = computed(() => bridges.value.filter(b => isOverdue(b.next_inspection_at)).length)

const bridgeMarkers = computed((): MarkerSpec[] =>
  bridges.value
    .filter(b => b.latitude != null && b.longitude != null)
    .map(b => ({
      id: `br-${b.id}`,
      lat: b.latitude!,
      lon: b.longitude!,
      title: b.bridge_name,
      subtitle: `${b.bridge_type} · Score: ${b.condition_score?.toFixed(1) ?? '-'} · ${b.condition_class}`,
      color: b.condition_class === 'good' ? 'green'
           : b.condition_class === 'fair' ? 'yellow'
           : b.condition_class === 'poor' ? 'orange'
           : 'red',
      size: b.condition_class === 'critical' ? 'lg' : 'md',
    })),
)

const byType = computed(() => {
  const map = new Map<string, { type: string; count: number; total_score: number; avg_score: number | null }>()
  bridges.value.forEach(b => {
    const ex = map.get(b.bridge_type)
    if (ex) { ex.count++; if (b.condition_score != null) ex.total_score += b.condition_score }
    else map.set(b.bridge_type, { type: b.bridge_type, count: 1, total_score: b.condition_score ?? 0, avg_score: null })
  })
  const arr = Array.from(map.values())
  arr.forEach(t => { t.avg_score = t.count > 0 ? t.total_score / t.count : null })
  return arr.sort((a, b) => b.count - a.count)
})

const maxTypeCount = computed(() => Math.max(1, ...byType.value.map(t => t.count)))

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function isOverdue(s: string | null | undefined) {
  if (!s) return false
  return new Date(s).getTime() < Date.now()
}
function scoreColor(score: number | null | undefined) {
  if (score == null) return '#94a3b8'
  return score >= 80 ? '#22c55e' : score >= 60 ? '#84cc16' : score >= 40 ? '#f59e0b' : '#ef4444'
}
function condBadge(cls: string) {
  const m: Record<string,string> = { good:'success', fair:'fair', poor:'warning', critical:'danger', failed:'danger' }
  return m[cls] ?? 'neutral'
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col-map { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid #f1f5f9; }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.type-list { display:flex; flex-direction:column; gap:10px; }
.type-item { }
.ti-header { display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px; }
.ti-label { font-weight:600; text-transform:capitalize; }
.ti-count { color:#64748b; }
.ti-bar-wrap { background:#f1f5f9; border-radius:4px; height:8px; overflow:hidden; margin-bottom:3px; }
.ti-bar { height:100%; background:#3b82f6; border-radius:4px; }
.ti-avg { font-size:11px; color:#94a3b8; }
.score-bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.score-bar { height:100%; border-radius:4px; transition:width .4s; }
</style>
