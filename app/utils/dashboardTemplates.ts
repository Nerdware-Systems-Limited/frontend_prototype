/**
 * Starter templates. "New dashboard → from template" clones one of these.
 * The backend seeds the same JSON (backend/apps/dashboards/fixtures) as
 * system dashboards so every agency has something sensible on day one.
 */
import { emptyDefinition, type DashboardDefinition } from '~/types/dashboard'

export interface DashboardTemplate {
  key: string
  name: string
  description: string
  suggestedAudience: string
  build: () => DashboardDefinition
}

const base = (title: string, subtitle: string): DashboardDefinition => ({ ...emptyDefinition(title), subtitle })

export const TEMPLATES: DashboardTemplate[] = [
  {
    key: 'blank', name: 'Blank', description: 'An empty 12-column canvas.', suggestedAudience: 'Anyone',
    build: () => emptyDefinition('New dashboard'),
  },
  {
    key: 'national', name: 'National Command Centre',
    description: 'Six-domain health ribbon, road safety KPIs, risk map with alerts, agency snapshots - the current national page, rebuilt from widgets.',
    suggestedAudience: 'SDT, super admins, Cabinet Secretary office',
    build: () => ({
      ...base('Command Centre', "Unified oversight across Kenya's transport agencies and modes"),
      widgets: [
        { id: 'hdr1', type: 'text', x: 0, y: 0, w: 12, h: 1, config: { text: 'National transport health', variant: 'section' } },
        { id: 'ribbon', type: 'kpi-row', x: 0, y: 1, w: 12, h: 2, config: { metricKeys: ['safety.active_incidents', 'fleet.live_vehicles', 'rail.otp_30d', 'aviation.otp_7d', 'maritime.teu_30d', 'infra.good_condition'], prominent: true } },
        { id: 'hdr2', type: 'text', x: 0, y: 3, w: 12, h: 1, config: { text: 'Road safety & incident management', variant: 'section' } },
        { id: 'k1', type: 'kpi', x: 0, y: 4, w: 4, h: 2, config: { metricKey: 'safety.incidents_24h' } },
        { id: 'k2', type: 'kpi', x: 4, y: 4, w: 4, h: 2, config: { metricKey: 'safety.incidents_7d' } },
        { id: 'k3', type: 'kpi', x: 8, y: 4, w: 4, h: 2, config: { metricKey: 'safety.fatalities_30d' } },
        { id: 'bars', type: 'fatality-bars', x: 0, y: 6, w: 12, h: 2 },
        { id: 'map', type: 'risk-map', x: 0, y: 8, w: 8, h: 5, config: { showRoads: true, hotspotLimit: 30 } },
        { id: 'alerts', type: 'alerts', x: 8, y: 8, w: 4, h: 5 },
        { id: 'hdr3', type: 'text', x: 0, y: 13, w: 12, h: 1, config: { text: 'Agency drill-downs', variant: 'section' } },
        { id: 'ag1', type: 'agency-card', x: 0, y: 14, w: 4, h: 4, config: { agency: 'KeNHA' } },
        { id: 'ag2', type: 'agency-card', x: 4, y: 14, w: 4, h: 4, config: { agency: 'NTSA' } },
        { id: 'ag3', type: 'agency-card', x: 8, y: 14, w: 4, h: 4, config: { agency: 'KPA' } },
        { id: 'ag4', type: 'agency-card', x: 0, y: 18, w: 4, h: 4, config: { agency: 'KAA' } },
        { id: 'ag5', type: 'agency-card', x: 4, y: 18, w: 4, h: 4, config: { agency: 'KRC' } },
        { id: 'ag6', type: 'agency-card', x: 8, y: 18, w: 4, h: 4, config: { agency: 'SDR' } },
      ],
      filters: [
        { id: 'fdate', field: 'date_range', label: 'Date range', control: 'daterange', appliesTo: 'all' },
        { id: 'fcounty', field: 'county', label: 'County', control: 'select', appliesTo: 'all' },
      ],
      actions: [
        { id: 'a_map_road', name: 'Map road → filter safety widgets', type: 'filter', sourceWidgetId: 'map', field: 'road', targetWidgetIds: 'all', onClear: 'show-all' },
        { id: 'a_bars_day', name: 'Trend day → filter KPIs', type: 'filter', sourceWidgetId: 'bars', field: 'date_range', targetWidgetIds: ['k1', 'k2', 'k3'], onClear: 'show-all' },
      ],
    }),
  },
  {
    key: 'road-safety-ops', name: 'Road Safety Operations',
    description: 'For NTSA / NPS duty officers: live incident load, dispatches, black spots, the risk map and a county filter that drives everything.',
    suggestedAudience: 'NTSA · Road Safety department',
    build: () => ({
      ...base('Road Safety Operations', 'Live incident load and risk - NTSA IRSMS'),
      refreshInterval: 60,
      widgets: [
        { id: 'k1', type: 'kpi', x: 0, y: 0, w: 3, h: 2, config: { metricKey: 'safety.active_incidents', prominent: true } },
        { id: 'k2', type: 'kpi', x: 3, y: 0, w: 3, h: 2, config: { metricKey: 'safety.incidents_24h' } },
        { id: 'k3', type: 'kpi', x: 6, y: 0, w: 3, h: 2, config: { metricKey: 'safety.dispatches' } },
        { id: 'k4', type: 'kpi', x: 9, y: 0, w: 3, h: 2, config: { metricKey: 'safety.critical_blackspots' } },
        { id: 'map', type: 'risk-map', x: 0, y: 2, w: 8, h: 6, config: { showRoads: true, hotspotLimit: 60 } },
        { id: 'alerts', type: 'alerts', x: 8, y: 2, w: 4, h: 6 },
        { id: 'trend', type: 'incident-trend', x: 0, y: 8, w: 8, h: 3 },
        { id: 'k5', type: 'kpi', x: 8, y: 8, w: 4, h: 3, config: { metricKey: 'safety.fatalities_30d' } },
      ],
      filters: [
        { id: 'fcounty', field: 'county', label: 'County', control: 'select', appliesTo: 'all' },
        { id: 'fsev', field: 'severity', label: 'Severity', control: 'segmented', appliesTo: 'all' },
      ],
      actions: [
        { id: 'a1', name: 'Click a road → filter everything', type: 'filter', sourceWidgetId: 'map', field: 'road', targetWidgetIds: 'all', onClear: 'show-all' },
      ],
    }),
  },
  {
    key: 'infrastructure', name: 'Road Infrastructure',
    description: 'Network condition, bridges, maintenance backlog and budget absorption, pinned to the viewer\'s own roads agency.',
    suggestedAudience: 'KeNHA / KURA / KeRRA · Maintenance',
    build: () => ({
      ...base('Road Infrastructure', 'Condition, assets and spend'),
      refreshInterval: 900,
      widgets: [
        { id: 'k1', type: 'kpi', x: 0, y: 0, w: 3, h: 2, config: { metricKey: 'infra.good_condition', prominent: true } },
        { id: 'k2', type: 'kpi', x: 3, y: 0, w: 3, h: 2, config: { metricKey: 'infra.critical_bridges' } },
        { id: 'k3', type: 'kpi', x: 6, y: 0, w: 3, h: 2, config: { metricKey: 'infra.maintenance_backlog' } },
        { id: 'k4', type: 'kpi', x: 9, y: 0, w: 3, h: 2, config: { metricKey: 'infra.budget_absorption' } },
        { id: 'ag', type: 'agency-card', x: 0, y: 2, w: 4, h: 4, config: { agency: 'KeNHA' } },
        { id: 'map', type: 'risk-map', x: 4, y: 2, w: 8, h: 4, config: { showRoads: true, hotspotLimit: 30 } },
      ],
      filters: [
        { id: 'fag', field: 'agency', label: 'Agency', control: 'select', appliesTo: 'all', bindToViewer: 'agency' },
        { id: 'fcounty', field: 'county', label: 'County', control: 'select', appliesTo: 'all' },
      ],
      actions: [],
    }),
  },
  {
    key: 'executive', name: 'Executive one-pager',
    description: 'Six headline numbers and the alert list. Nothing else. For principal secretaries and board members.',
    suggestedAudience: 'Role: executive',
    build: () => ({
      ...base('Transport at a glance', ''),
      theme: { density: 'comfortable', rowHeight: 84, gap: 10 },
      widgets: [
        { id: 'ribbon', type: 'kpi-row', x: 0, y: 0, w: 12, h: 2, config: { metricKeys: ['safety.fatalities_30d', 'fleet.live_vehicles', 'rail.otp_30d', 'aviation.otp_7d', 'maritime.teu_30d', 'infra.good_condition'], prominent: true } },
        { id: 'alerts', type: 'alerts', x: 0, y: 2, w: 8, h: 4 },
        { id: 'feeds', type: 'feed-health', x: 8, y: 2, w: 4, h: 4 },
      ],
      filters: [],
      actions: [],
    }),
  },
]
