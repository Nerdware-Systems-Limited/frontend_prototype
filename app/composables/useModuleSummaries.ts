/**
 * useModuleSummaries - one headline tile per operational module the viewer can
 * open, built from config/agencyModuleSummary.ts.
 *
 * Shared by the agency workspace and the HQ cross-module summary so both read
 * the same endpoints the same way:
 *  - a tile exists only when the route its data comes from resolves above
 *    "none" for this viewer (not merely the module's best-case scope);
 *  - modules load independently and settle independently: one feed being down
 *    marks that tile "unavailable" and leaves every other tile alone;
 *  - a missing value stays missing (`null`), never becomes 0.
 */
import { ref } from 'vue'
import { agencyModuleSummary, OPERATIONAL_MODULES, type ModuleSummaryEntry } from '~/config/agencyModuleSummary'

export interface ModuleTile {
  moduleId: string
  entry: ModuleSummaryEntry
  scope: 'full' | 'read'
  loading: boolean
  fetchFailed: boolean
  primary: { value: string | number | null; unit?: string }
  secondary: { label: string; value: string | number | null }[]
}

export function useModuleSummaries(opts: { modules?: readonly string[] } = {}) {
  const { resolveRoute } = useAccessControl()
  const loading = ref(true)
  const tiles = ref<ModuleTile[]>([])

  async function load() {
    loading.value = true

    const candidates = OPERATIONAL_MODULES
      .filter(id => !opts.modules || opts.modules.includes(id))
      .map(id => {
        const entry = agencyModuleSummary[id]!
        return { id, entry, scope: resolveRoute(entry.route).scopeLevel }
      })
      .filter(t => t.scope === 'full' || t.scope === 'read')

    const built: ModuleTile[] = candidates.map(({ entry, scope, id }) => ({
      moduleId: id, entry, scope: scope as 'full' | 'read',
      loading: true, fetchFailed: false, primary: { value: null }, secondary: [],
    }))
    tiles.value = built

    // Mutate through `tiles.value[idx]` (the reactive proxy), never the raw `built[idx]`:
    // writing to the raw object bypasses Vue's set trap, so no tile would ever re-render.
    await Promise.allSettled(built.map(async (tile, idx) => {
      const t = tiles.value[idx]!
      try {
        const summary = await tile.entry.fetch()
        const [primaryKpi, ...restKpis] = tile.entry.kpis
        t.primary = { value: primaryKpi!.get(summary), unit: primaryKpi!.unit }
        t.secondary = restKpis.map(k => ({ label: k.label, value: k.get(summary) }))
      } catch {
        t.primary = { value: null }
        t.fetchFailed = true
      } finally {
        t.loading = false
      }
    }))

    loading.value = false
  }

  return { tiles, loading, load }
}
