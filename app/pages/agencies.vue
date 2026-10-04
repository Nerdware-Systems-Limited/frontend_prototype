<template>
  <PageHeader
    class="header-actions-fill"
    eyebrow="Access Control"
    title="Agencies"
    :subtitle="canWrite ? 'Platform-wide agency directory (tbl_agencies) - create and adjust the agencies UAPTS tracks' : 'Platform-wide agency directory - read-only for your role, contact a Super Admin to make changes'"
  >
    <template #actions>
      <ExportButton :rows="exportRows" :columns="exportColumns" filename="uapts-agencies" label="Export" />
      <button v-if="canWrite" class="btn-primary" @click="openCreate">+ Add Agency</button>
    </template>
  </PageHeader>

  <div v-if="error"         class="error-banner">⚠ {{ error }}</div>
  <div v-if="actionError"   class="error-banner action-error">⚠ {{ actionError }}</div>
  <div v-if="actionSuccess" class="success-banner">✓ {{ actionSuccess }}</div>

  <!-- Metric strip -->
  <div class="metric-strip" role="group" aria-label="Agency directory statistics">
    <div v-for="m in metrics" :key="m.label" class="metric-item">
      <span class="metric-label">{{ m.label }}</span>
      <span class="metric-value">{{ metricsUnavailable ? '-' : m.value }}</span>
      <span class="metric-sub">{{ metricsUnavailable ? (loading ? 'Loading…' : 'Unavailable') : m.sub }}</span>
    </div>
  </div>

  <SectionTitle>Agency Directory</SectionTitle>
  <div class="filter-bar filter-bar--grid">
    <input
      v-model="search"
      class="select-sm filter-input filter-span"
      placeholder="Search code or name…"
      aria-label="Search by agency code or name"
    />
    <span class="result-count filter-span">{{ filteredAgencies.length }} of {{ agencies.length }} · Page {{ agenciesPage }} of {{ agenciesTotalPages }}</span>
  </div>

  <div id="agency-directory" class="card drill-target">
    <div class="card-body">
      <table class="agencies-table stack-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Agency Name</th>
            <th>Contact Email</th>
            <th v-if="canWrite">Actions</th>
          </tr>
        </thead>
        <tbody v-if="filteredAgencies.length">
          <tr v-for="a in agenciesPageRows" :key="a.id">
            <td class="stack-title"><BadgePill variant="neutral">{{ a.agency_code }}</BadgePill></td>
            <td class="stack-block" data-label="Agency Name">{{ a.agency_name }}</td>
            <td class="stack-block" data-label="Contact Email">
              <span v-if="a.contact_email">{{ a.contact_email }}</span>
              <span v-else class="dim">-</span>
            </td>
            <td v-if="canWrite" class="stack-actions">
              <div class="action-group">
                <button class="btn btn-sm" :disabled="actionId === a.id" @click="openEdit(a)">Edit</button>
                <button class="btn btn-sm btn-danger-outline" :disabled="actionId === a.id" @click="confirmDeleteAgency(a)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td :colspan="canWrite ? 4 : 3" class="empty-row">
              {{ loading ? 'Loading agencies…' : 'No agencies match the current search.' }}
            </td>
          </tr>
        </tbody>
      </table>
      <TablePagination
        :page="agenciesPage" :total-pages="agenciesTotalPages" :total="filteredAgencies.length"
        @prev="agenciesPrev" @next="agenciesNext"
      />
    </div>
  </div>

  <!-- Destructive action confirmation - replaces window.confirm() -->
  <ConfirmDialog
    :open="!!confirmAction"
    :title="confirmAction?.title ?? ''"
    :message="confirmAction?.message ?? ''"
    :confirm-label="confirmAction?.confirmLabel ?? 'Confirm'"
    busy-label="Working…"
    danger
    :busy="actionId === confirmAction?.agencyId"
    @confirm="runConfirmAction"
    @cancel="confirmAction = null"
  />

  <!-- Create / Edit Agency Modal -->
  <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
    <div class="modal">
      <div class="modal-header">
        <span>{{ editId ? 'Edit Agency' : 'Add Agency' }}</span>
        <button class="modal-close" @click="closeModal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Agency code <span class="required">*</span></label>
          <input
            v-model="form.agency_code"
            class="input-full"
            placeholder="e.g. KENHA"
            :disabled="!!editId"
            :title="editId ? 'Agency code cannot be changed after creation' : undefined"
            :class="{ 'input-error': formErrors.agency_code }"
            @input="formErrors.agency_code = ''"
          />
          <span v-if="formErrors.agency_code" class="field-error">{{ formErrors.agency_code }}</span>
        </div>
        <div class="form-group">
          <label>Agency name <span class="required">*</span></label>
          <input
            v-model="form.agency_name"
            class="input-full"
            placeholder="e.g. Kenya National Highways Authority"
            :class="{ 'input-error': formErrors.agency_name }"
            @input="formErrors.agency_name = ''"
          />
          <span v-if="formErrors.agency_name" class="field-error">{{ formErrors.agency_name }}</span>
        </div>
        <div class="form-group">
          <label>Contact email <span class="hint">(optional)</span></label>
          <input
            type="email"
            v-model="form.contact_email"
            class="input-full"
            placeholder="contact@agency.go.ke"
          />
        </div>
        <div v-if="saveApiError" class="api-error">⚠ {{ saveApiError }}</div>
      </div>
      <div class="modal-footer">
        <button class="btn" @click="closeModal">Cancel</button>
        <button
          class="btn-primary"
          :disabled="!form.agency_code || !form.agency_name || saving"
          @click="doSave"
        >{{ saving ? 'Saving…' : (editId ? 'Save Changes' : 'Add Agency') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { useAgencies as _useAgencies } from '~/composables/api'
import type { Agency } from '~/types/uapts'
import { isUnscopedAdmin } from '~/composables/useAgencyScope'

// ── Write gating ─────────────────────────────────────────────────────────
// The route itself (access-control.json's /agencies, minTier: oversight) is
// what keeps admin-tier agency accounts out entirely; AppSidebar/middleware
// already handle that. Within the page, 'oversight' is documented read-only
// everywhere else in this RBAC model (roles.oversight.write:false) but the
// resolver doesn't enforce that flag - so write actions here are narrowed
// to super_admin only, the same isUnscopedAdmin() check /users.vue uses for
// its own cross-agency actions.
const { user: viewer } = useAuth()
const canWrite = computed(() => isUnscopedAdmin(viewer.value as any))

// ── State ──────────────────────────────────────────────────────────────

const agencies = ref<Agency[]>([])
const loading  = ref(true)
const error    = ref<string | null>(null)
const actionError   = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)
const actionId      = ref<string | null>(null)

const search = ref('')

const showModal      = ref(false)
const saving          = ref(false)
const saveApiError    = ref<string | null>(null)
const editId           = ref<string | null>(null)
const form            = ref({ agency_code: '', agency_name: '', contact_email: '' })
const formErrors      = ref({ agency_code: '', agency_name: '' })

// ── Load ───────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value   = null
  try {
    const res = await _useAgencies().list({ page_size: 100, ordering: 'agency_code' })
    agencies.value = (res as any).results ?? []
  } catch {
    error.value = 'Unable to reach the UAPTS Accounts API.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ── Computed ───────────────────────────────────────────────────────────

const filteredAgencies = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return agencies.value
  return agencies.value.filter(a =>
    a.agency_code.toLowerCase().includes(q) || a.agency_name.toLowerCase().includes(q),
  )
})

