// tests/unit/kpi-anchors.test.ts
// A KPI card with `to="#section"` scrolls to that section on click. If the page has no element with that id the click
// silently does nothing (KpiCard looks it up with getElementById and returns) - so every anchor must have a target.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const APP = join(__dirname, '..', '..', 'app')
const walk = (dir: string, out: string[] = []): string[] => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    statSync(p).isDirectory() ? walk(p, out) : n.endsWith('.vue') && out.push(p)
  }
  return out
}

describe('KPI drill-down anchors', () => {
  it('every <KpiCard to="#id"> points at an id that exists on the same page', () => {
    const dangling: string[] = []
    for (const p of walk(APP)) {
      const rel = relative(APP, p).replace(/\\/g, '/')
      if (rel === 'components/KpiCard.vue') continue                      // its docs mention `#section-id`
      const src = readFileSync(p, 'utf8')
      const ids = new Set([...src.matchAll(/\bid="([\w-]+)"/g)].map(m => m[1]))
      // a bound id (:id="`row-${x}`") cannot be checked statically: treat a dynamic prefix as covering its family
      const dynamic = [...src.matchAll(/:id="`([\w-]+)\$\{/g)].map(m => m[1] as string)
      for (const m of src.matchAll(/<KpiCard\b[^>]*?\bto="#([\w-]+)"/gs)) {
        const id = m[1] as string
        if (!ids.has(id) && !dynamic.some(d => id.startsWith(d))) dangling.push(`${rel}: #${id}`)
      }
    }
    expect(dangling, 'Add id="…" (and class="drill-target") to the section the KPI is derived from.').toEqual([])
  })

  it('and the scan really sees the cards (so an empty result is not a broken scan)', () => {
    let cards = 0
    for (const p of walk(APP)) cards += (readFileSync(p, 'utf8').match(/<KpiCard\b[^>]*?\bto="#/gs) ?? []).length
    expect(cards).toBeGreaterThan(50)
  })
})
