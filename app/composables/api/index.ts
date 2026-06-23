// app/composables/api/index.ts
// ─────────────────────────────────────────────────────────────────────
// Re-exports for every domain API composable. Use as:
//
//   import { useIncidents, useAuthApi } from '~/composables/api'
//
// instead of long relative paths.
// ─────────────────────────────────────────────────────────────────────

export { useApi, cleanQuery, type ApiOptions } from './_client'
export { useGis } from './useGis'

export { useAuthApi, type LoginPayload, type RegisterPayload, type PasswordChangePayload, type PasswordResetPayload, type PasswordResetConfirmPayload } from './useAuth'
export { useSystemApi, useServiceHealth } from './useSystem'
export { useAgencies, useDepartments, useRoles, useUsers, type ListOpts } from './useAccounts'

export { useDashboard, useDashboardSummary, type DashboardKpi, type DashboardSummary, type DashboardModule, type DashboardRecentActivity } from './useDashboard'
export { useQuery, useQueryExecute, type QueryDatasetKey, type Dataset, type DatasetField, type FieldType, type QueryFilter, type QueryExecutePayload, type QueryExecuteResult, type FilterOp } from './useQuery'
export { useAudit, type AuditEntry, type AuditQuery } from './useAudit'
export { useTraffic, type TrafficSeverity, type CongestionLevel, type TrafficSummary, type CountingStation, type TrafficCount, type CongestionEvent, type TrafficForecast, type ODMatrix, type WeatherObservation, type TrafficAlert } from './useTraffic'
export {
  useFleet,
  type FleetSummary,
  type Vehicle, type VehicleStatus, type VehicleType,
  type GPSTrack,
  type Geofence, type GeofenceEvent, type GeofenceEventType,
  type DriverBehaviorEvent, type BehaviourEventType, type BehaviourSeverity,
  type RouteAdherence, type RouteAdherenceVerdict,
  type SpeedGovernorStatus, type GovernorStatus,
  type TripPlayback, type TripStatus, type FleetUtilization,
  type WeighbridgeStation, type WeighbridgeEvent, type GovernmentFleet,
  type FleetQuery,
} from './useFleet'
export {
  useSafety,
  type SafetySummary,
  type Incident as SafetyIncident, type IncidentSeverity, type IncidentStatus, type IncidentType, type ReportingChannel,
  type Accident as SafetyAccident,
  type BlackSpot, type BlackSpotTier,
  type EmergencyDispatch, type DispatchServiceType, type DispatchStatus,
  type PredictiveHotspot, type RiskTier,
  type SafetyKPI,
  type SafetyIntervention, type InterventionType,
  type TrafficViolation, type ViolationType,
  type SafetyQuery,
} from './useSafety'
export {
  useInfrastructure,
  type InfrastructureSummary,
  type RoadSegment, type RoadClass, type SurfaceType, type ConditionClass,
  type MaintenanceOrder, type MaintenanceStatus, type MaintenancePriority, type WorkType,
  type RegionalOffice,
  type FieldSurvey,
  type Bridge, type BridgeType,
  type Streetlight, type StreetlightStatus, type LampType,
  type ConstructionProject, type ProjectStatus,
  type DeteriorationForecast,
  type WIMReading, type WIMVerdict,
  type MaintenanceBudget,
  type TrafficSignal, type TrafficSignalStatus, type TrafficSignalMode,
  type RuralRoadStatus,
  type AssetInventorySnapshot,
  type InfrastructureQuery,
} from './useInfrastructure'
export { useIncidents, type Incident, type IncidentQuery, type IncidentReportPayload, type IncidentMode, type IncidentSeverity } from './useIncidents'
export { useReports, type ReportTemplate, type ReportRun, type ReportsQuery } from './useReports'
export { useIntegrations, type Integration, type IntegrationQuery } from './useIntegrations'
export { usePublicTransport, type PTSummary, type Sacco, type Route, type BRTStop, type Schedule, type ScheduleAdherence, type FareCollection, type DemandForecast, type ServiceQualityScore, type OperatorMetric, type PaymentTransaction, type FleetDeployment, type PTFeed, type PassengerFeedback, type PSVLicense, type PTQuery } from './usePublicTransport'
export { useRailway, type RailwaySummary, type RailwayKpis, type LiveOperation, type OnTimeStats, type FreightSummary, type IncidentSummary, type RidershipSummary, type RailLine, type RailStation, type Train, type TrainSchedule, type TrainOperation, type FreightManifest, type RailIncident, type RailTicket, type RailQuery, type RailNetwork, type RailGauge, type RailStatus, type StationType, type ServiceType, type TrainType, type TrainStatus, type ServiceClass, type DayType, type OpStatus, type DelayReason, type CargoType, type IncidentType, type IncidentSeverity, type TicketClass, type Channel } from './useRailway'
export { useNotifications, useNotificationStream, type Notification, type AlertRule, type Condition, type LeafCondition, type CompositeCondition, type ConditionOp, type Severity, type Channel as NotificationChannel, type NotificationQuery, type RuleQuery, type NotificationListResponse, type UnreadCountResponse, type MarkReadResponse, type MarkAllReadResponse, type AlertRuleListResponse, type NotifyRequest, type CreateRuleRequest, type HealthResponse } from './useNotifications'
export { useAviationMaritime, type AviationSummary, type MaritimeOps, type Airport, type Airline, type Aircraft, type Flight, type FlightStatus, type FlightOTP, type CargoByCommodity, type CabinClass, type PassengerByAirport, type Port, type Berth, type Vessel, type VesselMovement, type ContainerByPort, type IntermodalOnTime, type SafetySeverity, type SafetyReportType, type AocStatus, type AircraftType, type AirportType, type BerthType, type ContainerDirection, type ConnectionType, type ConnectionDirection, type PortType, type VesselType, type VesselMovementType, type VesselMovementStatus, type Commodity, type AviationQuery, type PortQuery } from './useAviationMaritime'