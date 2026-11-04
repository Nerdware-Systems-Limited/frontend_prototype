/**
 * Cell formatting for <DataTable>: one place, so every table shows dates, numbers, booleans and missing values the
 * same way (and exports them the same way).
 */
import type { Row, TableColumn } from '~/types/dataTable'

export const MISSING = '-'

/** `getCellPath(row, 'cohort_detail.cohort_code')` - a nested value, or undefined. A plain key is just `row[key]`. */
export function getCellPath(row: Row, key: string): unknown {
  if (key in row || !key.includes('.')) return row[key]
  return key.split('.').reduce<any>((v, k) => (v == null ? undefined : v[k]), row)
}

/** `snake_case` -> `snake case`. */
export const humanizeValue = (v: unknown): string => String(v ?? '').replace(/_/g, ' ')

export function formatTableDate(v: unknown, withTime: boolean): string {
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString(
    'en-KE',
    withTime
      ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' }
      // A bare date (YYYY-MM-DD) is a calendar day, not an instant: do not shift it through a timezone.
      : { day: '2-digit', month: 'short', year: 'numeric', timeZone: /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? 'UTC' : 'Africa/Nairobi' },
  )
}

/** The text a cell shows (and what a CSV export writes for it). */
export function formatTableCell<T extends Row>(c: TableColumn<T>, row: T): string {
  if (c.render) return c.render(row) || MISSING
  const v = getCellPath(row, c.key)
  if (c.type === 'join') {
    const parts = (c.join ?? []).map(k => humanizeValue(row[k])).filter(Boolean)
    return v == null || !parts.length ? MISSING : parts.join(' ')
  }
  if (v == null || v === '') return MISSING
  if (c.type === 'date') return formatTableDate(v, false)
  if (c.type === 'datetime') return formatTableDate(v, true)
  if (c.type === 'num') {
    const n = Number(v)
    return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: c.digits ?? 2 }) : String(v)
  }
  if (c.type === 'bool') return v ? 'Yes' : 'No'
  return humanizeValue(v)
}

export const badgeVariant = (c: TableColumn, v: unknown) => c.badge?.[String(v)] ?? 'info'
