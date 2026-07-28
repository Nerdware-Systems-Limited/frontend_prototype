<template>
  <Teleport to="body">
    <div class="upload-overlay" @click.self="handleBackdropClick" @keydown.esc="close">
      <div
        ref="modalEl"
        class="upload-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="`Upload data for ${source.agency_code}`"
        tabindex="-1"
      >
        <header class="upload-header">
          <div>
            <div class="upload-title">Upload — {{ source.source_system }}</div>
            <div class="upload-sub">{{ source.agency_name }} · last submitted {{ lastSyncLabel }}</div>
          </div>
          <button class="icon-btn" aria-label="Close" @click="close">✕</button>
        </header>

        <div v-if="fileError" class="upload-banner upload-banner-error">⚠ {{ fileError }}</div>

        <div class="upload-body">
          <!-- Step 1: template -->
          <div class="upload-row">
            <span class="upload-row-label">1. Get the current template</span>
            <button class="btn" style="font-size:12px" :disabled="downloadingTemplate" @click="downloadTemplate">
              {{ downloadingTemplate ? 'Preparing…' : '⬇ Download .xlsx' }}
            </button>
          </div>

          <!-- Dropzone -->
          <div
            v-if="state === 'idle'"
            class="dropzone"
            :class="{ dragging: isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
            @click="fileInput?.click()"
          >
            <input ref="fileInput" type="file" accept=".xlsx" hidden @change="onFileInput" />
            <p class="dropzone-main">Drag your filled-in template here, or click to browse</p>
            <p class="hint">.xlsx up to 10MB</p>
          </div>

          <div v-else-if="state === 'validating'" class="upload-status">
            <span class="spinner" aria-hidden="true" /> Reading {{ selectedFile?.name }}…
          </div>

          <!-- Reviewing / committing -->
          <template v-else-if="upload">
            <div class="upload-file-chip">
              <span>{{ upload.original_filename }}</span>
              <span class="hint">{{ upload.total_rows }} row(s) read</span>
            </div>

            <div class="validation-summary" :class="upload.valid_rows ? 'ok' : 'empty'">
              <div class="validation-summary-main">
                {{ upload.valid_rows }} of {{ upload.total_rows }} row(s) ready to commit
              </div>
              <div v-if="summaryItems.length" class="validation-summary-detail">
                <span v-for="(item, i) in summaryItems" :key="item.label">
                  {{ item.label }}: {{ item.value }}<span v-if="i < summaryItems.length - 1"> · </span>
                </span>
              </div>
            </div>

            <div v-if="upload.validation_report.length" class="error-table">
              <div v-for="err in upload.validation_report" :key="err.row" class="error-table-row">
                <span class="error-table-rownum">Row {{ err.row }}</span>
                <span class="error-table-msgs">{{ err.errors.join('; ') }}</span>
              </div>
            </div>

            <div v-if="commitError" class="upload-banner upload-banner-error">⚠ {{ commitError }}</div>

            <div v-if="state !== 'committed'" class="upload-footer">
              <span class="hint">
                <template v-if="upload.error_rows">{{ upload.error_rows }} row(s) need fixing before commit</template>
              </span>
              <div class="upload-actions">
                <button class="btn" style="font-size:12px" :disabled="state === 'committing'" @click="reset">
                  Upload a different file
                </button>
                <button
                  class="btn btn-primary" style="font-size:12px"
                  :disabled="!upload.valid_rows || state === 'committing'"
                  @click="commit"
                >
                  {{ state === 'committing' ? 'Committing…' : `Commit ${upload.valid_rows} row(s)` }}
                </button>
              </div>
            </div>

            <div v-else class="upload-banner upload-banner-success">
              <div>✓ Committed {{ commitResult?.rows_committed ?? 0 }} row(s)</div>
              <div class="hint">{{ commitResult?.domain_records_created ?? 0 }} record(s) created.</div>
              <button class="btn btn-primary" style="font-size:12px;margin-top:8px" @click="close">Done</button>
            </div>
          </template>

          <!-- Upload history (lazy, collapsed by default) -->
          <div v-if="state === 'idle'" class="upload-history">
            <button class="link-btn" @click="toggleHistory">
              {{ showHistory ? '▾' : '▸' }} Recent uploads
            </button>
            <div v-if="showHistory" class="upload-history-body">
              <div v-if="historyLoading" class="hint">Loading…</div>
              <div v-else-if="!history.length" class="hint">No uploads yet for this feed.</div>
              <div v-for="h in history" :key="h.id" class="upload-history-row">
                <BadgePill :variant="historyBadge(h.status)" size="sm">{{ h.status }}</BadgePill>
                <span class="upload-history-file">{{ h.original_filename }}</span>
                <span class="hint">{{ h.valid_rows }}/{{ h.total_rows }} rows</span>
                <span class="hint">{{ fmtDate(h.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { DataSource } from '~/composables/api'

// Adjust this to however useIntegrations() builds its base URL if you'd
// rather centralize these calls there instead of calling $fetch directly.
const API_BASE = '/api/v1/integrations'

interface UploadRowError {
  row: number
  errors: string[]
}

interface DataUpload {
  id: string
  source_id: string
  original_filename: string
  status: 'validated' | 'committed' | 'rejected'
  total_rows: number
  valid_rows: number
  error_rows: number
  validation_report: UploadRowError[]
  summary: Record<string, unknown>
  uploaded_by_email: string | null
  committed_at: string | null
  created_at: string
}

interface CommitResult {
  upload_id: string
  rows_committed: number
  domain_records_created: number
  raw_records_saved: number
}

type ModalState = 'idle' | 'validating' | 'reviewing' | 'committing' | 'committed'

const props = defineProps<{ source: DataSource }>()
const emit = defineEmits<{ close: []; committed: [] }>()

const state = ref<ModalState>('idle')
const selectedFile = ref<File | null>(null)
const upload = ref<DataUpload | null>(null)
const commitResult = ref<CommitResult | null>(null)
const fileError = ref<string | null>(null)
const commitError = ref<string | null>(null)
const isDragging = ref(false)
const downloadingTemplate = ref(false)
const showHistory = ref(false)
const history = ref<DataUpload[]>([])
const historyLoading = ref(false)

const fileInput = ref<HTMLInputElement | null>(null)
const modalEl = ref<HTMLElement | null>(null)

onMounted(() => modalEl.value?.focus())

const lastSyncLabel = computed(() => {
  if (!props.source.last_sync_at) return 'never'
  return new Date(props.source.last_sync_at).toLocaleDateString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
})

const SUMMARY_LABELS: Record<string, string> = {
  total_amount_kes: 'Total amount',
  financial_years: 'Financial year(s)',
  total_contract_sum_kes: 'Total contract sum',
  project_count: 'Projects',
  assessment_count: 'Assessments',
  fiscal_years: 'Fiscal year(s)',
}

function formatSummaryValue(key: string, value: unknown): string {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'number' && key.endsWith('_kes')) return `KES ${value.toLocaleString('en-KE')}`
  if (typeof value === 'number') return value.toLocaleString('en-KE')
  return String(value)
}

const summaryItems = computed(() => {
  if (!upload.value?.summary) return []
  return Object.entries(upload.value.summary).map(([key, value]) => ({
    label: SUMMARY_LABELS[key] ?? key.replace(/_/g, ' '),
    value: formatSummaryValue(key, value),
  }))
})

function close() {
  emit('close')
}

function handleBackdropClick() {
  close()
}

function reset() {
  state.value = 'idle'
  selectedFile.value = null
  upload.value = null
  fileError.value = null
  commitError.value = null
}

const MAX_SIZE = 20 * 1024 * 1024

function validateClientSide(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) return 'Please choose an .xlsx file.'
  if (file.size > MAX_SIZE) return 'That file is larger than 10MB.'
  return null
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) selectFile(file)
}

