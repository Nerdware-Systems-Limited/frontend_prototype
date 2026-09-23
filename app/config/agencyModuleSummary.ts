/**
 * agencyModuleSummary - module -> composable -> headline KPI mapping for
 * AgencyCommandCentre.vue. Only "operational" modules are listed (ones
 * with a natural single-number KPI, e.g. a fatality count) - utility
 * modules (M01 Command Centre, M09 Reporting, M10 Access Control, M11
 * Notifications, M12 Integration Hub, M13 GIS) surface only as quick
 * links, not KPI tiles, per the design spec.
 *
 * Every `fetch` call reuses a composable an existing domain page already
 * calls - no new backend endpoints. `get(summary)` reads one field off
 * that already-typed response; returning `null` renders the tile's
 * honest "NO DATA" state (KpiCard's `unavailable` prop), never a
 * fabricated number.
 */

import {
  useTraffic, useFleet, usePublicTransport, useSafety, useInfrastructure,
  useAviationInfrastructure, useMaritimeCargo, useRailway,
} from '~/composables/api'

export interface ModuleSummaryKpi {
  label: string
  get: (summary: any) => string | number | null
  unit?: string
}

export interface ModuleSummaryEntry {
  label: string
  /** The route this fetch's data actually backs - RBAC-gates the tile on this route's own resolved scope, not the module's best-case scope across all its routes (see AgencyCommandCentre.vue's Critical-finding fix). */
  route: string
  /** Time window the primary (first) KPI covers - passed straight to KpiCard's `period` prop. */
  period: string
  fetch: () => Promise<any>
  kpis: ModuleSummaryKpi[]
}

export const OPERATIONAL_MODULES = [
  'M02', 'M03', 'M04', 'M05', 'M06', 'M07a', 'M07b', 'M08',
] as const

/** Utility modules with no natural single-number KPI - quick-links only, never a tile. Exists so the completeness test can assert every real module in access-control.json is accounted for one way or the other. */
export const NON_OPERATIONAL_MODULES = ['M01', 'M09', 'M10', 'M11', 'M12', 'M13', 'M14'] as const

export const agencyModuleSummary: Record<string, ModuleSummaryEntry> = {
  M02: {
    label: 'Road Traffic',
    route: '/traffic',
    period: 'LIVE',
    fetch: () => useTraffic().summary(),
    kpis: [
      { label: 'Active congestion events', get: s => s?.kpis?.active_congestion_events ?? null },
      { label: 'Avg speed (24h)', get: s => s?.kpis?.avg_speed_24h_kmh ?? null, unit: 'km/h' },
      { label: 'Volume (24h)', get: s => s?.kpis?.total_volume_24h ?? null },
    ],
  },
  M03: {
    label: 'Fleet & Vehicle Tracking',
    route: '/fleet',
    period: 'LIVE',
    fetch: () => useFleet().summary(),
    kpis: [
      { label: 'Live vehicles', get: s => s?.kpis?.live_vehicles ?? null },
      { label: 'Trips (7d)', get: s => s?.kpis?.trips_7d ?? null },
      { label: 'Distance (7d)', get: s => s?.kpis?.distance_7d_km ?? null, unit: 'km' },
    ],
  },
  M04: {
    label: 'Public Transport',
    route: '/public-transport',
    period: 'LIVE',
    fetch: () => usePublicTransport().summary(),
    kpis: [
      { label: 'Active SACCOs', get: s => (s?.kpis?.active_saccos != null && s?.kpis?.total_saccos != null) ? `${s.kpis.active_saccos}/${s.kpis.total_saccos}` : null },
      { label: 'Active routes', get: s => s?.kpis?.active_routes ?? null },
      { label: 'Passenger trips (24h)', get: s => s?.kpis?.passenger_trips_24h ?? null },
    ],
  },
  M05: {
    label: 'Safety & Incidents',
    route: '/safety',
    period: 'LIVE',
    fetch: () => useSafety().summary(),
    kpis: [
      { label: 'Active incidents', get: s => s?.kpis?.active ?? null },
      { label: 'Fatalities (30d)', get: s => s?.kpis?.fatal_30d ?? null },
      { label: 'Incidents (7d)', get: s => s?.kpis?.total_7d ?? null },
    ],
  },
  M06: {
    label: 'Road Infrastructure',
    route: '/infrastructure',
    period: 'LATEST',
    fetch: () => useInfrastructure().summary(),
    kpis: [
      { label: 'Avg IRI', get: s => s?.network?.iri_average ?? null },
      { label: 'Avg PCI', get: s => s?.network?.pci_average ?? null },
      { label: 'Network length', get: s => s?.network?.total_length_km ?? null, unit: 'km' },
    ],
  },
  M07a: {
    label: 'Aviation',
    route: '/aviation/infrastructure',
    period: 'LIVE',
    fetch: () => useAviationInfrastructure().summary(),
    kpis: [
      { label: 'Runway availability', get: s => s?.kpis?.runway_availability_pct ?? null, unit: '%' },
      { label: 'ATC infra health', get: s => s?.kpis?.atc_infra_health_pct ?? null, unit: '%' },
      { label: 'Open work orders', get: s => s?.kpis?.open_work_orders ?? null },
    ],
  },
  M07b: {
    label: 'Maritime',
    route: '/maritime/cargo',
    period: '30D',
    fetch: () => useMaritimeCargo().summary(),
    kpis: [
      { label: 'Cargo tonnes (30d)', get: s => Array.isArray(s?.ports) ? s.ports.reduce((sum: number, p: any) => sum + (p.cargo_tonnes ?? 0), 0) : null },
      { label: 'Cargo TEU (30d)', get: s => Array.isArray(s?.ports) ? s.ports.reduce((sum: number, p: any) => sum + (p.cargo_teu ?? 0), 0) : null },
    ],
  },
  M08: {
    label: 'Railway',
    route: '/railway',
    period: 'LIVE',
    fetch: () => useRailway().summary(),
    kpis: [
      { label: 'Trains in service', get: s => s?.kpis?.trains_in_service ?? null },
      { label: 'Freight shipments (30d)', get: s => s?.kpis?.freight_30d_shipments ?? null },
      { label: 'Passenger bookings (30d)', get: s => s?.kpis?.passenger_bookings_30d ?? null },
    ],
  },
}
