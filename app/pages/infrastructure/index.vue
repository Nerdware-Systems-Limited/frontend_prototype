<template>
  <PageHeader
    eyebrow="Road Infrastructure"
    title="Road Network Inventory"
    subtitle="KeNHA · KURA · KeRRA · KRB · LAPSSET - Per-agency network inventory, pavement quality (IRI/PCI), and AI deterioration forecasts"
  >
    <template #actions>
      <NuxtLink :to="agencyLink('/infrastructure/bridges')" class="btn">Bridges & Assets →</NuxtLink>
      <NuxtLink :to="agencyLink('/infrastructure/funding')" class="btn-primary">Funding →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Agency tabs -->
  <div class="agency-tabs">
    <button class="agency-tab" :class="{ active: selectedAgency === '' }" @click="selectAgency('')">
      All Agencies
      <span class="agency-tab-count">{{ summary ? fmtNum(summary.network.total_segments) : fmtNum(segments.length) }}</span>
    </button>
    <button
      v-for="a in agencyOptions" :key="a.code"
      class="agency-tab" :class="{ active: selectedAgency === a.code }"
      @click="selectAgency(a.code)"
      title="Approximate - based on a sample, not a full per-agency count"
    >
      {{ a.name }}
      <span class="agency-tab-count">~{{ fmtNum(a.count) }}</span>
    </button>
  </div>

  <!-- KPI ribbon (agency-aware, computed client-side from loaded segments) -->
  <SectionTitle :pill="agencyLabel + ' · ' + (summary ? freshnessLabel(summary.generated_at) : 'Batch')">
    Network KPIs
  </SectionTitle>

  <div class="kpi-grid">
    <KpiCard
      label="Network Length"
      :value="`${fmtNum(stats.totalLength, 0)} km`"
      :sub="stats.usingAggregate ? `${segmentsLabel} · network-wide` : `${segmentsLabel} · estimated`"
      :source="stats.usingAggregate ? 'live' : 'batch'" source-title="Agency Survey"
    />
    <KpiCard
      label="Asset Count"
      :value="fmtNum(stats.assetCount)"
      :sub="stats.usingAggregate ? 'Segments + bridges + streetlights · network-wide' : 'Segments + bridges + streetlights · estimated'"
      :source="stats.usingAggregate ? 'live' : 'batch'" source-title="Agency Survey"
    />
    <KpiCard
      label="Avg IRI"
      :value="stats.avgIri != null ? stats.avgIri.toFixed(2) : '-'"
      :sub="stats.usingAggregate ? 'IRI (m/km) · network-wide average' : 'IRI (m/km) · estimated'"
      :trend-direction="stats.avgIri != null && stats.avgIri <= 4 ? 'up' : 'down'"
      :source="stats.usingAggregate ? 'live' : 'batch'" source-title="Agency Survey"
    />
    <KpiCard
      label="Avg PCI"
      :value="stats.avgPci != null ? stats.avgPci.toFixed(1) : '-'"
      :sub="stats.usingAggregate ? 'PCI (0–100) · network-wide average' : 'PCI (0–100) · estimated'"
      :trend-direction="stats.avgPci != null && stats.avgPci >= 70 ? 'up' : 'down'"
      :source="stats.usingAggregate ? 'live' : 'batch'" source-title="Agency Survey"
    />
    <KpiCard
      label="Data Completeness"
      :value="stats.completenessPct != null ? `${stats.completenessPct.toFixed(0)}%` : '-'"
      sub="IRI + PCI recorded · estimated"
      :trend-direction="stats.completenessPct != null && stats.completenessPct >= 80 ? 'up' : 'down'"
      source="batch" source-title="Agency Survey"
    />
    <KpiCard
      label="Latest Survey"
      :value="stats.latestSurvey ? fmtDate(stats.latestSurvey) : '-'"
      :sub="`Source: ${agencyLabel}`"
      source="batch" source-title="Agency Survey"
    />
  </div>
  <div v-if="!stats.usingAggregate" class="sample-caveat">
    Network Length/IRI/PCI/Condition are only exact when "All Agencies" is selected - no per-agency aggregate exists on the backend, so {{ agencyLabel }}'s figures above are estimated from loaded records.
  </div>

  <!-- Class / surface / condition distribution -->
  <div class="three-col">
    <div class="card">
      <div class="card-header">Road Class Distribution</div>
      <div v-if="stats.isSample" class="dist-caveat">Estimated - no network-wide breakdown exists for this metric.</div>
      <div class="card-body">
        <div v-if="stats.byClass.length" class="dist-list">
          <div v-for="d in stats.byClass" :key="d.key" class="dist-row">
            <span class="dist-label">{{ d.key.replace(/_/g,' ') }}</span>
            <div class="dist-bar-wrap"><div class="dist-bar" style="background:#3b82f6" :style="{ width: `${stats.segmentCount > 0 ? (d.count / stats.segmentCount) * 100 : 0}%` }" /></div>
            <span class="dist-val">{{ d.count }}</span>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Surface Type Distribution</div>
      <div v-if="stats.isSample" class="dist-caveat">Estimated - no network-wide breakdown exists for this metric.</div>
      <div class="card-body">
        <div v-if="stats.bySurface.length" class="dist-list">
          <div v-for="d in stats.bySurface" :key="d.key" class="dist-row">
            <span class="dist-label">{{ d.key }}</span>
            <div class="dist-bar-wrap"><div class="dist-bar" style="background:#8b5cf6" :style="{ width: `${stats.segmentCount > 0 ? (d.count / stats.segmentCount) * 100 : 0}%` }" /></div>
            <span class="dist-val">{{ d.count }}</span>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Condition Distribution</div>
      <div v-if="!stats.usingAggregate" class="dist-caveat">Estimated - no per-agency breakdown exists on the backend.</div>
      <div class="card-body">
        <div v-if="stats.byCondition.length" class="dist-list">
          <div v-for="d in stats.byCondition" :key="d.key" class="dist-row">
            <span class="dist-label">{{ d.key }}</span>
            <div class="dist-bar-wrap"><div class="dist-bar" :style="{ width: `${stats.conditionBase > 0 ? (d.count / stats.conditionBase) * 100 : 0}%`, background: condColor(d.key) }" /></div>
            <span class="dist-val">{{ fmtNum(d.count) }}</span>
          </div>
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No data' }}</div>
      </div>
    </div>
  </div>

  <!-- Condition map -->
  <div class="two-col-map">
    <div class="card map-card">
      <div class="card-header">Road Network Map ({{ agencyLabel }})</div>
      <ClientOnly>
        <UaptsMap
          :markers="segmentMarkers"
          :roads="roadsGeo"
          :center="[-1.286, 36.817]"
          :zoom="7"
          height="440px"
          show-legend
        />
      </ClientOnly>
      <div class="map-key">
        <span class="mk"><span class="dot" style="background:#22c55e" /> Good</span>
        <span class="mk"><span class="dot" style="background:#84cc16" /> Fair</span>
        <span class="mk"><span class="dot" style="background:#f59e0b" /> Poor</span>
        <span class="mk"><span class="dot" style="background:#ef4444" /> Critical</span>
        <span class="mk"><span class="dot" style="background:#7f1d1d" /> Failed</span>
      </div>
      <div v-if="!segmentMarkers.length" class="map-note">
        The road-segment registry does not yet return per-segment coordinates - showing the OSM road network as context. Condition-colored pins will appear automatically once the API adds segment geometry.
      </div>
    </div>

    <div class="right-col">
      <div v-if="agencyBudget" class="card">
        <div class="card-header">Maintenance Budget FY{{ agencyBudget.fiscal_year }} ({{ agencyLabel }})</div>
        <div class="card-body">
          <div class="budget-row"><span>Allocated</span><strong>KES {{ fmtKES(agencyBudget.allocated_kes) }}</strong></div>
          <div class="budget-row"><span>Disbursed</span><strong style="color:#22c55e">KES {{ fmtKES(agencyBudget.disbursed_kes) }}</strong></div>
          <div class="budget-row"><span>Committed</span><strong style="color:#f59e0b">KES {{ fmtKES(agencyBudget.committed_kes) }}</strong></div>
          <div class="budget-row"><span>Utilization</span><strong>{{ agencyBudget.utilization_pct.toFixed(1) }}%</strong></div>
          <div class="budget-bar-wrap" style="margin-top:8px"><div class="budget-bar" :style="{ width: `${agencyBudget.utilization_pct}%` }" /></div>
        </div>
      </div>

      <div v-if="summary" class="card" style="margin-top:12px">
        <div class="card-header">Weigh-in-Motion (30d, network-wide)</div>
        <div class="card-body">
          <div class="budget-row"><span>Total Passings</span><strong>{{ fmtNum(summary.wim.total_passings_30d) }}</strong></div>
          <div class="budget-row"><span>Overloads</span><strong style="color:#ef4444">{{ fmtNum(summary.wim.overloads_30d) }}</strong></div>
          <div class="budget-row">
            <span>Overload Rate</span>
            <strong :style="{ color: summary.wim.overload_rate_pct > 10 ? '#ef4444' : '#22c55e' }">{{ summary.wim.overload_rate_pct.toFixed(1) }}%</strong>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="card-header">Critical Bridges ({{ agencyLabel }})</div>
        <div class="card-body">
          <div class="budget-row"><span>Critical / Poor</span><strong style="color:#ef4444">{{ agencyCriticalBridges.length }}</strong></div>
          <div class="budget-row"><span>Overdue Inspections</span><strong style="color:#f59e0b">{{ agencyOverdueInspections }}</strong></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Inventory table -->
  <SectionTitle pill="Agency Survey · Rolling">Road Inventory ({{ agencyLabel }})</SectionTitle>

  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <input v-model="search" class="select-sm" placeholder="Search road name or code…" style="min-width:180px" />
        <select v-model="classFilter" class="select-sm">
          <option value="">All classifications</option>
          <option v-for="c in roadClasses" :key="c" :value="c">{{ c.replace(/_/g,' ') }}</option>
        </select>
        <select v-model="surfaceFilter" class="select-sm">
          <option value="">All surface types</option>
          <option v-for="s in surfaceTypes" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="conditionFilter" class="select-sm">
          <option value="">All conditions</option>
          <option value="very_good">Very Good</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
          <option value="very_poor">Very Poor</option>
          <option value="under_con">Under Construction</option>
        </select>
        <button class="btn" @click="clearTableFilters">Clear</button>
        <ExportButton filename="uapts-road-inventory.csv" :href="roadInventoryExportHref" style="margin-left:auto" />
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Agency</th>
              <th>Road Code</th>
              <th>Road Name</th>
              <th>Classification</th>
              <th>Length (km)</th>
              <th>Surface</th>
              <th>Lanes</th>
              <th>Bridges / Lights</th>
              <th>IRI</th>
              <th>PCI</th>
              <th>Condition</th>
              <th>Last Survey</th>
              <th>Geometry</th>
            </tr>
          </thead>
          <tbody v-if="tableSegments.length">
            <tr v-for="s in tableSegments" :key="s.id">
              <td><BadgePill variant="info">{{ s.agency_code ?? '-' }}</BadgePill></td>
              <td style="font-family:monospace;font-size:12px">{{ s.road_code }}</td>
              <td style="font-weight:600">{{ s.road_name }}</td>
              <td style="font-size:12px">{{ s.road_class.replace(/_/g,' ') }}</td>
              <td>{{ s.length_km.toFixed(1) }}</td>
              <td style="font-size:12px;text-transform:capitalize">{{ s.surface_type }}</td>
              <td>{{ s.lanes_count ?? '-' }}</td>
              <td style="font-size:12px">{{ s.bridge_count }} / {{ s.streetlight_count }}</td>
              <td>{{ s.iri_value != null ? s.iri_value.toFixed(2) : '-' }}</td>
              <td>{{ s.pci_value != null ? s.pci_value.toFixed(0) : '-' }}</td>
              <td><BadgePill :variant="condBadge(s.condition_class)">{{ s.condition_class }}</BadgePill></td>
              <td style="font-size:11px">{{ fmtDate(s.last_evaluated_at) }}</td>
              <td style="text-align:center">
                <span :style="{ color: onMapIds.has(s.id) ? '#22c55e' : '#94a3b8' }">{{ onMapIds.has(s.id) ? '✓' : '-' }}</span>
              </td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr>
              <td colspan="13" style="text-align:center;color:#94a3b8;padding:16px">
                {{ tableLoading ? 'Loading inventory…' : 'No road segments match the current filters.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <button class="btn" :disabled="tablePage <= 1 || tableLoading" @click="goToPage(tablePage - 1)">← Prev</button>
        <span class="page-info">Page {{ fmtNum(tablePage) }} of {{ fmtNum(tableTotalPages) }} · {{ fmtNum(tableTotal) }} segments</span>
        <button class="btn" :disabled="tablePage >= tableTotalPages || tableLoading" @click="goToPage(tablePage + 1)">Next →</button>
        <select v-model.number="tablePageSize" class="select-sm">
          <option :value="25">25 / page</option>
          <option :value="50">50 / page</option>
          <option :value="100">100 / page</option>
          <option :value="200">200 / page</option>
        </select>
      </div>
    </div>
  </div>

  <!-- Cross-agency data quality -->
  <SectionTitle pill="Cross-Agency · Computed">Data Quality Checks</SectionTitle>
  <div class="two-col">
    <div class="card">
      <div class="card-header">Duplicate Road Records ({{ qualityChecks.duplicates.length }})</div>
      <div class="card-body scroll-body">
        <div v-if="qualityChecks.duplicates.length">
          <AlertItem
            v-for="d in qualityChecks.duplicates" :key="d.road_code"
            severity="warning"
            :title="`Road code ${d.road_code} used ${d.count}×`"
            :meta="`Agencies: ${d.agencies.join(', ')}${d.inconsistentClass ? ' · classification mismatch' : ''}`"
          />
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No duplicate road codes detected.' }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Stale Survey Records ({{ qualityChecks.stale.length }})</div>
      <div class="card-body scroll-body">
        <div v-if="qualityChecks.stale.length">
          <AlertItem
            v-for="s in qualityChecks.stale.slice(0, 20)" :key="s.id"
            severity="info"
            :title="`${s.road_name} (${s.road_code})`"
            :meta="`${s.agency_code ?? '-'} · Last surveyed ${s.last_evaluated_at ? fmtDate(s.last_evaluated_at) : 'never'}`"
          />
        </div>
        <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'No stale survey records (>365d) detected.' }}</div>
      </div>
    </div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">Missing Geometry ({{ qualityChecks.missingGeometry.length }})</div>
    <div class="dist-caveat">Checked against a capped sample of the network's geometry records - segments outside that sample may be flagged here even if they do have coordinates.</div>
    <div class="card-body scroll-body">
      <table v-if="qualityChecks.missingGeometry.length">
        <thead><tr><th>Agency</th><th>Road Code</th><th>Road Name</th></tr></thead>
        <tbody>
          <tr v-for="s in qualityChecks.missingGeometry.slice(0, 30)" :key="s.id">
            <td style="font-size:12px">{{ s.agency_code ?? '-' }}</td>
            <td style="font-family:monospace;font-size:12px">{{ s.road_code }}</td>
            <td style="font-size:12px">{{ s.road_name }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else style="color:#94a3b8;font-size:13px">{{ loading ? 'Loading…' : 'All loaded segments are represented in the condition map.' }}</div>
    </div>
  </div>

  <!-- At-risk + signal faults - top-5 preview, full registry lives in Maintenance -->
  <div class="two-col">
    <div class="card">
      <div class="card-header">
        At-Risk Segments (Next 12mo)
        <NuxtLink :to="agencyLink('/infrastructure/maintenance')" class="link-sm">Full forecast list →</NuxtLink>
      </div>
      <div class="card-body">
        <table>
          <thead><tr><th>Road Code</th><th>Predicted Condition</th><th>Failure Prob.</th></tr></thead>
          <tbody v-if="topAtRisk.length">
            <tr v-for="f in topAtRisk" :key="f.id">
              <td style="font-weight:600;font-family:monospace;font-size:12px">{{ f.segment_road_code ?? f.segment }}</td>
              <td><BadgePill :variant="condBadge(f.predicted_condition_class ?? '')">{{ f.predicted_condition_class ?? '-' }}</BadgePill></td>
              <td>
                <span :style="{ color: failColor(f.failure_probability), fontWeight:'600' }">
                  {{ f.failure_probability != null ? `${(f.failure_probability * 100).toFixed(1)}%` : '-' }}
                </span>
              </td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No at-risk segments found.' }}</td></tr></tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        Traffic Signal Faults ({{ agencyLabel }})
        <NuxtLink :to="agencyLink('/infrastructure/maintenance')" class="link-sm">Full signal list →</NuxtLink>
      </div>
      <div class="card-body">
        <table>
          <thead><tr><th>Intersection</th><th>Status</th><th>Last Change</th></tr></thead>
          <tbody v-if="topSignalFaults.length">
            <tr v-for="sig in topSignalFaults" :key="sig.id">
              <td style="font-weight:600;font-size:13px">{{ sig.intersection_name }}</td>
              <td><BadgePill :variant="sigBadge(sig.status)">{{ sig.status }}</BadgePill></td>
              <td style="font-size:12px;white-space:nowrap">{{ fmtDate(sig.last_status_change_at) }}</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'No signal faults reported.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Road Network Inventory')

