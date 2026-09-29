<template>
  <PageHeader
    eyebrow="Data Integration Hub"
    title="Files & Feeds"
    subtitle="Every batch submitted, and every live feed connected, across every agency."
  >
    <template #breadcrumb>
      <NuxtLink to="/integrations" class="ih-crumb">← Upload &amp; Connect</NuxtLink>
    </template>
    <template #actions>
      <div ref="newUploadMenuEl" class="new-upload-menu">
        <button
          class="btn btn-primary" :aria-expanded="showNewUploadMenu" aria-haspopup="true"
          @click="showNewUploadMenu = !showNewUploadMenu" @keydown.esc="showNewUploadMenu = false"
        >+ New Upload</button>
        <div v-if="showNewUploadMenu" class="new-upload-dropdown" @keydown.esc="showNewUploadMenu = false">
          <p class="hint" style="padding:6px 10px 2px">Upload to which feed?</p>
          <NuxtLink
            v-for="s in manualSources" :key="s.source_id"
            class="new-upload-option" :to="`/integrations?source_id=${s.source_id}`"
            @click="showNewUploadMenu = false"
          >{{ s.source_id }} <span class="hint">({{ s.agency_code }})</span></NuxtLink>
          <p v-if="!manualSources.length" class="hint" style="padding:6px 10px">No manual feeds registered.</p>
        </div>
      </div>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI ribbon - sums over the current filter set (DataUploadInboxView's
       aggregates), not all time and not just the loaded page. -->
  <div class="ih-ribbon ih-rise">
    <KpiTile label="Batches" :value="total.toLocaleString('en-KE')" sub="matching current filters" :state="ribbonState" />
    <KpiTile
      label="Rows parsed" :value="(aggregates?.total_rows ?? 0).toLocaleString('en-KE')"
      :state="ribbonState" sub="matching current filters"
    />
    <KpiTile
      label="Rows written" :value="(aggregates?.domain_records_created ?? 0).toLocaleString('en-KE')"
      :state="ribbonState" sub="matching current filters"
    />
    <KpiTile
      label="Needs attention" :value="(aggregates?.needs_attention ?? 0).toLocaleString('en-KE')"
      :state="ribbonState" sub="routing / mapping / review"
    />
  </div>

  <TabStrip
    :tabs="[{ key: 'files', label: 'Files', count: segment === 'files' ? total : undefined }, { key: 'feeds', label: 'Feeds', count: nonManualSources.length }]"
    :model-value="segment"
    @update:model-value="v => { segment = v as 'files' | 'feeds'; syncQuery() }"
  />

  <!-- ── Files segment ────────────────────────────────────────────── -->
  <template v-if="segment === 'files'">
    <!-- Routing queue - files that arrived before their format was
         templated. A jump-chip, not just another status option, because
         these are a backlog someone owns, not a passing pipeline state. -->
    <button
      v-if="unroutedCount && statusFilter !== 'unrouted'"
      type="button" class="routing-queue-chip"
      @click="statusFilter = 'unrouted'; reload()"
    >
      <span class="routing-queue-dot" aria-hidden="true" />
      <strong>{{ unroutedCount.toLocaleString('en-KE') }}</strong>
      file{{ unroutedCount === 1 ? '' : 's' }} waiting for a template
      <span class="routing-queue-go">Review the queue →</span>
    </button>
    <div
      v-else-if="statusFilter === 'unrouted'"
      class="routing-queue-active"
    >
      Showing the routing queue: files with no feed assigned yet.
      <button type="button" class="routing-queue-clear" @click="statusFilter = ''; reload()">Clear filter</button>
    </div>

    <div class="filter-bar">
      <input v-model="q" class="select-sm" placeholder="Search filename…" aria-label="Search filename" @input="debouncedSearch" />
      <select v-model="agencyCode" class="select-sm" aria-label="Filter by submitting agency" @change="reload">
        <option value="">Submitted by: any agency</option>
        <option v-for="a in agencies" :key="a.agency_code" :value="a.agency_code">{{ a.agency_code }}</option>
      </select>
      <select v-model="coversAgency" class="select-sm" aria-label="Filter by covered agency" @change="reload">
        <option value="">Covers: any agency</option>
        <option v-for="a in agencies" :key="a.agency_code" :value="a.agency_code">{{ a.agency_code }}</option>
      </select>
      <select v-model="sourceId" class="select-sm" aria-label="Filter by feed" @change="reload">
        <option value="">Any feed</option>
        <option v-for="s in manualSources" :key="s.source_id" :value="s.source_id">{{ s.source_id }}</option>
      </select>
      <select v-model="statusFilter" class="select-sm" aria-label="Filter by status" @change="reload">
        <option value="">Any status</option>
        <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ statusMeta(s).label }}</option>
      </select>
      <DateRangeFilter
        :fields="DATE_FIELDS" :field="dateField" :from="dateFrom" :to="dateTo"
        @update:field="v => { dateField = v; reload() }"
        @update:from="v => { dateFrom = v; reload() }"
        @update:to="v => { dateTo = v; reload() }"
      />
      <button type="button" class="btn" @click="resetFilters">Reset</button>
    </div>

    <div class="ih-card">
      <div class="ih-card-body">
        <EmptyState v-if="!loading && !uploads.length" icon="inbox" message="No uploads match the current filters." />
        <div v-else class="ih-table-wrap">
        <table class="ih-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Submitted by</th>
              <th>Feed</th>
              <th>Period</th>
              <th>Rows</th>
              <th>Read</th>
              <th>Write</th>
              <th>Status</th>
              <th>Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in uploads" :key="u.id" class="is-clickable" @click="goToDetail(u.id)">
              <td>
                <span class="file-cell">{{ u.original_filename }}</span>
                <BadgePill v-if="u.duplicate_of" variant="warning">dup of #{{ u.duplicate_of.slice(0, 8) }}</BadgePill>
              </td>
              <td><BadgePill variant="neutral">{{ u.agency_code }}</BadgePill></td>
              <td class="mono-sm">{{ u.source_id || '-' }}</td>
              <td>{{ u.period_label || '-' }}</td>
              <template v-if="u.status === 'unrouted'">
                <td class="hint">-</td>
                <td class="progress-cell hint">not read yet</td>
                <td class="progress-cell hint">-</td>
              </template>
              <template v-else>
                <td class="num">
                  {{ u.total_rows.toLocaleString('en-KE') }}
                  <span v-if="u.error_rows" class="rows-err">{{ u.error_rows }} err</span>
                </td>
                <td class="progress-cell"><IngestProgress :pct="readPct(u)" /></td>
                <td class="progress-cell">
                  <IngestProgress :pct="writePct(u)" :variant="u.status === 'partial' ? 'warning' : 'success'" />
                </td>
              </template>
              <td><IngestStatusPill :status="u.status" /></td>
              <td class="hint" :title="u.uploaded_by_email || ''">{{ fmtRelative(u.created_at) }}</td>
              <td class="actions-cell" @click.stop>
                <NuxtLink
                  class="btn" :class="{ 'btn-primary': u.status === 'unrouted' }" style="font-size:11px"
                  :to="`/integrations/files/${u.id}`"
                >{{ u.status === 'unrouted' ? 'Route →' : 'Review' }}</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
        <TablePagination
          v-if="total > pageSize"
          :page="page" :total-pages="Math.ceil(total / pageSize)" :total="total"
          @prev="page > 1 && (page--, syncQuery(), refetch())"
          @next="page < Math.ceil(total / pageSize) && (page++, syncQuery(), refetch())"
        />
      </div>
    </div>
  </template>

  <!-- ── Feeds segment ────────────────────────────────────────────── -->
  <template v-else>
    <div v-if="nonManualSources.length" class="filter-bar">
      <input v-model="feedSearch" class="select-sm" placeholder="Search feed or agency…" aria-label="Search feed or agency" />
      <select v-model="feedStatusSeg" class="select-sm" aria-label="Filter by status">
        <option value="all">Any status</option>
        <option value="connected">Connected</option>
        <option value="degraded">Degraded</option>
        <option value="disconnected">Disconnected</option>
        <option value="paused">Paused</option>
        <option value="pending">Pending</option>
      </select>
      <button type="button" class="btn" @click="resetFeedFilters">Reset</button>
    </div>

    <div class="ih-card">
      <div class="ih-card-body">
        <EmptyState v-if="!sourcesLoading && !nonManualSources.length" icon="inbox" message="No live feeds registered." />
        <EmptyState v-else-if="!sourcesLoading && !filteredFeedsSeg.length" compact message="No feeds match this filter." />
        <div v-else-if="filteredFeedsSeg.length" class="ih-table-wrap">
        <table class="ih-table">
          <thead>
            <tr>
              <th>Feed</th>
              <th>Agency</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Records today</th>
              <th>Last sync</th>
              <th>Last error</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in feedsPageRows" :key="s.source_id" class="is-clickable" @click="router.push(`/integrations/feeds/${s.source_id}`)">
              <td class="mono-sm">{{ s.source_id }}</td>
              <td><BadgePill variant="neutral">{{ s.agency_code }}</BadgePill></td>
              <td><BadgePill variant="info">{{ s.mode }}</BadgePill></td>
              <td><BadgePill :variant="feedStatusVariant(s.status)">{{ s.status }}</BadgePill></td>
              <td class="mono-sm num">{{ (s.records_today ?? 0).toLocaleString('en-KE') }}</td>
              <td class="hint">{{ s.last_sync_at ? fmtRelative(s.last_sync_at) : 'never' }}</td>
              <td class="hint">{{ s.last_error || '-' }}</td>
            </tr>
          </tbody>
        </table>
        </div>
        <TablePagination
          v-if="feedsTotal > 15"
          :page="feedsPage" :total-pages="feedsTotalPages" :total="feedsTotal"
          @prev="feedsPrev" @next="feedsNext"
        />
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { useIntegrations } from '~/composables/api'
import type { DataSource, DataUpload, DataUploadStatus, UploadInboxAggregates } from '~/composables/api'
import { useAgencies } from '~/composables/api/useAccounts'
// Explicit import - see the note in integrations.vue for why this isn't
// left to the app/utils auto-import for template-only references.
import { isInFlight, readPct, statusMeta, writePct } from '~/utils/ingestStatus'

