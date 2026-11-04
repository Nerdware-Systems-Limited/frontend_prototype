// tests/unit/page-expand.test.ts
// page_size > 100 used to silently return 100 rows. It now returns what was asked for (up to a ceiling).
import { describe, it, expect, vi } from 'vitest'
import { EXPAND_ROW_CAP, expandPaged, pageRequest, wantedRows } from '~/utils/pageExpand'

const server = (total: number) => vi.fn(async (_path: string, o: any) => {
  const page = Number(o.query.page), size = Number(o.query.page_size)
  expect(size).toBeLessThanOrEqual(100)                                   // the server would never see more than its cap
  const start = (page - 1) * size
  return { count: total, page, page_size: size, total_pages: Math.ceil(total / size), next: start + size < total ? 'next-url' : null,
    results: Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, i) => ({ id: start + i })) }
})

describe('wantedRows', () => {
  it('only acts on a request bigger than one server page', () => {
    expect(wantedRows('/x/', { page_size: 200 })).toBe(200)
    expect(wantedRows('/x/', { page_size: '300' })).toBe(300)
    expect(wantedRows('/x/?page_size=150', undefined)).toBe(150)
    for (const q of [{ page_size: 100 }, { page_size: 25 }, {}, { page_size: 'lots' }]) expect(wantedRows('/x/', q)).toBeNull()
  })
  it('caps the ceiling', () => expect(wantedRows('/x/', { page_size: 5000 })).toBe(EXPAND_ROW_CAP))
  it('leaves a caller that pages for itself alone', () => {
    expect(wantedRows('/x/', { page_size: 200, page: 2 })).toBeNull()
    expect(wantedRows('/x/?page=3&page_size=200', undefined)).toBeNull()
    expect(wantedRows('/x/', { page_size: 200, page: 1 })).toBe(200)
  })
})

describe('pageRequest', () => {
  it('moves page and page_size from the URL into the query', () => {
    expect(pageRequest('/x/?a=1&page_size=200&page=1', { query: { b: 2 } }, 3, 100)).toEqual({ path: '/x/?a=1', options: { query: { b: 2, page: 3, page_size: 100 } } })
    expect(pageRequest('/x/?page_size=200', {}, 2, 100)).toEqual({ path: '/x/', options: { query: { page: 2, page_size: 100 } } })
  })
})

describe('expandPaged', () => {
  it('returns every row asked for, in order, as ONE response', async () => {
    const fetchOne = server(640)
    const res: any = await expandPaged('/x/', { query: { page_size: 250 } }, 250, fetchOne)
    expect(res.results).toHaveLength(250)
    expect(res.results.map((r: any) => r.id)).toEqual(Array.from({ length: 250 }, (_, i) => i))
    expect(res.count).toBe(640)                                          // the real total is preserved for the caller
    expect(res.page_size).toBe(250)
    expect(fetchOne).toHaveBeenCalledTimes(3)                            // 100 + 100 + 100, the last page trimmed to 50
  })

  it('does not over-fetch when the dataset is smaller than the request', async () => {
    const fetchOne = server(130)
    const res: any = await expandPaged('/x/', { query: { page_size: 500 } }, 500, fetchOne)
    expect(res.results).toHaveLength(130)
    expect(fetchOne).toHaveBeenCalledTimes(2)
    expect(res.next).toBeNull()
  })

  it('a small dataset costs a single request', async () => {
    const fetchOne = server(40)
    const res: any = await expandPaged('/x/', { query: { page_size: 200 } }, 200, fetchOne)
    expect(res.results).toHaveLength(40)
    expect(fetchOne).toHaveBeenCalledTimes(1)
  })

  it('says there is more when the ceiling cut it short', async () => {
    const res: any = await expandPaged('/x/', { query: { page_size: 500 } }, 500, server(5000))
    expect(res.results).toHaveLength(500)
    expect(res.count).toBe(5000)
    expect(res.next).toBe('next-url')
  })

  it('passes a response that is not a paged list straight through', async () => {
    const summary = { kpis: { a: 1 } }
    expect(await expandPaged('/x/', { query: { page_size: 200 } }, 200, async () => summary)).toBe(summary)
    const bare = [{ id: 1 }]
    expect(await expandPaged('/x/', { query: { page_size: 200 } }, 200, async () => bare as any)).toBe(bare)
  })

  it('an error on any page rejects the whole request', async () => {
    const fetchOne = vi.fn(async (_p: string, o: any) => { if (o.query.page === 2) throw new Error('boom'); return { count: 400, results: [{ id: 1 }] } })
    await expect(expandPaged('/x/', { query: { page_size: 300 } }, 300, fetchOne)).rejects.toThrow('boom')
  })
})
