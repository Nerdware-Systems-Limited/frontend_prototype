<template>
  <!--
    Audience - who gets this dashboard.

    Assignments stack from broad to narrow:
      Everyone → Agency → Role → Department → Role in department → User
    The most specific match wins, unless a broader assignment is LOCKED
    (then nothing narrower can replace it). Same scope twice? Higher
    priority wins. "Preview as" below runs the exact resolver so you can
    see the outcome before publishing.
  -->
  <div class="ap">
    <div v-if="actionError" class="error-banner" role="alert" aria-live="polite">⚠ {{ actionError }}</div>
    <div v-if="directoryError" class="error-banner" role="alert">⚠ {{ directoryError }}</div>
    <section class="ap-sec">
      <div class="ap-sec-title">Assigned to</div>
      <p v-if="!draft.length" class="ap-empty">Not assigned - only editors can open it. Add an audience below.</p>
      <ul class="ap-list">
        <li v-for="(a, i) in draft" :key="i" class="ap-item">
          <div class="ap-item-top">
            <span class="ap-scope">{{ SCOPE_LABELS[a.scopeType] }}</span>
            <strong class="ap-who">{{ describeScope(a) }}</strong>
            <button type="button" class="ap-x" :aria-label="`Remove ${describeScope(a)}`" @click="removeAt(i)"><X :size="13" aria-hidden="true" /></button>
          </div>
          <div class="ap-item-opts">
            <label>Priority <input type="number" class="ap-input ap-num" :value="a.priority" @change="patch(i, { priority: Number(val($event)) || 0 })"></label>
            <label class="ap-check" :title="'Nothing more specific can override this for ' + describeScope(a)">
              <input type="checkbox" :checked="a.locked" @change="patch(i, { locked: checked($event) })"> Lock
            </label>
            <label class="ap-check" title="Viewers may hide, move and resize widgets in their own copy">
              <input type="checkbox" :checked="a.allowPersonalization" @change="patch(i, { allowPersonalization: checked($event) })"> Personalize
            </label>
          </div>
          <div class="ap-item-opts">
            <label>From <input type="date" class="ap-input" :value="a.activeFrom?.slice(0, 10) ?? ''" @change="patch(i, { activeFrom: val($event) || null })"></label>
            <label>Until <input type="date" class="ap-input" :value="a.activeUntil?.slice(0, 10) ?? ''" @change="patch(i, { activeUntil: val($event) || null })"></label>
          </div>
          <p v-for="c in conflictsFor(a)" :key="c.id" class="ap-conflict">
            Also on “{{ c.name }}” (priority {{ c.priority }}{{ c.locked ? ', locked' : '' }}) -
            <strong>{{ c.priority > a.priority ? 'that one wins' : c.priority === a.priority ? 'tie: set a priority' : 'this one wins' }}</strong>
          </p>
        </li>
      </ul>

      <!-- ── add ── -->
      <div class="ap-add">
        <select v-model="form.scopeType" class="ap-input" aria-label="Audience type">
          <option v-for="s in SCOPE_ORDER" :key="s" :value="s">{{ SCOPE_LABELS[s] }}</option>
        </select>
        <template v-if="needs.agency">
          <select v-model="form.agency" class="ap-input" aria-label="Agency">
            <option value="">{{ form.scopeType === 'role' ? 'Any agency' : 'Agency…' }}</option>
            <option v-for="a in directory?.agencies ?? []" :key="a.code" :value="a.code">{{ a.code }} - {{ a.name }}</option>
          </select>
        </template>
        <select v-if="needs.dept" v-model="form.dept" class="ap-input" :disabled="!form.agency" aria-label="Department">
          <option value="">Department…</option>
          <option v-for="d in depts" :key="d.code" :value="d.code">{{ d.name }}</option>
        </select>
        <select v-if="needs.role" v-model="form.role" class="ap-input" aria-label="Role">
          <option value="">Role…</option>
          <option v-for="r in roles" :key="r.code" :value="r.code">{{ r.name }}</option>
        </select>
        <div v-if="form.scopeType === 'user'" class="ap-user">
          <input v-model="userQuery" type="search" class="ap-input" placeholder="Search name or email…" aria-label="Search users" @input="searchUsers">
          <ul v-if="userHits.length && !form.user" class="ap-user-hits">
            <li v-for="u in userHits" :key="u.id">
              <button type="button" @click="pickUser(u)">{{ u.name }} <span>{{ u.email }} · {{ u.agency ?? '-' }}</span></button>
            </li>
          </ul>
          <p v-if="form.user" class="ap-picked">{{ form.userLabel }} <button type="button" class="ap-x" aria-label="Clear selected user" @click="form.user = ''"><X :size="13" aria-hidden="true" /></button></p>
        </div>
        <button type="button" class="btn btn-sm btn-primary" :disabled="!formValue" @click="addAssignment">Assign</button>
      </div>

      <div class="ap-save">
        <span v-if="dirty" class="ap-dirty">Unsaved audience changes</span>
        <button type="button" class="btn btn-sm" :disabled="!dirty || saving" @click="save">{{ saving ? 'Saving…' : 'Save audience' }}</button>
      </div>
    </section>

    <!-- ── preview as ── -->
    <section class="ap-sec">
      <div class="ap-sec-title">Preview as a viewer</div>
      <div class="ap-sim">
        <select v-model="sim.agencyCode" class="ap-input" aria-label="Simulated agency">
          <option value="">No agency</option>
          <option v-for="a in directory?.agencies ?? []" :key="a.code" :value="a.code">{{ a.code }}</option>
        </select>
        <select v-model="sim.departmentCode" class="ap-input" :disabled="!sim.agencyCode" aria-label="Simulated department">
          <option value="">No department</option>
          <option v-for="d in simDepts" :key="d.code" :value="d.code">{{ d.name }}</option>
        </select>
        <select v-model="sim.role" class="ap-input" aria-label="Simulated role">
          <option value="">No role</option>
          <option v-for="r in directory?.roles ?? []" :key="r.code + (r.agency ?? '')" :value="r.code">{{ r.name }}{{ r.agency ? ` (${r.agency})` : '' }}</option>
        </select>
        <input v-model="sim.perms" type="text" class="ap-input ap-wide" placeholder="Permissions, comma-separated (e.g. safety.view, gis.view)" aria-label="Simulated permissions">
      </div>

      <div v-if="result" class="ap-result">
        <p v-if="result.winner" class="ap-winner" :class="{ me: result.winner.dashboard.id === dashboard.id }">
          Sees <strong>{{ result.winner.dashboard.name }}</strong>
          via {{ describeScope(result.winner.assignment) }}
          <template v-if="result.winner.dashboard.id === dashboard.id"> - this dashboard</template>
        </p>
        <p v-else class="ap-winner none">No dashboard matches - falls back to the built-in Command Centre.</p>
        <ol class="ap-trace">
          <li v-for="t in result.trace" :key="t.assignment.id" :class="t.outcome">
            <span class="ap-outcome">{{ OUTCOME[t.outcome] }}</span>
            {{ t.dashboard.name }} <span class="ap-trace-scope">· {{ describeScope(t.assignment) }} · p{{ t.assignment.priority }}{{ t.assignment.locked ? ' · locked' : '' }}</span>
          </li>
        </ol>
      </div>
      <div class="ap-sim-actions">
        <button type="button" class="btn btn-sm" @click="emit('preview', simViewer)"><Eye :size="14" aria-hidden="true" />Show canvas as this viewer</button>
        <button v-if="previewing" type="button" class="btn btn-sm" @click="emit('preview', null)">Stop</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Eye, X } from 'lucide-vue-next'
