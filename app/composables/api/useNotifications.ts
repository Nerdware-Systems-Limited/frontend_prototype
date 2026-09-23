// app/composables/api/useNotifications.ts
// ─────────────────────────────────────────────────────────────────────
// M11 - Event-Driven Notifications (Mongo-backed).
//
// Backend mounted at /api/v1/notifications/. Two collections:
//
//   * /api/v1/notifications/         per-user feed
//     GET    /                  list current user's
//     GET    /unread-count/     {count: N}
//     POST   /read-all/         mark all read
//     GET    /<id>/             retrieve one
//     POST   /<id>/read/        mark one read
//     DELETE /<id>/             delete one
//     POST   /notify/           ad-hoc (admin only)
//
//   * /api/v1/notifications/rules/  alert rules (admin only)
//     GET    /                  list
//     POST   /                  create
//     GET    /<id>/             retrieve
//     PUT    /<id>/             update
//     PATCH  /<id>/             partial update
//     DELETE /<id>/             delete
//
//   * /api/v1/notifications/_health/  Mongo backend status
//
// Live WebSocket push is at ws(s)://<host>/ws/notifications/ - see
// the `useNotificationStream` composable below for the client side.
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

// ── Domain types (mirror backend services.py + serializers.py) ─────

export type Severity = 'critical' | 'high' | 'warning' | 'info'
export type Channel = 'in_app' | 'websocket' | 'email' | 'sms'

export interface Notification {
  id: string
  user_id: string
  /** Array form of user_id for multi-recipient rule fan-out (e.g. rules targeting a role). */
  user_id_any?: string[]
  event_type: string
  rule_id?: string | null
  severity: Severity
  title: string
  body: string
  context: Record<string, any>
  channels: Channel[]
  delivered: Partial<Record<Channel, { status: string; at?: string; error?: string }>>
  read: boolean
  read_at: string | null
  created_at: string
  expires_at?: string | null
}

export type ConditionOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains'

export interface LeafCondition {
  field: string
  op: ConditionOp
  value: any
}
export interface CompositeCondition {
  all?: Condition[]
  any?: Condition[]
}
export type Condition = LeafCondition | CompositeCondition

export interface AlertRule {
  id: string
  name: string
  event_type: string
  condition?: Condition | null
  severity: Severity
  channels: Channel[]
  target_roles: string[]
  target_user_ids: string[]
  message_template: string
  cooldown_seconds: number
  active: boolean
  /** Optional EscalationPolicy.id - when set, each firing opens an EscalationRun. */
  escalation_policy_id?: string | null
  created_at: string
  updated_at: string
  last_fired_at: string | null
}

// ── Escalation workflows (real Postgres models - see backend
// apps.notifications.models.EscalationPolicy/Step/Run) ───────────────

export interface EscalationStep {
  id: string
  order: number
  title: string
  description: string
  channels: Channel[]
  target_role: string
  wait_minutes: number
  is_emergency: boolean
}

export interface EscalationPolicy {
  id: string
  name: string
  description: string
  is_active: boolean
  steps: EscalationStep[]
  created_at: string
  updated_at: string
}

export type EscalationRunStatus = 'pending' | 'acknowledged' | 'escalated' | 'emergency'

export interface EscalationRun {
  id: string
  policy: string | null
  policy_name: string
  notification_ref: string
  rule_id: string
  rule_name: string
  title: string
  current_step_index: number
  current_step: EscalationStep | null
  policy_steps_count: number
  status: EscalationRunStatus
  acknowledged_by_email: string | null
  acknowledged_at: string | null
  escalated_at: string | null
  created_at: string
}

export interface EscalationQuickStats {
  acknowledged_1h: number
  escalated_1h: number
  emergency_1h: number
}

// ── Admin-facing stats + recent activity (Alert Rules page) ─────────

export interface AlertStats {
  alerts_sent_24h: number
  active_rules: number
  avg_delivery_seconds: number | null
  delivery_rate_pct: number | null
}

export interface AlertActivityItem extends Notification {
  rule_name: string | null
  recipient_email: string | null
}

// ── API request/response envelopes ──────────────────────────────────

export interface NotificationListResponse {
  count: number
  unread_count?: number
  limit: number
  skip: number
  results: Notification[]
}

export interface UnreadCountResponse {
  count: number
}

export interface MarkReadResponse {
  id: string
  read: boolean
  unread_count: number
}

export interface MarkAllReadResponse {
  modified: number
  unread_count: number
}

export interface AlertRuleListResponse {
  count: number
  limit: number
  skip: number
  results: AlertRule[]
}

export interface NotifyRequest {
  user_id: string
  title: string
  body: string
  event_type?: string
  severity?: Severity
  context?: Record<string, any>
  channels?: Channel[]
}

export interface CreateRuleRequest {
  name: string
  event_type: string
  condition?: Condition | null
  severity?: Severity
  channels?: Channel[]
  target_roles?: string[]
  target_user_ids?: string[]
  message_template?: string
  cooldown_seconds?: number
  active?: boolean
  escalation_policy_id?: string | null
}

