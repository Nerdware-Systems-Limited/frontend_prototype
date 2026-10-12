<template>
  <!--
    Inspector for the selected widget, in three tabs:
      Data    - title, the binding picker (generic widgets) and the widget's
                own options, rendered from its definition's `options` schema
      Actions - what a click on it does, and which filters / actions reach it
      Style   - frame format and exact grid position
    plus a JSON view of exactly what is stored. Every change emits a whole new
    WidgetInstance so the editor's undo stack captures it.
  -->
  <div v-if="widget && def" class="insp">
    <div class="insp-head">
      <div class="insp-name">
        <strong>{{ def.title }}</strong>
        <code class="insp-id">{{ widget.id }}</code>
      </div>
      <button type="button" class="insp-json-btn" :aria-pressed="jsonOpen" title="Show the stored JSON" @click="jsonOpen = !jsonOpen">
        <Braces :size="13" aria-hidden="true" />JSON
      </button>
    </div>

    <ul v-if="issues.length" class="insp-issues" role="list" aria-label="Problems with this widget">
      <li v-for="i in issues" :key="i.message" :class="i.level">
        <component :is="i.level === 'error' ? CircleAlert : TriangleAlert" :size="13" aria-hidden="true" />
        <span>{{ i.message }}</span>
      </li>
    </ul>

    <WidgetJson v-if="jsonOpen" :widget="widget" @change="emit('change', $event)" />

    <template v-else>
      <div class="insp-tabs" role="tablist" aria-label="Widget settings">
        <button
          v-for="t in TABS" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key"
          :class="{ on: tab === t.key }" @click="tab = t.key"
        ><component :is="t.icon" :size="13" aria-hidden="true" />{{ t.label }}</button>
      </div>

      <!-- ── Data ── -->
      <div v-if="tab === 'data'" class="insp-body" role="tabpanel">
        <label class="insp-field">
          <span class="insp-label">Title</span>
          <input type="text" class="insp-input" :value="widget.title ?? ''" :placeholder="titlePlaceholder" @input="patch({ title: val($event) || undefined })">
        </label>
        <BindingEditor v-if="isBound" :widget="widget" @change="emit('change', $event)" />
        <div v-if="def.options?.length" class="insp-options">
          <OptionField
            v-for="o in def.options" :key="o.key" :option="o" :value="config[o.key]"
            @change="v => patchConfig({ [o.key]: v })"
          />
        </div>
        <p v-if="!isBound && !def.options?.length" class="insp-note">This widget has nothing to configure beyond its title and style.</p>
      </div>

      <!-- ── Actions ── -->
      <div v-else-if="tab === 'actions'" class="insp-body" role="tabpanel">
        <section class="insp-sec">
          <h3 class="insp-label">When a viewer clicks it</h3>
          <template v-if="emits.length">
            <p class="insp-note">A click selects a value for <strong>{{ emits.map(f => FIELD_LABELS[f].toLowerCase()).join(' or ') }}</strong>.</p>
            <ul v-if="ownActions.length" class="insp-rows">
              <li v-for="a in ownActions" :key="a.id"><Zap :size="12" aria-hidden="true" />{{ describeAction(a) }}</li>
            </ul>
            <p v-else class="insp-note">Nothing happens yet.</p>
            <div class="insp-btns">
              <button type="button" class="btn btn-sm" @click="emit('add-action', widget.id)"><Plus :size="13" aria-hidden="true" />Add click action</button>
              <button v-if="ownActions.length" type="button" class="insp-link" @click="emit('open-tab', 'actions')">Edit in Actions</button>
            </div>
          </template>
          <p v-else class="insp-note">
            Clicks on this widget don't pick a value, so it can't drive actions.
            <template v-if="binding && (binding.shape === 'categorical' || binding.shape === 'rows')"> Set <strong>Click filters by</strong> in the Data tab to make it clickable.</template>
          </p>
        </section>

        <section class="insp-sec">
          <h3 class="insp-label">What reaches it</h3>
          <p class="insp-note">Honours filters on: <strong>{{ fields.length ? fields.map(f => FIELD_LABELS[f]).join(', ') : 'nothing' }}</strong></p>
          <ul v-if="filters.length || incoming.length" class="insp-rows">
            <li v-for="f in filters" :key="f.id" :class="{ off: filterStatus(f) !== 'applies' }">
              <Filter :size="12" aria-hidden="true" />
              <span>{{ f.label }}</span>
              <span class="insp-tag">{{ FILTER_STATUS[filterStatus(f)] }}</span>
            </li>
            <li v-for="a in incoming" :key="a.id"><Zap :size="12" aria-hidden="true" /><span>{{ a.name }}</span><span class="insp-tag">{{ a.type }}</span></li>
          </ul>
          <p v-else class="insp-note">
            No dashboard filters yet. <button type="button" class="insp-link" @click="emit('open-tab', 'filters')">Add a filter</button>
          </p>
        </section>

        <section class="insp-sec">
          <h3 class="insp-label">Who sees it</h3>
          <p class="insp-note">
            <template v-if="perms.length">
              Viewers with
              <template v-for="(p, i) in perms" :key="p"><template v-if="i"> or </template><code>{{ p }}</code></template>.
              Stripped server-side for everyone else.
            </template>
            <template v-else>Anyone the dashboard is assigned to.</template>
          </p>
        </section>
      </div>

      <!-- ── Style ── -->
      <div v-else class="insp-body" role="tabpanel">
        <label class="insp-check">
          <input type="checkbox" :checked="style.showTitle" @change="patchStyle({ showTitle: checked($event) })"> Show title bar
        </label>
        <label class="insp-row">Background
          <select class="insp-input" :value="style.background" @change="patchStyle({ background: val($event) as WidgetStyle['background'] })">
            <option value="surface">Card</option><option value="sunken">Sunken</option><option value="transparent">None</option>
          </select>
        </label>
        <label class="insp-row">Padding
          <select class="insp-input" :value="style.padding" @change="patchStyle({ padding: val($event) as WidgetStyle['padding'] })">
            <option value="normal">Normal</option><option value="compact">Compact</option><option value="none">None</option>
          </select>
        </label>
        <label class="insp-row">Accent
          <select class="insp-input" :value="style.accent" @change="patchStyle({ accent: val($event) as WidgetStyle['accent'] })">
            <option value="none">None</option><option value="primary">Primary</option><option value="info">Info</option>
            <option value="success">Success</option><option value="warning">Warning</option><option value="danger">Danger</option>
          </select>
        </label>
        <label class="insp-check"><input type="checkbox" :checked="style.border" @change="patchStyle({ border: checked($event) })"> Border</label>

        <fieldset class="insp-set">
          <legend class="insp-label">Position &amp; size <span class="insp-hint">(grid units, 12 columns)</span></legend>
          <div class="insp-grid4">
            <label v-for="k in (['x', 'y', 'w', 'h'] as const)" :key="k">{{ k.toUpperCase() }}
              <input class="insp-input insp-num" type="number" :min="k === 'w' || k === 'h' ? 1 : 0" :max="k === 'x' ? 11 : k === 'w' ? 12 : 99" :value="widget[k]" @change="patchBox(k, Number(val($event)))">
            </label>
          </div>
        </fieldset>
      </div>
    </template>
  </div>
  <div v-else class="insp-empty">
    <MousePointerClick :size="18" aria-hidden="true" />
    <p>Select a widget on the canvas to edit its data, actions and style.</p>
  </div>
