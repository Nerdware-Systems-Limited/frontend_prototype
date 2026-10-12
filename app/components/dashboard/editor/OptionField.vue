<template>
  <!-- One schema-driven inspector field (WidgetOption) over config[option.key]. -->
  <label v-if="option.control === 'toggle'" class="of-check">
    <input type="checkbox" :checked="!!value" @change="set(checked($event))"> {{ option.label }}
  </label>

  <div v-else-if="option.control === 'metrics'" class="of-field">
    <span class="of-label">{{ option.label }}</span>
    <ol v-if="keys.length" class="of-list">
      <li v-for="(k, i) in keys" :key="k">
        <span>{{ METRICS_BY_KEY[k]?.label ?? k }}</span>
        <button type="button" class="of-mini" :disabled="i === 0" :aria-label="`Move ${METRICS_BY_KEY[k]?.label ?? k} up`" @click="move(i, -1)"><ChevronUp :size="13" aria-hidden="true" /></button>
        <button type="button" class="of-mini" :disabled="i === keys.length - 1" :aria-label="`Move ${METRICS_BY_KEY[k]?.label ?? k} down`" @click="move(i, 1)"><ChevronDown :size="13" aria-hidden="true" /></button>
        <button type="button" class="of-mini of-mini--danger" :aria-label="`Remove ${METRICS_BY_KEY[k]?.label ?? k}`" @click="set(keys.filter(x => x !== k))"><X :size="13" aria-hidden="true" /></button>
      </li>
    </ol>
    <select class="of-input" value="" :aria-label="`Add to ${option.label}`" @change="addMetric($event)">
      <option value="">Add a metric…</option>
      <optgroup v-for="g in metricGroups" :key="g.domain" :label="g.label">
        <option v-for="m in g.items" :key="m.value" :value="m.value" :disabled="keys.includes(m.value)">{{ m.label }}</option>
      </optgroup>
    </select>
  </div>

  <label v-else class="of-field">
    <span class="of-label">{{ option.label }}</span>
    <select v-if="option.control === 'metric'" class="of-input" :value="value" @change="set(val($event))">
      <optgroup v-for="g in metricGroups" :key="g.domain" :label="g.label">
        <option v-for="m in g.items" :key="m.value" :value="m.value">{{ m.label }} - {{ m.description }}</option>
      </optgroup>
    </select>
    <select v-else-if="option.control === 'agency'" class="of-input" :value="value" @change="set(val($event))">
      <option v-for="a in agencyOptions" :key="a.value" :value="a.value">{{ a.label }}</option>
    </select>
    <select v-else-if="option.control === 'select'" class="of-input" :value="value" @change="set(val($event))">
      <option v-for="c in option.choices" :key="c.value" :value="c.value">{{ c.label }}</option>
    </select>
    <input
      v-else-if="option.control === 'number'" class="of-input of-num" type="number"
      :min="option.min" :max="option.max" :placeholder="option.placeholder" :value="value ?? ''"
      @change="set(val($event) === '' ? undefined : Number(val($event)))"
    >
    <textarea v-else-if="option.control === 'textarea'" class="of-input of-textarea" rows="3" :value="(value as string) ?? ''" @input="set(val($event))" />
    <input v-else-if="option.control === 'text'" type="text" class="of-input" :placeholder="option.placeholder" :value="(value as string) ?? ''" @input="set(val($event) || undefined)">
  </label>
</template>

<script setup lang="ts">
import { ChevronDown, ChevronUp, X } from 'lucide-vue-next'
import type { WidgetOption } from '~/types/dashboard'
import { AGENCY_OPTIONS, METRIC_OPTIONS } from '~/utils/widgetRegistry'
import { DOMAIN_LABELS, METRICS_BY_KEY, type Domain } from '~/utils/metricRegistry'
import { agencyCardsInScope, metricInScope, type CatalogScope } from '~/utils/agencyCatalog'

const props = defineProps<{ option: WidgetOption; value: unknown }>()
const emit = defineEmits<{ change: [value: unknown] }>()

const val = (e: Event) => (e.target as HTMLInputElement).value
const checked = (e: Event) => (e.target as HTMLInputElement).checked
const set = (v: unknown) => emit('change', v)
const keys = computed(() => (Array.isArray(props.value) ? props.value as string[] : []))

// On an agency's dashboard, only metrics and snapshots from pages that agency can open
// (the current value always stays listed so it never silently changes).
const scope = inject<Ref<CatalogScope | null> | null>('dashboard:catalogScope', null)
const metricGroups = computed(() => (Object.keys(DOMAIN_LABELS) as Domain[]).map(domain => ({
  domain, label: DOMAIN_LABELS[domain],
  items: METRIC_OPTIONS.filter(m => m.domain === domain && (metricInScope(m.value, scope?.value ?? null) || m.value === props.value)),
})).filter(g => g.items.length))
const agencyOptions = computed(() => {
  if (!scope?.value) return AGENCY_OPTIONS
  const allowed = new Set(agencyCardsInScope(scope.value))
  return AGENCY_OPTIONS.filter(a => allowed.has(a.value) || a.value === props.value)
})

function addMetric(e: Event) {
  const k = val(e)
  ;(e.target as HTMLSelectElement).value = ''
  if (k && !keys.value.includes(k)) set([...keys.value, k])
}
function move(i: number, d: number) {
  const list = [...keys.value]
  const [m] = list.splice(i, 1)
  list.splice(i + d, 0, m!)
  set(list)
}
</script>

<style scoped>
.of-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.of-label { font-size: 11px; color: var(--fg-2); font-weight: 500; }
.of-input { height: 30px; padding: 0 8px; font-size: 12px; }
.of-textarea { height: auto; padding: 6px 8px; resize: vertical; }
.of-num { font-family: var(--font-mono); }
.of-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-2); cursor: pointer; }
.of-check input { width: auto; accent-color: var(--primary); }
.of-list { list-style: none; margin: 0 0 2px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.of-list li { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--fg-1); padding: 4px 6px; background: var(--surface-1); border-radius: var(--r-xs); }
.of-list li span { flex: 1; }
.of-mini { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 0; background: none; color: var(--fg-3); cursor: pointer; padding: 0; border-radius: var(--r-xs); }
.of-mini:disabled { opacity: .3; cursor: default; }
.of-mini:focus-visible { outline: 2px solid var(--primary); outline-offset: 0; }
@media (hover: hover) {
  .of-mini:hover:not(:disabled) { background: var(--surface-quiet); color: var(--fg-1); }
  .of-mini--danger:hover:not(:disabled) { background: var(--danger-bg); color: var(--danger-fg); }
}
</style>
