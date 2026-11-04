// tests/unit/scope-api.test.ts
// The scope-aware calls: a county (and period) reaches the endpoint; a call without one is unchanged.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { scopeArgs } from '~/composables/api/_client'
import { useTraffic } from '~/composables/api/useTraffic'
import { useInfrastructure } from '~/composables/api/useInfrastructure'

let $api: ReturnType<typeof vi.fn>
beforeEach(() => {
  $api = vi.fn().mockResolvedValue({ results: [], count: 0 })
  ;(globalThis as any).useNuxtApp = () => ({ $api })
})

describe('scopeArgs', () => {
  it('adds no argument when there is nothing to send', () => {
    expect(scopeArgs()).toEqual([])
    expect(scopeArgs({})).toEqual([])
    expect(scopeArgs({ county: '', days: undefined })).toEqual([])
  })
  it('wraps a scope as the query option', () => {
    expect(scopeArgs({ county: 'Nairobi', days: 7 })).toEqual([{ query: { county: 'Nairobi', days: 7 } }])
  })
})

describe('useTraffic with a scope', () => {
  it('summary / activeCongestion send the county; without one the call is bare', async () => {
    await useTraffic().summary({ county: 'Nairobi' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/traffic/summary/', { query: { county: 'Nairobi' } })
    await useTraffic().summary()
    expect($api).toHaveBeenLastCalledWith('/api/v1/traffic/summary/')
    await useTraffic().activeCongestion({ county: 'Kiambu' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/traffic/congestion-events/active/', { query: { county: 'Kiambu' } })
  })

  it('classShare keeps the old ?days= URL, and takes a full period + county', async () => {
    await useTraffic().classShare(30)
    expect($api).toHaveBeenLastCalledWith('/api/v1/traffic/classifications/share/?days=30')
    await useTraffic().classShare({ date_from: '2026-01-01', date_to: '2026-02-01', county: 'Nairobi' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/traffic/classifications/share/', {
      query: { date_from: '2026-01-01', date_to: '2026-02-01', county: 'Nairobi' },
    })
  })

  it('mapData asks for stations and active events in the county', async () => {
    await useTraffic().mapData({ county: 'Nairobi' })
    const calls = $api.mock.calls
    expect(calls.map(c => c[0]).sort()).toEqual(['/api/v1/traffic/congestion-events/', '/api/v1/traffic/counting-stations/'])
    for (const [, opts] of calls) expect(opts.query.county).toBe('Nairobi')
  })

  it('mapData without a scope sends no county', async () => {
    await useTraffic().mapData()
    for (const [, opts] of $api.mock.calls) expect(opts.query).not.toHaveProperty('county')
  })
})

describe('useInfrastructure with a scope', () => {
  it('scoped aggregates send the county', async () => {
    const infra = useInfrastructure()
    await infra.criticalBridges({ county: 'Nairobi' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/infrastructure/bridges/critical/', { query: { county: 'Nairobi' } })
    await infra.signalFaults({ county: 'Nairobi' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/infrastructure/traffic-signals/faults/', { query: { county: 'Nairobi' } })
    await infra.summary({ agency: 'a1', county: 'Nairobi' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/infrastructure/summary/', { query: { agency: 'a1', county: 'Nairobi' } })
  })
  it('list calls carry the county alongside paging', async () => {
    await useInfrastructure().segments({ page_size: 300, county: 'Nairobi' })
    expect($api).toHaveBeenLastCalledWith('/api/v1/infrastructure/road-segments/', { query: { page_size: 300, county: 'Nairobi' } })
  })
})
