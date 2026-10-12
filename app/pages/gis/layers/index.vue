<template>
  <PageHeader
    eyebrow="GIS & Spatial Analysis"
    title="Layer Catalogue"
    subtitle="Every spatial layer on the platform - agency uploads and reference layers - with status, size and provenance"
  >
    <template #actions>
      <NuxtLink to="/gis/overview" class="btn">Layer overview →</NuxtLink>
      <NuxtLink to="/integrations?tab=gis" class="btn btn-primary">Upload / replace →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <div class="ih-ribbon">
    <KpiTile label="Layers" :value="layers.length" :state="kpi" :sub="`${refCount} reference · ${layers.length - refCount} agency`" />
    <KpiTile label="Ready" :value="count('ready')" :state="kpi" sub="queryable now" />
    <KpiTile label="Processing" :value="count('processing')" :state="kpi" sub="being validated" />
    <KpiTile label="Failed" :value="count('failed')" :state="kpi" sub="need a retry" />
    <KpiTile label="Features" :value="fmtInt(features)" :state="kpi" sub="across ready layers" />
  </div>

  <FilterBar>
    <input v-model="q" class="select-sm" type="search" placeholder="Search name, slug or file…" aria-label="Search" />
    <select v-model="agency" class="select-sm" aria-label="Owner">
      <option value="">All owners</option>
      <option value="__reference">Reference (platform)</option>
      <option v-for="a in agencyCodes" :key="a" :value="a">{{ a }}</option>
    </select>
    <select v-model="status" class="select-sm" aria-label="Status">
      <option value="">All statuses</option>
      <option value="ready">ready</option><option value="processing">processing</option><option value="failed">failed</option>
    </select>
    <select v-model="geom" class="select-sm" aria-label="Geometry">
      <option value="">All geometries</option>
      <option v-for="g in ['Point', 'LineString', 'Polygon']" :key="g" :value="g">{{ GEOM_LABEL[g] }}</option>
    </select>
    <select v-model="cls" class="select-sm" aria-label="Classification">
      <option value="">Any classification</option>
      <option v-for="c in ['public', 'internal', 'restricted', 'sensitive']" :key="c" :value="c">{{ c }}</option>
    </select>
    <select v-model="tracked" class="select-sm" aria-label="Tracked">
      <option value="">Tracked + standalone</option>
      <option value="yes">Fulfils an expected layer</option>
      <option value="no">Standalone</option>
    </select>
    <button v-if="hasFilters" class="btn btn-sm" @click="reset">Clear</button>
    <span class="hint">{{ filtered.length }} of {{ layers.length }}</span>
  </FilterBar>

  <div class="card"><div class="card-body">
    <EmptyState v-if="!loading && !filtered.length" icon="search" message="No layers match these filters." />
    <table v-else class="stack-table">
      <thead><tr>
        <th v-for="c in COLS" :key="c.key"><button class="th-sort" @click="sortBy(c.key)">{{ c.label }}<span v-if="sort.key === c.key" aria-hidden="true"> {{ sort.dir === 1 ? '▲' : '▼' }}</span></button></th>
        <th />
      </tr></thead>
      <tbody>
        <tr v-for="l in pageRows" :key="l.id">
          <td data-label="Name"><strong>{{ l.name }}</strong> <span class="hint">{{ l.slug }}</span>
            <div v-if="l.fatal_error" class="hint err">{{ l.fatal_error }}</div></td>
          <td data-label="Owner">{{ l.agency_code || 'Reference' }}</td>
          <td data-label="Geometry">{{ GEOM_LABEL[l.geom_type] || '-' }}</td>
          <td data-label="Status"><BadgePill :variant="LAYER_BADGE[l.status]">{{ l.status }}</BadgePill></td>
          <td data-label="Features">{{ fmtInt(l.feature_count) }}
            <span v-if="l.error_count" class="hint">({{ fmtInt(l.error_count) }} skipped)</span>
            <span v-if="l.filtered_count" class="hint">({{ fmtInt(l.filtered_count) }} filtered)</span></td>
          <td data-label="Class"><BadgePill :variant="l.classification === 'public' ? 'success' : 'neutral'" size="sm">{{ l.classification }}</BadgePill></td>
          <td data-label="CRS" class="hint">{{ l.source_crs || '-' }}</td>
          <td data-label="Version">v{{ l.version }}</td>
          <td data-label="Source" class="hint">{{ l.original_filename || '-' }}<div v-if="l.uploaded_by_name">by {{ l.uploaded_by_name }}</div></td>
          <td data-label="Updated" class="hint">{{ fmtDate(l.updated_at) }}</td>
          <td class="row-actions"><NuxtLink v-if="l.status === 'ready'" class="btn btn-sm" :to="`/gis/layers/${l.id}`">Analysis</NuxtLink></td>
        </tr>
      </tbody>
    </table>
    <TablePagination :page="page" :total-pages="totalPages" :total="filtered.length" @prev="page--" @next="page++" />
  </div></div>