import type { DashboardAssignment, DashboardSummary, ScopeType, ViewerContext } from '~/types/dashboard'
import { SCOPE_PRECEDENCE } from '~/types/dashboard'
import { SCOPE_LABELS, describeScope, resolveDashboard } from '~/utils/resolveDashboard'
import { useDashboardApi, toDashboardApiError } from '~/composables/useDashboardApi'
import { useDashboardDirectory } from '~/composables/useDashboardDirectory'

type Draft = Omit<DashboardAssignment, 'id' | 'dashboardId'> & { id?: string }

const props = defineProps<{
  dashboard: DashboardSummary
  allDashboards: DashboardSummary[]
  previewing: boolean
}>()
const emit = defineEmits<{ saved: [DashboardAssignment[]]; preview: [ViewerContext | null] }>()

const api = useDashboardApi()
const SCOPE_ORDER: ScopeType[] = [...SCOPE_PRECEDENCE].reverse()
const OUTCOME = { 'won': 'Wins', 'overridden': 'Overridden', 'blocked-by-lock': 'Blocked by lock', 'lower-priority': 'Lower priority' }

const val = (e: Event) => (e.target as HTMLInputElement).value
const checked = (e: Event) => (e.target as HTMLInputElement).checked

// ── directory ──
const { directory, error: directoryError, load: loadDirectory } = useDashboardDirectory()
onMounted(loadDirectory)
/** Save / search failures, shown in the panel (e.g. an agency admin assigning outside their agency gets the server's 403 reason). */
const actionError = ref<string | null>(null)

