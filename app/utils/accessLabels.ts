/**
 * Plain-language labels for the Module Access page. access-control.json keys
 * capabilities and enforcement modes by machine id; admins read these
 * instead. Unknown ids fall back to a de-underscored version of the id, so a
 * new capability or enforcement mode added to the JSON still renders.
 */

const CAPABILITY_LABELS: Record<string, string> = {
  export: 'Export data',
  query_builder: 'Use query builder',
  run_reports: 'Run reports',
  manage_users: 'Manage users',
  approve_uploads: 'Approve uploads',
  register_feeds: 'Register data feeds',
  configure_rules: 'Configure alert rules',
  acknowledge_alerts: 'Acknowledge alerts',
  update_incidents: 'Update incidents',
  submit_uploads: 'Submit uploads',
}

const ENFORCEMENT_LABELS: Record<string, string> = {
  row_filter: 'Row filter',
  layer_permission: 'Map layer permission',
  layer_permission_precision_reduction: 'Map layer permission, reduced precision',
  field_mask: 'Field mask',
  field_mask_export_exclude: 'Field mask, excluded from exports',
  field_mask_export_query_exclude: 'Field mask, excluded from exports and queries',
  pseudonymise_ingest: 'Pseudonymised at ingest',
  pseudonymise_ingest_module_excluded: 'Pseudonymised at ingest, module excluded',
  tenant_deny_allowlist: 'Tenant allow-list',
  ingestion_validation: 'Blocked at ingestion',
  feature_flag_off: 'Feature switched off',
  not_ingested: 'Never ingested',
}

function humanise(id: string): string {
  const words = id.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function capabilityLabel(id: string): string {
  return CAPABILITY_LABELS[id] ?? humanise(id)
}

export function enforcementLabel(id: string): string {
  return ENFORCEMENT_LABELS[id] ?? humanise(id)
}
