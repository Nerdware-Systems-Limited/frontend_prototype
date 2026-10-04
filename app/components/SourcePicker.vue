<template>
  <!--
    "Choose the feed" - manual DataSources grouped by agency. Resolves the
    Integration Hub redesign mockup's "Agency" dropdown: the API has no
    concept of picking an agency first and a feed second, so this presents
    it that way while still emitting a plain source_id underneath.
  -->
  <div ref="rootEl" class="source-picker">
    <button
      type="button" class="source-picker-trigger" :class="{ open }"
      role="combobox" aria-haspopup="listbox" :aria-expanded="open" aria-controls="source-picker-listbox"
      @click="toggle" @keydown.down.prevent="openAndFocusFirst" @keydown.esc="close"
    >
      <span v-if="selected">{{ selected.agency_code }} - {{ selected.name }}</span>
      <span v-else class="source-picker-placeholder">Choose a feed…</span>
      <span class="source-picker-caret" aria-hidden="true">▾</span>
    </button>

    <div v-if="open" id="source-picker-listbox" ref="listEl" class="source-picker-menu" role="listbox" @keydown="onListKeydown">
      <div v-if="sources.length > SEARCH_THRESHOLD" class="source-picker-search">
        <input
          ref="searchEl" v-model="search" type="text" class="source-picker-search-input"
          placeholder="Search feeds or agencies…" aria-label="Search feeds" autocomplete="off" spellcheck="false"
          @keydown.down.prevent="focusOption(0)"
          @keydown.enter.prevent="visibleOptions.length === 1 && select(visibleOptions[0]!.source_id)"
        />
        <span class="source-picker-count">{{ visibleOptions.length }} / {{ sources.length }}</span>
      </div>
      <template v-if="!search && recentSources.length">
        <div class="source-picker-group-label">Recently used</div>
        <button
          v-for="s in recentSources" :key="`recent-${s.source_id}`" type="button"
          class="source-picker-option" role="option" :aria-selected="s.source_id === modelValue"
          :class="{ selected: s.source_id === modelValue }"
          @click="select(s.source_id)"
        >
          {{ s.name }}
          <span class="hint">{{ s.agency_code }}</span>
        </button>
      </template>
      <template v-for="group in groups" :key="group.agencyCode">
        <div class="source-picker-group-label">{{ group.agencyCode }} - {{ group.agencyName }}</div>
        <button
          v-for="s in group.sources" :key="s.source_id" type="button"
          class="source-picker-option" role="option" :aria-selected="s.source_id === modelValue"
          :class="{ selected: s.source_id === modelValue }"
          @click="select(s.source_id)"
        >
          {{ s.name }}
          <span class="hint">{{ s.source_system }}</span>
        </button>
      </template>
      <div v-if="!sources.length" class="source-picker-empty">No manual feeds registered.</div>
      <div v-else-if="!groups.length" class="source-picker-empty">No feed matches “{{ search }}”.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DataSource } from '~/composables/api'

const props = defineProps<{
  sources: DataSource[]
  modelValue: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)

const selected = computed(() => props.sources.find(s => s.source_id === props.modelValue) ?? null)

// A search box only earns its place once the list is long enough to need
// one - an agency user with a handful of feeds shouldn't see extra chrome.
const SEARCH_THRESHOLD = 7
const search = ref('')
const searchEl = ref<HTMLInputElement | null>(null)

const visibleOptions = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.sources
  return props.sources.filter(s =>
    [s.source_id, s.name, s.agency_code, s.agency_name, s.source_system]
      .some(v => (v ?? '').toLowerCase().includes(q)),
  )
})

// Last few feeds this browser uploaded to - per-viewer convenience only,
// so every read/write is guarded and the picker works with storage blocked.
const RECENT_KEY = 'uapts_ih_recent_feeds'
const recentIds = ref<string[]>([])
function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, 3) : []
  } catch { return [] }
}
function rememberRecent(id: string) {
  recentIds.value = [id, ...recentIds.value.filter(x => x !== id)].slice(0, 3)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentIds.value)) } catch { /* storage blocked */ }
}
onMounted(() => { recentIds.value = readRecent() })
const recentSources = computed(() =>
  recentIds.value
    .map(id => props.sources.find(s => s.source_id === id))
    .filter((s): s is DataSource => !!s),
)

