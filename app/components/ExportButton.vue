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
// Renders nothing at all below `minRole` - export is opt-in per role, not
// hidden-but-reachable.
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

const { hasMinRole } = usePermissions()
const { exportCsv } = useCsvExport()
const api = useApi()
const canExport = computed(() => hasMinRole(props.minRole))
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
  font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px;
  border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer;
  transition: all .15s; white-space: nowrap; text-decoration: none;
}
.export-btn:hover:not(:disabled) { border-color: #94a3b8; background: #f8fafc; }
.export-btn:disabled { opacity: .45; cursor: default; }
</style>
