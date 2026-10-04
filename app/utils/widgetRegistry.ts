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
 * PERMISSIONS: DOMAIN_PERMISSIONS lives in utils/dataSources.ts and must stay
 * identical to backend apps/dashboards/catalog.py DOMAIN_PERMISSIONS - the
 * server strips widgets by these exact strings. UAPTS users don't carry
 * permission strings, so useViewerContext derives them from module access
 * (safety.view = can reach module M05, ...); see VIEWER_PERMISSION_RULES there.
 *
 * FILTERS: filterFields lists only the params the widget's endpoint really
 * honours on the UAPTS backend, so the frame says "Not filtered by ..."
 * instead of showing unfiltered numbers as filtered.
 */
import type { Component } from 'vue'
import type { FilterField, WidgetDefinition } from '~/types/dashboard'
import { METRICS, METRICS_BY_KEY, type Domain } from '~/utils/metricRegistry'
import { DOMAIN_PERMISSIONS, SOURCES_BY_ID } from '~/utils/dataSources'
import { PRESETS_BY_ID } from '~/utils/widgetPresets'
import type { WidgetSize } from '~/types/dashboard'
import type { Binding } from '~/types/frame'

export const WIDGETS: WidgetDefinition[] = [
  // ── KPIs ───────────────────────────────────────────────────────────
  {
    type: 'kpi', kind: 'kpi', category: 'KPIs',
    title: 'KPI card', description: 'One metric with status, period and trend - pick the metric in the inspector.',
    defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 },
    framed: false,
    // permission and honoured filters both come from the chosen metric -
    // see widgetPermissions() / widgetFilterFields().
    filterFields: [],
    defaultConfig: { metricKey: 'safety.active_incidents', prominent: false },
  },
  {
    type: 'kpi-row', kind: 'kpi-row', category: 'KPIs',
    title: 'KPI ribbon', description: 'Several metrics in one evenly-spaced row, like the national health ribbon.',
    defaultSize: { w: 12, h: 2 }, minSize: { w: 4, h: 2 },
    framed: false,
    // the union of its metrics' fields - see widgetFilterFields()
    filterFields: [],
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
    // Type id kept for stored dashboards. The incident series isn't returned by
    // /safety/summary/ yet; the chart adds it automatically when it is.
    title: 'Daily fatality trend', description: 'Daily fatalities as a line with a crosshair. Incidents are added when the feed provides them.',
    defaultSize: { w: 6, h: 3 }, minSize: { w: 4, h: 3 },
    requiredPermissions: [DOMAIN_PERMISSIONS.safety],
    // /safety/summary/ reads no query params.
    filterFields: [],
  },
  // ── Maps ───────────────────────────────────────────────────────────
  {
    type: 'risk-map', kind: 'map', category: 'Maps',
    title: 'Risk hotspots map', description: 'Predicted hotspots and black spots over the road network. Click a spot or a top road to filter by road.',
    defaultSize: { w: 8, h: 5 }, minSize: { w: 4, h: 4 },
    requiredPermissions: [DOMAIN_PERMISSIONS.safety, DOMAIN_PERMISSIONS.gis],
    // /predictive-hotspots/ and /black-spots/top/ read only tier / min_score / limit.
    filterFields: [],
    emits: ['road'],
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
    framed: false,
    filterFields: [],
    emits: ['agency'],
    defaultConfig: { agency: 'NTSA' },
  },
  // ── Generic primitives (placed through presets in widgetPresets.ts) ──
  // Permission, filters and clicks all come from the instance's binding -
  // see widgetPermissions() / widgetFilterFields() / widgetEmits().
  {
    type: 'stat', kind: 'kpi', category: 'KPIs', palette: false, framed: false,
    title: 'Stat', description: 'One figure from any source, with its shared threshold.',
    defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, filterFields: [],
  },
  {
    type: 'series', kind: 'trend', category: 'Charts', palette: false,
    title: 'Time series', description: 'One or more measures over time on one axis.',
    defaultSize: { w: 6, h: 3 }, minSize: { w: 2, h: 2 }, filterFields: [],
  },
  {
    type: 'breakdown', kind: 'breakdown', category: 'Charts', palette: false,
    title: 'Breakdown', description: 'A measure split by category, largest first.',
    defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, filterFields: [],
  },
  {
    type: 'table', kind: 'table', category: 'Operations', palette: false,
    title: 'Table', description: 'Rows from any source, sortable.',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 2, h: 2 }, filterFields: [],
  },
  // ── Layout ─────────────────────────────────────────────────────────
  {
    type: 'text', kind: 'text', category: 'Layout',
    title: 'Heading / note', description: 'Section heading or a short explanatory note.',
    defaultSize: { w: 12, h: 1 }, minSize: { w: 2, h: 1 },
    framed: false,
    defaultConfig: { text: 'Section heading', variant: 'section' },
  },
  {
    type: 'national-command-centre', kind: 'embed', category: 'Layout',
    title: 'Full national Command Centre', description: 'The existing hand-built page, mounted whole. For migration: assign it, then replace section by section.',
    defaultSize: { w: 12, h: 12 }, minSize: { w: 12, h: 6 },
    framed: false,
    requiredPermissions: ['dashboard.national.view'],
  },
]

