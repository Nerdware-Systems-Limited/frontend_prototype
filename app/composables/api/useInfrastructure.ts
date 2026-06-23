// app/composables/api/useInfrastructure.ts
// ─────────────────────────────────────────────────────────────────────
// M06 — Infrastructure & Network Health Monitoring.
//
// Backend surface: /api/v1/infrastructure/
//   /road-segments/, /maintenance-orders/, /regional-offices/,
//   /field-surveys/, /bridges/, /streetlights/, /construction-projects/,
//   /deterioration-forecasts/, /wim-readings/, /maintenance-budgets/,
//   /traffic-signals/, /rural-road-status/, /asset-snapshots/, /summary/.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

// ── Enums ───────────────────────────────────────────────────────────

export type RoadClass =
  | 'national_trunk' | 'national_secondary' | 'primary'
  | 'secondary' | 'tertiary' | 'unclassified' | 'rural' | 'urban'
export type SurfaceType =
  | 'asphalt' | 'concrete' | 'gravel' | 'earth' | 'paved' | 'other'
export type ConditionClass = 'good' | 'fair' | 'poor' | 'critical' | 'failed'
export type MaintenanceStatus =
  | 'planned' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent'
export type WorkType =
  | 'routine' | 'periodic' | 'rehabilitation' | 'emergency' | 'snow_ice' | 'other'
export type ProjectStatus =
  | 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
export type StreetlightStatus =
  | 'operational' | 'faulty' | 'damaged' | 'maintenance' | 'decommissioned'
export type LampType = 'led' | 'sodium' | 'halogen' | 'solar' | 'fluorescent' | 'other'
export type TrafficSignalStatus = 'operational' | 'faulty' | 'maintenance' | 'offline'
export type TrafficSignalMode = 'fixed_time' | 'actuated' | 'adaptive' | 'manual' | 'flashing'
export type BridgeType =
  | 'beam' | 'arch' | 'suspension' | 'cable_stayed' | 'truss' | 'culvert' | 'other'
export type WIMVerdict = 'compliant' | 'overloaded' | 'gross_overload' | 'underloaded'

// ── Shapes ──────────────────────────────────────────────────────────

export interface RoadSegment {
  id: string
  agency: string | null
  agency_code: string | null
  road_name: string
  road_code: string
  road_class: RoadClass
  chainage_start: number | null
  chainage_end: number | null
  length_km: number
  surface_type: SurfaceType
  carriageway_width_m: number | null
  lanes_count: number | null
  annual_avg_daily_traffic: number | null
  iri_value: number | null
  iri_measured_at: string | null
  pci_value: number | null
  pci_measured_at: string | null
  rut_depth_mm: number | null
  condition_class: ConditionClass
  last_evaluated_at: string | null
  bridge_count: number
  streetlight_count: number
  open_maintenance_orders: number
  created_at: string
  updated_at: string
}

export interface MaintenanceOrder {
  id: string
  segment: string
  segment_road_code: string | null
  segment_road_name: string | null
  work_type: WorkType
  status: MaintenanceStatus
  priority: MaintenancePriority
  description: string
  cost_kes: number | null
  budgeted_cost_kes: number | null
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  progress_pct: number | null
  contractor_name: string
  created_at: string
  updated_at: string
}

export interface RegionalOffice {
  id: string
  agency: string | null
  agency_code: string | null
  region_name: string
  region_code: string
  created_at: string
  updated_at: string
}

