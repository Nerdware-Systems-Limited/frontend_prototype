// tests/unit/migrated-pages.test.ts
// Pages that moved onto the universal table (DataTable + useServerTable): right requests, real counts, and the
// behaviour they had before still works.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, onMounted, onUnmounted, watch } from 'vue'
import VesselsPage from '~/pages/maritime/vessels.vue'
import DataTable from '~/components/DataTable.vue'
import { useGlobalScope } from '~/composables/useGlobalScope'
import { useTimeRange } from '~/composables/useTimeRange'

let $api: ReturnType<typeof vi.fn>
const VESSELS = '/api/v1/aviation-maritime/maritime/vessels/'
const MOVES = '/api/v1/aviation-maritime/maritime/vessel-movements/'

const vessel = (i: number) => ({ id: `v${i}`, vessel_name: `MV Test ${i}`, imo_number: `IMO${i}`, mmsi: `MM${i}`, vessel_type: 'container', flag_state: 'KE',
  gross_tonnage: 1000 + i, deadweight_tonnage: 2000 + i, safety_cert_status: 'valid', owner: `Owner ${i}`, operator: 'Op', year_built: 2010, length_overall_m: 200, beam_m: 30, max_draft_m: 12 })

const KpiStub = { props: ['label', 'value', 'unavailable'], template: '<div class="kpi" :data-label="label" :data-unavailable="unavailable">{{ value }}</div>' }
const stubs = {
  PageHeader: { template: '<header><slot name="actions" /></header>' }, SectionTitle: { template: '<h3><slot /></h3>' }, KpiCard: KpiStub,
  ScopeBar: true, NuxtLink: true, MaritimeRawPanel: { props: ['dataset', 'id', 'defaultOpen'], template: '<div class="raw-stub" />' }, BadgePill: { template: '<span class="badge"><slot /></span>' },
}

function install(counts: Record<string, number>) {
  $api = vi.fn(async (path: string, o: any) => {
    const q = o?.query ?? {}
    if (Number(q.page_size) === 1) {                                       // a KPI count
      const key = q['f.safety_cert_status__exact'] ? 'valid' : q['f.status__exact'] ? 'inport' : path === VESSELS ? 'vessels' : 'moves'
      return { count: counts[key], results: [] }
    }
    const total = path === VESSELS ? counts.vessels : counts.moves
    const size = Number(q.page_size), page = Number(q.page)
    return { count: total, results: Array.from({ length: Math.min(size, Math.max(0, total - (page - 1) * size)) }, (_, i) => vessel((page - 1) * size + i)) }
  })
  ;(globalThis as any).useNuxtApp = () => ({ $api })
  const store = new Map<string, any>()
  ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
  ;(globalThis as any).usePermissions = () => ({ hasMinRole: () => true, hasCapability: () => true })
  ;(globalThis as any).definePageMeta = () => {}
  Object.assign(globalThis as any, { onMounted, onUnmounted, watch })
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as any
}
// Nuxt auto-registers components; the harness registers the ones a page uses for real.
const mountPage = (C: any) => mount(C, { global: { stubs, components: { DataTable } } })
const kpiOf = (w: any, label: string) => w.find(`.kpi[data-label="${label}"]`).text()
const calls = (path: string) => $api.mock.calls.filter(c => c[0] === path).map(c => c[1].query)

beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
afterEach(() => vi.useRealTimers())

