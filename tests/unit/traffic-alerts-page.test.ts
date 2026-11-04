// tests/unit/traffic-alerts-page.test.ts
// Traffic Alerts on the universal table: the right requests, real server counts, and - the point of the page -
// that resolving an alert updates the log, the active cards and every KPI, with nothing stale.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import AlertsPage from '~/pages/traffic/alerts.vue'
import DataTable from '~/components/DataTable.vue'
import AlertItem from '~/components/AlertItem.vue'
import { useGlobalScope } from '~/composables/useGlobalScope'

const T = '/api/v1/traffic'
type Alert = { id: string; title: string; message: string; alert_type: string; severity: string; segment_road_code: string; is_active: boolean; issued_at: string; resolved_at: string | null }

let alerts: Alert[]
let congestionTotal: number
let riskTotal: number
let $api: ReturnType<typeof vi.fn>

const mk = (id: string, severity: string, active: boolean, i: number): Alert => ({
  id, title: `Alert ${id}`, message: 'msg', alert_type: 'congestion', severity, segment_road_code: `A${i}`,
  is_active: active, issued_at: `2026-11-0${i}T10:00:00Z`, resolved_at: active ? null : '2026-11-04T08:00:00Z',
})

function page<T>(rows: T[], q: any, total = rows.length) {
  const size = Number(q.page_size ?? 20), p = Number(q.page ?? 1)
  return { count: total, results: rows.slice((p - 1) * size, p * size) }
}
function listAlerts(q: any) {
  let rows = alerts
  if (q.active === 'true') rows = rows.filter(a => a.is_active)
  if (q['f.is_active__exact'] !== undefined) rows = rows.filter(a => String(a.is_active) === q['f.is_active__exact'])
  if (q['f.severity__exact']) rows = rows.filter(a => a.severity === q['f.severity__exact'])
  if (q['f.alert_type__exact']) rows = rows.filter(a => a.alert_type === q['f.alert_type__exact'])
  return page(rows, q)
}

const row = (i: number) => ({ id: `r${i}`, segment_road_code: `C${i}`, severity: 'high', avg_speed_kmh: 15, delay_minutes: 20, impact_radius_km: 1.2, expected_duration_min: 45, started_at: '2026-11-04T09:00:00Z', description: 'd', predicted_congestion: 'heavy', model_name: 'lstm', target_at: '2026-11-04T15:00:00Z', predicted_volume: 100, predicted_speed_kmh: 20, horizon_hours: 3 })

function install() {
  alerts = [mk('a1', 'critical', true, 1), mk('a2', 'critical', true, 2), mk('a3', 'warning', true, 3), mk('a4', 'warning', false, 4)]
  congestionTotal = 57
  riskTotal = 9
  $api = vi.fn(async (path: string, o: any = {}) => {
    const q = o.query ?? {}
    if (o.method === 'POST') {
      const id = /alerts\/([^/]+)\/resolve\//.exec(path)![1]
      const a = alerts.find(x => x.id === id)!
      if (a.is_active) { a.is_active = false; a.resolved_at = '2026-11-04T12:00:00Z' }
      return a
    }
    if (path === `${T}/alerts/`) return listAlerts(q)
    if (path === `${T}/congestion-events/`) return page(Array.from({ length: Math.min(Number(q.page_size), 25) }, (_, i) => row(i)), q, congestionTotal)
    if (path === `${T}/forecasts/`) return page(Array.from({ length: Math.min(Number(q.page_size), 25) }, (_, i) => row(i)), q, riskTotal)
    throw new Error(`unexpected ${path}`)
  })
  ;(globalThis as any).useNuxtApp = () => ({ $api })
  const store = new Map<string, any>()
  ;(globalThis as any).useState = (k: string, init: () => any) => { if (!store.has(k)) store.set(k, ref(init())); return store.get(k) }
  ;(globalThis as any).usePermissions = () => ({ hasMinRole: () => true, hasCapability: () => true })
  ;(globalThis as any).definePageMeta = () => {}
  Object.assign(globalThis as any, { onMounted, onUnmounted, watch, computed, ref })
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as any
}

