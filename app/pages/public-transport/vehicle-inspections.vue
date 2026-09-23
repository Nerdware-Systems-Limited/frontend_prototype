<template>
  <PageHeader
    eyebrow="Public Transport · NTSA"
    title="Vehicle Inspections"
    subtitle="NTSA - Roadworthiness inspection records, pass/fail outcomes, re-inspection chains, and inspection-centre/inspector workload"
  >
    <template #actions>
      <NuxtLink to="/public-transport/vehicle-registration" class="btn">Vehicle Registration →</NuxtLink>
      <NuxtLink to="/public-transport/operators" class="btn">Public Operators →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI strip (computed from the loaded registry - real fields only) -->
  <div class="kpi-grid">
    <KpiCard label="Inspections (loaded)" :value="fmtNum(inspections.length)" :unavailable="loading || !!error" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Inspections feed unavailable'" period="LIVE" description="Most recent records" to="#inspection-registry" />
    <KpiCard label="Passed" :value="fmtNum(countByResult('pass'))" :unavailable="loading || !!error" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Inspections feed unavailable'" period="LIVE" description="Roadworthy" />
    <KpiCard label="Failed" :value="fmtNum(countByResult('fail'))" :unavailable="loading || !!error" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Inspections feed unavailable'" period="LIVE" description="Not roadworthy" />
    <KpiCard label="Conditional Pass" :value="fmtNum(countByResult('conditional_pass'))" :unavailable="loading || !!error" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Inspections feed unavailable'" period="LIVE" description="Passed with conditions" />
    <KpiCard label="Pass Rate" :value="passRate != null ? `${passRate.toFixed(1)}%` : '-'" :unavailable="loading || !!error" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Inspections feed unavailable'" period="LIVE" description="Pass / (pass + fail)" :status="passRate == null ? undefined : passRate >= 80 ? 'healthy' : 'warning'" />
    <KpiCard label="Re-inspections" :value="fmtNum(reinspectionCount)" :unavailable="loading || !!error" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Inspections feed unavailable'" period="LIVE" description="Follow-up records" />
    <KpiCard label="Overdue" :value="fmtNum(overdueCount)" :unavailable="loading || !!error" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Inspections feed unavailable'" period="LIVE" description="Next inspection due date passed" to="#overdue-queue" />
    <KpiCard label="Due ≤30d" :value="fmtNum(dueSoonCount)" :unavailable="loading || !!error" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Inspections feed unavailable'" period="30D" description="Next inspection approaching" />
    <KpiCard label="Active Centres" :value="fmtNum(byCentre.length)" :unavailable="loading || !!error" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Inspections feed unavailable'" period="LIVE" description="Distinct inspection centres" to="#inspections-by-centre" />
    <KpiCard label="Active Inspectors" :value="fmtNum(byInspector.length)" :unavailable="loading || !!error" :unavailable-note="loading ? 'Loading…' : 'NTSA Fleet Inspections feed unavailable'" period="LIVE" description="Distinct inspectors on file" />
  </div>

  <!-- Analytics -->
  <SectionTitle pill="Computed · Rolling">Inspections by Centre</SectionTitle>
  <div id="inspections-by-centre" class="card drill-target">
    <div class="card-body">
      <div v-if="byCentre.length" class="bar-list bar-list-wide">
        <div v-for="c in byCentre" :key="c.centre" class="bar-row bar-row-wide">
          <span class="bar-label">{{ c.centre }}</span>
          <div class="bar-wrap"><div class="bar-fill" :style="{ transform: `scaleX(${maxCentre > 0 ? c.count / maxCentre : 0})` }" /></div>
          <span class="bar-val">{{ c.count }} · {{ c.passRate.toFixed(0) }}% pass</span>
        </div>
      </div>
      <div v-else style="font-size:13px;color:var(--fg-3)">{{ loading ? 'Loading…' : 'No inspection records.' }}</div>
    </div>
  </div>

  <!-- Overdue queue -->
  <SectionTitle pill="Computed · Rolling">Overdue Inspections</SectionTitle>
  <div id="overdue-queue" class="card drill-target">
    <div class="card-body">
      <div v-if="overdue.length">
        <AlertItem
          v-for="i in overdue.slice(0, 20)" :key="i.id"
          :severity="i.result === 'fail' ? 'critical' : 'warning'"
          :title="`${i.plate_number} - inspection overdue`"
          :meta="`Due ${fmtDate(i.next_inspection_due)} · Last result ${i.result} · ${i.inspection_centre}`"
        />
      </div>
      <EmptyState v-else :loading="loading" message="No overdue inspections in the loaded registry." icon="search" compact />
    </div>
  </div>

  <!-- Registry -->
  <SectionTitle pill="NTSA Fleet Inspections · Rolling">Inspection Registry</SectionTitle>
  <div id="inspection-registry" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="search" class="select-sm" placeholder="Search plate / centre / inspector…" style="min-width:200px" @keyup.enter="load" />
        <select v-model="resultFilter" class="select-sm">
          <option value="">All results</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
          <option value="conditional_pass">Conditional pass</option>
        </select>
        <label class="checkbox-label">
          <input v-model="reinspectionOnly" type="checkbox" />
          Re-inspections only
        </label>
        <button class="btn" @click="load">Apply</button>
        <button class="btn" @click="clearFilters">Clear</button>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Vehicle</th>
              <th>Centre</th>
              <th>Inspector</th>
              <th>Inspected</th>
              <th>Result</th>
              <th>Sticker No.</th>
              <th>Next Due</th>
              <th>Re-inspection</th>
              <th>Report</th>
            </tr>
          </thead>
          <tbody v-if="filteredInspections.length">
            <template v-for="i in inspectionsPageRows" :key="i.id">
              <tr class="insp-row" @click="toggleExpand(i)">
                <td class="expand-cell">{{ expandedId === i.id ? '▾' : '▸' }}</td>
                <td style="font-weight:700;font-family:monospace">{{ i.plate_number }}</td>
                <td style="font-size:12px">{{ i.inspection_centre }}</td>
                <td style="font-size:12px">{{ i.inspector_name || '-' }}</td>
                <td style="font-size:11px">{{ fmtDate(i.inspected_at) }}</td>
                <td><BadgePill :variant="resultBadge(i.result)">{{ i.result.replace(/_/g,' ') }}</BadgePill></td>
                <td style="font-family:monospace;font-size:11px">{{ i.sticker_no || '-' }}</td>
                <td style="font-size:11px">
                  <span :style="{ color: isOverdue(i.next_inspection_due) ? 'var(--danger-fg)' : 'inherit' }">{{ fmtDate(i.next_inspection_due) }}</span>
                </td>
                <td style="text-align:center">{{ i.is_reinspection ? '✓' : '-' }}</td>
                <td>
                  <a v-if="i.report_url" :href="i.report_url" target="_blank" rel="noopener" class="link-sm" @click.stop>View →</a>
                  <span v-else style="color:var(--fg-3);font-size:11px">-</span>
                </td>
              </tr>
              <tr v-if="expandedId === i.id" class="insp-detail-row">
                <td :colspan="10">
                  <div class="dd-title">Re-inspection Chain</div>
                  <div v-if="reinspectionCache[i.id]?.length" class="dd-list">
                    <div v-for="r in reinspectionCache[i.id]" :key="r.id" class="dd-item">
                      <BadgePill :variant="resultBadge(r.result)">{{ r.result.replace(/_/g,' ') }}</BadgePill>
                      <span>{{ fmtDate(r.inspected_at) }} · {{ r.inspection_centre }} · {{ r.inspector_name || '-' }}</span>
                    </div>
                  </div>
                  <div v-else class="dd-empty">{{ reinspectionLoaded[i.id] ? 'No follow-up re-inspections on file.' : 'Loading…' }}</div>
                </td>
              </tr>
            </template>
          </tbody>
          <tbody v-else>
            <tr>
              <td colspan="10" style="text-align:center;color:var(--fg-3);padding:16px">
                {{ loading ? 'Loading inspections…' : 'No inspection records match the current filters.' }}
              </td>
            </tr>
          </tbody>
        </table>
        <TablePagination
          :page="inspectionsPage" :total-pages="inspectionsTotalPages" :total="inspectionsTotal"
          @prev="inspectionsPrev" @next="inspectionsNext"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useVehicleInspections } from '~/composables/api'
