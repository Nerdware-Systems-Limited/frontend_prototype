<template>
  <CollapsibleSection :id="id" class="card drill-target" :default-open="defaultOpen" :title="cfg.title" :source="cfg.source" :count="rows.length">
    <div class="card-body">
      <p v-if="cfg.hint" class="hint">{{ cfg.hint }}</p>
      <div v-if="error" class="error-banner">⚠ {{ error }}</div>
      <div class="filter-row">
        <input v-model="search" class="select-sm" placeholder="Search…" style="min-width:200px" />
        <button class="btn" @click="search = ''">Clear</button>
        <ExportButton :filename="`uapts-maritime-${dataset}.csv`" :rows="filtered" :columns="cfg.columns.map(c => ({ key: c.key, label: c.label }))" style="margin-left:auto" />
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
 * One panel for the maritime upload tables the dashboards do not roll up themselves: KPA vessel calls, container
 * movements and bulk cargo, KMA pollution reports and PSC inspections. Fetches its own rows (newest first, up to
 * 200) and filters / pages them in the browser, like the other maritime tables.
 */
import { useAviationMaritime } from '~/composables/api'

type Dataset = 'vessel-calls' | 'container-movements' | 'container-dwell' | 'bulk-cargo' | 'pollution' | 'inspections'
type Col = { key: string; label: string; type?: 'text' | 'mono' | 'num' | 'date' | 'datetime' | 'badge' | 'bool' | 'join'; badge?: Record<string, string>; join?: string[]; digits?: number }
type Row = Record<string, any>

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
const rows = ref<Row[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')

async function load() {
  loading.value = true
  error.value = null
  const avm = useAviationMaritime()
  const q = { page_size: 200, port: props.port }
  try {
    const res: any = await {
      'vessel-calls': () => avm.vesselCalls(q), 'container-movements': () => avm.containerMovements(q), 'container-dwell': () => avm.containerDwell(q),
      'bulk-cargo': () => avm.bulkCargo(q), pollution: () => avm.pollutionIncidents(q), inspections: () => avm.maritimeInspections(q),
    }[props.dataset]()
    rows.value = res.results ?? []
  } catch {
    rows.value = []
    error.value = `Unable to load ${cfg.value.title.toLowerCase()}.`
  } finally { loading.value = false }
}
onMounted(load)
watch(() => [props.dataset, props.port], load)

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
