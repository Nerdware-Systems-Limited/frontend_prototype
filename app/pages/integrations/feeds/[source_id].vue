<template>
  <PageHeader
    :eyebrow="source?.agency_name || 'Feed'"
    :title="sourceId"
    :subtitle="source ? `${source.source_system} · ${source.mode} · last synced ${source.last_sync_at ? fmtDate(source.last_sync_at) : 'never'}` : ''"
  >
    <template #breadcrumb>
      <NuxtLink to="/integrations/files?segment=feeds" class="ih-crumb">← Files &amp; Feeds</NuxtLink>
    </template>
    <template #actions>
      <button class="btn" :disabled="actionBusy" @click="trigger">Trigger sync</button>
      <button v-if="source?.status !== 'paused'" class="btn" :disabled="actionBusy" @click="pause">Pause</button>
      <button v-else class="btn" :disabled="actionBusy" @click="resume">Resume</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- ── Connection details — only for feeds registered through the
       Register-an-API console (blank protocol = legacy/seeded feed). ─── -->
  <div v-if="source?.protocol" class="ih-card ih-rise">
    <div class="ih-card-head">
      <h2>Connection details</h2>
      <button
        v-if="isPullProtocol" type="button" class="btn" :disabled="testingConnection"
        @click="retestConnection"
      >{{ testingConnection ? 'Testing…' : 'Test connection' }}</button>
    </div>
    <div class="ih-card-body">
      <dl class="conn-meta">
        <dt>Protocol</dt><dd>{{ protocolLabel }}</dd>
        <dt>Auth method</dt><dd>{{ authMethodLabel }}</dd>
        <dt>{{ isPullProtocol ? 'Endpoint' : 'Feed key' }}</dt><dd class="mono-sm">{{ source.endpoint_value || '-' }}</dd>
        <template v-if="isPullProtocol">
          <dt>Reconcile cron</dt><dd class="mono-sm">{{ source.reconcile_cron || '-' }}</dd>
        </template>
        <dt>Last test</dt>
        <dd>
          <template v-if="testResult">
            <span :class="testResult.ok ? 'test-ok' : 'test-bad'">{{ testResult.ok ? '✓ reachable' : '✕ ' + testResult.detail }}</span>
            <span class="hint"> · just now</span>
          </template>
          <template v-else-if="source.last_test_at">
            <span :class="source.last_test_ok ? 'test-ok' : 'test-bad'">{{ source.last_test_ok ? '✓ reachable' : '✕ unreachable' }}</span>
            <span class="hint"> · {{ fmtDate(source.last_test_at) }}</span>
          </template>
          <span v-else class="hint">never tested{{ isPullProtocol ? '' : ' (nothing to reach for a push feed)' }}</span>
        </dd>
      </dl>
    </div>
  </div>

  <!-- ── Headline ───────────────────────────────────────────────────── -->
  <div class="ih-ribbon ih-rise">
    <KpiTile label="Received · 24h" :value="fmt(stats?.received_24h)" :state="statState" />
    <KpiTile label="Received · 7d" :value="fmt(stats?.received_7d)" :state="statState" />
    <KpiTile label="Written · 7d" :value="fmt(stats?.domain_rows_created)" :state="statState" :sub="writtenSub" />
    <KpiTile label="Handler drop rate" :value="stats ? `${dropRate}%` : ''" :state="statState" sub="attempted, wrote nothing" />
  </div>

  <div v-if="stats" class="ih-card ih-rise ih-rise-2">
    <div class="ih-card-head"><h2>Received → written · last 7 days</h2></div>
    <div class="ih-card-body">
      <ReconciliationFunnel
        :stages="[
          { label: 'Received (7d)', value: stats.received_7d },
          { label: 'Attempted', value: stats.attempted },
          { label: 'Written', value: stats.domain_rows_created, variant: stats.domain_rows_created ? 'success' : 'danger' },
        ]"
      />
      <div v-if="stats.received_7d > 0 && stats.domain_rows_created === 0" class="silent-failure-banner">
        ⚠ This feed received {{ stats.received_7d.toLocaleString('en-KE') }} record(s) in the last 7 days and
        wrote <strong>zero</strong> domain rows. It still shows as “connected”: the sync works, but nothing it
        delivers is landing. Check the handler errors below.
      </div>

      <div v-if="stats.daily_received.length" class="ih-sparkbars">
        <div v-for="d in stats.daily_received" :key="d.date" class="ih-sparkbar">
          <span class="ih-sparkbar-count">{{ d.count || '' }}</span>
          <div class="ih-sparkbar-track">
            <div class="ih-sparkbar-fill" :style="{ transform: `scaleY(${dailyBarHeight(d.count) / 100})` }" />
          </div>
          <span class="ih-sparkbar-label">{{ fmtDay(d.date) }}</span>
        </div>
      </div>
    </div>
  </div>

  <div v-if="stats?.unrecognised_record_types.length" class="ih-card ih-rise ih-rise-3">
    <div class="ih-card-head"><h2>Unrecognised record types</h2></div>
    <div class="ih-card-body">
      <p class="ih-lead">
        These <code>record_type</code> values never reached a handler. Either there's no handler for this
        source, or the payload's <code>record_type</code> doesn't match what the handler expects.
      </p>
      <div class="ih-chips">
        <BadgePill v-for="t in stats.unrecognised_record_types" :key="t" variant="warning">{{ t }}</BadgePill>
      </div>
    </div>
  </div>

  <div v-if="stats?.top_handler_errors.length" class="ih-card ih-rise ih-rise-3">
    <div class="ih-card-head"><h2>Top handler errors · last 7 days</h2></div>
    <div class="ih-card-body ih-table-wrap">
      <table class="ih-table">
        <thead><tr><th>Count</th><th>Message</th></tr></thead>
        <tbody>
          <tr v-for="e in stats.top_handler_errors" :key="e.message">
            <td class="mono-sm num">{{ e.count }}</td>
            <td>{{ e.message }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="ih-card ih-rise ih-rise-4">
    <div class="ih-card-head"><h2>Last 50 raw payloads</h2></div>
    <div class="ih-card-body">
      <EmptyState v-if="stats && !stats.recent.length" message="No records received from this feed yet." />
      <div v-else class="payload-list">
        <div v-for="r in stats?.recent" :key="r.id" class="payload-item">
          <div class="payload-meta">
            <span class="mono-sm">{{ r.event_at ? fmtDate(r.event_at) : '-' }}</span>
            <BadgePill v-if="r.target_model" variant="success">{{ r.target_model.split('.').pop() }}</BadgePill>
            <BadgePill v-else-if="r.handler_error" variant="danger">handler failed</BadgePill>
            <BadgePill v-else variant="neutral">unhandled</BadgePill>
            <span v-if="r.record_type" class="mono-sm hint">{{ r.record_type }}</span>
          </div>
          <div v-if="r.handler_error" class="payload-error">⚠ {{ r.handler_error }}</div>
          <JsonViewer :value="r.payload" label="payload" collapsible />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { useIntegrations } from '~/composables/api'
import type { DataSource, DataSourceStats, RegisterAuthMethod, RegisterProtocol, TestConnectionResult } from '~/composables/api'

const route = useRoute()
const api = useIntegrations()
const sourceId = route.params.source_id as string

const source = ref<DataSource | null>(null)
const stats = ref<DataSourceStats | null>(null)
const error = ref<string | null>(null)

// Mirrors apps.integrations.protocols — see that module's docstring for
// why this isn't fetched dynamically. Only the bits this page needs
// (labels + push/pull direction); the richer register-console copy
// lives in app/pages/integrations/index.vue.
const PROTOCOL_LABELS: Record<RegisterProtocol, string> = {
  rest_push: 'REST push', webhook: 'Webhook', streaming: 'Streaming',
  rest_pull: 'REST pull', sftp: 'SFTP drop', database: 'Database pull',
}
const AUTH_LABELS: Record<RegisterAuthMethod, string> = {
  api_key: 'API key', hmac: 'HMAC signature', bearer: 'Bearer token',
  basic: 'Basic auth', oauth2: 'OAuth2', mtls: 'mTLS',
}
const PULL_PROTOCOLS: RegisterProtocol[] = ['rest_pull', 'sftp', 'database']
const isPullProtocol = computed(() => !!source.value?.protocol && PULL_PROTOCOLS.includes(source.value.protocol as RegisterProtocol))
const protocolLabel = computed(() => {
  const p = source.value?.protocol
  return p ? (PROTOCOL_LABELS[p] ?? p) : '-'
})
const authMethodLabel = computed(() => {
  const m = source.value?.auth_method
  return m ? (AUTH_LABELS[m] ?? m) : '-'
})

const testingConnection = ref(false)
const testResult = ref<TestConnectionResult | null>(null)
async function retestConnection() {
  testingConnection.value = true
  testResult.value = null
  try {
    const res = await api.testConnection({ source_id: sourceId })
    testResult.value = res
    if (source.value) {
      source.value = { ...source.value, last_test_at: res.last_test_at ?? source.value.last_test_at, last_test_ok: res.ok }
    }
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not run the connection test.'
  } finally {
    testingConnection.value = false
  }
}

const statState = computed<'loading' | 'ok' | 'unavailable'>(
  () => error.value ? 'unavailable' : stats.value ? 'ok' : 'loading',
)
const writtenSub = computed(() =>
  stats.value && stats.value.received_7d > 0 && stats.value.domain_rows_created === 0
    ? 'nothing is landing'
    : 'domain rows created',
)
function fmt(n: number | undefined): string {
  return n === undefined ? '' : n.toLocaleString('en-KE')
}

const dropRate = computed(() => {
  if (!stats.value || !stats.value.attempted) return 0
  const dropped = stats.value.attempted - stats.value.domain_rows_created
  return Math.round((dropped / stats.value.attempted) * 100)
})

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { weekday: 'short' })
}
function dailyBarHeight(count: number): number {
  const max = Math.max(1, ...(stats.value?.daily_received.map(d => d.count) ?? [1]))
  return Math.max(4, Math.round((count / max) * 100)) // 4% floor so a zero day still shows a sliver
}

