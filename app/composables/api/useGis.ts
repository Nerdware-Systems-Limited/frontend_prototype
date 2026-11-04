// app/composables/api/useGis.ts
// ─────────────────────────────────────────────────────────────────────
// API client for the GIS / GeoJSON endpoints. These power the
// dedicated Kenya map page and any map overlays on the dashboard.
//
// Each endpoint returns a standard GeoJSON FeatureCollection (or a
// bundle for /map/). The composable just wraps the existing useApi
// helper with typed responses so the page can hand the payload straight
// to <UAPTSMap :boundary=… :roads=… :routes=…>.
//
// All fetch methods share a small in-memory response cache (see
// "Lightweight response cache" below) so re-toggling a layer or
// re-mounting the page doesn't necessarily re-hit the network. Pass
// `force: true` in any method's params to bypass it.

import { useApi } from './_client'

// ── GeoJSON type stubs (subset we render) ──────────────────────────────
export interface GeoJSONFeature {
  type: 'Feature'
  geometry: { type: string; coordinates: any }
  properties: Record<string, any>
}
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
  count?: number
  bbox?: [number, number, number, number]
  filters?: Record<string, any>
  [k: string]: any
}

// ── Map-overview bundle ──────────────────────────────────────────────
export interface MapOverviewBundle {
  type: 'FeatureCollectionBundle'
  bbox: [number, number, number, number]
  boundary?: GeoJSONFeatureCollection
  roads?: GeoJSONFeatureCollection
  routes?: GeoJSONFeatureCollection
  stations?: GeoJSONFeatureCollection
  events?: GeoJSONFeatureCollection
}

// ── Lightweight response cache ──────────────────────────────────────
// GIS payloads (constituency-level boundaries, national route bundles)
// are large enough that re-fetching on every layer toggle or component
// re-mount is wasteful, and the underlying data changes rarely within a
// single session. This is a small in-memory cache keyed by endpoint +
// params, module-scoped so it's shared across every useGis() call site
// (the dashboard overlays and the dedicated map page alike). It holds
// nothing sensitive - these are all public GIS endpoints - and simply
// resets on a full page reload; nothing is persisted to disk/storage.
interface CacheEntry<T> { data: T; expires: number }
const _cache = new Map<string, CacheEntry<unknown>>()
const CACHE_MAX_ENTRIES = 150
// Boundaries are effectively static per session; routes/live bundles
// get a much shorter shelf life since schedules and events move.
const CACHE_TTL_MS = { boundary: 10 * 60_000, roads: 5 * 60_000, routes: 30_000, map: 30_000 } as const

function cacheKey(endpoint: string, query: Record<string, unknown>): string {
  const parts = Object.keys(query)
    .filter(k => query[k] !== undefined && query[k] !== '')
    .sort()
    .map(k => `${k}=${query[k]}`)
  return `${endpoint}?${parts.join('&')}`
}

function cacheGet<T>(key: string): T | undefined {
  const hit = _cache.get(key)
  if (!hit) return undefined
  if (hit.expires < Date.now()) { _cache.delete(key); return undefined }
  return hit.data as T
}

function cacheSet<T>(key: string, data: T, ttlMs: number) {
  // Simple insertion-order eviction so a long-lived session (map left
  // open, lots of panning/filtering) can't grow this unboundedly.
  if (!_cache.has(key) && _cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = _cache.keys().next().value
    if (oldest !== undefined) _cache.delete(oldest)
  }
  _cache.set(key, { data, expires: Date.now() + ttlMs })
}

/** Drops every cached GIS response. Exposed for a "hard refresh" action or after an upstream data fix. */
export function clearGisCache(): void {
  _cache.clear()
}

