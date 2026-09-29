<template>
  <!--
    DashboardEditor - the Tableau "Dashboard" workspace for UAPTS.

      ┌ toolbar: name · status · undo/redo · preview · history · save · publish ┐
      │ palette │           live canvas (12-col grid)          │ inspector tabs │
      └─────────┴──────────────────────────────────────────────┴────────────────┘

    Edits go to a DRAFT version; viewers keep the published version until
    Publish. Every publish is a restorable version.
  -->
  <div class="de" :class="{ 'de--preview': previewMode }">
    <header class="de-bar">
      <NuxtLink to="/admin/dashboards" class="de-icon-btn" aria-label="Back to all dashboards" title="All dashboards">
        <ArrowLeft :size="16" aria-hidden="true" />
      </NuxtLink>
      <input v-model="name" type="text" class="de-name" aria-label="Dashboard name">
      <span class="badge" :class="STATUS_CLASS[record.status]">{{ STATUS_LABEL[record.status] }}<template v-if="record.publishedVersion"> v{{ record.publishedVersion }}</template></span>
      <span v-if="dirty" class="badge warning" role="status">Unsaved changes</span>
      <span v-else-if="hasUnpublished" class="de-meta">Draft has unpublished edits</span>

      <div class="de-bar-actions">
        <div class="de-history-btns" role="group" aria-label="Undo and redo">
          <button type="button" class="de-icon-btn" :disabled="!canUndo" aria-label="Undo" title="Undo (Ctrl+Z)" @click="undo"><Undo2 :size="15" aria-hidden="true" /></button>
          <button type="button" class="de-icon-btn" :disabled="!canRedo" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" @click="redo"><Redo2 :size="15" aria-hidden="true" /></button>
        </div>
        <button type="button" class="btn btn-sm" :aria-pressed="previewMode" @click="previewMode = !previewMode">
          <component :is="previewMode ? PencilLine : Eye" :size="14" aria-hidden="true" />{{ previewMode ? 'Back to editing' : 'Preview' }}
        </button>
        <button type="button" class="btn btn-sm" @click="historyOpen = true"><History :size="14" aria-hidden="true" />Versions</button>
        <button type="button" class="btn btn-sm" :disabled="!dirty || saving" title="Save draft (Ctrl+S)" @click="saveDraft">{{ saving ? 'Saving…' : 'Save draft' }}</button>
        <button type="button" class="btn btn-sm btn-primary" :disabled="saving || publishing || !def.widgets.length" @click="publishOpen = true">Publish…</button>
      </div>
    </header>

    <div v-if="previewViewer" class="notice de-notice" role="status">
      <Eye :size="15" class="notice-icon" aria-hidden="true" />
      <p>
        Showing the canvas as <strong>{{ previewViewer.agencyCode ?? 'no agency' }}{{ previewViewer.departmentCode ? ` · ${previewViewer.departmentCode}` : '' }}{{ previewViewer.roles.length ? ` · ${previewViewer.roles.join(', ')}` : '' }}</strong>.
        Widgets they can't access are hidden.
      </p>
      <button type="button" class="btn btn-sm" @click="previewViewer = null">Stop</button>
    </div>
    <div v-if="error" class="error-banner de-error" role="alert" aria-live="polite">
      <span>⚠ {{ error }}</span>
      <button type="button" class="error-retry-btn" @click="error = null">Dismiss</button>
    </div>

    <!-- ── Preview: the real renderer, exactly as viewers get it ── -->
    <DashboardRenderer v-if="previewMode" :definition="def" :sync-url="false" />

    <div v-else class="de-body">
      <div class="de-left">
        <WidgetPalette @add="addWidget" />
      </div>

      <!-- A <section>, not <main>: the layout's global `main` rule adds the sidebar/nav margins. -->
      <section class="de-canvas-wrap" aria-label="Dashboard canvas">
        <div class="de-canvas-head">
          <input v-model="def.title" type="text" class="de-title" aria-label="Dashboard heading" @change="commit">
          <input v-model="def.subtitle" type="text" class="de-subtitle" placeholder="Add a subtitle" aria-label="Dashboard subtitle" @change="commit">
        </div>
        <DashboardFilterBar :filters="def.filters" :engine="engine" />
        <DashboardCanvas
          :widgets="def.widgets" :row-height="def.theme.rowHeight" :gap="def.theme.gap" :selected-id="selectedId"
          @update:widgets="setWidgets" @select="selectedId = $event"
          @add="addWidget" @remove="removeWidget" @duplicate="duplicateWidget"
        />
      </section>

      <aside class="de-right" aria-label="Dashboard settings">
        <div class="de-tabs" role="tablist">
          <button
            v-for="t in TABS" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key"
            :class="{ on: tab === t.key }" @click="tab = t.key"
          >{{ t.label }}<span v-if="t.count?.()" class="de-tab-n">{{ t.count() }}</span></button>
        </div>
        <div class="de-tab-body" role="tabpanel">
          <WidgetInspector v-if="tab === 'widget'" :widget="selected" @change="replaceWidget" />
          <FilterDesigner v-else-if="tab === 'filters'" :filters="def.filters" :widgets="def.widgets" @update:filters="set('filters', $event)" />
          <ActionDesigner v-else-if="tab === 'actions'" :actions="def.actions" :widgets="def.widgets" @update:actions="set('actions', $event)" />
          <AudiencePanel
            v-else-if="tab === 'audience'" :dashboard="record" :all-dashboards="allDashboards" :previewing="!!previewViewer"
            @saved="onAssignmentsSaved" @preview="previewViewer = $event"
          />
          <div v-else class="de-settings">
            <label class="de-field"><span class="de-label">Description</span><textarea v-model="description" rows="3" /></label>
            <label class="de-field"><span class="de-label">Density</span>
              <select v-model="def.theme.density" @change="commit">
                <option value="comfortable">Comfortable</option><option value="compact">Compact</option>
              </select>
            </label>
            <div class="de-pair">
              <label class="de-field"><span class="de-label">Row height (px)</span><input v-model.number="def.theme.rowHeight" type="number" min="40" max="160" class="de-num" @change="commit"></label>
              <label class="de-field"><span class="de-label">Gap (px)</span><input v-model.number="def.theme.gap" type="number" min="0" max="32" class="de-num" @change="commit"></label>
            </div>
            <label class="de-field"><span class="de-label">Auto-refresh</span>
              <select v-model.number="def.refreshInterval" @change="commit">
                <option :value="0">Off</option><option :value="60">Every minute</option><option :value="120">Every 2 minutes</option>
                <option :value="300">Every 5 minutes</option><option :value="900">Every 15 minutes</option>
              </select>
            </label>
            <div class="de-danger">
              <button type="button" class="btn btn-sm" @click="emit('duplicate')"><Copy :size="14" aria-hidden="true" />Duplicate</button>
              <button v-if="!record.isSystem" type="button" class="btn btn-sm de-btn-danger" @click="emit('archive')"><Archive :size="14" aria-hidden="true" />Archive</button>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- ── Publish ── -->
    <SideDrawer :open="publishOpen" title="Publish dashboard" subtitle="Viewers switch to this version as soon as you publish." @close="publishOpen = false">
      <div class="de-publish">
        <dl class="de-summary">
          <div><dt>Widgets</dt><dd>{{ def.widgets.length }}</dd></div>
          <div><dt>Filters</dt><dd>{{ def.filters.length }}</dd></div>
          <div><dt>Actions</dt><dd>{{ def.actions.length }}</dd></div>
        </dl>
        <div class="de-field">
          <span class="de-label">Audience</span>
          <ul v-if="record.assignments.length" class="de-aud">
            <li v-for="a in record.assignments" :key="a.id" class="badge info">{{ describeScope(a) }}</li>
          </ul>
          <p v-else class="de-muted">Nobody yet. Only editors will be able to open it.</p>
        </div>
        <div v-if="warnings.length" class="de-warnings" role="note">
          <TriangleAlert :size="15" aria-hidden="true" class="de-warn-icon" />
          <ul><li v-for="w in warnings" :key="w">{{ w }}</li></ul>
        </div>
        <label class="de-field"><span class="de-label">Change note</span><textarea v-model="publishNote" rows="3" placeholder="What changed and why" /></label>
      </div>
      <template #footer>
        <div class="de-drawer-actions">
          <button type="button" class="btn" @click="publishOpen = false">Cancel</button>
          <button type="button" class="btn-primary" :disabled="publishing" @click="publish">{{ publishing ? 'Publishing…' : 'Publish now' }}</button>
        </div>
      </template>
    </SideDrawer>

    <!-- ── Versions ── -->
    <SideDrawer :open="historyOpen" title="Versions" subtitle="Restoring copies a version into the draft. Viewers keep the published one until you publish." @close="historyOpen = false">
      <div v-if="versionsError" class="error-banner" role="alert">⚠ {{ versionsError }}</div>
      <EmptyState v-if="versionsLoading" loading compact />
      <ol v-else-if="versions.length" class="de-versions">
        <li v-for="v in versions" :key="v.version" class="de-version">
          <div class="de-v-top">
            <span class="de-v-num">v{{ v.version }}</span>
            <span v-if="v.published" class="badge success">Published</span>
            <span v-else-if="v.version === record.draftVersion" class="badge">Current draft</span>
            <button
              v-if="v.version !== record.draftVersion" type="button" class="btn btn-sm de-v-restore"
              :disabled="restoring !== null" @click="restore(v.version)"
            >{{ restoring === v.version ? 'Restoring…' : 'Restore to draft' }}</button>
          </div>
          <p v-if="v.note" class="de-v-note">{{ v.note }}</p>
          <div class="de-v-meta">{{ new Date(v.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }) }} · {{ v.createdBy }}</div>
        </li>
      </ol>
      <p v-else-if="!versionsError" class="de-muted">No versions yet.</p>
    </SideDrawer>
  </div>