const {
  pageRows: agenciesPageRows, page: agenciesPage, totalPages: agenciesTotalPages,
  next: agenciesNext, prev: agenciesPrev,
} = usePagination(filteredAgencies, 15)

const metricsUnavailable = computed(() => loading.value || !!error.value)
const metrics = computed(() => [
  { label: 'Total Agencies',  value: agencies.value.length,                                     sub: 'In the directory' },
  { label: 'With Contact',    value: agencies.value.filter(a => !!a.contact_email).length,       sub: 'Have a contact email on file' },
  { label: 'Missing Contact', value: agencies.value.filter(a => !a.contact_email).length,        sub: 'No contact email on file' },
])

// ── Export ─────────────────────────────────────────────────────────────

const exportColumns = [
  { key: 'code',  label: 'Agency Code' },
  { key: 'name',  label: 'Agency Name' },
  { key: 'email', label: 'Contact Email' },
]
const exportRows = computed(() => filteredAgencies.value.map(a => ({
  code:  a.agency_code,
  name:  a.agency_name,
  email: a.contact_email ?? '-',
})))

// ── Create / Edit ──────────────────────────────────────────────────────

function openCreate() {
  editId.value      = null
  form.value         = { agency_code: '', agency_name: '', contact_email: '' }
  formErrors.value   = { agency_code: '', agency_name: '' }
  saveApiError.value = null
  showModal.value    = true
}

