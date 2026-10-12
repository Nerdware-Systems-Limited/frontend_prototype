<template>
  <PageHeader
    eyebrow="GIS & Spatial Analysis"
    :title="layer?.name || 'Layer analysis'"
    :subtitle="layer ? `${layer.agency_code || 'Reference'} · ${GEOM_LABEL[layer.geom_type] || 'layer'} · v${layer.version} · updated ${fmtDate(layer.updated_at)}` : 'Loading…'"
  >
    <template #actions>
      <NuxtLink to="/gis/layers" class="btn">← All layers</NuxtLink>
      <NuxtLink v-if="canManage" to="/integrations?tab=gis" class="btn btn-primary">Reload / replace →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <template v-if="layer">
    <div class="ih-ribbon">
      <KpiTile label="Features" :value="fmtInt(sum?.totals.features ?? layer.feature_count)" :state="sumState" :sub="`${fmtInt(sum?.quality.rows_in_file)} rows in file`" />
      <KpiTile :label="measureLabel" :value="fmtMeasure(sum?.totals.measure, sum?.totals.unit)" :state="sumState" :sub="sum?.totals.unit ? 'computed on the ellipsoid' : 'points have no extent'" />
      <KpiTile label="Skipped" :value="fmtInt(layer.error_count)" :state="sumState" sub="failed validation" />
      <KpiTile label="Filtered out" :value="fmtInt(layer.filtered_count)" :state="sumState" :sub="describeFilter(layer.row_filter) || 'no row filter'" />
      <KpiTile label="Attribute completeness" :value="fmtPct(avgFilled)" :state="sumState" :sub="`${sum?.fields.length ?? 0} attributes`" />
    </div>

    <div class="card"><div class="card-body meta-grid">
      <div><span class="m-label">Status</span><BadgePill :variant="LAYER_BADGE[layer.status]">{{ layer.status }}</BadgePill></div>
      <div><span class="m-label">Classification</span>{{ layer.classification }}</div>
      <div><span class="m-label">Source CRS</span>{{ layer.source_crs || '-' }}</div>
      <div><span class="m-label">Extent (W,S → E,N)</span><span class="mono-sm">{{ fmtBbox(layer.bbox) }}</span></div>
      <div><span class="m-label">Source file</span>{{ layer.original_filename || '-' }}</div>
      <div><span class="m-label">Uploaded by</span>{{ layer.uploaded_by_name || '-' }}</div>
      <div v-if="Object.keys(layer.field_map || {}).length" class="m-wide"><span class="m-label">Column mapping</span>
        <code v-for="(c, f) in layer.field_map" :key="f" class="chip">{{ f }} ← {{ c }}</code></div>
    </div></div>

    <EmptyState v-if="sumError" icon="search" :message="sumError" />

    <!-- Breakdowns -->
    <template v-if="sum?.breakdowns.length">
      <SectionTitle pill="PostGIS aggregates">Breakdown</SectionTitle>
      <div class="card"><div class="card-body">
        <div class="bd-controls">
          <label class="hint">Group by
            <select v-model="bdField" class="select-sm">
              <option v-for="b in sum.breakdowns" :key="b.field" :value="b.field">{{ b.field }}</option>
            </select></label>
          <label v-if="sum.totals.unit" class="hint">Bar shows
            <select v-model="bdBasis" class="select-sm"><option value="count">feature count</option><option value="measure">{{ sum.totals.unit === 'km' ? 'length' : 'area' }}</option></select></label>
        </div>
        <table class="stack-table" v-if="bd">
          <thead><tr><th>{{ bd.field }}</th><th>Features</th><th v-if="sum.totals.unit">{{ sum.totals.unit === 'km' ? 'Length' : 'Area' }}</th><th style="width:34%">Share</th><th /></tr></thead>
          <tbody>
            <tr v-for="v in bd.values" :key="String(v.value)">
              <td data-label="Value">{{ v.value ?? '(blank)' }}</td>
              <td data-label="Features">{{ fmtInt(v.count) }}</td>
              <td v-if="sum.totals.unit" data-label="Measure">{{ fmtMeasure(v.measure, sum.totals.unit) }}</td>
              <td data-label="Share"><ProgressBar :pct="barPct(v)" :label="`Share of ${bd.field} = ${v.value}`" /></td>
              <td><button v-if="v.value !== null" class="linkish" @click="showFeatures(bd.field, v.value)">show features</button></td>
            </tr>
            <tr v-if="bd.other" class="hint">
              <td>Other values</td><td>{{ fmtInt(bd.other.count) }}</td>
              <td v-if="sum.totals.unit">{{ fmtMeasure(bd.other.measure, sum.totals.unit) }}</td><td /><td />
            </tr>
          </tbody>
        </table>
      </div></div>
    </template>

    <!-- Completeness -->
    <template v-if="sum?.fields.length">
      <SectionTitle pill="Data quality">Attributes</SectionTitle>
      <FilterBar>
        <input v-model="fieldQ" class="select-sm" type="search" placeholder="Filter attributes…" aria-label="Filter attributes" />
        <label class="hint"><input v-model="incompleteOnly" type="checkbox" /> Incomplete only</label>
        <span class="hint">{{ fieldRows.length }} of {{ sum.fields.length }}</span>
      </FilterBar>
      <div class="card"><div class="card-body">
        <table class="stack-table">
          <thead><tr><th>Attribute</th><th>Kind</th><th>Distinct (sample)</th><th>Filled</th><th style="width:30%">Completeness</th></tr></thead>
          <tbody>
            <tr v-for="f in fieldRows" :key="f.name">
              <td data-label="Attribute"><code>{{ f.name }}</code></td>
              <td data-label="Kind"><BadgePill size="sm" :variant="f.kind === 'numeric' ? 'info' : f.kind === 'categorical' ? 'success' : 'neutral'">{{ f.kind }}</BadgePill></td>
              <td data-label="Distinct">{{ f.kind === 'empty' ? '-' : f.distinct >= 40 ? '40+' : f.distinct }}</td>
              <td data-label="Filled">{{ fmtInt(f.filled) }} · {{ fmtPct(f.filled_pct) }}</td>
              <td data-label="Completeness"><ProgressBar :pct="f.filled_pct" :variant="f.filled_pct >= 95 ? 'success' : f.filled_pct >= 70 ? 'warning' : 'danger'" :label="`${f.name} completeness`" /></td>
            </tr>
          </tbody>
        </table>
      </div></div>
    </template>

    <template v-if="sum?.numeric.length">
      <SectionTitle pill="Numeric attributes">Ranges</SectionTitle>
      <div class="card"><div class="card-body">
        <table class="stack-table">
          <thead><tr><th>Attribute</th><th>Min</th><th>Average</th><th>Max</th></tr></thead>
          <tbody><tr v-for="n in sum.numeric" :key="n.field">
            <td data-label="Attribute"><code>{{ n.field }}</code></td>
            <td data-label="Min">{{ fmtNum(n.min) }}</td><td data-label="Average">{{ fmtNum(n.avg) }}</td><td data-label="Max">{{ fmtNum(n.max) }}</td>
          </tr></tbody>
        </table>
      </div></div>
    </template>

    <!-- Feature explorer -->
    <SectionTitle pill="Live rows">Features</SectionTitle>
    <FilterBar>
      <select v-model="featField" class="select-sm" aria-label="Filter column">
        <option value="">No attribute filter</option>
        <option v-for="f in filterableFields" :key="f" :value="f">{{ f }}</option>
      </select>
      <select v-if="featField && featValues.length" v-model="featValue" class="select-sm" aria-label="Value">
        <option value="">Choose a value…</option>
        <option v-for="v in featValues" :key="v" :value="v">{{ v }}</option>
      </select>
      <input v-else-if="featField" v-model="featValue" class="select-sm" type="text" placeholder="exact value" aria-label="Value" @keyup.enter="loadFeatures(true)" />
      <input v-model="featBbox" class="select-sm" type="text" placeholder="bbox: w,s,e,n (optional)" aria-label="Bounding box" @keyup.enter="loadFeatures(true)" />
      <button class="btn btn-sm" :disabled="featLoading" @click="loadFeatures(true)">Apply</button>
      <button v-if="featField || featBbox" class="btn btn-sm" @click="clearFeatureFilter">Clear</button>
      <span class="hint">{{ feats ? `${fmtInt(feats.count)} matching` : '' }}</span>
    </FilterBar>
    <p v-if="featError" class="upload-banner upload-banner-error">⚠ {{ featError }}</p>
    <div class="card"><div class="card-body">
      <EmptyState v-if="feats && !feats.features.length" icon="search" message="No features match." />
      <div v-else class="table-scroll">
        <table>
          <thead><tr><th>#</th><th>Geometry</th><th v-for="c in featCols" :key="c">{{ c }}</th></tr></thead>
          <tbody>
            <tr v-for="f in feats?.features" :key="f.id">
              <td class="mono-sm">{{ f.id }}</td><td>{{ f.geometry?.type }}</td>
              <td v-for="c in featCols" :key="c">{{ cell(f.properties[c]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <TablePagination :page="featPage" :total-pages="featPages" :total="feats?.count ?? 0" @prev="gotoFeatPage(featPage - 1)" @next="gotoFeatPage(featPage + 1)" />
    </div></div>
  </template>
  <EmptyState v-else-if="loading" loading message="Loading layer…" />
</template>

<script setup lang="ts">
import { useGisLayers, type GeoLayer, type LayerFeatures, type LayerSummary } from '~/composables/api/useGisLayers'
import { describeFilter } from '~/utils/gisFile'
import { fmtBbox, fmtDate, fmtInt, fmtMeasure, fmtPct, GEOM_LABEL, LAYER_BADGE, share } from '~/utils/gisFormat'

definePageMeta({ layout: 'default' })

const gis = useGisLayers()
const auth = useAuth()
const id = String(useRoute().params.id)
const canManage = computed(() => ['operator', 'admin', 'ministry_admin', 'super_admin'].includes(auth.user.value?.role_type || '') || !!auth.user.value?.is_staff)

const layer = ref<GeoLayer | null>(null)
const sum = ref<LayerSummary | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const sumError = ref<string | null>(null)
const sumState = computed(() => (!sum.value && !sumError.value ? 'loading' : sumError.value ? 'unavailable' : 'ok') as 'loading' | 'ok' | 'unavailable')
useHead({ title: computed(() => `${layer.value?.name ?? 'Layer'} · GIS analysis`) })

const measureLabel = computed(() => (layer.value?.geom_type === 'LineString' ? 'Total length' : layer.value?.geom_type === 'Polygon' ? 'Total area' : 'Extent'))
const avgFilled = computed(() => (sum.value?.fields.length ? sum.value.fields.reduce((n, f) => n + f.filled_pct, 0) / sum.value.fields.length : null))
const fmtNum = (n: number) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100).toLocaleString('en-KE')
const cell = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : typeof v === 'object' ? JSON.stringify(v) : String(v))

// Breakdown
const bdField = ref('')
const bdBasis = ref<'count' | 'measure'>('count')
const bd = computed(() => sum.value?.breakdowns.find(b => b.field === bdField.value) ?? null)
function barPct(v: { count: number; measure: number }) {
  const s = sum.value!
  return bdBasis.value === 'measure' && s.totals.unit ? share(v.measure, s.totals.measure) : share(v.count, s.totals.features)
}

// Attribute table
const fieldQ = ref('')
const incompleteOnly = ref(false)
const fieldRows = computed(() => (sum.value?.fields ?? [])
  .filter(f => (!fieldQ.value || f.name.toLowerCase().includes(fieldQ.value.toLowerCase())) && (!incompleteOnly.value || f.filled_pct < 100))
  .sort((a, b) => a.filled_pct - b.filled_pct))

// Feature explorer
const PAGE = 25
const feats = ref<LayerFeatures | null>(null)
const featLoading = ref(false)
const featError = ref<string | null>(null)
const featField = ref(''); const featValue = ref(''); const featBbox = ref('')
const featPage = ref(1)
const featPages = computed(() => Math.max(1, Math.ceil((feats.value?.count ?? 0) / PAGE)))
const filterableFields = computed(() => (layer.value?.fields ?? []).filter(f => !!f))
const featValues = computed(() => sum.value?.breakdowns.find(b => b.field === featField.value)?.values.map(v => v.value).filter((v): v is string => v !== null) ?? [])
const featCols = computed(() => (layer.value?.fields ?? []).slice(0, 8))
watch(featField, () => { featValue.value = '' })

async function loadFeatures(reset = false) {
  if (reset) featPage.value = 1
  featLoading.value = true; featError.value = null
  try {
    feats.value = await gis.layers.features(id, {
      limit: PAGE, offset: (featPage.value - 1) * PAGE, bbox: featBbox.value.trim() || undefined,
      prop: featField.value && featValue.value ? { [featField.value]: featValue.value } : undefined,
    })
  } catch (e: any) { featError.value = e?.data?.message || e?.message || 'Could not load features.' }
  finally { featLoading.value = false }
}
function gotoFeatPage(p: number) { featPage.value = Math.max(1, Math.min(featPages.value, p)); loadFeatures() }
function clearFeatureFilter() { featField.value = ''; featValue.value = ''; featBbox.value = ''; loadFeatures(true) }
function showFeatures(field: string, value: string) {
  featField.value = field
  nextTick(() => { featValue.value = value; loadFeatures(true); document.getElementById('features-anchor')?.scrollIntoView({ behavior: 'smooth' }) })
}

onMounted(async () => {
  try {
    layer.value = await gis.layers.detail(id)
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not load the layer.'
    loading.value = false
    return
  }
  loading.value = false
  if (layer.value.status !== 'ready') { sumError.value = `This layer is ${layer.value.status}${layer.value.fatal_error ? `: ${layer.value.fatal_error}` : ''} - there is nothing to analyse yet.`; return }
  try {
    sum.value = await gis.layers.summary(id)
    bdField.value = sum.value.breakdowns[0]?.field ?? ''
  } catch (e: any) { sumError.value = e?.data?.message || e?.message || 'Analysis is unavailable.' }
  loadFeatures(true)
})
</script>

<style scoped>
.meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px 18px; font-size: 13px; }
.m-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--fg-3); margin-bottom: 2px; }
.m-wide { grid-column: 1 / -1; }
.chip { display: inline-block; margin: 0 6px 4px 0; padding: 1px 6px; border: 1px solid var(--border-subtle); border-radius: 4px; font-size: 12px; }
.bd-controls { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
.table-scroll { overflow-x: auto; }
.linkish { background: none; border: 0; color: var(--link); cursor: pointer; padding: 0; font: inherit; }
</style>
