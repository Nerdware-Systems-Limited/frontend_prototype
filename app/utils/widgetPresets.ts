/**
 * Widget presets - named bindings on the generic primitives (docs/Widgets.md §5.1).
 *
 * A preset is what an author picks in the palette ("Traffic volume, 24h");
 * placing it creates a plain `series` / `breakdown` / `table` / `stat`
 * widget whose config carries the binding. Adding a chart for data that is
 * already in a source payload = one entry here, no new component.
 *
 * Every path below is checked against the payload types in
 * composables/api (TrafficSummary, PTSummary, SafetySummary, …).
 * FleetSummary.governor_compliance is deliberately NOT bound: the backend
 * returns hardcoded zeros there (see useFleet.ts).
 */
import type { Binding } from '~/types/frame'
import type { WidgetCategory, WidgetSize } from '~/types/dashboard'

export type GenericWidgetType = 'stat' | 'series' | 'breakdown' | 'table'

export interface WidgetPreset {
  id: string
  type: GenericWidgetType
  title: string
  description: string
  category: WidgetCategory
  defaultSize: WidgetSize
  binding: Binding
  /** Extra config (series mode, stat period / drill-down). */
  config?: Record<string, unknown>
}

const s = (id: string, title: string, description: string, binding: Binding, config: Record<string, unknown> = {}, size: WidgetSize = { w: 6, h: 3 }): WidgetPreset =>
  ({ id, type: 'series', title, description, category: 'Charts', defaultSize: size, binding, config })
const b = (id: string, title: string, description: string, binding: Binding, size: WidgetSize = { w: 4, h: 3 }): WidgetPreset =>
  ({ id, type: 'breakdown', title, description, category: 'Charts', defaultSize: size, binding })
const t = (id: string, title: string, description: string, binding: Binding, size: WidgetSize = { w: 6, h: 4 }): WidgetPreset =>
  ({ id, type: 'table', title, description, category: 'Operations', defaultSize: size, binding })
const k = (id: string, title: string, description: string, binding: Binding, config: Record<string, unknown>): WidgetPreset =>
  ({ id, type: 'stat', title, description, category: 'KPIs', defaultSize: { w: 2, h: 2 }, binding, config })

const hour = { key: 'hour', label: 'Hour', kind: 'time' as const }

