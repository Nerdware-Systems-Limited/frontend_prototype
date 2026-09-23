<template>
  <PageHeader
    eyebrow="Report Centre"
    title="Reports"
    subtitle="Generate scheduled and on-demand reports - download PDF or XLSX across all UAPTS modules"
  >
    <template #actions>
      <span class="freshness-badge">{{ runs.length ? `${runs.length} recent runs` : 'No recent runs' }}</span>
      <button class="btn-primary" @click="showGenerateModal = true">+ Generate Report</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Generate modal -->
  <div v-if="showGenerateModal" class="modal-backdrop" @click.self="showGenerateModal = false">
    <div class="modal">
      <div class="modal-header">
        Generate Report
        <button class="modal-close" @click="showGenerateModal = false">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Template</label>
          <select v-model="genForm.template_id" class="select-full">
            <option value="">Select a template…</option>
            <option v-for="tmpl in catalog" :key="tmpl.id" :value="tmpl.id">{{ tmpl.name }}</option>
          </select>
        </div>
        <div class="form-group" v-if="selectedTemplate">
          <div class="tmpl-preview-desc">{{ selectedTemplate.description }}</div>
          <div class="tmpl-preview-formats">
            <BadgePill v-for="f in selectedTemplate.formats" :key="f" variant="neutral">{{ f }}</BadgePill>
          </div>
        </div>
        <div class="form-group">
          <label>Format</label>
          <div class="format-select">
            <label v-for="f in availableFormats" :key="f" class="radio-label">
              <input type="radio" :value="f" v-model="genForm.format" />
              {{ f.toUpperCase() }}
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>Date From</label>
          <input type="date" v-model="genForm.params.date_from" class="select-full" />
        </div>
        <div class="form-group">
          <label>Date To</label>
          <input type="date" v-model="genForm.params.date_to" class="select-full" />
        </div>
        <div v-if="genError" style="font-size:12px;color:var(--danger-fg)">⚠ {{ genError }}</div>
      </div>
      <div class="modal-footer">
        <button class="btn" @click="showGenerateModal = false">Cancel</button>
        <button class="btn-primary" :disabled="!genForm.template_id || generating" @click="generateReport">
          {{ generating ? 'Generating…' : 'Generate' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Template catalog -->
  <SectionTitle pill="Available Templates">Report Templates</SectionTitle>

  <div v-if="catalog.length" class="template-grid">
    <div v-for="tmpl in catalog" :key="tmpl.id" class="template-card">
      <div class="tc-top">
        <div class="tc-head">
          <span class="tc-name">{{ tmpl.name }}</span>
          <BadgePill v-if="tmpl.schedule" variant="fair">Scheduled</BadgePill>
          <BadgePill v-else variant="neutral">On-demand</BadgePill>
        </div>
        <div v-if="tmpl.module" class="tc-module">{{ tmpl.module }}</div>
        <p class="tc-desc">{{ tmpl.description }}</p>
      </div>
      <div class="tc-footer">
        <div class="tc-formats">
          <span v-for="f in tmpl.formats" :key="f" class="tc-fmt">{{ f.toUpperCase() }}</span>
        </div>
        <button class="btn-primary tc-btn" @click="quickGenerate(tmpl)">Generate →</button>
      </div>
    </div>
  </div>
  <div v-else class="card">
    <div class="card-body empty-row">{{ loading ? 'Loading templates…' : 'No report templates found.' }}</div>
  </div>

  <!-- Saved query distributions (from the Query Builder) -->
  <SectionTitle pill="Query Builder · Distribution">Saved Query Templates</SectionTitle>
  <div class="card" style="margin-bottom:16px">
    <div class="card-body">
      <div v-if="savedError" class="query-error" style="margin-bottom:8px">⚠ {{ savedError }}</div>
      <div v-if="savedQueries.length" class="saved-list">
        <div v-for="sq in savedQueries" :key="sq.id" class="saved-row">
          <div class="saved-main">
            <div class="saved-name">
              {{ sq.name }}
              <BadgePill :variant="sq.query_type === 'join' ? 'info' : 'neutral'">{{ sq.query_type === 'join' ? 'Cross-module' : 'Single dataset' }}</BadgePill>
            </div>
            <div class="saved-desc">{{ sq.description || 'No description' }}</div>
            <div class="saved-meta">
              <span class="saved-meta-chip">{{ scheduleLabel(sq.schedule_frequency) }}</span>
              <span class="saved-meta-chip">{{ sq.export_format.toUpperCase() }}</span>
              <span class="saved-meta-chip">{{ sq.recipients.length }} recipient{{ sq.recipients.length === 1 ? '' : 's' }}</span>
              <span class="saved-meta-chip">Last run: {{ sq.last_run_at ? fmtTime(sq.last_run_at) : 'never' }}</span>
            </div>
          </div>
          <div class="saved-actions">
            <button class="btn-primary" :disabled="runningSavedId === sq.id" @click="runSavedNow(sq)">
              {{ runningSavedId === sq.id ? 'Running…' : '▶ Run Now' }}
            </button>
            <button class="remove-btn" title="Delete" @click="deleteSaved(sq.id)">×</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-row">
        No saved query templates yet - build one in the <NuxtLink to="/query-builder">Query Builder</NuxtLink> and click "Save as Template".
      </div>
    </div>
  </div>

  <!-- Recent runs -->
  <SectionTitle pill="Recent Activity">Recent Report Runs</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Template</th>
            <th>Format</th>
            <th>Status</th>
            <th>Generated At</th>
            <th>Requested By</th>
            <th>Size</th>
            <th></th>
          </tr>
        </thead>
        <tbody v-if="runs.length">
          <tr v-for="r in runsPageRows" :key="r.id" :class="{ 'run-row-active': r.id === pollingRunId }">
            <td class="run-name">{{ (r as any).template_name ?? r.template_id }}</td>
            <td><BadgePill variant="info">{{ r.format.toUpperCase() }}</BadgePill></td>
            <td>
              <BadgePill :variant="runBadge(r.status)">{{ r.status }}</BadgePill>
              <span v-if="r.id === pollingRunId" class="poll-dot" title="Checking status…" />
            </td>
            <td class="run-ts">{{ fmtTime((r as any).generated_at ?? (r as any).completed_at ?? (r as any).requested_at) }}</td>
            <td class="run-by">{{ (r as any).requested_by_email ?? '-' }}</td>
            <td class="run-size">{{ (r as any).file_size_bytes ? fmtBytes((r as any).file_size_bytes) : '-' }}</td>
            <td>
              <button v-if="r.status === 'completed'" class="btn run-dl" @click="useReports().download(r.id)">⬇ Download</button>
              <span v-else-if="r.status === 'running'" class="run-progress">● Generating…</span>
              <span v-else-if="r.status === 'queued'" class="run-queued">⏳ Queued…</span>
              <span v-else-if="r.status === 'failed'" class="run-failed" :title="(r as any).error">✕ Failed</span>
              <span v-else class="run-na">-</span>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="7" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading runs…' : 'No recent report runs.' }}</td></tr>
        </tbody>
      </table>
      <TablePagination
        :page="runsPage" :total-pages="runsTotalPages" :total="runsTotal"
        @prev="runsPrev" @next="runsNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useReports, useQuery } from '~/composables/api'
import type { ReportTemplate, ReportRun, SavedQuery, ScheduleFrequency, SavedQueryFormat } from '~/composables/api'

const catalog = ref<ReportTemplate[]>([])
const runs    = ref<ReportRun[]>([])
const loading = ref(true)
const error   = ref<string | null>(null)

const savedQueries   = ref<SavedQuery[]>([])
const savedError     = ref<string | null>(null)
const runningSavedId = ref<string | null>(null)

const showGenerateModal = ref(false)
const generating = ref(false)
const genError   = ref<string | null>(null)
const genForm = ref({
  template_id: '',
  format: 'pdf',
  params: { date_from: '', date_to: '' } as Record<string, string>,
})

// Fast-poll state: tracks a run that is still queued/running
const pollingRunId = ref<string | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollDeadline: ReturnType<typeof setTimeout> | null = null

async function load() {
  loading.value = true
  error.value = null
  const rpt = useReports()

  const [catRes, runsRes] = await Promise.allSettled([
    rpt.catalog(),
    rpt.runs({ page_size: 20 }),
  ])

  if (catRes.status === 'fulfilled')  catalog.value = catRes.value
  if (runsRes.status === 'fulfilled') runs.value    = (runsRes.value as any).results ?? []

  if (catRes.status === 'rejected' && runsRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Reports API.'

  loading.value = false
}

async function loadSavedQueries() {
  try {
    const res = await useQuery().savedList()
    savedQueries.value = res.results ?? []
  } catch (e: any) {
    savedError.value = e?.data?.detail ?? e?.message ?? 'Unable to load saved query templates.'
  }
}

async function runSavedNow(sq: SavedQuery) {
  runningSavedId.value = sq.id
  savedError.value = null
  try {
    const res = await useQuery().savedRun(sq.id)
    downloadRows(res.rows as Record<string, unknown>[], sq.export_format, sq.name)
    await loadSavedQueries()
  } catch (e: any) {
    savedError.value = e?.data?.detail ?? e?.message ?? 'Failed to run saved query.'
  } finally {
    runningSavedId.value = null
  }
}

async function deleteSaved(id: string) {
  try {
    await useQuery().savedDelete(id)
    savedQueries.value = savedQueries.value.filter(sq => sq.id !== id)
  } catch (e: any) {
    savedError.value = e?.data?.detail ?? e?.message ?? 'Failed to delete saved query.'
  }
}

function downloadRows(rows: Record<string, unknown>[], format: SavedQueryFormat, name: string) {
  if (typeof window === 'undefined') return
  const safe = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'saved-query'
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
    triggerDownload(blob, `uapts-saved-${safe}.json`)
  } else {
    const cols = rows.length ? Object.keys(rows[0]!) : []
    const body = [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))]
    const blob = new Blob([body.join('\n')], { type: 'text/csv' })
    triggerDownload(blob, `uapts-saved-${safe}.csv`)
  }
}
function triggerDownload(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
function scheduleLabel(f: ScheduleFrequency) {
  const m: Record<ScheduleFrequency, string> = { manual: 'Manual', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }
  return m[f] ?? f
}

onMounted(load)
onMounted(loadSavedQueries)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 60_000) })
onUnmounted(() => { if (t) clearInterval(t); stopPolling() })