async function load() {
  try {
    const [sourceRes, statsRes] = await Promise.all([api.get(sourceId), api.feedStats(sourceId)])
    source.value = sourceRes
    stats.value = statsRes
    error.value = null
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Could not load this feed.'
  }
}

// ── Registry control actions (no-ops server-side; real scheduler picks
// them up — see DataSourceViewSet) ─────────────────────────────────────
const actionBusy = ref(false)
async function trigger() {
  actionBusy.value = true
  try { await api.trigger(sourceId); await load() } catch { /* transient — leave prior state visible */ } finally { actionBusy.value = false }
}
async function pause() {
  actionBusy.value = true
  try { await api.pause(sourceId); if (source.value) source.value = { ...source.value, status: 'paused' } } catch {} finally { actionBusy.value = false }
}
async function resume() {
  actionBusy.value = true
  try { await api.resume(sourceId); if (source.value) source.value = { ...source.value, status: 'connected' } } catch {} finally { actionBusy.value = false }
}

onMounted(load)
</script>

<style scoped>
.error-banner {
  background: var(--danger-bg); border: 1px solid var(--danger-fg); color: var(--danger-fg);
  border-radius: var(--r-sm); padding: 10px 12px; font-size: 12.5px; margin-bottom: 14px;
}
.silent-failure-banner {
  background: var(--danger-bg); border: 1px solid var(--danger-fg); color: var(--danger-fg);
  border-radius: var(--r-sm); padding: 10px 12px; font-size: 12.5px; line-height: 1.5; margin-top: 12px;
}

.payload-list { display: flex; flex-direction: column; gap: 10px; }
.payload-item { border: 1px solid var(--border-subtle); border-radius: var(--r-sm); padding: 10px 12px; background: var(--surface-1); }
.payload-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.payload-error { font-size: 12px; color: var(--danger-fg); margin-bottom: 6px; }

.conn-meta { display: grid; grid-template-columns: 140px 1fr; row-gap: 10px; column-gap: 12px; font-size: 12.5px; margin: 0; }
.conn-meta dt { color: var(--fg-3); }
.conn-meta dd { margin: 0; color: var(--fg-1); overflow-wrap: anywhere; }
.test-ok { color: var(--success-fg); font-weight: 600; }
.test-bad { color: var(--danger-fg); font-weight: 600; }
</style>
