// scripts/test-endpoints.mjs
// ─────────────────────────────────────────────────────────────────────
// End-to-end live endpoint tester for the UAPTS backend.
//
// Logs in, then GETs every endpoint referenced by app/composables/api/*.ts,
// diffing actual JSON response fields against the TS interface fields the
// frontend expects. Prints a JSON report (array) to stdout; per-request
// status lines go to stderr so you can watch progress.
//
// Usage:
//   UAPTS_EMAIL=you@example.com UAPTS_PASSWORD=*** node scripts/test-endpoints.mjs > report.json
//   UAPTS_BASE=https://uapts.eu.cc UAPTS_EMAIL=... UAPTS_PASSWORD=... node scripts/test-endpoints.mjs
//
// Findings from a given run are written up in MissingApis.md - re-run
// this whenever the backend schema changes to check for drift.
//
// Requires Node 18+ (native fetch). No dependencies.
// ─────────────────────────────────────────────────────────────────────

const BASE = process.env.UAPTS_BASE || 'http://192.168.0.110:8000'
const EMAIL = process.env.UAPTS_EMAIL
const PASSWORD = process.env.UAPTS_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error('Set UAPTS_EMAIL / UAPTS_PASSWORD env vars (never hardcode credentials in this file).')
  process.exit(1)
}

async function req(path, opts = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  const t0 = Date.now()
  try {
    const res = await fetch(url, { ...opts, headers })
    const ms = Date.now() - t0
    const text = await res.text()
    let body = null
    try { body = text ? JSON.parse(text) : null } catch { body = text.slice(0, 300) }
    return { status: res.status, body, ms }
  } catch (e) {
    return { status: 0, body: null, error: String(e), ms: Date.now() - t0 }
  }
}

function topKeys(obj) {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return []
  return Object.keys(obj)
}

// Extract a representative "item" from a response: results[0] for Paged,
// the array's first element for bare arrays, or the object itself.
function sampleItem(body) {
  if (Array.isArray(body)) return body[0] ?? null
  if (body && Array.isArray(body.results)) return body.results[0] ?? null
  return body
}

function diffFields(expected, actual) {
  if (!expected) return { missing: [], extra: [], skipped: true }
  const actualKeys = new Set(topKeys(actual))
  const expectedKeys = new Set(expected)
  const missing = expected.filter(f => !actualKeys.has(f))
  const extra = [...actualKeys].filter(f => !expectedKeys.has(f))
  return { missing, extra, skipped: false }
}

// ── Manifest ──────────────────────────────────────────────────────────
// kind: 'envelope' diffs the top-level body itself; 'item' diffs
// sampleItem(body) (first row of a list, or the object for a detail/get).
// expectedFields: null means "don't field-diff" (unknown/`any`-typed
// response, or a composable already documented as loosely-typed) -
// existence/status is still checked.
// expectMissing: true flags composables written ahead of the backend API
// (see README.md "Ahead of API") - a 404 there is expected, not a finding.
const M = []
function add(module, name, path, expectedFields, kind = 'item', opts = {}) {
  M.push({ module, name, path, expectedFields, kind, ...opts })
}

// -- System --
add('System', 'banner', '/api/', ['name','version','environment','description','documentation_url','timestamp','endpoints'], 'envelope')
add('System', 'health', '/api/v1/health/', ['status','service','version','timestamp','uptime_seconds','environment','components'], 'envelope')

// -- Dashboard --
add('Dashboard', 'canonicalSummary', '/api/v1/dashboard/summary/', ['kpis','modules','recent_activity','generated_at','counts'], 'envelope')

// -- Accounts --
add('Accounts', 'agencies.list', '/api/v1/accounts/agencies/?page_size=5', ['id','agency_name','agency_code','contact_email'], 'item')
add('Accounts', 'departments.list', '/api/v1/accounts/departments/?page_size=5', ['id','agency','agency_code','parent_department','department_name','department_code'], 'item')
add('Accounts', 'roles.list', '/api/v1/accounts/roles/?page_size=5', ['id','role_name'], 'item')
add('Accounts', 'users.list', '/api/v1/accounts/users/?page_size=5', ['id','email','role_type','role','role_name','agency','agency_code','department','mfa_active','is_active','is_staff','created_at'], 'item')
add('Accounts', 'auth.user (me)', '/api/v1/auth/user/', ['id','email','role_type','role','agency','department','mfa_active','is_active','is_staff','created_at'], 'envelope')

// -- Traffic (M02) --
add('Traffic', 'summary', '/api/v1/traffic/summary/', ['kpis','volume_24h','class_breakdown','congestion_distribution','speed_compliance','forecast_next_hour','generated_at'], 'envelope')
add('Traffic', 'countingStations', '/api/v1/traffic/counting-stations/?page_size=5', ['id','station_code','station_name','agency','agency_code','station_type','segment','segment_id','latitude','longitude','speed_limit_kmh','equipment_status','last_calibration_at','data_quality_score','created_at','updated_at'], 'item')
add('Traffic', 'counts', '/api/v1/traffic/counts/?page_size=5', ['id','segment','segment_id','station','station_code','vehicle_vol','avg_speed','occupancy_pct','congestion_level','recorded_at'], 'item')
add('Traffic', 'classifications', '/api/v1/traffic/classifications/?page_size=5', ['id','station','station_code','vehicle_class','count','avg_speed_kmh','recorded_at'], 'item')
add('Traffic', 'speedObservations', '/api/v1/traffic/speed-observations/?page_size=5', ['id','station','station_code','avg_speed_kmh','p50_speed_kmh','p85_speed_kmh','speed_limit_kmh','compliance_pct','sample_count','recorded_at'], 'item')
add('Traffic', 'congestionEvents', '/api/v1/traffic/congestion-events/?page_size=5', ['id','segment','segment_id','severity','status','avg_speed_kmh','free_flow_speed_kmh','delay_minutes','impact_radius_km','expected_duration_min','started_at','ended_at','description'], 'item')
add('Traffic', 'activeCongestion', '/api/v1/traffic/congestion-events/active/', null, 'item')
add('Traffic', 'routeOptimizations', '/api/v1/traffic/route-optimizations/?page_size=5', ['id','event','origin_label','destination_label','detour_distance_km','estimated_time_saving_min','confidence_pct','polyline','created_at'], 'item')
add('Traffic', 'forecasts', '/api/v1/traffic/forecasts/?page_size=5', ['id','segment','segment_id','model_name','model_version','target_at','horizon_hours','predicted_volume','predicted_speed_kmh','predicted_congestion','lower_volume','upper_volume','lower_speed_kmh','upper_speed_kmh'], 'item')
add('Traffic', 'odMatrix', '/api/v1/traffic/od-matrices/?page_size=5', ['id','origin_zone','destination_zone','trip_count','avg_travel_time_min','recorded_hour'], 'item')
add('Traffic', 'topOdPairs', '/api/v1/traffic/od-matrices/top-pairs/?days=7', null, 'item')
add('Traffic', 'weather', '/api/v1/traffic/weather/?page_size=5', ['id','station','station_code','latitude','longitude','temperature_c','rainfall_mm','humidity_pct','wind_kmh','visibility_km','condition','traffic_impact_score','observed_at'], 'item')
add('Traffic', 'alerts', '/api/v1/traffic/alerts/?page_size=5', ['id','alert_type','severity','segment','segment_id','event','title','message','is_active','issued_at','resolved_at'], 'item')
add('Traffic', 'classShare', '/api/v1/traffic/classifications/share/?days=7', null, 'item')

