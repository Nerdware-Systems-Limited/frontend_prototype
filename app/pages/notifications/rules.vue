<template>
  <PageHeader
    eyebrow="Platform Notifications - Rules Engine"
    title="Alert Rules & Escalation"
    subtitle="Threshold-based alert rules, escalation workflows, and delivery activity across every UAPTS module"
  >
    <template #actions>
      <NuxtLink to="/notifications" class="btn">← Feed</NuxtLink>
      <button class="btn-primary" @click="openCreate">+ Create Rule</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- KPI row - matches the standard .kpi-grid/KpiCard pattern used across every other module -->
  <div class="kpi-grid">
    <KpiCard label="Alerts Sent (24h)" :value="fmtNum(stats?.alerts_sent_24h)" :unavailable="!stats" :unavailable-note="loading ? 'Loading…' : 'Notifications feed unavailable'" period="24H" to="#recent-alert-activity" />
    <KpiCard label="Active Rules" :value="fmtNum(stats?.active_rules)" :unavailable="!stats" :unavailable-note="loading ? 'Loading…' : 'Notifications feed unavailable'" period="LIVE" to="#alert-rules-list" />
    <KpiCard
      label="Avg Delivery Time"
      :value="stats?.avg_delivery_seconds != null ? `${stats.avg_delivery_seconds}s` : '-'"
      :unavailable="!stats"
      :unavailable-note="loading ? 'Loading…' : 'Notifications feed unavailable'"
      period="24H"
      to="#recent-alert-activity"
    />
    <KpiCard
      label="Delivery Rate"
      :value="stats?.delivery_rate_pct != null ? `${stats.delivery_rate_pct}%` : '-'"
      :unavailable="!stats"
      :unavailable-note="loading ? 'Loading…' : 'Notifications feed unavailable'"
      period="24H"
      to="#recent-alert-activity"
    />
  </div>

  <!-- Rules + Escalation designer -->
  <div class="grid-2">
    <!-- Alert Rules -->
    <div id="alert-rules-list" class="card drill-target">
      <div class="card-header">
        Threshold-Based Alert Rules
        <button class="mini-btn" @click="openCreate">+ Add Rule</button>
      </div>
      <div class="card-body" style="padding:12px">
        <div v-if="rulesPageRows.length" class="rule-list">
          <div v-for="r in rulesPageRows" :key="r.id" class="rule-card">
            <div class="rule-card-top">
              <div>
                <div class="rule-name">{{ r.name }}</div>
                <div class="rule-desc">{{ r.message_template || r.event_type }}</div>
              </div>
              <BadgePill :variant="r.active ? 'success' : 'warning'">{{ r.active ? 'Active' : 'Paused' }}</BadgePill>
            </div>
            <div class="rule-meta-row">
              <span class="rule-meta-chip"><strong>Channel:</strong> {{ (r.channels ?? []).join(', ') || '-' }}</span>
              <span class="rule-meta-chip"><strong>Recipients:</strong> {{ (r.target_roles ?? []).join(', ') || 'All' }}</span>
              <span class="rule-meta-chip"><strong>Cooldown:</strong> {{ r.cooldown_seconds ? `${r.cooldown_seconds}s` : '-' }}</span>
              <span v-if="r.escalation_policy_id" class="rule-meta-chip rule-meta-chip--esc">⚡ {{ policyName(r.escalation_policy_id) }}</span>
            </div>
            <div class="rule-card-actions">
              <button class="toggle-btn" :class="{ active: r.active }" :disabled="togglingId === r.id" @click="toggleRule(r)">{{ r.active ? 'On' : 'Off' }}</button>
              <button class="btn" @click="openEdit(r)">Edit</button>
              <button class="btn btn-tone-danger" :disabled="deletingId === r.id" @click="deleteRule(r.id)">{{ deletingId === r.id ? '…' : 'Delete' }}</button>
            </div>
          </div>
        </div>
        <EmptyState v-else :loading="loading" message="No alert rules defined yet." />
        <TablePagination v-if="rules.length" :page="rulesPage" :total-pages="rulesTotalPages" :total="rulesTotal" @prev="rulesPrev" @next="rulesNext" />
      </div>
    </div>

    <!-- Escalation Workflow Designer -->
    <div class="card">
      <div class="card-header">
        Escalation Workflow Designer
        <button class="mini-btn" @click="openPolicyCreate">+ New Workflow</button>
      </div>
      <div class="card-body" style="padding:12px">
        <div v-if="policies.length" class="policy-list">
          <div v-for="p in policies" :key="p.id" class="policy-block">
            <div class="policy-head">
              <div>
                <div class="policy-name">{{ p.name }}</div>
                <div class="policy-desc">{{ p.description || 'No description' }}</div>
              </div>
              <div class="policy-actions">
                <button class="mini-btn" @click="openPolicyEdit(p)">Edit</button>
                <button class="mini-btn mini-btn--danger" :disabled="deletingPolicyId === p.id" @click="deletePolicy(p.id)">{{ deletingPolicyId === p.id ? '…' : 'Delete' }}</button>
              </div>
            </div>

            <!-- Step ladder -->
            <div class="timeline">
              <div class="timeline-step timeline-step--trigger">
                <div class="timeline-dot timeline-dot--trigger">•</div>
                <div class="timeline-content">
                  <div class="timeline-title">Alert Triggered</div>
                  <div class="timeline-sub">Rule condition matched - initial notification sent</div>
                </div>
              </div>
              <div v-for="(s, i) in p.steps" :key="s.id" class="timeline-step">
                <div class="timeline-dot" :class="{ 'timeline-dot--emergency': s.is_emergency }">{{ i + 1 }}</div>
                <div class="timeline-content" :class="{ 'timeline-content--emergency': s.is_emergency }">
                  <div class="timeline-title">{{ s.title }}</div>
                  <div class="timeline-sub">{{ s.description }}</div>
                  <div class="timeline-tags">
                    <span class="timeline-tag">{{ (s.channels ?? []).join(', ') || 'no channel' }}</span>
                    <span class="timeline-tag">→ {{ s.target_role || 'unassigned' }}</span>
                    <span class="timeline-tag timeline-tag--wait">Target SLA: {{ s.wait_minutes }}min</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Active runs for this policy -->
            <div v-if="activeRunsFor(p.id).length" class="active-runs">
              <div class="active-runs-head">Active Escalations</div>
              <div v-for="run in activeRunsFor(p.id)" :key="run.id" class="run-row">
                <div class="run-info">
                  <span class="run-title">{{ run.title }}</span>
                  <BadgePill :variant="runBadge(run.status)">{{ run.status }}</BadgePill>
                  <span class="run-step">{{ run.current_step?.title ?? '-' }}</span>
                </div>
                <div class="run-actions">
                  <button class="mini-btn" :disabled="ackingId === run.id" @click="acknowledgeRun(run.id)">{{ ackingId === run.id ? '…' : 'Acknowledge' }}</button>
                  <button class="mini-btn mini-btn--warn" :disabled="escalatingId === run.id || run.current_step_index + 1 >= run.policy_steps_count" @click="escalateRun(run.id)">
                    {{ escalatingId === run.id ? '…' : 'Escalate now' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <EmptyState v-else :loading="loading" message="No escalation workflows defined yet." />

        <hr class="divider" />

        <!-- Quick stats -->
        <div class="quick-stats">
          <div class="quick-stat">
            <div class="quick-stat-val quick-stat-val--ok">{{ fmtNum(quickStats?.acknowledged_1h) }}</div>
            <div class="quick-stat-lbl">Acknowledged (1h)</div>
          </div>
          <div class="quick-stat">
            <div class="quick-stat-val quick-stat-val--warn">{{ fmtNum(quickStats?.escalated_1h) }}</div>
            <div class="quick-stat-lbl">Escalated (1h)</div>
          </div>
          <div class="quick-stat">
            <div class="quick-stat-val quick-stat-val--crit">{{ fmtNum(quickStats?.emergency_1h) }}</div>
            <div class="quick-stat-lbl">Emergency (1h)</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Recent Alert Activity -->
  <SectionTitle pill="Live · System-wide">Recent Alert Activity</SectionTitle>
  <div id="recent-alert-activity" class="card drill-target" style="margin-bottom:16px">
    <div class="card-body">
      <table>
        <thead>
          <tr><th>Time</th><th>Alert</th><th>Rule</th><th>Channels</th><th>Recipient</th><th>Status</th></tr>
        </thead>
        <tbody v-if="activity.length">
          <tr v-for="a in activity" :key="a.id">
            <td class="mono-cell">{{ fmtClock(a.created_at) }}</td>
            <td>{{ a.title }}</td>
            <td style="font-size:12px;color:var(--fg-2)">{{ a.rule_name ?? '-' }}</td>
            <td>
              <span v-for="ch in a.channels" :key="ch" class="ch-badge">{{ ch }}</span>
            </td>
            <td style="font-size:12px">{{ a.recipient_email ?? '-' }}</td>
            <td><BadgePill :variant="overallStatus(a).variant">{{ overallStatus(a).label }}</BadgePill></td>
          </tr>
        </tbody>
        <tbody v-else><tr><td colspan="6"><EmptyState :loading="loading" message="No recent alert activity." compact /></td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Create / Edit rule modal -->
  <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
    <div class="modal">
      <div class="modal-header">
        {{ editId ? 'Edit Rule' : 'Create Alert Rule' }}
        <button class="modal-close" @click="closeModal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Rule Name *</label>
          <input v-model="form.name" class="select-full" placeholder="e.g. High-severity safety alert" />
        </div>
        <div class="form-group">
          <label>Event Type *</label>
          <select v-model="form.event_type" class="select-full">
            <option value="">Select event type…</option>
            <option value="traffic.violation.created">Traffic Violation Created</option>
            <option value="traffic.congestion.high">Traffic Congestion High</option>
            <option value="safety.incident.created">Safety Incident Created</option>
            <option value="weather.observation.created">Weather Observation Created</option>
            <option value="revenue.anomaly.detected">Revenue Anomaly Detected</option>
            <option value="integration.sync.failed">Integration Sync Failed</option>
            <option value="vessel.created">Vessel Created</option>
            <option value="vessel.position_updated">Vessel Position Updated</option>
            <option value="vessel.seen">Vessel Seen</option>
            <option value="vessel.movement.recorded">Vessel Movement Recorded</option>
            <option value="flight.status_updated">Flight Status Updated</option>
          </select>
        </div>
        <div class="form-group">
          <label>Minimum Severity</label>
          <select v-model="form.severity" class="select-full">
            <option value="">Any</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div class="form-group">
          <label>Delivery Channels</label>
          <div class="channel-checks">
            <label v-for="ch in CHANNELS" :key="ch" class="checkbox-label">
              <input type="checkbox" :value="ch" v-model="form.channels" />
              {{ ch }}
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>Target Roles</label>
          <div class="channel-checks">
            <label v-for="r in ROLES" :key="r" class="checkbox-label">
              <input type="checkbox" :value="r" v-model="form.target_roles" />
              {{ r }}
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>Cooldown (seconds)</label>
          <input type="number" v-model.number="form.cooldown_seconds" class="select-full" placeholder="300" min="0" />
        </div>
        <div class="form-group">
          <label>Escalation Policy (optional)</label>
          <select v-model="form.escalation_policy_id" class="select-full">
            <option value="">None</option>
            <option v-for="p in policies" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Message Template</label>
          <textarea v-model="form.message_template" class="select-full" rows="3" placeholder="Use {field} placeholders matching the event's context payload, e.g. {plate_number}, {violation_type}, {station}, {weight_kg}…" />
        </div>
        <div v-if="saveError" style="font-size:12px;color:var(--danger-fg)">⚠ {{ saveError }}</div>
      </div>
      <div class="modal-footer">
        <button class="btn" @click="closeModal">Cancel</button>
        <button class="btn-primary" :disabled="!form.name || !form.event_type || saving" @click="saveRule">
          {{ saving ? 'Saving…' : editId ? 'Update' : 'Create' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Create / Edit escalation policy modal -->
  <div v-if="showPolicyModal" class="modal-backdrop" @click.self="closePolicyModal">
    <div class="modal modal--wide">
      <div class="modal-header">
        {{ editPolicyId ? 'Edit Escalation Workflow' : 'New Escalation Workflow' }}
        <button class="modal-close" @click="closePolicyModal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Workflow Name *</label>
          <input v-model="policyForm.name" class="select-full" placeholder="e.g. Critical Incident Escalation" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <input v-model="policyForm.description" class="select-full" placeholder="What this workflow is for" />
        </div>

        <div class="form-group">
          <label>Steps (after the initial trigger)</label>
          <div class="step-editor">
            <div v-for="(s, i) in policyForm.steps" :key="i" class="step-editor-row">
              <div class="step-editor-num">{{ i + 1 }}</div>
              <div class="step-editor-fields">
                <input v-model="s.title" class="select-sm" placeholder="Step title, e.g. Notify On-Call Operator" />
                <input v-model="s.description" class="select-sm" placeholder="Description" />
                <div class="step-editor-row2">
                  <select v-model="s.target_role" class="select-sm">
                    <option value="">Target role…</option>
                    <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
                  </select>
                  <input type="number" v-model.number="s.wait_minutes" class="select-sm" placeholder="Wait (min)" min="0" style="width:90px" />
                  <label class="checkbox-label" style="white-space:nowrap">
                    <input type="checkbox" v-model="s.is_emergency" /> Emergency
                  </label>
                </div>
                <div class="channel-checks">
                  <label v-for="ch in CHANNELS" :key="ch" class="checkbox-label">
                    <input type="checkbox" :value="ch" v-model="s.channels" />
                    {{ ch }}
                  </label>
                </div>
              </div>
              <button class="remove-btn" title="Remove step" @click="policyForm.steps.splice(i, 1)">×</button>
            </div>
          </div>
          <button class="mini-btn" style="margin-top:8px" @click="addStep">+ Add Step</button>
        </div>
        <div v-if="policySaveError" style="font-size:12px;color:var(--danger-fg)">⚠ {{ policySaveError }}</div>
      </div>
      <div class="modal-footer">
        <button class="btn" @click="closePolicyModal">Cancel</button>
        <button class="btn-primary" :disabled="!policyForm.name || policySaving" @click="savePolicy">
          {{ policySaving ? 'Saving…' : editPolicyId ? 'Update' : 'Create' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useNotifications } from '~/composables/api'
import type {
  AlertRule, AlertStats, AlertActivityItem, EscalationPolicy, EscalationPolicyRequest,
  EscalationRun, EscalationRunStatus, EscalationQuickStats, EscalationStepInput,
} from '~/composables/api'

const rules       = ref<AlertRule[]>([])
const stats       = ref<AlertStats | null>(null)
const activity    = ref<AlertActivityItem[]>([])
const policies    = ref<EscalationPolicy[]>([])
const runs        = ref<EscalationRun[]>([])
const quickStats  = ref<EscalationQuickStats | null>(null)

const loading   = ref(true)
const error     = ref<string | null>(null)

const showModal = ref(false)
const editId    = ref<string | null>(null)
const saving    = ref(false)
const saveError = ref<string | null>(null)
const togglingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)

const showPolicyModal   = ref(false)
const editPolicyId      = ref<string | null>(null)
const policySaving      = ref(false)
const policySaveError   = ref<string | null>(null)
const deletingPolicyId  = ref<string | null>(null)
const ackingId           = ref<string | null>(null)
const escalatingId       = ref<string | null>(null)

const CHANNELS = ['in_app', 'websocket', 'email', 'sms']
const ROLES    = ['admin', 'analyst', 'operator']

const emptyForm = () => ({
  name: '',
  event_type: '',
  severity: '' as string,
  channels: ['in_app'] as string[],
  target_roles: [] as string[],
  cooldown_seconds: 300,
  message_template: '',
  escalation_policy_id: '' as string,
})
const form = ref(emptyForm())

const emptyPolicyForm = () => ({
  name: '',
  description: '',
  is_active: true,
  steps: [] as EscalationStepInput[],
})
const policyForm = ref(emptyPolicyForm())

// ── Table pagination ────────────────────────────────────────────────
const {
  pageRows: rulesPageRows, page: rulesPage, totalPages: rulesTotalPages,
  total: rulesTotal, next: rulesNext, prev: rulesPrev,
} = usePagination(rules, 6)

async function load() {
  loading.value = true
  error.value = null
  const api = useNotifications()
  const [rulesRes, statsRes, activityRes, policiesRes, runsRes, quickRes] = await Promise.allSettled([
    api.rules.list({ active: false }),
    api.stats(),
    api.activity(40),
    api.escalation.policies.list(),
    api.escalation.runs.list(),
    api.escalation.runs.quickStats(),
  ])

  if (rulesRes.status === 'fulfilled') rules.value = (rulesRes.value as any).results ?? rulesRes.value ?? []
  if (statsRes.status === 'fulfilled') stats.value = statsRes.value
  if (activityRes.status === 'fulfilled') activity.value = activityRes.value.results ?? []
  if (policiesRes.status === 'fulfilled') policies.value = policiesRes.value.results ?? []
  if (runsRes.status === 'fulfilled') runs.value = runsRes.value.results ?? []
  if (quickRes.status === 'fulfilled') quickStats.value = quickRes.value

  if (rulesRes.status === 'rejected' && statsRes.status === 'rejected')
    error.value = 'Unable to reach the UAPTS Notifications API.'

  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 60_000) })
onUnmounted(() => { if (t) clearInterval(t) })

// ── Rule CRUD ────────────────────────────────────────────────────────
function openCreate() { form.value = emptyForm(); editId.value = null; saveError.value = null; showModal.value = true }
function openEdit(r: AlertRule) {
  form.value = {
    name: r.name,
    event_type: r.event_type,
    severity: r.severity ?? '',
    channels: [...(r.channels ?? [])],
    target_roles: [...((r as any).target_roles ?? [])],
    cooldown_seconds: r.cooldown_seconds ?? 300,
    message_template: (r as any).message_template ?? '',
    escalation_policy_id: r.escalation_policy_id ?? '',
  }
  editId.value = r.id
  saveError.value = null
  showModal.value = true
}
function closeModal() { showModal.value = false; editId.value = null }

async function saveRule() {
  saving.value = true
  saveError.value = null
  const payload: any = {
    name: form.value.name,
    event_type: form.value.event_type,
    channels: form.value.channels,
  }
  if (form.value.severity)            payload.severity              = form.value.severity
  if (form.value.target_roles.length) payload.target_roles          = form.value.target_roles
  if (form.value.cooldown_seconds)    payload.cooldown_seconds      = form.value.cooldown_seconds
  if (form.value.message_template)    payload.message_template      = form.value.message_template
  payload.escalation_policy_id = form.value.escalation_policy_id || null

  try {
    if (editId.value) {
      const updated = await useNotifications().rules.update(editId.value, payload)
      const idx = rules.value.findIndex(r => r.id === editId.value)
      if (idx !== -1) rules.value[idx] = updated
    } else {
      const created = await useNotifications().rules.create(payload)
      rules.value.unshift(created)
    }
    closeModal()
  } catch (e: any) {
    saveError.value = e?.message ?? 'Save failed.'
  } finally {
    saving.value = false
  }
}

async function toggleRule(r: AlertRule) {
  togglingId.value = r.id
  try {
    const updated = await useNotifications().rules.update(r.id, { active: !r.active })
    const idx = rules.value.findIndex(x => x.id === r.id)
    if (idx !== -1) rules.value[idx] = updated
  } catch {} finally { togglingId.value = null }
}

async function deleteRule(id: string) {
  deletingId.value = id
  try {
    await useNotifications().rules.delete(id)
    rules.value = rules.value.filter(r => r.id !== id)
  } catch {} finally { deletingId.value = null }
}

// ── Escalation policy CRUD ──────────────────────────────────────────
function openPolicyCreate() { policyForm.value = emptyPolicyForm(); editPolicyId.value = null; policySaveError.value = null; showPolicyModal.value = true }
function openPolicyEdit(p: EscalationPolicy) {
  policyForm.value = {
    name: p.name,
    description: p.description,
    is_active: p.is_active,
    steps: p.steps.map(s => ({
      order: s.order, title: s.title, description: s.description,
      channels: [...s.channels], target_role: s.target_role,
      wait_minutes: s.wait_minutes, is_emergency: s.is_emergency,
    })),
  }
  editPolicyId.value = p.id
  policySaveError.value = null
  showPolicyModal.value = true
}
function closePolicyModal() { showPolicyModal.value = false; editPolicyId.value = null }
function addStep() {
  policyForm.value.steps.push({ title: '', description: '', channels: [], target_role: '', wait_minutes: 5, is_emergency: false })
}

async function savePolicy() {
  policySaving.value = true
  policySaveError.value = null
  const payload: EscalationPolicyRequest = {
    name: policyForm.value.name,
    description: policyForm.value.description,
    is_active: policyForm.value.is_active,
    steps: policyForm.value.steps,
  }
  try {
    if (editPolicyId.value) {
      const updated = await useNotifications().escalation.policies.update(editPolicyId.value, payload)
      const idx = policies.value.findIndex(p => p.id === editPolicyId.value)
      if (idx !== -1) policies.value[idx] = updated
    } else {
      const created = await useNotifications().escalation.policies.create(payload)
      policies.value.push(created)
    }
    closePolicyModal()
  } catch (e: any) {
    policySaveError.value = e?.message ?? 'Save failed.'
  } finally {
    policySaving.value = false
  }
}

async function deletePolicy(id: string) {
  deletingPolicyId.value = id
  try {
    await useNotifications().escalation.policies.delete(id)
    policies.value = policies.value.filter(p => p.id !== id)
  } catch {} finally { deletingPolicyId.value = null }
}

// ── Escalation run actions ──────────────────────────────────────────
function activeRunsFor(policyId: string) {
  return runs.value.filter(r => r.policy === policyId && r.status !== 'acknowledged').slice(0, 8)
}

async function acknowledgeRun(id: string) {
  ackingId.value = id
  try {
    const updated = await useNotifications().escalation.runs.acknowledge(id)
    const idx = runs.value.findIndex(r => r.id === id)
    if (idx !== -1) runs.value[idx] = updated
    quickStats.value = await useNotifications().escalation.runs.quickStats()
  } catch {} finally { ackingId.value = null }
}

async function escalateRun(id: string) {
  escalatingId.value = id
  try {
    const updated = await useNotifications().escalation.runs.escalate(id)
    const idx = runs.value.findIndex(r => r.id === id)
    if (idx !== -1) runs.value[idx] = updated
    quickStats.value = await useNotifications().escalation.runs.quickStats()
  } catch {} finally { escalatingId.value = null }
}

// ── Helpers ──────────────────────────────────────────────────────────
function policyName(id: string) { return policies.value.find(p => p.id === id)?.name ?? 'Unknown' }
function runBadge(s: EscalationRunStatus) {
  const m: Record<EscalationRunStatus, string> = { pending: 'neutral', acknowledged: 'success', escalated: 'warning', emergency: 'danger' }
  return m[s] ?? 'neutral'
}
function overallStatus(item: AlertActivityItem): { label: string; variant: string } {
  const entries = Object.values(item.delivered || {})
  if (!entries.length) return { label: 'Unknown', variant: 'neutral' }
  if (entries.some(e => e.status === 'error')) return { label: 'Failed', variant: 'danger' }
  if (entries.some(e => e.status === 'pending' || e.status === 'queued')) return { label: 'Pending', variant: 'warning' }
  return { label: 'Delivered', variant: 'success' }
}
function fmtNum(v: number | null | undefined) { return v == null ? '-' : v.toLocaleString() }
function fmtClock(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { return iso }
}
</script>

<style scoped>
.select-full { width:100%; padding:6px 10px; border:1px solid var(--border-interactive); border-radius:6px; font-size:13px; background:var(--surface-2); }
textarea.select-full { resize:vertical; font-family:monospace; }
.channel-checks { display:flex; gap:14px; flex-wrap:wrap; }
.checkbox-label { display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer; }
.toggle-btn { padding:3px 12px; border-radius:12px; border:2px solid var(--border-interactive); background:var(--surface-sunken); font-size:12px; font-weight:600; cursor:pointer; color:var(--fg-2); transition:all .15s; }
.toggle-btn.active { background:var(--success); border-color:var(--success-fg); color:#fff; }
.modal-backdrop { position:fixed; inset:0; background:var(--scrim); z-index:1000; display:flex; align-items:center; justify-content:center; }
.modal { background:var(--surface-2); border-radius:10px; width:500px; max-width:95vw; max-height:90vh; overflow-y:auto; box-shadow:var(--elev-3); }
.modal--wide { width:620px; }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; font-weight:600; font-size:15px; border-bottom:1px solid var(--border-subtle); position:sticky; top:0; background:var(--surface-2); z-index:1; }
.modal-close { background:none; border:none; font-size:20px; cursor:pointer; color:var(--fg-3); line-height:1; }
.modal-body { padding:16px 20px; display:flex; flex-direction:column; gap:12px; }
.modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:12px 20px; border-top:1px solid var(--border-subtle); position:sticky; bottom:0; background:var(--surface-2); }
.form-group { display:flex; flex-direction:column; gap:4px; }
.form-group label { font-size:12px; font-weight:600; color:var(--fg-2); }
.empty-row { text-align:center; color:var(--fg-3); padding:20px; }
.mono-cell { font-family:monospace; font-size:12px; }
.mini-btn { font-size:11px; padding:3px 10px; border:1px solid var(--border-subtle); border-radius:6px; background:var(--surface-1); color:var(--fg-2); cursor:pointer; }
.mini-btn:hover { background:var(--surface-sunken); }
.mini-btn--danger { color:var(--danger-fg); }
.mini-btn--warn { color:var(--warning-fg); }
.remove-btn { background:none; border:none; font-size:16px; color:var(--fg-3); cursor:pointer; line-height:1; padding:0 4px; }
.remove-btn:hover { color:var(--danger-fg); }
.divider { border:none; border-top:1px solid var(--border-subtle); margin:16px 0; }

/* ── Stats strip ── */

/* ── Layout ── */
.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; align-items:start; }
@media(max-width:1000px) { .grid-2 { grid-template-columns:1fr; } }
.card-header { display:flex; align-items:center; justify-content:space-between; }

