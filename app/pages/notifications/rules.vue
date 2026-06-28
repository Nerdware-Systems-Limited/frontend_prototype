<template>
  <PageHeader
    eyebrow="Platform Notifications - Rules"
    title="Alert Rules"
    subtitle="Configure automated notification rules - trigger conditions, severity thresholds, and delivery channels"
  >
    <template #actions>
      <span class="freshness-badge">{{ rules.length }} rules defined</span>
      <NuxtLink to="/notifications" class="btn">← Feed</NuxtLink>
      <button class="btn-primary" @click="openCreate">+ Create Rule</button>
    </template>
  </PageHeader>

  <div v-if="error" class="error-banner">⚠ {{ error }}</div>

  <!-- Create / Edit modal -->
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
            <option value="safety.incident.created">Safety Incident Created</option>
            <option value="weather.observation.created">Weather Observation Created</option>

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
            <option value="low">Low</option>
            <option value="medium">Medium</option>
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
          <label>Message Template</label>
          <textarea v-model="form.message_template" class="select-full" rows="3" placeholder="Use {event_type}, {severity}, {resource_id} placeholders…" />
        </div>
        <div v-if="saveError" style="font-size:12px;color:#ef4444">⚠ {{ saveError }}</div>
      </div>
      <div class="modal-footer">
        <button class="btn" @click="closeModal">Cancel</button>
        <button class="btn-primary" :disabled="!form.name || !form.event_type || saving" @click="saveRule">
          {{ saving ? 'Saving…' : editId ? 'Update' : 'Create' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Rules table -->
  <div class="card">
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Event Type</th>
            <th>Severity</th>
            <th>Channels</th>
            <th>Target Roles</th>
            <th>Cooldown</th>
            <th>Last Fired</th>
            <th>Enabled</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody v-if="rules.length">
          <tr v-for="r in rules" :key="r.id">
            <td style="font-weight:600">{{ r.name }}</td>
            <td style="font-size:12px;font-family:monospace">{{ r.event_type }}</td>
            <td>
              <BadgePill v-if="r.severity" :variant="sevBadge(r.severity)">{{ r.severity }}</BadgePill>
              <span v-else style="color:#94a3b8;font-size:12px">Any</span>
            </td>
            <td>
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                <BadgePill v-for="ch in (r.channels ?? [])" :key="ch" variant="neutral">{{ ch }}</BadgePill>
              </div>
            </td>
            <td style="font-size:12px">{{ (r.target_roles ?? []).join(', ') || 'All' }}</td>
            <td style="font-size:12px">{{ r.cooldown_seconds ? `${r.cooldown_seconds}s` : '-' }}</td>
            <td style="font-size:12px;white-space:nowrap">{{ r.last_fired_at ? fmtTime(r.last_fired_at) : 'Never' }}</td>
            <td>
              <button
                class="toggle-btn"
                :class="{ active: r.active }"
                :disabled="togglingId === r.id"
                @click="toggleRule(r)"
              >{{ r.active ? 'On' : 'Off' }}</button>
            </td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn" style="font-size:12px" @click="openEdit(r)">Edit</button>
                <button class="btn" style="font-size:12px;color:#dc2626" :disabled="deletingId === r.id" @click="deleteRule(r.id)">
                  {{ deletingId === r.id ? '…' : 'Delete' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:20px">{{ loading ? 'Loading rules…' : 'No alert rules defined yet.' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Alert Rules')

import { useNotifications } from '~/composables/api'
import type { AlertRule } from '~/composables/api'

const rules     = ref<AlertRule[]>([])
const loading   = ref(true)
const error     = ref<string | null>(null)
const showModal = ref(false)
const editId    = ref<string | null>(null)
const saving    = ref(false)
const saveError = ref<string | null>(null)
const togglingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)

const CHANNELS = ['in_app', 'email', 'sms', 'webhook']
const ROLES    = ['admin', 'analyst', 'operator']

const emptyForm = () => ({
  name: '',
  event_type: '',
  severity: '' as string,
  channels: ['in_app'] as string[],
  target_roles: [] as string[],
  cooldown_seconds: 300,
  message_template: '',
})
const form = ref(emptyForm())

async function load() {
  loading.value = true
  error.value = null
  const [res] = await Promise.allSettled([useNotifications().rules.list()])
  if (res.status === 'fulfilled') rules.value = (res.value as any).results ?? res.value ?? []
  else error.value = 'Unable to reach the UAPTS Notifications API.'
  loading.value = false
}

onMounted(load)
let t: ReturnType<typeof setInterval> | null = null
onMounted(() => { t = setInterval(load, 120_000) })
onUnmounted(() => { if (t) clearInterval(t) })

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
  if (form.value.severity)          payload.severity          = form.value.severity
  if (form.value.target_roles.length) payload.target_roles    = form.value.target_roles
  if (form.value.cooldown_seconds)  payload.cooldown_seconds  = form.value.cooldown_seconds
  if (form.value.message_template)  payload.message_template  = form.value.message_template

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

function sevBadge(s: string) {
  const m: Record<string,string> = { critical:'danger', high:'warning', medium:'fair', low:'info', info:'neutral' }
  return m[s] ?? 'neutral'
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
</script>

<style scoped>
.freshness-badge { font-size:11px; padding:3px 8px; border-radius:4px; background:#f8fafc; color:#475569; border:1px solid #e2e8f0; }
.error-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:#fef9c3; border:1px solid #ca8a04; font-size:13px; }
.select-full { width:100%; padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; background:#fff; }
textarea.select-full { resize:vertical; font-family:monospace; }
.channel-checks { display:flex; gap:14px; flex-wrap:wrap; }
.checkbox-label { display:flex; align-items:center; gap:4px; font-size:13px; cursor:pointer; }
.toggle-btn { padding:3px 12px; border-radius:12px; border:2px solid #e2e8f0; background:#f1f5f9; font-size:12px; font-weight:600; cursor:pointer; color:#64748b; transition:all .15s; }
.toggle-btn.active { background:#22c55e; border-color:#16a34a; color:#fff; }
.modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:1000; display:flex; align-items:center; justify-content:center; }
.modal { background:#fff; border-radius:10px; width:500px; max-width:95vw; max-height:90vh; overflow-y:auto; box-shadow:0 24px 64px rgba(0,0,0,.2); }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; font-weight:600; font-size:15px; border-bottom:1px solid #f1f5f9; position:sticky; top:0; background:#fff; z-index:1; }
.modal-close { background:none; border:none; font-size:20px; cursor:pointer; color:#94a3b8; line-height:1; }
.modal-body { padding:16px 20px; display:flex; flex-direction:column; gap:12px; }
.modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:12px 20px; border-top:1px solid #f1f5f9; position:sticky; bottom:0; background:#fff; }
.form-group { display:flex; flex-direction:column; gap:4px; }
.form-group label { font-size:12px; font-weight:600; color:#374151; }
</style>
