<template>
  <PageHeader
    eyebrow="Access Control"
    title="Module Access"
    subtitle="Control which modules, pages and restricted data each agency, and each role inside it, can reach"
  >
    <template #actions>
      <span v-if="store.isDirty" class="badge warning unsaved-pill" role="status">
        Unsaved changes in {{ store.dirtyAgencies.length }} {{ store.dirtyAgencies.length === 1 ? 'agency' : 'agencies' }}
      </span>
      <button type="button" class="btn" :disabled="!store.isDirty || store.saving" @click="store.discard()">Discard</button>
      <button type="button" class="btn-primary" :disabled="!store.isDirty || store.saving" @click="store.save()">
        {{ store.saving ? 'Saving…' : 'Save changes' }}
      </button>
    </template>
  </PageHeader>

  <div v-if="selected && !canEditEnabled" class="notice" role="note">
    <Info :size="15" class="notice-icon" aria-hidden="true" />
    <p>Your role can view this agency's access but not change it.</p>
  </div>
  <div v-if="store.saveError" class="error-banner" role="alert" aria-live="polite">⚠ {{ store.saveError }}</div>
  <div v-if="actionError" class="error-banner" role="alert" aria-live="polite">⚠ {{ actionError }}</div>

  <p v-if="!selected" class="error-banner">
    Your account isn't linked to an agency this page knows about, so there is nothing to manage here.
  </p>

  <template v-else>
    <div class="filter-bar agency-bar">
      <div class="filter-group agency-picker">
        <template v-if="isSuper">
          <label class="filter-label" for="agency-select">Agency</label>
          <select id="agency-select" v-model="selected" class="select-sm agency-select">
            <option v-for="code in agencyCodes" :key="code" :value="code">
              {{ code }} - {{ BASE_SETTINGS.agencies[code]!.name }}{{ hasChanges(code) ? ' (edited)' : '' }}
            </option>
          </select>
        </template>
        <template v-else>
          <span class="filter-label">Agency</span>
          <span class="agency-name">{{ BASE_SETTINGS.agencies[selected]!.name }} <span class="agency-code">{{ selected }}</span></span>
        </template>
      </div>
      <ul class="scope-pills" :aria-label="`${selected} modules by enabled access level`">
        <li class="badge info"><span class="pill-num">{{ moduleCounts.full }}</span> Full</li>
        <li class="badge"><span class="pill-num">{{ moduleCounts.read }}</span> Read</li>
        <li class="badge pill-muted"><span class="pill-num">{{ moduleCounts.none }}</span> Restricted</li>
      </ul>
      <span class="agency-meta">{{ lastChanged }}</span>
      <OverflowMenu :items="menuItems" :label="`More actions for ${selected}`" @select="onMenuSelect" />
    </div>

    <div v-if="isSuper && store.staleKeys.length" class="error-banner stale-note">
      <span>
        {{ store.staleKeys.length }} saved {{ store.staleKeys.length === 1 ? 'setting refers' : 'settings refer' }} to agencies,
        modules or pages that no longer exist and {{ store.staleKeys.length === 1 ? 'is' : 'are' }} ignored.
      </span>
      <button type="button" class="error-retry-btn" @click="store.clearStale()">Clear</button>
    </div>

    <section class="agency-main" :aria-label="`${selected} access`">
      <TabStrip v-model="tab" :tabs="tabs" />
      <AccessModuleFilters v-if="tab !== 'categories'" v-model="moduleFilter" />

      <AccessAgencyTab
        v-if="tab === 'agency'"
        :code="selected" :overrides="store.draft" :filter="moduleFilter"
        :can-edit-ceiling="isSuper" :can-edit-enabled="canEditEnabled"
        @edit="onEdit"
      />
      <AccessRolesTab
        v-else-if="tab === 'roles'"
        :code="selected" :overrides="store.draft" :filter="moduleFilter"
        :can-edit-ceiling="isSuper" :can-edit-enabled="canEditEnabled"
        @edit="onEdit"
      />
      <AccessCategoriesTab
        v-else
        :code="selected" :overrides="store.draft"
        :can-edit-ceiling="isSuper" :can-edit-enabled="canEditEnabled"
        @edit="onEdit"
      />
    </section>

    <SideDrawer
      :open="drawer === 'preview'" title="Preview access"
      :subtitle="`${agencyName}${store.isDirty ? ', including unsaved changes' : ''}`"
      @close="drawer = null"
    >
      <AccessPreviewPanel :code="selected" :overrides="store.draft" />
    </SideDrawer>
    <SideDrawer
      :open="drawer === 'history'" title="Permission history"
      :subtitle="`${agencyName}. Saved changes, newest first.`"
      @close="drawer = null"
    >
      <AccessHistoryList :entries="store.historyFor(selected)" />
    </SideDrawer>
    <AccessExportDialog
      :open="exportOpen" :agency-name="agencyName" :includes-unsaved="store.isDirty"
      @close="exportOpen = false" @export="runExport"
    />
  </template>

  <ConfirmDialog
    :open="!!confirmSpec"
    :title="confirmSpec?.title ?? ''"
    :message="confirmSpec?.message ?? ''"
    :confirm-label="confirmSpec?.confirmLabel ?? 'Continue'"
    danger
    @confirm="runConfirm"
    @cancel="cancelConfirm"
  />
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Download, Eye, History, Info, RotateCcw } from 'lucide-vue-next'
import { useAccessPolicyStore, AccessPolicyError } from '~/stores/accessPolicy'
import { BASE_SETTINGS, editableModules, moduleSummary } from '~/utils/resolveAccess'
import { editWarning, type AccessEdit } from '~/utils/accessEdits'
import { EMPTY_FILTER, type ModuleFilter } from '~/utils/accessFilter'
import { buildPermissionExport, pageColumns, permissionsPrintHtml } from '~/utils/accessExport'
import { useCsvExport } from '~/composables/useCsvExport'
import type { OverflowMenuItem } from '~/components/OverflowMenu.vue'
import type { ExportFormat } from '~/components/AccessExportDialog.vue'

