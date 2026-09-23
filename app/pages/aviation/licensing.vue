<template>
  <PageHeader
    eyebrow="Aviation - Licensing &amp; Certification"
    title="Aircraft & Operator Licensing"
    subtitle="KCAA - Certificate of Registration, Certificate of Airworthiness, AOC, noise/insurance/radio certificates, and pilot licences - with renewal tracking"
  >
    <template #actions>
      <NuxtLink to="/aviation" class="btn">Aviation Overview →</NuxtLink>
      <NuxtLink to="/aviation/infrastructure" class="btn">Infrastructure →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">
    ⚠ {{ error }} Certificate/licence records are not yet integrated from KCAA - the aircraft and airline registries below remain live.
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <KpiCard label="Total Certificates" :value="summary ? fmtNum(summary.kpis.total_licences) : '-'" :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KCAA feed unavailable'" period="LIVE" description="All categories" to="#certificate-register" />
    <KpiCard label="Valid" :value="summary ? pct(summary.kpis.valid_pct) : '-'" :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KCAA feed unavailable'" period="LIVE" description="Of tracked certificates" :status="!summary ? undefined : summary.kpis.valid_pct >= 90 ? 'healthy' : 'warning'" to="#certificate-register" />
    <KpiCard label="Expiring (30d)" :value="summary ? fmtNum(summary.kpis.expiring_30d) : '-'" :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KCAA feed unavailable'" period="30D" description="Renewal due soon" :status="!summary ? undefined : summary.kpis.expiring_30d === 0 ? 'healthy' : 'warning'" to="#renewals-due" />
    <KpiCard label="Expired" :value="summary ? fmtNum(summary.kpis.expired) : '-'" :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KCAA feed unavailable'" period="LIVE" description="Lapsed, not renewed" :status="!summary ? undefined : summary.kpis.expired === 0 ? 'healthy' : 'critical'" to="#certificate-register" />
    <KpiCard label="Aircraft Without Valid CofA" :value="summary ? fmtNum(summary.kpis.aircraft_without_valid_cofa) : '-'" :unavailable="!summary" :unavailable-note="loading ? 'Loading…' : 'KCAA feed unavailable'" period="LIVE" description="Grounded / non-airworthy risk" :status="!summary ? undefined : summary.kpis.aircraft_without_valid_cofa === 0 ? 'healthy' : 'critical'" to="#aircraft-registry" />
    <KpiCard label="Registered Aircraft" :value="fmtNum(aircraft.length)" :unavailable="loading || acError" :unavailable-note="loading ? 'Loading…' : 'KCAA feed unavailable'" period="LIVE" description="Live registry" to="#aircraft-registry" />
  </div>

  <!-- Renewals due -->
  <SectionTitle pill="KCAA · Pending Integration">Renewals Due (Next 90 Days)</SectionTitle>
  <div id="renewals-due" class="card drill-target">
    <div class="card-body">
      <table>
        <thead>
          <tr><th>Holder</th><th>Category</th><th>Certificate No.</th><th>Expiry</th><th>Days Left</th><th>Status</th></tr>
        </thead>
        <tbody v-if="renewalsDue.length">
          <tr v-for="l in renewalsPageRows" :key="l.id">
            <td style="font-weight:600;font-size:12px">{{ holderLabel(l) }}</td>
            <td><BadgePill variant="info">{{ categoryLabel(l.category) }}</BadgePill></td>
            <td style="font-family:monospace;font-size:12px">{{ l.certificate_number }}</td>
            <td style="font-size:12px">{{ fmtDay(l.expiry_date) }}</td>
            <td :style="{ fontWeight:'700', color: daysLeft(l.expiry_date) <= 14 ? 'var(--danger-fg)' : daysLeft(l.expiry_date) <= 30 ? 'var(--warning-fg)' : 'var(--success-fg)' }">
              {{ daysLeft(l.expiry_date) }}d
            </td>
            <td><BadgePill :variant="statusBadge(l.status)">{{ l.status.replace(/_/g,' ') }}</BadgePill></td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="6" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'Renewal tracking has not been integrated from KCAA yet.' }}</td></tr></tbody>
      </table>
      <TablePagination
        :page="renewalsPage" :total-pages="renewalsTotalPages" :total="renewalsTotal"
        @prev="renewalsPrev" @next="renewalsNext"
      />
    </div>
  </div>

  <!-- Full certificate register -->
  <SectionTitle pill="KCAA · Pending Integration">Certificate / Licence Register</SectionTitle>
  <div id="certificate-register" class="card drill-target">
    <div class="card-body">
      <div class="filter-row">
        <select v-model="categoryFilter" class="select-sm">
          <option value="">All categories</option>
          <option value="certificate_of_registration">Certificate of Registration</option>
          <option value="certificate_of_airworthiness">Certificate of Airworthiness</option>
          <option value="noise_certificate">Noise Certificate</option>
          <option value="insurance">Insurance</option>
          <option value="radio_licence">Radio Licence</option>
          <option value="air_operator_certificate">Air Operator Certificate (AOC)</option>
          <option value="pilot_licence">Pilot Licence</option>
          <option value="crew_licence">Crew Licence</option>
        </select>
        <select v-model="holderTypeFilter" class="select-sm">
          <option value="">All holder types</option>
          <option value="aircraft">Aircraft</option>
          <option value="airline">Airline</option>
          <option value="pilot">Pilot</option>
        </select>
        <select v-model="statusFilter" class="select-sm">
          <option value="">All statuses</option>
          <option value="valid">Valid</option>
          <option value="expiring_soon">Expiring Soon</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
          <option value="revoked">Revoked</option>
        </select>
        <button class="btn" @click="categoryFilter=''; holderTypeFilter=''; statusFilter=''">Clear</button>
        <ExportButton filename="uapts-aviation-licensing.csv" :rows="filteredLicences" :columns="licenceExportColumns" style="margin-left:auto" />
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Holder</th><th>Category</th><th>Certificate No.</th><th>Issuing Authority</th><th>Issued</th><th>Expiry</th><th>Status</th></tr>
          </thead>
          <tbody v-if="filteredLicences.length">
            <tr v-for="l in licencesPageRows" :key="l.id">
              <td style="font-weight:600;font-size:12px">{{ holderLabel(l) }}</td>
              <td><BadgePill variant="info">{{ categoryLabel(l.category) }}</BadgePill></td>
              <td style="font-family:monospace;font-size:12px">{{ l.certificate_number }}</td>
              <td style="font-size:12px">{{ l.issuing_authority }}</td>
              <td style="font-size:11px">{{ l.issued_date ? fmtDay(l.issued_date) : '-' }}</td>
              <td style="font-size:11px">{{ fmtDay(l.expiry_date) }}</td>
              <td><BadgePill :variant="statusBadge(l.status)">{{ l.status.replace(/_/g,' ') }}</BadgePill></td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="7" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'The certificate/licence register has not been integrated from KCAA yet.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="licencesPage" :total-pages="licencesTotalPages" :total="licencesTotal"
          @prev="licencesPrev" @next="licencesNext"
        />
      </div>
    </div>
  </div>

  <!-- Live aircraft registry + AOC status cross-reference -->
  <SectionTitle pill="Live Registry">Aircraft Registry &amp; Airworthiness</SectionTitle>
  <div id="aircraft-registry" class="card drill-target">
    <div class="card-body">
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Registration</th><th>Type</th><th>Manufacturer / Model</th><th>Airline</th><th>In Service</th><th>Valid CofA</th></tr>
          </thead>
          <tbody v-if="aircraft.length">
            <tr v-for="a in aircraftPageRows" :key="a.id">
              <td style="font-family:monospace;font-weight:700">{{ a.registration }}</td>
              <td><BadgePill variant="neutral">{{ a.aircraft_type.replace(/_/g,' ') }}</BadgePill></td>
              <td style="font-size:12px">{{ a.manufacturer }} {{ a.model }}</td>
              <td style="font-size:12px">{{ a.airline_iata ?? '-' }}</td>
              <td><BadgePill :variant="a.in_service ? 'success' : 'neutral'">{{ a.in_service ? 'Yes' : 'No' }}</BadgePill></td>
              <td>
                <BadgePill v-if="cofaStatusFor(a.registration)" :variant="statusBadge(cofaStatusFor(a.registration)!)">{{ cofaStatusFor(a.registration)!.replace(/_/g,' ') }}</BadgePill>
                <span v-else style="font-size:12px;color:var(--fg-3)">Not tracked</span>
              </td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="6" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No aircraft in the registry.' }}</td></tr></tbody>
        </table>
        <TablePagination
          :page="aircraftPage" :total-pages="aircraftTotalPages" :total="aircraftTotal"
          @prev="aircraftPrev" @next="aircraftNext"
        />
      </div>
    </div>
  </div>

  <!-- Airline AOC status (real) -->
  <SectionTitle pill="Live Registry">Airline AOC Status</SectionTitle>
  <div class="card">
    <div class="card-body">
      <table>
        <thead><tr><th>Airline</th><th>IATA</th><th>AOC Status</th><th>Cargo Only</th><th>Fleet Size</th></tr></thead>
        <tbody v-if="airlines.length">
          <tr v-for="al in airlinesPageRows" :key="al.id">
            <td style="font-weight:600;font-size:12px">{{ al.name }}</td>
            <td style="font-family:monospace;font-size:12px">{{ al.iata_code }}</td>
            <td><BadgePill :variant="aocBadge(al.aoc_status)">{{ al.aoc_status }}</BadgePill></td>
            <td><BadgePill :variant="al.is_cargo_only ? 'info' : 'neutral'">{{ al.is_cargo_only ? 'Yes' : 'No' }}</BadgePill></td>
            <td>{{ fmtNum(al.fleet_size) }}</td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="5" style="text-align:center;color:var(--fg-3);padding:16px">{{ loading ? 'Loading…' : 'No airlines in the registry.' }}</td></tr></tbody>
      </table>
      <TablePagination
        :page="airlinesPage" :total-pages="airlinesTotalPages" :total="airlinesTotal"
        @prev="airlinesPrev" @next="airlinesNext"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useAviationMaritime, useAviationLicensing } from '~/composables/api'