const router = useRouter()
const route = useRoute()
const api = useIntegrations()

const STATUS_OPTIONS: DataUploadStatus[] = [
  'unrouted', 'pending', 'validating', 'needs_mapping', 'validated', 'rejected',
  'committing', 'committed', 'partial', 'failed', 'superseded',
]
const DATE_FIELDS = [
  { key: 'uploaded', label: 'Uploaded' },
  { key: 'committed', label: 'Committed' },
  { key: 'period', label: 'Period' },
]

const segment = ref<'files' | 'feeds'>(route.query.segment === 'feeds' ? 'feeds' : 'files')

// ── Files segment filters - synced to the URL query string so a filtered
// view is shareable and survives a refresh. ─────────────────────────────
const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
const agencyCode = ref(typeof route.query.agency_code === 'string' ? route.query.agency_code : '')
const coversAgency = ref(typeof route.query.covers_agency === 'string' ? route.query.covers_agency : '')
const sourceId = ref(typeof route.query.source_id === 'string' ? route.query.source_id : '')
const statusFilter = ref(typeof route.query.status === 'string' ? route.query.status : '')
const dateField = ref(typeof route.query.date_field === 'string' ? route.query.date_field : 'uploaded')
const dateFrom = ref(typeof route.query.date_from === 'string' ? route.query.date_from : '')
const dateTo = ref(typeof route.query.date_to === 'string' ? route.query.date_to : '')
const page = ref(Number(route.query.page) || 1)
const pageSize = 20

