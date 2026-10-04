// tests/unit/dashboard-compat.test.ts
// ─────────────────────────────────────────────────────────────────────
// Stored dashboards keep rendering across the widget refactor: every
// widget type in the shipped templates and in a stored-JSON fixture (the
// shape the backend keeps in DashboardVersion.definition) still resolves
// to a catalog definition and a component, and every action still points
// at a field its source widget emits.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import type { DashboardDefinition } from '~/types/dashboard'
import { WIDGETS_BY_TYPE, WIDGET_COMPONENTS, widgetEmits } from '~/utils/widgetRegistry'
import { TEMPLATES } from '~/utils/dashboardTemplates'

/** A definition as saved before the data-layer refactor (schemaVersion 1). */
const STORED: DashboardDefinition = {
  schemaVersion: 1,
  title: 'Stored before the refactor',
  theme: { density: 'comfortable', rowHeight: 76, gap: 8 },
  refreshInterval: 120,
  widgets: [
    { id: 'k', type: 'kpi', x: 0, y: 0, w: 2, h: 2, config: { metricKey: 'safety.fatalities_30d', prominent: true } },
    { id: 'r', type: 'kpi-row', x: 2, y: 0, w: 10, h: 2, config: { metricKeys: ['rail.otp_30d', 'infra.critical_bridges'] } },
    { id: 'b', type: 'fatality-bars', x: 0, y: 2, w: 6, h: 3 },
    { id: 't', type: 'incident-trend', x: 6, y: 2, w: 6, h: 3, title: 'Incidents vs fatalities' },
    { id: 'm', type: 'risk-map', x: 0, y: 5, w: 8, h: 5, config: { showRoads: false, hotspotLimit: 50 } },
    { id: 'a', type: 'alerts', x: 8, y: 5, w: 4, h: 5 },
    { id: 'f', type: 'feed-health', x: 0, y: 10, w: 4, h: 2 },
    { id: 'g', type: 'agency-card', x: 4, y: 10, w: 4, h: 4, config: { agency: 'KRC' } },
    { id: 'h', type: 'text', x: 0, y: 14, w: 12, h: 1, config: { text: 'Notes', variant: 'note' } },
    { id: 'n', type: 'national-command-centre', x: 0, y: 15, w: 12, h: 12 },
    // a generic widget saved with its binding (Phase 3 shape)
    { id: 'gb', type: 'breakdown', x: 0, y: 27, w: 4, h: 3, title: 'Network by agency', config: { binding: { source: 'infra.summary', shape: 'categorical', path: 'network.by_agency', dimension: { key: 'agency_code', label: 'Agency' }, measures: [{ key: 'total_length_km', label: 'Length', unit: 'km' }], emits: 'agency' } } },
  ],
  filters: [{ id: 'fa', field: 'agency', label: 'Agency', control: 'select', appliesTo: 'all' }],
  actions: [
    { id: 'x1', name: 'Road', type: 'filter', sourceWidgetId: 'm', field: 'road', targetWidgetIds: 'all', onClear: 'show-all' },
    { id: 'x2', name: 'Day', type: 'filter', sourceWidgetId: 'b', field: 'date_range', targetWidgetIds: ['k'], onClear: 'show-all' },
    { id: 'x3', name: 'Agency', type: 'highlight', sourceWidgetId: 'f', field: 'agency', targetWidgetIds: 'all', onClear: 'keep' },
    { id: 'x4', name: 'Agency bars', type: 'filter', sourceWidgetId: 'gb', field: 'agency', targetWidgetIds: 'all', onClear: 'show-all' },
  ],
}

const definitions: [string, DashboardDefinition][] = [
  ['stored fixture', STORED],
  ...TEMPLATES.map(t => [`template ${t.key}`, t.build()] as [string, DashboardDefinition]),
]

describe.each(definitions)('%s', (_name, def) => {
  it('every widget type has a definition and a component', () => {
    for (const w of def.widgets) {
      expect(WIDGETS_BY_TYPE[w.type], w.type).toBeDefined()
      expect(WIDGET_COMPONENTS[w.type], w.type).toBeTypeOf('function')
    }
  })

  it('every action uses a field its source widget emits', () => {
    for (const a of def.actions) {
      const src = def.widgets.find(w => w.id === a.sourceWidgetId)
      expect(src, a.id).toBeDefined()
      expect(widgetEmits(src!.type, src!.config), `${a.id} on ${src!.type}`).toContain(a.field)
    }
  })
})
