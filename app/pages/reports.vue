<script setup lang="ts">
// pages/reports.vue — M09 Report Center.
//
// Wires to:
//   • /api/v1/reports/catalog/    — pre-built templates
//   • /api/v1/reports/runs/       — run history
//   • /api/v1/reports/generate/   — kick off a run (POST)
import { RefreshCw, FileText, Download, Play, Clock, CheckCircle2, XCircle, Loader2, Plus, FileDown } from 'lucide-vue-next'
import { useReports } from '~/composables/api'

definePageMeta({ layout: 'default', title: 'Reports' })

const reports = useReports()
const catalog = ref<any[]>([])
const runs = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const generatingId = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [c, r] = await Promise.allSettled([
      reports.catalog(),
      reports.runs({ page_size: 20 }),
    ])
    catalog.value = c.status === 'fulfilled' ? c.value : []
    runs.value = r.status === 'fulfilled' ? (r.value as any).results ?? [] : []
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load reports.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filteredCatalog = computed(() => catalog.value)

async function generate(template: any) {
  generatingId.value = template.id
  try {
    const run = await reports.generate({ template_id: template.id, format: template.formats[0] })
    runs.value = [run, ...runs.value]
  } catch { /* ignore */ }
  finally {
    generatingId.value = null
  }
}

function downloadUrl(id: string) {
  return reports.downloadUrl(id)
}

function statusIcon(s: string) {
  if (s === 'completed') return CheckCircle2
  if (s === 'failed')    return XCircle
  if (s === 'running' || s === 'queued') return Loader2
  return Clock
}
function statusClass(s: string) {
  if (s === 'completed') return 'badge-success'
  if (s === 'failed')    return 'badge-danger'
  if (s === 'running' || s === 'queued') return 'badge-warning'
  return 'badge-neutral'
}

function fmt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-KE', { hour12: false })
}
</script>

<template>
  <div class="reports-page">
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M09 · Reporting & BI</div>
        <h1 class="text-display">Report Center</h1>
        <p class="text-sm text-fg-muted mt-1">
          {{ catalog.length }} templates · {{ runs.length }} recent runs
        </p>
      </div>
      <NuxtLink to="/query-builder" class="btn btn-secondary">
        <Plus :size="13" /> Ad-hoc Query
      </NuxtLink>
    </div>

    <!-- Catalog -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <FileText :size="15" class="text-primary" />
          <div class="text-subhead">Report Catalog</div>
        </div>
        <button class="btn btn-ghost" @click="load">
          <RefreshCw :size="12" /> Refresh
        </button>
      </div>
      <div v-if="error" class="card-body text-fg-muted">{{ error }}</div>
      <div v-else-if="loading && !catalog.length" class="card-body text-fg-muted">
        Loading catalog…
      </div>
      <div v-else-if="!filteredCatalog.length" class="card-body text-fg-muted">
        No report templates available.
      </div>
      <div v-else class="catalog-grid">
        <div v-for="t in filteredCatalog" :key="t.id" class="catalog-card">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-mono text-primary">{{ t.module }}</span>
            <span v-if="t.schedule" class="badge badge-neutral text-xs">{{ t.schedule }}</span>
          </div>
          <div class="text-subhead">{{ t.name }}</div>
          <div v-if="t.description" class="text-xs text-fg-muted mt-1">
            {{ t.description }}
          </div>
          <div class="flex items-center justify-between mt-3">
            <div class="flex gap-1.5">
              <span v-for="f in t.formats" :key="f" class="badge badge-neutral text-xs">
                {{ f.toUpperCase() }}
              </span>
            </div>
            <button
              class="btn btn-primary"
              :disabled="generatingId === t.id"
              @click="generate(t)"
            >
              <Loader2 v-if="generatingId === t.id" :size="12" class="animate-spin" />
              <Play v-else :size="12" />
              Generate
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Runs -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Clock :size="15" class="text-primary" />
          <div class="text-subhead">Recent Runs</div>
        </div>
        <span class="text-xs text-fg-dim">{{ runs.length }} entries</span>
      </div>
      <div v-if="!runs.length" class="card-body text-fg-muted">
        No report runs yet. Click <strong>Generate</strong> on a template above.
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Run ID</th>
            <th>Template</th>
            <th>Format</th>
            <th>Status</th>
            <th>Requested</th>
            <th>By</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in runs" :key="r.id">
            <td class="font-mono text-xs">{{ r.id }}</td>
            <td>
              <div class="text-sm font-medium">{{ r.template_id }}</div>
            </td>
            <td><span class="badge badge-neutral">{{ r.format?.toUpperCase() ?? 'PDF' }}</span></td>
            <td>
              <span class="badge" :class="statusClass(r.status)">
                <component :is="statusIcon(r.status)" :size="11" class="mr-0.5" />
                {{ r.status }}
              </span>
            </td>
            <td class="font-mono text-xs">{{ fmt(r.requested_at) }}</td>
            <td class="text-xs">{{ r.requested_by ?? '—' }}</td>
            <td>
              <a
                v-if="r.status === 'completed'"
                :href="downloadUrl(r.id)"
                class="btn btn-ghost"
                download
              >
                <FileDown :size="12" /> Download
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.reports-page { display: flex; flex-direction: column; gap: 16px; }
.card-body { padding: 18px; }

.card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--border);
}

.catalog-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px; padding: 16px;
}
.catalog-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px;
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

.badge { padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 3px; }
.badge-success { background: rgba(16,185,129,0.15); color: #10b981; }
.badge-warning { background: rgba(245,158,11,0.15); color: #f59e0b; }
.badge-danger  { background: rgba(239,68,68,0.15);  color: #ef4444; }
.badge-neutral { background: rgba(148,163,184,0.15); color: #94a3b8; }

.btn-primary {
  background: var(--primary, #3b82f6); color: white;
  border: none; border-radius: var(--radius-sm); padding: 5px 10px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem;
}
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 6px 12px; cursor: pointer; color: var(--fg);
  display: inline-flex; align-items: center; gap: 6px; text-decoration: none;
}
.btn-ghost {
  background: none; border: 1px solid transparent; cursor: pointer; color: var(--fg-muted);
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: var(--radius-sm);
  font-size: 0.75rem; text-decoration: none;
}
.btn-ghost:hover { background: rgba(255,255,255,0.06); }
.animate-spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
