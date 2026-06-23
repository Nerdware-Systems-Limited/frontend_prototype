// app/composables/api/useGis.ts
// ─────────────────────────────────────────────────────────────────────
// API client for the GIS / GeoJSON endpoints. These power the
// dedicated Kenya map page and any map overlays on the dashboard.
//
// Each endpoint returns a standard GeoJSON FeatureCollection (or a
// bundle for /map/). The composable just wraps the existing useApi
// helper with typed responses so the page can hand the payload straight
// to <UAPTSMap :boundary=… :roads=… :routes=…>.

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

// ── Composable ────────────────────────────────────────────────────────
export function useGis() {
  const api = useApi()

  /**
   * GET /api/v1/gis/kenya/boundary/
   * Country outline + 8 historical regions + 12 landmarks.
   */
  const kenyaBoundary = () =>
    api<GeoJSONFeatureCollection>('/api/v1/gis/kenya/boundary/')

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
  } = {}) => {
    const query: Record<string, string | number> = {}
    if (params.bbox) query.bbox = params.bbox.join(',')
    if (params.highway) query.highway = params.highway
    if (params.limit) query.limit = params.limit
    if (params.simplify != null) query.simplify = params.simplify
    return api<GeoJSONFeatureCollection>('/api/v1/gis/roads/', { query })
  }

  /**
   * GET /api/v1/gis/routes/?bbox=&service_type=&limit=&simplify=
   * Public transport routes as GeoJSON. Reads live from tbl_pt_routes.
   */
  const routes = (params: {
    bbox?: [number, number, number, number]
    service_type?: string   // csv: "brt,matatu"
    limit?: number
    simplify?: number
  } = {}) => {
    const query: Record<string, string | number> = {}
    if (params.bbox) query.bbox = params.bbox.join(',')
    if (params.service_type) query.service_type = params.service_type
    if (params.limit) query.limit = params.limit
    if (params.simplify != null) query.simplify = params.simplify
    return api<GeoJSONFeatureCollection>('/api/v1/gis/routes/', { query })
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
  } = {}) => {
    const query: Record<string, string | number> = {}
    if (params.include) query.include = params.include
    if (params.limit_roads) query.limit_roads = params.limit_roads
    if (params.limit_routes) query.limit_routes = params.limit_routes
    if (params.bbox) query.bbox = params.bbox.join(',')
    return api<MapOverviewBundle>('/api/v1/gis/map/', { query })
  }

  return { kenyaBoundary, roads, routes, mapOverview }
}