// -- Fleet (M03) --
add('Fleet', 'summary', '/api/v1/fleet/summary/', ['kpis','vehicles_by_type','vehicles_by_status','governor_compliance','behaviour_events_24h','behaviour_critical_24h','top_breaches_24h','generated_at'], 'envelope')
add('Fleet', 'vehicles', '/api/v1/fleet/vehicles/?page_size=5', ['id','agency','agency_code','operator','operator_name','assigned_route','route_name','plate_number','chassis_no','engine_no','vehicle_type','make','model_name','year_of_manufacture','seating_capacity','gross_weight_kg','load_capacity_kg','axle_configuration','fuel_type','speed_limit_kmh','has_speed_governor','insurance_expiry','inspection_expiry','status','last_seen_at','last_latitude','last_longitude','last_speed_kmh','has_recent_track','created_at','updated_at'], 'item')
add('Fleet', 'liveVehicles', '/api/v1/fleet/vehicles/live/', null, 'item')
add('Fleet', 'gpsTracks', '/api/v1/fleet/gps-tracks/?page_size=5', ['id','vehicle','plate_number','latitude','longitude','speed_kmh','timestamp'], 'item')
add('Fleet', 'geofences', '/api/v1/fleet/geofences/?page_size=5', ['id','agency','agency_code','zone_name','zone_type','severity','radius_m','latitude','longitude','is_active','created_at','updated_at'], 'item')
add('Fleet', 'geofenceEvents', '/api/v1/fleet/geofence-events/?page_size=5', ['id','geofence','zone_name','vehicle','plate_number','event_type','latitude','longitude','speed_kmh','detected_at'], 'item')
add('Fleet', 'recentBreaches', '/api/v1/fleet/geofence-events/recent/', null, 'item')
add('Fleet', 'behaviourEvents', '/api/v1/fleet/driver-behavior-events/?page_size=5', ['id','vehicle','plate_number','event_type','severity','speed_kmh','speed_limit_kmh','latitude','longitude','duration_seconds','deceleration_mps2','detected_at'], 'item')
add('Fleet', 'behaviourCritical', '/api/v1/fleet/driver-behavior-events/critical/', null, 'item')
add('Fleet', 'routeAdherence', '/api/v1/fleet/route-adherence/?page_size=5', ['id','vehicle','plate_number','route','route_name','verdict','deviation_m','sample_latitude','sample_longitude','sampled_at'], 'item')
add('Fleet', 'speedGovernorStatus', '/api/v1/fleet/speed-governor-status/?page_size=5', ['id','vehicle','plate_number','status','cap_kmh','observed_max_kmh','tamper_detected','firmware_version','reported_at'], 'item')
add('Fleet', 'tripPlaybacks', '/api/v1/fleet/trip-playbacks/?page_size=5', ['id','vehicle','plate_number','route','route_name','operator','operator_name','origin_label','destination_label','started_at','ended_at','distance_km','avg_speed_kmh','max_speed_kmh','duration_seconds','stop_count','boardings','alightings','status','created_at','updated_at'], 'item')
add('Fleet', 'utilization', '/api/v1/fleet/utilization/?page_size=5', ['id','vehicle','plate_number','operator','operator_name','date','trips_count','distance_km','active_hours','idle_hours','utilization_pct','created_at','updated_at'], 'item')
add('Fleet', 'weighbridgeStations', '/api/v1/fleet/weighbridge-stations/', ['id','agency','agency_code','station_name','latitude','longitude','created_at','updated_at'], 'item')
add('Fleet', 'weighbridgeEvents', '/api/v1/fleet/weighbridge-events/?page_size=5', ['id','vehicle','plate_number','station','station_name','axle_load_per_group','overload_amount_kg','recorded_at'], 'item')
add('Fleet', 'governmentFleet', '/api/v1/fleet/government-fleet/?page_size=5', ['id','agency','agency_code','equipment_type','serviceability','latitude','longitude','created_at','updated_at'], 'item')
add('Fleet', 'equipmentLeases', '/api/v1/fleet/equipment-leases/?page_size=5', null, 'item')

// -- Vehicle inspections / driver licensing (M03 sub) --
add('Fleet', 'vehicleInspections.list', '/api/v1/fleet/vehicle-inspections/?page_size=5', ['id','vehicle','plate_number','inspection_centre','inspector_name','inspected_at','result','sticker_no','report_url','next_inspection_due','reinspection_of','is_reinspection','created_at','updated_at'], 'item')
add('Fleet', 'vehicleInspections.summary', '/api/v1/fleet/vehicle-inspections/summary/', null, 'envelope')
add('Fleet', 'drivers', '/api/v1/fleet/drivers/?page_size=5', ['id','national_id','full_name','phone','date_of_birth','agency','agency_code','operator','operator_name','created_at','updated_at'], 'item')
add('Fleet', 'driverLicenses', '/api/v1/fleet/driver-licenses/?page_size=5', ['id','driver','driver_name','license_number','license_class','endorsements','demerit_points','psv_badge_no','psv_badge_expiry','is_psv','issue_date','expiry_date','is_expired','status','created_at','updated_at'], 'item')
add('Fleet', 'driverLicenses.expiring', '/api/v1/fleet/driver-licenses/expiring/?days=30', null, 'item')

