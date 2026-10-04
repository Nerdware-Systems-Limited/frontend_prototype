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
import type { ThresholdKey } from '~/utils/thresholds'
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
  }
}

/** The shape a binding produces - and the shape a visual accepts. */
export type FrameShape = 'scalar' | 'series' | 'categorical' | 'rows'

export interface MeasureSpec {
  /** Key in each payload row (or the dot path for a scalar). */
  key: string
  label: string
  unit?: UnitKey
}

export interface Binding {
  /** WidgetSource id, e.g. 'traffic.summary'. */
  source: string
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
}