// ── Who is looking ─────────────────────────────────────────────────────
// super_admin: every agency, every layer. Agency admin: own agency only,
// enabled + role layers. Everyone else never reaches this route
// (access-control.json: /access-policies minTier admin). The store is the
// single gate (canEditAgency re-checks the viewer's own SAVED
// /access-policies scope); the disabled controls here are only the clean
// experience, not a second copy of the check.
const { user } = useAuth()
const store = useAccessPolicyStore()

const isSuper = computed(() => user.value?.role_type === 'super_admin')
const agencyCodes = Object.keys(BASE_SETTINGS.agencies)
const ownCode = computed(() => {
  const code = user.value?.agency_code?.toUpperCase() ?? null
  return code && BASE_SETTINGS.agencies[code] ? code : null
})

const selected = ref<string | null>(isSuper.value ? agencyCodes[0] ?? null : ownCode.value)
const canEditEnabled = computed(() => !!selected.value && store.canEditAgency(selected.value))

// ── Agency picker + summary ────────────────────────────────────────────
/** "(edited)" in the picker: only real edits, not just the updatedAt/updatedBy stamp left behind after pruning. */
function hasChanges(code: string): boolean {
  const a = store.draft.agencies[code]
  return !!a && !!(a.ceiling || a.enabled || a.roles)
}