// -- Public Transport (M04) --
add('PublicTransport', 'summary', '/api/v1/public-transport/summary/', ['kpis','revenue_24h','payment_channels','on_time_pct','top_routes','leaderboard','feedback_by_category','expiring_licences','demand_forecast_24h','generated_at'], 'envelope')
add('PublicTransport', 'saccos', '/api/v1/public-transport/saccos/?page_size=5', ['id','sacco_name','registration_status','contact_phone','route_count','fleet_size','service_quality_score','created_at','updated_at'], 'item')
add('PublicTransport', 'routes', '/api/v1/public-transport/routes/?page_size=5', ['id','sacco','sacco_name','route_name','route_short_name','service_type','fare_kes','distance_km','path_geometry','geometry','stop_ids','stop_count','agency_id','is_active'], 'item')
add('PublicTransport', 'routeCoverage', '/api/v1/public-transport/routes/coverage/', null, 'item')
add('PublicTransport', 'schedules', '/api/v1/public-transport/schedules/?page_size=5', ['id','route','route_name','vehicle_id','day_type','departure_time','arrival_time','frequency_min','is_active'], 'item')
add('PublicTransport', 'compliance', '/api/v1/public-transport/compliance/?page_size=5', ['id','route','route_name','check_type','status','notes','checked_at'], 'item')
add('PublicTransport', 'complianceSummary', '/api/v1/public-transport/compliance/summary/', null, 'envelope')
add('PublicTransport', 'demand', '/api/v1/public-transport/demand/?page_size=5', ['id','route','origin_zone','destination_zone','passenger_count','surveyed_at'], 'item')
add('PublicTransport', 'brtStops', '/api/v1/public-transport/brt-stops/?page_size=5', ['id','stop_id','stop_name','route','route_name','latitude','longitude','platform_type','has_shelter','has_ticket_machine','accessibility_score','avg_dwell_seconds','avg_boarding_count','is_active'], 'item')
add('PublicTransport', 'brtHeadway', '/api/v1/public-transport/brt-stops/headway/', null, 'item')
add('PublicTransport', 'scheduleAdherence', '/api/v1/public-transport/schedule-adherence/?page_size=5', ['id','route','route_name','stop','stop_name','vehicle_id','scheduled_at','actual_at','deviation_seconds','on_time','recorded_at'], 'item')
add('PublicTransport', 'onTimeStats', '/api/v1/public-transport/schedule-adherence/on-time/?days=7', null, 'item')
add('PublicTransport', 'fareCollections', '/api/v1/public-transport/fare-collections/?page_size=5', ['id','route','route_name','payment_channel','transaction_count','total_kes','avg_fare_kes','collected_hour'], 'item')
add('PublicTransport', 'revenueTrend', '/api/v1/public-transport/fare-collections/revenue-trend/?days=7', null, 'item')
add('PublicTransport', 'revenueByChannel', '/api/v1/public-transport/fare-collections/by-channel/?days=7', null, 'item')
add('PublicTransport', 'demandForecasts', '/api/v1/public-transport/demand-forecasts/?page_size=5', ['id','route','route_name','target_at','horizon_hours','predicted_passengers','lower_passengers','upper_passengers','model_name','model_version'], 'item')
add('PublicTransport', 'serviceQuality', '/api/v1/public-transport/service-quality/?page_size=5', ['id','route','route_name','sacco','sacco_name','period_start','period_end','on_time_pct','complaint_rate','vehicle_age_score','occupancy_score','composite_score'], 'item')
add('PublicTransport', 'operatorMetrics', '/api/v1/public-transport/operator-metrics/?page_size=5', ['id','sacco','sacco_name','period_start','period_end','total_trips','on_time_pct','complaint_count','revenue_kes','fleet_utilization_pct','rank_position'], 'item')
add('PublicTransport', 'leaderboard', '/api/v1/public-transport/operator-metrics/leaderboard/', null, 'envelope')
add('PublicTransport', 'payments', '/api/v1/public-transport/payments/?page_size=5', ['id','transaction_ref','route','route_name','provider','amount_kes','boarded_stop','boarded_stop_name','alighted_stop','customer_phone_hash','transacted_at'], 'item')
add('PublicTransport', 'fleetDeployments', '/api/v1/public-transport/fleet-deployments/?page_size=5', ['id','route','route_name','period_start','period_end','recommended_vehicles','current_vehicles','predicted_demand','capacity_utilization_pct','rationale'], 'item')
add('PublicTransport', 'feeds', '/api/v1/public-transport/feeds/?page_size=5', ['id','feed_version','status','route_count','stop_count','trip_count','zip_sha256','zip_size_bytes','download_url','generated_at','published_at'], 'item')
add('PublicTransport', 'feedback', '/api/v1/public-transport/feedback/?page_size=5', ['id','route','route_name','sacco','sacco_name','category','rating','text','status','submitted_at','resolved_at'], 'item')
add('PublicTransport', 'feedbackByCategory', '/api/v1/public-transport/feedback/by-category/', null, 'item')
add('PublicTransport', 'psvLicenses', '/api/v1/public-transport/psv-licenses/?page_size=5', ['id','license_number','sacco','sacco_name','route','route_name','issue_date','expiry_date','status','gps_compliance_pct','vehicle_count'], 'item')
add('PublicTransport', 'expiringLicenses', '/api/v1/public-transport/psv-licenses/expiring/?days=90', null, 'item')

