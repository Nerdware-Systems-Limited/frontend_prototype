/**
 * mapBasemap.ts - the single source of truth for how every Leaflet map in
 * the app looks (basemap tiles + marker palette), so UaptsMap, AirportsMap,
 * WaterwaysMap and LiveMap can never drift apart.
 *
 * Basemaps are free, key-less raster sources:
 *   light     - "Streets": Esri World Street Map (roads, labels, places).
 *   dark      - "Night streets": the same street tiles, inverted and toned
 *               down with a CSS filter (class `um-night-tiles`, see map.css),
 *               so there is one tile source and no key. (CARTO's dark tiles
 *               were tried first but now demand an API key.)
 *   satellite - Esri World Imagery.
 * Maps follow the app theme (useTheme) unless a caller pins a basemap.
 */

export type BasemapKey = 'light' | 'dark' | 'satellite'

export interface BasemapSpec {
  url: string
  options: Record<string, any>
}

const ESRI_ATTR = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors'
const STREETS_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'

export const BASEMAP_LABELS: Record<BasemapKey, string> = {
  light: 'Streets',
  dark: 'Night streets',
  satellite: 'Satellite',
}

export const BASEMAP_CATALOG: Record<BasemapKey, BasemapSpec> = {
  light: {
    url: STREETS_URL,
    options: { attribution: ESRI_ATTR, maxZoom: 19, maxNativeZoom: 19 },
  },
  dark: {
    url: STREETS_URL,
    options: { attribution: ESRI_ATTR, maxZoom: 19, maxNativeZoom: 19, className: 'um-night-tiles' },
  },
  satellite: {
    // Esri's free tile endpoint - fine for current traffic. Esri steers
    // high-volume users toward an API-key-gated service; swap this if usage
    // ever grows enough for that to matter.
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community', maxZoom: 19 },
  },
}

export const BASEMAP_ORDER: BasemapKey[] = ['light', 'dark', 'satellite']

/** Marker palette - aligned with the traffic/status tokens in theme.css. */
export type MapColor = 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'purple' | 'gray'

export const MAP_COLORS: Record<MapColor, string> = {
  green: '#1A9C52',
  yellow: '#E6A800',
  red: '#DA3B30',
  orange: '#E06B18',
  blue: '#1F5FB4',
  purple: '#6D53C4',
  gray: '#8593A3',
}

/** Lower = more urgent. Used to sort live feeds and decide draw order. */
export const MAP_COLOR_RANK: Record<MapColor, number> = {
  red: 0, orange: 1, yellow: 2, purple: 3, blue: 4, green: 5, gray: 6,
}

/** Tile layer for a basemap key, falling back to light. */
export function createBasemapLayer(Lc: any, key: BasemapKey): any {
  const spec = BASEMAP_CATALOG[key] ?? BASEMAP_CATALOG.light
  return Lc.tileLayer(spec.url, spec.options)
}

/** Theme-following basemap key (`useTheme().resolved`). */
export function basemapForTheme(theme: 'light' | 'dark'): BasemapKey {
  return theme === 'dark' ? 'dark' : 'light'
}
