/**
 * Data source registry - every endpoint a dashboard widget can read, as data.
 *
 * Layer 1 of the widget architecture (docs/Widgets.md §5.1): a source says WHERE
 * data comes from and WHAT it honours. Bindings (which part, shaped how) and
 * visuals (how it looks at this size) sit on top and never know the endpoint.
 *
 * Adding a source = one entry here. useWidgetData() handles caching,
 * de-duplication, refresh ticks and honest error states for all of them.
 *
 * HONOURS lists only the filters the endpoint really reads on the UAPTS
 * backend (checked against the view code - see docs/dashboard-manager-
 * integration.md #6). Everything else is dropped before the request and shown
 * as "Not filtered by …" on the widget, so nobody reads unfiltered numbers as
 * filtered ones.
 *
 * PERMISSIONS: DOMAIN_PERMISSIONS must stay identical to backend
 * apps/dashboards/catalog.py DOMAIN_PERMISSIONS - the server strips widgets
 * by these exact strings. Viewers' permissions are derived from module access
 * in useViewerContext (VIEWER_PERMISSION_RULES).
 */
import {
  useSafety, useFleet, useRailway, useAviationMaritime, useInfrastructure,
  useAgencies, useIntegrations, useGis, useTraffic, usePublicTransport,
  useTraining, useAviationInfrastructure, useMaritimeCargo,
} from '~/composables/api'
import type { SummaryFilterParams } from '~/composables/api/_client'
import type { FilterField, FilterValue, WidgetFilterContext } from '~/types/dashboard'
import type { Domain } from '~/utils/metricRegistry'

export const DOMAIN_PERMISSIONS: Record<Domain | 'integrations' | 'gis' | 'traffic' | 'public_transport' | 'training', string> = {
  safety: 'safety.view',
  fleet: 'fleet.view',
  rail: 'railway.view',
  aviation: 'aviation.view',
  maritime: 'maritime.view',
  infra: 'infrastructure.view',
  integrations: 'integrations.view',
  gis: 'gis.view',
  // Added with the generic widgets (Phase 3) - backend catalog.py needs the same codes.
  traffic: 'traffic.view',
  public_transport: 'public_transport.view',
  // M14 Training Institutes - backend catalog.py needs the same code.
  training: 'training.view',
}

/** Module each dashboard permission is earned through (mirrors VIEWER_PERMISSION_RULES). */
export const PERMISSION_MODULE: Record<string, string> = {
  [DOMAIN_PERMISSIONS.safety]: 'M05',
  [DOMAIN_PERMISSIONS.fleet]: 'M03',
  [DOMAIN_PERMISSIONS.rail]: 'M08',
  [DOMAIN_PERMISSIONS.aviation]: 'M07a',
  [DOMAIN_PERMISSIONS.maritime]: 'M07b',
  [DOMAIN_PERMISSIONS.infra]: 'M06',
  [DOMAIN_PERMISSIONS.integrations]: 'M12',
  [DOMAIN_PERMISSIONS.gis]: 'M13',
  [DOMAIN_PERMISSIONS.traffic]: 'M02',
  [DOMAIN_PERMISSIONS.public_transport]: 'M04',
  [DOMAIN_PERMISSIONS.training]: 'M14',
}

/**
 * How data reaches UAPTS (the Kenya transport integration tiers):
 *   live   - REST / streaming feed, refreshed continuously
 *   file   - scheduled file transfer (CSV, batch export), refreshed on a cadence
 *   manual - an agency fills a template; refreshed once per reporting period
 */
export type SourceTier = 'live' | 'file' | 'manual'

export const TIER_LABELS: Record<SourceTier, string> = { live: 'Live', file: 'Batch', manual: 'Manual' }

/**
 * live             - the endpoint is deployed.
 * ahead-of-backend - the UI is built before the endpoint ships; a 404 means
 *                    "not yet integrated", not "broken" (PRODUCT.md principle 5).
 */
