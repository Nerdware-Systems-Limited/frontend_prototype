// tests/unit/widget-presets.test.ts
// ─────────────────────────────────────────────────────────────────────
// Every preset points at a registered source, uses the generic widget that
// draws its shape, and - applied to a payload shaped like the real API
// type - yields a non-empty Frame. Placing one through the catalog gives a
// widget whose permission / filters / clicks come from its binding.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { PRESETS } from '~/utils/widgetPresets'
import { SOURCES_BY_ID } from '~/utils/dataSources'
import { applyBinding } from '~/utils/bindings'
import { resolveCatalogItem, widgetEmits, widgetFilterFields, widgetPermissions, WIDGETS_BY_TYPE, WIDGET_COMPONENTS } from '~/utils/widgetRegistry'

const H = (h: number) => `2026-09-30T${String(h).padStart(2, '0')}:00:00Z`

/** Minimal payloads with the field names of the typed summaries in composables/api. */
const FIXTURES: Record<string, unknown> = {
  'traffic.summary': {
    kpis: { active_stations: 4, total_stations: 6, active_congestion_events: 2, total_segments_observed: 30, avg_speed_24h_kmh: 48, total_volume_24h: 12000 },
    volume_24h: [{ hour: H(1), volume: 300, avg_speed: 60 }, { hour: H(2), volume: 250, avg_speed: null }],
    class_breakdown: [{ vehicle_class: 'car', total: 900, share_pct: 75 }, { vehicle_class: 'bus', total: 300, share_pct: 25 }],
    congestion_distribution: { free_flow: 20, heavy: 3 },
    speed_compliance: { avg_compliance_pct: 81.5, observation_count: 400 },
    forecast_next_hour: [],
  },
  'pt.summary': {
    kpis: { passenger_trips_24h: 5000, revenue_24h_kes: 900000 },
    revenue_24h: [{ hour: H(6), total_kes: 120000, transactions: 300 }],
    payment_channels: [{ payment_channel: 'mpesa', total_kes: 800000, transactions: 1000, share_pct: 88 }],
    on_time_pct: 72.4,
    top_routes: [{ id: '1', route_name: 'Route 111', service_type: 'matatu', demand_count: 400, on_time_count: 300, total_records: 420 }],
    leaderboard: [{ sacco__sacco_name: 'Super Metro', rank_position: 1, on_time_pct: 90, revenue_kes: 500000, fleet_utilization_pct: 80, complaint_count: 3 }],
    feedback_by_category: [{ category: 'overcharging', total: 12, avg_rating: 2.1 }],
    expiring_licences: [{ license_number: 'PSV-1', sacco__sacco_name: 'Super Metro', expiry_date: '2026-10-10', status: 'active' }],
    demand_forecast_24h: [{ target_at: H(7), total_predicted: 900, total_lower: 800, total_upper: 1000 }],
  },
  'safety.summary': {
    incidents_by_severity: { fatal: 2, serious: 9 }, incidents_by_type: { collision: 10, rollover: 1 },
    black_spots_by_tier: { critical: 1, high: 4 }, recent_violations_24h: 33,
  },
  'fleet.summary': {
    kpis: { total_vehicles: 100, live_vehicles: 40, trips_7d: 900, distance_7d_km: 12000 },
    vehicles_by_type: [{ vehicle_type: 'bus', total: 60 }], vehicles_by_status: { active: 80, idle: 20 },
    behaviour_events_24h: { harsh_braking: 12 },
    top_breaches_24h: [{ geofence_id: 'g', geofence__zone_name: 'CBD', geofence__zone_type: 'restricted', c: 5 }],
  },
  'rail.summary': {
    kpis: { trains_in_service: 24, operations_24h: 61, open_incidents: 3 },
    live_operations: [{ id: 'op1', train_number: 'SGR-101', origin_code: 'NBO', destination_code: 'MSA', status: 'running', delay_arrival_min: 7, current_station_code: 'VOI', service_date: '2026-10-04', occupancy_pct: 82 }],
    on_time_30d: { total_operations: 1800, on_time_pct: 91.2, avg_delay_min: 6.4, cancelled: 4 },
    freight_30d: { shipments: 420, total_tons: 380000, total_revenue_kes: 910000000, top_corridors: [{ origin_station__code: 'MSA', destination_station__code: 'NVS', cargo_type: 'containers', tons: 210000, shipments: 190 }] },
    incidents_90d: { total: 12, casualties: 2, loss_kes: 1200000, fatal: 1, level_crossing: 5 },
    ridership_30d: { bookings: 98000, passengers: 95000, revenue_kes: 310000000, no_show_rate_pct: 3.1 },
    top_routes: [{ origin__code: 'NBO', origin__name: 'Nairobi', destination__code: 'MSA', destination__name: 'Mombasa', bookings: 800, revenue: 2000000 }],
  },
  'aviation.summary': { kpis: { cargo_kg_total: 54000, flights_total: 2100, avg_delay_min: 14 }, by_status: [{ status: 'landed', c: 300 }] },
  'aviation.infra': { kpis: { runway_availability_pct: 97.5, navaid_operational_pct: 94, open_work_orders: 18 } },
  'maritime.ops': {
    kpis: { active_ports: 4, live_vessels: 37, incidents_30d: 2, inspections_30d: 40, detentions_30d: 1 },
    ports: [{ port_name: 'Mombasa', arrivals_30d: 140, teu_throughput_30d: 120000, currently_in_port: 14, avg_yard_dwell_days: 4.2 }],
  },
  'maritime.cargo': { days: 30, ports: [{ port_unlocode: 'KEMBA', port_name: 'Mombasa', cargo_tonnes: 2800000, cargo_teu: 120000 }] },
  'training.overview': { kpis: { active_courses: 42, ongoing_cohorts: 9, scheduled_cohorts: 5, enrollments: 1300, completions: 800, pass_rate_pct: 86.5 } },
  'training.enrollment-status': [{ status: 'attending', enrollments: 300 }, { status: 'completed', enrollments: 800 }],
  'training.outcomes': [{ outcome: 'pass', completions: 600 }, { outcome: 'fail', completions: 110 }],
  'training.revenue': { monthly: [{ period: '2026-09', total_kes: 4200000 }], by_stream: [{ revenue_stream: 'student_fee', total_kes: 3900000 }] },
  'training.cohorts': [{ cohort_code: 'C-01', course: 'PSV driver', institute: 'NYS DTS', status: 'ongoing', start_date: '2026-09-01', enrolled_count: 28, capacity: 30, fill_rate_pct: 93.3 }],
  'infra.summary': {
    network: {
      condition_distribution: [{ condition_class: 'good', total: 10, length: 1200 }],
      by_agency: [{ agency_id: 'x', agency_code: 'KeNHA', total_segments: 40, total_length_km: 22000 }],
    },
    bridges: { by_condition_class: { good: 300, critical: 5 } },
    streetlights: { operational_pct: 77.5 },
    construction: { portfolio_by_corridor: [{ corridor: 'Northern', count: 4, contract_sum: 9e9, disbursed: 4e9, avg_physical: 45 }] },
  },
}

