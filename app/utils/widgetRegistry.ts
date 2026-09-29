/**
 * Widget catalog - the "worksheets" an admin can drag onto a dashboard.
 *
 * Two things live here:
 *   1. WIDGETS: static metadata (size, permissions, filter support) that the
 *      editor palette, the renderer and the backend allow-list all read.
 *   2. WIDGET_COMPONENTS: type -> Vue component, kept separate so the
 *      backend can import a JSON dump of (1) without Vue.
 *
 * Adding a widget = one entry here + one component. No dashboard code changes.
 *
 * PERMISSIONS: DOMAIN_PERMISSIONS must stay identical to
 * backend apps/dashboards/catalog.py DOMAIN_PERMISSIONS - the server strips
 * widgets by these exact strings. UAPTS users don't carry permission strings,
 * so useViewerContext derives them from module access (safety.view = can reach
 * module M05, ...); see VIEWER_PERMISSION_RULES there.
 *
 * FILTERS: filterFields lists only the params the widget's endpoint really
 * honours on the UAPTS backend, so the frame says "Not filtered by ..."
 * instead of showing unfiltered numbers as filtered.
 */
import type { Component } from 'vue'
import type { FilterField, WidgetDefinition } from '~/types/dashboard'
import { METRICS, METRICS_BY_KEY, type Domain } from '~/utils/metricRegistry'

export const DOMAIN_PERMISSIONS: Record<Domain | 'integrations' | 'gis', string> = {
  safety: 'safety.view',
  fleet: 'fleet.view',
  rail: 'railway.view',
  aviation: 'aviation.view',
  maritime: 'maritime.view',
  infra: 'infrastructure.view',
  integrations: 'integrations.view',
  gis: 'gis.view',
}

const ALL_GEO: FilterField[] = ['date_range', 'agency', 'county', 'road', 'mode', 'severity', 'vehicle_class']

export const WIDGETS: WidgetDefinition[] = [
  // ── KPIs ───────────────────────────────────────────────────────────
  {
    type: 'kpi', kind: 'kpi', category: 'KPIs',
    title: 'KPI card', description: 'One metric with status, period and trend - pick the metric in the inspector.',
    defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 },
    // permission is derived from the chosen metric's domain - see widgetPermissions()
    filterFields: ALL_GEO,
    defaultConfig: { metricKey: 'safety.active_incidents', prominent: false },
  },
  {
    type: 'kpi-row', kind: 'kpi-row', category: 'KPIs',
    title: 'KPI ribbon', description: 'Several metrics in one evenly-spaced row, like the national health ribbon.',
    defaultSize: { w: 12, h: 2 }, minSize: { w: 4, h: 2 },
    filterFields: ALL_GEO,
    defaultConfig: {
      metricKeys: ['safety.active_incidents', 'fleet.live_vehicles', 'rail.otp_30d',
        'aviation.otp_7d', 'maritime.teu_30d', 'infra.good_condition'],
      prominent: true,
    },
  },
  // ── Charts ─────────────────────────────────────────────────────────
  {
    type: 'fatality-bars', kind: 'bars', category: 'Charts',
    title: '30-day fatality trend', description: 'Daily fatalities, coloured by severity band.',
    defaultSize: { w: 6, h: 3 }, minSize: { w: 3, h: 2 },
    requiredPermissions: [DOMAIN_PERMISSIONS.safety],
    // /safety/summary/ reads no query params.
    filterFields: [],
    emits: ['date_range'],
  },
  {
    type: 'incident-trend', kind: 'trend', category: 'Charts',
    title: 'Incidents vs fatalities', description: 'Two-series daily line with shared crosshair.',
    defaultSize: { w: 6, h: 3 }, minSize: { w: 4, h: 3 },
    requiredPermissions: [DOMAIN_PERMISSIONS.safety],
    // /safety/summary/ reads no query params.
    filterFields: [],
  },
  // ── Maps ───────────────────────────────────────────────────────────
  {
    type: 'risk-map', kind: 'map', category: 'Maps',
    title: 'Risk hotspots map', description: 'Predicted hotspots and black spots over the road network. Click a spot to filter by county/road.',
    defaultSize: { w: 8, h: 5 }, minSize: { w: 4, h: 4 },
    requiredPermissions: [DOMAIN_PERMISSIONS.safety, DOMAIN_PERMISSIONS.gis],
    // /predictive-hotspots/ and /black-spots/top/ read only tier / min_score / limit.
    filterFields: [],
    emits: ['county', 'road'],
    defaultConfig: { showRoads: true, hotspotLimit: 30 },
  },
  // ── Operations ─────────────────────────────────────────────────────
  {
    type: 'alerts', kind: 'alerts', category: 'Operations',
    title: 'Active alerts', description: 'Threshold breaches across every domain the viewer can see, critical first.',
    defaultSize: { w: 4, h: 5 }, minSize: { w: 3, h: 3 },
    // Reads five domain summaries; only infrastructure honours a filter (agency), so none is claimed.
    filterFields: [],
  },
  {
    type: 'feed-health', kind: 'feed-health', category: 'Operations',
    title: 'Feed health', description: 'Connected / degraded / offline agency feeds from the Integration Hub.',
    defaultSize: { w: 4, h: 2 }, minSize: { w: 3, h: 2 },
    requiredPermissions: [DOMAIN_PERMISSIONS.integrations],
    filterFields: ['agency'],
    emits: ['agency'],
  },
  // ── Agency ─────────────────────────────────────────────────────────
  {
    type: 'agency-card', kind: 'agency-card', category: 'Agency',
    title: 'Agency snapshot', description: 'Live rows for one agency (KeNHA, NTSA, KPA, KAA, KRC…) plus its workspace link.',
    defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 },
    filterFields: [],
    emits: ['agency'],
    defaultConfig: { agency: 'NTSA' },
  },
  // ── Layout ─────────────────────────────────────────────────────────
  {
    type: 'text', kind: 'text', category: 'Layout',
    title: 'Heading / note', description: 'Section heading or a short explanatory note.',
    defaultSize: { w: 12, h: 1 }, minSize: { w: 2, h: 1 },
    defaultConfig: { text: 'Section heading', variant: 'section' },
  },
  {
    type: 'national-command-centre', kind: 'embed', category: 'Layout',
    title: 'Full national Command Centre', description: 'The existing hand-built page, mounted whole. For migration: assign it, then replace section by section.',
    defaultSize: { w: 12, h: 12 }, minSize: { w: 12, h: 6 },
    requiredPermissions: ['dashboard.national.view'],
  },
]

