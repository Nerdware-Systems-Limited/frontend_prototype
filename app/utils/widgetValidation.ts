/**
 * Authoring guardrails (docs/Widgets.md §5.6): what is wrong with a placed widget,
 * in words an author can act on. Errors block Publish; warnings don't.
 * Drafts always save - an unfinished widget is a normal part of editing.
 */
import type { DashboardDefinition, WidgetInstance } from '~/types/dashboard'
import { clampBox } from '~/utils/layoutEngine'
import { BOUND_TYPES, WIDGETS_BY_TYPE, AGENCY_CARD_DOMAINS } from '~/utils/widgetRegistry'
import { QUERY_MAX_ROWS, SOURCES_BY_ID, isQuerySource } from '~/utils/dataSources'
import { METRICS_BY_KEY } from '~/utils/metricRegistry'
import { SHAPE_FOR_TYPE } from '~/utils/bindingDesign'
import { agencyCardsInScope, metricInScope, sourceInScope, type CatalogScope } from '~/utils/agencyCatalog'
import { bindingOf } from '~/utils/bindings'
import type { FrameShape } from '~/types/frame'

export interface WidgetIssue { level: 'error' | 'warning'; message: string }
export interface DashboardIssue extends WidgetIssue { widgetId: string; label: string }

const SHAPE_WORDS: Record<FrameShape, string> = {
  scalar: 'a single figure', series: 'a time series', categorical: 'a breakdown by category', rows: 'a list of rows',
  points: 'places with coordinates', status: 'rows with a status', matrix: 'two categories and a measure',
}
const VISUAL_WORDS: Record<string, string> = {
  'stat': 'Stat', 'series': 'Time series', 'breakdown': 'Breakdown', 'table': 'Table',
  'points': 'Map', 'status-list': 'Status list', 'progress': 'Progress', 'heatmap': 'Heatmap',
}

export function widgetIssues(w: WidgetInstance, scope: CatalogScope | null = null): WidgetIssue[] {
  const out: WidgetIssue[] = []
  const err = (message: string) => out.push({ level: 'error', message })
  const warn = (message: string) => out.push({ level: 'warning', message })
  const def = WIDGETS_BY_TYPE[w.type]
  if (!def) {
    err(`Unknown widget type '${w.type}'. Remove it or change its type in the JSON view.`)
    return out
  }
  const config = { ...(def.defaultConfig ?? {}), ...(w.config ?? {}) }

  if (BOUND_TYPES.has(w.type)) {
    const b = bindingOf(config)
    if (!b) { err('No data selected. Pick a source in the Data tab.'); return out }
    const src = SOURCES_BY_ID[b.source]
    if (!src) { err(`Unknown data source '${b.source}'. Nobody will be able to see this widget.`); return out }
    const want = SHAPE_FOR_TYPE[w.type]
    if (want && b.shape !== want) err(`${VISUAL_WORDS[w.type]} needs ${SHAPE_WORDS[want]}, but the data is set up as ${SHAPE_WORDS[b.shape]}.`)
    if (b.shape === 'series' && !b.dimension) err('Pick the time field the series runs along.')
    if (b.shape === 'categorical' && !b.dimension) err('Pick the field to break the measure down by.')
    if (!b.measures.length && !(['rows', 'points', 'status'].includes(b.shape))) err('Pick at least one measure.')
    if (b.shape === 'rows' && !b.measures.length && !b.columns?.length) err('Pick at least one column or measure.')
    if (b.shape === 'points' && (!b.geo?.lat || !b.geo?.lon)) err('Pick the latitude and longitude fields.')
    if (b.shape === 'status' && !b.dimension) err('Pick the field that names each row.')
    if (b.shape === 'status' && !b.status?.field && !b.threshold) warn('No status rule yet - every row shows as Info. Pick a status field or a threshold.')
    if (b.shape === 'matrix' && (!b.dimension || !b.dimension2)) err('Pick the column and row fields.')
    if (w.type === 'progress' && !b.target?.path && b.target?.value == null && b.measures[0]?.unit !== 'pct') warn('No target set - the bar needs one unless the figure is a percentage.')
    if (b.aggregate && b.shape !== 'scalar' && b.shape !== 'rows') {
      if (b.dimension && b.aggregate.by !== b.dimension.key) err('The grouping and the category field differ. Pick the field to break down by again.')
      if (b.aggregate.fn !== 'count' && !b.aggregate.measure) err('Pick the field to sum, average or compare.')
    }
    const limit = (b.params as { limit?: unknown } | undefined)?.limit
    if (isQuerySource(b.source) && typeof limit === 'number' && limit > QUERY_MAX_ROWS) warn(`The server returns at most ${QUERY_MAX_ROWS} records; ${limit} is capped.`)
    if (scope && !sourceInScope(b.source, scope)) err(`${scope.agency} can't open the page this data comes from (${src.label}).`)
    if (src.backend === 'ahead-of-backend') warn(`${src.label} isn't integrated yet - viewers will see "not yet integrated".`)
    return out
  }

  if (w.type === 'kpi') {
    const key = String(config.metricKey ?? '')
    if (!METRICS_BY_KEY[key]) err(key ? `Unknown metric '${key}'.` : 'Pick a metric.')
    else if (!metricInScope(key, scope)) err(`${scope!.agency} can't open the page this metric comes from.`)
  }
  if (w.type === 'kpi-row') {
    const keys = (config.metricKeys as string[] | undefined) ?? []
    if (!keys.length) err('Add at least one metric to the ribbon.')
    const unknown = keys.filter(k => !METRICS_BY_KEY[k])
    if (unknown.length) warn(`Unknown metrics are skipped: ${unknown.join(', ')}.`)
    const outside = keys.filter(k => METRICS_BY_KEY[k] && !metricInScope(k, scope))
    if (outside.length) err(`${scope!.agency} can't open the pages ${outside.length === 1 ? 'one metric comes' : `${outside.length} metrics come`} from.`)
  }
  if (w.type === 'agency-card') {
    const agency = String(config.agency ?? '')
    if (scope && AGENCY_CARD_DOMAINS[agency] && !agencyCardsInScope(scope).includes(agency)) err(`${scope.agency} can't open every page the ${agency} snapshot reads.`)
  }
  if (w.type === 'text' && !String(config.text ?? '').trim()) warn('The text is empty.')
  return out
}

