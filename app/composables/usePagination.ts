import type { ComputedRef, Ref } from 'vue'

/**
 * Client-side pagination over an already-loaded array (the filtered/sorted
 * result, not the raw fetch) - slices it into pages of `pageSize` (default
 * 15, per the site-wide "max 15 rows visible" convention) and exposes the
 * page state a <TablePagination> bar needs.
 *
 * `page` is a writable computed (not a plain ref) that clamps itself to
 * `[1, totalPages]` on every read - this is what makes an out-of-range page
 * (e.g. after a filter shrinks the row count) self-correct without a
 * `watch()`. A `watch()` here would be simpler to read, but it evaluates its
 * source once, synchronously, the moment it's set up (to capture the
 * baseline "old value") - and `source` is frequently a computed defined at
 * the call site from an expression that itself reads a `const` declared
 * further down the same <script setup> block. That eager read would then
 * throw "Cannot access '<name>' before initialization" (TDZ), and where it
 * throws depends on where in the file usePagination() happens to be called
 * relative to its source's own dependencies - a landmine for every call
 * site, not just this one. Computed getters are lazy, so building `page`
 * this way never touches `source.value` until something actually renders
 * `pageRows`/`total`/etc., by which point every top-level const in the
 * component has finished initializing.
 */
export function usePagination<T>(source: Ref<T[]> | ComputedRef<T[]>, pageSize = 15) {
  const rawPage = ref(1)

  const total = computed(() => source.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

  const page = computed<number>({
    get: () => Math.min(Math.max(1, rawPage.value), totalPages.value),
    set: (p) => { rawPage.value = Math.min(Math.max(1, p), totalPages.value) },
  })

  const pageRows = computed(() => {
    const start = (page.value - 1) * pageSize
    return source.value.slice(start, start + pageSize)
  })

  function goTo(p: number) { page.value = p }
  function next() { page.value = page.value + 1 }
  function prev() { page.value = page.value - 1 }

  return { page, total, totalPages, pageRows, goTo, next, prev }
}
