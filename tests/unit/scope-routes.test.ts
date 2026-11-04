// tests/unit/scope-routes.test.ts
// Which requests get the module's county added implicitly, and which never do.
import { describe, it, expect } from 'vitest'
import { COUNTY_ROUTES, countyKeyFor, withModuleCounty } from '~/utils/scopeRoutes'

describe('countyKeyFor', () => {
  it.each([
    ['/api/v1/aviation-maritime/aviation/airports/', 'aviation'],
    ['/api/v1/aviation-maritime/maritime/ports/?page_size=5', 'maritime'],
    ['/api/v1/railway/summary/', 'railway'],
    ['/api/v1/public-transport/routes/', 'public-transport'],
    ['/api/v1/fleet/vehicles/', 'fleet'],
  ])('%s -> %s', (path, key) => expect(countyKeyFor(path)).toBe(key))

  it('leaves everything else alone, including the modules that pass the county explicitly', () => {
    for (const p of ['/api/v1/traffic/summary/', '/api/v1/safety/incidents/', '/api/v1/infrastructure/bridges/', '/api/v1/auth/login/', '/api/v1/gis/counties/']) {
      expect(countyKeyFor(p)).toBeNull()
    }
  })

  it('every prefix maps to a distinct module key', () => {
    expect(new Set(COUNTY_ROUTES.map(r => r.key)).size).toBe(COUNTY_ROUTES.length)
  })
})

describe('withModuleCounty', () => {
  const path = '/api/v1/railway/stations/'

  it('adds the county to a GET, keeping the caller\'s own query', () => {
    expect(withModuleCounty(path, { query: { page_size: 5 } }, 'Nairobi')).toEqual({ query: { page_size: 5, county: 'Nairobi' } })
    expect(withModuleCounty(path, {}, 'Nairobi')).toEqual({ query: { county: 'Nairobi' } })
  })

  it('does nothing without a county', () => {
    const o = { query: { a: 1 } }
    expect(withModuleCounty(path, o, null)).toBe(o)
  })

  it('never touches a write', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
      const o = { method, body: { x: 1 } }
      expect(withModuleCounty(path, o as any, 'Nairobi')).toBe(o)
    }
  })

  it('a county the caller already set wins, in the query option or in the URL', () => {
    const o = { query: { county: 'Mombasa' } }
    expect(withModuleCounty(path, o, 'Nairobi')).toBe(o)
    const noOpts = {}
    expect(withModuleCounty(path + '?county=Kisumu', noOpts, 'Nairobi')).toBe(noOpts)
    expect(withModuleCounty(path + '?days=7&county=Kisumu', noOpts, 'Nairobi')).toBe(noOpts)
  })

  it('does not mutate the options it was given', () => {
    const o = { query: { a: 1 } }
    withModuleCounty(path, o, 'Nairobi')
    expect(o).toEqual({ query: { a: 1 } })
  })
})
