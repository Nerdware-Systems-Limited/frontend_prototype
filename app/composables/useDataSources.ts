/**
 * useDataSources - single source of truth for "which agency does this data
 * come from, and how often is it updated" labels shown across the app.
 *
 * Values are taken from the agency UAPTS Needs Assessment questionnaires
 * (KeNHA, KURA, KeRRA, KRB, LAPSSET, KRC, KPA, KMA, NTSA, NaMATA, NCTTCA,
 * State Department for Roads / MTD). Where a questionnaire left the update
 * frequency unanswered, that is recorded as "Not specified" rather than
 * guessed - never invent a cadence a source document didn't state.
 */

export type SourceMode = 'live' | 'batch' | 'manual'

export interface DataSourceInfo {
  /** Short agency label, e.g. "KeNHA". */
  agency: string
  /** Named source system, if any (e.g. "DRIMS / ARICS"). */
  system?: string
  /** Human update cadence, verbatim or close to the questionnaire wording. */
  frequency: string
  mode: SourceMode
}

export const DATA_SOURCES: Record<string, DataSourceInfo> = {
  // ── Roads / traffic ──────────────────────────────────────────────────
  kenha_traffic:    { agency: 'KeNHA', system: 'ATC / Weighbridge', frequency: 'Continuous', mode: 'live' },
  kenha_condition:  { agency: 'KeNHA', system: 'DRIMS / ARICS', frequency: 'Annual survey (per financial year)', mode: 'batch' },
  kenha_blackspot:  { agency: 'KeNHA / NTSA TIMS', frequency: 'Updated quarterly', mode: 'batch' },
  kenha_maintenance:{ agency: 'KeNHA', frequency: 'Quarterly', mode: 'batch' },
  kura_network:     { agency: 'KURA', system: 'ArcGIS', frequency: 'Annually', mode: 'batch' },
  kura_traffic:     { agency: 'KURA', frequency: 'Quarterly', mode: 'batch' },
  kura_signals:     { agency: 'KURA Traffic Control Centre', frequency: 'Continuous', mode: 'live' },
  kura_axle_load:   { agency: 'KURA', system: 'KURAWeigh', frequency: 'Not specified', mode: 'batch' },
  kerra_condition:  { agency: 'KeRRA', frequency: 'Annually, and after major weather events', mode: 'batch' },
  kerra_network:    { agency: 'KeRRA', system: 'RMS', frequency: 'Incremental, after construction/rehabilitation projects', mode: 'batch' },
  krb_funding:      { agency: 'KRB (Kenya Roads Board)', frequency: 'Quarterly and annually', mode: 'batch' },
  sdr_network:      { agency: 'State Department for Roads', frequency: 'Quarterly and annually', mode: 'batch' },
  sdr_safety:       { agency: 'State Department for Roads', frequency: 'Monthly, quarterly and annually', mode: 'batch' },
  lapsset_projects: { agency: 'LAPSSET Corridor Authority', frequency: 'Ad hoc (project-based reporting)', mode: 'manual' },
  mtd_fleet:        { agency: 'MTD (State Dept. for Roads)', system: 'MECH', frequency: 'Not specified (manually updated)', mode: 'manual' },

  // ── Public transport / fleet ─────────────────────────────────────────
  ntsa_itims:       { agency: 'NTSA', system: 'iTIMS', frequency: 'Daily', mode: 'batch' },
  ntsa_ivms:        { agency: 'NTSA', system: 'IVMS', frequency: 'Not specified', mode: 'live' },
  ntsa_registry:    { agency: 'NTSA', system: 'iTIMS national vehicle registry', frequency: 'Not specified', mode: 'batch' },
  namata_planning:  { agency: 'NaMATA', frequency: 'As required (project/survey-based)', mode: 'manual' },
  namata_psv:       { agency: 'NaMATA', frequency: 'Not yet in place (no PSV tracking system)', mode: 'manual' },

  // ── Railway ───────────────────────────────────────────────────────────
  krc_passenger:    { agency: 'KRC', frequency: 'Daily', mode: 'batch' },
  krc_freight:      { agency: 'KRC', frequency: 'Daily', mode: 'batch' },
  krc_ctc:          { agency: 'KRC Control (CTC System)', frequency: 'Not specified (real-time operational)', mode: 'live' },

  // ── Maritime ──────────────────────────────────────────────────────────
  kpa_vport:        { agency: 'KPA', system: 'I-VPORT PMIS', frequency: 'Event-based (per port-call milestone)', mode: 'live' },
  kpa_vtmis:        { agency: 'KPA', system: 'VTMIS', frequency: 'Not specified (continuous monitoring)', mode: 'live' },
  kpa_cargo:        { agency: 'KPA', system: 'CATOS / MOST', frequency: 'Not specified', mode: 'batch' },
  kma_registry:     { agency: 'KMA', system: 'NAV 2018', frequency: 'Continuous', mode: 'live' },
  kma_performance:  { agency: 'KMA', frequency: 'Weekly', mode: 'batch' },

  // ── Aviation ──────────────────────────────────────────────────────────
  aviation_ops:     { agency: 'Airport Operations', frequency: 'Not specified', mode: 'batch' },

  // ── Corridor / regional ───────────────────────────────────────────────
  ncttca_kpi:       { agency: 'NCTTCA Transport Observatory', frequency: 'Monthly (some indicators quarterly/annual)', mode: 'batch' },

  // ── Safety (cross-agency) ────────────────────────────────────────────
  safety_incidents: { agency: 'NTSA / Police reports', frequency: 'Not specified', mode: 'batch' },
} as const

const FALLBACK: DataSourceInfo = { agency: 'UAPTS', frequency: 'Not specified', mode: 'batch' }

export function useDataSources() {
  function meta(key: string): DataSourceInfo {
    return DATA_SOURCES[key] ?? FALLBACK
  }

  /** e.g. "KeNHA · DRIMS / ARICS · Annual survey (per financial year)" */
  function sourceLabel(key: string): string {
    const m = meta(key)
    return [m.agency, m.system, m.frequency].filter(Boolean).join(' · ')
  }

  return { DATA_SOURCES, meta, sourceLabel }
}
