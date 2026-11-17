<template>
  <PageHeader
    :eyebrow="source?.agency_name || 'Feed'"
    :title="sourceId"
    :subtitle="source ? `${source.source_system} · ${source.mode} · last synced ${source.last_sync_at ? fmtDate(source.last_sync_at) : 'never'}` : ''"
  >
    <template #actions>
      <NuxtLink to="/integrations/files?segment=feeds" class="btn"><ArrowLeft :size="13" aria-hidden="true" />Files &amp; Feeds</NuxtLink>
      <button class="btn" :disabled="actionBusy" @click="trigger">Trigger sync</button>
      <button v-if="source?.status !== 'paused'" class="btn" :disabled="actionBusy" @click="pause">Pause</button>
      <button v-else class="btn" :disabled="actionBusy" @click="resume">Resume</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner banner-icon-warn" role="alert">{{ error }}</div>

  <!-- ── Connection details - only for feeds registered through the
       Register-an-API console (blank protocol = legacy/seeded feed). ─── -->
  <div v-if="source?.protocol" class="ih-card ih-rise">
    <div class="ih-card-head">
      <h2>Connection details</h2>
      <div class="head-actions">
        <button
          v-if="isPullProtocol && !editing" type="button" class="btn" :disabled="testingConnection"
          @click="retestConnection"
        >{{ testingConnection ? 'Testing…' : 'Test connection' }}</button>
        <button v-if="isPullProtocol && !editing" type="button" class="btn btn-primary" @click="startEdit">Edit link &amp; key</button>
      </div>
    </div>
    <div class="ih-card-body">
      <div v-if="saveNote" class="save-note banner-icon-ok" role="status">{{ saveNote }}</div>
      <dl v-if="!editing" class="conn-meta">
        <dt>Protocol</dt><dd>{{ protocolLabel }}</dd>
        <dt>Auth method</dt><dd>{{ authMethodLabel }}</dd>
        <dt>{{ isPullProtocol ? 'Link' : 'Feed key' }}</dt><dd class="mono-sm">{{ source.endpoint_value || '-' }}</dd>
        <template v-if="isPullProtocol">
          <dt>API key</dt>
          <dd>
            <span v-if="source.has_credentials" class="test-ok">●●●●●●●● stored (encrypted)</span>
            <span v-else class="hint">none</span>
          </dd>
          <dt>Reconcile cron</dt><dd class="mono-sm">{{ source.reconcile_cron || '-' }}</dd>
        </template>
        <template v-if="source.monitoring">
          <dt>Monitoring area</dt>
          <dd>
            <span class="mono-sm">{{ source.monitoring.bbox }}</span>
            <span class="hint"> · west, south, east, north{{ source.options?.bbox ? '' : ' (platform default)' }}</span>
          </dd>
          <dt>Roads polled</dt>
          <dd>
            <strong>{{ source.monitoring.points }}</strong> points on {{ source.monitoring.road_classes.join('/') }} roads from the
            {{ source.monitoring.road_source }}
            <span class="hint"> · quota allows {{ source.monitoring.points_per_cycle_allowed }} per pull</span>
            <span v-if="source.monitoring.degraded_points" class="test-bad"> · {{ source.monitoring.degraded_points }} not returning data</span>
          </dd>
        </template>
        <dt>Last test</dt>
        <dd>
          <template v-if="testResult">
            <span :class="testResult.ok ? 'test-ok banner-icon-ok' : 'test-bad banner-icon-fail'">{{ testResult.detail }}</span>
            <span class="hint"> · just now</span>
          </template>
          <template v-else-if="source.last_test_at">
            <span :class="source.last_test_ok ? 'test-ok banner-icon-ok' : 'test-bad banner-icon-fail'">{{ source.last_test_ok ? 'Working' : 'Failed' }}</span>
            <span class="hint"> · {{ fmtDate(source.last_test_at) }}</span>
          </template>
          <span v-else class="hint">never tested{{ isPullProtocol ? '' : ' (nothing to reach for a push feed)' }}</span>
        </dd>
      </dl>

      <form v-else class="edit-form" @submit.prevent="saveEdit">
        <label class="field">
          <span class="field-label">Link</span>
          <input v-model="form.endpoint_value" class="select-sm field-input" autocomplete="off" spellcheck="false" />
        </label>
        <label class="field">
          <span class="field-label">
            API key
            <button type="button" class="reveal-btn" @click="keyShown = !keyShown">{{ keyShown ? 'hide' : 'reveal' }}</button>
          </span>
          <input
            v-model="form.key" class="select-sm field-input" :type="keyShown ? 'text' : 'password'" autocomplete="off" spellcheck="false"
            :disabled="form.clear_key"
            :placeholder="source.has_credentials ? 'A key is stored - type a new one to replace it' : 'No key stored'"
          />
        </label>
        <label v-if="source.has_credentials" class="check">
          <input v-model="form.clear_key" type="checkbox" /> Remove the stored key
        </label>
        <label class="field">
          <span class="field-label">Pull schedule (cron)</span>
          <input v-model="form.reconcile_cron" class="select-sm field-input" autocomplete="off" />
        </label>
        <template v-if="source.supports_area">
          <label class="field">
            <span class="field-label">Monitoring area <span class="hint">west, south, east, north - empty = platform default</span></span>
            <input v-model="form.bbox" class="select-sm field-input" placeholder="36.65,-1.45,37.05,-1.16" autocomplete="off" spellcheck="false" />
          </label>
          <label class="field">
            <span class="field-label">Max road points <span class="hint">empty = as many as the daily quota allows</span></span>
            <input v-model="form.max_points" class="select-sm field-input" inputmode="numeric" autocomplete="off" />
          </label>
          <p class="hint">
            Points are picked automatically from the UAPTS road network inside this area, major roads first, and refreshed after you save.
          </p>
        </template>
        <p class="hint">Leave the key empty to keep the current one. A pasted sample call with <code>?key=…</code> is split for you.</p>
        <div v-if="editError" class="error-banner banner-icon-warn" role="alert">{{ editError }}</div>
        <div class="edit-actions">
          <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save changes' }}</button>
          <button type="button" class="btn" :disabled="saving" @click="editing = false">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <!-- ── Tables this feed writes to ────────────────────────────────── -->
  <div v-if="source?.target_tables?.length" class="ih-card ih-rise ih-rise-2">
    <div class="ih-card-head"><h2>Tables written</h2><span class="hint">where this feed's data lands</span></div>
    <div class="ih-card-body ih-table-wrap">
      <table class="ih-table stack-table">
        <thead><tr><th>Data</th><th>Table</th><th class="num">Rows</th><th>What counts</th></tr></thead>
        <tbody>
          <tr v-for="t in source.target_tables" :key="t.model">
            <td data-label="Data">{{ t.label }}</td>
            <td class="mono-sm" data-label="Table">{{ t.table || t.model }}</td>
            <td class="mono-sm num" data-label="Rows">{{ t.rows.toLocaleString('en-KE') }}</td>
            <td class="hint" data-label="What counts">{{ t.note }}</td>
          </tr>
        </tbody>
      </table>
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
      <div v-if="stats.received_7d > 0 && stats.domain_rows_created === 0" class="silent-failure-banner banner-icon-warn" role="alert">
        This feed received {{ stats.received_7d.toLocaleString('en-KE') }} record(s) in the last 7 days and
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
      <table class="ih-table stack-table">
        <thead><tr><th>Count</th><th>Message</th></tr></thead>
        <tbody>
          <tr v-for="e in stats.top_handler_errors" :key="e.message">
            <td class="mono-sm num" data-label="Count">{{ e.count }}</td>
            <td class="stack-block err-msg" data-label="Message">{{ e.message }}</td>
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
          <div v-if="r.handler_error" class="payload-error banner-icon-warn">{{ r.handler_error }}</div>
          <JsonViewer :value="r.payload" label="payload" collapsible />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowLeft } from 'lucide-vue-next'