// -- Safety (M05) --
add('Safety', 'summary', '/api/v1/safety/summary/', ['kpis','incidents_by_severity','incidents_by_type','fatality_trend_30d','top_predictive_hotspots','black_spots_by_tier','intervention_effectiveness','active_dispatches','recent_violations_24h','generated_at'], 'envelope')
add('Safety', 'incidents', '/api/v1/safety/incidents/?page_size=5', ['id','reference_code','segment','segment_code','reporting_agency','reporting_agency_code','reported_by','reported_by_email','incident_type','reporting_channel','severity','status','title','description','latitude','longitude','casualties','vehicles_involved','reported_at','triaged_at','resolved_at','closed_at','created_at','updated_at','dispatch_count'], 'item')
add('Safety', 'activeIncidents', '/api/v1/safety/incidents/active/', null, 'item')
add('Safety', 'incidentsByChannel', '/api/v1/safety/incidents/by-channel/', null, 'item')
add('Safety', 'accidents', '/api/v1/safety/accidents/?page_size=5', ['id','segment','segment_code','black_spot','incident','incident_ref','fatality_category','fatalities','serious_injuries','minor_injuries','cause_of_accident','weather_condition','road_condition','severity_classification','occurred_at','latitude','longitude','created_at','updated_at'], 'item')
add('Safety', 'fatalityTrend', '/api/v1/safety/accidents/fatality-trend/', null, 'item')
add('Safety', 'accidentsByCause', '/api/v1/safety/accidents/by-cause/', null, 'item')
add('Safety', 'blackspots', '/api/v1/safety/black-spots/?page_size=5', ['id','segment','segment_road_code','segment_road_name','accident_count_rolling','fatality_count_rolling','ranking_tier','kde_intensity','radius_m','window_days','centroid_latitude','centroid_longitude','last_computed_at','created_at','updated_at'], 'item')
add('Safety', 'topBlackspots', '/api/v1/safety/black-spots/top/', null, 'item')
add('Safety', 'dispatches', '/api/v1/safety/emergency-dispatches/?page_size=5', ['id','incident','incident_ref','incident_status','service_type','target_agency','target_agency_code','status','recommended_eta_minutes','recommended_units','rationale','acknowledged_at','arrived_at','completed_at','created_at'], 'item')
add('Safety', 'activeDispatches', '/api/v1/safety/emergency-dispatches/active/', null, 'item')
add('Safety', 'hotspots', '/api/v1/safety/predictive-hotspots/?page_size=5', ['id','segment','segment_road_code','latitude','longitude','grid_cell_id','predicted_risk_score','risk_tier','horizon_days','confidence_pct','contributing_factors','model_name','model_version','computed_at','created_at','updated_at'], 'item')
add('Safety', 'hotspotHeatmap', '/api/v1/safety/predictive-hotspots/heatmap/', null, 'item')
add('Safety', 'kpis', '/api/v1/safety/kpis/?page_size=5', ['id','agency','agency_code','date','county','total_incidents','fatal_count','serious_count','minor_count','fatalities','injuries','avg_response_minutes','interventions_evaluated','intervention_effectiveness_pct','created_at','updated_at'], 'item')
add('Safety', 'kpiTrend', '/api/v1/safety/kpis/trend/', null, 'item')
add('Safety', 'kpiByCounty', '/api/v1/safety/kpis/by-county/', null, 'item')
add('Safety', 'interventions', '/api/v1/safety/interventions/?page_size=5', ['id','segment','segment_road_code','intervention_type','description','installed_at','cost_kes','before_count','after_count','effectiveness_pct','evaluated_at','created_at','updated_at'], 'item')
add('Safety', 'violations', '/api/v1/safety/traffic-violations/?page_size=5', ['id','vehicle','plate_number','violation_type','fine_kes','latitude','longitude','occurred_at','notes','created_at','updated_at'], 'item')
add('Safety', 'violationsByType', '/api/v1/safety/traffic-violations/by-type/', null, 'item')

// -- Infrastructure (M06) --
add('Infrastructure', 'summary', '/api/v1/infrastructure/summary/', ['network','bridges','streetlights','construction','budget','predictive','wim','maintenance','generated_at'], 'envelope')
add('Infrastructure', 'segments', '/api/v1/infrastructure/road-segments/?page_size=5', ['id','agency','agency_code','road_name','road_code','road_class','chainage_start','chainage_end','length_km','surface_type','carriageway_width_m','lanes_count','annual_avg_daily_traffic','iri_value','iri_measured_at','pci_value','pci_measured_at','rut_depth_mm','condition_class','last_evaluated_at','bridge_count','streetlight_count','open_maintenance_orders','created_at','updated_at'], 'item')
add('Infrastructure', 'segmentConditionDistribution', '/api/v1/infrastructure/road-segments/condition-distribution/', null, 'envelope')
add('Infrastructure', 'maintenanceOrders', '/api/v1/infrastructure/maintenance-orders/?page_size=5', ['id','segment','segment_road_code','segment_road_name','work_type','status','priority','description','cost_kes','budgeted_cost_kes','scheduled_at','started_at','completed_at','progress_pct','contractor_name','created_at','updated_at'], 'item')
add('Infrastructure', 'maintenanceByType', '/api/v1/infrastructure/maintenance-orders/by-type/', null, 'item')
add('Infrastructure', 'regionalOffices', '/api/v1/infrastructure/regional-offices/?page_size=5', ['id','agency','agency_code','region_name','region_code','created_at','updated_at'], 'item')
add('Infrastructure', 'fieldSurveys', '/api/v1/infrastructure/field-surveys/?page_size=5', ['id','office','office_name','survey_type','submitted_at','synced_to_hq','payload','created_at','updated_at'], 'item')
add('Infrastructure', 'bridges', '/api/v1/infrastructure/bridges/?page_size=5', ['id','agency','agency_code','bridge_name','bridge_code','bridge_type','span_length_m','load_capacity_tonnes','condition_score','condition_class','year_built','last_inspection_at','next_inspection_at','latitude','longitude','notes','created_at','updated_at'], 'item')
add('Infrastructure', 'criticalBridges', '/api/v1/infrastructure/bridges/critical/', null, 'item')
add('Infrastructure', 'streetlights', '/api/v1/infrastructure/streetlights/?page_size=5', ['id','agency','agency_code','segment','segment_road_code','lamp_type','wattage','status','installed_at','last_serviced_at','pole_id','latitude','longitude','created_at','updated_at'], 'item')
add('Infrastructure', 'streetlightStatusSummary', '/api/v1/infrastructure/streetlights/status-summary/', ['count','by_status','operational_pct'], 'envelope')
add('Infrastructure', 'projects', '/api/v1/infrastructure/construction-projects/?page_size=5', ['id','agency','agency_code','project_code','project_name','project_type','status','corridor','county','planned_start','planned_end','actual_start','actual_end','contract_sum_kes','disbursed_kes','physical_progress_pct','financial_progress_pct','budget_utilization_pct','length_km','contractor','description','created_at','updated_at'], 'item')
add('Infrastructure', 'projectPortfolio', '/api/v1/infrastructure/construction-projects/portfolio/', null, 'item')
add('Infrastructure', 'delayedProjects', '/api/v1/infrastructure/construction-projects/delayed/', null, 'item')
add('Infrastructure', 'projectsByCounty', '/api/v1/infrastructure/construction-projects/by-county/', null, 'item')
add('Infrastructure', 'forecasts', '/api/v1/infrastructure/deterioration-forecasts/?page_size=5', ['id','segment','segment_road_code','model_name','model_version','target_at','horizon_months','predicted_pci','predicted_iri','predicted_condition_class','failure_probability','lower_pci','upper_pci','confidence_pct','generated_at'], 'item')
add('Infrastructure', 'atRiskForecasts', '/api/v1/infrastructure/deterioration-forecasts/at-risk/', null, 'item')
add('Infrastructure', 'wimReadings', '/api/v1/infrastructure/wim-readings/?page_size=5', ['id','station','station_name','vehicle','plate_number','measured_gross_weight_kg','legal_limit_kg','overload_amount_kg','axle_loads_kg','axle_configuration','speed_kmh','direction','verdict','fine_kes','fine_paid','recorded_at'], 'item')
add('Infrastructure', 'wimOverloadStats', '/api/v1/infrastructure/wim-readings/overload-stats/', null, 'item')
add('Infrastructure', 'wimRepeatOffenders', '/api/v1/infrastructure/wim-readings/repeat-offenders/', null, 'item')
add('Infrastructure', 'budgets', '/api/v1/infrastructure/maintenance-budgets/?page_size=5', ['id','agency','agency_code','fiscal_year','allocated_kes','disbursed_kes','committed_kes','utilization_pct','notes','created_at','updated_at'], 'item')
add('Infrastructure', 'budgetSummary', '/api/v1/infrastructure/maintenance-budgets/summary/', null, 'item')
add('Infrastructure', 'signals', '/api/v1/infrastructure/traffic-signals/?page_size=5', ['id','agency','agency_code','intersection_name','intersection_code','status','mode','last_status_change_at','installed_at','latitude','longitude','created_at','updated_at'], 'item')
add('Infrastructure', 'signalFaults', '/api/v1/infrastructure/traffic-signals/faults/', null, 'item')
add('Infrastructure', 'ruralRoadStatus', '/api/v1/infrastructure/rural-road-status/?page_size=5', ['id','segment','segment_road_code','segment_road_name','status','closure_reason','reported_at','notes','created_at','updated_at'], 'item')
add('Infrastructure', 'assetSnapshots', '/api/v1/infrastructure/asset-snapshots/?page_size=5', ['id','agency','agency_code','asset_type','snapshot_date','total_count','operational_count','faulty_count','value_kes','created_at','updated_at'], 'item')