</template>

<script setup lang="ts">
import { Braces, CircleAlert, Database, Filter, MousePointerClick, Paintbrush, Plus, TriangleAlert, Zap } from 'lucide-vue-next'
import type { DashboardAction, DashboardFilter, WidgetInstance, WidgetStyle } from '~/types/dashboard'
import { BOUND_TYPES, WIDGETS_BY_TYPE, isFramed, widgetEmits, widgetFilterFields, widgetPermissions } from '~/utils/widgetRegistry'
import { bindingOf } from '~/utils/bindings'
import { FIELD_LABELS } from '~/utils/filterFields'
import { clampBox } from '~/utils/layoutEngine'
import { widgetIssues } from '~/utils/widgetValidation'
import type { CatalogScope } from '~/utils/agencyCatalog'
import BindingEditor from '~/components/dashboard/editor/BindingEditor.vue'
import OptionField from '~/components/dashboard/editor/OptionField.vue'
import WidgetJson from '~/components/dashboard/editor/WidgetJson.vue'

const props = withDefaults(defineProps<{
  widget: WidgetInstance | null
  filters?: DashboardFilter[]
  actions?: DashboardAction[]
}>(), { filters: () => [], actions: () => [] })
const emit = defineEmits<{
  'change': [WidgetInstance]
  'add-action': [widgetId: string]
  'open-tab': [tab: 'actions' | 'filters']
}>()