// ── draft list ──
const draft = ref<Draft[]>([])
const original = ref('')
watch(() => props.dashboard.assignments, (list) => {
  draft.value = list.map(a => ({ ...a }))
  original.value = JSON.stringify(draft.value)
}, { immediate: true })
const dirty = computed(() => JSON.stringify(draft.value) !== original.value)
function patch(i: number, p: Partial<Draft>) { draft.value = draft.value.map((a, j) => (j === i ? { ...a, ...p } : a)) }
function removeAt(i: number) { draft.value = draft.value.filter((_, j) => j !== i) }

// ── add form ──
const form = reactive({ scopeType: 'agency' as ScopeType, agency: '', dept: '', role: '', user: '', userLabel: '' })
const needs = computed(() => ({
  agency: ['agency', 'department', 'role', 'role_in_department'].includes(form.scopeType),
  dept: ['department', 'role_in_department'].includes(form.scopeType),
  role: ['role', 'role_in_department'].includes(form.scopeType),
}))
const depts = computed(() => directory.value?.agencies.find(a => a.code === form.agency)?.departments ?? [])
const roles = computed(() => (directory.value?.roles ?? []).filter(r => !r.agency || !form.agency || r.agency === form.agency))
watch(() => form.agency, () => { form.dept = '' })

const formValue = computed(() => {
  switch (form.scopeType) {
    case 'global': return '*'
    case 'agency': return form.agency
    case 'department': return form.agency && form.dept ? `${form.agency}:${form.dept}` : ''
    case 'role': return form.role ? (form.agency ? `${form.agency}:${form.role}` : form.role) : ''
    case 'role_in_department': return form.agency && form.dept && form.role ? `${form.agency}:${form.dept}:${form.role}` : ''
    case 'user': return form.user
  }
})
function addAssignment() {
  if (!formValue.value) return
  if (draft.value.some(a => a.scopeType === form.scopeType && a.scopeValue === formValue.value)) return
  draft.value = [...draft.value, {
    scopeType: form.scopeType, scopeValue: formValue.value, priority: 0,
    locked: false, allowPersonalization: form.scopeType !== 'user', activeFrom: null, activeUntil: null,
  }]
  Object.assign(form, { agency: '', dept: '', role: '', user: '', userLabel: '' })
  userQuery.value = ''
}

const userQuery = ref('')
const userHits = ref<Awaited<ReturnType<typeof api.searchUsers>>>([])
const searchUsers = useDebounceFn(async () => {
  form.user = ''
  if (userQuery.value.trim().length < 2) { userHits.value = []; return }
  try { userHits.value = await api.searchUsers(userQuery.value.trim()) } catch (e) {
    userHits.value = []
    actionError.value = `User search failed: ${toDashboardApiError(e).message}`
  }
}, 250)
function pickUser(u: { id: string; name: string; email: string }) { form.user = u.id; form.userLabel = `${u.name} (${u.email})`; userHits.value = [] }

const saving = ref(false)
async function save() {
  saving.value = true
  actionError.value = null
  try {
    const saved = await api.saveAssignments(props.dashboard.id, draft.value.map(({ id: _id, ...rest }) => rest))
    emit('saved', saved)
  } catch (e) {
    actionError.value = `Audience not saved: ${toDashboardApiError(e).message}`
  } finally { saving.value = false }
}

// ── conflicts ──
function conflictsFor(a: Draft) {
  return props.allDashboards
    .filter(d => d.id !== props.dashboard.id && d.status === 'published')
    .flatMap(d => d.assignments.filter(x => x.scopeType === a.scopeType && x.scopeValue.toLowerCase() === a.scopeValue.toLowerCase())
      .map(x => ({ id: `${d.id}-${x.id}`, name: d.name, priority: x.priority, locked: x.locked })))
}