// -- Aviation + Maritime (M07) --
add('AviationMaritime', 'aviationSummary', '/api/v1/aviation-maritime/aviation/summary/?days=7', ['days','kpis','by_status','generated_at'], 'envelope')
add('AviationMaritime', 'airports', '/api/v1/aviation-maritime/aviation/airports/?page_size=5', ['id','iata_code','icao_code','name','city','country','airport_type','runway_count','has_international','design_capacity_passengers','elevation_ft','operator','active','latitude','longitude','created_at','updated_at'], 'item')
add('AviationMaritime', 'airlines', '/api/v1/aviation-maritime/aviation/airlines/?page_size=5', ['id','iata_code','icao_code','name','country','is_cargo_only','aoc_status','fleet_size','agency','agency_code'], 'item')
add('AviationMaritime', 'aircraft', '/api/v1/aviation-maritime/aviation/aircraft/?page_size=5', ['id','registration','aircraft_type','manufacturer','model','mtow_kg','seats_capacity','year_built','airline','airline_iata','in_service'], 'item')
add('AviationMaritime', 'flightSchedules', '/api/v1/aviation-maritime/aviation/flight-schedules/?page_size=5', null, 'item')
add('AviationMaritime', 'flights', '/api/v1/aviation-maritime/aviation/flights/?page_size=5', ['id','schedule','schedule_flight_number','airline_iata','origin_code','destination_code','flight_date','status','aircraft','aircraft_registration','delay_departure_min','delay_arrival_min','delay_reason','passengers_booked','passengers_actual','cargo_kg','gate','agency'], 'item')
add('AviationMaritime', 'flightsOTP', '/api/v1/aviation-maritime/aviation/flights/otp/?days=14', ['total_flights','on_time_flights','on_time_pct','avg_delay_min'], 'envelope')
add('AviationMaritime', 'cargoManifests', '/api/v1/aviation-maritime/aviation/cargo-manifests/?page_size=5', null, 'item')
add('AviationMaritime', 'cargoByCommodity', '/api/v1/aviation-maritime/aviation/cargo-manifests/by-commodity/?days=14', ['commodity','total_kg','shipments'], 'item')
add('AviationMaritime', 'passengerStats', '/api/v1/aviation-maritime/aviation/passenger-stats/?page_size=5', null, 'item')
add('AviationMaritime', 'passengersByAirport', '/api/v1/aviation-maritime/aviation/passenger-stats/by-airport/', ['airport__iata_code','airport__name','total_pax','domestic','intl','revenue_kes'], 'item')
add('AviationMaritime', 'safetyReports', '/api/v1/aviation-maritime/aviation/safety-reports/?page_size=5', null, 'item')
add('AviationMaritime', 'safetyReportStats', '/api/v1/aviation-maritime/aviation/safety-reports/stats/?days=365', ['days','total_reports','fatal','serious','casualties'], 'envelope')
add('AviationMaritime', 'intermodalConnections', '/api/v1/aviation-maritime/aviation/intermodal-connections/?page_size=5', null, 'item')
add('AviationMaritime', 'intermodalOnTime', '/api/v1/aviation-maritime/aviation/intermodal-connections/on-time/?days=30', ['origin_port__unlocode','origin_port__name','connection_type','destination_label','avg_median','avg_on_time','samples'], 'item')
add('AviationMaritime', 'metObservations', '/api/v1/aviation-maritime/aviation/met-observations/?page_size=5', null, 'item')
add('AviationMaritime', 'metObservationsLatest', '/api/v1/aviation-maritime/aviation/met-observations/latest/', null, 'item')