import type { Aircraft, Airline, AviationLicensingSummary, AviationLicence, AviationLicenceCategory, AviationLicenceHolderType, AviationLicenceStatus } from '~/composables/api'

const summary   = ref<AviationLicensingSummary | null>(null)
const licences  = ref<AviationLicence[]>([])
const renewals  = ref<AviationLicence[]>([])
const aircraft  = ref<Aircraft[]>([])
const airlines  = ref<Airline[]>([])
const loading   = ref(true)
const error     = ref<string | null>(null)
const acError   = ref(false)

const categoryFilter   = ref<'' | AviationLicenceCategory>('')
const holderTypeFilter = ref<'' | AviationLicenceHolderType>('')
const statusFilter     = ref<'' | AviationLicenceStatus>('')

async function load() {
  loading.value = true
  error.value = null
  const lic = useAviationLicensing()
  const avm = useAviationMaritime()

  const [sumRes, listRes, expRes, acRes, alRes] = await Promise.allSettled([
    lic.summary(),
    lic.list({ page_size: 100 }),
    lic.expiring(90),
    avm.aircraft({ page_size: 100 }),
    avm.airlines({ page_size: 50 }),
  ])

  if (sumRes.status  === 'fulfilled') summary.value = sumRes.value
  if (listRes.status === 'fulfilled') licences.value = (listRes.value as any).results ?? []
  if (expRes.status  === 'fulfilled') renewals.value = Array.isArray(expRes.value) ? expRes.value : (expRes.value as any).results ?? []
  if (acRes.status   === 'fulfilled') aircraft.value = (acRes.value as any).results ?? []
  if (alRes.status   === 'fulfilled') airlines.value = (alRes.value as any).results ?? []

  acError.value = acRes.status === 'rejected'

  if ([sumRes, listRes, expRes].every(r => r.status === 'rejected') && acRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Aviation API.'

  loading.value = false
}

onMounted(load)

const renewalsDue = computed(() => [...renewals.value].sort((a, b) => daysLeft(a.expiry_date) - daysLeft(b.expiry_date)))

const filteredLicences = computed(() => licences.value.filter(l => {
  if (categoryFilter.value && l.category !== categoryFilter.value) return false
  if (holderTypeFilter.value && l.holder_type !== holderTypeFilter.value) return false
  if (statusFilter.value && l.status !== statusFilter.value) return false
  return true
}))

// ── Table pagination (max 15 rows visible per table) ───────────────────
const {
  pageRows: renewalsPageRows, page: renewalsPage, totalPages: renewalsTotalPages,
  total: renewalsTotal, next: renewalsNext, prev: renewalsPrev,
} = usePagination(renewalsDue, 15)

const {
  pageRows: licencesPageRows, page: licencesPage, totalPages: licencesTotalPages,
  total: licencesTotal, next: licencesNext, prev: licencesPrev,
} = usePagination(filteredLicences, 15)

const {
  pageRows: aircraftPageRows, page: aircraftPage, totalPages: aircraftTotalPages,
  total: aircraftTotal, next: aircraftNext, prev: aircraftPrev,
} = usePagination(aircraft, 15)

const {
  pageRows: airlinesPageRows, page: airlinesPage, totalPages: airlinesTotalPages,
  total: airlinesTotal, next: airlinesNext, prev: airlinesPrev,
} = usePagination(airlines, 15)
const licenceExportColumns = [
  { key: 'holder_type', label: 'Holder Type' },
  { key: 'aircraft_registration', label: 'Aircraft' },
  { key: 'airline_iata', label: 'Airline' },
  { key: 'pilot_name', label: 'Pilot' },
  { key: 'category', label: 'Category' },
  { key: 'certificate_number', label: 'Certificate No.' },
  { key: 'issuing_authority', label: 'Issuing Authority' },
  { key: 'issued_date', label: 'Issued' },
  { key: 'expiry_date', label: 'Expiry' },
  { key: 'status', label: 'Status' },
]

const cofaByRegistration = computed(() => {
  const m = new Map<string, AviationLicenceStatus>()
  for (const l of licences.value) {
    if (l.category === 'certificate_of_airworthiness' && l.aircraft_registration) {
      m.set(l.aircraft_registration, l.status)
    }
  }
  return m
})
function cofaStatusFor(registration: string) {
  return cofaByRegistration.value.get(registration) ?? null
}

function holderLabel(l: AviationLicence) {
  if (l.holder_type === 'aircraft') return l.aircraft_registration ?? '-'
  if (l.holder_type === 'airline') return l.airline_name ?? l.airline_iata ?? '-'
  return l.pilot_name ?? l.pilot_licence_no ?? '-'
}
function categoryLabel(c: AviationLicenceCategory) {
  const m: Record<AviationLicenceCategory, string> = {
    certificate_of_registration: 'Cert. of Registration',
    certificate_of_airworthiness: 'Cert. of Airworthiness',
    noise_certificate: 'Noise Certificate',
    insurance: 'Insurance',
    radio_licence: 'Radio Licence',
    air_operator_certificate: 'AOC',
    pilot_licence: 'Pilot Licence',
    crew_licence: 'Crew Licence',
  }
  return m[c] ?? c
}
function statusBadge(s: AviationLicenceStatus) {
  const m: Record<AviationLicenceStatus, string> = { valid: 'success', expiring_soon: 'warning', expired: 'danger', suspended: 'danger', revoked: 'danger' }
  return m[s] ?? 'neutral'
}
function aocBadge(s: string) {
  const m: Record<string,string> = { valid: 'success', pending: 'warning', suspended: 'danger', revoked: 'danger' }
  return m[s] ?? 'neutral'
}
function daysLeft(expiry: string) {
  const ms = new Date(expiry).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}
function fmtDay(s: string) {
  try { return new Date(s).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return s }
}
function fmtNum(v: number | null | undefined, d = 0) {
  if (v == null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: d })
}
function pct(v: number | null | undefined) { return v == null ? '-' : `${v.toFixed(1)}%` }
</script>

<style scoped>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
.filter-row { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.table-scroll { overflow-x:auto; }
</style>
