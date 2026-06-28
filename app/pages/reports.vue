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
        <div v-if="genError" style="font-size:12px;color:#ef4444">⚠ {{ genError }}</div>
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
          <BadgePill v-if="tmpl.schedule_cron" variant="fair">Scheduled</BadgePill>
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
          <tr v-for="r in runs" :key="r.id" :class="{ 'run-row-active': r.id === pollingRunId }">
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
          <tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading runs…' : 'No recent report runs.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Reports')

import { useReports } from '~/composables/api'
import type { ReportTemplate, ReportRun } from '~/composables/api'

const catalog = ref<ReportTemplate[]>([])
const runs    = ref<ReportRun[]>([])
const loading = ref(true)
const error   = ref<string | null>(null)

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

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 60_000) })
onUnmounted(() => { if (t) clearInterval(t); stopPolling() })

const selectedTemplate = computed(() =>
  catalog.value.find(tmpl => tmpl.id === genForm.value.template_id) ?? null,
)
const availableFormats = computed(() =>
  selectedTemplate.value?.formats.length ? selectedTemplate.value.formats : ['pdf', 'xlsx'],
)

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

    // The API enqueues the job and returns queued/running — start fast polling
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

function downloadUrl(runId: string) { return useReports().downloadUrl(runId) }

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
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f8fafc; color:#475569; border:1px solid #e2e8f0; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }

/* ── Template card grid ── */
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.template-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,.04);
  transition: box-shadow .15s, border-color .15s;
}
.template-card:hover { border-color:#bfdbfe; box-shadow:0 4px 14px rgba(59,130,246,.08); }
.tc-top { flex:1; display:flex; flex-direction:column; gap:6px; }
.tc-head { display:flex; align-items:flex-start; gap:8px; flex-wrap:wrap; }
.tc-name { font-size:14px; font-weight:700; color:#1e293b; flex:1; line-height:1.3; }
.tc-module { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#94a3b8; }
.tc-desc { font-size:12px; color:#64748b; line-height:1.5; margin:0; }
.tc-footer { display:flex; align-items:center; justify-content:space-between; gap:8px; border-top:1px solid #f1f5f9; padding-top:10px; }
.tc-formats { display:flex; gap:4px; flex-wrap:wrap; }
.tc-fmt { font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; }
.tc-btn { font-size:12px; }

/* ── Recent runs table ── */
.run-name { font-weight:600; min-width:160px; }
.run-ts   { font-size:12px; white-space:nowrap; color:#64748b; }
.run-by   { font-size:12px; color:#64748b; }
.run-size { font-size:12px; color:#94a3b8; font-variant-numeric:tabular-nums; }
.run-dl   { font-size:12px; text-decoration:none; }
.run-progress { font-size:12px; color:#3b82f6; font-weight:500; }
.run-queued   { font-size:12px; color:#f59e0b; font-weight:500; }
.run-failed   { font-size:12px; color:#ef4444; font-weight:500; cursor:help; }
.run-na       { font-size:12px; color:#cbd5e1; }
.run-row-active td { background:#fffbeb !important; }
.poll-dot {
  display:inline-block; width:7px; height:7px; border-radius:50%;
  background:#3b82f6; margin-left:6px; vertical-align:middle;
  animation:poll-pulse 1s ease-in-out infinite;
}
@keyframes poll-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
.empty-row { text-align:center; color:#94a3b8; padding:20px; }

/* ── Modal ── */
.select-full { width:100%; padding:7px 10px; border:1px solid #e2e8f0; border-radius:7px; font-size:13px; background:#fff; color:#374151; }
.select-full:focus { outline:none; border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,.1); }
.format-select { display:flex; gap:16px; }
.radio-label { display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; font-weight:500; }
.radio-label input[type="radio"] { accent-color:#3b82f6; cursor:pointer; }
.tmpl-preview-desc { font-size:12px; color:#64748b; margin-bottom:6px; line-height:1.5; }
.tmpl-preview-formats { display:flex; gap:4px; flex-wrap:wrap; }
.modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.5); z-index:1000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(2px); }
.modal { background:#fff; border-radius:12px; width:460px; max-width:95vw; box-shadow:0 24px 64px rgba(0,0,0,.22); }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:18px 20px 16px; font-weight:700; font-size:15px; border-bottom:1px solid #f1f5f9; color:#1e293b; }
.modal-close { background:none; border:none; font-size:22px; cursor:pointer; color:#94a3b8; line-height:1; padding:0 2px; }
.modal-close:hover { color:#374151; }
.modal-body { padding:16px 20px; display:flex; flex-direction:column; gap:14px; }
.modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:14px 20px; border-top:1px solid #f1f5f9; }
.form-group { display:flex; flex-direction:column; gap:5px; }
.form-group label { font-size:12px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:.04em; }
</style>