const uploads = ref<DataUpload[]>([])
const aggregates = ref<UploadInboxAggregates | null>(null)
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

// Total un-routed files across every agency, independent of the current
// filter set - drives the "N in the routing queue" jump-chip. Cheap
// (page_size 1, we only read .count).
const unroutedCount = ref(0)
async function loadUnroutedCount() {
  try {
    unroutedCount.value = (await api.uploads.inbox({ status: 'unrouted', page_size: 1 })).count
  } catch { /* the chip just doesn't show - non-blocking */ }
}

// A failed fetch is a genuinely different state from "still loading" or a
// real, confirmed zero - never render error.value's stale/absent
// aggregates as "0 rows parsed".
const ribbonState = computed(() => error.value ? 'unavailable' : (loading.value && !aggregates.value) ? 'loading' : 'ok')

const agencies = ref<{ agency_code: string }[]>([])
const allSources = ref<DataSource[]>([])
const sourcesLoading = ref(true)
const manualSources = computed(() => allSources.value.filter(s => s.mode === 'manual'))
const nonManualSources = computed(() => allSources.value.filter(s => s.mode !== 'manual'))
const showNewUploadMenu = ref(false)
const newUploadMenuEl = ref<HTMLElement | null>(null)
onClickOutside(newUploadMenuEl, () => { showNewUploadMenu.value = false })