const SHAPE_FOR: Record<string, string> = { stat: 'scalar', series: 'series', breakdown: 'categorical', table: 'rows' }

describe('widget presets', () => {
  it('have unique ids', () => {
    const ids = PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(PRESETS.map(p => [p.id, p] as const))('%s binds a real source to the right primitive', (_id, p) => {
    expect(SOURCES_BY_ID[p.binding.source], p.binding.source).toBeDefined()
    expect(SHAPE_FOR[p.type]).toBe(p.binding.shape)
    expect(WIDGET_COMPONENTS[p.type]).toBeTypeOf('function')
    const fixture = FIXTURES[p.binding.source]
    expect(fixture, `no fixture for ${p.binding.source}`).toBeDefined()
    const frame = applyBinding(fixture, p.binding)
    expect(frame.rows.length, `${p.id} produced no rows`).toBeGreaterThan(0)
  })

  it('never binds the fleet governor figures the backend zeroes', () => {
    for (const p of PRESETS) expect(p.binding.path).not.toMatch(/governor_compliance/)
  })

  it('series presets never mix units on one axis', () => {
    for (const p of PRESETS.filter(x => x.type === 'series')) {
      expect(new Set(p.binding.measures.map(m => m.unit)).size, p.id).toBe(1)
    }
  })
})

describe('placing a preset', () => {
  it('creates a generic widget that inherits permission, filters and clicks from its binding', () => {
    const r = resolveCatalogItem('preset:infra.by_agency')!
    expect(r.type).toBe('breakdown')
    expect(r.title).toBe('Network by agency')
    expect(widgetPermissions(r.type, r.config)).toEqual(['infrastructure.view'])
    expect(widgetFilterFields(r.type, r.config)).toEqual(['agency'])
    expect(widgetEmits(r.type, r.config)).toEqual(['agency'])
  })

  it('copies the binding, so editing one widget never changes the catalog', () => {
    const a = resolveCatalogItem('preset:traffic.class_breakdown')!
    ;(a.config.binding as { limit?: number }).limit = 2
    expect(resolveCatalogItem('preset:traffic.class_breakdown')!.config.binding).toMatchObject({ limit: 6 })
  })

  it('hides generic primitives from the palette but still resolves plain types', () => {
    for (const t of ['stat', 'series', 'breakdown', 'table']) expect(WIDGETS_BY_TYPE[t]!.palette).toBe(false)
    expect(resolveCatalogItem('kpi')!.type).toBe('kpi')
    expect(resolveCatalogItem('preset:nope')).toBeNull()
    expect(resolveCatalogItem('nope')).toBeNull()
  })

  it('locks a widget bound to an unknown source', () => {
    expect(widgetPermissions('series', { binding: { source: 'nope', shape: 'series', path: 'x', measures: [] } })).toEqual(['dashboards.unknown-source'])
  })
})