function openEdit(a: Agency) {
  editId.value      = a.id
  form.value         = { agency_code: a.agency_code, agency_name: a.agency_name, contact_email: a.contact_email ?? '' }
  formErrors.value   = { agency_code: '', agency_name: '' }
  saveApiError.value = null
  showModal.value    = true
}

function closeModal() { showModal.value = false }

async function doSave() {
  formErrors.value = { agency_code: '', agency_name: '' }
  saveApiError.value = null
  if (!form.value.agency_code)  { formErrors.value.agency_code = 'Agency code is required.'; return }
  if (!form.value.agency_name)  { formErrors.value.agency_name = 'Agency name is required.'; return }

  saving.value = true
  try {
    if (editId.value) {
      const payload: Partial<Agency> = {
        agency_name: form.value.agency_name,
        contact_email: form.value.contact_email || undefined,
      }
      const updated = await _useAgencies().update(editId.value, payload)
      const idx = agencies.value.findIndex(a => a.id === editId.value)
      if (idx !== -1) agencies.value[idx] = updated
      closeModal()
      flash(`${updated.agency_code} updated.`)
    } else {
      const payload = {
        agency_code: form.value.agency_code.toUpperCase(),
        agency_name: form.value.agency_name,
        contact_email: form.value.contact_email || undefined,
      }
      const created = await _useAgencies().create(payload)
      agencies.value.push(created)
      agencies.value.sort((a, b) => a.agency_code.localeCompare(b.agency_code))
      closeModal()
      flash(`Agency ${created.agency_code} added.`)
    }
  } catch (err: any) {
    saveApiError.value = err?.data?.detail
      ?? (err?.data?.errors?.[0]?.message)
      ?? err?.message
      ?? 'Failed to save agency.'
  } finally {
    saving.value = false
  }
}

// ── Delete ─────────────────────────────────────────────────────────────

interface ConfirmSpec { title: string; message: string; confirmLabel: string; agencyId: string; run: () => void | Promise<void> }
const confirmAction = ref<ConfirmSpec | null>(null)

function confirmDeleteAgency(a: Agency) {
  confirmAction.value = {
    title: 'Delete agency',
    message: `Permanently delete "${a.agency_name}" (${a.agency_code})?\n\nThis cannot be undone, and will fail if users or departments still reference it.`,
    confirmLabel: 'Delete',
    agencyId: a.id,
    run: () => deleteAgency(a),
  }
}

async function deleteAgency(a: Agency) {
  actionId.value    = a.id
  actionError.value = null
  try {
    await _useAgencies().remove(a.id)
    agencies.value = agencies.value.filter(x => x.id !== a.id)
    flash(`Agency ${a.agency_code} deleted.`)
  } catch (err: any) {
    actionError.value = err?.data?.detail
      ?? (err?.data?.errors?.[0]?.message)
      ?? err?.message
      ?? 'Failed to delete agency - it may still be referenced by users or departments.'
  } finally {
    actionId.value = null
  }
}

async function runConfirmAction() {
  const action = confirmAction.value
  if (!action) return
  await action.run()
  confirmAction.value = null
}

// ── Helpers ────────────────────────────────────────────────────────────

