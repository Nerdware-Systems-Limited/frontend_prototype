<template>
  <PageHeader
    eyebrow="Corridor & Trade - NCTTCA"
    title="Border Crossings"
    subtitle="One-stop border posts - queues, waiting and clearance times, truck volumes and the main cause of delay"
  >
    <template #actions>
      <DayRangeToggle v-model="days" :options="[7, 30, 90]" @update:model-value="load" />
      <NuxtLink v-if="canSee('/corridor/northern')" to="/corridor/northern" class="btn">Northern Corridor<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <div class="kpi-grid">
    <KpiCard label="Avg waiting time" :value="avgWait != null ? avgWait.toFixed(1) : '-'" unit="h" :unavailable="avgWait == null" :period="`${days}D`"
      :status="statusFor(waitTone(avgWait))" description="Across posts reporting" />
    <KpiCard label="Avg clearance time" :value="avgClear != null ? avgClear.toFixed(1) : '-'" unit="h" :unavailable="avgClear == null" :period="`${days}D`" description="Customs and immigration" />
    <KpiCard label="Trucks crossed" :value="fmt(totalTrucks)" :unavailable="!posts.length" :period="`${days}D`" description="Loaded, empty, tankers, containers" />
    <KpiCard label="Longest queue" :value="fmt(maxQueue)" unit="veh" :unavailable="maxQueue == null" :period="`${days}D`" :description="worst ? `at ${worst.name}` : ''" />
    <KpiCard label="Slowest post" :value="worst?.avg_waiting_hours != null ? worst.avg_waiting_hours.toFixed(1) : '-'" unit="h" :unavailable="!worst" :period="`${days}D`"
      :description="worst?.name ?? ''" :status="statusFor(waitTone(worst?.avg_waiting_hours))" />
    <KpiCard label="Posts reporting" :value="fmt(posts.length)" :unavailable="!posts.length" :period="`${days}D`" description="One-stop border posts" />
  </div>

  <!-- Map + trend -->
  <div class="two-col">
    <CollapsibleSection class="card" title="Border post map" storage-key="map:corridor/borders" source="NCTTCA · CT-02">
      <ClientOnly><UaptsMap :markers="markers" :lines="lines" :center="[-0.4, 37.0]" :zoom="6" height="400px" show-legend /></ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:var(--success)" /> &lt; 5 h</span>
        <span class="mk"><span class="dot" style="background:var(--warning)" /> 5–8 h</span>
        <span class="mk"><span class="dot" style="background:var(--destructive)" /> ≥ 8 h</span>
        <span class="mk"><span class="line-seg" style="background:#0D4C8B" /> Northern Corridor</span>
        <span class="mk"><span class="line-seg" style="background:#D99A0F" /> LAPSSET</span>
      </div>
    </CollapsibleSection>

    <div class="card">
      <div class="card-header">
        {{ selected ? posts.find(p => p.site_id === selected)?.name : 'All posts' }} - daily trend
        <select v-model="selected" class="select select-sm" aria-label="Border post" @change="loadTrend">
          <option value="">All posts</option>
          <option v-for="p in posts" :key="p.site_id" :value="p.site_id">{{ p.name }}</option>
        </select>
      </div>
      <div class="card-body">
        <div class="trend-tabs">
          <button v-for="m in METRICS" :key="m.key" class="btn btn-secondary" :class="{ active: metric === m.key }" @click="metric = m.key">{{ m.label }}</button>
        </div>
        <TrendLineChart :points="trendPoints" :height="250" :format-value="metricFmt" :empty-text="loading ? 'Loading…' : 'No daily data in this window'" />
      </div>
    </div>
  </div>

  <!-- Posts table + causes -->
  <div class="two-col even">
    <div class="card">
      <div class="card-header">Posts · {{ days }}d</div>
      <div class="card-body flush">
        <table v-if="posts.length">
          <thead>
            <tr><th>Border post</th><th class="r">Wait</th><th class="r">Clearance</th><th class="r">Peak queue</th><th class="r">Utilisation</th><th class="r">Trucks</th><th>Main delay</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in postsPageRows" :key="p.site_id" class="clickable" :class="{ active: p.site_id === selected }" tabindex="0"
              @click="pick(p.site_id)" @keydown.enter="pick(p.site_id)">
              <td><span class="dot-sm" :style="{ background: TONE_COLOR[waitTone(p.avg_waiting_hours)] }" /><b>{{ p.name }}</b></td>
              <td class="r mono" :class="`t-${waitTone(p.avg_waiting_hours)}`">{{ p.avg_waiting_hours != null ? `${p.avg_waiting_hours.toFixed(1)} h` : '-' }}</td>
              <td class="r mono">{{ p.avg_clearance_hours != null ? `${p.avg_clearance_hours.toFixed(1)} h` : '-' }}</td>
              <td class="r mono">{{ fmt(p.peak_queue_length) }}</td>
              <td class="r">
                <div class="util"><div class="util-bar" :style="{ width: `${p.avg_osbp_utilisation_pct ?? 0}%` }" /></div>
                <span class="mono sm">{{ p.avg_osbp_utilisation_pct != null ? `${p.avg_osbp_utilisation_pct.toFixed(0)}%` : '-' }}</span>
              </td>
              <td class="r mono">{{ fmt(p.trucks) }}</td>
              <td>{{ p.top_delay_cause ? CAUSE_LABEL[p.top_delay_cause] : '-' }}</td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-else :loading="loading" message="No border crossing data in this window." compact />
        <TablePagination :page="postsPage" :total-pages="postsTotalPages" :total="postsTotal" @prev="postsPrev" @next="postsNext" />
      </div>
    </div>

    <div class="card">
      <div class="card-header">What delays crossings · days as top cause</div>
      <div class="card-body">
        <template v-if="causes.length">
          <div v-for="c in causes" :key="c.cause" class="cause">
            <span class="cause-l">{{ c.label }}</span>
            <div class="cause-track"><div class="cause-fill" :style="{ width: `${(c.days / maxCause) * 100}%` }" /></div>
            <span class="cause-n mono">{{ c.days }}</span>
          </div>
          <p class="note">Each post-day names one main cause of delay; the bars count how often each came first.</p>
        </template>
        <EmptyState v-else :loading="loading" message="No delay causes recorded." compact />
      </div>
    </div>
  </div>

  <!-- Daily rows -->
  <SectionTitle pill="CT-02 · daily records">Daily records</SectionTitle>
  <div class="card">
    <div class="card-header">
      Latest uploads
      <select v-model="dirFilter" class="select select-sm" aria-label="Direction" @change="rowPage = 1; loadRows()">
        <option value="">Both directions</option><option value="inbound">Inbound</option><option value="outbound">Outbound</option>
      </select>
    </div>
    <div class="card-body flush">
      <table v-if="rows.length">
        <thead><tr><th>Date</th><th>Post</th><th>Direction</th><th class="r">Loaded</th><th class="r">Empty</th><th class="r">Tankers</th><th class="r">Containers</th><th class="r">Wait (h)</th><th class="r">Queue</th><th class="r">Lanes</th><th>Main delay</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="mono">{{ r.date }}</td><td>{{ r.border_post_name }}</td>
            <td><BadgePill :variant="r.direction === 'inbound' ? 'info' : 'neutral'" size="sm">{{ r.direction }}</BadgePill></td>
            <td class="r mono">{{ fmt(r.loaded_trucks) }}</td><td class="r mono">{{ fmt(r.empty_trucks) }}</td>
            <td class="r mono">{{ fmt(r.tankers) }}</td><td class="r mono">{{ fmt(r.container_trucks) }}</td>
            <td class="r mono" :class="`t-${waitTone(r.avg_waiting_time_hours)}`">{{ r.avg_waiting_time_hours != null ? r.avg_waiting_time_hours.toFixed(1) : '-' }}</td>
            <td class="r mono">{{ fmt(r.peak_queue_length) }}</td><td class="r mono">{{ fmt(r.lanes_operational) }}</td>
            <td>{{ r.top_delay_cause ? CAUSE_LABEL[r.top_delay_cause] : '-' }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else :loading="rowsLoading" message="No daily records." compact />
      <TablePagination :page="rowPage" :total-pages="rowPages" :total="rowTotal" @prev="rowPage--; loadRows()" @next="rowPage++; loadRows()" />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import {
  useCorridor, waitTone, alignmentLines, fmtCorridorNum as fmt, CORRIDOR_CAUSE_LABEL as CAUSE_LABEL, CORRIDOR_TONE_COLOR as TONE_COLOR,
  type BorderPostStatus, type BorderTrendPoint, type DelayCauseRow, type BorderCrossingDay, type CorridorTone, type CorridorAlignment,
} from '~/composables/api'

const access = useAccessControl()
const canSee = access.canAccessRoute

const days = ref(30)
const posts = ref<BorderPostStatus[]>([])
const trend = ref<BorderTrendPoint[]>([])
const causes = ref<DelayCauseRow[]>([])
const rows = ref<BorderCrossingDay[]>([])
const alignments = ref<CorridorAlignment[]>([])
const lines = computed(() => alignmentLines(alignments.value))
const selected = ref('')
const dirFilter = ref('')
const rowPage = ref(1), rowPages = ref(1), rowTotal = ref(0)
const loading = ref(true), rowsLoading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const api = useCorridor()
  const [p, t, c, al] = await Promise.allSettled([api.borderPerformance(days.value), api.borderTrend(days.value, selected.value || undefined), api.delayCauses(days.value), api.alignments()])
  if (p.status === 'fulfilled') posts.value = p.value.posts; else error.value = 'Unable to reach the UAPTS Corridor API.'
  if (t.status === 'fulfilled') trend.value = t.value.points
  if (c.status === 'fulfilled') causes.value = c.value.causes
  if (al.status === 'fulfilled') alignments.value = al.value
  loading.value = false
  loadRows()
}
async function loadTrend() {
  const r = await useCorridor().borderTrend(days.value, selected.value || undefined).catch(() => null)
  if (r) trend.value = r.points
}
async function loadRows() {
  rowsLoading.value = true
  const r = await useCorridor().borderCrossings({ page: rowPage.value, page_size: 10, direction: dirFilter.value || undefined }).catch(() => null)
  if (r) { rows.value = r.results; rowTotal.value = r.count; rowPages.value = r.total_pages ?? 1 }
  rowsLoading.value = false
}
onMounted(load)