export const WIDGETS_BY_TYPE: Record<string, WidgetDefinition> =
  Object.fromEntries(WIDGETS.map(w => [w.type, w]))

/** Generic widget types whose data comes from a binding in their config. */
export const BOUND_TYPES = new Set(['stat', 'series', 'breakdown', 'table'])
const bindingIn = (type: string, config: Record<string, unknown> = {}): Binding | null =>
  BOUND_TYPES.has(type) && config.binding && typeof config.binding === 'object' ? config.binding as Binding : null

/** Whether the frame draws a card around this widget type. Unknown types are framed. */
export const isFramed = (type: string): boolean => WIDGETS_BY_TYPE[type]?.framed ?? true

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
  'stat': () => import('~/components/dashboard/widgets/StatWidget.vue').then(m => m.default),
  'series': () => import('~/components/dashboard/widgets/SeriesWidget.vue').then(m => m.default),
  'breakdown': () => import('~/components/dashboard/widgets/BreakdownWidget.vue').then(m => m.default),
  'table': () => import('~/components/dashboard/widgets/TableWidget.vue').then(m => m.default),
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
  const binding = bindingIn(type, config)
  if (binding) {
    const perm = SOURCES_BY_ID[binding.source]?.permission
    // An unknown source can't be checked, so nobody may see it.
    out.add(perm ?? 'dashboards.unknown-source')
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
  const binding = bindingIn(type, config)
  if (binding) return SOURCES_BY_ID[binding.source]?.honours ?? []
  return WIDGETS_BY_TYPE[type]?.filterFields ?? []
}

/** Fields a click on this placed widget can emit (generic widgets: their binding's). */
export function widgetEmits(type: string, config: Record<string, unknown> = {}): FilterField[] {
  const binding = bindingIn(type, config)
  if (binding) return binding.emits ? [binding.emits] : []
  return WIDGETS_BY_TYPE[type]?.emits ?? []
}

/**
 * A palette entry -> what to place. Entries are a widget type ("kpi") or a
 * preset ("preset:traffic.volume_24h"), which places a generic widget with
 * the preset's binding.
 */
export function resolveCatalogItem(item: string): { type: string; size: WidgetSize; config: Record<string, unknown>; title?: string } | null {
  if (item.startsWith('preset:')) {
    const p = PRESETS_BY_ID[item.slice('preset:'.length)]
    if (!p) return null
    return { type: p.type, size: p.defaultSize, title: p.title, config: { ...(p.config ?? {}), binding: structuredClone(p.binding), presetId: p.id, presetTitle: p.title } }
  }
  const d = WIDGETS_BY_TYPE[item]
  return d ? { type: d.type, size: d.defaultSize, config: { ...(d.defaultConfig ?? {}) } } : null
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
