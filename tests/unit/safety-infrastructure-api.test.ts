// tests/unit/safety-infrastructure-api.test.ts
// ─────────────────────────────────────────────────────────────────────
// useSafety() and useInfrastructure(): every method must call the right
// endpoint with the right verb, query and body. Table-driven, so adding a
// method to either composable without a row here fails the coverage check
// at the bottom of each block.
//
// $api is stubbed through useNuxtApp(), the same way tests/unit/api.test.ts
// does it.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSafety } from '~/composables/api/useSafety'
import { useInfrastructure } from '~/composables/api/useInfrastructure'

function installNuxtApp() {
  const $api = vi.fn()
  ;(globalThis as any).useNuxtApp = () => ({ $api })
  return $api
}

/** [method name, args to call it with, expected $api arguments]. */
type Row = [string, unknown[], unknown[]]

function runTable(make: () => Record<string, (...a: any[]) => Promise<unknown>>, rows: Row[], getApi: () => any) {
  describe.each(rows)('%s', (name, args, expected) => {
    it('calls $api with the right path and options', async () => {
      const api = getApi()
      api.mockResolvedValue({ ok: name })
      const result = await make()[name]!(...args)
      expect(api).toHaveBeenCalledTimes(1)
      expect(api).toHaveBeenLastCalledWith(...expected)
      expect(result).toEqual({ ok: name }) // response passed through untouched
    })
  })
}

// ── useSafety ───────────────────────────────────────────────────────────────

const S = '/api/v1/safety'
const safetyRows: Row[] = [
  ['summary', [], [`${S}/summary/`, { query: {} }]],
  ['summary', [{ agency: 'NTSA', county: 'Nairobi' }], [`${S}/summary/`, { query: { agency: 'NTSA', county: 'Nairobi' } }]],
  ['incidents', [], [`${S}/incidents/`, { query: {} }]],
  ['incidents', [{ severity: 'fatal', verified: 'true', page_size: 50 }], [`${S}/incidents/`, { query: { severity: 'fatal', verified: 'true', page_size: 50 } }]],
  ['getIncident', ['i1'], [`${S}/incidents/i1/`]],
  ['createIncident', [{ title: 'Crash' }], [`${S}/incidents/`, { method: 'POST', body: { title: 'Crash' } }]],
  ['triageIncident', ['i1'], [`${S}/incidents/i1/triage/`, { method: 'POST' }]],
  ['dispatchIncident', ['i1'], [`${S}/incidents/i1/dispatch/`, { method: 'POST', body: undefined }]],
  ['dispatchIncident', ['i1', { service_type: 'ambulance' }], [`${S}/incidents/i1/dispatch/`, { method: 'POST', body: { service_type: 'ambulance' } }]],
  ['resolveIncident', ['i1'], [`${S}/incidents/i1/resolve/`, { method: 'POST' }]],
  ['closeIncident', ['i1'], [`${S}/incidents/i1/close/`, { method: 'POST' }]],
  ['activeIncidents', [], [`${S}/incidents/active/`, { query: {} }]],
  ['activeIncidents', [{ page_size: 100, severity: 'fatal' }], [`${S}/incidents/active/`, { query: { page_size: 100, severity: 'fatal' } }]],
  ['incidentDispatches', ['i1'], [`${S}/incidents/i1/dispatches/`]],
  ['incidentsByChannel', [], [`${S}/incidents/by-channel/`]],
  ['verifyIncident', ['i1'], [`${S}/incidents/i1/verify/`, { method: 'POST' }]],
  ['unverifyIncident', ['i1'], [`${S}/incidents/i1/unverify/`, { method: 'POST' }]],
  ['incidentReporters', ['i1'], [`${S}/incidents/i1/reporters/`]],
  ['accidents', [{ page: 2 }], [`${S}/accidents/`, { query: { page: 2 } }]],
  ['fatalityTrend', [], [`${S}/accidents/fatality-trend/`, { query: {} }]],
  ['fatalityTrend', [{ days: 7 }], [`${S}/accidents/fatality-trend/`, { query: { days: 7 } }]],
  ['accidentsByCause', [], [`${S}/accidents/by-cause/`, { query: {} }]],
  ['accidentsByCause', [{ date_from: '2012-03-01', date_to: '2012-03-31' }], [`${S}/accidents/by-cause/`, { query: { date_from: '2012-03-01', date_to: '2012-03-31' } }]],
  ['blackspots', [], [`${S}/black-spots/`, { query: {} }]],
  ['topBlackspots', [{ road: 'A104' }], [`${S}/black-spots/top/`, { query: { road: 'A104' } }]],
  ['dispatches', [{ page_size: 30 }], [`${S}/emergency-dispatches/`, { query: { page_size: 30 } }]],
  ['activeDispatches', [], [`${S}/emergency-dispatches/active/`]],
  ['acknowledgeDispatch', ['d1'], [`${S}/emergency-dispatches/d1/acknowledge/`, { method: 'POST' }]],
  ['arriveDispatch', ['d1'], [`${S}/emergency-dispatches/d1/arrive/`, { method: 'POST' }]],
  ['completeDispatch', ['d1'], [`${S}/emergency-dispatches/d1/complete/`, { method: 'POST' }]],
  ['hotspots', [], [`${S}/predictive-hotspots/`, { query: {} }]],
  ['hotspotHeatmap', [], [`${S}/predictive-hotspots/heatmap/`]],
  // The KPI page reads these aggregates (accidents), not a SafetyKPI rollup list.
  ['kpiTrend', [], [`${S}/kpis/trend/`, { query: {} }]],
  ['kpiTrend', [365], [`${S}/kpis/trend/`, { query: { days: 365 } }]],
  ['kpiByCounty', [], [`${S}/kpis/by-county/`, { query: {} }]],
  ['kpiByCounty', [90], [`${S}/kpis/by-county/`, { query: { days: 90 } }]],
  ['kpiTrend', [{ date_from: '2006-01-01', date_to: '2025-12-31' }], [`${S}/kpis/trend/`, { query: { date_from: '2006-01-01', date_to: '2025-12-31' } }]],
  ['kpiByCounty', [{ days: 1 }], [`${S}/kpis/by-county/`, { query: { days: 1 } }]],
  ['interventions', [], [`${S}/interventions/`, { query: {} }]],
  ['interventionEffectiveness', [], [`${S}/interventions/effectiveness/`]],
  ['violations', [{ type: 'speeding' }], [`${S}/traffic-violations/`, { query: { type: 'speeding' } }]],
  ['violationsByType', [], [`${S}/traffic-violations/by-type/`, { query: {} }]],
  ['violationsByType', [{ days: 30 }], [`${S}/traffic-violations/by-type/`, { query: { days: 30 } }]],
]