</template>

<script setup lang="ts">
import { Archive, ArrowLeft, Copy, Eye, History, PencilLine, Redo2, TriangleAlert, Undo2 } from 'lucide-vue-next'
import type { DashboardDefinition, DashboardRecord, DashboardStatus, DashboardSummary, ViewerContext, WidgetInstance } from '~/types/dashboard'
import { WIDGETS_BY_TYPE, widgetFilterFields } from '~/utils/widgetRegistry'
import { findSpot, newId, settle, compact } from '~/utils/layoutEngine'
import { describeScope } from '~/utils/resolveDashboard'
import { useDashboardApi, toDashboardApiError, type DashboardVersionInfo } from '~/composables/useDashboardApi'
import { provideDashboardFilters } from '~/composables/useDashboardFilters'
import DashboardRenderer from '~/components/dashboard/DashboardRenderer.vue'
import DashboardCanvas from '~/components/dashboard/DashboardCanvas.vue'
import DashboardFilterBar from '~/components/dashboard/DashboardFilterBar.vue'
import WidgetPalette from '~/components/dashboard/editor/WidgetPalette.vue'
import WidgetInspector from '~/components/dashboard/editor/WidgetInspector.vue'
import FilterDesigner from '~/components/dashboard/editor/FilterDesigner.vue'
import ActionDesigner from '~/components/dashboard/editor/ActionDesigner.vue'
import AudiencePanel from '~/components/dashboard/editor/AudiencePanel.vue'

