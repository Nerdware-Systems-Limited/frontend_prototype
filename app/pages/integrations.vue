<script setup lang="ts">
// pages/integrations.vue — M12 Integration Hub.
//
// Wires to:
//   • /api/v1/integrations/                   — list of upstream feeds
//   • /api/v1/integrations/<id>/trigger/      — re-run ingestion
//   • /api/v1/integrations/<id>/pause/        — pause scheduled pull
//   • /api/v1/integrations/<id>/resume/       — resume
import { RefreshCw, Link2, Play, Pause, RotateCw, ChevronRight } from 'lucide-vue-next'
import { useIntegrations } from '~/composables/api'

definePageMeta({ layout: 'default', title: 'Integrations' })

const api = useIntegrations()
const items = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const filterStatus = ref<string>('')
const filterMode = ref<string>('')

async function load() {
  loading.value = true
  error.value = null
  try {
    const d = await api.list({ page_size: 100 })
    items.value = d.results ?? []
  } catch (err: any) {
    error.value = err?.status === 404
      ? 'Integration endpoints not yet wired up on the backend.'
      : err?.message ?? 'Failed to load integrations.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filtered = computed(() => items.value.filter((i) => {
  if (filterStatus.value && i.status !== filterStatus.value) return false
  if (filterMode.value && i.mode !== filterMode.value) return false
  return true
}))

const counts = computed(() => {
  const c: Record<string, number> = { connected: 0, degraded: 0, disconnected: 0, pending: 0 }
  for (const i of items.value) c[i.status] = (c[i.status] ?? 0) + 1
  return c
})

async function trigger(id: string) {
  try { await api.trigger(id) }
  catch { /* ignore for now */ }
}
async function pause(id: string) {
  try { await api.pause(id) }
  catch { /* ignore */ }
}
async function resume(id: string) {
  try { await api.resume(id) }
  catch { /* ignore */ }
}

