// Canonical severity/status -> BadgePill variant mapping, shared across
// modules so the same word always renders the same color everywhere
// (previously duplicated per-page and had drifted).

const RISK_LEVELS: Record<string, string> = {
  critical: 'danger',
  high: 'warning',
  medium: 'fair',
  low: 'success',
  warning: 'warning',
  info: 'info',
}

const INCIDENT_SEVERITY: Record<string, string> = {
  fatal: 'danger',
  serious: 'warning',
  minor: 'info',
}

const DISPATCH_STATUS: Record<string, string> = {
  recommended: 'info',
  acknowledged: 'fair',
  en_route: 'warning',
  on_scene: 'success',
  completed: 'success',
  cancelled: 'neutral',
}

const CONGESTION_LEVEL: Record<string, string> = {
  free_flow: 'success',
  moderate: 'fair',
  heavy: 'warning',
  severe: 'danger',
}

const GEOFENCE_EVENT: Record<string, string> = {
  entry: 'info',
  exit: 'warning',
}

export function useSeverityBadge() {
  const riskBadge = (s: string) => RISK_LEVELS[s] ?? 'neutral'
  const incidentSeverityBadge = (s: string) => INCIDENT_SEVERITY[s] ?? 'neutral'
  const dispatchBadge = (s: string) => DISPATCH_STATUS[s] ?? 'neutral'
  const congestionBadge = (s: string) => CONGESTION_LEVEL[s] ?? 'neutral'
  const geofenceEventBadge = (s: string) => GEOFENCE_EVENT[s] ?? 'neutral'

  return { riskBadge, incidentSeverityBadge, dispatchBadge, congestionBadge, geofenceEventBadge }
}