describe('useSafety - endpoint mapping', () => {
  let $api: any
  beforeEach(() => { $api = installNuxtApp() })

  runTable(() => useSafety() as any, safetyRows, () => $api)

  it('drops empty, null and undefined filters from the query string', async () => {
    $api.mockResolvedValue({})
    await useSafety().incidents({ severity: '', status: undefined, verified: null, page_size: 50 } as any)
    expect($api).toHaveBeenLastCalledWith(`${S}/incidents/`, { query: { page_size: 50 } })
    await useSafety().summary({ agency: '', county: 'Kisumu' })
    expect($api).toHaveBeenLastCalledWith(`${S}/summary/`, { query: { county: 'Kisumu' } })
  })

  it('keeps falsy-but-real values (0 and false) in the query', async () => {
    $api.mockResolvedValue({})
    await useSafety().incidents({ page: 0, flag: false } as any)
    expect($api).toHaveBeenLastCalledWith(`${S}/incidents/`, { query: { page: 0, flag: false } })
  })

  it('no longer exposes the unused SafetyKPI rollup list helper', () => {
    expect((useSafety() as any).kpis).toBeUndefined()
  })

  it('propagates API errors to the caller', async () => {
    $api.mockRejectedValue(Object.assign(new Error('boom'), { status: 403 }))
    await expect(useSafety().summary()).rejects.toMatchObject({ status: 403 })
    await expect(useSafety().triageIncident('i1')).rejects.toThrow('boom')
  })

  it('has a row for every method (add one when you add a method)', () => {
    const covered = new Set(safetyRows.map(r => r[0]))
    const missing = Object.keys(useSafety()).filter(k => !covered.has(k))
    expect(missing).toEqual([])
  })

  it('each call is independent - no state leaks between calls', async () => {
    $api.mockResolvedValue({})
    const s = useSafety()
    await s.incidents({ severity: 'fatal' })
    await s.incidents()
    expect($api).toHaveBeenLastCalledWith(`${S}/incidents/`, { query: {} })
  })
})

// ── useInfrastructure ───────────────────────────────────────────────────────

