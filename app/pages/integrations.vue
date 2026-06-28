<template>
  <PageHeader
    eyebrow="Data Integration Hub"
    title="Integrations"
    subtitle="All UAPTS agency feeds - NTSA · KeNHA · KURA · KeRRA · KRB · KAA · KCAA · KMD · KenTrade · LAPSSET · NaMATA · KRC · KPA · KMA · NCTTCA"
  >
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Feeds"
      :value="String(sources.length)"
      sub="Registered data sources"
      source="live" source-title="UAPTS"
    />
    <KpiCard
      label="Connected"
      :value="String(byStatus('connected'))"
      sub="Actively syncing"
      trend-direction="up"
      source="live" source-title="UAPTS"
    />
    <KpiCard
      label="Degraded"
      :value="String(byStatus('degraded'))"
      sub="Partial / error"
      :trend-direction="byStatus('degraded') === 0 ? 'up' : 'down'"
      source="live" source-title="UAPTS"
    />
    <KpiCard
      label="Disconnected"
      :value="String(byStatus('disconnected'))"
      sub="Not syncing"
      :trend-direction="byStatus('disconnected') === 0 ? 'up' : 'down'"
      source="live" source-title="UAPTS"
    />
    <KpiCard
      label="Records Today"
      :value="fmtNum(totalRecordsToday)"
      sub="Across all feeds"
      source="live" source-title="UAPTS"
    />
  </div>

  <!-- Filters -->
  <div class="filter-bar">
    <input v-model="searchFilter" class="select-sm" placeholder="Search name or agency…" style="min-width:180px" />
    <select v-model="statusFilter" class="select-sm">
      <option value="">All statuses</option>
      <option value="connected">Connected</option>
      <option value="degraded">Degraded</option>
      <option value="disconnected">Disconnected</option>
      <option value="paused">Paused</option>
      <option value="pending">Pending</option>
    </select>
    <select v-model="modeFilter" class="select-sm">
      <option value="">All modes</option>
      <option value="push">Push</option>
      <option value="pull">Pull</option>
      <option value="webhook">Webhook</option>
      <option value="kafka">Kafka</option>
      <option value="sftp">SFTP</option>
      <option value="api">API</option>
      <option value="manual">Manual</option>
    </select>
    <button class="btn" @click="applyFilters">Apply</button>
    <button class="btn" @click="resetFilters">Reset</button>
    <span style="flex:1" />
    <span class="result-count">{{ filteredSources.length }} feeds</span>
  </div>

  <!-- Feed table -->
  <SectionTitle>Data Sources</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Agency</th>
            <th>Agency Name</th>
            <th>Source System</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Last Sync</th>
            <th>Records Today</th>
            <th>Endpoint</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody v-if="filteredSources.length">
          <template v-for="src in filteredSources" :key="src.source_id">
            <tr class="feed-row" @click="expanded = expanded === src.source_id ? null : src.source_id">
              <td><BadgePill variant="neutral">{{ src.agency_code }}</BadgePill></td>
              <td style="font-size:12px;color:#374151">{{ src.agency_name }}</td>
              <td style="font-weight:600">{{ src.name }}</td>
              <td><BadgePill variant="info">{{ src.mode }}</BadgePill></td>
              <td><BadgePill :variant="statusBadge(src.status)">{{ src.status }}</BadgePill></td>
              <td style="font-size:12px;white-space:nowrap">{{ src.last_sync_at ? fmtTime(src.last_sync_at) : 'Never' }}</td>
              <td style="font-weight:600;text-align:right">{{ fmtNum(src.records_today ?? 0) }}</td>
              <td class="endpoint-cell">{{ src.endpoint_url ?? '-' }}</td>
              <td>
                <div style="display:flex;gap:4px">
                  <button
                    class="btn" style="font-size:12px"
                    :disabled="actionId === src.source_id"
                    @click.stop="trigger(src.source_id)"
                  >⚡ Sync</button>
                  <button
                    v-if="src.status !== 'paused'"
                    class="btn" style="font-size:12px;color:#ca8a04"
                    :disabled="actionId === src.source_id"
                    @click.stop="pause(src.source_id)"
                  >⏸ Pause</button>
                  <button
                    v-else
                    class="btn" style="font-size:12px;color:#16a34a"
                    :disabled="actionId === src.source_id"
                    @click.stop="resume(src.source_id)"
                  >▶ Resume</button>
                </div>
              </td>
            </tr>
            <tr v-if="expanded === src.source_id" :key="`${src.source_id}-detail`">
              <td colspan="9" class="error-row">
                <div class="error-detail">
                  <div style="font-size:12px;font-weight:600;margin-bottom:4px">
                    <span :style="{ color: src.status === 'degraded' || src.status === 'disconnected' ? '#dc2626' : '#15803d' }">
                      {{ src.status === 'degraded' || src.status === 'disconnected' ? '⚠ Last Error' : '✓ No Errors' }}
                    </span>
                  </div>
                  <div style="font-size:12px;font-family:monospace;color:#475569;white-space:pre-wrap">
                    {{ src.last_error ?? 'No errors recorded.' }}
                  </div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:4px">
                    Source ID: <strong>{{ src.source_id }}</strong> · Endpoint: {{ src.endpoint_url ?? '-' }}
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="9" style="text-align:center;color:#94a3b8;padding:20px">
              {{ loading ? 'Loading integrations…' : 'No feeds match the current filters.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Ingestion Log -->
  <SectionTitle style="margin-top:20px" pill="live">Ingestion Log</SectionTitle>

  <div class="filter-bar" style="margin-bottom:8px">
    <input v-model="recSearch" class="select-sm" placeholder="Search record type or agency…" style="min-width:200px" />
    <select v-model="recSource" class="select-sm" style="min-width:160px">
      <option value="">All sources</option>
      <option v-for="s in sources" :key="s.source_id" :value="s.source_id">
        {{ s.agency_code }} - {{ s.source_system }}
      </option>
    </select>
    <button class="btn" @click="loadRecords">Apply</button>
    <span style="flex:1" />
    <span class="result-count">{{ records.length }} records</span>
  </div>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Agency</th>
            <th>Source ID</th>
            <th>Record Type</th>
            <th>Handler</th>
            <th>Event At</th>
            <th>Handler Error</th>
          </tr>
        </thead>
        <tbody v-if="records.length">
          <tr v-for="r in records" :key="r.id">
            <td><BadgePill variant="neutral">{{ r.agency_name ?? '-' }}</BadgePill></td>
            <td class="mono-sm">{{ r.source_id }}</td>
            <td class="mono-sm" style="color:#0369a1">{{ r.record_type }}</td>
            <td class="mono-sm" style="color:#374151">{{ r.handler || '-' }}</td>
            <td style="font-size:12px;white-space:nowrap;color:#64748b">{{ fmtTime(r.event_at) }}</td>
            <td>
              <span v-if="r.handler_error" class="error-chip">{{ truncate(r.handler_error, 60) }}</span>
              <BadgePill v-else variant="success" size="sm">OK</BadgePill>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">
              {{ recordsLoading ? 'Loading ingestion log…' : 'No records found.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Integrations')

import { useIntegrations } from '~/composables/api'
import type { DataSource, IngestedRecord } from '~/composables/api'

const sources        = ref<DataSource[]>([])
const records        = ref<IngestedRecord[]>([])
const loading        = ref(true)
const recordsLoading = ref(false)
const error          = ref<string | null>(null)
const expanded       = ref<string | null>(null)
const actionId       = ref<string | null>(null)

const searchFilter = ref('')
const statusFilter = ref('')
const modeFilter   = ref('')

const recSearch = ref('')
const recSource = ref('')

const api = useIntegrations()

async function load() {
  loading.value = true
  error.value   = null
  const [res] = await Promise.allSettled([
    api.list({ page_size: 100, search: searchFilter.value || undefined }),
  ])
  if (res.status === 'fulfilled') sources.value = (res.value as any).results ?? []
  else error.value = 'Unable to reach the UAPTS Integrations API.'
  loading.value = false
}

async function loadRecords() {
  recordsLoading.value = true
  try {
    const res = await api.records({
      page_size: 50,
      ordering: '-event_at',
      search: recSearch.value || undefined,
      source: recSource.value || undefined,
    })
    records.value = (res as any).results ?? []
  } catch { /* leave existing records */ } finally {
    recordsLoading.value = false
  }
}

function applyFilters() { load() }
function resetFilters()  { searchFilter.value = ''; statusFilter.value = ''; modeFilter.value = ''; load() }

onMounted(() => { load(); loadRecords() })

let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(() => { load(); loadRecords() }, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Filtered list (client-side status/mode after API fetch) ───────────

const filteredSources = computed(() =>
  sources.value.filter(src => {
    if (statusFilter.value && src.status !== statusFilter.value) return false
    if (modeFilter.value   && src.mode   !== modeFilter.value)   return false
    return true
  }),
)

const totalRecordsToday = computed(() =>
  sources.value.reduce((s, src) => s + (src.records_today ?? 0), 0),
)

function byStatus(s: string) { return sources.value.filter(src => src.status === s).length }

// ── Actions ───────────────────────────────────────────────────────────

async function trigger(sourceId: string) {
  actionId.value = sourceId
  try { await api.trigger(sourceId); await load() } catch {} finally { actionId.value = null }
}

async function pause(sourceId: string) {
  actionId.value = sourceId
  try {
    await api.pause(sourceId)
    const idx = sources.value.findIndex(s => s.source_id === sourceId)
    if (idx !== -1) sources.value[idx] = { ...sources.value[idx], status: 'paused' }
  } catch {} finally { actionId.value = null }
}

async function resume(sourceId: string) {
  actionId.value = sourceId
  try {
    await api.resume(sourceId)
    const idx = sources.value.findIndex(s => s.source_id === sourceId)
    if (idx !== -1) sources.value[idx] = { ...sources.value[idx], status: 'connected' }
  } catch {} finally { actionId.value = null }
}

// ── Helpers ───────────────────────────────────────────────────────────

function statusBadge(s: string) {
  const m: Record<string, string> = {
    connected: 'success', degraded: 'warning', disconnected: 'danger',
    paused: 'neutral', pending: 'info',
  }
  return m[s] ?? 'neutral'
}

function fmtNum(v: number) { return v.toLocaleString() }

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-KE', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '…' : s
}
</script>

<style scoped>
.error-banner   { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid       { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:16px; }
.filter-bar     { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
.result-count   { font-size:12px; color:#64748b; }
.feed-row       { cursor:pointer; }
.feed-row:hover { background:#f8fafc; }
.error-row      { background:#fef2f2; }
.error-detail   { padding:8px 12px; }
.endpoint-cell  { font-size:11px; font-family:monospace; color:#64748b; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mono-sm        { font-family:monospace; font-size:12px; color:#1e293b; }
.error-chip     { font-size:11px; font-family:monospace; color:#dc2626; background:#fef2f2; border:1px solid #fecaca; border-radius:4px; padding:2px 6px; white-space:nowrap; max-width:260px; overflow:hidden; text-overflow:ellipsis; display:inline-block; }
</style>
