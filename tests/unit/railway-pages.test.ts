// tests/unit/railway-pages.test.ts
// The railway pages on the universal table: every table, KPI and roll-up asks the server for the GLOBAL county and period
// (preset or calendar range), and the page renders with the contract's payloads.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import DataTable from '~/components/DataTable.vue'
import { useGlobalScope } from '~/composables/useGlobalScope'
import { useTimeRange } from '~/composables/useTimeRange'
import { withModuleCounty } from '~/utils/scopeRoutes'
import RailIndex from '~/pages/railway/index.vue'
import RailFreight from '~/pages/railway/freight.vue'
import RailInfrastructure from '~/pages/railway/infrastructure.vue'
import RailLive from '~/pages/railway/live.vue'
import RailInventory from '~/pages/railway/network-inventory.vue'
import RailSafety from '~/pages/railway/safety.vue'
import RailSchedules from '~/pages/railway/schedules.vue'

let $api: ReturnType<typeof vi.fn>
const RAIL = '/api/v1/railway'

/** A permissive fake of the railway API: list endpoints honour the contract's shape; the few roll-ups return their own shapes. */
function fakeApi(path: string, o: any = {}) {
  const q = o.query ?? {}
  const row = (i: number) => ({ id: `r${i}`, code: `C${i}`, name: `Row ${i}`, unit_id: `U${i}`, status: 'in_service', network: i % 2 ? 'sgr' : 'mgr', train_type: 'sgr_express', gauge: 'standard', schedule_train_number: `T${i}`, origin_code: 'NBO', destination_code: 'MSA', delay_arrival_min: i, delay_departure_min: 0, tonnage: 10, revenue_kes: '100', budget_kes: '1000', spent_kes: '10', progress_pct: 10, risk_rating: 'high', protection_type: 'gate', near_miss_count: i, incident_ref: `I${i}`, severity: 'minor', incident_type: 'collision', occurred_at: '2026-10-05T10:00:00Z', casualties: 0, track_condition: 'poor', condition: 'poor', length_km: 10, line_name: 'Line', manifest_ref: `M${i}`, cargo_type: 'container', wagon_count: 3, dispatched_at: '2026-10-05T10:00:00Z', service_date: '2026-10-05', departure_time: '08:00', arrival_time: '14:00', is_active: true })
  if (path === `${RAIL}/summary/`) return { kpis: { sgr_lines: 1, mgr_lines: 1, total_lines: 2, trains_in_service: 1, total_trains: 2, operations_24h: 3, passenger_bookings_30d: 10, freight_30d_shipments: 4, open_incidents: 1 }, on_time_30d: { on_time_pct: 90, avg_delay_min: 2, total_operations: 5, cancelled: 0 }, ridership_30d: { bookings: 1, passengers: 1, revenue_kes: 1, no_show_rate_pct: 0 }, freight_30d: { shipments: 1, total_tons: 1, total_revenue_kes: 1, top_corridors: [] }, incidents_90d: { total: 0, fatal: 0, casualties: 0, level_crossing: 0 }, top_routes: [], live_operations: [] }
  if (path.endsWith('/on-time-stats/')) return { on_time_pct: 88, total_operations: 10, delayed: 2, cancelled: 1, avg_delay_min: 4, cancellation_pct: 10, days: 31 }
  if (path.endsWith('/by-corridor/') || path.endsWith('/by-route/')) return { count: 0, results: [] }
  if (path.endsWith('/trend/')) return { bucket: 'day', results: [{ bucket: '2026-10-05', total: 2 }] }
  if (path.endsWith('/operations/live/')) return []
  if (path.includes('/geojson/')) return { type: 'FeatureCollection', features: [], count: 0 }
  const size = Number(q.page_size ?? 20)
  const out: any = { count: 3, results: Array.from({ length: Math.min(size, 3) }, (_, i) => row(i)) }
  if (q.aggregate) out.aggregates = Object.fromEntries(String(q.aggregate).split(',').map(s => [s, 5]))
  if (q.group_by) out.groups = Object.fromEntries(String(q.group_by).split(',').map(c => [c, [{ value: 'sgr', count: 2 }, { value: 'mgr', count: 1 }]]))
  return out
}

