<template>
  <!--
    Raw preview table (from uploads.preview()) with row/cell-level error
    highlighting. Sheet tabs and paging live in the page around this —
    this component is just the grid.

    Cell-level highlighting is best-effort: validation_report's errors are
    keyed by the template's plain field name ("Financial Year"), but a raw
    file's header cell is the *display* text ("Financial Year *
    (e.g. 2025/26)" for a strict template) or, for a Track-B mapped
    upload, the agency's own unrelated header ("FY"). Normalized substring
    matching (same approach as the mapping form's bestGuessMapping) finds
    the right column for a strict-template file; when nothing matches (a
    mapped upload, or a genuinely cross-field error with no column at all)
    the whole row still gets highlighted rather than silently showing
    nothing.
  -->
  <div v-if="loading" class="sample-grid-loading">Loading preview…</div>
  <EmptyState v-else-if="!columns.length" message="Nothing to preview for this sheet." />
  <div v-else class="sample-grid-scroll">
    <table class="mono-table sample-grid">
      <thead>
        <tr>
          <th v-for="(c, i) in columns" :key="i">{{ c || `Column ${i + 1}` }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, ri) in rows" :key="ri"
          :class="{ 'row-error': rowErrorsFor(ri).length }"
          :title="rowErrorsFor(ri).length ? rowErrorsFor(ri).map(e => e.message).join('; ') : undefined"
        >
          <td
            v-for="(cell, ci) in row" :key="ci" class="mono-sm"
            :class="{ 'cell-error': cellErrorsFor(ri, ci).length }"
            :title="cellErrorsFor(ri, ci).length ? cellErrorsFor(ri, ci).map(e => e.message).join('; ') : undefined"
          >{{ cell ?? '' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { FieldError } from '~/composables/api'

const props = defineProps<{
  columns: string[]
  rows: unknown[][]
  /** File row number (source_row) of rows[0] — offset + DATA_START_ROW(2). */
  startRowNumber: number
  /** source_row -> field errors, from DataUploadDetail.validation_report. */
  rowErrors: Record<number, FieldError[]>
  loading?: boolean
}>()

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function errorsFor(rowIndex: number): FieldError[] {
  return props.rowErrors[props.startRowNumber + rowIndex] ?? []
}

function rowErrorsFor(rowIndex: number): FieldError[] {
  return errorsFor(rowIndex)
}

/** Column-attributable errors whose normalized name is a substring match
 *  (either direction) of this cell's header text. */
function cellErrorsFor(rowIndex: number, colIndex: number): FieldError[] {
  const header = props.columns[colIndex]
  if (!header) return []
  const nh = normalize(header)
  if (!nh) return []
  return errorsFor(rowIndex).filter((e) => {
    if (!e.column) return false
    const nc = normalize(e.column)
    return !!nc && (nh.includes(nc) || nc.includes(nh))
  })
}
</script>

<style scoped>
.sample-grid-loading { padding: 24px; text-align: center; color: var(--fg-3); font-size: 12.5px; }
.sample-grid-scroll { overflow-x: auto; }
.sample-grid { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.sample-grid th {
  text-align: left; font-weight: 600; color: var(--fg-3); padding: 8px 10px;
  border-bottom: 1px solid var(--border-subtle); white-space: nowrap;
}
.sample-grid td { padding: 7px 10px; border-bottom: 1px solid var(--border-subtle); }
.sample-grid tr.row-error { background: var(--danger-bg); }
.sample-grid td.cell-error { outline: 1.5px solid var(--danger-fg); outline-offset: -1.5px; font-weight: 600; color: var(--danger-fg); }
</style>