function fmtSync(iso?: string | null) {
  if (!iso) return '—'
  const dt = new Date(iso)
  const ms = Date.now() - dt.getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
</script>

<template>
  <div class="integrations-page">
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M12 · Data Integration Hub</div>
        <h1 class="text-display">Integrations</h1>
        <p class="text-sm text-fg-muted mt-1">
          Upstream feeds from the {{ items.length }} agencies that power UAPTS.
        </p>
      </div>
      <button class="btn btn-secondary" @click="load">
        <RefreshCw :size="13" /> Refresh
      </button>
    </div>

    <!-- Status strip -->
    <div v-if="items.length" class="status-strip card">
      <div class="status-item">
        <span class="dot dot-live" /> <span class="text-xs">Connected</span>
        <span class="badge badge-success ml-1">{{ counts.connected }}</span>
      </div>
      <div class="status-item">
        <span class="dot dot-warn" /> <span class="text-xs">Degraded</span>
        <span class="badge badge-warning ml-1">{{ counts.degraded }}</span>
      </div>
      <div class="status-item">
        <span class="dot dot-dead" /> <span class="text-xs">Disconnected</span>
        <span class="badge badge-danger ml-1">{{ counts.disconnected }}</span>
      </div>
      <div class="status-item">
        <span class="dot dot-pending" /> <span class="text-xs">Pending</span>
        <span class="badge badge-neutral ml-1">{{ counts.pending }}</span>
      </div>
    </div>

    <!-- Filters -->
    <div v-if="items.length" class="filters card">
      <select v-model="filterStatus" class="input filter-select">
        <option value="">All statuses</option>
        <option value="connected">Connected</option>
        <option value="degraded">Degraded</option>
        <option value="disconnected">Disconnected</option>
        <option value="pending">Pending</option>
      </select>
      <select v-model="filterMode" class="input filter-select">
        <option value="">All modes</option>
        <option value="api">API</option>
        <option value="csv">CSV</option>
        <option value="manual">Manual</option>
      </select>
      <span class="text-xs text-fg-dim ml-auto">
        Showing {{ filtered.length }} / {{ items.length }}
      </span>
    </div>

    <!-- Table -->
    <div class="card">
      <div v-if="error" class="card-body text-fg-muted">{{ error }}</div>
      <div v-else-if="loading && !items.length" class="card-body text-fg-muted">
        Loading integrations…
      </div>
      <div v-else-if="!filtered.length" class="card-body text-fg-muted">
        No integrations match the current filters.
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Agency</th>
            <th>System</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Last Sync</th>
            <th>Endpoint</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in filtered" :key="i.source_id">
            <td>
              <div class="flex items-center gap-2">
                <Link2 :size="13" class="text-primary" />
                <span class="font-medium">{{ i.source_id }}</span>
              </div>
              <div v-if="i.last_error" class="text-xs text-warning mt-0.5">
                {{ i.last_error }}
              </div>
            </td>
            <td>
              <span class="font-mono text-xs">{{ i.agency_code }}</span>
              <div class="text-xs text-fg-muted">{{ i.agency_name }}</div>
            </td>
            <td>{{ i.source_system }}</td>
            <td><span class="badge badge-neutral">{{ i.mode.toUpperCase() }}</span></td>
            <td>
              <span
                class="badge"
                :class="{
                  'badge-success': i.status === 'connected',
                  'badge-warning': i.status === 'degraded',
                  'badge-danger':  i.status === 'disconnected',
                  'badge-neutral': i.status === 'pending',
                }"
              >
                <span class="dot dot-inline" :class="`dot-${i.status === 'connected' ? 'live' : i.status === 'degraded' ? 'warn' : i.status === 'disconnected' ? 'dead' : 'pending'}`" />
                {{ i.status }}
              </span>
            </td>
            <td class="font-mono text-xs">{{ fmtSync(i.last_sync_at) }}</td>
            <td class="text-xs text-fg-muted font-mono truncate-cell">
              {{ i.endpoint_url ?? '—' }}
            </td>
            <td class="actions-cell">
              <button class="btn btn-ghost btn-icon" title="Trigger sync" @click="trigger(i.source_id)">
                <Play :size="12" />
              </button>
              <button class="btn btn-ghost btn-icon" title="Pause" @click="pause(i.source_id)">
                <Pause :size="12" />
              </button>
              <button class="btn btn-ghost btn-icon" title="Resume" @click="resume(i.source_id)">
                <RotateCw :size="12" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.integrations-page { display: flex; flex-direction: column; gap: 16px; }
.card-body { padding: 18px; }

.status-strip { display: flex; align-items: center; gap: 20px; padding: 10px 18px; flex-wrap: wrap; }
.status-item { display: flex; align-items: center; gap: 6px; }

.dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot-live    { background: var(--success, #10b981); }
.dot-warn    { background: var(--warning, #f59e0b); }
.dot-dead    { background: var(--danger,  #ef4444); }
.dot-pending { background: var(--fg-dim,  #475569); }
.dot-inline { display: inline-block; margin-right: 4px; vertical-align: middle; }

.badge { padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 4px; }
.badge-success { background: rgba(16,185,129,0.15); color: #10b981; }
.badge-warning { background: rgba(245,158,11,0.15); color: #f59e0b; }
.badge-danger  { background: rgba(239,68,68,0.15);  color: #ef4444; }
.badge-neutral { background: rgba(148,163,184,0.15); color: #94a3b8; }

.filters {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
}
.filter-select { width: 180px; }
.input {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 6px 10px; color: var(--fg); font-size: 0.8rem;
}

.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 10px 18px; text-align: left; }
.data-table thead th {
  font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--fg-muted); border-bottom: 1px solid var(--border);
}
.data-table tbody tr { border-bottom: 1px solid var(--border); }
.data-table tbody tr:last-child { border-bottom: none; }
.data-table tbody tr:hover { background: rgba(255,255,255,0.025); }

.truncate-cell { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.actions-cell { display: flex; gap: 2px; }
.btn-icon { padding: 5px 7px; }
.btn-ghost { background: none; border: 1px solid transparent; cursor: pointer; }
.btn-ghost:hover { background: rgba(255,255,255,0.06); border-color: var(--border); }
.btn-secondary {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 6px 12px; cursor: pointer; color: var(--fg);
  display: inline-flex; align-items: center; gap: 6px;
}
</style>