add('AviationMaritime', 'maritimeOperations', '/api/v1/aviation-maritime/maritime/operations/?days=30', ['days','kpis','ports','generated_at'], 'envelope')
add('AviationMaritime', 'ports', '/api/v1/aviation-maritime/maritime/ports/?page_size=5', ['id','unlocode','name','port_type','operator','design_throughput_teu','latitude','longitude','country','active','agency','agency_code'], 'item')
add('AviationMaritime', 'berths', '/api/v1/aviation-maritime/maritime/berths/?page_size=5', ['id','port','port_unlocode','berth_code','name','berth_type','length_m','max_draft_m','max_vessel_loa','crane_count','active'], 'item')
add('AviationMaritime', 'vessels', '/api/v1/aviation-maritime/maritime/vessels/?page_size=5', ['id','imo_number','mmsi','vessel_name','vessel_type','flag_state','gross_tonnage','deadweight_tonnage','length_overall_m','beam_m','max_draft_m','year_built','owner','operator','safety_cert_status'], 'item')
add('AviationMaritime', 'vesselMovements', '/api/v1/aviation-maritime/maritime/vessel-movements/?page_size=5', ['id','vessel','vessel_name','vessel_imo','port','port_unlocode','berth','berth_code','movement_type','status','eta','etd','ata','atd','cargo_type','cargo_tonnage','teu_count','is_international','agency'], 'item')
add('AviationMaritime', 'vesselMovementsLive', '/api/v1/aviation-maritime/maritime/vessel-movements/live/', null, 'item')
add('AviationMaritime', 'containerThroughput', '/api/v1/aviation-maritime/maritime/container-throughput/?page_size=5', null, 'item')
add('AviationMaritime', 'containerByPort', '/api/v1/aviation-maritime/maritime/container-throughput/by-port/', ['port__unlocode','port__name','teus','boxes','tons'], 'item')
add('AviationMaritime', 'containerTrend', '/api/v1/aviation-maritime/maritime/container-throughput/trend/?days=60', null, 'item')
add('AviationMaritime', 'yardDwell', '/api/v1/aviation-maritime/maritime/yard-dwell/?page_size=5', null, 'item')
add('AviationMaritime', 'maritimeInspections', '/api/v1/aviation-maritime/maritime/maritime-inspections/?page_size=5', null, 'item')
add('AviationMaritime', 'maritimeIncidents', '/api/v1/aviation-maritime/maritime/maritime-incidents/?page_size=5', null, 'item')
add('AviationMaritime', 'maritimeIncidentStats', '/api/v1/aviation-maritime/maritime/maritime-incidents/stats/?days=90', ['days','total_incidents','fatal_incidents','casualties','pollution_tons'], 'envelope')

// -- Aviation / Maritime infrastructure (ahead-of-API, expect 404) --
add('AviationInfra*', 'summary', '/api/v1/aviation-maritime/aviation/infrastructure/summary/', null, 'envelope', { expectMissing: true })
add('AviationInfra*', 'runways', '/api/v1/aviation-maritime/aviation/infrastructure/runways/', null, 'item', { expectMissing: true })
add('MaritimeInfra*', 'summary', '/api/v1/aviation-maritime/maritime/infrastructure/summary/', null, 'envelope', { expectMissing: true })
add('MaritimeInfra*', 'channels', '/api/v1/aviation-maritime/maritime/infrastructure/channels/', null, 'item', { expectMissing: true })
add('MaritimeInfra*', 'navaids', '/api/v1/aviation-maritime/maritime/infrastructure/navaids/', null, 'item', { expectMissing: true })
add('MaritimeInfra*', 'dryDocks', '/api/v1/aviation-maritime/maritime/infrastructure/dry-docks/', null, 'item', { expectMissing: true })
add('MaritimeInfra*', 'icds', '/api/v1/aviation-maritime/maritime/infrastructure/icds/', null, 'item', { expectMissing: true })
add('MaritimeInfra*', 'capitalWorks', '/api/v1/aviation-maritime/maritime/infrastructure/capital-works/', null, 'item', { expectMissing: true })

// -- Maritime composables added in the design-doc pass (ahead-of-API, expect 404) --
add('MaritimeServices*', 'summary', '/api/v1/aviation-maritime/maritime/services/summary/', null, 'envelope', { expectMissing: true })
add('MaritimeServices*', 'cargoHandling', '/api/v1/aviation-maritime/maritime/services/cargo-handling/', null, 'item', { expectMissing: true })
add('MaritimeServices*', 'pilotage', '/api/v1/aviation-maritime/maritime/services/pilotage/', null, 'item', { expectMissing: true })
add('MaritimeServices*', 'licences', '/api/v1/aviation-maritime/maritime/services/licences/', null, 'item', { expectMissing: true })
add('MaritimeCargo*', 'summary', '/api/v1/aviation-maritime/maritime/cargo/summary/', null, 'envelope', { expectMissing: true })
add('MaritimeCargo*', 'byType', '/api/v1/aviation-maritime/maritime/cargo/by-type/', null, 'item', { expectMissing: true })
add('MaritimeCargo*', 'pipeline', '/api/v1/aviation-maritime/maritime/cargo/pipeline/', null, 'item', { expectMissing: true })
add('MaritimeWaterways*', 'summary', '/api/v1/aviation-maritime/maritime/waterways/summary/', null, 'envelope', { expectMissing: true })
add('MaritimeWaterways*', 'list', '/api/v1/aviation-maritime/maritime/waterways/', null, 'item', { expectMissing: true })
add('MaritimeGreen*', 'summary', '/api/v1/aviation-maritime/maritime/green-transport/summary/', null, 'envelope', { expectMissing: true })
add('MaritimeGreen*', 'vesselEmissions', '/api/v1/aviation-maritime/maritime/green-transport/vessel-emissions/', null, 'item', { expectMissing: true })
add('MaritimePerformance*', 'summary', '/api/v1/aviation-maritime/maritime/performance/summary/', null, 'envelope', { expectMissing: true })
add('MaritimePerformance*', 'kpis', '/api/v1/aviation-maritime/maritime/performance/kpis/', null, 'item', { expectMissing: true })
add('MaritimePerformance*', 'ranking', '/api/v1/aviation-maritime/maritime/performance/ranking/', null, 'item', { expectMissing: true })