const I = '/api/v1/infrastructure'
const infraRows: Row[] = [
  ['summary', [], [`${I}/summary/`, { query: {} }]],
  ['summary', [{ agency: 'uuid-1' }], [`${I}/summary/`, { query: { agency: 'uuid-1' } }]],
  ['segments', [], [`${I}/road-segments/`, { query: {} }]],
  ['segments', [{ page: 2, page_size: 25, search: 'A104', ordering: '-iri_value' }], [`${I}/road-segments/`, { query: { page: 2, page_size: 25, search: 'A104', ordering: '-iri_value' } }]],
  ['getSegment', ['s1'], [`${I}/road-segments/s1/`]],
  ['segmentConditionMap', [{ page_size: 100 }], [`${I}/road-segments/condition-map/`, { query: { page_size: 100 } }]],
  ['segmentConditionDistribution', [], [`${I}/road-segments/condition-distribution/`]],
  ['segmentIRIHistogram', [], [`${I}/road-segments/iri-histogram/`]],
  ['maintenanceOrders', [{ status: 'planned' }], [`${I}/maintenance-orders/`, { query: { status: 'planned' } }]],
  ['maintenanceByType', [], [`${I}/maintenance-orders/by-type/`]],
  ['progressMaintenance', ['m1', { progress_pct: 40 }], [`${I}/maintenance-orders/m1/progress/`, { method: 'POST', body: { progress_pct: 40 } }]],
  ['regionalOffices', [], [`${I}/regional-offices/`, { query: {} }]],
  ['fieldSurveys', [{ page: 1 }], [`${I}/field-surveys/`, { query: { page: 1 } }]],
  ['syncFieldSurvey', ['f1'], [`${I}/field-surveys/f1/sync/`, { method: 'POST' }]],
  ['bridges', [{ condition_class: 'poor' }], [`${I}/bridges/`, { query: { condition_class: 'poor' } }]],
  ['criticalBridges', [], [`${I}/bridges/critical/`]],
  ['streetlights', [], [`${I}/streetlights/`, { query: {} }]],
  ['streetlightStatusSummary', [], [`${I}/streetlights/status-summary/`]],
  ['projects', [{ search: 'bypass' }], [`${I}/construction-projects/`, { query: { search: 'bypass' } }]],
  ['projectPortfolio', [], [`${I}/construction-projects/portfolio/`]],
  ['delayedProjects', [], [`${I}/construction-projects/delayed/`]],
  ['projectsByCounty', [], [`${I}/construction-projects/by-county/`]],
  ['forecasts', [], [`${I}/deterioration-forecasts/`, { query: {} }]],
  ['atRiskForecasts', [], [`${I}/deterioration-forecasts/at-risk/`]],
  ['wimReadings', [{ page: 3 }], [`${I}/wim-readings/`, { query: { page: 3 } }]],
  ['wimOverloadStats', [], [`${I}/wim-readings/overload-stats/`]],
  ['wimRepeatOffenders', [], [`${I}/wim-readings/repeat-offenders/`]],
  ['budgets', [{ fiscal_year: 2026 }], [`${I}/maintenance-budgets/`, { query: { fiscal_year: 2026 } }]],
  ['budgetSummary', [], [`${I}/maintenance-budgets/summary/`]],
  ['signals', [], [`${I}/traffic-signals/`, { query: {} }]],
  ['signalFaults', [], [`${I}/traffic-signals/faults/`]],
  ['ruralRoadStatus', [{ page_size: 10 }], [`${I}/rural-road-status/`, { query: { page_size: 10 } }]],
  ['assetSnapshots', [], [`${I}/asset-snapshots/`, { query: {} }]],
]

describe('useInfrastructure - endpoint mapping', () => {
  let $api: any
  beforeEach(() => { $api = installNuxtApp() })

  runTable(() => useInfrastructure() as any, infraRows, () => $api)

  it('drops empty, null and undefined params but keeps 0 and false', async () => {
    $api.mockResolvedValue({})
    await useInfrastructure().segments({ search: '', ordering: undefined, agency: null, page: 0, archived: false })
    expect($api).toHaveBeenLastCalledWith(`${I}/road-segments/`, { query: { page: 0, archived: false } })
  })

  it('scopes the summary by agency UUID and does not scope when omitted', async () => {
    $api.mockResolvedValue({})
    await useInfrastructure().summary({ agency: 'a-uuid' })
    expect($api).toHaveBeenLastCalledWith(`${I}/summary/`, { query: { agency: 'a-uuid' } })
    await useInfrastructure().summary()
    expect($api).toHaveBeenLastCalledWith(`${I}/summary/`, { query: {} })
  })

  it('the summary payload type carries the exact class/surface distributions and nullable averages', async () => {
    // Shape the Infrastructure page reads (see pages/infrastructure/index.vue stats).
    const payload = {
      network: {
        total_segments: 6322, total_length_km: 50344.1, iri_average: null, pci_average: null,
        condition_distribution: [], by_agency: [],
        class_distribution: [{ road_class: 'U', total: 1401, length: 10584.7 }],
        surface_distribution: [{ surface_type: 'unpaved', total: 4843, length: 34887.5 }],
      },
    }
    $api.mockResolvedValue(payload)
    const s = await useInfrastructure().summary()
    expect(s.network.iri_average).toBeNull()
    expect(s.network.class_distribution[0]!.total).toBe(1401)
    expect(s.network.surface_distribution.reduce((n, r) => n + r.total, 0)).toBe(4843)
  })

  it('propagates API errors to the caller', async () => {
    $api.mockRejectedValue(Object.assign(new Error('nope'), { status: 500 }))
    await expect(useInfrastructure().summary()).rejects.toMatchObject({ status: 500 })
    await expect(useInfrastructure().progressMaintenance('m1', { progress_pct: 10 })).rejects.toThrow('nope')
  })

  it('has a row for every method (add one when you add a method)', () => {
    const covered = new Set(infraRows.map(r => r[0]))
    const missing = Object.keys(useInfrastructure()).filter(k => !covered.has(k))
    expect(missing).toEqual([])
  })
})