export type BackendStatus = 'live' | 'ahead-of-backend'

/** Source-specific request options, e.g. a hotspot limit. Part of the cache key. */
export type SourceOptions = Record<string, string | number | boolean | undefined>

export interface WidgetSource<T = unknown> {
  id: string
  /** Module code, M01-M16 - drives palette grouping. */
  module: string
  /**
   * The page this data comes from. An agency that can open the page may put
   * its data on the agency's dashboards (see utils/agencyCatalog.ts).
   */
  route: string
  label: string
  /** Attribution shown in the widget footer, e.g. "NTSA IRSMS". */
  source: string
  tier: SourceTier
  /** Plain-language refresh cadence, e.g. "Continuous", "Weekly survey". */
  cadence: string
  /** Viewer needs this permission to read it. */
  permission: string
  /** Filters the endpoint really reads. */
  honours: FilterField[]
  backend: BackendStatus
  /** Cache lifetime. Default 60s. */
  ttlMs?: number
  fetch: (params: SummaryFilterParams, options: SourceOptions) => Promise<T>
}

// ── Filter params ────────────────────────────────────────────────────────

/** Query param names each FilterField becomes. */
const PARAM_NAMES: Record<FilterField, (keyof SummaryFilterParams)[]> = {
  date_range: ['date_from', 'date_to'], agency: ['agency'], county: ['county'], road: ['road'],
  severity: ['severity'], vehicle_class: ['vehicle_class'], mode: [],
}

/** A widget's filter context as flat query params (multi-values comma-joined). */
export function filterParams(ctx: WidgetFilterContext): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [field, raw] of Object.entries(ctx) as [string, FilterValue][]) {
    if (raw == null || raw === '' || (Array.isArray(raw) && !raw.length)) continue
    if (field === 'date_range' && typeof raw === 'object' && !Array.isArray(raw)) {
      out.date_from = raw.from
      out.date_to = raw.to
    } else {
      out[field] = Array.isArray(raw) ? raw.join(',') : String(raw)
    }
  }
  return out
}

/** Only the params this source honours. */
export function honouredParams(honours: FilterField[], params: Record<string, string>): SummaryFilterParams {
  const out: SummaryFilterParams = {}
  for (const field of honours) {
    for (const name of PARAM_NAMES[field]) if (params[name]) out[name] = params[name]
  }
  return out
}

// ── Agency code -> UUID (the infrastructure summary filters by UUID) ─────
let agencyIds: Promise<Map<string, string>> | null = null
async function agencyIdFor(code: string): Promise<string> {
  if (code.includes(',')) throw new Error('Infrastructure figures can be filtered by one agency at a time.')
  agencyIds ??= useAgencies().list({ page_size: 200 })
    .then(res => new Map(res.results.map(a => [a.agency_code.toUpperCase(), a.id])))
    .catch((err) => { agencyIds = null; throw err })
  const id = (await agencyIds).get(code.toUpperCase())
  if (!id) throw new Error(`Unknown agency '${code}'.`)
  return id
}

// ── Training rollup ──────────────────────────────────────────────────────
// The server aggregates (GET /training/summary/, one request); each source
// below just picks its slice, in the shape the presets already bind to.
const trainingSummary = (p: SummaryFilterParams) => useTraining().summary(p)

