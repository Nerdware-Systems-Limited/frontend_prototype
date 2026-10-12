/**
 * Frame & Binding - layer 2 of the widget architecture (docs/Widgets.md §5.1).
 *
 *   Data source (where)  ->  Binding (which part, shaped how)  ->  Frame  ->  Visual
 *
 * A Frame is the one shape every visual primitive draws. A Binding is stored
 * in a widget's config and says how to cut a Frame out of a source payload,
 * so one generic "breakdown" widget can show vehicle classes, payment
 * channels or incident severities without a new component.
 */
import type { FilterField } from '~/types/dashboard'
import type { Status, ThresholdKey } from '~/utils/thresholds'
import type { UnitKey } from '~/utils/units'

export type FieldKind = 'time' | 'category' | 'measure' | 'text'

export interface FrameField {
  key: string
  label: string
  kind: FieldKind
  /** Measures only - how values format. */
  unit?: UnitKey
}

export interface Frame {
  fields: FrameField[]
  rows: Record<string, unknown>[]
  meta: {
    /** Rows folded into "Other" by a top-N limit. */
    folded?: number
    /** Total rows before any limit. */
    total: number
    /**
     * Set when an aggregate was computed from only part of the records
     * (a query source returns at most 500): the figures cover `count` of
     * `total` records, and the widget says so.
     */
    partial?: { count: number; total: number }
    /** points: rows left off the map because they have no usable coordinates. */
    unplaced?: number
    /** status: how many rows carry each status, counted before any row limit. */
    statusCounts?: Partial<Record<Status, number>>
  }
}

/**
 * The shape a binding produces - and the shape a visual accepts.
 *   points - rows with coordinates (Points map)
 *   status - rows ranked worst status first (StatusList)
 *   matrix - two categories x one measure (Heatmap)
 * Progress draws a 'scalar' with a target.
 */
export type FrameShape = 'scalar' | 'series' | 'categorical' | 'rows' | 'points' | 'status' | 'matrix'

export interface MeasureSpec {
  /** Key in each payload row (or the dot path for a scalar). */
  key: string
  label: string
  unit?: UnitKey
}

export type AggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max'
/**
 * hour / day / week / month: points in time, in East Africa Time.
 * hourOfDay / dayOfWeek: the time of day and weekday, for heatmaps.
 */
export type TimeBucket = 'hour' | 'day' | 'week' | 'month' | 'hourOfDay' | 'dayOfWeek'

/**
 * Group raw records and compute one figure per group - what turns a list of
 * incidents into "incidents by severity". The result rows are
 * `{ [by]: group, value: figure }`, so the binding's dimension is `by` and its
 * one measure has key 'value'.
 */
export interface Aggregate {
  by: string
  fn: AggregateFn
  /** The field summed / averaged / …; not used by 'count'. */
  measure?: string
  /** Time dimensions: group timestamps into hours, days, weeks or months. */
  bucket?: TimeBucket
  /** matrix: a second grouping (the heatmap's rows); `by` is its columns. */
  by2?: string
  bucket2?: TimeBucket
}

export interface Binding {
  /** WidgetSource id, e.g. 'traffic.summary'. */
  source: string
  /**
   * Request parameters the source needs (query sources: dataset fields,
   * filters, sort, limit). Part of the request cache key.
   */
  params?: Record<string, unknown>
  /** Group the rows at `path` before shaping them. */
  aggregate?: Aggregate
  shape: FrameShape
  /**
   * Dot path into the payload. Arrays of rows for series/categorical/rows;
   * a number for scalar; a Record<string, number> is also accepted for
   * categorical ("congestion_distribution": { low: 3, high: 1 }).
   */
  path: string
  /** series: the x (time) key in each row. categorical: the category key. */
  dimension?: { key: string; label: string; kind?: 'time' | 'category' }
  /** One or more measures. Scalar uses measures[0] with key = path. */
  measures: MeasureSpec[]
  /** rows: extra text columns to show. */
  columns?: { key: string; label: string }[]
  sort?: { key: string; dir: 'asc' | 'desc' }
  /** Top-N; for categorical the remainder folds into "Other". */
  limit?: number
  /** Scalar / categorical status. */
  threshold?: ThresholdKey
  /** A click on a category emits this dashboard filter field. */
  emits?: FilterField
  /** points: which fields hold the coordinates, the marker key (emitted on click) and its tier. */
  geo?: { lat: string; lon: string; key?: string; tier?: string }
  /**
   * status: where each row's status comes from - a field's value mapped to a
   * status, or the binding's `threshold` applied to measures[0].
   */
  status?: { field?: string; map?: Record<string, Status> }
  /** status: route each row opens, with {key} replaced by the row's dimension value. */
  link?: string
  /** Progress: the target the value is measured against - a fixed number or another figure in the payload. */
  target?: { value?: number; path?: string; label?: string }
  /** matrix: the heatmap's row dimension (the column dimension is `dimension`). */
  dimension2?: { key: string; label: string }
}