function pick(id: string) { selected.value = selected.value === id ? '' : id; loadTrend() }

const { pageRows: postsPageRows, page: postsPage, totalPages: postsTotalPages, total: postsTotal, next: postsNext, prev: postsPrev } = usePagination(posts, 8)

const meanOf = (key: 'avg_waiting_hours' | 'avg_clearance_hours') => {
  const vals = posts.value.map(p => p[key]).filter((v): v is number => v != null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}
const avgWait = computed(() => meanOf('avg_waiting_hours'))
const avgClear = computed(() => meanOf('avg_clearance_hours'))
const totalTrucks = computed(() => posts.value.reduce((a, p) => a + p.trucks, 0))
const maxQueue = computed(() => posts.value.length ? Math.max(...posts.value.map(p => p.peak_queue_length ?? 0)) : null)
const worst = computed(() => posts.value[0] ?? null)
const maxCause = computed(() => Math.max(1, ...causes.value.map(c => c.days)))
const statusFor = (t: CorridorTone) => t === 'success' ? 'healthy' : t === 'warning' ? 'warning' : t === 'danger' ? 'critical' : undefined

const METRICS = [
  { key: 'avg_waiting_hours', label: 'Waiting (h)', fmt: (v: number) => `${v.toFixed(1)} h` },
  { key: 'trucks', label: 'Trucks', fmt: (v: number) => Math.round(v).toLocaleString() },
  { key: 'peak_queue', label: 'Peak queue', fmt: (v: number) => Math.round(v).toLocaleString() },
] as const
const metric = ref<(typeof METRICS)[number]['key']>('avg_waiting_hours')
const metricFmt = (v: number) => METRICS.find(m => m.key === metric.value)!.fmt(v)
const trendPoints = computed(() => trend.value
  .map(p => ({ label: p.date.slice(5), value: p[metric.value] as number | null }))
  .filter((p): p is { label: string; value: number } => p.value != null))

const markers = computed(() => posts.value.filter(p => p.latitude != null && p.longitude != null).map(p => {
  const tone = waitTone(p.avg_waiting_hours)
  return {
    id: p.site_id, lat: p.latitude as number, lon: p.longitude as number, title: p.name, badge: 'Border post',
    color: tone === 'success' ? 'green' as const : tone === 'warning' ? 'yellow' as const : 'red' as const,
    size: p.trucks > 6000 ? 'lg' as const : 'md' as const,
    rows: [
      { label: 'Avg wait', value: p.avg_waiting_hours != null ? `${p.avg_waiting_hours.toFixed(1)} h` : '-' },
      { label: 'Peak queue', value: fmt(p.peak_queue_length) },
      { label: 'Main delay', value: p.top_delay_cause ? CAUSE_LABEL[p.top_delay_cause] ?? '' : '-' },
    ],
  }
}))
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 16px; }
.two-col { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; margin-bottom: 16px; align-items: start; }
.two-col.even { grid-template-columns: 1.5fr 1fr; }
@media (max-width: 1100px) { .two-col, .two-col.even { grid-template-columns: 1fr; } }
.map-key { display: flex; gap: 14px; font-size: 11px; padding: 8px 14px; border-top: 1px solid var(--border-subtle); color: var(--fg-2); }
.mk { display: flex; align-items: center; gap: 5px; }
.line-seg { width: 20px; height: 4px; border-radius: 2px; display: inline-block; }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.dot-sm { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 8px; }
.card-body.flush { padding: 0; }
.card-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.card-header .select-sm { text-transform: none; letter-spacing: 0; font-weight: 500; max-width: 180px; }
.trend-tabs { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.r { text-align: right !important; }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.sm { font-size: 11px; margin-left: 6px; }
.t-success { color: var(--success-fg); } .t-warning { color: var(--warning-fg); } .t-danger { color: var(--danger-fg); } .t-neutral { color: var(--fg-3); }
tr.clickable { cursor: pointer; }
tr.clickable:hover td { background: var(--primary-wash); }
tr.active td { background: var(--primary-wash); }
tr.clickable:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.util { display: inline-block; width: 52px; height: 5px; background: var(--surface-sunken); border-radius: 3px; vertical-align: middle; overflow: hidden; }
.util-bar { height: 100%; background: var(--primary-fill); }
.cause { display: grid; grid-template-columns: 96px 1fr 38px; align-items: center; gap: 10px; padding: 7px 0; font-size: 12.5px; border-bottom: 1px solid var(--border-subtle); }
.cause:last-of-type { border-bottom: none; }
.cause-track { height: 8px; background: var(--surface-sunken); border-radius: 2px; overflow: hidden; }
.cause-fill { height: 100%; background: var(--primary-fill); }
.cause-n { text-align: right; color: var(--fg-1); font-weight: 600; }
.note { margin: 10px 0 0; font-size: 11.5px; color: var(--fg-3); }
</style>
