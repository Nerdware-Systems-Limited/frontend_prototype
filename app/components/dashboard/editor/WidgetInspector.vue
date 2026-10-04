<template>
  <!--
    Inspector for the selected widget: identity, data config (per widget
    kind), formatting, and exact position. Every change emits a whole new
    WidgetInstance so the editor's undo stack captures it.
  -->
  <div v-if="widget && def" class="insp">
    <div class="insp-head">
      <strong>{{ def.title }}</strong>
      <code class="insp-id">{{ widget.id }}</code>
    </div>

    <fieldset class="insp-set">
      <legend>Title</legend>
      <input type="text" class="insp-input" :value="widget.title ?? ''" :placeholder="def.title" @input="patch({ title: val($event) || undefined })">
      <label class="insp-check">
        <input type="checkbox" :checked="style.showTitle" @change="patchStyle({ showTitle: checked($event) })"> Show title bar
      </label>
    </fieldset>

    <!-- ── Data config, by kind ── -->
    <fieldset v-if="def.type === 'kpi'" class="insp-set">
      <legend>Metric</legend>
      <select class="insp-input" :value="config.metricKey" @change="patchConfig({ metricKey: val($event) })">
        <optgroup v-for="g in metricGroups" :key="g.domain" :label="g.label">
          <option v-for="m in g.items" :key="m.value" :value="m.value">{{ m.label }} - {{ m.description }}</option>
        </optgroup>
      </select>
      <input type="text" class="insp-input" :value="(config.label as string) ?? ''" placeholder="Card label (defaults to metric name)" @input="patchConfig({ label: val($event) || undefined })">
      <input type="text" class="insp-input" :value="(config.to as string) ?? ''" placeholder="Drill-down route (defaults to the metric's)" @input="patchConfig({ to: val($event) || undefined })">
      <label class="insp-check"><input type="checkbox" :checked="!!config.prominent" @change="patchConfig({ prominent: checked($event) })"> Large figure</label>
    </fieldset>

    <fieldset v-else-if="def.type === 'kpi-row'" class="insp-set">
      <legend>Metrics in the ribbon</legend>
      <ol class="insp-list">
        <li v-for="(k, i) in metricKeys" :key="k">
          <span>{{ METRICS_BY_KEY[k]?.label ?? k }}</span>
          <button type="button" class="insp-mini" :disabled="i === 0" :aria-label="`Move ${METRICS_BY_KEY[k]?.label ?? k} up`" @click="moveMetric(i, -1)"><ChevronUp :size="13" aria-hidden="true" /></button>
          <button type="button" class="insp-mini" :disabled="i === metricKeys.length - 1" :aria-label="`Move ${METRICS_BY_KEY[k]?.label ?? k} down`" @click="moveMetric(i, 1)"><ChevronDown :size="13" aria-hidden="true" /></button>
          <button type="button" class="insp-mini insp-mini--danger" :aria-label="`Remove ${METRICS_BY_KEY[k]?.label ?? k}`" @click="patchConfig({ metricKeys: metricKeys.filter(x => x !== k) })"><X :size="13" aria-hidden="true" /></button>
        </li>
      </ol>
      <select class="insp-input" value="" @change="addMetric($event)">
        <option value="">Add a metric…</option>
        <optgroup v-for="g in metricGroups" :key="g.domain" :label="g.label">
          <option v-for="m in g.items" :key="m.value" :value="m.value" :disabled="metricKeys.includes(m.value)">{{ m.label }}</option>
        </optgroup>
      </select>
      <label class="insp-check"><input type="checkbox" :checked="!!config.prominent" @change="patchConfig({ prominent: checked($event) })"> Large figures</label>
    </fieldset>

    <fieldset v-else-if="def.type === 'agency-card'" class="insp-set">
      <legend>Agency</legend>
      <select class="insp-input" :value="config.agency" @change="patchConfig({ agency: val($event) })">
        <option v-for="a in agencyOptions" :key="a.value" :value="a.value">{{ a.label }}</option>
      </select>
    </fieldset>

    <fieldset v-else-if="def.type === 'text'" class="insp-set">
      <legend>Text</legend>
      <select class="insp-input" :value="config.variant" @change="patchConfig({ variant: val($event) })">
        <option value="section">Section label (small caps + rule)</option>
        <option value="heading">Heading</option>
        <option value="note">Note / paragraph</option>
      </select>
      <textarea class="insp-input insp-textarea" :value="(config.text as string) ?? ''" rows="3" @input="patchConfig({ text: val($event) })" />
    </fieldset>

    <fieldset v-else-if="def.type === 'risk-map'" class="insp-set">
      <legend>Map</legend>
      <label class="insp-check"><input type="checkbox" :checked="!!config.showRoads" @change="patchConfig({ showRoads: checked($event) })"> Show road network</label>
      <label class="insp-row">Hotspots to plot
        <input class="insp-input insp-num" type="number" min="5" max="200" :value="config.hotspotLimit" @change="patchConfig({ hotspotLimit: Number(val($event)) })">
      </label>
    </fieldset>

    <!-- Generic widgets: what the binding reads. Full binding editing is phase 4. -->
    <fieldset v-else-if="binding" class="insp-set">
      <legend>Data</legend>
      <p class="insp-note">
        <strong>{{ sourceOf(binding.source)?.label ?? binding.source }}</strong>
        · {{ sourceOf(binding.source)?.source }}<br>
        Field <code>{{ binding.path }}</code>
        <template v-if="binding.measures.length"> · {{ binding.measures.map(m => m.label).join(', ') }}</template>
      </p>
      <label v-if="def.type === 'series'" class="insp-row">Chart
        <select class="insp-input" :value="config.mode ?? 'line'" @change="patchConfig({ mode: val($event) })">
          <option value="line">Line</option><option value="area">Area</option><option value="bars">Bars</option>
        </select>
      </label>
      <label v-if="binding.shape === 'categorical' || binding.shape === 'rows'" class="insp-row">{{ binding.shape === 'categorical' ? 'Top categories' : 'Rows' }}
        <input
          class="insp-input insp-num" type="number" min="2" max="50" :value="binding.limit ?? ''" placeholder="All"
          @change="patchBinding({ limit: Number(val($event)) || undefined })"
        >
      </label>
    </fieldset>

    <!-- ── Format ── -->
    <fieldset class="insp-set">
      <legend>Format</legend>
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
    </fieldset>

    <!-- ── Position ── -->
    <fieldset class="insp-set">
      <legend>Position &amp; size <span class="insp-hint">(grid units, 12 columns)</span></legend>
      <div class="insp-grid4">
        <label v-for="k in (['x', 'y', 'w', 'h'] as const)" :key="k">{{ k.toUpperCase() }}
          <input class="insp-input insp-num" type="number" :min="k === 'w' || k === 'h' ? 1 : 0" :max="k === 'x' ? 11 : k === 'w' ? 12 : 99" :value="widget[k]" @change="patchBox(k, Number(val($event)))">
        </label>
      </div>
    </fieldset>

    <fieldset class="insp-set">
      <legend>Access &amp; filters</legend>
      <p class="insp-note">
        <template v-if="perms.length">
          Visible only to viewers with
          <template v-for="(p, i) in perms" :key="p"><template v-if="i"> or </template><code>{{ p }}</code></template>.
          Stripped server-side for everyone else.
        </template>
        <template v-else>No extra permission - anyone the dashboard is assigned to sees it.</template>
      </p>
      <p class="insp-note">
        Honours filters on: <strong>{{ fields.length ? fields.map(f => FIELD_LABELS[f]).join(', ') : 'nothing' }}</strong>
        <template v-if="emits.length"> · clicks can drive actions on: <strong>{{ emits.map(f => FIELD_LABELS[f]).join(', ') }}</strong></template>
      </p>
    </fieldset>
  </div>
  <div v-else class="insp-empty">
    <MousePointerClick :size="18" aria-hidden="true" />
    <p>Select a widget on the canvas to edit its data, format and position.</p>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, ChevronUp, MousePointerClick, X } from 'lucide-vue-next'
