<template>
  <CollapsibleSection :id="id" class="card drill-target" :default-open="defaultOpen" :title="cfg.title" :source="cfg.source" :count="table.total.value">
    <div class="card-body">
      <p v-if="cfg.hint" class="hint">{{ cfg.hint }}</p>
      <DataTable :table="table" row-key="id" :title="cfg.title" :empty="cfg.empty" :export-name="`uapts-aviation-${dataset}`" />
    </div>
  </CollapsibleSection>
</template>

<script setup lang="ts">
/**
 * One panel for the aviation upload tables the dashboards do not roll up themselves: KAA air cargo statistics and
 * ground handlers, KCAA AOC register and ATM performance, KCAA occurrence reports, KMD aviation weather. A field the
 * viewer's access tier hides (occurrence narratives, cargo forwarders) arrives as null and shows as "-".
 *
 * Every table is a window onto the WHOLE server-side dataset: search, column filters, sorting and paging all run on
 * the server (see composables/useServerTable), so nothing is capped at the first few hundred rows and the browser
 * only ever holds one page. Export can take every matching row.
 */
import { useEndpointTable } from '~/composables/useEndpointTable'
import type { TableColumn } from '~/types/dataTable'

type Dataset = 'air-cargo' | 'ground-handlers' | 'aoc' | 'atm' | 'occurrences' | 'weather'
type Col = { key: string; label: string; type?: 'text' | 'mono' | 'num' | 'date' | 'datetime' | 'badge' | 'bool' | 'join'; badge?: Record<string, string>; join?: string[]; digits?: number }

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

const PATHS: Record<Dataset, string> = { 'air-cargo': 'air-cargo-stats', 'ground-handlers': 'ground-handlers', 'aoc': 'air-operator-certificates', 'atm': 'atm-performance', 'occurrences': 'safety-reports', 'weather': 'met-observations' }
// Columns the server computes (they are not database columns): shown, but they cannot be sorted or filtered on.
const COMPUTED: Record<Dataset, string[]> = { 'air-cargo': ['total_tonnes'], 'ground-handlers': ['performance_vs_standard_pct'], 'aoc': ['days_to_expiry'], 'atm': ['separation_incidents', 'atco_coverage_pct'], 'occurrences': ['aircraft_registration'], 'weather': [] }
// Datasets whose endpoint takes the page-level `airport` selector.
const SCOPED = new Set<Dataset>(['air-cargo', 'ground-handlers', 'occurrences'])
// Fixed extra parameters per dataset.
const EXTRA: Partial<Record<Dataset, Record<string, string>>> = { 'weather': { scope: 'aviation' } }

const columns: TableColumn[] = CONFIG[props.dataset].columns.map((c: Col, i: number) => ({
  ...c,
  ...(COMPUTED[props.dataset].includes(c.key) ? { sortable: false as const, filter: false as const } : {}),
  priority: i < 5 ? (2 as const) : (3 as const),
}))

const table = useEndpointTable({
  key: `aviation-${props.dataset}`,
  path: `/api/v1/aviation-maritime/aviation/${PATHS[props.dataset]}/`,
  columns,
  pageSize: 25,
  countyKey: 'aviation',
  params: () => ({ ...EXTRA[props.dataset], ...(SCOPED.has(props.dataset) ? { airport: props.airport } : {}) }),
})
</script>

<style scoped>
.hint { font-size: 12px; color: var(--fg-3); margin: 0 0 8px; }
</style>
