<template>
  <!--
    Integration Hub → "GIS layers" tab. Tracks which spatial layers each agency
    is expected to provide (missing / requested / processing / uploaded), lets
    an admin ask a specific user to upload one, and lets uploaders send a
    zipped shapefile / GeoJSON / GeoPackage. Backend: /api/v1/gis/layer-*.
  -->
  <div class="gis-panel">
    <div class="ih-ribbon ih-rise">
      <KpiTile label="Required layers" :value="coverage ? coverage.total : ''" :state="kpiState" sub="across agencies in scope" />
      <KpiTile label="Uploaded" :value="coverage ? `${coverage.complete_pct}%` : ''" :state="kpiState" :sub="coverage ? `${coverage.uploaded} of ${coverage.total} ready` : ''" />
      <KpiTile label="Missing" :value="coverage ? coverage.missing : ''" :state="kpiState" sub="nobody asked yet" />
      <KpiTile label="Requested / processing" :value="coverage ? coverage.requested + coverage.processing : ''" :state="kpiState" :sub="coverage ? `${coverage.failed} failed` : ''" />
    </div>

    <p v-if="loadError" class="upload-banner upload-banner-error">⚠ {{ loadError }}</p>

    <!-- My requests -->
    <div v-if="myRequests.length" class="ih-card ih-rise">
      <div class="ih-card-body">
        <h3 class="gis-h">Asked of you</h3>
        <ul class="gis-list">
          <li v-for="r in myRequests" :key="r.id">
            <div>
              <strong>{{ r.requirement_name }}</strong> <span class="hint">· {{ r.agency_code }}</span>
              <div class="hint">{{ r.message }}<template v-if="r.due_date"> · due {{ r.due_date }}</template> · from {{ r.requested_by_name || 'an admin' }}</div>
            </div>
            <button class="btn btn-primary" @click="openUpload(r.requirement)">Upload</button>
          </li>
        </ul>
      </div>
    </div>

    <!-- Requirements tracker -->
    <div class="ih-card ih-rise">
      <div class="ih-card-body">
        <div class="gis-head">
          <h3 class="gis-h">Layer tracker</h3>
          <div class="gis-actions">
            <select v-model="statusFilter" aria-label="Filter by status" @change="load">
              <option value="">All statuses</option>
              <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
            </select>
            <button v-if="isAdmin" class="btn" @click="reqModal = true">+ Expected layer</button>
            <button v-if="canUpload" class="btn btn-primary" @click="openUpload('')">Upload a layer</button>
          </div>
        </div>
        <EmptyState v-if="!loading && !requirements.length" icon="inbox"
          message="No expected layers yet. An admin can define the layers each agency should provide." />
        <table v-else class="gis-table">
          <thead><tr><th>Layer</th><th>Agency</th><th>Type</th><th>Status</th><th>Features</th><th>Asked of</th><th /></tr></thead>
          <tbody>
            <tr v-for="r in requirements" :key="r.id">
              <td>
                <strong>{{ r.name }}</strong>
                <div v-if="r.required_fields.length" class="hint">needs: {{ r.required_fields.join(', ') }} <span class="hint">(any column can be mapped)</span></div>
                <div v-if="r.layer?.fatal_error" class="hint gis-err">{{ r.layer.fatal_error }}</div>
              </td>
              <td>{{ r.agency_code }}</td>
              <td>{{ r.geom_type }}</td>
              <td><BadgePill :variant="BADGE[r.status]">{{ r.status }}</BadgePill></td>
              <td>
                <template v-if="r.layer">{{ r.layer.feature_count.toLocaleString('en-KE') }}
                  <span v-if="r.layer.error_count" class="hint">({{ r.layer.error_count }} skipped)</span></template>
                <span v-else class="hint">-</span>
              </td>
              <td>
                <span v-for="q in r.open_requests" :key="q.id" class="hint gis-assignee">
                  {{ q.assignee_name }}<template v-if="q.due_date"> · {{ q.due_date }}</template>
                  <button v-if="isAdmin" class="linkish" @click="cancelRequest(q.id)">cancel</button>
                </span>
                <span v-if="!r.open_requests.length" class="hint">-</span>
              </td>
              <td class="gis-row-actions">
                <button v-if="isAdmin && r.status !== 'uploaded'" class="btn" @click="openRequest(r)">Request upload</button>
                <button v-if="r.layer" class="btn" @click="openDetails(r.layer.id)">Details</button>
                <button v-if="canUpload && r.status === 'processing'" class="btn" disabled><span class="spinner" aria-hidden="true" /> Processing</button>
                <button v-else-if="canUpload && r.layer?.status === 'failed'" class="btn btn-primary" @click="openUpload(r.id, r.layer)">Retry</button>
                <button v-else-if="canUpload" class="btn" @click="openUpload(r.id, r.layer)">{{ r.layer ? 'Replace' : 'Upload' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- All layers -->
    <div class="ih-card ih-rise">
      <div class="ih-card-body">
        <h3 class="gis-h">Uploaded layers</h3>
        <EmptyState v-if="!layers.length" compact message="Nothing uploaded yet." />
        <table v-else class="gis-table">
          <thead><tr><th>Name</th><th>Agency</th><th>Type</th><th>CRS</th><th>Status</th><th>Features</th><th>Updated</th><th /></tr></thead>
          <tbody>
            <tr v-for="l in layers" :key="l.id">
              <td><strong>{{ l.name }}</strong> <span class="hint">v{{ l.version }}</span>
                <div v-if="l.fatal_error" class="hint gis-err">{{ l.fatal_error }}</div></td>
              <td>{{ l.agency_code || 'Reference' }}</td><td>{{ l.geom_type || '-' }}</td><td>{{ l.source_crs || '-' }}</td>
              <td><BadgePill :variant="LAYER_BADGE[l.status]">{{ l.status }}</BadgePill></td>
              <td>{{ l.feature_count.toLocaleString('en-KE') }}<span v-if="l.error_count" class="hint"> ({{ l.error_count }} skipped)</span></td>
              <td class="hint">{{ new Date(l.updated_at).toLocaleString('en-KE') }}</td>
              <td class="gis-row-actions">
                <button class="btn" @click="openDetails(l.id)">Details</button>
                <template v-if="!l.is_reference && canUpload">
                  <button v-if="l.status === 'failed'" class="btn btn-primary" @click="openUpload(l.requirement || '', l)">Retry</button>
                  <button v-else-if="l.status === 'ready'" class="btn" @click="openUpload(l.requirement || '', l)">Replace</button>
                </template>
                <button v-if="isAdmin && !l.is_reference && l.status !== 'processing'" class="btn btn-tone-danger" @click="confirmDelete = l">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Upload / replace / retry modal -->
    <AppModal v-model="uploadModal" :title="modalTitle" subtitle="Zipped shapefile (.zip), GeoJSON or GeoPackage" max-width="660px">
      <p v-if="mode !== 'new'" class="hint gis-note">
        {{ mode === 'retry' ? 'Retrying re-sends the file with the settings below.' : 'Replacing loads a new version (v' + ((ctxLayer?.version ?? 0) + 1) + ') and swaps the features in once it validates; the current version stays until then.' }}
        <template v-if="!up.file"> No file chosen: <strong>the copy already stored on the server is re-processed</strong> with the settings below. Choose a file to send a new one instead.</template>
      </p>
      <div class="form-group">
        <label class="input-label">Expected layer</label>
        <select v-model="up.requirement" :disabled="mode !== 'new'" @change="onPickRequirement">
          <option value="">Not one of the expected layers</option>
          <option v-for="r in requirements" :key="r.id" :value="r.id">{{ r.agency_code }} · {{ r.name }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="input-label">Layer name</label>
        <input v-model="up.name" class="input" type="text" placeholder="e.g. KeNHA trunk roads" />
      </div>
      <div v-if="isMinistry && !up.requirement && mode === 'new'" class="form-group">
        <label class="input-label">Agency</label>
        <select v-model="up.agency"><option value="">Choose…</option>
          <option v-for="a in agencies" :key="a.id" :value="a.id">{{ a.agency_code }}</option></select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="input-label">Source CRS <span class="hint">(only if the file has no .prj / CRS)</span></label>
          <input v-model="up.source_crs" class="input" :class="{ 'input-error': crsHint }" type="text" placeholder="EPSG:21037" />
          <p v-if="crsHint" class="hint gis-err">Set the CRS the coordinates are in, e.g. EPSG:32737 (UTM 37S) or EPSG:4326.</p>
        </div>
        <div class="form-group">
          <label class="input-label">Classification</label>
          <select v-model="up.classification">
            <option v-for="c in CLASSES" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
      </div>

      <FileDropzone accept=".zip,.geojson,.json,.gpkg" :max-size-mb="1024" :uploading="uploading" :progress="progress"
        :file-name="up.file?.name" @file="onFile" @error="upError = $event" />
      <p v-if="up.file && !uploading" class="hint">Selected: {{ up.file.name }} ({{ (up.file.size / 1048576).toFixed(1) }} MB)
        <button class="linkish" @click="clearFile">choose another</button></p>

      <!-- Column mapping: no attribute name is mandatory by itself -->
      <div v-if="primaryReq?.required_fields.length" class="gis-map">
        <h4 class="gis-h">Match columns</h4>
        <p class="hint">
          This layer asks for {{ primaryReq.required_fields.join(', ') }} on every feature. Point each at whichever
          column in your file identifies the feature - the names don't have to match.
          <template v-if="!columns.length">Columns are read from GeoJSON files; for a shapefile / GeoPackage type the column name.</template>
        </p>
        <datalist id="gis-columns"><option v-for="c in columns" :key="c" :value="c" /></datalist>
        <div v-for="f in primaryReq.required_fields" :key="f" class="gis-map-row">
          <code>{{ f }}</code><span aria-hidden="true">←</span>
          <input v-model="up.mapping[f]" class="input" list="gis-columns" type="text" :placeholder="columns.length ? 'choose a column' : 'column in your file'" />
          <span class="hint gis-map-note">{{ mappingNote(f) }}</span>
          <button v-if="isAdmin" class="linkish" :disabled="busyReq" @click="stopRequiring(f)" title="Admin: this layer will no longer require the attribute">stop requiring</button>
        </div>
      </div>

      <!-- Row filter: keep only part of the file -->
      <div class="gis-map">
        <h4 class="gis-h">Only load some rows <span class="hint">(optional)</span></h4>
        <p class="hint">
          Keep a slice of the file - e.g. a national road file for the rural network: <em>keep rows where road_agency is KeRRA</em>.
          Rows left out are counted, not treated as errors.
        </p>
        <GisRowFilterEditor v-model="up.filterRows" :columns="columns" />
      </div>

      <!-- Related layers this one file can feed -->
      <div v-if="relatedOptions.length" class="gis-map">
        <h4 class="gis-h">Also use this file for</h4>
        <p class="hint">
          A road inventory can fill several expected layers. Suggestions come from the first rows' attributes; each
          ticked layer gets its own row filter (pre-filled where the file has the columns) so it only loads its slice.
          An empty filter loads the whole file into that layer.
        </p>
        <div v-for="o in relatedOptions" :key="o.req.id" class="gis-related">
          <label class="gis-check">
            <input v-model="up.extra" type="checkbox" :value="o.req.id" />
            <span><strong>{{ o.req.agency_code }} · {{ o.req.name }}</strong>
              <span v-if="o.reason" class="hint"> - {{ o.reason }}</span>
              <span v-if="o.req.layer?.status === 'ready'" class="hint"> · replaces v{{ o.req.layer.version }}</span></span>
          </label>
          <div v-if="up.extra.includes(o.req.id)" class="gis-related-filter">
            <GisRowFilterEditor v-model="up.extraFilters[o.req.id]" :columns="columns" />
            <p v-if="!rowsToFilter(up.extraFilters[o.req.id] ?? []).include" class="hint gis-warn">No filter - the whole file goes into this layer.</p>
          </div>
        </div>
      </div>

      <p v-if="upError" class="upload-banner upload-banner-error">⚠ {{ upError }}</p>

      <ul v-if="targets.length" class="gis-targets" aria-live="polite">
        <li v-for="t in targets" :key="t.key">
          <div class="gis-target-head">
            <strong>{{ t.label }}</strong>
            <BadgePill :variant="TARGET_BADGE[t.state]">{{ t.state }}</BadgePill>
          </div>
          <p v-if="t.state === 'processing'" class="hint"><span class="spinner" aria-hidden="true" /> Reprojecting and validating features…</p>
          <p v-else-if="t.state === 'ready' && t.layer" class="hint">
            ✓ {{ t.layer.feature_count.toLocaleString('en-KE') }} feature(s) loaded<template v-if="t.layer.error_count">, {{ t.layer.error_count }} skipped</template><template v-if="t.layer.filtered_count">, {{ t.layer.filtered_count.toLocaleString('en-KE') }} left out by the filter</template>.
          </p>
          <p v-else-if="t.error" class="gis-err">✕ {{ t.error }}</p>
          <ul v-if="t.layer?.errors?.length" class="gis-errors">
            <li v-for="e in t.layer.errors.slice(0, 5)" :key="e.row">Row {{ e.row }}: {{ e.error }}</li>
            <li v-if="t.layer.error_count > 5" class="hint">…and {{ t.layer.error_count - 5 }} more (see Details)</li>
          </ul>
        </li>
      </ul>
      <template #footer>
        <button class="btn" @click="closeUpload">{{ allSettled && targets.length ? 'Done' : 'Cancel' }}</button>
        <button v-if="uploading" class="btn" @click="abortCtl?.abort()">Stop upload</button>
        <button class="btn btn-primary" :disabled="!canSubmit" @click="submitUpload">{{ submitLabel }}</button>
      </template>
    </AppModal>

    <!-- Layer details -->
    <AppModal v-model="detailsModal" :title="detail?.name || 'Layer'" :subtitle="detail ? `${detail.agency_code || 'Reference'} · v${detail.version} · ${detail.original_filename || 'no file'}` : ''" max-width="640px">
      <p v-if="detailError" class="upload-banner upload-banner-error">⚠ {{ detailError }}</p>
      <template v-if="detail">
        <p><BadgePill :variant="LAYER_BADGE[detail.status]">{{ detail.status }}</BadgePill>
          {{ detail.feature_count.toLocaleString('en-KE') }} feature(s)<template v-if="detail.error_count">, {{ detail.error_count }} skipped</template>
          · {{ detail.geom_type || 'unknown geometry' }} · {{ detail.source_crs || 'CRS unknown' }}</p>
        <p v-if="describeFilter(detail.row_filter)" class="hint">Row filter: {{ describeFilter(detail.row_filter) }}
          · {{ detail.filtered_count.toLocaleString('en-KE') }} row(s) left out</p>
        <NuxtLink v-if="detail.status === 'ready'" class="btn btn-sm" :to="`/gis/layers/${detail.id}`">Open analysis →</NuxtLink>
        <p v-if="detail.fatal_error" class="upload-banner upload-banner-error">{{ detail.fatal_error }}</p>
        <div v-if="Object.keys(detail.field_map || {}).length" class="form-group">
          <label class="input-label">Column mapping used</label>
          <code v-for="(col, field) in detail.field_map" :key="field" class="gis-chip">{{ field }} ← {{ col }}</code>
        </div>
        <div v-if="detail.fields?.length" class="form-group">
          <label class="input-label">Attributes in the file</label>
          <code v-for="f in detail.fields" :key="f" class="gis-chip">{{ f }}</code>
        </div>
        <div v-if="detail.errors?.length" class="form-group">
          <label class="input-label">Skipped features (first {{ detail.errors.length }})</label>
          <ul class="gis-errors"><li v-for="e in detail.errors" :key="e.row">Row {{ e.row }}: {{ e.error }}</li></ul>
        </div>
      </template>
      <EmptyState v-else-if="!detailError" compact loading message="Loading…" />
      <template #footer>
        <button class="btn" @click="detailsModal = false">Close</button>
        <button v-if="detail && canUpload && !detail.is_reference && detail.status !== 'processing'" class="btn btn-primary"
          @click="detailsModal = false; openUpload(detail.requirement || '', detail)">{{ detail.status === 'failed' ? 'Retry' : 'Replace' }}</button>
      </template>
    </AppModal>

    <ConfirmDialog :open="!!confirmDelete" title="Delete layer" danger confirm-label="Delete" :busy="deleting"
      :message="`Delete ${confirmDelete?.name} and all its features? This can't be undone.`"
      @confirm="doDelete" @cancel="confirmDelete = null" />

    <!-- Request-upload modal -->
    <AppModal v-model="requestModal" title="Request an upload" :subtitle="reqTarget ? `${reqTarget.agency_code} · ${reqTarget.name}` : ''">
      <div class="form-group">
        <label class="input-label">Ask</label>
        <select v-model="rq.assignee">
          <option value="">Choose a user…</option>
          <option v-for="u in assignable" :key="u.id" :value="u.id">{{ u.username || u.email }} ({{ u.role_type }})</option>
        </select>
        <p v-if="!assignable.length" class="hint">No operator-or-above users found in this agency.</p>
      </div>
      <div class="form-group"><label class="input-label">Due date</label><input v-model="rq.due_date" type="date" /></div>
      <div class="form-group"><label class="input-label">Message</label>
        <textarea v-model="rq.message" rows="3" placeholder="Optional - what you need and why" /></div>
      <p v-if="rqError" class="upload-banner upload-banner-error">⚠ {{ rqError }}</p>
      <template #footer>
        <button class="btn" @click="requestModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="!rq.assignee || rqBusy" @click="submitRequest">Send request</button>
      </template>
    </AppModal>

    <!-- New expected layer modal -->
    <AppModal v-model="reqModal" title="Expected layer" subtitle="A layer an agency should provide">
      <div v-if="isMinistry" class="form-group"><label class="input-label">Agency</label>
        <select v-model="nr.agency"><option value="">Choose…</option>
          <option v-for="a in agencies" :key="a.id" :value="a.id">{{ a.agency_code }}</option></select></div>
      <div class="form-group"><label class="input-label">Name</label><input v-model="nr.name" class="input" type="text" placeholder="Trunk roads" /></div>
      <div class="form-row">
        <div class="form-group"><label class="input-label">Geometry</label>
          <select v-model="nr.geom_type"><option value="Point">Point</option><option value="LineString">Line</option><option value="Polygon">Polygon</option></select></div>
        <div class="form-group"><label class="input-label">Required attributes</label>
          <input v-model="nr.fields" class="input" type="text" placeholder="road_code, class" /></div>
      </div>
      <div class="form-group"><label class="input-label">Description</label><textarea v-model="nr.description" rows="2" /></div>
      <p v-if="nrError" class="upload-banner upload-banner-error">⚠ {{ nrError }}</p>
      <template #footer>
        <button class="btn" @click="reqModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="!nr.name || nrBusy" @click="submitRequirement">Add</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { useGisLayers, type GeoLayer, type GeoLayerRequest, type GeoLayerRequirement, type GisCoverage, type RequirementStatus, type Classification } from '~/composables/api/useGisLayers'
import { useAgencies, useUsers } from '~/composables/api'
import {
  buildFieldMap, describeFilter, filterToRows, parseAvailableColumns, relatedLayerHints, rowsToFilter,
  sniffGisFile, suggestColumn, suggestedFilterRows,
  type FileSniff, type FilterRow,
} from '~/utils/gisFile'
import type { Agency, User } from '~/types/uapts'

const STATUSES: RequirementStatus[] = ['missing', 'requested', 'processing', 'failed', 'uploaded']
const CLASSES: Classification[] = ['internal', 'public', 'restricted', 'sensitive']
const BADGE: Record<RequirementStatus, string> = { uploaded: 'success', processing: 'info', requested: 'warning', failed: 'danger', missing: 'danger' }
const LAYER_BADGE: Record<string, string> = { ready: 'success', processing: 'info', failed: 'danger' }
const TARGET_BADGE: Record<string, string> = { queued: 'neutral', uploading: 'info', processing: 'info', ready: 'success', failed: 'danger', skipped: 'warning' }

const gis = useGisLayers()
const auth = useAuth()
const role = computed(() => auth.user.value?.role_type)
const isMinistry = computed(() => ['super_admin', 'ministry_admin'].includes(role.value || '') || !auth.user.value?.agency)
const isAdmin = computed(() => ['admin', 'ministry_admin', 'super_admin'].includes(role.value || '') || !!auth.user.value?.is_staff)
const canUpload = computed(() => ['operator', 'analyst', 'admin', 'ministry_admin', 'super_admin'].includes(role.value || '') || !!auth.user.value?.is_staff)

const coverage = ref<GisCoverage | null>(null)
const requirements = ref<GeoLayerRequirement[]>([])
const layers = ref<GeoLayer[]>([])
const myRequests = ref<GeoLayerRequest[]>([])
const agencies = ref<Agency[]>([])
const statusFilter = ref('')
const loading = ref(true)
const loadError = ref<string | null>(null)
const kpiState = computed(() => (loading.value ? 'loading' : loadError.value ? 'unavailable' : 'ok') as 'loading' | 'ok' | 'unavailable')

function errMsg(e: any, fallback: string) { return e?.data?.message || e?.message || fallback }

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [cov, reqs, lay, mine] = await Promise.all([
      gis.requirements.coverage(), gis.requirements.list({ status: statusFilter.value || undefined }),
      gis.layers.list(), gis.requests.list({ mine: true, status: 'open' }),
    ])
    coverage.value = cov; requirements.value = reqs; layers.value = lay; myRequests.value = mine
  } catch (e) {
    loadError.value = errMsg(e, 'Could not load GIS layers.')
  } finally {
    loading.value = false
    schedulePoll()
  }
}

// Keep the tracker fresh while any layer is still being processed server-side
// (a big file takes minutes) - so a page reload or a second tab doesn't leave
// a stale "processing".
let listTimer: ReturnType<typeof setTimeout> | null = null
function schedulePoll() {
  if (listTimer) clearTimeout(listTimer)
  if (layers.value.some(l => l.status === 'processing')) listTimer = setTimeout(load, 5000)
}

onMounted(async () => {
  load()
  if (isMinistry.value) {
    try { agencies.value = (await useAgencies().list({ page_size: 200 } as any)).results } catch { /* picker stays empty */ }
  }
})

// ── Upload / replace / retry ──────────────────────────────────────────
type TargetState = 'queued' | 'uploading' | 'processing' | 'ready' | 'failed' | 'skipped'
interface Target { key: string; label: string; requirement: string; state: TargetState; layer?: GeoLayer; error?: string }

const uploadModal = ref(false)
const mode = ref<'new' | 'replace' | 'retry'>('new')
const ctxLayer = ref<GeoLayer | null>(null)
const up = reactive({
  file: null as File | null, name: '', slug: '', requirement: '', agency: '', source_crs: '',
  classification: 'internal' as Classification,
  mapping: {} as Record<string, string>,
  filterRows: [] as FilterRow[],
  extra: [] as string[],
  extraFilters: {} as Record<string, FilterRow[]>,
})
const sniff = ref<FileSniff>({ columns: [], samples: {} })
const reportedColumns = ref<string[]>([])   // learnt from a backend "Available: …" error
const uploading = ref(false)
const progress = ref(0)
const upError = ref<string | null>(null)
const crsHint = ref(false)
const targets = ref<Target[]>([])
const abortCtl = ref<AbortController | null>(null)
const busyReq = ref(false)
// The File objects can't survive a page reload, so retry/replace in the same
// session re-sends the cached one; otherwise the user picks it again.
const fileCache = new Map<string, File>()
let pollTimer: ReturnType<typeof setTimeout> | null = null

const columns = computed(() => [...new Set([...sniff.value.columns, ...reportedColumns.value])])
const primaryReq = computed(() => requirements.value.find(r => r.id === up.requirement) ?? null)
const modalTitle = computed(() => ({ new: 'Upload a GIS layer', replace: 'Replace a GIS layer', retry: 'Retry a GIS layer' })[mode.value])
const submitLabel = computed(() => {
  if (uploading.value) return 'Uploading…'
  if (canReloadStored.value) return 'Reload stored file'
  return mode.value === 'retry' ? 'Retry' : mode.value === 'replace' ? 'Replace' : 'Upload'
})
const allSettled = computed(() => targets.value.every(t => ['ready', 'failed', 'skipped'].includes(t.state)))
// With no file chosen, an existing layer is re-processed from the copy the server stored at upload time.
const canReloadStored = computed(() => mode.value !== 'new' && !!ctxLayer.value && !up.file)
const canSubmit = computed(() => (!!up.file || canReloadStored.value) && !uploading.value && (!targets.value.length || allSettled.value))

const relatedOptions = computed(() => {
  if (mode.value !== 'new' || !primaryReq.value) return []
  const hints = new Map(relatedLayerHints(sniff.value).map(h => [h.key, h.reason]))
  if (!hints.size) return []
  return requirements.value
    .filter(r => r.id !== up.requirement && r.geom_type === primaryReq.value!.geom_type && hints.has(r.key))
    .filter(r => isMinistry.value || r.agency === primaryReq.value!.agency)
    .map(req => ({ req, reason: hints.get(req.key) || '' }))
})

function cacheKey() { return ctxLayer.value?.id || up.requirement || '' }

function openUpload(requirementId: string, layer?: GeoLayer | null) {
  ctxLayer.value = layer ?? null
  mode.value = !layer ? 'new' : layer.status === 'failed' ? 'retry' : 'replace'
  Object.assign(up, {
    file: null, name: layer?.name ?? '', slug: layer?.slug ?? '', requirement: requirementId, agency: '',
    source_crs: layer?.source_crs ?? '', classification: layer?.classification ?? 'internal',
    mapping: { ...(layer?.field_map ?? {}) }, filterRows: filterToRows(layer?.row_filter), extra: [], extraFilters: {},
  })
  // No file in hand: the layer's own attribute list stands in for the columns.
  sniff.value = { columns: layer?.fields ?? [], samples: {} }; reportedColumns.value = []
  targets.value = []; upError.value = null; crsHint.value = false; progress.value = 0
  const cached = fileCache.get(cacheKey())
  if (cached) { up.file = cached; sniffGisFile(cached).then((r) => { sniff.value = r; applySuggestions() }) }
  onPickRequirement()
  uploadModal.value = true
}
function onPickRequirement() {
  const r = primaryReq.value
  if (r && !up.name) up.name = r.name
  applySuggestions()
}
async function onFile(f: File) {
  up.file = f; upError.value = null; crsHint.value = false; reportedColumns.value = []
  sniff.value = await sniffGisFile(f)
  applySuggestions(true)
}
function clearFile() {
  up.file = null; reportedColumns.value = []
  sniff.value = { columns: ctxLayer.value?.fields ?? [], samples: {} }
}
// A ticked layer starts with the filter its file columns suggest (e.g. road_agency = KeRRA).
watch(() => [...up.extra], (ids) => {
  for (const id of ids) {
    const r = requirements.value.find(x => x.id === id)
    if (r && !up.extraFilters[id]) up.extraFilters[id] = suggestedFilterRows(r.key, sniff.value)
  }
})

/** Fill empty mapping slots with the best-matching column; `force` re-suggests slots whose column isn't in the new file. */
function applySuggestions(force = false) {
  for (const f of primaryReq.value?.required_fields ?? []) {
    const cur = up.mapping[f]
    const stale = force && cur && columns.value.length && !columns.value.includes(cur)
    if (!cur || stale) {
      const hit = suggestColumn(f, columns.value)
      up.mapping[f] = hit ? hit.column : ''
    }
  }
}
function mappingNote(f: string): string {
  const col = (up.mapping[f] || '').trim()
  if (!col) return columns.value.length ? 'no matching column found - features without it are skipped' : ''
  if (columns.value.length && !columns.value.includes(col)) return 'not a column in this file'
  if (col === f) return 'same name'
  const hit = suggestColumn(f, columns.value)
  return hit && hit.column === col && !hit.exact ? 'closest match - change if it isn\'t a unique ID' : ''
}

async function stopRequiring(field: string) {
  const r = primaryReq.value
  if (!r) return
  busyReq.value = true
  try {
    await gis.requirements.update(r.id, { required_fields: r.required_fields.filter(f => f !== field) })
    delete up.mapping[field]
    await load()
  } catch (e) { upError.value = errMsg(e, 'Could not update the layer.') }
  finally { busyReq.value = false }
}

function closeUpload() {
  uploadModal.value = false
  if (pollTimer) clearTimeout(pollTimer)
  load()
}

async function submitReload() {
  const layer = ctxLayer.value
  if (!layer) return
  upError.value = null; crsHint.value = false; uploading.value = true
  const t: Target = { key: 'primary', requirement: up.requirement, state: 'uploading', label: layer.name }
  targets.value = [t]
  try {
    t.layer = await gis.layers.reload(layer.id, {
      field_map: buildFieldMap(primaryReq.value?.required_fields ?? [], columns.value, { ...up.mapping }),
      row_filter: rowsToFilter(up.filterRows),
      source_crs: up.source_crs, classification: up.classification,
    })
    t.state = 'processing'
  } catch (e) {
    t.state = 'failed'; t.error = errMsg(e, 'Could not reload the layer.')
    learnFromError(t.error)
  } finally { uploading.value = false }
  pollTargets()
}

async function submitUpload() {
  if (canReloadStored.value) return submitReload()
  const file = up.file
  if (!file) return
  if (isMinistry.value && !up.requirement && !up.agency && mode.value === 'new') { upError.value = 'Choose an agency.'; return }
  upError.value = null; crsHint.value = false; uploading.value = true; progress.value = 0
  abortCtl.value = new AbortController()

  const list: Target[] = [{
    key: 'primary', requirement: up.requirement, state: 'queued',
    label: primaryReq.value?.name || up.name || file.name,
  }]
  for (const id of up.extra) {
    const r = requirements.value.find(x => x.id === id)
    if (r) list.push({ key: id, requirement: id, state: 'queued', label: `${r.agency_code} · ${r.name}` })
  }
  targets.value = list

  for (const t of list) {
    const req = requirements.value.find(r => r.id === t.requirement) ?? null
    const isPrimary = t.key === 'primary'
    // Extras map their own required attributes from the same columns.
    const chosen = isPrimary ? { ...up.mapping } : {}
    const required = req?.required_fields ?? []
    const field_map = buildFieldMap(required, columns.value, chosen)
    const missing = required.filter(f => !(field_map[f] || (columns.value.includes(f))) && columns.value.length)
    if (!isPrimary && missing.length) {
      t.state = 'skipped'; t.error = `No column to use for ${missing.join(', ')} - upload it on its own to map by hand.`
      continue
    }
    t.state = 'uploading'
    try {
      t.layer = await gis.layers.upload({
        file, name: isPrimary ? up.name || undefined : req?.name,
        slug: isPrimary ? up.slug || undefined : undefined,
        requirement: t.requirement || undefined,
        agency: isPrimary ? up.agency || undefined : undefined,
        source_crs: up.source_crs || undefined, classification: up.classification, field_map,
        row_filter: rowsToFilter(isPrimary ? up.filterRows : up.extraFilters[t.requirement] ?? []),
      }, (p) => { progress.value = p }, abortCtl.value.signal)
      t.state = 'processing'
      fileCache.set(isPrimary ? cacheKey() : t.requirement, file)
    } catch (e) {
      t.state = 'failed'; t.error = errMsg(e, 'Could not upload that file.')
      if (isPrimary) learnFromError(t.error)
      if (abortCtl.value?.signal.aborted) break
    }
  }
  uploading.value = false
  abortCtl.value = null
  pollTargets()
}

/** Turn a backend rejection into something the form can act on. */
function learnFromError(msg: string) {
  const cols = parseAvailableColumns(msg)
  if (cols.length) {
    reportedColumns.value = cols
    for (const f of Object.keys(up.mapping)) if (up.mapping[f] && !cols.includes(up.mapping[f])) up.mapping[f] = ''
    applySuggestions()
  }
  if (/source_crs|coordinate reference|\.prj/i.test(msg)) crsHint.value = true
  upError.value = msg
}

function pollTargets() {
  if (pollTimer) clearTimeout(pollTimer)
  if (!targets.value.some(t => t.state === 'processing')) { load(); return }
  pollTimer = setTimeout(async () => {
    for (const t of targets.value.filter(x => x.state === 'processing' && x.layer)) {
      try {
        t.layer = await gis.layers.detail(t.layer!.id)
        if (t.layer.status === 'ready') t.state = 'ready'
        else if (t.layer.status === 'failed') {
          t.state = 'failed'; t.error = t.layer.fatal_error || 'The file could not be loaded.'
          if (t.key === 'primary') learnFromError(t.error)
        }
      } catch { /* try again next tick */ }
    }
    pollTargets()
  }, 2000)
}
onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer)
  if (listTimer) clearTimeout(listTimer)
})

