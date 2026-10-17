<template>
  <PageHeader
    eyebrow="Corridor & Trade"
    title="Corridor & Trade Overview"
    subtitle="NCTTCA · KenTrade · LAPSSET - transit, border crossings and corridor development across the Northern and LAPSSET corridors"
  >
    <template #actions>
      <DayRangeToggle v-model="days" :options="[7, 30, 90]" @update:model-value="load" />
      <NuxtLink v-if="canSee('/corridor/northern')" to="/corridor/northern" class="btn">Northern Corridor<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
      <NuxtLink v-if="canSee('/corridor/lapsset')" to="/corridor/lapsset" class="btn">LAPSSET<ArrowRight :size="14" aria-hidden="true" /></NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Headline numbers -->
  <div class="kpi-grid">
    <KpiCard label="Transit declarations" :value="fmt(k?.shipments)" :unavailable="!k" :unavailable-reason="loading ? 'Loading…' : 'Corridor feed unavailable'"
      :period="`${days}D`" :description="k ? `${fmt(k.tonnage)} t of cargo` : ''" to="/corridor/transit" />
    <KpiCard label="Avg transit time" :value="k?.avg_transit_hours != null ? hours(k.avg_transit_hours) : '-'" :unavailable="!k || k.avg_transit_hours == null"
      :period="`${days}D`" description="Mombasa release to arrival" to="/corridor/transit" />
    <KpiCard label="Avg border wait" :value="k?.avg_border_wait_hours != null ? k.avg_border_wait_hours.toFixed(1) : '-'" unit="h" :unavailable="!k || k.avg_border_wait_hours == null"
      :period="`${days}D`" :description="k ? `${k.border_posts_reporting} posts reporting` : ''"
      :status="statusFor(waitTone(k?.avg_border_wait_hours))" to="/corridor/border-crossings" />
    <KpiCard label="Trucks crossed" :value="fmt(k?.trucks_crossed)" :unavailable="!k" :period="`${days}D`" description="Loaded, empty, tankers, containers" to="/corridor/border-crossings" />
    <KpiCard label="OSBP utilisation" :value="k?.avg_osbp_utilisation_pct != null ? k.avg_osbp_utilisation_pct.toFixed(0) : '-'" unit="%" :unavailable="!k || k.avg_osbp_utilisation_pct == null"
      :period="`${days}D`" description="Mean across one-stop border posts" />
    <KpiCard label="On the road now" :value="fmt(k?.in_transit)" :unavailable="!k" period="LIVE" description="In transit or at a border" to="/corridor/transit" />
    <KpiCard label="Open transit bond" :value="k?.bond_open_kes != null ? `KES ${fmtKes(k.bond_open_kes)}` : '-'" :unavailable="!k || k.bond_open_kes == null"
      period="LIVE" description="Not yet confirmed out of Kenya" to="/corridor/transit" />
    <KpiCard label="Overdue exits" :value="fmt(k?.overdue_exits)" :unavailable="!k" period="LIVE" description="Past declared exit date, bond open"
      :status="!k ? undefined : k.overdue_exits === 0 ? 'healthy' : 'critical'" to="/corridor/transit" />
    <KpiCard label="Tamper alerts" :value="fmt(k?.tamper_alerts)" :unavailable="!k" :period="`${days}D`" description="Seal / tracker tamper"
      :status="!k ? undefined : k.tamper_alerts === 0 ? 'healthy' : 'critical'" to="#alerts" />
    <KpiCard label="Route deviations" :value="fmt(k?.deviation_alerts)" :unavailable="!k" :period="`${days}D`" description="Off the declared route"
      :status="!k ? undefined : k.deviation_alerts === 0 ? 'healthy' : 'warning'" to="#alerts" />
  </div>

  <!-- Map + corridor comparison -->
  <div class="two-col">
    <CollapsibleSection class="card" title="Border posts - average waiting time" storage-key="map:corridor/index" source="NCTTCA · CT-02">
      <ClientOnly>
        <UaptsMap :markers="markers" :lines="lines" :center="[-0.4, 37.0]" :zoom="6" height="440px" show-legend />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:var(--success)" /> &lt; 5 h</span>
        <span class="mk"><span class="dot" style="background:var(--warning)" /> 5–8 h</span>
        <span class="mk"><span class="dot" style="background:var(--destructive)" /> ≥ 8 h</span>
        <span class="mk"><span class="line-seg" style="background:#0D4C8B" /> Northern Corridor</span>
        <span class="mk"><span class="line-seg" style="background:#D99A0F" /> LAPSSET</span>
        <span v-if="!markers.length && !loading" class="mk muted">No border post has coordinates yet.</span>
      </div>
    </CollapsibleSection>

    <div class="stack">
      <div v-for="c in summary?.corridors ?? []" :key="c.code" class="card">
        <div class="card-header">
          {{ c.name }}
          <BadgePill v-if="c.coordinating_agency" variant="blue" size="sm">{{ c.coordinating_agency }}</BadgePill>
        </div>
        <div class="card-body stats">
          <div><span class="stat-label">Declarations</span><span class="val">{{ fmt(c.shipments) }}</span></div>
          <div><span class="stat-label">Avg transit</span><span class="val">{{ c.avg_transit_hours != null ? hours(c.avg_transit_hours) : '-' }}</span></div>
          <div><span class="stat-label">Cargo</span><span class="val">{{ fmt(c.tonnage) }}<small> t</small></span></div>
        </div>
      </div>
      <div v-if="!summary?.corridors?.length" class="card"><EmptyState :loading="loading" message="No corridors registered." compact /></div>

      <div class="card">
        <div class="card-header">Customs status mix · {{ days }}d</div>
        <div class="card-body">
          <template v-if="summary?.status_mix?.length">
            <div class="mix" role="img" :aria-label="mixLabel">
              <span v-for="s in summary.status_mix" :key="s.status" class="mix-seg"
                :style="{ flex: s.count, background: mixColor(s.status) }" :title="`${s.label}: ${s.count}`" />
            </div>
            <ul class="legend">
              <li v-for="s in summary.status_mix" :key="s.status"><i class="sw" :style="{ background: mixColor(s.status) }" />{{ s.label }} <b>{{ s.count }}</b></li>
            </ul>
          </template>
          <EmptyState v-else :loading="loading" message="No declarations in this window." compact />
        </div>
      </div>
    </div>
  </div>

  <!-- Scorecards -->
  <SectionTitle pill="Corridor performance · monthly">Northern Corridor - headline indicators</SectionTitle>
  <div class="kpi-grid wide">
    <KpiCard v-for="s in headline.NORTHERN" :key="s.indicator_code + s.segment" v-bind="kpiCardBind(s)" to="/corridor/northern" />
    <EmptyState v-if="!headline.NORTHERN.length" :loading="loading" message="No Northern Corridor indicators loaded." compact />
  </div>

  <SectionTitle pill="LAPSSET · monthly">LAPSSET Corridor - headline indicators</SectionTitle>
  <div class="kpi-grid wide">
    <KpiCard v-for="s in headline.LAPSSET" :key="s.indicator_code + s.segment" v-bind="kpiCardBind(s)" to="/corridor/lapsset" />
    <EmptyState v-if="!headline.LAPSSET.length" :loading="loading" message="No LAPSSET indicators loaded." compact />
  </div>

  <!-- Border league + alerts -->
  <div class="two-col even">
    <div class="card">
      <div class="card-header">Border post league · slowest first <NuxtLink v-if="canSee('/corridor/border-crossings')" to="/corridor/border-crossings" class="link-sm">Details →</NuxtLink></div>
      <div class="card-body flush">
        <table v-if="posts.length">
          <thead><tr><th>Post</th><th class="r">Wait</th><th class="r">Queue</th><th class="r">Trucks</th><th>Main delay</th></tr></thead>
          <tbody>
            <tr v-for="p in postsPageRows" :key="p.site_id">
              <td><span class="dot-sm" :style="{ background: TONE_COLOR[waitTone(p.avg_waiting_hours)] }" />{{ p.name }}</td>
              <td class="r mono" :class="`t-${waitTone(p.avg_waiting_hours)}`">{{ p.avg_waiting_hours != null ? `${p.avg_waiting_hours.toFixed(1)} h` : '-' }}</td>
              <td class="r mono">{{ fmt(p.peak_queue_length) }}</td>
              <td class="r mono">{{ fmt(p.trucks) }}</td>
              <td>{{ p.top_delay_cause ? CAUSE_LABEL[p.top_delay_cause] : '-' }}</td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-else :loading="loading" message="No border crossing data in this window." compact />
        <TablePagination :page="postsPage" :total-pages="postsTotalPages" :total="postsTotal" @prev="postsPrev" @next="postsNext" />
      </div>
    </div>

    <div id="alerts" class="card drill-target">
      <div class="card-header">Flagged shipments <NuxtLink v-if="canSee('/corridor/transit')" to="/corridor/transit" class="link-sm">All declarations →</NuxtLink></div>
      <div class="card-body">
        <template v-if="summary?.alerts?.length">
          <AlertItem v-for="a in summary.alerts" :key="a.id" :severity="a.tamper_alert ? 'critical' : 'warning'"
            :title="`${a.transit_declaration_ref} → ${a.destination_country}`"
            :meta="[a.tamper_alert ? 'Tamper alert' : null, a.deviation_alert ? 'Route deviation' : null, a.truck_registration, a.cargo_description].filter(Boolean).join(' · ')" />
        </template>
        <EmptyState v-else :loading="loading" message="All systems nominal - no flagged shipments." compact />
      </div>
    </div>
  </div>

  <!-- Agency lenses -->
  <SectionTitle pill="Who reports what">Agency views</SectionTitle>
  <div class="lens-grid">
    <NuxtLink v-for="l in lenses" :key="l.to" :to="l.to" class="lens card" :class="{ disabled: !canSee(l.to) }">
      <span class="lens-agency">{{ l.agency }}</span>
      <span class="lens-title">{{ l.title }}</span>
      <span class="lens-desc">{{ l.desc }}</span>
      <span class="lens-fig">{{ l.fig }}</span>
      <span class="lens-go">Open <ArrowRight :size="13" aria-hidden="true" /></span>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight } from 'lucide-vue-next'
