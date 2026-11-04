// tests/fixtures/table-ledger.ts
// ─────────────────────────────────────────────────────────────────────────────
// The ledger behind tests/unit/table-standard.test.ts - the inventory of tables that have NOT yet moved onto the
// universal table (components/DataTable.vue over composables/useServerTable; see docs/data-tables.md).
//
// It is a ratchet: it can only shrink. A file may not be added to it (a new table must use DataTable), and a file
// that no longer matches must be removed from it. Migrating a page = delete its entry here in the same change.
// ─────────────────────────────────────────────────────────────────────────────

export interface LegacyEntry {
  /** `<table>` elements in the file. */
  tables: number
  /** usePagination() calls: tables paged in the browser over rows the page fetched up front. */
  pagers: number
  /** Literal page_size values > 100 in the file: the fetch is bigger than the server's 100-row page (the API client
   *  expands it, up to 500 rows) - anything beyond that is simply not on screen. */
  bigFetch: number[]
}

/** Tables paged in the browser over a one-shot fetch. These can show a truncated dataset: migrate them. */
export const LEGACY_PAGED: Record<string, LegacyEntry> = {
  'components/CertificateExpiryPanel.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/agencies.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/analytics.vue': { tables: 5, pagers: 4, bigFetch: [] },
  'pages/aviation/flights.vue': { tables: 1, pagers: 1, bigFetch: [150] },
  'pages/aviation/index.vue': { tables: 2, pagers: 2, bigFetch: [] },
  'pages/aviation/infrastructure.vue': { tables: 6, pagers: 6, bigFetch: [200] },
  'pages/aviation/licensing.vue': { tables: 3, pagers: 3, bigFetch: [] },
  'pages/aviation/passenger-stats.vue': { tables: 2, pagers: 2, bigFetch: [] },
  'pages/corridor/border-crossings.vue': { tables: 2, pagers: 1, bigFetch: [] },
  'pages/corridor/index.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/fleet/behaviour.vue': { tables: 2, pagers: 2, bigFetch: [150] },
  'pages/fleet/geofences.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/fleet/index.vue': { tables: 2, pagers: 2, bigFetch: [] },
  'pages/fleet/live.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/fleet/trip-playbacks.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/infrastructure/bridges.vue': { tables: 2, pagers: 2, bigFetch: [200] },
  'pages/infrastructure/index.vue': { tables: 4, pagers: 1, bigFetch: [200, 300, 500] },
  'pages/infrastructure/maintenance.vue': { tables: 3, pagers: 3, bigFetch: [] },
  'pages/infrastructure/projects.vue': { tables: 3, pagers: 3, bigFetch: [200] },
  'pages/integrations/analytics.vue': { tables: 3, pagers: 1, bigFetch: [200] },
  'pages/integrations/files/index.vue': { tables: 2, pagers: 1, bigFetch: [] },
  'pages/maritime/accidents.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/maritime/cargo.vue': { tables: 3, pagers: 3, bigFetch: [] },
  'pages/maritime/green-transport.vue': { tables: 4, pagers: 4, bigFetch: [] },
  'pages/maritime/imports-exports.vue': { tables: 2, pagers: 2, bigFetch: [] },
  'pages/maritime/index.vue': { tables: 3, pagers: 3, bigFetch: [] },
  'pages/maritime/infrastructure.vue': { tables: 9, pagers: 9, bigFetch: [200] },
  'pages/maritime/performance.vue': { tables: 3, pagers: 1, bigFetch: [] },
  'pages/maritime/port-ops.vue': { tables: 2, pagers: 2, bigFetch: [] },
  'pages/maritime/services.vue': { tables: 3, pagers: 3, bigFetch: [] },
  'pages/maritime/waterways.vue': { tables: 3, pagers: 3, bigFetch: [] },
  'pages/notifications/rules.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/reports.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/roles.vue': { tables: 3, pagers: 3, bigFetch: [200] },
  'pages/safety/blackspots.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/safety/incidents.vue': { tables: 2, pagers: 2, bigFetch: [] },
  'pages/safety/index.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/safety/kpis.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/traffic/analytics.vue': { tables: 2, pagers: 2, bigFetch: [] },
  'pages/traffic/index.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/training/cohorts.vue': { tables: 2, pagers: 2, bigFetch: [] },
  'pages/training/completions.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/training/enrollments.vue': { tables: 1, pagers: 1, bigFetch: [] },
  'pages/training/index.vue': { tables: 3, pagers: 3, bigFetch: [] },
  'pages/users.vue': { tables: 1, pagers: 1, bigFetch: [] },
}

/** Raw `<table>`s that are not paged in the browser. Not yet assessed one by one: each is either a small fixed table
 *  (fine as it is, move it to STATIC_TABLES with a reason), a dynamic result grid, or a data table to migrate. */
export const UNREVIEWED_TABLES: Record<string, { tables: number; bigFetch: number[] }> = {
  'components/AccessAgencyTab.vue': { tables: 1, bigFetch: [] },
  'components/AccessCategoriesTab.vue': { tables: 1, bigFetch: [] },
  'components/AccessRolesTab.vue': { tables: 2, bigFetch: [200] },
  'components/CorridorKpiScorecard.vue': { tables: 1, bigFetch: [] },
  'components/GisLayersPanel.vue': { tables: 2, bigFetch: [200] },
  'components/SampleGrid.vue': { tables: 1, bigFetch: [] },
  'components/UaptsMap.vue': { tables: 4, bigFetch: [] },
  'components/dashboard/editor/BindingEditor.vue': { tables: 1, bigFetch: [] },
  'components/dashboard/viz/VizTable.vue': { tables: 1, bigFetch: [] },
  'pages/admin/dashboards/index.vue': { tables: 2, bigFetch: [] },
  'pages/audit.vue': { tables: 3, bigFetch: [] },
  'pages/corridor/lapsset.vue': { tables: 1, bigFetch: [] },
  'pages/corridor/transit.vue': { tables: 2, bigFetch: [] },
  'pages/gis/coverage.vue': { tables: 2, bigFetch: [] },
  'pages/gis/layers/[id].vue': { tables: 4, bigFetch: [] },
  'pages/gis/layers/index.vue': { tables: 1, bigFetch: [] },
  'pages/gis/requests.vue': { tables: 1, bigFetch: [] },
  'pages/integrations/feeds/[source_id].vue': { tables: 1, bigFetch: [] },
  'pages/integrations/files/[id].vue': { tables: 2, bigFetch: [] },
  'pages/maritime/overview.vue': { tables: 1, bigFetch: [] },
  'pages/query-builder.vue': { tables: 2, bigFetch: [] },
}

/** Small, fixed tables that legitimately stay plain (a handful of summary rows, not a dataset). Reason required. */
export const STATIC_TABLES: Record<string, string> = {}

/** Files that ask for more than one server page for something that is not a table (a map layer, a chart). */
export const BIG_FETCH_NON_TABLE: Record<string, string> = {
  'pages/infrastructure/funding.vue': 'not a table - [200]',
  'pages/integrations/index.vue': 'not a table - [200]',
}
