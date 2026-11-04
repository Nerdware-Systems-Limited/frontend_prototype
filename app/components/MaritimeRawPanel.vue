<template>
  <CollapsibleSection :id="id" class="card drill-target" :default-open="defaultOpen" :title="cfg.title" :source="cfg.source" :count="table.total.value">
    <div class="card-body">
      <p v-if="cfg.hint" class="hint">{{ cfg.hint }}</p>
      <DataTable :table="table" row-key="id" :title="cfg.title" :empty="cfg.empty" :export-name="`uapts-maritime-${dataset}`" />
    </div>
  </CollapsibleSection>
</template>

<script setup lang="ts">
/**
 * One panel for the maritime upload tables the dashboards do not roll up themselves: KPA vessel calls, container
 * movements, dwell and bulk cargo, KMA pollution reports and PSC inspections.
 *
 * Every table is a window onto the WHOLE server-side dataset: search, column filters, sorting and paging all run on
 * the server (see composables/useServerTable), so nothing is capped at the first few hundred rows and the browser
 * only ever holds one page. Export can take every matching row.
 */
import { useEndpointTable } from '~/composables/useEndpointTable'
import type { TableColumn } from '~/types/dataTable'

type Dataset = 'vessel-calls' | 'container-movements' | 'container-dwell' | 'bulk-cargo' | 'pollution' | 'inspections'
type Col = { key: string; label: string; type?: 'text' | 'mono' | 'num' | 'date' | 'datetime' | 'badge' | 'bool' | 'join'; badge?: Record<string, string>; join?: string[]; digits?: number }

const props = withDefaults(defineProps<{ dataset: Dataset; id?: string; defaultOpen?: boolean; port?: string }>(), { defaultOpen: false, id: undefined, port: undefined })

const STAGE = { scheduled: 'neutral', arrived: 'info', alongside: 'warning', departed: 'success' }
const CONTAIN = { ongoing: 'danger', contained: 'warning', resolved: 'success' }
const EXAM = { green: 'success', yellow: 'warning', red: 'danger' }
const RESULT = { clear: 'success', deficiencies: 'warning', detainable: 'danger', banned: 'danger' }