function onFileInput(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) selectFile(file)
  target.value = '' // allow re-selecting the same filename after a failed attempt
}

async function selectFile(file: File) {
  const clientError = validateClientSide(file)
  if (clientError) {
    fileError.value = clientError
    return
  }

  fileError.value = null
  selectedFile.value = file
  state.value = 'validating'

  try {
    const form = new FormData()
    form.append('file', file)
    const res = await $fetch<{ success: boolean; data?: DataUpload; message?: string }>(
      `${API_BASE}/${props.source.source_id}/uploads/`,
      { method: 'POST', body: form },
    )
    if (!res.success || !res.data) throw new Error(res.message || 'Validation failed.')
    upload.value = res.data
    state.value = 'reviewing'
  } catch (e: any) {
    fileError.value = e?.data?.message || e?.message || 'Could not validate that file.'
    state.value = 'idle'
  }
}

async function downloadTemplate() {
  downloadingTemplate.value = true
  try {
    const blob = await $fetch<Blob>(`${API_BASE}/${props.source.source_id}/upload-template/`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.source.source_id}-template.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch {
    fileError.value = 'Could not download the template. Try again.'
  } finally {
    downloadingTemplate.value = false
  }
}

async function commit() {
  if (!upload.value) return
  state.value = 'committing'
  commitError.value = null
  try {
    const res = await $fetch<{ success: boolean; data?: CommitResult; message?: string }>(
      `${API_BASE}/uploads/${upload.value.id}/commit/`,
      { method: 'POST' },
    )
    if (!res.success || !res.data) throw new Error(res.message || 'Commit failed.')
    commitResult.value = res.data
    state.value = 'committed'
    emit('committed')
  } catch (e: any) {
    commitError.value = e?.data?.message || e?.message || 'Could not commit this upload.'
    state.value = 'reviewing'
  }
}

function historyBadge(status: string) {
  const m: Record<string, string> = { committed: 'success', validated: 'info', rejected: 'danger' }
  return m[status] ?? 'neutral'
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })
  } catch {
    return iso
  }
}