export const WIDGETS_BY_TYPE: Record<string, WidgetDefinition> =
  Object.fromEntries(WIDGETS.map(w => [w.type, w]))

/** Lazy components so a dashboard only downloads the widgets it uses. */
export const WIDGET_COMPONENTS: Record<string, () => Promise<Component>> = {
  'kpi': () => import('~/components/dashboard/widgets/KpiWidget.vue').then(m => m.default),
  'kpi-row': () => import('~/components/dashboard/widgets/KpiRowWidget.vue').then(m => m.default),
  'fatality-bars': () => import('~/components/dashboard/widgets/FatalityBarsWidget.vue').then(m => m.default),
  'incident-trend': () => import('~/components/dashboard/widgets/IncidentTrendWidget.vue').then(m => m.default),
  'risk-map': () => import('~/components/dashboard/widgets/RiskMapWidget.vue').then(m => m.default),
  'alerts': () => import('~/components/dashboard/widgets/AlertsWidget.vue').then(m => m.default),
  'feed-health': () => import('~/components/dashboard/widgets/FeedHealthWidget.vue').then(m => m.default),
  'agency-card': () => import('~/components/dashboard/widgets/AgencyCardWidget.vue').then(m => m.default),
  'text': () => import('~/components/dashboard/widgets/TextWidget.vue').then(m => m.default),
  'national-command-centre': () => import('~/components/NationalCommandCentre.vue').then(m => m.default),
}

/** Domains each agency snapshot reads - mirrored in backend catalog.AGENCY_CARD_DOMAINS. */
export const AGENCY_CARD_DOMAINS: Record<string, Domain[]> = {
  NTSA: ['safety', 'fleet'], KeNHA: ['infra'], SDR: ['infra'], KPA: ['maritime'],
  KMA: ['maritime'], KAA: ['aviation'], KRC: ['rail'],
}

/**
 * Permissions a placed widget needs - the viewer needs ANY ONE of them.
 * KPI widgets inherit them from the metrics they show, so an NTSA analyst
 * can't see a KPA metric just because someone dropped it on a shared
 * dashboard. (A KPI ribbon shows if any metric is visible; the rest are
 * dropped individually.)
 */
export function widgetPermissions(type: string, config: Record<string, unknown> = {}): string[] {
  const def = WIDGETS_BY_TYPE[type]
  const out = new Set(def?.requiredPermissions ?? [])
  const keys: string[] = type === 'kpi'
    ? [String(config.metricKey ?? '')]
    : type === 'kpi-row' ? (config.metricKeys as string[] | undefined) ?? [] : []
  for (const k of keys) {
    const m = METRICS_BY_KEY[k]
    if (m) out.add(DOMAIN_PERMISSIONS[m.domain as Domain])
  }
  if (type === 'agency-card') {
    for (const d of AGENCY_CARD_DOMAINS[String(config.agency ?? '')] ?? []) out.add(DOMAIN_PERMISSIONS[d])
  }
  return [...out]
}

/** Filter fields a placed widget honours (KPIs narrow to their metrics' fields). */
export function widgetFilterFields(type: string, config: Record<string, unknown> = {}): FilterField[] {
  if (type === 'kpi') return METRICS_BY_KEY[String(config.metricKey)]?.filterFields ?? []
  if (type === 'kpi-row') {
    const set = new Set<FilterField>()
    for (const k of (config.metricKeys as string[] | undefined) ?? []) {
      for (const f of METRICS_BY_KEY[k]?.filterFields ?? []) set.add(f)
    }
    return [...set]
  }
  return WIDGETS_BY_TYPE[type]?.filterFields ?? []
}

export const METRIC_OPTIONS = METRICS.map(m => ({ value: m.key, label: m.label, domain: m.domain, description: m.description }))

export const AGENCY_OPTIONS = [
  { value: 'NTSA', label: 'NTSA - Safety & enforcement' },
  { value: 'KeNHA', label: 'KeNHA - National highways' },
  { value: 'KURA', label: 'KURA - Urban roads' },
  { value: 'KeRRA', label: 'KeRRA - Rural roads' },
  { value: 'KPA', label: 'KPA - Ports' },
  { value: 'KMA', label: 'KMA - Maritime' },
  { value: 'KAA', label: 'KAA - Airports' },
  { value: 'KRC', label: 'KRC - Railways' },
  { value: 'NaMATA', label: 'NaMATA - Metro transport' },
  { value: 'NCTTCA', label: 'NCTTCA - Northern Corridor' },
  { value: 'LAPSSET', label: 'LAPSSET - Corridor development' },
  { value: 'SDR', label: 'SDR - Roads directorate' },
  { value: 'SDT', label: 'SDT - Transport directorate' },
]
