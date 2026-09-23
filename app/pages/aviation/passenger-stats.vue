<template>
  <PageHeader
    eyebrow="Aviation - Passenger Intelligence"
    title="Passenger Statistics"
    subtitle="KAA · KCAA · KenTrade - Airport throughput, domestic vs international volumes, KenTrade air cargo clearances, and revenue trends"
  >
    <template #actions>
      <DayRangeToggle v-model="days" :options="[7, 30, 90]" @update:model-value="load" />
      <select v-model="airportFilter" class="select-sm" @change="load">
        <option value="">All airports</option>
        <option v-for="a in airports" :key="a.iata_code" :value="a.iata_code">{{ a.iata_code }} - {{ a.name }}</option>
      </select>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Passengers"
      :value="fmtNum(totalPax)"
      :unavailable="loading || byApError"
      :unavailable-note="loading ? 'Loading…' : 'KAA feed unavailable'"
      :period="`${days}D`"
      description="All airports"
      to="#by-airport"
    />
    <KpiCard
      label="Domestic"
      :value="fmtNum(totalDomestic)"
      :unavailable="loading || byApError"
      :unavailable-note="loading ? 'Loading…' : 'KAA feed unavailable'"
      :period="`${days}D`"
      :description="totalPax > 0 ? `${((totalDomestic / totalPax) * 100).toFixed(1)}% share` : ''"
      to="#volume-comparison"
    />
    <KpiCard
      label="International"
      :value="fmtNum(totalIntl)"
      :unavailable="loading || byApError"
      :unavailable-note="loading ? 'Loading…' : 'KAA feed unavailable'"
      :period="`${days}D`"
      :description="totalPax > 0 ? `${((totalIntl / totalPax) * 100).toFixed(1)}% share` : ''"
      to="#volume-comparison"
    />
    <KpiCard
      label="Total Revenue"
      :value="totalRevenue ? `KES ${fmtKES(totalRevenue)}` : '-'"
      :unavailable="loading || byApError"
      :unavailable-note="loading ? 'Loading…' : 'KAA feed unavailable'"
      :period="`${days}D`"
      description="Across network"
      to="#by-airport"
    />
    <KpiCard
      label="Airports Reporting"
      :value="fmtNum(byAirport.length)"
      :unavailable="loading || byApError"
      :unavailable-note="loading ? 'Loading…' : 'KAA feed unavailable'"
      :period="`${days}D`"
      description="With passenger data"
      to="#by-airport"
    />
    <KpiCard
      label="Avg Rev / Pax"
      :value="totalPax > 0 && totalRevenue ? `KES ${fmtKES(totalRevenue / totalPax)}` : '-'"
      :unavailable="loading || byApError"
      :unavailable-note="loading ? 'Loading…' : 'KAA feed unavailable'"
      :period="`${days}D`"
      description="Yield per passenger"
    />
  </div>

  <!-- Airport breakdown table + intl share bars -->
  <SectionTitle :pill="`KAA · ${days}d`">By Airport</SectionTitle>

  <div id="by-airport" class="card drill-target">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Airport</th>
            <th>IATA</th>
            <th>Total Passengers</th>
            <th>Domestic</th>
            <th>International</th>
            <th>Intl %</th>
            <th>Revenue (KES)</th>
            <th>Rev / Pax</th>
          </tr>
        </thead>
        <tbody v-if="byAirport.length">
          <tr v-for="p in byAirportPageRows" :key="p.airport__iata_code">
            <td style="font-weight:600">{{ p.airport__name }}</td>
            <td style="font-family:monospace;font-weight:700;font-size:14px">{{ p.airport__iata_code }}</td>
            <td style="font-weight:700">{{ fmtNum(p.total_pax) }}</td>
            <td>{{ fmtNum(p.domestic) }}</td>
            <td>{{ fmtNum(p.intl) }}</td>
            <td>
              <div class="share-bar-wrap">
                <div class="share-bar intl-bar" :style="{ width: `${p.total_pax > 0 ? (p.intl / p.total_pax) * 100 : 0}%` }" />
              </div>
              <span style="font-size:11px">{{ p.total_pax > 0 ? ((p.intl / p.total_pax) * 100).toFixed(0) : 0 }}%</span>
            </td>
            <td style="font-size:12px">{{ fmtKES(p.revenue_kes) }}</td>
            <td style="font-size:12px">
              {{ p.total_pax > 0 ? fmtKES(p.revenue_kes / p.total_pax) : '-' }}
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="8" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No passenger data.' }}</td></tr>
        </tbody>
      </table>
      <TablePagination
        :page="byAirportPage" :total-pages="byAirportTotalPages" :total="byAirportTotal"
        @prev="byAirportPrev" @next="byAirportNext"
      />
    </div>
  </div>

  <!-- Volume comparison bar chart -->
  <SectionTitle pill="KAA">Domestic vs International Volumes</SectionTitle>

  <div id="volume-comparison" class="card drill-target">
    <div class="card-body">
      <div v-if="byAirport.length" class="vol-compare">
        <div v-for="p in byAirport" :key="p.airport__iata_code" class="vc-row">
          <div class="vc-label">{{ p.airport__iata_code }}</div>
          <div class="vc-bars">
            <div class="vc-bar-wrap" title="Domestic">
              <div class="vc-bar dom-bar" :style="{ width: `${maxPax > 0 ? (p.domestic / maxPax) * 100 : 0}%` }" />
              <span class="vc-count">{{ fmtNum(p.domestic) }}</span>
            </div>
            <div class="vc-bar-wrap" title="International">
              <div class="vc-bar int-bar" :style="{ width: `${maxPax > 0 ? (p.intl / maxPax) * 100 : 0}%` }" />
              <span class="vc-count">{{ fmtNum(p.intl) }}</span>
            </div>
          </div>
        </div>
        <div class="vc-legend">
          <span><span class="vc-dot dom-bg" /> Domestic</span>
          <span><span class="vc-dot int-bg" /> International</span>
        </div>
      </div>
      <EmptyState v-else :loading="loading" message="No data." compact />
    </div>
  </div>

  <!-- Detailed passenger records -->
  <SectionTitle pill="KAA · KCAA">Detailed Passenger Records</SectionTitle>

  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Airport</th>
            <th>Date</th>
            <th>Passengers</th>
            <th>Domestic</th>
            <th>International</th>
            <th>Revenue (KES)</th>
          </tr>
        </thead>
        <tbody v-if="paxRecords.length">
          <tr v-for="(r, i) in paxRecordsPageRows" :key="i">
            <td>{{ airportName(r.airport_code) }}</td>
            <td style="font-size:12px">{{ r.report_date ? fmtDate(r.report_date) : '-' }}</td>
            <td style="font-weight:600">{{ fmtNum(r.passengers) }}</td>
            <td>{{ fmtNum(r.domestic) }}</td>
            <td>{{ fmtNum(r.international) }}</td>
            <td style="font-size:12px">{{ r.revenue_kes ? fmtKES(parseFloat(r.revenue_kes)) : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="6" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No detailed records.' }}</td></tr>
        </tbody>
      </table>
      <TablePagination
        :page="paxRecordsPage" :total-pages="paxRecordsTotalPages" :total="paxRecordsTotal"
        @prev="paxRecordsPrev" @next="paxRecordsNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useAviationMaritime } from '~/composables/api'
import type { PassengerByAirport, Airport } from '~/composables/api'

const byAirport  = ref<PassengerByAirport[]>([])
const airports   = ref<Airport[]>([])
const paxRecords = ref<any[]>([])
const loading    = ref(true)
const error      = ref<string | null>(null)
const byApError  = ref(false)
const lastRefreshed = ref('-')
const days          = ref(30)
const airportFilter = ref('')

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()

  const [byApRes, apRes, recRes] = await Promise.allSettled([
    avm.passengersByAirport({ days: days.value }),
    avm.airports(),
    avm.passengerStats({ airport: airportFilter.value || undefined, days: days.value, page_size: 50 }),
  ])

  if (byApRes.status === 'fulfilled') byAirport.value  = (byApRes.value as any).results ?? []
  if (apRes.status   === 'fulfilled') airports.value   = (apRes.value as any).results ?? []
  if (recRes.status  === 'fulfilled') paxRecords.value = (recRes.value as any).results ?? []

  byApError.value = byApRes.status === 'rejected'

  if ([byApRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Aviation API.'

  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Computed ──────────────────────────────────────────────────────────────
const totalPax      = computed(() => byAirport.value.reduce((s, p) => s + p.total_pax, 0))
const totalDomestic = computed(() => byAirport.value.reduce((s, p) => s + p.domestic, 0))
const totalIntl     = computed(() => byAirport.value.reduce((s, p) => s + p.intl, 0))
const totalRevenue  = computed(() => byAirport.value.reduce((s, p) => s + p.revenue_kes, 0))
const maxPax        = computed(() => Math.max(1, ...byAirport.value.map(p => Math.max(p.domestic, p.intl))))

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: byAirportPageRows, page: byAirportPage, totalPages: byAirportTotalPages,
  total: byAirportTotal, next: byAirportNext, prev: byAirportPrev,
} = usePagination(byAirport, 15)

const {
  pageRows: paxRecordsPageRows, page: paxRecordsPage, totalPages: paxRecordsTotalPages,
  total: paxRecordsTotal, next: paxRecordsNext, prev: paxRecordsPrev,
} = usePagination(paxRecords, 15)

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '-'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}k`
  return Math.round(n).toLocaleString()
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function airportName(code: string | null | undefined) {
  if (!code) return '-'
  return airports.value.find(a => a.iata_code === code)?.name ?? code
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; margin-bottom:16px; }
.share-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.intl-bar { height:100%; background:var(--primary-fill); border-radius:4px; }
.vol-compare { display:flex; flex-direction:column; gap:10px; }
.vc-row { display:grid; grid-template-columns:60px 1fr; align-items:center; gap:10px; }
.vc-label { font-family:monospace; font-weight:700; font-size:13px; }
.vc-bars { display:flex; flex-direction:column; gap:4px; }
.vc-bar-wrap { display:flex; align-items:center; gap:8px; }
.vc-bar { height:12px; border-radius:3px; min-width:2px; flex-shrink:0; }
.vc-count { font-size:11px; color:var(--fg-2); white-space:nowrap; }
.dom-bar { background:var(--success); }
.int-bar { background:var(--primary-fill); }
.vc-legend { display:flex; gap:16px; font-size:12px; margin-top:8px; }
.vc-dot { width:10px; height:10px; border-radius:2px; display:inline-block; margin-right:4px; }
.dom-bg { background:var(--success); }
.int-bg { background:var(--primary-fill); }
</style>