const props = defineProps<{ initial: DashboardRecord; allDashboards: DashboardSummary[] }>()
const emit = defineEmits<{ saved: [DashboardRecord]; duplicate: []; archive: [] }>()
const api = useDashboardApi()

const STATUS_LABEL: Record<DashboardStatus, string> = { published: 'Published', draft: 'Draft', archived: 'Archived' }
const STATUS_CLASS: Record<DashboardStatus, string> = { published: 'success', draft: '', archived: 'pill-muted' }

const record = ref<DashboardRecord>(props.initial)
const def = ref<DashboardDefinition>(structuredClone(toRaw(props.initial.definition)))
const name = ref(props.initial.name)
const description = ref(props.initial.description)
const selectedId = ref<string | null>(null)
const selected = computed(() => def.value.widgets.find(w => w.id === selectedId.value) ?? null)
const tab = ref<TabKey>('widget')
const previewMode = ref(false)
const error = ref<string | null>(null)

type TabKey = 'widget' | 'filters' | 'actions' | 'audience' | 'settings'
const TABS: { key: TabKey; label: string; count?: () => number }[] = [
  { key: 'widget', label: 'Widget' },
  { key: 'filters', label: 'Filters', count: () => def.value.filters.length },
  { key: 'actions', label: 'Actions', count: () => def.value.actions.length },
  { key: 'audience', label: 'Audience', count: () => record.value.assignments.length },
  { key: 'settings', label: 'Settings' },
]