const CONFIG: Record<Dataset, { title: string; source: string; hint?: string; empty: string; columns: Col[] }> = {
  'vessel-calls': {
    title: 'Vessel Calls', source: 'KPA · Upload', empty: 'No vessel calls uploaded yet (template: kpa-vessel-calls).',
    columns: [
      { key: 'call_id', label: 'Call', type: 'mono' }, { key: 'vessel_name', label: 'Vessel' }, { key: 'port_unlocode', label: 'Port' },
      { key: 'berth_code', label: 'Berth', type: 'mono' }, { key: 'voyage_number', label: 'Voyage' }, { key: 'eta', label: 'ETA', type: 'datetime' },
      { key: 'ata', label: 'ATA', type: 'datetime' }, { key: 'waiting_hours', label: 'Waiting (h)', type: 'num', digits: 1 },
      { key: 'turnaround_hours', label: 'Turnaround (h)', type: 'num', digits: 1 }, { key: 'stage', label: 'Stage', type: 'badge', badge: STAGE },
    ],
  },
  'container-movements': {
    title: 'Container Movements', source: 'KPA · Upload', empty: 'No container movements uploaded yet (template: kpa-container-movements).',
    columns: [
      { key: 'container_number', label: 'Container', type: 'mono' }, { key: 'movement_type', label: 'Movement', type: 'badge', badge: {} },
      { key: 'moved_at', label: 'Time', type: 'datetime' }, { key: 'iso_size_type', label: 'Size' }, { key: 'container_type', label: 'Type' },
      { key: 'full_empty', label: 'F/E' }, { key: 'vessel_name', label: 'Vessel' }, { key: 'bill_of_lading', label: 'B/L', type: 'mono' },
      { key: 'weight_kg', label: 'Weight (kg)', type: 'num' }, { key: 'cargo_class', label: 'Class' }, { key: 'status', label: 'Status' },
    ],
  },
  'container-dwell': {
    title: 'Container Dwell Time', source: 'KPA · Upload', empty: 'No container dwell records uploaded yet (template: kpa-container-dwell).',
    columns: [
      { key: 'container_number', label: 'Container', type: 'mono' }, { key: 'port_unlocode', label: 'Port' }, { key: 'terminal', label: 'Terminal' },
      { key: 'discharged_at', label: 'Discharged', type: 'datetime' }, { key: 'exam_type', label: 'Exam', type: 'badge', badge: EXAM },
      { key: 'released_at', label: 'Released', type: 'date' }, { key: 'delivered_at', label: 'Delivered', type: 'datetime' },
      { key: 'dwell_days', label: 'Dwell (days)', type: 'num', digits: 1 }, { key: 'detention_alert', label: 'Detention alert', type: 'bool' },
      { key: 'reefer_status', label: 'Reefer' },
    ],
  },
  'bulk-cargo': {
    title: 'General & Bulk Cargo', source: 'KPA · Upload', empty: 'No bulk cargo uploaded yet (template: kpa-bulk-cargo-transactions).',
    columns: [
      { key: 'transaction_date', label: 'Date', type: 'date' }, { key: 'port_unlocode', label: 'Port' }, { key: 'cargo_category', label: 'Category' },
      { key: 'commodity', label: 'Commodity' }, { key: 'vessel_name', label: 'Vessel' }, { key: 'berth_code', label: 'Berth', type: 'mono' },
      { key: 'import_tonnes', label: 'Import (t)', type: 'num' }, { key: 'export_tonnes', label: 'Export (t)', type: 'num' },
      { key: 'transit_tonnes', label: 'Transit (t)', type: 'num' },
    ],
  },
  pollution: {
    title: 'Marine Pollution Reports', source: 'KMA · Upload', empty: 'No pollution incidents reported (template: kma-marine-pollution-incidents).',
    columns: [
      { key: 'incident_ref', label: 'Reference', type: 'mono' }, { key: 'occurred_at', label: 'Occurred', type: 'datetime' },
      { key: 'substance', label: 'Substance', type: 'badge', badge: {} }, { key: 'source_type', label: 'Source' }, { key: 'vessel_name', label: 'Vessel' },
      { key: 'quantity', label: 'Quantity', type: 'join', join: ['quantity', 'quantity_unit'] },
      { key: 'containment_status', label: 'Containment', type: 'badge', badge: CONTAIN }, { key: 'responsible_party', label: 'Responsible party' },
      { key: 'legal_action_initiated', label: 'Legal action', type: 'bool' },
    ],
  },
  inspections: {
    title: 'Port State Control Inspections', source: 'KMA · Upload', empty: 'No inspections uploaded yet (template: kma-vessel-inspections).',
    columns: [
      { key: 'inspection_ref', label: 'Reference', type: 'mono' }, { key: 'inspected_at', label: 'Inspected', type: 'datetime' },
      { key: 'vessel_name', label: 'Vessel' }, { key: 'port_unlocode', label: 'Port' }, { key: 'inspection_type', label: 'Type' },
      { key: 'deficiencies_count', label: 'Deficiencies', type: 'num' }, { key: 'result', label: 'Result', type: 'badge', badge: RESULT },
      { key: 'compliance_status', label: 'Compliance' }, { key: 'deficiency_categories', label: 'Categories' },
      { key: 'detained', label: 'Detained', type: 'bool' }, { key: 'banning_order', label: 'Banned', type: 'bool' },
      { key: 'recidivist', label: 'Repeat detention', type: 'bool' }, { key: 'inspector', label: 'Inspector' },
    ],
  },
}


const cfg = computed(() => CONFIG[props.dataset])

const PATHS: Record<Dataset, string> = { 'vessel-calls': 'vessel-calls', 'container-movements': 'container-movements', 'container-dwell': 'container-dwell', 'bulk-cargo': 'bulk-cargo', 'pollution': 'pollution-incidents', 'inspections': 'maritime-inspections' }
// Columns the server computes (they are not database columns): shown, but they cannot be sorted or filtered on.
const COMPUTED: Record<Dataset, string[]> = { 'vessel-calls': ['waiting_hours', 'turnaround_hours', 'stage'], 'container-movements': [], 'container-dwell': [], 'bulk-cargo': ['total_tonnes'], 'pollution': [], 'inspections': ['recidivist'] }
// Datasets whose endpoint takes the page-level `port` selector.
const SCOPED = new Set<Dataset>(['vessel-calls', 'container-movements', 'container-dwell', 'bulk-cargo', 'pollution', 'inspections'])
// Fixed extra parameters per dataset.
const EXTRA: Partial<Record<Dataset, Record<string, string>>> = {}

const columns: TableColumn[] = CONFIG[props.dataset].columns.map((c: Col, i: number) => ({
  ...c,
  ...(COMPUTED[props.dataset].includes(c.key) ? { sortable: false as const, filter: false as const } : {}),
  priority: i < 5 ? (2 as const) : (3 as const),
}))

const table = useEndpointTable({
  key: `maritime-${props.dataset}`,
  path: `/api/v1/aviation-maritime/maritime/${PATHS[props.dataset]}/`,
  columns,
  pageSize: 25,
  countyKey: 'maritime',
  params: () => ({ ...EXTRA[props.dataset], ...(SCOPED.has(props.dataset) ? { port: props.port } : {}) }),
})
</script>

<style scoped>
.hint { font-size: 12px; color: var(--fg-3); margin: 0 0 8px; }
</style>