const stubs = {
  PageHeader: { template: '<header><slot name="actions" /></header>' }, SectionTitle: { template: '<h3><slot /></h3>' },
  KpiCard: { props: ['label', 'value'], template: '<div class="kpi" :data-label="label">{{ value }}</div>' }, ScopeBar: true, NuxtLink: true,
  BadgePill: { template: '<span><slot /></span>' }, AlertItem: { props: ['title'], template: '<div class="alert-item">{{ title }}</div>' },
  EmptyState: { template: '<p />' }, CollapsibleSection: { template: '<section><slot /></section>' }, ClientOnly: { template: '<div><slot /></div>' },
  UaptsMap: true, TrendLineChart: true, StationActivityPanel: true,
}

beforeEach(() => {
  localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T09:00:00Z'))
  // What plugins/api.ts does for every GET under a module prefix: add the module's county unless the caller set one.
  $api = vi.fn(async (path: string, o: any) => fakeApi(path, o))
  const inner = $api
  ;(globalThis as any).useNuxtApp = () => ({ $api: (path: string, o: any = {}) => inner(path, withModuleCounty(path, o, useGlobalScope().county.value)) })
  const store = new Map<string, any>()
  ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
  ;(globalThis as any).usePermissions = () => ({ hasMinRole: () => true, hasCapability: () => true })
  ;(globalThis as any).definePageMeta = () => {}
  Object.assign(globalThis as any, { onMounted, onUnmounted, watch, computed, ref, useTimeRange })
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as any
})
afterEach(() => vi.useRealTimers())

const railCalls = () => $api.mock.calls.filter(c => String(c[0]).startsWith(RAIL)).map(c => ({ path: String(c[0]), q: c[1]?.query ?? {} }))
async function mountPage(C: any) {
  const w = mount(C, { global: { stubs, components: { DataTable } } })
  await vi.advanceTimersByTimeAsync(0); await flushPromises(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
  return w
}
const setGlobal = () => {
  const g = useGlobalScope()
  g.setCounty('Mombasa'); g.setRange({ mode: 'custom', year: 2026, from: '2026-10-01', to: '2026-10-31' } as any)
}

const PAGES: { name: string; page: any; period: (c: { path: string; q: Record<string, any> }) => boolean }[] = [
  { name: 'index', page: RailIndex, period: c => c.path === `${RAIL}/summary/` || c.path.endsWith('/on-time-stats/') },
  { name: 'freight', page: RailFreight, period: c => c.path.startsWith(`${RAIL}/freight/`) },
  { name: 'schedules', page: RailSchedules, period: c => c.path.endsWith('/on-time-stats/') || c.path.endsWith('/by-route/') || (c.path === `${RAIL}/operations/`) },
  { name: 'safety', page: RailSafety, period: c => c.path.startsWith(`${RAIL}/incidents/`) && !c.q['f.status__in'] && !c.q['f.severity__in'] },
  { name: 'network-inventory', page: RailInventory, period: c => [`${RAIL}/operations/`, `${RAIL}/tickets/`, `${RAIL}/freight/`].includes(c.path) },
  { name: 'infrastructure', page: RailInfrastructure, period: () => false },
  { name: 'live', page: RailLive, period: () => false },
]

describe.each(PAGES)('railway/$name follows the global filters', ({ page, period }) => {
  it('renders, and every request carries the global county', async () => {
    setGlobal()
    const w = await mountPage(page)
    expect(w.html().length).toBeGreaterThan(100)
    const rail = railCalls()
    expect(rail.length).toBeGreaterThan(2)
    for (const c of rail) expect(c.q.county, `${c.path} ${JSON.stringify(c.q)}`).toBe('Mombasa')
  })

  it('the period-bound requests carry the calendar range, not a rolling window', async () => {
    setGlobal()
    await mountPage(page)
    const bound = railCalls().filter(period)
    for (const c of bound) {
      expect(c.q.date_from, `${c.path} ${JSON.stringify(c.q)}`).toBe('2026-10-01')
      expect(c.q.date_to).toBe('2026-10-31')
      expect(c.q.days).toBeUndefined()
    }
    if (page !== RailInfrastructure && page !== RailLive) expect(bound.length).toBeGreaterThan(0)
  })

  it('a county change refetches', async () => {
    const w = await mountPage(page)
    $api.mockClear()
    useGlobalScope().setCounty('Kisumu'); await vi.advanceTimersByTimeAsync(400); await flushPromises()
    const rail = railCalls()
    expect(rail.length).toBeGreaterThan(0)
    for (const c of rail) expect(c.q.county).toBe('Kisumu')
    w.unmount()
  })
})