import { useIntegrations } from '~/composables/api'
import type { DataSource, DataSourceStats, RegisterAuthMethod, RegisterProtocol, TestConnectionResult, UpdateConnectionPayload } from '~/composables/api'

const route = useRoute()
const api = useIntegrations()
const sourceId = route.params.source_id as string

const source = ref<DataSource | null>(null)
const stats = ref<DataSourceStats | null>(null)
const error = ref<string | null>(null)

// Mirrors apps.integrations.protocols - see that module's docstring for
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

// ── Edit link / key / schedule (PATCH /integrations/<id>/connection/) ──
const editing = ref(false)
const saving = ref(false)
const editError = ref<string | null>(null)
const saveNote = ref<string | null>(null)
const keyShown = ref(false)
const form = reactive({ endpoint_value: '', key: '', clear_key: false, reconcile_cron: '', bbox: '', max_points: '' })
function startEdit() {
  if (!source.value) return
  Object.assign(form, {
    endpoint_value: source.value.endpoint_value, key: '', clear_key: false, reconcile_cron: source.value.reconcile_cron,
    bbox: source.value.options?.bbox ?? '', max_points: source.value.options?.max_points != null ? String(source.value.options.max_points) : '',
  })
  editError.value = null
  saveNote.value = null
  keyShown.value = false
  editing.value = true
}
async function saveEdit() {
  if (!source.value) return
  const cur = source.value
  const payload: UpdateConnectionPayload = {}
  if (form.endpoint_value.trim() !== cur.endpoint_value) payload.endpoint_value = form.endpoint_value.trim()
  if (form.reconcile_cron.trim() !== cur.reconcile_cron) payload.reconcile_cron = form.reconcile_cron.trim()
  if (cur.supports_area) {
    const bbox = form.bbox.trim()
    const mp = String(form.max_points).trim()
    const was = cur.options ?? {}
    if (bbox !== (was.bbox ?? '') || mp !== (was.max_points != null ? String(was.max_points) : '')) {
      if (mp && !/^\d+$/.test(mp)) { editError.value = 'Max road points must be a whole number.'; return }
      payload.options = { bbox, max_points: mp ? Number(mp) : '' }
    }
  }
  if (form.clear_key) payload.clear_key = true
  else if (form.key.trim()) payload.key = form.key.trim()
  if (!Object.keys(payload).length) { editing.value = false; return }
  saving.value = true
  editError.value = null
  try {
    await api.updateConnection(sourceId, payload)
    testResult.value = null
    await load()                       // the detail response carries tables + has_credentials
    editing.value = false
    saveNote.value = 'Saved. Use "Test connection" to check it, or "Trigger sync" to pull now.'
  } catch (e: any) {
    editError.value = e?.data?.message || e?.data?.detail || e?.message || 'Could not save the changes.'
  } finally {
    saving.value = false
  }
}

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
// them up - see DataSourceViewSet) ─────────────────────────────────────
const actionBusy = ref(false)
async function trigger() {
  actionBusy.value = true
  try { await api.trigger(sourceId); await load(); setTimeout(load, 6000) } catch { /* transient - leave prior state visible */ } finally { actionBusy.value = false }
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
.head-actions { display: flex; gap: 8px; }
.edit-form { display: grid; gap: 12px; max-width: 640px; }
.edit-actions { display: flex; gap: 8px; }
.check { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--fg-2); }
.save-note { background: var(--success-bg); color: var(--success-fg); border-radius: var(--r-sm); padding: 8px 12px; font-size: 12.5px; margin-bottom: 12px; }
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
.err-msg { overflow-wrap: anywhere; }

@media (max-width: 560px) {
  /* Caption above value - a 140px caption column leaves an endpoint URL
     a sliver of the card to wrap into. */
  .conn-meta { grid-template-columns: minmax(0, 1fr); row-gap: 2px; }
  .conn-meta dd { margin-bottom: 8px; }
  .payload-item { padding: 9px 10px; min-width: 0; }
}
</style>