describe('maritime/vessels', () => {
  it('KPIs show the server\'s real counts, not the length of a capped list', async () => {
    install({ vessels: 1234, valid: 900, moves: 8800, inport: 41 })
    const w = mountPage(VesselsPage)
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    const kpi = (label: string) => w.find(`.kpi[data-label="${label}"]`).text()
    expect(kpi('Registered Vessels')).toBe('1,234')
    expect(kpi('Valid Safety Certs')).toBe('900')
    expect(kpi('Movements Recorded')).toBe('8,800')
    expect(kpi('Vessels In Port')).toBe('41')
  })

  it('asks for the filtered counts with the shared f.* contract', async () => {
    install({ vessels: 10, valid: 7, moves: 20, inport: 3 })
    mountPage(VesselsPage)
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(calls(VESSELS).some(q => q['f.safety_cert_status__exact'] === 'valid' && q.page_size === 1)).toBe(true)
    expect(calls(MOVES).some(q => q['f.status__exact'] === 'in_port' && q.page_size === 1)).toBe(true)
  })

  it('both tables page the whole dataset on the server', async () => {
    install({ vessels: 1234, valid: 1, moves: 8800, inport: 1 })
    const w = mountPage(VesselsPage)
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(calls(VESSELS).find(q => q.page_size === 25)).toEqual({ page: 1, page_size: 25 })
    expect(calls(MOVES).find(q => q.page_size === 25)).toEqual({ page: 1, page_size: 25 })
    const statuses = w.findAll('.dt-status').map(s => s.text())
    expect(statuses).toEqual(['Showing 1–25 of 1,234', 'Showing 1–25 of 8,800'])        // not "Page 1 of 7 · 100 rows"
    expect(w.text()).toContain('of 50')                                                  // 1,234 / 25 pages
  })

  it('every vessel type the model has can be filtered to (the old menu missed three)', async () => {
    install({ vessels: 5, valid: 1, moves: 1, inport: 1 })
    const w = mountPage(VesselsPage)
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    const select = w.find('select[aria-label="Filter Type"]')
    const values = select.findAll('option').map(o => o.attributes('value'))
    for (const t of ['cruise', 'fishing', 'other', 'container', 'tanker']) expect(values).toContain(t)
  })

  it('a row opens into its drill-down', async () => {
    install({ vessels: 3, valid: 1, moves: 1, inport: 1 })
    const w = mountPage(VesselsPage)
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(w.text()).not.toContain('Owner 0')
    await w.find('tbody tr').trigger('click')
    expect(w.find('.dt-detail').text()).toContain('Owner 0')
    expect(w.find('.dt-detail').text()).toContain('Max Draft')
  })

  it('a county change (top bar / ScopeBar) refetches the tables and the KPIs', async () => {
    install({ vessels: 10, valid: 5, moves: 10, inport: 2 })
    mountPage(VesselsPage)
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    $api.mockClear()
    useGlobalScope().setCounty('Mombasa')
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(calls(VESSELS).filter(q => q.county === 'Mombasa').length).toBeGreaterThanOrEqual(3)   // table + two KPI counts
    expect(calls(MOVES).filter(q => q.county === 'Mombasa').length).toBeGreaterThanOrEqual(3)
  })

  it('a failed KPI says so instead of showing 0', async () => {
    install({ vessels: 10, valid: 5, moves: 10, inport: 2 })
    const base = $api.getMockImplementation()!
    $api.mockImplementation(async (path: string, o: any) => { if (path === VESSELS && Number(o.query.page_size) === 1) throw new Error('down'); return base(path, o) })
    const w = mountPage(VesselsPage)
    await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(w.find('.kpi[data-label="Registered Vessels"]').attributes('data-unavailable')).toBe('true')
  })
})

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Public Transport
// ───────────────────────────────────────────────────────────────────────────────────────────────
import BrtPage from '~/pages/public-transport/brt.vue'
import CompliancePage from '~/pages/public-transport/compliance.vue'
import IndexPage from '~/pages/public-transport/index.vue'
import OperatorsPage from '~/pages/public-transport/operators.vue'
import InspectionsPage from '~/pages/public-transport/vehicle-inspections.vue'
import RegistrationPage from '~/pages/public-transport/vehicle-registration.vue'
import DriverLicensingPage from '~/pages/public-transport/driver-licensing.vue'
import { computed } from 'vue'

const PT = '/api/v1/public-transport'
const stop = (i: number, over: Record<string, any> = {}) => ({
  id: `s${i}`, stop_id: `BRT-${i}`, stop_name: `Stop ${i}`, route: 'r1', route_name: 'Line 1', latitude: -1.2 - i / 1000, longitude: 36.8,
  platform_type: 'center', has_shelter: i % 2 === 0, has_ticket_machine: false, accessibility_score: 0.9, avg_dwell_seconds: 30 + i, avg_boarding_count: 100 + i, is_active: i % 5 !== 0, ...over,
})

/** A small fake of the list contract: paging, f.* filters, q, ordering ignored, aggregates and group_by. */
function fakeList(all: any[]) {
  return (q: any) => {
    let rows = all
    if (q.q) rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(String(q.q).toLowerCase()))
    for (const [k, v] of Object.entries(q)) {
      if (!k.startsWith('f.')) continue
      const [col, lookup = 'icontains'] = k.slice(2).split('__')
      const cmp = (a: any, b: any) => (typeof a === 'number' ? a - Number(b) : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0)
      rows = rows.filter(r => {
        const x = r[col!]
        if (lookup === 'isnull') return (x == null || x === '') === (String(v) === 'true')
        if (lookup === 'gte') return cmp(x, v) >= 0
        if (lookup === 'lte') return cmp(x, v) <= 0
        if (lookup === 'gt') return cmp(x, v) > 0
        if (lookup === 'lt') return cmp(x, v) < 0
        if (lookup === 'exact' || typeof x === 'boolean') return String(x) === String(v)
        return String(x).toLowerCase().includes(String(v).toLowerCase())
      })
    }
    const size = Number(q.page_size ?? 20), page = Number(q.page ?? 1)
    const out: any = { count: rows.length, results: rows.slice((page - 1) * size, page * size) }
    if (q.aggregate) {
      out.aggregates = {}
      for (const spec of String(q.aggregate).split(',')) {
        const [fn, col] = spec.split(':')
        const vals = rows.map(r => r[col!]).filter(v => v != null)
        out.aggregates[spec] = fn === 'avg' ? (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null) : fn === 'sum' ? vals.reduce((a, b) => a + b, 0) : fn === 'distinct' ? new Set(vals).size : rows.length
      }
    }
    if (q.group_by) {
      out.groups = {}
      for (const col of String(q.group_by).split(',')) {
        const m = new Map<any, number>()
        for (const r of rows) m.set(r[col], (m.get(r[col]) ?? 0) + 1)
        out.groups[col] = [...m].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)
      }
    }
    return out
  }
}