// ── Details / delete ──────────────────────────────────────────────────
const detailsModal = ref(false)
const detail = ref<GeoLayer | null>(null)
const detailError = ref<string | null>(null)
async function openDetails(id: string) {
  detail.value = null; detailError.value = null; detailsModal.value = true
  try { detail.value = await gis.layers.detail(id) } catch (e) { detailError.value = errMsg(e, 'Could not load the layer.') }
}
const confirmDelete = ref<GeoLayer | null>(null)
const deleting = ref(false)
async function doDelete() {
  if (!confirmDelete.value) return
  deleting.value = true
  try {
    await gis.layers.remove(confirmDelete.value.id)
    fileCache.delete(confirmDelete.value.id)
    confirmDelete.value = null
    await load()
  } catch (e) { loadError.value = errMsg(e, 'Could not delete the layer.'); confirmDelete.value = null }
  finally { deleting.value = false }
}

// ── Request an upload ─────────────────────────────────────────────────
const requestModal = ref(false)
const reqTarget = ref<GeoLayerRequirement | null>(null)
const rq = reactive({ assignee: '', due_date: '', message: '' })
const assignable = ref<User[]>([])
const rqBusy = ref(false)
const rqError = ref<string | null>(null)

async function openRequest(r: GeoLayerRequirement) {
  reqTarget.value = r
  Object.assign(rq, { assignee: '', due_date: '', message: '' })
  rqError.value = null; assignable.value = []; requestModal.value = true
  try {
    const res = await useUsers().list({ agency: r.agency, is_active: true, page_size: 200 } as any)
    assignable.value = res.results.filter(u => ['operator', 'analyst', 'admin'].includes(u.role_type))
  } catch (e) { rqError.value = errMsg(e, 'Could not load users.') }
}
async function submitRequest() {
  if (!reqTarget.value) return
  rqBusy.value = true; rqError.value = null
  try {
    await gis.requirements.requestUpload(reqTarget.value.id, {
      assignee: rq.assignee, message: rq.message || undefined, due_date: rq.due_date || undefined,
    })
    requestModal.value = false
    await load()
  } catch (e) { rqError.value = errMsg(e, 'Could not send the request.') }
  finally { rqBusy.value = false }
}
async function cancelRequest(id: string) {
  try { await gis.requests.cancel(id); await load() } catch (e) { loadError.value = errMsg(e, 'Could not cancel.') }
}

