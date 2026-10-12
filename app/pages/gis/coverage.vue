<template>
  <PageHeader
    eyebrow="GIS & Spatial Analysis"
    title="Layer Coverage"
    subtitle="Which spatial layers each agency is expected to provide, and where they stand - missing, requested, processing or uploaded"
  >
    <template #actions>
      <NuxtLink to="/gis/overview" class="btn">Layer overview →</NuxtLink>
      <NuxtLink to="/integrations" class="btn btn-primary">Upload a layer →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <div class="ih-ribbon">
    <KpiTile label="Expected layers" :value="cov?.total ?? ''" :state="kpi" sub="active requirements in scope" />
    <KpiTile label="Complete" :value="cov ? fmtPct(cov.complete_pct) : ''" :state="kpi" :sub="cov ? `${cov.uploaded} uploaded` : ''" />
    <KpiTile label="Missing" :value="cov?.missing ?? ''" :state="kpi" sub="nobody asked yet" />
    <KpiTile label="In progress" :value="cov ? cov.requested + cov.processing : ''" :state="kpi" :sub="cov ? `${cov.requested} requested · ${cov.processing} processing` : ''" />
    <KpiTile label="Failed" :value="cov?.failed ?? ''" :state="kpi" sub="needs a retry or a new file" />
  </div>

  <SectionTitle pill="By agency">Agency completeness</SectionTitle>
  <div class="card"><div class="card-body">
    <EmptyState v-if="!loading && !cov?.by_agency.length" compact message="No expected layers in scope." />
    <table v-else class="stack-table">
      <thead><tr><th>Agency</th><th>Expected</th><th>Uploaded</th><th>Requested</th><th>Processing</th><th>Failed</th><th>Missing</th><th style="width:22%">Complete</th></tr></thead>
      <tbody>
        <tr v-for="a in cov?.by_agency" :key="a.agency_code" class="is-clickable" @click="agency = agency === a.agency ? '' : a.agency">
          <td data-label="Agency"><strong>{{ a.agency_code }}</strong></td>
          <td data-label="Expected">{{ a.total }}</td>
          <td data-label="Uploaded">{{ a.uploaded }}</td>
          <td data-label="Requested">{{ a.requested }}</td>
          <td data-label="Processing">{{ a.processing }}</td>
          <td data-label="Failed"><span :class="{ 'val-danger': a.failed }">{{ a.failed }}</span></td>
          <td data-label="Missing"><span :class="{ 'val-danger': a.missing }">{{ a.missing }}</span></td>
          <td data-label="Complete"><ProgressBar :pct="share(a.uploaded, a.total)" variant="success" label="Layers uploaded" /></td>
        </tr>
      </tbody>
    </table>
    <p class="hint" style="margin-top:8px">Click an agency to filter the layer list below.</p>
  </div></div>

  <SectionTitle pill="Every expected layer">Layer tracker</SectionTitle>
  <FilterBar>
    <input v-model="q" class="select-sm" type="search" placeholder="Search layer or agency…" aria-label="Search" />
    <select v-model="agency" class="select-sm" aria-label="Agency">
      <option value="">All agencies</option>
      <option v-for="a in agencyOptions" :key="a.id" :value="a.id">{{ a.code }}</option>
    </select>
    <select v-model="status" class="select-sm" aria-label="Status">
      <option value="">All statuses</option>
      <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
    </select>
    <select v-model="geom" class="select-sm" aria-label="Geometry">
      <option value="">All geometries</option>
      <option v-for="g in ['Point', 'LineString', 'Polygon']" :key="g" :value="g">{{ GEOM_LABEL[g] }}</option>
    </select>
    <label class="hint"><input v-model="onlyGaps" type="checkbox" /> Gaps only (not uploaded)</label>
    <button v-if="q || agency || status || geom || onlyGaps" class="btn btn-sm" @click="reset">Clear</button>
    <span class="hint">{{ filtered.length }} of {{ reqs.length }}</span>
  </FilterBar>

  <div class="card"><div class="card-body">
    <EmptyState v-if="!loading && !filtered.length" icon="search" message="No layers match these filters." />
    <table v-else class="stack-table">
      <thead>
        <tr>
          <th v-for="c in COLS" :key="c.key"><button class="th-sort" @click="sortBy(c.key)">{{ c.label }}<span v-if="sort.key === c.key" aria-hidden="true"> {{ sort.dir === 1 ? '▲' : '▼' }}</span></button></th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in pageRows" :key="r.id">
          <td data-label="Layer">
            <strong>{{ r.name }}</strong>
            <div v-if="r.required_fields.length" class="hint">needs: {{ r.required_fields.join(', ') }}</div>
          </td>
          <td data-label="Agency">{{ r.agency_code }}</td>
          <td data-label="Geometry">{{ GEOM_LABEL[r.geom_type] || r.geom_type }}</td>
          <td data-label="Status"><BadgePill :variant="REQ_BADGE[r.status]">{{ r.status }}</BadgePill></td>
          <td data-label="Features">{{ r.layer ? fmtInt(r.layer.feature_count) : '-' }}
            <span v-if="r.layer?.error_count" class="hint">({{ fmtInt(r.layer.error_count) }} skipped)</span>
            <span v-if="r.layer?.filtered_count" class="hint">({{ fmtInt(r.layer.filtered_count) }} filtered)</span></td>
          <td data-label="Version">{{ r.layer ? `v${r.layer.version}` : '-' }}</td>
          <td data-label="Updated" class="hint">{{ fmtDate(r.layer?.updated_at) }}</td>
          <td data-label="Asked of"><span v-if="r.open_requests.length" class="hint">{{ r.open_requests.map(o => o.assignee_name).join(', ') }}</span><span v-else class="hint">-</span></td>
          <td class="row-actions">
            <NuxtLink v-if="r.layer?.status === 'ready'" class="btn btn-sm" :to="`/gis/layers/${r.layer.id}`">Analysis</NuxtLink>
            <NuxtLink v-else class="btn btn-sm" :to="`/integrations?tab=gis`">{{ r.layer?.status === 'failed' ? 'Fix & retry' : 'Upload' }}</NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
    <TablePagination :page="page" :total-pages="totalPages" :total="filtered.length" @prev="page--" @next="page++" />
  </div></div>
