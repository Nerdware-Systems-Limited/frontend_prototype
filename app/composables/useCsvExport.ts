/**
 * useCsvExport - client-side CSV generation for registry pages that have
 * no backend export endpoint. Exports whatever rows are already loaded in
 * the page (i.e. the current filtered view), never fabricated data.
 */

export interface CsvColumn {
  key: string
  label: string
}

function toCsvValue(v: unknown): string {
  if (v == null) return ''
  const s = typeof v === 'string' ? v : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function useCsvExport() {
  function exportCsv(filename: string, rows: Record<string, unknown>[], columns?: CsvColumn[]) {
    if (typeof window === 'undefined' || !rows.length) return

    const cols = columns ?? Object.keys(rows[0]).map(k => ({ key: k, label: k }))
    const header = cols.map(c => toCsvValue(c.label)).join(',')
    const body = rows.map(r => cols.map(c => toCsvValue(r[c.key])).join(',')).join('\n')
    const csv = `${header}\n${body}`

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return { exportCsv }
}
