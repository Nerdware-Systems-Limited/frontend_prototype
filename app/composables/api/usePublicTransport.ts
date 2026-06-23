// app/composables/api/usePublicTransport.ts
// ─────────────────────────────────────────────────────────────────────
// M04 — Public Transport Operations (FR-M04-001..014)
//
// Backend mounted at /api/v1/public-transport/. ViewSets implemented:
//   saccos, routes, schedules, compliance, demand, brt-stops,
//   schedule-adherence, fare-collections, demand-forecasts,
//   service-quality, operator-metrics, payments, fleet-deployments,
//   feeds, feedback, psv-licenses.
// Plus the one-shot analytics endpoint at /summary/.

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

export type ServiceType = 'brt' | 'matatu' | 'ferry' | 'rail'

export interface Sacco {
  id: string
  sacco_name: string
  registration_status: 'active' | 'suspended' | 'revoked'
  contact_phone?: string
  route_count: number
  fleet_size: number
  service_quality_score: number
  created_at?: string
  updated_at?: string
}

export interface Route {
  id: string
  sacco?: string | null
  sacco_name?: string | null
  route_name: string
  route_short_name?: string
  service_type: ServiceType
  fare_kes: number
  distance_km: number
  path_geometry: [number, number][]
  geometry: [number, number][]
  stop_ids: string[]
  stop_count: number
  agency_id?: string
  is_active: boolean
}

export interface BRTStop {
  id: string
  stop_id: string
  stop_name: string
  route?: string | null
  route_name?: string | null
  latitude: number
  longitude: number
  platform_type: 'center' | 'side' | 'island'
  has_shelter: boolean
  has_ticket_machine: boolean
  accessibility_score: number
  avg_dwell_seconds: number
  avg_boarding_count: number
  is_active: boolean
}

export interface Schedule {
  id: string
  route: string
  route_name?: string
  vehicle_id: string
  day_type: 'weekday' | 'saturday' | 'sunday' | 'holiday'
  departure_time: string
  arrival_time: string
  frequency_min: number
  is_active: boolean
}

export interface ScheduleAdherence {
  id: string
  route: string
  route_name?: string
  stop?: string | null
  stop_name?: string | null
  vehicle_id: string
  scheduled_at: string
  actual_at: string
  deviation_seconds: number
  on_time: boolean
  recorded_at: string
}

export interface FareCollection {
  id: string
  route: string
  route_name?: string
  payment_channel: 'cash' | 'bebapay' | 'mpesa' | 'card' | 'other'
  transaction_count: number
  total_kes: number
  avg_fare_kes: number
  collected_hour: string
}

export interface DemandForecast {
  id: string
  route: string
  route_name?: string
  target_at: string
  horizon_hours: number
  predicted_passengers: number
  lower_passengers: number
  upper_passengers: number
  model_name: string
  model_version: string
}

export interface ServiceQualityScore {
  id: string
  route?: string | null
  route_name?: string | null
  sacco?: string | null
  sacco_name?: string | null
  period_start: string
  period_end: string
  on_time_pct: number
  complaint_rate: number
  vehicle_age_score: number
  occupancy_score: number
  composite_score: number
}

export interface OperatorMetric {
  id: string
  sacco: string
  sacco_name?: string
  period_start: string
  period_end: string
  total_trips: number
  on_time_pct: number
  complaint_count: number
  revenue_kes: number
  fleet_utilization_pct: number
  rank_position: number
}

export interface PaymentTransaction {
  id: string
  transaction_ref: string
  route?: string | null
  route_name?: string | null
  provider: 'bebapay' | 'mpesa' | 'airtel_money' | 'equity' | 'coop'
  amount_kes: number
  boarded_stop?: string | null
  boarded_stop_name?: string | null
  alighted_stop?: string
  customer_phone_hash: string
  transacted_at: string
}

export interface FleetDeployment {
  id: string
  route: string
  route_name?: string
  period_start: string
  period_end: string
  recommended_vehicles: number
  current_vehicles: number
  predicted_demand: number
  capacity_utilization_pct: number
  rationale?: string
}

export interface PTFeed {
  id: string
  feed_version: string
  status: 'draft' | 'generating' | 'published' | 'retired'
  route_count: number
  stop_count: number
  trip_count: number
  zip_sha256?: string
  zip_size_bytes: number
  download_url?: string
  generated_at: string
  published_at?: string | null
}