// -- Railway (M08) --
add('Railway', 'summary', '/api/v1/railway/summary/', ['kpis','live_operations','on_time_30d','freight_30d','incidents_90d','ridership_30d','top_routes','generated_at'], 'envelope')
add('Railway', 'lines', '/api/v1/railway/lines/?page_size=5', ['id','osm_id','name','network','gauge','gauge_mm','status','operator','max_speed_kmh','electrification','electrified_voltage_kv','length_km','stations_count','admin1_name','admin2_name','created_at','updated_at'], 'item')
add('Railway', 'stations', '/api/v1/railway/stations/?page_size=5', ['id','osm_id','code','name','network','station_type','service','has_passenger_service','has_freight_terminal','platforms','passenger_capacity_daily','city','admin1_name','elevation_m','created_at','updated_at'], 'item')
add('Railway', 'trains', '/api/v1/railway/trains/?page_size=5', ['id','unit_id','train_type','status','capacity_passengers','capacity_freight_tons','year_built','manufacturer','last_maintenance','next_maintenance','home_depot','current_location','current_location_code','created_at','updated_at'], 'item')
add('Railway', 'schedules', '/api/v1/railway/schedules/?page_size=5', ['id','train_number','service_class','network','origin','origin_code','destination','destination_code','departure_time','arrival_time','duration_minutes','days_of_week','day_type','train_unit','train_unit_code','fare_first_class_kes','fare_economy_kes','fare_freight_per_ton_kes','is_active','created_at','updated_at'], 'item')
add('Railway', 'operations', '/api/v1/railway/operations/?page_size=5', ['id','schedule','schedule_train_number','origin_code','destination_code','train_unit','train_unit_code','service_date','status','actual_departure','actual_arrival','delay_departure_min','delay_arrival_min','delay_reason','passengers_actual','occupancy_pct','current_lat','current_lon','current_station','current_station_code','created_at','updated_at'], 'item')
add('Railway', 'liveOperations', '/api/v1/railway/operations/live/', null, 'item')
add('Railway', 'onTimeStats', '/api/v1/railway/operations/on-time-stats/?days=30', ['days','total_operations','on_time_pct','avg_delay_min','cancelled','cancellation_pct','delayed'], 'envelope')
add('Railway', 'freight', '/api/v1/railway/freight/?page_size=5', ['id','manifest_ref','cargo_type','tonnage','wagon_count','origin_station','origin_station_code','destination_station','destination_station_code','operator','customs_clearance_ref','port_origin','revenue_kes','dispatched_at','arrived_at','schedule','schedule_train_number','operator_agency','operator_agency_code','created_at','updated_at'], 'item')
add('Railway', 'freightByCorridor', '/api/v1/railway/freight/by-corridor/?days=30', null, 'item')
add('Railway', 'incidents', '/api/v1/railway/incidents/?page_size=5', ['id','incident_ref','incident_type','severity','status','station','station_name','station_code','line','occurred_at','description','casualties','estimated_loss_kes','reported_by_agency','reported_by_agency_code','created_at','updated_at'], 'item')
add('Railway', 'incidentStats', '/api/v1/railway/incidents/stats/?days=90', ['total','casualties','loss_kes','fatal','level_crossing'], 'envelope')
add('Railway', 'tickets', '/api/v1/railway/tickets/?page_size=5', ['id','pnr','schedule','origin','destination','ticket_class','channel','passenger_name_hash','fare_kes','seat_number','booking_date','travel_date','is_no_show','operator_agency','created_at','updated_at'], 'item')
add('Railway', 'revenueByRoute', '/api/v1/railway/tickets/by-route/?days=30', null, 'item')
add('Railway', 'geojsonRailLines', '/api/v1/geojson/rail-lines/', ['type','features','count'], 'envelope')
add('Railway', 'geojsonRailStations', '/api/v1/geojson/rail-stations/', ['type','features','count'], 'envelope')

// -- Rail infrastructure (real per useRailInfrastructure.ts comment) --
add('RailInfra', 'trackSections', '/api/v1/railway/track-sections/?page_size=5', ['id','line','line_name','section_ref','chainage_start_km','chainage_end_km','rail_type','sleeper_type','track_condition','posted_speed_kmh','last_inspected_at','next_inspection_due','created_at','updated_at'], 'item')
add('RailInfra', 'trackSectionConditionSummary', '/api/v1/railway/track-sections/condition-summary/', null, 'envelope')
add('RailInfra', 'levelCrossings', '/api/v1/railway/level-crossings/?page_size=5', ['id','line','line_name','crossing_ref','road_name','latitude','longitude','protection_type','risk_rating','near_miss_count','daily_road_traffic','daily_train_movements','last_incident_at','is_active','created_at','updated_at'], 'item')
add('RailInfra', 'highRiskLevelCrossings', '/api/v1/railway/level-crossings/high-risk/', null, 'item')
add('RailInfra', 'capitalWorks', '/api/v1/railway/capital-works/?page_size=5', ['id','project_ref','project_name','project_type','line','line_name','status','budget_kes','spent_kes','progress_pct','funding_source','contractor','start_date','expected_completion','actual_completion','created_at','updated_at'], 'item')
add('RailInfra', 'capitalWorksByStatus', '/api/v1/railway/capital-works/by-status/', null, 'envelope')
add('RailInfra', 'culverts', '/api/v1/railway/culverts/?page_size=5', ['id','line','line_name','culvert_ref','chainage_km','culvert_type','span_m','condition','last_inspected_at','next_inspection_due','created_at','updated_at'], 'item')
add('RailInfra', 'signals', '/api/v1/railway/signals/?page_size=5', ['id','line','line_name','station','station_code','signal_ref','signal_type','chainage_km','status','is_automatic','last_maintenance','created_at','updated_at'], 'item')
add('RailInfra', 'signalFaults', '/api/v1/railway/signals/faults/', null, 'item')

// -- Rail safety (ahead-of-API, expect 404) --
add('RailSafety*', 'correctiveActions', '/api/v1/railway/safety/corrective-actions/', null, 'item', { expectMissing: true })
add('RailSafety*', 'riskIndicators', '/api/v1/railway/safety/risk-indicators/', null, 'item', { expectMissing: true })

// -- Reports (M09/M15) --
add('Reports', 'catalog', '/api/v1/reports/catalog/', ['id','name','description','module','formats','schedule','params'], 'item')
add('Reports', 'runs', '/api/v1/reports/runs/?page_size=5', ['id','template_id','template_name','status','format','requested_by','requested_by_email','requested_at','generated_at','completed_at','download_url','file_size_bytes','error'], 'item')