import {
  useCorridor, kpiCardBind, waitTone, fmtHours, fmtKes, alignmentLines, fmtCorridorNum as fmtN,
  CORRIDOR_CAUSE_LABEL as CAUSE_LABEL, CORRIDOR_TONE_COLOR as TONE_COLOR,
  type CorridorSummary, type KpiSeries, type CorridorTone, type CorridorAlignment,
} from '~/composables/api'

const access = useAccessControl()
const canSee = access.canAccessRoute

const days = ref(30)
const summary = ref<CorridorSummary | null>(null)
const series = ref<KpiSeries[]>([])
const alignments = ref<CorridorAlignment[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  const api = useCorridor()
  const [s, k, al] = await Promise.allSettled([api.summary(days.value), api.kpiSeries({ months: 12 }), api.alignments()])
  if (s.status === 'fulfilled') summary.value = s.value
  if (k.status === 'fulfilled') series.value = k.value
  if (al.status === 'fulfilled') alignments.value = al.value
  if (s.status === 'rejected' && k.status === 'rejected') error.value = 'Unable to reach the UAPTS Corridor API.'
  loading.value = false
}
onMounted(load)

const k = computed(() => summary.value?.kpis ?? null)
const lines = computed(() => alignmentLines(alignments.value))
const posts = computed(() => summary.value?.border_posts ?? [])
const { pageRows: postsPageRows, page: postsPage, totalPages: postsTotalPages, total: postsTotal, next: postsNext, prev: postsPrev } = usePagination(posts, 8)