const selectedTemplate = computed(() =>
  catalog.value.find(tmpl => tmpl.id === genForm.value.template_id) ?? null,
)
const availableFormats = computed(() =>
  selectedTemplate.value?.formats.length ? selectedTemplate.value.formats : ['pdf', 'xlsx'],
)

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: runsPageRows, page: runsPage, totalPages: runsTotalPages,
  total: runsTotal, next: runsNext, prev: runsPrev,
} = usePagination(runs, 15)

function quickGenerate(tmpl: ReportTemplate) {
  genForm.value.template_id = tmpl.id
  genForm.value.format = tmpl.formats?.[0] ?? 'pdf'
  showGenerateModal.value = true
}

async function generateReport() {
  if (!genForm.value.template_id) return
  generating.value = true
  genError.value = null
  try {
    const run = await useReports().generate({
      template_id: genForm.value.template_id,
      format: genForm.value.format as 'pdf' | 'xlsx' | 'csv',
      params: Object.fromEntries(
        Object.entries(genForm.value.params).filter(([, v]) => v),
      ),
    })
    runs.value.unshift(run)
    showGenerateModal.value = false
    genForm.value = { template_id: '', format: 'pdf', params: { date_from: '', date_to: '' } }

    // The API enqueues the job and returns queued/running - start fast polling
    if (run.status === 'queued' || run.status === 'running') {
      startPolling(run.id)
    }
  } catch (e: any) {
    genError.value = e?.data?.detail ?? e?.data?.errors?.[0]?.message ?? e?.message ?? 'Failed to generate report.'
  } finally {
    generating.value = false
  }
}

