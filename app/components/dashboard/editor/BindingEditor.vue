<template>
  <!--
    Data picker for the generic widgets (docs/Widgets.md §5.6):
      Source -> Data (a path in the live payload) -> Visual -> fields
    with a preview of the Frame the widget will draw. Everything offered is
    read from what the source actually returned just now - no guessed schema.
  -->
  <div class="be">
    <label class="be-field">
      <span class="be-label">Source</span>
      <select class="be-input" :value="activeSource ?? ''" @change="pickSource(val($event))">
        <option v-if="!activeSource" value="" disabled>Pick a data source…</option>
        <optgroup v-for="g in sourceGroups" :key="g.module" :label="g.label">
          <option v-for="s in g.items" :key="s.id" :value="s.id">{{ s.label }}</option>
        </optgroup>
      </select>
    </label>
    <p v-if="src" class="be-note">
      {{ src.source }} · {{ TIER_LABELS[src.tier] }} · {{ src.cadence }}<br>
      Honours filters on: <strong>{{ src.honours.length ? src.honours.map(f => FIELD_LABELS[f]).join(', ') : 'nothing' }}</strong>
    </p>

    <QueryEditor
      v-if="isQuery && binding && binding.source === activeSource" :source="binding.source" :params="binding.params ?? {}"
      @change="p => patch({ params: Object.keys(p).length ? p : undefined })"
    />

    <div v-if="loadingFields" class="be-wait" role="status">Reading fields from {{ src?.source ?? 'the source' }}…</div>
    <div v-else-if="failure" class="be-fail" role="alert">
      <span>{{ FAILURE_TEXT[failure.kind] ?? failure.message }}</span>
      <button type="button" class="be-link" @click="reload">Retry</button>
    </div>

    <template v-if="paths.length">
      <label class="be-field">
        <span class="be-label">Data</span>
        <select class="be-input" :value="binding?.source === activeSource ? binding?.path : ''" @change="pickPath(val($event))">
          <option v-if="binding?.source !== activeSource || !currentInfo" value="" disabled>Pick what to show…</option>
          <option v-for="p in paths" :key="p.path" :value="p.path">{{ pathLabel(p) }}</option>
        </select>
      </label>
      <p v-if="binding && binding.source === activeSource && pathEmpty && isQuery" class="be-muted">
        No records match right now - the widget will say so. Every field of the dataset is still listed.
      </p>
      <p v-else-if="binding && binding.source === activeSource && pathEmpty" class="be-muted">
        The feed has no rows for this right now, so only the fields this widget already uses are listed.
      </p>
      <p v-else-if="binding && binding.source === activeSource && pathMissing" class="be-warn">
        The feed didn't return <code>{{ binding.path || '(whole response)' }}</code> just now - the widget will say so. Keep it if it only appears sometimes; only the fields it already uses are listed.
      </p>
    </template>
    <p v-else-if="binding && !loadingFields && data != null" class="be-warn">This source returned nothing a widget can draw.</p>

    <template v-if="binding && binding.source === activeSource">
      <div class="be-field">
        <span class="be-label">Visual</span>
        <div class="be-visuals" role="radiogroup" aria-label="Visual">
          <button
            v-for="v in VISUALS" :key="v.id" type="button" role="radio" class="be-visual"
            :class="{ on: visual === v.id }" :aria-checked="visual === v.id" :disabled="!canDraw(v.shape)"
            :title="canDraw(v.shape) ? v.label : `${v.label} needs ${SHAPE_NEEDS[v.shape]}`"
            @click="pickVisual(v)"
          ><component :is="v.icon" :size="15" aria-hidden="true" /><span>{{ v.label }}</span></button>
        </div>
      </div>

      <!-- ── fields, by shape ── -->
      <template v-if="binding.shape === 'scalar'">
        <MeasureRow :measure="binding.measures[0]!" @change="m => patch({ measures: [m] })" />
        <label class="be-field">
          <span class="be-label">Status from threshold</span>
          <select class="be-input" :value="binding.threshold ?? ''" @change="patch({ threshold: (val($event) || undefined) as Binding['threshold'] })">
            <option value="">None - neutral</option>
            <option v-for="t in THRESHOLD_CHOICES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </label>
        <template v-if="widget.type === 'progress'">
          <div class="be-pair">
            <label class="be-field">
              <span class="be-label">Target</span>
              <input
                class="be-input be-num" type="number" :value="binding.target?.value ?? ''" :disabled="!!binding.target?.path"
                :placeholder="binding.measures[0]?.unit === 'pct' ? '100' : 'Number'"
                @change="patchTarget({ value: val($event) === '' ? undefined : Number(val($event)), path: undefined })"
              >
            </label>
            <label class="be-field">
              <span class="be-label">…or from the feed</span>
              <select class="be-input" :value="binding.target?.path ?? ''" @change="patchTarget({ path: val($event) || undefined, value: undefined })">
                <option value="">Fixed number</option>
                <option v-for="p in targetPaths" :key="p.path" :value="p.path">{{ pathLabel(p) }}</option>
              </select>
            </label>
          </div>
          <label class="be-field">
            <span class="be-label">Target label</span>
            <input type="text" class="be-input" :value="binding.target?.label ?? ''" placeholder="Target" @input="patchTarget({ label: val($event) || undefined })">
          </label>
        </template>
      </template>

      <template v-else-if="binding.shape === 'points'">
        <div class="be-pair">
          <label class="be-field">
            <span class="be-label">Latitude</span>
            <select class="be-input" :value="binding.geo?.lat ?? ''" @change="patchGeo({ lat: val($event) })">
              <option v-for="f in numberFields" :key="f.key" :value="f.key">{{ humanize(f.key) }}</option>
            </select>
          </label>
          <label class="be-field">
            <span class="be-label">Longitude</span>
            <select class="be-input" :value="binding.geo?.lon ?? ''" @change="patchGeo({ lon: val($event) })">
              <option v-for="f in numberFields" :key="f.key" :value="f.key">{{ humanize(f.key) }}</option>
            </select>
          </label>
        </div>
        <label class="be-field">
          <span class="be-label">Name each marker by</span>
          <select class="be-input" :value="binding.dimension?.key ?? ''" @change="pickLabel(val($event))">
            <option value="">No name</option>
            <option v-for="f in textFields" :key="f.key" :value="f.key">{{ humanize(f.key) }}</option>
          </select>
        </label>
        <div class="be-pair">
          <label class="be-field">
            <span class="be-label">Colour by tier</span>
            <select class="be-input" :value="binding.geo?.tier ?? ''" @change="patchGeo({ tier: val($event) || undefined })">
              <option value="">One colour</option>
              <option v-for="f in textFields" :key="f.key" :value="f.key">{{ humanize(f.key) }}</option>
            </select>
          </label>
          <label class="be-field">
            <span class="be-label">A click picks</span>
            <select class="be-input" :value="binding.geo?.key ?? ''" @change="patchGeo({ key: val($event) || undefined })">
              <option value="">Nothing</option>
              <option v-for="f in textFields" :key="f.key" :value="f.key">{{ humanize(f.key) }}</option>
            </select>
          </label>
        </div>
        <fieldset class="be-set">
          <legend class="be-label">Shown on each marker</legend>
          <label v-for="f in numberFields.filter(f => f.key !== binding!.geo?.lat && f.key !== binding!.geo?.lon)" :key="f.key" class="be-check">
            <input type="checkbox" :checked="binding.measures.some(m => m.key === f.key)" @change="toggleMeasure(f.key, checked($event))"> {{ humanize(f.key) }}
          </label>
        </fieldset>
      </template>

      <template v-else-if="binding.shape === 'status'">
        <label class="be-field">
          <span class="be-label">Name each row by</span>
          <select class="be-input" :value="binding.dimension?.key ?? ''" @change="pickLabel(val($event))">
            <option v-for="f in textFields" :key="f.key" :value="f.key">{{ humanize(f.key) }}</option>
          </select>
        </label>
        <label class="be-field">
          <span class="be-label">Status from</span>
          <select class="be-input" :value="binding.status?.field ? `field:${binding.status.field}` : 'threshold'" @change="pickStatusSource(val($event))">
            <option v-for="f in textFields" :key="f.key" :value="`field:${f.key}`">The {{ humanize(f.key).toLowerCase() }} field</option>
            <option value="threshold">A threshold on a measure</option>
          </select>
        </label>
        <fieldset v-if="binding.status?.field" class="be-set">
          <legend class="be-label">Status of each value</legend>
          <div v-for="v in statusValues" :key="v" class="be-map">
            <span>{{ humanize(v) }}</span>
            <select class="be-input" :value="binding.status.map?.[v] ?? statusWord(v)" :aria-label="`Status for ${v}`" @change="mapStatus(v, val($event) as Status)">
              <option value="critical">Critical</option><option value="warning">Warning</option><option value="neutral">Info</option><option value="healthy">OK</option>
            </select>
          </div>
          <p v-if="!statusValues.length" class="be-muted">Values appear once the feed returns rows. Common words (offline, degraded, critical, resolved…) are read automatically.</p>
        </fieldset>
        <template v-else>
          <select class="be-input" :value="binding.measures[0]?.key ?? ''" aria-label="Measure" @change="pickMeasure(val($event))">
            <option value="" disabled>Measure…</option>
            <option v-for="f in numberFields" :key="f.key" :value="f.key">{{ humanize(f.key) }}</option>
          </select>
          <select class="be-input" :value="binding.threshold ?? ''" aria-label="Threshold" @change="patch({ threshold: (val($event) || undefined) as Binding['threshold'] })">
            <option value="">Pick a threshold…</option>
            <option v-for="t in THRESHOLD_CHOICES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </template>
        <fieldset class="be-set">
          <legend class="be-label">Detail line</legend>
          <label v-for="f in textFields.filter(f => f.key !== binding!.dimension?.key)" :key="f.key" class="be-check">
            <input type="checkbox" :checked="!!binding.columns?.some(c => c.key === f.key)" @change="toggleColumn(f.key, checked($event))"> {{ humanize(f.key) }}
          </label>
        </fieldset>
        <label class="be-field">
          <span class="be-label">Each row opens</span>
          <input type="text" class="be-input" :value="binding.link ?? ''" placeholder="/integrations?agency={key}" @change="patch({ link: val($event).trim() || undefined })">
        </label>
      </template>

      <template v-else-if="binding.shape === 'matrix'">
        <div class="be-pair">
          <label v-for="axis in (['x', 'y'] as const)" :key="axis" class="be-field">
            <span class="be-label">{{ axis === 'x' ? 'Columns' : 'Rows' }}</span>
            <select class="be-input" :value="axisValue(axis)" @change="pickAxis(axis, val($event))">
              <optgroup v-for="f in textFields.filter(f => f.type === 'time')" :key="f.key" :label="humanize(f.key)">
                <option v-for="(lbl, b) in AXIS_BUCKETS" :key="b" :value="`${f.key}|${b}`">{{ lbl }}</option>
              </optgroup>
              <option v-for="f in textFields.filter(f => f.type !== 'time')" :key="f.key" :value="`${f.key}|`">{{ humanize(f.key) }}</option>
            </select>
          </label>
        </div>
        <select class="be-input" :value="measureChoice" aria-label="Measure" @change="pickMeasureChoice(val($event))">
          <option v-for="o in measureOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <MeasureRow v-if="binding.measures[0]" :measure="binding.measures[0]" @change="m => patch({ measures: [m] })" />
      </template>

      <template v-else-if="currentInfo?.kind === 'map'">
        <label class="be-field">
          <span class="be-label">Category label</span>
          <input type="text" class="be-input" :value="binding.dimension?.label ?? ''" @input="patch({ dimension: { key: 'category', label: val($event) } })">
        </label>
        <MeasureRow :measure="binding.measures[0]!" @change="m => patch({ measures: [m] })" />
      </template>

      <template v-else>
        <label v-if="binding.shape !== 'rows'" class="be-field">
          <span class="be-label">{{ binding.shape === 'series' ? 'Along (time)' : 'Break down by' }}</span>
          <select class="be-input" :value="binding.dimension?.key ?? ''" @change="pickDimension(val($event))">
            <option v-for="f in dimensionChoices" :key="f.key" :value="f.key">{{ humanize(f.key) }}{{ f.type === 'time' ? ' (time)' : '' }}</option>
          </select>
        </label>

        <fieldset v-if="binding.shape === 'rows'" class="be-set">
          <legend class="be-label">Columns</legend>
          <label v-for="f in textFields" :key="f.key" class="be-check">
            <input type="checkbox" :checked="!!binding.columns?.some(c => c.key === f.key)" @change="toggleColumn(f.key, checked($event))"> {{ humanize(f.key) }}
          </label>
        </fieldset>

        <fieldset class="be-set">
          <legend class="be-label">{{ binding.shape === 'categorical' ? 'Measure' : 'Measures' }}</legend>
          <template v-if="binding.shape === 'categorical' || (binding.shape === 'series' && (binding.aggregate || isQuery))">
            <select class="be-input" :value="measureChoice" aria-label="Measure" @change="pickMeasureChoice(val($event))">
              <option v-for="o in measureOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <MeasureRow v-if="binding.measures[0]" :measure="binding.measures[0]" @change="m => patch({ measures: [m] })" />
            <label v-if="binding.shape === 'series' && binding.aggregate" class="be-field">
              <span class="be-label">Group times by</span>
              <select class="be-input" :value="binding.aggregate.bucket ?? 'day'" @change="patch({ aggregate: { ...binding.aggregate!, bucket: val($event) as TimeBucket } })">
                <option value="hour">Hour</option><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option>
              </select>
            </label>
          </template>
          <template v-else>
            <div v-for="f in numberFields" :key="f.key" class="be-measure">
              <label class="be-check">
                <input type="checkbox" :checked="binding.measures.some(m => m.key === f.key)" @change="toggleMeasure(f.key, checked($event))"> {{ humanize(f.key) }}
              </label>
              <MeasureRow
                v-if="measureOf(f.key)" :measure="measureOf(f.key)!" compact
                @change="m => patch({ measures: binding!.measures.map(x => (x.key === m.key ? m : x)) })"
              />
            </div>
          </template>
        </fieldset>

        <div v-if="binding.shape === 'rows'" class="be-pair">
          <label class="be-field">
            <span class="be-label">Sort by</span>
            <select class="be-input" :value="binding.sort?.key ?? ''" @change="pickSort(val($event), binding.sort?.dir ?? 'desc')">
              <option value="">Feed order</option>
              <option v-for="c in sortChoices" :key="c.key" :value="c.key">{{ c.label }}</option>
            </select>
          </label>
          <label class="be-field">
            <span class="be-label">Order</span>
            <select class="be-input" :value="binding.sort?.dir ?? 'desc'" :disabled="!binding.sort" @change="pickSort(binding.sort!.key, val($event) as 'asc' | 'desc')">
              <option value="desc">High → low</option><option value="asc">Low → high</option>
            </select>
          </label>
        </div>
      </template>

      <div v-if="binding.shape !== 'scalar' && binding.shape !== 'matrix'" class="be-pair">
        <label class="be-field">
          <span class="be-label">{{ LIMIT_LABEL[binding.shape] }}</span>
          <input
            class="be-input be-num" type="number" min="2" max="200" :value="binding.limit ?? ''" placeholder="All"
            @change="patch({ limit: Number(val($event)) || undefined })"
          >
        </label>
        <label v-if="['categorical', 'rows', 'points', 'status'].includes(binding.shape)" class="be-field">
          <span class="be-label">Click filters by</span>
          <select class="be-input" :value="binding.emits ?? ''" @change="patch({ emits: (val($event) || undefined) as FilterField | undefined })">
            <option value="">Not clickable</option>
            <option v-for="f in EMIT_FIELDS" :key="f" :value="f">{{ FIELD_LABELS[f] }}</option>
          </select>
        </label>
      </div>

      <!-- ── live preview of the Frame ── -->
      <div class="be-preview">
        <div class="be-preview-head">
          <span class="be-label">Preview</span>
          <span v-if="preview.frame" class="be-meta">{{ Math.min(PREVIEW_ROWS, preview.frame.rows.length) }} of {{ preview.frame.meta.total }} rows · live</span>
        </div>
        <p v-if="preview.frame?.meta.partial" class="be-muted">
          From the first {{ formatValue(preview.frame.meta.partial.count, 'count') }} of {{ formatValue(preview.frame.meta.partial.total, 'count') }} matching records - narrow the query to cover them all.
        </p>
        <p v-if="preview.error" class="be-warn">{{ preview.error }}</p>
        <p v-else-if="!preview.frame" class="be-muted">Appears once the source has answered.</p>
        <p v-else-if="!preview.frame.rows.length" class="be-muted">The feed has no rows for this right now - the widget will say so.</p>
        <div v-else class="be-table-wrap">
          <table class="be-table">
            <thead><tr><th v-for="f in preview.frame.fields" :key="f.key" scope="col">{{ f.label }}</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in preview.frame.rows.slice(0, PREVIEW_ROWS)" :key="i">
                <td v-for="f in preview.frame.fields" :key="f.key" :class="{ num: f.kind === 'measure' }">{{ cell(r[f.key], f) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ChartArea, ChartBar, ChartColumn, ChartLine, Grid3x3, Hash, ListChecks, Map as MapIcon, Table2, Target } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { FilterField, WidgetInstance } from '~/types/dashboard'
import type { Aggregate, AggregateFn, Binding, Frame, FrameField, FrameShape, MeasureSpec, TimeBucket } from '~/types/frame'
import { QUERY_JOINS_BY_ID, SOURCES, SOURCES_BY_ID, TIER_LABELS, isQuerySource, paramsOption } from '~/utils/dataSources'
import { applyBinding, bindingOf, getPath, humanize, statusWord } from '~/utils/bindings'
import { AGG_LABELS, aggregateMeasure, bindingFor, describePayload, guessUnit, SHAPE_FOR_TYPE, shapesFor, TYPE_FOR_SHAPE, withBindingFields, type FieldInfo, type PathInfo } from '~/utils/bindingDesign'
import { THRESHOLDS, type Status } from '~/utils/thresholds'
import { formatValue } from '~/utils/units'
import { FIELD_LABELS } from '~/utils/filterFields'
import { BASE_SETTINGS } from '~/utils/resolveAccess'
import { sourceInScope, type CatalogScope } from '~/utils/agencyCatalog'
import { useWidgetData } from '~/composables/useWidgetData'
import { useWidgetFilters } from '~/composables/useDashboardFilters'
import { fieldInfoOf, useQueryCatalog } from '~/composables/useQueryCatalog'
import MeasureRow from '~/components/dashboard/editor/MeasureRow.vue'
import QueryEditor from '~/components/dashboard/editor/QueryEditor.vue'

const props = defineProps<{ widget: WidgetInstance }>()
const emit = defineEmits<{ change: [WidgetInstance] }>()

const PREVIEW_ROWS = 5
const SHAPE_NEEDS: Record<FrameShape, string> = {
  scalar: 'a single figure', series: 'rows with a time field', categorical: 'rows with a category', rows: 'a list of rows',
  points: 'rows with latitude and longitude', status: 'rows with a name', matrix: 'a time field or two categories',
}
const LIMIT_LABEL: Record<FrameShape, string> = { scalar: '', series: 'Last N points', categorical: 'Top N (rest → Other)', rows: 'Rows', points: 'Markers', status: 'Rows', matrix: '' }
const AXIS_BUCKETS: Partial<Record<TimeBucket, string>> = { hourOfDay: 'Hour of day', dayOfWeek: 'Day of week', day: 'Day', week: 'Week', month: 'Month' }
const FAILURE_TEXT: Partial<Record<string, string>> = {
  'forbidden': "You can't read this source, so its fields can't be listed.",
  'not-integrated': "This source isn't integrated yet - its fields appear once the feed is onboarded.",
}
const AGG_FNS: Exclude<AggregateFn, 'count'>[] = ['sum', 'avg', 'max', 'min']
const EMIT_FIELDS = Object.keys(FIELD_LABELS).filter(f => f !== 'date_range') as FilterField[]
const THRESHOLD_CHOICES = Object.entries(THRESHOLDS).map(([value, t]) => ({ value, label: t.label }))
interface Visual { id: string; label: string; type: string; shape: FrameShape; mode?: 'line' | 'area' | 'bars'; icon: Component }
const VISUALS: Visual[] = [
  { id: 'stat', label: 'Stat', type: 'stat', shape: 'scalar', icon: Hash },
  { id: 'line', label: 'Line', type: 'series', shape: 'series', mode: 'line', icon: ChartLine },
  { id: 'area', label: 'Area', type: 'series', shape: 'series', mode: 'area', icon: ChartArea },
  { id: 'bars', label: 'Bars', type: 'series', shape: 'series', mode: 'bars', icon: ChartColumn },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', shape: 'categorical', icon: ChartBar },
  { id: 'table', label: 'Table', type: 'table', shape: 'rows', icon: Table2 },
  { id: 'progress', label: 'Progress', type: 'progress', shape: 'scalar', icon: Target },
  { id: 'points', label: 'Map', type: 'points', shape: 'points', icon: MapIcon },
  { id: 'status', label: 'Status', type: 'status-list', shape: 'status', icon: ListChecks },
  { id: 'heatmap', label: 'Heatmap', type: 'heatmap', shape: 'matrix', icon: Grid3x3 },
]

const val = (e: Event) => (e.target as HTMLInputElement).value
const checked = (e: Event) => (e.target as HTMLInputElement).checked

const config = computed(() => props.widget.config ?? {})
const binding = computed(() => bindingOf(config.value))
const visual = computed(() => {
  const t = props.widget.type
  return t === 'series' ? String(config.value.mode ?? 'line') : t === 'status-list' ? 'status' : t
})

// ── sources (scoped to what the owner agency can open) ──
const scope = inject<Ref<CatalogScope | null> | null>('dashboard:catalogScope', null)
const sourceGroups = computed(() => {
  const list = SOURCES.filter(s => sourceInScope(s.id, scope?.value ?? null) || s.id === binding.value?.source)
  const modules = [...new Set(list.map(s => s.module))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  return modules.map(m => ({ module: m, label: `${m} · ${BASE_SETTINGS.modules[m]?.label ?? m}`, items: list.filter(s => s.module === m) }))
})
const pendingSource = ref<string | null>(null)
watch(() => props.widget.id, () => { pendingSource.value = null })
const activeSource = computed(() => pendingSource.value ?? binding.value?.source ?? null)
const src = computed(() => (activeSource.value ? SOURCES_BY_ID[activeSource.value] : undefined))

// Same filter context as the widget on the canvas, so this shares its cached response.
const { context } = useWidgetFilters(() => props.widget.id)
const { data, state, failure, reload } = useWidgetData(() => activeSource.value, () => context.value, {
  options: () => paramsOption(activeSource.value === binding.value?.source ? binding.value?.params : undefined),
})

// ── query sources: fields come from the dataset catalog, so an empty result is still authorable ──
const isQuery = computed(() => isQuerySource(activeSource.value ?? undefined))
const { datasets: queryDatasets, ensure: ensureQueryCatalog } = useQueryCatalog()
watch(isQuery, (q) => { if (q) ensureQueryCatalog() }, { immediate: true })
const queryFields = computed<FieldInfo[] | null>(() => {
  if (!isQuery.value || !queryDatasets.value) return null
  const id = activeSource.value!
  const own = binding.value?.source === id ? binding.value.params ?? {} : {}
  const pick = (ds: string, chosen: unknown, prefix = '') => {
    const meta = queryDatasets.value?.[ds as keyof typeof queryDatasets.value]
    const keep = Array.isArray(chosen) && chosen.length ? new Set(chosen as string[]) : null
    return (meta?.fields ?? []).filter(f => !keep || keep.has(f.name)).map(f => fieldInfoOf(f, prefix))
  }
  const j = QUERY_JOINS_BY_ID[id]
  if (j) {
    const side = (k: 'left' | 'right') => (own[k] as { fields?: string[] } | undefined)?.fields
    return [...pick(j.left, side('left'), j.left), ...pick(j.right, side('right'), j.right)]
  }
  return pick(id.replace(/^query\./, ''), own.fields)
})
const loadingFields = computed(() => data.value == null && (state.value === 'loading' || state.value === 'refreshing'))

// An empty list stays pickable when the widget already points at it - its fields come from the binding.
const paths = computed<PathInfo[]>(() => {
  if (data.value == null) return []
  if (isQuery.value && queryFields.value) {
    const rows = getPath(data.value, 'rows')
    return [
      { path: 'rows', kind: 'rows', fields: queryFields.value, count: Array.isArray(rows) ? rows.length : 0 },
      { path: 'total', kind: 'number', fields: [], count: 1 },
    ]
  }
  const own = binding.value?.source === activeSource.value ? binding.value : null
  const list = describePayload(data.value).map(p => withBindingFields(p, own)).filter(p => shapesFor(p).length)
  // A path the feed left out this time stays listed (and editable) from the binding itself.
  if (own && !list.some(p => p.path === own.path)) list.push(missingPath(own))
  return list
})
const missingPath = (b: Binding): PathInfo =>
  withBindingFields({ path: b.path, kind: b.shape === 'scalar' ? 'number' : 'rows', fields: [], count: 0 }, b)
const pathMissing = computed(() => {
  const b = binding.value
  return !!b && data.value != null && getPath(data.value, b.path) === undefined
})
/** The bound path is in the payload but holds an empty list right now. */
const pathEmpty = computed(() => {
  const b = binding.value
  if (!b || data.value == null) return false
  const v = getPath(data.value, b.path)
  return Array.isArray(v) && !v.length
})
const currentInfo = computed(() => paths.value.find(p => p.path === binding.value?.path) ?? null)
const canDraw = (shape: FrameShape) =>
  currentInfo.value ? shapesFor(currentInfo.value).includes(shape) : shape === binding.value?.shape

function pathLabel(p: PathInfo) {
  if (isQuery.value && p.path === 'rows') return `Records · ${p.count} fetched`
  if (isQuery.value && p.path === 'total') return 'Total matching records · figure'
  const name = p.path ? p.path.split('.').map(humanize).join(' › ') : 'Whole response'
  if (p.path === binding.value?.path && pathMissing.value) return `${name} · not in the feed right now`
  if (p.kind === 'number') return `${name} · figure`
  if (p.kind === 'map') return `${name} · ${p.count} categor${p.count === 1 ? 'y' : 'ies'}`
  return p.count ? `${name} · ${p.count} row${p.count === 1 ? '' : 's'}` : `${name} · no rows right now`
}

// ── field pools for the current path ──
const fieldsOf = (t: 'number' | 'text') => (currentInfo.value?.fields ?? []).filter(f => (t === 'number' ? f.type === 'number' : f.type !== 'number'))
const numberFields = computed(() => fieldsOf('number'))
const textFields = computed(() => fieldsOf('text'))
const dimensionChoices = computed(() => {
  const all = textFields.value
  if (binding.value?.shape !== 'series') return all
  const times = all.filter(f => f.type === 'time')
  return binding.value.aggregate ? times : [...times, ...all.filter(f => f.type !== 'time')]
})
const measureOf = (key: string) => binding.value?.measures.find(m => m.key === key)
const sortChoices = computed(() => [
  ...(binding.value?.columns ?? []).map(c => ({ key: c.key, label: c.label })),
  ...(binding.value?.measures ?? []).map(m => ({ key: m.key, label: m.label })),
])

// ── edits: every one emits a whole new widget (one undo step) ──
function apply(next: Binding, type = props.widget.type, mode?: Visual['mode']) {
  const cfg: Record<string, unknown> = { ...config.value, binding: next }
  if (mode) cfg.mode = mode
  emit('change', { ...props.widget, type, config: cfg })
}
function patch(p: Partial<Binding>) {
  if (!binding.value) return
  const next = { ...binding.value, ...p } as Record<string, unknown>
  for (const k of Object.keys(p)) if (next[k] === undefined) delete next[k]
  apply(next as unknown as Binding)
}

function pickSource(id: string) {
  pendingSource.value = id === binding.value?.source ? null : id
}
// A new source is applied once its payload arrives: keep the visual if the data allows it.
watch([pendingSource, paths, queryFields], () => {
  const id = pendingSource.value
  if (!id || data.value == null || (isQuerySource(id) && !queryFields.value)) return
  // An unbound widget starts from the shape its type draws (a Chart wants a series, a Table rows),
  // and a chart falls back to a category breakdown before anything else.
  const want = binding.value?.shape ?? SHAPE_FOR_TYPE[props.widget.type] ?? 'scalar'
  const order: FrameShape[] = want === 'series' ? ['series', 'categorical'] : [want]
  const info = order.map(s => bestPath(paths.value.filter(p => shapesFor(p).includes(s)))).find(Boolean) ?? bestPath(paths.value)
  if (!info) return
  const shape = order.find(s => shapesFor(info).includes(s)) ?? shapesFor(info)[0]!
  pendingSource.value = null
  apply(bindingFor(id, info, shape, null, { aggregate: isQuerySource(id) }), TYPE_FOR_SHAPE[shape])
}, { immediate: true })

/** Lists with rows first, then figure maps, then empty lists, then single figures. */
const RANK = (p: PathInfo) => (p.kind === 'rows' ? (p.count ? 0 : 2) : p.kind === 'map' ? 1 : 3)
const bestPath = (list: PathInfo[]) => [...list].sort((a, b) => RANK(a) - RANK(b))[0]

function pickPath(path: string) {
  const info = paths.value.find(p => p.path === path)
  if (!info || !activeSource.value) return
  const shapes = shapesFor(info)
  const shape = binding.value && shapes.includes(binding.value.shape) ? binding.value.shape : shapes[0]!
  const prev = binding.value?.source === activeSource.value ? binding.value : null
  apply(bindingFor(activeSource.value, info, shape, prev, { aggregate: isQuery.value }), TYPE_FOR_SHAPE[shape])
}
function pickVisual(v: Visual) {
  const b = binding.value
  if (!b || !canDraw(v.shape)) return
  if (v.shape === b.shape) { apply(b, v.type, v.mode); return }
  if (!currentInfo.value) return
  apply(bindingFor(b.source, currentInfo.value, v.shape, b, { aggregate: isQuery.value }), v.type, v.mode)
}
function pickDimension(key: string) {
  const kind = textFields.value.find(f => f.key === key)?.type === 'time' ? 'time' as const : 'category' as const
  const agg = binding.value?.aggregate
  patch({
    dimension: binding.value?.shape === 'series' ? { key, label: humanize(key), kind } : { key, label: humanize(key) },
    ...(agg ? { aggregate: { ...agg, by: key } } : {}),
  })
}
const newMeasure = (key: string): MeasureSpec => ({ key, label: humanize(key), unit: guessUnit(key) })
/** 'count' | '<fn>:<field>' (grouped) | 'field:<field>' (the value as the feed reports it). */
const measureChoice = computed(() => {
  const b = binding.value
  if (!b) return ''
  if (b.aggregate) return b.aggregate.fn === 'count' ? 'count' : `${b.aggregate.fn}:${b.aggregate.measure}`
  return `field:${b.measures[0]?.key ?? ''}`
})
/** Count, or sum / average / highest / lowest of each number field ("as reported" for summaries). */
const measureOptions = computed(() => [
  { value: 'count', label: 'Count of records' },
  ...numberFields.value.flatMap(f => [
    ...(!isQuery.value && binding.value?.shape !== 'matrix' ? [{ value: `field:${f.key}`, label: `${humanize(f.key)} as reported` }] : []),
    ...AGG_FNS.map(fn => ({ value: `${fn}:${f.key}`, label: `${AGG_LABELS[fn]} ${humanize(f.key).toLowerCase()}` })),
  ]),
])
function pickMeasureChoice(choice: string) {
  const b = binding.value
  if (!b?.dimension) return
  const [head, field] = choice.split(':') as [string, string | undefined]
  if (head === 'field') { patch({ aggregate: undefined, measures: [measureOf(field!) ?? newMeasure(field!)] }); return }
  // Keep the grouping (and a heatmap's second grouping); change only what is computed.
  const agg: Aggregate = { ...(b.aggregate ?? { by: b.dimension.key }), fn: head as AggregateFn }
  if (field) agg.measure = field
  else delete agg.measure
  if (b.shape === 'series' && !agg.bucket) agg.bucket = 'day'
  patch({ aggregate: agg, measures: [aggregateMeasure(agg)] })
}
function pickMeasure(key: string) { patch({ measures: [measureOf(key) ?? newMeasure(key)] }) }

// ── map ──
function patchGeo(p: Partial<NonNullable<Binding['geo']>>) {
  const g: Record<string, unknown> = { lat: '', lon: '', ...(binding.value?.geo ?? {}), ...p }
  for (const k of ['key', 'tier']) if (!g[k]) delete g[k]
  patch({ geo: g as Binding['geo'] })
}
function pickLabel(key: string) { patch({ dimension: key ? { key, label: humanize(key) } : undefined }) }

// ── status list ──
function pickStatusSource(v: string) {
  if (v === 'threshold') { patch({ status: undefined }); return }
  patch({ status: { field: v.slice('field:'.length) }, threshold: undefined })
}
/** The values the status field takes in the rows the feed returned (up to 12). */
const statusValues = computed(() => {
  const f = binding.value?.status?.field
  const rows = binding.value && data.value != null ? getPath(data.value, binding.value.path) : null
  if (!f || !Array.isArray(rows)) return []
  return [...new Set(rows.map(r => (r as Record<string, unknown>)[f]).filter(v => v != null && v !== '').map(String))].slice(0, 12)
})
function mapStatus(value: string, status: Status) {
  const s = binding.value?.status
  if (!s?.field) return
  const map = { ...(s.map ?? {}) }
  // Only store what differs from the shared words, so the map stays short.
  if (status === statusWord(value)) delete map[value]
  else map[value] = status
  patch({ status: Object.keys(map).length ? { field: s.field, map } : { field: s.field } })
}

// ── heatmap ──
function axisValue(axis: 'x' | 'y') {
  const a = binding.value?.aggregate
  return axis === 'x' ? `${a?.by ?? ''}|${a?.bucket ?? ''}` : `${a?.by2 ?? ''}|${a?.bucket2 ?? ''}`
}
function pickAxis(axis: 'x' | 'y', v: string) {
  const b = binding.value
  if (!b) return
  const [key, bucket] = v.split('|') as [string, string]
  const tb = (bucket || undefined) as TimeBucket | undefined
  const agg: Aggregate = { fn: 'count', by: key, ...(b.aggregate ?? {}) }
  if (axis === 'x') { agg.by = key; if (tb) agg.bucket = tb; else delete agg.bucket }
  else { agg.by2 = key; if (tb) agg.bucket2 = tb; else delete agg.bucket2 }
  const dim = { key, label: tb ? AXIS_BUCKETS[tb] ?? humanize(key) : humanize(key) }
  patch({ aggregate: agg, ...(axis === 'x' ? { dimension: dim } : { dimension2: dim }) })
}

// ── progress ──
const targetPaths = computed(() => paths.value.filter(p => p.kind === 'number' && p.path !== binding.value?.path))
function patchTarget(p: Partial<NonNullable<Binding['target']>>) {
  const t: Record<string, unknown> = { ...(binding.value?.target ?? {}), ...p }
  for (const [k, v] of Object.entries(t)) if (v === undefined || v === '') delete t[k]
  patch({ target: Object.keys(t).length ? t as Binding['target'] : undefined })
}
function toggleMeasure(key: string, on: boolean) {
  const list = binding.value?.measures ?? []
  // keep the payload's field order so series colours stay stable
  const order = numberFields.value.map(f => f.key)
  const next = on ? [...list, newMeasure(key)].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : list.filter(m => m.key !== key)
  patch({ measures: next, ...(binding.value?.sort?.key === key && !on ? { sort: undefined } : {}) })
}
function toggleColumn(key: string, on: boolean) {
  const list = binding.value?.columns ?? []
  const order = textFields.value.map(f => f.key)
  const next = on ? [...list, { key, label: humanize(key) }].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : list.filter(c => c.key !== key)
  patch({ columns: next, ...(binding.value?.sort?.key === key && !on ? { sort: undefined } : {}) })
}
function pickSort(key: string, dir: 'asc' | 'desc') { patch({ sort: key ? { key, dir } : undefined }) }

// ── preview ──
const preview = computed<{ frame: Frame | null; error: string | null }>(() => {
  const b = binding.value
  if (!b || data.value == null || b.source !== activeSource.value) return { frame: null, error: null }
  try { return { frame: applyBinding(data.value, b), error: null } } catch (e) {
    return { frame: null, error: e instanceof Error ? e.message : 'Unexpected response shape' }
  }
})
function cell(v: unknown, f: FrameField) {
  if (f.kind === 'measure') return formatValue(v as number | null, f.unit ?? 'count')
  return v == null || v === '' ? '-' : String(v)
}
</script>

<style scoped>
.be { display: flex; flex-direction: column; gap: 10px; }
.be-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.be-label { font-size: 11px; color: var(--fg-2); font-weight: 500; padding: 0; }
.be-input { height: 30px; padding: 0 8px; font-size: 12px; }
.be-num { font-family: var(--font-mono); }
.be-note { font-size: 11px; color: var(--fg-3); line-height: 1.5; margin: -4px 0 0; }
.be-note strong { color: var(--fg-2); font-weight: 600; }
.be-muted { font-size: 11.5px; color: var(--fg-3); margin: 0; line-height: 1.5; }
.be-warn { font-size: 11.5px; color: var(--warning-fg); margin: 0; line-height: 1.5; }
.be-warn code { font-family: var(--font-mono); font-size: 10.5px; }
.be-wait { font-size: 11.5px; color: var(--fg-3); }
.be-fail { display: flex; gap: 8px; align-items: baseline; justify-content: space-between; font-size: 11.5px; color: var(--danger-fg); line-height: 1.5; }
.be-link { background: none; border: 0; padding: 0; color: var(--primary); font-size: 11.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.be-link:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

.be-visuals { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.be-visual {
  display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 7px 4px 6px; font-size: 10.5px; font-weight: 500;
  color: var(--fg-2); background: var(--surface-1); border: 1px solid var(--border-subtle); border-radius: var(--r-sm); cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
.be-visual.on { border-color: var(--primary); background: var(--primary-wash); color: var(--primary); font-weight: 600; }
.be-visual:disabled { opacity: .4; cursor: not-allowed; }
.be-visual:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }

.be-set { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.be-set legend { margin-bottom: 4px; }
.be-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-2); cursor: pointer; }
.be-check input { width: auto; accent-color: var(--primary); }
.be-measure { display: flex; flex-direction: column; gap: 4px; }
.be-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.be-map { display: grid; grid-template-columns: 1fr 104px; align-items: center; gap: 8px; font-size: 11.5px; color: var(--fg-2); }

.be-preview { border-top: 1px solid var(--border-subtle); padding-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.be-preview-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.be-meta { font-size: 10px; font-family: var(--font-mono); color: var(--fg-3); }
.be-table-wrap { overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--r-xs); }
.be-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.be-table th { text-align: left; font-weight: 600; color: var(--fg-3); background: var(--surface-1); padding: 4px 6px; white-space: nowrap; }
.be-table td { padding: 4px 6px; color: var(--fg-1); border-top: 1px solid var(--border-subtle); white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.be-table td.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; }
@media (hover: hover) {
  .be-visual:hover:not(:disabled):not(.on) { border-color: var(--border-interactive); color: var(--fg-1); }
  .be-link:hover { text-decoration: underline; }
}
</style>