const fmt = (v: number | null | undefined) => fmtN(v)
const hours = fmtHours
const statusFor = (t: CorridorTone) => t === 'success' ? 'healthy' : t === 'warning' ? 'warning' : t === 'danger' ? 'critical' : undefined

const markers = computed(() => posts.value.filter(p => p.latitude != null && p.longitude != null).map(p => {
  const tone = waitTone(p.avg_waiting_hours)
  return {
    id: p.site_id, lat: p.latitude as number, lon: p.longitude as number, title: p.name, badge: 'Border post',
    color: tone === 'success' ? 'green' as const : tone === 'warning' ? 'yellow' as const : 'red' as const,
    size: p.trucks > 6000 ? 'lg' as const : 'md' as const,
    rows: [
      { label: 'Avg wait', value: p.avg_waiting_hours != null ? `${p.avg_waiting_hours.toFixed(1)} h` : '-' },
      { label: 'Avg clearance', value: p.avg_clearance_hours != null ? `${p.avg_clearance_hours.toFixed(1)} h` : '-' },
      { label: 'Peak queue', value: fmtN(p.peak_queue_length) },
      { label: 'Trucks', value: fmtN(p.trucks) },
    ],
  }
}))

const HEADLINE: Record<string, string[]> = {
  NORTHERN: ['BORDER_CROSSING_TIME', 'PORT_DWELL_TIME', 'TRANSIT_TIME_MSA_KLA', 'WEIGHBRIDGE_CROSSING_TIME'],
  LAPSSET: ['PORT_THROUGHPUT', 'BERTH_OCCUPANCY_PCT', 'VESSEL_TURNAROUND_TIME', 'INVESTMENT_DISBURSED_PCT'],
}
const headline = computed(() => {
  const pick = (code: string) => HEADLINE[code]!.map(ind => series.value.find(s => s.corridor === code && s.indicator_code === ind && !s.segment)).filter(Boolean) as KpiSeries[]
  return { NORTHERN: pick('NORTHERN'), LAPSSET: pick('LAPSSET') }
})

