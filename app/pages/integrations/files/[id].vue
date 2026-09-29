<template>
  <PageHeader
    :eyebrow="upload?.source_id || (upload?.status === 'unrouted' ? 'Routing queue' : 'File')"
    :title="upload?.original_filename || 'Loading…'"
    :subtitle="headerSubtitle"
  >
    <template #breadcrumb>
      <NuxtLink to="/integrations/files" class="ih-crumb">← Files &amp; Feeds</NuxtLink>
    </template>
    <template #actions>
      <button class="btn" :disabled="downloading || !upload" @click="download">
        {{ downloading ? 'Preparing…' : 'Download original' }}
      </button>
      <div ref="replaceMenuEl" class="replace-menu">
        <button
          class="btn" :disabled="!upload" :aria-expanded="showReplaceMenu" aria-haspopup="true"
          @click="showReplaceMenu = !showReplaceMenu" @keydown.esc="showReplaceMenu = false"
        >Replace ▾</button>
        <div v-if="showReplaceMenu" class="replace-dropdown" @keydown.esc="showReplaceMenu = false">
          <button class="replace-option" @click="openReplace">Upload a correction</button>
        </div>
      </div>
      <input ref="replaceFileInput" type="file" accept=".xlsx,.csv" hidden @change="onReplaceFileSelected" />
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>
  <div v-if="replacing" class="upload-banner upload-banner-info">Uploading replacement… {{ replaceProgress }}%</div>
  <div v-if="upload?.duplicate_of" class="upload-banner upload-banner-warning">
    ⚠ This exact file matches an earlier upload.
    <NuxtLink :to="`/integrations/files/${upload.duplicate_of}`">View it</NuxtLink>
  </div>
  <div v-if="upload?.superseded_by" class="upload-banner upload-banner-info">
    ⤺ This upload was replaced by a correction.
    <NuxtLink :to="`/integrations/files/${upload.superseded_by}`">View the replacement</NuxtLink>
  </div>

  <!-- KPI ribbon - status+elapsed · rows parsed · written to DB · duplicates · rejected.
       An un-routed file has none of those numbers yet; show what it does have. -->
  <div v-if="upload && upload.status === 'unrouted'" class="ih-ribbon ih-rise">
    <div class="status-elapsed-tile" aria-live="polite">
      <div class="kpi-tile-label">Status</div>
      <IngestStatusPill :status="upload.status" />
      <div class="kpi-tile-sub">{{ elapsedLabel }}</div>
    </div>
    <KpiTile label="Size" :value="fmtBytes(upload.size_bytes)" />
    <KpiTile label="Sheets" :value="upload.sheet_count ?? '-'" />
    <KpiTile label="Detected columns" :value="upload.detected_headers.length || '-'" sub="peeked from the file" />
  </div>
  <div v-else-if="upload" class="ih-ribbon ih-rise">
    <div class="status-elapsed-tile" aria-live="polite">
      <div class="kpi-tile-label">Status</div>
      <IngestStatusPill :status="upload.status" />
      <div class="kpi-tile-sub">{{ elapsedLabel }}</div>
    </div>
    <KpiTile label="Rows parsed" :value="upload.total_rows.toLocaleString('en-KE')" />
    <KpiTile label="Written to DB" :value="upload.domain_records_created.toLocaleString('en-KE')" />
    <KpiTile label="Duplicates" :value="upload.duplicate_rows.toLocaleString('en-KE')" />
    <KpiTile label="Rejected" :value="upload.error_rows.toLocaleString('en-KE')" />
  </div>

  <div v-if="upload" class="detail-layout ih-rise ih-rise-2">
    <div class="detail-main">
      <RoutePanel
        v-if="upload.status === 'unrouted'"
        :upload-id="upload.id" :detected-headers="upload.detected_headers" :agency-code="upload.agency_code"
        @routed="onRouted"
      />
      <template v-else>
      <TabStrip
        :tabs="[
          { key: 'sample', label: 'Sample', disabled: gateOnMapping, disabledReason: 'Map columns for this file first' },
          { key: 'validation', label: 'Validation', count: upload.error_rows, disabled: gateOnMapping, disabledReason: 'Map columns for this file first' },
          { key: 'mapping', label: 'Mapping' },
          { key: 'dbmatches', label: 'DB matches', disabled: gateOnMapping, disabledReason: 'Map columns for this file first' },
        ]"
        v-model="activeTab"
      />

      <!-- ── Sample tab ─────────────────────────────────────────────── -->
      <div v-if="activeTab === 'sample'" class="card">
        <div class="card-body">
          <div v-if="preview" class="sheet-tabs">
            <button
              v-for="s in preview.sheets" :key="s.name" class="btn sheet-tab-btn"
              :class="{ active: previewSheet === s.name, unrecognised: !s.recognised }"
              @click="previewSheet = s.name"
            >{{ s.name }}<span v-if="!s.recognised" class="hint"> (not read by this template)</span></button>
          </div>
          <SampleGrid
            :columns="preview?.active?.columns ?? []" :rows="preview?.active?.rows ?? []"
            :start-row-number="previewOffset + DATA_START_ROW" :row-errors="rowErrorsBySourceRow"
            :loading="previewLoading"
          />
          <div v-if="preview?.active" class="preview-pager">
            <button class="btn" :disabled="previewOffset === 0" @click="previewOffset = Math.max(0, previewOffset - PREVIEW_LIMIT); loadPreview()">← Prev {{ PREVIEW_LIMIT }}</button>
            <span class="hint">Rows {{ previewOffset + 1 }}–{{ previewOffset + preview.active.rows.length }}</span>
            <button class="btn" :disabled="preview.active.rows.length < PREVIEW_LIMIT" @click="previewOffset += PREVIEW_LIMIT; loadPreview()">Next {{ PREVIEW_LIMIT }} →</button>
          </div>
        </div>
      </div>

      <!-- ── Validation tab ─────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'validation'" class="card">
        <div class="card-body">
          <template v-if="errorTypeSummary.length">
            <SectionTitle>What's wrong, grouped</SectionTitle>
            <p v-if="upload.error_rows > upload.validation_report.length" class="hint" style="margin-bottom:8px">
              Showing the first {{ upload.validation_report.length.toLocaleString('en-KE') }} error row(s) of {{ upload.error_rows.toLocaleString('en-KE') }}.
            </p>
            <ul class="error-summary-list">
              <li v-for="s in errorTypeSummary" :key="s.message">
                <strong>{{ s.count.toLocaleString('en-KE') }}</strong> row(s): {{ s.message }}
              </li>
            </ul>
          </template>

          <div class="row-filters">
            <button
              v-for="f in ROW_FILTERS" :key="f.value" class="btn row-filter-btn"
              :class="{ active: rowStatusFilter === f.value }"
              @click="rowStatusFilter = f.value; rowsPage = 1; loadRows()"
            >{{ f.label }}</button>
          </div>

          <EmptyState v-if="!rowsLoading && !rows.length" message="No rows match this filter." />
          <table v-else class="ih-table">
            <thead><tr><th>#</th><th>Status</th><th>Data</th></tr></thead>
            <tbody>
              <tr v-for="r in rows" :key="r.id">
                <td class="mono-sm">{{ r.source_row ?? '-' }}</td>
                <td>
                  <span v-if="r.row_status === 'error'" class="row-status danger">✕ {{ r.row_errors.map(e => e.message).join('; ') }}</span>
                  <span v-else-if="r.row_status === 'duplicate_in_file'" class="row-status warning">⚠ same key as an earlier row in this file</span>
                  <span v-else-if="r.row_status === 'duplicate_in_db'" class="row-status warning">⚠ already recorded from an earlier upload</span>
                  <span v-else-if="r.target_model" class="row-status success">✓ {{ modelLabel(r.target_model) }} #{{ r.target_pk.slice(0, 8) }}</span>
                  <span v-else-if="r.handler_error" class="row-status danger">✕ {{ r.handler_error }}</span>
                  <span v-else class="hint">○ not yet committed</span>
                </td>
                <td class="mono-sm row-data-cell">{{ rowSummary(r) }}</td>
              </tr>
            </tbody>
          </table>
          <TablePagination
            v-if="rowsTotal > ROWS_PAGE_SIZE"
            :page="rowsPage" :total-pages="Math.ceil(rowsTotal / ROWS_PAGE_SIZE)" :total="rowsTotal"
            @prev="rowsPage > 1 && (rowsPage--, loadRows())"
            @next="rowsPage < Math.ceil(rowsTotal / ROWS_PAGE_SIZE) && (rowsPage++, loadRows())"
          />
        </div>
      </div>

      <!-- ── Mapping tab (Track B) ─────────────────────────────────── -->
      <div v-else-if="activeTab === 'mapping'" class="card">
        <div class="card-body">
          <template v-if="upload.status === 'needs_mapping'">
            <SectionTitle>Map this file's columns</SectionTitle>
            <p class="hint" style="margin-bottom:14px">
              This file's headers don't match the current template. Match each field below to
              one of this file's columns. Best guesses are pre-filled, but check them before applying.
            </p>
            <div class="mapping-table">
              <div class="mapping-row mapping-header"><span>Our field</span><span>Maps to</span></div>
              <div v-for="col in expectedColumns" :key="col.header" class="mapping-row">
                <span>
                  {{ col.header }}<span v-if="col.required" class="mapping-required">*</span>
                  <span v-if="col.example" class="hint"> (e.g. {{ col.example }})</span>
                </span>
                <select v-model="mappingSelections[col.header]" class="select-sm">
                  <option value="">Ignore</option>
                  <option v-for="h in upload.detected_headers" :key="h" :value="h">{{ h }}</option>
                </select>
              </div>
            </div>
            <div v-if="unmappedRequired.length" class="upload-banner upload-banner-warning">
              ⚠ Required field(s) not mapped: {{ unmappedRequired.map(c => c.header).join(', ') }}
            </div>
            <label class="mapping-save">
              <input v-model="saveMappingForAgency" type="checkbox" />
              Save this mapping for future uploads from {{ upload.agency_code }}
            </label>
            <button
              class="btn btn-primary" style="margin-top:12px"
              :disabled="applyingMapping || !!unmappedRequired.length"
              @click="applyMapping"
            >{{ applyingMapping ? 'Applying…' : 'Apply mapping' }}</button>
          </template>
          <template v-else-if="upload.source_track === 'mapped'">
            <SectionTitle>Column mapping used</SectionTitle>
            <p class="hint" style="margin-bottom:10px">This file was read using a saved/human-supplied column mapping, not the exact template headers.</p>
            <div class="mapping-table">
              <div class="mapping-row mapping-header"><span>Our field</span><span>Their column</span></div>
              <div v-for="(actual, expected) in upload.column_map" :key="expected" class="mapping-row">
                <span>{{ expected }}</span><span class="mono-sm">{{ actual }}</span>
              </div>
            </div>
          </template>
          <EmptyState v-else message="This file matched the template exactly. No column mapping was needed." />
        </div>
      </div>

      <!-- ── DB matches tab ───────────────────────────────────────────── -->
      <div v-else class="card">
        <div class="card-body">
          <SectionTitle>Written to</SectionTitle>
          <EmptyState v-if="!upload.written_to.length" compact message="Nothing written yet. Commit this upload to populate domain tables." />
          <div v-else class="chip-row" style="margin-bottom:14px">
            <button
              v-for="w in upload.written_to" :key="w.target_model" class="written-to-chip written-to-chip--btn"
              :class="{ active: dbMatchModel === w.target_model }"
              @click="loadDbMatches(w.target_model)"
            >{{ modelLabel(w.target_model) }} <strong>{{ w.count.toLocaleString('en-KE') }}</strong></button>
          </div>

          <div v-if="upload.covers_breakdown.length">
            <SectionTitle pill="who the data is about">Covers</SectionTitle>
            <div class="chip-row" style="margin-bottom:14px">
              <span v-for="c in upload.covers_breakdown" :key="c.payload__road_agency_code" class="written-to-chip">
                {{ c.payload__road_agency_code }} <strong>{{ c.count.toLocaleString('en-KE') }}</strong>
              </span>
            </div>
          </div>

          <template v-if="dbMatchModel">
            <EmptyState v-if="!dbMatchLoading && !dbMatchRows.length" compact message="No rows for this table." />
            <table v-else class="ih-table">
              <thead><tr><th>#</th><th>Record</th><th>Data</th></tr></thead>
              <tbody>
                <tr v-for="r in dbMatchRows" :key="r.id">
                  <td class="mono-sm">{{ r.source_row ?? '-' }}</td>
                  <td class="mono-sm">#{{ r.target_pk.slice(0, 8) }}</td>
                  <td class="mono-sm row-data-cell">{{ rowSummary(r) }}</td>
                </tr>
              </tbody>
            </table>
            <TablePagination
              v-if="dbMatchTotal > ROWS_PAGE_SIZE"
              :page="dbMatchPage" :total-pages="Math.ceil(dbMatchTotal / ROWS_PAGE_SIZE)" :total="dbMatchTotal"
              @prev="dbMatchPage > 1 && (dbMatchPage--, loadDbMatches(dbMatchModel!))"
              @next="dbMatchPage < Math.ceil(dbMatchTotal / ROWS_PAGE_SIZE) && (dbMatchPage++, loadDbMatches(dbMatchModel!))"
            />
          </template>
        </div>
      </div>
      </template>
    </div>

    <div class="detail-rail">
      <div class="card">
        <div class="card-body">
          <SectionTitle>Batch details</SectionTitle>
          <dl class="file-meta">
            <dt>Feed</dt><dd class="mono-sm">{{ upload.source_id || 'Not routed yet' }}</dd>
            <dt>Format</dt><dd>{{ fileFormat }}</dd>
            <dt>Size</dt><dd>{{ fmtBytes(upload.size_bytes) }}</dd>
            <dt v-if="upload.sheet_count !== null">Sheets</dt><dd v-if="upload.sheet_count !== null">{{ upload.sheet_count }}</dd>
            <dt>Submitted by</dt><dd>{{ upload.agency_code }} - {{ upload.agency_name }}</dd>
            <dt>Uploaded by</dt><dd>{{ upload.uploaded_by_email || '-' }}</dd>
            <dt>Period</dt><dd>{{ upload.period_label || '-' }}</dd>
            <dt>Content hash</dt><dd class="mono-sm hash-cell">{{ upload.content_hash || '-' }}</dd>
            <dt>Corrects</dt>
            <dd>
              <NuxtLink v-if="upload.supersedes" :to="`/integrations/files/${upload.supersedes}`">View original upload</NuxtLink>
              <span v-else class="hint">-</span>
            </dd>
          </dl>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <SectionTitle>Timeline</SectionTitle>
          <UploadTimeline
            :steps="[
              { label: 'Uploaded', at: upload.created_at },
              { label: 'Commit started', at: upload.commit_started_at },
              { label: 'Committed', at: upload.committed_at },
            ]"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- ── Pinned action bar ────────────────────────────────────────────── -->
  <!-- Un-routed uploads drive their next step from RoutePanel, not here. -->
  <div v-if="upload && upload.status !== 'unrouted'" class="action-bar">
    <div v-if="upload.validation_error || upload.commit_error" class="upload-banner upload-banner-error" style="margin:0 0 10px">
      ⚠ {{ upload.validation_error || upload.commit_error }}
    </div>
    <div v-if="confirmingCommit" class="commit-confirm">
      <span>This will write {{ upload.valid_rows.toLocaleString('en-KE') }} row(s) to the domain tables for <strong>{{ upload.source_id }}</strong>. This can't be undone.</span>
      <div class="commit-confirm-actions">
        <button class="btn" @click="confirmingCommit = false">Cancel</button>
        <button class="btn btn-primary" :disabled="committing" @click="commit">{{ committing ? 'Committing…' : 'Confirm commit' }}</button>
      </div>
    </div>
    <div v-else class="action-bar-row">
      <template v-if="upload.status === 'needs_mapping'">
        <button class="btn btn-primary" @click="activeTab = 'mapping'">Review mapping →</button>
      </template>
      <template v-else-if="upload.status === 'validated'">
        <button v-if="upload.duplicate_rows" class="btn" :disabled="includingDuplicates" @click="includeDuplicates">
          {{ includingDuplicates ? 'Including…' : `Include ${upload.duplicate_rows} duplicate row(s)` }}
        </button>
        <button class="btn btn-primary" :disabled="!upload.valid_rows" @click="confirmingCommit = true">
          Commit {{ upload.valid_rows.toLocaleString('en-KE') }} row(s)
        </button>
      </template>
      <template v-else-if="['rejected', 'failed', 'partial'].includes(upload.status)">
        <button class="btn btn-primary" @click="openReplace">Upload a correction</button>
      </template>
      <span v-else class="hint">{{ statusMeta(upload.status).label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { useIntegrations } from '~/composables/api'
import type { DataUploadDetail, ExpectedColumn, FieldError, IngestedRecord, IngestedRowStatus, PreviewResult } from '~/composables/api'
// Explicit import - see the note in integrations.vue for why this isn't
// left to the app/utils auto-import for template-only references.
import { isInFlight, statusMeta } from '~/utils/ingestStatus'

const route = useRoute()
const router = useRouter()
const api = useIntegrations()
const uploadId = route.params.id as string

const DATA_START_ROW = 2 // mirrors apps.integrations.xlsx_templates.DATA_START_ROW

const upload = ref<DataUploadDetail | null>(null)
const error = ref<string | null>(null)
const downloading = ref(false)
const committing = ref(false)
const confirmingCommit = ref(false)
const includingDuplicates = ref(false)
const showReplaceMenu = ref(false)
const replaceMenuEl = ref<HTMLElement | null>(null)
onClickOutside(replaceMenuEl, () => { showReplaceMenu.value = false })
const replacing = ref(false)
const replaceProgress = ref(0)
const replaceFileInput = ref<HTMLInputElement | null>(null)

const activeTab = ref('sample')
const gateOnMapping = computed(() => upload.value?.status === 'needs_mapping')

const headerSubtitle = computed(() => {
  if (!upload.value) return ''
  const parts = [upload.value.agency_code, upload.value.source_id || 'unrouted']
  if (upload.value.period_label) parts.push(upload.value.period_label)
  if (upload.value.uploaded_by_email) parts.push(upload.value.uploaded_by_email)
  parts.push(fmtDate(upload.value.created_at))
  return parts.join(' · ')
})

const fileFormat = computed(() => {
  const name = upload.value?.original_filename.toLowerCase() ?? ''
  if (name.endsWith('.xlsx')) return 'Excel (.xlsx)'
  if (name.endsWith('.csv')) return 'CSV'
  return '-'
})

const now = ref(Date.now())
let nowTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => { nowTimer = setInterval(() => { now.value = Date.now() }, 30_000) })
onUnmounted(() => { if (nowTimer) clearInterval(nowTimer) })

const elapsedLabel = computed(() => {
  if (!upload.value) return ''
  const start = new Date(upload.value.created_at).getTime()
  const end = upload.value.committed_at ? new Date(upload.value.committed_at).getTime() : now.value
  const mins = Math.max(0, Math.round((end - start) / 60_000))
  const label = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h ${mins % 60}m` : `${Math.round(mins / 1440)}d`
  return upload.value.committed_at ? `took ${label}` : `${label} elapsed`
})

// ── Poll while in-flight ─────────────────────────────────────────────
async function load() {
  try {
    upload.value = await api.uploads.detail(uploadId)
    error.value = null
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not load this upload.'
  }
}
const poll = useUploadPoll(load, () => !!upload.value && isInFlight(upload.value.status))

let openedDefaultTab = false
watch(() => upload.value?.status, (statusNow) => {
  // "unrouted" has no tabs - RoutePanel owns the whole main column.
  if (!openedDefaultTab && statusNow && statusNow !== 'unrouted') {
    openedDefaultTab = true
    activeTab.value = statusNow === 'needs_mapping' ? 'mapping' : 'sample'
  }
  if (statusNow === 'needs_mapping') loadMappingForm()
})

// RoutePanel just assigned a feed - the upload is now "pending" and will
// march through validating → validated. Reload and resume polling so the
// page follows it without a manual refresh.
async function onRouted() {
  await load()
  poll.start()
}

// ── Mapping tab (Track B) - client-side best-guess only, always
// human-editable before applying. See app/pages/integrations/files/[id].vue
// history for the original inline version this was ported from verbatim.
const expectedColumns = ref<ExpectedColumn[]>([])
const mappingSelections = ref<Record<string, string>>({})
const saveMappingForAgency = ref(true)
const applyingMapping = ref(false)
const unmappedRequired = computed(() => expectedColumns.value.filter(c => c.required && !mappingSelections.value[c.header]))

function normalize(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]/g, '') }
function acronymOf(s: string): string { return s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(w => w[0]).join('').toLowerCase() }
function headerSimilarity(expected: string, actual: string): number {
  const ne = normalize(expected)
  const na = normalize(actual)
  if (!ne || !na) return 0
  if (ne === na) return 1
  if (ne.includes(na) || na.includes(ne)) return 0.75
  if (acronymOf(expected) === na || acronymOf(actual) === ne) return 0.7
  const setE = new Set(ne)
  const setA = new Set(na)
  const intersection = [...setE].filter(c => setA.has(c)).length
  const union = new Set([...setE, ...setA]).size
  return union ? intersection / union : 0
}
function bestGuessMapping(expected: ExpectedColumn[], actual: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  const used = new Set<string>()
  for (const col of expected) {
    let best = ''
    let bestScore = 0.4
    for (const a of actual) {
      if (used.has(a)) continue
      const score = headerSimilarity(col.header, a)
      if (score > bestScore) { bestScore = score; best = a }
    }
    if (best) { map[col.header] = best; used.add(best) }
  }
  return map
}

async function loadMappingForm() {
  // Only ever reached for status="needs_mapping", which always has a source.
  if (!upload.value?.source_id) return
  try {
    expectedColumns.value = await api.uploads.expectedColumns(upload.value.source_id)
    const guesses = bestGuessMapping(expectedColumns.value, upload.value.detected_headers)
    mappingSelections.value = Object.fromEntries(expectedColumns.value.map(c => [c.header, guesses[c.header] || '']))
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not load the mapping form.'
  }
}

async function applyMapping() {
  if (!upload.value) return
  const columnMap = Object.fromEntries(Object.entries(mappingSelections.value).filter(([, actual]) => actual))
  applyingMapping.value = true
  error.value = null
  try {
    await api.uploads.applyMapping(uploadId, columnMap, saveMappingForAgency.value)
    await load()
    poll.start()
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not apply this mapping.'
  } finally {
    applyingMapping.value = false
  }
}

// ── Actions ──────────────────────────────────────────────────────────
async function download() {
  if (!upload.value) return
  downloading.value = true
  try {
    const blob = await api.uploads.download(uploadId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = upload.value.original_filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    error.value = e?.message || 'Could not download this file.'
  } finally {
    downloading.value = false
  }
}

async function commit() {
  committing.value = true
  error.value = null
  try {
    await api.uploads.commit(uploadId)
    confirmingCommit.value = false
    await load()
    poll.start()
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not commit this upload.'
  } finally {
    committing.value = false
  }
}

async function includeDuplicates() {
  includingDuplicates.value = true
  try {
    await api.uploads.includeDuplicates(uploadId)
    await load()
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not include duplicates.'
  } finally {
    includingDuplicates.value = false
  }
}

function openReplace() {
  showReplaceMenu.value = false
  replaceFileInput.value?.click()
}

async function onReplaceFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !upload.value) return
  replacing.value = true
  replaceProgress.value = 0
  error.value = null
  try {
    let declaredSchemaVersion: string | null = null
    if (file.name.toLowerCase().endsWith('.csv') && upload.value.source_id) {
      const source = await api.get(upload.value.source_id)
      declaredSchemaVersion = source.schema_version
    }
    const newUpload = await api.uploads.replace(uploadId, file, declaredSchemaVersion, (pct) => { replaceProgress.value = pct })
    router.push(`/integrations/files/${newUpload.id}`)
  } catch (e: any) {
    error.value = e?.message || 'Could not upload the replacement file.'
  } finally {
    replacing.value = false
    input.value = ''
  }
}

// ── Validation tab ───────────────────────────────────────────────────
const ROWS_PAGE_SIZE = 25
const ROW_FILTERS: { value: IngestedRowStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'valid', label: '✓ Valid' },
  { value: 'duplicate_in_file', label: '⚠ Dup (file)' },
  { value: 'duplicate_in_db', label: '⚠ Dup (DB)' },
  { value: 'error', label: '✕ Error' },
]
const rowStatusFilter = ref<IngestedRowStatus>('')
const rows = ref<IngestedRecord[]>([])
const rowsPage = ref(1)
const rowsTotal = ref(0)
const rowsLoading = ref(false)

async function loadRows() {
  rowsLoading.value = true
  try {
    const res = await api.records({ upload_id: uploadId, row_status: rowStatusFilter.value || undefined, page: rowsPage.value, page_size: ROWS_PAGE_SIZE })
    rows.value = res.results
    rowsTotal.value = res.count
  } catch { /* a Rows-tab failure shouldn't blank the rest of the page */ } finally {
    rowsLoading.value = false
  }
}

const errorTypeSummary = computed(() => {
  if (!upload.value) return []
  const counts = new Map<string, number>()
  for (const row of upload.value.validation_report) {
    for (const e of row.errors) counts.set(e.message, (counts.get(e.message) ?? 0) + 1)
  }
  return [...counts.entries()].map(([message, count]) => ({ message, count })).sort((a, b) => b.count - a.count).slice(0, 10)
})

const rowErrorsBySourceRow = computed(() => {
  const map: Record<number, FieldError[]> = {}
  if (upload.value) for (const row of upload.value.validation_report) map[row.row] = row.errors
  return map
})

function rowSummary(r: IngestedRecord): string {
  if (!r.payload || typeof r.payload !== 'object') return ''
  return Object.entries(r.payload as Record<string, unknown>).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join('  ·  ')
}

// ── DB matches tab ───────────────────────────────────────────────────
const dbMatchModel = ref<string | null>(null)
const dbMatchRows = ref<IngestedRecord[]>([])
const dbMatchPage = ref(1)
const dbMatchTotal = ref(0)
const dbMatchLoading = ref(false)

async function loadDbMatches(targetModel: string) {
  if (dbMatchModel.value !== targetModel) dbMatchPage.value = 1
  dbMatchModel.value = targetModel
  dbMatchLoading.value = true
  try {
    const res = await api.records({ upload_id: uploadId, target_model: targetModel, page: dbMatchPage.value, page_size: ROWS_PAGE_SIZE })
    dbMatchRows.value = res.results
    dbMatchTotal.value = res.count
  } catch { /* non-fatal */ } finally {
    dbMatchLoading.value = false
  }
}

// ── Sheets/Sample tab ────────────────────────────────────────────────
const PREVIEW_LIMIT = 50
const preview = ref<PreviewResult | null>(null)
const previewSheet = ref<string | undefined>(undefined)
const previewOffset = ref(0)
const previewLoading = ref(false)

async function loadPreview() {
  previewLoading.value = true
  try {
    preview.value = await api.uploads.preview(uploadId, { sheet: previewSheet.value, offset: previewOffset.value, limit: PREVIEW_LIMIT })
    if (!previewSheet.value && preview.value.active) previewSheet.value = preview.value.active.name
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not load a preview of this file.'
  } finally {
    previewLoading.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'validation' && !rows.value.length) loadRows()
  if (tab === 'sample' && !preview.value) loadPreview()
})
watch(previewSheet, () => { previewOffset.value = 0; loadPreview() })

function modelLabel(m: string): string { return m.split('.').pop() || m }
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtBytes(bytes: number): string {
  if (!bytes) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

onMounted(async () => {
  await load()
  poll.start()
  loadRows()
})
</script>

<style scoped>
.replace-menu { position: relative; display: inline-block; }
.replace-dropdown {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 20;
  background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--r-sm);
  box-shadow: var(--elev-2); min-width: 180px; padding: 4px;
}
.replace-option { display: block; width: 100%; text-align: left; background: none; border: none; padding: 8px 10px; font-size: 12.5px; color: var(--fg-1); cursor: pointer; border-radius: var(--r-xs); }
.replace-option:hover { background: var(--surface-quiet); }

.status-elapsed-tile {
  background: var(--surface-1); border: 1px solid var(--border-subtle); border-radius: var(--r-md);
  padding: 14px 16px; box-shadow: var(--elev-1); display: flex; flex-direction: column; gap: 6px; align-items: flex-start;
}
.kpi-tile-label { font-size: 11px; color: var(--fg-3); font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
.kpi-tile-sub { font-size: 11px; color: var(--fg-3); }

.detail-layout { display: grid; grid-template-columns: 1fr 300px; gap: 16px; align-items: start; margin-bottom: 70px; }
.detail-rail { display: flex; flex-direction: column; gap: 12px; }
@media (max-width: 900px) { .detail-layout { grid-template-columns: 1fr; } }

.sheet-tabs { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.sheet-tab-btn { font-size: 11.5px; padding: 4px 10px; }
.sheet-tab-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.sheet-tab-btn.unrecognised { opacity: 0.55; }
.preview-pager { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 12px 0 2px; }

.error-summary-list { margin: 8px 0 16px; padding-left: 18px; font-size: 12.5px; color: var(--fg-2); display: flex; flex-direction: column; gap: 4px; }

.row-filters { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.row-filter-btn { font-size: 11.5px; padding: 4px 10px; }
.row-filter-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }

/* Validation / DB-matches tabs pack multi-line cell content - top-align
   overrides the shared .ih-table's middle-align for this page only. */
.ih-table td { vertical-align: top; }
.row-status.success { color: var(--success-fg); }
.row-status.warning { color: var(--warning-fg); }
.row-status.danger { color: var(--danger-fg); }
.row-data-cell { color: var(--fg-3); max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
.written-to-chip {
  background: var(--bg); border: 1px solid var(--border-subtle); border-radius: var(--r-pill);
  padding: 4px 12px; color: var(--fg-2); font-size: 12.5px;
}
.written-to-chip--btn { cursor: pointer; }
.written-to-chip--btn:hover, .written-to-chip--btn.active { border-color: var(--primary); color: var(--primary); }

.file-meta { display: grid; grid-template-columns: 100px 1fr; row-gap: 10px; column-gap: 10px; font-size: 12.5px; margin: 0; }
.file-meta dt { color: var(--fg-3); }
.file-meta dd { margin: 0; color: var(--fg-1); overflow-wrap: anywhere; }
.hash-cell { font-size: 10.5px; }

.mapping-table { border: 1px solid var(--border-subtle); border-radius: var(--r-sm); overflow: hidden; margin-bottom: 12px; }
.mapping-row { display: grid; grid-template-columns: 1fr 220px; gap: 12px; align-items: center; padding: 8px 12px; font-size: 13px; border-top: 1px solid var(--border-subtle); }
.mapping-row:first-child { border-top: none; }
.mapping-header { background: var(--bg); font-weight: 600; color: var(--fg-3); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.mapping-required { color: var(--danger-fg); margin-left: 2px; }
.mapping-save { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--fg-2); }

.upload-banner { border-radius: var(--r-sm); padding: 10px 12px; font-size: 12px; margin: 10px 0; }
.upload-banner-error { background: var(--danger-bg); border: 1px solid var(--danger-fg); color: var(--danger-fg); }
.upload-banner-warning { background: var(--warning-bg); border: 1px solid var(--warning-fg); color: var(--warning-fg); }
.upload-banner-info { background: var(--info-bg); border: 1px solid var(--info-fg); color: var(--info-fg); }

.action-bar {
  position: sticky; bottom: 12px; left: 0; right: 0; z-index: 10;
  background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--r-md);
  box-shadow: var(--elev-2); padding: 12px 16px;
}
.action-bar-row { display: flex; gap: 10px; align-items: center; }
.commit-confirm { display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 12.5px; color: var(--fg-1); flex-wrap: wrap; }
.commit-confirm-actions { display: flex; gap: 8px; flex-shrink: 0; }
</style>
