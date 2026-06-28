<template>
  <PageHeader
    eyebrow="M15 - Data Integration Hub"
    title="Integrations"
    subtitle="All 15 UAPTS agency feeds - NTSA · KeNHA · KURA · KeRRA · KRB · KAA · KCAA · KMD · KenTrade · LAPSSET · NaMATA · KRC · KPA · KMA · NCTTCA"
  >
    <template #actions>
      <button class="btn" :disabled="loading" @click="load">↻ Refresh</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Summary KPIs -->
  <div class="kpi-grid">
    <KpiCard
      label="Total Feeds"
      :value="String(integrations.length)"
      sub="Registered integrations"
      source="live" source-title="UAPTS"
    />
    <KpiCard
      label="Connected"
      :value="String(byStatus('connected'))"
      sub="Actively syncing"
      trend-direction="up"
      source="live" source-title="UAPTS"
    />
    <KpiCard
      label="Degraded"
      :value="String(byStatus('degraded'))"
      sub="Partial / error"
      :trend-direction="byStatus('degraded') === 0 ? 'up' : 'down'"
      source="live" source-title="UAPTS"
    />
    <KpiCard
      label="Disconnected"
      :value="String(byStatus('disconnected'))"
      sub="Not syncing"
      :trend-direction="byStatus('disconnected') === 0 ? 'up' : 'down'"
      source="live" source-title="UAPTS"
    />
    <KpiCard
      label="Records Today"
      :value="fmtNum(totalRecordsToday)"
      sub="Across all feeds"
      source="live" source-title="UAPTS"
    />
  </div>

  <!-- Filters -->
  <div class="filter-bar">
    <select v-model="statusFilter" class="select-sm">
      <option value="">All statuses</option>
      <option value="connected">Connected</option>
      <option value="degraded">Degraded</option>
      <option value="disconnected">Disconnected</option>
      <option value="paused">Paused</option>
    </select>
    <select v-model="modeFilter" class="select-sm">
      <option value="">All modes</option>
      <option value="push">Push</option>
      <option value="pull">Pull</option>
      <option value="webhook">Webhook</option>
    </select>
    <input v-model="agencySearch" class="select-sm" placeholder="Agency code…" style="min-width:130px" />
    <button class="btn" @click="statusFilter=''; modeFilter=''; agencySearch=''">Reset</button>
    <span style="flex:1" />
    <span style="font-size:12px;color:#64748b">{{ filteredIntegrations.length }} feeds</span>
  </div>

  <!-- Feed table -->
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Agency</th>
            <th>Source System</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Last Sync</th>
            <th>Records Today</th>
            <th>Endpoint</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody v-if="filteredIntegrations.length">
          <template v-for="i in filteredIntegrations" :key="i.id">
            <tr @click="expanded = expanded === i.id ? null : i.id" class="feed-row">
              <td><BadgePill variant="neutral">{{ i.agency_code }}</BadgePill></td>
              <td style="font-weight:600">{{ i.name }}</td>
              <td><BadgePill variant="info">{{ i.mode }}</BadgePill></td>
              <td><BadgePill :variant="statusBadge(i.status)">{{ i.status }}</BadgePill></td>
              <td style="font-size:12px;white-space:nowrap">{{ i.last_sync_at ? fmtTime(i.last_sync_at) : 'Never' }}</td>
              <td style="font-weight:600;text-align:right">{{ fmtNum(i.records_today ?? 0) }}</td>
              <td style="font-size:11px;font-family:monospace;color:#64748b;max-width:160px;overflow:hidden;text-overflow:ellipsis">
                {{ i.endpoint_url }}
              </td>
              <td>
                <div style="display:flex;gap:4px">
                  <button
                    class="btn" style="font-size:12px"
                    :disabled="actionId === i.id"
                    @click.stop="trigger(i.id)"
                  >⚡ Sync</button>
                  <button
                    v-if="i.status !== 'paused'"
                    class="btn" style="font-size:12px;color:#ca8a04"
                    :disabled="actionId === i.id"
                    @click.stop="pause(i.id)"
                  >⏸ Pause</button>
                  <button
                    v-else
                    class="btn" style="font-size:12px;color:#16a34a"
                    :disabled="actionId === i.id"
                    @click.stop="resume(i.id)"
                  >▶ Resume</button>
                </div>
              </td>
            </tr>
            <tr v-if="expanded === i.id" :key="`${i.id}-detail`">
              <td colspan="8" class="error-row">
                <div class="error-detail">
                  <div style="font-size:12px;font-weight:600;margin-bottom:4px">
                    <span :style="{ color: i.status === 'degraded' || i.status === 'disconnected' ? '#dc2626' : '#15803d' }">
                      {{ i.status === 'degraded' || i.status === 'disconnected' ? '⚠ Last Error' : '✓ No Errors' }}
                    </span>
                  </div>
                  <div style="font-size:12px;font-family:monospace;color:#475569;white-space:pre-wrap">
                    {{ i.last_error ?? 'No errors recorded.' }}
                  </div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:4px">
                    Endpoint: {{ i.endpoint_url }}
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
        <tbody v-else>
          <tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px">{{ loading ? 'Loading integrations…' : 'No feeds match the current filters.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Integrations')