const groups = computed(() => {
  const byAgency = new Map<string, { agencyCode: string; agencyName: string; sources: DataSource[] }>()
  for (const s of visibleOptions.value) {
    if (!byAgency.has(s.agency_code)) byAgency.set(s.agency_code, { agencyCode: s.agency_code, agencyName: s.agency_name, sources: [] })
    byAgency.get(s.agency_code)!.sources.push(s)
  }
  return [...byAgency.values()].sort((a, b) => a.agencyCode.localeCompare(b.agencyCode))
})

// Auto-select the moment there's exactly one manual feed for an agency -
// resolves the mockup's "Agency" dropdown when there's nothing to actually
// choose between at the feed level.
watch(() => props.sources, (list) => {
  if (!props.modelValue && list.length === 1 && list[0]) emit('update:modelValue', list[0].source_id)
}, { immediate: true })

function toggle() { open.value ? close() : openMenu() }
function openMenu() {
  open.value = true
  search.value = ''
  nextTick(() => searchEl.value?.focus())
}
function close() { open.value = false }

function focusOption(i: number) {
  listEl.value?.querySelectorAll<HTMLElement>('.source-picker-option')[i]?.focus()
}
function openAndFocusFirst() {
  openMenu()
  nextTick(() => { if (!searchEl.value) focusOption(0) })
}

function select(sourceId: string) {
  rememberRecent(sourceId)
  emit('update:modelValue', sourceId)
  close()
}

function onListKeydown(e: KeyboardEvent) {
  const options = Array.from(listEl.value?.querySelectorAll<HTMLElement>('.source-picker-option') ?? [])
  const idx = options.indexOf(document.activeElement as HTMLElement)
  if (e.target === searchEl.value && e.key !== 'Escape' && e.key !== 'Tab') return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    options[Math.min(options.length - 1, idx + 1)]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (idx <= 0 && searchEl.value) searchEl.value.focus()
    else options[Math.max(0, idx - 1)]?.focus()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
    rootEl.value?.querySelector<HTMLElement>('.source-picker-trigger')?.focus()
  } else if (e.key === 'Tab') {
    close()
  }
}

onClickOutside(rootEl, close)
</script>

<style scoped>
.source-picker { position: relative; }
.source-picker-trigger {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  background: var(--surface-2); border: 1px solid var(--border-interactive); border-radius: var(--r-sm);
  padding: 9px 12px; font-size: 13px; color: var(--fg-1); cursor: pointer; text-align: left;
}
.source-picker-trigger:hover, .source-picker-trigger.open { border-color: var(--primary); }
.source-picker-trigger:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.source-picker-placeholder { color: var(--fg-3); }
.source-picker-caret { color: var(--fg-3); font-size: 10px; }

.source-picker-menu {
  position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 30;
  background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--r-sm);
  box-shadow: var(--elev-2); max-height: 320px; overflow-y: auto; padding: 4px;
}
.source-picker-group-label {
  font-size: 10.5px; font-weight: 700; color: var(--fg-3); text-transform: uppercase; letter-spacing: .03em;
  padding: 8px 10px 4px;
}
.source-picker-option {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;
  background: none; border: none; text-align: left; padding: 8px 10px; font-size: 13px; color: var(--fg-1);
  border-radius: var(--r-xs); cursor: pointer;
}
.source-picker-option:hover, .source-picker-option:focus-visible { background: var(--surface-quiet); outline: none; }
.source-picker-option.selected { color: var(--primary); font-weight: 600; }
.source-picker-search {
  display: flex; align-items: center; gap: 8px; padding: 4px 4px 6px;
  position: sticky; top: -4px; background: var(--surface-2); border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 2px;
}
.source-picker-search-input {
  flex: 1; min-width: 0; background: var(--surface-2); border: 1px solid var(--border-interactive);
  border-radius: var(--r-sm); padding: 6px 9px; font-size: 12.5px; color: var(--fg-1);
}
.source-picker-search-input:focus-visible { outline: 2px solid var(--primary); outline-offset: 0; border-color: var(--primary); }
.source-picker-count { font: 500 11px/1 var(--font-mono); font-variant-numeric: tabular-nums; color: var(--fg-3); }
.source-picker-empty { padding: 12px 10px; font-size: 12px; color: var(--fg-3); }
</style>
