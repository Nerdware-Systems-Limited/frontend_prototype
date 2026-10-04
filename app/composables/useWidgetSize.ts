/**
 * Widget size - WidgetFrame measures its body and provides the size; visual
 * primitives read it to pick their form for the cell (docs/Widgets.md §5.7):
 *
 *   xs (<240px)  the headline only - last value, top category, row count
 *   s  (<400px)  a compact form - line without axes, proportion bar, top 3
 *   m  (<640px)  the full chart with axes and a crosshair
 *   l  (640px+)  the full chart plus legend, values and share
 *
 * Outside a frame (tests, standalone use) it falls back to 'm'.
 */
import { computed, inject, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { sizeClassFor, type SizeClass } from '~/utils/viz'

export interface WidgetSize {
  width: Ref<number>
  height: Ref<number>
  sizeClass: ComputedRef<SizeClass>
}

export const WIDGET_SIZE_KEY: InjectionKey<WidgetSize> = Symbol('widget-size')

export function makeWidgetSize(width: Ref<number>, height: Ref<number>): WidgetSize {
  // 0 before the first measurement - treat as 'm' so nothing flashes compact.
  return { width, height, sizeClass: computed(() => (width.value > 0 ? sizeClassFor(width.value) : 'm')) }
}

export function useWidgetSize(): WidgetSize {
  return inject(WIDGET_SIZE_KEY, null) ?? makeWidgetSize(ref(0), ref(0))
}
