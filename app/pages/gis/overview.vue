<template>
  <PageHeader
    eyebrow="GIS & Spatial Analysis"
    title="Layer Overview"
    subtitle="One card per expected spatial layer - size, completeness and how it breaks down - for every layer an agency has uploaded"
  >
    <template #actions>
      <NuxtLink to="/gis/coverage" class="btn">Coverage tracker →</NuxtLink>
      <NuxtLink to="/gis/layers" class="btn">All layers →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <div class="ih-ribbon">
    <KpiTile label="Layers loaded" :value="readyCount" :state="kpi" :sub="`of ${reqs.length} expected`" />
    <KpiTile label="Features" :value="fmtInt(totalFeatures)" :state="kpi" sub="across loaded layers" />
    <KpiTile label="Line network" :value="fmtMeasure(totalKm, 'km')" :state="summariesLoading ? 'loading' : kpi" sub="sum of line layers (layers overlap)" />
    <KpiTile label="Data quality" :value="fmtGisPct(avgFilled)" :state="summariesLoading ? 'loading' : kpi" sub="avg attribute completeness" />
  </div>

  <FilterBar>
    <input v-model="q" class="select-sm" type="search" placeholder="Search layer or agency…" aria-label="Search" />
    <select v-model="agency" class="select-sm" aria-label="Agency">
      <option value="">All agencies</option>
      <option v-for="a in agencyCodes" :key="a" :value="a">{{ a }}</option>
    </select>
    <select v-model="geom" class="select-sm" aria-label="Geometry">
      <option value="">All geometries</option>
      <option v-for="g in ['Point', 'LineString', 'Polygon']" :key="g" :value="g">{{ GEOM_LABEL[g] }}</option>
    </select>
    <select v-model="show" class="select-sm" aria-label="Show">
      <option value="all">All layers</option>
      <option value="loaded">Loaded only</option>
      <option value="gaps">Not loaded</option>
    </select>
    <span class="hint">{{ filtered.length }} layer(s)</span>
  </FilterBar>

  <EmptyState v-if="!loading && !filtered.length" icon="search" message="No layers match these filters." />
  <div class="ov-grid">
    <article v-for="r in filtered" :key="r.id" class="card ov-card" :class="{ 'ov-card--idle': r.layer?.status !== 'ready' }">
      <header class="ov-head">
        <div>
          <div class="ov-agency">{{ r.agency_code }} · {{ GEOM_LABEL[r.geom_type] || r.geom_type }}</div>
          <h3 class="ov-title">{{ r.name }}</h3>
        </div>
        <BadgePill :variant="REQ_BADGE[r.status]">{{ r.status }}</BadgePill>
      </header>

      <template v-if="r.layer?.status === 'ready'">
        <div class="ov-stats">
          <div><span class="ov-label">Features</span><span class="ov-val">{{ fmtInt(r.layer.feature_count) }}</span></div>
          <div><span class="ov-label">{{ unitLabel(r) }}</span>
            <span class="ov-val">{{ sums[r.layer.id] ? fmtMeasure(sums[r.layer.id].totals.measure, sums[r.layer.id].totals.unit) : summaryFailed[r.layer.id] ? '-' : '…' }}</span></div>
          <div><span class="ov-label">Complete</span>
            <span class="ov-val">{{ sums[r.layer.id] ? fmtGisPct(avgOf(sums[r.layer.id])) : '…' }}</span></div>
        </div>

        <div v-if="sums[r.layer.id] && topBreakdown(sums[r.layer.id])" class="ov-bars">
          <div class="ov-bars-title">By {{ topBreakdown(sums[r.layer.id])!.field }}</div>
          <div v-for="v in topBreakdown(sums[r.layer.id])!.values.slice(0, 5)" :key="String(v.value)" class="ov-bar">
            <span class="ov-bar-label">{{ v.value ?? '(blank)' }}</span>
            <span class="ov-bar-track"><span class="ov-bar-fill" :style="{ width: share(v.count, sums[r.layer.id].totals.features) + '%' }" /></span>
            <span class="ov-bar-n">{{ fmtInt(v.count) }}</span>
          </div>
        </div>
        <p v-else-if="summaryFailed[r.layer.id]" class="hint">Analysis unavailable for this layer.</p>

        <footer class="ov-foot">
          <span class="hint">v{{ r.layer.version }} · {{ fmtDate(r.layer.updated_at) }}
            <template v-if="r.layer.error_count"> · {{ fmtInt(r.layer.error_count) }} skipped</template>
            <template v-if="r.layer.filtered_count"> · {{ fmtInt(r.layer.filtered_count) }} filtered</template></span>
          <NuxtLink class="btn btn-sm btn-primary" :to="`/gis/layers/${r.layer.id}`">Analysis →</NuxtLink>
        </footer>
      </template>

      <template v-else>
        <p class="ov-idle">
          <template v-if="r.layer?.status === 'processing'"><span class="spinner" aria-hidden="true" /> Loading - check back shortly.</template>
          <template v-else-if="r.layer?.status === 'failed'">The last upload failed: {{ r.layer.fatal_error || 'see details' }}</template>
          <template v-else-if="r.open_requests.length">Requested from {{ r.open_requests.map(o => o.assignee_name).join(', ') }}.</template>
          <template v-else>No data yet.</template>
        </p>
        <footer class="ov-foot">
          <span class="hint">{{ r.required_fields.length ? `needs ${r.required_fields.join(', ')}` : 'no required attributes' }}</span>
          <NuxtLink class="btn btn-sm" to="/integrations?tab=gis">{{ r.layer?.status === 'failed' ? 'Fix & retry' : 'Upload' }}</NuxtLink>
        </footer>
      </template>
    </article>
  </div>
