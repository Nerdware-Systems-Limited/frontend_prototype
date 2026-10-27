<template>
  <CollapsibleSection :id="id" class="card drill-target" :default-open="defaultOpen" :title="cfg.title" :source="cfg.source" :count="rows.length">
    <div class="card-body">
      <p v-if="cfg.hint" class="hint">{{ cfg.hint }}</p>
      <div v-if="error" class="error-banner">⚠ {{ error }}</div>
      <div class="filter-row">
        <input v-model="search" class="select-sm" placeholder="Search…" style="min-width:200px" />
        <button class="btn" @click="search = ''">Clear</button>
        <ExportButton :filename="`uapts-aviation-${dataset}.csv`" :rows="filtered" :columns="cfg.columns.map(c => ({ key: c.key, label: c.label }))" style="margin-left:auto" />
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th v-for="c in cfg.columns" :key="c.key" :style="c.type === 'num' ? 'text-align:right' : ''">{{ c.label }}</th></tr>
          </thead>
          <tbody v-if="filtered.length">
            <tr v-for="r in pageRows" :key="String(r.id)">
              <td v-for="c in cfg.columns" :key="c.key" :style="cellStyle(c)">
                <BadgePill v-if="c.type === 'badge' && r[c.key]" :variant="badgeVariant(c, r[c.key])">{{ label(r[c.key]) }}</BadgePill>
                <template v-else>{{ cell(c, r) }}</template>
              </td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr><td :colspan="cfg.columns.length" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : cfg.empty }}</td></tr>
          </tbody>
        </table>
        <TablePagination :page="page" :total-pages="totalPages" :total="total" @prev="prev" @next="next" />
      </div>
    </div>
  </CollapsibleSection>
</template>

<script setup lang="ts">
/**
 * One panel for the aviation upload tables the dashboards do not roll up themselves: KAA air cargo statistics and
 * ground handlers, KCAA AOC register and ATM performance, KCAA occurrence reports, KMD aviation weather. Fetches its own
 * rows (newest first, up to 200) and filters / pages them in the browser. A field the viewer's access tier hides
 * (occurrence narratives, cargo forwarders) arrives as null and shows as "-".
 */
import { useAviationMaritime } from '~/composables/api'

type Dataset = 'air-cargo' | 'ground-handlers' | 'aoc' | 'atm' | 'occurrences' | 'weather'
type Col = { key: string; label: string; type?: 'text' | 'mono' | 'num' | 'date' | 'datetime' | 'badge' | 'bool' | 'join'; badge?: Record<string, string>; join?: string[]; digits?: number }
type Row = Record<string, any>

const props = withDefaults(defineProps<{ dataset: Dataset; id?: string; defaultOpen?: boolean; airport?: string }>(), { defaultOpen: false, id: undefined, airport: undefined })

const CUSTOMS = { cleared: 'success', held: 'danger', under_examination: 'warning' }
const COMPLIANCE = { compliant: 'success', conditional: 'warning', non_compliant: 'danger', suspended: 'danger' }
const AOC = { valid: 'success', under_renewal: 'warning', suspended: 'danger', revoked: 'danger' }
const FINDING = { none: 'success', level_1: 'info', level_2: 'warning', level_3: 'danger' }
const OCC = { accident: 'danger', serious_incident: 'danger', incident: 'warning', occurrence: 'info', ground_occurrence: 'info', ground_damage: 'info', airspace_infringement: 'warning' }
const FLIGHTCAT = { VFR: 'success', MVFR: 'info', IFR: 'warning', LIFR: 'danger' }