type TabKey = 'data' | 'actions' | 'style'
const TABS = [
  { key: 'data' as const, label: 'Data', icon: Database },
  { key: 'actions' as const, label: 'Actions', icon: Zap },
  { key: 'style' as const, label: 'Style', icon: Paintbrush },
]
const tab = ref<TabKey>('data')
const jsonOpen = ref(false)

const def = computed(() => (props.widget ? WIDGETS_BY_TYPE[props.widget.type] : null))
const config = computed<Record<string, unknown>>(() => ({ ...(def.value?.defaultConfig ?? {}), ...(props.widget?.config ?? {}) }))
const isBound = computed(() => !!props.widget && BOUND_TYPES.has(props.widget.type))
const binding = computed(() => (isBound.value ? bindingOf(config.value) : null))
const titlePlaceholder = computed(() => String(config.value.presetTitle ?? def.value?.title ?? ''))
const style = computed<Required<WidgetStyle>>(() => {
  const framed = props.widget ? isFramed(props.widget.type) : true
  const s = props.widget?.style ?? {}
  return {
    showTitle: s.showTitle ?? framed, background: s.background ?? (framed ? 'surface' : 'transparent'),
    border: s.border ?? framed, padding: s.padding ?? (framed ? 'normal' : 'none'), accent: s.accent ?? 'none',
  }
})

const scope = inject<Ref<CatalogScope | null> | null>('dashboard:catalogScope', null)
const issues = computed(() => (props.widget ? widgetIssues(props.widget, scope?.value ?? null) : []))
const perms = computed(() => (props.widget ? widgetPermissions(props.widget.type, config.value) : []))
const fields = computed(() => (props.widget ? widgetFilterFields(props.widget.type, config.value) : []))
const emits = computed(() => (props.widget ? widgetEmits(props.widget.type, config.value) : []))

// ── actions & filters around this widget ──
const ownActions = computed(() => props.actions.filter(a => a.sourceWidgetId === props.widget?.id))
const incoming = computed(() => props.actions.filter(a =>
  a.type !== 'navigate' && a.sourceWidgetId !== props.widget?.id && fields.value.includes(a.field)
  && (a.targetWidgetIds === 'all' || a.targetWidgetIds.includes(props.widget!.id))))
const FILTER_STATUS = { 'applies': 'applies', 'not-selected': 'not applied', 'unsupported': "can't honour" } as const
function filterStatus(f: DashboardFilter): keyof typeof FILTER_STATUS {
  if (!fields.value.includes(f.field)) return 'unsupported'
  return f.appliesTo === 'all' || f.appliesTo.includes(props.widget!.id) ? 'applies' : 'not-selected'
}
function describeAction(a: DashboardAction) {
  const field = FIELD_LABELS[a.field].toLowerCase()
  if (a.type === 'navigate') return `Opens ${a.urlTemplate || '(no route yet)'} with the ${field}`
  const n = a.targetWidgetIds === 'all' ? 'every compatible widget' : `${a.targetWidgetIds.length} widget${a.targetWidgetIds.length === 1 ? '' : 's'}`
  return `${a.type === 'filter' ? 'Filters' : 'Highlights'} ${n} by ${field}`
}

// ── edits ──
const val = (e: Event) => (e.target as HTMLInputElement).value
const checked = (e: Event) => (e.target as HTMLInputElement).checked
function patch(p: Partial<WidgetInstance>) { if (props.widget) emit('change', { ...props.widget, ...p }) }
function patchConfig(p: Record<string, unknown>) {
  const next = { ...(props.widget?.config ?? {}), ...p }
  for (const [k, v] of Object.entries(p)) if (v === undefined) delete next[k]
  patch({ config: next })
}
function patchStyle(p: Partial<WidgetStyle>) { patch({ style: { ...(props.widget?.style ?? {}), ...p } }) }
function patchBox(k: 'x' | 'y' | 'w' | 'h', n: number) {
  if (!props.widget || Number.isNaN(n)) return
  emit('change', clampBox({ ...props.widget, [k]: n }, def.value?.minSize))
}
</script>