function syncQuery() {
  router.replace({
    query: {
      segment: segment.value === 'feeds' ? 'feeds' : undefined,
      q: q.value || undefined,
      agency_code: agencyCode.value || undefined,
      covers_agency: coversAgency.value || undefined,
      source_id: sourceId.value || undefined,
      status: statusFilter.value || undefined,
      date_field: dateField.value !== 'uploaded' ? dateField.value : undefined,
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
      page: page.value > 1 ? String(page.value) : undefined,
    },
  })
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await api.uploads.inbox({
      q: q.value || undefined,
      agency_code: agencyCode.value || undefined,
      covers_agency: coversAgency.value || undefined,
      source_id: sourceId.value || undefined,
      status: (statusFilter.value || undefined) as DataUploadStatus | undefined,
      date_field: dateField.value as 'uploaded' | 'committed' | 'period',
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
      page: page.value,
      page_size: pageSize,
    })
    uploads.value = res.results
    total.value = res.count
    aggregates.value = res.aggregates
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not load uploads.'
  } finally {
    loading.value = false
  }
  loadUnroutedCount()
}

// Poll only while at least one visible row is still in flight; the
// backoff/visibility/hard-stop mechanics all live in the composable.
const poll = useUploadPoll(load, () => uploads.value.some(u => isInFlight(u.status)))

/** User-driven reload (filter/page change) - resets the poll backoff,
 *  unlike the poll's own internal ticks (which call load() directly). */
async function refetch() {
  await load()
  poll.start()
}

function reload() {
  page.value = 1
  syncQuery()
  refetch()
}

const debouncedSearch = useDebounceFn(() => { page.value = 1; syncQuery(); refetch() }, 400)

function resetFilters() {
  q.value = ''
  agencyCode.value = ''
  coversAgency.value = ''
  sourceId.value = ''
  statusFilter.value = ''
  dateField.value = 'uploaded'
  dateFrom.value = ''
  dateTo.value = ''
  reload()
}

function goToDetail(id: string) {
  router.push(`/integrations/files/${id}`)
}

function fmtRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function feedStatusVariant(s: string) {
  const m: Record<string, string> = { connected: 'success', degraded: 'warning', disconnected: 'danger', paused: 'neutral', pending: 'info' }
  return m[s] ?? 'neutral'
}

// ── Feeds segment - client-side search/filter + pagination over the same
// list() fetch used for the filter dropdowns / new-upload menu, no second
// request. Mirrors the feed-status chips on the analytics page. ──────────
const feedSearch = ref('')
const feedStatusSeg = ref<'all' | DataSource['status']>('all')
const filteredFeedsSeg = computed(() =>
  nonManualSources.value.filter(s => {
    if (feedStatusSeg.value !== 'all' && s.status !== feedStatusSeg.value) return false
    if (feedSearch.value) {
      const q = feedSearch.value.toLowerCase()
      if (!s.source_id.toLowerCase().includes(q) && !s.agency_code.toLowerCase().includes(q)) return false
    }
    return true
  }),
)
function resetFeedFilters() {
  feedSearch.value = ''
  feedStatusSeg.value = 'all'
}
const {
  pageRows: feedsPageRows, page: feedsPage, totalPages: feedsTotalPages,
  total: feedsTotal, next: feedsNext, prev: feedsPrev,
} = usePagination(filteredFeedsSeg, 15)

