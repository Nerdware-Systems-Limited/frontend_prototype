<template>
  <div class="json-viewer">
    <button v-if="collapsible" type="button" class="json-viewer-toggle" @click="open = !open">
      {{ open ? '▾' : '▸' }} {{ label }}
    </button>
    <pre v-if="!collapsible || open" class="json-viewer-body">{{ formatted }}</pre>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: unknown
  label?: string
  collapsible?: boolean
  startOpen?: boolean
}>(), { label: 'Raw payload', collapsible: false, startOpen: false })

const open = ref(props.startOpen)

const formatted = computed(() => {
  try { return JSON.stringify(props.value, null, 2) } catch { return String(props.value) }
})
</script>

<style scoped>
.json-viewer-toggle {
  background: none; border: none; padding: 0; font-size: 12px; color: var(--fg-2);
  cursor: pointer; margin-bottom: 4px;
}
.json-viewer-toggle:hover { color: var(--primary); }
.json-viewer-body {
  background: var(--surface-sunken); border: 1px solid var(--border-subtle); border-radius: var(--r-sm);
  padding: 10px 12px; font-size: 11px; line-height: 1.5; overflow-x: auto;
  max-height: 320px; overflow-y: auto;
  /* Raw payload text, not a tracked figure - the system monospace stack
     here (not var(--font-mono)) matches how <code>/curl-block render actual
     code elsewhere on this page. */
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg-2); margin: 0;
}
</style>
