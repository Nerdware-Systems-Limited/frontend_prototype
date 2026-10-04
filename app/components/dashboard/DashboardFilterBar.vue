<template>
  <div v-if="filters.length || engine.activeSelections.value.length" class="fbar" role="search" aria-label="Dashboard filters">
    <div v-for="f in filters" :key="f.id" class="fbar-item">
      <label :for="`flt-${f.id}`" class="fbar-label">
        {{ f.label }}
        <Lock v-if="f.locked || f.bindToViewer" :size="10" class="fbar-lock" aria-label="Set for your audience, not editable" />
      </label>

      <!-- date range: presets + custom -->
      <div v-if="f.control === 'daterange'" class="fbar-range">
        <select :id="`flt-${f.id}`" class="fbar-input" :disabled="readOnly(f)" :value="presetOf(f)" @change="onPreset(f, ($event.target as HTMLSelectElement).value)">
          <option value="">Any time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="ytd">Year to date</option>
          <option value="custom">Custom…</option>
        </select>
        <template v-if="presetOf(f) === 'custom'">
          <input type="date" class="fbar-input" :value="rangeOf(f)?.from" :disabled="readOnly(f)" aria-label="From" @change="onRange(f, 'from', ($event.target as HTMLInputElement).value)">
          <input type="date" class="fbar-input" :value="rangeOf(f)?.to" :disabled="readOnly(f)" aria-label="To" @change="onRange(f, 'to', ($event.target as HTMLInputElement).value)">
        </template>
      </div>

      <!-- segmented -->
      <div v-else-if="f.control === 'segmented'" :id="`flt-${f.id}`" class="fbar-seg" role="radiogroup" :aria-label="f.label">
        <button
          type="button" role="radio" :aria-checked="!engine.values.value[f.id]" :disabled="readOnly(f)"
          :class="{ on: !engine.values.value[f.id] }" @click="engine.setFilter(f.id, null)"
        >All</button>
        <button
          v-for="o in optionsFor(f)" :key="o.value" type="button" role="radio" :disabled="readOnly(f)"
          :aria-checked="engine.values.value[f.id] === o.value" :class="{ on: engine.values.value[f.id] === o.value }"
          @click="engine.setFilter(f.id, o.value)"
        >{{ o.label }}</button>
      </div>

      <!-- road: free text with suggestions (thousands of road codes) -->
      <template v-else-if="f.field === 'road' && !f.options?.length">
        <input
          :id="`flt-${f.id}`" type="text" class="fbar-input" placeholder="e.g. A8" :disabled="readOnly(f)"
          :value="(engine.values.value[f.id] as string) ?? ''" @change="onText(f, ($event.target as HTMLInputElement).value)"
        >
      </template>

      <!-- select / multiselect -->
      <select
        v-else :id="`flt-${f.id}`" class="fbar-input" :disabled="readOnly(f)" :multiple="f.control === 'multiselect'"
        :value="f.control === 'multiselect' ? undefined : (engine.values.value[f.id] ?? '')"
        @change="onSelect(f, $event.target as HTMLSelectElement)"
      >
        <option v-if="f.control !== 'multiselect'" value="">All</option>
        <option
          v-for="o in optionsFor(f)" :key="o.value" :value="o.value"
          :selected="f.control === 'multiselect' ? ((engine.values.value[f.id] as string[] | null) ?? []).includes(o.value) : undefined"
        >{{ o.label }}</option>
      </select>
    </div>

    <!-- Selections made by clicking widgets (dashboard filter actions) -->
    <div v-if="engine.activeSelections.value.length" class="fbar-chips" aria-label="Active selections">
      <button
        v-for="s in engine.activeSelections.value" :key="s.action.id" type="button" class="fbar-chip"
        :title="`From '${s.action.name}' - click to clear`" @click="engine.clearSelection(s.action.id)"
      >{{ FIELD_LABELS[s.action.field] }}: {{ fmt(s.value) }} <span aria-hidden="true">×</span></button>
    </div>

    <button v-if="hasAnything" type="button" class="fbar-reset" @click="engine.clearAll()">Reset</button>
  </div>
</template>

<script setup lang="ts">
import { Lock } from 'lucide-vue-next'
import type { DashboardFilter, FilterOption, FilterValue } from '~/types/dashboard'
import type { DashboardFilterEngine } from '~/composables/useDashboardFilters'
import { FIELD_LABELS, FIELD_OPTIONS } from '~/utils/filterFields'

const props = defineProps<{ filters: DashboardFilter[]; engine: DashboardFilterEngine }>()