onMounted(async () => {
  refetch()
  sourcesLoading.value = true
  try {
    const [agencyRes, sourceRes] = await Promise.all([
      useAgencies().list({ page_size: 100 }),
      api.list({ page_size: 100 }),
    ])
    agencies.value = agencyRes.results
    allSources.value = sourceRes.results
  } catch {
    // filter option lists / feeds segment are a nice-to-have - the Files
    // segment still works with free-text filters if these fail to load
  } finally {
    sourcesLoading.value = false
  }
})
</script>

<style scoped>
/* ── Filter bar - same technique as roles.vue/users.vue: every control gets
   min-width:0 so it can actually shrink below its content's natural width
   (the flexbox default is min-width:auto, which silently blocks shrinking
   and is what forces a row to wrap before it needs to). This row packs in
   more controls than any other page's (4 selects + a whole DateRangeFilter
   cluster), so each one is capped tighter to still land on one line at a
   normal desktop width; flex-wrap:wrap (inherited, unchanged) is still the
   safety net at narrow/mobile widths, exactly as it is everywhere else. */
.filter-bar { gap: 8px; }
.filter-bar > * { min-width: 0; }
.filter-bar input[type="text"], .filter-bar input:not([type]) { flex: 0 1 150px; width: 150px; }
.filter-bar select { flex: 0 1 110px; max-width: 110px; }

/* ── Routing-queue jump-chip ──────────────────────────────────────────── */
.routing-queue-chip {
  display: flex; align-items: center; gap: 10px; width: 100%;
  background: var(--warning-bg); border: 1px solid var(--warning-fg); border-radius: var(--r-sm);
  padding: 10px 14px; margin-bottom: 12px; font-size: 12.5px; color: var(--fg-1);
  cursor: pointer; text-align: left;
  transition: box-shadow var(--dur-base) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}
.routing-queue-chip:hover { box-shadow: var(--elev-1); }
.routing-queue-chip:active { transform: translateY(1px); }
.routing-queue-chip strong { font-weight: 700; }
.routing-queue-dot {
  width: 8px; height: 8px; border-radius: var(--r-pill); background: var(--warning-fg); flex-shrink: 0;
}
.routing-queue-go { margin-left: auto; font-weight: 600; color: var(--warning-fg); white-space: nowrap; }

.routing-queue-active {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: var(--surface-quiet); border: 1px solid var(--border-subtle); border-radius: var(--r-sm);
  padding: 8px 12px; margin-bottom: 12px; font-size: 12px; color: var(--fg-2);
}
.routing-queue-clear {
  background: none; border: none; color: var(--primary); font-size: 12px; font-weight: 600; cursor: pointer; padding: 0;
}
.routing-queue-clear:hover { text-decoration: underline; }

.file-cell { font-weight: 600; color: var(--fg-1); margin-right: 6px; }
.rows-err { color: var(--danger-fg); font-weight: 600; margin-left: 6px; }
.actions-cell { text-align: right; }
.progress-cell { min-width: 120px; }

.new-upload-menu { position: relative; display: inline-block; }
.new-upload-dropdown {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 20;
  background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--r-sm);
  box-shadow: var(--elev-2); min-width: 220px; max-height: 300px;
  overflow-y: auto; padding: 4px;
}
.new-upload-option {
  display: block; padding: 8px 10px; font-size: 12.5px; color: var(--fg-1);
  text-decoration: none; border-radius: var(--r-xs);
}
.new-upload-option:hover { background: var(--surface-quiet); }
</style>