export const PRESETS: WidgetPreset[] = [
  // ── M02 Road traffic (KeNHA ATC / RTMS) ───────────────────────────────
  s('traffic.volume_24h', 'Traffic volume, 24h', 'Vehicles counted per hour across active counting stations.',
    { source: 'traffic.summary', shape: 'series', path: 'volume_24h', dimension: hour, measures: [{ key: 'volume', label: 'Vehicles', unit: 'count' }] },
    { mode: 'bars' }),
  s('traffic.speed_24h', 'Average speed, 24h', 'Mean observed speed per hour.',
    { source: 'traffic.summary', shape: 'series', path: 'volume_24h', dimension: hour, measures: [{ key: 'avg_speed', label: 'Average speed', unit: 'kmh' }] }),
  b('traffic.class_breakdown', 'Traffic by vehicle class', 'Share of counted vehicles by class. Click a class to filter linked widgets.',
    { source: 'traffic.summary', shape: 'categorical', path: 'class_breakdown', dimension: { key: 'vehicle_class', label: 'Vehicle class' }, measures: [{ key: 'total', label: 'Vehicles', unit: 'count' }], limit: 6, emits: 'vehicle_class' }),
  b('traffic.congestion', 'Congestion by level', 'Observed road segments at each congestion level.',
    { source: 'traffic.summary', shape: 'categorical', path: 'congestion_distribution', dimension: { key: 'level', label: 'Congestion level' }, measures: [{ key: 'segments', label: 'Segments', unit: 'count' }] }),
  k('traffic.volume_total', 'Traffic volume (24h)', 'Total vehicles counted in the last 24 hours.',
    { source: 'traffic.summary', shape: 'scalar', path: 'kpis.total_volume_24h', measures: [{ key: 'value', label: 'Traffic volume', unit: 'count' }] },
    { period: '24H', description: 'Vehicles counted', to: '/traffic' }),
  k('traffic.congestion_events', 'Active congestion events', 'Congestion events currently open.',
    { source: 'traffic.summary', shape: 'scalar', path: 'kpis.active_congestion_events', measures: [{ key: 'value', label: 'Congestion events', unit: 'count' }] },
    { period: 'LIVE', description: 'Open events', to: '/traffic' }),
  k('traffic.speed_compliance', 'Speed compliance', 'Average share of observations within the limit.',
    { source: 'traffic.summary', shape: 'scalar', path: 'speed_compliance.avg_compliance_pct', measures: [{ key: 'value', label: 'Speed compliance', unit: 'pct' }] },
    { period: '24H', description: 'Within speed limit', to: '/traffic/analytics' }),

  // ── M04 Public transport (NaMATA / NTSA) ──────────────────────────────
  s('pt.revenue_24h', 'Fare revenue, 24h', 'Fare collections per hour.',
    { source: 'pt.summary', shape: 'series', path: 'revenue_24h', dimension: hour, measures: [{ key: 'total_kes', label: 'Revenue', unit: 'kes' }] },
    { mode: 'bars' }),
  s('pt.demand_forecast', 'Demand forecast, next 24h', 'Predicted passenger demand with its lower and upper bounds.',
    { source: 'pt.summary', shape: 'series', path: 'demand_forecast_24h', dimension: { key: 'target_at', label: 'Time', kind: 'time' },
      measures: [{ key: 'total_predicted', label: 'Predicted', unit: 'count' }, { key: 'total_lower', label: 'Lower bound', unit: 'count' }, { key: 'total_upper', label: 'Upper bound', unit: 'count' }] }),
  b('pt.payment_channels', 'Fares by payment channel', 'Fare revenue by payment channel.',
    { source: 'pt.summary', shape: 'categorical', path: 'payment_channels', dimension: { key: 'payment_channel', label: 'Channel' }, measures: [{ key: 'total_kes', label: 'Revenue', unit: 'kes' }], limit: 6 }),
  b('pt.feedback', 'Passenger feedback by category', 'Feedback items received, by category.',
    { source: 'pt.summary', shape: 'categorical', path: 'feedback_by_category', dimension: { key: 'category', label: 'Category' }, measures: [{ key: 'total', label: 'Items', unit: 'count' }], limit: 6 }),
  t('pt.leaderboard', 'SACCO leaderboard', 'Operator ranking by punctuality, revenue, utilisation and complaints.',
    { source: 'pt.summary', shape: 'rows', path: 'leaderboard', columns: [{ key: 'sacco__sacco_name', label: 'SACCO' }],
      measures: [{ key: 'rank_position', label: 'Rank', unit: 'count' }, { key: 'on_time_pct', label: 'On time', unit: 'pct' }, { key: 'revenue_kes', label: 'Revenue', unit: 'kes' }, { key: 'fleet_utilization_pct', label: 'Fleet use', unit: 'pct' }, { key: 'complaint_count', label: 'Complaints', unit: 'count' }],
      sort: { key: 'rank_position', dir: 'asc' } }),
  t('pt.expiring_licences', 'PSV licences expiring', 'Operator licences approaching expiry, soonest first.',
    { source: 'pt.summary', shape: 'rows', path: 'expiring_licences',
      columns: [{ key: 'sacco__sacco_name', label: 'SACCO' }, { key: 'license_number', label: 'Licence' }, { key: 'expiry_date', label: 'Expires' }, { key: 'status', label: 'Status' }],
      measures: [], sort: { key: 'expiry_date', dir: 'asc' } }),
  t('pt.top_routes', 'Busiest routes', 'Routes by recorded demand.',
    { source: 'pt.summary', shape: 'rows', path: 'top_routes', columns: [{ key: 'route_name', label: 'Route' }, { key: 'service_type', label: 'Service' }],
      measures: [{ key: 'demand_count', label: 'Demand', unit: 'count' }, { key: 'on_time_count', label: 'On time', unit: 'count' }], sort: { key: 'demand_count', dir: 'desc' } }),
  k('pt.trips_24h', 'Passenger trips (24h)', 'Passenger trips recorded in the last 24 hours.',
    { source: 'pt.summary', shape: 'scalar', path: 'kpis.passenger_trips_24h', measures: [{ key: 'value', label: 'Passenger trips', unit: 'count' }] },
    { period: '24H', description: 'Trips recorded', to: '/public-transport' }),
  k('pt.on_time', 'PSV on-time performance', 'Share of scheduled departures on time.',
    { source: 'pt.summary', shape: 'scalar', path: 'on_time_pct', measures: [{ key: 'value', label: 'On-time', unit: 'pct' }] },
    { period: '24H', description: 'Departures on time', to: '/public-transport/brt' }),

  // ── M05 Safety (NTSA IRSMS) ───────────────────────────────────────────
  b('safety.by_severity', 'Incidents by severity', 'Recorded incidents by severity. Click a severity to filter linked widgets.',
    { source: 'safety.summary', shape: 'categorical', path: 'incidents_by_severity', dimension: { key: 'severity', label: 'Severity' }, measures: [{ key: 'incidents', label: 'Incidents', unit: 'count' }], emits: 'severity' }),
  b('safety.by_type', 'Incidents by type', 'Recorded incidents by type, top six.',
    { source: 'safety.summary', shape: 'categorical', path: 'incidents_by_type', dimension: { key: 'type', label: 'Incident type' }, measures: [{ key: 'incidents', label: 'Incidents', unit: 'count' }], limit: 6 }),
  b('safety.blackspots_by_tier', 'Black spots by tier', 'Active accident clusters by risk tier.',
    { source: 'safety.summary', shape: 'categorical', path: 'black_spots_by_tier', dimension: { key: 'tier', label: 'Tier' }, measures: [{ key: 'spots', label: 'Black spots', unit: 'count' }] }),
  k('safety.violations_24h', 'Traffic violations (24h)', 'Violations recorded in the last 24 hours.',
    { source: 'safety.summary', shape: 'scalar', path: 'recent_violations_24h', measures: [{ key: 'value', label: 'Violations', unit: 'count' }] },
    { period: '24H', description: 'Violations recorded', to: '/safety' }),

  // ── M03 Fleet (NTSA iTIMS) ────────────────────────────────────────────
  b('fleet.by_type', 'Fleet by vehicle type', 'Registered vehicles by type.',
    { source: 'fleet.summary', shape: 'categorical', path: 'vehicles_by_type', dimension: { key: 'vehicle_type', label: 'Vehicle type' }, measures: [{ key: 'total', label: 'Vehicles', unit: 'count' }], limit: 6 }),
  b('fleet.by_status', 'Fleet by status', 'Registered vehicles by operating status.',
    { source: 'fleet.summary', shape: 'categorical', path: 'vehicles_by_status', dimension: { key: 'status', label: 'Status' }, measures: [{ key: 'vehicles', label: 'Vehicles', unit: 'count' }] }),
  b('fleet.behaviour_24h', 'Driver behaviour events (24h)', 'Harsh braking, speeding and other events by type.',
    { source: 'fleet.summary', shape: 'categorical', path: 'behaviour_events_24h', dimension: { key: 'event', label: 'Event' }, measures: [{ key: 'events', label: 'Events', unit: 'count' }], limit: 6 }),
  t('fleet.geofence_breaches', 'Geofence breaches (24h)', 'Zones with the most breaches in the last 24 hours.',
    { source: 'fleet.summary', shape: 'rows', path: 'top_breaches_24h', columns: [{ key: 'geofence__zone_name', label: 'Zone' }, { key: 'geofence__zone_type', label: 'Type' }],
      measures: [{ key: 'c', label: 'Breaches', unit: 'count' }], sort: { key: 'c', dir: 'desc' } }, { w: 4, h: 4 }),
  k('fleet.trips_7d', 'Fleet trips (7d)', 'Tracked trips in the last 7 days.',
    { source: 'fleet.summary', shape: 'scalar', path: 'kpis.trips_7d', measures: [{ key: 'value', label: 'Trips', unit: 'count' }] },
    { period: '7D', description: 'Tracked trips', to: '/fleet' }),
  k('fleet.distance_7d', 'Fleet distance (7d)', 'Distance covered by tracked vehicles in 7 days.',
    { source: 'fleet.summary', shape: 'scalar', path: 'kpis.distance_7d_km', measures: [{ key: 'value', label: 'Distance', unit: 'km' }] },
    { period: '7D', description: 'Tracked distance', to: '/fleet' }),

  // ── M08 Rail (KRC) ────────────────────────────────────────────────────
  t('rail.top_routes', 'Top rail routes', 'Origin-destination pairs by bookings and revenue.',
    { source: 'rail.summary', shape: 'rows', path: 'top_routes', columns: [{ key: 'origin__name', label: 'From' }, { key: 'destination__name', label: 'To' }],
      measures: [{ key: 'bookings', label: 'Bookings', unit: 'count' }, { key: 'revenue', label: 'Revenue', unit: 'kes' }], sort: { key: 'bookings', dir: 'desc' } }),

  k('rail.trains_in_service', 'Trains in service', 'Trains currently in service across SGR and MGR.',
    { source: 'rail.summary', shape: 'scalar', path: 'kpis.trains_in_service', measures: [{ key: 'value', label: 'Trains in service', unit: 'count' }] },
    { period: 'LIVE', description: 'In service now', to: '/railway/live' }),
  k('rail.operations_24h', 'Train operations (24h)', 'Train runs recorded in the last 24 hours.',
    { source: 'rail.summary', shape: 'scalar', path: 'kpis.operations_24h', measures: [{ key: 'value', label: 'Operations', unit: 'count' }] },
    { period: '24H', description: 'Train runs', to: '/railway/schedules' }),
  k('rail.avg_delay', 'Average train delay', 'Mean arrival delay over 30 days.',
    { source: 'rail.summary', shape: 'scalar', path: 'on_time_30d.avg_delay_min', measures: [{ key: 'value', label: 'Average delay', unit: 'min' }] },
    { period: '30D', description: 'Mean arrival delay', to: '/railway/schedules' }),
  k('rail.freight_tons', 'Rail freight (30d)', 'Freight tonnage moved by rail in 30 days.',
    { source: 'rail.summary', shape: 'scalar', path: 'freight_30d.total_tons', measures: [{ key: 'value', label: 'Rail freight', unit: 'tonnes' }] },
    { period: '30D', description: 'Tonnes moved', to: '/railway/freight' }),
  k('rail.freight_revenue', 'Rail freight revenue (30d)', 'Freight revenue in 30 days.',
    { source: 'rail.summary', shape: 'scalar', path: 'freight_30d.total_revenue_kes', measures: [{ key: 'value', label: 'Freight revenue', unit: 'kes' }] },
    { period: '30D', description: 'Freight revenue', to: '/railway/freight' }),
  k('rail.passenger_revenue', 'Passenger revenue (30d)', 'Ticket revenue in 30 days.',
    { source: 'rail.summary', shape: 'scalar', path: 'ridership_30d.revenue_kes', measures: [{ key: 'value', label: 'Passenger revenue', unit: 'kes' }] },
    { period: '30D', description: 'Ticket revenue', to: '/railway' }),
  k('rail.no_show', 'Passenger no-show rate', 'Share of booked passengers who did not travel (30 days).',
    { source: 'rail.summary', shape: 'scalar', path: 'ridership_30d.no_show_rate_pct', measures: [{ key: 'value', label: 'No-show rate', unit: 'pct' }] },
    { period: '30D', description: 'Booked, did not travel', to: '/railway' }),
  k('rail.open_incidents', 'Open rail incidents', 'Rail incidents not yet closed.',
    { source: 'rail.summary', shape: 'scalar', path: 'kpis.open_incidents', measures: [{ key: 'value', label: 'Open incidents', unit: 'count' }] },
    { period: 'LIVE', description: 'Not yet closed', to: '/railway/safety' }),
  k('rail.level_crossing', 'Level-crossing incidents (90d)', 'Incidents at level crossings in 90 days.',
    { source: 'rail.summary', shape: 'scalar', path: 'incidents_90d.level_crossing', measures: [{ key: 'value', label: 'Level-crossing incidents', unit: 'count' }] },
    { period: '90D', description: 'At level crossings', to: '/railway/safety' }),
  t('rail.live_operations', 'Live train operations', 'Trains running now: route, status, delay and occupancy.',
    { source: 'rail.summary', shape: 'rows', path: 'live_operations',
      columns: [{ key: 'train_number', label: 'Train' }, { key: 'origin_code', label: 'From' }, { key: 'destination_code', label: 'To' }, { key: 'status', label: 'Status' }, { key: 'current_station_code', label: 'At' }],
      measures: [{ key: 'delay_arrival_min', label: 'Delay', unit: 'min' }, { key: 'occupancy_pct', label: 'Occupancy', unit: 'pct' }],
      sort: { key: 'delay_arrival_min', dir: 'desc' } }, { w: 8, h: 4 }),
  t('rail.freight_corridors', 'Top freight corridors', 'Station pairs by freight tonnage (30 days).',
    { source: 'rail.summary', shape: 'rows', path: 'freight_30d.top_corridors',
      columns: [{ key: 'origin_station__code', label: 'From' }, { key: 'destination_station__code', label: 'To' }, { key: 'cargo_type', label: 'Cargo' }],
      measures: [{ key: 'tons', label: 'Tonnes', unit: 'tonnes' }, { key: 'shipments', label: 'Shipments', unit: 'count' }],
      sort: { key: 'tons', dir: 'desc' } }),

  // ── M07a Aviation (KAA / KCAA) ────────────────────────────────────────
  b('aviation.by_status', 'Flights by status', 'Flights in the last 7 days by status.',
    { source: 'aviation.summary', shape: 'categorical', path: 'by_status', dimension: { key: 'status', label: 'Status' }, measures: [{ key: 'c', label: 'Flights', unit: 'count' }] }),
  k('aviation.cargo_7d', 'Air cargo (7d)', 'Cargo handled across airports in 7 days.',
    { source: 'aviation.summary', shape: 'scalar', path: 'kpis.cargo_kg_total', measures: [{ key: 'value', label: 'Air cargo', unit: 'kg' }] },
    { period: '7D', description: 'Cargo handled', to: '/aviation' }),
  k('aviation.flights_7d', 'Flights (7d)', 'Flights operated across airports in 7 days.',
    { source: 'aviation.summary', shape: 'scalar', path: 'kpis.flights_total', measures: [{ key: 'value', label: 'Flights', unit: 'count' }] },
    { period: '7D', description: 'Flights operated', to: '/aviation/flights' }),
  k('aviation.avg_delay', 'Average flight delay', 'Mean flight delay over 7 days.',
    { source: 'aviation.summary', shape: 'scalar', path: 'kpis.avg_delay_min', measures: [{ key: 'value', label: 'Average delay', unit: 'min' }] },
    { period: '7D', description: 'Mean delay', to: '/aviation/flights' }),
  k('aviation.runway_availability', 'Runway availability', 'Share of runways available for operations.',
    { source: 'aviation.infra', shape: 'scalar', path: 'kpis.runway_availability_pct', measures: [{ key: 'value', label: 'Runway availability', unit: 'pct' }] },
    { period: 'LATEST', description: 'Runways available', to: '/aviation/infrastructure' }),
  k('aviation.navaids', 'Navaids operational', 'Share of navigation aids operational.',
    { source: 'aviation.infra', shape: 'scalar', path: 'kpis.navaid_operational_pct', measures: [{ key: 'value', label: 'Navaids operational', unit: 'pct' }] },
    { period: 'LATEST', description: 'Navaids working', to: '/aviation/infrastructure' }),
  k('aviation.work_orders', 'Open airport work orders', 'Maintenance work orders still open.',
    { source: 'aviation.infra', shape: 'scalar', path: 'kpis.open_work_orders', measures: [{ key: 'value', label: 'Open work orders', unit: 'count' }] },
    { period: 'LIVE', description: 'Still open', to: '/aviation/infrastructure' }),

  // ── M07b Maritime (KPA) ───────────────────────────────────────────────
  t('maritime.ports', 'Port throughput', 'Each port: containers handled, vessels in port and yard dwell (30 days).',
    { source: 'maritime.ops', shape: 'rows', path: 'ports', columns: [{ key: 'port_name', label: 'Port' }],
      measures: [{ key: 'teu_throughput_30d', label: 'Throughput', unit: 'teu' }, { key: 'currently_in_port', label: 'In port', unit: 'count' }, { key: 'avg_yard_dwell_days', label: 'Yard dwell', unit: 'days' }],
      sort: { key: 'teu_throughput_30d', dir: 'desc' } }),
  b('maritime.arrivals', 'Vessel arrivals by port', 'Vessel arrivals per port in 30 days.',
    { source: 'maritime.ops', shape: 'categorical', path: 'ports', dimension: { key: 'port_name', label: 'Port' }, measures: [{ key: 'arrivals_30d', label: 'Arrivals', unit: 'count' }], limit: 6 }),
  b('maritime.cargo_by_port', 'Cargo tonnage by port', 'Cargo handled per port in 30 days.',
    { source: 'maritime.cargo', shape: 'categorical', path: 'ports', dimension: { key: 'port_name', label: 'Port' }, measures: [{ key: 'cargo_tonnes', label: 'Cargo', unit: 'tonnes' }], limit: 6 }),
  k('maritime.live_vessels', 'Vessels tracked', 'Vessels currently tracked in Kenyan waters.',
    { source: 'maritime.ops', shape: 'scalar', path: 'kpis.live_vessels', measures: [{ key: 'value', label: 'Vessels', unit: 'count' }] },
    { period: 'LIVE', description: 'Tracked now', to: '/maritime/vessels' }),
  k('maritime.incidents_30d', 'Maritime incidents (30d)', 'Maritime incidents reported in 30 days.',
    { source: 'maritime.ops', shape: 'scalar', path: 'kpis.incidents_30d', measures: [{ key: 'value', label: 'Incidents', unit: 'count' }] },
    { period: '30D', description: 'Incidents reported', to: '/maritime/accidents' }),
  k('maritime.detentions_30d', 'Vessel detentions (30d)', 'Port-state detentions in 30 days.',
    { source: 'maritime.ops', shape: 'scalar', path: 'kpis.detentions_30d', measures: [{ key: 'value', label: 'Detentions', unit: 'count' }] },
    { period: '30D', description: 'Vessels detained', to: '/maritime/vessels' }),

  // ── M14 Training institutes ───────────────────────────────────────────
  k('training.enrollments', 'Trainees enrolled', 'Enrolments across accredited training institutes.',
    { source: 'training.overview', shape: 'scalar', path: 'kpis.enrollments', measures: [{ key: 'value', label: 'Enrolments', unit: 'count' }] },
    { period: 'ALL', description: 'Enrolments recorded', to: '/training/enrollments' }),
  k('training.ongoing_cohorts', 'Cohorts in session', 'Training cohorts currently running.',
    { source: 'training.overview', shape: 'scalar', path: 'kpis.ongoing_cohorts', measures: [{ key: 'value', label: 'Cohorts running', unit: 'count' }] },
    { period: 'LIVE', description: 'Running now', to: '/training/cohorts' }),
  k('training.active_courses', 'Active courses', 'Courses currently offered.',
    { source: 'training.overview', shape: 'scalar', path: 'kpis.active_courses', measures: [{ key: 'value', label: 'Active courses', unit: 'count' }] },
    { period: 'LATEST', description: 'Courses offered', to: '/training' }),
  k('training.pass_rate', 'Training pass rate', 'Share of completions that passed (pass or distinction).',
    { source: 'training.overview', shape: 'scalar', path: 'kpis.pass_rate_pct', measures: [{ key: 'value', label: 'Pass rate', unit: 'pct' }] },
    { period: 'ALL', description: 'Passed or distinction', to: '/training/completions' }),
  b('training.enrollment_status', 'Enrolments by status', 'Trainees by enrolment status.',
    { source: 'training.enrollment-status', shape: 'categorical', path: '', dimension: { key: 'status', label: 'Status' }, measures: [{ key: 'enrollments', label: 'Enrolments', unit: 'count' }] }),
  b('training.outcomes', 'Completions by outcome', 'Completed training by result.',
    { source: 'training.outcomes', shape: 'categorical', path: '', dimension: { key: 'outcome', label: 'Outcome' }, measures: [{ key: 'completions', label: 'Completions', unit: 'count' }] }),
  b('training.revenue_by_stream', 'Training revenue by stream', 'Fees, grants and sponsorship received.',
    { source: 'training.revenue', shape: 'categorical', path: 'by_stream', dimension: { key: 'revenue_stream', label: 'Stream' }, measures: [{ key: 'total_kes', label: 'Revenue', unit: 'kes' }] }),
  s('training.revenue_monthly', 'Training revenue by month', 'Revenue received per month.',
    { source: 'training.revenue', shape: 'series', path: 'monthly', dimension: { key: 'period', label: 'Month', kind: 'time' }, measures: [{ key: 'total_kes', label: 'Revenue', unit: 'kes' }] },
    { mode: 'bars' }),
  t('training.cohorts', 'Running and upcoming cohorts', 'Cohorts in session or scheduled, with how full they are.',
    { source: 'training.cohorts', shape: 'rows', path: '',
      columns: [{ key: 'cohort_code', label: 'Cohort' }, { key: 'course', label: 'Course' }, { key: 'institute', label: 'Institute' }, { key: 'status', label: 'Status' }, { key: 'start_date', label: 'Starts' }],
      measures: [{ key: 'enrolled_count', label: 'Enrolled', unit: 'count' }, { key: 'capacity', label: 'Capacity', unit: 'count' }, { key: 'fill_rate_pct', label: 'Fill', unit: 'pct' }],
      sort: { key: 'start_date', dir: 'asc' } }, { w: 8, h: 4 }),

  // ── M06 Infrastructure (KeNHA / KURA / KeRRA, BMS) ───────────────────
  b('infra.condition', 'Network by condition', 'Road length by surveyed condition class.',
    { source: 'infra.summary', shape: 'categorical', path: 'network.condition_distribution', dimension: { key: 'condition_class', label: 'Condition' }, measures: [{ key: 'length', label: 'Length', unit: 'km' }] }),
  b('infra.by_agency', 'Network by agency', 'Road length managed by each agency. Click an agency to filter linked widgets.',
    { source: 'infra.summary', shape: 'categorical', path: 'network.by_agency', dimension: { key: 'agency_code', label: 'Agency' }, measures: [{ key: 'total_length_km', label: 'Length', unit: 'km' }], emits: 'agency' }),
  b('infra.bridges_condition', 'Bridges by condition', 'Surveyed bridges by condition class.',
    { source: 'infra.summary', shape: 'categorical', path: 'bridges.by_condition_class', dimension: { key: 'condition', label: 'Condition' }, measures: [{ key: 'bridges', label: 'Bridges', unit: 'count' }] }),
  t('infra.corridors', 'Construction by corridor', 'Project portfolio per corridor: contract value, disbursed and physical progress.',
    { source: 'infra.summary', shape: 'rows', path: 'construction.portfolio_by_corridor', columns: [{ key: 'corridor', label: 'Corridor' }],
      measures: [{ key: 'count', label: 'Projects', unit: 'count' }, { key: 'contract_sum', label: 'Contract', unit: 'kes' }, { key: 'disbursed', label: 'Disbursed', unit: 'kes' }, { key: 'avg_physical', label: 'Progress', unit: 'pct' }],
      sort: { key: 'contract_sum', dir: 'desc' } }),
  k('infra.streetlights', 'Street lighting operational', 'Share of street lights reported working.',
    { source: 'infra.summary', shape: 'scalar', path: 'streetlights.operational_pct', measures: [{ key: 'value', label: 'Street lighting', unit: 'pct' }] },
    { period: 'LATEST', description: 'Lights operational', to: '/infrastructure' }),
]

export const PRESETS_BY_ID: Record<string, WidgetPreset> = Object.fromEntries(PRESETS.map(p => [p.id, p]))
