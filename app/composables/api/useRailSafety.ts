// app/composables/api/useRailSafety.ts
// ─────────────────────────────────────────────────────────────────────
// Railway safety compliance layer - corrective actions tied to
// incidents, and predictive derailment/signal-failure risk indicators.
//
// Core incident data (type, severity, status, casualties, station,
// line, occurred_at) already comes from the real useRailway().incidents()
// endpoint - this composable only covers the compliance/prediction
// fields the backend doesn't expose yet (investigation ownership,
// regulatory references, ML risk scores). Level crossing registries
// live in useRailInfrastructure() since they're an asset, not an event.
//
// Backend: /api/v1/railway/safety/{corrective-actions,risk-indicators}/.
// Both tables start empty - the endpoints return an empty page until
// corrective actions are entered / the risk pipeline writes scores.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'
import type { RailNetwork } from './useRailway'

export type InvestigationStatus = 'open' | 'in_progress' | 'closed'
export type RailRiskType = 'derailment' | 'signal_failure'

export interface CorrectiveAction {
  id: string
  incident_ref: string
  investigation_status: InvestigationStatus
  regulatory_reference?: string | null
  action_owner?: string | null
  due_date?: string | null
  closure_evidence?: string | null
  recurrence_flag: boolean
}

export interface RailRiskIndicator {
  id: string
  line: string
  line_name?: string | null
  network: RailNetwork
  risk_type: RailRiskType
  risk_score: number
  contributing_factors?: string[]
  generated_at: string
}

export interface RailSafetyQuery {
  page?: number
  page_size?: number
  investigation_status?: InvestigationStatus
  incident_ref?: string
}

export function useRailSafety() {
  const api = useApi()
  const S = '/api/v1/railway/safety'

  return {
    correctiveActions: (q?: RailSafetyQuery) =>
      api<Paged<CorrectiveAction>>(`${S}/corrective-actions/`, { query: cleanQuery(q as Record<string, unknown>) }),

    forIncident: (incidentRef: string) =>
      api<Paged<CorrectiveAction>>(`${S}/corrective-actions/`, { query: { incident_ref: incidentRef } }),

    riskIndicators: (q?: { network?: RailNetwork; risk_type?: RailRiskType }) =>
      api<Paged<RailRiskIndicator>>(`${S}/risk-indicators/`, { query: cleanQuery(q as Record<string, unknown>) }),
  }
}