import { useInfrastructure, useGis, useAgencies } from '~/composables/api'
import type { InfrastructureSummary, DeteriorationForecast, TrafficSignal, RoadSegment, Bridge, MaintenanceBudget } from '~/composables/api'
import type { GeoJSONFeatureCollection } from '~/composables/api'

type MarkerSpec = { id: string; lat: number; lon: number; title?: string; subtitle?: string; color?: 'green'|'yellow'|'red'|'orange'|'blue'|'purple'|'gray'; size?: 'sm'|'md'|'lg' }

const route  = useRoute()
const router = useRouter()

const summary      = ref<InfrastructureSummary | null>(null)
// Currently displayed segments - the full unfiltered sample when no agency is
// selected, or a fresh server-side `agency=`-filtered fetch once one is picked.
const segments      = ref<RoadSegment[]>([])
// Real row count for the current scope (from the API's `count` field) - the
// road-segments table has 588k+ rows, so `segments.value.length` is only ever
// a sample, never the true total.
const segmentsTotal = ref(0)
// Small unfiltered baseline sample - independent of the selected tab, used to
// populate the agency tab list, the class/surface filter dropdowns, and the
// cross-agency data-quality checks (which must not be scoped to one agency).
const allAgencySample = ref<RoadSegment[]>([])
const bridges      = ref<Bridge[]>([])
const budgets      = ref<MaintenanceBudget[]>([])
const onMapIds     = ref<Set<string>>(new Set())
const atRisk       = ref<DeteriorationForecast[]>([])
const signalFaults = ref<TrafficSignal[]>([])
const agencyNames  = ref<Record<string, string>>({})
const roadsGeo     = ref<GeoJSONFeatureCollection | null>(null)
const loading      = ref(true)
const error        = ref<string | null>(null)