const MIX_COLOR: Record<string, string> = {
  lodged: 'var(--border-interactive)', in_transit: 'var(--info)', at_border: 'var(--warning)',
  exited: 'var(--primary-fill)', cleared: 'var(--success)', held: 'var(--destructive)', cancelled: 'var(--fg-3)',
}
const mixColor = (s: string) => MIX_COLOR[s] ?? 'var(--border-interactive)'
const mixLabel = computed(() => (summary.value?.status_mix ?? []).map(s => `${s.label} ${s.count}`).join(', '))

const lenses = computed(() => [
  { agency: 'NCTTCA', title: 'Northern Corridor', to: '/corridor/northern', desc: 'Observatory indicators against benchmark, route condition, port-to-border transit chain.',
    fig: headline.value.NORTHERN[0] ? `${headline.value.NORTHERN[0].indicator_name}: ${headline.value.NORTHERN[0].latest.toFixed(1)} ${headline.value.NORTHERN[0].unit}` : '' },
  { agency: 'NCTTCA', title: 'Border Crossings', to: '/corridor/border-crossings', desc: 'Daily performance of every one-stop border post: queues, waits, causes of delay.',
    fig: k.value ? `${k.value.border_posts_reporting} posts · ${fmtN(k.value.trucks_crossed)} trucks` : '' },
  { agency: 'KenTrade', title: 'Transit Declarations', to: '/corridor/transit', desc: 'Every transit declaration through the single window: status, destination, time in transit.',
    fig: k.value ? `${fmtN(k.value.shipments)} declarations · ${fmtN(k.value.in_transit)} on the road` : '' },
  { agency: 'LAPSSET', title: 'LAPSSET Corridor', to: '/corridor/lapsset', desc: 'Lamu Port throughput, highway and rail construction progress, investment disbursed.',
    fig: headline.value.LAPSSET[0] ? `${headline.value.LAPSSET[0].indicator_name}: ${headline.value.LAPSSET[0].latest.toFixed(0)} ${headline.value.LAPSSET[0].unit}` : '' },
])
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 16px; }
.kpi-grid.wide { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.two-col { display: grid; grid-template-columns: 1.7fr 1fr; gap: 16px; margin-bottom: 16px; align-items: start; }
.two-col.even { grid-template-columns: 1fr 1fr; }
@media (max-width: 1100px) { .two-col, .two-col.even { grid-template-columns: 1fr; } }
.stack { display: flex; flex-direction: column; gap: 12px; }
.map-key { display: flex; gap: 14px; flex-wrap: wrap; font-size: 11px; padding: 8px 14px; border-top: 1px solid var(--border-subtle); color: var(--fg-2); }
.mk { display: flex; align-items: center; gap: 5px; }
.mk.muted, .muted { color: var(--fg-3); }
.line-seg { width: 20px; height: 4px; border-radius: 2px; display: inline-block; }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.dot-sm { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 8px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stat-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-3); margin-bottom: 3px; }
.val { font: 600 18px 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; color: var(--fg-1); }
.val small { font-size: 11px; color: var(--fg-3); }
.mix { display: flex; height: 10px; border-radius: 2px; overflow: hidden; gap: 1px; background: var(--surface-sunken); }
.mix-seg { min-width: 2px; }
.legend { list-style: none; margin: 12px 0 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 12px; color: var(--fg-2); }
.legend b { font-family: 'JetBrains Mono', ui-monospace, monospace; color: var(--fg-1); margin-left: 4px; }
.sw { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 7px; }
.card-body.flush { padding: 0; }
.r { text-align: right !important; }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.t-success { color: var(--success-fg); } .t-warning { color: var(--warning-fg); } .t-danger { color: var(--danger-fg); } .t-neutral { color: var(--fg-3); }
.link-sm { font-size: 12px; color: var(--link); text-decoration: none; float: right; font-weight: 500; text-transform: none; letter-spacing: 0; }
.lens-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; margin-bottom: 24px; }
.lens { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; text-decoration: none; color: inherit; }
.lens:hover { background: var(--primary-wash); }
.lens.disabled { opacity: .55; pointer-events: none; }
.lens-agency { font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--primary); }
.lens-title { font-size: 15px; font-weight: 700; color: var(--fg-1); letter-spacing: -.01em; }
.lens-desc { font-size: 12px; color: var(--fg-2); line-height: 1.45; flex: 1; }
.lens-fig { font: 500 11px 'JetBrains Mono', ui-monospace, monospace; color: var(--fg-1); min-height: 15px; }
.lens-go { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--link); }
</style>
