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
  created_at: string
  updated_at: string
  last_fired_at: string | null
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

    // ── Health ─────────────────────────────────────────────────────
    health: () => api<HealthResponse>('/api/v1/notifications/_health/'),
  }
}

// Live WebSocket push is handled by useNotificationSocket (useNotificationSocket.ts).
// That composable supersedes the former useNotificationStream: it has proper
// 4001 auth-rejection handling, an intentional-close guard, proactive token
// refresh, a managed notifications list, and WS-based markRead.