const CONFIG: Record<Dataset, { title: string; source: string; hint?: string; empty: string; columns: Col[] }> = {
  'air-cargo': {
    title: 'Air Cargo Statistics', source: 'KAA · Upload', empty: 'No air cargo statistics uploaded yet (template: kaa-air-cargo-statistics).',
    columns: [
      { key: 'report_date', label: 'Date', type: 'date' }, { key: 'airport_iata', label: 'Airport', type: 'mono' }, { key: 'airline_iata', label: 'Airline', type: 'mono' },
      { key: 'flight_number', label: 'Flight', type: 'mono' }, { key: 'cargo_category', label: 'Category' }, { key: 'commodity', label: 'Commodity' },
      { key: 'import_tonnes', label: 'Import (t)', type: 'num' }, { key: 'export_tonnes', label: 'Export (t)', type: 'num' }, { key: 'transit_tonnes', label: 'Transit (t)', type: 'num' },
      { key: 'warehouse_dwell_hours', label: 'Dwell (h)', type: 'num', digits: 1 }, { key: 'customs_status', label: 'Customs', type: 'badge', badge: CUSTOMS },
      { key: 'freight_forwarder', label: 'Forwarder' },
    ],
  },
  'ground-handlers': {
    title: 'Ground Handlers', source: 'KAA · Upload', empty: 'No ground handlers uploaded yet (template: kaa-ground-handlers).',
    columns: [
      { key: 'name', label: 'Handler' }, { key: 'airport_iata', label: 'Airport', type: 'mono' }, { key: 'licence_no', label: 'Licence', type: 'mono' },
      { key: 'licence_expires', label: 'Licence expiry', type: 'date' }, { key: 'turnaround_avg_min', label: 'Turnaround (min)', type: 'num', digits: 0 },
      { key: 'performance_vs_standard_pct', label: 'vs standard (%)', type: 'num', digits: 0 }, { key: 'gse_availability_pct', label: 'GSE avail. (%)', type: 'num', digits: 0 },
      { key: 'fod_incidents', label: 'FOD', type: 'num' }, { key: 'safety_incidents', label: 'Safety inc.', type: 'num' },
      { key: 'audit_score', label: 'Audit score', type: 'num', digits: 0 }, { key: 'compliance_status', label: 'Compliance', type: 'badge', badge: COMPLIANCE },
    ],
  },
  aoc: {
    title: 'Air Operator Certificates', source: 'KCAA · Upload', empty: 'No AOCs uploaded yet (template: kcaa-aoc-register).',
    columns: [
      { key: 'aoc_number', label: 'AOC', type: 'mono' }, { key: 'operator_name', label: 'Operator' }, { key: 'trade_name', label: 'Trade name' },
      { key: 'ops_spec_type', label: 'Ops spec' }, { key: 'authorised_aircraft_types', label: 'Types' }, { key: 'home_base_icao', label: 'Base', type: 'mono' },
      { key: 'expiry_date', label: 'Expires', type: 'date' }, { key: 'days_to_expiry', label: 'Days left', type: 'num', digits: 0 },
      { key: 'status', label: 'Status', type: 'badge', badge: AOC }, { key: 'special_authorisations', label: 'Special auth.' },
      { key: 'audit_finding_level', label: 'Last audit', type: 'badge', badge: FINDING },
    ],
  },
  atm: {
    title: 'ATM Performance', source: 'KCAA · Upload', empty: 'No ATM performance uploaded yet (template: kcaa-atm-performance).',
    columns: [
      { key: 'record_date', label: 'Date', type: 'date' }, { key: 'sector', label: 'Sector' }, { key: 'ifr_flights', label: 'IFR flights', type: 'num', digits: 0 },
      { key: 'atfm_delay_min', label: 'ATFM delay (min)', type: 'num', digits: 0 }, { key: 'route_adherence_pct', label: 'Route adherence (%)', type: 'num', digits: 1 },
      { key: 'separation_incidents', label: 'Separation inc.', type: 'num' }, { key: 'runway_incursions', label: 'Incursions', type: 'num' },
      { key: 'atco_coverage_pct', label: 'ATCO cover (%)', type: 'num', digits: 0 }, { key: 'primary_radar_uptime_pct', label: 'PSR (%)', type: 'num', digits: 1 },
      { key: 'secondary_radar_uptime_pct', label: 'SSR (%)', type: 'num', digits: 1 }, { key: 'capacity_utilisation_pct', label: 'Capacity use (%)', type: 'num', digits: 0 },
    ],
  },
  occurrences: {
    title: 'Occurrence Reports (MORS)', source: 'KCAA · Upload · ICAO Annex 13', empty: 'No occurrence reports uploaded yet (template: kcaa-occurrence-reports).',
    hint: 'Safety analytics only (ICAO Annex 13). Narratives and corrective actions are visible to admin tier and above.',
    columns: [
      { key: 'report_ref', label: 'Occurrence', type: 'mono' }, { key: 'occurred_at', label: 'Occurred (UTC)', type: 'datetime' }, { key: 'report_type', label: 'Category', type: 'badge', badge: OCC },
      { key: 'airport_code', label: 'Aerodrome', type: 'mono' }, { key: 'aircraft_registration', label: 'Aircraft', type: 'mono' }, { key: 'operator_name', label: 'Operator' },
      { key: 'flight_phase', label: 'Phase' }, { key: 'contributing_factors', label: 'SHELL factors' }, { key: 'casualties', label: 'Casualties', type: 'num' },
      { key: 'aircraft_damage', label: 'Damage' }, { key: 'investigation_authority', label: 'Investigator' }, { key: 'status', label: 'Status' }, { key: 'description', label: 'Narrative' },
    ],
  },
  weather: {
    title: 'Aviation Weather (METAR / TAF / SIGMET)', source: 'KMD · Upload', empty: 'No aviation weather uploaded yet (template: kmd-aviation-weather).',
    columns: [
      { key: 'station_code', label: 'Station', type: 'mono' }, { key: 'observation_type', label: 'Product' }, { key: 'observed_at', label: 'Issued (UTC)', type: 'datetime' },
      { key: 'wind_direction_deg', label: 'Wind dir', type: 'num', digits: 0 }, { key: 'wind_speed_kt', label: 'Wind (kt)', type: 'num', digits: 0 }, { key: 'wind_gust_kt', label: 'Gust (kt)', type: 'num', digits: 0 },
      { key: 'visibility_m', label: 'Vis (m)', type: 'num', digits: 0 }, { key: 'cloud_layers', label: 'Cloud' }, { key: 'temperature_c', label: 'Temp (C)', type: 'num', digits: 0 },
      { key: 'qnh_hpa', label: 'QNH', type: 'num', digits: 0 }, { key: 'flight_category', label: 'Category', type: 'badge', badge: FLIGHTCAT }, { key: 'raw_text', label: 'Message' },
    ],
  },
}

