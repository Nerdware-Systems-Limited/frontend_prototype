/**
 * useCounties - the canonical county names for the filter dropdown.
 * Fetched once per session from the cheap names-only endpoint; an empty list
 * (reference layer not loaded, or the call failed) hides the county filter
 * rather than showing a broken one.
 */
import { useGis } from '~/composables/api/useGis'

export function useCounties() {
  const names = useState<string[]>('county-names', () => [])
  const loaded = useState<boolean>('county-names-loaded', () => false)
  const gis = useGis()

  async function load() {
    if (loaded.value) return
    loaded.value = true   // set first so concurrent callers don't double-fetch
    try {
      names.value = (await gis.counties()).results ?? []
    } catch {
      names.value = []
      loaded.value = false // allow a retry on the next mount
    }
  }

  return { names, load }
}