import type { WidgetInstance, WidgetStyle } from '~/types/dashboard'
import { AGENCY_OPTIONS, METRIC_OPTIONS, WIDGETS_BY_TYPE, isFramed, widgetEmits, widgetFilterFields, widgetPermissions } from '~/utils/widgetRegistry'
import { SOURCES_BY_ID } from '~/utils/dataSources'
import { bindingOf } from '~/composables/useBoundFrame'
import type { Binding } from '~/types/frame'
import { DOMAIN_LABELS, METRICS_BY_KEY, type Domain } from '~/utils/metricRegistry'
import { FIELD_LABELS } from '~/utils/filterFields'
import { clampBox } from '~/utils/layoutEngine'
import { agencyCardsInScope, metricInScope, type CatalogScope } from '~/utils/agencyCatalog'

const props = defineProps<{ widget: WidgetInstance | null }>()
const emit = defineEmits<{ change: [WidgetInstance] }>()

const def = computed(() => (props.widget ? WIDGETS_BY_TYPE[props.widget.type] : null))
const config = computed(() => ({ ...(def.value?.defaultConfig ?? {}), ...(props.widget?.config ?? {}) }))
const style = computed<Required<WidgetStyle>>(() => {
  const framed = props.widget ? isFramed(props.widget.type) : true
  const s = props.widget?.style ?? {}
  return {
    showTitle: s.showTitle ?? framed, background: s.background ?? (framed ? 'surface' : 'transparent'),
    border: s.border ?? framed, padding: s.padding ?? (framed ? 'normal' : 'none'), accent: s.accent ?? 'none',
  }
})
const perms = computed(() => (props.widget ? widgetPermissions(props.widget.type, config.value) : []))
const fields = computed(() => (props.widget ? widgetFilterFields(props.widget.type, config.value) : []))
const emits = computed(() => (props.widget ? widgetEmits(props.widget.type, config.value) : []))
const binding = computed(() => bindingOf(config.value))
const sourceOf = (id: string) => SOURCES_BY_ID[id]
function patchBinding(p: Partial<Binding>) { if (binding.value) patchConfig({ binding: { ...binding.value, ...p } }) }
const metricKeys = computed(() => (config.value.metricKeys as string[] | undefined) ?? [])