watch(selectedId, (id) => { if (id) tab.value = 'widget' })

// Live widgets on the canvas need the same context the renderer provides.
const previewViewer = ref<ViewerContext | null>(null)
provide('dashboard:viewerOverride', previewViewer)
provide('dashboard:refreshTick', ref(0))
const { viewer } = useViewerContext()
const engine = provideDashboardFilters(def as Ref<DashboardDefinition | null>, viewer as Ref<ViewerContext | null>, { syncUrl: false })

// ── undo / redo (snapshots of the whole definition - it's small) ─────────
const past = ref<string[]>([])
const future = ref<string[]>([])
let last = JSON.stringify(def.value)
const savedSnapshot = ref(last + name.value + description.value)
const dirty = computed(() => JSON.stringify(def.value) + name.value + description.value !== savedSnapshot.value)
const hasUnpublished = computed(() => record.value.publishedVersion !== record.value.draftVersion)
const canUndo = computed(() => past.value.length > 0)
const canRedo = computed(() => future.value.length > 0)

function commit() {
  const now = JSON.stringify(def.value)
  if (now === last) return
  past.value = [...past.value.slice(-99), last]
  future.value = []
  last = now
}
function undo() {
  const prev = past.value.at(-1)
  if (!prev) return
  future.value = [last, ...future.value]
  past.value = past.value.slice(0, -1)
  last = prev
  def.value = JSON.parse(prev)
}
function redo() {
  const nxt = future.value[0]
  if (!nxt) return
  past.value = [...past.value, last]
  future.value = future.value.slice(1)
  last = nxt
  def.value = JSON.parse(nxt)
}

function set<K extends keyof DashboardDefinition>(key: K, value: DashboardDefinition[K]) {
  def.value = { ...def.value, [key]: value }
  commit()
}

// ── widget operations ───────────────────────────────────────────────────
function setWidgets(widgets: WidgetInstance[]) { set('widgets', widgets) }

