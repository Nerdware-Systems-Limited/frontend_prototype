// app/composables/api/useSafety.ts
// ─────────────────────────────────────────────────────────────────────
// M05 — Safety & Incident Management.
//
// Backend surface: /api/v1/safety/
//   /incidents/, /accidents/, /black-spots/, /emergency-dispatches/,
//   /predictive-hotspots/, /kpis/, /interventions/, /traffic-violations/,
//   /summary/.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

// ── Domain enums ────────────────────────────────────────────────────

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical' | 'fatal'
export type IncidentStatus =
  | 'reported' | 'triaged' | 'dispatched' | 'on_scene'
  | 'resolved' | 'closed' | 'cancelled'
export type IncidentType =
  | 'accident' | 'near_miss' | 'breakdown' | 'hazard' | 'violation' | 'other'
export type ReportingChannel =
  | 'mobile_app' | 'hotline' | 'radio' | 'partner_api' | 'roadside_cam'
  | 'social_media' | 'other'
export type DispatchServiceType =
  | 'ambulance' | 'fire' | 'police' | 'tow' | 'traffic_management' | 'hazmat'
export type DispatchStatus =
  | 'recommended' | 'acknowledged' | 'en_route' | 'on_scene'
  | 'completed' | 'cancelled'
export type BlackSpotTier = 'critical' | 'high' | 'medium' | 'low'
export type RiskTier = 'critical' | 'high' | 'medium' | 'low'
export type ViolationType =
  | 'speeding' | 'red_light' | 'wrong_way' | 'no_seatbelt'
  | 'overloading' | 'no_license' | 'other'
export type InterventionType =
  | 'rumble_strip' | 'speed_table' | 'signage' | 'streetlight'
  | 'guardrail' | 'rechannelization' | 'crosswalk' | 'other'

// ── Shapes ──────────────────────────────────────────────────────────

export interface Incident {
  id: string
  reference_code: string
  segment: string | null
  segment_code: string | null
  reporting_agency: string | null
  reporting_agency_code: string | null
  reported_by: string | null
  reported_by_email: string | null
  incident_type: IncidentType
  reporting_channel: ReportingChannel
  severity: IncidentSeverity
  status: IncidentStatus
  title: string
  description: string
  latitude: number | null
  longitude: number | null
  casualties: number
  vehicles_involved: number
  reported_at: string
  triaged_at: string | null
  resolved_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  dispatch_count: number
}