export interface FieldSurvey {
  id: string
  office: string
  office_name: string
  survey_type: string
  submitted_at: string | null
  synced_to_hq: boolean
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Bridge {
  id: string
  agency: string | null
  agency_code: string | null
  bridge_name: string
  bridge_code: string
  bridge_type: BridgeType
  span_length_m: number | null
  load_capacity_tonnes: number | null
  condition_score: number | null
  condition_class: ConditionClass
  year_built: number | null
  last_inspection_at: string | null
  next_inspection_at: string | null
  latitude: number | null
  longitude: number | null
  notes: string
  created_at: string
  updated_at: string
}

export interface Streetlight {
  id: string
  agency: string | null
  agency_code: string | null
  segment: string | null
  segment_road_code: string | null
  lamp_type: LampType
  wattage: number | null
  status: StreetlightStatus
  installed_at: string | null
  last_serviced_at: string | null
  pole_id: string
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

export interface ConstructionProject {
  id: string
  agency: string | null
  agency_code: string | null
  project_code: string
  project_name: string
  project_type: string
  status: ProjectStatus
  corridor: string
  county: string
  planned_start: string | null
  planned_end: string | null
  actual_start: string | null
  actual_end: string | null
  contract_sum_kes: number | null
  disbursed_kes: number | null
  physical_progress_pct: number | null
  financial_progress_pct: number | null
  budget_utilization_pct: number
  length_km: number | null
  contractor: string
  description: string
  created_at: string
  updated_at: string
}

export interface DeteriorationForecast {
  id: string
  segment: string
  segment_road_code: string | null
  model_name: string
  model_version: string
  target_at: string
  horizon_months: number
  predicted_pci: number | null
  predicted_iri: number | null
  predicted_condition_class: ConditionClass | null
  failure_probability: number | null
  lower_pci: number | null
  upper_pci: number | null
  confidence_pct: number | null
  generated_at: string
}

export interface WIMReading {
  id: string
  station: string
  station_name: string
  vehicle: string | null
  plate_number: string
  measured_gross_weight_kg: number
  legal_limit_kg: number
  overload_amount_kg: number | null
  axle_loads_kg: number[] | null
  axle_configuration: string
  speed_kmh: number | null
  direction: string
  verdict: WIMVerdict
  fine_kes: number | null
  fine_paid: boolean
  recorded_at: string
}

export interface MaintenanceBudget {
  id: string
  agency: string | null
  agency_code: string | null
  fiscal_year: number
  allocated_kes: number
  disbursed_kes: number
  committed_kes: number
  utilization_pct: number
  notes: string
  created_at: string
  updated_at: string
}

export interface TrafficSignal {
  id: string
  agency: string | null
  agency_code: string | null
  intersection_name: string
  intersection_code: string
  status: TrafficSignalStatus
  mode: TrafficSignalMode
  last_status_change_at: string | null
  installed_at: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

export interface RuralRoadStatus {
  id: string
  segment: string
  segment_road_code: string | null
  segment_road_name: string | null
  status: string
  closure_reason: string
  reported_at: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface AssetInventorySnapshot {
  id: string
  agency: string | null
  agency_code: string | null
  asset_type: string
  snapshot_date: string
  total_count: number
  operational_count: number
  faulty_count: number
  value_kes: number | null
  created_at: string
  updated_at: string
}

// ── Summary analytics payload ───────────────────────────────────────

export interface InfrastructureSummary {
  network: {
    total_segments: number
    total_length_km: number
    iri_average: number
    pci_average: number
    condition_distribution: Array<{
      condition_class: string
      total: number
      length: number
    }>
  }
  bridges: {
    total: number
    by_condition_class: Record<string, number>
    critical_count: number
  }
  streetlights: {
    total: number
    operational: number
    operational_pct: number
  }
  construction: {
    total_projects: number
    in_progress: number
    portfolio_by_corridor: Array<{
      corridor: string
      count: number
      contract_sum: number
      disbursed: number
      avg_physical: number
    }>
  }
  budget: {
    fiscal_year: number
    allocated_kes: number
    disbursed_kes: number
    committed_kes: number
    utilization_pct: number
  }
  predictive: {
    at_risk_segments_12mo: number
  }
  wim: {
    total_passings_30d: number
    overloads_30d: number
    overload_rate_pct: number
  }
  maintenance: {
    open_orders: number
    open_value_kes: number
  }
  generated_at: string
}

// ── Query type ──────────────────────────────────────────────────────

export interface InfrastructureQuery {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
  [k: string]: unknown
}

// ── Composable ──────────────────────────────────────────────────────

export function useInfrastructure() {
  const api = useApi()
  const I = '/api/v1/infrastructure'

  return {
    // ── Dashboard / summary ────────────────────────────────────────
    summary: () => api<InfrastructureSummary>(`${I}/summary/`),

    // ── Road segments ──────────────────────────────────────────────
    segments: (q?: InfrastructureQuery) =>
      api<Paged<RoadSegment>>(`${I}/road-segments/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    getSegment: (id: string) => api<RoadSegment>(`${I}/road-segments/${id}/`),
    segmentConditionMap: () =>
      api<Paged<RoadSegment>>(`${I}/road-segments/condition-map/`),
    segmentConditionDistribution: () =>
      api<{ results: Array<{ condition_class: string; total: number; length: number }> }>(
        `${I}/road-segments/condition-distribution/`,
      ),
    segmentIRIHistogram: () => api<unknown>(`${I}/road-segments/iri-histogram/`),

    // ── Maintenance orders ─────────────────────────────────────────
    maintenanceOrders: (q?: InfrastructureQuery) =>
      api<Paged<MaintenanceOrder>>(`${I}/maintenance-orders/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    maintenanceByType: () => api<unknown>(`${I}/maintenance-orders/by-type/`),
    progressMaintenance: (id: string, body: { progress_pct: number }) =>
      api<MaintenanceOrder>(`${I}/maintenance-orders/${id}/progress/`, {
        method: 'POST',
        body,
      }),

    // ── Regional offices / field surveys ───────────────────────────
    regionalOffices: (q?: InfrastructureQuery) =>
      api<Paged<RegionalOffice>>(`${I}/regional-offices/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    fieldSurveys: (q?: InfrastructureQuery) =>
      api<Paged<FieldSurvey>>(`${I}/field-surveys/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    syncFieldSurvey: (id: string) =>
      api<FieldSurvey>(`${I}/field-surveys/${id}/sync/`, { method: 'POST' }),

    // ── Bridges ────────────────────────────────────────────────────
    bridges: (q?: InfrastructureQuery) =>
      api<Paged<Bridge>>(`${I}/bridges/`, { query: cleanQuery(q as Record<string, unknown>) }),
    criticalBridges: () => api<Paged<Bridge>>(`${I}/bridges/critical/`),

    // ── Streetlights ───────────────────────────────────────────────
    streetlights: (q?: InfrastructureQuery) =>
      api<Paged<Streetlight>>(`${I}/streetlights/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    streetlightStatusSummary: () =>
      api<{
        count: number
        by_status: Record<string, number>
        operational_pct: number
      }>(`${I}/streetlights/status-summary/`),

    // ── Construction projects ──────────────────────────────────────
    projects: (q?: InfrastructureQuery) =>
      api<Paged<ConstructionProject>>(`${I}/construction-projects/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    projectPortfolio: () => api<unknown>(`${I}/construction-projects/portfolio/`),
    delayedProjects: () => api<Paged<ConstructionProject>>(`${I}/construction-projects/delayed/`),
    projectsByCounty: () => api<unknown>(`${I}/construction-projects/by-county/`),

    // ── ML deterioration forecasts ─────────────────────────────────
    forecasts: (q?: InfrastructureQuery) =>
      api<Paged<DeteriorationForecast>>(`${I}/deterioration-forecasts/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    atRiskForecasts: () =>
      api<Paged<DeteriorationForecast>>(`${I}/deterioration-forecasts/at-risk/`),

    // ── WIM overload ───────────────────────────────────────────────
    wimReadings: (q?: InfrastructureQuery) =>
      api<Paged<WIMReading>>(`${I}/wim-readings/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    wimOverloadStats: () => api<unknown>(`${I}/wim-readings/overload-stats/`),
    wimRepeatOffenders: () => api<unknown>(`${I}/wim-readings/repeat-offenders/`),

    // ── Budgets ────────────────────────────────────────────────────
    budgets: (q?: InfrastructureQuery) =>
      api<Paged<MaintenanceBudget>>(`${I}/maintenance-budgets/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    budgetSummary: () => api<unknown>(`${I}/maintenance-budgets/summary/`),

    // ── Traffic signals ────────────────────────────────────────────
    signals: (q?: InfrastructureQuery) =>
      api<Paged<TrafficSignal>>(`${I}/traffic-signals/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
    signalFaults: () => api<Paged<TrafficSignal>>(`${I}/traffic-signals/faults/`),

    // ── Rural roads ────────────────────────────────────────────────
    ruralRoadStatus: (q?: InfrastructureQuery) =>
      api<Paged<RuralRoadStatus>>(`${I}/rural-road-status/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),

    // ── Asset snapshots ────────────────────────────────────────────
    assetSnapshots: (q?: InfrastructureQuery) =>
      api<Paged<AssetInventorySnapshot>>(`${I}/asset-snapshots/`, {
        query: cleanQuery(q as Record<string, unknown>),
      }),
  }
}