function addWidget(type: string, at?: { x: number; y: number }) {
  const d = WIDGETS_BY_TYPE[type]
  if (!d) return
  const spot = at ?? findSpot(def.value.widgets, d.defaultSize)
  const w: WidgetInstance = { id: newId(), type, x: spot.x, y: spot.y, w: d.defaultSize.w, h: d.defaultSize.h, config: { ...(d.defaultConfig ?? {}) } }
  set('widgets', settle([...def.value.widgets, w], w.id))
  selectedId.value = w.id
}
function replaceWidget(w: WidgetInstance) {
  set('widgets', settle(def.value.widgets.map(x => (x.id === w.id ? w : x)), w.id))
}
function duplicateWidget(id: string) {
  const src = def.value.widgets.find(w => w.id === id)
  if (!src) return
  const spot = findSpot(def.value.widgets, { w: src.w, h: src.h })
  const copy: WidgetInstance = { ...structuredClone(toRaw(src)), id: newId(), ...spot }
  set('widgets', [...def.value.widgets, copy])
  selectedId.value = copy.id
}
function removeWidget(id: string) {
  // Removing a widget also removes it from every filter/action that pointed at it.
  const d = def.value
  def.value = {
    ...d,
    widgets: compact(d.widgets.filter(w => w.id !== id)),
    filters: d.filters.map(f => (f.appliesTo === 'all' ? f : { ...f, appliesTo: f.appliesTo.filter(x => x !== id) })),
    actions: d.actions
      .filter(a => a.sourceWidgetId !== id)
      .map(a => (a.targetWidgetIds === 'all' ? a : { ...a, targetWidgetIds: a.targetWidgetIds.filter(x => x !== id) })),
  }
  commit()
  if (selectedId.value === id) selectedId.value = null
}

// ── save / publish ──────────────────────────────────────────────────────
const saving = ref(false)
async function saveDraft() {
  saving.value = true
  error.value = null
  try {
    record.value = await api.saveDraft(record.value.id, def.value, { name: name.value, description: description.value })
    savedSnapshot.value = JSON.stringify(def.value) + name.value + description.value
    emit('saved', record.value)
  } catch (e) {
    error.value = `Draft not saved: ${toDashboardApiError(e).message}`
  } finally { saving.value = false }
}

const publishOpen = ref(false)
const publishing = ref(false)
const publishNote = ref('')
const warnings = computed(() => {
  const out: string[] = []
  for (const f of def.value.filters) {
    const targets = f.appliesTo === 'all' ? def.value.widgets : def.value.widgets.filter(w => (f.appliesTo as string[]).includes(w.id))
    if (!targets.some(w => widgetFilterFields(w.type, w.config).includes(f.field))) out.push(`Filter “${f.label}” doesn't affect any widget.`)
  }
  for (const a of def.value.actions) {
    if (a.type === 'navigate' && !a.urlTemplate) out.push(`Action “${a.name}” has no route.`)
  }
  if (!record.value.assignments.length) out.push('No audience assigned - nobody will be routed to this dashboard.')
  return out
})
async function publish() {
  publishing.value = true
  error.value = null
  try {
    if (dirty.value) await saveDraft()
    if (error.value) return
    record.value = await api.publish(record.value.id, publishNote.value)
    publishOpen.value = false
    publishNote.value = ''
    emit('saved', record.value)
  } catch (e) {
    error.value = `Not published: ${toDashboardApiError(e).message}`
  } finally { publishing.value = false }
}

function onAssignmentsSaved(list: DashboardRecord['assignments']) {
  record.value = { ...record.value, assignments: list }
  emit('saved', record.value)
}

// ── history ─────────────────────────────────────────────────────────────
const historyOpen = ref(false)
const versions = ref<DashboardVersionInfo[]>([])
const versionsLoading = ref(false)
const versionsError = ref<string | null>(null)
const restoring = ref<number | null>(null)
watch(historyOpen, async (open) => {
  if (!open) return
  versionsLoading.value = true
  versionsError.value = null
  try { versions.value = await api.versions(record.value.id) } catch (e) {
    versionsError.value = `Couldn't load versions: ${toDashboardApiError(e).message}`
  } finally { versionsLoading.value = false }
})
async function restore(v: number) {
  restoring.value = v
  versionsError.value = null
  try {
    record.value = await api.restore(record.value.id, v)
    def.value = structuredClone(toRaw(record.value.definition))
    commit()
    savedSnapshot.value = JSON.stringify(def.value) + name.value + description.value
    historyOpen.value = false
    emit('saved', record.value)
  } catch (e) {
    versionsError.value = `v${v} not restored: ${toDashboardApiError(e).message}`
  } finally { restoring.value = null }
}