// ── The registry ─────────────────────────────────────────────────────────
export const SOURCES: WidgetSource[] = [
  {
    id: 'safety.summary', route: '/safety', module: 'M05', label: 'Road safety summary', source: 'NTSA IRSMS',
    tier: 'live', cadence: 'Continuous', permission: DOMAIN_PERMISSIONS.safety, honours: [], backend: 'live',
    fetch: p => useSafety().summary(p),
  },
  {
    id: 'fleet.summary', route: '/fleet', module: 'M03', label: 'Fleet summary', source: 'NTSA iTIMS',
    tier: 'live', cadence: 'Continuous', permission: DOMAIN_PERMISSIONS.fleet, honours: [], backend: 'live',
    fetch: p => useFleet().summary(p),
  },
  {
    id: 'rail.summary', route: '/railway', module: 'M08', label: 'Railway summary', source: 'KRC Operations',
    tier: 'live', cadence: 'Continuous', permission: DOMAIN_PERMISSIONS.rail, honours: [], backend: 'live',
    fetch: p => useRailway().summary(p),
  },
  {
    id: 'aviation.summary', route: '/aviation', module: 'M07a', label: 'Aviation summary (7 days)', source: 'KAA / KCAA',
    tier: 'live', cadence: 'Continuous', permission: DOMAIN_PERMISSIONS.aviation, honours: [], backend: 'live',
    fetch: p => useAviationMaritime().aviationSummary(7, p),
  },
  {
    id: 'maritime.ops', route: '/maritime/port-ops', module: 'M07b', label: 'Port operations (30 days)', source: 'KPA Mombasa',
    tier: 'file', cadence: 'Daily port returns', permission: DOMAIN_PERMISSIONS.maritime, honours: [], backend: 'live',
    fetch: p => useAviationMaritime().maritimeOperations(30, p),
  },
  {
    id: 'infra.summary', route: '/infrastructure', module: 'M06', label: 'Road infrastructure summary', source: 'KeNHA / KURA / KeRRA',
    tier: 'file', cadence: 'Condition survey cycle', permission: DOMAIN_PERMISSIONS.infra, honours: ['agency'], backend: 'live',
    fetch: async p => useInfrastructure().summary(p.agency ? { ...p, agency: await agencyIdFor(p.agency) } : p),
  },
  {
    id: 'integrations.feeds', route: '/integrations', module: 'M12', label: 'Integration Hub feeds', source: 'Integration Hub',
    tier: 'live', cadence: 'Continuous', permission: DOMAIN_PERMISSIONS.integrations, honours: ['agency'], backend: 'live',
    // The list filters on agency_code, one agency at a time; with several
    // selected it returns every feed and the widget narrows client-side.
    fetch: async (p) => {
      const agency = p.agency && !p.agency.includes(',') ? { agency_code: p.agency } : {}
      return (await useIntegrations().list({ page_size: 200, ...agency })).results ?? []
    },
  },
  {
    id: 'safety.hotspots', route: '/safety/blackspots', module: 'M16', label: 'Predictive risk hotspots', source: 'UAPTS risk model',
    tier: 'file', cadence: 'Model run', permission: DOMAIN_PERMISSIONS.safety, honours: [], backend: 'live',
    // /predictive-hotspots/ reads only tier / min_score / limit.
    fetch: async (_p, o) => (await useSafety().hotspots({ page_size: Number(o.limit ?? 30) })).results ?? [],
  },
  {
    id: 'safety.top-blackspots', route: '/safety/blackspots', module: 'M05', label: 'Top accident black spots', source: 'NTSA KDE analysis',
    tier: 'file', cadence: 'Periodic clustering run', permission: DOMAIN_PERMISSIONS.safety, honours: [], backend: 'live',
    fetch: async p => (await useSafety().topBlackspots(p)).results ?? [],
  },
  {
    id: 'traffic.summary', route: '/traffic', module: 'M02', label: 'Road traffic summary', source: 'KeNHA ATC / RTMS',
    tier: 'live', cadence: 'Continuous', permission: DOMAIN_PERMISSIONS.traffic, honours: [], backend: 'live',
    fetch: () => useTraffic().summary(),
  },
  {
    id: 'pt.summary', route: '/public-transport', module: 'M04', label: 'Public transport summary', source: 'NaMATA / NTSA',
    tier: 'live', cadence: 'Continuous', permission: DOMAIN_PERMISSIONS.public_transport, honours: [], backend: 'live',
    fetch: () => usePublicTransport().summary(),
  },
  {
    id: 'gis.roads', route: '/gis', module: 'M13', label: 'Road network geometry', source: 'KeNHA road register',
    tier: 'file', cadence: 'Register update', permission: DOMAIN_PERMISSIONS.gis, honours: [], backend: 'live',
    ttlMs: 5 * 60_000,
    fetch: () => useGis().roads({ limit: 300, simplify: 0.02 }),
  },
  {
    id: 'aviation.infra', route: '/aviation/infrastructure', module: 'M07a', label: 'Airport infrastructure', source: 'KAA',
    tier: 'file', cadence: 'Asset register update', permission: DOMAIN_PERMISSIONS.aviation, honours: [], backend: 'live',
    ttlMs: 5 * 60_000,
    fetch: () => useAviationInfrastructure().summary(),
  },
  {
    id: 'maritime.cargo', route: '/maritime/cargo', module: 'M07b', label: 'Port cargo (30 days)', source: 'KPA Mombasa',
    tier: 'file', cadence: 'Daily port returns', permission: DOMAIN_PERMISSIONS.maritime, honours: [], backend: 'live',
    fetch: () => useMaritimeCargo().summary(30),
  },
  {
    id: 'training.overview', route: '/training', module: 'M14', label: 'Training institutes overview', source: 'Training Institutes MIS',
    tier: 'manual', cadence: 'As institutes report', permission: DOMAIN_PERMISSIONS.training, honours: ['agency', 'date_range'], backend: 'live',
    ttlMs: 5 * 60_000,
    fetch: async p => ({ kpis: (await trainingSummary(p)).kpis }),
  },
  {
    id: 'training.enrollment-status', route: '/training/enrollments', module: 'M14', label: 'Enrolments by status', source: 'Training Institutes MIS',
    tier: 'manual', cadence: 'As institutes report', permission: DOMAIN_PERMISSIONS.training, honours: ['agency', 'date_range'], backend: 'live',
    ttlMs: 5 * 60_000,
    fetch: async p => (await trainingSummary(p)).enrollments_by_status,
  },
  {
    id: 'training.outcomes', route: '/training/completions', module: 'M14', label: 'Completions by outcome', source: 'Training Institutes MIS',
    tier: 'manual', cadence: 'As institutes report', permission: DOMAIN_PERMISSIONS.training, honours: ['agency', 'date_range'], backend: 'live',
    ttlMs: 5 * 60_000,
    fetch: async p => (await trainingSummary(p)).completions_by_outcome,
  },
  {
    id: 'training.cohorts', route: '/training/cohorts', module: 'M14', label: 'Running and upcoming cohorts', source: 'Training Institutes MIS',
    tier: 'manual', cadence: 'As institutes report', permission: DOMAIN_PERMISSIONS.training, honours: ['agency'], backend: 'live',
    fetch: async p => (await trainingSummary(p)).cohorts,
  },
  {
    id: 'training.revenue', route: '/training', module: 'M14', label: 'Training revenue', source: 'Training Institutes MIS',
    tier: 'manual', cadence: 'Monthly', permission: DOMAIN_PERMISSIONS.training, honours: ['agency', 'date_range'], backend: 'live',
    ttlMs: 5 * 60_000,
    fetch: async (p) => {
      const r = await trainingSummary(p)
      return { monthly: r.revenue_monthly, by_stream: r.revenue_by_stream }
    },
  },
]

export const SOURCES_BY_ID: Record<string, WidgetSource> = Object.fromEntries(SOURCES.map(s => [s.id, s]))

/** The summary source behind each metric domain. */
export const DOMAIN_SOURCE: Record<Domain, string> = {
  safety: 'safety.summary', fleet: 'fleet.summary', rail: 'rail.summary',
  aviation: 'aviation.summary', maritime: 'maritime.ops', infra: 'infra.summary',
}