</template>

<script setup lang="ts">
import { useGisLayers, type GeoLayerRequirement, type GisCoverage, type RequirementStatus } from '~/composables/api/useGisLayers'
import { fmtDate, fmtInt, fmtPct, GEOM_LABEL, REQ_BADGE, share } from '~/utils/gisFormat'

definePageMeta({ layout: 'default' })
useHead({ title: 'GIS Layer Coverage' })

const gis = useGisLayers()
const STATUSES: RequirementStatus[] = ['missing', 'requested', 'processing', 'failed', 'uploaded']
const PAGE_SIZE = 25

const cov = ref<GisCoverage | null>(null)
const reqs = ref<GeoLayerRequirement[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const kpi = computed(() => (loading.value ? 'loading' : error.value ? 'unavailable' : 'ok') as 'loading' | 'ok' | 'unavailable')

const route = useRoute()
const q = ref('')
const agency = ref(typeof route.query.agency === 'string' ? route.query.agency : '')
const status = ref(typeof route.query.status === 'string' ? route.query.status : '')
const geom = ref('')
const onlyGaps = ref(false)
const page = ref(1)
const sort = reactive<{ key: string; dir: 1 | -1 }>({ key: 'status', dir: 1 })

const COLS = [
  { key: 'name', label: 'Layer' }, { key: 'agency_code', label: 'Agency' }, { key: 'geom_type', label: 'Geometry' },
  { key: 'status', label: 'Status' }, { key: 'features', label: 'Features' }, { key: 'version', label: 'Version' },
  { key: 'updated', label: 'Updated' }, { key: 'asked', label: 'Asked of' },
]
const STATUS_RANK: Record<string, number> = { failed: 0, missing: 1, requested: 2, processing: 3, uploaded: 4 }

const agencyOptions = computed(() => {
  const m = new Map<string, string>()
  for (const r of reqs.value) m.set(r.agency, r.agency_code)
  return [...m].map(([id, code]) => ({ id, code })).sort((a, b) => a.code.localeCompare(b.code))
})

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  const rows = reqs.value.filter(r =>
    (!needle || r.name.toLowerCase().includes(needle) || r.agency_code.toLowerCase().includes(needle) || r.key.includes(needle))
    && (!agency.value || r.agency === agency.value)
    && (!status.value || r.status === status.value)
    && (!geom.value || r.geom_type === geom.value)
    && (!onlyGaps.value || r.status !== 'uploaded'))
  const val = (r: GeoLayerRequirement): string | number => ({
    name: r.name.toLowerCase(), agency_code: r.agency_code, geom_type: r.geom_type, status: STATUS_RANK[r.status],
    features: r.layer?.feature_count ?? -1, version: r.layer?.version ?? 0,
    updated: r.layer?.updated_at ?? '', asked: r.open_requests.length,
  } as Record<string, string | number>)[sort.key]
  return [...rows].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir)
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageRows = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([q, agency, status, geom, onlyGaps], () => { page.value = 1 })

function sortBy(key: string) {
  if (sort.key === key) sort.dir = (sort.dir * -1) as 1 | -1
  else { sort.key = key; sort.dir = 1 }
}
function reset() { q.value = ''; agency.value = ''; status.value = ''; geom.value = ''; onlyGaps.value = false }

onMounted(async () => {
  try {
    const [c, r] = await Promise.all([gis.requirements.coverage(), gis.requirements.list()])
    cov.value = c; reqs.value = r
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not load layer coverage.'
  } finally { loading.value = false }
})
</script>

<style scoped>
.th-sort { background: none; border: 0; padding: 0; font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit; cursor: pointer; }
.row-actions { white-space: nowrap; }
tr.is-clickable { cursor: pointer; }
.val-danger { color: var(--danger-fg); font-weight: 700; }
</style>