export interface PassengerFeedback {
  id: string
  route?: string | null
  route_name?: string | null
  sacco?: string | null
  sacco_name?: string | null
  category: 'cleanliness' | 'safety' | 'punctuality' | 'fare' | 'driver_behaviour' | 'vehicle_condition' | 'other'
  rating: number
  text: string
  status: 'open' | 'investigating' | 'resolved' | 'closed'
  submitted_at: string
  resolved_at?: string | null
}

export interface PSVLicense {
  id: string
  license_number: string
  sacco: string
  sacco_name?: string
  route: string
  route_name?: string
  issue_date: string
  expiry_date: string
  status: 'active' | 'expired' | 'suspended' | 'revoked'
  gps_compliance_pct: number
  vehicle_count: number
}

export interface PTSummary {
  kpis: {
    active_saccos: number
    total_saccos: number
    active_routes: number
    brt_routes: number
    matatu_routes: number
    scheduled_departures_24h: number
    revenue_24h_kes: number
    passenger_trips_24h: number
    open_feedback: number
  }
  revenue_24h: { hour: string; total_kes: number; transactions: number }[]
  payment_channels: { payment_channel: string; total_kes: number; transactions: number; share_pct: number }[]
  on_time_pct: number
  top_routes: { id: string; route_name: string; service_type: string; demand_count: number; on_time_count: number; total_records: number }[]
  leaderboard: { sacco__sacco_name: string; rank_position: number; on_time_pct: number; revenue_kes: number; fleet_utilization_pct: number; complaint_count: number }[]
  feedback_by_category: { category: string; total: number; avg_rating: number }[]
  expiring_licences: { license_number: string; sacco__sacco_name: string; expiry_date: string; status: string }[]
  demand_forecast_24h: { target_at: string; total_predicted: number; total_lower: number; total_upper: number }[]
  generated_at: string
}

export interface PTQuery {
  page?: number
  page_size?: number
  service_type?: ServiceType
  sacco?: string
  route?: string
  station?: string
  channel?: string
  provider?: string
  status?: string
  category?: string
  active?: boolean
  date_from?: string
  date_to?: string
}