const cfg = computed(() => CONFIG[props.dataset])
const rows = ref<Row[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()
  const q = { page_size: 100, airport: props.airport }
  try {
    const res: any = await {
      'air-cargo': () => avm.airCargoStats(q), 'ground-handlers': () => avm.groundHandlers(q), aoc: () => avm.airOperatorCertificates({ page_size: 100 }),
      atm: () => avm.atmPerformance({ page_size: 100 }), occurrences: () => avm.safetyReports({ airport: props.airport }), weather: () => avm.metObservations({ scope: 'aviation' }),
    }[props.dataset]()
    rows.value = res.results ?? []
  } catch {
    rows.value = []
    error.value = `Unable to load ${cfg.value.title.toLowerCase()}.`
  } finally { loading.value = false }
}
onMounted(load)
watch(() => [props.dataset, props.airport], load)

const filtered = computed(() => {
  const s = search.value.trim().toLowerCase()
  return s ? rows.value.filter(r => Object.values(r).some(v => v != null && String(v).toLowerCase().includes(s))) : rows.value
})
const { pageRows, page, totalPages, total, next, prev } = usePagination(filtered, 15)

const label = (v: unknown) => String(v ?? '').replace(/_/g, ' ')
const cellStyle = (c: Col) => (c.type === 'mono' ? 'font-family:monospace;font-size:12px' : c.type === 'num' ? 'text-align:right' : 'font-size:12px')
const badgeVariant = (c: Col, v: string) => c.badge?.[v] ?? 'info'
function fmtDate(v: string, time: boolean) {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v
    : d.toLocaleString('en-KE', time ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' })
}
function cell(c: Col, r: Row): string {
  const v = r[c.key]
  if (c.type === 'join') return v == null ? '-' : (c.join ?? []).map(k => label(r[k])).filter(Boolean).join(' ')
  if (v == null || v === '') return '-'
  if (c.type === 'date') return fmtDate(v, false)
  if (c.type === 'datetime') return fmtDate(v, true)
  if (c.type === 'num') return Number(v).toLocaleString(undefined, { maximumFractionDigits: c.digits ?? 2 })
  if (c.type === 'bool') return v ? 'Yes' : 'No'
  return label(v)
}
</script>

<style scoped>
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.table-scroll { overflow-x:auto; }
.hint { font-size:12px; color:var(--fg-3); margin:0 0 8px; }
</style>
