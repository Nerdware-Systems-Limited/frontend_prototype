// tests/unit/widget-validation.test.ts
// ─────────────────────────────────────────────────────────────────────
// Save-time guardrails (docs/Widgets.md §5.6): every problem is stated in words
// an author can act on; errors block Publish, drafts always save; the JSON
// view only applies a correctly shaped widget and never changes its id.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { dashboardIssues, parseWidgetJson, widgetIssues } from '~/utils/widgetValidation'
import { resolveCatalogItem } from '~/utils/widgetRegistry'
import { emptyDefinition, type WidgetInstance } from '~/types/dashboard'
import type { CatalogScope } from '~/utils/agencyCatalog'

const place = (item: string, id = 'w1'): WidgetInstance => {
  const r = resolveCatalogItem(item)!
  return { id, type: r.type, x: 0, y: 0, w: r.size.w, h: r.size.h, config: r.config }
}
const levels = (w: WidgetInstance, scope: CatalogScope | null = null) => widgetIssues(w, scope).map(i => `${i.level}: ${i.message}`)

describe('widgetIssues', () => {
  it('every catalog widget and preset is valid as placed', () => {
    const items = ['kpi', 'kpi-row', 'risk-map', 'alerts', 'feed-health', 'agency-card', 'text', 'preset:traffic.volume_24h', 'preset:pt.leaderboard', 'preset:infra.by_agency', 'preset:rail.avg_delay']
    for (const item of items) expect(levels(place(item)), item).toEqual([])
  })

  it('a generic widget with no binding asks for a source', () => {
    expect(levels({ id: 'w', type: 'series', x: 0, y: 0, w: 6, h: 3 })).toEqual(['error: No data selected. Pick a source in the Data tab.'])
  })

  it('flags an unknown source, a shape the visual cannot draw, and missing fields', () => {
    const w = place('preset:traffic.volume_24h')
    const b = w.config!.binding as Record<string, unknown>
    expect(levels({ ...w, config: { binding: { ...b, source: 'nope' } } })[0]).toMatch(/Unknown data source 'nope'/)
    expect(levels({ ...w, type: 'breakdown' })).toContain('error: Breakdown needs a breakdown by category, but the data is set up as a time series.')
    expect(levels({ ...w, config: { binding: { ...b, dimension: undefined, measures: [] } } })).toEqual([
      'error: Pick the time field the series runs along.', 'error: Pick at least one measure.',
    ])
  })

  it('a table with columns but no measures is fine', () => {
    expect(levels(place('preset:pt.expiring_licences'))).toEqual([])
  })

  it("on an agency dashboard, data from pages the agency can't open is an error", () => {
    const scope: CatalogScope = { agency: 'KRC', routes: new Set(['/railway']), oversight: false }
    expect(levels(place('preset:traffic.volume_24h'), scope)).toEqual([
      "error: KRC can't open the page this data comes from (Road traffic summary).",
    ])
    expect(levels(place('preset:rail.avg_delay'), scope)).toEqual([])
    expect(levels({ ...place('kpi'), config: { metricKey: 'safety.active_incidents' } }, scope)[0]).toMatch(/KRC can't open the page this metric comes from/)
  })

  it('KPI and ribbon checks', () => {
    expect(levels({ ...place('kpi'), config: { metricKey: 'nope' } })).toEqual(["error: Unknown metric 'nope'."])
    expect(levels({ ...place('kpi-row'), config: { metricKeys: [] } })).toEqual(['error: Add at least one metric to the ribbon.'])
    expect(levels({ ...place('kpi-row'), config: { metricKeys: ['safety.active_incidents', 'gone'] } })).toEqual(['warning: Unknown metrics are skipped: gone.'])
  })

  it('an unknown widget type cannot be published', () => {
    expect(levels({ id: 'w', type: 'pie-3d', x: 0, y: 0, w: 2, h: 2 })[0]).toMatch(/^error: Unknown widget type 'pie-3d'/)
  })
})

describe('dashboardIssues', () => {
  it('lists errors first, with the widget each belongs to', () => {
    const def = { ...emptyDefinition(), widgets: [
      { ...place('text', 'a'), title: 'Intro', config: { text: '  ', variant: 'note' } },
      { id: 'b', type: 'table', x: 0, y: 1, w: 6, h: 4 },
    ] }
    expect(dashboardIssues(def).map(i => [i.widgetId, i.label, i.level])).toEqual([
      ['b', 'Table', 'error'], ['a', 'Intro', 'warning'],
    ])
  })
})

describe('parseWidgetJson', () => {
  it('applies a valid widget, keeps the id and clamps the box onto the grid', () => {
    const r = parseWidgetJson(JSON.stringify({ id: 'hijack', type: 'series', x: 10, y: 0, w: 6, h: 3, config: {} }), 'w1')
    expect(r).toEqual({ widget: { id: 'w1', type: 'series', x: 6, y: 0, w: 6, h: 3, config: {} } })
  })

  it.each([
    ['{', /^Not valid JSON/],
    ['[]', /Expected a JSON object/],
    ['{"x":0,"y":0,"w":1,"h":1}', /"type" must be a widget type/],
    ['{"type":"text","x":0,"y":0,"w":"2","h":1}', /"w" must be a whole number/],
    ['{"type":"text","x":0,"y":0,"w":2,"h":1,"config":[]}', /"config" must be an object/],
  ])('rejects %s', (text, msg) => {
    const r = parseWidgetJson(text, 'w1')
    expect('error' in r && r.error).toMatch(msg)
  })
})
