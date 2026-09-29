/**
 * Dashboard Manager - shared schema.
 *
 * Tableau mental model -> UAPTS:
 *   Worksheet        -> WidgetDefinition (catalog entry) + WidgetInstance (placed copy)
 *   Dashboard        -> DashboardDefinition (layout + filters + actions)
 *   Filter           -> DashboardFilter, with an explicit `appliesTo` widget list
 *   Dashboard action -> DashboardAction (click on a source widget sets a filter)
 *   Publishing/perms -> DashboardAssignment (who sees which dashboard, and how strongly)
 *
 * The JSON shape below is exactly what the backend stores in
 * DashboardVersion.definition, so the renderer, editor and API agree on one format.
 */

export const GRID_COLUMNS = 12

// ── Scope / audience ────────────────────────────────────────────────────

/**
 * Who a dashboard is assigned to. Resolution goes from most to least specific
 * (see SCOPE_PRECEDENCE); the first published match wins, unless a less
 * specific assignment is `locked`, which stops anything below it overriding it.
 */
export type ScopeType = 'user' | 'role_in_department' | 'department' | 'role' | 'agency' | 'global'

export const SCOPE_PRECEDENCE: ScopeType[] = [
  'user', 'role_in_department', 'department', 'role', 'agency', 'global',
]

export interface DashboardAssignment {
  id: string
  dashboardId: string
  scopeType: ScopeType
  /**
   * user          -> user id
   * role          -> role code, optionally agency-qualified "NTSA:analyst"
   * department    -> "<AGENCY>:<DEPT>"  e.g. "KeNHA:maintenance"
   * role_in_department -> "<AGENCY>:<DEPT>:<ROLE>"
   * agency        -> agency code  e.g. "KPA"
   * global        -> "*"
   */
  scopeValue: string
  /** Tie-break inside the same scope level - higher wins. */
  priority: number
  /** Nothing more specific may replace this dashboard for this audience. */
  locked: boolean
  /** Users in this audience may save a personal copy (hide/move widgets only). */
  allowPersonalization: boolean
  /** Optional date window - e.g. a dashboard for an election-period operation. */
  activeFrom?: string | null
  activeUntil?: string | null
}

/** The viewer, as the resolver sees them. Comes from useAccessControl(). */
export interface ViewerContext {
  userId: string
  agencyCode: string | null
  departmentCode: string | null
  roles: string[]
  permissions: string[]
  isSuperAdmin: boolean
}

// ── Widgets ─────────────────────────────────────────────────────────────

export type WidgetKind =
  | 'kpi'          // single metric -> KpiCard
  | 'kpi-row'      // several metrics in one tile row
  | 'trend'        // time series -> MultiLineChart
  | 'bars'         // daily bars (fatality trend style)
  | 'map'          // UaptsMap with hotspots / black spots
  | 'alerts'       // Active alerts list
  | 'agency-card'  // one agency drill-down card
  | 'feed-health'  // Integration Hub status strip
  | 'text'         // heading / markdown note
  | 'embed'        // an existing full-page section, mounted as-is

export type WidgetCategory = 'KPIs' | 'Charts' | 'Maps' | 'Operations' | 'Agency' | 'Layout'

export interface WidgetSize { w: number; h: number }

/** Catalog entry - the "worksheet" an admin drags onto the canvas. */
export interface WidgetDefinition {
  type: string
  kind: WidgetKind
  title: string
  description: string
  category: WidgetCategory
  defaultSize: WidgetSize
  minSize?: WidgetSize
  /** Any one of these permissions is enough. Empty = visible to anyone with the dashboard. */
  requiredPermissions?: string[]
  /** Restrict to viewers of these agencies (super admins bypass). */
  agencies?: string[]
  /** Filter fields this widget can honour. Filters on other fields are ignored for it. */
  filterFields?: FilterField[]
  /** Fields a click on this widget can emit for a dashboard action. */
  emits?: FilterField[]
  /** Default config, merged under the instance's own config. */
  defaultConfig?: Record<string, unknown>
}

