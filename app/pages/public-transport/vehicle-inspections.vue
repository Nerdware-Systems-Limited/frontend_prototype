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
    <KpiCard label="Inspections (loaded)" :value="fmtNum(inspections.length)" sub="Most recent records" source="live" source-title="NTSA Fleet Inspections" />
    <KpiCard label="Passed" :value="fmtNum(countByResult('pass'))" sub="Result: pass" trend-direction="up" source="live" source-title="NTSA Fleet Inspections" />
    <KpiCard label="Failed" :value="fmtNum(countByResult('fail'))" sub="Result: fail" trend-direction="down" source="live" source-title="NTSA Fleet Inspections" />
    <KpiCard label="Conditional Pass" :value="fmtNum(countByResult('conditional_pass'))" sub="Passed with conditions" source="live" source-title="NTSA Fleet Inspections" />
    <KpiCard label="Pass Rate" :value="passRate != null ? `${passRate.toFixed(1)}%` : '-'" sub="Pass / (pass + fail)" :trend-direction="(passRate ?? 0) >= 80 ? 'up' : 'down'" source="live" source-title="NTSA Fleet Inspections" />
    <KpiCard label="Re-inspections" :value="fmtNum(reinspectionCount)" sub="Follow-up records" source="live" source-title="NTSA Fleet Inspections" />
    <KpiCard label="Overdue" :value="fmtNum(overdueCount)" sub="Next inspection due date passed" trend-direction="down" source="live" source-title="NTSA Fleet Inspections" />
    <KpiCard label="Due ≤30d" :value="fmtNum(dueSoonCount)" sub="Next inspection approaching" source="live" source-title="NTSA Fleet Inspections" />
    <KpiCard label="Active Centres" :value="fmtNum(byCentre.length)" sub="Distinct inspection centres" source="live" source-title="NTSA Fleet Inspections" />
    <KpiCard label="Active Inspectors" :value="fmtNum(byInspector.length)" sub="Distinct inspectors on file" source="live" source-title="NTSA Fleet Inspections" />
  </div>

  <!-- Analytics -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">Inspections by Centre</div>
      <div class="card-body">
        <div v-if="byCentre.length" class="bar-list">
          <div v-for="c in byCentre" :key="c.centre" class="bar-row">
            <span class="bar-label">{{ c.centre }}</span>
            <div class="bar-wrap"><div class="bar-fill" :style="{ width: `${maxCentre > 0 ? (c.count / maxCentre) * 100 : 0}%` }" /></div>
            <span class="bar-val">{{ c.count }} · {{ c.passRate.toFixed(0) }}% pass</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:#94a3b8">{{ loading ? 'Loading…' : 'No inspection records.' }}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">Inspector Workload</div>
      <div class="card-body">
        <div v-if="byInspector.length" class="bar-list">
          <div v-for="i in byInspector" :key="i.inspector" class="bar-row">
            <span class="bar-label">{{ i.inspector }}</span>
            <div class="bar-wrap"><div class="bar-fill" style="background:#8b5cf6" :style="{ width: `${maxInspector > 0 ? (i.count / maxInspector) * 100 : 0}%` }" /></div>
            <span class="bar-val">{{ i.count }}</span>
          </div>
        </div>
        <div v-else style="font-size:13px;color:#94a3b8">{{ loading ? 'Loading…' : 'No inspector data.' }}</div>
      </div>
    </div>
  </div>

  <!-- Overdue queue -->
  <SectionTitle pill="Computed · Rolling">Overdue Inspections</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div v-if="overdue.length">
        <AlertItem
          v-for="i in overdue.slice(0, 20)" :key="i.id"
          :severity="i.result === 'fail' ? 'critical' : 'warning'"
          :title="`${i.plate_number} - inspection overdue`"
          :meta="`Due ${fmtDate(i.next_inspection_due)} · Last result ${i.result} · ${i.inspection_centre}`"
        />
      </div>
      <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No overdue inspections in the loaded registry.' }}</div>
    </div>
  </div>

  <!-- Registry -->
  <SectionTitle pill="NTSA Fleet Inspections · Rolling">Inspection Registry</SectionTitle>
  <div class="card">
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
            <template v-for="i in filteredInspections" :key="i.id">
              <tr class="insp-row" @click="toggleExpand(i)">
                <td class="expand-cell">{{ expandedId === i.id ? '▾' : '▸' }}</td>
                <td style="font-weight:700;font-family:monospace">{{ i.plate_number }}</td>
                <td style="font-size:12px">{{ i.inspection_centre }}</td>
                <td style="font-size:12px">{{ i.inspector_name || '-' }}</td>
                <td style="font-size:11px">{{ fmtDate(i.inspected_at) }}</td>
                <td><BadgePill :variant="resultBadge(i.result)">{{ i.result.replace(/_/g,' ') }}</BadgePill></td>
                <td style="font-family:monospace;font-size:11px">{{ i.sticker_no || '-' }}</td>
                <td style="font-size:11px">
                  <span :style="{ color: isOverdue(i.next_inspection_due) ? '#ef4444' : 'inherit' }">{{ fmtDate(i.next_inspection_due) }}</span>
                </td>
                <td style="text-align:center">{{ i.is_reinspection ? '✓' : '-' }}</td>
                <td>
                  <a v-if="i.report_url" :href="i.report_url" target="_blank" rel="noopener" class="link-sm" @click.stop>View →</a>
                  <span v-else style="color:#94a3b8;font-size:11px">-</span>
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
              <td colspan="10" style="text-align:center;color:#94a3b8;padding:16px">
                {{ loading ? 'Loading inspections…' : 'No inspection records match the current filters.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Vehicle Inspections')

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

  const res = await vi.list({ page_size: 100, search: search.value || undefined }).catch(() => null)
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
  return true
}))

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
const maxInspector = computed(() => Math.max(1, ...byInspector.value.map(i => i.count)))

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
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.checkbox-label { display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; }
.table-scroll { overflow-x:auto; }
.bar-list { display:flex; flex-direction:column; gap:8px; }
.bar-row { display:grid; grid-template-columns:140px 1fr 90px; align-items:center; gap:8px; }
.bar-label { font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.bar-fill { height:100%; background:#3b82f6; border-radius:4px; transition:width .4s; }
.bar-val { font-size:11px; text-align:right; }
.insp-row { cursor:pointer; }
.expand-cell { width:18px; color:#94a3b8; font-size:11px; }
.insp-detail-row td { background:#fafbfc; padding:12px 18px; border-bottom:1px solid #f1f5f9; }
.dd-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#64748b; margin-bottom:8px; }
.dd-list { display:flex; flex-direction:column; gap:6px; }
.dd-item { display:flex; align-items:center; gap:8px; font-size:12px; }
.dd-empty { font-size:12px; color:#94a3b8; }
.link-sm { font-size:11px; color:#3b82f6; text-decoration:none; }
</style>
