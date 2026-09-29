/**
 * Pure dashboard resolution - which dashboard does this viewer get?
 *
 * The backend (apps/dashboards/resolver.py) is the authority and runs the
 * same algorithm. This copy powers the editor's "Preview as…" panel and the
 * assignment-conflict warnings without a round trip. Keep the two in sync;
 * tests/resolver.spec.ts and tests/test_resolver.py share the same fixtures.
 *
 * Algorithm
 *   1. Keep assignments whose dashboard is published and whose date window
 *      contains `now`.
 *   2. Keep the ones that MATCH the viewer (see matches()).
 *   3. Walk SCOPE_PRECEDENCE from least specific to most specific. At each
 *      level, the highest-priority match becomes the candidate - unless a
 *      locked assignment was already found at a broader level, in which case
 *      narrower levels are ignored. (Locks flow downward: an agency head can
 *      force a dashboard on all their departments.)
 *   4. The last candidate standing wins.
 */
import {
  SCOPE_PRECEDENCE,
  type DashboardAssignment, type DashboardSummary, type ScopeType, type ViewerContext,
} from '~/types/dashboard'

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

export function matches(a: DashboardAssignment, v: ViewerContext): boolean {
  const parts = a.scopeValue.split(':').map(norm)
  const agency = norm(v.agencyCode)
  const dept = norm(v.departmentCode)
  const roles = v.roles.map(norm)

  switch (a.scopeType) {
    case 'global':
      return true
    case 'agency':
      return parts[0] === agency
    case 'role':
      // "analyst" (any agency) or "NTSA:analyst" (agency-qualified)
      return parts.length === 1
        ? roles.includes(parts[0]!)
        : parts[0] === agency && roles.includes(parts[1]!)
    case 'department':
      return parts[0] === agency && parts[1] === dept
    case 'role_in_department':
      return parts[0] === agency && parts[1] === dept && roles.includes(parts[2]!)
    case 'user':
      return parts[0] === norm(v.userId)
  }
}

function inWindow(a: DashboardAssignment, now: Date): boolean {
  if (a.activeFrom && new Date(a.activeFrom) > now) return false
  if (a.activeUntil && new Date(a.activeUntil) < now) return false
  return true
}

export interface ResolutionStep {
  scopeType: ScopeType
  assignment: DashboardAssignment
  dashboard: DashboardSummary
  outcome: 'won' | 'overridden' | 'blocked-by-lock' | 'lower-priority'
}

export interface ResolutionResult {
  winner: { dashboard: DashboardSummary; assignment: DashboardAssignment } | null
  /** Every matching assignment and what happened to it - shown in "Preview as". */
  trace: ResolutionStep[]
}

export function resolveDashboard(
  dashboards: DashboardSummary[],
  viewer: ViewerContext,
  now = new Date(),
): ResolutionResult {
  const byId = new Map(dashboards.map(d => [d.id, d]))
  const candidates = dashboards
    .filter(d => d.status === 'published')
    .flatMap(d => d.assignments)
    .filter(a => inWindow(a, now) && matches(a, viewer))

  const trace: ResolutionStep[] = []
  let current: DashboardAssignment | null = null
  let locked = false

  // broad -> narrow
  for (const level of [...SCOPE_PRECEDENCE].reverse()) {
    const atLevel = candidates
      .filter(a => a.scopeType === level)
      .sort((x, y) => y.priority - x.priority)
    if (!atLevel.length) continue

    atLevel.forEach((a, i) => {
      const dashboard = byId.get(a.dashboardId)!
      if (locked) { trace.push({ scopeType: level, assignment: a, dashboard, outcome: 'blocked-by-lock' }); return }
      if (i > 0) { trace.push({ scopeType: level, assignment: a, dashboard, outcome: 'lower-priority' }); return }
      if (current) {
        const prev = trace.find(t => t.assignment.id === current!.id)
        if (prev) prev.outcome = 'overridden'
      }
      current = a
      trace.push({ scopeType: level, assignment: a, dashboard, outcome: 'won' })
    })
    if (current && (current as DashboardAssignment).locked) locked = true
  }

  const win = current as DashboardAssignment | null
  return {
    winner: win ? { dashboard: byId.get(win.dashboardId)!, assignment: win } : null,
    // present narrow -> broad, the way admins read it
    trace: trace.reverse(),
  }
}

export const SCOPE_LABELS: Record<ScopeType, string> = {
  user: 'Individual user',
  role_in_department: 'Role within a department',
  department: 'Department',
  role: 'Role',
  agency: 'Agency',
  global: 'Everyone',
}

/** Human-readable audience, e.g. "Analysts in KeNHA · Maintenance". */
export function describeScope(a: Pick<DashboardAssignment, 'scopeType' | 'scopeValue'>): string {
  const p = a.scopeValue.split(':')
  switch (a.scopeType) {
    case 'global': return 'Everyone'
    case 'agency': return `All of ${p[0]}`
    case 'role': return p.length === 1 ? `Every ${p[0]}` : `${p[1]}s in ${p[0]}`
    case 'department': return `${p[0]} · ${p[1]}`
    case 'role_in_department': return `${p[2]}s in ${p[0]} · ${p[1]}`
    case 'user': return `User ${p[0]}`
  }
}