export interface EscalationStepInput {
  order?: number
  title: string
  description?: string
  channels?: Channel[]
  target_role?: string
  wait_minutes?: number
  is_emergency?: boolean
}

export interface EscalationPolicyRequest {
  name: string
  description?: string
  is_active?: boolean
  steps?: EscalationStepInput[]
}

export interface HealthResponse {
  enabled: boolean
  status: 'ok' | 'error' | 'disabled'
  error?: string
}

export interface NotificationQuery {
  unread?: boolean
  limit?: number
  skip?: number
}

export interface RuleQuery {
  event_type?: string
  active?: boolean
  limit?: number
  skip?: number
}

// ── Composable ──────────────────────────────────────────────────────

export function useNotifications() {
  const api = useApi()

  return {
    // ── Per-user feed ─────────────────────────────────────────────
    list: (q?: NotificationQuery) =>
      api<NotificationListResponse>('/api/v1/notifications/', {
        query: cleanQuery({
          unread: q?.unread ? 'true' : undefined,
          limit: q?.limit,
          skip: q?.skip,
        } as Record<string, unknown>),
      }),

    get: (id: string) =>
      api<Notification>(`/api/v1/notifications/${id}/`),

    unreadCount: () =>
      api<UnreadCountResponse>('/api/v1/notifications/unread-count/'),

    markRead: (id: string) =>
      api<MarkReadResponse>(`/api/v1/notifications/${id}/read/`, {
        method: 'POST',
      }),

    markAllRead: () =>
      api<MarkAllReadResponse>('/api/v1/notifications/read-all/', {
        method: 'POST',
        body: {},
      }),

    delete: (id: string) =>
      api<void>(`/api/v1/notifications/${id}/`, { method: 'DELETE' }),

    // ── Admin: ad-hoc notify ──────────────────────────────────────
    notify: (req: NotifyRequest) =>
      api<Notification>('/api/v1/notifications/notify/', {
        method: 'POST',
        body: req,
      }),

    // ── Admin: alert rules ────────────────────────────────────────
    rules: {
      list: (q?: RuleQuery) =>
        api<AlertRuleListResponse>('/api/v1/notifications/rules/', {
          query: cleanQuery({
            event_type: q?.event_type,
            active: q?.active === false ? 'false' : undefined,
            limit: q?.limit,
            skip: q?.skip,
          } as Record<string, unknown>),
        }),
      get: (id: string) =>
        api<AlertRule>(`/api/v1/notifications/rules/${id}/`),
      create: (req: CreateRuleRequest) =>
        api<AlertRule>('/api/v1/notifications/rules/', {
          method: 'POST',
          body: req,
        }),
      update: (id: string, req: Partial<CreateRuleRequest>) =>
        api<AlertRule>(`/api/v1/notifications/rules/${id}/`, {
          method: 'PATCH',
          body: req,
        }),
      delete: (id: string) =>
        api<void>(`/api/v1/notifications/rules/${id}/`, { method: 'DELETE' }),
    },

    // ── Admin: stats + recent activity (Alert Rules page) ──────────
    stats: () => api<AlertStats>('/api/v1/notifications/stats/'),
    activity: (limit = 50) =>
      api<{ results: AlertActivityItem[] }>('/api/v1/notifications/activity/', {
        query: { limit },
      }),

    // ── Admin: escalation workflows ─────────────────────────────────
    escalation: {
      policies: {
        list: () =>
          api<{ results: EscalationPolicy[] }>('/api/v1/notifications/escalation-policies/'),
        create: (req: EscalationPolicyRequest) =>
          api<EscalationPolicy>('/api/v1/notifications/escalation-policies/', {
            method: 'POST',
            body: req,
          }),
        update: (id: string, req: Partial<EscalationPolicyRequest>) =>
          api<EscalationPolicy>(`/api/v1/notifications/escalation-policies/${id}/`, {
            method: 'PATCH',
            body: req,
          }),
        delete: (id: string) =>
          api<void>(`/api/v1/notifications/escalation-policies/${id}/`, { method: 'DELETE' }),
      },
      runs: {
        list: (status?: EscalationRunStatus) =>
          api<{ results: EscalationRun[] }>('/api/v1/notifications/escalation-runs/', {
            query: cleanQuery({ status } as Record<string, unknown>),
          }),
        acknowledge: (id: string) =>
          api<EscalationRun>(`/api/v1/notifications/escalation-runs/${id}/acknowledge/`, { method: 'POST' }),
        escalate: (id: string) =>
          api<EscalationRun>(`/api/v1/notifications/escalation-runs/${id}/escalate/`, { method: 'POST' }),
        quickStats: () =>
          api<EscalationQuickStats>('/api/v1/notifications/escalation-runs/quick-stats/'),
      },
    },

    // ── Health ─────────────────────────────────────────────────────
    health: () => api<HealthResponse>('/api/v1/notifications/_health/'),
  }
}

// Live WebSocket push is handled by useNotificationSocket (useNotificationSocket.ts).
// That composable supersedes the former useNotificationStream: it has proper
// 4001 auth-rejection handling, an intentional-close guard, proactive token
// refresh, a managed notifications list, and WS-based markRead.
