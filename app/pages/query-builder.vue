<script setup lang="ts">
// pages/query-builder.vue — M15 Ad-hoc Query Builder.
//
// Wires to:
//   • /api/v1/query/datasets/   — dataset catalog (fields, examples)
//   • /api/v1/query/execute/    — run a filtered query (POST)
//
// UX: pick a dataset, add filters (field / op / value), click
// Execute. Results render as a generic key-value table that adapts
// to whatever columns the chosen dataset emits.
import { RefreshCw, Search, Database, Play, X, Plus, Sparkles } from 'lucide-vue-next'
import { useQuery } from '~/composables/api'

definePageMeta({ layout: 'default', title: 'Query Builder' })

const q = useQuery()

const datasets = ref<Record<string, any> | null>(null)
const datasetKeys = computed(() => datasets.value ? Object.keys(datasets.value) : [])
const selected = ref<string>('incidents')
const filters = ref<Array<{ field: string; op: string; value: any }>>([])
const limit = ref(50)
const executing = ref(false)
const result = ref<any | null>(null)
const error = ref<string | null>(null)
const catError = ref<string | null>(null)

async function loadDatasets() {
  catError.value = null
  try {
    datasets.value = await q.datasets()
    if (selected.value && !datasets.value[selected.value]) {
      selected.value = Object.keys(datasets.value)[0]
    }
  } catch (err: any) {
    catError.value = err?.status === 404
      ? 'Query endpoints not yet wired up on the backend.'
      : err?.message ?? 'Failed to load dataset catalog.'
  }
}

onMounted(loadDatasets)

const currentDataset = computed(() => datasets.value?.[selected.value] ?? null)
const filterableFields = computed(() =>
  currentDataset.value?.fields?.filter((f: any) =>
    ['string', 'number', 'enum'].includes(f.type)
  ) ?? []
)
const enumFields = computed(() =>
  new Set(currentDataset.value?.fields?.filter((f: any) => f.type === 'enum').map((f: any) => f.name) ?? [])
)

function addFilter() {
  const first = filterableFields.value[0]?.name ?? ''
  filters.value.push({ field: first, op: 'eq', value: '' })
}
function removeFilter(i: number) {
  filters.value.splice(i, 1)
}

const OPS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'in (csv)' },
]

function valuesFor(field: string): string[] {
  return currentDataset.value?.fields?.find((f: any) => f.name === field)?.values ?? []
}

async function execute() {
  executing.value = true
  error.value = null
  result.value = null
  try {
    const payload = {
      dataset: selected.value,
      filters: filters.value
        .filter((f) => f.field && f.value !== '' && f.value !== null && f.value !== undefined)
        .map((f) => ({ ...f, value: f.op === 'in' ? String(f.value).split(',').map((s) => s.trim()) : f.value })),
      limit: limit.value,
      offset: 0,
    }
    result.value = await q.execute(payload)
  } catch (err: any) {
    error.value = err?.message ?? 'Query failed.'
  } finally {
    executing.value = false
  }
}

const resultColumns = computed(() => {
  const rows = result.value?.rows ?? []
  if (!rows.length) return []
  // Union of keys, in insertion order, max 6 cols for readability
  const seen = new Set<string>()
  const cols: string[] = []
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) { seen.add(k); cols.push(k) }
      if (cols.length >= 6) break
    }
    if (cols.length >= 6) break
  }
  return cols
})
</script>