const readOnly = (f: DashboardFilter) => !!(f.locked || f.bindToViewer)
const optionsFor = (f: DashboardFilter): FilterOption[] => f.options?.length ? f.options : FIELD_OPTIONS[f.field] ?? []

const hasAnything = computed(() =>
  props.engine.activeSelections.value.length > 0
  || props.filters.some(f => !readOnly(f) && JSON.stringify(props.engine.values.value[f.id] ?? null) !== JSON.stringify(f.defaultValue ?? null)))

function onSelect(f: DashboardFilter, el: HTMLSelectElement) {
  if (f.control === 'multiselect') props.engine.setFilter(f.id, [...el.selectedOptions].map(o => o.value))
  else props.engine.setFilter(f.id, el.value || null)
}
function onText(f: DashboardFilter, v: string) { props.engine.setFilter(f.id, v.trim() || null) }

// ── date range helpers ──
const iso = (d: Date) => d.toISOString().slice(0, 10)
const customMode = ref<Record<string, boolean>>({})
function rangeOf(f: DashboardFilter) {
  const v = props.engine.values.value[f.id]
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null
}
function presetOf(f: DashboardFilter): string {
  if (customMode.value[f.id]) return 'custom'
  const r = rangeOf(f)
  if (!r) return ''
  const today = iso(new Date())
  if (r.to !== today) return 'custom'
  for (const n of [7, 30, 90]) {
    const from = new Date(); from.setDate(from.getDate() - (n - 1))
    if (r.from === iso(from)) return String(n)
  }
  if (r.from === `${new Date().getFullYear()}-01-01`) return 'ytd'
  return 'custom'
}
function onPreset(f: DashboardFilter, p: string) {
  customMode.value = { ...customMode.value, [f.id]: p === 'custom' }
  if (p === 'custom') return
  if (!p) { props.engine.setFilter(f.id, null); return }
  const to = new Date()
  const from = p === 'ytd' ? new Date(to.getFullYear(), 0, 1) : new Date(Date.now() - (Number(p) - 1) * 86_400_000)
  props.engine.setFilter(f.id, { from: iso(from), to: iso(to) })
}
function onRange(f: DashboardFilter, side: 'from' | 'to', v: string) {
  const cur = rangeOf(f) ?? { from: v, to: v }
  const next = { ...cur, [side]: v }
  if (next.from > next.to) [next.from, next.to] = [next.to, next.from]
  props.engine.setFilter(f.id, next)
}

function fmt(v: FilterValue): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return v.from === v.to ? v.from : `${v.from} → ${v.to}`
  return v
}
</script>

<style scoped>
.fbar {
  display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px 14px;
  padding: 10px 12px; margin-bottom: 10px;
  background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius);
  position: sticky; top: var(--nav-h); z-index: 20;
}
.fbar-item { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.fbar-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--fg-3); display: flex; gap: 4px; align-items: center; }
.fbar-lock { color: var(--fg-3); }
.fbar-input { width: auto; height: 30px; padding: 0 8px; font-size: 12px; min-width: 120px; }
.fbar-input[multiple] { height: auto; min-height: 30px; max-height: 90px; padding: 4px; }
.fbar-input:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.fbar-input:disabled { opacity: .7; cursor: not-allowed; }
.fbar-range { display: flex; gap: 6px; flex-wrap: wrap; }
.fbar-seg { display: inline-flex; border: 1px solid var(--border-interactive); border-radius: var(--r-sm); overflow: hidden; height: 30px; }
.fbar-seg button {
  border: 0; border-right: 1px solid var(--border-subtle); background: var(--surface-1); color: var(--fg-2);
  font-size: 11.5px; padding: 0 10px; cursor: pointer;
}
.fbar-seg button:last-child { border-right: 0; }
.fbar-seg button.on { background: var(--primary-fill); color: #fff; font-weight: 600; }
.fbar-seg button:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.fbar-seg button:disabled { cursor: not-allowed; }
.fbar-chips { display: flex; flex-wrap: wrap; gap: 6px; align-self: center; }
.fbar-chip {
  display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; font-size: 11px; font-weight: 600;
  border: 1px solid var(--primary); border-radius: var(--r-pill); background: var(--primary-wash); color: var(--primary); cursor: pointer;
}
.fbar-reset { margin-left: auto; align-self: center; background: none; border: 0; font-size: 11.5px; font-weight: 600; color: var(--primary); cursor: pointer; }
.fbar-reset:hover { text-decoration: underline; }
@media (max-width: 640px) { .fbar { position: static; } .fbar-item { flex: 1 1 140px; } .fbar-input { width: 100%; } }
</style>