import type { VehicleInspection } from '~/composables/api'

const inspections = ref<VehicleInspection[]>([])
const loading      = ref(true)
const error        = ref<string | null>(null)

const search           = ref('')
const resultFilter     = ref('')
const reinspectionOnly = ref(false)
const expandedId       = ref<string | null>(null)

const reinspectionCache  = reactive<Record<string, VehicleInspection[]>>({})
const reinspectionLoaded = reactive<Record<string, boolean>>({})

async function load() {
  loading.value = true
  error.value = null
  const vi = useVehicleInspections()

  // Note: the backend endpoint has no full-text search param (search=
  // is a silent no-op there - see useVehicleInspections.ts), so the
  // search box below filters the loaded page client-side instead.
  const res = await vi.list({ page_size: 100 }).catch(() => null)
  if (res) {
    inspections.value = (res as any).results ?? []
  } else {
    error.value = 'Unable to reach the UAPTS Fleet Vehicle Inspections API.'
  }

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

function clearFilters() {
  search.value = ''; resultFilter.value = ''; reinspectionOnly.value = false
  load()
}

async function toggleExpand(i: VehicleInspection) {
  if (expandedId.value === i.id) { expandedId.value = null; return }
  expandedId.value = i.id
  if (reinspectionLoaded[i.id]) return
  const vi = useVehicleInspections()
  const res = await vi.reinspections(i.id).catch(() => null)
  reinspectionCache[i.id] = res ? (Array.isArray(res) ? res : (res as any).results ?? []) : []
  reinspectionLoaded[i.id] = true
}

// ── Filters ──────────────────────────────────────────────────────────────
const filteredInspections = computed(() => inspections.value.filter(i => {
  if (resultFilter.value && i.result !== resultFilter.value) return false
  if (reinspectionOnly.value && !i.is_reinspection) return false
  if (search.value) {
    const q = search.value.toLowerCase()
    const hay = `${i.plate_number} ${i.inspection_centre} ${i.inspector_name ?? ''}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}))

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: inspectionsPageRows, page: inspectionsPage, totalPages: inspectionsTotalPages,
  total: inspectionsTotal, next: inspectionsNext, prev: inspectionsPrev,
} = usePagination(filteredInspections, 15)

// ── KPIs / analytics (all computed client-side from real loaded records) ─
function countByResult(r: string) { return inspections.value.filter(i => i.result === r).length }
const reinspectionCount = computed(() => inspections.value.filter(i => i.is_reinspection).length)
const passRate = computed(() => {
  const pass = countByResult('pass'), fail = countByResult('fail')
  return pass + fail > 0 ? (pass / (pass + fail)) * 100 : null
})

function isOverdue(due: string | null | undefined) {
  return !!due && new Date(due).getTime() < Date.now()
}
function isDueSoon(due: string | null | undefined) {
  if (!due) return false
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000)
  return days >= 0 && days <= 30
}
const overdue = computed(() => inspections.value.filter(i => isOverdue(i.next_inspection_due)))
const overdueCount = computed(() => overdue.value.length)
const dueSoonCount = computed(() => inspections.value.filter(i => isDueSoon(i.next_inspection_due)).length)

const byCentre = computed(() => {
  const m = new Map<string, { centre: string; count: number; pass: number }>()
  for (const i of inspections.value) {
    const ex = m.get(i.inspection_centre) ?? { centre: i.inspection_centre, count: 0, pass: 0 }
    ex.count++
    if (i.result === 'pass') ex.pass++
    m.set(i.inspection_centre, ex)
  }
  return [...m.values()].map(c => ({ ...c, passRate: c.count ? (c.pass / c.count) * 100 : 0 })).sort((a, b) => b.count - a.count)
})
const maxCentre = computed(() => Math.max(1, ...byCentre.value.map(c => c.count)))

const byInspector = computed(() => {
  const m = new Map<string, number>()
  for (const i of inspections.value) {
    if (!i.inspector_name) continue
    m.set(i.inspector_name, (m.get(i.inspector_name) ?? 0) + 1)
  }
  return [...m.entries()].map(([inspector, count]) => ({ inspector, count })).sort((a, b) => b.count - a.count)
})

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'2-digit' }) }
  catch { return s }
}
function resultBadge(r: string) {
  const m: Record<string,string> = { pass:'success', fail:'danger', conditional_pass:'warning' }
  return m[r] ?? 'neutral'
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.checkbox-label { display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; }
.table-scroll { overflow-x:auto; }
.bar-list { display:flex; flex-direction:column; gap:8px; }
.bar-row { display:grid; grid-template-columns:140px 1fr 90px; align-items:center; gap:8px; }
.bar-label { font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-wrap { background:var(--surface-sunken); border-radius:4px; height:10px; overflow:hidden; }
.bar-fill { height:100%; width:100%; background:var(--primary-fill); border-radius:4px; transform-origin:left; transition:transform .4s; }
.bar-val { font-size:11px; text-align:right; }
.bar-list-wide { gap:12px; }
.bar-row-wide { grid-template-columns:240px 1fr 130px; gap:14px; }
.bar-row-wide .bar-label { font-size:13px; font-weight:600; overflow:visible; white-space:normal; }
.bar-row-wide .bar-wrap { height:16px; }
.bar-row-wide .bar-val { font-size:12.5px; font-weight:600; }
.insp-row { cursor:pointer; }
.expand-cell { width:18px; color:var(--fg-3); font-size:11px; }
.insp-detail-row td { background:var(--surface-1); padding:12px 18px; border-bottom:1px solid var(--border-subtle); }
.dd-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--fg-2); margin-bottom:8px; }
.dd-list { display:flex; flex-direction:column; gap:6px; }
.dd-item { display:flex; align-items:center; gap:8px; font-size:12px; }
.dd-empty { font-size:12px; color:var(--fg-3); }
.link-sm { font-size:11px; color:var(--link); text-decoration:none; }
</style>
