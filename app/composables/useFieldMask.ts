/**
 * useFieldMask - client-side half of RBAC spec section 6 (restricted
 * categories). useAccessControl().resolveRoute(path).deniedCategories
 * already computes WHICH categories are masked for the current viewer on
 * a given route; nothing previously read that list to actually hide a
 * field's value; this closes that gap.
 *
 * Field masking is per-value, not per-route (section 6 intro: masking
 * "never blocks the whole route, only flags fields") - a page calls
 * isMasked()/mask() once per restricted field it renders, using the same
 * category id declared on that route in access-control.json.
 */

import accessControlData from '~/config/access-control.json'
import { useAccessControl } from './useAccessControl'

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries((accessControlData as any).restrictedCategories ?? {}).map(
    ([id, def]) => [id, (def as { label: string }).label],
  ),
)

export function useFieldMask(path: string) {
  const access = useAccessControl()
  const denied = computed(() => new Set(access.resolveRoute(path).deniedCategories))

  function isMasked(category: string): boolean {
    return denied.value.has(category)
  }

  function categoryLabel(category: string): string {
    return CATEGORY_LABELS[category] ?? category
  }

  /** Returns `value` untouched, or `placeholder` when `category` is denied on this route. */
  function mask<T>(category: string, value: T, placeholder = 'Restricted'): T | string {
    return isMasked(category) ? placeholder : value
  }

  return { deniedCategories: denied, isMasked, categoryLabel, mask }
}
