<template>
  <PageHeader
    eyebrow="Maritime - Port Services"
    title="Port Services"
    subtitle="KPA · KMA - Cargo handling operations (offload / load / stevedoring), pilotage boarding-to-berthing records, and vessel / pilot / crane-equipment licensing"
  >
    <template #actions>
      <NuxtLink to="/maritime" class="btn">Vessel Movements →</NuxtLink>
      <NuxtLink to="/maritime/cargo" class="btn">Cargo →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">
    ⚠ {{ error }}
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Cargo Ops (30d)" :value="fmtNum(cargoOpsTotal)"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KPA Ops feed unavailable'"
      period="30D" description="Offload / load / stevedoring" to="#cargo-ops-table"
    />
    <KpiCard
      label="Avg Tonnes / Gang Hour" :value="avgTonnesPerGangHour != null ? avgTonnesPerGangHour.toFixed(1) : '-'"
      :unavailable="loading || cargoOpsError" :unavailable-note="loading ? 'Loading…' : 'KPA Ops feed unavailable'"
      period="LIVE" description="Stevedoring productivity (from sampled ops)" to="#cargo-ops-table"
    />
    <KpiCard
      label="Pilotage Calls (30d)" :value="fmtNum(pilotageCallsTotal)"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KPA Pilotage feed unavailable'"
      period="30D" description="Boarding to berthing" to="#pilotage-table"
    />
    <KpiCard
      label="Avg Pilotage Duration" :value="avgPilotageDurationMin != null ? `${avgPilotageDurationMin.toFixed(0)} min` : '-'"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KPA Pilotage feed unavailable'"
      period="30D" description="Target: &lt;120 min (Mombasa)"
      :status="avgPilotageDurationMin == null ? undefined : avgPilotageDurationMin <= 120 ? 'healthy' : 'warning'"
      to="#pilotage-table"
    />
    <KpiCard
      label="Pilotage Incidents (sampled)" :value="fmtNum(pilotageIncidentsSampled)"
      :unavailable="loading || pilotageError" :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="LIVE" description="Flagged near-miss / grounding / collision"
      :status="loading || pilotageError ? undefined : pilotageIncidentsSampled === 0 ? 'healthy' : 'warning'"
      to="#pilotage-table"
    />
    <KpiCard
      label="Licences Expiring (30d)" :value="fmtNum(licencesExpiringTotal)"
      :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KMA feed unavailable'"
      period="30D" description="Vessel / pilot / equipment" to="#licensing-table"
    />
  </div>

  <!-- Cargo Handling Operations -->
  <SectionTitle pill="KPA Ops · Live">Cargo Handling Operations</SectionTitle>
  <div id="cargo-ops-table" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="opFilter" class="select-sm">
          <option value="">All operations</option>
          <option value="offload">Offloading (Discharge)</option>
          <option value="load">Loading (Onloading)</option>
          <option value="stevedoring">Stevedoring</option>
        </select>
        <button class="btn" @click="opFilter=''">Clear</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Vessel</th><th>Port</th><th>Operation</th><th>Crane</th><th>Gang Size</th><th>Tonnes Moved</th><th>t/hr</th><th>Equipment</th><th>Damage</th></tr>
          </thead>
          <tbody v-if="filteredCargoOps.length">
            <tr v-for="c in cargoRowsPageRows" :key="c.id">
              <td style="font-weight:600;font-size:12px">{{ c.vessel_name ?? '-' }}</td>
              <td style="font-family:monospace;font-size:12px">{{ c.port_unlocode }}</td>
              <td><BadgePill variant="info">{{ c.operation_type.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-family:monospace;font-size:12px">{{ c.crane_id || '-' }}</td>
              <td>{{ c.gang_size ?? '-' }}</td>
              <td>{{ fmtNum(c.tonnes_moved) }}</td>
              <td>{{ tonnesPerHour(c)?.toFixed(1) ?? '-' }}</td>
              <td style="font-size:12px">{{ c.equipment_used || '-' }}</td>
              <td><BadgePill :variant="c.damage_reported ? 'danger' : 'success'">{{ c.damage_reported ? 'Yes' : 'No' }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="9" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No cargo handling operations in the current view.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="cargoRowsPage" :total-pages="cargoRowsTotalPages" :total="cargoRowsTotal"
          @prev="cargoRowsPrev" @next="cargoRowsNext"
        />
      </div>
    </div>
  </div>

  <!-- Pilotage -->
  <SectionTitle pill="KPA Pilotage Dept · Live">Pilotage Records</SectionTitle>
  <div id="pilotage-table" class="card drill-target">
    <div class="card-body">
      <table>
        <thead>
          <tr><th>Vessel</th><th>Port</th><th>Pilot</th><th>Boarding</th><th>Berthing</th><th>Duration</th><th>Tugs</th><th>Incident</th></tr>
        </thead>
        <tbody v-if="pilotage.length">
          <tr v-for="p in pilotagePageRows" :key="p.id">
            <td style="font-weight:600;font-size:12px">{{ p.vessel_name }}</td>
            <td style="font-family:monospace;font-size:12px">{{ p.port_unlocode }}</td>
            <td style="font-size:12px;font-family:monospace">{{ p.pilot_id }}</td>
            <td style="font-size:11px">{{ fmtDate(p.boarding_time) }}</td>
            <td style="font-size:11px">{{ p.berthing_time ? fmtDate(p.berthing_time) : '-' }}</td>
            <td :style="{ color: (p.duration_hours ?? 0) > 2 ? 'var(--danger-fg)' : 'var(--success-fg)', fontWeight:'600' }">{{ p.duration_hours != null ? `${Math.round(p.duration_hours * 60)} min` : '-' }}</td>
            <td>{{ p.tug_assist_ids.length }}</td>
            <td><BadgePill :variant="p.incident_flag ? 'danger' : 'success'">{{ p.incident_flag ? 'Flagged' : 'None' }}</BadgePill></td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="8" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No pilotage records in the current view.' }}</td></tr></tbody>
      </table>
      <TablePagination
        :page="pilotagePage" :total-pages="pilotageTotalPages" :total="pilotageTotal"
        @prev="pilotagePrev" @next="pilotageNext"
      />
    </div>
  </div>

  <!-- Licensing -->
  <SectionTitle pill="KMA · Live">Licensing Register</SectionTitle>
  <div id="licensing-table" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="licenceCategoryFilter" class="select-sm">
          <option value="">All categories</option>
          <option value="vessel">Vessel Licence</option>
          <option value="pilot">Pilot Licence</option>
          <option value="equipment">Crane / Equipment Licence</option>
        </select>
        <select v-model="licenceStatusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>
        <button class="btn" @click="licenceCategoryFilter=''; licenceStatusFilter=''">Clear</button>
      </div>
      <table>
        <thead>
          <tr><th>Category</th><th>Licence #</th><th>Holder</th><th>Authority</th><th>Issued</th><th>Expiry</th><th>Status</th><th>Endorsements</th></tr>
        </thead>
        <tbody v-if="filteredLicences.length">
          <tr v-for="l in licencesPageRows" :key="l.id">
            <td><BadgePill variant="info">{{ l.licence_type.replace(/_/g,' ') }}</BadgePill></td>
            <td style="font-family:monospace;font-size:11px">{{ l.licence_number }}</td>
            <td style="font-weight:600;font-size:12px">{{ l.vessel_name ?? l.holder_id ?? '-' }}</td>
            <td style="font-size:12px">{{ l.issuing_authority }}</td>
            <td style="font-size:11px">{{ l.issue_date ? fmtDay(l.issue_date) : '-' }}</td>
            <td style="font-size:11px">{{ fmtDay(l.expiry_date) }}</td>
            <td><BadgePill :variant="licenceBadge(l)">{{ l.is_expired ? 'expired' : l.status }}</BadgePill></td>
            <td style="font-size:12px">{{ l.endorsements.length ? l.endorsements.join(', ') : '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="8" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No licences in the current view.' }}</td></tr></tbody>
      </table>
      <TablePagination
        :page="licencesPage" :total-pages="licencesTotalPages" :total="licencesTotal"
        @prev="licencesPrev" @next="licencesNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useMaritimeServices } from '~/composables/api'
import type { MaritimeServicesSummary, CargoHandlingRecord, PilotageRecord, MaritimeLicence, LicenceCategory, LicenceStatus } from '~/composables/api'

const summary   = ref<MaritimeServicesSummary | null>(null)
const cargoOps  = ref<CargoHandlingRecord[]>([])
const pilotage  = ref<PilotageRecord[]>([])
const licences  = ref<MaritimeLicence[]>([])
const loading   = ref(true)
const error     = ref<string | null>(null)
const cargoOpsError = ref(false)
const pilotageError = ref(false)

const opFilter = ref('')
const licenceCategoryFilter = ref('')
const licenceStatusFilter   = ref('')

async function load() {
  loading.value = true
  error.value = null
  const svc = useMaritimeServices()

  const [sumRes, coRes, plRes, licRes] = await Promise.allSettled([
    svc.summary(),
    svc.cargoHandling({ page_size: 50 }),
    svc.pilotage({ page_size: 30 }),
    svc.licences({ page_size: 100 }),
  ])

  if (sumRes.status === 'fulfilled') summary.value = sumRes.value
  if (coRes.status  === 'fulfilled') cargoOps.value = (coRes.value as any).results ?? []
  if (plRes.status  === 'fulfilled') pilotage.value = (plRes.value as any).results ?? []
  if (licRes.status === 'fulfilled') licences.value = (licRes.value as any).results ?? []

  cargoOpsError.value = coRes.status === 'rejected'
  pilotageError.value = plRes.status === 'rejected'

  if ([sumRes, coRes, plRes, licRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime Services API.'

  loading.value = false
}

onMounted(load)

const filteredCargoOps = computed(() => cargoOps.value.filter(c => !opFilter.value || c.operation_type === opFilter.value))
const filteredLicences = computed(() => licences.value.filter(l => {
  if (licenceCategoryFilter.value && l.licence_type !== (licenceCategoryFilter.value as LicenceCategory)) return false
  if (licenceStatusFilter.value && l.status !== (licenceStatusFilter.value as LicenceStatus)) return false
  return true
}))

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: cargoRowsPageRows, page: cargoRowsPage, totalPages: cargoRowsTotalPages,
  total: cargoRowsTotal, next: cargoRowsNext, prev: cargoRowsPrev,
} = usePagination(filteredCargoOps, 15)

const {
  pageRows: pilotagePageRows, page: pilotagePage, totalPages: pilotageTotalPages,
  total: pilotageTotal, next: pilotageNext, prev: pilotagePrev,
} = usePagination(pilotage, 15)

const {
  pageRows: licencesPageRows, page: licencesPage, totalPages: licencesTotalPages,
  total: licencesTotal, next: licencesNext, prev: licencesPrev,
} = usePagination(filteredLicences, 15)

// ── Summary KPIs (aggregated from the per-port summary + sampled catalogues) ─
const cargoOpsTotal = computed(() => summary.value?.ports.reduce((s, p) => s + p.cargo_operations_count, 0) ?? null)
const pilotageCallsTotal = computed(() => summary.value?.ports.reduce((s, p) => s + p.pilotage_count, 0) ?? null)
const avgPilotageDurationMin = computed(() => {
  const withData = summary.value?.ports.filter(p => p.avg_pilotage_duration_hours != null) ?? []
  if (!withData.length) return null
  const avgHours = withData.reduce((s, p) => s + (p.avg_pilotage_duration_hours as number), 0) / withData.length
  return avgHours * 60
})
const licencesExpiringTotal = computed(() => summary.value?.licences_expiring_30d.reduce((s, r) => s + r.count, 0) ?? null)
// Not in the summary endpoint - computed from the sampled cargo-handling/pilotage pages already fetched for the tables below.
const avgTonnesPerGangHour = computed(() => {
  const withGang = cargoOps.value.filter(c => c.gang_size && c.duration_hours)
  if (!withGang.length) return null
  const rates = withGang.map(c => c.tonnes_moved / ((c.gang_size as number) * (c.duration_hours as number)))
  return rates.reduce((s, r) => s + r, 0) / rates.length
})
const pilotageIncidentsSampled = computed(() => pilotage.value.filter(p => p.incident_flag).length)

function tonnesPerHour(c: CargoHandlingRecord): number | null {
  if (!c.duration_hours) return null
  return c.tonnes_moved / c.duration_hours
}

function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return s }
}
function fmtDay(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function licenceBadge(l: MaritimeLicence) {
  if (l.is_expired) return 'danger'
  const m: Record<LicenceStatus,string> = { active:'success', expired:'danger', suspended:'warning' }
  return m[l.status] ?? 'neutral'
}
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.table-scroll { overflow-x:auto; }
</style>