describe('public-transport/brt', () => {
  let stops: any[]
  const brtStubs = { ...stubs, ClientOnly: { template: '<slot />' }, UaptsMap: { props: ['markers'], template: '<div class="map-stub" :data-markers="markers.length" />' }, EmptyState: { template: '<p />' } }
  const mountBrt = () => mount(BrtPage, { global: { stubs: brtStubs, components: { DataTable } } })

  beforeEach(() => {
    stops = Array.from({ length: 640 }, (_, i) => stop(i))
    const list = fakeList(stops)
    const adherence = fakeList(Array.from({ length: 300 }, (_, i) => ({ id: `a${i}`, route_name: 'Line 1', stop_name: `Stop ${i}`, scheduled_at: '2026-11-04T08:00:00Z', actual_at: '2026-11-04T08:02:00Z', deviation_seconds: 120, on_time: true })))
    $api = vi.fn(async (path: string, o: any = {}) => {
      const q = o.query ?? {}
      if (path === `${PT}/brt-stops/`) return list(q)
      if (path === `${PT}/brt-stops/headway/`) return { count: 2, results: [{ route_id: 'r1', route__route_name: 'Line 1', buses_per_day: 80, avg_frequency: 8 }, { route_id: 'r2', route__route_name: 'Line 2', buses_per_day: 40, avg_frequency: 22 }] }
      if (path === `${PT}/schedule-adherence/`) return adherence(q)
      if (path.startsWith('/api/v1/gis/roads')) return { type: 'FeatureCollection', features: [] }
      throw new Error(`unexpected ${path}`)
    })
    ;(globalThis as any).useNuxtApp = () => ({ $api })
    const store = new Map<string, any>()
    ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
    ;(globalThis as any).usePermissions = () => ({ hasMinRole: () => true, hasCapability: () => true })
    ;(globalThis as any).definePageMeta = () => {}
    Object.assign(globalThis as any, { onMounted, onUnmounted, watch, computed, ref })
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as any
  })

  it('the KPIs are server aggregates over ALL 640 stops, not the first page', async () => {
    const w = mountBrt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(kpiOf(w, 'BRT Stops')).toBe('640')
    expect(kpiOf(w, 'Active Stops')).toBe(String(stops.filter(s => s.is_active).length))
    const avgDwell = stops.reduce((a, s) => a + s.avg_dwell_seconds, 0) / stops.length
    expect(kpiOf(w, 'Avg Dwell Time')).toBe(`${avgDwell.toFixed(0)}s`)
    expect(kpiOf(w, 'Shelter Coverage')).toBe(`${((stops.filter(s => s.has_shelter).length / 640) * 100).toFixed(0)}%`)
    expect(kpiOf(w, 'BRT Routes (Headway)')).toBe('2')
  })

  it('the stop inventory pages the whole dataset on the server', async () => {
    const w = mountBrt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(calls(`${PT}/brt-stops/`).find(q => q.page_size === 25)).toEqual({ page: 1, page_size: 25, ordering: 'stop_name' })
    expect(w.findAll('.dt-status').map(s => s.text())).toEqual(['Showing 1–25 of 640', 'Showing 1–25 of 300'])    // not "Page 1 of 7 · 100 rows"
  })

  it('searching and filtering the inventory is a server query', async () => {
    const w = mountBrt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    const inv = w.find('#stop-inventory')
    await inv.find('input[type="search"]').setValue('Stop 6'); await vi.advanceTimersByTimeAsync(400); await flushPromises()
    expect(calls(`${PT}/brt-stops/`).at(-1)).toMatchObject({ q: 'Stop 6', page: 1 })
    await inv.find('select[aria-label="Filter Shelter"]').setValue('true'); await vi.advanceTimersByTimeAsync(400); await flushPromises()
    expect(calls(`${PT}/brt-stops/`).at(-1)).toMatchObject({ q: 'Stop 6', 'f.has_shelter': 'true' })
    expect(inv.find('.dt-chips').text()).toContain('Shelter')
  })

  it('the map shows every stop (up to its own limit), not just the table\'s page', async () => {
    const w = mountBrt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(w.find('.map-stub').attributes('data-markers')).toBe('500')
    expect(calls(`${PT}/brt-stops/`).some(q => q.page_size === 500)).toBe(true)
  })

  it('the headway list shows every route, with no pager', async () => {
    const w = mountBrt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(w.findAll('.hw-row')).toHaveLength(2)
    expect(w.find('#headway-compliance .table-pagination').exists()).toBe(false)
  })

  it('a county change refetches the tables, the KPIs and the map', async () => {
    mountBrt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    $api.mockClear()
    useGlobalScope().setCounty('Nairobi'); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    for (const q of calls(`${PT}/brt-stops/`)) expect(q.county).toBe('Nairobi')
    expect(calls(`${PT}/brt-stops/`).some(q => q.page_size === 1 && q.aggregate)).toBe(true)      // KPIs
    expect(calls(`${PT}/brt-stops/`).some(q => q.page_size === 25)).toBe(true)                      // table
    expect(calls(`${PT}/brt-stops/`).some(q => q.page_size === 500)).toBe(true)                     // map
    expect(calls(`${PT}/schedule-adherence/`).some(q => q.county === 'Nairobi')).toBe(true)
  })

  it('an unreachable API says so instead of showing zeros', async () => {
    const base = $api.getMockImplementation()!
    $api.mockImplementation(async (p: string, o: any = {}) => { if (p === `${PT}/brt-stops/`) throw new Error('down'); return base(p, o) })
    const w = mountBrt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(w.find('.error-banner').text()).toContain('Unable to reach')
    expect(w.find('.kpi[data-label="BRT Stops"]').attributes('data-unavailable')).toBe('true')
  })
})


