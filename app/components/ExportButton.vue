<template>
  <button
    v-if="canExport"
    class="export-btn"
    :disabled="disabled || busy || (!href && !rows.length)"
    :title="tooltip"
    @click="href ? onExportHref() : onExportRows()"
  >⬇ {{ busy ? 'Exporting…' : label }}</button>
</template>

<script setup lang="ts">
// Role-gated export control. Two modes:
//  - :href          -> a real backend export endpoint (e.g. .../export/?format=csv).
//    Fetched via the authenticated $api client and saved as a blob - a plain
//    <a href> would skip the Bearer-token header entirely and 401.
//  - :rows/:columns -> client-side CSV built from the page's already-loaded,
//    already-filtered records, for registries with no backend export route.
// Renders nothing at all below `minRole`, or when the viewer's role has the
// `export` capability switched off (Module Access) - export is opt-in per
// role, not hidden-but-reachable.
import { useApi } from '~/composables/api/_client'

const props = withDefaults(defineProps<{
  filename?: string
  rows?: Record<string, unknown>[]
  columns?: { key: string; label: string }[]
  href?: string
  label?: string
  disabled?: boolean
  minRole?: string
}>(), {
  filename: 'export.csv',
  rows: () => [],
  columns: undefined,
  href: undefined,
  label: 'Export CSV',
  disabled: false,
  minRole: 'analyst',
})

const { hasMinRole, hasCapability } = usePermissions()
const { exportCsv } = useCsvExport()
const api = useApi()
// The tier gate (`minRole`) AND the `export` capability: an agency can switch export off for a role.
const canExport = computed(() => hasMinRole(props.minRole) && hasCapability('export'))
const downloadName = computed(() => props.filename.endsWith('.csv') ? props.filename : `${props.filename}.csv`)
const busy = ref(false)

const tooltip = computed(() => {
  if (props.href) return `Export via ${props.href}`
  return !props.rows.length ? 'No data to export' : `Export ${props.rows.length} record${props.rows.length !== 1 ? 's' : ''} as CSV`
})

function onExportRows() {
  exportCsv(props.filename, props.rows, props.columns)
}

async function onExportHref() {
  if (!props.href || busy.value) return
  busy.value = true
  try {
    const blob = await api<Blob>(props.href, { responseType: 'blob' } as any)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadName.value
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.export-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: var(--r-sm);
  border: 1px solid var(--border-interactive); background: var(--surface-2); color: var(--fg-1); cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
  white-space: nowrap; text-decoration: none;
}
.export-btn:hover:not(:disabled) { border-color: var(--primary); background: var(--surface-quiet); color: var(--primary); }
.export-btn:disabled { opacity: .45; cursor: default; }
</style>
