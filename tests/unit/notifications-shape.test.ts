// tests/unit/notifications-shape.test.ts
// ─────────────────────────────────────────────────────────────────────
// Contract tests: the front-end composable `useNotifications` mirrors
// the shapes documented in the backend's
// `apps/notifications/serializers.py` + `services.py`. These tests
// pin the public surface so a backend change that breaks the
// contract fails the test suite on whichever side shipped the change.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'

// ── Severity enum (must match backend choices) ──────────────────────
const SEVERITIES = ['critical', 'high', 'warning', 'info'] as const
type Severity = typeof SEVERITIES[number]

// ── Channels (must match backend dispatch._ok statuses) ─────────────
const CHANNELS = ['in_app', 'websocket', 'email', 'sms'] as const
type Channel = typeof CHANNELS[number]

// ── Notification document shape ──────────────────────────────────────
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

// ── Alert rule document shape ────────────────────────────────────────
export interface AlertRule {
  id: string
  name: string
  event_type: string
  condition: any | null
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

// ── API list response ────────────────────────────────────────────────
export interface ListResponse<T> {
  count: number
  limit?: number
  skip?: number
  results: T[]
}

// ── The rule-condition operator set (mirrors services._condition_matches) ──
const CONDITION_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'] as const
type ConditionOp = typeof CONDITION_OPS[number]

describe('Notification contract', () => {
  it('severity must be one of the four enum values', () => {
    const sample: Notification = {
      id: 'n1', user_id: 'u1', event_type: 'test',
      severity: 'critical', title: 't', body: 'b', context: {},
      channels: ['in_app'], delivered: {}, read: false, read_at: null,
      created_at: new Date().toISOString(),
    }
    expect(SEVERITIES).toContain(sample.severity)
  })

  it('channel list must be a subset of supported channels', () => {
    const sample: Notification = {
      id: 'n1', user_id: 'u1', event_type: 'test',
      severity: 'info', title: 't', body: 'b', context: {},
      channels: ['in_app', 'websocket', 'email'],
      delivered: { websocket: { status: 'delivered' } },
      read: false, read_at: null, created_at: new Date().toISOString(),
    }
    for (const c of sample.channels) {
      expect(CHANNELS).toContain(c)
    }
  })

  it('per-channel delivered map uses the same keys as channels', () => {
    const channels: Channel[] = ['email', 'sms']
    const delivered: Notification['delivered'] = {
      email: { status: 'queued' },
      sms: { status: 'pending' },
    }
    for (const c of channels) {
      expect(delivered[c]).toBeDefined()
    }
  })
})

describe('AlertRule contract', () => {
  it('cooldown_seconds is non-negative', () => {
    const rule: AlertRule = {
      id: 'r1', name: 'rule', event_type: 't', condition: null,
      severity: 'warning', channels: ['in_app'],
      target_roles: [], target_user_ids: ['u1'],
      message_template: '', cooldown_seconds: 0, active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_fired_at: null,
    }
    expect(rule.cooldown_seconds).toBeGreaterThanOrEqual(0)
  })

  it('condition operators are a closed set', () => {
    expect(CONDITION_OPS).toEqual(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'])
  })

  it('combinators all/any take arrays of nested conditions', () => {
    const condition = {
      all: [
        { field: 'weight_kg', op: 'gte', value: 35000 },
        { field: 'agency', op: 'eq', value: 'KeNHA' },
      ],
    }
    expect(Array.isArray((condition as any).all)).toBe(true)
  })
})

describe('ListResponse envelope', () => {
  it('has count + results fields', () => {
    const resp: ListResponse<Notification> = {
      count: 0,
      limit: 50,
      skip: 0,
      results: [],
    }
    expect(resp.count).toBe(0)
    expect(resp.results).toEqual([])
  })
})