<template>
  <div class="qb-page">
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M15 · Ad-hoc Query</div>
        <h1 class="text-display">Query Builder</h1>
        <p class="text-sm text-fg-muted mt-1">
          Run filtered queries against the operational datasets. Powered by <code>/api/v1/query/</code>.
        </p>
      </div>
      <button class="btn btn-secondary" @click="loadDatasets">
        <RefreshCw :size="13" /> Reload datasets
      </button>
    </div>

    <div v-if="catError" class="card"><div class="card-body text-fg-muted">{{ catError }}</div></div>

    <div v-else class="builder-grid">
      <!-- Left: dataset + filters -->
      <div class="builder-col">
        <div class="card">
          <div class="card-header">
            <div class="flex items-center gap-2">
              <Database :size="15" class="text-primary" />
              <div class="text-subhead">Dataset</div>
            </div>
            <span v-if="currentDataset" class="badge badge-neutral text-xs">{{ currentDataset.module }}</span>
          </div>
          <div class="card-body">
            <select v-model="selected" class="input w-full">
              <option v-for="k in datasetKeys" :key="k" :value="k">
                {{ datasets?.[k]?.label ?? k }}
              </option>
            </select>
            <div v-if="currentDataset?.description" class="text-xs text-fg-muted mt-2">
              {{ currentDataset.description }}
            </div>
            <div v-if="currentDataset?.examples?.length" class="mt-3">
              <div class="text-label text-fg-dim mb-1 flex items-center gap-1">
                <Sparkles :size="11" /> Example queries
              </div>
              <ul class="examples">
                <li v-for="(ex, i) in currentDataset.examples" :key="i">{{ ex }}</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="text-subhead">Filters</div>
            <button class="btn btn-ghost" @click="addFilter">
              <Plus :size="12" /> Add filter
            </button>
          </div>
          <div class="card-body">
            <div v-if="!filters.length" class="text-xs text-fg-dim">
              No filters. Add one to narrow the result set.
            </div>
            <div v-else class="filter-list">
              <div v-for="(f, i) in filters" :key="i" class="filter-row">
                <select v-model="f.field" class="input field-sel">
                  <option v-for="fl in filterableFields" :key="fl.name" :value="fl.name">
                    {{ fl.name }} <span v-if="fl.type === 'enum'">▾</span>
                  </option>
                </select>
                <select v-model="f.op" class="input op-sel">
                  <option v-for="o in OPS" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
                <select
                  v-if="enumFields.has(f.field)"
                  v-model="f.value"
                  class="input val-sel"
                >
                  <option v-for="v in valuesFor(f.field)" :key="v" :value="v">{{ v }}</option>
                </select>
                <input
                  v-else
                  v-model="f.value"
                  type="text"
                  class="input val-sel"
                  :placeholder="f.op === 'in' ? 'a,b,c' : 'value'"
                />
                <button class="btn btn-ghost btn-icon" @click="removeFilter(i)">
                  <X :size="12" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="text-subhead">Execute</div>
          </div>
          <div class="card-body">
            <label class="text-xs text-fg-muted block mb-2">Limit (rows)</label>
            <input v-model.number="limit" type="number" min="1" max="200" class="input w-full mb-3" />
            <button class="btn btn-primary w-full" :disabled="executing" @click="execute">
              <Play v-if="!executing" :size="13" />
              <RefreshCw v-else :size="13" class="animate-spin" />
              {{ executing ? 'Running…' : 'Run Query' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Right: results -->
      <div class="results-col">
        <div class="card">
          <div class="card-header">
            <div class="flex items-center gap-2">
              <Search :size="15" class="text-primary" />
              <div class="text-subhead">Results</div>
            </div>
            <span v-if="result" class="text-xs text-fg-dim">
              {{ result.count }} of {{ result.total }} rows
              <span v-if="result.executed_at" class="ml-2 font-mono">
                {{ new Date(result.executed_at).toLocaleTimeString('en-KE', { hour12: false }) }}
              </span>
            </span>
          </div>
          <div v-if="error" class="card-body text-fg-muted">{{ error }}</div>
          <div v-else-if="!result" class="card-body text-fg-muted">
            Pick a dataset, optionally add a filter, then click <strong>Run Query</strong>.
          </div>
          <div v-else-if="!result.rows.length" class="card-body text-fg-muted">
            Query returned no rows.
          </div>
          <div v-else class="results-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th v-for="c in resultColumns" :key="c">{{ c }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in result.rows" :key="i">
                  <td v-for="c in resultColumns" :key="c" class="cell">
                    {{ r[c] ?? '—' }}
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

<style scoped>
.qb-page { display: flex; flex-direction: column; gap: 16px; }
.card-body { padding: 16px; }
.card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border);
}

.builder-grid {
  display: grid; grid-template-columns: 360px 1fr; gap: 16px;
  align-items: start;
}
@media (max-width: 1000px) { .builder-grid { grid-template-columns: 1fr; } }
.builder-col, .results-col { display: flex; flex-direction: column; gap: 14px; }

.input {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 6px 10px; color: var(--fg); font-size: 0.8rem;
}
.input.w-full { width: 100%; }

.examples {
  margin: 0; padding-left: 18px;
  font-size: 0.75rem; color: var(--fg-muted);
}
.examples li { margin-bottom: 4px; }

.filter-list { display: flex; flex-direction: column; gap: 8px; }
.filter-row { display: grid; grid-template-columns: 1fr 80px 1fr 24px; gap: 6px; }
.field-sel { min-width: 0; }
.op-sel    { min-width: 0; }
.val-sel   { min-width: 0; }
.btn-icon  { padding: 4px; }

.btn-primary {
  background: var(--primary, #3b82f6); color: white;
  border: none; border-radius: var(--radius-sm); padding: 8px 12px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary.w-full { width: 100%; }
.btn-secondary {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 6px 12px; cursor: pointer; color: var(--fg);
  display: inline-flex; align-items: center; gap: 6px;
}
.btn-ghost {
  background: none; border: 1px solid transparent; cursor: pointer; color: var(--fg-muted);
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px;
  border-radius: var(--radius-sm); font-size: 0.75rem;
}
.btn-ghost:hover { background: rgba(255,255,255,0.06); }

.badge { padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; }
.badge-neutral { background: rgba(148,163,184,0.15); color: #94a3b8; }

.results-wrap { max-height: 70vh; overflow: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 8px 14px; text-align: left; }
.data-table thead th {
  position: sticky; top: 0;
  background: var(--card); z-index: 1;
  font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--fg-muted); border-bottom: 1px solid var(--border);
}
.data-table tbody tr { border-bottom: 1px solid var(--border); }
.data-table tbody tr:hover { background: rgba(255,255,255,0.025); }
.cell { font-size: 0.75rem; }
.animate-spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