const KpiStub = { props: ['label', 'value', 'unavailable'], template: '<div class="kpi" :data-label="label" :data-unavailable="unavailable">{{ value }}</div>' }
const stubs = {
  PageHeader: { template: '<header><slot name="actions" /></header>' }, SectionTitle: { template: '<h3><slot /></h3>' }, KpiCard: KpiStub, ScopeBar: true,
  CollapsibleSection: { props: ['count', 'title'], template: '<section><h2>{{ title }}</h2><slot /></section>' },
  EmptyState: { props: ['message'], template: '<p class="empty">{{ message }}</p>' },
  BadgePill: { template: '<span class="badge"><slot /></span>' },
}
const mountPage = () => mount(AlertsPage, { global: { stubs, components: { DataTable, AlertItem } } })
const settle = async () => { await vi.advanceTimersByTimeAsync(0); await flushPromises() }
const kpi = (w: any, label: string) => w.find(`.kpi[data-label="${label}"]`).text()
const reqs = (path: string) => $api.mock.calls.filter(c => c[0] === path && !c[1]?.method).map(c => c[1].query)

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T09:00:00Z')); install() })
afterEach(() => vi.useRealTimers())

describe('Traffic Alerts - what it shows', () => {
  it('every KPI is a server count (not the length of a first page)', async () => {
    const w = mountPage(); await settle()
    expect(kpi(w, 'Active Alerts')).toBe('3')
    expect(kpi(w, 'Critical')).toBe('2')
    expect(kpi(w, 'Warning')).toBe('1')
    expect(kpi(w, 'Resolved (all)')).toBe('1')
    expect(kpi(w, 'Active Congestion Events')).toBe('57')        // the old page capped this at 20 (the default page size)
    expect(kpi(w, 'Forecast Risk Events')).toBe('9')
  })

  it('asks for the right things', async () => {
    mountPage(); await settle()
    const counts = reqs(`${T}/alerts/`).filter(q => q.page_size === 1)
    expect(counts).toContainEqual({ active: 'true', page_size: 1 })
    expect(counts).toContainEqual({ active: 'true', 'f.severity__exact': 'critical', page_size: 1 })
    expect(counts).toContainEqual({ 'f.is_active__exact': 'false', page_size: 1 })
    expect(reqs(`${T}/congestion-events/`).filter(q => q.page_size === 1)).toContainEqual({ status: 'active', page_size: 1 })
    // the forecast KPI and table share one definition: heavy/severe, up to 12 hours ahead (09:00Z + 12h)
    const risk = reqs(`${T}/forecasts/`)
    expect(risk.length).toBeGreaterThanOrEqual(2)
    for (const q of risk) expect(q).toMatchObject({ 'f.predicted_congestion__in': 'heavy,severe', 'f.target_at__lte': '2026-11-04T21:00:00.000Z' })
  })

  it('the log, the congestion table and the forecast table each page the whole dataset on the server', async () => {
    const w = mountPage(); await settle()
    expect(reqs(`${T}/alerts/`).find(q => q.page_size === 25)).toEqual({ page: 1, page_size: 25, ordering: '-issued_at' })
    expect(reqs(`${T}/congestion-events/`).find(q => q.page_size === 25)).toMatchObject({ status: 'active', ordering: '-started_at' })
    expect(w.findAll('.dt-status').map(s => s.text())).toEqual(['Showing 1–4 of 4', 'Showing 1–25 of 57', 'Showing 1–9 of 9'])
  })

  it('the log is the whole history by default, newest first, with status as a column filter', async () => {
    const w = mountPage(); await settle()
    const bodyRows = w.findAll('#alert-log tbody tr')
    expect(bodyRows).toHaveLength(4)                                       // active AND resolved
    expect(bodyRows[0]!.text()).toContain('Alert a1')
    const status = w.find('#alert-log select[aria-label="Filter Status"]')
    expect(status.findAll('option').map(o => o.text())).toEqual(['All', 'Active', 'Resolved'])
  })

  it('active cards list the most urgent first', async () => {
    const w = mountPage(); await settle()
    const titles = w.findAll('.alert-item .alert-title').map(t => t.text())
    expect(titles).toEqual(['Alert a1', 'Alert a2', 'Alert a3'])          // critical, critical, warning
  })

  it('says when there are more active alerts than the cards show', async () => {
    alerts = Array.from({ length: 130 }, (_, i) => mk(`x${i}`, 'warning', true, 1))
    const w = mountPage(); await settle()
    expect(w.find('.more-note').text()).toContain('100 most recent of 130')
    expect(kpi(w, 'Active Alerts')).toBe('130')                            // the KPI is the real total
  })

  it('the severity filter on the cards runs on the server', async () => {
    const w = mountPage(); await settle()
    await w.find('select[aria-label="Severity"]').setValue('critical'); await settle()
    expect(reqs(`${T}/alerts/`).at(-1)).toMatchObject({ active: 'true', 'f.severity__exact': 'critical', page_size: 100 })
    expect(w.findAll('.alert-item')).toHaveLength(2)
  })
})