/* ── Rule cards ── */
.rule-list { display:flex; flex-direction:column; gap:10px; }
.rule-card { border:1px solid var(--border-subtle); border-radius:8px; padding:12px 14px; }
.rule-card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px; }
.rule-name { font-size:13.5px; font-weight:700; color:var(--fg-1); }
.rule-desc { font-size:11.5px; color:var(--fg-3); margin-top:2px; }
.rule-meta-row { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
.rule-meta-chip { font-size:10.5px; padding:3px 8px; border-radius:5px; background:var(--surface-1); color:var(--fg-2); font-weight:500; }
.rule-meta-chip--esc { background:var(--warning-bg); color:var(--warning-fg); }
.rule-card-actions { display:flex; gap:6px; align-items:center; }

/* ── Escalation designer ── */
.policy-list { display:flex; flex-direction:column; gap:20px; }
.policy-head { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:14px; }
.policy-name { font-size:13.5px; font-weight:700; color:var(--fg-1); }
.policy-desc { font-size:11.5px; color:var(--fg-3); margin-top:2px; }
.policy-actions { display:flex; gap:6px; flex-shrink:0; }

.timeline { position:relative; padding-left:22px; }
.timeline-step { position:relative; margin-bottom:16px; }
.timeline-step:last-child { margin-bottom:0; }
.timeline-step:not(:last-child)::before {
  content:''; position:absolute; left:-14px; top:20px; bottom:-16px; width:2px; background:var(--border-subtle);
}
.timeline-dot {
  position:absolute; left:-22px; top:2px; width:18px; height:18px; border-radius:50%;
  background:var(--primary-fill); color:#fff; font-size:9px; font-weight:700;
  display:flex; align-items:center; justify-content:center;
}
.timeline-dot--trigger { background:var(--destructive); }
.timeline-dot--emergency { background:var(--danger-fg); }
.timeline-content { background:var(--surface-1); padding:9px 12px; border-radius:8px; }
.timeline-content--emergency { background:var(--danger-bg); border:1px solid color-mix(in srgb, var(--danger-fg) 30%, transparent); }
.timeline-title { font-size:12.5px; font-weight:700; color:var(--fg-1); margin-bottom:2px; }
.timeline-sub { font-size:11px; color:var(--fg-2); }
.timeline-tags { display:flex; gap:5px; flex-wrap:wrap; margin-top:6px; }
.timeline-tag { font-size:10px; padding:2px 7px; border-radius:10px; background:var(--surface-1); color:var(--fg-2); font-weight:600; }
.timeline-tag--wait { background:var(--info-bg); color:var(--info-fg); }

/* ── Active runs ── */
.active-runs { margin-top:14px; padding-top:12px; border-top:1px dashed var(--border-subtle); }
.active-runs-head { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--fg-3); margin-bottom:8px; }
.run-row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:7px 0; }
.run-info { display:flex; align-items:center; gap:8px; flex-wrap:wrap; min-width:0; }
.run-title { font-size:12px; font-weight:600; color:var(--fg-1); }
.run-step { font-size:11px; color:var(--fg-3); }
.run-actions { display:flex; gap:6px; flex-shrink:0; }

/* ── Quick stats ── */
.quick-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.quick-stat { text-align:center; padding:10px; background:var(--surface-1); border-radius:8px; }
.quick-stat-val { font-size:20px; font-weight:800; }
.quick-stat-val--ok { color:var(--success-fg); }
.quick-stat-val--warn { color:var(--warning-fg); }
.quick-stat-val--crit { color:var(--danger-fg); }
.quick-stat-lbl { font-size:10px; color:var(--fg-3); margin-top:2px; }

/* ── Step editor (policy modal) ── */
.step-editor { display:flex; flex-direction:column; gap:10px; }
.step-editor-row { display:flex; gap:8px; align-items:flex-start; background:var(--surface-1); border-radius:8px; padding:10px; }
.step-editor-num { width:20px; height:20px; border-radius:50%; background:var(--primary-fill); color:#fff; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:4px; }
.step-editor-fields { flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }
.step-editor-row2 { display:flex; gap:8px; align-items:center; }

/* ── Recent activity table ── */
.ch-badge { font-size:10px; padding:2px 7px; border-radius:4px; background:var(--info-bg); color:var(--info-fg); margin-right:4px; font-weight:600; }
</style>
