<template>
  <PageHeader
    eyebrow="M16 - Compliance & Governance"
    title="Audit Trail"
    subtitle="Full platform audit log - every user action, data change, and system event across all modules"
  >
    <template #actions>
      <a :href="exportHref" download="uapts-audit.csv" class="btn">⬇ Export CSV</a>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Filter bar -->
  <div class="filter-bar">
    <input v-model="filters.search" class="select-sm" placeholder="Search…" style="min-width:200px" @change="reload" />
    <input v-model="filters.user" class="select-sm" placeholder="User email…" style="min-width:160px" @change="reload" />
    <select v-model="filters.action" class="select-sm" @change="reload">
      <option value="">All actions</option>
      <option value="create">Create</option>
      <option value="update">Update</option>
      <option value="delete">Delete</option>
      <option value="login">Login</option>
      <option value="logout">Logout</option>
      <option value="export">Export</option>
      <option value="generate">Generate</option>
    </select>
    <input v-model="filters.resource" class="select-sm" placeholder="Resource type…" @change="reload" />
    <input type="date" v-model="filters.date_from" class="select-sm" @change="reload" />
    <input type="date" v-model="filters.date_to" class="select-sm" @change="reload" />
    <button class="btn" @click="resetFilters">Reset</button>
    <span style="flex:1" />
    <span style="font-size:12px;color:#64748b">Showing {{ entries.length }} of {{ fmtNum(total) }}</span>
  </div>

  <!-- Audit table -->
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>User</th>
            <th>Action</th>
            <th>Resource Type</th>
            <th>Resource ID</th>
            <th>IP Address</th>
            <th>Changes</th>
          </tr>
        </thead>
        <tbody v-if="entries.length">
          <tr v-for="e in entries" :key="e.id" @click="expanded = expanded === e.id ? null : e.id" class="audit-row">
            <td style="font-size:12px;white-space:nowrap;font-family:monospace">{{ fmtTime(e.timestamp) }}</td>
            <td style="font-size:12px">{{ e.user_email }}</td>
            <td><BadgePill :variant="actionBadge(e.action)">{{ e.action }}</BadgePill></td>
            <td style="font-family:monospace;font-size:12px">{{ e.resource_type }}</td>
            <td style="font-family:monospace;font-size:11px;color:#64748b;max-width:120px;overflow:hidden;text-overflow:ellipsis">{{ e.resource_id ?? '-' }}</td>
            <td style="font-size:12px;font-family:monospace;color:#64748b">{{ (e as any).ip_address ?? '-' }}</td>
            <td style="font-size:12px">
              <template v-if="(e as any).changes && Object.keys((e as any).changes).length">
                <span style="color:#3b82f6;cursor:pointer">{{ expanded === e.id ? '▾' : '▸' }} {{ Object.keys((e as any).changes).length }} fields</span>
              </template>
              <span v-else style="color:#94a3b8">-</span>
            </td>
          </tr>
          <template v-for="e in entries" :key="`${e.id}-expanded`">
            <tr v-if="expanded === e.id && (e as any).changes">
              <td colspan="7" class="change-detail">
                <table class="diff-table">
                  <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                  <tbody>
                    <tr v-for="(change, field) in (e as any).changes" :key="field">
                      <td style="font-family:monospace;font-size:11px">{{ field }}</td>
                      <td style="font-size:11px;color:#dc2626">{{ JSON.stringify(change.before ?? change.from ?? null) }}</td>
                      <td style="font-size:11px;color:#16a34a">{{ JSON.stringify(change.after ?? change.to ?? null) }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
        <tbody v-else>
          <tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px">{{ loading ? 'Loading audit log…' : 'No audit entries match the current filters.' }}</td></tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="total > pageSize" class="pagination">
        <button class="btn" :disabled="page <= 1 || loading" @click="page--; reload()">← Prev</button>
        <span style="font-size:13px;color:#64748b">Page {{ page }} of {{ Math.ceil(total / pageSize) }}</span>
        <button class="btn" :disabled="page >= Math.ceil(total / pageSize) || loading" @click="page++; reload()">Next →</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Audit Trail')

import { useAudit } from '~/composables/api'
import type { AuditEntry } from '~/composables/api'

const entries  = ref<AuditEntry[]>([])
const total    = ref(0)
const loading  = ref(true)
const error    = ref<string | null>(null)
const page     = ref(1)
const pageSize = 50
const expanded = ref<string | null>(null)

const filters = ref({
  search:    '',
  user:      '',
  action:    '',
  resource:  '',
  date_from: '',
  date_to:   '',
})

async function load(resetPage = false) {
  if (resetPage) page.value = 1
  loading.value = true
  error.value = null

  const q: Record<string, unknown> = {
    page_size: pageSize,
    page: page.value,
  }
  if (filters.value.search)    q.search    = filters.value.search
  if (filters.value.user)      q.user      = filters.value.user
  if (filters.value.action)    q.action    = filters.value.action
  if (filters.value.resource)  q.resource  = filters.value.resource
  if (filters.value.date_from) q.date_from = filters.value.date_from
  if (filters.value.date_to)   q.date_to   = filters.value.date_to

  const [res] = await Promise.allSettled([useAudit().list(q as any)])
  if (res.status === 'fulfilled') {
    entries.value = (res.value as any).results ?? []
    total.value   = (res.value as any).count ?? entries.value.length
  } else {
    error.value = 'Unable to reach the UAPTS Audit API.'
  }

  loading.value = false
}

function reload() { load(true) }

function resetFilters() {
  filters.value = { search: '', user: '', action: '', resource: '', date_from: '', date_to: '' }
  reload()
}

onMounted(() => load())
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(() => load(), 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

const exportHref = computed(() => {
  const q: Record<string, string> = {}
  if (filters.value.search)    q.search    = filters.value.search
  if (filters.value.user)      q.user      = filters.value.user
  if (filters.value.action)    q.action    = filters.value.action
  if (filters.value.resource)  q.resource  = filters.value.resource
  if (filters.value.date_from) q.date_from = filters.value.date_from
  if (filters.value.date_to)   q.date_to   = filters.value.date_to
  return useAudit().exportUrl(q as any)
})

function actionBadge(a: string) {
  const m: Record<string,string> = { create:'success', update:'info', delete:'danger', login:'fair', logout:'neutral', export:'fair', generate:'fair' }
  return m[a] ?? 'neutral'
}
function fmtTime(iso: string) {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleString('en-KE', { year:'2-digit', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }) }
  catch { return iso }
}
function fmtNum(v: number) {
  return v.toLocaleString()
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f8fafc; color:#475569; border:1px solid #e2e8f0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.audit-row { cursor:pointer; }
.audit-row:hover { background:#f8fafc; }
.change-detail { background:#f8fafc; padding:12px !important; }
.diff-table { width:100%; border-collapse:collapse; }
.diff-table th, .diff-table td { padding:4px 8px; border:1px solid #e2e8f0; text-align:left; }
.diff-table th { background:#f1f5f9; font-size:11px; font-weight:600; }
.pagination { display:flex; justify-content:center; align-items:center; gap:16px; padding-top:12px; border-top:1px solid #f1f5f9; margin-top:8px; }
</style>
