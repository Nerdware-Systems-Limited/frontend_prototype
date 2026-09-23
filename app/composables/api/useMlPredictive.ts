// app/composables/api/useMlPredictive.ts
// ─────────────────────────────────────────────────────────────────────
// M16 - AI Predictive Workbench: ML model registry + the "Ask" assistant.
//
// Backend: /api/v1/ml/models/, /api/v1/ml/ask/, /api/v1/ml/history/
//
// ask() calls the backend, which answers via OpenAI when OPENAI_API_KEY
// is configured server-side, or a rule-based fallback otherwise - either
// way it returns the same shape. `source` on the response tells you
// which path answered ('openai' | 'fallback').
// ─────────────────────────────────────────────────────────────────────

import { useApi } from './_client'

export type MlTaskType =
  | 'traffic_forecast'
  | 'safety_hotspot'
  | 'infra_deterioration'
  | 'demand_forecast'
  | 'anomaly_detection'

export interface MLModelRegistryEntry {
  id: string
  name: string
  version: string
  task_type: MlTaskType
  algorithm: string
  framework: string
  stage: 'production' | 'staging' | 'archived'
  accuracy_pct: number | null
  avg_latency_ms: number | null
  trained_at: string | null
  notes: string
}

export interface AskResult {
  answer: string
  source: 'openai' | 'fallback'
  model_used: string
  matched_topic: string
  rows: Record<string, unknown>[]
  total: number
  latency_ms: number
}

export interface AIQueryLogEntry {
  id: string
  question: string
  answer: string
  answered_by: 'openai' | 'fallback'
  model_used: string
  matched_topic: string
  row_count: number
  latency_ms: number
  asked_by_email: string | null
  created_at: string
}

export function useMlPredictive() {
  const api = useApi()
  return {
    models: (taskType?: MlTaskType): Promise<MLModelRegistryEntry[]> =>
      api<MLModelRegistryEntry[]>('/api/v1/ml/models/', {
        query: taskType ? { task_type: taskType } : undefined,
      }),
    ask: (question: string): Promise<AskResult> =>
      api<AskResult>('/api/v1/ml/ask/', { method: 'POST', body: { question } }),
    history: (): Promise<{ results: AIQueryLogEntry[] }> =>
      api<{ results: AIQueryLogEntry[] }>('/api/v1/ml/history/'),
  }
}
