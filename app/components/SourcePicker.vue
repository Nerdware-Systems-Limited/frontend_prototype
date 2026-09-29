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

const groups = computed(() => {
  const byAgency = new Map<string, { agencyCode: string; agencyName: string; sources: DataSource[] }>()
  for (const s of props.sources) {
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
function openMenu() { open.value = true }
function close() { open.value = false }

function openAndFocusFirst() {
  openMenu()
  nextTick(() => {
    const first = listEl.value?.querySelector<HTMLElement>('.source-picker-option')
    first?.focus()
  })
}

function select(sourceId: string) {
  emit('update:modelValue', sourceId)
  close()
}

function onListKeydown(e: KeyboardEvent) {
  const options = Array.from(listEl.value?.querySelectorAll<HTMLElement>('.source-picker-option') ?? [])
  const idx = options.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    options[Math.min(options.length - 1, idx + 1)]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    options[Math.max(0, idx - 1)]?.focus()
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
.source-picker-empty { padding: 12px 10px; font-size: 12px; color: var(--fg-3); }
</style>