export function usePublicTransport() {
  const api = useApi()

  return {
    summary: () => api<PTSummary>('/api/v1/public-transport/summary/'),

    saccos: (q?: PTQuery) =>
      api<Paged<Sacco>>('/api/v1/public-transport/saccos/', { query: cleanQuery(q as Record<string, unknown>) }),
    routes: (q?: PTQuery) =>
      api<Paged<Route>>('/api/v1/public-transport/routes/', { query: cleanQuery(q as Record<string, unknown>) }),
    routeCoverage: () =>
      api<{ count: number; results: { service_type: string; count: number; avg_fare: number; total_distance: number }[] }>(
        '/api/v1/public-transport/routes/coverage/',
      ),
    schedules: (q?: PTQuery) =>
      api<Paged<Schedule>>('/api/v1/public-transport/schedules/', { query: cleanQuery(q as Record<string, unknown>) }),
    compliance: (q?: PTQuery) =>
      api<Paged<{ id: string; route: string; route_name?: string; check_type: string; status: string; notes: string; checked_at: string }>>(
        '/api/v1/public-transport/compliance/', { query: cleanQuery(q as Record<string, unknown>) }),
    complianceSummary: () =>
      api<Record<string, { compliant: number; flagged: number; violation: number; total: number }>>(
        '/api/v1/public-transport/compliance/summary/',
      ),
    demand: (q?: PTQuery) =>
      api<Paged<{ id: string; route: string; origin_zone: string; destination_zone: string; passenger_count: number; surveyed_at: string }>>(
        '/api/v1/public-transport/demand/', { query: cleanQuery(q as Record<string, unknown>) }),

    brtStops: (q?: PTQuery) =>
      api<Paged<BRTStop>>('/api/v1/public-transport/brt-stops/', { query: cleanQuery(q as Record<string, unknown>) }),
    brtHeadway: () =>
      api<{ count: number; results: { route_id: string; route__route_name: string; buses_per_day: number; avg_frequency: number }[] }>(
        '/api/v1/public-transport/brt-stops/headway/',
      ),

    scheduleAdherence: (q?: PTQuery) =>
      api<Paged<ScheduleAdherence>>('/api/v1/public-transport/schedule-adherence/', { query: cleanQuery(q as Record<string, unknown>) }),
    onTimeStats: (days = 7) =>
      api<{ count: number; results: { route_id: string; route__route_name: string; total: number; on_time: number; on_time_pct: number }[]; days: number }>(
        `/api/v1/public-transport/schedule-adherence/on-time/?days=${days}`,
      ),

    fareCollections: (q?: PTQuery) =>
      api<Paged<FareCollection>>('/api/v1/public-transport/fare-collections/', { query: cleanQuery(q as Record<string, unknown>) }),
    revenueTrend: (days = 7) =>
      api<{ count: number; results: { collected_hour: string; total_kes: number; transactions: number }[]; days: number }>(
        `/api/v1/public-transport/fare-collections/revenue-trend/?days=${days}`,
      ),
    revenueByChannel: (days = 7) =>
      api<{ count: number; results: { payment_channel: string; total_kes: number; transactions: number; share_pct: number }[]; days: number }>(
        `/api/v1/public-transport/fare-collections/by-channel/?days=${days}`,
      ),

    demandForecasts: (q?: PTQuery) =>
      api<Paged<DemandForecast>>('/api/v1/public-transport/demand-forecasts/', { query: cleanQuery(q as Record<string, unknown>) }),
    serviceQuality: (q?: PTQuery) =>
      api<Paged<ServiceQualityScore>>('/api/v1/public-transport/service-quality/', { query: cleanQuery(q as Record<string, unknown>) }),
    operatorMetrics: (q?: PTQuery) =>
      api<Paged<OperatorMetric>>('/api/v1/public-transport/operator-metrics/', { query: cleanQuery(q as Record<string, unknown>) }),
    leaderboard: () =>
      api<{ count: number; period_end: string | null; results: OperatorMetric[] }>(
        '/api/v1/public-transport/operator-metrics/leaderboard/',
      ),
    payments: (q?: PTQuery) =>
      api<Paged<PaymentTransaction>>('/api/v1/public-transport/payments/', { query: cleanQuery(q as Record<string, unknown>) }),
    fleetDeployments: (q?: PTQuery) =>
      api<Paged<FleetDeployment>>('/api/v1/public-transport/fleet-deployments/', { query: cleanQuery(q as Record<string, unknown>) }),
    feeds: (q?: PTQuery) =>
      api<Paged<PTFeed>>('/api/v1/public-transport/feeds/', { query: cleanQuery(q as Record<string, unknown>) }),
    publishFeed: (id: string) =>
      api<PTFeed>(`/api/v1/public-transport/feeds/${id}/publish/`, { method: 'POST' }),
    feedback: (q?: PTQuery) =>
      api<Paged<PassengerFeedback>>('/api/v1/public-transport/feedback/', { query: cleanQuery(q as Record<string, unknown>) }),
    feedbackByCategory: () =>
      api<{ count: number; results: { category: string; total: number; avg_rating: number }[] }>(
        '/api/v1/public-transport/feedback/by-category/',
      ),
    psvLicenses: (q?: PTQuery) =>
      api<Paged<PSVLicense>>('/api/v1/public-transport/psv-licenses/', { query: cleanQuery(q as Record<string, unknown>) }),
    expiringLicenses: (days = 90) =>
      api<PSVLicense[]>(`/api/v1/public-transport/psv-licenses/expiring/?days=${days}`),

    // Map data: routes + BRT stops as polylines + markers.
    mapData: async () => {
      const [routes, stops] = await Promise.all([
        api<Paged<Route>>('/api/v1/public-transport/routes/', { query: { page_size: 80 } }),
        api<Paged<BRTStop>>('/api/v1/public-transport/brt-stops/', { query: { page_size: 200 } }),
      ])
      const lines: import('~/components/UaptsMap.vue').LineSpec[] = []
      const markers: import('~/components/UaptsMap.vue').MarkerSpec[] = []      
      for (const r of (routes as any).results ?? []) {
        const pts = r.path_geometry ?? r.geometry
        if (pts && pts.length >= 2) {
          lines.push({
            id: `route-${r.id}`,
            points: pts,
            color: r.service_type === 'brt' ? 'orange' : 'blue',
            weight: r.service_type === 'brt' ? 5 : 3,
            opacity: 0.7,
            label: r.route_name,
          })
        }
      }
      for (const s of (stops as any).results ?? []) {
        if (s.latitude == null || s.longitude == null) continue
        markers.push({
          id: `stop-${s.id}`,
          lat: s.latitude,
          lon: s.longitude,
          title: s.stop_name,
          subtitle: `Stop ${s.stop_id} · ${s.avg_boarding_count} boardings · ${s.avg_dwell_seconds}s dwell`,
          color: 'yellow',
          size: 'sm',
        })
      }
      return { lines, markers }
    },
  }
}