describe('public-transport/compliance', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 10, 4) + n * 86_400_000).toISOString().slice(0, 10)     // "today" is 2026-11-04
  let licences: any[]
  let operators: any[]
  const mk = (i: number, status: string, expiresInDays: number, gps: number) => ({
    id: `l${i}`, license_number: `PSV-${i}`, sacco: 's1', sacco_name: `Operator ${i % 3}`, route: 'r', route_name: 'Route 1', issue_date: '2025-01-01',
    expiry_date: day(expiresInDays), status, gps_compliance_pct: gps, vehicle_count: 10,
  })
  const compStubs = { ...stubs, CertificateExpiryPanel: { template: '<div class="expiry-stub" />' }, EmptyState: { template: '<p class="empty" />' } }
  const mountPage = () => mount(CompliancePage, { global: { stubs: compStubs, components: { DataTable } } })

  beforeEach(() => {
    licences = [
      ...Array.from({ length: 5 }, (_, i) => mk(i, 'active', 10, 80)),            // expiring within 30 days
      ...Array.from({ length: 4 }, (_, i) => mk(10 + i, 'active', 60, 100)),      // expiring in 31-90 days
      ...Array.from({ length: 3 }, (_, i) => mk(20 + i, 'active', 400, 90)),      // not expiring soon
      ...Array.from({ length: 2 }, (_, i) => mk(30 + i, 'expired', -30, 50)),     // already expired
      mk(40, 'suspended', 200, 60), mk(41, 'revoked', 200, 60),
    ]
    operators = [
      { id: 'o1', sacco_name: 'Alpha', registration_status: 'active', fleet_size: 50, route_count: 4, service_quality_score: 91 },
      { id: 'o2', sacco_name: 'Beta', registration_status: 'active', fleet_size: 20, route_count: 2, service_quality_score: 72 },
      { id: 'o3', sacco_name: 'Gamma', registration_status: 'active', fleet_size: 10, route_count: 1, service_quality_score: 40 },
      { id: 'o4', sacco_name: 'Delta', registration_status: 'suspended', fleet_size: 5, route_count: 1, service_quality_score: 20 },
    ]
    const licList = fakeList(licences), opList = fakeList(operators)
    $api = vi.fn(async (path: string, o: any = {}) => {
      const q = o.query ?? {}
      if (path === `${PT}/psv-licenses/`) return licList(q)
      if (path === `${PT}/saccos/`) return opList(q)
      if (path === `${PT}/compliance/summary/`) return { speed: { compliant: 8, flagged: 1, violation: 1, total: 10 } }
      throw new Error(`unexpected ${path}`)
    })
    ;(globalThis as any).useNuxtApp = () => ({ $api })
    const store = new Map<string, any>()
    ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
    ;(globalThis as any).usePermissions = () => ({ hasMinRole: () => true, hasCapability: () => true })
    ;(globalThis as any).definePageMeta = () => {}
    Object.assign(globalThis as any, { onMounted, onUnmounted, watch, computed, ref })
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as any
    vi.setSystemTime(new Date('2026-11-04T09:00:00Z'))
  })

  it('every KPI is a server figure over the whole register', async () => {
    const w = mountPage(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(kpiOf(w, 'Active Licences')).toBe('12')
    expect(kpiOf(w, 'Expiring ≤30d')).toBe('5')
    expect(kpiOf(w, 'Expiring 31–90d')).toBe('4')                            // not 5 + 4: the windows do not overlap
    expect(kpiOf(w, 'Expired / Suspended')).toBe('3')                        // 2 expired + 1 suspended (revoked is not counted)
    const avg = [80, 80, 80, 80, 80, 100, 100, 100, 100, 90, 90, 90].reduce((a, b) => a + b, 0) / 12
    expect(kpiOf(w, 'Avg GPS Compliance')).toBe(`${avg.toFixed(1)}%`)         // active licences only
    expect(kpiOf(w, 'Active Operators')).toBe('3')
  })

  it('asks for the expiry windows as date ranges, in EAT calendar days', async () => {
    mountPage(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    const counts = calls(`${PT}/psv-licenses/`).filter(q => q.page_size === 1)
    expect(counts).toContainEqual({ 'f.expiry_date__gte': '2026-11-04', 'f.expiry_date__lte': '2026-12-04', page_size: 1 })
    expect(counts).toContainEqual({ 'f.expiry_date__gt': '2026-12-04', 'f.expiry_date__lte': '2027-02-02', page_size: 1 })
    expect(counts).toContainEqual({ 'f.status__exact': 'active', page_size: 1, aggregate: 'avg:gps_compliance_pct' })
  })

  it('both tables page the whole dataset on the server, soonest expiry first', async () => {
    const w = mountPage(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(calls(`${PT}/psv-licenses/`).find(q => q.page_size === 25)).toEqual({ page: 1, page_size: 25, ordering: 'expiry_date' })
    expect(w.findAll('.dt-status').map(s => s.text())).toEqual(['Showing 1–16 of 16', 'Showing 1–4 of 4'])
  })

  it('"Days Left" is derived from the expiry date and sorts by it on the server', async () => {
    const w = mountPage(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    const reg = w.find('#licence-registry')
    expect(reg.find('tbody tr').text()).toContain('10d')
    const header = reg.findAll('thead tr:first-child th').find(th => th.text().includes('Days Left'))!
    await header.find('.dt-sort').trigger('click'); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(header.attributes('aria-sort')).toBe('ascending')                 // same query as the default, so the cache serves it
    await header.find('.dt-sort').trigger('click'); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(header.attributes('aria-sort')).toBe('descending')
    expect(calls(`${PT}/psv-licenses/`).at(-1)).toMatchObject({ ordering: '-expiry_date' })   // sorted by the expiry date on the server
  })

  it('filtering the register by status is a server query', async () => {
    const w = mountPage(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    await w.find('#licence-registry select[aria-label="Filter Status"]').setValue('expired'); await vi.advanceTimersByTimeAsync(400); await flushPromises()
    expect(calls(`${PT}/psv-licenses/`).at(-1)).toMatchObject({ 'f.status__exact': 'expired', page: 1 })
    expect(w.find('#licence-registry .dt-status').text()).toBe('Showing 1–2 of 2')
  })

  it('keeps the compliance-by-check-type summary', async () => {
    const w = mountPage(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(w.find('.chk-card').text()).toContain('8 OK')
  })

  it('a county change refetches everything', async () => {
    mountPage(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    $api.mockClear()
    useGlobalScope().setCounty('Mombasa'); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    for (const q of [...calls(`${PT}/psv-licenses/`), ...calls(`${PT}/saccos/`)]) expect(q.county).toBe('Mombasa')
    expect(calls(`${PT}/psv-licenses/`).length).toBeGreaterThanOrEqual(5)       // table + status / gps / 30d / 90d stats
  })
})

describe('public-transport/driver-licensing', () => {
  const FL = '/api/v1/fleet/driver-licenses/'
  const FD = '/api/v1/fleet/drivers/'
  const day = (n: number) => new Date(Date.UTC(2026, 10, 4) + n * 86_400_000).toISOString().slice(0, 10)
  let licences: any[]
  const mk = (i: number, status: string, expiresInDays: number, demerit: number, psv = '') => ({
    id: `l${i}`, license_number: `DL-${i}`, driver_name: `Driver ${i}`, license_class: 'B', demerit_points: demerit,
    psv_badge_no: psv, psv_badge_expiry: psv ? day(100) : null, expiry_date: day(expiresInDays), status,
  })
  const dlStubs = { ...stubs, CertificateExpiryPanel: { template: '<div class="expiry-stub" />' }, EmptyState: { template: '<p class="empty" />' }, AlertItem: { props: ['title'], template: '<div class="alert-item">{{ title }}</div>' } }
  const mountPage = () => mount(DriverLicensingPage, { global: { stubs: dlStubs, components: { DataTable } } })

  beforeEach(() => {
    licences = [
      mk(1, 'active', 10, 2, 'P1'), mk(2, 'active', 20, 9, 'P2'), mk(3, 'active', 300, 0), mk(4, 'active', -5, 10),   // #4 expired but still active
      mk(5, 'suspended', 100, 4), mk(6, 'revoked', 100, 12), mk(7, 'expired', -40, 0),
    ]
    const licList = fakeList(licences)
    $api = vi.fn(async (path: string, o: any = {}) => {
      const q = o.query ?? {}
      if (path === FL) {
        const { psv, ...rest } = q
        const all = licList({ ...rest, page_size: 1000, page: 1 }).results as any[]
        const rows = psv === '1' ? all.filter(r => r.psv_badge_no) : all
        return fakeList(rows)(rest)
      }
      throw new Error(`unexpected ${path}`)
    })
    ;(globalThis as any).useNuxtApp = () => ({ $api })
    const store = new Map<string, any>()
    ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
    ;(globalThis as any).usePermissions = () => ({ hasMinRole: () => true, hasCapability: () => true })
    ;(globalThis as any).definePageMeta = () => {}
    Object.assign(globalThis as any, { onMounted, onUnmounted, watch, computed, ref })
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as any
    vi.setSystemTime(new Date('2026-11-04T09:00:00Z'))
  })

  it('every KPI is a server figure over the whole registry', async () => {
    const w = mountPage(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(kpiOf(w, 'Licences')).toBe('7')
    expect(kpiOf(w, 'Active')).toBe('4')
    expect(kpiOf(w, 'Suspended')).toBe('1')
    expect(kpiOf(w, 'Revoked')).toBe('1')
    expect(kpiOf(w, 'Expired')).toBe('1')
    expect(kpiOf(w, 'PSV Endorsed')).toBe('2')
    expect(kpiOf(w, 'Avg Demerit Points')).toBe((37 / 7).toFixed(1))
    expect(kpiOf(w, 'High Demerit (≥8)')).toBe('3')
    expect(kpiOf(w, 'Expiring ≤30d')).toBe('2')                                 // active, expiring in the next 30 days
    expect(kpiOf(w, 'Expired-but-Active')).toBe('1')
  })

  it('both tables page the whole licence registry on the server', async () => {
    const w = mountPage(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(w.findAll('.dt-status').map(s => s.text())).toEqual(['Showing 1–2 of 2', 'Showing 1–7 of 7'])
    expect(calls(FL).find(q => q.page_size === 15 && q.psv === '1')).toMatchObject({ ordering: 'psv_badge_expiry' })
    expect(calls(FL).find(q => q.page_size === 15 && !q.psv)).toMatchObject({ ordering: 'expiry_date' })
    expect(calls(FD)).toEqual([])                                                  // the driver identity registry is no longer read
  })

  it('shows licence classes but no personal identifiers (name, licence or badge number)', async () => {
    const w = mountPage(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    const text = w.text()
    expect(w.find('#licence-registry tbody tr').text()).toContain('B')
    expect(text).not.toMatch(/Driver \d/)
    expect(text).not.toMatch(/DL-\d/)
    expect(text).not.toMatch(/\bP[12]\b/)
  })

  it('lists the worst expiry / demerit cases as alerts, from the server, without naming the driver', async () => {
    const w = mountPage(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    const titles = w.findAll('.alert-item').map(a => a.text())
    expect(titles).toContain('Class B licence - expired but marked active')
    expect(titles).toContain('Class B licence - demerit points at 9')
    expect(titles).toContain('Class B licence - renewal due')
  })
})


// ── Shared set-up for the remaining Public Transport pages ─────────────────────────────────────────────────────────
function installGlobals() {
  ;(globalThis as any).useNuxtApp = () => ({ $api })
  const store = new Map<string, any>()
  ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
  ;(globalThis as any).usePermissions = () => ({ hasMinRole: () => true, hasCapability: () => true })
  ;(globalThis as any).definePageMeta = () => {}
  Object.assign(globalThis as any, { onMounted, onUnmounted, watch, computed, ref, useTimeRange })
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as any
  vi.setSystemTime(new Date('2026-11-04T09:00:00Z'))
}
const ptStubs = {
  ...stubs, CertificateExpiryPanel: { template: '<div />' }, EmptyState: { template: '<p class="empty" />' }, AlertItem: { props: ['title'], template: '<div class="alert-item">{{ title }}</div>' },
  OperatorDetailPanel: { props: ['sacco'], template: '<div class="op-detail" :data-sacco="sacco" />' }, VehicleDetailPanel: { template: '<div class="veh-detail" />' },
  ReinspectionChain: { template: '<div class="chain" />' }, CollapsibleSection: { template: '<div><slot /></div>' }, ClientOnly: { template: '<div><slot /></div>' },
  UaptsMap: true, TrendLineChart: true, DayRangeToggle: true,
}

describe('public-transport/index (operator leaderboard)', () => {
  const metrics = Array.from({ length: 22 }, (_, i) => ({ id: `m${i}`, sacco: `s${i}`, sacco_name: `Op ${i}`, rank_position: i + 1, on_time_pct: 90 - i, revenue_kes: 1000 * (i + 1), fleet_utilization_pct: 70, total_trips: 10, complaint_count: 1 }))
  beforeEach(() => {
    const list = fakeList(metrics)
    $api = vi.fn(async (path: string, o: any = {}) => {
      if (path === `${PT}/operator-metrics/`) return list(o.query ?? {})
      if (path === `${PT}/summary/`) return { kpis: { active_saccos: 3, total_saccos: 4, active_routes: 5, brt_routes: 1, matatu_routes: 4, scheduled_departures_24h: 9, revenue_24h_kes: 5000, passenger_trips_24h: 70 }, on_time_pct: 88, generated_at: new Date().toISOString(), demand_forecast_24h: [], feedback_by_category: [] }
      if (path.startsWith(PT) || path.includes('/gis/')) return { results: [], lines: [], markers: [] }
      throw new Error(`unexpected ${path}`)
    })
    installGlobals()
  })

  it('the leaderboard is the latest period, paged and ranked on the server', async () => {
    const w = mount(IndexPage, { global: { stubs: ptStubs, components: { DataTable } } }); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(calls(`${PT}/operator-metrics/`)[0]).toEqual({ page: 1, page_size: 15, ordering: 'rank_position', latest: '1' })
    expect(w.find('#operator-leaderboard .dt-status').text()).toBe('Showing 1–15 of 22')
    expect(kpiOf(w, 'Active Operators')).toBe('3')
  })
})

describe('public-transport/operators', () => {
  const saccos = [
    { id: 's1', sacco_name: 'Alpha', registration_status: 'active', fleet_size: 50, route_count: 4, service_quality_score: 90, contact_phone: '1', agency_code: 'A', updated_at: '2026-10-01' },
    { id: 's2', sacco_name: 'Beta', registration_status: 'active', fleet_size: 30, route_count: 2, service_quality_score: 70, contact_phone: '2', agency_code: 'A', updated_at: '2026-10-01' },
    { id: 's3', sacco_name: 'Gamma', registration_status: 'suspended', fleet_size: 20, route_count: 1, service_quality_score: 50, contact_phone: '3', agency_code: 'A', updated_at: '2026-10-01' },
  ]
  const routes = [{ id: 'r1', is_active: true }, { id: 'r2', is_active: true }, { id: 'r3', is_active: false }]
  const feedback = [{ id: 'f1', status: 'open' }, { id: 'f2', status: 'open' }, { id: 'f3', status: 'resolved' }]
  const compliance = [{ id: 'c1', status: 'compliant' }, { id: 'c2', status: 'compliant' }, { id: 'c3', status: 'compliant' }, { id: 'c4', status: 'violation' }]
  const licences = [{ id: 'l1', status: 'active', gps_compliance_pct: 90 }, { id: 'l2', status: 'active', gps_compliance_pct: 70 }, { id: 'l3', status: 'expired', gps_compliance_pct: 10 }, { id: 'l4', status: 'revoked', gps_compliance_pct: 0 }]
  beforeEach(() => {
    const lists: Record<string, any> = {
      [`${PT}/saccos/`]: fakeList(saccos), [`${PT}/routes/`]: fakeList(routes), [`${PT}/feedback/`]: fakeList(feedback),
      [`${PT}/compliance/`]: fakeList(compliance), [`${PT}/psv-licenses/`]: fakeList(licences), [`${PT}/demand-forecasts/`]: fakeList([{ id: 'd1', route_name: 'R', target_at: '2026-11-05T00:00:00Z', predicted_passengers: 10, lower_passengers: 5, upper_passengers: 15, model_name: 'm', horizon_hours: 1 }]),
    }
    $api = vi.fn(async (path: string, o: any = {}) => { if (lists[path]) return lists[path](o.query ?? {}); throw new Error(`unexpected ${path}`) })
    installGlobals()
  })

  it('every KPI is a server figure over the whole dataset', async () => {
    const w = mount(OperatorsPage, { global: { stubs: ptStubs, components: { DataTable } } }); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(kpiOf(w, 'Registered Operators')).toBe('3')
    expect(kpiOf(w, 'Suspended')).toBe('1')
    expect(kpiOf(w, 'Total Fleet Size')).toBe('100')
    expect(kpiOf(w, 'Active Routes')).toBe('2')
    expect(kpiOf(w, 'Avg Service Quality')).toBe('70/100')
    expect(kpiOf(w, 'Open Complaints')).toBe('2')
    expect(kpiOf(w, 'Route Compliance')).toBe('75.0%')
    expect(kpiOf(w, 'Avg GPS Compliance')).toBe('80.0%')
    expect(kpiOf(w, 'PSV Licence Compliance')).toBe('50.0%')
  })

  it('opening a registry row mounts the drill-down for that operator only', async () => {
    const w = mount(OperatorsPage, { global: { stubs: ptStubs, components: { DataTable } } }); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(w.find('.op-detail').exists()).toBe(false)
    await w.find('#operator-registry tbody .dt-toggle').trigger('click'); await flushPromises()
    expect(w.find('.op-detail').attributes('data-sacco')).toBe('s1')
  })

  it('a county change refetches every table and KPI with the county', async () => {
    mount(OperatorsPage, { global: { stubs: ptStubs, components: { DataTable } } }); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    $api.mockClear()
    useGlobalScope().setCounty('Mombasa'); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    for (const path of [`${PT}/saccos/`, `${PT}/routes/`, `${PT}/feedback/`, `${PT}/compliance/`, `${PT}/psv-licenses/`, `${PT}/demand-forecasts/`])
      for (const q of calls(path)) expect(q.county).toBe('Mombasa')
    expect(calls(`${PT}/routes/`).length).toBeGreaterThanOrEqual(2)
  })
})

describe('public-transport/vehicle-inspections', () => {
  const V = '/api/v1/fleet/vehicle-inspections/'
  const day = (n: number) => new Date(Date.UTC(2026, 10, 4) + n * 86_400_000).toISOString().slice(0, 10)
  const mk = (i: number, result: string, centre: string, inspector: string, dueIn: number, re = false) => ({ id: `i${i}`, plate_number: `KAA ${i}`, inspection_centre: centre, inspector_name: inspector, inspected_at: day(-10), result, sticker_no: `S${i}`, report_url: '', next_inspection_due: day(dueIn), reinspection_of: re ? 'i1' : null, is_reinspection: re })
  const rows = [mk(1, 'pass', 'Likoni', 'Ann', 100), mk(2, 'pass', 'Likoni', 'Ann', 10), mk(3, 'fail', 'Likoni', 'Bob', -5), mk(4, 'pass', 'Industrial', 'Cy', -20, true), mk(5, 'conditional_pass', 'Industrial', 'Cy', 200)]
  beforeEach(() => {
    const list = fakeList(rows)
    $api = vi.fn(async (path: string, o: any = {}) => { if (path === V) return list(o.query ?? {}); throw new Error(`unexpected ${path}`) })
    installGlobals()
  })
  const mountIt = () => mount(InspectionsPage, { global: { stubs: ptStubs, components: { DataTable } } })

  it('every KPI and the per-centre breakdown come from the server', async () => {
    const w = mountIt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(kpiOf(w, 'Inspections')).toBe('5')
    expect(kpiOf(w, 'Passed')).toBe('3')
    expect(kpiOf(w, 'Failed')).toBe('1')
    expect(kpiOf(w, 'Pass Rate')).toBe('75.0%')
    expect(kpiOf(w, 'Re-inspections')).toBe('1')
    expect(kpiOf(w, 'Overdue')).toBe('2')
    expect(kpiOf(w, 'Due ≤30d')).toBe('1')
    expect(w.findAll('.bar-row').map(r => r.text())).toEqual(expect.arrayContaining([expect.stringContaining('Likoni'), expect.stringContaining('Industrial')]))
    expect(w.find('.bar-row').text()).toContain('Likoni')
    expect(w.find('.bar-row').text()).toContain('67% pass')                    // 2 of Likoni's 3
  })

  it('lists the longest-overdue inspections as alerts', async () => {
    const w = mountIt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(w.findAll('.alert-item').map(a => a.text()).sort()).toEqual(['Industrial - inspection overdue', 'Likoni - inspection overdue'])
    expect(calls(V).find(q => q.page_size === 20)).toMatchObject({ ordering: 'next_inspection_due', 'f.next_inspection_due__lt': '2026-11-04' })
  })

  it('shows no registration number, sticker number or inspector', async () => {
    const w = mountIt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    const text = w.text()
    for (const pii of ['KAA', 'Ann', 'Bob', 'Inspector', 'Sticker']) expect(text).not.toContain(pii)
    for (const q of calls(V)) expect(String(q.aggregate ?? '')).not.toContain('inspector_name')
  })

  it('"Re-inspections only" is a server filter on the registry', async () => {
    const w = mountIt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(w.find('#inspection-registry .dt-status').text()).toBe('Showing 1–5 of 5')
    await w.find('#inspection-registry input[type=checkbox]').setValue(true); await vi.advanceTimersByTimeAsync(400); await flushPromises()
    expect(calls(V).at(-1)).toMatchObject({ 'f.reinspection_of__isnull': 'false' })
    expect(w.find('#inspection-registry .dt-status').text()).toBe('Showing 1–1 of 1')
  })
})

describe('public-transport/vehicle-registration', () => {
  const V = '/api/v1/fleet/vehicles/'
  const thisYear = new Date().getFullYear()
  const day = (n: number) => new Date(Date.UTC(2026, 10, 4) + n * 86_400_000).toISOString().slice(0, 10)
  const mk = (i: number, status: string, type: string, year: number | null, created: string, insp: number) => ({ id: `v${i}`, plate_number: `KBB ${i}`, chassis_no: `CH${i}`, make: 'Toyota', model_name: 'Hiace', year_of_manufacture: year, vehicle_type: type, fuel_type: 'diesel', operator_name: 'Alpha', agency_code: 'A', route_name: 'R', inspection_expiry: day(insp), insurance_expiry: day(200), has_recent_track: false, status, created_at: created, updated_at: created, last_seen_at: null })
  const rows = [
    mk(1, 'operational', 'matatu', thisYear - 1, '2026-11-01', 10), mk(2, 'operational', 'matatu', thisYear - 5, '2026-10-01', 300),
    mk(3, 'maintenance', 'bus', thisYear - 10, '2026-10-30', 15), mk(4, 'impounded', 'bus', null, '2026-01-01', 300),
  ]
  beforeEach(() => {
    const list = fakeList(rows)
    $api = vi.fn(async (path: string, o: any = {}) => {
      if (path === V) return list(o.query ?? {})
      if (path === '/api/v1/fleet/summary/') return { governor_compliance: { online_pct: 93.2 }, vehicles_by_status: {}, vehicles_by_type: [] }
      throw new Error(`unexpected ${path}`)
    })
    installGlobals()
  })
  const mountIt = () => mount(RegistrationPage, { global: { stubs: ptStubs, components: { DataTable } } })

  it('KPIs and breakdowns are server figures over the whole registry', async () => {
    const w = mountIt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(kpiOf(w, 'Total Registered Vehicles')).toBe('4')
    expect(kpiOf(w, 'Operational')).toBe('2')
    expect(kpiOf(w, 'Impounded')).toBe('1')
    expect(kpiOf(w, 'Inspection Expiring ≤30d')).toBe('2')
    expect(kpiOf(w, 'Speed Governor Online')).toBe('93.2%')
    const text = w.text()
    expect(text).toContain('0-3 yrs'); expect(text).toContain('4-7 yrs'); expect(text).toContain('8-15 yrs'); expect(text).toContain('Unknown')
  })

  it('shows no plate or chassis number', async () => {
    const w = mountIt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    expect(w.text()).not.toContain('KBB')
    expect(w.text()).not.toMatch(/CH\d/)
    expect(calls(V).find(q => q.page_size === 15)).toMatchObject({ ordering: '-updated_at' })
  })

  it('the global period narrows the table and every KPI on the server (and nothing is sent without one)', async () => {
    const w = mountIt(); await vi.advanceTimersByTimeAsync(0); await flushPromises()
    for (const q of calls(V)) expect(q['f.created_at__gte']).toBeUndefined()
    useGlobalScope().setRange({ mode: '7d', year: 2026 }); await vi.advanceTimersByTimeAsync(400); await flushPromises()
    for (const q of calls(V).slice(-3)) expect(q['f.created_at__gte']).toBe('2026-10-28')
    expect(kpiOf(w, 'Total Registered Vehicles')).toBe('2')
    useGlobalScope().setRange(null)
  })
})