<style scoped>
.insp { display: flex; flex-direction: column; gap: 12px; }
.insp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.insp-name { display: flex; flex-direction: column; gap: 2px; min-width: 0; font-size: 13px; color: var(--fg-1); }
.insp-name strong { font-weight: 600; }
.insp-id { font-family: var(--font-mono); font-size: 10px; color: var(--fg-3); }
.insp-json-btn {
  display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; height: 26px; padding: 0 8px; font-size: 11px; font-weight: 600;
  color: var(--fg-2); background: none; border: 1px solid var(--border-subtle); border-radius: var(--r-sm); cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard);
}
.insp-json-btn[aria-pressed="true"] { border-color: var(--primary); color: var(--primary); background: var(--primary-wash); }
.insp-json-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }

.insp-issues { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.insp-issues li { display: flex; gap: 6px; align-items: flex-start; padding: 6px 8px; border-radius: var(--r-sm); font-size: 11.5px; line-height: 1.45; }
.insp-issues li svg { flex-shrink: 0; margin-top: 2px; }
.insp-issues li.error { background: var(--danger-bg); color: var(--danger-fg); }
.insp-issues li.warning { background: var(--warning-bg); color: var(--warning-fg); }

.insp-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 2px; background: var(--surface-sunken); border-radius: var(--r-sm); }
.insp-tabs button {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 28px; border: 0; border-radius: var(--r-xs);
  background: none; font-size: 11.5px; font-weight: 500; color: var(--fg-3); cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
.insp-tabs button.on { background: var(--surface-2); color: var(--fg-1); font-weight: 600; box-shadow: 0 0 0 1px var(--border-subtle); }
.insp-tabs button:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }

.insp-body { display: flex; flex-direction: column; gap: 10px; }
.insp-options { display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--border-subtle); padding-top: 10px; }
.insp-field { display: flex; flex-direction: column; gap: 4px; }
.insp-label { font-size: 11px; color: var(--fg-2); font-weight: 500; margin: 0; padding: 0; }
.insp-sec { display: flex; flex-direction: column; gap: 6px; }
.insp-sec + .insp-sec { border-top: 1px solid var(--border-subtle); padding-top: 10px; }
.insp-set { border: 0; border-top: 1px solid var(--border-subtle); padding: 10px 0 0; margin: 0; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.insp-hint { font-weight: 400; color: var(--fg-3); }
.insp-input { height: 30px; padding: 0 8px; font-size: 12px; }
.insp-num { width: 100%; font-family: var(--font-mono); }
.insp-row { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 8px; font-size: 11.5px; color: var(--fg-2); }
.insp-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-2); cursor: pointer; }
.insp-check input { width: auto; accent-color: var(--primary); }
.insp-grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.insp-grid4 label { display: flex; flex-direction: column; gap: 3px; font-size: 10px; font-weight: 700; color: var(--fg-3); }
.insp-note { font-size: 11.5px; color: var(--fg-3); line-height: 1.5; margin: 0; }
.insp-note strong { color: var(--fg-2); font-weight: 600; }
.insp-note code { font-family: var(--font-mono); font-size: 10.5px; color: var(--fg-2); }
.insp-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.insp-rows li { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--fg-1); padding: 5px 7px; background: var(--surface-1); border-radius: var(--r-xs); }
.insp-rows li svg { flex-shrink: 0; color: var(--fg-3); }
.insp-rows li.off { color: var(--fg-3); }
.insp-tag { margin-left: auto; font-size: 10px; font-family: var(--font-mono); color: var(--fg-3); white-space: nowrap; }
.insp-btns { display: flex; align-items: center; gap: 10px; }
.insp-btns .btn { gap: 5px; }
.insp-link { background: none; border: 0; padding: 0; color: var(--primary); font-size: 11.5px; font-weight: 600; cursor: pointer; }
.insp-link:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.insp-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px 12px; text-align: center; color: var(--fg-3); }
.insp-empty p { margin: 0; font-size: 12px; line-height: 1.5; max-width: 26ch; }
@media (hover: hover) {
  .insp-json-btn:hover:not([aria-pressed="true"]) { border-color: var(--border-interactive); color: var(--fg-1); }
  .insp-tabs button:hover:not(.on) { color: var(--fg-1); }
  .insp-link:hover { text-decoration: underline; }
}
</style>