// ── Composable ────────────────────────────────────────────────────────
export function useGis() {
  const api = useApi()

  /**
   * Static URL to the pre-tiled road network (PMTiles archive).
   *
   * PMTiles are read with HTTP byte-range requests, so whatever serves
   * `tilesBase` MUST answer `Range:` with 206 Partial Content. Production
   * nginx does. In dev the Django backend does too, via core/range_serve.py
   * (django.views.static.serve ignores Range and answers 200 with the whole
   * file, which protomaps-leaflet rejects with "Server returned no
   * content-length header or content-length exceeding request"). Note that
   * `pmtiles serve` is NOT a substitute: it serves Z/X/Y tiles, not the raw
   * archive. Check any host with:
   *   curl -s -o /dev/null -D - -H "Range: bytes=0-1023" <tilesBase>/roads.pmtiles
   * (expect `206` and a `Content-Range` header). Cross-origin tile hosts also
   * need CORS to allow the `Range` header (CORS_ALLOW_HEADERS in settings.py).
   */
  const roadsPmtilesUrl = (path: string = '/roads.pmtiles') => {
    const tilesBase = (useRuntimeConfig().public.tilesBase as string) || 'http://localhost:8081'
    return `${tilesBase}${path}`
  }

  /**
   * Static URL to the pre-tiled rail network (PMTiles archive) - same
   * deal as roadsPmtilesUrl above: served by the dedicated `pmtiles serve`
   * process (go-pmtiles), NOT through Django, since Django/Daphne doesn't
   * honor Range requests for /media/ and PMTiles requires them.
   *
   * File on disk is `rails.pmtiles` (matches the file already built and
   * delivered - see the tippecanoe build script; `--layer=railways` inside
   * it is the vector tile layer name, independent of the archive's own
   * filename). Point `pmtiles serve <dir>` at whatever directory holds
   * both roads.pmtiles and rails.pmtiles - e.g. if that's literally
   * Django's MEDIA_ROOT, the two processes can both read from the same
   * folder on disk without Django ever serving the bytes itself.
   */
  const railsPmtilesUrl = (path: string = '/rails.pmtiles') => {
    const tilesBase = (useRuntimeConfig().public.tilesBase as string) || 'http://localhost:8081'
    return `${tilesBase}${path}`
  }

  /**
   * GET /api/v1/gis/kenya/boundary/?admin_level=
   * Country outline + counties + constituencies.
   * admin_level: 0 = country outline only, 1 = +47 counties (default), 2 = +290 constituencies
   * @param force Skip the cache and re-fetch even if a fresh copy is held.
   */
  const kenyaBoundary = (params: { admin_level?: 0 | 1 | 2; force?: boolean } = {}) => {
    const query: Record<string, number> = {}
    if (params.admin_level != null) query.admin_level = params.admin_level
    const endpoint = '/api/v1/gis/kenya/boundary/'
    const key = cacheKey(endpoint, query)
    if (!params.force) {
      const hit = cacheGet<GeoJSONFeatureCollection>(key)
      if (hit) return Promise.resolve(hit)
    }
    return api<GeoJSONFeatureCollection>(endpoint, { query }).then(data => {
      cacheSet(key, data, CACHE_TTL_MS.boundary)
      return data
    })
  }

  /**
   * GET /api/v1/gis/roads/?bbox=&highway=&limit=&simplify=
   * OSM road network as GeoJSON. Default = trunk/motorway/primary/secondary,
   * capped at 4000 features, simplified 50%.
   */
  const roads = (params: {
    bbox?: [number, number, number, number]   // [S, W, N, E]
    highway?: string     // csv: "motorway,trunk,primary"
    limit?: number
    simplify?: number    // 0..1
    force?: boolean
  } = {}) => {
    const query: Record<string, string | number> = {}
    if (params.bbox) query.bbox = params.bbox.join(',')
    if (params.highway) query.highway = params.highway
    if (params.limit) query.limit = params.limit
    if (params.simplify != null) query.simplify = params.simplify
    const endpoint = '/api/v1/gis/roads/'
    const key = cacheKey(endpoint, query)
    if (!params.force) {
      const hit = cacheGet<GeoJSONFeatureCollection>(key)
      if (hit) return Promise.resolve(hit)
    }
    return api<GeoJSONFeatureCollection>(endpoint, { query }).then(data => {
      cacheSet(key, data, CACHE_TTL_MS.roads)
      return data
    })
  }

  /**
   * GET /api/v1/gis/counties/ - canonical county names for the shared county filter
   * (names only; empty when the kenya-counties reference layer isn't loaded).
   */
  const counties = () => api<{ count: number; results: string[] }>('/api/v1/gis/counties/')

  /**
   * GET /api/v1/gis/routes/?bbox=&service_type=&limit=&simplify=
   * Public transport routes as GeoJSON. Reads live from tbl_pt_routes.
   */
  const routes = (params: {
    bbox?: [number, number, number, number]
    service_type?: string   // csv: "brt,matatu"
    limit?: number
    simplify?: number
    force?: boolean
  } = {}) => {
    const query: Record<string, string | number> = {}
    if (params.bbox) query.bbox = params.bbox.join(',')
    if (params.service_type) query.service_type = params.service_type
    if (params.limit) query.limit = params.limit
    if (params.simplify != null) query.simplify = params.simplify
    const endpoint = '/api/v1/gis/routes/'
    const key = cacheKey(endpoint, query)
    if (!params.force) {
      const hit = cacheGet<GeoJSONFeatureCollection>(key)
      if (hit) return Promise.resolve(hit)
    }
    return api<GeoJSONFeatureCollection>(endpoint, { query }).then(data => {
      cacheSet(key, data, CACHE_TTL_MS.routes)
      return data
    })
  }

  /**
   * GET /api/v1/gis/map/?include=&limit_roads=&limit_routes=
   * Combined bundle: boundary + roads + routes + stations + events in one
   * round-trip. Designed for the initial map load.
   */
  const mapOverview = (params: {
    include?: string           // csv: "boundary,roads,routes,stations,events"
    limit_roads?: number
    limit_routes?: number
    bbox?: [number, number, number, number]
    force?: boolean
  } = {}) => {
    const query: Record<string, string | number> = {}
    if (params.include) query.include = params.include
    if (params.limit_roads) query.limit_roads = params.limit_roads
    if (params.limit_routes) query.limit_routes = params.limit_routes
    if (params.bbox) query.bbox = params.bbox.join(',')
    const endpoint = '/api/v1/gis/map/'
    const key = cacheKey(endpoint, query)
    if (!params.force) {
      const hit = cacheGet<MapOverviewBundle>(key)
      if (hit) return Promise.resolve(hit)
    }
    return api<MapOverviewBundle>(endpoint, { query }).then(data => {
      cacheSet(key, data, CACHE_TTL_MS.map)
      return data
    })
  }

  return { kenyaBoundary, roads, roadsPmtilesUrl, railsPmtilesUrl, routes, mapOverview, counties, clearGisCache }
}