<template>
  <PageHeader
    eyebrow="Road Infrastructure"
    title="Road Infrastructure Status"
    subtitle="KeNHA · KURA · KeRRA · LAPSSET · KRB (funding) - Construction portfolio, maintenance work orders, asset status, and exceptions per agency"
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
      All Agencies <span class="agency-tab-count">{{ fmtNum(summary?.construction.total_projects ?? projects.length) }}</span>
    </button>
    <button
      v-for="a in agencyOptions" :key="a.code"
      class="agency-tab" :class="{ active: selectedAgency === a.code }"
      @click="selectAgency(a.code)"
    >
      {{ a.name }} <span class="agency-tab-count">{{ fmtNum(a.count) }}</span>
    </button>
    <button v-if="krbHasFundingOnly" class="agency-tab" :class="{ active: selectedAgency === 'KRB' }" @click="selectAgency('KRB')">
      KRB (funding source) <span class="agency-tab-count">{{ agencyBudgets('KRB').length }}</span>
    </button>
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Projects" :value="fmtNum(agencyProjects.length)"
      :unavailable="loading || projectsError" :unavailable-note="loading ? 'Loading…' : 'Agency PMU feed unavailable'"
      period="LIVE" :description="agencyLabel" to="#project-portfolio"
    />
    <KpiCard
      label="In Progress" :value="fmtNum(countByStatus('in_progress'))"
      :unavailable="loading || projectsError" :unavailable-note="loading ? 'Loading…' : 'Agency PMU feed unavailable'"
      period="LIVE" description="Active construction" to="#project-portfolio"
    />
    <KpiCard
      label="On Hold" :value="fmtNum(countByStatus('on_hold'))"
      :unavailable="loading || projectsError" :unavailable-note="loading ? 'Loading…' : 'Agency PMU feed unavailable'"
      period="LIVE" description="Suspended works"
      :status="loading || projectsError ? undefined : countByStatus('on_hold') > 0 ? 'warning' : 'healthy'"
      to="#project-portfolio"
    />
    <KpiCard
      label="Delayed Projects" :value="fmtNum(agencyDelayed.length)"
      :unavailable="loading || delayedError" :unavailable-note="loading ? 'Loading…' : 'Agency PMU feed unavailable'"
      period="LIVE" description="Behind planned schedule"
      :status="loading || delayedError ? undefined : agencyDelayed.length > 0 ? 'critical' : 'healthy'"
      to="#exceptions-delayed"
    />
    <KpiCard
      label="Total Contract Value" :value="totalContract ? `KES ${fmtKES(totalContract)}` : '-'"
      :unavailable="loading || projectsError" :unavailable-note="loading ? 'Loading…' : 'Agency PMU feed unavailable'"
      period="LIVE" :description="agencyLabel" to="#project-portfolio"
    />
    <KpiCard
      label="Total Disbursed" :value="totalDisbursed ? `KES ${fmtKES(totalDisbursed)}` : '-'"
      :unavailable="loading || projectsError" :unavailable-note="loading ? 'Loading…' : 'National Treasury feed unavailable'"
      period="LIVE" :description="totalContract ? `${((totalDisbursed / totalContract) * 100).toFixed(0)}% absorption` : ''"
      to="#project-portfolio"
    />
  </div>

  <!-- Exception panels -->
  <SectionTitle pill="Computed · Rolling">Exceptions</SectionTitle>
  <div class="two-col">
    <div id="exceptions-delayed" class="card drill-target">
      <div class="card-header">Delayed Projects ({{ agencyDelayed.length }})</div>
      <div class="card-body scroll-body">
        <div v-if="agencyDelayed.length">
          <AlertItem
            v-for="p in agencyDelayed" :key="p.id"
            severity="warning"
            :title="`${p.project_name} (${p.project_code})`"
            :meta="`${p.agency_code ?? '-'} · ${p.county} · Physical: ${p.physical_progress_pct ?? '-'}% · Planned end: ${fmtDate(p.planned_end)}`"
          />
        </div>
        <EmptyState v-else :loading="loading" message="No delayed projects found." icon="search" compact />
      </div>
    </div>

    <div class="card">
      <div class="card-header">Budget-vs-Progress Mismatch ({{ budgetProgressMismatch.length }})</div>
      <div class="card-body scroll-body">
        <div v-if="budgetProgressMismatch.length">
          <AlertItem
            v-for="p in budgetProgressMismatch" :key="p.id"
            severity="critical"
            :title="`${p.project_name} (${p.project_code})`"
            :meta="`Financial ${p.financial_progress_pct?.toFixed(0)}% vs physical ${p.physical_progress_pct?.toFixed(0)}% · ${p.contractor || 'contractor n/a'}`"
          />
        </div>
        <EmptyState v-else :loading="loading" message="No projects with financial progress significantly ahead of physical progress." icon="search" compact />
      </div>
    </div>
  </div>
  <div class="two-col">
    <div id="critical-assets" class="card drill-target">
      <div class="card-header">Critical Assets ({{ agencyCriticalBridges.length + agencySignalFaults.length }})</div>
      <div class="card-body scroll-body">
        <div v-if="agencyCriticalBridges.length || agencySignalFaults.length">
          <AlertItem v-for="b in agencyCriticalBridges" :key="'b-'+b.id" severity="critical" :title="`Bridge: ${b.bridge_name} (${b.bridge_code})`" :meta="`Condition ${b.condition_class} · score ${b.condition_score?.toFixed(0) ?? '-'}`" />
          <AlertItem v-for="s in agencySignalFaults" :key="'s-'+s.id" severity="warning" :title="`Signal: ${s.intersection_name}`" :meta="`${s.status} · ${s.agency_code ?? '-'}`" />
        </div>
        <EmptyState v-else :loading="loading" message="No critical assets flagged." icon="search" compact />
      </div>
    </div>

    <div class="card">
      <div class="card-header">Agency Data Freshness</div>
      <div class="card-body scroll-body">
        <div v-if="freshnessRows.length">
          <div v-for="r in freshnessRows" :key="r.agency" class="fresh-row">
            <span class="fresh-agency">{{ r.agency }}</span>
            <span :style="{ color: r.stale ? 'var(--danger-fg)' : 'var(--success-fg)' }">{{ r.lastUpdate ? fmtDate(r.lastUpdate) : 'no data' }}</span>
            <BadgePill :variant="r.stale ? 'danger' : 'success'">{{ r.stale ? 'stale (>30d)' : 'fresh' }}</BadgePill>
          </div>
        </div>
        <EmptyState v-else :loading="loading" message="No agency data loaded." compact />
      </div>
    </div>
  </div>

  <!-- Assets & closures -->
  <SectionTitle pill="Agency Systems · Rolling">Assets &amp; Closures ({{ agencyLabel }})</SectionTitle>
  <div class="kpi-grid">
    <KpiCard
      label="Overdue Bridge Inspections" :value="fmtNum(agencyOverdueInspections)"
      :unavailable="loading || bridgesError" :unavailable-note="loading ? 'Loading…' : 'Bridge Mgmt feed unavailable'"
      period="LIVE" description="Past next-inspection date"
      :status="loading || bridgesError ? undefined : agencyOverdueInspections > 0 ? 'warning' : 'healthy'"
      to="/infrastructure/bridges"
    />
    <KpiCard
      label="Streetlights Operational" :value="streetlightPct != null ? `${streetlightPct.toFixed(0)}%` : '-'"
      :unavailable="loading || summaryError" :unavailable-note="loading ? 'Loading…' : 'Streetlight Registry feed unavailable'"
      period="LIVE" description="Network-wide"
    />
    <KpiCard
      label="Traffic Signal Faults" :value="fmtNum(agencySignalFaults.length)"
      :unavailable="loading || signalError" :unavailable-note="loading ? 'Loading…' : 'NaMATA / NCC feed unavailable'"
      period="LIVE" :description="agencyLabel"
      :status="loading || signalError ? undefined : agencySignalFaults.length > 0 ? 'warning' : 'healthy'"
      to="#critical-assets"
    />
    <KpiCard
      label="WIM Overload Rate" :value="summary?.wim.overload_rate_pct != null ? `${summary.wim.overload_rate_pct.toFixed(1)}%` : '-'"
      :unavailable="loading || summaryError" :unavailable-note="loading ? 'Loading…' : 'WIM Stations feed unavailable'"
      period="30D" description="Network-wide · 30d"
    />
    <KpiCard
      label="Rural Road Closures" :value="fmtNum(agencyClosures.length)"
      :unavailable="loading || closuresError" :unavailable-note="loading ? 'Loading…' : 'Field Reports feed unavailable'"
      period="LIVE" :description="agencyLabel" to="#closures-table"
    />
  </div>

  <div v-if="agencyClosures.length" id="closures-table" class="card drill-target" style="margin-bottom:16px">
    <div class="card-header">Closures / Restrictions</div>
    <div class="card-body">
      <table>
        <thead><tr><th>Road</th><th>Status</th><th>Reason</th><th>Reported</th></tr></thead>
        <tbody>
          <tr v-for="c in closuresPageRows" :key="c.id">
            <td style="font-weight:600;font-size:12px">{{ c.segment_road_name ?? c.segment_road_code ?? '-' }}</td>
            <td><BadgePill variant="warning">{{ c.status }}</BadgePill></td>
            <td style="font-size:12px">{{ c.closure_reason || '-' }}</td>
            <td style="font-size:11px">{{ fmtDate(c.reported_at) }}</td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="closuresPage" :total-pages="closuresTotalPages" :total="closuresTotal"
        @prev="closuresPrev" @next="closuresNext"
      />
    </div>
  </div>

  <!-- Project table with filters -->
  <SectionTitle>Project Portfolio ({{ agencyLabel }})</SectionTitle>

  <div id="project-portfolio" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="statusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="planning">Planning</option>
          <option value="procurement">Procurement</option>
          <option value="in_progress">In Progress</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input v-model="countySearch" class="select-sm" placeholder="Filter by county…" style="min-width:150px" />
        <input v-model="nameSearch" class="select-sm" placeholder="Project name…" style="min-width:200px" />
        <button class="btn" @click="statusFilter=''; countySearch=''; nameSearch=''">Clear</button>
        <ExportButton filename="uapts-project-portfolio.csv" :href="projectExportHref" style="margin-left:auto" />
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Project</th>
              <th>County / Corridor</th>
              <th>Agency</th>
              <th>Status</th>
              <th>Contractor</th>
              <th>Physical Progress</th>
              <th>Financial Progress</th>
              <th>Contract (KES)</th>
              <th>Disbursed (KES)</th>
              <th>Planned End</th>
            </tr>
          </thead>
          <tbody v-if="filteredProjects.length">
            <template v-for="p in projectsPageRows" :key="p.id">
              <tr class="expand-row" :class="{ 'row-delayed': isDelayed(p.id) }" @click="expandedProject = expandedProject === p.id ? null : p.id">
                <td class="expand-cell">{{ expandedProject === p.id ? '▾' : '▸' }}</td>
                <td>
                  <div style="font-weight:600;font-size:13px">{{ p.project_name }}</div>
                  <div style="font-size:11px;color:var(--fg-3);font-family:monospace">{{ p.project_code }}</div>
                </td>
                <td style="font-size:12px">{{ p.county }}{{ p.corridor ? ` · ${p.corridor}` : '' }}</td>
                <td><BadgePill variant="info">{{ p.agency_code ?? '-' }}</BadgePill></td>
                <td><BadgePill :variant="statusBadge(p.status)">{{ p.status.replace(/_/g,' ') }}</BadgePill></td>
                <td style="font-size:12px">{{ p.contractor || '-' }}</td>
                <td>
                  <div class="prog-wrap"><div class="prog-bar" :style="{ transform: `scaleX(${(p.physical_progress_pct ?? 0) / 100})`, background: progColor(p.physical_progress_pct) }" /></div>
                  <span style="font-size:11px">{{ p.physical_progress_pct != null ? `${p.physical_progress_pct.toFixed(0)}%` : '-' }}</span>
                </td>
                <td>
                  <div class="prog-wrap"><div class="prog-bar" :style="{ transform: `scaleX(${(p.financial_progress_pct ?? 0) / 100})`, background: 'var(--primary-fill)' }" /></div>
                  <span style="font-size:11px">{{ p.financial_progress_pct != null ? `${p.financial_progress_pct.toFixed(0)}%` : '-' }}</span>
                </td>
                <td style="font-size:12px;white-space:nowrap">{{ p.contract_sum_kes != null ? `KES ${fmtKES(p.contract_sum_kes)}` : '-' }}</td>
                <td style="font-size:12px;white-space:nowrap">{{ p.disbursed_kes != null ? `KES ${fmtKES(p.disbursed_kes)}` : '-' }}</td>
                <td style="font-size:12px;white-space:nowrap">{{ fmtDate(p.planned_end) }}</td>
              </tr>
              <tr v-if="expandedProject === p.id" class="detail-row">
                <td :colspan="11">
                  <div class="dd-group-title">Overview</div>
                  <div class="drilldown">
                    <div class="dd-item"><span class="dd-label">Project Code</span><span>{{ p.project_code }}</span></div>
                    <div class="dd-item"><span class="dd-label">Agency</span><span>{{ p.agency_code ?? '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Status</span><span>{{ p.status.replace(/_/g,' ') }}</span></div>
                    <div class="dd-item"><span class="dd-label">Project Type</span><span>{{ p.project_type.replace(/_/g,' ') }}</span></div>
                    <div class="dd-item"><span class="dd-label">County</span><span>{{ p.county || '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Corridor</span><span>{{ p.corridor || '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Contractor</span><span>{{ p.contractor || '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Length</span><span>{{ p.length_km != null ? `${p.length_km} km` : '-' }}</span></div>
                  </div>

                  <div class="dd-group-title">Progress &amp; Financials</div>
                  <div class="drilldown">
                    <div class="dd-item"><span class="dd-label">Physical Progress</span><span>{{ p.physical_progress_pct != null ? `${p.physical_progress_pct.toFixed(1)}%` : '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Financial Progress</span><span>{{ p.financial_progress_pct != null ? `${p.financial_progress_pct.toFixed(1)}%` : '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Budget Utilization</span><span>{{ p.budget_utilization_pct.toFixed(1) }}%</span></div>
                    <div class="dd-item"><span class="dd-label">Contract Sum</span><span>{{ p.contract_sum_kes != null ? `KES ${fmtKESExact(p.contract_sum_kes)}` : '-' }}</span></div>
                    <div class="dd-item"><span class="dd-label">Disbursed</span><span>{{ p.disbursed_kes != null ? `KES ${fmtKESExact(p.disbursed_kes)}` : '-' }}</span></div>
                  </div>

                  <div class="dd-group-title">Timeline</div>
                  <div class="drilldown">
                    <div class="dd-item"><span class="dd-label">Planned Start</span><span>{{ fmtDate(p.planned_start) }}</span></div>
                    <div class="dd-item"><span class="dd-label">Planned End</span><span>{{ fmtDate(p.planned_end) }}</span></div>
                    <div class="dd-item"><span class="dd-label">Actual Start</span><span>{{ fmtDate(p.actual_start) }}</span></div>
                    <div class="dd-item"><span class="dd-label">Actual End</span><span>{{ fmtDate(p.actual_end) }}</span></div>
                    <div class="dd-item"><span class="dd-label">Last Updated</span><span>{{ fmtDate(p.updated_at) }}</span></div>
                  </div>

                  <div class="dd-group-title">Description</div>
                  <div class="dd-description">{{ p.description || 'No description on file.' }}</div>
                </td>
              </tr>
            </template>
          </tbody>
          <tbody v-else>
            <tr><td colspan="11" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading projects…' : 'No projects match the current filters.' }}</td></tr>
          </tbody>
        </table>
      </div>
      <TablePagination
        :page="projectsPage" :total-pages="projectsTotalPages" :total="projectsTotal"
        @prev="projectsPrev" @next="projectsNext"
      />
    </div>
  </div>

  <!-- By-county breakdown -->
  <SectionTitle>Projects by County ({{ agencyLabel }})</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div v-if="countyBreakdown.length" class="county-grid">
        <div v-for="c in countyBreakdown" :key="c.county" class="county-card">
          <div class="cc-name">{{ c.county }}</div>
          <div class="cc-count">{{ c.count }} project{{ c.count > 1 ? 's' : '' }}</div>
          <div class="cc-bar-wrap"><div class="cc-bar" :style="{ width: `${maxCountyCount > 0 ? (c.count / maxCountyCount) * 100 : 0}%` }" /></div>
          <div class="cc-val"><span v-if="c.avg_physical != null">{{ c.avg_physical.toFixed(0) }}% avg progress</span></div>
        </div>
      </div>
      <EmptyState v-else :loading="loading" message="No county breakdown available." compact />
    </div>
  </div>

  <!-- Maintenance Orders by agency -->
  <SectionTitle pill="Agency MMS · Live">Maintenance Orders ({{ agencyLabel }})</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="maintStatusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select v-model="maintPriorityFilter" class="select-sm">
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button class="btn" @click="maintStatusFilter=''; maintPriorityFilter=''">Clear</button>
        <ExportButton filename="uapts-maintenance-orders.csv" :href="ordersExportHref" style="margin-left:auto" />
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Road</th>
              <th>Agency</th>
              <th>Work Type</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Contractor</th>
              <th>Progress</th>
              <th>Cost (KES)</th>
              <th>Scheduled</th>
            </tr>
          </thead>
          <tbody v-if="filteredOrders.length">
            <tr v-for="o in ordersPageRows" :key="o.id">
              <td>
                <div style="font-weight:600;font-size:13px">{{ o.segment_road_name ?? o.segment_road_code ?? '-' }}</div>
                <div v-if="o.description" style="font-size:11px;color:var(--fg-3)">{{ o.description.slice(0,60) }}{{ o.description.length > 60 ? '…' : '' }}</div>
              </td>
              <td><BadgePill variant="info">{{ segmentAgency(o.segment) ?? '-' }}</BadgePill></td>
              <td><BadgePill variant="info">{{ o.work_type.replace(/_/g,' ') }}</BadgePill></td>
              <td><BadgePill :variant="maintStatusBadge(o.status)">{{ o.status.replace(/_/g,' ') }}</BadgePill></td>
              <td><BadgePill :variant="priorityBadge(o.priority)">{{ o.priority }}</BadgePill></td>
              <td style="font-size:12px">{{ o.contractor_name || '-' }}</td>
              <td>
                <div v-if="o.status === 'in_progress'" class="prog-wrap"><div class="prog-bar" :style="{ transform: `scaleX(${(o.progress_pct ?? 0) / 100})`, background: progColor(o.progress_pct) }" /></div>
                <span style="font-size:11px">{{ o.progress_pct != null ? `${o.progress_pct.toFixed(0)}%` : '-' }}</span>
              </td>
              <td style="font-size:12px;white-space:nowrap">{{ o.cost_kes != null ? `KES ${fmtKES(o.cost_kes)}` : '-' }}</td>
              <td style="font-size:12px;white-space:nowrap">{{ fmtDate(o.scheduled_at) }}</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr><td colspan="9" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading maintenance orders…' : 'No orders match the current filters.' }}</td></tr>
          </tbody>
        </table>
      </div>
      <TablePagination
        :page="ordersPage" :total-pages="ordersTotalPages" :total="ordersTotal"
        @prev="ordersPrev" @next="ordersNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useInfrastructure, useAgencies } from '~/composables/api'
import type { ConstructionProject, MaintenanceOrder, RoadSegment, Bridge, TrafficSignal, MaintenanceBudget, InfrastructureSummary, RuralRoadStatus } from '~/composables/api'

const route  = useRoute()
const router = useRouter()

const projects      = ref<ConstructionProject[]>([])
const delayed       = ref<ConstructionProject[]>([])
const countyRaw     = ref<any[]>([])
const orders        = ref<MaintenanceOrder[]>([])
const segments      = ref<RoadSegment[]>([])
const bridges       = ref<Bridge[]>([])
const signalFaults  = ref<TrafficSignal[]>([])
const budgets       = ref<MaintenanceBudget[]>([])
const summary       = ref<InfrastructureSummary | null>(null)
const closures      = ref<RuralRoadStatus[]>([])
const agencyNames   = ref<Record<string, string>>({})
const loading       = ref(true)
const error         = ref<string | null>(null)
const projectsError = ref(false)
const delayedError  = ref(false)
const ordersError   = ref(false)
const bridgesError  = ref(false)
const signalError   = ref(false)
const summaryError  = ref(false)
const closuresError = ref(false)
const statusFilter  = ref('')
const countySearch  = ref('')
const nameSearch    = ref('')
const maintStatusFilter   = ref('')
const maintPriorityFilter = ref('')
const expandedProject     = ref<string | null>(null)

const selectedAgency = ref(typeof route.query.agency === 'string' ? route.query.agency : '')

function selectAgency(code: string) {
  selectedAgency.value = code
  router.replace({ query: { ...route.query, agency: code || undefined } })
}
function agencyLink(path: string) {
  return selectedAgency.value ? { path, query: { agency: selectedAgency.value } } : path
}

async function load() {
  loading.value = true
  error.value = null
  const infra = useInfrastructure()
  const agenciesApi = useAgencies()

  const [projRes, delayRes, countyRes, ordRes, segRes, bridgeRes, sigRes, budRes, sumRes, closureRes, agencyRes] = await Promise.allSettled([
    infra.projects({ page_size: 100 }),
    infra.delayedProjects(),
    infra.projectsByCounty(),
    infra.maintenanceOrders({ page_size: 100 }),
    infra.segments({ page_size: 200 }),
    infra.bridges({ page_size: 200 }),
    infra.signalFaults(),
    infra.budgets({ page_size: 50 }),
    infra.summary(),
    infra.ruralRoadStatus({ page_size: 50 }),
    agenciesApi.list({ page_size: 50 }),
  ])

  if (projRes.status   === 'fulfilled') projects.value  = (projRes.value as any).results ?? []
  if (delayRes.status  === 'fulfilled') delayed.value   = (delayRes.value as any).results ?? []
  if (countyRes.status === 'fulfilled') countyRaw.value = Array.isArray(countyRes.value) ? countyRes.value : ((countyRes.value as any).results ?? [])
  if (ordRes.status    === 'fulfilled') orders.value    = (ordRes.value as any).results ?? []
  if (segRes.status    === 'fulfilled') segments.value  = (segRes.value as any).results ?? []
  if (bridgeRes.status === 'fulfilled') bridges.value   = (bridgeRes.value as any).results ?? []
  if (sigRes.status    === 'fulfilled') signalFaults.value = (sigRes.value as any).results ?? []
  if (budRes.status    === 'fulfilled') budgets.value   = (budRes.value as any).results ?? []
  if (sumRes.status    === 'fulfilled') summary.value   = sumRes.value
  if (closureRes.status === 'fulfilled') closures.value = (closureRes.value as any).results ?? []
  if (agencyRes.status === 'fulfilled') {
    const list = (agencyRes.value as any).results ?? []
    agencyNames.value = Object.fromEntries(list.map((a: any) => [a.agency_code, a.agency_name]))
  }

  projectsError.value = projRes.status  === 'rejected'
  delayedError.value  = delayRes.status === 'rejected'
  ordersError.value   = ordRes.status   === 'rejected'
  bridgesError.value  = bridgeRes.status === 'rejected'
  signalError.value   = sigRes.status   === 'rejected'
  summaryError.value  = sumRes.status   === 'rejected'
  closuresError.value = closureRes.status === 'rejected'

  if ([projRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Infrastructure API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Agency tabs ──────────────────────────────────────────────────────────
// `summary.construction.by_agency` is an exact server-side group-by - real
// per-agency project counts, not derived from the (page_size:100-capped)
// `projects` list. Falls back to counting the loaded list only while the
// summary request hasn't resolved yet (or failed).
const agencyOptions = computed(() => {
  const byAgency = summary.value?.construction.by_agency
  if (byAgency?.length) {
    return byAgency
      .filter(a => !!a.agency_code)
      .map(a => ({ code: a.agency_code as string, count: a.total_projects, name: agencyNames.value[a.agency_code as string] ?? (a.agency_code as string) }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }
  const m = new Map<string, number>()
  for (const p of projects.value) {
    if (!p.agency_code) continue
    m.set(p.agency_code, (m.get(p.agency_code) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([code, count]) => ({ code, count, name: agencyNames.value[code] ?? code }))
    .sort((a, b) => a.code.localeCompare(b.code))
})
const agencyLabel = computed(() => selectedAgency.value ? (agencyNames.value[selectedAgency.value] ?? selectedAgency.value) : 'All Agencies')
const krbHasFundingOnly = computed(() => !agencyOptions.value.some(a => a.code === 'KRB') && agencyBudgets('KRB').length > 0)
function agencyBudgets(code: string) { return budgets.value.filter(b => b.agency_code === code) }

// ConstructionProjectFilter/MaintenanceOrderFilter's `agency` param matches
// the Agency UUID, not its code - build the mapping from `construction.
// by_agency` (covers every agency with a project, not just those in the
// loaded page), falling back to whatever loaded rows carry both `agency`
// (uuid) and `agency_code` for any code it doesn't have yet.
const agencyCodeToId = computed(() => {
  const m: Record<string, string> = {}
  for (const a of summary.value?.construction.by_agency ?? []) {
    if (a.agency_code && a.agency_id) m[a.agency_code] = a.agency_id
  }
  for (const p of projects.value) if (p.agency_code && p.agency && !m[p.agency_code]) m[p.agency_code] = p.agency
  for (const b of bridges.value) if (b.agency_code && b.agency && !m[b.agency_code]) m[b.agency_code] = b.agency
  for (const b of budgets.value) if (b.agency_code && b.agency && !m[b.agency_code]) m[b.agency_code] = b.agency
  for (const s of segments.value) if (s.agency_code && s.agency && !m[s.agency_code]) m[s.agency_code] = s.agency
  return m
})

// ── Agency-scoped datasets ───────────────────────────────────────────────
const agencyProjects = computed(() => selectedAgency.value ? projects.value.filter(p => p.agency_code === selectedAgency.value) : projects.value)
const agencyDelayed  = computed(() => selectedAgency.value ? delayed.value.filter(p => p.agency_code === selectedAgency.value) : delayed.value)
const agencyCriticalBridges = computed(() => bridges.value.filter(b => (!selectedAgency.value || b.agency_code === selectedAgency.value) && ['poor','critical'].includes(b.condition_class)))
const agencyOverdueInspections = computed(() => bridges.value.filter(b => (!selectedAgency.value || b.agency_code === selectedAgency.value) && b.next_inspection_at && new Date(b.next_inspection_at).getTime() < Date.now()).length)
const agencySignalFaults = computed(() => signalFaults.value.filter(s => !selectedAgency.value || s.agency_code === selectedAgency.value))
const agencyClosures = computed(() => {
  if (!selectedAgency.value) return closures.value
  const ids = new Set(segments.value.filter(s => s.agency_code === selectedAgency.value).map(s => s.id))
  return closures.value.filter(c => ids.has(c.segment))
})
const streetlightPct = computed(() => summary.value?.streetlights.operational_pct ?? null)

function segmentAgency(segmentId: string) {
  return segments.value.find(s => s.id === segmentId)?.agency_code
}

const isDelayedSet = computed(() => new Set(delayed.value.map(p => p.id)))
function isDelayed(id: string) { return isDelayedSet.value.has(id) }

const budgetProgressMismatch = computed(() =>
  agencyProjects.value.filter(p =>
    p.financial_progress_pct != null && p.physical_progress_pct != null &&
    p.financial_progress_pct - p.physical_progress_pct >= 20,
  ),
)

const freshnessRows = computed(() => {
  const agencies = agencyOptions.value.map(a => a.code)
  return agencies.map(code => {
    const dates = [
      ...projects.value.filter(p => p.agency_code === code).map(p => p.updated_at),
      ...segments.value.filter(s => s.agency_code === code).map(s => s.updated_at),
    ].filter(Boolean).map(d => new Date(d as string).getTime())
    const lastUpdate = dates.length ? new Date(Math.max(...dates)).toISOString() : null
    const stale = !lastUpdate || (Date.now() - new Date(lastUpdate).getTime()) > 30 * 86_400_000
    return { agency: code, lastUpdate, stale }
  })
})

// ── Table filters ─────────────────────────────────────────────────────────
const filteredProjects = computed(() =>
  agencyProjects.value.filter(p => {
    if (statusFilter.value && p.status !== statusFilter.value) return false
    if (countySearch.value && !p.county.toLowerCase().includes(countySearch.value.toLowerCase())) return false
    if (nameSearch.value   && !p.project_name.toLowerCase().includes(nameSearch.value.toLowerCase())) return false
    return true
  }),
)

const filteredOrders = computed(() =>
  orders.value.filter(o => {
    if (selectedAgency.value && segmentAgency(o.segment) !== selectedAgency.value) return false
    if (maintStatusFilter.value   && o.status   !== maintStatusFilter.value)   return false
    if (maintPriorityFilter.value && o.priority !== maintPriorityFilter.value) return false
    return true
  }),
)

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: closuresPageRows, page: closuresPage, totalPages: closuresTotalPages,
  total: closuresTotal, next: closuresNext, prev: closuresPrev,
} = usePagination(agencyClosures, 15)

const {
  pageRows: projectsPageRows, page: projectsPage, totalPages: projectsTotalPages,
  total: projectsTotal, next: projectsNext, prev: projectsPrev,
} = usePagination(filteredProjects, 15)

const {
  pageRows: ordersPageRows, page: ordersPage, totalPages: ordersTotalPages,
  total: ordersTotal, next: ordersNext, prev: ordersPrev,
} = usePagination(filteredOrders, 15)

// Real server-side exports (honor the same django-filter params as their
// list endpoints) - more complete than exporting only the currently-loaded page.
// Both filters' `agency` param expects the Agency UUID, not its code
// (passing a non-UUID code 500s server-side) - resolve via agencyCodeToId.
const projectExportHref = computed(() => {
  const q = new URLSearchParams({ format: 'csv' })
  const agencyId = selectedAgency.value ? agencyCodeToId.value[selectedAgency.value] : undefined
  if (agencyId) q.set('agency', agencyId)
  if (statusFilter.value) q.set('status', statusFilter.value)
  if (countySearch.value) q.set('county', countySearch.value)
  if (nameSearch.value) q.set('search', nameSearch.value)
  return `/api/v1/infrastructure/construction-projects/export/?${q.toString()}`
})
const ordersExportHref = computed(() => {
  const q = new URLSearchParams({ format: 'csv' })
  const agencyId = selectedAgency.value ? agencyCodeToId.value[selectedAgency.value] : undefined
  if (agencyId) q.set('agency', agencyId)
  if (maintStatusFilter.value) q.set('status', maintStatusFilter.value)
  if (maintPriorityFilter.value) q.set('priority', maintPriorityFilter.value)
  return `/api/v1/infrastructure/maintenance-orders/export/?${q.toString()}`
})

const totalContract  = computed(() => agencyProjects.value.reduce((s, p) => s + (parseFloat(p.contract_sum_kes ?? '') || 0), 0))
const totalDisbursed = computed(() => agencyProjects.value.reduce((s, p) => s + (parseFloat(p.disbursed_kes ?? '') || 0), 0))

function countByStatus(s: string) { return agencyProjects.value.filter(p => p.status === s).length }

const countyBreakdown = computed(() => {
  if (!selectedAgency.value && countyRaw.value.length) return countyRaw.value
  const map = new Map<string, { county: string; count: number; avg_physical: number | null }>()
  agencyProjects.value.forEach(p => {
    const ex = map.get(p.county)
    if (ex) { ex.count++; if (p.physical_progress_pct != null) ex.avg_physical = ((ex.avg_physical ?? 0) + p.physical_progress_pct) / 2 }
    else map.set(p.county, { county: p.county, count: 1, avg_physical: p.physical_progress_pct })
  })
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
})

const maxCountyCount = computed(() => Math.max(1, ...countyBreakdown.value.map(c => c.count)))

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
function fmtKESExact(v: number | string | null | undefined) {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (n == null || isNaN(n)) return '-'
  return Math.round(n).toLocaleString()
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function statusBadge(s: string) {
  const m: Record<string,string> = { in_progress:'info', completed:'success', on_hold:'warning', planning:'neutral', procurement:'neutral', cancelled:'danger' }
  return m[s] ?? 'neutral'
}
function maintStatusBadge(s: string) {
  const m: Record<string,string> = { in_progress:'info', completed:'success', scheduled:'fair', planned:'neutral', on_hold:'warning', cancelled:'danger' }
  return m[s] ?? 'neutral'
}
function priorityBadge(s: string) {
  const m: Record<string,string> = { urgent:'danger', high:'warning', medium:'fair', low:'success' }
  return m[s] ?? 'neutral'
}
function progColor(pct: number | null | undefined) {
  if (pct == null) return 'var(--border-strong)'
  return pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--destructive)'
}
</script>

<style scoped>
.agency-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px; }
.agency-tab { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:20px; border:1px solid var(--border-subtle); background:var(--surface-2); font-size:12.5px; font-weight:600; color:var(--fg-2); cursor:pointer; transition:all .12s; }
.agency-tab:hover { border-color:var(--primary); color:var(--primary); }
.agency-tab.active { background:var(--primary-fill); border-color:var(--primary-fill); color:#fff; }
.agency-tab-count { font-size:11px; opacity:.75; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
@media(max-width:1000px) { .two-col { grid-template-columns:1fr; } }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.table-scroll { overflow-x:auto; }
.scroll-body { max-height:280px; overflow-y:auto; }
.prog-wrap { background:var(--surface-sunken); border-radius:4px; height:6px; overflow:hidden; margin-bottom:2px; }
.prog-bar { height:100%; width:100%; border-radius:4px; transform-origin:left; transition:transform .4s; }
/* Delayed is a background tint, not a coloured border-left slab. */
.row-delayed td { background:var(--warning-bg); }
.expand-row { cursor:pointer; }
.expand-cell { width:18px; color:var(--fg-3); font-size:11px; }
.detail-row td { background:var(--surface-1); padding:14px 18px; border-bottom:1px solid var(--border-subtle); }
.drilldown { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:14px; }
.dd-item { display:flex; flex-direction:column; gap:2px; font-size:12px; }
.dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--fg-3); }
.dd-group-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--fg-2); margin-bottom:8px; }
.dd-group-title:not(:first-child) { margin-top:4px; }
.dd-description { font-size:12.5px; line-height:1.5; color:var(--fg-1); white-space:pre-wrap; }
.county-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; }
.county-card { border:1px solid var(--border-subtle); border-radius:6px; padding:10px 12px; }
.cc-name { font-size:13px; font-weight:600; margin-bottom:2px; }
.cc-count { font-size:12px; color:var(--fg-2); margin-bottom:6px; }
.cc-bar-wrap { background:var(--surface-sunken); border-radius:4px; height:6px; overflow:hidden; margin-bottom:4px; }
.cc-bar { height:100%; background:var(--primary-fill); border-radius:4px; }
.cc-val { font-size:11px; color:var(--fg-3); }
.fresh-row { display:grid; grid-template-columns:80px 1fr 90px; align-items:center; gap:8px; padding:6px 0; font-size:12px; border-bottom:1px solid var(--border-subtle); }
.fresh-agency { font-weight:600; }
</style>