// ── New expected layer ────────────────────────────────────────────────
const reqModal = ref(false)
const nr = reactive({ agency: '', name: '', geom_type: 'LineString' as 'Point' | 'LineString' | 'Polygon', fields: '', description: '' })
const nrBusy = ref(false)
const nrError = ref<string | null>(null)
async function submitRequirement() {
  nrBusy.value = true; nrError.value = null
  try {
    await gis.requirements.create({
      name: nr.name, geom_type: nr.geom_type, description: nr.description,
      required_fields: nr.fields.split(',').map(s => s.trim()).filter(Boolean),
      agency: isMinistry.value ? nr.agency || undefined : undefined,
    })
    reqModal.value = false
    Object.assign(nr, { agency: '', name: '', fields: '', description: '' })
    await load()
  } catch (e) { nrError.value = errMsg(e, 'Could not add the layer.') }
  finally { nrBusy.value = false }
}
</script>

<style scoped>
.gis-panel { display: flex; flex-direction: column; gap: 16px; }
.gis-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.gis-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.gis-h { margin: 0 0 8px; font-size: 14px; }
.gis-head .gis-h { margin: 0; }
.gis-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.gis-table th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--fg-3); padding: 6px 8px; border-bottom: 1px solid var(--border-subtle); }
.gis-table td { padding: 8px; border-bottom: 1px solid var(--border-subtle); vertical-align: top; }
.gis-row-actions { white-space: nowrap; display: flex; gap: 6px; }
.gis-assignee { display: block; }
.gis-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.gis-list li { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.gis-err { color: var(--danger-fg); }
.gis-related { margin-top: 8px; }
.gis-related-filter { margin: 6px 0 0 24px; }
.gis-warn { color: var(--warning-fg); }
.gis-note { margin: 0 0 10px; }
.gis-map { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-subtle); }
.gis-map-row { display: grid; grid-template-columns: auto auto 1fr; gap: 8px; align-items: center; margin-top: 6px; }
.gis-map-note { grid-column: 3; margin-top: -4px; }
.gis-check { display: flex; gap: 8px; align-items: flex-start; margin-top: 8px; font-size: 13px; }
.gis-targets { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.gis-target-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.gis-chip { display: inline-block; margin: 0 6px 6px 0; padding: 1px 6px; border: 1px solid var(--border-subtle); border-radius: 4px; font-size: 12px; }
.gis-errors { margin: 8px 0 0; padding-left: 18px; font-size: 12px; }
</style>