// On an agency's dashboard, only metrics and snapshots from pages that agency can open.
const scope = inject<Ref<CatalogScope | null> | null>('dashboard:catalogScope', null)
const metricGroups = computed(() => (Object.keys(DOMAIN_LABELS) as Domain[]).map(domain => ({
  domain, label: DOMAIN_LABELS[domain],
  items: METRIC_OPTIONS.filter(m => m.domain === domain && (metricInScope(m.value, scope?.value ?? null) || m.value === config.value.metricKey)),
})).filter(g => g.items.length))
const agencyOptions = computed(() => {
  if (!scope?.value) return AGENCY_OPTIONS
  const allowed = new Set(agencyCardsInScope(scope.value))
  return AGENCY_OPTIONS.filter(a => allowed.has(a.value) || a.value === config.value.agency)
})

const val = (e: Event) => (e.target as HTMLInputElement).value
const checked = (e: Event) => (e.target as HTMLInputElement).checked

function patch(p: Partial<WidgetInstance>) { if (props.widget) emit('change', { ...props.widget, ...p }) }
function patchConfig(p: Record<string, unknown>) { patch({ config: { ...(props.widget?.config ?? {}), ...p } }) }
function patchStyle(p: Partial<WidgetStyle>) { patch({ style: { ...(props.widget?.style ?? {}), ...p } }) }
function patchBox(k: 'x' | 'y' | 'w' | 'h', n: number) {
  if (!props.widget || Number.isNaN(n)) return
  const next = clampBox({ ...props.widget, [k]: n }, def.value?.minSize)
  if (next.x + next.w > 12) next.w = 12 - next.x
  emit('change', next)
}
function addMetric(e: Event) {
  const k = val(e)
  ;(e.target as HTMLSelectElement).value = ''
  if (k && !metricKeys.value.includes(k)) patchConfig({ metricKeys: [...metricKeys.value, k] })
}
function moveMetric(i: number, d: number) {
  const list = [...metricKeys.value]
  const [m] = list.splice(i, 1)
  list.splice(i + d, 0, m!)
  patchConfig({ metricKeys: list })
}
</script>

<style scoped>
.insp { display: flex; flex-direction: column; gap: 12px; }
.insp-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 600; color: var(--fg-1); }
.insp-head strong { font-weight: 600; }
.insp-id { font-family: var(--font-mono); font-size: 10px; color: var(--fg-3); }
.insp-set { border: 0; border-top: 1px solid var(--border-subtle); padding: 12px 0 0; margin: 0; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.insp-set legend { float: left; width: 100%; margin-bottom: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--fg-3); padding: 0; }
.insp-set legend + * { clear: both; }
.insp-hint { font-weight: 500; text-transform: none; letter-spacing: 0; }
.insp-input { height: 30px; padding: 0 8px; font-size: 12px; }
.insp-textarea { height: auto; padding: 6px 8px; resize: vertical; }
.insp-num { width: 100%; font-family: var(--font-mono); }
.insp-row { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 8px; font-size: 11.5px; color: var(--fg-2); }
.insp-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-2); cursor: pointer; }
.insp-check input { width: auto; accent-color: var(--primary); }
.insp-grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.insp-grid4 label { display: flex; flex-direction: column; gap: 3px; font-size: 10px; font-weight: 700; color: var(--fg-3); }
.insp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.insp-list li { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--fg-1); padding: 4px 6px; background: var(--surface-1); border-radius: var(--r-xs); }
.insp-list li span { flex: 1; }
.insp-mini { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 0; background: none; color: var(--fg-3); cursor: pointer; padding: 0; border-radius: var(--r-xs); }
.insp-mini:disabled { opacity: .3; cursor: default; }
.insp-mini:focus-visible { outline: 2px solid var(--primary); outline-offset: 0; }
.insp-note { font-size: 11.5px; color: var(--fg-3); line-height: 1.5; margin: 0; }
.insp-note code { font-family: var(--font-mono); font-size: 10.5px; color: var(--fg-2); }
.insp-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px 12px; text-align: center; color: var(--fg-3); }
.insp-empty p { margin: 0; font-size: 12px; line-height: 1.5; max-width: 26ch; }
@media (hover: hover) {
  .insp-mini:hover:not(:disabled) { background: var(--surface-quiet); color: var(--fg-1); }
  .insp-mini--danger:hover:not(:disabled) { background: var(--danger-bg); color: var(--danger-fg); }
}
</style>