// ── preview-as ──
const sim = reactive({ agencyCode: '', departmentCode: '', role: '', perms: '' })
const simDepts = computed(() => directory.value?.agencies.find(a => a.code === sim.agencyCode)?.departments ?? [])
const simViewer = computed<ViewerContext>(() => ({
  userId: '__preview__',
  agencyCode: sim.agencyCode || null,
  departmentCode: sim.departmentCode || null,
  roles: sim.role ? [sim.role] : [],
  permissions: sim.perms.split(',').map(s => s.trim()).filter(Boolean),
  isSuperAdmin: false,
}))
// Resolve with THIS dashboard's unsaved audience, treated as published, so
// the admin sees the effect of what they're about to save.
const result = computed(() => {
  const self: DashboardSummary = {
    ...props.dashboard, status: 'published',
    assignments: draft.value.map((a, i) => ({ ...a, id: a.id ?? `draft-${i}`, dashboardId: props.dashboard.id })),
  }
  const others = props.allDashboards.filter(d => d.id !== props.dashboard.id)
  return resolveDashboard([self, ...others], simViewer.value)
})
</script>

<style scoped>
.ap { display: flex; flex-direction: column; gap: 14px; }
.ap-sec { display: flex; flex-direction: column; gap: 8px; }
.ap-sec-title { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-3); }
.ap-sec + .ap-sec { padding-top: 14px; border-top: 1px solid var(--border-subtle); }
.ap-empty { font-size: 11.5px; color: var(--fg-3); margin: 0; }
.ap-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.ap-item { border: 1px solid var(--border-subtle); border-radius: var(--r-sm); padding: 8px 10px; background: var(--surface-2); display: flex; flex-direction: column; gap: 6px; }
.ap-item-top { display: flex; align-items: center; gap: 8px; }
.ap-scope { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--fg-3); white-space: nowrap; }
.ap-who { flex: 1; font-size: 12px; color: var(--fg-1); }
.ap-item-opts { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; font-size: 11px; color: var(--fg-2); }
.ap-item-opts label { display: flex; align-items: center; gap: 4px; }
.ap-check { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.ap-check input { width: auto; accent-color: var(--primary); }
.ap-input { height: 28px; padding: 0 6px; font-size: 12px; min-width: 0; }
.ap-item-opts .ap-input[type='date'] { width: auto; }
.ap-num { width: 56px; font-family: var(--font-mono); }
.ap-wide { grid-column: 1 / -1; }
.ap-x { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; border: 0; background: none; color: var(--fg-3); cursor: pointer; border-radius: var(--r-xs); flex-shrink: 0; }
.ap-x:focus-visible { outline: 2px solid var(--primary); outline-offset: 0; }
@media (hover: hover) { .ap-x:hover { background: var(--danger-bg); color: var(--danger-fg); } }
.ap-sim-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.ap-sim-actions .btn { gap: 6px; }
.ap-conflict { font-size: 10.5px; color: var(--warning-fg); background: var(--warning-bg); border-radius: var(--r-xs); padding: 4px 6px; margin: 0; }
.ap-add { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px dashed var(--border-interactive); border-radius: var(--r-sm); }
.ap-user { position: relative; display: flex; flex-direction: column; gap: 4px; }
.ap-user-hits { list-style: none; margin: 0; padding: 4px; border: 1px solid var(--border-subtle); border-radius: var(--r-sm); background: var(--surface-2); box-shadow: var(--elev-2); max-height: 180px; overflow-y: auto; }
.ap-user-hits button { width: 100%; text-align: left; border: 0; background: none; padding: 6px; font-size: 12px; color: var(--fg-1); cursor: pointer; border-radius: var(--r-xs); display: flex; flex-direction: column; }
.ap-user-hits button:hover { background: var(--surface-quiet); }
.ap-user-hits span { font-size: 10.5px; color: var(--fg-3); }
.ap-picked { font-size: 11.5px; color: var(--fg-1); margin: 0; display: flex; gap: 6px; align-items: center; }
.ap-save { display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
.ap-dirty { font-size: 11px; color: var(--warning-fg); }
.ap-sim { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ap-result { border: 1px solid var(--border-subtle); border-radius: var(--r-sm); padding: 8px 10px; background: var(--surface-1); }
.ap-winner { margin: 0 0 6px; font-size: 12px; color: var(--fg-1); }
.ap-winner.me { color: var(--success-fg); }
.ap-winner.none { color: var(--fg-3); }
.ap-trace { margin: 0; padding-left: 16px; font-size: 11px; color: var(--fg-2); display: flex; flex-direction: column; gap: 3px; }
.ap-trace li.overridden, .ap-trace li.lower-priority, .ap-trace li.blocked-by-lock { color: var(--fg-3); }
.ap-outcome { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-right: 4px; }
.ap-trace li.won .ap-outcome { color: var(--success-fg); }
.ap-trace li.blocked-by-lock .ap-outcome { color: var(--warning-fg); }
.ap-trace-scope { color: var(--fg-3); }
</style>
