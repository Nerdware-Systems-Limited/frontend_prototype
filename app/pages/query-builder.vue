<template>
  <PageHeader
    eyebrow="M15 - Ad-hoc Query Engine"
    title="Query Builder"
    subtitle="Build and execute ad-hoc queries across UAPTS datasets - incidents, vehicles, congestion, blackspots, GPS tracks, and traffic counts"
  >
    <template #actions>
      <span class="freshness-badge">Interactive · Results not auto-refreshed</span>
      <NuxtLink to="/reports" class="btn">Reports →</NuxtLink>
    </template>
  </PageHeader>

  <div class="query-layout">
    <!-- Left panel: builder -->
    <div class="query-panel">
      <div class="card">
        <div class="card-header">Dataset</div>
        <div class="card-body">
          <select v-model="selectedDataset" class="select-full" @change="onDatasetChange">
            <option value="">Select a dataset…</option>
            <option v-for="(ds, key) in datasets" :key="key" :value="key">
              {{ ds.label }} ({{ ds.module }})
            </option>
          </select>
          <div v-if="currentDataset" class="ds-examples">
            <div class="ds-examples-head">Example queries</div>
            <div v-for="ex in currentDataset.examples" :key="ex" class="ds-example-item">{{ ex }}</div>
          </div>
        </div>
      </div>

      <div class="card panel-card" v-if="currentDataset">
        <div class="card-header">
          Fields
          <div class="field-actions">
            <button class="mini-btn" @click="selectedFields = currentDataset?.fields.map(f => f.name) ?? []">All</button>
            <button class="mini-btn" @click="selectedFields = []">None</button>
          </div>
        </div>
        <div class="card-body">
          <div class="field-list">
            <label v-for="f in currentDataset.fields" :key="f.name" class="field-row">
              <input type="checkbox" :value="f.name" v-model="selectedFields" />
              <span class="field-name">{{ f.name }}</span>
              <span class="field-type">{{ f.type }}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="card panel-card" v-if="currentDataset">
        <div class="card-header">
          Filters
          <button class="mini-btn" @click="addFilter">+ Add filter</button>
        </div>
        <div class="card-body">
          <div v-if="filters.length" class="filter-list">
            <div v-for="(f, i) in filters" :key="i" class="filter-row">
              <select v-model="f.field" class="select-sm filter-field">
                <option value="">Field…</option>
                <option v-for="df in currentDataset.fields" :key="df.name" :value="df.name">{{ df.name }}</option>
              </select>
              <select v-model="f.op" class="select-sm filter-op">
                <option value="eq">=</option>
                <option value="neq">≠</option>
                <option value="gt">&gt;</option>
                <option value="gte">≥</option>
                <option value="lt">&lt;</option>
                <option value="lte">≤</option>
                <option value="contains">contains</option>
                <option value="in">in (csv)</option>
              </select>
              <input v-model="f.value" class="select-sm filter-val" placeholder="value…" />
              <button class="remove-btn" @click="filters.splice(i, 1)" title="Remove">×</button>
            </div>
          </div>
          <div v-else class="no-filters">No filters applied - returns all rows up to limit.</div>
        </div>
      </div>

      <div class="card panel-card exec-card" v-if="currentDataset">
        <div class="exec-row">
          <span class="exec-label">Limit</span>
          <select v-model.number="queryLimit" class="select-sm">
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
            <option :value="500">500</option>
          </select>
          <button class="btn-primary exec-run" :disabled="!selectedDataset || executing" @click="execute">
            {{ executing ? 'Running…' : '▶ Run Query' }}
          </button>
          <button v-if="result" class="btn" @click="downloadJSON">⬇ JSON</button>
          <button v-if="result" class="btn" @click="downloadCSV">⬇ CSV</button>
        </div>
        <div v-if="queryError" class="query-error">⚠ {{ queryError }}</div>
      </div>
    </div>

    <!-- Right panel: results -->
    <div class="result-panel">
      <div class="card result-card">
        <div class="card-header result-header">
          <span>Results</span>
          <span v-if="result" class="result-meta">
            <span class="result-count">{{ fmtNum(result.count) }}</span> of {{ fmtNum(result.total) }} rows
            <span class="result-sep">·</span>
            {{ fmtTime(result.executed_at) }}
          </span>
          <span v-else class="result-meta-empty">No results yet</span>
        </div>
        <div class="card-body result-body">
          <div v-if="executing" class="result-placeholder">
            <div class="rp-spinner" />
            <span>Executing query…</span>
          </div>
          <div v-else-if="!result" class="result-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <span>Select a dataset, choose fields, add filters, then click Run Query.</span>
          </div>
          <div v-else-if="result.rows.length === 0" class="result-placeholder">
            <span>No rows returned for this query.</span>
          </div>
          <div v-else class="result-table-wrap">
            <table>
              <thead>
                <tr>
                  <th v-for="col in resultColumns" :key="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in result.rows" :key="i">
                  <td v-for="col in resultColumns" :key="col" class="result-cell">
                    {{ formatCell(row[col]) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Query Builder')

import { useQuery } from '~/composables/api'
import type { Dataset, QueryDatasetKey, QueryExecuteResult, FilterOp } from '~/composables/api'

const datasets        = ref<Record<string, Dataset>>({})
const selectedDataset = ref<string>('')
const selectedFields  = ref<string[]>([])
const filters         = ref<{ field: string; op: string; value: string }[]>([])
const queryLimit      = ref(50)
const result          = ref<QueryExecuteResult | null>(null)
const executing       = ref(false)
const queryError      = ref<string | null>(null)

onMounted(async () => {
  try { datasets.value = await useQuery().datasets() } catch {}
})

const currentDataset = computed<Dataset | null>(() =>
  selectedDataset.value ? (datasets.value[selectedDataset.value] ?? null) : null,
)

function onDatasetChange() {
  selectedFields.value = currentDataset.value?.fields.map(f => f.name) ?? []
  filters.value = []
  result.value = null
}

function addFilter() {
  filters.value.push({ field: '', op: 'eq', value: '' })
}

async function execute() {
  if (!selectedDataset.value) return
  executing.value = true
  queryError.value = null
  try {
    result.value = await useQuery().execute({
      dataset: selectedDataset.value as QueryDatasetKey,
      filters: filters.value
        .filter(f => f.field && f.value)
        .map(f => ({
          field: f.field,
          op: f.op as FilterOp,
          value: f.op === 'in' ? f.value.split(',').map((s: string) => s.trim()) : f.value,
        })),
      limit: queryLimit.value,
    })
  } catch (e: any) {
    queryError.value = e?.message ?? 'Query execution failed.'
  } finally {
    executing.value = false
  }
}

const resultColumns = computed(() => {
  if (!result.value?.rows.length) return []
  const row = result.value.rows[0]
  return selectedFields.value.length
    ? selectedFields.value.filter(f => f in row)
    : Object.keys(row)
})

function downloadJSON() {
  if (!result.value || typeof window === 'undefined') return
  const blob = new Blob([JSON.stringify(result.value.rows, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `uapts-query-${selectedDataset.value}.json`)
}
function downloadCSV() {
  if (!result.value || typeof window === 'undefined') return
  const cols = resultColumns.value
  const rows = [cols.join(','), ...result.value.rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  triggerDownload(blob, `uapts-query-${selectedDataset.value}.csv`)
}
function triggerDownload(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
function formatCell(v: unknown) {
  if (v == null) return '-'
  if (typeof v === 'object') return JSON.stringify(v)
  if (typeof v === 'string' && v.length > 60) return v.slice(0, 60) + '…'
  return String(v)
}
function fmtNum(v: number | null | undefined) {
  if (v == null) return '-'
  return v.toLocaleString()
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; }

/* ── Page layout ── */
.query-layout { display:grid; grid-template-columns:300px 1fr; gap:16px; align-items:start; }
@media(max-width:900px) { .query-layout { grid-template-columns:1fr; } }

/* ── Left panel ── */
.query-panel { display:flex; flex-direction:column; gap:10px; }
.panel-card { } /* spacing handled by flex gap */

/* ── Dataset card ── */
.select-full { width:100%; padding:6px 10px; border:1px solid #e2e8f0; border-radius:7px; font-size:13px; background:#fff; color:#374151; }
.select-full:focus { outline:none; border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,.1); }
.ds-examples { margin-top:10px; padding:10px; background:#f8fafc; border-radius:7px; border:1px solid #f1f5f9; }
.ds-examples-head { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8; margin-bottom:6px; }
.ds-example-item { font-size:11px; color:#64748b; padding:2px 0 2px 10px; border-left:2px solid #e2e8f0; margin-bottom:4px; line-height:1.4; }
.ds-example-item:last-child { margin-bottom:0; }

/* ── Field list ── */
.card-header { display:flex; align-items:center; justify-content:space-between; }
.field-actions { display:flex; gap:4px; }
.mini-btn { font-size:11px; padding:2px 8px; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; color:#475569; cursor:pointer; }
.mini-btn:hover { background:#f1f5f9; border-color:#cbd5e1; }
.field-list { display:flex; flex-direction:column; gap:3px; max-height:220px; overflow-y:auto; }
.field-row { display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer; padding:4px 6px; border-radius:5px; }
.field-row:hover { background:#f8fafc; }
.field-row input[type="checkbox"] { width:13px; height:13px; accent-color:#3b82f6; cursor:pointer; flex-shrink:0; }
.field-name { flex:1; font-family:monospace; font-size:12px; color:#1e293b; }
.field-type { font-size:10px; padding:1px 6px; border-radius:4px; background:#f1f5f9; color:#64748b; font-weight:600; }

/* ── Filters ── */
.filter-list { display:flex; flex-direction:column; gap:6px; }
.filter-row { display:grid; grid-template-columns:1fr 72px 1fr 24px; gap:4px; align-items:center; }
.select-sm { padding:5px 7px; border:1px solid #e2e8f0; border-radius:6px; font-size:12px; background:#fff; color:#374151; }
.select-sm:focus { outline:none; border-color:#3b82f6; }
.filter-field { } /* takes 1fr */
.filter-op   { text-align:center; }
.filter-val  { }
.remove-btn { background:none; border:none; font-size:16px; color:#94a3b8; cursor:pointer; line-height:1; padding:0; text-align:center; }
.remove-btn:hover { color:#ef4444; }
.no-filters { font-size:12px; color:#94a3b8; padding:4px 0; }

/* ── Execute bar ── */
.exec-card .card-body { padding:12px 16px; }
.exec-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.exec-label { font-size:12px; color:#64748b; }
.exec-run { flex-shrink:0; }
.query-error { font-size:12px; color:#dc2626; margin-top:8px; display:flex; align-items:center; gap:4px; }

/* ── Result panel ── */
.result-panel { min-height:500px; }
.result-card { display:flex; flex-direction:column; height:100%; min-height:500px; }
.result-header { display:flex; align-items:center; gap:8px; }
.result-meta { font-size:12px; color:#64748b; font-weight:400; margin-left:auto; }
.result-count { font-weight:700; color:#1e293b; }
.result-sep { color:#cbd5e1; margin:0 2px; }
.result-meta-empty { font-size:12px; color:#cbd5e1; font-weight:400; margin-left:auto; }
.result-body { overflow:auto; flex:1; }
.result-table-wrap { overflow-x:auto; }
.result-cell { font-size:12px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#374151; }
.result-placeholder { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; min-height:240px; color:#94a3b8; font-size:13px; text-align:center; max-width:280px; margin:0 auto; line-height:1.5; }
.rp-spinner { width:20px; height:20px; border:2px solid #e2e8f0; border-top-color:#3b82f6; border-radius:50%; animation:spin .7s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
</style>
