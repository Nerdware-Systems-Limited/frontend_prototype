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
    ⚠ {{ error }} Cargo handling, pilotage, and licensing records are not yet integrated from KPA/KMA operational systems - tables below will populate once that feed goes live.
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Cargo Ops (30d)" :value="summary ? fmtNum(summary.kpis.cargo_ops_30d) : '-'" sub="Offload / load / stevedoring" source="batch" source-title="KPA Ops" />
    <KpiCard label="Avg Tonnes / Gang Hour" :value="summary ? summary.kpis.avg_tonnes_per_gang_hour.toFixed(1) : '-'" sub="Stevedoring productivity" source="batch" source-title="KPA Ops" />
    <KpiCard label="Pilotage Calls (30d)" :value="summary ? fmtNum(summary.kpis.pilotage_calls_30d) : '-'" sub="Boarding to berthing" source="batch" source-title="KPA Pilotage" />
    <KpiCard label="Avg Pilotage Duration" :value="summary ? `${summary.kpis.avg_pilotage_duration_min.toFixed(0)} min` : '-'" sub="Target: <120 min (Mombasa)" :trend-direction="summary && summary.kpis.avg_pilotage_duration_min <= 120 ? 'up' : 'down'" source="batch" source-title="KPA Pilotage" />
    <KpiCard label="Pilotage Incidents (30d)" :value="summary ? fmtNum(summary.kpis.pilotage_incidents_30d) : '-'" sub="Near-miss / grounding / collision" :trend-direction="summary && summary.kpis.pilotage_incidents_30d === 0 ? 'up' : 'down'" source="batch" source-title="KMA" />
    <KpiCard label="Licences Expiring (60d)" :value="summary ? fmtNum(summary.kpis.licences_expiring_60d) : '-'" sub="Vessel / pilot / equipment" source="batch" source-title="KMA" />
  </div>

  <!-- Cargo Handling Operations -->
  <SectionTitle pill="KPA Ops · Pending Integration">Cargo Handling Operations</SectionTitle>
  <div class="card">
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
            <tr><th>Vessel</th><th>Port</th><th>Operation</th><th>Crane</th><th>Gang Size</th><th>Tonnes Moved</th><th>t/hr</th><th>Damage</th></tr>
          </thead>
          <tbody v-if="filteredCargoOps.length">
            <tr v-for="c in filteredCargoOps" :key="c.id">
              <td style="font-weight:600;font-size:12px">{{ c.vessel_name }}</td>
              <td style="font-family:monospace;font-size:12px">{{ c.port_unlocode }}</td>
              <td><BadgePill variant="info">{{ c.operation.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-family:monospace;font-size:12px">{{ c.crane_id ?? '-' }}</td>
              <td>{{ c.gang_size ?? '-' }}</td>
              <td>{{ fmtNum(c.tonnes_moved) }}</td>
              <td>{{ c.tonnes_per_hour?.toFixed(1) ?? '-' }}</td>
              <td><BadgePill :variant="c.damage_reported ? 'danger' : 'success'">{{ c.damage_reported ? 'Yes' : 'No' }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'Cargo handling operational records have not been integrated from KPA yet.' }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Pilotage -->
  <SectionTitle pill="KPA Pilotage Dept · Pending Integration">Pilotage Records</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr><th>Vessel</th><th>Port</th><th>Pilot</th><th>Boarding</th><th>Berthing</th><th>Duration</th><th>Tugs</th><th>Incident</th></tr>
        </thead>
        <tbody v-if="pilotage.length">
          <tr v-for="p in pilotage" :key="p.id">
            <td style="font-weight:600;font-size:12px">{{ p.vessel_name }}</td>
            <td style="font-family:monospace;font-size:12px">{{ p.port_unlocode }}</td>
            <td style="font-size:12px">{{ p.pilot_name ?? p.pilot_id }}</td>
            <td style="font-size:11px">{{ fmtDate(p.boarding_time) }}</td>
            <td style="font-size:11px">{{ p.berthing_time ? fmtDate(p.berthing_time) : '-' }}</td>
            <td :style="{ color: (p.duration_min ?? 0) > 120 ? '#ef4444' : '#22c55e', fontWeight:'600' }">{{ p.duration_min != null ? `${p.duration_min} min` : '-' }}</td>
            <td>{{ p.tug_count }}</td>
            <td><BadgePill :variant="pilotageIncidentBadge(p.incident_flag)">{{ p.incident_flag.replace(/_/g,' ') }}</BadgePill></td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'Pilotage records have not been integrated from the KPA Pilotage Department yet.' }}</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Licensing -->
  <SectionTitle pill="KMA · Pending Integration">Licensing Register</SectionTitle>
  <div class="card">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="licenceCategoryFilter" class="select-sm">
          <option value="">All categories</option>
          <option value="vessel">Vessel Licence</option>
          <option value="pilot">Pilot Licence</option>
          <option value="crane_equipment">Crane / Equipment Licence</option>
        </select>
        <select v-model="licenceStatusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="valid">Valid</option>
          <option value="expiring_soon">Expiring Soon</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>
        <button class="btn" @click="licenceCategoryFilter=''; licenceStatusFilter=''">Clear</button>
      </div>
      <table>
        <thead>
          <tr><th>Category</th><th>Holder</th><th>Authority</th><th>Issued</th><th>Expiry</th><th>Status</th><th>Endorsements</th></tr>
        </thead>
        <tbody v-if="filteredLicences.length">
          <tr v-for="l in filteredLicences" :key="l.id">
            <td><BadgePill variant="info">{{ l.category.replace(/_/g,' ') }}</BadgePill></td>
            <td style="font-weight:600;font-size:12px">{{ l.holder_name }}</td>
            <td style="font-size:12px">{{ l.licensing_authority }}</td>
            <td style="font-size:11px">{{ l.issued_date ? fmtDay(l.issued_date) : '-' }}</td>
            <td style="font-size:11px">{{ fmtDay(l.expiry_date) }}</td>
            <td><BadgePill :variant="licenceBadge(l.status)">{{ l.status.replace(/_/g,' ') }}</BadgePill></td>
            <td style="font-size:12px">{{ l.endorsements ?? '-' }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">{{ loading ? 'Loading…' : 'Licensing register has not been integrated from KMA yet.' }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Port Services')

import { useMaritimeServices } from '~/composables/api'
import type { MaritimeServicesSummary, CargoHandlingRecord, PilotageRecord, MaritimeLicence, PilotageIncidentFlag, LicenceStatus } from '~/composables/api'

const summary   = ref<MaritimeServicesSummary | null>(null)
const cargoOps  = ref<CargoHandlingRecord[]>([])
const pilotage  = ref<PilotageRecord[]>([])
const licences  = ref<MaritimeLicence[]>([])
const loading   = ref(true)
const error     = ref<string | null>(null)

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

  if ([sumRes, coRes, plRes, licRes].every(r => r.status === 'rejected'))
    error.value = 'Unable to reach the UAPTS Maritime Services API.'

  loading.value = false
}

onMounted(load)

const filteredCargoOps = computed(() => cargoOps.value.filter(c => !opFilter.value || c.operation === opFilter.value))
const filteredLicences = computed(() => licences.value.filter(l => {
  if (licenceCategoryFilter.value && l.category !== licenceCategoryFilter.value) return false
  if (licenceStatusFilter.value && l.status !== (licenceStatusFilter.value as LicenceStatus)) return false
  return true
}))

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
function pilotageIncidentBadge(f: PilotageIncidentFlag) {
  const m: Record<PilotageIncidentFlag,string> = { none:'success', near_miss:'warning', grounding:'danger', collision:'danger' }
  return m[f] ?? 'neutral'
}
function licenceBadge(s: LicenceStatus) {
  const m: Record<LicenceStatus,string> = { valid:'success', expiring_soon:'warning', expired:'danger', suspended:'danger' }
  return m[s] ?? 'neutral'
}
</script>

<style scoped>
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.select-sm { padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
.table-scroll { overflow-x:auto; }
</style>
