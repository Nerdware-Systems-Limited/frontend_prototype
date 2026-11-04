/**
 * Types for the schema-driven server data table (composables/useServerTable + components/DataTable).
 * The schema (an array of TableColumn) is the whole configuration: the engine builds the query from it and the
 * component renders from it - nothing about a particular dataset is hard-coded in either.
 */
export type Row = Record<string, any>

export type CellType = 'text' | 'mono' | 'num' | 'date' | 'datetime' | 'badge' | 'bool' | 'join'

/** The control a column's filter uses. `false` = not filterable. */
export type FilterKind = 'text' | 'select' | 'bool' | 'date' | 'number' | false

export interface TableColumn<T extends Row = Row> {
  /** Row property to display. Also the field name used to sort and filter unless overridden. */
  key: string
  label: string
  type?: CellType
  /** Sortable on the server. `true` sorts by `key`; a string sorts by that field instead. Default: true. */
  sortable?: boolean | string
  /** Column filter control. Default: derived from `type` (text for text/mono, date for date/datetime, ...). */
  filter?: FilterKind
  /** Server field to filter on when it differs from `key`. */
  filterKey?: string
  /** Choices for a `select` filter. */
  options?: Array<{ value: string; label: string }>
  /** `badge` cells: value -> BadgePill variant. */
  badge?: Record<string, string>
  /** `join` cells: row keys joined with a space. */
  join?: string[]
  /** `num` cells: max fraction digits. */
  digits?: number
  /** A computed / custom text for the cell (also used for export). Cannot be sorted or filtered on the server. */
  render?: (row: T) => string
  width?: number
  minWidth?: number
  maxWidth?: number
  /** Stick to the left edge while scrolling sideways. */
  pin?: 'left'
  /** The text to write for this cell in a CSV export, for a column whose cell is built in a slot (a derived
   *  "days left"), without making the column non-sortable the way `render` does. */
  exportAs?: (row: T) => string
  /** Left out of CSV exports (an actions column, a row-open button). */
  noExport?: boolean
  /** Start hidden (the user can show it from the Columns menu). */
  hidden?: boolean
  /** Responsive priority: 1 always shown, 3 first to drop on a narrow screen / card view's detail section. */
  priority?: 1 | 2 | 3
}

export interface SortSpec { key: string; dir: 'asc' | 'desc' }

/** A column filter's value: text / select / bool as a string, a range as {from, to}. */
export type FilterValue = string | { from?: string; to?: string }

export type Density = 'compact' | 'standard' | 'comfortable'

/** A page of results in the shape every list endpoint returns. */
export interface PagedResult<T = Row> {
  count: number
  results: T[]
  total_pages?: number
}

/** Query-string parameters sent to the endpoint. */
export type TableParams = Record<string, string | number>

export interface TableFetchContext { signal: AbortSignal }

export interface ColumnLayout {
  /** Column keys in display order. */
  order: string[]
  hidden: string[]
  widths: Record<string, number>
}

/** What is remembered between visits (per table key). Search text, filters and the page are NOT. */
export interface TablePrefs {
  pageSize: number
  sort: SortSpec[]
  layout: ColumnLayout
  density: Density
}