let flashTimer: ReturnType<typeof setTimeout> | null = null
function flash(msg: string) {
  actionSuccess.value = msg
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { actionSuccess.value = null }, 4000)
}
</script>

<style scoped>
.action-error   { background:var(--danger-bg); border-color:color-mix(in srgb, var(--danger-fg) 40%, transparent); color:var(--danger-fg); }
.success-banner { margin:8px 0 12px; padding:10px 16px; border-radius:6px; background:var(--success-bg); border:1px solid color-mix(in srgb, var(--success-fg) 40%, transparent); font-size:13px; color:var(--success-fg); }

.filter-bar   { padding:8px 12px; margin-bottom:10px; gap:10px; }
.filter-input { min-width:0; }
/* Desktop width only - on phones .filter-bar--grid (theme.css) owns the layout;
   a flex-basis left active there would size the control's height, not its width. */
@media (min-width:769px) {
  .filter-input { width:220px; flex:0 1 220px; }
}
.result-count { font-size:12px; color:var(--fg-2); white-space:nowrap; margin-left:auto; }

#agency-directory .card-body { padding:0; }
#agency-directory :deep(.table-pagination) { padding-left:12px; padding-right:12px; }
.agencies-table { width:100%; }
.agencies-table th, .agencies-table td { padding:8px 12px; }
.dim { color:var(--fg-3); }
.action-group { display:flex; gap:6px; }
.btn-danger-outline { color:var(--danger-fg); border-color:color-mix(in srgb, var(--danger-fg) 40%, transparent); }
.btn-danger-outline:hover { background:var(--danger-bg); }

.empty-row { text-align:center; color:var(--fg-3); font-size:13px; padding:24px; }

/* Modal */
.modal-backdrop { position:fixed; inset:0; background:var(--scrim); z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; }
.modal { background:var(--surface-2); border-radius:var(--r-lg); width:440px; max-width:100%; box-shadow:var(--elev-3); display:flex; flex-direction:column; }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; font-weight:600; font-size:15px; border-bottom:1px solid var(--border-subtle); }
.modal-close  { background:none; border:none; font-size:22px; cursor:pointer; color:var(--fg-3); line-height:1; padding:0 4px; }
.modal-close:hover { color:var(--fg-2); }
.modal-body   { padding:20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; max-height:70vh; }
.modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:14px 20px; border-top:1px solid var(--border-subtle); }

.form-group { display:flex; flex-direction:column; gap:4px; }
.form-group label { font-size:12px; font-weight:600; color:var(--fg-2); }
.input-full { width:100%; padding:7px 10px; border:1px solid var(--border-interactive); border-radius:6px; font-size:13px; background:var(--surface-2); box-sizing:border-box; }
.input-full:focus { outline:none; border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-wash); }
.input-full:disabled { opacity:.6; cursor:not-allowed; }
.input-error { border-color:var(--destructive); }
.field-error { font-size:11px; color:var(--danger-fg); margin-top:2px; }
.hint       { font-weight:400; color:var(--fg-3); }
.required   { color:var(--danger-fg); }
.api-error  { font-size:12px; color:var(--danger-fg); padding:8px 12px; background:var(--danger-bg); border-radius:6px; border:1px solid color-mix(in srgb, var(--danger-fg) 30%, transparent); }

/* Phones - the stacked-card layout itself is .stack-table (theme.css). */
@media (max-width:768px) {
  .action-group { gap:8px; }
}
@media (max-width:600px) {
  .modal-backdrop { padding:8px; }
  .modal          { width:100%; max-height:calc(100dvh - 16px); }
  /* Header and footer stay put; only the form scrolls, and it never outgrows the
     screen when the on-screen keyboard shrinks the viewport. */
  .modal-body     { max-height:none; flex:1 1 auto; min-height:0; padding:16px; }
  .modal-header, .modal-footer { padding-left:16px; padding-right:16px; }
  .modal-close    { padding:6px 10px; }
  .input-full     { min-height:40px; font-size:16px; } /* 16px stops iOS zooming on focus */
  .modal-footer .btn, .modal-footer .btn-primary { min-height:40px; }
}
</style>