export interface Accident {
  id: string
  segment: string | null
  segment_code: string | null
  black_spot: string | null
  incident: string | null
  incident_ref: string | null
  fatality_category: string
  fatalities: number
  serious_injuries: number
  minor_injuries: number
  cause_of_accident: string
  weather_condition: string
  road_condition: string
  severity_classification: string
  occurred_at: string
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

export interface BlackSpot {
  id: string
  segment: string | null
  segment_road_code: string | null
  segment_road_name: string | null
  accident_count_rolling: number
  fatality_count_rolling: number
  ranking_tier: BlackSpotTier
  kde_intensity: number | null
  radius_m: number | null
  window_days: number
  centroid_latitude: number | null
  centroid_longitude: number | null
  last_computed_at: string
  created_at: string
  updated_at: string
}

export interface EmergencyDispatch {
  id: string
  incident: string
  incident_ref: string
  incident_status: IncidentStatus
  service_type: DispatchServiceType
  target_agency: string | null
  target_agency_code: string | null
  status: DispatchStatus
  recommended_eta_minutes: number | null
  recommended_units: number | null
  rationale: string
  acknowledged_at: string | null
  arrived_at: string | null
  completed_at: string | null
  created_at: string
}

export interface PredictiveHotspot {
  id: string
  segment: string | null
  segment_road_code: string | null
  latitude: number
  longitude: number
  grid_cell_id: string
  predicted_risk_score: number
  risk_tier: RiskTier
  horizon_days: number
  confidence_pct: number | null
  contributing_factors: Record<string, number> | null
  model_name: string
  model_version: string
  computed_at: string
  created_at: string
  updated_at: string
}

export interface SafetyKPI {
  id: string
  agency: string | null
  agency_code: string | null
  date: string
  county: string
  total_incidents: number
  fatal_count: number
  serious_count: number
  minor_count: number
  fatalities: number
  injuries: number
  avg_response_minutes: number | null
  interventions_evaluated: number
  intervention_effectiveness_pct: number | null
  created_at: string
  updated_at: string
}

export interface SafetyIntervention {
  id: string
  segment: string | null
  segment_road_code: string | null
  intervention_type: InterventionType
  description: string
  installed_at: string | null
  cost_kes: number | null
  before_count: number | null
  after_count: number | null
  effectiveness_pct: number | null
  evaluated_at: string | null
  created_at: string
  updated_at: string
}

export interface TrafficViolation {
  id: string
  vehicle: string | null
  plate_number: string
  violation_type: ViolationType
  fine_kes: number | null
  latitude: number | null
  longitude: number | null
  occurred_at: string
  notes: string
  created_at: string
  updated_at: string
}

// ── Summary analytics payload ───────────────────────────────────────

export interface SafetySummary {
  kpis: {
    total_24h: number
    total_7d: number
    total_30d: number
    active: number
    fatal_30d: number
  }
  incidents_by_severity: Record<string, number>
  incidents_by_type: Record<string, number>
  fatality_trend_30d: Array<{ day: string; fatalities: number }>
  top_predictive_hotspots: Array<{
    id: string
    latitude: number
    longitude: number
    predicted_risk_score: number
    risk_tier: RiskTier
  }>
  black_spots_by_tier: Record<string, number>
  intervention_effectiveness: {
    average_pct: number
    total_evaluated: number
  }
  active_dispatches: number
  recent_violations_24h: number
  generated_at: string
}

// ── Query type ──────────────────────────────────────────────────────

export interface SafetyQuery {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
  [k: string]: unknown
}

// ── Composable ──────────────────────────────────────────────────────

export function useSafety() {
  const api = useApi()
  const S = '/api/v1/safety'

  return {
    // ── Dashboard / summary ────────────────────────────────────────
    summary: () => api<SafetySummary>(`${S}/summary/`),

    // ── Incidents ──────────────────────────────────────────────────
    incidents: (q?: SafetyQuery) =>
      api<Paged<Incident>>(`${S}/incidents/`, { query: cleanQuery(q as Record<string, unknown>) }),
    getIncident: (id: string) => api<Incident>(`${S}/incidents/${id}/`),
    createIncident: (body: Partial<Incident>) =>
      api<Incident>(`${S}/incidents/`, { method: 'POST', body }),
    triageIncident: (id: string) =>
      api<Incident>(`${S}/incidents/${id}/triage/`, { method: 'POST' }),
    dispatchIncident: (id: string, body?: unknown) =>
      api<Incident>(`${S}/incidents/${id}/dispatch/`, { method: 'POST', body }),
    resolveIncident: (id: string) =>
      api<Incident>(`${S}/incidents/${id}/resolve/`, { method: 'POST' }),
    closeIncident: (id: string) =>
      api<Incident>(`${S}/incidents/${id}/close/`, { method: 'POST' }),
    activeIncidents: () => api<Paged<Incident>>(`${S}/incidents/active/`),
    incidentDispatches: (id: string) =>
      api<Paged<EmergencyDispatch>>(`${S}/incidents/${id}/dispatches/`),
    incidentsByChannel: () => api<unknown>(`${S}/incidents/by-channel/`),

    // ── Accidents ──────────────────────────────────────────────────
    accidents: (q?: SafetyQuery) =>
      api<Paged<Accident>>(`${S}/accidents/`, { query: cleanQuery(q as Record<string, unknown>) }),
    fatalityTrend: () => api<unknown>(`${S}/accidents/fatality-trend/`),
    accidentsByCause: () => api<unknown>(`${S}/accidents/by-cause/`),

    // ── Black spots ────────────────────────────────────────────────
    blackspots: (q?: SafetyQuery) =>
      api<Paged<BlackSpot>>(`${S}/black-spots/`, { query: cleanQuery(q as Record<string, unknown>) }),
    topBlackspots: () => api<Paged<BlackSpot>>(`${S}/black-spots/top/`),

    // ── Dispatches ─────────────────────────────────────────────────
    dispatches: (q?: SafetyQuery) =>
      api<Paged<EmergencyDispatch>>(`${S}/emergency-dispatches/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    activeDispatches: () => api<Paged<EmergencyDispatch>>(`${S}/emergency-dispatches/active/`),
    acknowledgeDispatch: (id: string) =>
      api<EmergencyDispatch>(`${S}/emergency-dispatches/${id}/acknowledge/`, { method: 'POST' }),
    arriveDispatch: (id: string) =>
      api<EmergencyDispatch>(`${S}/emergency-dispatches/${id}/arrive/`, { method: 'POST' }),
    completeDispatch: (id: string) =>
      api<EmergencyDispatch>(`${S}/emergency-dispatches/${id}/complete/`, { method: 'POST' }),

    // ── Predictive hotspots ────────────────────────────────────────
    hotspots: (q?: SafetyQuery) =>
      api<Paged<PredictiveHotspot>>(`${S}/predictive-hotspots/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    hotspotHeatmap: () => api<Paged<PredictiveHotspot>>(`${S}/predictive-hotspots/heatmap/`),

    // ── KPIs ───────────────────────────────────────────────────────
    kpis: (q?: SafetyQuery) =>
      api<Paged<SafetyKPI>>(`${S}/kpis/`, { query: cleanQuery(q as Record<string, unknown>) }),
    kpiTrend: () => api<unknown>(`${S}/kpis/trend/`),
    kpiByCounty: () => api<unknown>(`${S}/kpis/by-county/`),

    // ── Interventions ──────────────────────────────────────────────
    interventions: (q?: SafetyQuery) =>
      api<Paged<SafetyIntervention>>(`${S}/interventions/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    interventionEffectiveness: () =>
      api<Paged<SafetyIntervention>>(`${S}/interventions/effectiveness/`),

    // ── Violations ─────────────────────────────────────────────────
    violations: (q?: SafetyQuery) =>
      api<Paged<TrafficViolation>>(`${S}/traffic-violations/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    violationsByType: () => api<unknown>(`${S}/traffic-violations/by-type/`),
  }
}