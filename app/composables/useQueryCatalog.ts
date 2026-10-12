/**
 * The Query Builder's dataset catalog (/query/datasets/) and saved queries,
 * loaded once per session for the dashboard editor's query picker.
 *
 * Saved queries are only READ here, to copy a definition into a widget's
 * binding - never run: running one triggers its distribution (emails /
 * exports to its recipients).
 */
import { shallowRef } from 'vue'
import { useQuery, type Dataset, type QueryDatasetKey, type SavedQuery } from '~/composables/api'
import type { FieldInfo } from '~/utils/bindingDesign'

const datasets = shallowRef<Partial<Record<QueryDatasetKey, Dataset>> | null>(null)
const saved = shallowRef<SavedQuery[] | null>(null)
const error = shallowRef<string | null>(null)
let loading: Promise<void> | null = null

function load() {
  loading ??= Promise.all([
    useQuery().datasets().then((d) => { datasets.value = d }),
    // Saved queries are a convenience; their absence must not block the picker.
    useQuery().savedList().then((r) => { saved.value = r.results ?? [] }).catch(() => { saved.value = [] }),
  ]).then(() => { error.value = null }).catch((e) => {
    error.value = e instanceof Error ? e.message : "Couldn't load the query datasets"
    loading = null
  })
  return loading
}

/** The catalog refs; nothing is fetched until `ensure()` (only query widgets need it). */
export function useQueryCatalog() {
  return { datasets, saved, error, ensure: load, retry: () => { loading = null; return load() } }
}

/** A dataset field as the binding picker types it. */
export function fieldInfoOf(f: { name: string; type: string }, prefix = ''): FieldInfo {
  const key = prefix ? `${prefix}.${f.name}` : f.name
  if (f.type === 'number') return { key, type: 'number' }
  if (f.type === 'datetime') return { key, type: 'time' }
  return f.type === 'enum' ? { key, type: 'text', category: true } : { key, type: 'text' }
}

/** Test seam: forget what was loaded. */
export function resetQueryCatalog() {
  datasets.value = null
  saved.value = null
  error.value = null
  loading = null
}