const lastChanged = computed(() => {
  const saved = selected.value ? store.overrides.agencies[selected.value] : undefined
  if (!saved?.updatedAt) return 'No saved changes. Using platform defaults.'
  const when = new Date(saved.updatedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
  return `Last saved by ${saved.updatedBy ?? 'unknown'}, ${when}`
})

/** Module count per enabled access level for the selected agency, from the draft so it tracks unsaved edits. */
const moduleCounts = computed(() => {
  const counts = { full: 0, read: 0, none: 0 }
  const code = selected.value
  if (!code) return counts
  for (const m of editableModules()) counts[moduleSummary(store.draft, code, 'enabled', null, m).scope]++
  return counts
})

const agencyName = computed(() => (selected.value ? BASE_SETTINGS.agencies[selected.value]?.name ?? selected.value : ''))

// ── Overflow menu, drawers, export ─────────────────────────────────────
const drawer = ref<'preview' | 'history' | null>(null)
const exportOpen = ref(false)
const menuItems = computed<OverflowMenuItem[]>(() => [
  { key: 'preview', label: 'Preview as role', icon: Eye },
  { key: 'history', label: 'View change history', icon: History },
  { key: 'export', label: 'Export permissions', icon: Download },
  ...(canEditEnabled.value
    ? [{ key: 'reset', label: 'Reset to agency defaults', icon: RotateCcw, danger: true, separatorBefore: true }]
    : []),
])
function onMenuSelect(key: string) {
  if (key === 'preview' || key === 'history') drawer.value = key
  else if (key === 'export') exportOpen.value = true
  else if (key === 'reset') askReset()
}

const { exportCsv } = useCsvExport()
function download(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
function runExport(format: ExportFormat) {
  const code = selected.value
  if (!code) return
  exportOpen.value = false
  const data = buildPermissionExport(store.draft, code, store.isDirty)
  const base = `uapts-module-access-${code.toLowerCase()}-${data.generatedAt.slice(0, 10)}`
  if (format === 'csv') return exportCsv(base, data.pages, pageColumns(data))
  if (format === 'json') return download(`${base}.json`, 'application/json', JSON.stringify(data, null, 2))
  const win = window.open('', '_blank')
  if (!win) {
    actionError.value = 'Your browser blocked the print window. Allow pop-ups for this site to export a PDF.'
    return
  }
  win.document.write(permissionsPrintHtml(data))
  win.document.close()
  win.focus()
  win.print()
}

// ── Tabs ───────────────────────────────────────────────────────────────
const tab = ref('agency')
/** Search + filter shared by the Agency access and Role permissions tables, kept across tab switches. */
const moduleFilter = ref<ModuleFilter>({ ...EMPTY_FILTER })
const tabs = [
  { key: 'agency', label: 'Agency access' },
  { key: 'roles', label: 'Role permissions' },
  { key: 'categories', label: 'Data categories' },
]

// ── Edits, guardrails, confirmation ────────────────────────────────────
interface ConfirmSpec { title: string; message: string; confirmLabel: string; run: () => void; cancel?: () => void }
const confirmSpec = ref<ConfirmSpec | null>(null)
const actionError = ref<string | null>(null)

function applyNow(code: string, e: AccessEdit) {
  actionError.value = null
  try {
    store.edit(code, e)
  } catch (err) {
    actionError.value = err instanceof AccessPolicyError ? err.message : 'That change could not be applied.'
  }
}

function onEdit(e: AccessEdit) {
  const code = selected.value
  if (!code) return
  // Agency admins can't make the edits these warnings describe at all - the
  // store's self-lockout guard rejects them - so only super_admin is asked.
  const warning = isSuper.value ? editWarning(store.draft, code, e) : null
  if (!warning) return applyNow(code, e)
  confirmSpec.value = { title: `Change ${code}'s access?`, message: warning, confirmLabel: 'Apply change', run: () => applyNow(code, e) }
}

function askReset() {
  const code = selected.value
  if (!code) return
  confirmSpec.value = {
    title: 'Reset agency permissions?',
    message: `This will restore ${agencyName.value}'s module access to the configured agency defaults.\n\n`
      + 'Current custom permissions will be removed. Nothing changes for users until you press Save changes.',
    confirmLabel: 'Reset to defaults',
    run: () => applyNow(code, { kind: 'reset', keepCeiling: !isSuper.value }),
  }
}

function runConfirm() {
  const spec = confirmSpec.value
  confirmSpec.value = null
  spec?.run()
}
function cancelConfirm() {
  const spec = confirmSpec.value
  confirmSpec.value = null
  spec?.cancel?.()
}

// ── Unsaved-changes guards ─────────────────────────────────────────────
onBeforeRouteLeave(() => {
  if (!store.isDirty) return true
  return new Promise<boolean>((resolve) => {
    confirmSpec.value = {
      title: 'Leave without saving?',
      message: 'Your Module Access changes have not been saved and will be discarded.',
      confirmLabel: 'Discard and leave',
      run: () => { store.discard(); resolve(true) },
      cancel: () => resolve(false),
    }
  })
})

function onBeforeUnload(ev: BeforeUnloadEvent) {
  if (!store.isDirty) return
  ev.preventDefault()
  ev.returnValue = ''
}
onMounted(() => {
  if (!store.loaded) store.load()
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
</script>

<style scoped>
.unsaved-pill { align-self: center; }


.agency-bar { gap: 10px 16px; }
.agency-picker { min-width: 0; flex: 0 1 auto; }
.agency-select { min-width: 0; max-width: 100%; }
.agency-name { font-size: 13px; font-weight: 600; color: var(--fg-1); }
.agency-code { font-family: var(--font-mono); font-size: 11px; font-weight: 500; color: var(--fg-3); margin-left: 4px; }
.scope-pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.scope-pills .badge { gap: 4px; font-size: 11px; font-weight: 600; padding: 3px 8px; }
.pill-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.pill-muted { color: var(--fg-3); }
.agency-meta { font-size: 12px; color: var(--fg-3); margin-left: auto; }

.stale-note { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

.agency-main { min-width: 0; }

@media (min-width: 769px) {
  .agency-select { width: 360px; }
}
@media (max-width: 768px) {
  /* The ••• menu pins to the bar's top-right corner instead of wrapping onto a line of its own. */
  .agency-bar { position: relative; }
  .agency-bar > .overflow-menu { position: absolute; top: 10px; right: 10px; }
  .agency-picker { flex: 1 1 100%; flex-direction: column; align-items: stretch; gap: 4px; padding-right: 48px; }
  .agency-select { width: 100%; }
  .agency-meta { margin-left: 0; flex: 1 1 100%; }
}
</style>
