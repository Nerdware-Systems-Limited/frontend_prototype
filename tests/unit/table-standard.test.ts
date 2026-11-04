// tests/unit/table-standard.test.ts
// UAPTS has one table design: components/DataTable.vue over composables/useServerTable (docs/data-tables.md).
// This keeps it that way. It scans the app for the old pattern - a raw <table>, usePagination() over a one-shot fetch,
// a page_size beyond the server's 100-row page - and fails on any file that is not in the ledger of known legacy
// tables. The ledger can only shrink: add nothing to it, remove entries as pages are migrated.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { BIG_FETCH_NON_TABLE, LEGACY_PAGED, STATIC_TABLES, UNREVIEWED_TABLES } from '../fixtures/table-ledger'

const APP = join(__dirname, '..', '..', 'app')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(vue|ts)$/.test(name)) out.push(p)
  }
  return out
}

interface Facts { rel: string; vue: boolean; tables: number; pagers: number; bigFetch: number[]; usesDataTable: boolean }
const files: Facts[] = walk(APP).map(p => {
  const src = readFileSync(p, 'utf8')
  return {
    rel: relative(APP, p).replace(/\\/g, '/'),
    vue: p.endsWith('.vue'),
    tables: p.endsWith('.vue') ? (src.match(/<table\b/g) ?? []).length : 0,
    pagers: (src.match(/\busePagination\(/g) ?? []).length,
    bigFetch: [...new Set([...src.matchAll(/page_size:\s*(\d+)/g)].map(m => Number(m[1])).filter(n => n > 100))].sort((a, b) => a - b),
    usesDataTable: /<DataTable\b/.test(src),
  }
}).filter(f => f.rel !== 'components/DataTable.vue' && f.rel !== 'composables/usePagination.ts')

const byRel = new Map(files.map(f => [f.rel, f]))
const known = (rel: string) => rel in LEGACY_PAGED || rel in UNREVIEWED_TABLES || rel in STATIC_TABLES
const HOW = 'Use <DataTable> over useServerTable/useEndpointTable (docs/data-tables.md).'

describe('one table design', () => {
  it('no new raw <table> outside the ledger', () => {
    const offenders = files.filter(f => f.tables > 0 && !known(f.rel)).map(f => f.rel)
    expect(offenders, `New hand-built table(s). ${HOW}`).toEqual([])
  })

  it('no new browser-side paging (usePagination) outside the ledger', () => {
    const offenders = files.filter(f => f.pagers > 0 && !(f.rel in LEGACY_PAGED)).map(f => f.rel)
    expect(offenders, `usePagination pages a list the browser already holds, so it cannot reach rows beyond the fetch. ${HOW}`).toEqual([])
  })

  it('no new fetch bigger than the server page size outside the ledger', () => {
    // Pages and components only: the .ts composables fetch shared lookup lists (agencies, roles), not tables.
    const offenders = files.filter(f => f.vue && f.bigFetch.length && !known(f.rel) && !(f.rel in BIG_FETCH_NON_TABLE)).map(f => `${f.rel} (${f.bigFetch.join(', ')})`)
    expect(offenders, `page_size above 100 is not a way to load a dataset (the server pages at 100; the client stops at 500). ${HOW}`).toEqual([])
  })

  it('the ledger only shrinks: every entry must still be true', () => {
    const stale: string[] = []
    for (const rel of Object.keys(LEGACY_PAGED)) {
      const f = byRel.get(rel)
      if (!f || f.pagers === 0) stale.push(`${rel}: no longer uses usePagination - remove it from LEGACY_PAGED`)
    }
    for (const rel of Object.keys(UNREVIEWED_TABLES)) {
      const f = byRel.get(rel)
      if (!f || f.tables === 0) stale.push(`${rel}: no longer has a raw <table> - remove it from UNREVIEWED_TABLES`)
      else if (f.pagers > 0) stale.push(`${rel}: now pages in the browser - move it to LEGACY_PAGED (or migrate it)`)
    }
    for (const rel of Object.keys(STATIC_TABLES)) {
      if (!byRel.get(rel)?.tables) stale.push(`${rel}: no longer has a raw <table> - remove it from STATIC_TABLES`)
    }
    for (const rel of Object.keys(BIG_FETCH_NON_TABLE)) {
      if (!byRel.get(rel)?.bigFetch.length) stale.push(`${rel}: no longer fetches > 100 - remove it from BIG_FETCH_NON_TABLE`)
    }
    expect(stale).toEqual([])
  })

  it('the counts in the ledger match the code, so progress is real', () => {
    const drift: string[] = []
    for (const [rel, e] of Object.entries(LEGACY_PAGED)) {
      const f = byRel.get(rel)
      if (f && (f.tables !== e.tables || f.pagers !== e.pagers)) drift.push(`${rel}: ledger says ${e.tables} tables / ${e.pagers} pagers, file has ${f.tables} / ${f.pagers}`)
    }
    expect(drift, 'Update the ledger entry (or, better, migrate the page).').toEqual([])
  })

  it('every migrated table page is on the engine, not paging in the browser', () => {
    const bad = files.filter(f => f.usesDataTable && f.pagers > 0).map(f => f.rel)
    expect(bad, 'A page using <DataTable> should not also page with usePagination.').toEqual([])
  })

  it('reports where the migration stands', () => {
    const legacyTables = Object.values(LEGACY_PAGED).reduce((n, e) => n + e.tables, 0)
    const migrated = files.filter(f => f.usesDataTable).length
    // eslint-disable-next-line no-console
    console.info(`[tables] ${migrated} file(s) on DataTable; ${Object.keys(LEGACY_PAGED).length} files / ${legacyTables} tables still paged in the browser; ${Object.keys(UNREVIEWED_TABLES).length} files with unreviewed raw tables`)
    expect(migrated).toBeGreaterThan(0)
  })
})
