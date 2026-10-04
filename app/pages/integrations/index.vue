<template>
  <PageHeader
    eyebrow="Data Integration Hub"
    title="Upload & Connect"
    subtitle="Get a file in, or register how a live feed connects."
  >
    <template #actions>
      <NuxtLink to="/integrations/files" class="btn">Files &amp; Feeds →</NuxtLink>
      <NuxtLink to="/integrations/analytics" class="btn">Ingestion Analytics →</NuxtLink>
    </template>
  </PageHeader>

  <!-- Page-wide drop target: drag a file anywhere on the page. Floats above
       the workspace, so it is allowed to be an overlay (Flat-Body Rule). -->
  <div v-if="pageDragging" class="page-drop" aria-hidden="true">
    <div class="page-drop-card">
      <Upload :size="22" />
      <strong v-if="canDropFile">Drop to upload{{ selectedSource ? ` to ${selectedSource.source_id}` : ' to the routing queue' }}</strong>
      <strong v-else>Choose a feed first</strong>
      <span class="hint">{{ canDropFile ? '.xlsx or .csv' : 'Pick a feed below, then drop the file' }}</span>
    </div>
  </div>

  <!-- KPI ribbon - real numbers only; loading/unavailable/ok render
       differently, a failed fetch never shows as a fabricated zero. -->
  <div class="ih-ribbon ih-rise">
    <KpiTile
      label="Files in pipeline" :value="pipelineState === 'ok' ? filesInPipeline!.toLocaleString('en-KE') : ''"
      :state="pipelineState" sub="not yet committed or closed out"
    />
    <KpiTile
      label="Records today" :value="recordsTodayState === 'ok' ? recordsToday!.toLocaleString('en-KE') : ''"
      :state="recordsTodayState" sub="across all feeds"
    />
    <KpiTile
      label="Connections" :value="feedsLoading ? '' : `${connectedCount} / ${connectedFeeds.length}`"
      :state="feedsLoading ? 'loading' : 'ok'"
      :sub="feedsLoading ? 'loading' : `${connectedFeeds.length - connectedCount} degraded / disconnected`"
    />
    <KpiTile
      label="Needs attention" :value="needsAttentionState === 'ok' ? needsAttention!.toLocaleString('en-KE') : ''"
      :state="needsAttentionState" sub="unrouted / mapping / review"
    />
  </div>

  <TabStrip
    :tabs="[{ key: 'upload', label: 'Upload a file' }, { key: 'api', label: 'Register an API' }]"
    v-model="tab"
  />

  <div class="hub-layout">
    <!-- ── Left: the flow ───────────────────────────────────────────── -->
    <div class="hub-main">
      <!-- ══════════════════════════════════════════════════════════
           UPLOAD TAB
      ══════════════════════════════════════════════════════════════ -->
      <div v-if="tab === 'upload'" class="ih-card ih-rise">
        <div class="ih-card-body">
          <ol class="flow-steps">
            <li class="flow-step">
              <span class="flow-step-label">Choose the feed</span>
              <SourcePicker v-if="!templateLateMode" v-model="sourceId" :sources="manualSources" />
              <div v-if="selectedSource && !templateLateMode" class="selected-source-meta">
                {{ selectedSource.source_system }} · {{ selectedSource.mode }}
                <template v-if="selectedSource.schema_version">· template {{ selectedSource.schema_version }}</template>
                · last submitted {{ lastSyncLabel }}
              </div>
              <div v-if="templateLateMode" class="template-late-note">
                <strong>Routing queue.</strong> Your file will be accepted as-is and held until
                someone assigns it a template, so you don't need to pick a feed. Best for a format
                that isn't in the list yet.
                <button type="button" class="linkish" @click="templateLateMode = false">Pick a feed instead</button>
              </div>
              <button
                v-else type="button" class="linkish template-late-toggle"
                @click="enterTemplateLateMode"
              >Can't find your feed? Submit it to the routing queue →</button>
            </li>

            <li v-if="selectedSource?.schema_version && !templateLateMode" class="flow-step">
              <span class="flow-step-label">Get the template</span>
              <button class="btn" :disabled="downloadingTemplate" @click="downloadTemplate">
                <Download :size="13" class="btn-ico" />{{ downloadingTemplate ? 'Preparing…' : 'Download .xlsx' }}
              </button>
            </li>

            <li class="flow-step">
              <span class="flow-step-label">Drop the file</span>
              <FileDropzone
                :disabled="!selectedSource && !templateLateMode"
                disabled-reason="Choose a feed first, or submit to the routing queue"
                :uploading="state === 'uploading'" :progress="uploadProgress" :file-name="selectedFile?.name"
                @file="onFileSelected" @error="fileError = $event"
              />
            </li>
          </ol>

          <div v-if="fileError" class="upload-banner upload-banner-error" role="alert"><AlertTriangle :size="14" class="btn-ico" />{{ fileError }}</div>

          <!-- ── Inline result - never redirect-and-lose-the-file ─────── -->
          <div v-if="uploadResult" class="upload-result" aria-live="polite">
            <template v-if="uploadResult.status === 'validated'">
              <p class="upload-result-main"><CheckCircle2 :size="16" class="btn-ico" />{{ uploadResult.valid_rows.toLocaleString('en-KE') }} row(s) ready.</p>
              <NuxtLink class="btn btn-primary" :to="`/integrations/files/${uploadResult.id}`">Review and commit →</NuxtLink>
            </template>
            <template v-else-if="uploadResult.status === 'needs_mapping'">
              <p class="upload-result-main"><AlertTriangle :size="16" class="btn-ico" />Column names don't match the template.</p>
              <NuxtLink class="btn btn-primary" :to="`/integrations/files/${uploadResult.id}`">Map columns →</NuxtLink>
            </template>
            <template v-else-if="uploadResult.status === 'rejected' || uploadResult.status === 'failed'">
              <p class="upload-result-main upload-result-main--error">
                <XCircle :size="16" class="btn-ico" />{{ uploadResult.validation_error || 'Every row in this file failed validation.' }}
              </p>
              <button class="btn btn-primary" @click="resetUpload">Upload a correction</button>
            </template>
            <template v-else-if="uploadResult.status === 'unrouted'">
              <p class="upload-result-main"><Inbox :size="16" class="btn-ico" />In the routing queue. A template will be assigned before it's validated.</p>
              <div class="upload-result-actions">
                <NuxtLink class="btn btn-primary" :to="`/integrations/files/${uploadResult.id}`">Assign a template now →</NuxtLink>
                <button class="btn" @click="resetUpload">Submit another</button>
              </div>
            </template>
            <template v-else>
              <p class="upload-result-main"><span class="spinner" aria-hidden="true" /> {{ statusMeta(uploadResult.status).label }}…</p>
            </template>
          </div>

          <p v-else class="hint" style="margin-top:14px">
            Once uploaded, you'll see the result here. No need to go hunting for your file in the inbox.
          </p>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════
           REGISTER API TAB - POST .../register/ + .../test-connection/,
           admin-only server-side. Push feeds get a generated secret
           shown once; pull feeds get a real SSRF-guarded reachability
           test. See the script header comment for the full picture.
      ══════════════════════════════════════════════════════════════ -->
      <template v-else>
        <EmptyState
          v-if="!isAdmin" icon="inbox"
          message="Registering a live feed is an admin action. Ask an admin to add it, or sign in with an admin account."
        />

        <div v-else-if="registeredResult" class="ih-card ih-rise">
          <div class="ih-card-body">
            <div class="upload-banner" :class="registeredResult.issued_secret ? 'upload-banner-warning' : 'upload-banner-success'">
              <strong>Feed registered: {{ registeredResult.source_id }}.</strong>
              <template v-if="registeredResult.issued_secret">
                <p class="hint" style="margin:8px 0 6px">
                  Copy this key now. It can't be shown again. Send it to {{ registeredResult.agency_code }} as the
                  <code>X-API-Key</code> header value for their POSTs to the URL below.
                </p>
                <div class="secret-row">
                  <code class="secret-value">{{ registeredResult.issued_secret }}</code>
                  <button type="button" class="btn" @click="copySecret">{{ secretCopied ? 'Copied ✓' : 'Copy' }}</button>
                </div>
                <pre class="curl-block" style="margin-top:10px">{{ curlExample }}</pre>
              </template>
              <p v-else class="hint" style="margin-top:6px">
                {{ registeredResult.agency_code }} can be tracked from Files &amp; Feeds → Feeds once it starts sending data.
              </p>
            </div>
            <div class="upload-result-actions" style="margin-top:14px">
              <NuxtLink class="btn btn-primary" :to="`/integrations/feeds/${registeredResult.source_id}`">View connection details →</NuxtLink>
              <button type="button" class="btn" @click="resetRegisterForm">Register another feed</button>
            </div>
          </div>
        </div>

        <template v-else>
          <div class="ih-card ih-rise">
            <div class="ih-card-head"><h2>1 · Identity &amp; protocol</h2><span class="hint">who this feed belongs to, and how it connects</span></div>
            <div class="ih-card-body">
              <div class="field-grid" style="margin-bottom:16px">
                <label class="field">
                  <span class="field-label">Agency</span>
                  <select v-model="agencyCode" class="select-sm field-input">
                    <option value="">Choose an agency…</option>
                    <option v-for="a in agencies" :key="a.agency_code" :value="a.agency_code">{{ a.agency_code }} - {{ a.agency_name }}</option>
                  </select>
                </label>
                <label class="field">
                  <span class="field-label">Feed ID (source_id)</span>
                  <input
                    v-model="registerSourceId" class="select-sm field-input" placeholder="kws-park-traffic"
                    autocomplete="off" spellcheck="false"
                  />
                </label>
              </div>
              <div class="protocol-grid">
                <button
                  v-for="p in PROTOCOLS" :key="p.id" type="button"
                  class="protocol" :class="{ active: p.id === protocol.id }" @click="pickProtocol(p.id)"
                >
                  <div class="protocol-name">{{ p.name }}</div>
                  <div class="protocol-meta">{{ p.meta }}</div>
                </button>
              </div>
            </div>
          </div>

          <div class="ih-card ih-rise ih-rise-2">
            <div class="ih-card-head">
              <h2>2 · Authentication</h2>
              <span class="hint">{{ protocol.direction === 'push' ? 'we issue the credential on save' : "their credential, encrypted at rest" }}</span>
            </div>
            <div class="ih-card-body">
              <div class="pill-row">
                <button
                  v-for="m in protocol.auth" :key="m" type="button" class="pill"
                  :class="{ active: m === authMethod }" @click="authOverride = m; testState = 'idle'"
                >{{ AUTH_LABELS[m] }}</button>
              </div>
              <div v-if="protocol.direction === 'push'" class="upload-banner upload-banner-info">
                This feed's credential is generated automatically when you save, so there's nothing to type here.
                It's sent as an <code>X-API-Key</code> header regardless of the label above. (This backend doesn't
                implement HMAC/OAuth2 verification for push feeds yet: every push credential is a plain API key
                under the hood.)
              </div>
              <div v-else class="field-grid">
                <label v-for="f in AUTH_FIELDS[authMethod]" :key="fieldKey(f.id)" class="field">
                  <span class="field-label">
                    {{ f.label }}
                    <button
                      v-if="f.secret" type="button" class="reveal-btn"
                      @click="revealed[fieldKey(f.id)] = !revealed[fieldKey(f.id)]"
                    >{{ revealed[fieldKey(f.id)] ? 'hide' : 'reveal' }}</button>
                  </span>
                  <input
                    v-model="credentials[fieldKey(f.id)]" class="select-sm field-input"
                    :type="f.secret && !revealed[fieldKey(f.id)] ? 'password' : 'text'"
                    autocomplete="off" spellcheck="false"
                  />
                </label>
              </div>
            </div>
          </div>

          <div class="ih-card ih-rise ih-rise-3">
            <div class="ih-card-head">
              <h2>3 · {{ protocol.direction === 'push' ? 'Where they push' : 'Endpoint & schedule' }}</h2>
              <span class="hint">{{ protocol.direction === 'push' ? 'generated from the Feed ID above' : 'where events land and how often to reconcile' }}</span>
            </div>
            <div class="ih-card-body">
              <div v-if="protocol.direction === 'pull'" class="field-grid field-grid--3">
                <label class="field field--span2">
                  <span class="field-label">{{ protocol.endpointLabel }}</span>
                  <input
                    v-model="endpointValue" class="select-sm field-input" :placeholder="protocol.endpointPlaceholder"
                    autocomplete="off" spellcheck="false" @input="testState = 'idle'"
                  />
                </label>
                <label class="field">
                  <span class="field-label">Reconcile cron</span>
                  <input v-model="cron" class="select-sm field-input" autocomplete="off" />
                </label>
              </div>
              <pre class="curl-block">{{ curlExample }}</pre>
            </div>
          </div>

          <div class="ih-card ih-rise ih-rise-4">
            <div class="ih-card-head">
              <h2>4 · Test &amp; save</h2>
              <span class="hint">{{ protocol.direction === 'push' ? 'validates the Feed ID shape' : 'a real, SSRF-guarded reachability check' }}</span>
            </div>
            <div class="ih-card-body">
              <div v-if="registerError" class="upload-banner upload-banner-error">⚠ {{ registerError }}</div>
              <div class="test-row">
                <button type="button" class="btn" :disabled="testState === 'running'" @click="runTest">
                  {{ testState === 'running' ? 'Testing…' : 'Run test' }}
                </button>
                <button type="button" class="btn btn-primary" :disabled="registering" @click="saveFeed">{{ registering ? 'Saving…' : 'Save feed' }}</button>
                <span class="hint">
                  {{ protocol.name }} · {{ AUTH_LABELS[authMethod] }}<template v-if="protocol.direction === 'pull'"> · {{ cron }}</template>
                </span>
              </div>

              <div v-if="testState === 'passed'" class="test-result test-result--ok">✓ {{ testDetail }}</div>
              <div v-else-if="testState === 'failed'" class="test-result test-result--bad">✕ {{ testDetail }}</div>
            </div>
          </div>
        </template>
      </template>
    </div>

    <!-- ── Right: context ───────────────────────────────────────────── -->
    <div class="hub-rail">
      <div class="ih-card ih-rise">
        <div class="ih-card-head"><h2>Connected feeds</h2></div>
        <div class="ih-card-body">
          <EmptyState v-if="!feedsLoading && !connectedFeeds.length" compact message="No live feeds registered." />
          <ul v-else class="feed-mini-list">
            <li v-for="f in connectedFeeds.slice(0, 6)" :key="f.source_id">
              <span class="feed-dot" :class="feedStatusVariant(f.status)" aria-hidden="true" />
              <span class="mono-sm">{{ f.source_id }}</span>
              <span class="hint">{{ (f.records_today ?? 0).toLocaleString('en-KE') }} today</span>
            </li>
          </ul>
          <NuxtLink v-if="connectedFeeds.length > 6" to="/integrations/analytics" class="link-see-all">See all {{ connectedFeeds.length }} →</NuxtLink>
        </div>
      </div>

      <div class="ih-card ih-rise ih-rise-2">
        <div class="ih-card-head"><h2>Recent uploads</h2></div>
        <div class="ih-card-body">
          <EmptyState v-if="!recentUploadsLoading && !recentUploads.length" compact message="No uploads yet." />
          <ul v-else class="feed-mini-list">
            <li v-for="u in recentUploads" :key="u.id">
              <NuxtLink :to="`/integrations/files/${u.id}`" class="recent-upload-link">
                <span class="feed-dot" :class="statusMeta(u.status).variant" aria-hidden="true" />
                <span class="mono-sm recent-upload-name">{{ u.original_filename }}</span>
                <span class="hint">{{ statusMeta(u.status).label }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { useIntegrations } from '~/composables/api'
import type {
  DataSource, DataUpload, DataUploadStatus,
  RegisterAuthMethod, RegisterProtocol, RegisterFeedResult,
} from '~/composables/api'
import { useAgencies } from '~/composables/api/useAccounts'
// Explicit import (not just relying on Nuxt's app/utils auto-import) -
// vue-tsc's template-only global resolution lagged the freshly generated
// .nuxt types for a template-only reference; this sidesteps that outright.
import { isInFlight, statusMeta } from '~/utils/ingestStatus'
import { AlertTriangle, CheckCircle2, Download, Inbox, Upload, XCircle } from 'lucide-vue-next'

const route = useRoute()
const api = useIntegrations()
const config = useRuntimeConfig()
const apiBase = (config.public.apiBase as string).replace(/\/$/, '')
const auth = useAuth()
// Server-side enforcement is core.permissions.IsAdminRole - this is only a
// UX nicety so a non-admin doesn't fill out the whole form before hitting
// a 403; the real boundary is the backend either way.
const isAdmin = computed(() => {
  const rt = auth.user.value?.role_type
  return rt === 'admin' || rt === 'super_admin' || !!auth.user.value?.is_staff
})

const tab = ref<'upload' | 'api'>('upload')

// ── Feed picker ──────────────────────────────────────────────────────
const sourceId = ref(typeof route.query.source_id === 'string' ? route.query.source_id : '')
// Template-late intake: submit a file with no feed assigned - it lands in
// the routing queue (status="unrouted") for someone to give it a template.
const templateLateMode = ref(false)
function enterTemplateLateMode() {
  templateLateMode.value = true
  sourceId.value = ''
  fileError.value = null
}
const allSources = ref<DataSource[]>([])
const feedsLoading = ref(true)
const manualSources = computed(() => allSources.value.filter(s => s.mode === 'manual'))
const connectedFeeds = computed(() => allSources.value.filter(s => s.mode !== 'manual'))
const connectedCount = computed(() => connectedFeeds.value.filter(f => f.status === 'connected').length)
const selectedSource = computed(() => allSources.value.find(s => s.source_id === sourceId.value) ?? null)

const lastSyncLabel = computed(() => {
  if (!selectedSource.value?.last_sync_at) return 'never'
  return new Date(selectedSource.value.last_sync_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
})

function feedStatusVariant(s: string) {
  const m: Record<string, string> = { connected: 'success', degraded: 'warning', disconnected: 'danger', paused: 'neutral', pending: 'info' }
  return m[s] ?? 'neutral'
}

const downloadingTemplate = ref(false)
async function downloadTemplate() {
  if (!selectedSource.value) return
  downloadingTemplate.value = true
  try {
    const blob = await api.uploads.templateDownload(selectedSource.value.source_id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedSource.value.source_id}-template.xlsx`
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

// ── Upload ───────────────────────────────────────────────────────────
type State = 'idle' | 'uploading'
const state = ref<State>('idle')
const selectedFile = ref<File | null>(null)
const uploadProgress = ref(0)
const fileError = ref<string | null>(null)
const uploadResult = ref<DataUpload | null>(null)

async function onFileSelected(file: File) {
  if (!selectedSource.value && !templateLateMode.value) return
  fileError.value = null

  const isCsv = file.name.toLowerCase().endsWith('.csv')
  // Known feed: a CSV must declare the feed's current template version.
  // Routing-queue mode: there's no feed and no version to declare - the
  // version check happens later, when a template is assigned.
  const declaredSchemaVersion = (!templateLateMode.value && isCsv)
    ? selectedSource.value!.schema_version
    : null
  if (!templateLateMode.value && isCsv && !declaredSchemaVersion) {
    fileError.value = 'This feed has no template, so a CSV can’t be validated. Upload the .xlsx template instead.'
    return
  }

  selectedFile.value = file
  state.value = 'uploading'
  uploadProgress.value = 0
  try {
    if (templateLateMode.value && !selectedSource.value) {
      uploadResult.value = await api.uploads.intake(file, {}, (pct) => { uploadProgress.value = pct })
    } else {
      uploadResult.value = await api.uploads.create(
        selectedSource.value!.source_id, file, declaredSchemaVersion, (pct) => { uploadProgress.value = pct },
      )
    }
    state.value = 'idle'
    poll.start()
  } catch (e: any) {
    fileError.value = e?.data?.message || e?.message || 'Could not upload that file.'
    state.value = 'idle'
  }
}

async function pollUpload() {
  if (!uploadResult.value) return
  try {
    uploadResult.value = await api.uploads.detail(uploadResult.value.id)
  } catch {
    // transient - keep trying until the poll's own backoff/stop logic gives up
  }
}
const poll = useUploadPoll(pollUpload, () => !!uploadResult.value && isInFlight(uploadResult.value.status))

// ── Page-wide drag & drop ────────────────────────────────────────────
// A counter, not a boolean: dragenter/dragleave fire for every child the
// pointer crosses, so a flag would flicker off mid-drag.
const pageDragging = ref(false)
let dragDepth = 0
const canDropFile = computed(() =>
  tab.value === 'upload' && state.value === 'idle' && (!!selectedSource.value || templateLateMode.value),
)
const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')
if (import.meta.client) {
  useEventListener(window, 'dragenter', (e: DragEvent) => {
    if (tab.value !== 'upload' || !hasFiles(e)) return
    dragDepth++
    pageDragging.value = true
  })
  useEventListener(window, 'dragleave', (e: DragEvent) => {
    if (!hasFiles(e)) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (!dragDepth) pageDragging.value = false
  })
  useEventListener(window, 'dragover', (e: DragEvent) => { if (hasFiles(e)) e.preventDefault() })
  useEventListener(window, 'drop', (e: DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth = 0
    pageDragging.value = false
    // The dropzone handles drops that land on it (with its own validation);
    // this only catches drops elsewhere on the page.
    if ((e.target as HTMLElement | null)?.closest?.('.file-dropzone')) return
    const file = e.dataTransfer?.files?.[0]
    if (!file || !canDropFile.value) return
    const ok = /\.(xlsx|csv)$/i.test(file.name)
    if (!ok) { fileError.value = 'Upload a .xlsx or .csv file generated from the template.'; return }
    onFileSelected(file)
  })
}

function resetUpload() {
  uploadResult.value = null
  selectedFile.value = null
  fileError.value = null
  state.value = 'idle'
}

// ── Ribbon KPIs - loading/ok/unavailable are three different states; a
// failed fetch must never render as "0" (a real, confirmed count). ──────
const filesInPipeline = ref<number | null>(null)
const pipelineFailed = ref(false)
const pipelineState = computed(() => pipelineFailed.value ? 'unavailable' : filesInPipeline.value === null ? 'loading' : 'ok')
const recordsToday = ref<number | null>(null)
const recordsTodayFailed = ref(false)
const recordsTodayState = computed(() => recordsTodayFailed.value ? 'unavailable' : recordsToday.value === null ? 'loading' : 'ok')
const needsAttention = ref<number | null>(null)
const needsAttentionFailed = ref(false)
const needsAttentionState = computed(() => needsAttentionFailed.value ? 'unavailable' : needsAttention.value === null ? 'loading' : 'ok')

const TERMINAL_STATUSES: DataUploadStatus[] = ['committed', 'rejected', 'failed', 'superseded']

// One cheap call (`?only=uploads`, already tenant-scoped server-side)
// feeds both ribbon tiles - this used to be nine separate count queries.
async function loadUploadCounts() {
  try {
    const { uploads } = await api.uploadStats('all')
    const closed = TERMINAL_STATUSES.reduce((sum, st) => sum + (uploads.by_status[st] ?? 0), 0)
    filesInPipeline.value = Math.max(0, uploads.total - closed)
    needsAttention.value = uploads.needs_attention
  } catch {
    pipelineFailed.value = true
    needsAttentionFailed.value = true
  }
}

// ── Recent uploads (right rail) ─────────────────────────────────────
const recentUploads = ref<DataUpload[]>([])
const recentUploadsLoading = ref(true)
async function loadRecentUploads() {
  recentUploadsLoading.value = true
  try {
    recentUploads.value = (await api.uploads.inbox({ page_size: 6 })).results
  } catch {
    // right-rail nice-to-have - the console still works without it
  } finally {
    recentUploadsLoading.value = false
  }
}

const agencies = ref<{ agency_code: string; agency_name: string }[]>([])

onMounted(async () => {
  loadUploadCounts()
  loadRecentUploads()
  try {
    const [sourceRes, agencyRes] = await Promise.all([
      api.list({ page_size: 200 }),
      useAgencies().list({ page_size: 100 }),
    ])
    allSources.value = sourceRes.results
    recordsToday.value = sourceRes.results.reduce((sum, s) => sum + (s.records_today ?? 0), 0)
    agencies.value = agencyRes.results
  } catch {
    recordsTodayFailed.value = true
  } finally {
    feedsLoading.value = false
  }
})

// ══════════════════════════════════════════════════════════════════════
// Register an API - POST /api/v1/integrations/register/ + .../test-connection/
// (views.RegisterDataSourceView / TestConnectionView, admin-only). See
// those docstrings for the push-vs-pull distinction this UI mirrors:
// push credentials are generated server-side and shown once; pull
// credentials are the third party's own, encrypted at rest, and "test"
// makes a real SSRF-guarded outbound probe.
// ══════════════════════════════════════════════════════════════════════

type AuthMethodId = RegisterAuthMethod
const AUTH_LABELS: Record<AuthMethodId, string> = {
  api_key: 'API key', hmac: 'HMAC signature', bearer: 'Bearer token',
  basic: 'Basic auth', oauth2: 'OAuth2', mtls: 'mTLS',
}
interface AuthField { id: string; label: string; secret?: boolean }
const AUTH_FIELDS: Record<AuthMethodId, AuthField[]> = {
  api_key: [{ id: 'header', label: 'Header name' }, { id: 'key', label: 'API key', secret: true }],
  hmac: [{ id: 'header', label: 'Signature header' }, { id: 'secret', label: 'Signing secret', secret: true }],
  bearer: [{ id: 'token', label: 'Bearer token', secret: true }],
  basic: [{ id: 'user', label: 'Username' }, { id: 'pass', label: 'Password', secret: true }],
  oauth2: [{ id: 'client_id', label: 'Client ID' }, { id: 'client_secret', label: 'Client secret', secret: true }, { id: 'token_url', label: 'Token URL' }],
  mtls: [{ id: 'cert', label: 'Client certificate (PEM)', secret: true }, { id: 'key', label: 'Private key (PEM)', secret: true }],
}
interface Protocol {
  id: RegisterProtocol; name: string; meta: string; direction: 'push' | 'pull'
  auth: AuthMethodId[]; endpointLabel: string; endpointPlaceholder: string
}
// ids match apps.integrations.protocols.PROTOCOL_* exactly (not fetched
// dynamically - kept in sync by hand, see that module's own docstring).
const PROTOCOLS: Protocol[] = [
  { id: 'rest_push', name: 'REST push', meta: 'agency POSTs batches to us', direction: 'push', auth: ['api_key', 'hmac'], endpointLabel: 'Feed key (source_id)', endpointPlaceholder: 'kws-park-traffic' },
  { id: 'webhook', name: 'Webhook', meta: 'event-driven push', direction: 'push', auth: ['hmac', 'bearer'], endpointLabel: 'Feed key (source_id)', endpointPlaceholder: 'kaa-flight-events' },
  { id: 'streaming', name: 'Streaming', meta: 'Kafka / MQTT relay', direction: 'push', auth: ['api_key', 'mtls'], endpointLabel: 'Feed key (source_id)', endpointPlaceholder: 'kpa-vessel-stream' },
  { id: 'rest_pull', name: 'REST pull', meta: 'we poll their API', direction: 'pull', auth: ['bearer', 'oauth2', 'basic'], endpointLabel: "Agency's API base URL", endpointPlaceholder: 'https://api.agency.go.ke/v1' },
  { id: 'sftp', name: 'SFTP drop', meta: 'scheduled file pickup', direction: 'pull', auth: ['basic', 'mtls'], endpointLabel: 'SFTP host and path', endpointPlaceholder: 'sftp://files.agency.go.ke/outbound/' },
  { id: 'database', name: 'Database pull', meta: 'direct read replica', direction: 'pull', auth: ['basic', 'mtls'], endpointLabel: 'Connection string', endpointPlaceholder: 'postgres://reader@host:5432/agency_db' },
]

const agencyCode = ref('')
const registerSourceId = ref('')
const protocolId = ref<RegisterProtocol>('rest_push')
const protocol = computed(() => PROTOCOLS.find(p => p.id === protocolId.value) ?? PROTOCOLS[0]!)
const authOverride = ref<AuthMethodId | null>(null)
const authMethod = computed<AuthMethodId>(() =>
  authOverride.value && protocol.value.auth.includes(authOverride.value) ? authOverride.value : protocol.value.auth[0]!,
)
const credentials = reactive<Record<string, string>>({})
const revealed = reactive<Record<string, boolean>>({})
const endpointValue = ref('')
const cron = ref('*/15 * * * *')
type TestState = 'idle' | 'running' | 'passed' | 'failed'
const testState = ref<TestState>('idle')
const testDetail = ref('')
const registering = ref(false)
const registerError = ref<string | null>(null)
const registeredResult = ref<RegisterFeedResult | null>(null)
const secretCopied = ref(false)

function pickProtocol(id: RegisterProtocol) {
  protocolId.value = id
  authOverride.value = null
  endpointValue.value = ''
  testState.value = 'idle'
  testDetail.value = ''
}
function fieldKey(id: string) { return `${protocol.value.id}:${authMethod.value}:${id}` }

/** {field id: value}, dropping anything blank - sent as-is to the backend
 *  (ignored server-side for push protocols, which generate their own). */
const currentCredentials = computed(() => {
  const out: Record<string, string> = {}
  for (const f of AUTH_FIELDS[authMethod.value]) {
    const v = credentials[fieldKey(f.id)]
    if (v) out[f.id] = v
  }
  return out
})

async function runTest() {
  testState.value = 'running'
  testDetail.value = ''
  try {
    const res = await api.testConnection({
      protocol: protocol.value.id,
      endpoint_value: protocol.value.direction === 'push' ? registerSourceId.value.trim() : endpointValue.value.trim(),
    })
    testState.value = res.ok ? 'passed' : 'failed'
    testDetail.value = res.detail
  } catch (e: any) {
    testState.value = 'failed'
    testDetail.value = e?.data?.message || e?.message || 'Could not run the test.'
  }
}

async function saveFeed() {
  registerError.value = null
  const id = registerSourceId.value.trim().toLowerCase()
  if (!id) { registerError.value = 'Feed ID is required.'; return }
  if (!agencyCode.value) { registerError.value = 'Choose an agency first.'; return }
  if (protocol.value.direction === 'pull' && !endpointValue.value.trim()) {
    registerError.value = `${protocol.value.endpointLabel} is required.`
    return
  }
  registering.value = true
  try {
    const result = await api.registerFeed({
      source_id: id,
      agency_code: agencyCode.value,
      protocol: protocol.value.id,
      auth_method: authMethod.value,
      endpoint_value: protocol.value.direction === 'push' ? id : endpointValue.value.trim(),
      reconcile_cron: protocol.value.direction === 'pull' ? cron.value : undefined,
      credentials: currentCredentials.value,
    })
    registeredResult.value = result
    allSources.value = [...allSources.value, result]
  } catch (e: any) {
    registerError.value = e?.data?.message || e?.message || 'Could not register this feed.'
  } finally {
    registering.value = false
  }
}

async function copySecret() {
  if (!registeredResult.value?.issued_secret) return
  try {
    await navigator.clipboard.writeText(registeredResult.value.issued_secret)
    secretCopied.value = true
    setTimeout(() => { secretCopied.value = false }, 2000)
  } catch {
    // Clipboard API unavailable (permissions/non-secure context) - the
    // value is still visible and selectable in the banner either way.
  }
}

function resetRegisterForm() {
  registeredResult.value = null
  registerError.value = null
  registerSourceId.value = ''
  endpointValue.value = ''
  for (const k of Object.keys(credentials)) delete credentials[k]
  for (const k of Object.keys(revealed)) delete revealed[k]
  testState.value = 'idle'
  testDetail.value = ''
}

const curlExample = computed(() => {
  const p = protocol.value
  if (p.direction === 'push') {
    // Every push credential is a plain generated API key under the hood
    // regardless of the auth_method label - see step 2's note and
    // RegisterDataSourceView's docstring.
    const key = registerSourceId.value.trim() || '<source_id>'
    return `curl -X POST ${apiBase}/api/v1/integrations/${key}/ingest/ \\\n  -H "X-API-Key: ••••" -H "Content-Type: application/json" \\\n  -d '{"records":[{ "record_type": "…", … }]}'`
  }
  const authHeader =
    authMethod.value === 'bearer' ? '-H "Authorization: Bearer ••••"'
      : authMethod.value === 'basic' ? '-u agency_reader:••••'
        : authMethod.value === 'oauth2' ? '-H "Authorization: Bearer ${ACCESS_TOKEN}"'
          : '--cert client.pem --key client-key.pem'
  const target = endpointValue.value.trim() || p.endpointPlaceholder
  return `curl -X GET ${target} \\\n  ${authHeader}`
})
</script>

<style scoped>
.hub-layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; align-items: start; }
@media (max-width: 900px) { .hub-layout { grid-template-columns: 1fr; } }

/* Numbered stepper - CSS counter so a hidden step 2 (no template feed /
   routing-queue mode) renumbers the rest automatically. */
.flow-steps { list-style: none; margin: 0; padding: 0; counter-reset: step; }
.flow-step {
  position: relative; counter-increment: step;
  padding: 0 0 22px 40px; margin: 0;
}
.flow-step:last-child { padding-bottom: 0; }
.flow-step::before {
  content: counter(step);
  position: absolute; left: 0; top: -2px;
  width: 26px; height: 26px; border-radius: var(--r-pill);
  display: flex; align-items: center; justify-content: center;
  font: 700 12px/1 var(--font-mono);
  color: var(--primary); background: var(--info-bg); border: 1px solid var(--primary);
}
/* Connector line down to the next step's badge. */
.flow-step:not(:last-child)::after {
  content: ''; position: absolute; left: 13px; top: 28px; bottom: 6px; width: 1px;
  background: var(--border-subtle);
}
.flow-step-label { display: block; font-size: 13px; font-weight: 600; color: var(--fg-1); margin-bottom: 8px; padding-top: 3px; }
.selected-source-meta { font-size: 11.5px; color: var(--fg-3); margin-top: 6px; }

.linkish {
  background: none; border: none; padding: 0; cursor: pointer;
  color: var(--primary); font: inherit; font-size: 12px; font-weight: 600;
}
.linkish:hover { text-decoration: underline; }
.template-late-toggle { display: inline-block; margin-top: 10px; }
.template-late-note {
  margin-top: 10px; font-size: 12px; line-height: 1.55; color: var(--fg-2);
  background: var(--info-bg); border: 1px solid var(--info-fg); border-radius: var(--r-sm);
  padding: 10px 12px;
}
.template-late-note strong { color: var(--fg-1); }
.template-late-note .linkish { margin-left: 4px; }

.upload-result-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.upload-banner { border-radius: var(--r-sm); padding: 10px 12px; font-size: 12px; margin-top: 12px; }
.upload-banner-error { background: var(--danger-bg); border: 1px solid var(--danger-fg); color: var(--danger-fg); }
.upload-banner-info { background: var(--info-bg); border: 1px solid var(--info-fg); color: var(--fg-1); }
.upload-banner-info a { color: var(--primary); font-weight: 600; }
.upload-banner-warning { background: var(--warning-bg); border: 1px solid var(--warning-fg); color: var(--fg-1); }
.upload-banner-success { background: var(--success-bg); border: 1px solid var(--success-fg); color: var(--fg-1); }
.upload-banner code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; background: var(--surface-quiet); padding: 1px 5px; border-radius: var(--r-xs); }

.secret-row { display: flex; align-items: center; gap: 8px; }
.secret-value {
  flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
  background: var(--surface-1); border: 1px solid var(--border-subtle); border-radius: var(--r-xs);
  padding: 6px 10px; color: var(--fg-1); user-select: all;
}

.upload-result { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.upload-result-main { font-size: 13.5px; color: var(--fg-1); margin: 0; display: flex; align-items: center; gap: 8px; }
.upload-result-main--error { color: var(--danger-fg); }
.spinner { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--border-subtle); border-top-color: var(--primary); animation: hub-spin .7s linear infinite; }
@keyframes hub-spin { to { transform: rotate(360deg); } }

.feed-mini-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.feed-mini-list li { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.feed-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--fg-3); flex-shrink: 0; }
.feed-dot.success { background: var(--success-fg); }
.feed-dot.warning { background: var(--warning-fg); }
.feed-dot.danger { background: var(--danger-fg); }
.feed-dot.info { background: var(--info-fg); }
.link-see-all { display: inline-block; margin-top: 10px; font-size: 12px; color: var(--primary); text-decoration: none; }
.link-see-all:hover { text-decoration: underline; }

.recent-upload-link { display: contents; text-decoration: none; }
.recent-upload-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fg-1); }
.recent-upload-link:hover .recent-upload-name { color: var(--primary); text-decoration: underline; }

/* ── Register API - protocol grid, auth pills, fields, curl ──────────── */
.protocol-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
@media (max-width: 640px) { .protocol-grid { grid-template-columns: repeat(2, 1fr); } }
.protocol {
  text-align: left; background: var(--surface-1); border: 1px solid var(--border-subtle); border-radius: var(--r-sm);
  padding: 10px 12px; cursor: pointer; transition: border-color var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-out);
}
.protocol:hover { border-color: var(--border-interactive); }
.protocol:active { transform: scale(.99); }
.protocol.active { background: var(--info-bg); border-color: var(--primary); }
.protocol-name { font-size: 12px; font-weight: 600; color: var(--fg-1); }
.protocol.active .protocol-name { color: var(--primary); }
.protocol-meta { font-size: 10.5px; color: var(--fg-3); margin-top: 2px; }

.pill-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.pill {
  border-radius: var(--r-pill); padding: 5px 12px; font-size: 11px; font-weight: 600; cursor: pointer;
  background: var(--surface-2); color: var(--fg-3); border: 1px solid var(--border-subtle);
}
.pill:hover { color: var(--fg-1); }
.pill.active { background: var(--info-bg); border-color: var(--primary); color: var(--primary); }

.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field-grid--3 { grid-template-columns: 2fr 1fr; }
@media (max-width: 560px) { .field-grid, .field-grid--3 { grid-template-columns: 1fr; } }
.field { display: block; }
.field--span2 { grid-column: span 2; }
@media (max-width: 560px) { .field--span2 { grid-column: span 1; } }
.field-label { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; color: var(--fg-3); margin-bottom: 5px; }
.reveal-btn { background: none; border: none; padding: 0; cursor: pointer; font-size: 11px; font-weight: 600; color: var(--primary); }
.reveal-btn:hover { text-decoration: underline; }
.field-input { width: 100%; }

.curl-block {
  /* Deliberately NOT theme-following - a terminal/code block stays a fixed
     dark surface with light text in both app themes, the same way a
     syntax-highlighted snippet would. var(--fg-1) would flip to a LIGHT
     colour in dark mode and leave the cream text unreadable on it. */
  margin: 14px 0 0; overflow-x: auto; background: #111823; color: #E8E1D2;
  border-radius: var(--r-sm); padding: 12px 14px; font: 400 11px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre-wrap; word-break: break-all;
}

.test-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.test-result {
  display: flex; align-items: center; gap: 6px; margin-top: 14px; padding: 10px 12px; border-radius: var(--r-sm);
  font-size: 12px; font-weight: 500;
}
.test-result--ok { background: var(--success-bg); color: var(--success-fg); border: 1px solid var(--success-fg); }
.test-result--bad { background: var(--danger-bg); color: var(--danger-fg); border: 1px solid var(--danger-fg); }

.btn-ico { vertical-align: -2px; margin-right: 6px; flex-shrink: 0; }
.page-drop {
  position: fixed; inset: 0; z-index: 60; display: grid; place-items: center;
  background: var(--primary-wash-strong); pointer-events: none;
}
.page-drop-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 28px 44px;
  background: var(--surface-2); border: 2px dashed var(--primary); border-radius: var(--r-md);
  color: var(--primary); box-shadow: var(--elev-2);
}
.page-drop-card strong { font-size: 15px; color: var(--fg-1); }
</style>