/** Every widget problem on a dashboard, errors first. */
export function dashboardIssues(def: DashboardDefinition, scope: CatalogScope | null = null): DashboardIssue[] {
  const out: DashboardIssue[] = []
  for (const w of def.widgets) {
    const label = w.title || WIDGETS_BY_TYPE[w.type]?.title || w.type
    for (const i of widgetIssues(w, scope)) out.push({ ...i, widgetId: w.id, label })
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))
}

/**
 * The JSON view's Apply: parse, check the stored shape, keep the id, and
 * clamp the box onto the 12-column grid. Content problems (unknown source,
 * missing measure) are left to widgetIssues so they show in the inspector.
 */
export function parseWidgetJson(text: string, id: string): { widget: WidgetInstance } | { error: string } {
  let raw: unknown
  try { raw = JSON.parse(text) } catch (e) {
    return { error: `Not valid JSON: ${e instanceof Error ? e.message : 'parse error'}` }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Expected a JSON object.' }
  const o = raw as Record<string, unknown>
  if (typeof o.type !== 'string' || !o.type) return { error: '"type" must be a widget type, e.g. "series".' }
  for (const k of ['x', 'y', 'w', 'h'] as const) {
    if (!Number.isInteger(o[k])) return { error: `"${k}" must be a whole number (grid units).` }
  }
  if (o.config !== undefined && (typeof o.config !== 'object' || o.config === null || Array.isArray(o.config))) return { error: '"config" must be an object.' }
  if (o.style !== undefined && (typeof o.style !== 'object' || o.style === null || Array.isArray(o.style))) return { error: '"style" must be an object.' }
  if (o.title !== undefined && typeof o.title !== 'string') return { error: '"title" must be text.' }
  const def = WIDGETS_BY_TYPE[o.type]
  const box = clampBox({ id, x: o.x as number, y: o.y as number, w: o.w as number, h: o.h as number }, def?.minSize)
  return { widget: { ...(o as unknown as WidgetInstance), ...box, id } }
}