const selectedAgency = ref(typeof route.query.agency === 'string' ? route.query.agency : '')
const search          = ref('')
const classFilter     = ref('')
const surfaceFilter   = ref('')
const conditionFilter = ref('')

function selectAgency(code: string) {
  selectedAgency.value = code
  router.replace({ query: { ...route.query, agency: code || undefined } })
}
function agencyLink(path: string) {
  return selectedAgency.value ? { path, query: { agency: selectedAgency.value } } : path
}
function clearTableFilters() {
  search.value = ''; classFilter.value = ''; surfaceFilter.value = ''; conditionFilter.value = ''
  tablePage.value = 1
  loadTablePage()
}

async function load() {
  loading.value = true
  error.value = null
  const infra = useInfrastructure()
  const gis   = useGis()
  const agenciesApi = useAgencies()

  const [sumRes, sampleRes, bridgeRes, budgetRes, riskRes, sigRes, roadsRes, agencyRes] = await Promise.allSettled([
    infra.summary(),
    infra.segments({ page_size: 300 }),
    infra.bridges({ page_size: 200 }),
    infra.budgets({ page_size: 50 }),
    infra.atRiskForecasts(),
    infra.signalFaults(),
    gis.roads({ limit: 500, simplify: 0.02 }),
    agenciesApi.list({ page_size: 50 }),
  ])

  if (sumRes.status === 'fulfilled') summary.value = sumRes.value
  if (sampleRes.status === 'fulfilled') {
    allAgencySample.value = (sampleRes.value as any).results ?? []
    if (!selectedAgency.value) {
      segments.value = allAgencySample.value
      segmentsTotal.value = (sampleRes.value as any).count ?? summary.value?.network.total_segments ?? segments.value.length
    }
  }
  if (bridgeRes.status === 'fulfilled') bridges.value  = (bridgeRes.value as any).results ?? []
  if (budgetRes.status === 'fulfilled') budgets.value  = (budgetRes.value as any).results ?? []
  if (riskRes.status === 'fulfilled') atRisk.value       = (riskRes.value as any).results ?? []
  if (sigRes.status  === 'fulfilled') signalFaults.value = (sigRes.value as any).results ?? []
  if (roadsRes.status === 'fulfilled') roadsGeo.value    = roadsRes.value
  if (agencyRes.status === 'fulfilled') {
    const list = (agencyRes.value as any).results ?? []
    agencyNames.value = Object.fromEntries(list.map((a: any) => [a.agency_code, a.agency_name]))
  }

  // Re-apply the selected agency's own server-filtered fetch (e.g. deep link
  // landed on ?agency=KeNHA) - the unfiltered sample above may contain zero
  // rows for it, so it must never be derived by client-filtering that sample.
  if (selectedAgency.value) await loadAgencySegments(selectedAgency.value)

  if ([sumRes, sampleRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Infrastructure API.'

  loading.value = false
}

async function loadAgencySegments(code: string) {
  const infra = useInfrastructure()
  try {
    const res = await infra.segments({ agency_code: code, page_size: 300 }) as any
    segments.value = res.results ?? []
    segmentsTotal.value = res.count ?? segments.value.length
  } catch {
    segments.value = []
    segmentsTotal.value = 0
  }
}

// condition-map has no documented way to cap or filter its response and the
// table it backs (588k+ rows) - fetch it once on load rather than on every
// 120s refresh tick, and pass a defensive page_size in case the server does
// happen to honor it.
async function loadConditionMap() {
  const infra = useInfrastructure()
  try {
    const res = await infra.segmentConditionMap({ page_size: 500 }) as any
    onMapIds.value = new Set((res.results ?? []).map((r: any) => r.id))
  } catch { /* leave onMapIds as-is */ }
}

watch(selectedAgency, async (code) => {
  loading.value = true
  if (code) await loadAgencySegments(code)
  else {
    segments.value = allAgencySample.value
    segmentsTotal.value = summary.value?.network.total_segments ?? allAgencySample.value.length
  }
  loading.value = false
  tablePage.value = 1
  loadTablePage()
})

onMounted(load)
onMounted(loadConditionMap)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Agency tabs ──────────────────────────────────────────────────────────
// Derived from the unfiltered baseline sample, not the currently displayed
// (possibly agency-scoped) `segments` - so the tab list itself doesn't
// collapse to one agency once a tab is selected. Counts are therefore only
// approximate (a sample of 300 out of 588k+ rows), never a true per-agency
// total - there's no backend endpoint for that.
const agencyOptions = computed(() => {
  const m = new Map<string, number>()
  for (const s of allAgencySample.value) {
    if (!s.agency_code) continue
    m.set(s.agency_code, (m.get(s.agency_code) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([code, count]) => ({ code, count, name: agencyNames.value[code] ?? code }))
    .sort((a, b) => a.code.localeCompare(b.code))
})
const agencyLabel = computed(() => selectedAgency.value ? (agencyNames.value[selectedAgency.value] ?? selectedAgency.value) : 'All Agencies')

// ── Agency-scoped datasets ───────────────────────────────────────────────
// `segments` is already agency-scoped (server-side `agency=` filter) once a
// tab is selected - see loadAgencySegments() - so no client-side filter step
// is needed here.
const agencyCriticalBridges = computed(() =>
  bridges.value.filter(b => (!selectedAgency.value || b.agency_code === selectedAgency.value) && ['poor', 'critical'].includes(b.condition_class)),
)
const agencyOverdueInspections = computed(() =>
  bridges.value.filter(b => (!selectedAgency.value || b.agency_code === selectedAgency.value) && b.next_inspection_at && new Date(b.next_inspection_at).getTime() < Date.now()).length,
)
const agencySignalFaults = computed(() =>
  signalFaults.value.filter(s => !selectedAgency.value || s.agency_code === selectedAgency.value),
)
const topAtRisk = computed(() =>
  [...atRisk.value].sort((a, b) => (b.failure_probability ?? 0) - (a.failure_probability ?? 0)).slice(0, 5),
)
const topSignalFaults = computed(() =>
  [...agencySignalFaults.value].sort((a, b) => (a.status === 'faulty' ? -1 : 1) - (b.status === 'faulty' ? -1 : 1)).slice(0, 5),
)
const agencyBudget = computed(() => {
  const pool = budgets.value.filter(b => !selectedAgency.value || b.agency_code === selectedAgency.value)
  if (!pool.length) return null
  return pool.reduce((latest, b) => !latest || b.fiscal_year > latest.fiscal_year ? b : latest, null as MaintenanceBudget | null)
})

// ── Network / per-agency stats panel ─────────────────────────────────────
// All-Agencies view: Network Length, Avg IRI/PCI, Asset Count and Condition
// Distribution come from the real server-side aggregate (summary.network) -
// exact, not a sample. There is no per-agency equivalent endpoint, so once a
// specific agency is selected those same figures fall back to being computed
// from the (now server-filtered, but still page-capped) loaded segments, and
// are labelled as sample-based in the template via `isSample`/`totalSegmentsReal`.
// Class/Surface distribution and Data Completeness have no aggregate at all
// and are always sample-based, regardless of agency selection.
const stats = computed(() => {
  const list = segments.value
  const segmentCount = list.length
  const totalSegmentsReal = segmentsTotal.value || segmentCount
  const isSample = segmentCount < totalSegmentsReal

  const iriVals = list.filter(r => r.iri_value != null).map(r => r.iri_value as number)
  const pciVals = list.filter(r => r.pci_value != null).map(r => r.pci_value as number)
  const sampleAvgIri = iriVals.length ? iriVals.reduce((a, b) => a + b, 0) / iriVals.length : null
  const sampleAvgPci = pciVals.length ? pciVals.reduce((a, b) => a + b, 0) / pciVals.length : null
  const complete = list.filter(r => r.iri_value != null && r.pci_value != null).length
  const completenessPct = segmentCount ? (complete / segmentCount) * 100 : null
  const surveyDates = list.filter(r => r.last_evaluated_at).map(r => new Date(r.last_evaluated_at as string).getTime())
  const latestSurvey = surveyDates.length ? new Date(Math.max(...surveyDates)).toISOString() : null

  const byClass = countBy(list, r => r.road_class)
  const bySurface = countBy(list, r => r.surface_type)

  const net = !selectedAgency.value ? summary.value?.network ?? null : null
  const usingAggregate = !!net
  const totalLength = net ? net.total_length_km : list.reduce((s, r) => s + (r.length_km ?? 0), 0)
  const avgIri = net ? net.iri_average : sampleAvgIri
  const avgPci = net ? net.pci_average : sampleAvgPci
  const byCondition = net
    ? net.condition_distribution
        .map(c => ({ key: c.condition_class || 'unrecorded', count: c.total }))
        .sort((a, b) => b.count - a.count)
    : countBy(list, r => r.condition_class ?? 'unrecorded')
  const conditionBase = net ? net.total_segments : segmentCount
  const assetCount = net
    ? net.total_segments + (summary.value?.bridges.total ?? 0) + (summary.value?.streetlights.total ?? 0)
    : list.reduce((s, r) => s + 1 + (r.bridge_count ?? 0) + (r.streetlight_count ?? 0), 0)

  return {
    segmentCount, totalSegmentsReal, isSample, usingAggregate,
    totalLength, assetCount, avgIri, avgPci, completenessPct, latestSurvey,
    byClass, bySurface, byCondition, conditionBase,
  }
})

// Real total (from the API's `count` field), never a raw sample size - see stats().
const segmentsLabel = computed(() => `${fmtNum(stats.value.totalSegmentsReal)} segments`)

function countBy<T>(list: T[], keyFn: (t: T) => string) {
  const m = new Map<string, number>()
  for (const item of list) { const k = keyFn(item); m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}

// ── Inventory table (server-side paginated - the table is a real page of the
// 588k+ row dataset, not a client-filtered slice of a fixed sample) ────────
const roadClasses  = computed(() => [...new Set(allAgencySample.value.map(s => s.road_class))].sort())
const surfaceTypes = computed(() => [...new Set(allAgencySample.value.map(s => s.surface_type))].sort())

const tableSegments  = ref<RoadSegment[]>([])
const tableTotal     = ref(0)
const tablePage      = ref(1)
const tablePageSize  = ref(50)
const tableLoading   = ref(true)
const tableTotalPages = computed(() => Math.max(1, Math.ceil(tableTotal.value / tablePageSize.value)))

async function loadTablePage() {
  tableLoading.value = true
  const infra = useInfrastructure()
  try {
    const res = await infra.segments({
      agency_code: selectedAgency.value || undefined,
      page: tablePage.value,
      page_size: tablePageSize.value,
      search: search.value || undefined,
      road_class: classFilter.value || undefined,
      surface: surfaceFilter.value || undefined,
      condition: conditionFilter.value || undefined,
    }) as any
    tableSegments.value = res.results ?? []
    tableTotal.value = res.count ?? 0
  } catch {
    tableSegments.value = []
    tableTotal.value = 0
  }
  tableLoading.value = false
}
function goToPage(p: number) {
  if (p < 1 || p > tableTotalPages.value) return
  tablePage.value = p
  loadTablePage()
}
let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => { tablePage.value = 1; loadTablePage() }, 400)
})
watch([classFilter, surfaceFilter, conditionFilter, tablePageSize], () => {
  tablePage.value = 1
  loadTablePage()
})
onMounted(loadTablePage)

// Real server-side export (honors the same django-filter params as the list
// endpoint) - more complete than exporting only the currently-loaded page.
const roadInventoryExportHref = computed(() => {
  const q = new URLSearchParams({ format: 'csv' })
  if (selectedAgency.value) q.set('agency_code', selectedAgency.value)
  if (classFilter.value) q.set('road_class', classFilter.value)
  if (surfaceFilter.value) q.set('surface', surfaceFilter.value)
  if (conditionFilter.value) q.set('condition', conditionFilter.value)
  if (search.value) q.set('search', search.value)
  return `/api/v1/infrastructure/road-segments/export/?${q.toString()}`
})

// ── Cross-agency data quality (computed over the unfiltered baseline sample,
// independent of the selected agency tab) ────────────────────────────────
const qualityChecks = computed(() => {
  const byCode = new Map<string, RoadSegment[]>()
  for (const s of allAgencySample.value) {
    const arr = byCode.get(s.road_code) ?? []
    arr.push(s)
    byCode.set(s.road_code, arr)
  }
  const duplicates = [...byCode.entries()]
    .filter(([, arr]) => arr.length > 1)
    .map(([road_code, arr]) => ({
      road_code,
      count: arr.length,
      agencies: [...new Set(arr.map(a => a.agency_code ?? 'unknown'))],
      inconsistentClass: new Set(arr.map(a => a.road_class)).size > 1,
    }))

  const oneYearAgo = Date.now() - 365 * 86_400_000
  const stale = allAgencySample.value.filter(s => !s.last_evaluated_at || new Date(s.last_evaluated_at).getTime() < oneYearAgo)
  // onMapIds is itself a capped sample of the (588k+ row) condition-map
  // endpoint, so a segment missing from it isn't proof it lacks geometry -
  // only that it wasn't in the window we fetched. See the caveat in the template.
  const missingGeometry = allAgencySample.value.filter(s => !onMapIds.value.has(s.id))

  return { duplicates, stale, missingGeometry }
})

// ── Map markers (only plotted when the API returns real coordinates) ────
const segmentMarkers = computed((): MarkerSpec[] => {
  const raw = segments.value as any[]
  return raw
    .filter(s => s.latitude != null && s.longitude != null)
    .map(s => ({
      id: `seg-${s.id}`,
      lat: s.latitude,
      lon: s.longitude,
      title: `${s.road_name} (${s.road_code})`,
      subtitle: `${s.condition_class} · IRI ${s.iri_value ?? '-'} · PCI ${s.pci_value ?? '-'}`,
      color: (s.condition_class === 'good' || s.condition_class === 'very_good') ? 'green'
           : s.condition_class === 'fair' ? 'yellow'
           : s.condition_class === 'poor' ? 'orange'
           : s.condition_class === 'very_poor' ? 'red'
           : 'gray',
      size: 'sm',
    }))
})

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtKES(v: number | string | null | undefined) {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (n == null || isNaN(n)) return '-'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}k`
  return Math.round(n).toLocaleString()
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function freshnessLabel(iso: string | undefined) {
  if (!iso) return 'Live'
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    return mins < 2 ? 'Live' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`
  } catch { return 'Live' }
}
function condColor(cls: string): string {
  const m: Record<string,string> = { very_good:'#16a34a', good:'#22c55e', fair:'#84cc16', poor:'#f59e0b', very_poor:'#ef4444', under_con:'#94a3b8' }
  return m[cls] ?? '#94a3b8'
}
function condBadge(cls: string) {
  const m: Record<string,string> = { very_good:'success', good:'success', fair:'fair', poor:'warning', very_poor:'danger', under_con:'info' }
  return m[cls] ?? 'neutral'
}
function failColor(p: number | null | undefined) {
  if (p == null) return '#94a3b8'
  return p >= 0.7 ? '#ef4444' : p >= 0.4 ? '#f59e0b' : '#22c55e'
}
function sigBadge(s: string) {
  const m: Record<string,string> = { operational:'success', faulty:'danger', maintenance:'warning', offline:'neutral' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.sample-caveat { margin:-8px 0 16px; font-size:11.5px; color:#94a3b8; }
.dist-caveat { font-size:11px; color:#94a3b8; padding:0 14px 6px; margin-top:-4px; }
.agency-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px; }
.agency-tab { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:20px; border:1px solid #e2e8f0; background:#fff; font-size:12.5px; font-weight:600; color:#475569; cursor:pointer; transition:all .12s; }
.agency-tab:hover { border-color:#3b82f6; color:#3b82f6; }
.agency-tab.active { background:#3b82f6; border-color:#3b82f6; color:#fff; }
.agency-tab-count { font-size:11px; opacity:.75; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.three-col { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1100px) { .three-col { grid-template-columns:1fr; } }
.two-col-map { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col-map, .two-col { grid-template-columns:1fr; } }
.map-card { overflow:hidden; }
.map-key { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; padding:8px 14px; border-top:1px solid #f1f5f9; }
.map-note { font-size:11px; color:#94a3b8; padding:8px 14px; border-top:1px solid #f1f5f9; }
.mk { display:flex; align-items:center; gap:4px; }
.dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.right-col { display:flex; flex-direction:column; gap:0; overflow-y:auto; max-height:468px; }
.dist-list { display:flex; flex-direction:column; gap:8px; }
.dist-row { display:grid; grid-template-columns:90px 1fr 36px; align-items:center; gap:8px; }
.dist-label { font-size:12px; text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dist-bar-wrap { background:#f1f5f9; border-radius:4px; height:10px; overflow:hidden; }
.dist-bar { height:100%; border-radius:4px; transition:width .4s; }
.dist-val { font-size:11px; text-align:right; }
.budget-row { display:flex; justify-content:space-between; font-size:13px; padding:4px 0; border-bottom:1px solid #f8fafc; }
.budget-bar-wrap { background:#f1f5f9; border-radius:4px; height:8px; overflow:hidden; }
.budget-bar { height:100%; background:#3b82f6; border-radius:4px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
.pagination { display:flex; justify-content:center; align-items:center; gap:16px; padding-top:12px; border-top:1px solid #f1f5f9; margin-top:8px; }
.page-info { font-size:12.5px; color:#64748b; white-space:nowrap; }
.scroll-body { max-height:320px; overflow-y:auto; }
.link-sm { font-size:12px; color:#3b82f6; text-decoration:none; font-weight:600; }
.link-sm:hover { text-decoration:underline; }
</style>
