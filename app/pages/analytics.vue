<script setup lang="ts">
// pages/analytics.vue — Analytics Workbench (M01 + M09).
//
// Wires the page to:
//   • /api/v1/dashboard/summary/   — M01 single pane of glass (canonical)
//   • /api/v1/reports/catalog/     — M09 report template catalog
//
// The page degrades gracefully: if any single call fails, that
// section renders an empty-state with the underlying error.
import { RefreshCw, TrendingUp, FileText, Database, Activity, ChevronRight } from 'lucide-vue-next'
import { useDashboardSummary } from '~/composables/api/useDashboard'
import { useReports } from '~/composables/api'

definePageMeta({ layout: 'default', title: 'Analytics' })

const { data: summary, refresh: refreshSummary, pending: sumPending, error: sumError } =
  await useDashboardSummary()

const reports = useReports()
const catalog = ref<any[]>([])
const catPending = ref(true)
const catError = ref<string | null>(null)

async function loadCatalog() {
  catPending.value = true
  catError.value = null
  try {
    catalog.value = await reports.catalog()
  } catch (err: any) {
    catError.value = err?.status === 404
      ? 'Report catalog endpoint not yet wired up on the backend.'
      : err?.message ?? 'Failed to load report catalog.'
  } finally {
    catPending.value = false
  }
}

onMounted(loadCatalog)

async function reload() {
  await Promise.all([refreshSummary(), loadCatalog()])
}

function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-KE', { hour12: false })
}

// Group catalog by module for the catalog grid
const byModule = computed(() => {
  const m: Record<string, any[]> = {}
  for (const t of catalog.value) {
    const key = t.module ?? 'M??'
    ;(m[key] ||= []).push(t)
  }
  return m
})
</script>

<template>
  <div class="analytics-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <div class="text-label text-fg-dim mb-1">M01 · M09 · Analytics</div>
        <h1 class="text-display">Analytics Workbench</h1>
        <p class="text-sm text-fg-muted mt-1">
          Live KPIs from the M01 dashboard endpoint, plus the curated M09 report catalog.
        </p>
      </div>
      <button class="btn btn-primary" @click="reload">
        <RefreshCw :size="13" /> Refresh
      </button>
    </div>

    <!-- Live KPIs (from /dashboard/summary/) -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Activity :size="15" class="text-primary" />
          <div class="text-subhead">Live KPIs · M01 Dashboard</div>
        </div>
        <div class="text-xs text-fg-dim font-mono">
          generated {{ formatTime(summary?.generated_at) }}
        </div>
      </div>
      <div v-if="sumError" class="card-body text-fg-muted">
        Dashboard endpoint unavailable: {{ sumError.message }}
      </div>
      <div v-else-if="!summary?.kpis?.length" class="card-body text-fg-muted">
        Loading dashboard KPIs…
      </div>
      <div v-else class="kpi-grid">
        <div v-for="k in summary.kpis" :key="k.id" class="kpi-card">
          <div class="flex items-center justify-between mb-2">
            <div class="text-label text-fg-dim">{{ k.module }}</div>
            <div class="kpi-icon" :class="`kpi-${k.color || 'primary'}`">
              <TrendingUp :size="14" />
            </div>
          </div>
          <div class="kpi-value">{{ k.value }}</div>
          <div class="kpi-label">{{ k.label }}</div>
          <div v-if="k.sub" class="kpi-sub">{{ k.sub }}</div>
        </div>
      </div>
    </div>

    <!-- Module health strip (from /dashboard/summary/) -->
    <div v-if="summary?.modules?.length" class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Database :size="15" class="text-primary" />
          <div class="text-subhead">Module Status</div>
        </div>
        <span class="text-xs text-fg-dim">{{ summary.modules.length }} modules monitored</span>
      </div>
      <div class="modules-grid">
        <div v-for="mod in summary.modules" :key="mod.id" class="module-card">
          <div class="flex items-center gap-2 mb-1">
            <span
              class="status-dot"
              :class="`dot-${mod.status === 'online' ? 'live' : mod.status === 'degraded' ? 'warn' : 'dead'}`"
            />
            <span class="text-xs font-mono text-fg-dim">{{ mod.id }}</span>
          </div>
          <div class="text-sm font-medium">{{ mod.name }}</div>
          <div class="text-xs text-fg-muted mt-1">{{ mod.status }}</div>
        </div>
      </div>
    </div>

    <!-- Report catalog (M09) -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <FileText :size="15" class="text-primary" />
          <div class="text-subhead">Report Catalog · M09</div>
        </div>
        <span class="text-xs text-fg-dim">{{ catalog.length }} templates</span>
      </div>
      <div v-if="catError" class="card-body text-fg-muted">{{ catError }}</div>
      <div v-else-if="catPending && !catalog.length" class="card-body text-fg-muted">
        Loading catalog…
      </div>
      <div v-else class="catalog-grid">
        <div v-for="t in catalog" :key="t.id" class="catalog-card card">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-mono text-primary">{{ t.module }}</span>
            <span v-if="t.schedule" class="badge badge-neutral text-xs">{{ t.schedule }}</span>
          </div>
          <div class="text-subhead">{{ t.name }}</div>
          <div v-if="t.description" class="text-xs text-fg-muted mt-1">{{ t.description }}</div>
          <div class="flex gap-1.5 mt-3">
            <span v-for="f in t.formats" :key="f" class="badge badge-neutral text-xs">{{ f.toUpperCase() }}</span>
          </div>
          <NuxtLink to="/reports" class="view-all-btn">
            Open in Report Center <ChevronRight :size="11" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analytics-page { display: flex; flex-direction: column; gap: 20px; }
.card-body { padding: 18px; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px; padding: 16px;
}
.kpi-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px;
}
.kpi-icon { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
.kpi-primary { background: rgba(59,130,246,0.12); color: #3b82f6; }
.kpi-cyan    { background: rgba(34,211,238,0.12); color: #22d3ee; }
.kpi-green   { background: rgba(16,185,129,0.12); color: #10b981; }
.kpi-amber   { background: rgba(245,158,11,0.12); color: #f59e0b; }
.kpi-red     { background: rgba(239,68,68,0.12); color: #ef4444; }
.kpi-value { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; }
.kpi-label { font-size: 0.75rem; color: var(--fg-muted); margin-top: 2px; }
.kpi-sub { font-size: 0.6875rem; color: var(--fg-dim); margin-top: 4px; }

.modules-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px; padding: 14px 16px;
}
.module-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 10px 12px;
}
.status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot-live { background: var(--success); }
.dot-warn { background: var(--warning); }
.dot-dead { background: var(--danger); }

.catalog-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px; padding: 16px;
}
.catalog-card { padding: 14px; }
.view-all-btn {
  display: flex; align-items: center; justify-content: flex-end; gap: 4px;
  margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border);
  font-size: 0.7rem; color: var(--primary); text-decoration: none;
}
.view-all-btn:hover { color: #60a5fa; }
.badge { padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; }
.badge-neutral { background: rgba(148,163,184,0.15); color: #94a3b8; }
</style>