</template>

<script setup lang="ts">
import { useGisLayers, type GeoLayer } from '~/composables/api/useGisLayers'
import { fmtDate, fmtInt, GEOM_LABEL, LAYER_BADGE } from '~/utils/gisFormat'

definePageMeta({ layout: 'default' })
useHead({ title: 'GIS Layer Catalogue' })

const gis = useGisLayers()
const PAGE_SIZE = 25
const layers = ref<GeoLayer[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const kpi = computed(() => (loading.value ? 'loading' : error.value ? 'unavailable' : 'ok') as 'loading' | 'ok' | 'unavailable')

const q = ref(''); const agency = ref(''); const status = ref(''); const geom = ref(''); const cls = ref(''); const tracked = ref('')
const page = ref(1)
const sort = reactive<{ key: string; dir: 1 | -1 }>({ key: 'updated_at', dir: -1 })
const COLS = [
  { key: 'name', label: 'Name' }, { key: 'agency_code', label: 'Owner' }, { key: 'geom_type', label: 'Geometry' },
  { key: 'status', label: 'Status' }, { key: 'feature_count', label: 'Features' }, { key: 'classification', label: 'Class' },
  { key: 'source_crs', label: 'CRS' }, { key: 'version', label: 'Version' }, { key: 'original_filename', label: 'Source' },
  { key: 'updated_at', label: 'Updated' },
]

const refCount = computed(() => layers.value.filter(l => l.is_reference).length)
const count = (s: string) => layers.value.filter(l => l.status === s).length
const features = computed(() => layers.value.filter(l => l.status === 'ready').reduce((n, l) => n + l.feature_count, 0))
const agencyCodes = computed(() => [...new Set(layers.value.map(l => l.agency_code).filter(Boolean))].sort())
const hasFilters = computed(() => !!(q.value || agency.value || status.value || geom.value || cls.value || tracked.value))

const filtered = computed(() => {
  const n = q.value.trim().toLowerCase()
  const rows = layers.value.filter(l =>
    (!n || [l.name, l.slug, l.original_filename].some(v => v?.toLowerCase().includes(n)))
    && (!agency.value || (agency.value === '__reference' ? l.is_reference : l.agency_code === agency.value))
    && (!status.value || l.status === status.value)
    && (!geom.value || l.geom_type === geom.value)
    && (!cls.value || l.classification === cls.value)
    && (!tracked.value || (tracked.value === 'yes') === !!l.requirement))
  const k = sort.key as keyof GeoLayer
  return [...rows].sort((a, b) => {
    const x = a[k] as string | number, y = b[k] as string | number
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageRows = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([q, agency, status, geom, cls, tracked], () => { page.value = 1 })

function sortBy(key: string) {
  if (sort.key === key) sort.dir = (sort.dir * -1) as 1 | -1
  else { sort.key = key; sort.dir = 1 }
}
function reset() { q.value = ''; agency.value = ''; status.value = ''; geom.value = ''; cls.value = ''; tracked.value = '' }

onMounted(async () => {
  try { layers.value = await gis.layers.list() }
  catch (e: any) { error.value = e?.data?.message || e?.message || 'Could not load layers.' }
  finally { loading.value = false }
})
</script>

<style scoped>
.th-sort { background: none; border: 0; padding: 0; font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit; cursor: pointer; }
.row-actions { white-space: nowrap; }
.err { color: var(--danger-fg); }
</style>