// -- Query builder (M15) --
add('Query', 'datasets', '/api/v1/query/datasets/', null, 'envelope')

// -- Integrations (M12) --
add('Integrations', 'list', '/api/v1/integrations/?page_size=5', ['source_id','name','source_system','agency_code','agency_name','mode','status','last_sync_at','last_error','records_today','endpoint_url'], 'item')
add('Integrations', 'records', '/api/v1/integrations/records/?page_size=5', ['id','source_id','record_type','payload','event_at','handler','handler_error','agency_name'], 'item')

// -- GIS (M13) --
add('Gis', 'kenyaBoundary', '/api/v1/gis/kenya/boundary/?admin_level=1', ['type','features','count','bbox','filters'], 'envelope')
add('Gis', 'roads', '/api/v1/gis/roads/?limit=50', ['type','features','count','bbox','filters'], 'envelope')
add('Gis', 'routes', '/api/v1/gis/routes/?limit=50', ['type','features','count','bbox','filters'], 'envelope')
add('Gis', 'mapOverview', '/api/v1/gis/map/', ['type','bbox','boundary','roads','routes','stations','events'], 'envelope')

// -- Training (M14) --
add('Training', 'courses', '/api/v1/training/courses/?page_size=5', ['id','institute','institute_name','institute_reg','name','course_code','course_category','delivery_mode','certification_body','duration_hours','duration_days','fee_kes','is_active','description','created_at','updated_at'], 'item')
add('Training', 'cohorts', '/api/v1/training/cohorts/?page_size=5', ['id','course','course_detail','cohort_code','status','start_date','end_date','capacity','enrolled_count','fill_rate_pct','facilitator','facilitator_name','notes','created_at','updated_at'], 'item')
add('Training', 'enrollments', '/api/v1/training/enrollments/?page_size=5', ['id','cohort','cohort_detail','student','national_id','full_name','phone_number','email','status','payment_status','amount_paid_kes','enrolled_at','confirmed_at','withdrawn_at','notes','created_at','updated_at'], 'item')
add('Training', 'sessions', '/api/v1/training/sessions/?page_size=5', ['id','cohort','cohort_code','title','session_type','scheduled_at','duration_minutes','facilitator','facilitator_name','venue','is_completed','completed_at','notes','created_at','updated_at'], 'item')
add('Training', 'attendance', '/api/v1/training/attendance/?page_size=5', ['id','session','session_title','enrollment','enrollment_name','status','marked_at','marked_by','marked_by_name','notes','created_at','updated_at'], 'item')
add('Training', 'completions', '/api/v1/training/completions/?page_size=5', ['id','enrollment','enrollment_detail','outcome','score_pct','theory_score_pct','practical_score_pct','attendance_rate_pct','completed_at','certificate_number','certificate_issued_at','certificate_expiry','is_certificate_valid','issued_by','issued_by_name','created_at','updated_at'], 'item')
add('Training', 'revenue', '/api/v1/training/revenue/?page_size=5', ['id','cohort','cohort_code','enrollment','enrollment_name','revenue_stream','payment_method','amount_kes','transaction_reference','received_at','recorded_by','recorded_by_name','notes','created_at','updated_at'], 'item')
add('Training', 'revenueSummary', '/api/v1/training/revenue/summary/', null, 'item')

// -- Audit (special pagination) --
add('Audit', 'logs', '/api/v1/audit/logs/?limit=5', ['_id','id','user_id','username','action','resource_type','resource_id','description','old_values','new_values','metadata','ip_address','user_agent','request_path','request_method','status_code','response_time','created_at'], 'item')
add('Audit', 'myLogs', '/api/v1/audit/my-logs/?limit=5', null, 'item')
add('Audit', 'actions', '/api/v1/audit/actions/', null, 'envelope')

// -- Notifications (M11) --
add('Notifications', 'list', '/api/v1/notifications/?limit=5', ['id','user_id','event_type','rule_id','severity','title','body','context','channels','delivered','read','read_at','created_at','expires_at'], 'item')
add('Notifications', 'unreadCount', '/api/v1/notifications/unread-count/', ['count'], 'envelope')
add('Notifications', 'rules.list', '/api/v1/notifications/rules/?limit=5', ['id','name','event_type','condition','severity','channels','target_roles','target_user_ids','message_template','cooldown_seconds','active','created_at','updated_at','last_fired_at'], 'item')
add('Notifications', 'health', '/api/v1/notifications/_health/', ['enabled','status'], 'envelope')

// ── Runner ────────────────────────────────────────────────────────────
async function main() {
  console.error(`Logging in as ${EMAIL} @ ${BASE} ...`)
  const loginRes = await req('/api/v1/auth/login/', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })
  if (loginRes.status !== 200 || !loginRes.body?.access) {
    console.error('LOGIN FAILED', loginRes.status, loginRes.body)
    process.exit(1)
  }
  const token = loginRes.body.access
  console.error('Login OK. Running', M.length, 'endpoint checks...')

  const results = []
  for (const m of M) {
    const r = await req(m.path, {}, token)
    let diff = { missing: [], extra: [], skipped: true }
    let itemUsed = null
    if (r.status >= 200 && r.status < 300) {
      itemUsed = m.kind === 'envelope' ? r.body : sampleItem(r.body)
      diff = diffFields(m.expectedFields, itemUsed)
    }
    results.push({
      module: m.module,
      name: m.name,
      path: m.path,
      status: r.status,
      ms: r.ms,
      expectMissing: !!m.expectMissing,
      hasData: itemUsed != null,
      envelopeKeys: r.body && typeof r.body === 'object' && !Array.isArray(r.body) ? Object.keys(r.body) : null,
      resultCount: r.body && typeof r.body === 'object' ? (r.body.count ?? (Array.isArray(r.body) ? r.body.length : (Array.isArray(r.body.results) ? r.body.results.length : null))) : null,
      missingFields: diff.missing,
      extraFields: diff.extra,
      diffSkipped: diff.skipped,
      error: r.error ?? null,
      sample: itemUsed && typeof itemUsed === 'object' ? JSON.stringify(itemUsed).slice(0, 500) : null,
    })
    process.stderr.write(`${r.status} ${m.module}.${m.name}\n`)
  }

  console.log(JSON.stringify(results, null, 2))
}

main()