// ── keyboard + leave guard ──────────────────────────────────────────────
function onKey(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return
  const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
  if (e.key.toLowerCase() === 's') { e.preventDefault(); if (dirty.value) saveDraft() }
  else if (!inField && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
}
function onBeforeUnload(e: BeforeUnloadEvent) { if (dirty.value) { e.preventDefault(); e.returnValue = '' } }
onMounted(() => { window.addEventListener('keydown', onKey); window.addEventListener('beforeunload', onBeforeUnload) })
onUnmounted(() => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onBeforeUnload) })
onBeforeRouteLeave(() => (dirty.value ? window.confirm('You have unsaved changes. Leave anyway?') : true))
</script>

<style scoped>
.de { display: flex; flex-direction: column; gap: 10px; min-height: calc(100vh - var(--nav-h) - 40px); }

/* ── toolbar: sticks under the fixed top nav ── */
.de-bar {
  display: flex; align-items: center; gap: 8px 10px; flex-wrap: wrap; padding: 8px 10px;
  background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius);
  position: sticky; top: var(--nav-h); z-index: 30;
}
.de-icon-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex-shrink: 0;
  border: 1px solid transparent; border-radius: var(--r-sm); background: none; color: var(--fg-2); cursor: pointer; text-decoration: none;
  transition: background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard), transform 120ms var(--ease-out);
}
.de-icon-btn:active:not(:disabled) { transform: scale(0.96); }
.de-icon-btn:disabled { color: var(--fg-3); opacity: .45; cursor: not-allowed; }
.de-icon-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.de-history-btns { display: inline-flex; gap: 2px; padding-right: 6px; margin-right: 2px; border-right: 1px solid var(--border-subtle); }
.de-name {
  width: auto; flex: 0 1 320px; min-width: 140px; font-size: 14px; font-weight: 600; color: var(--fg-1);
  border: 1px solid transparent; background: none; padding: 4px 8px;
}
.de-name:focus { border-color: var(--primary); background: var(--surface-1); }
.de-meta { font-size: 11.5px; color: var(--fg-3); }
.de-bar-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.de-bar-actions .btn { gap: 6px; }

.de-notice { margin: 0; align-items: center; }
.de-notice p { flex: 1; }
.de-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

