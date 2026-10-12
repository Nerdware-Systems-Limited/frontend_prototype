// @vitest-environment node
// tests/unit/page-access-coverage.test.ts
// ─────────────────────────────────────────────────────────────────────
// Every page under app/pages must be registered in the access config (a
// module's `routes`, or a baseline route), or non-admin users are denied it
// with "route not recognised" / "route has no module mapping" - and only
// super admins, who bypass the check, would ever notice. See resolveFor() in
// app/utils/resolveAccess.ts.
//
// The config checked is tests/fixtures/access-control.json, the frontend's
// copy of the backend's apps/access_control/data/access-control.json. Keep
// the two in step when you add a page.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PAGES_DIR = fileURLToPath(new URL('../../app/pages', import.meta.url))
const CONFIG_PATH = fileURLToPath(new URL('../fixtures/access-control.json', import.meta.url))

/**
 * Pages that are meant to be reachable without a module grant. The first three
 * mirror PUBLIC_ROUTES in app/middleware/auth.global.ts; '/' is the redirect page.
 * Adding to this list is a decision to leave a page outside access control.
 */
const PUBLIC_PAGES = ['/', '/login', '/forgot-password', '/reset-password/[uid]/[token]']

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? vueFiles(full) : name.endsWith('.vue') ? [full] : []
  })
}

/** Nuxt file-based routing: pages/a/index.vue -> /a, pages/a/[id].vue -> /a/[id]. */
function routeOf(file: string): string {
  const parts = relative(PAGES_DIR, file).slice(0, -'.vue'.length).split(sep)
  if (parts[parts.length - 1] === 'index') parts.pop()
  return `/${parts.join('/')}`
}

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as {
  modules: Record<string, { label: string; routes: string[] }>
  defaults: { baselineRoutes: Record<string, string> }
}
const pageRoutes = vueFiles(PAGES_DIR).map(routeOf).sort()
const moduleRoutes = Object.values(config.modules).flatMap(m => m.routes)
const registered = new Set([...moduleRoutes, ...Object.keys(config.defaults.baselineRoutes)])

describe('page access coverage', () => {
  it('finds the pages', () => {
    expect(pageRoutes.length).toBeGreaterThan(20)
    expect(pageRoutes).toContain('/safety/incidents')
    expect(pageRoutes).toContain('/admin/dashboards/[id]')
  })

  it('registers every page in a module (or the baseline) so non-admins can open it', () => {
    const missing = pageRoutes.filter(r => !registered.has(r) && !PUBLIC_PAGES.includes(r))
    expect(
      missing,
      `Not in access-control.json - non-admin users cannot open ${missing.join(', ')}. ` +
      'Add each path to a module\'s "routes" array (backend apps/access_control/data/access-control.json, ' +
      'and the copy in tests/fixtures), or to PUBLIC_PAGES in this test if it is meant to be public.',
    ).toEqual([])
  })

  it('lists no route that has no page (a typo or a deleted page)', () => {
    const dead = [...registered].filter(r => !pageRoutes.includes(r))
    expect(dead, `Registered but no page file: ${dead.join(', ')}`).toEqual([])
  })

  it('keeps the public-page exemptions honest', () => {
    for (const r of PUBLIC_PAGES) expect(pageRoutes, `${r} is exempt but has no page`).toContain(r)
    for (const r of PUBLIC_PAGES) expect(registered.has(r), `${r} is exempt but also registered`).toBe(false)
  })

  it('maps each route to one module only', () => {
    const seen = new Map<string, number>()
    for (const r of moduleRoutes) seen.set(r, (seen.get(r) ?? 0) + 1)
    const dup = [...seen].filter(([, n]) => n > 1).map(([r]) => r)
    expect(dup, `Listed in more than one module: ${dup.join(', ')}`).toEqual([])
  })
})
