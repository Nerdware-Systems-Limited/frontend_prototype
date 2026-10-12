<template>
  <PageHeader
    eyebrow="GIS & Spatial Analysis"
    title="Layer Requests"
    subtitle="Uploads that admins have asked specific people to provide - who, for which layer, by when"
  >
    <template #actions>
      <NuxtLink to="/gis/coverage" class="btn">Coverage tracker →</NuxtLink>
      <NuxtLink to="/integrations?tab=gis" class="btn btn-primary">Upload a layer →</NuxtLink>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <div class="ih-ribbon">
    <KpiTile label="Open" :value="count('open')" :state="kpi" sub="waiting on an upload" />
    <KpiTile label="Overdue" :value="overdue" :state="kpi" sub="past the due date" />
    <KpiTile label="Fulfilled" :value="count('fulfilled')" :state="kpi" sub="layer uploaded" />
    <KpiTile label="Cancelled" :value="count('cancelled')" :state="kpi" sub="withdrawn" />
  </div>

  <FilterBar>
    <input v-model="q" class="select-sm" type="search" placeholder="Search layer, person or agency…" aria-label="Search" />
    <select v-model="status" class="select-sm" aria-label="Status">
      <option value="">All statuses</option>
      <option value="open">open</option><option value="fulfilled">fulfilled</option><option value="cancelled">cancelled</option>
    </select>
    <select v-model="agency" class="select-sm" aria-label="Agency">
      <option value="">All agencies</option>
      <option v-for="a in agencies" :key="a" :value="a">{{ a }}</option>
    </select>
    <label class="hint"><input v-model="mine" type="checkbox" @change="load" /> Asked of me</label>
    <label class="hint"><input v-model="onlyOverdue" type="checkbox" /> Overdue only</label>
    <span class="hint">{{ filtered.length }} of {{ rows.length }}</span>
  </FilterBar>

  <div class="card"><div class="card-body">
    <EmptyState v-if="!loading && !filtered.length" icon="inbox" message="No requests match these filters." />
    <table v-else class="stack-table">
      <thead><tr><th>Layer</th><th>Agency</th><th>Asked of</th><th>Asked by</th><th>Due</th><th>Status</th><th>Message</th><th /></tr></thead>
      <tbody>
        <tr v-for="r in filtered" :key="r.id">
          <td data-label="Layer"><strong>{{ r.requirement_name }}</strong></td>
          <td data-label="Agency">{{ r.agency_code }}</td>
          <td data-label="Asked of">{{ r.assignee_name }}<div class="hint">{{ r.assignee_email }}</div></td>
          <td data-label="Asked by" class="hint">{{ r.requested_by_name || '-' }}<div>{{ fmtDate(r.created_at) }}</div></td>
          <td data-label="Due"><span :class="{ late: isLate(r) }">{{ r.due_date ? fmtDate(r.due_date) : '-' }}</span><span v-if="isLate(r)" class="hint"> overdue</span></td>
          <td data-label="Status"><BadgePill :variant="r.status === 'open' ? 'warning' : r.status === 'fulfilled' ? 'success' : 'neutral'">{{ r.status }}</BadgePill></td>
          <td data-label="Message" class="hint">{{ r.message }}</td>
          <td class="row-actions">
            <NuxtLink v-if="r.status === 'fulfilled' && r.fulfilled_by_layer" class="btn btn-sm" :to="`/gis/layers/${r.fulfilled_by_layer}`">Layer</NuxtLink>
            <NuxtLink v-if="r.status === 'open' && mine" class="btn btn-sm btn-primary" to="/integrations?tab=gis">Upload</NuxtLink>
            <button v-if="r.status === 'open' && isAdmin" class="btn btn-sm btn-tone-danger" @click="cancel(r.id)">Cancel</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div></div>
</template>

<script setup lang="ts">
import { useGisLayers, type GeoLayerRequest } from '~/composables/api/useGisLayers'
import { fmtDate } from '~/utils/gisFormat'

definePageMeta({ layout: 'default' })
useHead({ title: 'GIS Layer Requests' })

const gis = useGisLayers()
const auth = useAuth()
const isAdmin = computed(() => ['admin', 'ministry_admin', 'super_admin'].includes(auth.user.value?.role_type || '') || !!auth.user.value?.is_staff)

const rows = ref<GeoLayerRequest[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const kpi = computed(() => (loading.value ? 'loading' : error.value ? 'unavailable' : 'ok') as 'loading' | 'ok' | 'unavailable')
const q = ref(''); const status = ref(''); const agency = ref(''); const mine = ref(!isAdmin.value); const onlyOverdue = ref(false)

const today = new Date().toISOString().slice(0, 10)
const isLate = (r: GeoLayerRequest) => r.status === 'open' && !!r.due_date && r.due_date < today
const count = (s: string) => rows.value.filter(r => r.status === s).length
const overdue = computed(() => rows.value.filter(isLate).length)
const agencies = computed(() => [...new Set(rows.value.map(r => r.agency_code))].sort())
const filtered = computed(() => {
  const n = q.value.trim().toLowerCase()
  return rows.value.filter(r =>
    (!n || [r.requirement_name, r.assignee_name, r.assignee_email, r.agency_code].some(v => v?.toLowerCase().includes(n)))
    && (!status.value || r.status === status.value)
    && (!agency.value || r.agency_code === agency.value)
    && (!onlyOverdue.value || isLate(r)))
})

async function load() {
  loading.value = true; error.value = null
  try { rows.value = await gis.requests.list({ mine: mine.value }) }
  catch (e: any) { error.value = e?.data?.message || e?.message || 'Could not load requests.' }
  finally { loading.value = false }
}
async function cancel(id: string) {
  try { await gis.requests.cancel(id); await load() }
  catch (e: any) { error.value = e?.data?.message || e?.message || 'Could not cancel the request.' }
}
onMounted(load)
</script>

<style scoped>
.row-actions { white-space: nowrap; display: flex; gap: 6px; }
.late { color: var(--danger-fg); font-weight: 700; }
</style>