import { useIntegrations } from '~/composables/api'
import type { Integration } from '~/composables/api'

const integrations = ref<Integration[]>([])
const loading      = ref(true)
const error        = ref<string | null>(null)
const lastRefreshed = ref('-')
const expanded     = ref<string | null>(null)
const actionId     = ref<string | null>(null)

const statusFilter = ref('')
const modeFilter   = ref('')
const agencySearch = ref('')

async function load() {
  loading.value = true
  error.value = null
  const [res] = await Promise.allSettled([useIntegrations().list({ page_size: 100 })])
  if (res.status === 'fulfilled') integrations.value = (res.value as any).results ?? []
  else error.value = 'Unable to reach the UAPTS Integrations API.'
  lastRefreshed.value = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

const filteredIntegrations = computed(() =>
  integrations.value.filter(i => {
    if (statusFilter.value && i.status !== statusFilter.value) return false
    if (modeFilter.value   && i.mode !== modeFilter.value)     return false
    if (agencySearch.value && !i.agency_code.toLowerCase().includes(agencySearch.value.toLowerCase())) return false
    return true
  }),
)

const totalRecordsToday = computed(() =>
  integrations.value.reduce((s, i) => s + (i.records_today ?? 0), 0),
)
function byStatus(s: string) { return integrations.value.filter(i => i.status === s).length }

async function trigger(id: string) {
  actionId.value = id
  try { await useIntegrations().trigger(id); await load() } catch {} finally { actionId.value = null }
}
async function pause(id: string) {
  actionId.value = id
  try {
    await useIntegrations().pause(id)
    const idx = integrations.value.findIndex(i => i.id === id)
    if (idx !== -1) integrations.value[idx] = { ...integrations.value[idx], status: 'paused' }
  } catch {} finally { actionId.value = null }
}
async function resume(id: string) {
  actionId.value = id
  try {
    await useIntegrations().resume(id)
    const idx = integrations.value.findIndex(i => i.id === id)
    if (idx !== -1) integrations.value[idx] = { ...integrations.value[idx], status: 'connected' }
  } catch {} finally { actionId.value = null }
}

function statusBadge(s: string) {
  const m: Record<string,string> = { connected:'success', degraded:'warning', disconnected:'danger', paused:'neutral' }
  return m[s] ?? 'neutral'
}
function fmtNum(v: number) { return v.toLocaleString() }
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
.freshness-badge.loading { background:#fefce8; color:#854d0e; border-color:#fef08a; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:16px; }
.feed-row { cursor:pointer; }
.feed-row:hover { background:#f8fafc; }
.error-row { background:#fef2f2; }
.error-detail { padding:8px 12px; }
</style>