export interface WidgetStyle {
  /** Show / hide the frame title bar. */
  showTitle?: boolean
  background?: 'surface' | 'sunken' | 'transparent'
  border?: boolean
  padding?: 'none' | 'compact' | 'normal'
  /** Accent rule along the top edge. */
  accent?: 'none' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

/** A placed widget on a dashboard. */
export interface WidgetInstance {
  id: string
  type: string
  title?: string
  /** 0-based grid coordinates. x + w <= GRID_COLUMNS. h is in row units. */
  x: number
  y: number
  w: number
  h: number
  config?: Record<string, unknown>
  style?: WidgetStyle
  /** Hidden in this layout but kept (used by personal overrides). */
  hidden?: boolean
}

// ── Filters & actions ───────────────────────────────────────────────────

export type FilterField = 'date_range' | 'agency' | 'county' | 'road' | 'mode' | 'severity' | 'vehicle_class'

export interface FilterOption { value: string; label: string }

export interface DashboardFilter {
  id: string
  field: FilterField
  label: string
  control: 'select' | 'multiselect' | 'daterange' | 'segmented'
  /** Static options; when absent the filter bar loads them from the field's option source. */
  options?: FilterOption[]
  defaultValue?: string | string[] | null
  /** 'all' = every widget whose definition supports the field. Otherwise explicit widget ids. */
  appliesTo: 'all' | string[]
  /** Pin the value for this audience - shown but not editable (e.g. KPA users fixed to KPA). */
  locked?: boolean
  /** Fill from the viewer's own context, e.g. agency -> viewer.agencyCode. */
  bindToViewer?: 'agency' | 'department' | null
}

export type ActionType = 'filter' | 'highlight' | 'navigate'

export interface DashboardAction {
  id: string
  name: string
  type: ActionType
  /** Widget the user clicks. */
  sourceWidgetId: string
  /** Field emitted by the click (must be in the source definition's `emits`). */
  field: FilterField
  /** filter/highlight: widgets that react. navigate: ignored. */
  targetWidgetIds: 'all' | string[]
  /** navigate: route template, e.g. "/safety/incidents?county={value}" */
  urlTemplate?: string
  /** What clearing the selection does. */
  onClear: 'show-all' | 'keep'
}

// ── Dashboard ───────────────────────────────────────────────────────────

export interface DashboardTheme {
  density: 'comfortable' | 'compact'
  /** Row height in px for one grid row unit. */
  rowHeight: number
  gap: number
}

export interface DashboardDefinition {
  schemaVersion: 1
  title: string
  subtitle?: string
  theme: DashboardTheme
  widgets: WidgetInstance[]
  filters: DashboardFilter[]
  actions: DashboardAction[]
  /** Seconds. 0 disables auto refresh. */
  refreshInterval: number
}

export type DashboardStatus = 'draft' | 'published' | 'archived'

export interface DashboardSummary {
  id: string
  slug: string
  name: string
  description: string
  ownerAgency: string | null
  status: DashboardStatus
  publishedVersion: number | null
  draftVersion: number
  updatedAt: string
  updatedBy: string
  assignments: DashboardAssignment[]
  isSystem: boolean
}

export interface DashboardRecord extends DashboardSummary {
  /** The draft for editors; the published definition for viewers. */
  definition: DashboardDefinition
}

/** What GET /dashboards/resolve returns for the current viewer. */
export interface ResolvedDashboard {
  dashboard: DashboardRecord
  /** The assignment that won, for the "why am I seeing this?" affordance. */
  matchedAssignment: DashboardAssignment | null
  /** Personal layout override, already merged into dashboard.definition. */
  personalized: boolean
  canPersonalize: boolean
  /** Widget ids the server removed because the viewer lacks permission. */
  strippedWidgetIds: string[]
}

// ── Runtime filter state ────────────────────────────────────────────────

export type FilterValue = string | string[] | { from: string; to: string } | null

/** field -> value, already scoped per widget by the filter engine. */
export type WidgetFilterContext = Partial<Record<FilterField, FilterValue>>

export function emptyDefinition(title = 'Untitled dashboard'): DashboardDefinition {
  return {
    schemaVersion: 1,
    title,
    theme: { density: 'comfortable', rowHeight: 76, gap: 8 },
    widgets: [],
    filters: [],
    actions: [],
    refreshInterval: 120,
  }
}