</template>

<script setup lang="ts">
import { useGisLayers, type GeoLayerRequirement, type LayerSummary } from '~/composables/api/useGisLayers'
import { fmtDate, fmtInt, fmtMeasure, fmtGisPct, GEOM_LABEL, REQ_BADGE, share } from '~/utils/gisFormat'

definePageMeta({ layout: 'default' })
useHead({ title: 'GIS Layer Overview' })

const gis = useGisLayers()
const reqs = ref<GeoLayerRequirement[]>([])
const sums = reactive<Record<string, LayerSummary>>({})
const summaryFailed = reactive<Record<string, boolean>>({})
const loading = ref(true)
const summariesLoading = ref(false)
const error = ref<string | null>(null)
const kpi = computed(() => (loading.value ? 'loading' : error.value ? 'unavailable' : 'ok') as 'loading' | 'ok' | 'unavailable')

const q = ref(''); const agency = ref(''); const geom = ref(''); const show = ref<'all' | 'loaded' | 'gaps'>('all')
const agencyCodes = computed(() => [...new Set(reqs.value.map(r => r.agency_code))].sort())
const filtered = computed(() => {
  const n = q.value.trim().toLowerCase()
  return reqs.value.filter(r =>
    (!n || r.name.toLowerCase().includes(n) || r.agency_code.toLowerCase().includes(n))
    && (!agency.value || r.agency_code === agency.value)
    && (!geom.value || r.geom_type === geom.value)
    && (show.value === 'all' || (show.value === 'loaded') === (r.layer?.status === 'ready')))
})

const ready = computed(() => reqs.value.filter(r => r.layer?.status === 'ready'))
const readyCount = computed(() => ready.value.length)
const totalFeatures = computed(() => ready.value.reduce((n, r) => n + (r.layer?.feature_count ?? 0), 0))
const totalKm = computed(() => Object.values(sums).filter(s => s.totals.unit === 'km').reduce((n, s) => n + s.totals.measure, 0))
const avgFilled = computed(() => {
  const all = Object.values(sums).map(avgOf).filter(v => v != null) as number[]
  return all.length ? all.reduce((a, b) => a + b, 0) / all.length : null
})

function avgOf(s: LayerSummary): number | null {
  return s.fields.length ? s.fields.reduce((n, f) => n + f.filled_pct, 0) / s.fields.length : null
}
const unitLabel = (r: GeoLayerRequirement) => (r.geom_type === 'LineString' ? 'Length' : r.geom_type === 'Polygon' ? 'Area' : 'Extent')
// The breakdown most worth a glance on a card: a classification-style column first, else the first one.
const PREFER = ['road_class', 'class', 'surface', 'surface_condition', 'type', 'status', 'county']
function topBreakdown(s: LayerSummary) {
  for (const p of PREFER) { const b = s.breakdowns.find(x => x.field.toLowerCase().includes(p)); if (b) return b }
  return s.breakdowns[0] ?? null
}

// Summaries are real PostGIS aggregates - fetch a few at a time, newest view first.
async function loadSummaries() {
  const queue = ready.value.map(r => r.layer!.id)
  summariesLoading.value = queue.length > 0
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try { sums[id] = await gis.layers.summary(id) } catch { summaryFailed[id] = true }
    }
  }
  await Promise.all([worker(), worker(), worker()])
  summariesLoading.value = false
}

onMounted(async () => {
  try {
    reqs.value = await gis.requirements.list()
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not load layers.'
  } finally { loading.value = false }
  loadSummaries()
})
</script>

<style scoped>
.ov-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; margin-top: 14px; }
.ov-card { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.ov-card--idle { background: var(--surface-quiet); }
.ov-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
.ov-agency { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--fg-3); }
.ov-title { margin: 2px 0 0; font-size: 14px; }
.ov-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.ov-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--fg-3); }
.ov-val { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 17px; font-weight: 700; }
.ov-bars-title { font-size: 11px; color: var(--fg-3); margin-bottom: 4px; }
.ov-bar { display: grid; grid-template-columns: 84px 1fr auto; gap: 8px; align-items: center; font-size: 12px; margin-top: 3px; }
.ov-bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-bar-track { height: 6px; background: var(--surface-sunken); border-radius: 3px; overflow: hidden; }
.ov-bar-fill { display: block; height: 100%; background: var(--primary); }
.ov-bar-n { font-family: var(--font-mono); font-size: 11px; color: var(--fg-2); }
.ov-idle { margin: 0; font-size: 13px; color: var(--fg-2); }
.ov-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: auto; }
</style>