function startPolling(runId: string) {
  stopPolling()
  pollingRunId.value = runId

  pollTimer = setInterval(async () => {
    try {
      const updated = await useReports().run(runId)
      const idx = runs.value.findIndex(r => r.id === runId)
      if (idx !== -1) runs.value[idx] = updated
      if (updated.status === 'completed' || updated.status === 'failed') stopPolling()
    } catch { /* keep trying until deadline */ }
  }, 3_000)

  // Give up after 3 minutes
  pollDeadline = setTimeout(stopPolling, 180_000)
}

function stopPolling() {
  pollingRunId.value = null
  if (pollTimer)    { clearInterval(pollTimer);    pollTimer = null }
  if (pollDeadline) { clearTimeout(pollDeadline);  pollDeadline = null }
}

function runBadge(s: string) {
  const m: Record<string,string> = { completed:'success', running:'info', failed:'danger', queued:'neutral' }
  return m[s] ?? 'neutral'
}
function fmtTime(iso: string) {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function fmtBytes(b: number) {
  if (b > 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`
  if (b > 1_000)     return `${(b / 1_000).toFixed(0)} KB`
  return `${b} B`
}
</script>

<style scoped>

/* ── Template card grid ── */
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.template-card {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color .15s;
}
.template-card:hover { border-color:var(--border-interactive); }
.tc-top { flex:1; display:flex; flex-direction:column; gap:6px; }
.tc-head { display:flex; align-items:flex-start; gap:8px; flex-wrap:wrap; }
.tc-name { font-size:14px; font-weight:700; color:var(--fg-1); flex:1; line-height:1.3; }
.tc-module { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--fg-3); }
.tc-desc { font-size:12px; color:var(--fg-2); line-height:1.5; margin:0; }
.tc-footer { display:flex; align-items:center; justify-content:space-between; gap:8px; border-top:1px solid var(--border-subtle); padding-top:10px; }
.tc-formats { display:flex; gap:4px; flex-wrap:wrap; }
.tc-fmt { font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; background:var(--info-bg); color:var(--info-fg); border:1px solid color-mix(in srgb, var(--info-fg) 30%, transparent); }
.tc-btn { font-size:12px; }

/* ── Recent runs table ── */
.run-name { font-weight:600; min-width:160px; }
.run-ts   { font-size:12px; white-space:nowrap; color:var(--fg-2); }
.run-by   { font-size:12px; color:var(--fg-2); }
.run-size { font-size:12px; color:var(--fg-3); font-variant-numeric:tabular-nums; }
.run-dl   { font-size:12px; text-decoration:none; }
.run-progress { font-size:12px; color:var(--info-fg); font-weight:500; }
.run-queued   { font-size:12px; color:var(--warning-fg); font-weight:500; }
.run-failed   { font-size:12px; color:var(--danger-fg); font-weight:500; cursor:help; }
.run-na       { font-size:12px; color:var(--fg-3); }
.run-row-active td { background:var(--warning-bg) !important; }
.poll-dot {
  display:inline-block; width:7px; height:7px; border-radius:50%;
  background:var(--info-fg); margin-left:6px; vertical-align:middle;
  animation:poll-pulse 1s ease-in-out infinite;
}
@keyframes poll-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
.empty-row { text-align:center; color:var(--fg-3); padding:20px; }
.query-error { font-size:12px; color:var(--danger-fg); display:flex; align-items:center; gap:4px; }

/* ── Saved query templates ── */
.saved-list { display:flex; flex-direction:column; gap:10px; }
.saved-row { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:10px 12px; border:1px solid var(--border-subtle); border-radius:8px; }
.saved-row:hover { background:var(--surface-1); }
.saved-main { flex:1; min-width:0; }
.saved-name { font-size:13px; font-weight:700; color:var(--fg-1); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.saved-desc { font-size:12px; color:var(--fg-2); margin-top:2px; }
.saved-meta { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
.saved-meta-chip { font-size:10px; padding:2px 8px; border-radius:10px; background:var(--surface-sunken); color:var(--fg-2); font-weight:600; white-space:nowrap; }
.saved-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
.remove-btn { background:none; border:none; font-size:16px; color:var(--fg-3); cursor:pointer; line-height:1; padding:0; text-align:center; }
.remove-btn:hover { color:var(--danger-fg); }

/* ── Modal ── */
.select-full { width:100%; padding:7px 10px; border:1px solid var(--border-interactive); border-radius:7px; font-size:13px; background:var(--surface-2); color:var(--fg-2); }
.select-full:focus { outline:none; border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-wash); }
.format-select { display:flex; gap:16px; }
.radio-label { display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; font-weight:500; }
.radio-label input[type="radio"] { accent-color:var(--primary-fill); cursor:pointer; }
.tmpl-preview-desc { font-size:12px; color:var(--fg-2); margin-bottom:6px; line-height:1.5; }
.tmpl-preview-formats { display:flex; gap:4px; flex-wrap:wrap; }
.modal-backdrop { position:fixed; inset:0; background:var(--scrim); z-index:1000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(2px); }
.modal { background:var(--surface-2); border-radius:12px; width:460px; max-width:95vw; box-shadow:var(--elev-3); }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:18px 20px 16px; font-weight:700; font-size:15px; border-bottom:1px solid var(--border-subtle); color:var(--fg-1); }
.modal-close { background:none; border:none; font-size:22px; cursor:pointer; color:var(--fg-3); line-height:1; padding:0 2px; }
.modal-close:hover { color:var(--fg-2); }
.modal-body { padding:16px 20px; display:flex; flex-direction:column; gap:14px; }
.modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:14px 20px; border-top:1px solid var(--border-subtle); }
.form-group { display:flex; flex-direction:column; gap:5px; }
.form-group label { font-size:12px; font-weight:600; color:var(--fg-2); text-transform:uppercase; letter-spacing:.04em; }
</style>
