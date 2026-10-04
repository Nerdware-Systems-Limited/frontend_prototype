<template>
  <PageHeader
    eyebrow="Data Integration Hub"
    title="Ingestion Analytics"
    :subtitle="statsRes?.scope === 'agency' ? 'Is your agency\'s data actually landing, and where is it not?' : 'Is data actually landing everywhere, and where is it not?'"
  >
    <template #breadcrumb>
      <NuxtLink to="/integrations" class="ih-crumb">← Upload &amp; Connect</NuxtLink>
    </template>
    <template #actions>
      <BadgePill v-if="statsRes" :variant="statsRes.scope === 'agency' ? 'info' : 'neutral'">
        {{ statsRes.scope === 'agency' ? 'Your agency only' : 'All agencies' }}
      </BadgePill>
      <div class="ih-toggle" role="tablist" aria-label="Time window">
        <button
          v-for="w in WINDOWS" :key="w" type="button" role="tab"
          :class="{ active: windowSel === w }" :aria-selected="windowSel === w"
          @click="windowSel = w; loadWindowed()"
        >{{ w }}</button>
      </div>
    </template>
  </PageHeader>

  <!-- ── Headline reconciliation ─────────────────────────────────────── -->
  <div class="ih-ribbon ih-rise">
    <KpiTile
      label="Received" :value="fmt(statsRes?.funnel.received)"
      :state="funnelState" sub="records into the platform"
    />
    <KpiTile
      label="Handler ran" :value="fmt(statsRes?.funnel.attempted)"
      :state="funnelState" sub="dispatched to a handler"
    />
    <KpiTile
      label="Written to domain" :value="fmt(statsRes?.funnel.written)"
      :state="funnelState" :sub="writtenSub"
    />
    <KpiTile
      label="Silent failures" :value="statsRes ? statsRes.silent_failures.length : ''"
      :state="funnelState" sub="feeds writing nothing"
    />
  </div>

  <div class="ih-card ih-rise ih-rise-2">
    <div class="ih-card-head">
      <h2>Received → written{{ statsRes?.scoped_to_top_n ? ` · top ${statsRes.scoped_to_top_n} sources by volume` : '' }}</h2>
    </div>
    <div class="ih-card-body">
      <EmptyState v-if="statsFailed" compact message="Could not load the reconciliation funnel." />
      <EmptyState v-else-if="!statsRes" loading compact />
      <ReconciliationFunnel
        v-else
        :stages="[
          { label: 'Received', value: statsRes.funnel.received },
          { label: 'Attempted', value: statsRes.funnel.attempted },
          { label: 'Written', value: statsRes.funnel.written, variant: statsRes.funnel.written ? 'success' : 'danger' },
        ]"
      />
    </div>
  </div>

  <!-- ── File uploads - same window + tenant scope as the funnel ────── -->
  <div class="ih-card ih-rise ih-rise-2">
    <div class="ih-card-head">
      <h2>File uploads</h2>
      <NuxtLink v-if="statsRes?.uploads?.needs_attention" to="/integrations/files" class="ih-crumb">
        {{ statsRes.uploads.needs_attention.toLocaleString('en-KE') }} need attention →
      </NuxtLink>
    </div>
    <div class="ih-card-body">
      <EmptyState v-if="statsFailed" compact message="Could not load upload statistics." />
      <EmptyState v-else-if="!statsRes" loading compact />
      <EmptyState v-else-if="!statsRes.uploads.total" compact icon="inbox" message="No files uploaded in this window." />
      <template v-else>
        <div class="ih-stats">
          <div class="ih-stat"><span class="ih-stat-value">{{ statsRes.uploads.total.toLocaleString('en-KE') }}</span><span class="ih-stat-label">files</span></div>
          <div class="ih-stat"><span class="ih-stat-value">{{ statsRes.uploads.total_rows.toLocaleString('en-KE') }}</span><span class="ih-stat-label">rows parsed</span></div>
          <div class="ih-stat"><span class="ih-stat-value">{{ statsRes.uploads.domain_records_created.toLocaleString('en-KE') }}</span><span class="ih-stat-label">rows written</span></div>
          <div class="ih-stat"><span class="ih-stat-value">{{ writeRate }}</span><span class="ih-stat-label">of parsed rows written</span></div>
          <div class="ih-stat"><span class="ih-stat-value">{{ fmtBytes(statsRes.uploads.total_size_bytes) }}</span><span class="ih-stat-label">received</span></div>
        </div>
        <div class="ih-hbars upload-status-bars">
          <button
            v-for="row in uploadStatusRows" :key="row.status" class="ih-hbar"
            @click="router.push(`/integrations/files?status=${row.status}`)"
          >
            <span class="ih-hbar-label">{{ row.label }}</span>
            <span class="ih-hbar-track"><span class="ih-hbar-fill" :style="{ transform: `scaleX(${row.pct / 100})` }" /></span>
            <span class="ih-hbar-value">{{ row.count.toLocaleString('en-KE') }}</span>
          </button>
        </div>
      </template>
    </div>
  </div>

  <!-- ── Silent failures ────────────────────────────────────────────── -->
  <div class="ih-card ih-rise ih-rise-2">
    <div class="ih-card-head"><h2>Silent failures</h2></div>
    <div class="ih-card-body">
      <p class="ih-lead">Receiving records, syncing green, writing nothing to the domain tables. Sorted by records lost.</p>
      <EmptyState v-if="statsFailed" compact message="Could not load silent-failure data." />
      <EmptyState v-else-if="statsRes && !statsRes.silent_failures.length" compact icon="inbox" message="No silent failures in this window." />
      <div v-else-if="statsRes" class="ih-table-wrap">
        <table class="ih-table">
          <thead><tr><th>Feed</th><th>Agency</th><th>Records lost</th></tr></thead>
          <tbody>
            <tr
              v-for="f in statsRes.silent_failures" :key="f.source_id" class="is-clickable"
              @click="router.push(`/integrations/feeds/${f.source_id}`)"
            >
              <td class="mono-sm">{{ f.source_id }}</td>
              <td>{{ f.agency_code || '-' }}</td>
              <td class="ih-num-danger">{{ f.received.toLocaleString('en-KE') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ── Agency contributions ───────────────────────────────────────── -->
  <div class="ih-card ih-rise ih-rise-3">
    <div class="ih-card-head"><h2>Agency contributions</h2></div>
    <div class="ih-card-body">
      <EmptyState v-if="contribFailed" compact message="Could not load agency contributions." />
      <EmptyState v-else-if="contributions && !contributions.length" compact message="No records ingested in this window." />
      <div v-else-if="contributions" class="ih-hbars">
        <button
          v-for="c in contributions" :key="c.agency_code" class="ih-hbar"
          @click="router.push(`/integrations/files?agency_code=${c.agency_code}`)"
        >
          <span class="ih-hbar-label">{{ c.agency_code }}</span>
          <span class="ih-hbar-track"><span class="ih-hbar-fill" :style="{ transform: `scaleX(${contribPct(c.records) / 100})` }" /></span>
          <span class="ih-hbar-value">{{ c.records.toLocaleString('en-KE') }}</span>
        </button>
      </div>
    </div>
  </div>

  <div class="ih-two-col ih-rise ih-rise-3">
    <div class="ih-card">
      <div class="ih-card-head"><h2>Handler errors</h2></div>
      <div class="ih-card-body">
        <EmptyState v-if="statsFailed" compact message="Could not load handler errors." />
        <EmptyState v-else-if="statsRes && !statsRes.top_handler_errors.length" compact message="No handler errors in this window." />
        <div v-else-if="statsRes" class="ih-table-wrap">
          <table class="ih-table">
            <thead><tr><th>Count</th><th>Message</th></tr></thead>
            <tbody>
              <tr v-for="e in statsRes.top_handler_errors" :key="e.message">
                <td class="mono-sm num">{{ e.count }}</td>
                <td>{{ e.message }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="ih-card">
      <div class="ih-card-head"><h2>Unrecognised record types</h2></div>
      <div class="ih-card-body">
        <EmptyState v-if="statsFailed" compact message="Could not load record types." />
        <EmptyState v-else-if="statsRes && !statsRes.unrecognised_record_types.length" compact message="None in this window." />
        <div v-else-if="statsRes" class="ih-chips">
          <BadgePill v-for="t in statsRes.unrecognised_record_types" :key="t" variant="warning">{{ t }}</BadgePill>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Feed health ────────────────────────────────────────────────── -->
  <div class="ih-card ih-rise ih-rise-4">
    <div class="ih-card-head">
      <h2>Feed health</h2>
      <span class="ih-lead" style="margin:0">Live registry snapshot, not windowed.</span>
    </div>
    <div class="ih-card-body">
      <EmptyState v-if="feedsFailed" compact message="Could not load the feed registry." />
      <template v-else>
        <div class="feed-filter-row">
          <button
            v-for="chip in FEED_CHIPS" :key="chip.key" type="button"
            class="feed-filter-chip" :class="[chip.tone, { active: feedStatusFilter === chip.key }]"
            @click="feedStatusFilter = chip.key"
          >{{ chip.label }} <span class="feed-filter-count">{{ chip.key === 'all' ? integrations.length : (feedCounts[chip.key] ?? 0) }}</span></button>
        </div>
        <div class="ih-table-wrap">
          <table class="ih-table">
            <thead>
              <tr><th>Agency / source system</th><th>Status</th><th>Mode</th><th>Records today</th><th>Last sync</th></tr>
            </thead>
            <tbody v-if="filteredFeeds.length">
              <tr
                v-for="f in feedsPageRows" :key="f.source_id" class="is-clickable"
                @click="router.push(f.mode === 'manual' ? `/integrations/files?source_id=${f.source_id}` : `/integrations/feeds/${f.source_id}`)"
              >
                <td><strong>{{ f.agency_code }}</strong> <span class="hint">· {{ f.source_system }}</span></td>
                <td><BadgePill :variant="feedStatusVariant(f.status)">{{ f.status }}</BadgePill></td>
                <td class="mono-sm">{{ f.mode }}</td>
                <td class="mono-sm num">{{ (f.records_today ?? 0).toLocaleString('en-KE') }}</td>
                <td class="hint">{{ f.last_sync_at ? fmtRelative(f.last_sync_at) : '-' }}</td>
              </tr>
            </tbody>
            <tbody v-else><tr><td colspan="5" class="feed-empty">No feeds match this filter.</td></tr></tbody>
          </table>
        </div>
        <TablePagination v-if="feedsTotal > 15" :page="feedsPage" :total-pages="feedsTotalPages" :total="feedsTotal" @prev="feedsPrev" @next="feedsNext" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { useIntegrations } from '~/composables/api'
import type { AgencyContribution, DataSource, DataUploadStatus, PlatformStats } from '~/composables/api'
import { statusMeta } from '~/utils/ingestStatus'

const router = useRouter()
const api = useIntegrations()

const WINDOWS = ['24h', '7d', '30d'] as const
const windowSel = ref<typeof WINDOWS[number]>('7d')

const statsRes = ref<PlatformStats | null>(null)
const statsFailed = ref(false)
const contributions = ref<AgencyContribution[] | null>(null)
const contribFailed = ref(false)
const integrations = ref<DataSource[]>([])
const feedsFailed = ref(false)

const funnelState = computed<'loading' | 'ok' | 'unavailable'>(
  () => statsFailed.value ? 'unavailable' : statsRes.value ? 'ok' : 'loading',
)
const writtenSub = computed(() =>
  statsRes.value && statsRes.value.funnel.received > 0 && statsRes.value.funnel.written === 0
    ? 'nothing is landing'
    : 'rows into domain tables',
)
// Pipeline order, so the bars read left-to-right as a file's life, not by volume.
const UPLOAD_STATUS_ORDER: DataUploadStatus[] = [
  'unrouted', 'pending', 'validating', 'needs_mapping', 'validated', 'committing',
  'committed', 'partial', 'rejected', 'failed', 'superseded',
]
const uploadStatusRows = computed(() => {
  const by = statsRes.value?.uploads?.by_status ?? {}
  const max = Math.max(1, ...Object.values(by).map(n => n ?? 0))
  return UPLOAD_STATUS_ORDER
    .filter(st => (by[st] ?? 0) > 0)
    .map(st => ({ status: st, label: statusMeta(st).label, count: by[st]!, pct: Math.max(2, Math.round((by[st]! / max) * 100)) }))
})
const writeRate = computed(() => {
  const u = statsRes.value?.uploads
  return u && u.total_rows > 0 ? `${Math.round((u.domain_records_created / u.total_rows) * 100)}%` : '-'
})
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}
function fmt(n: number | undefined): string {
  return n === undefined ? '' : n.toLocaleString('en-KE')
}

async function loadWindowed() {
  statsFailed.value = false
  contribFailed.value = false
  const [statsResult, contribResult] = await Promise.allSettled([
    api.platformStats(windowSel.value),
    api.agencyContributions(windowSel.value),
  ])
  if (statsResult.status === 'fulfilled') statsRes.value = statsResult.value
  else statsFailed.value = true
  if (contribResult.status === 'fulfilled') contributions.value = contribResult.value
  else contribFailed.value = true
}

const maxContribution = computed(() => Math.max(1, ...(contributions.value ?? []).map(c => c.records)))
function contribPct(records: number): number {
  return Math.max(2, Math.round((records / maxContribution.value) * 100))
}

// ── Feed health table - independent of the window selector ─────────────
const FEED_CHIPS = [
  { key: 'all', label: 'All', tone: '' },
  { key: 'connected', label: 'Connected', tone: 'feed-filter-chip--good' },
  { key: 'degraded', label: 'Degraded', tone: 'feed-filter-chip--warn' },
  { key: 'disconnected', label: 'Disconnected', tone: 'feed-filter-chip--crit' },
] as const
const feedStatusFilter = ref<'all' | DataSource['status']>('all')
const feedCounts = computed(() => {
  const counts: Record<string, number> = { connected: 0, degraded: 0, pending: 0, disconnected: 0 }
  for (const f of integrations.value) counts[f.status] = (counts[f.status] ?? 0) + 1
  return counts
})
const filteredFeeds = computed(() =>
  feedStatusFilter.value === 'all' ? integrations.value : integrations.value.filter(f => f.status === feedStatusFilter.value),
)
const { pageRows: feedsPageRows, page: feedsPage, totalPages: feedsTotalPages, total: feedsTotal, next: feedsNext, prev: feedsPrev } = usePagination(filteredFeeds, 15)

function feedStatusVariant(s: string) {
  const m: Record<string, string> = { connected: 'success', degraded: 'warning', disconnected: 'danger', paused: 'neutral', pending: 'info' }
  return m[s] ?? 'neutral'
}
function fmtRelative(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })
}

onMounted(async () => {
  loadWindowed()
  try {
    integrations.value = (await api.list({ page_size: 200 })).results
  } catch {
    feedsFailed.value = true
  }
})
</script>

<style scoped>
.upload-status-bars { margin-top: 18px; }
.upload-status-bars .ih-hbar { grid-template-columns: 120px 1fr 76px; }
.feed-filter-row { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.feed-filter-chip {
  background: var(--surface-quiet); border: 1px solid var(--border-subtle); border-radius: var(--r-pill);
  padding: 5px 12px; font-size: 12px; color: var(--fg-2); cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
.feed-filter-chip:hover { border-color: var(--border-interactive); }
.feed-filter-chip.active { background: var(--primary); border-color: var(--primary); color: #fff; }
.feed-filter-chip--good.active { background: var(--success-fg); border-color: var(--success-fg); }
.feed-filter-chip--warn.active { background: var(--warning-fg); border-color: var(--warning-fg); }
.feed-filter-chip--crit.active { background: var(--danger-fg); border-color: var(--danger-fg); }
.feed-filter-count { opacity: 0.8; margin-left: 4px; font-variant-numeric: tabular-nums; }
.feed-empty { text-align: center; color: var(--fg-3); padding: 22px; }
</style>
