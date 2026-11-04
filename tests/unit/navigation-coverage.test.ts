// tests/unit/navigation-coverage.test.ts
// Every page must be reachable from the sidebar AND findable in the search palette (AppTopNav). A page that exists
// only as a URL - like Road Infrastructure > Maintenance Orders was - cannot be found, and the user guide (which lists
// it as a sidebar page) disagrees with the app.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const APP = join(__dirname, '..', '..', 'app')
const PAGES = join(APP, 'pages')

/** Pages that are deliberately not in the menu: auth screens, the profile (opened from the avatar), the root redirect. */
const NOT_IN_MENU = new Set(['/', '/login', '/forgot-password', '/profile'])

function routes(dir: string, base = ''): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { out.push(...routes(p, `${base}/${name}`)); continue }
    if (!name.endsWith('.vue') || name.includes('[')) continue            // dynamic routes have no menu entry
    const stem = name.slice(0, -4)
    out.push(stem === 'index' ? (base || '/') : `${base}/${stem}`)
  }
  return out
}

const all = routes(PAGES).filter(r => !NOT_IN_MENU.has(r))
const sidebar = new Set([...readFileSync(join(APP, 'components/AppSidebar.vue'), 'utf8').matchAll(/\bto="(\/[^"]*)"/g)].map(m => m[1]))
const palette = new Set([...readFileSync(join(APP, 'components/AppTopNav.vue'), 'utf8').matchAll(/\bto: '(\/[^']*)'/g)].map(m => m[1]))

describe('navigation coverage', () => {
  it('the scan finds the pages and the menus', () => {
    expect(all.length).toBeGreaterThan(60)
    expect(sidebar.size).toBeGreaterThan(60)
    expect(palette.size).toBeGreaterThan(60)
  })

  it('every page is in the sidebar', () => {
    expect(all.filter(r => !sidebar.has(r)), 'Add a <NuxtLink> in components/AppSidebar.vue').toEqual([])
  })

  it('every page is in the search palette', () => {
    expect(all.filter(r => !palette.has(r)), 'Add an entry to the palette list in components/AppTopNav.vue').toEqual([])
  })

  it('Road Infrastructure lists Maintenance Orders, as the user guide says', () => {
    expect(sidebar.has('/infrastructure/maintenance')).toBe(true)
    expect(palette.has('/infrastructure/maintenance')).toBe(true)
  })
})