/* ── three panes ── */
.de-body { display: grid; grid-template-columns: 240px minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
.de-left, .de-right { position: sticky; top: calc(var(--nav-h) + 58px); max-height: calc(100vh - var(--nav-h) - 72px); overflow-y: auto; overscroll-behavior: contain; }
.de-canvas-wrap { min-width: 0; padding-top: 14px; }
/* The toolbar already sticks here; a second sticky bar would stack under it. */
.de-canvas-wrap :deep(.fbar) { position: static; }
.de-canvas-head { display: flex; flex-direction: column; gap: 2px; margin-bottom: 10px; }
.de-title, .de-subtitle { width: 100%; border: 1px solid transparent; background: none; padding: 2px 6px; margin-left: -6px; }
.de-title { font-size: 19px; font-weight: 700; letter-spacing: .055em; text-transform: uppercase; color: var(--fg-1); }
.de-subtitle { font-size: 12.5px; color: var(--fg-2); }
.de-title:focus, .de-subtitle:focus { border-color: var(--primary); background: var(--surface-1); }

.de-right { background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius); }
.de-tabs { display: flex; border-bottom: 1px solid var(--border-subtle); position: sticky; top: 0; background: var(--surface-2); z-index: 1; }
.de-tabs button {
  flex: 1; border: 0; background: none; padding: 10px 4px 9px; margin-bottom: -1px; font-size: 11.5px; font-weight: 500; color: var(--fg-3); cursor: pointer;
  border-bottom: 2px solid transparent; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  transition: color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
.de-tabs button.on { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.de-tabs button:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.de-tab-n { font-size: 10px; font-family: var(--font-mono); background: var(--surface-sunken); border-radius: var(--r-pill); padding: 0 5px; color: var(--fg-2); font-weight: 600; }
.de-tabs button.on .de-tab-n { background: var(--primary); color: #fff; }
.de-tab-body { padding: 14px 12px; }

/* ── settings tab ── */
.de-settings { display: flex; flex-direction: column; gap: 12px; }
.de-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.de-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--fg-3); font-weight: 700; }
.de-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.de-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.de-danger { display: flex; gap: 6px; padding-top: 12px; border-top: 1px solid var(--border-subtle); }
.de-danger .btn { gap: 6px; }
.de-btn-danger { color: var(--danger-fg); }

/* ── drawers ── */
.de-publish { display: flex; flex-direction: column; gap: 16px; font-size: 12.5px; color: var(--fg-2); }
.de-summary { display: grid; grid-template-columns: repeat(3, 1fr); margin: 0; border: 1px solid var(--border-subtle); border-radius: var(--r-sm); }
.de-summary > div { padding: 10px 12px; }
.de-summary > div + div { border-left: 1px solid var(--border-subtle); }
.de-summary dt { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--fg-3); font-weight: 700; }
.de-summary dd { margin: 2px 0 0; font-family: var(--font-mono); font-size: 18px; font-weight: 600; color: var(--fg-1); font-variant-numeric: tabular-nums; }
.de-aud { display: flex; flex-wrap: wrap; gap: 4px; margin: 0; padding: 0; list-style: none; }
.de-muted { margin: 0; font-size: 12.5px; color: var(--fg-3); }
.de-warnings {
  display: flex; gap: 10px; padding: 10px 12px; border-radius: var(--r-sm); font-size: 12px; line-height: 1.5;
  background: var(--warning-bg); color: var(--warning-fg); border: 1px solid color-mix(in srgb, var(--warning-fg) 22%, transparent);
}
.de-warnings ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.de-warn-icon { flex-shrink: 0; margin-top: 2px; }
.de-drawer-actions { display: flex; justify-content: flex-end; gap: 8px; }

.de-versions { list-style: none; margin: 0; padding: 0; }
.de-version { display: flex; flex-direction: column; gap: 4px; padding: 12px 0; border-bottom: 1px solid var(--border-subtle); }
.de-version:first-child { padding-top: 0; }
.de-v-top { display: flex; align-items: center; gap: 8px; }
.de-v-num { font-family: var(--font-mono); font-size: 13px; font-weight: 600; color: var(--fg-1); font-variant-numeric: tabular-nums; }
.de-v-restore { margin-left: auto; }
.de-v-note { margin: 0; font-size: 12.5px; color: var(--fg-1); }
.de-v-meta { font-size: 11px; color: var(--fg-3); }

@media (hover: hover) {
  .de-icon-btn:hover:not(:disabled) { background: var(--surface-quiet); color: var(--fg-1); }
  .de-name:hover:not(:focus), .de-title:hover:not(:focus), .de-subtitle:hover:not(:focus) { border-color: var(--border-interactive); }
  .de-tabs button:hover:not(.on) { color: var(--fg-1); }
}
@media (prefers-reduced-motion: reduce) {
  .de-icon-btn:active:not(:disabled) { transform: none; }
}
@media (max-width: 1280px) { .de-body { grid-template-columns: 210px minmax(0, 1fr) 290px; } }
@media (max-width: 1024px) {
  .de-body { grid-template-columns: 1fr; }
  .de-left, .de-right { position: static; max-height: none; }
  .de-left { order: 2; }
  .de-right { order: 3; }
}
@media (max-width: 768px) {
  .de-bar { position: static; }
  .de-name { flex: 1 1 0; }
  .de-bar-actions { margin-left: 0; flex: 1 1 100%; }
}
</style>