describe('Traffic Alerts - updating', () => {
  it('resolving an alert updates the log, the active cards and every KPI', async () => {
    const w = mountPage(); await settle()
    expect(w.find('#alert-log tbody tr').text()).toContain('Active')
    const resolve = w.findAll('#alert-log button').find(b => b.text() === 'Resolve')!
    await resolve.trigger('click'); await settle()

    expect($api.mock.calls.some(c => c[1]?.method === 'POST' && c[0] === `${T}/alerts/a1/resolve/`)).toBe(true)
    expect(kpi(w, 'Active Alerts')).toBe('2')
    expect(kpi(w, 'Critical')).toBe('1')
    expect(kpi(w, 'Resolved (all)')).toBe('2')
    expect(w.findAll('.alert-item')).toHaveLength(2)                         // gone from the active cards
    expect(w.find('#alert-log tbody tr').text()).toContain('Resolved')       // and the log row (page 1, which was cached) is fresh
    expect(w.find('#alert-log tbody tr:first-child button').exists()).toBe(false)        // no Resolve button on a resolved alert
  })

  it('the ACK button on an active card resolves it too', async () => {
    const w = mountPage(); await settle()
    await w.find('.alert-item .ack-btn').trigger('click'); await settle()
    expect(kpi(w, 'Active Alerts')).toBe('2')
  })

  it('a failed resolve says so, leaves nothing stuck, and shows the truth', async () => {
    const w = mountPage(); await settle()
    const base = $api.getMockImplementation()!
    $api.mockImplementation(async (p: string, o: any = {}) => { if (o.method === 'POST') throw { data: { detail: 'Not allowed.' } }; return base(p, o) })
    await w.findAll('#alert-log button').find(b => b.text() === 'Resolve')!.trigger('click'); await settle()
    expect(w.find('.error-banner').text()).toContain('Not allowed.')
    expect(kpi(w, 'Active Alerts')).toBe('3')                                // nothing changed
    expect(w.findAll('#alert-log button').find(b => b.text() === 'Resolve')!.attributes('disabled')).toBeUndefined()   // can retry
  })

  it('a second click while one is in flight is ignored', async () => {
    const w = mountPage(); await settle()
    const resolveBtns = () => w.findAll('#alert-log button').filter(b => b.text() === 'Resolve' || b.text() === '…')
    const before = $api.mock.calls.filter(c => c[1]?.method === 'POST').length
    await resolveBtns()[0]!.trigger('click')
    await resolveBtns()[1]!.trigger('click')
    await settle()
    expect($api.mock.calls.filter(c => c[1]?.method === 'POST').length - before).toBe(1)
  })

  it('refreshes by itself every minute, and rolls the 12-hour window forward', async () => {
    mountPage(); await settle()
    const before = reqs(`${T}/alerts/`).length
    await vi.advanceTimersByTimeAsync(61_000); await flushPromises()
    expect(reqs(`${T}/alerts/`).length).toBeGreaterThan(before)
    const last = reqs(`${T}/forecasts/`).at(-1)!
    expect(last['f.target_at__lte']).toBe('2026-11-04T21:01:00.000Z')
  })
})

describe('Traffic Alerts - county', () => {
  it('a county change refetches every table, count and the active cards', async () => {
    mountPage(); await settle()
    $api.mockClear()
    useGlobalScope().setCounty('Mombasa'); await settle()
    for (const path of [`${T}/alerts/`, `${T}/congestion-events/`, `${T}/forecasts/`]) {
      expect(reqs(path).length, path).toBeGreaterThan(0)
      for (const q of reqs(path)) expect(q.county, path).toBe('Mombasa')
    }
  })
})