async function toggleHistory() {
  showHistory.value = !showHistory.value
  if (showHistory.value && !history.value.length) {
    historyLoading.value = true
    try {
      const res = await $fetch<{ results: DataUpload[] }>(`${API_BASE}/${props.source.source_id}/uploads/`, {
        query: { page_size: 5 },
      })
      history.value = res.results ?? []
    } catch {
      // history is a nice-to-have — fail silently rather than banner-ing an
      // error over what's otherwise a working upload flow
    } finally {
      historyLoading.value = false
    }
  }
}
</script>

<style scoped>
.upload-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.upload-modal {
  width: 560px; max-width: 100%; max-height: calc(100vh - 48px);
  overflow-y: auto;
  background: #fff; border-radius: 10px; border: 1px solid #e2e8f0;
  padding: 18px 20px; outline: none;
}
.upload-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 4px; }
.upload-title { font-size: 15px; font-weight: 600; color: #1e293b; }
.upload-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
.icon-btn { background: none; border: none; font-size: 15px; color: #64748b; cursor: pointer; padding: 4px; }
.icon-btn:hover { color: #1e293b; }

.upload-body { margin-top: 12px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
.upload-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.upload-row-label { font-size: 13px; color: #374151; }

.dropzone {
  border: 1px dashed #cbd5e1; border-radius: 6px; padding: 22px;
  text-align: center; cursor: pointer; margin-bottom: 4px;
}
.dropzone.dragging { border-color: #16a34a; background: #f0fdf4; }
.dropzone-main { font-size: 13px; color: #374151; margin: 0 0 4px; }
.hint { font-size: 11px; color: #94a3b8; }

.upload-status {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: #374151; padding: 16px 0;
}
.spinner {
  width: 13px; height: 13px; border-radius: 50%;
  border: 2px solid #e2e8f0; border-top-color: #64748b;
  animation: upload-spin 0.7s linear infinite;
}
@keyframes upload-spin { to { transform: rotate(360deg); } }

.upload-file-chip {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; color: #374151; background: #f8fafc;
  border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px;
}

.validation-summary {
  border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; font-size: 12px;
}
.validation-summary.ok { background: #f0fdf4; color: #15803d; }
.validation-summary.empty { background: #fef2f2; color: #dc2626; }
.validation-summary-main { font-weight: 600; }
.validation-summary-detail { margin-top: 2px; opacity: 0.9; }

.error-table {
  border: 1px solid #fecaca; border-radius: 6px; overflow: hidden;
  max-height: 160px; overflow-y: auto; margin-bottom: 10px;
}
.error-table-row {
  display: flex; gap: 10px; padding: 6px 10px; font-size: 11px;
  border-top: 1px solid #fee2e2; background: #fef2f2;
}
.error-table-row:first-child { border-top: none; }
.error-table-rownum { color: #dc2626; font-weight: 600; white-space: nowrap; }
.error-table-msgs { color: #7f1d1d; }

.upload-banner { border-radius: 6px; padding: 10px 12px; font-size: 12px; margin: 10px 0; }
.upload-banner-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
.upload-banner-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }

.upload-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.upload-actions { display: flex; gap: 8px; }
.btn-primary { background: #1e293b; color: #fff; border-color: #1e293b; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.upload-history { margin-top: 14px; padding-top: 10px; border-top: 1px solid #f1f5f9; }
.link-btn { background: none; border: none; padding: 0; font-size: 12px; color: #64748b; cursor: pointer; }
.link-btn:hover { color: #1e293b; }
.upload-history-body { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.upload-history-row { display: flex; align-items: center; gap: 8px; font-size: 11px; }
.upload-history-file { flex: 1; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
